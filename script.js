// ============================================
// 🚀 YAPING SOCIAL NETWORK - script.js
// Facebook 2008 Style Compatible - Anti-XSS Protected
// ============================================

// ===== SECURITY FUNCTIONS (ANTI-XSS) =====
var USERNAME_MAX_LENGTH = 10;
var LIKE_SPIKE_LIMIT = 1000000000000; // 1 Triliun like
var ACCOUNT_BANS_KEY = 'yaping_accountBans';
var SECURITY_BAN_KEY = 'yaping_securityBan';
var SECURITY_BAN_MESSAGE = 'Akun anda resmi di ban dari Yaping selama 2 bulan karena anda mencoba XSS injection. IP address anda diblokir oleh server.';
var LIKE_SPIKE_BAN_MESSAGE = 'Akun anda resmi di ban dari Yaping selama 3 bulan karena post anda mendapatkan 1 triliun like secara tiba-tiba.';
var SECURITY_BAN_MONTHS = 3;
var securityBanCountdownTimer = null;

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

function escapeAttr(value) {
    return escapeHtml(value);
}

function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeMediaSrc(src, type) {
    if (src === null || src === undefined) return '';

    var value = String(src).trim();
    if (!value) return '';

    var compact = value.replace(/[\u0000-\u001F\u007F\s]+/g, '').toLowerCase();
    var protocolMatch = compact.match(/^([a-z][a-z0-9+.-]*):/);

    if (protocolMatch) {
        var protocol = protocolMatch[1];
        if (protocol === 'data') {
            var dataPatterns = {
                image: /^data:image\/(png|jpe?g|gif|webp);/i,
                audio: /^data:audio\/(mpeg|mp3|wav|ogg|webm);/i,
                video: /^data:video\/(mp4|webm|ogg);/i
            };
            return dataPatterns[type] && dataPatterns[type].test(compact) ? value : '';
        }

        if (protocol !== 'http' && protocol !== 'https' && protocol !== 'blob') {
            return '';
        }
    }

    return value;
}

function renderMediaSecure(src, type) {
    var safeSrc = sanitizeMediaSrc(src, type);
    if (!safeSrc) return '';

    var escapedSrc = escapeAttr(safeSrc);
    if (type === 'image') {
        return '<div class="post-image"><img src="' + escapedSrc + '" alt="post image" style="max-width:100%;border-radius:3px;margin:8px 0;" onerror="this.style.display=\'none\'"></div>';
    }
    if (type === 'audio') {
        return '<div class="post-media"><audio controls style="width:100%;max-width:300px;margin:8px 0;"><source src="' + escapedSrc + '" type="audio/mpeg"></audio></div>';
    }
    if (type === 'video') {
        return '<div class="post-media"><video controls style="width:100%;max-width:300px;margin:8px 0;"><source src="' + escapedSrc + '" type="video/mp4"></video></div>';
    }
    return '';
}

function renderPostMedia(post) {
    if (!post) return '';
    if (post.media) return renderMediaSecure(post.media, post.mediaType);
    if (post.photo) return renderMediaSecure(post.photo, 'image');
    return '';
}

function sanitizeColor(color, fallback) {
    var value = String(color || '').trim();
    if (/^#[0-9a-fA-F]{3}$/.test(value) || /^#[0-9a-fA-F]{6}$/.test(value)) {
        return value;
    }
    return fallback || '#4472CA';
}

function safeCount(value) {
    var n = parseInt(value, 10);
    return (!isNaN(n) && n >= 0) ? n : 0;
}

function safeInteger(value, fallback) {
    if (value === null || value === undefined || String(value).trim() === '') return fallback;
    var n = Number(value);
    return isFinite(n) ? Math.floor(n) : fallback;
}

function formatPostContent(content) {
    if (!content) return '';

    var hashtags = parseHashtags(String(content));
    var html = escapeHtml(content);

    for (var i = 0; i < hashtags.length; i++) {
        var tag = hashtags[i];
        html = html.replace(
            new RegExp(escapeRegExp(tag) + '(?!\\w)', 'g'),
            '<a href="#" class="hashtag-link" onclick="viewHashtag(\'' + jsString(tag) + '\'); return false;">' + escapeHtml(tag) + '</a>'
        );
    }

    return html.replace(/\n/g, '<br>');
}

