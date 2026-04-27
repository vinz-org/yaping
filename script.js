/* ============================================
   YAPING - script.js (SUPABASE FIXED)
   ✓ db.raw() diganti logic JS
   ✓ Storage upload diperbaiki
   ✓ Error logging aktif
   ✓ RLS & Policy compatible
   ============================================ */

// ===== SUPABASE CONFIG =====
const SUPABASE_URL = 'https://lzxjjiebpnhjeifnnqms.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6eGpqaWVicG5oamVpZm5ucW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzYxMjYsImV4cCI6MjA5Mjc1MjEyNn0.Tro63bLrHih8EJ4cVBt4SDy2lhVE4P3LQ4T81TFGKRI';

// Init Client
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== GLOBAL STATE =====
let currentUser = null;
let communities = [];
let currentViewedCommunity = null;
let emojiTargetInput = 'postInput';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

// ===== INIT =====
async function initApp() {
    const { data: { session } } = await db.auth.getSession();
    
    if (session?.user) {
        currentUser = session.user;
        await loadCommunities();
        renderCommunities('all');
        updateProfileStats();
        showToast('✅ Login berhasil!');
    } else {
        await demoSignUp();
    }
    
    setupEventListeners();
    
    if (localStorage.getItem('yaping_darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        var toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = true;
    }
}

async function demoSignUp() {
    const randomId = Math.random().toString(36).substr(2, 9);
    const { data, error } = await db.auth.signUp({
        email: `demo_${randomId}@yaping.test`,
        password: 'demo123456',
        options: {  { username: '@user', fullname: 'Pengguna Yaping' } }
    });
    
    if (error) {
        console.error('❌ Demo signup error:', error);
        currentUser = { id: 'demo-fallback', user_meta { username: '@user', fullname: 'Pengguna Yaping' } };
        await loadCommunities();
        renderCommunities('all');
        showToast('⚠️ Mode demo (tanpa auth)');
        return;
    }
    
    currentUser = data.user;
    
    const { error: pErr } = await db.from('profiles').upsert({
        id: currentUser.id, username: '@user', fullname: 'Pengguna Yaping', avatar_url: null
    }, { onConflict: 'id' });
    if (pErr) console.error('❌ Profile create:', pErr);
    
    await loadCommunities();
    renderCommunities('all');
    showToast('✅ Akun demo siap!');
}

async function loadCommunities() {
    try {
        const { data, error } = await db.from('communities')
            .select('*, owner:profiles!communities_owner_id_fkey(username), stats')
            .order('created_at', { ascending: false });
        if (error) throw error;
        communities = data || [];
    } catch(e) { console.error('❌ Load communities:', e); communities = []; }
}

function setupEventListeners() {
    var searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });
    
    document.addEventListener('click', e => {
        var picker = document.getElementById('emoji-picker');
        if (picker && !picker.contains(e.target)) {
            var isBtn = false, el = e.target;
            while (el) { var onclick = el.getAttribute?.('onclick') || ''; if (onclick.includes('addEmoji')) { isBtn = true; break; } el = el.parentNode; }
            if (!isBtn) picker.classList.add('hidden');
        }
    });
    
    db.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') { currentUser = session.user; await loadCommunities(); renderCommunities('all'); }
        if (event === 'SIGNED_OUT') { currentUser = null; communities = []; renderCommunities('all'); }
    });
    
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
    else initApp();
}

// ===== TAB NAVIGATION =====
function switchToTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    var target = document.getElementById(tabName + '-tab');
    if (target) target.classList.remove('hidden');
    
    document.querySelectorAll('#topbar-nav a').forEach(l => l.classList.remove('active-nav'));
    document.getElementById('nav-' + tabName)?.classList.add('active-nav');
    
    if (tabName === 'komunitas') { loadCommunities().then(() => renderCommunities('all')); }
    else if (tabName === 'profile') { updateProfileStats(); renderMyPosts(); }
    else if (tabName === 'home') renderFeed();
    
    document.getElementById('notif-dropdown')?.classList.add('hidden');
    if (tabName !== 'community-detail') currentViewedCommunity = null;
    return false;
}

