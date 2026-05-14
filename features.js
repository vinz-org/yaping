// ============================================
// YAPING - Features Module
// features.js - Login, Signup, Edit Posts, Updates
// ============================================

var currentUpdatesFilter = 'all';
var currentSortMode = 'newest'; // 'newest' or 'popular'

function getAuthInputUsername(value) {
    if (typeof normalizeAuthUsername === 'function') {
        return normalizeAuthUsername(value);
    }
    return String(value || '').trim().toLowerCase().replace(/^@+/, '');
}

function getAuthInputEmail(value) {
    if (typeof normalizeAuthEmail === 'function') {
        return normalizeAuthEmail(value);
    }
    return String(value || '').trim().toLowerCase();
}

function createAuthEmailRow(inputId, placeholder) {
    var row = document.createElement('div');
    row.className = 'form-row';

    var label = document.createElement('label');
    label.textContent = 'Email';

    var input = document.createElement('input');
    input.type = 'email';
    input.id = inputId;
    input.placeholder = placeholder || 'email@contoh.com';
    input.autocomplete = 'email';

    row.appendChild(label);
    row.appendChild(input);
    return row;
}

function convertLoginUsernameToEmailField(pendingEmail) {
    var loginEmail = document.getElementById('login-email');
    if (loginEmail) return loginEmail;

    var loginUsername = document.getElementById('login-username');
    if (!loginUsername) return null;

    loginUsername.id = 'login-email';
    loginUsername.type = 'email';
    loginUsername.placeholder = 'email@contoh.com';
    loginUsername.autocomplete = 'email';

    var row = loginUsername.closest ? loginUsername.closest('.form-row') : loginUsername.parentNode;
    var label = row ? row.querySelector('label') : null;
    if (label) label.textContent = 'Email';
    if (pendingEmail) loginUsername.value = pendingEmail;

    return loginUsername;
}

function installAuthEmailFields() {
    var pendingEmail = localStorage.getItem('yaping_pendingEmail') || '';
    var loginEmail = convertLoginUsernameToEmailField(pendingEmail);

    if (!loginEmail) {
        var loginPassword = document.getElementById('login-password');
        if (loginPassword && loginPassword.parentNode) {
            var loginRow = createAuthEmailRow('login-email', 'email@contoh.com');
            loginPassword.parentNode.insertAdjacentElement('beforebegin', loginRow);
            if (pendingEmail) loginRow.querySelector('input').value = pendingEmail;
        }
    }

    if (!document.getElementById('signup-email')) {
        var signupPassword = document.getElementById('signup-password');
        if (signupPassword && signupPassword.parentNode) {
            var signupRow = createAuthEmailRow('signup-email', 'email@contoh.com');
            signupPassword.parentNode.insertAdjacentElement('afterend', signupRow);
        }
    }
}

// ===== AUTHENTICATION HANDLERS =====

async function handleLogin() {
    var emailInput = document.getElementById('login-email');
    var passwordInput = document.getElementById('login-password');
    var email = getAuthInputEmail(emailInput ? emailInput.value : '');
    var password = passwordInput ? passwordInput.value : '';

    if (!email || !password) {
        showToast('Email dan password harus diisi');
        return;
    }

    var result = await signIn(email, password);
    if (result.success) {
        localStorage.removeItem('yaping_pendingEmail');
        showToast('Login berhasil!');
        setTimeout(function() {
            switchToTab('home');
            location.reload();
        }, 800);
    } else {
        showToast(result.error);
    }
}

