// ============================================
// 🚀 YAPING SOCIAL NETWORK - script.js
// Facebook 2008 Style Compatible
// ============================================

// ===== DATA & STATE =====
let communities = JSON.parse(localStorage.getItem('yaping_communities')) || [
    { id: 1, name: '🎮 Gaming Indonesia', desc: 'Komunitas gamer Indonesia', category: '🎮', members: 128, owner: '@user', createdAt: Date.now() },
    { id: 2, name: '💻 Teknologi Update', desc: 'Berita tech terbaru', category: '💻', members: 256, owner: '@admin', createdAt: Date.now() - 86400000 },
    { id: 3, name: '😂 Meme Lucu', desc: 'Kumpulan meme terbaik', category: '😂', members: 512, owner: '@memeLord', createdAt: Date.now() - 172800000 }
];

let communityPosts = JSON.parse(localStorage.getItem('yaping_communityPosts')) || {};
let joinedCommunities = JSON.parse(localStorage.getItem('yaping_joinedCommunities')) || [1];
let feedPosts = JSON.parse(localStorage.getItem('yaping_feedPosts')) || [];
let currentUser = '@user';
let lastCommunityCreate = localStorage.getItem('yaping_lastCommCreate') || 0;
let emojiTargetInput = 'postInput';
let currentViewedCommunity = null;
let postImage = null;

// Peer.js Configuration
let peer = null;
let peerId = null;
let connections = {};
let activeConnections = JSON.parse(localStorage.getItem('yaping_activeConnections')) || [];
let knownPeerIds = JSON.parse(localStorage.getItem('yaping_knownPeerIds')) || [];

// Hashtags tracking
let allHashtags = new Set();

// Auto-connect interval
let autoConnectInterval = null;

// ===== INISIALISASI =====
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Peer.js
    initializePeer();
    
    // Set active state on topbar for home tab
    var homeNavLink = document.getElementById('nav-home');
    if (homeNavLink) homeNavLink.classList.add('active-nav');
    
    // Set active state on sidebar for home link
    var sidebarLinks = document.querySelectorAll('#left-sidebar .sidebar-menu a');
    for (var i = 0; i < sidebarLinks.length; i++) {
        if (sidebarLinks[i].textContent.indexOf('Beranda') !== -1) {
            sidebarLinks[i].classList.add('active-sidebar');
            break;
        }
    }
    
    // Load data awal
    renderCommunities('all');
    renderFeed();
    updateProfileStats();
    
    // Setup search
    var searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') doSearch();
        });
    }
    
    // Auto-hide emoji picker when clicking outside
    document.addEventListener('click', function(e) {
        var picker = document.getElementById('emoji-picker');
        if (picker && !picker.contains(e.target) && !e.target.closest('[onclick*="addEmoji"]')) {
            picker.classList.add('hidden');
        }
    });
    
    // Load dark mode preference
    if (localStorage.getItem('yaping_darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        var toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = true;
    }
});

// ===== NAVIGASI TAB =====
function switchToTab(tabName) {
    // Sembunyikan semua tab content
    var tabs = document.querySelectorAll('.tab-content');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.add('hidden');
    }
    
    // Tampilkan tab yang dipilih
    var targetTab = document.getElementById(tabName + '-tab');
    if (targetTab) {
        targetTab.classList.remove('hidden');
    }
    
    // Update active state di navigasi topbar
    var navLinks = document.querySelectorAll('#topbar-nav a');
    for (var j = 0; j < navLinks.length; j++) {
        navLinks[j].classList.remove('active-nav');
    }
    var activeNav = document.getElementById('nav-' + tabName);
    if (activeNav) activeNav.classList.add('active-nav');
    
    // Update active state di sidebar menu
    var sidebarLinks = document.querySelectorAll('#left-sidebar .sidebar-menu a');
    for (var k = 0; k < sidebarLinks.length; k++) {
        sidebarLinks[k].classList.remove('active-sidebar');
    }
    
    // Match sidebar link by content/tab name
    for (var k = 0; k < sidebarLinks.length; k++) {
        var linkText = sidebarLinks[k].textContent.toLowerCase();
        if ((tabName === 'home' && linkText.indexOf('beranda') !== -1) ||
            (tabName === 'komunitas' && linkText.indexOf('komunitas') !== -1) ||
            (tabName === 'profile' && linkText.indexOf('profil') !== -1) ||
            (tabName === 'connections' && linkText.indexOf('koneksi') !== -1) ||
            (tabName === 'settings' && linkText.indexOf('pengaturan') !== -1)) {
            sidebarLinks[k].classList.add('active-sidebar');
            break;
        }
    }
    
    // Load konten khusus jika perlu
    if (tabName === 'komunitas') {
        renderCommunities('all');
    } else if (tabName === 'profile') {
        updateProfileStats();
        renderMyPosts();
    } else if (tabName === 'home') {
        renderFeed();
    } else if (tabName === 'hashtags') {
        renderHashtags();
    } else if (tabName === 'settings') {
        // Settings tab hanya perlu ditampilkan
    }
    
    // Tutup dropdown notifikasi jika terbuka
    var notifDropdown = document.getElementById('notif-dropdown');
    if (notifDropdown) notifDropdown.classList.add('hidden');
    
    // Reset viewed community
    if (tabName !== 'community-detail') {
        currentViewedCommunity = null;
    }
}

