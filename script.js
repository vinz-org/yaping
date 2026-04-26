/* ============================================
   YAPING - script.js (Supabase Version)
   ✓ Cloud persistence via Supabase
   ✓ Profile/Post media upload to Storage
   ✓ Comments + Stats + Real-time ready
   Compatible with Facebook 2008 Style CSS
   ============================================ */

// ===== SUPABASE CONFIG =====
// ⚠️ GANTI DENGAN KEY KAMU DARI SUPABASE DASHBOARD
const SUPABASE_URL = 'https://lzxjjiebpnhjeifnnqms.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6eGpqaWVicG5oamVpZm5ucW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzYxMjYsImV4cCI6MjA5Mjc1MjEyNn0.Tro63bLrHih8EJ4cVBt4SDy2lhVE4P3LQ4T81TFGKRI';

// Init Supabase client
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== GLOBAL STATE =====
let currentUser = null; // Will be set after auth
let communities = [];
let currentViewedCommunity = null;
let emojiTargetInput = 'postInput';

// File config
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

// ===== AUTH & INIT =====
async function initApp() {
    // Check auth session
    const { data: { session } } = await db.auth.getSession();
    
    if (session?.user) {
        currentUser = session.user;
        await loadUserProfile();
        await loadCommunities();
        renderCommunities('all');
        renderFeed();
        updateProfileStats();
        updateProfilePhotoDisplay();
        setupRealtimeListeners();
    } else {
        // Auto-signup demo user for testing
        await demoSignUp();
    }
    
    setupEventListeners();
    
    // Dark mode from localStorage (UI preference only)
    if (localStorage.getItem('yaping_darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        var toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = true;
    }
}

async function demoSignUp() {
    // Demo: auto-create user for testing (remove in production)
    const randomId = Math.random().toString(36).substr(2, 9);
    const { data, error } = await db.auth.signUp({
        email: `demo_${randomId}@yaping.test`,
        password: 'demo123456',
        options: {
            data: { username: '@user', fullname: 'Pengguna Yaping' }
        }
    });
    
    if (error) {
        console.log('Demo signup error:', error);
        // Fallback to anonymous mode
        currentUser = { id: 'demo-user', user_metadata: { username: '@user', fullname: 'Pengguna Yaping' } };
        await loadCommunities();
        renderCommunities('all');
        return;
    }
    
    currentUser = data.user;
    
    // Create profile if not exists
    const { error: profileError } = await db.from('profiles').upsert({
        id: currentUser.id,
        username: '@user',
        fullname: 'Pengguna Yaping',
        avatar_url: null
    }, { onConflict: 'id' });
    
    if (profileError) console.log('Profile create error:', profileError);
    
    await loadCommunities();
    renderCommunities('all');
    showToast('✅ Akun demo dibuat!');
}

async function loadUserProfile() {
    if (!currentUser) return;
    
    const { data, error } = await db
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    
    if (error) {
        console.log('Load profile error:', error);
        return;
    }
    
    // Update UI with profile data
    if (data.avatar_url) {
        document.documentElement.style.setProperty('--user-avatar', `url(${data.avatar_url})`);
    }
}

async function loadCommunities() {
    const { data, error } = await db
        .from('communities')
        .select(`
            *,
            owner:profiles!communities_owner_id_fkey(username),
            member_count,
            stats
        `)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.log('Load communities error:', error);
        communities = [];
        return;
    }
    
    communities = data || [];
}

function setupEventListeners() {
    // Search
    var searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') doSearch();
        });
    }
    
    // Emoji picker close
    document.addEventListener('click', function(e) {
        var picker = document.getElementById('emoji-picker');
        if (picker && !picker.contains(e.target)) {
            var isBtn = false, el = e.target;
            while (el) {
                var onclick = el.getAttribute ? el.getAttribute('onclick') : '';
                if (onclick && onclick.indexOf('addEmoji') !== -1) { isBtn = true; break; }
                el = el.parentNode;
            }
            if (!isBtn) picker.classList.add('hidden');
        }
    });
    
    // Auth state change listener
    db.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            await loadUserProfile();
            await loadCommunities();
            renderCommunities('all');
            showToast('✅ Login berhasil!');
        }
        if (event === 'SIGNED_OUT') {
            currentUser = null;
            communities = [];
            renderCommunities('all');
            showToast('👋 Logout berhasil');
        }
    });
    
    // Init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
}