async function handleSignup() {
    var usernameInput = document.getElementById('signup-username');
    var passwordInput = document.getElementById('signup-password');
    var emailInput = document.getElementById('signup-email');
    var confirmInput = document.getElementById('signup-password-confirm');
    var username = getAuthInputUsername(usernameInput ? usernameInput.value : '');
    var email = getAuthInputEmail(emailInput ? emailInput.value : '');
    var password = passwordInput ? passwordInput.value : '';
    var passwordConfirm = confirmInput ? confirmInput.value : '';

    if (!username || !email || !password || !passwordConfirm) {
        showToast('Semua field harus diisi');
        return;
    }

    if (password !== passwordConfirm) {
        showToast('Password tidak cocok');
        return;
    }

    if (password.length < 6) {
        showToast('Password minimal 6 karakter');
        return;
    }

    if (username.length < 3 || username.length > 20) {
        showToast('Username harus 3-20 karakter');
        return;
    }

    var result = await signUp(username, email, password);
    if (result.success) {
        if (result.needsLogin) {
            showToast('Daftar berhasil! Cek email jika diminta, lalu login.');
            setTimeout(function() {
                switchToTab('login');
                var loginEmail = document.getElementById('login-email');
                if (loginEmail) loginEmail.value = email;
            }, 800);
        } else {
            showToast('Daftar berhasil! Kamu sudah masuk');
            setTimeout(function() {
                switchToTab('home');
                location.reload();
            }, 800);
        }
    } else {
        showToast(result.error);
    }
}

// ===== EDIT POST FUNCTIONALITY =====

function showEditPostModal(postId) {
    var post = findPostById(feedPosts, postId);
    if (!post) {
        showToast('Postingan tidak ditemukan');
        return;
    }

    // Check if user owns this post
    if (post.author !== getCurrentUsername()) {
        showToast('Anda hanya bisa edit postingan sendiri');
        return;
    }

    var modalTitle = document.getElementById('modal-title');
    var modalBody = document.getElementById('modal-body');
    var modalFooter = document.getElementById('modal-footer');

    modalTitle.innerHTML = 'Edit Postingan';
    modalBody.innerHTML = `
        <textarea id="edit-post-content" style="width: 100%; height: 120px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: Arial, sans-serif; font-size: 14px;">${escapeHtml(post.content || '')}</textarea>
    `;
    modalFooter.innerHTML = `
        <button class="primary-btn" onclick="saveEditPost('${jsString(postId)}')">Simpan</button>
        <button class="secondary-btn" onclick="closeModal()">Batal</button>
    `;

    document.getElementById('modal-overlay').classList.remove('hidden');
}

async function saveEditPost(postId) {
    var newContent = document.getElementById('edit-post-content').value.trim();

    if (!newContent) {
        showToast('Konten tidak boleh kosong');
        return;
    }

    try {
        // Update in database
        await sbUpdate('feed_posts', 'id', postId, {
            content: newContent
        });

        // Update in local cache
        var idx = findPostIndexById(feedPosts, postId);
        if (idx !== -1) {
            feedPosts[idx].content = newContent;
            saveFeedPosts();
        }

        // Log activity
        await logActivity('edit_post', 'post', postId, 'Edited post content');

        showToast('Postingan berhasil diperbarui');
        closeModal();
        renderFeed();
        renderMyPosts();
    } catch (e) {
        console.error('[Features] Edit post error:', e);
        showToast('Gagal mengupdate postingan');
    }
}

function deletePost(postId) {
    if (!confirm('Apakah Anda yakin ingin menghapus postingan ini?')) return;

    var post = findPostById(feedPosts, postId);
    if (!post) {
        showToast('Postingan tidak ditemukan');
        return;
    }

    if (post.author !== getCurrentUsername()) {
        showToast('Anda hanya bisa hapus postingan sendiri');
        return;
    }

    try {
        // Delete from database
        sbDelete('feed_posts', 'id', postId);

        // Delete from local cache
        var idx = findPostIndexById(feedPosts, postId);
        if (idx !== -1) {
            feedPosts.splice(idx, 1);
            saveFeedPosts();
        }

        // Log activity
        logActivity('delete_post', 'post', postId, 'Deleted post');

        showToast('Postingan berhasil dihapus');
        renderFeed();
        renderMyPosts();
    } catch (e) {
        console.error('[Features] Delete post error:', e);
        showToast('Gagal menghapus postingan');
    }
}

// ===== UPDATES TAB FUNCTIONALITY =====
// NOTE: renderUpdates() and filterUpdates() are defined in script.js to use local post data
// This prevents conflicts between local and database implementations

// ===== HELPER FUNCTIONS =====

function findPostById(posts, postId) {
    if (!posts) return null;
    for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === postId) return posts[i];
    }
    return null;
}

