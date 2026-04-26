/* ============================================
   YAPING - script.js (Fixed Version)
   Compatible with Facebook 2008 Style CSS
   ============================================ */

// ===== GLOBAL DATA =====
var communities = [];
var communityPosts = {};
var joinedCommunities = [];
var currentUser = '@user';
var lastCommunityCreate = 0;
var emojiTargetInput = 'postInput';
var currentViewedCommunity = null;

// ===== INIT =====
function initApp() {
    loadData();
    renderCommunities('all');
    renderFeed();
    updateProfileStats();
    setupEventListeners();
    
    // Load dark mode
    if (localStorage.getItem('yaping_darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        var toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = true;
    }
}

function loadData() {
    try {
        var c = localStorage.getItem('yaping_communities');
        communities = c ? JSON.parse(c) : [
            { id: 1, name: 'Gaming Indonesia', desc: 'Komunitas gamer Indonesia', category: '🎮', members: 128, owner: '@user', createdAt: Date.now() },
            { id: 2, name: 'Teknologi Update', desc: 'Berita tech terbaru', category: '💻', members: 256, owner: '@admin', createdAt: Date.now() - 86400000 },
            { id: 3, name: 'Meme Lucu', desc: 'Kumpulan meme terbaik', category: '😂', members: 512, owner: '@memeLord', createdAt: Date.now() - 172800000 }
        ];
        
        var p = localStorage.getItem('yaping_communityPosts');
        communityPosts = p ? JSON.parse(p) : {};
        
        var j = localStorage.getItem('yaping_joinedCommunities');
        joinedCommunities = j ? JSON.parse(j) : [1];
        
        var lcc = localStorage.getItem('yaping_lastCommCreate');
        lastCommunityCreate = lcc ? parseInt(lcc) : 0;
    } catch(e) {
        console.log('Load data error:', e);
        communities = [];
        communityPosts = {};
        joinedCommunities = [];
    }
}

function setupEventListeners() {
    var searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') doSearch();
        });
    }
    
    document.addEventListener('click', function(e) {
        var picker = document.getElementById('emoji-picker');
        if (picker && !picker.contains(e.target)) {
            var isEmojiBtn = false;
            var el = e.target;
            while (el) {
                if (el.getAttribute && el.getAttribute('onclick') && el.getAttribute('onclick').indexOf('addEmoji') !== -1) {
                    isEmojiBtn = true;
                    break;
                }
                el = el.parentNode;
            }
            if (!isEmojiBtn) picker.classList.add('hidden');
        }
    });
    
    // Run init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
}

// ===== TAB NAVIGATION =====
function switchToTab(tabName) {
    var tabs = document.querySelectorAll('.tab-content');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.add('hidden');
    }
    
    var target = document.getElementById(tabName + '-tab');
    if (target) target.classList.remove('hidden');
    
    var navs = document.querySelectorAll('#topbar-nav a');
    for (var j = 0; j < navs.length; j++) {
        navs[j].classList.remove('active-nav');
    }
    var activeNav = document.getElementById('nav-' + tabName);
    if (activeNav) activeNav.classList.add('active-nav');
    
    if (tabName === 'komunitas') renderCommunities('all');
    else if (tabName === 'profile') { updateProfileStats(); renderMyPosts(); }
    else if (tabName === 'home') renderFeed();
    
    var nd = document.getElementById('notif-dropdown');
    if (nd) nd.classList.add('hidden');
    
    if (tabName !== 'community-detail') currentViewedCommunity = null;
    
    return false;
}

// ===== COMMUNITIES =====
function renderCommunities(filter) {
    if (!filter) filter = 'all';
    var list = document.getElementById('communityList');
    if (!list) return;
    
    var filtered = [];
    for (var i = 0; i < communities.length; i++) {
        if (filter === 'all' || (filter === 'mine' && communities[i].owner === currentUser)) {
            filtered.push(communities[i]);
        }
    }
    
    if (filtered.length === 0) {
        list.innerHTML = '<li class="sidebar-empty">Belum ada komunitas</li>';
        return;
    }
    
    var html = '';
    for (var k = 0; k < filtered.length; k++) {
        var c = filtered[k];
        var isMember = joinedCommunities.indexOf(c.id) !== -1;
        var memberBadge = isMember ? ' <span style="color:var(--fb-green)">[Anggota]</span>' : '';
        var btn = isMember 
            ? '<button class="primary-btn" onclick="viewCommunity(' + c.id + ')">Lihat</button>'
            : '<button class="primary-btn" onclick="joinCommunity(' + c.id + ')">Gabung</button>';
        
        html += '<li class="comm-list-item">' +
            '<div class="comm-icon">' + c.category + '</div>' +
            '<div class="comm-info">' +
                '<div class="comm-name" onclick="viewCommunity(' + c.id + ')">' + escapeHtml(c.name) + memberBadge + '</div>' +
                '<div class="comm-meta">' + escapeHtml(c.desc) + ' | ' + c.members + ' anggota</div>' +
            '</div>' +
            '<div class="comm-actions">' + btn + '</div>' +
        '</li>';
    }
    list.innerHTML = html;
}

