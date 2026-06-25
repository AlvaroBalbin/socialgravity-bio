// twin-voice.js
// Self-contained first-party voice runtime for a SocialGravity twin, with the
// INSTANT GREETING built in. No build step: imports livekit-client from a CDN.
//
// The instant greeting is the same mechanism shipped on the website
// (useCartesiaSandbox): pre-render the opener once in the twin's OWN cloned
// voice, confirm it is playable in this browser, tell the worker (via
// livekit-token -> room metadata: skip_spoken_greeting) NOT to speak its own
// opener, and play the cached clip client-side the instant we connect. The
// worker records the clip's exact line in chat_ctx so it doesn't re-greet.
//
// SAFETY INVARIANT (same as the website): the skip flag is sent ONLY when the
// clip is confirmed playable. No playable clip => no flag => the worker greets
// itself exactly as before. So the instant path can never leave the visitor in
// silence; worst case it falls back to the normal worker greeting.

import { Room, RoomEvent, Track } from "https://esm.sh/livekit-client@2.17.3";

export class TwinVoice {
  /**
   * @param {object} cfg  { SUPABASE_URL, SUPABASE_ANON, AGENT_ID, GREETING_TEXT }
   * @param {object} handlers  optional callbacks:
   *   onStatus(state)            "idle"|"warming"|"connecting"|"live"|"error"
   *   onCaption(text|null)       live caption (twin speech / greeting line)
   *   onMessage({role,text})     committed transcript line
   *   onMicState(bool)           visitor mic on/off
   *   onError(message)
   */
  constructor(cfg, handlers = {}) {
    this.cfg = cfg;
    this.h = handlers;
    this.room = null;
    this.jwt = null;
    this.greetingClip = null; // {url,text} only when CONFIRMED playable
    this.connectGreetingSkip = false;
    this.warmed = false;
    this.audioEl = null; // hidden <audio> the twin's track attaches to
    this._activeLink = null; // optional page-awareness: the link the visitor is viewing
  }

  // ---- public API ---------------------------------------------------------

  /** Call on first traffic intent (scroll/touch). Idempotent. Fetches +
   *  confirms the greeting clip so it's ready before the visitor taps. */
  async warm() {
    if (this.warmed) return;
    this.warmed = true;
    this._status("warming");
    await this._ensureSession().catch(() => {});
    await this._fetchGreetingClip().catch(() => {});
    this._status(this.room ? "live" : "idle");
  }