// ===== PEER.JS FUNCTIONS =====
function initializePeer() {
    // Inisialisasi Peer dengan config lokal
    peer = new Peer({
        host: 'localhost',
        port: 3000,
        path: '/peerjs'
    });
    
    // Fallback ke public server jika lokal tidak tersedia
    peer.on('error', function(err) {
        console.log('Local peer server unavailable, using public server');
        peer = new Peer();
        peer.on('open', function(id) {
            peerId = id;
            broadcastPeerId();
            startAutoConnect();
            showToast('✅ Peer siap: ' + id);
        });
        peer.on('connection', handleIncomingConnection);
    });
    
    peer.on('open', function(id) {
        peerId = id;
        console.log('Peer ID: ' + id);
        broadcastPeerId();
        startAutoConnect();
        showToast('✅ Peer siap: ' + id);
    });
    
    peer.on('connection', handleIncomingConnection);
}

function broadcastPeerId() {
    // Store peer ID di local storage untuk auto-discovery
    if (peerId) {
        localStorage.setItem('yaping_myPeerId', peerId);
        // Notify connected peers
        for (var pId in connections) {
            connections[pId].send({
                type: 'peer-id',
                peerId: peerId,
                user: currentUser
            });
        }
    }
}

function startAutoConnect() {
    // Auto-connect ke known peers secara berkala
    if (autoConnectInterval) clearInterval(autoConnectInterval);
    
    autoConnectInterval = setInterval(function() {
        // Try to connect to peers yang sudah diketahui tapi belum terhubung
        for (var i = 0; i < knownPeerIds.length; i++) {
            var remotePeerId = knownPeerIds[i];
            if (remotePeerId !== peerId && !connections[remotePeerId]) {
                console.log('Auto-connecting to: ' + remotePeerId);
                autoConnectToPeer(remotePeerId);
            }
        }
    }, 5000); // Coba setiap 5 detik
}

function autoConnectToPeer(remotePeerId) {
    if (!peer || connections[remotePeerId]) return;
    
    try {
        var conn = peer.connect(remotePeerId, { reliable: true });
        
        conn.on('open', function() {
            connections[remotePeerId] = conn;
            if (activeConnections.indexOf(remotePeerId) === -1) {
                activeConnections.push(remotePeerId);
                localStorage.setItem('yaping_activeConnections', JSON.stringify(activeConnections));
            }
            console.log('Auto-connected to: ' + remotePeerId);
            
            // Broadcast koneksi
            conn.send({
                type: 'connection',
                fromId: peerId,
                fromUser: currentUser,
                message: currentUser + ' terhubung otomatis'
            });
        });
        
        conn.on('data', function(data) {
            handlePeerData(data, remotePeerId);
        });
        
        conn.on('error', function(err) {
            console.log('Connection error to ' + remotePeerId + ':', err);
        });
        
        conn.on('close', function() {
            delete connections[remotePeerId];
            activeConnections = activeConnections.filter(id => id !== remotePeerId);
            localStorage.setItem('yaping_activeConnections', JSON.stringify(activeConnections));
        });
    } catch(e) {
        console.log('Error auto-connecting:', e);
    }
}

function handlePeerData(data, remotePeerId) {
    if (data.type === 'peer-id') {
        // Register known peer
        if (knownPeerIds.indexOf(data.peerId) === -1) {
            knownPeerIds.push(data.peerId);
            localStorage.setItem('yaping_knownPeerIds', JSON.stringify(knownPeerIds));
        }
    } else if (data.type === 'post') {
        addNotification(data.fromUser + ' memposting: ' + data.content.substring(0, 30), 'post');
    } else if (data.type === 'connection') {
        addNotification(data.message, 'connection');
    }
}







function handleIncomingConnection(conn) {
    connections[conn.peer] = conn;
    if (activeConnections.indexOf(conn.peer) === -1) {
        activeConnections.push(conn.peer);
        localStorage.setItem('yaping_activeConnections', JSON.stringify(activeConnections));
    }
    
    if (knownPeerIds.indexOf(conn.peer) === -1) {
        knownPeerIds.push(conn.peer);
        localStorage.setItem('yaping_knownPeerIds', JSON.stringify(knownPeerIds));
    }
    
    conn.on('data', function(data) {
        handlePeerData(data, conn.peer);
    });
    
    conn.on('close', function() {
        delete connections[conn.peer];
        activeConnections = activeConnections.filter(id => id !== conn.peer);
        localStorage.setItem('yaping_activeConnections', JSON.stringify(activeConnections));
    });
    
    console.log('Incoming connection from: ' + conn.peer);
}

