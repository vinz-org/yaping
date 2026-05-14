// ============================================
// YAPING - Main UI Script
// script.js - All core UI functionality
// ============================================

// ===== GLOBAL VARIABLES =====
var feedPosts = [];
var communityList = [];
var myPosts = [];
var notifications = [];
var currentUser = 'user';
var currentFullname = 'Pengguna Yaping';
var currentBio = '';
var currentUserPhoto = '';
var hashtags = {};
var updates = [];
var postImages = {};
var currentSortMode = 'newest'; // 'newest' or 'popular'
var currentUpdatesFilter = 'all';
var userFollowers = {}; // { username: [follower1, follower2, ...] }
var userFollowing = {}; // { username: [following1, following2, ...] }
var profileBanner = null;

// ===== INITIALIZATION =====
window.addEventListener('load', function() {
    loadLocalData();
    
    // Setup auth check
    if (typeof initAuth === 'function') {
        initAuth();
    }
    
    // Check if logged in, otherwise show login
    setTimeout(function() {
        if (!isLoggedIn()) {
            switchToTab('login');
        } else {
            switchToTab('home');
            renderFeed();
            loadProfileBanner();
            loadFollowData();
            renderProfileAvatar();
            renderRightSidebar();
        }
    }, 500);
    
    // Load sample data if empty
    if (feedPosts.length === 0) {
        loadSampleData();
    }
});

// ===== TAB SWITCHING =====
function switchToTab(tabName) {
    // Hide all tabs
    var tabs = document.querySelectorAll('.tab-content');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.add('hidden');
    }
    
    // Show selected tab
    var selectedTab = document.getElementById(tabName + '-tab');
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
    }
    
    // Update nav highlights
    var navItems = document.querySelectorAll('#topbar-nav a');
    for (var i = 0; i < navItems.length; i++) {
        navItems[i].style.fontWeight = 'normal';
    }
    
    var navItem = document.getElementById('nav-' + tabName);
    if (navItem) {
        navItem.style.fontWeight = 'bold';
    }
    
    // Load specific data for tabs
    if (tabName === 'updates') {
        loadUpdates();
    } else if (tabName === 'profile') {
        renderProfileInfo();
        renderMyPosts();
    }
}

// ===== AUTHENTICATION HELPERS =====
function getCurrentUsername() {
    return currentUser || localStorage.getItem('yaping_currentUser') || '@user';
}

function isLoggedIn() {
    if (typeof authSessionToken !== 'undefined' && authSessionToken) return true;
    var auth = localStorage.getItem('yaping_auth');
    return !!auth;
}

// ===== NOTIFICATIONS =====
function showToast(message) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(function() {
        toast.classList.add('hidden');
    }, 3000);
}

