// ============================================================
//  YAPING - Script Utama
// ============================================================

// ===== STATE =====
let posts = JSON.parse(localStorage.getItem('yapingPosts')) || [];
let communitiesData = JSON.parse(localStorage.getItem('yapingCommunities')) || [
    { id: 1, name: "Gaming Squad", category: "🎮", desc: "Komunitas gamer Indonesia.", owner: "@qwertty", createdAt: Date.now() - 864000000, followers: 142 },
    { id: 2, name: "Meme Central",  category: "😂", desc: "Tempat berbagi meme terbaik.", owner: "@dudememe",  createdAt: Date.now() - 432000000, followers: 87  },
    { id: 3, name: "Tech Talk Daily",category: "💻", desc: "Diskusi teknologi terkini.", owner: "@techguru", createdAt: Date.now() - 216000000, followers: 213 }
];
let userProfile = JSON.parse(localStorage.getItem('yapingProfile')) || {
    username: "@user", fullname: "Pengguna Yaping", bio: ""
};
let notifications = JSON.parse(localStorage.getItem('yapingNotifs')) || [];
let followedCommunities = JSON.parse(localStorage.getItem('yapingFollowed')) || [];
let communityPosts = JSON.parse(localStorage.getItem('yapingCommPosts')) || {};
let darkMode = localStorage.getItem('yapingDarkMode') === 'true';
let activeTab = localStorage.getItem('yapingTab') || 'home';

// ===== INIT =====
(function init() {
    if (darkMode) document.body.classList.add('dark-mode');
    applyProfile();
    renderFeed();
    renderCommunities('all');
    renderSidebars();
    switchToTab(activeTab);
    // Set cooldown info
    updateCooldownInfo();
})();

// ===== PROFILE =====
function applyProfile() {
    safeSet('sidebar-username', userProfile.username);
    safeSet('profile-username-display', userProfile.username);
    safeSet('profile-fullname-display', userProfile.fullname);
    safeSet('pi-username', userProfile.username);
    safeSet('pi-fullname', userProfile.fullname);
    safeSet('edit-username', '', 'value', userProfile.username);
    safeSet('edit-fullname', '', 'value', userProfile.fullname);
    safeSet('edit-bio', '', 'value', userProfile.bio);
    updateStats();
}

function saveProfile() {
    const uname = val('edit-username').trim();
    const fname = val('edit-fullname').trim();
    const bio   = val('edit-bio').trim();
    if (!uname) { showToast('Username tidak boleh kosong!'); return; }
    if (!uname.startsWith('@')) { showToast('Username harus dimulai dengan @'); return; }
    userProfile = { username: uname, fullname: fname, bio };
    localStorage.setItem('yapingProfile', JSON.stringify(userProfile));
    applyProfile();
    showProfileSection('info', document.querySelector('.profile-tab-btn'));
    showToast('✅ Profil berhasil disimpan!');
    addNotification('Profil kamu berhasil diperbarui.');
}

