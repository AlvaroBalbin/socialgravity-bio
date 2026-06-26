// Bio runtime config. Point AGENT_ID at any twin; the page renders that twin's
// twin_pages + twin_page_links data (display name, tagline, bio, avatar, theme,
// links) at runtime. FALLBACK is embedded so the page still renders if the data
// fetch fails or is slow (it is overwritten by the live fetch when that lands).
export const CONFIG = {
  SUPABASE_URL: "https://ootcwmipvdlyvjcvdtpo.supabase.co",
  SUPABASE_ANON:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vdGN3bWlwdmRseXZqY3ZkdHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMDI4NDMsImV4cCI6MjA3OTU3ODg0M30.YCHLGEVvDeZEX1RKBGTxGRIQ8AxUxfVozUbVLEKFAxc",
  AGENT_ID: "b8de3cea-79b1-4b7a-acb0-89589f0a89ab",
  GREETING_TEXT: "Hey, good to see you here!",
  // Embedded fallback render data (Alvaro). The live twin_pages fetch replaces it.
  FALLBACK: {
    display_name: "Alvaro Balbin",
    tagline: "Cofounder and CTO, SocialGravity",
    bio: "I build AI voice twins. The one on this page is mine, scraped and trained on me. Talk to it, ask it anything.",
    avatar_url: "https://ootcwmipvdlyvjcvdtpo.supabase.co/storage/v1/object/public/twin-page-assets/alvaro/avatar.png",
    prompt_title: "Talk to Alvaro",
    prompt_sub: "Voice or text, ask me anything",
    palette: { canvas: "#fbfbf9", surface: "#ffffff", ink: "#14150f", inkMuted: "#6b6f63", line: "#ececec", accent: "#945cd6" },
    links: [
      { label: "Make your own AI twin", subtitle: "Scrape or talk yourself into a clone", url: "https://socialgravity.ai", kind: "product" },
      { label: "alvarobalbin.com", subtitle: "My personal site", url: "https://alvarobalbin.com", kind: "link" },
      { label: "X / Twitter", subtitle: null, url: "https://x.com/elalvarobalbin", kind: "social" },
      { label: "LinkedIn", subtitle: null, url: "https://www.linkedin.com/in/alvaro-balbin-ugalde-68b237318", kind: "social" },
      { label: "GitHub", subtitle: null, url: "https://github.com/AlvaroBalbin", kind: "social" },
      { label: "Instagram", subtitle: null, url: "https://instagram.com/alvaro_balbin", kind: "social" },
    ],
  },
};
