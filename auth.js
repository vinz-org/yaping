// ============================================
// YAPING - Authentication Module
// auth.js — Supabase Authentication (Username-based) + Fallback Local Auth
// ============================================

var currentUser = null;
var authToken = null;
var currentUsername = null;
var localUsers = {}; // Fallback local user database

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
    
    // Load local users database
    var localUsersData = localStorage.getItem('yaping_localUsers');
    if (localUsersData) {
        try {
            localUsers = JSON.parse(localUsersData);
        } catch (e) {
            localUsers = {};
        }
    }
}

// Save local users database
function saveLocalUsers() {
    localStorage.setItem('yaping_localUsers', JSON.stringify(localUsers));
}

// Sign up new user with username and password only
async function signUp(username, password) {
    try {
        // Normalize username
        username = username.trim().toLowerCase();
        
        // Check if username already exists locally first (faster check)
        if (localUsers[username]) {
            return { success: false, error: 'Username sudah digunakan' };
        }
        
        // Try to check on Supabase if available
        if (typeof sbGet === 'function') {
            try {
                var existingProfiles = await sbGet('profiles', 'username=eq.' + encodeURIComponent(username));
                if (existingProfiles && Array.isArray(existingProfiles) && existingProfiles.length > 0) {
                    return { success: false, error: 'Username sudah digunakan' };
                }
            } catch (e) {
                console.warn('[Auth] Supabase check failed, using local fallback:', e);
            }
        }

        // Generate a temporary email based on username
        var tempEmail = username + '@yaping.local';
        var userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // Try to create on Supabase if available
        if (typeof SUPABASE_ANON_KEY !== 'undefined') {
            try {
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

                if (signUpRes.ok) {
                    try {
                        var signUpData = await signUpRes.json();
                        userId = signUpData.user.id;
                        
                        // Try to create profile
                        if (typeof sbUrl === 'function' && typeof sbHeaders === 'function') {
                            try {
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
                            } catch (pe) {
                                console.warn('[Auth] Profile creation failed:', pe);
                            }
                        }
                    } catch (je) {
                        console.warn('[Auth] Failed to parse signup response:', je);
                    }
                }
            } catch (e) {
                console.warn('[Auth] Supabase signup failed, using local fallback:', e);
            }
        }

        // Create local user record (always do this as fallback)
        localUsers[username] = {
            username: username,
            password: password,
            createdAt: new Date().toISOString(),
            id: userId
        };
        saveLocalUsers();

        // Save auth session
        currentUser = { id: userId, email: tempEmail };
        authToken = 'local_' + userId;
        currentUsername = username;
        
        localStorage.setItem('yaping_auth', JSON.stringify({
            user: currentUser,
            token: authToken,
            username: username
        }));
        localStorage.setItem('yaping_currentUser', username);

        return { success: true, user: currentUser };
    } catch (e) {
        console.error('[Auth] Signup error:', e);
        return { success: false, error: e.message || 'Signup gagal' };
    }
}

// Sign in existing user with username and password
async function signIn(username, password) {
    try {
        // Normalize username
        username = username.trim().toLowerCase();
        
        // Try Supabase first if available
        if (typeof sbGet === 'function' && typeof SUPABASE_ANON_KEY !== 'undefined') {
            try {
                var profiles = await sbGet('profiles', 'username=eq.' + encodeURIComponent(username));
                
                if (profiles && Array.isArray(profiles) && profiles.length > 0) {
                    var profile = profiles[0];
                    var userId = profile.id;
                    var tempEmail = username + '@yaping.local';

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

                    if (signInRes.ok) {
                        var signInData = await signInRes.json();
                        currentUser = signInData.user;
                        authToken = signInData.access_token;
                        currentUsername = username;

                        localStorage.setItem('yaping_auth', JSON.stringify({
                            user: currentUser,
                            token: authToken,
                            username: username
                        }));
                        localStorage.setItem('yaping_currentUser', username);

                        return { success: true, user: currentUser };
                    }
                }
            } catch (e) {
                console.warn('[Auth] Supabase signin failed, trying local fallback:', e);
            }
        }

        // Fallback to local user database
        if (localUsers[username] && localUsers[username].password === password) {
            var user = localUsers[username];
            currentUser = { id: user.id, email: username + '@yaping.local' };
            authToken = 'local_' + user.id;
            currentUsername = username;

            localStorage.setItem('yaping_auth', JSON.stringify({
                user: currentUser,
                token: authToken,
                username: username
            }));
            localStorage.setItem('yaping_currentUser', username);

            return { success: true, user: currentUser };
        }

        return { success: false, error: 'Username atau password salah' };
    } catch (e) {
        console.error('[Auth] Signin error:', e);
        return { success: false, error: e.message || 'Login gagal' };
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