// ===== TAB SWITCHING =====
window.switchToTab = function(tabName) {
    ['home', 'komunitas', 'profile', 'settings', 'community-detail'].forEach(t => {
        const el = document.getElementById(t + '-tab');
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(tabName + '-tab');
    if (target) target.classList.remove('hidden');

    // Update topbar nav active state
    document.querySelectorAll('#topbar-nav a').forEach(a => a.classList.remove('active-nav'));
    const navEl = document.getElementById('nav-' + tabName);
    if (navEl) navEl.classList.add('active-nav');

    activeTab = tabName;
    localStorage.setItem('yapingTab', tabName);

    if (tabName === 'profile') {
        renderMyPosts();
        updateStats();
    }
    if (tabName === 'komunitas') {
        renderCommunities('all');
        updateCooldownInfo();
    }

    // Close notification dropdown
    safeHide('notif-dropdown');
    safeHide('emoji-picker');
};

// ===== SEARCH =====
window.doSearch = function() {
    const q = val('searchInput').toLowerCase().trim();
    if (!q) return;
    const found = communitiesData.filter(c => c.name.toLowerCase().includes(q) || c.category.includes(q));
    if (found.length > 0) {
        switchToTab('komunitas');
        showToast(`Ditemukan ${found.length} komunitas untuk "${q}"`);
        renderCommunities('all', q);
    } else {
        showModal('Hasil Pencarian', `Tidak ditemukan komunitas untuk "<b>${q}</b>".`);
    }
};

// ===== POST FUNCTIONS =====
window.submitPost = function() {
    const content = val('postInput').trim();
    if (!content) { showToast('⚠️ Tulis sesuatu dulu!'); return; }

    const newPost = {
        id: Date.now(),
        user: userProfile.username,
        content,
        timestamp: now(),
        likes: 0,
        likedByMe: false,
        comments: []
    };
    posts.unshift(newPost);
    savePosts();
    renderFeed();
    renderSidebars();
    document.getElementById('postInput').value = '';
    showToast('✅ Postingan berhasil dibagikan!');
    addNotification('Postingan baru kamu sudah dibagikan.');
    updateStats();
};

window.toggleLike = function(postId, isCommunity, commId) {
    let postList = isCommunity ? (communityPosts[commId] || []) : posts;
    const post = postList.find(p => p.id === postId);
    if (!post) return;

    if (post.likedByMe) {
        post.likes--;
        post.likedByMe = false;
    } else {
        post.likes++;
        post.likedByMe = true;
        if (!isCommunity) addNotification(`Kamu menyukai postingan dari ${post.user}.`);
    }

    if (isCommunity) {
        communityPosts[commId] = postList;
        saveCommPosts();
        openCommunityDetail(communitiesData.find(c => c.id === commId));
    } else {
        savePosts();
        renderFeed();
        renderSidebars();
    }
    updateStats();
};

window.toggleComment = function(postId) {
    const section = document.getElementById('comments-' + postId);
    if (section) section.classList.toggle('open');
};

window.submitComment = function(postId, isCommunity, commId) {
    const input = document.getElementById('comment-input-' + postId);
    const text = input ? input.value.trim() : '';
    if (!text) return;

    let postList = isCommunity ? (communityPosts[commId] || []) : posts;
    const post = postList.find(p => p.id === postId);
    if (!post) return;
    if (!post.comments) post.comments = [];
    post.comments.push({ user: userProfile.username, text, time: now() });

    if (isCommunity) {
        communityPosts[commId] = postList;
        saveCommPosts();
        openCommunityDetail(communitiesData.find(c => c.id === commId));
    } else {
        savePosts();
        renderFeed();
    }
    input.value = '';
    showToast('💬 Komentar ditambahkan!');
};

window.deletePost = function(postId) {
    if (!confirm('Hapus postingan ini?')) return;
    posts = posts.filter(p => p.id !== postId);
    savePosts();
    renderFeed();
    renderSidebars();
    updateStats();
    showToast('🗑️ Postingan dihapus.');
};

window.sharePost = function(postId) {
    showToast('🔗 Tautan postingan disalin!');
};

function buildPostCard(post, isCommunity, commId) {
    const isMe = post.user === userProfile.username;
    const commentsHtml = (post.comments || []).map(c => `
        <div class="comment-item">
            <strong>${c.user}</strong>${escapeHtml(c.text)}
            <span style="float:right;color:#aaa;font-size:10px;">${c.time}</span>
        </div>
    `).join('');

    return `
    <div class="post-card" id="post-${post.id}">
        <div class="post-card-header">
            <span class="post-username">${post.user}</span>
            <span class="post-timestamp">${post.timestamp}</span>
        </div>
        <div class="post-body">${escapeHtml(post.content)}</div>
        <div class="post-footer">
            <div class="post-actions-left">
                <button class="like-btn ${post.likedByMe ? 'liked' : ''}"
                    onclick="toggleLike(${post.id}, ${isCommunity}, ${commId})">
                    ❤️ ${post.likes} Suka
                </button>
                <button class="comment-btn" onclick="toggleComment(${post.id})">
                    💬 ${(post.comments||[]).length} Komentar
                </button>
                <button class="share-btn" onclick="sharePost(${post.id})">🔗 Bagikan</button>
            </div>
            ${isMe ? `<button class="post-delete-btn" onclick="deletePost(${post.id})">🗑️ Hapus</button>` : ''}
        </div>
        <div class="comment-section" id="comments-${post.id}">
            <div class="comment-input-row">
                <input type="text" id="comment-input-${post.id}" placeholder="Tulis komentar...">
                <button onclick="submitComment(${post.id}, ${isCommunity}, ${commId})">Kirim</button>
            </div>
            <div class="comment-list">${commentsHtml}</div>
        </div>
    </div>`;
}

function renderFeed() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    if (posts.length === 0) {
        feed.innerHTML = `<div class="content-box" style="text-align:center;color:#999;padding:30px;">
            Belum ada postingan. Jadilah yang pertama berbagi!
        </div>`;
        return;
    }
    feed.innerHTML = posts.map(p => buildPostCard(p, false, 0)).join('');
}

function renderMyPosts() {
    const myPosts = posts.filter(p => p.user === userProfile.username);
    const el = document.getElementById('my-posts-feed');
    if (!el) return;
    if (myPosts.length === 0) {
        el.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">Kamu belum punya postingan.</div>';
        return;
    }
    el.innerHTML = myPosts.map(p => buildPostCard(p, false, 0)).join('');
}

// ===== EMOJI =====
window.addEmoji = function() {
    const picker = document.getElementById('emoji-picker');
    picker.classList.toggle('hidden');
};

window.insertEmoji = function(emoji) {
    const input = document.getElementById('postInput');
    input.value += emoji;
    input.focus();
    document.getElementById('emoji-picker').classList.add('hidden');
};

window.addPhoto = function() {
    showToast('📷 Fitur upload foto akan segera hadir!');
};

// ===== COMMUNITY FUNCTIONS =====
window.addCommunity = function() {
    const name = val('newCommunityInput').trim();
    const desc = val('newCommunityDesc').trim() || 'Komunitas baru di Yaping.';
    const category = val('newCommunityCategory');

    if (!name) { showToast('⚠️ Masukkan nama komunitas!'); return; }
    if (communitiesData.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        showToast('⚠️ Nama komunitas sudah digunakan!'); return;
    }

    const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
    const myComms = communitiesData.filter(c => c.owner === userProfile.username);
    if (myComms.length > 0) {
        const latest = myComms.reduce((a, b) => b.createdAt > a.createdAt ? b : a);
        const diff = Date.now() - latest.createdAt;
        if (diff < TWO_WEEKS) {
            const days = Math.ceil((TWO_WEEKS - diff) / (24 * 60 * 60 * 1000));
            showToast(`⏳ Tunggu ${days} hari lagi untuk membuat komunitas baru!`);
            return;
        }
    }

    const newComm = {
        id: Date.now(), name, category, desc,
        owner: userProfile.username,
        createdAt: Date.now(), followers: 0
    };
    communitiesData.push(newComm);
    saveCommunities();
    renderCommunities('all');
    renderSidebars();
    document.getElementById('newCommunityInput').value = '';
    document.getElementById('newCommunityDesc').value = '';
    showToast('✅ Komunitas berhasil dibuat!');
    addNotification(`Komunitas "${name}" berhasil dibuat!`);
    updateStats();
    updateCooldownInfo();
};

window.deleteCommunity = function(commId) {
    if (!confirm('Yakin ingin menghapus komunitas ini? Semua postingan di dalamnya akan hilang.')) return;
    communitiesData = communitiesData.filter(c => c.id !== commId);
    delete communityPosts[commId];
    saveCommunities();
    saveCommPosts();
    renderCommunities('all');
    renderSidebars();
    showToast('🗑️ Komunitas dihapus.');
    updateStats();
    // If we're in detail view, go back
    if (!document.getElementById('community-detail-tab').classList.contains('hidden')) {
        switchToTab('komunitas');
    }
};

window.toggleFollow = function(commId) {
    const idx = followedCommunities.indexOf(commId);
    const comm = communitiesData.find(c => c.id === commId);
    if (!comm) return;

    if (idx === -1) {
        followedCommunities.push(commId);
        comm.followers++;
        showToast(`✅ Kamu mengikuti ${comm.name}!`);
        addNotification(`Kamu mulai mengikuti komunitas "${comm.name}".`);
    } else {
        followedCommunities.splice(idx, 1);
        if (comm.followers > 0) comm.followers--;
        showToast(`❌ Berhenti mengikuti ${comm.name}.`);
    }
    localStorage.setItem('yapingFollowed', JSON.stringify(followedCommunities));
    saveCommunities();
    // Re-render detail
    openCommunityDetail(comm);
};

window.openCommunityDetail = function(comm) {
    if (!comm) return;
    switchToTab('community-detail');
    const isOwner = comm.owner === userProfile.username;
    const isFollowing = followedCommunities.includes(comm.id);
    const daysAgo = Math.floor((Date.now() - comm.createdAt) / 86400000);
    const commPostList = communityPosts[comm.id] || [];

    const postsHtml = commPostList.length === 0
        ? '<div style="text-align:center;color:#999;padding:20px;">Belum ada postingan di komunitas ini.</div>'
        : commPostList.map(p => buildPostCard(p, true, comm.id)).join('');

    document.getElementById('community-detail-tab').innerHTML = `
        <a class="back-link" onclick="switchToTab('komunitas')">← Kembali ke Komunitas</a>

        <div class="comm-detail-banner"></div>

        <div class="comm-detail-header">
            <div class="comm-detail-icon">${comm.category}</div>
            <div class="comm-detail-info">
                <div class="comm-detail-name">
                    ${comm.name}
                    <span class="verified-check" title="Komunitas Terverifikasi">✓</span>
                </div>
                <div class="comm-detail-meta">
                    Dibuat oleh ${comm.owner} • ${daysAgo} hari lalu • ${comm.followers} pengikut
                </div>
                <div style="margin-top:5px;font-size:12px;color:#555;">${comm.desc}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
                <button class="follow-btn-big ${isFollowing ? 'following' : ''}"
                    onclick="toggleFollow(${comm.id})">
                    ${isFollowing ? '✓ Mengikuti' : '+ Follow'}
                </button>
                ${isOwner ? `<button class="danger-btn" onclick="deleteCommunity(${comm.id})">🗑️ Hapus Komunitas</button>` : ''}
            </div>
        </div>

        ${isOwner ? `<div class="content-box" style="background:#e8f5e9;border-color:#a5d6a7;">
            <span style="font-size:12px;color:#2e7d32;">✅ Kamu adalah pemilik komunitas ini.</span>
        </div>` : ''}

        <div class="content-box">
            <div class="box-title">Tulis Postingan</div>
            <textarea class="comm-post-input" id="comm-post-input-${comm.id}"
                placeholder="Tulis sesuatu di ${comm.name}..."></textarea>
            <button class="primary-btn" onclick="submitCommPost(${comm.id})">Bagikan ke Komunitas</button>
        </div>

        <div class="content-box">
            <div class="box-title">Postingan Komunitas (${commPostList.length})</div>
            ${postsHtml}
        </div>
    `;
};

window.submitCommPost = function(commId) {
    const input = document.getElementById('comm-post-input-' + commId);
    const text = input ? input.value.trim() : '';
    if (!text) { showToast('⚠️ Tulis sesuatu dulu!'); return; }

    const comm = communitiesData.find(c => c.id === commId);
    if (!communityPosts[commId]) communityPosts[commId] = [];
    communityPosts[commId].unshift({
        id: Date.now(),
        user: userProfile.username,
        content: text,
        timestamp: now(),
        likes: 0,
        likedByMe: false,
        comments: []
    });
    saveCommPosts();
    openCommunityDetail(comm);
    showToast('✅ Postingan dibagikan ke komunitas!');
    addNotification(`Postingan baru di komunitas "${comm.name}".`);
};

window.filterComm = function(type, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCommunities(type);
};

function renderCommunities(type, searchQuery) {
    const list = document.getElementById('communityList');
    if (!list) return;

    let data = [...communitiesData];
    if (type === 'mine') data = data.filter(c => c.owner === userProfile.username);
    if (searchQuery) data = data.filter(c => c.name.toLowerCase().includes(searchQuery));

    if (data.length === 0) {
        list.innerHTML = `<li style="padding:20px;text-align:center;color:#999;">
            ${type === 'mine' ? 'Kamu belum punya komunitas.' : 'Tidak ada komunitas ditemukan.'}
        </li>`;
        return;
    }

    list.innerHTML = data.map(comm => {
        const isOwner = comm.owner === userProfile.username;
        const isFollowing = followedCommunities.includes(comm.id);
        const daysAgo = Math.floor((Date.now() - comm.createdAt) / 86400000);
        return `
        <li class="comm-list-item">
            <div class="comm-icon">${comm.category}</div>
            <div class="comm-info">
                <div class="comm-name" onclick="openCommunityDetail(communitiesData.find(c=>c.id===${comm.id}))">${comm.name}</div>
                <div class="comm-meta">${comm.owner} • ${daysAgo} hari lalu • ${comm.followers} pengikut</div>
            </div>
            <div class="comm-actions">
                ${isOwner
                    ? `<button class="danger-btn" onclick="deleteCommunity(${comm.id})">Hapus</button>`
                    : `<button class="${isFollowing ? 'secondary-btn' : 'primary-btn'}"
                            onclick="toggleFollow(${comm.id});renderCommunities('${type}');">
                            ${isFollowing ? '✓ Mengikuti' : '+ Follow'}
                        </button>`
                }
            </div>
        </li>`;
    }).join('');
}

function updateCooldownInfo() {
    const el = document.getElementById('cooldown-info');
    if (!el) return;
    const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
    const myComms = communitiesData.filter(c => c.owner === userProfile.username);
    if (myComms.length === 0) { el.textContent = ''; return; }
    const latest = myComms.reduce((a, b) => b.createdAt > a.createdAt ? b : a);
    const diff = Date.now() - latest.createdAt;
    if (diff < TWO_WEEKS) {
        const days = Math.ceil((TWO_WEEKS - diff) / 86400000);
        el.textContent = `⏳ Cooldown: ${days} hari lagi`;
    } else {
        el.textContent = '';
    }
}

// ===== PROFILE SECTIONS =====
window.showProfileSection = function(section, clickedBtn) {
    ['info', 'posts', 'edit'].forEach(s => {
        safeHide(`profile-${s}-section`);
    });
    document.getElementById(`profile-${section}-section`).classList.remove('hidden');

    document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
    if (clickedBtn) clickedBtn.classList.add('active');
    else {
        const btns = document.querySelectorAll('.profile-tab-btn');
        const map = { info: 0, posts: 1, edit: 2 };
        if (btns[map[section]]) btns[map[section]].classList.add('active');
    }

    if (section === 'posts') renderMyPosts();
    if (section === 'edit') {
        safeSet('edit-username', '', 'value', userProfile.username);
        safeSet('edit-fullname', '', 'value', userProfile.fullname);
        safeSet('edit-bio', '', 'value', userProfile.bio);
    }
};

// ===== SETTINGS =====
window.toggleDarkMode = function() {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('yapingDarkMode', darkMode);
    showToast(darkMode ? '🌙 Mode gelap aktif' : '☀️ Mode terang aktif');
};

window.changeFontSize = function(size) {
    document.body.style.fontSize = size + 'px';
    showToast(`Font diubah ke ${size}px`);
};

window.clearAllPosts = function() {
    if (!confirm('Hapus SEMUA postingan kamu?')) return;
    posts = posts.filter(p => p.user !== userProfile.username);
    savePosts();
    renderFeed();
    updateStats();
    showToast('🗑️ Semua postinganmu dihapus.');
};

window.resetAllData = function() {
    if (!confirm('⚠️ RESET semua data Yaping? Ini tidak bisa dibatalkan!')) return;
    localStorage.clear();
    location.reload();
};

// ===== NOTIFICATIONS =====
window.showNotifications = function() {
    const dropdown = document.getElementById('notif-dropdown');
    dropdown.classList.toggle('hidden');

    // Update badge
    safeHide('notif-badge');

    // Render notifications
    const list = document.getElementById('notif-list');
    if (notifications.length === 0) {
        list.innerHTML = '<div class="notif-empty">Belum ada notifikasi</div>';
    } else {
        list.innerHTML = notifications.slice(0, 10).map(n => `
            <div class="notif-item">📌 ${n.text} <br><small style="color:#aaa">${n.time}</small></div>
        `).join('');
    }

    // Close when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeNotif(e) {
            if (!document.getElementById('notif-dropdown').contains(e.target) &&
                e.target.id !== 'nav-notif') {
                safeHide('notif-dropdown');
                document.removeEventListener('click', closeNotif);
            }
        });
    }, 100);
};

