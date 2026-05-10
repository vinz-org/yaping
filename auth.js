// ============================================
// YAPING - Authentication Module
// auth.js - Username/password RPC authentication
// ============================================

var authUser = null;
var authSessionToken = null;
var currentUsername = null;
var authInitialized = false;

var AUTH_METHOD = 'username_rpc';
var AUTH_USERNAME_MIN_LENGTH = 3;
var AUTH_USERNAME_MAX_LENGTH = 20;

function getSupabaseConfig() {
    if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
        return null;
    }

    return {
        url: String(SUPABASE_URL).replace(/\/+$/, ''),
        key: SUPABASE_ANON_KEY
    };
}

function normalizeAuthUsername(value) {
    return String(value || '').trim().toLowerCase().replace(/^@+/, '');
}

function validateAuthUsername(username) {
    if (!username) return 'Username harus diisi';
    if (username.length < AUTH_USERNAME_MIN_LENGTH || username.length > AUTH_USERNAME_MAX_LENGTH) {
        return 'Username harus ' + AUTH_USERNAME_MIN_LENGTH + '-' + AUTH_USERNAME_MAX_LENGTH + ' karakter';
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
        return 'Username hanya boleh huruf kecil, angka, dan underscore';
    }
    return '';
}

async function readResponseBody(response) {
    var text = await response.text();
    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch (e) {
        return { message: text };
    }
}

function getAuthErrorMessage(payload, fallback) {
    var raw = (payload && (payload.message || payload.error_description || payload.msg || payload.error)) || fallback || 'Request auth gagal';
    var lower = String(raw).toLowerCase();

    if (lower.indexOf('username sudah digunakan') !== -1 || lower.indexOf('duplicate key') !== -1 || lower.indexOf('23505') !== -1) {
        return 'Username sudah digunakan';
    }
    if (lower.indexOf('username atau password salah') !== -1 || lower.indexOf('invalid login') !== -1) {
        return 'Username atau password salah';
    }
    if (lower.indexOf('session') !== -1 && (lower.indexOf('invalid') !== -1 || lower.indexOf('expired') !== -1 || lower.indexOf('kadaluarsa') !== -1)) {
        return 'Sesi login sudah habis. Silakan login ulang.';
    }

    return raw;
}

async function authRpc(functionName, params) {
    var config = getSupabaseConfig();
    if (!config) throw new Error('Database belum siap');

    var response = await fetch(config.url + '/rest/v1/rpc/' + functionName, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': config.key,
            'Authorization': 'Bearer ' + config.key
        },
        body: JSON.stringify(params || {})
    });

    var payload = await readResponseBody(response);
    if (!response.ok) {
        throw new Error(getAuthErrorMessage(payload, 'Auth gagal: ' + response.status));
    }

    return payload;
}

function normalizeAuthPayload(payload) {
    payload = payload || {};
    if (Array.isArray(payload)) payload = payload[0] || {};

    var user = payload.user || {};
    var profile = payload.profile || {};
    var username = normalizeAuthUsername(profile.username || user.username || payload.username);
    var sessionToken = payload.session_token || payload.sessionToken || payload.token;

    if (!user.id && profile.id) user.id = profile.id;
    if (!user.username && username) user.username = username;

    return {
        user: user,
        profile: profile,
        username: username,
        sessionToken: sessionToken,
        expiresAt: payload.expires_at || payload.expiresAt || null
    };
}

function persistAuthSession(user, sessionToken, username, profile) {
    var safeUsername = normalizeAuthUsername(username || (profile && profile.username) || (user && user.username));
    var safeUser = {
        id: user && user.id,
        username: safeUsername
    };

    authUser = safeUser;
    authSessionToken = sessionToken;
    currentUsername = safeUsername;
    authInitialized = true;

    localStorage.setItem('yaping_auth', JSON.stringify({
        method: AUTH_METHOD,
        user: safeUser,
        username: currentUsername,
        sessionToken: authSessionToken,
        profile: profile || null,
        timestamp: Date.now()
    }));
    localStorage.setItem('yaping_currentUser', currentUsername);

    if (profile) {
        if (profile.full_name) localStorage.setItem('yaping_currentFullname', profile.full_name);
        if (typeof profile.bio === 'string') localStorage.setItem('yaping_currentBio', profile.bio);
        if (profile.avatar_url) localStorage.setItem('yaping_currentUserPhoto', profile.avatar_url);
    }
}

function clearAuthSession() {
    authUser = null;
    authSessionToken = null;
    currentUsername = null;
    localStorage.removeItem('yaping_auth');
    localStorage.removeItem('yaping_userProfile');
    localStorage.removeItem('yaping_currentUser');
}

