// ============================================
// 🚀 YAPING SOCIAL NETWORK - script.js (FIXED)
// ============================================

// ===== DATA & STATE =====
let communities = JSON.parse(localStorage.getItem('yaping_communities')) || [
    { id: 1, name: '🎮 Gaming Indonesia', desc: 'Komunitas gamer Indonesia', category: '🎮', members: 128, owner: 'system', createdAt: Date.now() },
    { id: 2, name: '💻 Teknologi Update', desc: 'Berita tech terbaru', category: '💻', members: 256, owner: 'system', createdAt: Date.now() - 86400000 },
    { id: 3, name: '😂 Meme Lucu', desc: 'Kumpulan meme terbaik', category: '😂', members: 512, owner: 'system', createdAt: Date.now() - 172800000 }
];

let communityPosts = JSON.parse(localStorage.getItem('yaping_communityPosts')) || {};
let posts = JSON.parse(localStorage.getItem('yaping_posts')) || []; // Global posts
let joinedCommunities = JSON.parse(localStorage.getItem('yaping_joinedCommunities')) || [1];
let currentUser = '@user';
let lastCommunityCreate = localStorage.getItem('yaping_lastCommCreate') || 0;
let emojiTargetInput = 'postInput';
let currentViewedCommunity = null;
let selectedImageBase64 = null;

// ===== INISIALISASI =====
document.addEventListener('DOMContentLoaded', function() {
    // Set default view
    switchToTab('home');
    
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
    
    // Auto-hide emoji picker
    document.addEventListener('click', function(e) {
        var picker = document.getElementById('emoji-picker');
        if (picker && !picker.contains(e.target) && !e.target.closest('[onclick*="addEmoji"]')) {
            picker.classList.add('hidden');
        }
    });

    if (localStorage.getItem('yaping_darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        if (document.getElementById('dark-mode-toggle')) document.getElementById('dark-mode-toggle').checked = true;
    }
});

// ===== NAVIGASI TAB =====
function switchToTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    
    var targetTab = document.getElementById(tabName + '-tab');
    if (targetTab) targetTab.classList.remove('hidden');
    
    // Update active states (Top & Sidebar)
    document.querySelectorAll('.active-nav').forEach(el => el.classList.remove('active-nav'));
    var navLink = document.getElementById('nav-' + tabName);
    if (navLink) navLink.classList.add('active-nav');

    if (tabName === 'komunitas') renderCommunities('all');
    if (tabName === 'profile') { updateProfileStats(); renderMyPosts(); }
    if (tabName === 'home') renderFeed();
}

// ===== POSTING LOGIC (HOME & GLOBAL) =====
function handleImageSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            selectedImageBase64 = e.target.result;
            const preview = document.getElementById('imagePreview');
            const container = document.getElementById('imagePreviewContainer');
            if(preview) preview.src = selectedImageBase64;
            if(container) container.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

function removeSelectedImage() {
    selectedImageBase64 = null;
    const input = document.getElementById('imageUpload');
    const container = document.getElementById('imagePreviewContainer');
    if (input) input.value = '';
    if (container) container.classList.add('hidden');
}

function submitPost() {
    const input = document.getElementById('postInput');
    const content = input ? input.value.trim() : '';

    if (!content && !selectedImageBase64) {
        showToast('⚠️ Tulis sesuatu atau pilih gambar!');
        return;
    }

    const newPost = {
        id: Date.now(),
        author: currentUser,
        content: content,
        image: selectedImageBase64,
        likes: 0,
        likedBy: [],
        createdAt: Date.now()
    };

    posts.unshift(newPost);
    localStorage.setItem('yaping_posts', JSON.stringify(posts));
    
    if (input) input.value = '';
    removeSelectedImage();
    renderFeed();
    showToast('✅ Berhasil posting!');
}

// ===== RENDER FEED =====
function renderFeed(filter = '') {
    const feedEl = document.getElementById('feed');
    if (!feedEl) return;

    const query = typeof filter === 'string' ? filter.toLowerCase() : '';
    const filteredPosts = posts.filter(p => 
        p.content.toLowerCase().includes(query) || 
        p.author.toLowerCase().includes(query)
    );

    if (filteredPosts.length === 0) {
        feedEl.innerHTML = '<div class="content-box">Belum ada postingan.</div>';
        return;
    }

    let html = '';
    filteredPosts.forEach(post => {
        let imgHtml = post.image ? `<img src="${post.image}" style="width:100%; border-radius:4px; margin-top:8px;">` : '';
        html += `
            <div class="content-box post-card">
                <div class="post-card-header">
                    <span class="post-username">${escapeHtml(post.author)}</span>
                    <span class="post-timestamp">${formatTimeAgo(post.createdAt)}</span>
                </div>
                <div class="post-body">${formatContent(post.content)}</div>
                ${imgHtml}
                <div class="post-footer">
                    <button class="option-btn" onclick="showToast('❤️ Segera hadir!')">🤍 ${post.likes || 0}</button>
                </div>
            </div>`;
    });
    feedEl.innerHTML = html;
}