// ===== IMAGE UPLOAD FUNCTIONS =====
function triggerImageUpload() {
    var input = document.getElementById('imageUpload');
    if (input) input.click();
}

function handleImageUpload(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    // Validasi ukuran file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('⚠️ Ukuran file terlalu besar (max 5MB)');
        return;
    }
    
    var reader = new FileReader();
    reader.onload = function(e) {
        postImage = e.target.result;
        var preview = document.getElementById('post-preview-img');
        var img = document.getElementById('post-img-preview');
        if (preview && img) {
            img.src = postImage;
            preview.style.display = 'block';
            showToast('✅ Gambar berhasil diunggah!');
        }
    };
    reader.readAsDataURL(file);
}

function removePostImage() {
    postImage = null;
    var preview = document.getElementById('post-preview-img');
    var input = document.getElementById('imageUpload');
    if (preview) preview.style.display = 'none';
    if (input) input.value = '';
}

// ===== HASHTAG FUNCTIONS =====
function parseHashtags(text) {
    var hashtags = [];
    var regex = /#[a-zA-Z0-9_]+/g;
    var matches = text.match(regex);
    if (matches) {
        for (var i = 0; i < matches.length; i++) {
            hashtags.push(matches[i]);
            allHashtags.add(matches[i]);
        }
    }
    return hashtags;
}

