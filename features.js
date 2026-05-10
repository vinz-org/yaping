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