function filterComm(filter, btn) {
    var btns = document.querySelectorAll('.comm-filter .filter-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    if (btn) btn.classList.add('active');
    renderCommunities(filter);
}

function addCommunity() {
    var nameInput = document.getElementById('newCommunityInput');
    var descInput = document.getElementById('newCommunityDesc');
    var catInput = document.getElementById('newCommunityCategory');
    var cooldownInfo = document.getElementById('cooldown-info');
    
    var name = nameInput ? nameInput.value.trim() : '';
    var desc = descInput ? descInput.value.trim() : '';
    var category = catInput ? catInput.value : '🎮';
    
    if (!name) { showToast('Nama komunitas wajib diisi!'); if (nameInput) nameInput.focus(); return; }
    
    var now = Date.now();
    if (now - lastCommunityCreate < 30000) {
        var remaining = Math.ceil((30000 - (now - lastCommunityCreate)) / 1000);
        if (cooldownInfo) cooldownInfo.textContent = 'Tunggu ' + remaining + ' detik...';
        return;
    }
    
    var newComm = {
        id: Date.now(),
        name: name,
        desc: desc || 'Tidak ada deskripsi',
        category: category,
        members: 1,
        owner: currentUser,
        createdAt: now
    };
    
    communities.unshift(newComm);
    lastCommunityCreate = now;
    
    saveCommunities();
    localStorage.setItem('yaping_lastCommCreate', now.toString());
    
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    if (cooldownInfo) cooldownInfo.textContent = 'Komunitas dibuat!';
    
    renderCommunities('all');
    showToast('Komunitas "' + name + '" berhasil dibuat!');
    
    setTimeout(function() {
        if (cooldownInfo && cooldownInfo.textContent.indexOf('Komunitas') !== -1) {
            cooldownInfo.textContent = '';
        }
    }, 3000);
}

function joinCommunity(commId) {
    if (joinedCommunities.indexOf(commId) !== -1) { showToast('Kamu sudah anggota!'); return; }
    
    var comm = getCommunityById(commId);
    if (!comm) return;
    
    comm.members++;
    joinedCommunities.push(commId);
    
    saveCommunities();
    saveJoinedCommunities();
    
    var activeBtn = document.querySelector('.comm-filter .filter-btn.active');
    var f = (activeBtn && activeBtn.textContent.indexOf('Milik') !== -1) ? 'mine' : 'all';
    renderCommunities(f);
    
    if (currentViewedCommunity === commId) viewCommunity(commId);
    
    showToast('Selamat bergabung di ' + comm.name + '!');
    addNotification('Kamu sekarang anggota ' + comm.name, 'comm');
}

function viewCommunity(commId) {
    var comm = getCommunityById(commId);
    if (!comm) return;
    
    currentViewedCommunity = commId;
    
    var tabs = document.querySelectorAll('.tab-content');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.add('hidden');
    
    var detailTab = document.getElementById('community-detail-tab');
    if (!detailTab) return;
    detailTab.classList.remove('hidden');
    
    var isMember = joinedCommunities.indexOf(commId) !== -1;
    
    var postBox = '';
    if (isMember) {
        postBox = '<div class="content-box">' +
            '<div class="box-title">Buat Postingan</div>' +
            '<textarea id="communityPostInput" class="comm-post-input" placeholder="Tulis untuk ' + escapeHtml(comm.name) + '..."></textarea>' +
            '<div style="display:flex;gap:8px;align-items:center;">' +
                '<button class="option-btn" onclick="addEmoji(\'communityPostInput\')" style="font-size:11px;">Emoji</button>' +
                '<button class="primary-btn" onclick="submitCommunityPost(' + commId + ')">Bagikan</button>' +
            '</div>' +
        '</div>';
    } else {
        postBox = '<div class="content-box" style="text-align:center;padding:20px;">' +
            '<div style="font-size:36px;margin-bottom:10px;">🔒</div>' +
            '<p style="margin-bottom:12px;font-size:12px;">Gabung untuk bisa posting & berdiskusi</p>' +
            '<button class="primary-btn" onclick="joinCommunity(' + commId + ')">Gabung Sekarang</button>' +
        '</div>';
    }
    
    var postsHTML = renderCommunityPosts(commId);
    
    var memberText = isMember ? ' | <span style="color:var(--fb-green)">Anggota</span>' : '';
    var joinBtn = !isMember ? '<button class="follow-btn-big" onclick="joinCommunity(' + commId + ')">Gabung</button>' : '';
    
    detailTab.innerHTML = 
        '<div class="content-box">' +
            '<a class="back-link" onclick="switchToTab(\'komunitas\');return false;">&larr; Kembali</a>' +
            '<div class="comm-detail-banner"></div>' +
            '<div class="comm-detail-header">' +
                '<div class="comm-detail-icon">' + comm.category + '</div>' +
                '<div class="comm-detail-info">' +
                    '<div class="comm-detail-name">' + escapeHtml(comm.name) + '</div>' +
                    '<div style="font-size:12px;color:var(--fb-text-light);margin-bottom:8px;">' + escapeHtml(comm.desc) + '</div>' +
                    '<div class="comm-detail-meta">' + comm.members + ' anggota | Oleh ' + escapeHtml(comm.owner) + memberText + '</div>' +
                '</div>' +
                joinBtn +
            '</div>' +
        '</div>' +
        postBox +
        '<div class="content-box">' +
            '<div class="box-title">Diskusi Terbaru</div>' +
            '<div id="comm-posts-feed">' + postsHTML + '</div>' +
        '</div>';
}

function submitCommunityPost(commId) {
    var input = document.getElementById('communityPostInput');
    var text = input ? input.value.trim() : '';
    
    if (!text) { showToast('Tulis sesuatu dulu!'); if (input) input.focus(); return; }
    
    var comm = getCommunityById(commId);
    if (!comm) return;
    
    var newPost = {
        id: Date.now(),
        communityId: commId,
        author: currentUser,
        content: text,
        likes: 0,
        likedBy: [],
        createdAt: Date.now(),
        photo: null
    };
    
    if (!communityPosts[commId]) communityPosts[commId] = [];
    communityPosts[commId].unshift(newPost);
    
    saveCommunityPosts();
    
    if (input) input.value = '';
    showToast('Postingan dibagikan ke ' + comm.name);
    
    var feedEl = document.getElementById('comm-posts-feed');
    if (feedEl) feedEl.innerHTML = renderCommunityPosts(commId);
    
    if (comm.owner !== currentUser) addNotification(currentUser + ' memposting di ' + comm.name, 'comm');
}

function renderCommunityPosts(commId) {
    var posts = communityPosts[commId] || [];
    if (posts.length === 0) return '<div class="sidebar-empty">Belum ada diskusi. Jadilah yang pertama!</div>';
    
    var html = '';
    for (var i = 0; i < posts.length; i++) {
        var p = posts[i];
        var timeAgo = formatTimeAgo(p.createdAt);
        var isLiked = p.likedBy.indexOf(currentUser) !== -1;
        
        html += '<div class="post-card" style="margin-bottom:8px;">' +
            '<div class="post-card-header">' +
                '<span class="post-username">' + escapeHtml(p.author) + '</span>' +
                '<span class="post-timestamp">' + timeAgo + '</span>' +
            '</div>' +
            '<div class="post-body">' + escapeHtml(p.content) + '</div>' +
            '<div class="post-footer">' +
                '<div class="post-actions-left">' +
                    '<button class="like-btn' + (isLiked ? ' liked' : '') + '" onclick="likeCommunityPost(' + commId + ',' + p.id + ')">' + 
                        (isLiked ? '❤️' : '🤍') + ' ' + p.likes + '</button>' +
                    '<button class="comment-btn" onclick="showToast(\'Fitur komentar segera hadir!\')">Komentar</button>' +
                '</div>' +
                '<button class="share-btn" onclick="showToast(\'Link disalin!\')">Bagikan</button>' +
            '</div>' +
        '</div>';
    }
    return html;
}

function likeCommunityPost(commId, postId) {
    var posts = communityPosts[commId];
    if (!posts) return;
    
    var post = null;
    for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === postId) { post = posts[i]; break; }
    }
    if (!post) return;
    
    var idx = post.likedBy.indexOf(currentUser);
    if (idx === -1) { post.likes++; post.likedBy.push(currentUser); }
    else { post.likes--; post.likedBy.splice(idx, 1); }
    
    saveCommunityPosts();
    
    if (currentViewedCommunity === commId) {
        var feedEl = document.getElementById('comm-posts-feed');
        if (feedEl) feedEl.innerHTML = renderCommunityPosts(commId);
    }
}