// ===== FILE UPLOAD =====
async function uploadToStorage(bucket, path, file) {
    const { data, error } = await db.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw new Error('Storage upload: ' + error.message);
    
    const { data: urlData } = db.storage.from(bucket).getPublicUrl(path);
    return urlData.publicUrl;
}

function validateFile(file, isProfile) {
    if (!file) return { valid: false, error: 'Pilih file dulu' };
    if (isProfile && !ALLOWED_IMAGE_TYPES.includes(file.type)) return { valid: false, error: 'Format: PNG, JPEG, atau GIF' };
    if (!isProfile && !ALLOWED_IMAGE_TYPES.includes(file.type) && !ALLOWED_VIDEO_TYPES.includes(file.type)) return { valid: false, error: 'Format: PNG, JPEG, GIF, MP4, atau WebM' };
    if (file.size > MAX_FILE_SIZE) return { valid: false, error: 'Maksimal 2MB' };
    return { valid: true };
}

async function triggerPostFileUpload(target) {
    if (!currentUser) { showToast('Login dulu!'); return; }
    var commId = target === 'community' ? currentViewedCommunity : null;
    var previewId = 'filePreview_' + (commId || 'home');
    
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,video/mp4,video/webm';
    input.style.display = 'none';
    
    input.onchange = async e => {
        var file = e.target.files[0];
        if (!file) return;
        var v = validateFile(file, false);
        if (!v.valid) { showToast(v.error); return; }
        
        showToast('⏳ Uploading...');
        try {
            const ext = file.type.split('/')[1];
            const path = `${currentUser.id}/post_${Date.now()}.${ext}`;
            const publicUrl = await uploadToStorage('posts', path, file);
            
            var previewEl = document.getElementById(previewId);
            if (!previewEl) {
                previewEl = document.createElement('div');
                previewEl.id = previewId;
                previewEl.className = 'file-preview';
                previewEl.style.cssText = 'margin:8px 0;padding:8px;background:var(--fb-blue-lighter);border-radius:3px;font-size:11px;display:flex;align-items:center;gap:8px;';
                var textareaId = target === 'community' ? 'communityPostInput' : 'postInput';
                var textarea = document.getElementById(textareaId);
                if (textarea?.parentNode) textarea.parentNode.insertBefore(previewEl, textarea.nextSibling);
            }
            
            var isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
            var fname = file.name.length > 25 ? file.name.slice(0, 22) + '...' : file.name;
            previewEl.innerHTML = `${isVideo ? '🎬' : '🖼️'} ${fname} <button class="option-btn" style="padding:2px 6px;font-size:10px;" onclick="removeFilePreview('${previewId}')">✕</button>`;
            previewEl.dataset.url = publicUrl;
            previewEl.dataset.type = file.type;
            showToast('✅ Upload berhasil!');
        } catch(err) {
            console.error('❌ Upload error:', err);
            showToast('❌ Upload gagal: ' + err.message);
        }
    };
    
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 1000);
}

function removeFilePreview(id) { var el = document.getElementById(id); if (el) el.remove(); }
function getFileData(id) { var el = document.getElementById(id); if (!el?.dataset.url) return null; return { url: el.dataset.url, type: el.dataset.type }; }

