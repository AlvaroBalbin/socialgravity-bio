// app.js: fetches the twin's page data (twin_pages + twin_page_links), renders
// it, applies the theme, and wires the bottom-bar voice dock to the shared
// TwinVoice runtime. Data-driven, so pointing CONFIG.AGENT_ID at another twin
// renders that twin's page. Falls back to CONFIG.FALLBACK if the fetch is slow
// or fails, so the page always renders.
import { CONFIG } from "./config.js";
import { TwinVoice } from "./twin-voice.js";

const $ = (id) => document.getElementById(id);

// ---- render the page from page data --------------------------------------
function applyTheme(p) {
  if (!p) return;
  const r = document.documentElement.style;
  const pal = p.palette || {};
  const set = (k, v) => v && r.setProperty(k, v);
  set("--canvas", pal.canvas); set("--surface", pal.surface); set("--ink", pal.ink);
  set("--ink-muted", pal.inkMuted); set("--line", pal.line); set("--accent", pal.accent);
  set("--accent-contrast", pal.accentContrast || "#ffffff");
}

function render(p) {
  if (!p) return;
  applyTheme(p);
  if (p.avatar_url) { const a = $("avatar"); a.src = p.avatar_url; a.alt = p.display_name || ""; }
  $("name").textContent = p.display_name || "";
  $("tagline").textContent = p.tagline || "";
  $("bio").textContent = p.bio || "";
  if (p.display_name) document.title = p.display_name;
  $("talkLabel").textContent = p.prompt_title || "Talk to me";
  $("ptitle").textContent = p.prompt_sub || "";
  const wrap = $("links");
  wrap.innerHTML = "";
  for (const l of (p.links || [])) {
    if (l.enabled === false) continue;
    const a = document.createElement("a");
    a.href = l.url; a.target = "_blank"; a.rel = "noopener";
    a.dataset.linkId = l.id || l.label;
    a.innerHTML = `<div class="lab"></div>${l.subtitle ? '<div class="sub"></div>' : ""}`;
    a.querySelector(".lab").textContent = l.label || l.url;
    if (l.subtitle) a.querySelector(".sub").textContent = l.subtitle;
    wrap.appendChild(a);
  }
  wireLinkAwareness();
}

// Live fetch of the twin's page (replaces the embedded fallback when it lands).
async function fetchPage() {
  const base = `${CONFIG.SUPABASE_URL}/rest/v1`;
  const h = { apikey: CONFIG.SUPABASE_ANON, Authorization: `Bearer ${CONFIG.SUPABASE_ANON}` };
  try {
    const pr = await fetch(`${base}/twin_pages?agent_id=eq.${CONFIG.AGENT_ID}&select=id,display_name,tagline,bio,avatar_url,theme&limit=1`, { headers: h });
    const rows = await pr.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    const lr = await fetch(`${base}/twin_page_links?page_id=eq.${row.id}&enabled=eq.true&select=id,position,label,subtitle,url,kind&order=position.asc`, { headers: h });
    const links = await lr.json().catch(() => []);
    const t = row.theme || {};
    return {
      display_name: row.display_name,
      tagline: row.tagline,
      bio: row.bio,
      avatar_url: row.avatar_url,
      prompt_title: t?.clone?.promptTitle || "Talk to me",
      prompt_sub: t?.clone?.promptSub || "",
      palette: t?.theme?.palette || {},
      links: Array.isArray(links) ? links : [],
    };
  } catch { return null; }
}

// ---- voice dock ----------------------------------------------------------
const twin = new TwinVoice(CONFIG, {
  onStatus(s) {
    const dock = $("dock"); dock.dataset.state = s;
    $("talkBtn").dataset.state = s;
    const t = $("talkLabel");
    if (s === "connecting") t.textContent = "Connecting…";
    else if (s === "live") t.textContent = "Listening";
    else t.textContent = (window.__promptTitle || "Talk to me");
  },
  onCaption(t) { const c = $("caption"); c.textContent = t || ""; c.classList.toggle("show", !!t); },
  onMessage({ role, text }) {
    const li = document.createElement("div");
    li.className = "msg " + role; li.textContent = text;
    $("log").appendChild(li); $("log").scrollTop = $("log").scrollHeight;
  },
  onMicState(on) { $("talkBtn").classList.toggle("mic-on", on); },
  onError(m) { console.warn("[twin]", m); },
});

function wireLinkAwareness() {
  document.querySelectorAll("a[data-link-id]").forEach((a) => {
    a.addEventListener("pointerenter", () => twin.setActiveLink(a.dataset.linkId));
    a.addEventListener("focus", () => twin.setActiveLink(a.dataset.linkId));
  });
}

// Warm (clip + worker prewarm) on first traffic intent so the greeting is ready
// the instant the visitor taps.
let warmed = false;
const warm = () => {
  if (warmed) return; warmed = true;
  twin.warm();
  ["pointerdown", "touchstart", "keydown", "scroll"].forEach((e) => window.removeEventListener(e, warm, true));
};
["pointerdown", "touchstart", "keydown", "scroll"].forEach((e) =>
  window.addEventListener(e, warm, e === "scroll" ? { capture: true, passive: true } : true));

$("talkBtn").addEventListener("click", async () => {
  if ($("dock").dataset.state === "live") { await twin.muteMic(); return; }
  await twin.connect({ withMic: true });
});

$("textForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("textInput").value; $("textInput").value = "";
  if (!twin.room) twin.connect({ withMic: false }).then(() => twin.sendText(v));
  else twin.sendText(v);
});

// ---- boot: render fallback immediately, then the live data ----------------
render(CONFIG.FALLBACK);
window.__promptTitle = CONFIG.FALLBACK.prompt_title;
fetchPage().then((p) => { if (p) { render(p); window.__promptTitle = p.prompt_title; $("talkLabel").textContent = p.prompt_title; } });