  /** Connect to the twin and start the conversation (call on the visitor's
   *  tap so mic + audio autoplay are inside a user gesture). */
  async connect({ withMic = true } = {}) {
    if (this.room) return;
    this._status("connecting");
    try {
      await this._ensureSession();
      // If warm() hasn't finished, fetch the clip now (best effort, bounded).
      if (!this.greetingClip && !this.warmed) await this._fetchGreetingClip().catch(() => {});

      const body = this._tokenBody();
      // The clip plays only if THIS connection told the worker to skip.
      this.connectGreetingSkip = !!body.client_greeting;

      const tok = await this._post("livekit-token", body, /*useJwt*/ true);
      if (!tok?.ok || !tok.token || !tok.url || !tok.room) {
        throw new Error(tok?.error || "livekit-token failed");
      }

      const room = new Room({ adaptiveStream: true, dynacast: true });
      this.room = room;

      // Hidden audio sink for the twin's voice.
      if (!this.audioEl) {
        this.audioEl = document.createElement("audio");
        this.audioEl.autoplay = true;
        this.audioEl.setAttribute("playsinline", "");
        this.audioEl.style.display = "none";
        document.body.appendChild(this.audioEl);
      }

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          track.attach(this.audioEl);
          this.audioEl.play?.().catch(() => {});
        }
      });
      room.on(RoomEvent.TranscriptionReceived, (segs, participant) => {
        // Ignore our own (visitor) STT echo; show the twin's words.
        const mine = participant?.identity === room.localParticipant?.identity;
        if (mine) return;
        const text = (segs || []).map((s) => s.text).join(" ").trim();
        if (text) this._caption(text);
      });
      room.on(RoomEvent.Disconnected, () => {
        this._status("idle");
        this.room = null;
      });

      await room.connect(tok.url, tok.token);
      try { await room.startAudio(); } catch { /* unlocked by the tap */ }

      // INSTANT GREETING: play the cached cloned-voice clip the moment we
      // connect, but ONLY if the worker was told to skip (else it greets
      // itself and we'd double up).
      if (this.connectGreetingSkip && this.greetingClip?.url) {
        const a = new Audio(this.greetingClip.url);
        a.setAttribute("playsinline", "");
        const line = this.greetingClip.text;
        this._caption(line);
        a.addEventListener("ended", () => {
          this._caption(null);
          this.h.onMessage?.({ role: "twin", text: line });
        }, { once: true });
        a.addEventListener("error", () => this._caption(null), { once: true });
        a.play().catch(() => { /* if blocked, worker still has the chat_ctx line */ });
      }

      if (withMic) await this.enableMic().catch(() => {});
      this._status("live");
    } catch (e) {
      this._status("error");
      this.h.onError?.(String(e?.message || e));
      this.room = null;
    }
  }

  /** Turn the visitor's mic on. On iOS in-app browsers this may be blocked;
   *  callers can fall back to text or a native-recorder push-to-talk. */
  async enableMic() {
    if (!this.room) return false;
    try {
      await this.room.localParticipant.setMicrophoneEnabled(true);
      this.h.onMicState?.(true);
      return true;
    } catch (e) {
      this.h.onMicState?.(false);
      this.h.onError?.("mic blocked: " + String(e?.message || e));
      return false;
    }
  }

  async muteMic() {
    if (!this.room) return;
    try { await this.room.localParticipant.setMicrophoneEnabled(false); } catch { /* noop */ }
    this.h.onMicState?.(false);
  }

  /** Send a typed message over the data channel (text mode). */
  sendText(text) {
    const t = (text || "").trim();
    if (!t || !this.room) return;
    const payload = JSON.stringify({ type: "user_text", text: t, ts: Date.now() });
    this.room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
    this.h.onMessage?.({ role: "visitor", text: t });
  }

  /** Optional page-awareness: tell the twin which link the visitor is viewing
   *  so retrieval can lean into that destination (Layer 2 on the worker). */
  setActiveLink(linkId) {
    this._activeLink = linkId || null;
    if (this.room) {
      const payload = JSON.stringify({ type: "active_link", link_id: this._activeLink, ts: Date.now() });
      try { this.room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true }); } catch { /* noop */ }
    }
  }

  async disconnect() {
    try { await this.room?.disconnect(); } catch { /* noop */ }
    this.room = null;
    this._caption(null);
    this._status("idle");
  }

  // ---- internals ----------------------------------------------------------

  _tokenBody() {
    return {
      agent_id: this.cfg.AGENT_ID,
      source: "bio",
      ...(this._activeLink ? { active_link_id: this._activeLink } : {}),
      // Send the skip flag ONLY when the clip is confirmed playable.
      ...(this.greetingClip
        ? { client_greeting: true, client_greeting_text: this.greetingClip.text }
        : {}),
    };
  }

  async _ensureSession() {
    if (this.jwt) return this.jwt;
    // Reuse an anon session across reloads so we don't mint a new user each time.
    const cached = sessionStorage.getItem("sg_bio_jwt");
    if (cached) { this.jwt = cached; return cached; }
    const r = await fetch(`${this.cfg.SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: this.cfg.SUPABASE_ANON, "Content-Type": "application/json" },
      body: "{}",
    });
    const d = await r.json();
    if (!d?.access_token) throw new Error("anon session failed");
    this.jwt = d.access_token;
    try { sessionStorage.setItem("sg_bio_jwt", this.jwt); } catch { /* noop */ }
    return this.jwt;
  }

  async _fetchGreetingClip() {
    if (this.greetingClip) return;
    const d = await this._post("twin-greeting-clip", { agent_id: this.cfg.AGENT_ID }, /*useJwt*/ false);
    if (!(d?.ok && d.url && d.text)) return; // no cloned voice / failure -> worker greets
    const playable = await this._confirmPlayable(d.url);
    if (playable) this.greetingClip = { url: d.url, text: d.text };
  }

  _confirmPlayable(url) {
    return new Promise((resolve) => {
      let done = false;
      const fin = (ok) => { if (!done) { done = true; clearTimeout(t); resolve(ok); } };
      const t = setTimeout(() => fin(false), 3000);
      try {
        const a = new Audio();
        a.preload = "auto";
        a.muted = true;
        a.addEventListener("loadeddata", () => fin(true), { once: true });
        a.addEventListener("canplaythrough", () => fin(true), { once: true });
        a.addEventListener("error", () => fin(false), { once: true });
        a.src = url;
        a.load();
      } catch { fin(false); }
    });
  }

  async _post(fn, body, useJwt) {
    const bearer = useJwt ? this.jwt : this.cfg.SUPABASE_ANON;
    const r = await fetch(`${this.cfg.SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        apikey: this.cfg.SUPABASE_ANON,
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return r.json();
  }

  _status(s) { this.h.onStatus?.(s); }
  _caption(t) { this.h.onCaption?.(t ?? null); }
}