// ===== REALTIME LISTENERS (Optional) =====
function setupRealtimeListeners() {
    // Listen for new posts in viewed community
    if (currentViewedCommunity) {
        db.channel('posts_' + currentViewedCommunity)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'posts',
                filter: `community_id=eq.${currentViewedCommunity}`
            }, payload => {
                // Reload posts when new post arrives
                if (document.getElementById('comm-posts-feed')) {
                    renderCommunityPosts(currentViewedCommunity);
                }
            })
            .subscribe();
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
    
    if (tabName === 'komunitas') { loadCommunities().then(() => renderCommunities('all')); }
    else if (tabName === 'profile') { updateProfileStats(); updateProfilePhotoDisplay(); renderMyPosts(); }
    else if (tabName === 'home') renderFeed();
    
    var nd = document.getElementById('notif-dropdown');
    if (nd) nd.classList.add('hidden');
    
    if (tabName !== 'community-detail') {
        currentViewedCommunity = null;
        // Unsubscribe realtime channels if needed
    }
    
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
        if (ALLOWED_IMAGE_TYPES.indexOf(file.type) === -1) return { valid: false, error: 'Format: PNG, JPEG, atau GIF' };
    } else {
        if (ALLOWED_IMAGE_TYPES.indexOf(file.type) === -1 && ALLOWED_VIDEO_TYPES.indexOf(file.type) === -1) 
            return { valid: false, error: 'Format: PNG, JPEG, GIF, MP4, atau WebM' };
    }
    if (file.size > MAX_FILE_SIZE) return { valid: false, error: 'Maksimal 2MB' };
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

async function uploadToStorage(bucket, path, file) {
    const { data, error } = await db.storage
        .from(bucket)
        .upload(path, file, { upsert: true });
    
    if (error) throw error;
    
    const { data: { publicUrl } } = db.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
}

// ===== PROFILE PHOTO =====
function updateProfilePhotoDisplay() {
    var selectors = ['.profile-avatar-big', '.sidebar-profile-pic'];
    for (var s = 0; s < selectors.length; s++) {
        var el = document.querySelector(selectors[s]);
        if (el) {
            // Will be updated when profile loads
        }
    }
}

async function triggerProfilePhotoUpload() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif';
    input.style.display = 'none';
    
    input.onchange = async function(e) {
        var file = e.target.files[0];
        if (!file || !currentUser) return;
        
        var validation = validateFile(file, true);
        if (!validation.valid) { showToast(validation.error); return; }
        
        showToast('Uploading...');
        
        try {
            // Compress if not GIF
            var base64 = await new Promise(resolve => readFileAsBase64(file, resolve));
            if (file.type !== 'image/gif') {
                base64 = await new Promise(resolve => compressImage(base64, 400, resolve));
                // Convert base64 back to blob for upload
                var response = await fetch(base64);
                var blob = await response.blob();
                file = new File([blob], file.name, { type: 'image/jpeg' });
            }
            
            // Upload to Supabase Storage
            const path = `${currentUser.id}/avatar_${Date.now()}.${file.type.split('/')[1]}`;
            const publicUrl = await uploadToStorage('avatars', path, file);
            
            // Update profile
            const { error } = await db
                .from('profiles')
                .update({ avatar_url: publicUrl, updated_at: new Date() })
                .eq('id', currentUser.id);
            
            if (error) throw error;
            
            // Update UI
            document.documentElement.style.setProperty('--user-avatar', `url(${publicUrl})`);
            updateProfilePhotoDisplay();
            showToast('✅ Foto profil diperbarui!');
            
        } catch(err) {
            console.log('Upload error:', err);
            showToast('❌ Upload gagal: ' + err.message);
        }
    };
    
    document.body.appendChild(input);
    input.click();
    setTimeout(function() { input.remove(); }, 1000);
}

async function removeProfilePhoto() {
    if (!currentUser || !confirm('Hapus foto profil?')) return;
    
    try {
        // Delete from storage (optional)
        // await db.storage.from('avatars').remove([`${currentUser.id}/avatar_*`]);
        
        // Update profile
        const { error } = await db
            .from('profiles')
            .update({ avatar_url: null, updated_at: new Date() })
            .eq('id', currentUser.id);
        
        if (error) throw error;
        
        document.documentElement.style.removeProperty('--user-avatar');
        updateProfilePhotoDisplay();
        showToast('Foto profil dihapus');
    } catch(err) {
        showToast('❌ Gagal: ' + err.message);
    }
}

