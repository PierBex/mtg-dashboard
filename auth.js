// Account utilities backed by Supabase Auth. The browser only receives the
// publishable key; Row Level Security protects every user's portfolio rows.

function friendlyAuthError(message) {
  const text = String(message || 'Unable to sign in. Please try again.');
  if (/invalid login credentials/i.test(text)) return 'That email or password is not correct.';
  if (/email not confirmed/i.test(text)) return 'Please confirm your email first, then sign in.';
  if (/rate limit/i.test(text)) return 'Too many attempts. Please wait a moment and try again.';
  return text;
}

async function authenticate(email, password) {
  if (!window.MTG_SUPABASE) return { success: false, error: 'The account service could not load. Please refresh and try again.' };
  if (!email || !password) return { success: false, error: 'Please enter your email and password.' };
  const { data, error } = await window.MTG_SUPABASE.auth.signInWithPassword({
    email: email.trim(), password
  });
  return error ? { success: false, error: friendlyAuthError(error.message) } : { success: true, user: data.user };
}

async function createAccount(email, password) {
  if (!window.MTG_SUPABASE) return { success: false, error: 'The account service could not load. Please refresh and try again.' };
  if (!email || !password) return { success: false, error: 'Please enter your email and password.' };
  if (password.length < 8) return { success: false, error: 'Please use a password with at least 8 characters.' };
  const { data, error } = await window.MTG_SUPABASE.auth.signUp({
    email: email.trim(), password,
    options: { emailRedirectTo: window.location.href.split('#')[0] }
  });
  if (error) return { success: false, error: friendlyAuthError(error.message) };
  return { success: true, needsEmailConfirmation: !data.session, user: data.user };
}

async function isLoggedIn() {
  if (!window.MTG_SUPABASE) return false;
  const { data: { session } } = await window.MTG_SUPABASE.auth.getSession();
  return Boolean(session);
}

async function getUser() {
  if (!window.MTG_SUPABASE) return null;
  const { data: { user } } = await window.MTG_SUPABASE.auth.getUser();
  return user || null;
}

async function logout() {
  if (window.MTG_SUPABASE) await window.MTG_SUPABASE.auth.signOut();
}

window.AUTH = { authenticate, createAccount, isLoggedIn, getUser, logout };