// ===== COMMUNITIES =====
function renderCommunities(filter) {
    if (!filter) filter = 'all';
    var list = document.getElementById('communityList');
    if (!list) return;
    
    if (!communities.length) { list.innerHTML = '<li class="sidebar-empty">Memuat komunitas...</li>'; return; }
    
    var filtered = filter === 'mine' ? communities.filter(c => c.owner_id === currentUser?.id) : communities;
    if (!filtered.length) { list.innerHTML = '<li class="sidebar-empty">Belum ada komunitas</li>'; return; }
    
    var html = filtered.map(c => {
        var isMember = true; // Simplified for demo
        var badge = isMember ? ' <span style="color:var(--fb-green)">[Anggota]</span>' : '';
        var btn = isMember 
            ? `<button class="primary-btn" onclick="viewCommunity('${c.id}')">Lihat</button>`
            : `<button class="primary-btn" onclick="joinCommunity('${c.id}')">Gabung</button>`;
        return `<li class="comm-list-item">
            <div class="comm-icon">${c.category || '🎮'}</div>
            <div class="comm-info">
                <div class="comm-name" onclick="viewCommunity('${c.id}')">${escapeHtml(c.name)}${badge}</div>
                <div class="comm-meta">${escapeHtml(c.description || '')} | ${c.member_count || 0} anggota</div>
            </div>
            <div class="comm-actions">${btn}</div>
        </li>`;
    }).join('');
    list.innerHTML = html;
}