function addNotification(text) {
    notifications.unshift({ text, time: now() });
    if (notifications.length > 50) notifications.pop();
    localStorage.setItem('yapingNotifs', JSON.stringify(notifications));

    const badge = document.getElementById('notif-badge');
    if (badge) {
        badge.classList.remove('hidden');
        badge.textContent = Math.min(notifications.length, 9);
    }
}

window.clearNotifications = function() {
    notifications = [];
    localStorage.setItem('yapingNotifs', JSON.stringify(notifications));
    document.getElementById('notif-list').innerHTML = '<div class="notif-empty">Belum ada notifikasi</div>';
    safeHide('notif-badge');
    showToast('🔔 Notifikasi dihapus.');
};

// ===== SIDEBARS =====
function renderSidebars() {
    // Popular posts
    const popularEl = document.getElementById('popular-posts-sidebar');
    if (popularEl) {
        const sorted = [...posts].sort((a, b) => b.likes - a.likes).slice(0, 5);
        if (sorted.length === 0) {
            popularEl.innerHTML = '<div class="sidebar-empty">Belum ada postingan</div>';
        } else {
            popularEl.innerHTML = sorted.map(p => `
                <div class="sidebar-post-item" onclick="alert('${escapeHtml(p.content.substring(0, 50))}...')">
                    ❤️ ${p.likes} - ${p.user}: ${p.content.substring(0, 30)}...
                </div>
            `).join('');
        }
    }

    // Popular communities
    const commEl = document.getElementById('popular-comms-sidebar');
    if (commEl) {
        const sorted = [...communitiesData].sort((a, b) => b.followers - a.followers).slice(0, 5);
        commEl.innerHTML = sorted.map(c => `
            <div class="sidebar-comm-item" onclick="openCommunityDetail(communitiesData.find(x=>x.id===${c.id}))">
                ${c.category} ${c.name} (${c.followers})
            </div>
        `).join('');
    }
}

