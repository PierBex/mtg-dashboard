// MTG Dashboard - client-side auth utilities
// SHA-256 hashing + sessionStorage session with 24h expiry.

const AUTH_CONFIG = {
  users: [
    { username: 'aquarius', passwordHash: '57016ab31516ab194980337d54cf8e97959f30d827aa0f574f535b84eae37cf4' },
    { username: 'karolis',  passwordHash: 'ce8287426a2c8cf69270d3b471208b524009e7f2215bc183a32f3b7892181842' }
  ]
};

const SESSION_KEY = 'mtg_dashboard_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function authenticate(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Please enter username and password.' };
  }
  const hash = await sha256(password.trim());
  const user = AUTH_CONFIG.users.find(
    u => u.username.toLowerCase() === username.trim().toLowerCase() &&
         u.passwordHash.toLowerCase() === hash.toLowerCase()
  );
  if (user) {
    setSession(username.trim());
    return { success: true, error: null };
  }
  return { success: false, error: 'Invalid username or password.' };
}

function setSession(username) {
  const session = {
    username,
    createdAt: Date.now()
  };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('sessionStorage unavailable', e);
  }
}

function isLoggedIn() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw);
    if (!session || typeof session.createdAt !== 'number') return false;
    if (Date.now() - session.createdAt > SESSION_DURATION_MS) {
      logout();
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

function logout() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.warn('sessionStorage unavailable', e);
  }
}

// Expose for dashboard use
window.AUTH = {
  authenticate,
  isLoggedIn,
  logout,
  sha256,
  getUsername() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw).username : null;
    } catch (e) {
      return null;
    }
  }
};