// ===== HOME FEED =====
function submitPost() {
    var input = document.getElementById('postInput');
    var text = input ? input.value.trim() : '';
    if (!text) { showToast('Tulis sesuatu dulu!'); if (input) input.focus(); return; }
    
    showToast('Postingan dibagikan!');
    if (input) input.value = '';
    renderFeed();
}

function renderFeed() {
    var feed = document.getElementById('feed');
    if (!feed) return;
    
    if (!feed.innerHTML.trim() || feed.innerHTML.indexOf('Selamat datang') !== -1) {
        feed.innerHTML = 
            '<div class="post-card">' +
                '<div class="post-card-header"><span class="post-username">@user</span><span class="post-timestamp">Baru saja</span></div>' +
                '<div class="post-body">Selamat datang di Yaping! 👋 Mulai bagikan pikiranmu atau gabung komunitas menarik.</div>' +
                '<div class="post-footer">' +
                    '<div class="post-actions-left">' +
                        '<button class="like-btn" onclick="showToast(\'Terima kasih!\')">🤍 0</button>' +
                        '<button class="comment-btn" onclick="showToast(\'Komentar...\')">Komentar</button>' +
                    '</div>' +
                    '<button class="share-btn" onclick="showToast(\'Dibagikan!\')">Bagikan</button>' +
                '</div>' +
            '</div>';
    }
}

