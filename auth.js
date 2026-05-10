// ============================================
// YAPING - Authentication Module
// auth.js — Supabase Authentication (Username-based)
// ============================================

var currentUser = null;
var authToken = null;
var currentUsername = null;

// Initialize auth from localStorage
function initAuth() {
    var stored = localStorage.getItem('yaping_auth');
    if (stored) {
        try {
            var data = JSON.parse(stored);
            currentUser = data.user;
            authToken = data.token;
            currentUsername = data.username;
            localStorage.setItem('yaping_currentUser', currentUsername);
        } catch (e) {
            console.warn('[Auth] Failed to restore session:', e);
            logout();
        }
    }
}

// Sign up new user with username and password only
async function signUp(username, password) {
    try {
        // Generate a temporary email based on username
        var tempEmail = username + '@yaping.local';
        
        // Check if username already exists
        var existingProfiles = await sbGet('profiles', 'username=eq.' + encodeURIComponent(username));
        if (existingProfiles && existingProfiles.length > 0) {
            throw new Error('Username sudah digunakan');
        }

        // Create auth user with temporary email
        var signUpRes = await fetch('https://lzxjjiebpnhjeifnnqms.supabase.co/auth/v1/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                email: tempEmail,
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

        // Create profile with username
        var profileRes = await fetch(sbUrl('profiles'), {
            method: 'POST',
            headers: sbHeaders(),
            body: JSON.stringify({
                id: userId,
                username: username,
                full_name: username,
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
        currentUsername = username;
        
        localStorage.setItem('yaping_auth', JSON.stringify({
            user: currentUser,
            token: token,
            username: username
        }));

        // Set current username
        localStorage.setItem('yaping_currentUser', username);

        return { success: true, user: currentUser };
    } catch (e) {
        console.error('[Auth] Signup error:', e);
        return { success: false, error: e.message };
    }
}

// Sign in existing user with username and password
async function signIn(username, password) {
    try {
        // First, find the user's profile to get their email
        var profiles = await sbGet('profiles', 'username=eq.' + encodeURIComponent(username));
        
        if (!profiles || profiles.length === 0) {
            throw new Error('Username tidak ditemukan');
        }

        var profile = profiles[0];
        var userId = profile.id;
        
        // Generate the temporary email based on username
        var tempEmail = username + '@yaping.local';

        // Sign in using the temporary email and password
        var signInRes = await fetch('https://lzxjjiebpnhjeifnnqms.supabase.co/auth/v1/token?grant_type=password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                email: tempEmail,
                password: password
            })
        });

        if (!signInRes.ok) {
            var errData = await signInRes.json();
            throw new Error('Password salah atau user tidak ditemukan');
        }

        var signInData = await signInRes.json();
        currentUser = signInData.user;
        authToken = signInData.access_token;
        currentUsername = username;

        // Save auth session
        localStorage.setItem('yaping_auth', JSON.stringify({
            user: currentUser,
            token: authToken,
            username: username
        }));

        // Set current username
        localStorage.setItem('yaping_currentUser', username);

        return { success: true, user: currentUser };
    } catch (e) {
        console.error('[Auth] Signin error:', e);
        return { success: false, error: e.message };
    }
}

// Logout
function logout() {
    currentUser = null;
    authToken = null;
    currentUsername = null;
    localStorage.removeItem('yaping_auth');
    localStorage.removeItem('yaping_userProfile');
    localStorage.removeItem('yaping_currentUser');
    window.location.href = '#login';
    location.reload();
}

// Check if user is logged in
function isLoggedIn() {
    return currentUser !== null && authToken !== null && currentUsername !== null;
}

// Get current user ID
function getCurrentUserId() {
    return currentUser ? currentUser.id : null;
}

// Get current username
function getCurrentUsername() {
    return currentUsername || localStorage.getItem('yaping_currentUser') || '@user';
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
