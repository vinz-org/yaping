// ============================================
// YAPING - Runtime patches
// db-patch.js - loaded after script.js
// ============================================

(function installProfileAuthGuards() {
    function getStoredAuth() {
        try {
            var raw = localStorage.getItem('yaping_auth');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function hasSupabaseAuthSession() {
        var auth = getStoredAuth();
        return !!(auth && auth.method === 'supabase_auth' && auth.accessToken && auth.username && auth.user && auth.user.id);
    }

    function loggedIn() {
        if (typeof isLoggedIn === 'function' && isLoggedIn()) return true;
        return hasSupabaseAuthSession();
    }

    function requireLogin(message) {
        if (loggedIn()) return true;

        if (typeof showToast === 'function') {
            showToast(message || 'Silakan login dulu');
        }
        if (typeof switchToTab === 'function') {
            switchToTab('login');
        }
        return false;
    }

    function normalizeUsername(value) {
        if (typeof normalizeAuthUsername === 'function') return normalizeAuthUsername(value);
        return String(value || '').trim().toLowerCase().replace(/^@+/, '');
    }

    function applyProfile(profile) {
        profile = profile || {};
        var username = normalizeUsername(profile.username || currentUser);
        var fullName = profile.full_name || currentFullname || username;
        var bio = typeof profile.bio === 'string' ? profile.bio : (currentBio || '');
        var avatarUrl = profile.avatar_url || currentUserPhoto || '';

        currentUser = username;
        currentFullname = fullName;
        currentBio = bio;
        currentUserPhoto = avatarUrl;

        localStorage.setItem('yaping_currentUser', currentUser);
        localStorage.setItem('yaping_currentFullname', currentFullname);
        localStorage.setItem('yaping_currentBio', currentBio);

        if (currentUserPhoto) {
            localStorage.setItem('yaping_currentUserPhoto', currentUserPhoto);
        } else {
            localStorage.removeItem('yaping_currentUserPhoto');
        }

        if (typeof renderProfileAvatar === 'function') renderProfileAvatar();
        if (typeof renderSidebarProfilePic === 'function') renderSidebarProfilePic();
        if (typeof updateProfileStats === 'function') updateProfileStats();
        if (typeof renderRightSidebar === 'function') renderRightSidebar();
        if (typeof renderFeed === 'function') renderFeed();
    }

    if (typeof showProfileSection === 'function') {
        var originalShowProfileSection = showProfileSection;
        window.showProfileSection = showProfileSection = function(section, btn) {
            if (section === 'edit' && !requireLogin('Silakan login dulu untuk edit profil')) {
                return;
            }
            return originalShowProfileSection(section, btn);
        };
    }

    if (typeof handleProfilePhotoUpload === 'function') {
        var originalHandleProfilePhotoUpload = handleProfilePhotoUpload;
        window.handleProfilePhotoUpload = handleProfilePhotoUpload = function(event) {
            if (!requireLogin('Silakan login dulu untuk ubah foto profil')) {
                if (event && event.target) event.target.value = '';
                return;
            }
            return originalHandleProfilePhotoUpload(event);
        };
    }

    if (typeof handleProfileBannerUpload === 'function') {
        var originalHandleProfileBannerUpload = handleProfileBannerUpload;
        window.handleProfileBannerUpload = handleProfileBannerUpload = function(event) {
            if (!requireLogin('Silakan login dulu untuk ubah banner profil')) {
                if (event && event.target) event.target.value = '';
                return;
            }
            return originalHandleProfileBannerUpload(event);
        };
    }

    if (typeof triggerProfileBannerUpload === 'function') {
        var originalTriggerProfileBannerUpload = triggerProfileBannerUpload;
        window.triggerProfileBannerUpload = triggerProfileBannerUpload = function() {
            if (!requireLogin('Silakan login dulu untuk ubah banner profil')) return;
            return originalTriggerProfileBannerUpload();
        };
    }

    if (typeof clearProfileBanner === 'function') {
        var originalClearProfileBanner = clearProfileBanner;
        window.clearProfileBanner = clearProfileBanner = function() {
            if (!requireLogin('Silakan login dulu untuk mengubah banner profil')) return;
            return originalClearProfileBanner();
        };
    }

    if (typeof saveProfile === 'function') {
        window.saveProfile = saveProfile = async function() {
            if (!requireLogin('Silakan login dulu untuk menyimpan profil')) return;

            var elUser = document.getElementById('edit-username');
            var elName = document.getElementById('edit-fullname');
            var elBio = document.getElementById('edit-bio');

            var newUsername = normalizeUsername(elUser ? (elUser.value || currentUser) : currentUser);
            var newFullname = elName ? (elName.value.trim() || newUsername) : newUsername;
            var newBio = elBio ? elBio.value.trim() : '';
            var maxLength = typeof USERNAME_MAX_LENGTH !== 'undefined' ? USERNAME_MAX_LENGTH : 20;

            if (!newUsername) {
                if (typeof showToast === 'function') showToast('Username harus diisi');
                if (elUser) elUser.focus();
                return;
            }

            if (newUsername.length > maxLength) {
                if (typeof showToast === 'function') showToast('Username maksimal ' + maxLength + ' karakter.');
                if (elUser) {
                    elUser.value = newUsername.slice(0, maxLength);
                    elUser.focus();
                }
                return;
            }

            if (!/^[a-z0-9_]+$/.test(newUsername)) {
                if (typeof showToast === 'function') showToast('Username hanya boleh huruf kecil, angka, dan underscore');
                if (elUser) elUser.focus();
                return;
            }

            if (typeof updateProfileAuthenticated !== 'function') {
                if (typeof showToast === 'function') showToast('Auth belum siap. Coba refresh halaman.');
                return;
            }

            var result = await updateProfileAuthenticated(newUsername, newFullname, newBio, currentUserPhoto || null);
            if (!result || !result.success) {
                if (typeof showToast === 'function') showToast((result && result.error) || 'Gagal menyimpan profil');
                return;
            }

            applyProfile(result.profile || {
                username: newUsername,
                full_name: newFullname,
                bio: newBio,
                avatar_url: currentUserPhoto || null
            });

            if (typeof currentProfileBanner !== 'undefined') {
                if (currentProfileBanner) localStorage.setItem('yaping_profileBanner', currentProfileBanner);
                else localStorage.removeItem('yaping_profileBanner');
            }
            if (typeof renderProfileBanner === 'function') renderProfileBanner();

            if (typeof showToast === 'function') showToast('Profil berhasil diperbarui!');
            if (typeof showProfileSection === 'function') {
                showProfileSection('info', document.querySelector('.profile-tab-btn'));
            }
        };
    }
})();
