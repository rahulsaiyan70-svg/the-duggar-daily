/*
  PUBLIC SUPABASE CONFIGURATION
  Paste your Supabase Project URL and anon/public key below.
  These are public browser credentials; NEVER put a service_role key here.
*/
window.DD_SUPABASE_URL = "PASTE_SUPABASE_PROJECT_URL_HERE";
window.DD_SUPABASE_ANON_KEY = "PASTE_SUPABASE_ANON_OR_PUBLISHABLE_KEY_HERE";

window.ddSupabase = (() => {
  const ready = window.supabase &&
    window.DD_SUPABASE_URL.startsWith("https://") &&
    window.DD_SUPABASE_ANON_KEY.length > 20 &&
    !window.DD_SUPABASE_ANON_KEY.includes("PASTE_");
  return ready ? window.supabase.createClient(window.DD_SUPABASE_URL, window.DD_SUPABASE_ANON_KEY) : null;
})();