function parsePostWithHashtags(text) {
    var hashtags = parseHashtags(text);
    var html = escapeHtml(text);
    
    // Replace hashtags with blue links
    for (var i = 0; i < hashtags.length; i++) {
        var tag = hashtags[i];
        var encoded = tag.replace(/#/, '%23');
        html = html.replace(
            new RegExp('\\' + tag + '(?!\\w)', 'g'),
            '<a href="#" class="hashtag-link" onclick="viewHashtag(\'' + tag + '\'); return false;">' + tag + '</a>'
        );
    }
    
    return html;
}

function viewHashtag(hashtag) {
    switchToTab('hashtags');
    renderHashtagPosts(hashtag);
}

function renderHashtags() {
    var list = document.getElementById('hashtagsList');
    if (!list) return;
    
    if (allHashtags.size === 0) {
        list.innerHTML = '<div class="sidebar-empty">Belum ada hashtag digunakan</div>';
        return;
    }
    
    var html = '';
    var hashtags = Array.from(allHashtags).sort();
    
    for (var i = 0; i < hashtags.length; i++) {
        var tag = hashtags[i];
        html += '<div class="hashtag-item" onclick="viewHashtag(\'' + tag + '\')">' +
            '<div class="hashtag-name">' + escapeHtml(tag) + '</div>' +
        '</div>';
    }
    list.innerHTML = html;
}

function renderHashtagPosts(hashtag) {
    var list = document.getElementById('hashtagsList');
    if (!list) return;
    
    var html = '<div class="content-box" style="margin-bottom:10px;">' +
        '<a class="back-link" onclick="renderHashtags();return false;">← Kembali</a>' +
        '<div class="hashtag-title">' + escapeHtml(hashtag) + '</div>' +
    '</div>';
    
    // Search posts dengan hashtag ini
    var posts = [];
    
    // Dari community posts
    for (var commId in communityPosts) {
        var commPostList = communityPosts[commId] || [];
        for (var i = 0; i < commPostList.length; i++) {
            if (commPostList[i].content.indexOf(hashtag) !== -1) {
                posts.push({
                    type: 'community',
                    post: commPostList[i],
                    commId: parseInt(commId)
                });
            }
        }
    }
    
    // Sort by date
    posts.sort(function(a, b) {
        return b.post.createdAt - a.post.createdAt;
    });
    
    if (posts.length === 0) {
        html += '<div class="sidebar-empty">Belum ada postingan dengan hashtag ini</div>';
        list.innerHTML = html;
        return;
    }
    
    // Render posts
    for (var i = 0; i < posts.length; i++) {
        var post = posts[i].post;
        var timeAgo = formatTimeAgo(post.createdAt);
        var isLiked = post.likedBy.indexOf(currentUser) !== -1;
        
        html += '<div class="content-box">' +
            '<div class="post-card">' +
                '<div class="post-card-header">' +
                    '<span class="post-username">' + escapeHtml(post.author) + '</span>' +
                    '<span class="post-timestamp">' + timeAgo + '</span>' +
                '</div>' +
                '<div class="post-body">' + parsePostWithHashtags(post.content) + '</div>' +
                (post.photo ? '<div class="post-image"><img src="' + post.photo + '" alt="post image"></div>' : '') +
                '<div class="post-footer">' +
                    '<div class="post-actions-left">' +
                        '<button class="like-btn' + (isLiked ? ' liked' : '') + '" onclick="likeCommunityPost(' + posts[i].commId + ',' + post.id + ')">' + 
                            (isLiked ? '❤️' : '🤍') + ' ' + post.likes + '</button>' +
                        '<button class="comment-btn" onclick="showToast(\'💬 Fitur komentar segera hadir!\')">💬 Komentar</button>' +
                    '</div>' +
                    '<button class="share-btn" onclick="showToast(\'🔗 Dibagikan!\')">🔗 Bagikan</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }
    
    list.innerHTML = html;
}

// ===== KOMUNITAS: RENDER DAFTAR =====
function renderCommunities(filter) {
    if (!filter) filter = 'all';
    var list = document.getElementById('communityList');
    if (!list) return;
    
    // Filter komunitas
    var filtered = communities;
    if (filter === 'mine') {
        filtered = [];
        for (var i = 0; i < communities.length; i++) {
            if (communities[i].owner === currentUser) {
                filtered.push(communities[i]);
            }
        }
    }
    
    // Render
    if (filtered.length === 0) {
        list.innerHTML = '<li class="sidebar-empty">Belum ada komunitas</li>';
        return;
    }
    
    var html = '';
    for (var k = 0; k < filtered.length; k++) {
        var comm = filtered[k];
        var isMember = joinedCommunities.indexOf(comm.id) !== -1;
        html += '<li class="comm-list-item">' +
            '<div class="comm-icon">' + comm.category + '</div>' +
            '<div class="comm-info">' +
                '<div class="comm-name" onclick="viewCommunity(' + comm.id + ')">' + escapeHtml(comm.name) + '</div>' +
                '<div class="comm-meta">' + escapeHtml(comm.desc) + ' • 👥 ' + comm.members + ' anggota</div>' +
            '</div>' +
            '<div class="comm-actions">' +
                (isMember 
                    ? '<button class="primary-btn" onclick="viewCommunity(' + comm.id + ')">Lihat</button>' 
                    : '<button class="primary-btn" onclick="joinCommunity(' + comm.id + ')">Gabung</button>') +
            '</div>' +
        '</li>';
    }
    list.innerHTML = html;
}

// ===== KOMUNITAS: FILTER =====
function filterComm(filter, btn) {
    var buttons = document.querySelectorAll('.comm-filter .filter-btn');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.remove('active');
    }
    if (btn) btn.classList.add('active');
    renderCommunities(filter);
}

// ===== KOMUNITAS: TAMBAH BARU =====
function addCommunity() {
    var nameInput = document.getElementById('newCommunityInput');
    var descInput = document.getElementById('newCommunityDesc');
    var catInput = document.getElementById('newCommunityCategory');
    var cooldownInfo = document.getElementById('cooldown-info');
    
    var name = nameInput ? nameInput.value.trim() : '';
    var desc = descInput ? descInput.value.trim() : '';
    var category = catInput ? catInput.value : '🎮';
    
    // Validasi
    if (!name) {
        showToast('⚠️ Nama komunitas wajib diisi!');
        if (nameInput) nameInput.focus();
        return;
    }
    
    // Cek cooldown 30 detik
    var now = Date.now();
    if (now - lastCommunityCreate < 30000) {
        var remaining = Math.ceil((30000 - (now - lastCommunityCreate)) / 1000);
        if (cooldownInfo) cooldownInfo.textContent = 'Tunggu ' + remaining + ' detik lagi...';
        return;
    }
    
    // Buat komunitas baru
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
    
    // Simpan ke localStorage
    saveCommunities();
    localStorage.setItem('yaping_lastCommCreate', now.toString());
    
    // Reset form & update UI
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    if (cooldownInfo) cooldownInfo.textContent = '✅ Komunitas dibuat!';
    
    renderCommunities('all');
    showToast('🎉 Komunitas "' + name + '" berhasil dibuat!');
    
    // Clear cooldown message after 3 seconds
    setTimeout(function() {
        if (cooldownInfo && cooldownInfo.textContent.indexOf('✅') !== -1) {
            cooldownInfo.textContent = '';
        }
    }, 3000);
}

// ===== KOMUNITAS: JOIN =====
function joinCommunity(commId) {
    // Cek jika sudah join
    if (joinedCommunities.indexOf(commId) !== -1) {
        showToast('✅ Kamu sudah menjadi anggota!');
        return;
    }
    
    var comm = null;
    for (var i = 0; i < communities.length; i++) {
        if (communities[i].id === commId) {
            comm = communities[i];
            break;
        }
    }
    if (!comm) return;
    
    // Tambah member & simpan
    comm.members++;
    joinedCommunities.push(commId);
    
    saveCommunities();
    saveJoinedCommunities();
    
    // Update UI daftar komunitas
    var activeFilter = document.querySelector('.comm-filter .filter-btn.active');
    var filterType = (activeFilter && activeFilter.textContent.indexOf('Milik') !== -1) ? 'mine' : 'all';
    renderCommunities(filterType);
    
    // Jika sedang melihat detail komunitas, re-render untuk tampilkan post box
    if (currentViewedCommunity === commId) {
        viewCommunity(commId);
    }
    
    showToast('✅ Selamat bergabung di ' + comm.name + '! 🎉');
    addNotification('Kamu sekarang anggota ' + comm.name, 'comm');
}

// ===== KOMUNITAS: LIHAT DETAIL =====
function viewCommunity(commId) {
    var comm = null;
    for (var i = 0; i < communities.length; i++) {
        if (communities[i].id === commId) {
            comm = communities[i];
            break;
        }
    }
    if (!comm) return;
    
    // Simpan ID komunitas yang sedang dilihat
    currentViewedCommunity = commId;
    
    // Sembunyikan semua tab
    var tabs = document.querySelectorAll('.tab-content');
    for (var j = 0; j < tabs.length; j++) {
        tabs[j].classList.add('hidden');
    }
    
    // Tampilkan detail komunitas
    var detailTab = document.getElementById('community-detail-tab');
    if (!detailTab) return;
    detailTab.classList.remove('hidden');
    
    // Cek apakah user sudah join
    var isMember = joinedCommunities.indexOf(commId) !== -1;
    
    // Render post box (hanya jika member)
    var postBoxHTML = '';
    if (isMember) {
        postBoxHTML = '<div class="content-box">' +
            '<div class="box-title">💬 Buat Postingan</div>' +
            '<textarea id="communityPostInput" class="comm-post-input" placeholder="Tulis sesuatu untuk ' + escapeHtml(comm.name) + '..."></textarea>' +
            '<div style="display:flex;gap:8px;align-items:center;">' +
                '<button class="option-btn" onclick="addEmoji(\'communityPostInput\')" style="font-size:11px;">😊 Emoji</button>' +
                '<button class="primary-btn" onclick="submitCommunityPost(' + commId + ')">Bagikan</button>' +
            '</div>' +
        '</div>';
    } else {
        postBoxHTML = '<div class="content-box" style="text-align:center;padding:20px;">' +
            '<div style="font-size:36px;margin-bottom:10px;">🔒</div>' +
            '<p style="margin-bottom:12px;font-size:12px;">Gabung untuk bisa posting & berdiskusi</p>' +
            '<button class="primary-btn" onclick="joinCommunity(' + commId + ')">👥 Gabung Sekarang</button>' +
        '</div>';
    }
    
    // Render posts komunitas
    var postsHTML = renderCommunityPosts(commId);
    
    detailTab.innerHTML = 
        '<div class="content-box">' +
            '<a class="back-link" onclick="switchToTab(\'komunitas\');return false;">← Kembali ke Komunitas</a>' +
            '<div class="comm-detail-banner"></div>' +
            '<div class="comm-detail-header">' +
                '<div class="comm-detail-icon">' + comm.category + '</div>' +
                '<div class="comm-detail-info">' +
                    '<div class="comm-detail-name">' + escapeHtml(comm.name) + '</div>' +
                    '<div style="font-size:12px;color:var(--fb-text-light);margin-bottom:8px;">' + escapeHtml(comm.desc) + '</div>' +
                    '<div class="comm-detail-meta">👥 ' + comm.members + ' anggota • Oleh ' + escapeHtml(comm.owner) + 
                    (isMember ? ' • <span style="color:var(--fb-green)">✅ Anggota</span>' : '') + '</div>' +
                '</div>' +
                (!isMember ? '<button class="follow-btn-big" onclick="joinCommunity(' + commId + ')">Gabung</button>' : '') +
            '</div>' +
        '</div>' +
        postBoxHTML +
        '<div class="content-box">' +
            '<div class="box-title">💬 Diskusi Terbaru</div>' +
            '<div id="comm-posts-feed">' + postsHTML + '</div>' +
        '</div>';
}

// ===== KOMUNITAS: SUBMIT POST =====
function submitCommunityPost(commId) {
    var input = document.getElementById('communityPostInput');
    var text = input ? input.value.trim() : '';
    
    if (!text) {
        showToast('⚠️ Tulis sesuatu dulu ya!');
        if (input) input.focus();
        return;
    }
    
    var comm = null;
    for (var i = 0; i < communities.length; i++) {
        if (communities[i].id === commId) {
            comm = communities[i];
            break;
        }
    }
    if (!comm) return;
    
    // Buat post object
    var newPost = {
        id: Date.now(),
        communityId: commId,
        author: currentUser,
        content: text,
        likes: 0,
        likedBy: [],
        createdAt: Date.now(),
        photo: postImage || null
    };
    
    // Simpan ke communityPosts
    if (!communityPosts[commId]) {
        communityPosts[commId] = [];
    }
    communityPosts[commId].unshift(newPost);
    
    // Simpan ke localStorage
    saveCommunityPosts();
    
    // Reset input & update UI
    if (input) input.value = '';
    postImage = null;
    var preview = document.getElementById('post-preview-img');
    if (preview) preview.style.display = 'none';
    showToast('✅ Postingan dibagikan ke ' + comm.name);
    
    // Re-render feed
    var feedEl = document.getElementById('comm-posts-feed');
    if (feedEl) feedEl.innerHTML = renderCommunityPosts(commId);
    
    // Broadcast ke connected peers
    for (var peerId in connections) {
        connections[peerId].send({
            type: 'post',
            fromUser: currentUser,
            community: comm.name,
            content: text,
            createdAt: newPost.createdAt
        });
    }
    
    // Update notifikasi untuk owner komunitas
    if (comm.owner !== currentUser) {
        addNotification(currentUser + ' memposting di ' + comm.name, 'comm');
    }
}

// ===== KOMUNITAS: RENDER POSTS =====
function renderCommunityPosts(commId) {
    var posts = communityPosts[commId] || [];
    
    if (posts.length === 0) {
        return '<div class="sidebar-empty">Belum ada diskusi. Jadilah yang pertama! 🎉</div>';
    }
    
    var html = '';
    for (var i = 0; i < posts.length; i++) {
        var post = posts[i];
        var timeAgo = formatTimeAgo(post.createdAt);
        var isLiked = post.likedBy.indexOf(currentUser) !== -1;
        
        html += '<div class="post-card" style="margin-bottom:8px;">' +
            '<div class="post-card-header">' +
                '<span class="post-username">' + escapeHtml(post.author) + '</span>' +
                '<span class="post-timestamp">' + timeAgo + '</span>' +
            '</div>' +
            '<div class="post-body">' + parsePostWithHashtags(post.content) + '</div>' +
            (post.photo ? '<div class="post-image"><img src="' + post.photo + '" alt="post image" style="max-width:100%;border-radius:3px;margin:8px 0;"></div>' : '') +
            '<div class="post-footer">' +
                '<div class="post-actions-left">' +
                    '<button class="like-btn' + (isLiked ? ' liked' : '') + '" onclick="likeCommunityPost(' + commId + ',' + post.id + ')">' + 
                        (isLiked ? '❤️' : '🤍') + ' ' + post.likes + '</button>' +
                    '<button class="comment-btn" onclick="showToast(\'💬 Fitur komentar segera hadir!\')">💬 Komentar</button>' +
                '</div>' +
                '<button class="share-btn" onclick="showToast(\'🔗 Link disalin!\')">🔗 Bagikan</button>' +
            '</div>' +
        '</div>';
    }
    return html;
}

// ===== KOMUNITAS: LIKE POST =====
function likeCommunityPost(commId, postId) {
    var posts = communityPosts[commId];
    if (!posts) return;
    
    var post = null;
    for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === postId) {
            post = posts[i];
            break;
        }
    }
    if (!post) return;
    
    var idx = post.likedBy.indexOf(currentUser);
    if (idx === -1) {
        post.likes++;
        post.likedBy.push(currentUser);
    } else {
        post.likes--;
        post.likedBy.splice(idx, 1);
    }
    
    saveCommunityPosts();
    
    // Re-render jika sedang view komunitas ini
    if (currentViewedCommunity === commId) {
        var feedEl = document.getElementById('comm-posts-feed');
        if (feedEl) feedEl.innerHTML = renderCommunityPosts(commId);
    }
}