// ===== PROFILE =====
function renderMyPosts() {
    var feed = document.getElementById('my-posts-feed');
    if (feed) feed.innerHTML = '<div class="sidebar-empty">Kamu belum memiliki postingan. Yuk mulai berbagi!</div>';
}

function updateProfileStats() {
    var els = {
        'pi-username': currentUser,
        'pi-fullname': 'Pengguna Yaping',
        'pi-posts': '0',
        'pi-likes': '0',
        'sidebar-username': currentUser,
        'profile-username-display': currentUser
    };
    
    for (var key in els) {
        var el = document.getElementById(key);
        if (el) el.textContent = els[key];
    }
    
    var count = 0;
    for (var i = 0; i < communities.length; i++) if (communities[i].owner === currentUser) count++;
    var el = document.getElementById('pi-comms');
    if (el) el.textContent = count;
}

function showProfileSection(section, btn) {
    var btns = document.querySelectorAll('.profile-tab-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    if (btn) btn.classList.add('active');
    
    var secs = ['profile-info-section', 'profile-posts-section', 'profile-edit-section'];
    for (var j = 0; j < secs.length; j++) {
        var s = document.getElementById(secs[j]);
        if (s) s.classList.add('hidden');
    }
    
    if (section === 'info') { var s = document.getElementById('profile-info-section'); if (s) s.classList.remove('hidden'); }
    if (section === 'posts') { var s = document.getElementById('profile-posts-section'); if (s) { s.classList.remove('hidden'); renderMyPosts(); } }
    if (section === 'edit') {
        var u = document.getElementById('edit-username'); if (u) u.value = currentUser;
        var n = document.getElementById('edit-fullname'); if (n) n.value = 'Pengguna Yaping';
        var b = document.getElementById('edit-bio'); if (b) b.value = '';
        var s = document.getElementById('profile-edit-section'); if (s) s.classList.remove('hidden');
    }
}

function saveProfile() {
    var u = document.getElementById('edit-username');
    var n = document.getElementById('edit-fullname');
    var newU = u ? (u.value.trim() || currentUser) : currentUser;
    var newN = n ? (n.value.trim() || 'Pengguna Yaping') : 'Pengguna Yaping';
    
    currentUser = newU;
    
    var keys = ['sidebar-username', 'profile-username-display', 'pi-username'];
    for (var i = 0; i < keys.length; i++) {
        var el = document.getElementById(keys[i]);
        if (el) el.textContent = currentUser;
    }
    var el = document.getElementById('pi-fullname'); if (el) el.textContent = newN;
    
    showToast('Profil diperbarui!');
    showProfileSection('info', document.querySelector('.profile-tab-btn'));
}

// ===== SETTINGS =====
function toggleDarkMode() {
    var t = document.getElementById('dark-mode-toggle');
    var isDark = t ? t.checked : false;
    document.body.classList.toggle('dark-mode', isDark);
    localStorage.setItem('yaping_darkMode', isDark);
}

function changeFontSize(val) { document.body.style.fontSize = val + 'px'; }

function clearAllPosts() {
    if (confirm('Hapus semua postingan?')) {
        communityPosts = {};
        saveCommunityPosts();
        showToast('Postingan dihapus!');
        if (currentViewedCommunity) {
            var f = document.getElementById('comm-posts-feed');
            if (f) f.innerHTML = renderCommunityPosts(currentViewedCommunity);
        }
    }
}

function resetAllData() {
    if (confirm('Reset SEMUA data?')) {
        localStorage.clear();
        location.reload();
    }
}

// ===== NOTIFICATIONS =====
function showNotifications() {
    var d = document.getElementById('notif-dropdown');
    if (d) d.classList.toggle('hidden');
}

function addNotification(text, type) {
    var badge = document.getElementById('notif-badge');
    if (!badge) return;
    var c = parseInt(badge.textContent) || 0;
    badge.textContent = c + 1;
    badge.classList.remove('hidden');
    
    var list = document.getElementById('notif-list');
    if (!list) return;
    if (list.querySelector('.notif-empty')) list.innerHTML = '';
    
    var n = document.createElement('div');
    n.className = 'notif-item';
    n.innerHTML = '<div>' + escapeHtml(text) + '</div><small>Baru saja</small>';
    list.insertBefore(n, list.firstChild);
}

function clearNotifications() {
    var list = document.getElementById('notif-list');
    var badge = document.getElementById('notif-badge');
    if (list) list.innerHTML = '<div class="notif-empty">Belum ada notifikasi</div>';
    if (badge) { badge.classList.add('hidden'); badge.textContent = '0'; }
}

// ===== EMOJI & UTILS =====
function addEmoji(target) {
    emojiTargetInput = target || 'postInput';
    var p = document.getElementById('emoji-picker');
    if (p) p.classList.toggle('hidden');
}

function insertEmoji(emoji) {
    var input = document.getElementById(emojiTargetInput);
    if (input) { input.value += emoji; input.focus(); }
    var p = document.getElementById('emoji-picker');
    if (p) p.classList.add('hidden');
}

function addPhoto() { showToast('Fitur upload foto segera hadir!'); }

function doSearch() {
    var input = document.getElementById('searchInput');
    var q = input ? input.value.trim() : '';
    if (q) showToast('Mencari: ' + q);
}

function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(function() { t.classList.add('hidden'); }, 3000);
}

