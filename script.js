/* ============================================
   YAPING - script.js (FIXED + NEW FEATURES)
   ✓ Profil Photo Fixed
   ✓ Upload Media Fixed  
   ✓ + Komentar System
   ✓ + Community Statistics
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
var profilePhoto = null;

// File upload config
var MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
var ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
var ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

// ===== INIT =====
function initApp() {
    loadData();
    renderCommunities('all');
    renderFeed();
    updateProfileStats();
    updateProfilePhotoDisplay();
    setupEventListeners();
    
    // Dark mode
    if (localStorage.getItem('yaping_darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        var toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = true;
    }
}

function loadData() {
    try {
        // Communities
        var c = localStorage.getItem('yaping_communities');
        communities = c ? JSON.parse(c) : [
            { id: 1, name: 'Gaming Indonesia', desc: 'Komunitas gamer Indonesia', category: '🎮', members: 128, owner: '@user', createdAt: Date.now() },
            { id: 2, name: 'Teknologi Update', desc: 'Berita tech terbaru', category: '💻', members: 256, owner: '@admin', createdAt: Date.now() - 86400000 },
            { id: 3, name: 'Meme Lucu', desc: 'Kumpulan meme terbaik', category: '😂', members: 512, owner: '@memeLord', createdAt: Date.now() - 172800000 }
        ];
        
        // Posts
        var p = localStorage.getItem('yaping_communityPosts');
        communityPosts = p ? JSON.parse(p) : {};
        
        // Joined
        var j = localStorage.getItem('yaping_joinedCommunities');
        joinedCommunities = j ? JSON.parse(j) : [1];
        
        // Cooldown
        var lcc = localStorage.getItem('yaping_lastCommCreate');
        lastCommunityCreate = lcc ? parseInt(lcc) : 0;
        
        // Profile photo
        profilePhoto = localStorage.getItem('yaping_profilePhoto_' + currentUser);
        
    } catch(e) {
        console.log('Load error:', e);
        communities = [];
        communityPosts = {};
        joinedCommunities = [];
    }
}

function setupEventListeners() {
    // Search
    var searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') doSearch();
        });
    }
    
    // Emoji picker close on outside click
    document.addEventListener('click', function(e) {
        var picker = document.getElementById('emoji-picker');
        if (picker && !picker.contains(e.target)) {
            var isBtn = false;
            var el = e.target;
            while (el) {
                var onclick = el.getAttribute ? el.getAttribute('onclick') : '';
                if (onclick && onclick.indexOf('addEmoji') !== -1) { isBtn = true; break; }
                el = el.parentNode;
            }
            if (!isBtn) picker.classList.add('hidden');
        }
    });
    
    // Init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
}

// ===== TAB NAVIGATION =====
function switchToTab(tabName) {
    var tabs = document.querySelectorAll('.tab-content');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.add('hidden');
    
    var target = document.getElementById(tabName + '-tab');
    if (target) target.classList.remove('hidden');
    
    var navs = document.querySelectorAll('#topbar-nav a');
    for (var j = 0; j < navs.length; j++) navs[j].classList.remove('active-nav');
    var activeNav = document.getElementById('nav-' + tabName);
    if (activeNav) activeNav.classList.add('active-nav');
    
    if (tabName === 'komunitas') renderCommunities('all');
    else if (tabName === 'profile') { updateProfileStats(); updateProfilePhotoDisplay(); renderMyPosts(); }
    else if (tabName === 'home') renderFeed();
    
    var nd = document.getElementById('notif-dropdown');
    if (nd) nd.classList.add('hidden');
    
    if (tabName !== 'community-detail') currentViewedCommunity = null;
    
    return false;
}

// ===== FILE UPLOAD HELPERS =====
function readFileAsBase64(file, callback) {
    var reader = new FileReader();
    reader.onload = function(e) { callback(e.target.result); };
    reader.onerror = function() { showToast('Gagal membaca file'); };
    reader.readAsDataURL(file);
}

function validateFile(file, isProfile) {
    if (!file) return { valid: false, error: 'Pilih file dulu' };
    
    if (isProfile) {
        if (ALLOWED_IMAGE_TYPES.indexOf(file.type) === -1) {
            return { valid: false, error: 'Format: PNG, JPEG, atau GIF' };
        }
    } else {
        if (ALLOWED_IMAGE_TYPES.indexOf(file.type) === -1 && ALLOWED_VIDEO_TYPES.indexOf(file.type) === -1) {
            return { valid: false, error: 'Format: PNG, JPEG, GIF, MP4, atau WebM' };
        }
    }
    
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: 'Maksimal 2MB' };
    }
    
    return { valid: true };
}

function compressImage(base64, maxWidth, callback) {
    var img = new Image();
    img.onload = function() {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var ratio = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * ratio;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = function() { callback(base64); };
    img.src = base64;
}

// ===== PROFILE PHOTO =====
function updateProfilePhotoDisplay() {
    // Update all avatar elements
    var selectors = ['.profile-avatar-big', '.sidebar-profile-pic'];
    for (var s = 0; s < selectors.length; s++) {
        var el = document.querySelector(selectors[s]);
        if (el) {
            if (profilePhoto) {
                el.innerHTML = '<img src="' + profilePhoto + '" style="width:100%;height:100%;object-fit:cover;border-radius:3px;" alt="Profile">';
            } else {
                el.innerHTML = '👤';
            }
        }
    }
}

function triggerProfilePhotoUpload() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif';
    input.style.display = 'none';
    
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        var validation = validateFile(file, true);
        if (!validation.valid) {
            showToast(validation.error);
            return;
        }
        
        showToast('Memproses...');
        
        readFileAsBase64(file, function(base64) {
            if (file.type !== 'image/gif') {
                compressImage(base64, 400, function(compressed) {
                    saveProfilePhoto(compressed);
                });
            } else {
                if (base64.length > 3000000) {
                    showToast('GIF terlalu besar');
                    return;
                }
                saveProfilePhoto(base64);
            }
        });
    };
    
    document.body.appendChild(input);
    input.click();
    setTimeout(function() { input.remove(); }, 1000);
}

function saveProfilePhoto(base64) {
    try {
        localStorage.setItem('yaping_profilePhoto_' + currentUser, base64);
        profilePhoto = base64;
        updateProfilePhotoDisplay();
        showToast('✅ Foto profil diperbarui!');
    } catch(e) {
        showToast('❌ Gagal: penyimpanan penuh');
    }
}

function removeProfilePhoto() {
    if (confirm('Hapus foto profil?')) {
        localStorage.removeItem('yaping_profilePhoto_' + currentUser);
        profilePhoto = null;
        updateProfilePhotoDisplay();
        showToast('Foto profil dihapus');
    }
}

// ===== POST MEDIA UPLOAD =====
function triggerPostFileUpload(target) {
    // target: 'home' or 'community'
    var commId = target === 'community' ? currentViewedCommunity : null;
    var previewId = 'filePreview_' + (commId || 'home');
    
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,video/mp4,video/webm';
    input.style.display = 'none';
    
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        var validation = validateFile(file, false);
        if (!validation.valid) {
            showToast(validation.error);
            return;
        }
        
        showToast('Memproses...');
        
        readFileAsBase64(file, function(base64) {
            // Show preview
            var previewEl = document.getElementById(previewId);
            if (!previewEl) {
                previewEl = document.createElement('div');
                previewEl.id = previewId;
                previewEl.className = 'file-preview';
                previewEl.style.cssText = 'margin:8px 0;padding:8px;background:var(--fb-blue-lighter);border-radius:3px;font-size:11px;display:flex;align-items:center;gap:8px;';
                
                var textareaId = target === 'community' ? 'communityPostInput' : 'postInput';
                var textarea = document.getElementById(textareaId);
                if (textarea && textarea.parentNode) {
                    textarea.parentNode.insertBefore(previewEl, textarea.nextSibling);
                }
            }
            
            var isVideo = ALLOWED_VIDEO_TYPES.indexOf(file.type) !== -1;
            var fname = file.name.length > 25 ? file.name.substring(0, 22) + '...' : file.name;
            
            previewEl.innerHTML = (isVideo ? '🎬' : '🖼️') + ' ' + fname + 
                ' <button class="option-btn" style="padding:2px 6px;font-size:10px;" onclick="removeFilePreview(\'' + previewId + '\')">✕</button>';
            previewEl.dataset.base64 = base64;
            previewEl.dataset.type = file.type;
        });
    };
    
    document.body.appendChild(input);
    input.click();
    setTimeout(function() { input.remove(); }, 1000);
}

function removeFilePreview(previewId) {
    var el = document.getElementById(previewId);
    if (el) el.remove();
}

function getFileData(previewId) {
    var el = document.getElementById(previewId);
    if (!el || !el.dataset.base64) return null;
    return { base64: el.dataset.base64, type: el.dataset.type };
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
        var badge = isMember ? ' <span style="color:var(--fb-green)">[Anggota]</span>' : '';
        var btn = isMember 
            ? '<button class="primary-btn" onclick="viewCommunity(' + c.id + ')">Lihat</button>'
            : '<button class="primary-btn" onclick="joinCommunity(' + c.id + ')">Gabung</button>';
        
        html += '<li class="comm-list-item">' +
            '<div class="comm-icon">' + c.category + '</div>' +
            '<div class="comm-info">' +
                '<div class="comm-name" onclick="viewCommunity(' + c.id + ')">' + escapeHtml(c.name) + badge + '</div>' +
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
        createdAt: now,
        stats: { totalPosts: 0, totalLikes: 0, totalComments: 0, joinedAt: now }
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
    
    setTimeout(function() { if (cooldownInfo && cooldownInfo.textContent.indexOf('Komunitas') !== -1) cooldownInfo.textContent = ''; }, 3000);
}

function joinCommunity(commId) {
    if (joinedCommunities.indexOf(commId) !== -1) { showToast('Kamu sudah anggota!'); return; }
    
    var comm = getCommunityById(commId);
    if (!comm) return;
    
    comm.members++;
    if (!comm.stats) comm.stats = { totalPosts: 0, totalLikes: 0, totalComments: 0, joinedAt: Date.now() };
    comm.stats.joinedAt = Date.now();
    
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
    
    // Stats display
    var stats = comm.stats || { totalPosts: 0, totalLikes: 0, totalComments: 0 };
    var statsHtml = '<div style="display:flex;gap:12px;font-size:11px;color:var(--fb-text-light);margin:8px 0;">' +
        '<span>📊 ' + stats.totalPosts + ' postingan</span>' +
        '<span>❤️ ' + stats.totalLikes + ' like</span>' +
        '<span>💬 ' + stats.totalComments + ' komentar</span>' +
    '</div>';
    
    var postBox = '';
    if (isMember) {
        postBox = '<div class="content-box">' +
            '<div class="box-title">Buat Postingan</div>' +
            '<textarea id="communityPostInput" class="comm-post-input" placeholder="Tulis untuk ' + escapeHtml(comm.name) + '..."></textarea>' +
            '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0;">' +
                '<button class="option-btn" onclick="addEmoji(\'communityPostInput\')" style="font-size:11px;">😊 Emoji</button>' +
                '<button class="option-btn" onclick="triggerPostFileUpload(\'community\')" style="font-size:11px;">📷 Foto/Video</button>' +
                '<button class="primary-btn" onclick="submitCommunityPost(' + commId + ')">Bagikan</button>' +
            '</div>' +
            '<div id="filePreview_' + commId + '"></div>' +
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
                    '<div style="font-size:12px;color:var(--fb-text-light);margin-bottom:4px;">' + escapeHtml(comm.desc) + '</div>' +
                    '<div class="comm-detail-meta">' + comm.members + ' anggota | Oleh ' + escapeHtml(comm.owner) + memberText + '</div>' +
                    statsHtml +
                '</div>' +
                joinBtn +
            '</div>' +
        '</div>' +
        postBox +
        '<div class="content-box">' +
            '<div class="box-title">💬 Diskusi Terbaru</div>' +
            '<div id="comm-posts-feed">' + postsHTML + '</div>' +
        '</div>';
}

// ===== POST SUBMIT =====
function submitCommunityPost(commId) {
    var input = document.getElementById('communityPostInput');
    var text = input ? input.value.trim() : '';
    var fileData = getFileData('filePreview_' + commId);
    
    if (!text && !fileData) { showToast('Tulis sesuatu atau upload media!'); return; }
    
    var comm = getCommunityById(commId);
    if (!comm) return;
    
    var newPost = {
        id: Date.now(),
        communityId: commId,
        author: currentUser,
        content: text,
        media: fileData ? { base64: fileData.base64, type: fileData.type } : null,
        likes: 0,
        likedBy: [],
        comments: [],
        createdAt: Date.now()
    };
    
    if (!communityPosts[commId]) communityPosts[commId] = [];
    communityPosts[commId].unshift(newPost);
    
    // Update stats
    if (!comm.stats) comm.stats = { totalPosts: 0, totalLikes: 0, totalComments: 0 };
    comm.stats.totalPosts++;
    
    saveCommunityPosts();
    saveCommunities();
    
    if (input) input.value = '';
    removeFilePreview('filePreview_' + commId);
    
    showToast('Postingan dibagikan!');
    
    var feedEl = document.getElementById('comm-posts-feed');
    if (feedEl) feedEl.innerHTML = renderCommunityPosts(commId);
    
    if (comm.owner !== currentUser) addNotification(currentUser + ' memposting di ' + comm.name, 'comm');
}

// ===== RENDER POSTS WITH COMMENTS =====
function renderCommunityPosts(commId) {
    var posts = communityPosts[commId] || [];
    if (posts.length === 0) return '<div class="sidebar-empty">Belum ada diskusi. Jadilah yang pertama!</div>';
    
    var html = '';
    for (var i = 0; i < posts.length; i++) {
        var p = posts[i];
        var timeAgo = formatTimeAgo(p.createdAt);
        var isLiked = p.likedBy && p.likedBy.indexOf(currentUser) !== -1;
        var isOwner = p.author === currentUser;
        
        // Media
        var mediaHtml = '';
        if (p.media && p.media.base64) {
            if (p.media.type.indexOf('video') !== -1) {
                mediaHtml = '<div style="margin:8px 0;"><video src="' + p.media.base64 + '" controls style="max-width:100%;border-radius:3px;"></video></div>';
            } else {
                mediaHtml = '<div style="margin:8px 0;"><img src="' + p.media.base64 + '" style="max-width:100%;border-radius:3px;cursor:pointer;" onclick="viewMediaFull(\'' + p.media.base64 + '\')"></div>';
            }
        }
        
        // Comments
        var commentsHtml = '';
        if (p.comments && p.comments.length > 0) {
            commentsHtml = '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--fb-border);">';
            for (var c = 0; c < p.comments.length; c++) {
                var cm = p.comments[c];
                var canDelete = cm.author === currentUser || isOwner;
                commentsHtml += '<div style="font-size:12px;margin:4px 0;padding:6px 8px;background:var(--fb-blue-bg);border-radius:3px;">' +
                    '<strong>' + escapeHtml(cm.author) + '</strong>: ' + escapeHtml(cm.text) + 
                    ' <span style="color:var(--fb-text-light);font-size:10px;">' + formatTimeAgo(cm.createdAt) + '</span>' +
                    (canDelete ? ' <button class="option-btn" style="padding:1px 4px;font-size:9px;" onclick="deleteComment(' + commId + ',' + p.id + ',' + cm.id + ')">✕</button>' : '') +
                '</div>';
            }
            commentsHtml += '</div>';
        }
        
        // Comment input (only for members)
        var commentInput = joinedCommunities.indexOf(commId) !== -1 
            ? '<div style="margin-top:8px;display:flex;gap:4px;">' +
                '<input type="text" id="commentInput_' + p.id + '" placeholder="Tulis komentar..." style="flex:1;padding:4px 8px;border:1px solid var(--fb-border);border-radius:3px;font-size:11px;">' +
                '<button class="option-btn" style="padding:4px 8px;font-size:11px;" onclick="submitComment(' + commId + ',' + p.id + ')">Kirim</button>' +
              '</div>'
            : '';
        
        var deleteBtn = isOwner ? '<button class="post-delete-btn" onclick="deletePost(' + commId + ',' + p.id + ',true)" style="margin-left:auto;">🗑️</button>' : '';
        
        html += '<div class="post-card" style="margin-bottom:8px;">' +
            '<div class="post-card-header">' +
                '<span class="post-username">' + escapeHtml(p.author) + '</span>' +
                '<span class="post-timestamp">' + timeAgo + '</span>' +
            '</div>' +
            '<div class="post-body">' + escapeHtml(p.content) + '</div>' +
            mediaHtml +
            '<div class="post-footer">' +
                '<div class="post-actions-left">' +
                    '<button class="like-btn' + (isLiked ? ' liked' : '') + '" onclick="likePost(' + commId + ',' + p.id + ')">' + (isLiked ? '❤️' : '🤍') + ' ' + p.likes + '</button>' +
                    '<button class="comment-btn" onclick="toggleCommentInput(' + p.id + ')">💬 ' + (p.comments ? p.comments.length : 0) + '</button>' +
                '</div>' +
                '<button class="share-btn" onclick="showToast(\'Link disalin!\')">🔗</button>' +
                deleteBtn +
            '</div>' +
            '<div id="commentSection_' + p.id + '" class="comment-section" style="display:none;">' + commentInput + commentsHtml + '</div>' +
        '</div>';
    }
    return html;
}

// ===== COMMENTS SYSTEM =====
function toggleCommentInput(postId) {
    var section = document.getElementById('commentSection_' + postId);
    if (section) {
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
    }
}

function submitComment(commId, postId) {
    var input = document.getElementById('commentInput_' + postId);
    var text = input ? input.value.trim() : '';
    if (!text) { showToast('Tulis komentar dulu!'); return; }
    
    var posts = communityPosts[commId];
    if (!posts) return;
    
    var post = null;
    for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === postId) { post = posts[i]; break; }
    }
    if (!post) return;
    
    if (!post.comments) post.comments = [];
    
    post.comments.push({
        id: Date.now(),
        author: currentUser,
        text: text,
        createdAt: Date.now()
    });
    
    // Update stats
    var comm = getCommunityById(commId);
    if (comm && comm.stats) comm.stats.totalComments++;
    
    saveCommunityPosts();
    saveCommunities();
    
    if (input) input.value = '';
    
    // Re-render
    var feedEl = document.getElementById('comm-posts-feed');
    if (feedEl && currentViewedCommunity === commId) {
        feedEl.innerHTML = renderCommunityPosts(commId);
        // Re-open comment section
        var section = document.getElementById('commentSection_' + postId);
        if (section) section.style.display = 'block';
    }
    
    showToast('Komentar dikirim!');
    
    // Notify post author if not self
    if (post.author !== currentUser) {
        addNotification(currentUser + ' mengomentari postinganmu', 'comment');
    }
}

function deleteComment(commId, postId, commentId) {
    if (!confirm('Hapus komentar ini?')) return;
    
    var posts = communityPosts[commId];
    if (!posts) return;
    
    var post = null;
    for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === postId) { post = posts[i]; break; }
    }
    if (!post || !post.comments) return;
    
    var idx = -1;
    for (var j = 0; j < post.comments.length; j++) {
        if (post.comments[j].id === commentId) { idx = j; break; }
    }
    if (idx === -1) return;
    
    post.comments.splice(idx, 1);
    
    // Update stats
    var comm = getCommunityById(commId);
    if (comm && comm.stats && comm.stats.totalComments > 0) comm.stats.totalComments--;
    
    saveCommunityPosts();
    saveCommunities();
    
    // Re-render
    var feedEl = document.getElementById('comm-posts-feed');
    if (feedEl && currentViewedCommunity === commId) {
        feedEl.innerHTML = renderCommunityPosts(commId);
    }
    
    showToast('Komentar dihapus');
}

// ===== LIKE SYSTEM =====
function likePost(commId, postId) {
    var posts = communityPosts[commId];
    if (!posts) return;
    
    var post = null;
    for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === postId) { post = posts[i]; break; }
    }
    if (!post) return;
    
    if (!post.likedBy) post.likedBy = [];
    
    var idx = post.likedBy.indexOf(currentUser);
    if (idx === -1) {
        post.likes = (post.likes || 0) + 1;
        post.likedBy.push(currentUser);
        // Update stats
        var comm = getCommunityById(commId);
        if (comm && comm.stats) comm.stats.totalLikes++;
    } else {
        post.likes = (post.likes || 0) - 1;
        post.likedBy.splice(idx, 1);
        var comm = getCommunityById(commId);
        if (comm && comm.stats && comm.stats.totalLikes > 0) comm.stats.totalLikes--;
    }
    
    saveCommunityPosts();
    saveCommunities();
    
    if (currentViewedCommunity === commId) {
        var feedEl = document.getElementById('comm-posts-feed');
        if (feedEl) feedEl.innerHTML = renderCommunityPosts(commId);
    }
}

// ===== DELETE POST =====
function deletePost(commId, postId, isCommunity) {
    if (!confirm('Hapus postingan ini?')) return;
    
    if (isCommunity) {
        var posts = communityPosts[commId];
        if (!posts) return;
        
        var post = null, idx = -1;
        for (var i = 0; i < posts.length; i++) {
            if (posts[i].id === postId) { post = posts[i]; idx = i; break; }
        }
        if (idx === -1 || !post) return;
        
        // Update stats: subtract likes/comments
        var comm = getCommunityById(commId);
        if (comm && comm.stats) {
            if (comm.stats.totalPosts > 0) comm.stats.totalPosts--;
            if (comm.stats.totalLikes >= (post.likes || 0)) comm.stats.totalLikes -= (post.likes || 0);
            if (comm.stats.totalComments >= (post.comments ? post.comments.length : 0)) comm.stats.totalComments -= (post.comments ? post.comments.length : 0);
        }
        
        posts.splice(idx, 1);
        saveCommunityPosts();
        saveCommunities();
        
        if (currentViewedCommunity === commId) {
            var feedEl = document.getElementById('comm-posts-feed');
            if (feedEl) feedEl.innerHTML = renderCommunityPosts(commId);
        }
        showToast('Postingan dihapus');
    } else {
        showToast('Postingan dihapus');
        renderFeed();
    }
}

// ===== MEDIA FULLSCREEN =====
function viewMediaFull(base64) {
    var isVideo = base64.indexOf('video') !== -1;
    var content = isVideo 
        ? '<video src="' + base64 + '" controls style="max-width:100%;max-height:70vh;"></video>'
        : '<img src="' + base64 + '" style="max-width:100%;max-height:70vh;">';
    showModal('Lihat Media', content);
}

// ===== HOME FEED =====
function submitPost() {
    var input = document.getElementById('postInput');
    var text = input ? input.value.trim() : '';
    var fileData = getFileData('filePreview_home');
    
    if (!text && !fileData) { showToast('Tulis sesuatu atau upload media!'); return; }
    
    showToast('Postingan dibagikan!');
    if (input) input.value = '';
    removeFilePreview('filePreview_home');
    renderFeed();
}

function renderFeed() {
    var feed = document.getElementById('feed');
    if (!feed) return;
    
    if (!feed.innerHTML.trim() || feed.innerHTML.indexOf('Selamat datang') !== -1) {
        feed.innerHTML = 
            '<div class="post-card">' +
                '<div class="post-card-header"><span class="post-username">@user</span><span class="post-timestamp">Baru saja</span></div>' +
                '<div class="post-body">Selamat datang di Yaping! 👋 Upload foto/video, komen, dan gabung komunitas!</div>' +
                '<div class="post-footer">' +
                    '<div class="post-actions-left">' +
                        '<button class="like-btn" onclick="showToast(\'Terima kasih!\')">🤍 0</button>' +
                        '<button class="comment-btn" onclick="showToast(\'Komentar...\')">💬 0</button>' +
                    '</div>' +
                    '<button class="share-btn" onclick="showToast(\'Dibagikan!\')">🔗</button>' +
                    '<button class="post-delete-btn" onclick="deletePost(null,1,false)">🗑️</button>' +
                '</div>' +
            '</div>';
    }
}

// ===== PROFILE =====
function renderMyPosts() {
    var feed = document.getElementById('my-posts-feed');
    if (!feed) return;
    
    var myPosts = [];
    for (var commId in communityPosts) {
        var posts = communityPosts[commId];
        for (var i = 0; i < posts.length; i++) {
            if (posts[i].author === currentUser) myPosts.push(posts[i]);
        }
    }
    
    if (myPosts.length === 0) {
        feed.innerHTML = '<div class="sidebar-empty">Kamu belum memiliki postingan. Yuk mulai berbagi!</div>';
        return;
    }
    
    var html = '';
    for (var j = 0; j < myPosts.length; j++) {
        var p = myPosts[j];
        var timeAgo = formatTimeAgo(p.createdAt);
        
        var mediaHtml = '';
        if (p.media && p.media.base64) {
            if (p.media.type.indexOf('video') !== -1) {
                mediaHtml = '<div style="margin:8px 0;"><video src="' + p.media.base64 + '" controls style="max-width:100%;border-radius:3px;"></video></div>';
            } else {
                mediaHtml = '<div style="margin:8px 0;"><img src="' + p.media.base64 + '" style="max-width:100%;border-radius:3px;"></div>';
            }
        }
        
        html += '<div class="post-card" style="margin-bottom:8px;">' +
            '<div class="post-card-header"><span class="post-username">' + escapeHtml(p.author) + '</span><span class="post-timestamp">' + timeAgo + '</span></div>' +
            '<div class="post-body">' + escapeHtml(p.content) + '</div>' +
            mediaHtml +
            '<div class="post-footer">' +
                '<button class="post-delete-btn" onclick="deletePost(' + p.communityId + ',' + p.id + ',true)">🗑️ Hapus</button>' +
            '</div>' +
        '</div>';
    }
    feed.innerHTML = html;
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
    for (var key in els) { var el = document.getElementById(key); if (el) el.textContent = els[key]; }
    
    var count = 0;
    for (var i = 0; i < communities.length; i++) if (communities[i].owner === currentUser) count++;
    var el = document.getElementById('pi-comms'); if (el) el.textContent = count;
}

function showProfileSection(section, btn) {
    var btns = document.querySelectorAll('.profile-tab-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    if (btn) btn.classList.add('active');
    
    var secs = ['profile-info-section', 'profile-posts-section', 'profile-edit-section'];
    for (var j = 0; j < secs.length; j++) { var s = document.getElementById(secs[j]); if (s) s.classList.add('hidden'); }
    
    if (section === 'info') { var s = document.getElementById('profile-info-section'); if (s) s.classList.remove('hidden'); }
    if (section === 'posts') { var s = document.getElementById('profile-posts-section'); if (s) { s.classList.remove('hidden'); renderMyPosts(); } }
    if (section === 'edit') {
        var u = document.getElementById('edit-username'); if (u) u.value = currentUser;
        var n = document.getElementById('edit-fullname'); if (n) n.value = 'Pengguna Yaping';
        var b = document.getElementById('edit-bio'); if (b) b.value = '';
        var s = document.getElementById('profile-edit-section'); if (s) s.classList.remove('hidden');
        
        // Add photo upload row if not exists
        if (!document.getElementById('profilePhotoUploadRow')) {
            var photoRow = document.createElement('div');
            photoRow.id = 'profilePhotoUploadRow';
            photoRow.className = 'form-row';
            photoRow.innerHTML = 
                '<label>Foto Profil</label>' +
                '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
                    '<button class="secondary-btn" type="button" onclick="triggerProfilePhotoUpload()" style="font-size:11px;">📷 Pilih Foto</button>' +
                    '<button class="danger-btn" type="button" onclick="removeProfilePhoto()" style="font-size:11px;">Hapus</button>' +
                '</div>' +
                '<small style="color:var(--fb-text-light);">PNG, JPEG, GIF • Maksimal 2MB</small>';
            
            var editSection = document.getElementById('profile-edit-section');
            if (editSection) {
                var bioRow = document.getElementById('edit-bio');
                if (bioRow && bioRow.parentNode && bioRow.parentNode.parentNode) {
                    bioRow.parentNode.parentNode.insertBefore(photoRow, bioRow.parentNode.nextSibling);
                }
            }
        }
    }
}

function saveProfile() {
    var u = document.getElementById('edit-username');
    var n = document.getElementById('edit-fullname');
    var newU = u ? (u.value.trim() || currentUser) : currentUser;
    var newN = n ? (n.value.trim() || 'Pengguna Yaping') : 'Pengguna Yaping';
    
    currentUser = newU;
    var keys = ['sidebar-username', 'profile-username-display', 'pi-username'];
    for (var i = 0; i < keys.length; i++) { var el = document.getElementById(keys[i]); if (el) el.textContent = currentUser; }
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
        renderFeed();
    }
}
function resetAllData() {
    if (confirm('Reset SEMUA data?')) { localStorage.clear(); location.reload(); }
}

// ===== NOTIFICATIONS =====
function showNotifications() { var d = document.getElementById('notif-dropdown'); if (d) d.classList.toggle('hidden'); }
function addNotification(text) {
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

// ===== UTILS =====
function addEmoji(target) { emojiTargetInput = target || 'postInput'; var p = document.getElementById('emoji-picker'); if (p) p.classList.toggle('hidden'); }
function insertEmoji(emoji) { var input = document.getElementById(emojiTargetInput); if (input) { input.value += emoji; input.focus(); } var p = document.getElementById('emoji-picker'); if (p) p.classList.add('hidden'); }
function doSearch() { var input = document.getElementById('searchInput'); var q = input ? input.value.trim() : ''; if (q) showToast('Mencari: ' + q); }
function showToast(msg) { var t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.remove('hidden'); setTimeout(function() { t.classList.add('hidden'); }, 3000); }
function saveCommunities() { localStorage.setItem('yaping_communities', JSON.stringify(communities)); }
function saveCommunityPosts() { localStorage.setItem('yaping_communityPosts', JSON.stringify(communityPosts)); }
function saveJoinedCommunities() { localStorage.setItem('yaping_joinedCommunities', JSON.stringify(joinedCommunities)); }
function formatTimeAgo(ts) { var diff = Date.now() - ts; var m = Math.floor(diff/60000); var h = Math.floor(diff/3600000); var d = Math.floor(diff/86400000); if (m<1) return 'Baru saja'; if (m<60) return m+'m lalu'; if (h<24) return h+'j lalu'; return d+'h lalu'; }
function escapeHtml(text) { if (!text) return ''; var div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function getCommunityById(id) { for (var i=0; i<communities.length; i++) if (communities[i].id === id) return communities[i]; return null; }
function closeModal() { var m = document.getElementById('modal-overlay'); if (m) m.classList.add('hidden'); }
function showModal(title, content) { var t = document.getElementById('modal-title'); var b = document.getElementById('modal-body'); var o = document.getElementById('modal-overlay'); if (t) t.textContent = title; if (b) b.innerHTML = content; if (o) o.classList.remove('hidden'); }

// ===== START =====
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); } else { initApp(); }