// ===== HOME: SUBMIT POST =====
function submitPost() {
    var input = document.getElementById('postInput');
    var text = input ? input.value.trim() : '';
    
    if (!text) {
        showToast('⚠️ Tulis sesuatu dulu ya!');
        if (input) input.focus();
        return;
    }
    
    // Buat post object
    var newPost = {
        id: Date.now(),
        author: currentUser,
        content: text,
        likes: 0,
        likedBy: [],
        createdAt: Date.now(),
        photo: postImage || null
    };
    
    // Tambah ke feed
    feedPosts.unshift(newPost);
    localStorage.setItem('yaping_feedPosts', JSON.stringify(feedPosts));
    
    // Reset input & hapus preview
    if (input) input.value = '';
    postImage = null;
    var preview = document.getElementById('post-preview-img');
    if (preview) preview.style.display = 'none';
    
    showToast('✅ Postingan dibagikan! 🎉');
    
    // Re-render feed
    renderFeed();
    
    // Broadcast ke connected peers
    for (var peerId in connections) {
        connections[peerId].send({
            type: 'post',
            fromUser: currentUser,
            content: text,
            photo: postImage,
            createdAt: newPost.createdAt
        });
    }
}

// ===== HOME: RENDER FEED =====
function renderFeed() {
    var feed = document.getElementById('feed');
    if (!feed) return;
    
    // Jika belum ada post, tampilkan welcome message
    if (feedPosts.length === 0) {
        feed.innerHTML = 
            '<div class="post-card">' +
                '<div class="post-card-header">' +
                    '<span class="post-username">@user</span>' +
                    '<span class="post-timestamp">Baru saja</span>' +
                '</div>' +
                '<div class="post-body">Selamat datang di Yaping! 👋 Mulai bagikan pikiranmu atau gabung komunitas menarik.</div>' +
                '<div class="post-footer">' +
                    '<div class="post-actions-left">' +
                        '<button class="like-btn" onclick="showToast(\'❤️ Terima kasih!\')">🤍 0</button>' +
                        '<button class="comment-btn" onclick="showToast(\'💬 Komentar...\')">💬 Komentar</button>' +
                    '</div>' +
                    '<button class="share-btn" onclick="showToast(\'🔗 Dibagikan!\')">🔗 Bagikan</button>' +
                '</div>' +
            '</div>';
        return;
    }
    
    // Render semua posts dari feedPosts
    var html = '';
    for (var i = 0; i < feedPosts.length; i++) {
        var post = feedPosts[i];
        var timeAgo = formatTimeAgo(post.createdAt);
        var isLiked = post.likedBy.indexOf(currentUser) !== -1;
        
        html += '<div class="post-card" style="margin-bottom:8px;">' +
            '<div class="post-card-header">' +
                '<span class="post-username">' + escapeHtml(post.author) + '</span>' +
                '<span class="post-timestamp">' + timeAgo + '</span>' +
            '</div>' +
            '<div class="post-body">' + parsePostWithHashtags(post.content) + '</div>' +
            (post.photo ? '<div class="post-image"><img src="' + post.photo + '" alt="post image" style="max-width:100%;border-radius:3px;margin:8px 0;"></div>' : '') +
            '<div class="post-footer">' +
                '<div class="post-actions-left">' +
                    '<button class="like-btn' + (isLiked ? ' liked' : '') + '" onclick="likeFeedPost(' + i + ')">' + 
                        (isLiked ? '❤️' : '🤍') + ' ' + post.likes + '</button>' +
                    '<button class="comment-btn" onclick="showToast(\'💬 Fitur komentar segera hadir!\')">💬 Komentar</button>' +
                '</div>' +
                '<button class="share-btn" onclick="showToast(\'🔗 Link disalin!\')">🔗 Bagikan</button>' +
            '</div>' +
        '</div>';
    }
    feed.innerHTML = html;
}

