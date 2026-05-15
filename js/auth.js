// ============================================
// YAPING - Authentication Module
// auth.js - Supabase Auth v1 email/password
// ============================================

var authUser = null;
var authSessionToken = null;
var authRefreshToken = null;
var authExpiresAt = null;
var currentUsername = null;
var currentEmail = null;
var authInitialized = false;

var AUTH_METHOD = 'supabase_auth';
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

function normalizeAuthEmail(value) {
    return String(value || '').trim().toLowerCase();
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

function validateAuthEmail(email) {
    if (!email) return 'Email harus diisi';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Format email tidak valid';
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
    var lower = String(raw + ' ' + ((payload && (payload.details || payload.hint || payload.code)) || '')).toLowerCase();

    if (lower.indexOf('user already registered') !== -1 || lower.indexOf('already registered') !== -1) {
        return 'Email sudah terdaftar';
    }
    if (lower.indexOf('invalid login credentials') !== -1 || lower.indexOf('invalid credentials') !== -1) {
        return 'Email atau password salah';
    }
    if (lower.indexOf('email not confirmed') !== -1 || lower.indexOf('not confirmed') !== -1) {
        return 'Email belum dikonfirmasi. Cek inbox email kamu.';
    }
    if (lower.indexOf('email rate limit') !== -1 || lower.indexOf('rate limit') !== -1) {
        return 'Terlalu banyak request email. Tunggu sebentar lalu coba lagi.';
    }
    if (lower.indexOf('duplicate key') !== -1 || lower.indexOf('23505') !== -1) {
        return 'Username atau email sudah digunakan';
    }
    if (lower.indexOf('jwt') !== -1 || lower.indexOf('session') !== -1) {
        return 'Sesi login sudah habis. Silakan login ulang.';
    }

    return raw;
}

async function authRequest(path, body, accessToken) {
    var config = getSupabaseConfig();
    if (!config) throw new Error('Database belum siap');

    var response = await fetch(config.url + path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': config.key,
            'Authorization': 'Bearer ' + (accessToken || config.key)
        },
        body: JSON.stringify(body || {})
    });

    var payload = await readResponseBody(response);
    if (!response.ok) {
        throw new Error(getAuthErrorMessage(payload, 'Auth gagal: ' + response.status));
    }

    return payload;
}

async function authUserRequest(method, body) {
    var config = getSupabaseConfig();
    if (!config || !authSessionToken) return null;

    var response = await fetch(config.url + '/auth/v1/user', {
        method: method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            'apikey': config.key,
            'Authorization': 'Bearer ' + authSessionToken
        },
        body: body ? JSON.stringify(body) : undefined
    });

    var payload = await readResponseBody(response);
    if (!response.ok) {
        throw new Error(getAuthErrorMessage(payload, 'Auth user gagal: ' + response.status));
    }

    return payload;
}

function normalizeAuthPayload(payload) {
    payload = payload || {};
    var session = payload.session || payload;
    var user = payload.user || session.user || (payload.id ? payload : {});
    var metadata = (user && user.user_metadata) || {};
    var email = normalizeAuthEmail(user.email || payload.email || metadata.email);
    var username = normalizeAuthUsername(metadata.username || payload.username || (email ? email.split('@')[0] : ''));
    var accessToken = payload.access_token || session.access_token || null;
    var refreshToken = payload.refresh_token || session.refresh_token || null;
    var expiresAt = payload.expires_at || session.expires_at || (payload.expires_in ? Math.floor(Date.now() / 1000) + payload.expires_in : null);

    return {
        user: user || {},
        email: email,
        username: username,
        accessToken: accessToken,
        refreshToken: refreshToken,
        expiresAt: expiresAt
    };
}

function profileHeaders(accessToken) {
    var config = getSupabaseConfig();
    return {
        'Content-Type': 'application/json',
        'apikey': config.key,
        'Authorization': 'Bearer ' + (accessToken || authSessionToken || config.key),
        'Prefer': 'resolution=merge-duplicates,return=representation'
    };
}