function findPostIndexById(posts, postId) {
    if (!posts) return -1;
    for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === postId) return i;
    }
    return -1;
}

function jsString(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', installAuthEmailFields);

// Check if user is logged in on page load
window.addEventListener('load', function() {
    installAuthEmailFields();

    if (!isLoggedIn()) {
        switchToTab('login');
    } else {
        // Load updates when switching to updates tab
        var originalSwitchToTab = window.switchToTab;
        window.switchToTab = function(tabName) {
            if (tabName === 'updates') {
                if (typeof loadUpdates === 'function') loadUpdates();
            }
            return originalSwitchToTab(tabName);
        };
    }
});

// ===== SORTING FUNCTIONALITY =====

function setSortMode(mode) {
    currentSortMode = mode;
    
    // Update button states
    var newestBtn = document.getElementById('sort-newest-btn');
    var popularBtn = document.getElementById('sort-popular-btn');
    
    if (newestBtn && popularBtn) {
        if (mode === 'newest') {
            newestBtn.classList.add('active');
            popularBtn.classList.remove('active');
        } else {
            newestBtn.classList.remove('active');
            popularBtn.classList.add('active');
        }
    }
    
    // Re-render feed with new sort
    if (typeof renderFeed === 'function') renderFeed();
}

// ===== PROFILE BANNER FUNCTIONALITY =====

var profileBanner = null;

function triggerBannerUpload() {
    var input = document.getElementById('bannerUpload');
    if (input) input.click();
}

async function handleBannerUpload(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('❌ Ukuran banner terlalu besar (max 5MB)');
        return;
    }
    
    var reader = new FileReader();
    reader.onload = async function(e) {
        profileBanner = e.target.result;
        
        // Update banner display
        var bannerEl = document.getElementById('profile-banner');
        if (bannerEl) {
            bannerEl.style.backgroundImage = 'url(' + profileBanner + ')';
        }
        
        // Save to localStorage
        localStorage.setItem('yaping_banner_' + getCurrentUsername(), profileBanner);
        
        showToast('✅ Banner berhasil diupload!');
    };
    reader.readAsDataURL(file);
}

function loadProfileBanner() {
    var username = getCurrentUsername();
    var savedBanner = localStorage.getItem('yaping_banner_' + username);
    if (savedBanner) {
        profileBanner = savedBanner;
        var bannerEl = document.getElementById('profile-banner');
        if (bannerEl) {
            bannerEl.style.backgroundImage = 'url(' + savedBanner + ')';
        }
    }
}

// ===== FOLLOWERS/FOLLOWING FUNCTIONALITY =====

var userFollowers = {}; // { username: [follower1, follower2, ...] }
var userFollowing = {}; // { username: [following1, following2, ...] }

function followUser(username) {
    var currentUser = getCurrentUsername();
    if (!currentUser) {
        showToast('❌ Anda harus login terlebih dahulu');
        return;
    }
    
    if (username === currentUser) {
        showToast('⚠️ Anda tidak bisa follow diri sendiri');
        return;
    }
    
    // Add to following list
    if (!userFollowing[currentUser]) userFollowing[currentUser] = [];
    if (userFollowing[currentUser].indexOf(username) === -1) {
        userFollowing[currentUser].push(username);
    }
    
    // Add to followers list of the target user
    if (!userFollowers[username]) userFollowers[username] = [];
    if (userFollowers[username].indexOf(currentUser) === -1) {
        userFollowers[username].push(currentUser);
    }
    
    // Save to localStorage
    localStorage.setItem('yaping_following_' + currentUser, JSON.stringify(userFollowing[currentUser]));
    localStorage.setItem('yaping_followers_' + username, JSON.stringify(userFollowers[username]));
    
    showToast('✅ Berhasil follow ' + username);
    updateFollowStats();
}