function likeFeedPost(index) {
    if (feedPosts[index]) {
        var post = feedPosts[index];
        var idx = post.likedBy.indexOf(currentUser);
        if (idx === -1) {
            post.likes++;
            post.likedBy.push(currentUser);
        } else {
            post.likes--;
            post.likedBy.splice(idx, 1);
        }
        localStorage.setItem('yaping_feedPosts', JSON.stringify(feedPosts));
        renderFeed();
    }
}

// ===== PROFILE: RENDER MY POSTS =====
function renderMyPosts() {
    var feed = document.getElementById('my-posts-feed');
    if (!feed) return;
    feed.innerHTML = '<div class="sidebar-empty">Kamu belum memiliki postingan. Yuk mulai berbagi! ✨</div>';
}

// ===== PROFILE: UPDATE STATS =====
function updateProfileStats() {
    var el;
    
    el = document.getElementById('pi-username'); if (el) el.textContent = currentUser;
    el = document.getElementById('pi-fullname'); if (el) el.textContent = 'Pengguna Yaping';
    el = document.getElementById('pi-posts'); if (el) el.textContent = '0';
    el = document.getElementById('pi-likes'); if (el) el.textContent = '0';
    
    var myComms = 0;
    for (var i = 0; i < communities.length; i++) {
        if (communities[i].owner === currentUser) myComms++;
    }
    el = document.getElementById('pi-comms'); if (el) el.textContent = myComms;
    
    el = document.getElementById('sidebar-username'); if (el) el.textContent = currentUser;
    el = document.getElementById('profile-username-display'); if (el) el.textContent = currentUser;
}

