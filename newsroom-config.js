/*
  PUBLIC SUPABASE CONFIGURATION
  Paste your Supabase Project URL and anon/public key below.
  These are public browser credentials; NEVER put a service_role key here.
*/
window.DD_SUPABASE_URL = "https://vkssntjrbepntnjekoud.supabase.co";
window.DD_SUPABASE_ANON_KEY = "sb_publishable_CNUuWm_yR_Yv6Vp08nFAYw_ldENN5Q5";

window.ddSupabase = (() => {
  const ready = window.supabase &&
    window.DD_SUPABASE_URL.startsWith("https://") &&
    window.DD_SUPABASE_ANON_KEY.length > 20 &&
    !window.DD_SUPABASE_ANON_KEY.includes("PASTE_");
  return ready ? window.supabase.createClient(window.DD_SUPABASE_URL, window.DD_SUPABASE_ANON_KEY) : null;
})();