// ===== POST MEDIA UPLOAD =====
async function triggerPostFileUpload(target) {
    if (!currentUser) { showToast('Login dulu!'); return; }
    
    var commId = target === 'community' ? currentViewedCommunity : null;
    var previewId = 'filePreview_' + (commId || 'home');
    
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,video/mp4,video/webm';
    input.style.display = 'none';
    
    input.onchange = async function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        var validation = validateFile(file, false);
        if (!validation.valid) { showToast(validation.error); return; }
        
        showToast('Uploading...');
        
        try {
            const ext = file.type.split('/')[1];
            const path = `${currentUser.id}/post_${Date.now()}.${ext}`;
            const publicUrl = await uploadToStorage('posts', path, file);
            
            // Show preview
            var previewEl = document.getElementById(previewId);
            if (!previewEl) {
                previewEl = document.createElement('div');
                previewEl.id = previewId;
                previewEl.className = 'file-preview';
                previewEl.style.cssText = 'margin:8px 0;padding:8px;background:var(--fb-blue-lighter);border-radius:3px;font-size:11px;display:flex;align-items:center;gap:8px;';
                var textareaId = target === 'community' ? 'communityPostInput' : 'postInput';
                var textarea = document.getElementById(textareaId);
                if (textarea && textarea.parentNode) textarea.parentNode.insertBefore(previewEl, textarea.nextSibling);
            }
            
            var isVideo = ALLOWED_VIDEO_TYPES.indexOf(file.type) !== -1;
            var fname = file.name.length > 25 ? file.name.substring(0, 22) + '...' : file.name;
            previewEl.innerHTML = (isVideo ? '🎬' : '🖼️') + ' ' + fname + 
                ' <button class="option-btn" style="padding:2px 6px;font-size:10px;" onclick="removeFilePreview(\'' + previewId + '\')">✕</button>';
            previewEl.dataset.url = publicUrl;
            previewEl.dataset.type = file.type;
            
        } catch(err) {
            console.log('Upload error:', err);
            showToast('❌ Upload gagal: ' + err.message);
        }
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
    if (!el || !el.dataset.url) return null;
    return { url: el.dataset.url, type: el.dataset.type };
}