function unfollowUser(username) {
    var currentUser = getCurrentUsername();
    if (!currentUser) return;
    
    // Remove from following list
    if (userFollowing[currentUser]) {
        var idx = userFollowing[currentUser].indexOf(username);
        if (idx !== -1) userFollowing[currentUser].splice(idx, 1);
    }
    
    // Remove from followers list of the target user
    if (userFollowers[username]) {
        var idx = userFollowers[username].indexOf(currentUser);
        if (idx !== -1) userFollowers[username].splice(idx, 1);
    }
    
    // Save to localStorage
    localStorage.setItem('yaping_following_' + currentUser, JSON.stringify(userFollowing[currentUser] || []));
    localStorage.setItem('yaping_followers_' + username, JSON.stringify(userFollowers[username] || []));
    
    showToast('✅ Berhasil unfollow ' + username);
    updateFollowStats();
}

function loadFollowData() {
    var currentUser = getCurrentUsername();
    if (!currentUser) return;
    
    // Load following list
    var followingStr = localStorage.getItem('yaping_following_' + currentUser);
    if (followingStr) {
        try {
            userFollowing[currentUser] = JSON.parse(followingStr);
        } catch (e) {
            userFollowing[currentUser] = [];
        }
    } else {
        userFollowing[currentUser] = [];
    }
    
    // Load followers list
    var followersStr = localStorage.getItem('yaping_followers_' + currentUser);
    if (followersStr) {
        try {
            userFollowers[currentUser] = JSON.parse(followersStr);
        } catch (e) {
            userFollowers[currentUser] = [];
        }
    } else {
        userFollowers[currentUser] = [];
    }
}

function updateFollowStats() {
    var currentUser = getCurrentUsername();
    var followersCount = userFollowers[currentUser] ? userFollowers[currentUser].length : 0;
    var followingCount = userFollowing[currentUser] ? userFollowing[currentUser].length : 0;
    
    var followersEl = document.getElementById('pi-followers-count');
    var followingEl = document.getElementById('pi-following-count');
    
    if (followersEl) followersEl.textContent = followersCount;
    if (followingEl) followingEl.textContent = followingCount;
}

function showFollowers() {
    var currentUser = getCurrentUsername();
    var followers = userFollowers[currentUser] || [];
    
    var modal = document.getElementById('followers-modal');
    var title = document.getElementById('followers-modal-title');
    var list = document.getElementById('followers-list');
    
    if (modal && title && list) {
        title.textContent = 'Pengikut (' + followers.length + ')';
        
        if (followers.length === 0) {
            list.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">Belum ada pengikut</div>';
        } else {
            var html = '';
            for (var i = 0; i < followers.length; i++) {
                html += '<div style="padding: 8px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">' +
                    '<span>' + escapeHtml(followers[i]) + '</span>' +
                    '<button class="secondary-btn" onclick="unfollowUser(\'' + jsString(followers[i]) + '\')" style="padding: 4px 8px; font-size: 11px;">Hapus Pengikut</button>' +
                    '</div>';
            }
            list.innerHTML = html;
        }
        
        modal.classList.remove('hidden');
    }
}

function showFollowing() {
    var currentUser = getCurrentUsername();
    var following = userFollowing[currentUser] || [];
    
    var modal = document.getElementById('followers-modal');
    var title = document.getElementById('followers-modal-title');
    var list = document.getElementById('followers-list');
    
    if (modal && title && list) {
        title.textContent = 'Diikuti (' + following.length + ')';
        
        if (following.length === 0) {
            list.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">Belum mengikuti siapa pun</div>';
        } else {
            var html = '';
            for (var i = 0; i < following.length; i++) {
                html += '<div style="padding: 8px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">' +
                    '<span>' + escapeHtml(following[i]) + '</span>' +
                    '<button class="secondary-btn" onclick="unfollowUser(\'' + jsString(following[i]) + '\')" style="padding: 4px 8px; font-size: 11px;">Unfollow</button>' +
                    '</div>';
            }
            list.innerHTML = html;
        }
        
        modal.classList.remove('hidden');
    }
}

function closeFollowersModal() {
    var modal = document.getElementById('followers-modal');
    if (modal) modal.classList.add('hidden');
}

function escapeHtml(text) {
    var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        \"'\": '&#039;'
    };
    return String(text).replace(/[&<>\"']/g, function(m) { return map[m]; });
}

// Load data on init
window.addEventListener('load', function() {
    loadFollowData();
    loadProfileBanner();
    updateFollowStats();
});
