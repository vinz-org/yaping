/* ============================================
   YAPING - script.js (Full Features)
   + Upload Foto/Video Post
   + Hapus Post
   + Upload Foto Profil (PNG/JPEG/GIF)
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
var profilePhoto = localStorage.getItem('yaping_profilePhoto_' + currentUser) || null;
var MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB limit for localStorage
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
        
        // Load profile photo
        profilePhoto = localStorage.getItem('yaping_profilePhoto_' + currentUser);
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
    
    // Profile photo upload listener
    var profilePhotoInput = document.getElementById('profilePhotoInput');
    if (profilePhotoInput) {
        profilePhotoInput.addEventListener('change', handleProfilePhotoUpload);
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

// ===== FILE UPLOAD UTILS =====
function readFileAsBase64(file, callback) {
    var reader = new FileReader();
    reader.onload = function(e) { callback(e.target.result); };
    reader.onerror = function() { showToast('Error membaca file'); };
    reader.readAsDataURL(file);
}

function validateFile(file, isProfile) {
    if (!file) return { valid: false, error: 'Pilih file dulu' };
    
    if (isProfile) {
        // Profile photo: only images
        if (ALLOWED_IMAGE_TYPES.indexOf(file.type) === -1) {
            return { valid: false, error: 'Format harus PNG, JPEG, atau GIF' };
        }
    } else {
        // Post media: images or videos
        if (ALLOWED_IMAGE_TYPES.indexOf(file.type) === -1 && ALLOWED_VIDEO_TYPES.indexOf(file.type) === -1) {
            return { valid: false, error: 'Format harus PNG, JPEG, GIF, MP4, atau WebM' };
        }
    }
    
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: 'Ukuran maksimal 2MB' };
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
    img.src = base64;
}

// ===== PROFILE PHOTO UPLOAD =====
function handleProfilePhotoUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    
    var validation = validateFile(file, true);
    if (!validation.valid) {
        showToast(validation.error);
        e.target.value = '';
        return;
    }
    
    showToast('Memproses foto...');
    
    readFileAsBase64(file, function(base64) {
        // Compress if needed
        if (file.type !== 'image/gif') {
            compressImage(base64, 400, function(compressed) {
                saveProfilePhoto(compressed);
            });
        } else {
            // GIF: keep original but check size
            if (base64.length > 3000000) {
                showToast('GIF terlalu besar, coba yang lebih kecil');
                e.target.value = '';
                return;
            }
            saveProfilePhoto(base64);
        }
    });
}

function saveProfilePhoto(base64) {
    try {
        localStorage.setItem('yaping_profilePhoto_' + currentUser, base64);
        profilePhoto = base64;
        updateProfilePhotoDisplay();
        showToast('✅ Foto profil diperbarui!');
    } catch(e) {
        showToast('❌ Gagal simpan: penyimpanan penuh');
        console.log('Storage error:', e);
    }
}

function updateProfilePhotoDisplay() {
    var avatarBig = document.querySelector('.profile-avatar-big');
    var avatarSidebar = document.querySelector('.sidebar-profile-pic');
    var avatarPost = document.querySelectorAll('.post-avatar');
    
    var imgHtml = profilePhoto 
        ? '<img src="' + profilePhoto + '" style="width:100%;height:100%;object-fit:cover;border-radius:3px;">'
        : '👤';
    
    if (avatarBig) avatarBig.innerHTML = imgHtml;
    if (avatarSidebar) avatarSidebar.innerHTML = imgHtml;
    
    // Update post avatars (for current user posts)
    for (var i = 0; i < avatarPost.length; i++) {
        var post = avatarPost[i].closest('.post-card') || avatarPost[i].closest('.post-item');
        if (post && post.innerHTML.indexOf(currentUser) !== -1) {
            avatarPost[i].innerHTML = imgHtml;
        }
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

// ===== POST: FILE UPLOAD =====
function triggerPostFileInput(target) {
    var inputId = 'postFileInput_' + (target === 'community' ? currentViewedCommunity : 'home');
    var existing = document.getElementById(inputId);
    if (existing) existing.remove();
    
    var input = document.createElement('input');
    input.type = 'file';
    input.id = inputId;
    input.accept = 'image/png,image/jpeg,image/gif,video/mp4,video/webm';
    input.style.display = 'none';
    
    input.onchange = function(e) {
        handlePostFileUpload(e, target);
    };
    
    document.body.appendChild(input);
    input.click();
}

function handlePostFileUpload(e, target) {
    var file = e.target.files[0];
    if (!file) return;
    
    var validation = validateFile(file, false);
    if (!validation.valid) {
        showToast(validation.error);
        e.target.value = '';
        return;
    }
    
    var inputId = target === 'community' ? 'communityPostInput' : 'postInput';
    var previewId = 'filePreview_' + (target === 'community' ? currentViewedCommunity : 'home');
    
    showToast('Memproses file...');
    
    readFileAsBase64(file, function(base64) {
        // Show preview
        var previewEl = document.getElementById(previewId);
        if (!previewEl) {
            previewEl = document.createElement('div');
            previewEl.id = previewId;
            previewEl.className = 'file-preview';
            previewEl.style.cssText = 'margin:8px 0;padding:8px;background:var(--fb-blue-lighter);border-radius:3px;font-size:11px;';
            
            var input = target === 'community' ? document.getElementById('communityPostInput') : document.getElementById('postInput');
            if (input && input.parentNode) {
                input.parentNode.insertBefore(previewEl, input.nextSibling);
            }
        }
        
        var isVideo = ALLOWED_VIDEO_TYPES.indexOf(file.type) !== -1;
        var fileName = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
        
        previewEl.innerHTML = (isVideo ? '🎬 ' : '🖼️ ') + fileName + 
            ' <button class="option-btn" style="padding:2px 6px;font-size:10px;margin-left:8px;" onclick="removePostFilePreview(\'' + previewId + '\')">✕ Hapus</button>';
        
        // Store reference
        previewEl.dataset.base64 = base64;
        previewEl.dataset.type = file.type;
    });
    
    e.target.value = '';
}

function removePostFilePreview(previewId) {
    var el = document.getElementById(previewId);
    if (el) el.remove();
}

function getPostFileData(previewId) {
    var el = document.getElementById(previewId);
    if (!el) return null;
    return {
        base64: el.dataset.base64,
        type: el.dataset.type
    };
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
            '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
                '<button class="option-btn" onclick="addEmoji(\'communityPostInput\')" style="font-size:11px;">😊 Emoji</button>' +
                '<button class="option-btn" onclick="triggerPostFileInput(\'community\')" style="font-size:11px;">📷 Foto/Video</button>' +
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
    var fileData = getPostFileData('filePreview_' + commId);
    
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
        createdAt: Date.now()
    };
    
    if (!communityPosts[commId]) communityPosts[commId] = [];
    communityPosts[commId].unshift(newPost);
    
    saveCommunityPosts();
    
    if (input) input.value = '';
    removePostFilePreview('filePreview_' + commId);
    
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
        var isOwner = p.author === currentUser;
        
        var mediaHtml = '';
        if (p.media && p.media.base64) {
            if (p.media.type.indexOf('video') !== -1) {
                mediaHtml = '<div style="margin:8px 0;"><video src="' + p.media.base64 + '" controls style="max-width:100%;border-radius:3px;"></video></div>';
            } else {
                mediaHtml = '<div style="margin:8px 0;"><img src="' + p.media.base64 + '" style="max-width:100%;border-radius:3px;cursor:pointer;" onclick="viewMediaFull(\'' + p.media.base64 + '\')"></div>';
            }
        }
        
        var deleteBtn = isOwner 
            ? '<button class="post-delete-btn" onclick="deletePost(' + commId + ',' + p.id + ',true)" style="margin-left:auto;">🗑️ Hapus</button>'
            : '';
        
        html += '<div class="post-card" style="margin-bottom:8px;">' +
            '<div class="post-card-header">' +
                '<span class="post-username">' + escapeHtml(p.author) + '</span>' +
                '<span class="post-timestamp">' + timeAgo + '</span>' +
            '</div>' +
            '<div class="post-body">' + escapeHtml(p.content) + '</div>' +
            mediaHtml +
            '<div class="post-footer">' +
                '<div class="post-actions-left">' +
                    '<button class="like-btn' + (isLiked ? ' liked' : '') + '" onclick="likeCommunityPost(' + commId + ',' + p.id + ')">' + 
                        (isLiked ? '❤️' : '🤍') + ' ' + p.likes + '</button>' +
                    '<button class="comment-btn" onclick="showToast(\'Fitur komentar segera hadir!\')">Komentar</button>' +
                '</div>' +
                '<button class="share-btn" onclick="showToast(\'Link disalin!\')">Bagikan</button>' +
                deleteBtn +
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
    var fileData = getPostFileData('filePreview_home');
    
    if (!text && !fileData) { showToast('Tulis sesuatu atau upload media!'); return; }
    
    var newPost = {
        id: Date.now(),
        author: currentUser,
        content: text,
        media: fileData ? { base64: fileData.base64, type: fileData.type } : null,
        likes: 0,
        likedBy: [],
        createdAt: Date.now()
    };
    
    // Simpan ke localStorage (bisa dikembangkan)
    showToast('Postingan dibagikan!');
    if (input) input.value = '';
    removePostFilePreview('filePreview_home');
    
    renderFeed();
}

function renderFeed() {
    var feed = document.getElementById('feed');
    if (!feed) return;
    
    // Placeholder + demo post with media
    if (!feed.innerHTML.trim() || feed.innerHTML.indexOf('Selamat datang') !== -1) {
        feed.innerHTML = 
            '<div class="post-card">' +
                '<div class="post-card-header"><span class="post-username">@user</span><span class="post-timestamp">Baru saja</span></div>' +
                '<div class="post-body">Selamat datang di Yaping! 👋 Mulai bagikan pikiranmu, upload foto/video, atau gabung komunitas menarik.</div>' +
                '<div class="post-footer">' +
                    '<div class="post-actions-left">' +
                        '<button class="like-btn" onclick="showToast(\'Terima kasih!\')">🤍 0</button>' +
                        '<button class="comment-btn" onclick="showToast(\'Komentar...\')">Komentar</button>' +
                    '</div>' +
                    '<button class="share-btn" onclick="showToast(\'Dibagikan!\')">Bagikan</button>' +
                    '<button class="post-delete-btn" onclick="deletePost(null,1,false)">🗑️ Hapus</button>' +
                '</div>' +
            '</div>' +
            '<div class="post-card">' +
                '<div class="post-card-header"><span class="post-username">@admin</span><span class="post-timestamp">2j lalu</span></div>' +
                '<div class="post-body">Coba fitur upload foto baru! 📷✨</div>' +
                '<div style="margin:8px 0;"><img src="https://via.placeholder.com/400x300/e8edf5/3b5998?text=Demo+Foto" style="max-width:100%;border-radius:3px;"></div>' +
                '<div class="post-footer">' +
                    '<div class="post-actions-left">' +
                        '<button class="like-btn" onclick="this.classList.toggle(\'liked\');this.textContent=(this.classList.contains(\'liked\')?\'❤️\':\'🤍\')+\' 1\'">🤍 1</button>' +
                        '<button class="comment-btn">Komentar</button>' +
                    '</div>' +
                    '<button class="share-btn">Bagikan</button>' +
                '</div>' +
            '</div>';
    }
}

// ===== DELETE POST =====
function deletePost(commId, postId, isCommunity) {
    if (!confirm('Hapus postingan ini? Tindakan ini tidak bisa dibatalkan.')) return;
    
    if (isCommunity) {
        var posts = communityPosts[commId];
        if (!posts) return;
        
        var idx = -1;
        for (var i = 0; i < posts.length; i++) {
            if (posts[i].id === postId) { idx = i; break; }
        }
        if (idx === -1) return;
        
        posts.splice(idx, 1);
        saveCommunityPosts();
        
        if (currentViewedCommunity === commId) {
            var feedEl = document.getElementById('comm-posts-feed');
            if (feedEl) feedEl.innerHTML = renderCommunityPosts(commId);
        }
        showToast('Postingan dihapus');
    } else {
        // Home feed delete (demo)
        showToast('Postingan dihapus');
        renderFeed();
    }
}

// ===== VIEW MEDIA FULLSCREEN =====
function viewMediaFull(base64) {
    var isVideo = base64.indexOf('video') !== -1;
    var content = isVideo 
        ? '<video src="' + base64 + '" controls style="max-width:100%;max-height:70vh;"></video>'
        : '<img src="' + base64 + '" style="max-width:100%;max-height:70vh;">';
    
    showModal('Lihat Media', content);
}

// ===== PROFILE =====
function renderMyPosts() {
    var feed = document.getElementById('my-posts-feed');
    if (!feed) return;
    
    // Collect user's community posts
    var myPosts = [];
    for (var commId in communityPosts) {
        var posts = communityPosts[commId];
        for (var i = 0; i < posts.length; i++) {
            if (posts[i].author === currentUser) {
                myPosts.push(posts[i]);
            }
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
        
        // Show profile photo upload option
        var editSection = document.getElementById('profile-edit-section');
        if (editSection && !document.getElementById('profilePhotoUploadRow')) {
            var photoRow = document.createElement('div');
            photoRow.id = 'profilePhotoUploadRow';
            photoRow.className = 'form-row';
            photoRow.innerHTML = 
                '<label>Foto Profil</label>' +
                '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
                    '<input type="file" id="profilePhotoInput" accept="image/png,image/jpeg,image/gif" style="flex:1;min-width:200px;">' +
                    '<button class="secondary-btn" type="button" onclick="removeProfilePhoto()" style="font-size:11px;">Hapus Foto</button>' +
                '</div>' +
                '<small style="color:var(--fb-text-light);">PNG, JPEG, GIF • Maksimal 2MB</small>';
            
            var bioRow = document.getElementById('edit-bio');
            if (bioRow && bioRow.parentNode) {
                bioRow.parentNode.parentNode.insertBefore(photoRow, bioRow.parentNode.nextSibling);
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
        renderFeed();
    }
}

function resetAllData() {
    if (confirm('Reset SEMUA data? Ini akan menghapus komunitas, postingan, dan pengaturan!')) {
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