// ===== COMMUNITIES =====
function renderCommunities(filter) {
    if (!filter) filter = 'all';
    var list = document.getElementById('communityList');
    if (!list) return;
    
    if (communities.length === 0) {
        list.innerHTML = '<li class="sidebar-empty">Memuat komunitas...</li>';
        return;
    }
    
    var filtered = filter === 'mine' 
        ? communities.filter(c => c.owner?.username === '@user' || c.owner_id === currentUser?.id)
        : communities;
    
    if (filtered.length === 0) {
        list.innerHTML = '<li class="sidebar-empty">Belum ada komunitas</li>';
        return;
    }
    
    var html = '';
    for (var k = 0; k < filtered.length; k++) {
        var c = filtered[k];
        var isMember = true; // Will be checked via DB in real app
        var badge = isMember ? ' <span style="color:var(--fb-green)">[Anggota]</span>' : '';
        var btn = isMember 
            ? '<button class="primary-btn" onclick="viewCommunity(\'' + c.id + '\')">Lihat</button>'
            : '<button class="primary-btn" onclick="joinCommunity(\'' + c.id + '\')">Gabung</button>';
        
        html += '<li class="comm-list-item">' +
            '<div class="comm-icon">' + (c.category || '🎮') + '</div>' +
            '<div class="comm-info">' +
                '<div class="comm-name" onclick="viewCommunity(\'' + c.id + '\')">' + escapeHtml(c.name) + badge + '</div>' +
                '<div class="comm-meta">' + escapeHtml(c.description || '') + ' | ' + (c.member_count || 0) + ' anggota</div>' +
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

async function addCommunity() {
    if (!currentUser) { showToast('Login dulu!'); return; }
    
    var nameInput = document.getElementById('newCommunityInput');
    var descInput = document.getElementById('newCommunityDesc');
    var catInput = document.getElementById('newCommunityCategory');
    var cooldownInfo = document.getElementById('cooldown-info');
    
    var name = nameInput ? nameInput.value.trim() : '';
    var desc = descInput ? descInput.value.trim() : '';
    var category = catInput ? catInput.value : '🎮';
    
    if (!name) { showToast('Nama komunitas wajib diisi!'); if (nameInput) nameInput.focus(); return; }
    
    try {
        const { data, error } = await db.from('communities').insert({
            name: name,
            description: desc || 'Tidak ada deskripsi',
            category: category,
            owner_id: currentUser.id,
            member_count: 1,
            stats: { totalPosts: 0, totalLikes: 0, totalComments: 0 }
        }).select().single();
        
        if (error) throw error;
        
        communities.unshift(data);
        renderCommunities('all');
        
        if (nameInput) nameInput.value = '';
        if (descInput) descInput.value = '';
        if (cooldownInfo) cooldownInfo.textContent = 'Komunitas dibuat!';
        
        showToast('✅ Komunitas "' + name + '" berhasil dibuat!');
        setTimeout(function() { if (cooldownInfo && cooldownInfo.textContent.indexOf('Komunitas') !== -1) cooldownInfo.textContent = ''; }, 3000);
        
    } catch(err) {
        console.log('Create community error:', err);
        showToast('❌ Gagal: ' + err.message);
    }
}

async function joinCommunity(commId) {
    if (!currentUser) { showToast('Login dulu!'); return; }
    
    try {
        // Check if already member
        const { data: existing } = await db
            .from('community_members')
            .select('id')
            .eq('community_id', commId)
            .eq('user_id', currentUser.id)
            .maybeSingle();
        
        if (existing) { showToast('Kamu sudah anggota!'); return; }
        
        // Add member
        const { error: memberError } = await db.from('community_members').insert({
            community_id: commId,
            user_id: currentUser.id
        });
        if (memberError) throw memberError;
        
        // Update member count
        const { error: updateError } = await db
            .from('communities')
            .update({ member_count: db.raw('member_count + 1') })
            .eq('id', commId);
        if (updateError) throw updateError;
        
        // Refresh local data
        await loadCommunities();
        renderCommunities('all');
        
        if (currentViewedCommunity === commId) viewCommunity(commId);
        
        showToast('✅ Selamat bergabung!');
        
    } catch(err) {
        console.log('Join error:', err);
        showToast('❌ Gagal: ' + err.message);
    }
}

async function viewCommunity(commId) {
    currentViewedCommunity = commId;
    
    var tabs = document.querySelectorAll('.tab-content');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.add('hidden');
    
    var detailTab = document.getElementById('community-detail-tab');
    if (!detailTab) return;
    detailTab.classList.remove('hidden');
    
    // Fetch community details
    const { data: comm, error } = await db
        .from('communities')
        .select(`
            *,
            owner:profiles!communities_owner_id_fkey(username),
            stats
        `)
        .eq('id', commId)
        .single();
    
    if (error || !comm) { showToast('Komunitas tidak ditemukan'); return; }
    
    // Check membership
    const { data: membership } = await db
        .from('community_members')
        .select('id')
        .eq('community_id', commId)
        .eq('user_id', currentUser?.id)
        .maybeSingle();
    
    var isMember = !!membership;
    
    // Stats display
    var stats = comm.stats || { totalPosts: 0, totalLikes: 0, totalComments: 0 };
    var statsHtml = '<div style="display:flex;gap:12px;font-size:11px;color:var(--fb-text-light);margin:8px 0;">' +
        '<span>📊 ' + (stats.totalPosts || 0) + ' postingan</span>' +
        '<span>❤️ ' + (stats.totalLikes || 0) + ' like</span>' +
        '<span>💬 ' + (stats.totalComments || 0) + ' komentar</span>' +
    '</div>';
    
    var postBox = '';
    if (isMember && currentUser) {
        postBox = '<div class="content-box">' +
            '<div class="box-title">Buat Postingan</div>' +
            '<textarea id="communityPostInput" class="comm-post-input" placeholder="Tulis untuk ' + escapeHtml(comm.name) + '..."></textarea>' +
            '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0;">' +
                '<button class="option-btn" onclick="addEmoji(\'communityPostInput\')" style="font-size:11px;">😊 Emoji</button>' +
                '<button class="option-btn" onclick="triggerPostFileUpload(\'community\')" style="font-size:11px;">📷 Foto/Video</button>' +
                '<button class="primary-btn" onclick="submitCommunityPost(\'' + commId + '\')">Bagikan</button>' +
            '</div>' +
            '<div id="filePreview_' + commId + '"></div>' +
        '</div>';
    } else {
        postBox = '<div class="content-box" style="text-align:center;padding:20px;">' +
            '<div style="font-size:36px;margin-bottom:10px;">🔒</div>' +
            '<p style="margin-bottom:12px;font-size:12px;">Gabung untuk bisa posting & berdiskusi</p>' +
            '<button class="primary-btn" onclick="joinCommunity(\'' + commId + '\')">Gabung Sekarang</button>' +
        '</div>';
    }
    
    var postsHTML = await renderCommunityPosts(commId);
    
    var memberText = isMember ? ' | <span style="color:var(--fb-green)">Anggota</span>' : '';
    var joinBtn = !isMember ? '<button class="follow-btn-big" onclick="joinCommunity(\'' + commId + '\')">Gabung</button>' : '';
    
    detailTab.innerHTML = 
        '<div class="content-box">' +
            '<a class="back-link" onclick="switchToTab(\'komunitas\');return false;">&larr; Kembali</a>' +
            '<div class="comm-detail-banner"></div>' +
            '<div class="comm-detail-header">' +
                '<div class="comm-detail-icon">' + (comm.category || '🎮') + '</div>' +
                '<div class="comm-detail-info">' +
                    '<div class="comm-detail-name">' + escapeHtml(comm.name) + '</div>' +
                    '<div style="font-size:12px;color:var(--fb-text-light);margin-bottom:4px;">' + escapeHtml(comm.description || '') + '</div>' +
                    '<div class="comm-detail-meta">' + (comm.member_count || 0) + ' anggota | Oleh ' + escapeHtml(comm.owner?.username || 'Unknown') + memberText + '</div>' +
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
    
    // Setup realtime for this community
    setupRealtimeListeners();
}

async function submitCommunityPost(commId) {
    if (!currentUser) { showToast('Login dulu!'); return; }
    
    var input = document.getElementById('communityPostInput');
    var text = input ? input.value.trim() : '';
    var fileData = getFileData('filePreview_' + commId);
    
    if (!text && !fileData) { showToast('Tulis sesuatu atau upload media!'); return; }
    
    try {
        const { data: post, error } = await db.from('posts').insert({
            community_id: commId,
            author_id: currentUser.id,
            content: text || null,
            media_url: fileData?.url || null,
            media_type: fileData?.type?.indexOf('video') !== -1 ? 'video' : (fileData?.url ? 'image' : null),
            likes_count: 0
        }).select().single();
        
        if (error) throw error;
        
        if (input) input.value = '';
        removeFilePreview('filePreview_' + commId);
        
        showToast('✅ Postingan dibagikan!');
        
        // Re-render posts
        const feedEl = document.getElementById('comm-posts-feed');
        if (feedEl) feedEl.innerHTML = await renderCommunityPosts(commId);
        
    } catch(err) {
        console.log('Post error:', err);
        showToast('❌ Gagal: ' + err.message);
    }
}

async function renderCommunityPosts(commId) {
    const { data: posts, error } = await db
        .from('posts')
        .select(`
            *,
            author:profiles!posts_author_id_fkey(username),
            comments:comments(
                *,
                author:profiles!comments_author_id_fkey(username)
            ),
            likes:likes(user_id)
        `)
        .eq('community_id', commId)
        .order('created_at', { ascending: false });
    
    if (error || !posts || posts.length === 0) {
        return '<div class="sidebar-empty">Belum ada diskusi. Jadilah yang pertama!</div>';
    }
    
    var html = '';
    for (var i = 0; i < posts.length; i++) {
        var p = posts[i];
        var timeAgo = formatTimeAgo(new Date(p.created_at).getTime());
        var isLiked = p.likes?.some(l => l.user_id === currentUser?.id) || false;
        var isOwner = p.author_id === currentUser?.id;
        
        // Media
        var mediaHtml = '';
        if (p.media_url) {
            if (p.media_type === 'video') {
                mediaHtml = '<div style="margin:8px 0;"><video src="' + p.media_url + '" controls style="max-width:100%;border-radius:3px;"></video></div>';
            } else {
                mediaHtml = '<div style="margin:8px 0;"><img src="' + p.media_url + '" style="max-width:100%;border-radius:3px;cursor:pointer;" onclick="viewMediaFull(\'' + p.media_url + '\')"></div>';
            }
        }
        
        // Comments
        var commentsHtml = '';
        if (p.comments && p.comments.length > 0) {
            commentsHtml = '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--fb-border);">';
            for (var c = 0; c < p.comments.length; c++) {
                var cm = p.comments[c];
                var canDelete = cm.author_id === currentUser?.id || isOwner;
                commentsHtml += '<div style="font-size:12px;margin:4px 0;padding:6px 8px;background:var(--fb-blue-bg);border-radius:3px;">' +
                    '<strong>' + escapeHtml(cm.author?.username || 'Unknown') + '</strong>: ' + escapeHtml(cm.content) + 
                    ' <span style="color:var(--fb-text-light);font-size:10px;">' + formatTimeAgo(new Date(cm.created_at).getTime()) + '</span>' +
                    (canDelete ? ' <button class="option-btn" style="padding:1px 4px;font-size:9px;" onclick="deleteComment(\'' + commId + '\',\'' + p.id + '\',\'' + cm.id + '\')">✕</button>' : '') +
                '</div>';
            }
            commentsHtml += '</div>';
        }
        
        // Comment input
        var commentInput = currentUser 
            ? '<div style="margin-top:8px;display:flex;gap:4px;">' +
                '<input type="text" id="commentInput_' + p.id + '" placeholder="Tulis komentar..." style="flex:1;padding:4px 8px;border:1px solid var(--fb-border);border-radius:3px;font-size:11px;">' +
                '<button class="option-btn" style="padding:4px 8px;font-size:11px;" onclick="submitComment(\'' + commId + '\',\'' + p.id + '\')">Kirim</button>' +
              '</div>'
            : '';
        
        var deleteBtn = isOwner ? '<button class="post-delete-btn" onclick="deletePost(\'' + commId + '\',\'' + p.id + '\',true)" style="margin-left:auto;">🗑️</button>' : '';
        
        html += '<div class="post-card" style="margin-bottom:8px;">' +
            '<div class="post-card-header">' +
                '<span class="post-username">' + escapeHtml(p.author?.username || 'Unknown') + '</span>' +
                '<span class="post-timestamp">' + timeAgo + '</span>' +
            '</div>' +
            '<div class="post-body">' + escapeHtml(p.content || '') + '</div>' +
            mediaHtml +
            '<div class="post-footer">' +
                '<div class="post-actions-left">' +
                    '<button class="like-btn' + (isLiked ? ' liked' : '') + '" onclick="likePost(\'' + commId + '\',\'' + p.id + '\')">' + (isLiked ? '❤️' : '🤍') + ' ' + (p.likes_count || 0) + '</button>' +
                    '<button class="comment-btn" onclick="toggleCommentInput(\'' + p.id + '\')">💬 ' + (p.comments?.length || 0) + '</button>' +
                '</div>' +
                '<button class="share-btn" onclick="showToast(\'Link disalin!\')">🔗</button>' +
                deleteBtn +
            '</div>' +
            '<div id="commentSection_' + p.id + '" class="comment-section" style="display:none;">' + commentInput + commentsHtml + '</div>' +
        '</div>';
    }
    return html;
}

// ===== COMMENTS =====
function toggleCommentInput(postId) {
    var section = document.getElementById('commentSection_' + postId);
    if (section) section.style.display = section.style.display === 'none' ? 'block' : 'none';
}

async function submitComment(commId, postId) {
    if (!currentUser) { showToast('Login dulu!'); return; }
    
    var input = document.getElementById('commentInput_' + postId);
    var text = input ? input.value.trim() : '';
    if (!text) { showToast('Tulis komentar dulu!'); return; }
    
    try {
        const { error } = await db.from('comments').insert({
            post_id: postId,
            author_id: currentUser.id,
            content: text
        });
        
        if (error) throw error;
        
        if (input) input.value = '';
        showToast('✅ Komentar dikirim!');
        
        // Re-render
        const feedEl = document.getElementById('comm-posts-feed');
        if (feedEl && currentViewedCommunity === commId) {
            feedEl.innerHTML = await renderCommunityPosts(commId);
            var section = document.getElementById('commentSection_' + postId);
            if (section) section.style.display = 'block';
        }
        
    } catch(err) {
        showToast('❌ Gagal: ' + err.message);
    }
}

async function deleteComment(commId, postId, commentId) {
    if (!confirm('Hapus komentar ini?')) return;
    
    try {
        const { error } = await db.from('comments').delete().eq('id', commentId);
        if (error) throw error;
        
        // Re-render
        const feedEl = document.getElementById('comm-posts-feed');
        if (feedEl && currentViewedCommunity === commId) {
            feedEl.innerHTML = await renderCommunityPosts(commId);
        }
        showToast('Komentar dihapus');
        
    } catch(err) {
        showToast('❌ Gagal: ' + err.message);
    }
}

// ===== LIKE SYSTEM =====
async function likePost(commId, postId) {
    if (!currentUser) { showToast('Login dulu!'); return; }
    
    try {
        // Check if already liked
        const { data: existing } = await db
            .from('likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', currentUser.id)
            .maybeSingle();
        
        if (existing) {
            // Unlike
            await db.from('likes').delete().eq('id', existing.id);
            await db.from('posts').update({ likes_count: db.raw('likes_count - 1') }).eq('id', postId);
        } else {
            // Like
            await db.from('likes').insert({ post_id: postId, user_id: currentUser.id });
            await db.from('posts').update({ likes_count: db.raw('likes_count + 1') }).eq('id', postId);
        }
        
        // Re-render if viewing this community
        if (currentViewedCommunity === commId) {
            const feedEl = document.getElementById('comm-posts-feed');
            if (feedEl) feedEl.innerHTML = await renderCommunityPosts(commId);
        }
        
    } catch(err) {
        showToast('❌ Gagal: ' + err.message);
    }
}

// ===== DELETE POST =====
async function deletePost(commId, postId, isCommunity) {
    if (!confirm('Hapus postingan ini?')) return;
    
    try {
        // Delete related data first (comments, likes)
        await db.from('comments').delete().eq('post_id', postId);
        await db.from('likes').delete().eq('post_id', postId);
        
        // Delete post
        const { error } = await db.from('posts').delete().eq('id', postId);
        if (error) throw error;
        
        showToast('✅ Postingan dihapus');
        
        if (isCommunity && currentViewedCommunity === commId) {
            const feedEl = document.getElementById('comm-posts-feed');
            if (feedEl) feedEl.innerHTML = await renderCommunityPosts(commId);
        } else {
            renderFeed();
        }
        
    } catch(err) {
        showToast('❌ Gagal: ' + err.message);
    }
}

// ===== MEDIA FULLSCREEN =====
function viewMediaFull(url) {
    var isVideo = url.indexOf('.mp4') !== -1 || url.indexOf('.webm') !== -1;
    var content = isVideo 
        ? '<video src="' + url + '" controls style="max-width:100%;max-height:70vh;"></video>'
        : '<img src="' + url + '" style="max-width:100%;max-height:70vh;">';
    showModal('Lihat Media', content);
}

// ===== HOME FEED =====
function renderFeed() {
    var feed = document.getElementById('feed');
    if (!feed) return;
    
    feed.innerHTML = 
        '<div class="post-card">' +
            '<div class="post-card-header"><span class="post-username">@user</span><span class="post-timestamp">Baru saja</span></div>' +
            '<div class="post-body">Selamat datang di Yaping! 👋 Data sekarang tersimpan di Supabase cloud!</div>' +
            '<div class="post-footer">' +
                '<div class="post-actions-left">' +
                    '<button class="like-btn" onclick="showToast(\'Terima kasih!\')">🤍 0</button>' +
                    '<button class="comment-btn" onclick="showToast(\'Komentar...\')">💬 0</button>' +
                '</div>' +
                '<button class="share-btn" onclick="showToast(\'Dibagikan!\')">🔗</button>' +
            '</div>' +
        '</div>';
}

// ===== PROFILE =====
async function renderMyPosts() {
    if (!currentUser) return;
    
    var feed = document.getElementById('my-posts-feed');
    if (!feed) return;
    
    const { data: posts, error } = await db
        .from('posts')
        .select(`
            *,
            author:profiles!posts_author_id_fkey(username),
            community:communities(name)
        `)
        .eq('author_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(20);
    
    if (error || !posts || posts.length === 0) {
        feed.innerHTML = '<div class="sidebar-empty">Kamu belum memiliki postingan. Yuk mulai berbagi!</div>';
        return;
    }
    
    var html = '';
    for (var j = 0; j < posts.length; j++) {
        var p = posts[j];
        var timeAgo = formatTimeAgo(new Date(p.created_at).getTime());
        
        var mediaHtml = '';
        if (p.media_url) {
            if (p.media_type === 'video') {
                mediaHtml = '<div style="margin:8px 0;"><video src="' + p.media_url + '" controls style="max-width:100%;border-radius:3px;"></video></div>';
            } else {
                mediaHtml = '<div style="margin:8px 0;"><img src="' + p.media_url + '" style="max-width:100%;border-radius:3px;"></div>';
            }
        }
        
        html += '<div class="post-card" style="margin-bottom:8px;">' +
            '<div class="post-card-header"><span class="post-username">' + escapeHtml(p.author?.username || 'Unknown') + '</span><span class="post-timestamp">' + timeAgo + '</span></div>' +
            '<div class="post-body">' + escapeHtml(p.content || '') + '</div>' +
            mediaHtml +
            '<div class="post-footer">' +
                '<button class="post-delete-btn" onclick="deletePost(\'' + p.community_id + '\',\'' + p.id + '\',true)">🗑️ Hapus</button>' +
            '</div>' +
        '</div>';
    }
    feed.innerHTML = html;
}

function updateProfileStats() {
    var els = {
        'pi-username': currentUser?.user_metadata?.username || '@user',
        'pi-fullname': currentUser?.user_metadata?.fullname || 'Pengguna Yaping',
        'sidebar-username': currentUser?.user_metadata?.username || '@user',
        'profile-username-display': currentUser?.user_metadata?.username || '@user'
    };
    for (var key in els) { var el = document.getElementById(key); if (el) el.textContent = els[key]; }
    
    // Placeholder stats - fetch from DB in production
    document.getElementById('pi-posts') && (document.getElementById('pi-posts').textContent = '0');
    document.getElementById('pi-likes') && (document.getElementById('pi-likes').textContent = '0');
    document.getElementById('pi-comms') && (document.getElementById('pi-comms').textContent = communities.filter(c => c.owner_id === currentUser?.id).length);
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
        var u = document.getElementById('edit-username'); if (u) u.value = currentUser?.user_metadata?.username || '@user';
        var n = document.getElementById('edit-fullname'); if (n) n.value = currentUser?.user_metadata?.fullname || 'Pengguna Yaping';
        var b = document.getElementById('edit-bio'); if (b) b.value = '';
        var s = document.getElementById('profile-edit-section'); if (s) s.classList.remove('hidden');
        
        // Add photo upload row
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

async function saveProfile() {
    if (!currentUser) return;
    
    var u = document.getElementById('edit-username');
    var n = document.getElementById('edit-fullname');
    var newUsername = u ? (u.value.trim() || currentUser.user_metadata.username) : currentUser.user_metadata.username;
    var newFullname = n ? (n.value.trim() || currentUser.user_metadata.fullname) : currentUser.user_metadata.fullname;
    
    try {
        const { error } = await db
            .from('profiles')
            .update({ 
                username: newUsername, 
                fullname: newFullname,
                updated_at: new Date()
            })
            .eq('id', currentUser.id);
        
        if (error) throw error;
        
        // Update local metadata
        currentUser.user_metadata.username = newUsername;
        currentUser.user_metadata.fullname = newFullname;
        
        // Update UI
        var keys = ['sidebar-username', 'profile-username-display', 'pi-username'];
        for (var i = 0; i < keys.length; i++) { var el = document.getElementById(keys[i]); if (el) el.textContent = newUsername; }
        var el = document.getElementById('pi-fullname'); if (el) el.textContent = newFullname;
        
        showToast('✅ Profil diperbarui!');
        showProfileSection('info', document.querySelector('.profile-tab-btn'));
        
    } catch(err) {
        showToast('❌ Gagal: ' + err.message);
    }
}

// ===== SETTINGS =====
function toggleDarkMode() {
    var t = document.getElementById('dark-mode-toggle');
    var isDark = t ? t.checked : false;
    document.body.classList.toggle('dark-mode', isDark);
    localStorage.setItem('yaping_darkMode', isDark);
}
function changeFontSize(val) { document.body.style.fontSize = val + 'px'; }
function clearAllPosts() { showToast('Fitur reset via Supabase akan segera hadir!'); }
function resetAllData() { showToast('Gunakan Supabase Dashboard untuk reset data'); }

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
function formatTimeAgo(ts) { var diff = Date.now() - ts; var m = Math.floor(diff/60000); var h = Math.floor(diff/3600000); var d = Math.floor(diff/86400000); if (m<1) return 'Baru saja'; if (m<60) return m+'m lalu'; if (h<24) return h+'j lalu'; return d+'h lalu'; }
function escapeHtml(text) { if (!text) return ''; var div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function closeModal() { var m = document.getElementById('modal-overlay'); if (m) m.classList.add('hidden'); }
function showModal(title, content) { var t = document.getElementById('modal-title'); var b = document.getElementById('modal-body'); var o = document.getElementById('modal-overlay'); if (t) t.textContent = title; if (b) b.innerHTML = content; if (o) o.classList.remove('hidden'); }

// ===== SUPABASE CDN =====
// Pastikan ini ada di HTML sebelum script.js:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

// ===== START =====
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); } else { initApp(); }