function showNotifications() {
    var dropdown = document.getElementById('notif-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

function clearNotifications() {
    notifications = [];
    localStorage.removeItem('yaping_notifications');
    renderNotifications();
    showToast('Notifikasi dihapus');
}

function renderNotifications() {
    var list = document.getElementById('notif-list');
    if (!list) return;
    
    if (notifications.length === 0) {
        list.innerHTML = '<div class="notif-empty">Belum ada notifikasi</div>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < notifications.length; i++) {
        var notif = notifications[i];
        html += '<div class="notif-item">' +
            '<div><strong>' + escapeHtml(notif.title) + '</strong></div>' +
            '<div style="font-size: 12px; color: #666;">' + escapeHtml(notif.message) + '</div>' +
            '</div>';
    }
    list.innerHTML = html;
}

// ===== POSTS =====
function renderFeed() {
    var feed = document.getElementById('feed');
    if (!feed) return;
    
    var sorted = feedPosts.slice();
    
    // Sort by selected mode
    if (currentSortMode === 'popular') {
        sorted.sort(function(a, b) {
            return (b.likes || 0) - (a.likes || 0);
        });
    } else {
        sorted.sort(function(a, b) {
            return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
        });
    }
    
    var html = '';
    for (var i = 0; i < sorted.length; i++) {
        var post = sorted[i];
        var isOwn = post.author === getCurrentUsername();
        
        html += '<div class="content-box" style="margin-bottom: 16px;">' +
            '<div style="display: flex; justify-content: space-between; align-items: start;">' +
            '<div><strong>' + escapeHtml(post.author) + '</strong><br>' +
            '<small style="color: #666;">' + new Date(post.timestamp).toLocaleString('id-ID') + '</small></div>';
        
        if (isOwn) {
            html += '<div style="display: flex; gap: 4px;">' +
                '<button class="secondary-btn" style="padding: 2px 6px; font-size: 11px;" onclick="showEditPostModal(\'' + jsString(post.id) + '\')">Edit</button>' +
                '<button class="danger-btn" style="padding: 2px 6px; font-size: 11px;" onclick="deletePost(\'' + jsString(post.id) + '\')">Hapus</button>' +
                '</div>';
        }
        
        html += '</div>' +
            '<div style="margin: 8px 0; white-space: pre-wrap;">' + escapeHtml(post.content) + '</div>';
        
        if (post.image) {
            html += '<img src="' + post.image + '" style="max-width: 100%; max-height: 300px; border-radius: 4px; margin-bottom: 8px;">';
        }
        
        html += '<div style="display: flex; gap: 12px; padding-top: 8px; border-top: 1px solid #eee; font-size: 12px; color: #666;">' +
            '<button class="option-btn" onclick="likePost(\'' + jsString(post.id) + '\')">❤️ ' + (post.likes || 0) + '</button>' +
            '<button class="option-btn" onclick="commentPost(\'' + jsString(post.id) + '\')">💬 ' + (post.comments || 0) + '</button>' +
            '<button class="option-btn" onclick="sharePost(\'' + jsString(post.id) + '\')">🔄 Bagikan</button>' +
            '</div>' +
            '</div>';
    }
    
    if (html === '') {
        html = '<div class="content-box" style="text-align: center; color: #999; padding: 40px;">Belum ada postingan. Buat postingan pertama Anda!</div>';
    }
    
    feed.innerHTML = html;
}

function submitPost() {
    var input = document.getElementById('postInput');
    var content = input ? input.value.trim() : '';
    
    if (!content) {
        showToast('Konten tidak boleh kosong');
        return;
    }
    
    if (!isLoggedIn()) {
        showToast('Silakan login terlebih dahulu');
        switchToTab('login');
        return;
    }
    
    var post = {
        id: 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        author: getCurrentUsername(),
        content: content,
        timestamp: new Date().toISOString(),
        likes: 0,
        comments: 0,
        image: postImages.current || null
    };
    
    feedPosts.unshift(post);
    saveFeedPosts();
    
    if (input) input.value = '';
    removePostImage();
    postImages.current = null;
    
    // Sync to database
    if (typeof sbInsert === 'function') {
        sbInsert('feed_posts', post);
    }
    
    showToast('Postingan berhasil dibagikan!');
    renderFeed();
}

function likePost(postId) {
    var post = findPostById(feedPosts, postId);
    if (!post) return;
    
    post.likes = (post.likes || 0) + 1;
    saveFeedPosts();
    renderFeed();
}

function commentPost(postId) {
    showToast('Fitur komentar akan segera hadir');
}

function sharePost(postId) {
    showToast('Postingan dibagikan');
}

function renderMyPosts() {
    var container = document.getElementById('my-posts-feed');
    if (!container) return;
    
    var myPosts = [];
    for (var i = 0; i < feedPosts.length; i++) {
        if (feedPosts[i].author === getCurrentUsername()) {
            myPosts.push(feedPosts[i]);
        }
    }
    
    if (myPosts.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">Anda belum membuat postingan</div>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < myPosts.length; i++) {
        var post = myPosts[i];
        html += '<div class="content-box" style="margin-bottom: 12px;">' +
            '<div>' + escapeHtml(post.content.substring(0, 100)) + (post.content.length > 100 ? '...' : '') + '</div>' +
            '<div style="font-size: 12px; color: #666; margin-top: 8px;">' + new Date(post.timestamp).toLocaleString('id-ID') + '</div>' +
            '</div>';
    }
    
    container.innerHTML = html;
}

// ===== MEDIA HANDLING =====
function addEmoji() {
    var picker = document.getElementById('emoji-picker');
    if (picker) {
        picker.classList.toggle('hidden');
    }
}

function insertEmoji(emoji) {
    var input = document.getElementById('postInput');
    if (input) {
        input.value += emoji;
    }
}

function triggerMediaUpload() {
    var input = document.getElementById('mediaUpload');
    if (input) {
        input.click();
    }
}

function handleMediaUpload(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
        showToast('File terlalu besar (max 10MB)');
        return;
    }
    
    var reader = new FileReader();
    reader.onload = function(e) {
        postImages.current = e.target.result;
        
        var preview = document.getElementById('post-preview-img');
        var img = document.getElementById('post-img-preview');
        if (preview && img) {
            img.src = postImages.current;
            preview.style.display = 'block';
        }
        
        var blurBtn = document.getElementById('blur-media-btn');
        if (blurBtn && file.type.startsWith('image/')) {
            blurBtn.style.display = 'inline-block';
        }
    };
    reader.readAsDataURL(file);
}

function removePostImage() {
    postImages.current = null;
    var preview = document.getElementById('post-preview-img');
    if (preview) {
        preview.style.display = 'none';
    }
}

function toggleBlurMedia() {
    var img = document.getElementById('post-img-preview');
    if (img) {
        img.style.filter = img.style.filter === 'blur(15px)' ? 'none' : 'blur(15px)';
    }
}

// ===== COMMUNITIES =====
function addCommunity() {
    var name = document.getElementById('newCommunityInput');
    var desc = document.getElementById('newCommunityDesc');
    var cat = document.getElementById('newCommunityCategory');
    
    var communityName = name ? name.value.trim() : '';
    var communityDesc = desc ? desc.value.trim() : '';
    var communityCategory = cat ? cat.value : '';
    
    if (!communityName) {
        showToast('Nama komunitas harus diisi');
        return;
    }
    
    var community = {
        id: 'comm_' + Date.now(),
        name: communityName,
        description: communityDesc,
        category: communityCategory,
        creator: getCurrentUsername(),
        members: [getCurrentUsername()],
        created_at: new Date().toISOString()
    };
    
    communityList.push(community);
    localStorage.setItem('yaping_communities', JSON.stringify(communityList));
    
    if (name) name.value = '';
    if (desc) desc.value = '';
    
    showToast('Komunitas berhasil dibuat!');
    renderCommunities();
}

function renderCommunities() {
    var list = document.getElementById('communityList');
    if (!list) return;
    
    if (communityList.length === 0) {
        list.innerHTML = '<div class="sidebar-empty">Belum ada komunitas</div>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < communityList.length; i++) {
        var comm = communityList[i];
        html += '<li style="padding: 8px; border-bottom: 1px solid #eee; cursor: pointer;" onclick="viewCommunity(\'' + jsString(comm.id) + '\')">' +
            '<div><strong>' + escapeHtml(comm.category + ' ' + comm.name) + '</strong></div>' +
            '<div style="font-size: 12px; color: #666;">' + comm.members.length + ' anggota</div>' +
            '</li>';
    }
    
    list.innerHTML = html;
}

function filterComm(filter, btn) {
    if (btn) {
        var btns = document.querySelectorAll('.filter-btn');
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.remove('active');
        }
        btn.classList.add('active');
    }
    
    var list = document.getElementById('communityList');
    if (!list) return;
    
    var filtered = communityList;
    if (filter === 'mine') {
        filtered = communityList.filter(function(c) {
            return c.creator === getCurrentUsername();
        });
    }
    
    renderCommunities();
}