async function initAuth() {
    authInitialized = true;

    var stored = localStorage.getItem('yaping_auth');
    if (!stored) return;

    try {
        var data = JSON.parse(stored);
        if (!data || data.method !== AUTH_METHOD || !data.user || !data.sessionToken || !data.username) {
            clearAuthSession();
            return;
        }

        authUser = data.user;
        authSessionToken = data.sessionToken;
        currentUsername = normalizeAuthUsername(data.username);

        if (currentUsername) {
            localStorage.setItem('yaping_currentUser', currentUsername);
        }
    } catch (e) {
        console.warn('[Auth] Failed to restore session:', e);
        clearAuthSession();
    }
}

async function signUp(username, password) {
    try {
        username = normalizeAuthUsername(username);

        var validationError = validateAuthUsername(username);
        if (validationError) return { success: false, error: validationError };
        if (!password || password.length < 6) return { success: false, error: 'Password minimal 6 karakter' };

        var payload = normalizeAuthPayload(await authRpc('signup_username', {
            p_username: username,
            p_password: password
        }));

        if (!payload.user.id || !payload.sessionToken) {
            return { success: false, error: 'Signup gagal mendapatkan session' };
        }

        persistAuthSession(payload.user, payload.sessionToken, payload.username, payload.profile);
        return { success: true, user: authUser, profile: payload.profile, needsLogin: false };
    } catch (e) {
        console.error('[Auth] Signup error:', e);
        return { success: false, error: e.message || 'Signup gagal' };
    }
}

async function signIn(username, password) {
    try {
        username = normalizeAuthUsername(username);

        var validationError = validateAuthUsername(username);
        if (validationError) return { success: false, error: validationError };
        if (!password) return { success: false, error: 'Password harus diisi' };

        var payload = normalizeAuthPayload(await authRpc('login_username', {
            p_username: username,
            p_password: password
        }));

        if (!payload.user.id || !payload.sessionToken) {
            return { success: false, error: 'Login gagal mendapatkan session' };
        }

        persistAuthSession(payload.user, payload.sessionToken, payload.username, payload.profile);
        return { success: true, user: authUser, profile: payload.profile };
    } catch (e) {
        console.error('[Auth] Signin error:', e);
        return { success: false, error: e.message || 'Login gagal' };
    }
}

async function updateProfileAuthenticated(username, fullName, bio, avatarUrl) {
    try {
        if (!isLoggedIn()) {
            return { success: false, error: 'Silakan login dulu' };
        }

        username = normalizeAuthUsername(username || currentUsername);
        var validationError = validateAuthUsername(username);
        if (validationError) return { success: false, error: validationError };

        var payload = normalizeAuthPayload(await authRpc('update_profile_authenticated', {
            p_session_token: authSessionToken,
            p_username: username,
            p_full_name: String(fullName || '').trim() || username,
            p_bio: String(bio || '').trim(),
            p_avatar_url: avatarUrl || null
        }));

        if (!payload.user.id || !payload.sessionToken) {
            payload.sessionToken = authSessionToken;
        }

        persistAuthSession(payload.user, payload.sessionToken, payload.username || username, payload.profile);
        return { success: true, user: authUser, profile: payload.profile };
    } catch (e) {
        console.error('[Auth] Profile update error:', e);
        return { success: false, error: e.message || 'Gagal menyimpan profil' };
    }
}

function logout() {
    clearAuthSession();
    window.location.href = '#login';
    location.reload();
}

function isLoggedIn() {
    return authUser !== null && authSessionToken !== null && currentUsername !== null;
}

function getCurrentUserId() {
    return authUser ? authUser.id : null;
}

function getCurrentUsername() {
    return currentUsername || localStorage.getItem('yaping_currentUser') || '@user';
}

function getAuthSessionToken() {
    return authSessionToken;
}

function getAuthHeaders() {
    var headers = typeof sbHeaders === 'function' ? sbHeaders() : {};
    if (authSessionToken) {
        headers['X-Yaping-Session'] = authSessionToken;
    }
    return headers;
}

async function logActivity(action, targetType, targetId, details) {
    if (!authUser) return;

    try {
        await sbInsert('activity_log', {
            user_id: authUser.id,
            username: getCurrentUsername(),
            action: action,
            target_type: targetType,
            target_id: targetId,
            details: details
        });
    } catch (e) {
        console.warn('[Auth] Failed to log activity:', e);
    }
}

window.updateProfileAuthenticated = updateProfileAuthenticated;
window.getAuthSessionToken = getAuthSessionToken;

initAuth();