async function getProfileByUserId(userId, accessToken) {
    var config = getSupabaseConfig();
    if (!config || !userId) return null;

    var url = config.url + '/rest/v1/users_profile?id=eq.' + encodeURIComponent(userId) + '&limit=1';
    var response = await fetch(url, {
        method: 'GET',
        headers: profileHeaders(accessToken)
    });

    if (!response.ok) return null;
    var rows = await response.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function upsertUserProfile(profile, accessToken) {
    var config = getSupabaseConfig();
    if (!config || !profile || !profile.id) return null;

    var response = await fetch(config.url + '/rest/v1/users_profile?on_conflict=id', {
        method: 'POST',
        headers: profileHeaders(accessToken),
        body: JSON.stringify(profile)
    });

    var payload = await readResponseBody(response);
    if (!response.ok) {
        throw new Error(getAuthErrorMessage(payload, 'Gagal menyimpan profil: ' + response.status));
    }

    return Array.isArray(payload) ? payload[0] : payload;
}

async function ensureUserProfile(user, username, accessToken) {
    if (!user || !user.id) return null;

    var email = normalizeAuthEmail(user.email || currentEmail);
    var safeUsername = normalizeAuthUsername(username || (user.user_metadata && user.user_metadata.username) || (email ? email.split('@')[0] : 'user'));
    var existing = await getProfileByUserId(user.id, accessToken);

    var profile = {
        id: user.id,
        username: normalizeAuthUsername((existing && existing.username) || safeUsername),
        email: email || (existing && existing.email) || null,
        full_name: (existing && existing.full_name) || safeUsername,
        avatar_url: (existing && existing.avatar_url) || null,
        bio: (existing && existing.bio) || '',
        updated_at: new Date().toISOString()
    };

    try {
        return await upsertUserProfile(profile, accessToken);
    } catch (e) {
        console.warn('[Auth] Profile sync skipped:', e);
        return profile;
    }
}

function persistAuthSession(user, accessToken, refreshToken, expiresAt, username, email, profile, rememberMe) {
    var safeEmail = normalizeAuthEmail(email || (user && user.email));
    var safeUsername = normalizeAuthUsername(username || (profile && profile.username) || (user && user.user_metadata && user.user_metadata.username) || (safeEmail ? safeEmail.split('@')[0] : 'user'));
    var safeUser = {
        id: user && user.id,
        email: safeEmail,
        username: safeUsername
    };

    authUser = safeUser;
    authSessionToken = accessToken;
    authRefreshToken = refreshToken || null;
    authExpiresAt = expiresAt || null;
    currentUsername = safeUsername;
    currentEmail = safeEmail;
    authInitialized = true;

    var storage = rememberMe ? localStorage : sessionStorage;
    var authData = {
        method: AUTH_METHOD,
        user: safeUser,
        username: currentUsername,
        email: currentEmail,
        accessToken: authSessionToken,
        refreshToken: authRefreshToken,
        expiresAt: authExpiresAt,
        profile: profile || null,
        timestamp: Date.now(),
        rememberMe: !!rememberMe
    };

    storage.setItem('yaping_auth', JSON.stringify(authData));
    localStorage.setItem('yaping_currentUser', currentUsername);
    if (currentEmail) localStorage.setItem('yaping_currentEmail', currentEmail);

    if (profile) {
        if (profile.full_name) localStorage.setItem('yaping_currentFullname', profile.full_name);
        else localStorage.removeItem('yaping_currentFullname');

        if (typeof profile.bio === 'string') localStorage.setItem('yaping_currentBio', profile.bio);
        else localStorage.removeItem('yaping_currentBio');

        if (profile.avatar_url) localStorage.setItem('yaping_currentUserPhoto', profile.avatar_url);
        else localStorage.removeItem('yaping_currentUserPhoto');

        // Handle banner if it exists in profile (might need schema update, but for now let's be safe)
        if (profile.banner_url) localStorage.setItem('yaping_profileBanner', profile.banner_url);
        else localStorage.removeItem('yaping_profileBanner');
    }

    // Clean up other storage to avoid conflicts
    if (rememberMe) {
        sessionStorage.removeItem('yaping_auth');
    } else {
        localStorage.removeItem('yaping_auth');
    }
}

function clearAuthSession() {
    authUser = null;
    authSessionToken = null;
    authRefreshToken = null;
    authExpiresAt = null;
    currentUsername = null;
    currentEmail = null;
    localStorage.removeItem('yaping_auth');
    sessionStorage.removeItem('yaping_auth');
    localStorage.removeItem('yaping_userProfile');
    localStorage.removeItem('yaping_currentUser');
    localStorage.removeItem('yaping_currentEmail');
    localStorage.removeItem('yaping_currentUserPhoto');
    localStorage.removeItem('yaping_profileBanner');
    localStorage.removeItem('yaping_currentFullname');
    localStorage.removeItem('yaping_currentBio');
}

async function refreshAuthSession(data) {
    if (!data || !data.refreshToken) return false;

    try {
        var payload = normalizeAuthPayload(await authRequest('/auth/v1/token?grant_type=refresh_token', {
            refresh_token: data.refreshToken
        }));

        if (!payload.user.id || !payload.accessToken) return false;
        var profile = await ensureUserProfile(payload.user, data.username || payload.username, payload.accessToken);
        persistAuthSession(payload.user, payload.accessToken, payload.refreshToken, payload.expiresAt, payload.username || data.username, payload.email || data.email, profile, data.rememberMe);
        return true;
    } catch (e) {
        console.warn('[Auth] Refresh session failed:', e);
        return false;
    }
}

async function initAuth() {
    authInitialized = true;

    var stored = localStorage.getItem('yaping_auth') || sessionStorage.getItem('yaping_auth');
    if (!stored) {
        clearAuthSession();
        return;
    }

    try {
        var data = JSON.parse(stored);
        if (!data || data.method !== AUTH_METHOD || !data.user || !data.accessToken || !data.username) {
            clearAuthSession();
            return;
        }

        var nowSeconds = Math.floor(Date.now() / 1000);
        if (data.expiresAt && data.expiresAt <= nowSeconds + 60) {
            var refreshed = await refreshAuthSession(data);
            if (!refreshed) clearAuthSession();
            return;
        }

        authUser = data.user;
        authSessionToken = data.accessToken;
        authRefreshToken = data.refreshToken || null;
        authExpiresAt = data.expiresAt || null;
        currentUsername = normalizeAuthUsername(data.username);
        currentEmail = normalizeAuthEmail(data.email || (data.user && data.user.email));

        if (currentUsername) localStorage.setItem('yaping_currentUser', currentUsername);
        if (currentEmail) localStorage.setItem('yaping_currentEmail', currentEmail);
    } catch (e) {
        console.warn('[Auth] Failed to restore session:', e);
        clearAuthSession();
    }
}

async function signUp(username, email, password, rememberMe) {
    try {
        username = normalizeAuthUsername(username);
        email = normalizeAuthEmail(email);

        var validationError = validateAuthUsername(username) || validateAuthEmail(email);
        if (validationError) return { success: false, error: validationError };
        if (!password || password.length < 6) return { success: false, error: 'Password minimal 6 karakter' };

        var payload = normalizeAuthPayload(await authRequest('/auth/v1/signup', {
            email: email,
            password: password,
            data: {
                username: username,
                full_name: username
            }
        }));

        if (!payload.user.id) {
            return { success: false, error: 'Signup gagal membuat user' };
        }

        if (!payload.accessToken) {
            localStorage.setItem('yaping_pendingEmail', email);
            return { success: true, user: payload.user, needsLogin: true };
        }

        var profile = await ensureUserProfile(payload.user, username, payload.accessToken);
        persistAuthSession(payload.user, payload.accessToken, payload.refreshToken, payload.expiresAt, username, email, profile, rememberMe);
        return { success: true, user: authUser, profile: profile, needsLogin: false };
    } catch (e) {
        console.error('[Auth] Signup error:', e);
        return { success: false, error: e.message || 'Signup gagal' };
    }
}

async function signIn(email, password, rememberMe) {
    try {
        email = normalizeAuthEmail(email);

        var validationError = validateAuthEmail(email);
        if (validationError) return { success: false, error: validationError };
        if (!password) return { success: false, error: 'Password harus diisi' };

        var payload = normalizeAuthPayload(await authRequest('/auth/v1/token?grant_type=password', {
            email: email,
            password: password
        }));

        if (!payload.user.id || !payload.accessToken) {
            return { success: false, error: 'Login gagal mendapatkan session' };
        }

        var profile = await ensureUserProfile(payload.user, payload.username, payload.accessToken);
        persistAuthSession(payload.user, payload.accessToken, payload.refreshToken, payload.expiresAt, (profile && profile.username) || payload.username, email, profile, rememberMe);
        return { success: true, user: authUser, profile: profile };
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

        var profile = await upsertUserProfile({
            id: authUser.id,
            username: username,
            email: currentEmail || authUser.email || null,
            full_name: String(fullName || '').trim() || username,
            bio: String(bio || '').trim(),
            avatar_url: avatarUrl || null,
            updated_at: new Date().toISOString()
        }, authSessionToken);

        try {
            await authUserRequest('PUT', {
                data: {
                    username: username,
                    full_name: profile.full_name,
                    avatar_url: profile.avatar_url
                }
            });
        } catch (metadataError) {
            console.warn('[Auth] Metadata update skipped:', metadataError);
        }

        persistAuthSession(authUser, authSessionToken, authRefreshToken, authExpiresAt, username, currentEmail, profile);
        return { success: true, user: authUser, profile: profile };
    } catch (e) {
        console.error('[Auth] Profile update error:', e);
        return { success: false, error: e.message || 'Gagal menyimpan profil' };
    }
}

async function logout() {
    var token = authSessionToken;
    clearAuthSession();

    if (token) {
        try {
            await authRequest('/auth/v1/logout', {}, token);
        } catch (e) {
            console.warn('[Auth] Logout request failed:', e);
        }
    }

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

function getCurrentEmail() {
    return currentEmail || localStorage.getItem('yaping_currentEmail') || '';
}

function getAuthSessionToken() {
    return authSessionToken;
}

function getAuthHeaders() {
    var headers = typeof sbHeaders === 'function' ? sbHeaders() : {};
    if (authSessionToken) {
        headers['Authorization'] = 'Bearer ' + authSessionToken;
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
window.getCurrentEmail = getCurrentEmail;

initAuth();
