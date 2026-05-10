// ============================================
// YAPING - Authentication Module
// auth.js - Supabase Authentication (Username-based) + profiles table
// ============================================

var authUser = null;
var authToken = null;
var currentUsername = null;
var authInitialized = false;

var AUTH_PROFILE_TABLE = 'profiles';
var AUTH_EMAIL_DOMAIN = 'yaping.local';
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

function usernameToAuthEmail(username) {
    return normalizeAuthUsername(username) + '@' + AUTH_EMAIL_DOMAIN;
}

function authRestHeaders(token, prefer) {
    var config = getSupabaseConfig();
    var bearer = token || (config && config.key) || '';
    var headers = {
        'Content-Type': 'application/json',
        'apikey': config ? config.key : '',
        'Authorization': 'Bearer ' + bearer
    };

    if (prefer) headers['Prefer'] = prefer;
    return headers;
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
    var raw = (payload && (payload.error_description || payload.message || payload.msg || payload.error)) || fallback || 'Request auth gagal';
    var lower = String(raw).toLowerCase();

    if (lower.indexOf('already registered') !== -1 || lower.indexOf('user already') !== -1 || lower.indexOf('already exists') !== -1) {
        return 'Username sudah digunakan';
    }
    if (lower.indexOf('invalid login credentials') !== -1 || lower.indexOf('invalid grant') !== -1) {
        return 'Username atau password salah';
    }
    if (lower.indexOf('email not confirmed') !== -1 || lower.indexOf('not confirmed') !== -1) {
        return 'Akun belum aktif di Supabase';
    }

    return raw;
}

async function supabaseAuthRequest(path, body) {
    var config = getSupabaseConfig();
    if (!config) throw new Error('Database belum siap');

    var response = await fetch(config.url + '/auth/v1/' + path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': config.key
        },
        body: JSON.stringify(body || {})
    });

    var payload = await readResponseBody(response);
    if (!response.ok) {
        throw new Error(getAuthErrorMessage(payload, 'Auth gagal: ' + response.status));
    }

    return payload;
}

function getSessionFromAuthPayload(payload) {
    payload = payload || {};
    var session = payload.session || payload;
    var user = payload.user || (session && session.user) || null;
    var token = payload.access_token || (session && session.access_token) || null;

    return { user: user, token: token };
}

function createProfilePayload(user, username, existingProfile) {
    existingProfile = existingProfile || {};

    return {
        id: user.id,
        username: username,
        full_name: existingProfile.full_name || localStorage.getItem('yaping_currentFullname') || username,
        avatar_url: existingProfile.avatar_url || localStorage.getItem('yaping_currentUserPhoto') || null,
        bio: existingProfile.bio || localStorage.getItem('yaping_currentBio') || '',
        updated_at: new Date().toISOString()
    };
}

async function fetchAuthProfileById(userId, token) {
    var config = getSupabaseConfig();
    if (!config || !userId) return null;

    var query = 'select=id,username,full_name,avatar_url,bio,updated_at&id=eq.' + encodeURIComponent(userId) + '&limit=1';
    var response = await fetch(config.url + '/rest/v1/' + AUTH_PROFILE_TABLE + '?' + query, {
        method: 'GET',
        headers: authRestHeaders(token)
    });

    var payload = await readResponseBody(response);
    if (!response.ok) {
        throw new Error('Gagal membaca profile: ' + getAuthErrorMessage(payload, response.status));
    }

    return Array.isArray(payload) && payload.length > 0 ? payload[0] : null;
}

async function upsertAuthProfile(user, username, token, existingProfile) {
    var config = getSupabaseConfig();
    if (!config) throw new Error('Database belum siap');
    if (!user || !user.id) throw new Error('User id tidak ditemukan');

    var profile = createProfilePayload(user, username, existingProfile);
    var response = await fetch(config.url + '/rest/v1/' + AUTH_PROFILE_TABLE + '?on_conflict=id', {
        method: 'POST',
        headers: authRestHeaders(token, 'resolution=merge-duplicates,return=representation'),
        body: JSON.stringify(profile)
    });

    var payload = await readResponseBody(response);
    if (!response.ok) {
        throw new Error('Gagal menyimpan profile: ' + getAuthErrorMessage(payload, response.status));
    }

    return Array.isArray(payload) && payload.length > 0 ? payload[0] : profile;
}

