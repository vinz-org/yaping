// ============================================
// YAPING - Authentication Module
// auth.js — Supabase Authentication (Username-based) + Database Persistence
// ============================================

var currentUser = null;
var authToken = null;
var currentUsername = null;
var authInitialized = false;

// Initialize auth from Supabase database
async function initAuth() {
    var stored = localStorage.getItem('yaping_auth');
    if (stored) {
        try {
            var data = JSON.parse(stored);
            currentUser = data.user;
            authToken = data.token;
            currentUsername = data.username;
            localStorage.setItem('yaping_currentUser', currentUsername);
            authInitialized = true;
        } catch (e) {
            console.warn('[Auth] Failed to restore session:', e);
        }
    }
}

// Sign up new user with username and password only
async function signUp(username, password) {
    try {
        // Normalize username
        username = username.trim().toLowerCase();
        
        // Check if username already exists in database
        if (typeof sbGet === 'function') {
            try {
                var existingProfiles = await sbGet('profiles', 'username=eq.' + encodeURIComponent(username));
                if (existingProfiles && Array.isArray(existingProfiles) && existingProfiles.length > 0) {
                    return { success: false, error: 'Username sudah digunakan' };
                }
            } catch (e) {
                console.warn('[Auth] Database check failed:', e);
                return { success: false, error: 'Gagal terhubung ke database' };
            }
        }

        // Generate a temporary email based on username
        var tempEmail = username + '@yaping.local';
        var userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // Try to create on Supabase auth
        var supabaseUserId = null;
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
                        supabaseUserId = signUpData.user.id;
                        userId = supabaseUserId;
                    } catch (je) {
                        console.warn('[Auth] Failed to parse signup response:', je);
                    }
                }
            } catch (e) {
                console.warn('[Auth] Supabase auth signup failed:', e);
            }
        }

        // Create profile in database (IMPORTANT - this is the primary storage)
        if (typeof sbInsert === 'function') {
            try {
                var profileRes = await sbInsert('profiles', {
                    id: userId,
                    username: username,
                    full_name: username,
                    email: tempEmail,
                    password_hash: password, // NOTE: Use proper hashing in production!
                    avatar_url: null,
                    bio: '',
                    created_at: new Date().toISOString()
                });
                
                if (!profileRes) {
                    throw new Error('Failed to create profile in database');
                }
            } catch (e) {
                console.error('[Auth] Failed to create profile in database:', e);
                return { success: false, error: 'Gagal membuat akun di database: ' + e.message };
            }
        } else {
            return { success: false, error: 'Database belum siap' };
        }

        // Save auth session locally (cache only, not primary storage)
        currentUser = { id: userId, email: tempEmail };
        authToken = 'bearer_' + userId;
        currentUsername = username;
        
        localStorage.setItem('yaping_auth', JSON.stringify({
            user: currentUser,
            token: authToken,
            username: username,
            timestamp: Date.now()
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
        
        // Find user in database
        if (typeof sbGet === 'function') {
            try {
                var profiles = await sbGet('profiles', 'username=eq.' + encodeURIComponent(username));
                
                if (!profiles || !Array.isArray(profiles) || profiles.length === 0) {
                    return { success: false, error: 'Username atau password salah' };
                }

                var profile = profiles[0];
                
                // Verify password (simple comparison - use proper hashing in production!)
                if (profile.password_hash !== password) {
                    return { success: false, error: 'Username atau password salah' };
                }

                var userId = profile.id;
                var tempEmail = username + '@yaping.local';

                // Try Supabase auth as backup
                var token = 'bearer_' + userId;
                if (typeof SUPABASE_ANON_KEY !== 'undefined') {
                    try {
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
                            try {
                                var signInData = await signInRes.json();
                                token = signInData.access_token;
                            } catch (je) {
                                console.warn('[Auth] Failed to parse signin response:', je);
                            }
                        }
                    } catch (e) {
                        console.warn('[Auth] Supabase signin failed, using local token:', e);
                    }
                }

                // Save auth session locally (cache)
                currentUser = { id: userId, email: tempEmail };
                authToken = token;
                currentUsername = username;

                localStorage.setItem('yaping_auth', JSON.stringify({
                    user: currentUser,
                    token: authToken,
                    username: username,
                    timestamp: Date.now()
                }));
                localStorage.setItem('yaping_currentUser', username);

                return { success: true, user: currentUser };
            } catch (e) {
                console.error('[Auth] Database signin failed:', e);
                return { success: false, error: 'Gagal login: ' + e.message };
            }
        } else {
            return { success: false, error: 'Database belum siap' };
        }
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