// ===== PROFILE: SWITCH SECTION =====
function showProfileSection(section, btn) {
    // Update active button
    var buttons = document.querySelectorAll('.profile-tab-btn');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.remove('active');
    }
    if (btn) btn.classList.add('active');
    
    // Hide all sections
    var sections = ['profile-info-section', 'profile-posts-section', 'profile-edit-section'];
    for (var j = 0; j < sections.length; j++) {
        var sec = document.getElementById(sections[j]);
        if (sec) sec.classList.add('hidden');
    }
    
    // Show selected
    if (section === 'info') {
        var sec = document.getElementById('profile-info-section');
        if (sec) sec.classList.remove('hidden');
    }
    if (section === 'posts') {
        var sec = document.getElementById('profile-posts-section');
        if (sec) {
            sec.classList.remove('hidden');
            renderMyPosts();
        }
    }
    if (section === 'edit') {
        // Load current values
        var el = document.getElementById('edit-username'); if (el) el.value = currentUser;
        el = document.getElementById('edit-fullname'); if (el) el.value = 'Pengguna Yaping';
        el = document.getElementById('edit-bio'); if (el) el.value = '';
        var sec = document.getElementById('profile-edit-section');
        if (sec) sec.classList.remove('hidden');
    }
}

// ===== PROFILE: SAVE =====
function saveProfile() {
    var elUser = document.getElementById('edit-username');
    var elName = document.getElementById('edit-fullname');
    
    var newUsername = elUser ? (elUser.value.trim() || currentUser) : currentUser;
    var newFullname = elName ? (elName.value.trim() || 'Pengguna Yaping') : 'Pengguna Yaping';
    
    currentUser = newUsername;
    
    // Update display
    var els = ['sidebar-username', 'profile-username-display', 'pi-username'];
    for (var i = 0; i < els.length; i++) {
        var el = document.getElementById(els[i]);
        if (el) el.textContent = currentUser;
    }
    el = document.getElementById('pi-fullname'); if (el) el.textContent = newFullname;
    
    showToast('✅ Profil berhasil diperbarui!');
    showProfileSection('info', document.querySelector('.profile-tab-btn'));
}