function persistAuthSession(user, token, username, profile) {
    var safeUsername = normalizeAuthUsername(username || (profile && profile.username));
    var safeUser = {
        id: user.id,
        email: user.email || usernameToAuthEmail(safeUsername)
    };

    authUser = safeUser;
    authToken = token;
    currentUsername = safeUsername;
    authInitialized = true;

    localStorage.setItem('yaping_auth', JSON.stringify({
        user: safeUser,
        token: authToken,
        username: currentUsername,
        timestamp: Date.now()
    }));
    localStorage.setItem('yaping_currentUser', currentUsername);

    if (profile) {
        if (profile.full_name) localStorage.setItem('yaping_currentFullname', profile.full_name);
        if (typeof profile.bio === 'string') localStorage.setItem('yaping_currentBio', profile.bio);
        if (profile.avatar_url) localStorage.setItem('yaping_currentUserPhoto', profile.avatar_url);
    }
}

// Initialize auth from cached Supabase session.
async function initAuth() {
    authInitialized = true;

    var stored = localStorage.getItem('yaping_auth');
    if (!stored) return;

    try {
        var data = JSON.parse(stored);
        if (!data || !data.user || !data.token || !data.username) return;

        authUser = data.user;
        authToken = data.token;
        currentUsername = normalizeAuthUsername(data.username);

        if (currentUsername) {
            localStorage.setItem('yaping_currentUser', currentUsername);
        }
    } catch (e) {
        console.warn('[Auth] Failed to restore session:', e);
        localStorage.removeItem('yaping_auth');
    }
}

// Sign up new user with username and password only.
async function signUp(username, password) {
    try {
        username = normalizeAuthUsername(username);

        var validationError = validateAuthUsername(username);
        if (validationError) return { success: false, error: validationError };
        if (!password || password.length < 6) return { success: false, error: 'Password minimal 6 karakter' };

        var email = usernameToAuthEmail(username);
        var payload = await supabaseAuthRequest('signup', {
            email: email,
            password: password,
            data: { username: username }
        });

        var session = getSessionFromAuthPayload(payload);
        if (!session.user || !session.user.id) {
            return { success: false, error: 'Akun gagal dibuat di Supabase' };
        }

        var profile = null;
        try {
            profile = await upsertAuthProfile(session.user, username, session.token);
        } catch (profileError) {
            console.warn('[Auth] Profile sync after signup failed:', profileError);
        }

        if (session.token) {
            persistAuthSession(session.user, session.token, username, profile);
        }

        return {
            success: true,
            user: session.user,
            profile: profile,
            needsLogin: !session.token
        };
    } catch (e) {
        console.error('[Auth] Signup error:', e);
        return { success: false, error: e.message || 'Signup gagal' };
    }
}

// Sign in existing user with username and password.
async function signIn(username, password) {
    try {
        username = normalizeAuthUsername(username);

        var validationError = validateAuthUsername(username);
        if (validationError) return { success: false, error: validationError };
        if (!password) return { success: false, error: 'Password harus diisi' };

        var payload = await supabaseAuthRequest('token?grant_type=password', {
            email: usernameToAuthEmail(username),
            password: password
        });

        var session = getSessionFromAuthPayload(payload);
        if (!session.user || !session.user.id || !session.token) {
            return { success: false, error: 'Login gagal mendapatkan session Supabase' };
        }

        var profile = null;
        try {
            profile = await fetchAuthProfileById(session.user.id, session.token);
            if (!profile) {
                profile = await upsertAuthProfile(session.user, username, session.token);
            }
        } catch (profileError) {
            console.warn('[Auth] Profile sync after signin failed:', profileError);
        }

        persistAuthSession(session.user, session.token, username, profile);
        return { success: true, user: authUser, profile: profile };
    } catch (e) {
        console.error('[Auth] Signin error:', e);
        return { success: false, error: e.message || 'Login gagal' };
    }
}

// Logout.
function logout() {
    authUser = null;
    authToken = null;
    currentUsername = null;
    localStorage.removeItem('yaping_auth');
    localStorage.removeItem('yaping_userProfile');
    localStorage.removeItem('yaping_currentUser');
    window.location.href = '#login';
    location.reload();
}

// Check if user is logged in.
function isLoggedIn() {
    return authUser !== null && authToken !== null && currentUsername !== null;
}

// Get current user ID.
function getCurrentUserId() {
    return authUser ? authUser.id : null;
}

// Get current username.
function getCurrentUsername() {
    return currentUsername || localStorage.getItem('yaping_currentUser') || '@user';
}

// Get auth headers for API calls.
function getAuthHeaders() {
    var headers = typeof sbHeaders === 'function' ? sbHeaders() : authRestHeaders();
    if (authToken) {
        headers['Authorization'] = 'Bearer ' + authToken;
    }
    return headers;
}

// Log activity.
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

// Initialize auth on page load.
initAuth();