function viewCommunity(commId) {
    switchToTab('community-detail');
    showToast('Komunitas sedang dimuat...');
}

// ===== PROFILE =====
function renderProfileInfo() {
    var username = document.getElementById('pi-username');
    var fullname = document.getElementById('pi-fullname');
    var posts = document.getElementById('pi-posts');
    var comms = document.getElementById('pi-comms');
    
    if (username) username.textContent = getCurrentUsername();
    if (fullname) fullname.textContent = currentFullname;
    
    var myPostCount = feedPosts.filter(function(p) {
        return p.author === getCurrentUsername();
    }).length;
    if (posts) posts.textContent = myPostCount;
    if (comms) comms.textContent = communityList.length;
    
    updateFollowStats();
}

function renderProfileAvatar() {
    var avatars = document.querySelectorAll('.profile-avatar-big, .sidebar-profile-pic');
    var avatar = currentUserPhoto ? currentUserPhoto : '👤';
    
    for (var i = 0; i < avatars.length; i++) {
        avatars[i].textContent = avatar;
    }
}

function renderSidebarProfilePic() {
    var sidebar = document.getElementById('sidebar-username');
    if (sidebar) {
        sidebar.textContent = '@' + getCurrentUsername().replace(/^@/, '');
    }
}

function showProfileSection(section, btn) {
    var sections = document.querySelectorAll('[id$="-section"]');
    for (var i = 0; i < sections.length; i++) {
        sections[i].classList.add('hidden');
    }
    
    var sectionEl = document.getElementById('profile-' + section + '-section');
    if (sectionEl) {
        sectionEl.classList.remove('hidden');
    }
    
    if (btn) {
        var btns = document.querySelectorAll('.profile-tab-btn');
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.remove('active');
        }
        btn.classList.add('active');
    }
    
    if (section === 'edit') {
        loadProfileForEdit();
    }
}