// ===== SETTINGS: DARK MODE =====
function toggleDarkMode() {
    var toggle = document.getElementById('dark-mode-toggle');
    var isDark = toggle ? toggle.checked : false;
    document.body.classList.toggle('dark-mode', isDark);
    localStorage.setItem('yaping_darkMode', isDark);
}

// ===== SETTINGS: FONT SIZE =====
function changeFontSize(size) {
    document.body.style.fontSize = size + 'px';
}

// ===== SETTINGS: CLEAR POSTS =====
function clearAllPosts() {
    if (confirm('Hapus semua postingan? Tindakan ini tidak bisa dibatalkan!')) {
        communityPosts = {};
        saveCommunityPosts();
        showToast('🗑️ Semua postingan dihapus!');
        if (currentViewedCommunity) {
            var feedEl = document.getElementById('comm-posts-feed');
            if (feedEl) feedEl.innerHTML = renderCommunityPosts(currentViewedCommunity);
        }
    }
}

// ===== SETTINGS: RESET ALL =====
function resetAllData() {
    if (confirm('Reset SEMUA data? Ini akan menghapus komunitas, postingan, dan pengaturan!')) {
        localStorage.clear();
        location.reload();
    }
}

// ===== NOTIFICATIONS =====
function showNotifications() {
    var dropdown = document.getElementById('notif-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

function addNotification(text, type) {
    var badge = document.getElementById('notif-badge');
    if (!badge) return;
    
    var count = parseInt(badge.textContent) || 0;
    badge.textContent = count + 1;
    badge.classList.remove('hidden');
    
    var list = document.getElementById('notif-list');
    if (!list) return;
    
    if (list.querySelector('.notif-empty')) {
        list.innerHTML = '';
    }
    
    var notif = document.createElement('div');
    notif.className = 'notif-item';
    notif.innerHTML = '<div>' + escapeHtml(text) + '</div><small>Baru saja</small>';
    list.insertBefore(notif, list.firstChild);
}

function clearNotifications() {
    var list = document.getElementById('notif-list');
    var badge = document.getElementById('notif-badge');
    if (list) list.innerHTML = '<div class="notif-empty">Belum ada notifikasi</div>';
    if (badge) {
        badge.classList.add('hidden');
        badge.textContent = '0';
    }
}

// ===== EMOJI PICKER =====
function addEmoji(targetInput) {
    if (!targetInput) targetInput = 'postInput';
    emojiTargetInput = targetInput;
    var picker = document.getElementById('emoji-picker');
    if (picker) picker.classList.toggle('hidden');
}

function insertEmoji(emoji) {
    var input = document.getElementById(emojiTargetInput);
    if (input) {
        input.value += emoji;
        input.focus();
    }
    var picker = document.getElementById('emoji-picker');
    if (picker) picker.classList.add('hidden');
}

// ===== PHOTO UPLOAD (placeholder) =====
function addPhoto(targetInput) {
    showToast('📷 Fitur upload foto akan segera hadir!');
}

// ===== SEARCH =====
function doSearch() {
    var input = document.getElementById('searchInput');
    var query = input ? input.value.trim() : '';
    if (query) {
        showToast('🔍 Mencari: "' + query + '"');
    }
}

// ===== UTILITIES =====
function showToast(message) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(function() {
        toast.classList.add('hidden');
    }, 3000);
}

function saveCommunities() {
    localStorage.setItem('yaping_communities', JSON.stringify(communities));
}

function saveCommunityPosts() {
    localStorage.setItem('yaping_communityPosts', JSON.stringify(communityPosts));
}

function saveJoinedCommunities() {
    localStorage.setItem('yaping_joinedCommunities', JSON.stringify(joinedCommunities));
}

function formatTimeAgo(timestamp) {
    var diff = Date.now() - timestamp;
    var minutes = Math.floor(diff / 60000);
    var hours = Math.floor(diff / 3600000);
    var days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Baru saja';
    if (minutes < 60) return minutes + 'm lalu';
    if (hours < 24) return hours + 'j lalu';
    return days + 'h lalu';
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== MODAL =====
function closeModal() {
    var modal = document.getElementById('modal-overlay');
    if (modal) modal.classList.add('hidden');
}

function showModal(title, content) {
    var titleEl = document.getElementById('modal-title');
    var bodyEl = document.getElementById('modal-body');
    var overlay = document.getElementById('modal-overlay');
    
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = content;
    if (overlay) overlay.classList.remove('hidden');
}
