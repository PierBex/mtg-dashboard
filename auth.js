// Auth configuration for MTG Dashboard
const AUTH_CONFIG = {
    username: "aquarius",
    password_hash: "57016ab31516ab194980337d54cf8e97959f30d827aa0f574f535b84eae37cf4",
    session_key: "mtg_dashboard_auth",
    session_duration_hours: 24,
};

async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function authenticate(username, password) {
    if (username !== AUTH_CONFIG.username) return false;
    const hash = await sha256(password);
    return hash === AUTH_CONFIG.password_hash;
}

function setSession() {
    const session = {
        login_time: Date.now(),
        expires: Date.now() + AUTH_CONFIG.session_duration_hours * 60 * 60 * 1000,
    };
    sessionStorage.setItem(AUTH_CONFIG.session_key, JSON.stringify(session));
}

function isLoggedIn() {
    const session = sessionStorage.getItem(AUTH_CONFIG.session_key);
    if (!session) return false;
    try {
        const s = JSON.parse(session);
        return Date.now() < s.expires;
    } catch {
        return false;
    }
}

function logout() {
    sessionStorage.removeItem(AUTH_CONFIG.session_key);
    location.reload();
}