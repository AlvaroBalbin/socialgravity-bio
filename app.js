// app.js: wires the bio page UI to the shared TwinVoice runtime.
// This file is the PAGE (presentation). All the voice/twin logic lives in the
// reusable runtime (twin-voice.js), so the page stays thin.
import { CONFIG } from "./config.js";
import { TwinVoice } from "./twin-voice.js";

const $ = (id) => document.getElementById(id);
const dock = $("dock");
const statusEl = $("status");
const captionEl = $("caption");
const talkBtn = $("talkBtn");
const textForm = $("textForm");
const textInput = $("textInput");
const log = $("log");

const twin = new TwinVoice(CONFIG, {
  onStatus(s) {
    dock.dataset.state = s;
    const label = {
      idle: "Tap to talk to my twin",
      warming: "Tap to talk to my twin",
      connecting: "Connecting…",
      live: "Listening, talk to me",
      error: "Tap to retry",
    }[s] || s;
    statusEl.textContent = label;
    talkBtn.dataset.state = s;
  },
  onCaption(t) {
    captionEl.textContent = t || "";
    captionEl.classList.toggle("show", !!t);
  },
  onMessage({ role, text }) {
    const li = document.createElement("div");
    li.className = "msg " + role;
    li.textContent = text;
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
  },
  onMicState(on) { talkBtn.classList.toggle("mic-on", on); },
  onError(m) { console.warn("[twin]", m); },
});

// Warm (fetch + confirm the greeting clip, mint the anon session) on the FIRST
// sign of traffic intent, so an idle view costs nothing but a real visitor finds
// the clip ready by the time they tap.
let warmed = false;
const warm = () => {
  if (warmed) return;
  warmed = true;
  twin.warm();
  ["pointerdown", "touchstart", "keydown", "scroll"].forEach((e) =>
    window.removeEventListener(e, warm, true));
};
["pointerdown", "touchstart", "keydown", "scroll"].forEach((e) =>
  window.addEventListener(e, warm, e === "scroll" ? { capture: true, passive: true } : true));

// Tap the dock: connect + mic (inside the user gesture so audio + mic unlock).
talkBtn.addEventListener("click", async () => {
  const s = dock.dataset.state;
  if (s === "live") { await twin.muteMic(); return; }
  await twin.connect({ withMic: true });
});

// Text mode.
textForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = textInput.value;
  textInput.value = "";
  if (!twin.room) { twin.connect({ withMic: false }).then(() => twin.sendText(v)); }
  else twin.sendText(v);
});

// Page-awareness: when the visitor opens a link, tell the twin which one so it
// can lean into that destination (the worker indexes link destinations).
document.querySelectorAll("a[data-link-id]").forEach((a) => {
  a.addEventListener("pointerenter", () => twin.setActiveLink(a.dataset.linkId));
  a.addEventListener("focus", () => twin.setActiveLink(a.dataset.linkId));
});