function decodeSecurityScanText(text) {
    text = String(text || '');
    var decoded = text;

    try {
        decoded = decodeURIComponent(text);
    } catch (e) {
        decoded = text;
    }

    return (text + '\n' + decoded)
        .replace(/&lt;|&#60;|&#x3c;/gi, '<')
        .replace(/&gt;|&#62;|&#x3e;/gi, '>')
        .replace(/&quot;|&#34;|&#x22;/gi, '"')
        .replace(/&#39;|&#x27;|&apos;/gi, "'")
        .replace(/&colon;|&#58;|&#x3a;/gi, ':');
}

function hasXSSAttempt(value) {
    if (value === null || value === undefined) return false;

    var scan = decodeSecurityScanText(value).toLowerCase();
    var compact = scan.replace(/[\u0000-\u001F\u007F\s]+/g, '');

    var patterns = [
        /<\s*\/?\s*script\b/i,
        /<\s*\/?\s*(iframe|object|embed|svg|math|meta|link|base|form)\b/i,
        /<\s*[a-z][^>]*\son[a-z]+\s*=/i,
        /\son[a-z]+\s*=/i,
        /srcdoc\s*=/i,
        /(href|src|xlink:href)\s*=\s*["']?\s*(javascript|vbscript)\s*:/i,
        /(javascript|vbscript)\s*:/i,
        /data\s*:\s*text\/html/i,
        /expression\s*\(/i,
        /url\s*\(\s*["']?\s*javascript\s*:/i,
        /document\s*\.\s*(cookie|write|location)/i,
        /window\s*\.\s*(location|open)/i,
        /eval\s*\(/i,
        /settimeout\s*\(\s*["']/i,
        /setinterval\s*\(\s*["']/i
    ];

    for (var i = 0; i < patterns.length; i++) {
        if (patterns[i].test(scan)) return true;
    }

    return compact.indexOf('<script') !== -1 ||
        compact.indexOf('javascript:') !== -1 ||
        compact.indexOf('vbscript:') !== -1 ||
        compact.indexOf('data:text/html') !== -1;
}

function getSecurityBanMessage(banData) {
    banData = banData || {};
    return banData.reason === 'like-spike-ban' ? LIKE_SPIKE_BAN_MESSAGE : SECURITY_BAN_MESSAGE;
}

function postHasXSSAttempt(post) {
    if (!post) return false;
    if (hasXSSAttempt(post.content) || hasXSSAttempt(post.author)) return true;
    if (hasXSSAttempt(post.media) || hasXSSAttempt(post.photo)) return true;

    var comments = Array.isArray(post.comments) ? post.comments : [];
    for (var i = 0; i < comments.length; i++) {
        if (commentHasXSSAttempt(comments[i])) return true;
    }

    return false;
}

function commentHasXSSAttempt(comment) {
    if (!comment) return false;
    return hasXSSAttempt(comment.content) || hasXSSAttempt(comment.author);
}

function getSecurityBanData() {
    return loadStoredJSON(SECURITY_BAN_KEY, null);
}

function getSecurityBanExpiry(createdAt) {
    var base = new Date(createdAt || Date.now());
    if (isNaN(base.getTime())) base = new Date();
    base.setMonth(base.getMonth() + SECURITY_BAN_MONTHS);
    return base.getTime();
}

function getAccountBans() {
    return loadStoredJSON(ACCOUNT_BANS_KEY, {});
}

function saveAccountBans(bans) {
    saveStoredJSON(ACCOUNT_BANS_KEY, bans || {});
}

function isAccountLocallyBanned(username) {
    if (!username) return false;

    var bans = getAccountBans();
    var ban = bans[username];
    if (!ban) return false;

    var expiresAt = parseInt(ban.expiresAt, 10);
    if (!expiresAt || isNaN(expiresAt) || Date.now() >= expiresAt) {
        delete bans[username];
        saveAccountBans(bans);
        return false;
    }

    return true;
}

function setAccountLocalBan(username, reason) {
    if (!username) return;

    var now = Date.now();
    var bans = getAccountBans();
    bans[username] = {
        reason: reason || 'like-spike-ban',
        createdAt: now,
        expiresAt: getSecurityBanExpiry(now),
        durationMonths: SECURITY_BAN_MONTHS
    };
    saveAccountBans(bans);
}

function hasLikeSpike(post) {
    if (!post) return false;
    var likes = parseInt(post.likes, 10);
    return !isNaN(likes) && likes >= LIKE_SPIKE_LIMIT;
}

function isCurrentUserPostOwner(post) {
    if (!post) return false;
    return post.author === currentUser ||
        post.originPeerId === peerId ||
        post.originPeerId === localClientId ||
        post.originPeerId === preferredPeerId;
}

function banPostOwnerForLikeSpike(post) {
    var author = (post && (post.author || post.fromUser)) || '@unknown';

    if (isCurrentUserPostOwner(post) || author === currentUser) {
        triggerSecurityBan('like-spike-ban');
        return;
    }

    setAccountLocalBan(author, 'like-spike-ban');
    if (typeof showToast === 'function') {
        showToast('🚫 Post dihapus. Pemilik akun diban 3 bulan karena like mencurigakan.');
    }
}

function removePostFromLocalStorageOnly(postId, scope, commId) {
    var removed = false;

    if (scope === 'community') {
        var posts = communityPosts[commId] || [];
        var index = findPostIndexById(posts, postId);
        if (index !== -1) {
            posts.splice(index, 1);
            communityPosts[commId] = posts;
            saveCommunityPosts();
            removed = true;
        }
    } else {
        var feedIndex = findPostIndexById(feedPosts, postId);
        if (feedIndex !== -1) {
            feedPosts.splice(feedIndex, 1);
            saveFeedPosts();
            removed = true;
        }
    }

    if (removed) {
        rebuildHashtags();
        renderFeed();
        renderMyPosts();
        updateProfileStats();
        renderRightSidebar();

        if (scope === 'community' && currentViewedCommunity === parseInt(commId, 10)) {
            var feedEl = document.getElementById('comm-posts-feed');
            if (feedEl) feedEl.innerHTML = renderCommunityPosts(parseInt(commId, 10));
        }
    }

    return removed;
}

function handleLikeSpikePost(post, scope, commId, shouldBroadcast) {
    if (!hasLikeSpike(post)) return false;

    var postId = post.id || post.postId;
    removePostFromLocalStorageOnly(postId, scope, commId);

    if (shouldBroadcast !== false && typeof broadcastPeerMessage === 'function') {
        broadcastPeerMessage({
            type: 'delete-post',
            scope: scope || 'feed',
            communityId: commId || post.communityId || null,
            postId: postId,
            originPeerId: post.originPeerId || post.fromPeerId || null
        });
    }

    banPostOwnerForLikeSpike(post);
    return true;
}

function isSecurityBanned() {
    var banData = getSecurityBanData();
    if (!banData) return false;

    var createdAt = parseInt(banData.createdAt, 10);
    if (!createdAt || isNaN(createdAt)) createdAt = Date.now();

    var expiresAt = parseInt(banData.expiresAt, 10);
    if (!expiresAt || isNaN(expiresAt)) {
        expiresAt = getSecurityBanExpiry(createdAt);
        banData.createdAt = createdAt;
        banData.expiresAt = expiresAt;
        saveStoredJSON(SECURITY_BAN_KEY, banData);
    }

    if (Date.now() >= expiresAt) {
        localStorage.removeItem(SECURITY_BAN_KEY);
        return false;
    }

    return true;
}

function setSecurityBan(reason) {
    var now = Date.now();
    var banData = {
        reason: reason || 'xss-attempt',
        username: localStorage.getItem('yaping_currentUser') || '@user',
        clientId: localStorage.getItem('yaping_clientId') || 'local-browser',
        createdAt: now,
        expiresAt: getSecurityBanExpiry(now),
        durationMonths: SECURITY_BAN_MONTHS
    };
    saveStoredJSON(SECURITY_BAN_KEY, banData);
    return banData;
}

function getSecurityNetworkText(banData) {
    banData = banData || {};
    var ip = banData.publicIp || 'memuat...';
    var isp = banData.publicIsp || 'memuat...';
    return ' • IP address: ' + ip + ' • ISP: ' + isp;
}

function updateSecurityNetworkDisplay(banData) {
    var el = document.getElementById('security-network-info');
    if (!el) return;
    el.textContent = getSecurityNetworkText(banData);
}

function saveSecurityNetworkInfo(ip, isp) {
    var banData = getSecurityBanData();
    if (!banData) return;

    banData.publicIp = ip || 'tidak tersedia';
    banData.publicIsp = isp || 'tidak tersedia';
    banData.networkCapturedAt = Date.now();
    saveStoredJSON(SECURITY_BAN_KEY, banData);
    updateSecurityNetworkDisplay(banData);
}

function fetchSecurityNetworkInfo() {
    var banData = getSecurityBanData();
    if (!banData || (banData.publicIp && banData.publicIsp)) {
        updateSecurityNetworkDisplay(banData);
        return;
    }

    if (typeof fetch !== 'function') {
        saveSecurityNetworkInfo('tidak tersedia', 'tidak tersedia');
        return;
    }

    fetch('https://ipapi.co/json/')
        .then(function(response) {
            if (!response.ok) throw new Error('ipapi gagal');
            return response.json();
        })
        .then(function(data) {
            saveSecurityNetworkInfo(data.ip, data.org || data.asn || 'tidak tersedia');
        })
        .catch(function() {
            fetch('https://ipwho.is/')
                .then(function(response) {
                    if (!response.ok) throw new Error('ipwhois gagal');
                    return response.json();
                })
                .then(function(data) {
                    var isp = data.connection && (data.connection.isp || data.connection.org);
                    saveSecurityNetworkInfo(data.ip, isp || 'tidak tersedia');
                })
                .catch(function() {
                    saveSecurityNetworkInfo('tidak tersedia', 'tidak tersedia');
                });
        });
}

function resetComposerInputs() {
    var input = document.getElementById('postInput');
    var commInput = document.getElementById('communityPostInput');
    var preview = document.getElementById('post-preview-img');
    var commPreview = document.getElementById('community-post-preview-img');
    var mediaInput = document.getElementById('mediaUpload');
    var commMediaInput = document.getElementById('communityMediaUpload');

    if (input) input.value = '';
    if (commInput) commInput.value = '';
    if (preview) preview.style.display = 'none';
    if (commPreview) commPreview.style.display = 'none';
    if (mediaInput) mediaInput.value = '';
    if (commMediaInput) commMediaInput.value = '';

    postMedia = null;
    postMediaType = null;
}

function purgeXSSAttemptsFromStorage() {
    var changedFeed = false;
    if (Array.isArray(feedPosts)) {
        var cleanFeed = [];
        for (var i = 0; i < feedPosts.length; i++) {
            if (postHasXSSAttempt(feedPosts[i])) {
                changedFeed = true;
            } else {
                cleanFeed.push(feedPosts[i]);
            }
        }
        feedPosts = cleanFeed;
    }

    var changedCommunity = false;
    if (communityPosts) {
        for (var commId in communityPosts) {
            var posts = Array.isArray(communityPosts[commId]) ? communityPosts[commId] : [];
            var cleanPosts = [];
            for (var j = 0; j < posts.length; j++) {
                if (postHasXSSAttempt(posts[j])) {
                    changedCommunity = true;
                } else {
                    cleanPosts.push(posts[j]);
                }
            }
            communityPosts[commId] = cleanPosts;
        }
    }

    if (changedFeed && typeof saveFeedPosts === 'function') saveFeedPosts();
    if (changedCommunity && typeof saveCommunityPosts === 'function') saveCommunityPosts();
}

function purgeLikeSpikePostsFromStorage() {
    var changedFeed = false;
    if (Array.isArray(feedPosts)) {
        var cleanFeed = [];
        for (var i = 0; i < feedPosts.length; i++) {
            if (hasLikeSpike(feedPosts[i])) {
                banPostOwnerForLikeSpike(feedPosts[i]);
                changedFeed = true;
            } else {
                cleanFeed.push(feedPosts[i]);
            }
        }
        feedPosts = cleanFeed;
    }

    var changedCommunity = false;
    if (communityPosts) {
        for (var commId in communityPosts) {
            var posts = Array.isArray(communityPosts[commId]) ? communityPosts[commId] : [];
            var cleanPosts = [];
            for (var j = 0; j < posts.length; j++) {
                if (hasLikeSpike(posts[j])) {
                    banPostOwnerForLikeSpike(posts[j]);
                    changedCommunity = true;
                } else {
                    cleanPosts.push(posts[j]);
                }
            }
            communityPosts[commId] = cleanPosts;
        }
    }

    if (changedFeed && typeof saveFeedPosts === 'function') saveFeedPosts();
    if (changedCommunity && typeof saveCommunityPosts === 'function') saveCommunityPosts();
}

function showSecurityBanScreen() {
    if (!document.body) return;

    var banData = getSecurityBanData() || {};
    var expiresAt = parseInt(banData.expiresAt, 10) || getSecurityBanExpiry(banData.createdAt);
    var expiresDate = new Date(expiresAt);
    document.body.innerHTML =
        '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f0f2f5;font-family:Tahoma,Arial,sans-serif;padding:20px;">' +
            '<div style="width:min(520px,100%);background:white;border:1px solid #d8dfea;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,.12);padding:22px;text-align:center;">' +
                '<div style="font-size:42px;margin-bottom:10px;">🚫✋</div>' +
                '<h1 style="font-size:20px;color:#b00020;margin:0 0 10px;">Akun Diblokir</h1>' +
                '<p style="font-size:13px;line-height:1.5;color:#333;margin:0 0 12px;">' + escapeHtml(getSecurityBanMessage(banData)) + '</p>' +
                '<div id="security-ban-timer" style="font-size:13px;font-weight:bold;color:#b00020;margin-bottom:8px;"></div>' +
                '<div style="font-size:12px;color:#555;margin-bottom:12px;">Ban berakhir: ' + escapeHtml(expiresDate.toLocaleString('id-ID')) + '</div>' +
                '<div style="font-size:11px;color:#777;border-top:1px solid #edf0f5;padding-top:10px;">ID blokir: ' + escapeHtml(banData.clientId || 'local-browser') + '<span id="security-network-info">' + escapeHtml(getSecurityNetworkText(banData)) + '</span></div>' +
            '</div>' +
        '</div>';
    startSecurityBanCountdown(expiresAt);
    fetchSecurityNetworkInfo();
}

function formatRemainingBanTime(ms) {
    if (ms <= 0) return '0 menit';

    var totalMinutes = Math.ceil(ms / 60000);
    var days = Math.floor(totalMinutes / 1440);
    var hours = Math.floor((totalMinutes % 1440) / 60);
    var minutes = totalMinutes % 60;
    var parts = [];

    if (days > 0) parts.push(days + ' hari');
    if (hours > 0) parts.push(hours + ' jam');
    if (minutes > 0 || parts.length === 0) parts.push(minutes + ' menit');

    return parts.join(' ');
}

function startSecurityBanCountdown(expiresAt) {
    if (securityBanCountdownTimer) clearInterval(securityBanCountdownTimer);

    function updateTimer() {
        var timerEl = document.getElementById('security-ban-timer');
        var remaining = expiresAt - Date.now();

        if (remaining <= 0) {
            localStorage.removeItem(SECURITY_BAN_KEY);
            if (securityBanCountdownTimer) clearInterval(securityBanCountdownTimer);
            location.reload();
            return;
        }

        if (timerEl) {
            timerEl.textContent = 'Sisa waktu ban: ' + formatRemainingBanTime(remaining);
        }
    }

    updateTimer();
    securityBanCountdownTimer = setInterval(updateTimer, 60000);
}

function enforceSecurityBan() {
    if (!isSecurityBanned()) return false;
    showSecurityBanScreen();
    return true;
}

function triggerSecurityBan(reason) {
    resetComposerInputs();
    purgeXSSAttemptsFromStorage();
    var banData = setSecurityBan(reason);
    alert(getSecurityBanMessage(banData));
    showSecurityBanScreen();
}

function rejectXSSPayload(source) {
    purgeXSSAttemptsFromStorage();
    console.warn('[Security] Payload XSS ditolak dari ' + (source || 'unknown'));
    if (typeof showToast === 'function') {
        showToast('🚫 Payload XSS ditolak dan dihapus.');
    }
}

// ===== STORAGE HELPERS =====
function loadStoredJSON(key, fallback) {
    try {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        console.warn('Gagal membaca data ' + key + ', memakai default:', e);
        return fallback;
    }
}

function saveStoredJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.warn('Gagal menyimpan data ' + key + ':', e);
        if (typeof showToast === 'function') {
            showToast('⚠️ Data terlalu besar atau browser menolak penyimpanan.');
        }
        return false;
    }
}

function createLocalId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

function getOrCreateStoredValue(key, prefix) {
    var value = localStorage.getItem(key);
    if (!value) {
        value = createLocalId(prefix);
        localStorage.setItem(key, value);
    }
    return value;
}

function findPostIndexById(posts, postId) {
    if (!Array.isArray(posts)) return -1;
    for (var i = 0; i < posts.length; i++) {
        if (String(posts[i].id) === String(postId)) return i;
    }
    return -1;
}

// ... [SISA FUNGSI script.js SEBELUMNYA] ...
// (Fungsi-fungsi UI, Peer.js, Navigasi, dll tetap ada di sini)

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
    saveStoredJSON('yaping_communities', communities);
}

function saveCommunityPosts() {
    saveStoredJSON('yaping_communityPosts', communityPosts);
}

function saveJoinedCommunities() {
    saveStoredJSON('yaping_joinedCommunities', joinedCommunities);
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

// ===== MODAL =====
function closeModal() {
    var modal = document.getElementById('modal-overlay');
    if (modal) modal.classList.add('hidden');
}

// ============================================
// YAPING DB PATCH - Tambahkan di akhir script.js
// atau simpan sebagai db-patch.js dan load setelah script.js di index.html
// ============================================

(function() {
    // ===== PATCH DOMContentLoaded =====
    // Jalankan dbInit setelah semua inisialisasi script.js selesai
    var _originalDCL = document.addEventListener;
    
    // Hook ke window.onload supaya jalan setelah DOMContentLoaded script.js
    window.addEventListener('load', function() {
        // Install save hooks
        if (typeof dbInstallHooks === 'function') dbInstallHooks();
        
        // Start DB sync
        if (typeof dbInit === 'function') {
            dbInit().then(function() {
                var dbStatus = document.getElementById('db-status-value');
                if (dbStatus) {
                    dbStatus.textContent = 'Terhubung ✅';
                    dbStatus.style.color = '#27ae60';
                }
            }).catch(function(e) {
                var dbStatus = document.getElementById('db-status-value');
                if (dbStatus) {
                    dbStatus.textContent = 'Gagal ❌';
                    dbStatus.style.color = '#c0392b';
                }
                console.warn('[DB] Init failed:', e);
            });
        }
    });

    // ===== PATCH submitPost =====
    var _origSubmitPost = window.submitPost;
    window.submitPost = function() {
        var prevLen = feedPosts.length;
        if (typeof _origSubmitPost === 'function') _origSubmitPost();
        // If a new post was added, sync it
        if (feedPosts.length > prevLen && (typeof dbReady !== 'undefined' && dbReady)) {
            dbSyncPost(feedPosts[0], false);
        }
    };

    // ===== PATCH submitCommunityPost =====
    var _origSubmitCommunityPost = window.submitCommunityPost;
    window.submitCommunityPost = function(commId) {
        var prevLen = communityPosts[commId] ? communityPosts[commId].length : 0;
        if (typeof _origSubmitCommunityPost === 'function') _origSubmitCommunityPost(commId);
        if (communityPosts[commId] && communityPosts[commId].length > prevLen && (typeof dbReady !== 'undefined' && dbReady)) {
            dbSyncCommunityPost(communityPosts[commId][0], false);
        }
    };

    // ===== PATCH deleteFeedPost =====
    var _origDeleteFeedPost = window.deleteFeedPost;
    window.deleteFeedPost = function(postId) {
        var idx = findPostIndexById(feedPosts, postId);
        var post = idx !== -1 ? feedPosts[idx] : null;
        if (typeof _origDeleteFeedPost === 'function') _origDeleteFeedPost(postId);
        if (post && (typeof dbReady !== 'undefined' && dbReady)) dbSyncPost(post, true);
    };

    // ===== PATCH deleteCommunityPost =====
    var _origDeleteCommunityPost = window.deleteCommunityPost;
    window.deleteCommunityPost = function(commId, postId) {
        var posts = communityPosts[commId] || [];
        var idx = findPostIndexById(posts, postId);
        var post = idx !== -1 ? posts[idx] : null;
        if (typeof _origDeleteCommunityPost === 'function') _origDeleteCommunityPost(commId, postId);
        if (post && (typeof dbReady !== 'undefined' && dbReady)) dbSyncCommunityPost(post, true);
    };

    // ===== PATCH likeFeedPost =====
    var _origLikeFeedPost = window.likeFeedPost;
    window.likeFeedPost = function(postId) {
        if (typeof _origLikeFeedPost === 'function') _origLikeFeedPost(postId);
        if (typeof dbReady !== 'undefined' && dbReady) {
            var idx = findPostIndexById(feedPosts, postId);
            if (idx !== -1) dbSyncPost(feedPosts[idx], false);
        }
    };

    // ===== PATCH likeCommunityPost =====
    var _origLikeCommunityPost = window.likeCommunityPost;
    window.likeCommunityPost = function(commId, postId) {
        if (typeof _origLikeCommunityPost === 'function') _origLikeCommunityPost(commId, postId);
        if ((typeof dbReady !== 'undefined' && dbReady) && communityPosts[commId]) {
            var idx = findPostIndexById(communityPosts[commId], postId);
            if (idx !== -1) dbSyncCommunityPost(communityPosts[commId][idx], false);
        }
    };

    // ===== PATCH submitComment =====
    var _origSubmitComment = window.submitComment;
    window.submitComment = function(postId, scope, commId) {
        if (typeof _origSubmitComment === 'function') _origSubmitComment(postId, scope, commId);
        if (typeof dbReady === 'undefined' || !dbReady) return;
        if (scope === 'community' && commId) {
            var posts = communityPosts[commId] || [];
            var idx = findPostIndexById(posts, postId);
            if (idx !== -1) dbSyncCommunityPost(posts[idx], false);
        } else {
            var fidx = findPostIndexById(feedPosts, postId);
            if (fidx !== -1) dbSyncPost(feedPosts[fidx], false);
        }
    };

    // ===== PATCH addCommunity =====
    var _origAddCommunity = window.addCommunity;
    window.addCommunity = function() {
        var prevLen = communities.length;
        if (typeof _origAddCommunity === 'function') _origAddCommunity();
        if (communities.length > prevLen && (typeof dbReady !== 'undefined' && dbReady)) {
            dbSyncCommunity(communities[0], false);
        }
    };

    // ===== PATCH deleteCommunity =====
    var _origDeleteCommunity = window.deleteCommunity;
    window.deleteCommunity = function(commId) {
        var comm = null;
        for (var i = 0; i < communities.length; i++) {
            if (communities[i].id === commId) { comm = communities[i]; break; }
        }
        if (typeof _origDeleteCommunity === 'function') _origDeleteCommunity(commId);
        if (comm && (typeof dbReady !== 'undefined' && dbReady)) {
            dbSyncCommunity(comm, true);
            // Also delete all community posts from DB
            if (typeof sbDelete === 'function') sbDelete('community_posts', 'community_id', commId);
        }
    };

    console.log('[DB Patch] Hooks installed.');
})();
