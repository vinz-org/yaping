// ============================================
// YAPING - Authentication Module
// auth.js — Supabase Authentication
// ============================================

var SUPABASE_AUTH_URL = 'https://lzxjjiebpnhjeifnnqms.supabase.co/auth/v1';
var currentUser = null;
var authToken = null;

// Initialize auth from localStorage
function initAuth() {
    var stored = localStorage.getItem('yaping_auth');
    if (stored) {
        try {
            var data = JSON.parse(stored);
            currentUser = data.user;
            authToken = data.token;
            loadUserProfile();
        } catch (e) {
            console.warn('[Auth] Failed to restore session:', e);
            logout();
        }
    }
}

// Sign up new user
async function signUp(email, password, username, fullName) {
    try {
        // Create auth user
        var signUpRes = await fetch(SUPABASE_AUTH_URL + '/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        if (!signUpRes.ok) {
            var errData = await signUpRes.json();
            throw new Error(errData.message || 'Signup failed');
        }

        var signUpData = await signUpRes.json();
        var userId = signUpData.user.id;
        var token = signUpData.session.access_token;

        // Create profile
        var profileRes = await fetch(sbUrl('profiles'), {
            method: 'POST',
            headers: sbHeaders(),
            body: JSON.stringify({
                id: userId,
                username: username,
                full_name: fullName,
                avatar_url: null,
                bio: ''
            })
        });

        if (!profileRes.ok) {
            throw new Error('Failed to create profile');
        }

        // Save auth session
        currentUser = signUpData.user;
        authToken = token;
        localStorage.setItem('yaping_auth', JSON.stringify({
            user: currentUser,
            token: token
        }));

        // Set current username
        localStorage.setItem('yaping_currentUser', username);

        return { success: true, user: currentUser };
    } catch (e) {
        console.error('[Auth] Signup error:', e);
        return { success: false, error: e.message };
    }
}

// Sign in existing user
async function signIn(email, password) {
    try {
        var signInRes = await fetch(SUPABASE_AUTH_URL + '/token?grant_type=password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        if (!signInRes.ok) {
            var errData = await signInRes.json();
            throw new Error(errData.error_description || 'Login failed');
        }

        var signInData = await signInRes.json();
        currentUser = signInData.user;
        authToken = signInData.access_token;

        // Save auth session
        localStorage.setItem('yaping_auth', JSON.stringify({
            user: currentUser,
            token: authToken
        }));

        // Load user profile and set username
        await loadUserProfile();

        return { success: true, user: currentUser };
    } catch (e) {
        console.error('[Auth] Signin error:', e);
        return { success: false, error: e.message };
    }
}

// Load user profile from database
async function loadUserProfile() {
    if (!currentUser) return;

    try {
        var profiles = await sbGet('profiles', 'id=eq.' + encodeURIComponent(currentUser.id));
        if (profiles && profiles.length > 0) {
            var profile = profiles[0];
            localStorage.setItem('yaping_currentUser', profile.username);
            localStorage.setItem('yaping_userProfile', JSON.stringify(profile));
            return profile;
        }
    } catch (e) {
        console.warn('[Auth] Failed to load profile:', e);
    }
}

// Logout
function logout() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('yaping_auth');
    localStorage.removeItem('yaping_userProfile');
    localStorage.removeItem('yaping_currentUser');
    window.location.href = '#login';
    location.reload();
}

// Check if user is logged in
function isLoggedIn() {
    return currentUser !== null && authToken !== null;
}

// Get current user ID
function getCurrentUserId() {
    return currentUser ? currentUser.id : null;
}

// Get current username
function getCurrentUsername() {
    return localStorage.getItem('yaping_currentUser') || '@user';
}

// Get auth headers for API calls
function getAuthHeaders() {
    var headers = sbHeaders();
    if (authToken) {
        headers['Authorization'] = 'Bearer ' + authToken;
    }
    return headers;
}

// Log activity
async function logActivity(action, targetType, targetId, details) {
    if (!currentUser) return;

    try {
        await sbInsert('activity_log', {
            user_id: currentUser.id,
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

// Initialize auth on page load
initAuth();