function loadProfileForEdit() {
    var userEl = document.getElementById('edit-username');
    var nameEl = document.getElementById('edit-fullname');
    var bioEl = document.getElementById('edit-bio');
    
    if (userEl) userEl.value = getCurrentUsername();
    if (nameEl) nameEl.value = currentFullname;
    if (bioEl) bioEl.value = currentBio;
}

function handleProfilePhotoUpload(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    var reader = new FileReader();
    reader.onload = function(e) {
        currentUserPhoto = e.target.result;
        localStorage.setItem('yaping_currentUserPhoto', currentUserPhoto);
        renderProfileAvatar();
        showToast('Foto profil berhasil diubah!');
    };
    reader.readAsDataURL(file);
}

function updateProfileStats() {
    if (typeof updateFollowStats === 'function') {
        updateFollowStats();
    }
}

// ===== SETTINGS =====
function logout() {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
        localStorage.clear();
        if (typeof clearAuthSession === 'function') {
            clearAuthSession();
        }
        showToast('Anda telah keluar');
        location.reload();
    }
}

function resetAllData() {
    if (confirm('Ini akan menghapus SEMUA data Anda. Lanjutkan?')) {
        localStorage.clear();
        feedPosts = [];
        communityList = [];
        showToast('Semua data berhasil direset');
        location.reload();
    }
}

function clearAllPosts() {
    if (confirm('Hapus semua postingan Anda? Ini tidak bisa dibatalkan.')) {
        feedPosts = feedPosts.filter(function(p) {
            return p.author !== getCurrentUsername();
        });
        saveFeedPosts();
        showToast('Semua postingan Anda berhasil dihapus');
        renderFeed();
        renderMyPosts();
    }
}

function toggleDarkMode() {
    var toggle = document.getElementById('dark-mode-toggle');
    if (toggle && toggle.checked) {
        document.documentElement.style.filter = 'invert(1)';
        localStorage.setItem('yaping_darkmode', '1');
    } else {
        document.documentElement.style.filter = 'none';
        localStorage.removeItem('yaping_darkmode');
    }
}

function changeFontSize(size) {
    document.documentElement.style.fontSize = size + 'px';
    localStorage.setItem('yaping_fontsize', size);
}

// ===== SEARCH =====
function doSearch() {
    var input = document.getElementById('searchInput');
    var query = input ? input.value.trim() : '';
    
    if (!query) {
        showToast('Cari apa?');
        return;
    }
    
    doGlobalSearch();
}