// ===== KOMUNITAS LOGIC =====
function renderCommunities(filter) {
    var list = document.getElementById('communityList');
    if (!list) return;
    
    var filtered = communities;
    if (filter === 'mine') filtered = communities.filter(c => c.owner === currentUser);
    
    var html = '';
    filtered.forEach(comm => {
        var isMember = joinedCommunities.includes(comm.id);
        html += `
            <li class="comm-list-item">
                <div class="comm-icon">${comm.category}</div>
                <div class="comm-info">
                    <div class="comm-name" onclick="viewCommunity(${comm.id})">${escapeHtml(comm.name)}</div>
                    <div class="comm-meta">${escapeHtml(comm.desc)} • 👥 ${comm.members}</div>
                </div>
                <button class="primary-btn" onclick="${isMember ? `viewCommunity(${comm.id})` : `joinCommunity(${comm.id})`}">
                    ${isMember ? 'Lihat' : 'Gabung'}
                </button>
            </li>`;
    });
    list.innerHTML = html || '<li class="sidebar-empty">Tidak ada komunitas</li>';
}

function viewCommunity(commId) {
    currentViewedCommunity = commId;
    const comm = communities.find(c => c.id === commId);
    if (!comm) return;

    switchToTab('community-detail');
    const detailTab = document.getElementById('community-detail-tab');
    const isMember = joinedCommunities.includes(commId);

    detailTab.innerHTML = `
        <div class="content-box">
            <a href="#" onclick="switchToTab('komunitas'); return false;">← Kembali</a>
            <h2 style="margin-top:10px">${comm.category} ${escapeHtml(comm.name)}</h2>
            <p>${escapeHtml(comm.desc)}</p>
        </div>
        ${isMember ? `
            <div class="content-box">
                <textarea id="communityPostInput" class="comm-post-input" placeholder="Tulis sesuatu..."></textarea>
                <button class="primary-btn" onclick="submitCommunityPost(${commId})">Kirim</button>
            </div>
        ` : `<div class="content-box"><button class="primary-btn" onclick="joinCommunity(${commId})">Gabung untuk Posting</button></div>`}
        <div id="comm-posts-feed">${renderCommunityPosts(commId)}</div>
    `;
}

function submitCommunityPost(commId) {
    const input = document.getElementById('communityPostInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    if (!communityPosts[commId]) communityPosts[commId] = [];
    communityPosts[commId].unshift({
        id: Date.now(),
        author: currentUser,
        content: text,
        createdAt: Date.now(),
        likes: 0,
        likedBy: []
    });

    saveCommunityPosts();
    input.value = '';
    document.getElementById('comm-posts-feed').innerHTML = renderCommunityPosts(commId);
}

function renderCommunityPosts(commId) {
    const posts = communityPosts[commId] || [];
    if (posts.length === 0) return '<div class="sidebar-empty">Belum ada diskusi.</div>';
    
    return posts.map(post => `
        <div class="post-card content-box">
            <strong>${escapeHtml(post.author)}</strong> <small>${formatTimeAgo(post.createdAt)}</small>
            <div style="margin-top:5px">${escapeHtml(post.content)}</div>
        </div>
    `).join('');
}

function joinCommunity(commId) {
    if (!joinedCommunities.includes(commId)) {
        joinedCommunities.push(commId);
        const comm = communities.find(c => c.id === commId);
        if (comm) comm.members++;
        saveCommunities();
        saveJoinedCommunities();
        renderCommunities('all');
        if(currentViewedCommunity === commId) viewCommunity(commId);
        showToast('🎉 Selamat bergabung!');
    }
}

// ===== UTILITIES =====
function formatContent(text) {
    if (!text) return '';
    let safe = escapeHtml(text);
    return safe.replace(/#(\w+)/g, '<span class="hashtag" style="color:#3b5998; cursor:pointer;">#$1</span>');
}

function escapeHtml(text) {
    let div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Baru saja';
    if (diff < 3600000) return Math.floor(diff/60000) + 'm lalu';
    return Math.floor(diff/86400000) + 'h lalu';
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function saveCommunities() { localStorage.setItem('yaping_communities', JSON.stringify(communities)); }
function saveCommunityPosts() { localStorage.setItem('yaping_communityPosts', JSON.stringify(communityPosts)); }
function saveJoinedCommunities() { localStorage.setItem('yaping_joinedCommunities', JSON.stringify(joinedCommunities)); }

function updateProfileStats() {
    const el = document.getElementById('sidebar-username');
    if (el) el.textContent = currentUser;
}

function doSearch() {
    const query = document.getElementById('searchInput').value;
    renderFeed(query);
}

// Global modal close
function closeModal() {
    const modal = document.getElementById('modal-overlay');
    if (modal) modal.classList.add('hidden');
}
