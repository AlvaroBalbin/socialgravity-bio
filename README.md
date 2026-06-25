# socialgravity-bio

First-party link-in-bio page for a SocialGravity twin, with the **instant
greeting** built in: the moment a visitor commits, the twin speaks a
pre-rendered opener in its OWN cloned voice (zero generation latency) while the
worker cedes its own greeting.

No build step. Edit the files, push, deploy as a static site (GitHub Pages,
Vercel, any host). Imports `livekit-client` from a CDN.

## Why this exists (architecture)

Every surface that lets someone talk to a twin (the website twin room, the
website embed, this bio page, future per-context clones) needs the same thing:
anon session -> `livekit-token` -> a LiveKit room -> mic/text/audio -> the
instant cloned-voice greeting. When each surface reimplements that, they drift
and silently regress (this bio page shipped with no greeting at all; the worker
skip got dropped by an unrelated deploy).

So the voice logic lives in ONE reusable, framework-agnostic runtime:

- **`twin-voice.js`** is the canonical runtime. It is the single source of truth
  for "talk to a twin from any web surface." It has no framework dependency and
  no build step, so any page (or the React app, eventually) can consume it. It
  can be pinned by version from a CDN (e.g. jsDelivr serves a tagged release of
  this repo) so a consumer never silently drifts.
- **`index.html` + `app.js`** are the bio PAGE: presentation only. They are the
  first consumer of the runtime and double as the live bio.

The server side is already shared and live: `livekit-token` (stamps
`skip_spoken_greeting`), `twin-greeting-clip` (pre-renders the opener in the
twin's cloned voice, both CORS `*`), and the LiveKit worker (cedes its spoken
greeting when it sees the flag, records the clip's line in `chat_ctx`).

## The instant-greeting contract (and its safety invariant)

1. On first traffic intent, fetch the clip (`twin-greeting-clip`) and confirm it
   actually decodes in this browser.
2. Send `client_greeting` + `client_greeting_text` to `livekit-token` ONLY when
   the clip is confirmed playable.
3. On connect, play the cached clip client-side; the worker stays silent.

Invariant: **no playable clip means no flag means the worker greets itself, exactly
as before.** The instant path can never leave the visitor in silence; worst case
it falls back to the normal worker greeting. The clip plays only when the worker
was actually told to skip, so there is never a double greeting either.

## Config

Edit `config.js`:
- `AGENT_ID` selects the twin (default: Alvaro `b8de3cea-...`).
- `SUPABASE_URL` / `SUPABASE_ANON` are the public project URL + publishable key.
- `GREETING_TEXT` is the default opener wording.

## Run locally

It is plain static files. Serve the folder over http (ES modules need http, not
`file://`):

```
npx serve .            # or: python -m http.server 8000
```

Open the printed URL on a phone (or desktop) and tap **Talk**.

## iOS note (in-app browsers)

The clone speaking aloud, the page, links, page-awareness, and text chat all work
inside Instagram's in-app browser. The visitor's live microphone is the only part
iOS gates in-app; `enableMic()` returns false there, and the page stays usable
(text + the twin still greets aloud). A native-recorder push-to-talk or an
optional Safari upgrade covers full hands-free voice where the in-app webview
blocks the mic.
