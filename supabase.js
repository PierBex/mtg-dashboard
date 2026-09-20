// Public browser configuration. The publishable key is designed to be visible
// in a web app; database policies, not this key, protect portfolio data.
const SUPABASE_URL = 'https://pcatywgadapkkvihvxif.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ApMMAbWtKWl1kg5dWffgYA_wYjaM747';

window.MTG_SUPABASE = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;