function doGlobalSearch() {
    var input = document.getElementById('tabSearchInput');
    var query = input ? input.value.trim().toLowerCase() : '';
    
    if (!query) return;
    
    switchToTab('search');
    
    // Search in posts
    var results = '<div style="margin-bottom: 16px;"><h3>Postingan</h3>';
    var found = false;
    for (var i = 0; i < feedPosts.length; i++) {
        if (feedPosts[i].content.toLowerCase().indexOf(query) !== -1) {
            results += '<div class="content-box">' +
                '<strong>' + escapeHtml(feedPosts[i].author) + '</strong><br>' +
                escapeHtml(feedPosts[i].content.substring(0, 100)) + '...' +
                '</div>';
            found = true;
        }
    }
    results += found ? '' : '<div class="sidebar-empty">Tidak ada hasil</div>';
    results += '</div>';
    
    // Search in users
    results += '<div><h3>Pengguna</h3>';
    results += '<div class="sidebar-empty">Fitur pencarian pengguna segera hadir</div></div>';
    
    var container = document.getElementById('search-results-container');
    if (container) {
        container.innerHTML = results;
    }
}

// ===== UPDATES =====
function loadUpdates() {
    var feed = document.getElementById('updates-feed');
    if (!feed) return;
    
    if (updates.length === 0) {
        feed.innerHTML = '<div class="sidebar-empty">Tidak ada update terbaru</div>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < updates.length; i++) {
        var update = updates[i];
        html += '<div class="content-box" style="margin-bottom: 12px;">' +
            '<div style="font-weight: bold; margin-bottom: 4px;">' + escapeHtml(update.title) + '</div>' +
            '<div style="color: #666; font-size: 12px; margin-bottom: 8px;">' + new Date(update.date).toLocaleString('id-ID') + '</div>' +
            '<div>' + escapeHtml(update.content) + '</div>' +
            '</div>';
    }
    
    feed.innerHTML = html;
}

// ===== ADMIN FUNCTIONS =====
function checkAdminStatus() {
    var username = getCurrentUsername().replace(/^@/, '');
    var isAdmin = false;
    
    if (typeof YAPING_BADGE_USERS !== 'undefined') {
        for (var i = 0; i < YAPING_BADGE_USERS.length; i++) {
            if (YAPING_BADGE_USERS[i].replace(/^@/, '') === username) {
                isAdmin = true;
                break;
            }
        }
    }
    
    var adminGroup = document.getElementById('admin-settings-group');
    if (adminGroup) {
        adminGroup.classList.toggle('hidden', !isAdmin);
    }
    
    return isAdmin;
}

function adminActionBan() {
    var input = document.getElementById('admin-ban-username');
    var username = input ? input.value.trim().replace(/^@/, '') : '';
    
    if (!username) {
        showToast('Username harus diisi');
        return;
    }
    
    if (typeof sbInsert === 'function') {
        sbInsert('yaping_bans', {
            username: username,
            client_id: '',
            reason: 'Banned by admin',
            is_permanent: true,
            created_at: new Date().toISOString()
        });
        showToast('User berhasil di-ban');
        if (input) input.value = '';
    }
}

function adminActionUnban() {
    var input = document.getElementById('admin-unban-username');
    var username = input ? input.value.trim().replace(/^@/, '') : '';
    
    if (!username) {
        showToast('Username harus diisi');
        return;
    }
    
    if (typeof sbDelete === 'function') {
        sbDelete('yaping_bans', 'username', username);
        showToast('User berhasil di-unban');
        if (input) input.value = '';
    }
}