// ===== STATS =====
function updateStats() {
    const totalPosts = posts.length;
    const likesGiven = posts.filter(p => p.likedByMe).length;
    const myCommsCount = communitiesData.filter(c => c.owner === userProfile.username).length;

    safeSet('sidebar-post-count', totalPosts);
    safeSet('sidebar-like-count', likesGiven);
    safeSet('sidebar-comm-count', communitiesData.length);
    safeSet('pi-posts', totalPosts);
    safeSet('pi-likes', likesGiven);
    safeSet('pi-comms', myCommsCount);
}

// ===== MODAL =====
function showModal(title, body, extraBtn) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    const footer = document.getElementById('modal-footer');
    footer.innerHTML = '';
    if (extraBtn) {
        const btn = document.createElement('button');
        btn.className = 'primary-btn';
        btn.textContent = extraBtn.text;
        btn.onclick = extraBtn.action;
        footer.appendChild(btn);
    }
    const closeBtn = document.createElement('button');
    closeBtn.className = 'secondary-btn';
    closeBtn.textContent = 'Tutup';
    closeBtn.onclick = closeModal;
    footer.appendChild(closeBtn);
    document.getElementById('modal-overlay').classList.remove('hidden');
}

window.closeModal = function() {
    document.getElementById('modal-overlay').classList.add('hidden');
};

// Close modal on overlay click
document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

// ===== TOAST =====
let toastTimer;
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ===== SAVE FUNCTIONS =====
function savePosts() { localStorage.setItem('yapingPosts', JSON.stringify(posts)); }
function saveCommunities() { localStorage.setItem('yapingCommunities', JSON.stringify(communitiesData)); }
function saveCommPosts() { localStorage.setItem('yapingCommPosts', JSON.stringify(communityPosts)); }

// ===== HELPERS =====
function val(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

function safeSet(id, text, attr, val2) {
    const el = document.getElementById(id);
    if (!el) return;
    if (attr) el[attr] = val2 !== undefined ? val2 : text;
    else el.textContent = text;
}

function safeHide(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function now() {
    return new Date().toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// Close emoji picker on outside click
document.addEventListener('click', function(e) {
    const picker = document.getElementById('emoji-picker');
    if (!picker.classList.contains('hidden') &&
        !picker.contains(e.target) &&
        !e.target.closest('.option-btn')) {
        picker.classList.add('hidden');
    }
});

// Keyboard shortcut: Ctrl+Enter to post
document.getElementById('postInput').addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'Enter') submitPost();
});
