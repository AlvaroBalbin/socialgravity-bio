// Bio runtime config. Edit these to point the page at a different twin.
// The anon key is the public Supabase publishable key (safe in client code).
export const CONFIG = {
  SUPABASE_URL: "https://ootcwmipvdlyvjcvdtpo.supabase.co",
  SUPABASE_ANON:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vdGN3bWlwdmRseXZqY3ZkdHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMDI4NDMsImV4cCI6MjA3OTU3ODg0M30.YCHLGEVvDeZEX1RKBGTxGRIQ8AxUxfVozUbVLEKFAxc",
  // Alvaro's twin (clone). Swap for another agent id to mount a different twin.
  AGENT_ID: "b8de3cea-79b1-4b7a-acb0-89589f0a89ab",
  // Default opener spoken in the twin's cloned voice the instant the visitor
  // commits. The clip is generated server-side per (voice, text) and cached.
  GREETING_TEXT: "Hey, good to see you here!",
};