function filterComm(filter, btn) {
    document.querySelectorAll('.comm-filter .filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderCommunities(filter);
}

async function addCommunity() {
    if (!currentUser) { showToast('Login dulu!'); return; }
    var name = document.getElementById('newCommunityInput')?.value.trim();
    var desc = document.getElementById('newCommunityDesc')?.value.trim();
    var cat = document.getElementById('newCommunityCategory')?.value || '🎮';
    var cooldown = document.getElementById('cooldown-info');
    
    if (!name) { showToast('Nama komunitas wajib diisi!'); return; }
    
    try {
        const { data, error } = await db.from('communities').insert({
            name, description: desc || 'Tidak ada deskripsi', category: cat,
            owner_id: currentUser.id, member_count: 1,
            stats: { totalPosts: 0, totalLikes: 0, totalComments: 0 }
        }).select().single();
        if (error) throw error;
        
        communities.unshift(data);
        renderCommunities('all');
        document.getElementById('newCommunityInput').value = '';
        document.getElementById('newCommunityDesc').value = '';
        if (cooldown) cooldown.textContent = 'Komunitas dibuat!';
        setTimeout(() => { if (cooldown?.textContent.includes('Komunitas')) cooldown.textContent = ''; }, 3000);
        showToast('✅ Komunitas "' + name + '" berhasil!');
    } catch(e) { console.error('❌ Create comm:', e); showToast('❌ Gagal: ' + e.message); }
}

async function joinCommunity(commId) {
    if (!currentUser) { showToast('Login dulu!'); return; }
    try {
        const { data: exists } = await db.from('community_members').select('id').eq('community_id', commId).eq('user_id', currentUser.id).maybeSingle();
        if (exists) { showToast('Sudah anggota!'); return; }
        
        await db.from('community_members').insert({ community_id: commId, user_id: currentUser.id });
        
        const {  comm } = await db.from('communities').select('member_count').eq('id', commId).single();
        await db.from('communities').update({ member_count: (comm?.member_count || 0) + 1 }).eq('id', commId);
        
        await loadCommunities();
        renderCommunities('all');
        if (currentViewedCommunity === commId) viewCommunity(commId);
        showToast('✅ Selamat bergabung!');
    } catch(e) { console.error('❌ Join:', e); showToast('❌ Gagal: ' + e.message); }
}

async function viewCommunity(commId) {
    currentViewedCommunity = commId;
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    var detailTab = document.getElementById('community-detail-tab');
    if (!detailTab) return;
    detailTab.classList.remove('hidden');
    
    try {
        const {  comm, error } = await db.from('communities').select('*, owner:profiles!communities_owner_id_fkey(username), stats').eq('id', commId).single();
        if (error) throw error;
        
        const {  membership } = await db.from('community_members').select('id').eq('community_id', commId).eq('user_id', currentUser?.id).maybeSingle();
        var isMember = !!membership;
        
        var stats = comm.stats || { totalPosts: 0, totalLikes: 0, totalComments: 0 };
        var statsHtml = `<div style="display:flex;gap:12px;font-size:11px;color:var(--fb-text-light);margin:8px 0;">
            <span>📊 ${stats.totalPosts || 0} post</span><span>❤️ ${stats.totalLikes || 0} like</span><span>💬 ${stats.totalComments || 0} komentar</span>
        </div>`;
        
        var postBox = isMember && currentUser ? `<div class="content-box">
            <div class="box-title">Buat Postingan</div>
            <textarea id="communityPostInput" class="comm-post-input" placeholder="Tulis untuk ${escapeHtml(comm.name)}..."></textarea>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0;">
                <button class="option-btn" onclick="addEmoji('communityPostInput')" style="font-size:11px;">😊 Emoji</button>
                <button class="option-btn" onclick="triggerPostFileUpload('community')" style="font-size:11px;">📷 Foto/Video</button>
                <button class="primary-btn" onclick="submitCommunityPost('${commId}')">Bagikan</button>
            </div>
            <div id="filePreview_${commId}"></div>
        </div>` : `<div class="content-box" style="text-align:center;padding:20px;">
            <div style="font-size:36px;margin-bottom:10px;">🔒</div>
            <p style="margin-bottom:12px;font-size:12px;">Gabung untuk bisa posting & berdiskusi</p>
            <button class="primary-btn" onclick="joinCommunity('${commId}')">Gabung Sekarang</button>
        </div>`;
        
        var postsHTML = await renderCommunityPosts(commId);
        var joinBtn = !isMember ? `<button class="follow-btn-big" onclick="joinCommunity('${commId}')">Gabung</button>` : '';
        
        detailTab.innerHTML = `<div class="content-box">
            <a class="back-link" onclick="switchToTab('komunitas');return false;">&larr; Kembali</a>
            <div class="comm-detail-banner"></div>
            <div class="comm-detail-header">
                <div class="comm-detail-icon">${comm.category || '🎮'}</div>
                <div class="comm-detail-info">
                    <div class="comm-detail-name">${escapeHtml(comm.name)}</div>
                    <div style="font-size:12px;color:var(--fb-text-light);margin-bottom:4px;">${escapeHtml(comm.description || '')}</div>
                    <div class="comm-detail-meta">${comm.member_count || 0} anggota | Oleh ${escapeHtml(comm.owner?.username || 'Unknown')}${isMember ? ' <span style="color:var(--fb-green)">[Anggota]</span>' : ''}</div>
                    ${statsHtml}
                </div>
                ${joinBtn}
            </div>
        </div>` + postBox + `<div class="content-box">
            <div class="box-title">💬 Diskusi Terbaru</div>
            <div id="comm-posts-feed">${postsHTML}</div>
        </div>`;
    } catch(e) { console.error('❌ View comm:', e); showToast('❌ Gagal muat: ' + e.message); }
}

// ===== POSTS & COMMENTS =====
async function submitCommunityPost(commId) {
    if (!currentUser) { showToast('Login dulu!'); return; }
    var text = document.getElementById('communityPostInput')?.value.trim();
    var fileData = getFileData('filePreview_' + commId);
    
    if (!text && !fileData) { showToast('Tulis sesuatu atau upload media!'); return; }
    
    try {
        const { data: post, error } = await db.from('posts').insert({
            community_id: commId, author_id: currentUser.id,
            content: text || null,
            media_url: fileData?.url || null,
            media_type: fileData?.type?.includes('video') ? 'video' : (fileData?.url ? 'image' : null),
            likes_count: 0
        }).select().single();
        if (error) throw error;
        
        document.getElementById('communityPostInput').value = '';
        removeFilePreview('filePreview_' + commId);
        showToast('✅ Postingan dibagikan!');
        
        var feedEl = document.getElementById('comm-posts-feed');
        if (feedEl) feedEl.innerHTML = await renderCommunityPosts(commId);
    } catch(e) { console.error('❌ Submit post:', e); showToast('❌ Gagal: ' + e.message); }
}

async function renderCommunityPosts(commId) {
    try {
        const {  posts, error } = await db.from('posts')
            .select(`*, author:profiles!posts_author_id_fkey(username), comments:comments(*, author:profiles!comments_author_id_fkey(username)), likes:likes(user_id)`)
            .eq('community_id', commId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        
        if (!posts?.length) return '<div class="sidebar-empty">Belum ada diskusi. Jadilah yang pertama!</div>';
        
        return posts.map(p => {
            var timeAgo = formatTimeAgo(new Date(p.created_at).getTime());
            var isLiked = p.likes?.some(l => l.user_id === currentUser?.id) || false;
            var isOwner = p.author_id === currentUser?.id;
            
            var mediaHtml = p.media_url ? (p.media_type === 'video' 
                ? `<div style="margin:8px 0;"><video src="${p.media_url}" controls style="max-width:100%;border-radius:3px;"></video></div>`
                : `<div style="margin:8px 0;"><img src="${p.media_url}" style="max-width:100%;border-radius:3px;cursor:pointer;" onclick="viewMediaFull('${p.media_url}')"></div>`) : '';
            
            var commentsHtml = p.comments?.length ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--fb-border);">${p.comments.map(cm => 
                `<div style="font-size:12px;margin:4px 0;padding:6px 8px;background:var(--fb-blue-bg);border-radius:3px;">
                    <strong>${escapeHtml(cm.author?.username || 'Unknown')}</strong>: ${escapeHtml(cm.content)} 
                    <span style="color:var(--fb-text-light);font-size:10px;">${formatTimeAgo(new Date(cm.created_at).getTime())}</span>
                    ${(cm.author_id === currentUser?.id || isOwner) ? `<button class="option-btn" style="padding:1px 4px;font-size:9px;" onclick="deleteComment('${commId}','${p.id}','${cm.id}')">✕</button>` : ''}
                </div>`
            ).join('')}</div>` : '';
            
            var commentInput = currentUser ? `<div style="margin-top:8px;display:flex;gap:4px;">
                <input type="text" id="commentInput_${p.id}" placeholder="Tulis komentar..." style="flex:1;padding:4px 8px;border:1px solid var(--fb-border);border-radius:3px;font-size:11px;">
                <button class="option-btn" style="padding:4px 8px;font-size:11px;" onclick="submitComment('${commId}','${p.id}')">Kirim</button>
            </div>` : '';
            
            return `<div class="post-card" style="margin-bottom:8px;">
                <div class="post-card-header"><span class="post-username">${escapeHtml(p.author?.username || 'Unknown')}</span><span class="post-timestamp">${timeAgo}</span></div>
                <div class="post-body">${escapeHtml(p.content || '')}</div>
                ${mediaHtml}
                <div class="post-footer">
                    <div class="post-actions-left">
                        <button class="like-btn${isLiked ? ' liked' : ''}" onclick="likePost('${commId}','${p.id}')">${isLiked ? '❤️' : '🤍'} ${p.likes_count || 0}</button>
                        <button class="comment-btn" onclick="toggleCommentInput('${p.id}')">💬 ${p.comments?.length || 0}</button>
                    </div>
                    <button class="share-btn" onclick="showToast('Link disalin!')">🔗</button>
                    ${isOwner ? `<button class="post-delete-btn" onclick="deletePost('${commId}','${p.id}',true)" style="margin-left:auto;">🗑️</button>` : ''}
                </div>
                <div id="commentSection_${p.id}" class="comment-section" style="display:none;">${commentInput}${commentsHtml}</div>
            </div>`;
        }).join('');
    } catch(e) { console.error('❌ Render posts:', e); return '<div class="sidebar-empty">Gagal memuat postingan</div>'; }
}

function toggleCommentInput(postId) {
    var s = document.getElementById('commentSection_' + postId);
    if (s) s.style.display = s.style.display === 'none' ? 'block' : 'none';
}

async function submitComment(commId, postId) {
    if (!currentUser) { showToast('Login dulu!'); return; }
    var text = document.getElementById('commentInput_' + postId)?.value.trim();
    if (!text) { showToast('Tulis komentar dulu!'); return; }
    
    try {
        await db.from('comments').insert({ post_id: postId, author_id: currentUser.id, content: text });
        document.getElementById('commentInput_' + postId).value = '';
        showToast('✅ Komentar dikirim!');
        
        var feedEl = document.getElementById('comm-posts-feed');
        if (feedEl && currentViewedCommunity === commId) {
            feedEl.innerHTML = await renderCommunityPosts(commId);
            var s = document.getElementById('commentSection_' + postId);
            if (s) s.style.display = 'block';
        }
    } catch(e) { console.error('❌ Comment:', e); showToast('❌ Gagal: ' + e.message); }
}

async function deleteComment(commId, postId, commentId) {
    if (!confirm('Hapus komentar?')) return;
    try {
        await db.from('comments').delete().eq('id', commentId);
        var feedEl = document.getElementById('comm-posts-feed');
        if (feedEl && currentViewedCommunity === commId) feedEl.innerHTML = await renderCommunityPosts(commId);
        showToast('Komentar dihapus');
    } catch(e) { console.error('❌ Del comment:', e); showToast('❌ Gagal: ' + e.message); }
}

async function likePost(commId, postId) {
    if (!currentUser) { showToast('Login dulu!'); return; }
    try {
        const {  exists } = await db.from('likes').select('id').eq('post_id', postId).eq('user_id', currentUser.id).maybeSingle();
        if (exists) {
            await db.from('likes').delete().eq('id', exists.id);
            const { data: p } = await db.from('posts').select('likes_count').eq('id', postId).single();
            await db.from('posts').update({ likes_count: (p?.likes_count || 0) - 1 }).eq('id', postId);
        } else {
            await db.from('likes').insert({ post_id: postId, user_id: currentUser.id });
            const { data: p } = await db.from('posts').select('likes_count').eq('id', postId).single();
            await db.from('posts').update({ likes_count: (p?.likes_count || 0) + 1 }).eq('id', postId);
        }
        if (currentViewedCommunity === commId) {
            var feedEl = document.getElementById('comm-posts-feed');
            if (feedEl) feedEl.innerHTML = await renderCommunityPosts(commId);
        }
    } catch(e) { console.error('❌ Like:', e); showToast('❌ Gagal: ' + e.message); }
}

async function deletePost(commId, postId, isCommunity) {
    if (!confirm('Hapus postingan?')) return;
    try {
        await db.from('comments').delete().eq('post_id', postId);
        await db.from('likes').delete().eq('post_id', postId);
        await db.from('posts').delete().eq('id', postId);
        showToast('✅ Postingan dihapus');
        if (isCommunity && currentViewedCommunity === commId) {
            var feedEl = document.getElementById('comm-posts-feed');
            if (feedEl) feedEl.innerHTML = await renderCommunityPosts(commId);
        } else renderFeed();
    } catch(e) { console.error('❌ Del post:', e); showToast('❌ Gagal: ' + e.message); }
}

// ===== UTILS =====
function viewMediaFull(url) {
    var isV = url.includes('.mp4') || url.includes('.webm');
    showModal('Lihat Media', isV ? `<video src="${url}" controls style="max-width:100%;max-height:70vh;"></video>` : `<img src="${url}" style="max-width:100%;max-height:70vh;">`);
}

function renderFeed() {
    var feed = document.getElementById('feed');
    if (!feed) return;
    feed.innerHTML = `<div class="post-card"><div class="post-card-header"><span class="post-username">@user</span><span class="post-timestamp">Baru saja</span></div>
        <div class="post-body">Selamat datang di Yaping! 👋 Data tersimpan di Supabase cloud.</div>
        <div class="post-footer"><div class="post-actions-left"><button class="like-btn" onclick="showToast('Terima kasih!')">🤍 0</button><button class="comment-btn" onclick="showToast('Komentar...')">💬 0</button></div>
        <button class="share-btn" onclick="showToast('Dibagikan!')">🔗</button></div></div>`;
}

async function renderMyPosts() {
    if (!currentUser) return;
    var feed = document.getElementById('my-posts-feed');
    if (!feed) return;
    try {
        const {  posts } = await db.from('posts').select('*, author:profiles!posts_author_id_fkey(username)').eq('author_id', currentUser.id).order('created_at', { ascending: false }).limit(20);
        if (!posts?.length) { feed.innerHTML = '<div class="sidebar-empty">Belum ada postingan. Yuk mulai berbagi!</div>'; return; }
        feed.innerHTML = posts.map(p => `<div class="post-card" style="margin-bottom:8px;">
            <div class="post-card-header"><span class="post-username">${escapeHtml(p.author?.username || 'Unknown')}</span><span class="post-timestamp">${formatTimeAgo(new Date(p.created_at).getTime())}</span></div>
            <div class="post-body">${escapeHtml(p.content || '')}</div>
            ${p.media_url ? (p.media_type === 'video' ? `<video src="${p.media_url}" controls style="max-width:100%;border-radius:3px;margin:8px 0;"></video>` : `<img src="${p.media_url}" style="max-width:100%;border-radius:3px;margin:8px 0;">`) : ''}
            <div class="post-footer"><button class="post-delete-btn" onclick="deletePost('${p.community_id}','${p.id}',true)">🗑️ Hapus</button></div>
        </div>`).join('');
    } catch(e) { console.error('❌ My posts:', e); }
}

function updateProfileStats() {
    var u = currentUser?.user_metadata?.username || '@user';
    var n = currentUser?.user_metadata?.fullname || 'Pengguna Yaping';
    ['pi-username', 'sidebar-username', 'profile-username-display'].forEach(k => { var el = document.getElementById(k); if (el) el.textContent = u; });
    document.getElementById('pi-fullname') && (document.getElementById('pi-fullname').textContent = n);
    document.getElementById('pi-comms') && (document.getElementById('pi-comms').textContent = communities.filter(c => c.owner_id === currentUser?.id).length);
}

function showProfileSection(section, btn) {
    document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    ['profile-info-section', 'profile-posts-section', 'profile-edit-section'].forEach(id => { var s = document.getElementById(id); if (s) s.classList.add('hidden'); });
    if (section === 'info') document.getElementById('profile-info-section')?.classList.remove('hidden');
    if (section === 'posts') { var s = document.getElementById('profile-posts-section'); if (s) { s.classList.remove('hidden'); renderMyPosts(); } }
    if (section === 'edit') {
        document.getElementById('edit-username').value = currentUser?.user_metadata?.username || '@user';
        document.getElementById('edit-fullname').value = currentUser?.user_metadata?.fullname || 'Pengguna Yaping';
        document.getElementById('profile-edit-section')?.classList.remove('hidden');
        if (!document.getElementById('profilePhotoUploadRow')) {
            var row = document.createElement('div');
            row.id = 'profilePhotoUploadRow';
            row.className = 'form-row';
            row.innerHTML = `<label>Foto Profil</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <button class="secondary-btn" type="button" onclick="triggerProfilePhotoUpload()" style="font-size:11px;">📷 Pilih Foto</button>
                <button class="danger-btn" type="button" onclick="removeProfilePhoto()" style="font-size:11px;">Hapus</button>
            </div><small style="color:var(--fb-text-light);">PNG, JPEG, GIF • Maksimal 2MB</small>`;
            var bio = document.getElementById('edit-bio');
            if (bio?.parentNode?.parentNode) bio.parentNode.parentNode.insertBefore(row, bio.parentNode.nextSibling);
        }
    }
}

async function triggerProfilePhotoUpload() {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/png,image/jpeg,image/gif'; input.style.display = 'none';
    input.onchange = async e => {
        var file = e.target.files[0];
        if (!file || !currentUser) return;
        var v = validateFile(file, true);
        if (!v.valid) { showToast(v.error); return; }
        showToast('⏳ Uploading...');
        try {
            const path = `${currentUser.id}/avatar_${Date.now()}.${file.type.split('/')[1]}`;
            const url = await uploadToStorage('avatars', path, file);
            await db.from('profiles').update({ avatar_url: url }).eq('id', currentUser.id);
            showToast('✅ Foto profil diperbarui!');
        } catch(err) { console.error('❌ Avatar upload:', err); showToast('❌ Gagal: ' + err.message); }
    };
    document.body.appendChild(input); input.click(); setTimeout(() => input.remove(), 1000);
}

async function removeProfilePhoto() {
    if (!currentUser || !confirm('Hapus foto profil?')) return;
    try {
        await db.from('profiles').update({ avatar_url: null }).eq('id', currentUser.id);
        showToast('Foto profil dihapus');
    } catch(e) { console.error('❌ Del avatar:', e); showToast('❌ Gagal: ' + e.message); }
}

function toggleDarkMode() { var t = document.getElementById('dark-mode-toggle'); document.body.classList.toggle('dark-mode', t?.checked); localStorage.setItem('yaping_darkMode', t?.checked); }
function changeFontSize(val) { document.body.style.fontSize = val + 'px'; }
function showNotifications() { document.getElementById('notif-dropdown')?.classList.toggle('hidden'); }
function addNotification(text) { var b = document.getElementById('notif-badge'); if (!b) return; b.textContent = parseInt(b.textContent || 0) + 1; b.classList.remove('hidden'); var l = document.getElementById('notif-list'); if (!l) return; if (l.querySelector('.notif-empty')) l.innerHTML = ''; var n = document.createElement('div'); n.className = 'notif-item'; n.innerHTML = `<div>${escapeHtml(text)}</div><small>Baru saja</small>`; l.insertBefore(n, l.firstChild); }
function clearNotifications() { var l = document.getElementById('notif-list'); var b = document.getElementById('notif-badge'); if (l) l.innerHTML = '<div class="notif-empty">Belum ada notifikasi</div>'; if (b) { b.classList.add('hidden'); b.textContent = '0'; } }
function addEmoji(t) { emojiTargetInput = t || 'postInput'; document.getElementById('emoji-picker')?.classList.toggle('hidden'); }
function insertEmoji(e) { var i = document.getElementById(emojiTargetInput); if (i) { i.value += e; i.focus(); } document.getElementById('emoji-picker')?.classList.add('hidden'); }
function doSearch() { var q = document.getElementById('searchInput')?.value.trim(); if (q) showToast('Mencari: ' + q); }
function showToast(msg) { var t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.remove('hidden'); setTimeout(() => t.classList.add('hidden'), 3000); }
function formatTimeAgo(ts) { var d = Date.now() - ts; var m = Math.floor(d/60000); var h = Math.floor(d/3600000); var dy = Math.floor(d/86400000); if (m<1) return 'Baru saja'; if (m<60) return m+'m lalu'; if (h<24) return h+'j lalu'; return dy+'h lalu'; }
function escapeHtml(t) { if (!t) return ''; var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function closeModal() { document.getElementById('modal-overlay')?.classList.add('hidden'); }
function showModal(title, content) { document.getElementById('modal-title').textContent = title; document.getElementById('modal-body').innerHTML = content; document.getElementById('modal-overlay')?.classList.remove('hidden'); }

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp); else initApp();
