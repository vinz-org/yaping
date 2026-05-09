// ============================================
// YAPING - Features Module
// features.js — Login, Signup, Edit Posts, Updates
// ============================================

var currentUpdatesFilter = 'all';

// ===== AUTHENTICATION HANDLERS =====

async function handleLogin() {
    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;

    if (!email || !password) {
        showToast('❌ Email dan password harus diisi');
        return;
    }

    var result = await signIn(email, password);
    if (result.success) {
        showToast('✅ Login berhasil!');
        setTimeout(function() {
            switchToTab('home');
            location.reload();
        }, 1000);
    } else {
        showToast('❌ ' + result.error);
    }
}

async function handleSignup() {
    var email = document.getElementById('signup-email').value.trim();
    var username = document.getElementById('signup-username').value.trim();
    var fullName = document.getElementById('signup-fullname').value.trim();
    var password = document.getElementById('signup-password').value;
    var passwordConfirm = document.getElementById('signup-password-confirm').value;

    if (!email || !username || !fullName || !password || !passwordConfirm) {
        showToast('❌ Semua field harus diisi');
        return;
    }

    if (password !== passwordConfirm) {
        showToast('❌ Password tidak cocok');
        return;
    }

    if (password.length < 6) {
        showToast('❌ Password minimal 6 karakter');
        return;
    }

    if (username.length < 3 || username.length > 20) {
        showToast('❌ Username harus 3-20 karakter');
        return;
    }

    var result = await signUp(email, password, username, fullName);
    if (result.success) {
        showToast('✅ Daftar berhasil! Silakan login');
        setTimeout(function() {
            switchToTab('login');
            document.getElementById('login-email').value = email;
        }, 1000);
    } else {
        showToast('❌ ' + result.error);
    }
}

// ===== EDIT POST FUNCTIONALITY =====

function showEditPostModal(postId) {
    var post = findPostById(feedPosts, postId);
    if (!post) {
        showToast('❌ Postingan tidak ditemukan');
        return;
    }

    // Check if user owns this post
    if (post.author !== getCurrentUsername()) {
        showToast('❌ Anda hanya bisa edit postingan sendiri');
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
        showToast('❌ Konten tidak boleh kosong');
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

        showToast('✅ Postingan berhasil diperbarui');
        closeModal();
        renderFeed();
        renderMyPosts();
    } catch (e) {
        console.error('[Features] Edit post error:', e);
        showToast('❌ Gagal mengupdate postingan');
    }
}

function deletePost(postId) {
    if (!confirm('Apakah Anda yakin ingin menghapus postingan ini?')) return;

    var post = findPostById(feedPosts, postId);
    if (!post) {
        showToast('❌ Postingan tidak ditemukan');
        return;
    }

    if (post.author !== getCurrentUsername()) {
        showToast('❌ Anda hanya bisa hapus postingan sendiri');
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

        showToast('✅ Postingan berhasil dihapus');
        renderFeed();
        renderMyPosts();
    } catch (e) {
        console.error('[Features] Delete post error:', e);
        showToast('❌ Gagal menghapus postingan');
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