// ===== MODAL FUNCTIONS =====
function closeModal() {
    var modal = document.getElementById('modal-overlay');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function closeFollowersModal() {
    var modal = document.getElementById('followers-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// ===== HELPER FUNCTIONS =====
// Note: These helper functions are defined in features.js to avoid conflicts
// - escapeHtml()
// - findPostById()
// - findPostIndexById()
// - jsString()

function saveFeedPosts() {
    localStorage.setItem('yaping_feedposts', JSON.stringify(feedPosts));
}

function loadLocalData() {
    var stored = localStorage.getItem('yaping_feedposts');
    if (stored) {
        try {
            feedPosts = JSON.parse(stored);
        } catch (e) {
            feedPosts = [];
        }
    }
    
    var commStored = localStorage.getItem('yaping_communities');
    if (commStored) {
        try {
            communityList = JSON.parse(commStored);
        } catch (e) {
            communityList = [];
        }
    }
    
    // Load user data
    currentUser = localStorage.getItem('yaping_currentUser') || 'user';
    currentFullname = localStorage.getItem('yaping_currentFullname') || 'Pengguna Yaping';
    currentBio = localStorage.getItem('yaping_currentBio') || '';
    currentUserPhoto = localStorage.getItem('yaping_currentUserPhoto') || '';
    
    // Load notifications
    var notifStored = localStorage.getItem('yaping_notifications');
    if (notifStored) {
        try {
            notifications = JSON.parse(notifStored);
        } catch (e) {
            notifications = [];
        }
    }
    
    // Load follow data
    loadFollowData();
}

function loadSampleData() {
    feedPosts = [
        {
            id: 'post_1',
            author: '@hexaa',
            content: 'Selamat datang di Yaping! 🎉',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            likes: 10,
            comments: 2,
            image: null
        },
        {
            id: 'post_2',
            author: '@anotheroom',
            content: 'Posting pertama saya di Yaping. Semoga bermanfaat!',
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            likes: 5,
            comments: 1,
            image: null
        }
    ];
    
    updates = [
        {
            title: 'Yaping v1.0 Released',
            content: 'Platform sosial Yaping resmi diluncurkan!',
            date: new Date().toISOString()
        }
    ];
    
    saveFeedPosts();
    localStorage.setItem('yaping_communities', JSON.stringify(communityList));
}

function logActivity(action, type, targetId, description) {
    // Log activity to database or local storage
    console.log('[Activity] ' + action + ' on ' + type + ' ' + targetId + ': ' + description);
}

function renderRightSidebar() {
    var sidebar = document.getElementById('right-sidebar');
    if (!sidebar) return;
    
    var currentUserName = getCurrentUsername();
    var followers = (typeof userFollowers !== 'undefined' && userFollowers[currentUserName]) ? userFollowers[currentUserName] : [];
    var following = (typeof userFollowing !== 'undefined' && userFollowing[currentUserName]) ? userFollowing[currentUserName] : [];
    
    sidebar.innerHTML =
        '<div class="sidebar-box">' +
            '<div class="sidebar-box-title">👥 Pengikut & Diikuti</div>' +
            '<div class="sidebar-stat"><span>Pengikut</span><strong>' + followers.length + '</strong></div>' +
            '<div class="sidebar-stat"><span>Diikuti</span><strong>' + following.length + '</strong></div>' +
            '<div style="margin-top: 12px; display: flex; gap: 8px;">' +
                '<button class="secondary-btn" onclick="showFollowers()" style="flex: 1; padding: 6px; font-size: 11px;">Pengikut</button>' +
                '<button class="secondary-btn" onclick="showFollowing()" style="flex: 1; padding: 6px; font-size: 11px;">Diikuti</button>' +
            '</div>' +
        '</div>';
}

// ===== DATABASE SYNC =====
async function dbPushLocalPosts() {
    if (typeof sbUpsert !== 'function') {
        showToast('Database belum siap');
        return false;
    }
    
    try {
        for (var i = 0; i < feedPosts.length; i++) {
            var post = feedPosts[i];
            await sbUpsert('feed_posts', post, 'id');
        }
        showToast('✅ Semua postingan berhasil disync');
        return true;
    } catch (e) {
        console.error('[DB] Push local posts error:', e);
        showToast('❌ Gagal sync postingan');
        return false;
    }
}

async function dbPullRemotePosts() {
    if (typeof sbGet !== 'function') {
        console.warn('Database belum siap');
        return false;
    }
    
    try {
        var posts = await sbGet('feed_posts', 'order=created_at.desc&limit=100');
        if (Array.isArray(posts) && posts.length > 0) {
            // Merge with existing posts
            for (var i = 0; i < posts.length; i++) {
                var dbPost = posts[i];
                var idx = findPostIndexById(feedPosts, dbPost.id);
                if (idx === -1) {
                    feedPosts.push(dbPost);
                }
            }
            saveFeedPosts();
        }
        return true;
    } catch (e) {
        console.warn('[DB] Pull remote posts error:', e);
        return false;
    }
}