function saveCommunities() { localStorage.setItem('yaping_communities', JSON.stringify(communities)); }
function saveCommunityPosts() { localStorage.setItem('yaping_communityPosts', JSON.stringify(communityPosts)); }
function saveJoinedCommunities() { localStorage.setItem('yaping_joinedCommunities', JSON.stringify(joinedCommunities)); }

function formatTimeAgo(ts) {
    var diff = Date.now() - ts;
    var m = Math.floor(diff / 60000);
    var h = Math.floor(diff / 3600000);
    var d = Math.floor(diff / 86400000);
    if (m < 1) return 'Baru saja';
    if (m < 60) return m + 'm lalu';
    if (h < 24) return h + 'j lalu';
    return d + 'h lalu';
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getCommunityById(id) {
    for (var i = 0; i < communities.length; i++) {
        if (communities[i].id === id) return communities[i];
    }
    return null;
}

function closeModal() { var m = document.getElementById('modal-overlay'); if (m) m.classList.add('hidden'); }

function showModal(title, content) {
    var t = document.getElementById('modal-title');
    var b = document.getElementById('modal-body');
    var o = document.getElementById('modal-overlay');
    if (t) t.textContent = title;
    if (b) b.innerHTML = content;
    if (o) o.classList.remove('hidden');
}

// ===== START =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
