// ============================================
// 🚀 YAPING SOCIAL NETWORK - script.js
// Facebook 2008 Style Compatible - Anti-XSS Protected
// ============================================

// ===== SECURITY FUNCTIONS (ANTI-XSS) =====
var USERNAME_MAX_LENGTH = 20;
var LIKE_SPIKE_LIMIT = 50000000;
var ACCOUNT_BANS_KEY = 'yaping_accountBans';
var SECURITY_BAN_KEY = 'yaping_securityBan';
var SECURITY_BAN_MESSAGE = 'Akun anda resmi di ban dari Yaping selama 2 bulan karena anda mencoba XSS injection. IP address anda diblokir oleh server.';
var LIKE_SPIKE_BAN_MESSAGE = 'Akun anda resmi di ban dari Yaping selama 2 bulan karena post anda mendapatkan 50 juta like secara tiba-tiba.';
var SECURITY_BAN_MONTHS = 2;
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
        showToast('🚫 Post dihapus. Pemilik akun diban 2 bulan karena like mencurigakan.');
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

function makePeerUsername(id) {
    var clean = String(id || createLocalId('peer'))
        .toLowerCase()
        .replace(/^yaping-/, '')
        .replace(/^client-/, '')
        .replace(/^peer-/, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    
    var parts = clean.split('-').filter(Boolean);
    var shortName = parts.slice(0, 2).join('-') || clean.substring(0, 12) || 'local';
    return '@peer-' + shortName;
}

// ===== DATA & STATE =====
let communities = loadStoredJSON('yaping_communities', [
    { id: 1, name: '🎮 Gaming Indonesia', desc: 'Komunitas gamer Indonesia', category: '🎮', members: 128, owner: '@user', createdAt: Date.now(), banner: '#4472CA' },
    { id: 2, name: '💻 Teknologi Update', desc: 'Berita tech terbaru', category: '💻', members: 256, owner: '@admin', createdAt: Date.now() - 86400000, banner: '#70AD47' },
    { id: 3, name: '😂 Meme Lucu', desc: 'Kumpulan meme terbaik', category: '😂', members: 512, owner: '@memeLord', createdAt: Date.now() - 172800000, banner: '#FFC000' }
]);

let communityPosts = loadStoredJSON('yaping_communityPosts', {});
let joinedCommunities = loadStoredJSON('yaping_joinedCommunities', [1]);
let feedPosts = loadStoredJSON('yaping_feedPosts', []);
let lastCommunityCreate = localStorage.getItem('yaping_lastCommCreate') || 0;
let emojiTargetInput = 'postInput';
let currentViewedCommunity = null;
let communityBeingEdited = null;
let postMedia = null;
let postMediaType = null; // 'image', 'audio', 'video'
let openComments = {}; // postId -> boolean, melacak komentar yang sedang terbuka
let badgedUsers = new Set(); // username yang memiliki badge resmi

// ===== BADGE SYSTEM =====
function loadBadgeList() {
    badgedUsers.clear();

    // Baca dari badge.js (variable global YAPING_BADGE_USERS)
    var list = (typeof YAPING_BADGE_USERS !== 'undefined') ? YAPING_BADGE_USERS : [];
    for (var i = 0; i < list.length; i++) {
        var u = list[i].trim();
        if (u) badgedUsers.add(u);
    }

    if (badgedUsers.size > 0) {
        console.log('[Badge] Dimuat untuk: ' + Array.from(badgedUsers).join(', '));
        // Re-render supaya badge langsung tampil
        renderFeed();
        renderCommunities('all');
        if (currentViewedCommunity) {
            var feedEl = document.getElementById('comm-posts-feed');
            if (feedEl) feedEl.innerHTML = renderCommunityPosts(currentViewedCommunity);
        }
        updateProfileStats();
    }
}

function getBadgeHTML(username) {
    if (!username || !badgedUsers.has(username)) return '';
    return '<img src="badge.png" class="official-badge" title="Akun Resmi" alt="✓">';
}

function getUserDisplayHTML(username) {
    return '<span class="username-with-badge">' +
        escapeHtml(username) +
        getBadgeHTML(username) +
    '</span>';
}
let localClientId = getOrCreateStoredValue('yaping_clientId', 'client');
let preferredPeerId = localStorage.getItem('yaping_preferredPeerId') || ('yaping-' + localClientId.replace(/[^a-zA-Z0-9-]/g, ''));
let storedCurrentUser = localStorage.getItem('yaping_currentUser');
let currentUser = (!storedCurrentUser || storedCurrentUser === '@user') ? makePeerUsername(preferredPeerId) : storedCurrentUser;
let currentFullname = localStorage.getItem('yaping_currentFullname') || 'Pengguna Yaping';
let currentBio = localStorage.getItem('yaping_currentBio') || '';
let currentUserPhoto = localStorage.getItem('yaping_currentUserPhoto') || ''; // Base64 encoded image

// Peer.js Configuration
let peer = null;
let peerId = null;
let connections = {};
let pendingConnections = {};
let activeConnections = loadStoredJSON('yaping_activeConnections', []);
let knownPeerIds = loadStoredJSON('yaping_knownPeerIds', []);
let peerFallbackStarted = false;
let peerReady = false;
let currentPeerOptions = {};
let bootstrapPeer = null;
let bootstrapSlotId = null;
let bootstrapReady = false;
let bootstrapDiscoveryStarted = false;
let bootstrapRetryInterval = null;
let bootstrapStatus = 'menunggu';
let bootstrapClaimInProgress = false;

// Slot publik ini jadi "ruang temu" otomatis. Tidak perlu input Peer ID manual.
let bootstrapRoomName = 'yaping-public-room-2026-v2';
let bootstrapSlotCount = 12;

// Hashtags tracking
let allHashtags = new Set();

// Auto-connect interval
let autoConnectInterval = null;

purgeXSSAttemptsFromStorage();
purgeLikeSpikePostsFromStorage();
feedPosts = normalizeFeedPosts(feedPosts);
communityPosts = normalizeCommunityPosts(communityPosts);
migrateDefaultUserIdentity();
rebuildHashtags();

// ===== INISIALISASI =====
document.addEventListener('DOMContentLoaded', function() {
    if (enforceSecurityBan()) return;

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
    renderRightSidebar();
    updateProfileStats();
    renderProfileAvatar();
    renderSidebarProfilePic();

    var editUsernameInput = document.getElementById('edit-username');
    if (editUsernameInput) editUsernameInput.maxLength = USERNAME_MAX_LENGTH;

    // Initialize Peer.js setelah UI lokal tampil, supaya feed tetap muncul walau CDN/server online lambat.
    initializePeer();
    
    // Muat daftar badge resmi dari badge.env
    loadBadgeList();
    
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

// ===== POST DATA HELPERS =====
function normalizePost(raw, scope, communityId) {
    if (!raw || (!raw.content && !raw.photo && !raw.media)) return null;
    if (postHasXSSAttempt(raw)) return null;
    if (isAccountLocallyBanned(raw.author || raw.fromUser)) return null;
    if (hasLikeSpike(raw)) {
        banPostOwnerForLikeSpike(raw);
        return null;
    }
    
    var createdAt = parseInt(raw.createdAt, 10);
    if (!createdAt || isNaN(createdAt)) createdAt = Date.now();
    
    var likes = parseInt(raw.likes, 10);
    if (isNaN(likes) || likes < 0) likes = 0;
    
    var post = {
        id: raw.id || raw.postId || createLocalId(scope || 'post'),
        author: raw.author || raw.fromUser || '@teman',
        content: raw.content || '',
        likes: likes,
        likedBy: Array.isArray(raw.likedBy) ? raw.likedBy : [],
        createdAt: createdAt,
        photo: raw.photo || null,
        media: raw.media || null,
        mediaType: raw.mediaType || null,
        originPeerId: raw.originPeerId || raw.fromPeerId || null,
        scope: scope || raw.scope || 'feed',
        comments: []
    };

    if (Array.isArray(raw.comments)) {
        for (var c = 0; c < raw.comments.length; c++) {
            if (!commentHasXSSAttempt(raw.comments[c])) {
                post.comments.push(raw.comments[c]);
            }
        }
    }
    
    if (communityId !== undefined && communityId !== null) {
        post.communityId = parseInt(communityId, 10);
    } else if (raw.communityId !== undefined && raw.communityId !== null) {
        post.communityId = parseInt(raw.communityId, 10);
    }
    
    return post;
}

function findPostIndexById(posts, postId) {
    if (!Array.isArray(posts)) return -1;
    for (var i = 0; i < posts.length; i++) {
        if (String(posts[i].id) === String(postId)) return i;
    }
    return -1;
}

function normalizeFeedPosts(posts) {
    if (!Array.isArray(posts)) return [];
    
    var normalized = [];
    for (var i = 0; i < posts.length; i++) {
        var post = normalizePost(posts[i], 'feed');
        if (post && findPostIndexById(normalized, post.id) === -1) {
            normalized.push(post);
        }
    }
    
    normalized.sort(function(a, b) {
        return b.createdAt - a.createdAt;
    });
    return normalized;
}

function normalizeCommunityPosts(postsByCommunity) {
    var normalized = {};
    postsByCommunity = postsByCommunity || {};
    
    for (var commId in postsByCommunity) {
        var list = Array.isArray(postsByCommunity[commId]) ? postsByCommunity[commId] : [];
        normalized[commId] = [];
        
        for (var i = 0; i < list.length; i++) {
            var post = normalizePost(list[i], 'community', commId);
            if (post && findPostIndexById(normalized[commId], post.id) === -1) {
                normalized[commId].push(post);
            }
        }
        
        normalized[commId].sort(function(a, b) {
            return b.createdAt - a.createdAt;
        });
    }
    
    return normalized;
}

function saveFeedPosts() {
    saveStoredJSON('yaping_feedPosts', feedPosts);
}

function upsertFeedPost(post, shouldRender) {
    if (postHasXSSAttempt(post)) {
        rejectXSSPayload('feed-post');
        return false;
    }
    if (isAccountLocallyBanned(post && (post.author || post.fromUser))) return false;
    if (hasLikeSpike(post)) {
        handleLikeSpikePost(post, 'feed', null, true);
        return false;
    }

    post = normalizePost(post, 'feed');
    if (!post) return false;
    
    if (findPostIndexById(feedPosts, post.id) !== -1) {
        return false;
    }
    
    feedPosts.unshift(post);
    feedPosts.sort(function(a, b) {
        return b.createdAt - a.createdAt;
    });
    saveFeedPosts();
    rebuildHashtags();
    
    if (shouldRender !== false) {
        renderFeed();
        renderMyPosts();
        updateProfileStats();
        renderRightSidebar();
    }
    
    return true;
}

function upsertCommunityPost(commId, post, shouldRender) {
    if (postHasXSSAttempt(post)) {
        rejectXSSPayload('community-post');
        return false;
    }
    if (isAccountLocallyBanned(post && (post.author || post.fromUser))) return false;
    if (hasLikeSpike(post)) {
        handleLikeSpikePost(post, 'community', commId, true);
        return false;
    }

    post = normalizePost(post, 'community', commId);
    if (!post) return false;
    
    if (!communityPosts[commId]) {
        communityPosts[commId] = [];
    }
    
    if (findPostIndexById(communityPosts[commId], post.id) !== -1) {
        return false;
    }
    
    communityPosts[commId].unshift(post);
    communityPosts[commId].sort(function(a, b) {
        return b.createdAt - a.createdAt;
    });
    saveCommunityPosts();
    rebuildHashtags();
    
    if (shouldRender !== false) {
        if (currentViewedCommunity === parseInt(commId, 10)) {
            var feedEl = document.getElementById('comm-posts-feed');
            if (feedEl) feedEl.innerHTML = renderCommunityPosts(parseInt(commId, 10));
        }
        renderMyPosts();
        updateProfileStats();
        renderRightSidebar();
    }
    
    return true;
}

function mergeFeedPosts(posts) {
    if (!Array.isArray(posts)) return 0;
    
    var added = 0;
    for (var i = 0; i < posts.length; i++) {
        var incoming = posts[i];
        if (!incoming) continue;
        var existingIdx = findPostIndexById(feedPosts, incoming.id);
        if (existingIdx !== -1 && hasLikeSpike(incoming)) {
            feedPosts[existingIdx].likes = parseInt(incoming.likes, 10);
            handleLikeSpikePost(feedPosts[existingIdx], 'feed', null, true);
            continue;
        }
        if (upsertFeedPost(incoming, false)) added++;
    }
    
    if (added > 0) {
        renderFeed();
        renderMyPosts();
        updateProfileStats();
        renderRightSidebar();
    }
    return added;
}

function mergeCommunityPosts(postsByCommunity) {
    if (!postsByCommunity) return 0;
    
    var added = 0;
    for (var commId in postsByCommunity) {
        var list = postsByCommunity[commId];
        if (!Array.isArray(list)) continue;
        
        for (var i = 0; i < list.length; i++) {
            var incoming = list[i];
            if (!incoming) continue;
            if (!communityPosts[commId]) communityPosts[commId] = [];
            var existingIdx = findPostIndexById(communityPosts[commId], incoming.id);
            if (existingIdx !== -1 && hasLikeSpike(incoming)) {
                communityPosts[commId][existingIdx].likes = parseInt(incoming.likes, 10);
                handleLikeSpikePost(communityPosts[commId][existingIdx], 'community', commId, true);
                continue;
            }
            if (upsertCommunityPost(commId, incoming, false)) added++;
        }
    }
    
    if (added > 0) {
        if (currentViewedCommunity) {
            var feedEl = document.getElementById('comm-posts-feed');
            if (feedEl) feedEl.innerHTML = renderCommunityPosts(currentViewedCommunity);
        }
        renderMyPosts();
        updateProfileStats();
        renderRightSidebar();
    }
    return added;
}

// Merge posts DAN komentar dari peer (dipakai saat sync hello)
function mergeCommentsIntoPost(localPost, incomingComments) {
    if (!Array.isArray(incomingComments) || incomingComments.length === 0) return false;
    if (!Array.isArray(localPost.comments)) localPost.comments = [];
    var changed = false;
    for (var i = 0; i < incomingComments.length; i++) {
        var ic = incomingComments[i];
        if (!ic || !ic.id) continue;
        if (commentHasXSSAttempt(ic)) {
            rejectXSSPayload('comment-sync');
            continue;
        }
        var found = false;
        for (var j = 0; j < localPost.comments.length; j++) {
            if (localPost.comments[j].id === ic.id) { found = true; break; }
        }
        if (!found) {
            localPost.comments.push(ic);
            changed = true;
        }
    }
    return changed;
}

function mergeFeedPostsWithComments(posts) {
    if (!Array.isArray(posts)) return 0;
    var added = 0;
    var commentsMerged = false;
    for (var i = 0; i < posts.length; i++) {
        var incoming = posts[i];
        if (!incoming) continue;
        var existingIdx = findPostIndexById(feedPosts, incoming.id);
        if (existingIdx === -1) {
            // Post baru, tambahkan
            if (upsertFeedPost(incoming, false)) added++;
        } else {
            if (hasLikeSpike(incoming)) {
                feedPosts[existingIdx].likes = parseInt(incoming.likes, 10);
                handleLikeSpikePost(feedPosts[existingIdx], 'feed', null, true);
                continue;
            }
            // Post sudah ada - merge komentarnya saja
            if (mergeCommentsIntoPost(feedPosts[existingIdx], incoming.comments)) {
                commentsMerged = true;
            }
        }
    }
    if (added > 0 || commentsMerged) {
        if (commentsMerged) saveFeedPosts();
        renderFeed();
        renderMyPosts();
        updateProfileStats();
        renderRightSidebar();
    }
    return added;
}

function mergeCommunityPostsWithComments(postsByCommunity) {
    if (!postsByCommunity) return 0;
    var added = 0;
    var commentsMerged = false;
    for (var commId in postsByCommunity) {
        var list = postsByCommunity[commId];
        if (!Array.isArray(list)) continue;
        for (var i = 0; i < list.length; i++) {
            var incoming = list[i];
            if (!incoming) continue;
            if (!communityPosts[commId]) communityPosts[commId] = [];
            var existingIdx = findPostIndexById(communityPosts[commId], incoming.id);
            if (existingIdx === -1) {
                if (upsertCommunityPost(commId, incoming, false)) added++;
            } else {
                if (hasLikeSpike(incoming)) {
                    communityPosts[commId][existingIdx].likes = parseInt(incoming.likes, 10);
                    handleLikeSpikePost(communityPosts[commId][existingIdx], 'community', commId, true);
                    continue;
                }
                if (mergeCommentsIntoPost(communityPosts[commId][existingIdx], incoming.comments)) {
                    commentsMerged = true;
                }
            }
        }
    }
    if (added > 0 || commentsMerged) {
        if (commentsMerged) saveCommunityPosts();
        if (currentViewedCommunity) {
            var feedEl = document.getElementById('comm-posts-feed');
            if (feedEl) feedEl.innerHTML = renderCommunityPosts(currentViewedCommunity);
        }
        renderMyPosts();
        updateProfileStats();
        renderRightSidebar();
    }
    return added;
}

function removeDeletedPost(data) {
    if (!data || !data.postId) return false;
    
    var removed = false;
    if (data.scope === 'community') {
        var commId = data.communityId;
        var posts = communityPosts[commId] || [];
        var index = findPostIndexById(posts, data.postId);
        if (index !== -1) {
            if (data.originPeerId && posts[index].originPeerId && data.originPeerId !== posts[index].originPeerId) {
                return false;
            }
            posts.splice(index, 1);
            saveCommunityPosts();
            removed = true;
            
            if (currentViewedCommunity === parseInt(commId, 10)) {
                var feedEl = document.getElementById('comm-posts-feed');
                if (feedEl) feedEl.innerHTML = renderCommunityPosts(parseInt(commId, 10));
            }
        }
    } else {
        var feedIndex = findPostIndexById(feedPosts, data.postId);
        if (feedIndex !== -1) {
            if (data.originPeerId && feedPosts[feedIndex].originPeerId && data.originPeerId !== feedPosts[feedIndex].originPeerId) {
                return false;
            }
            feedPosts.splice(feedIndex, 1);
            saveFeedPosts();
            renderFeed();
            removed = true;
        }
    }
    
    if (removed) {
        rebuildHashtags();
        renderMyPosts();
        updateProfileStats();
        renderRightSidebar();
    }
    
    return removed;
}

function mergeCommunities(incomingCommunities) {
    if (!Array.isArray(incomingCommunities)) return 0;
    
    var added = 0;
    for (var i = 0; i < incomingCommunities.length; i++) {
        var incoming = incomingCommunities[i];
        if (!incoming || incoming.id === undefined || incoming.id === null) continue;
        
        var exists = false;
        for (var j = 0; j < communities.length; j++) {
            if (String(communities[j].id) === String(incoming.id)) {
                exists = true;
                break;
            }
        }
        
        if (!exists) {
            communities.unshift(incoming);
            added++;
        }
    }
    
    if (added > 0) {
        saveCommunities();
        renderCommunities('all');
        renderRightSidebar();
    }
    return added;
}

function rebuildHashtags() {
    allHashtags.clear();
    
    for (var i = 0; i < feedPosts.length; i++) {
        collectHashtags(feedPosts[i].content);
    }
    
    for (var commId in communityPosts) {
        var posts = communityPosts[commId] || [];
        for (var j = 0; j < posts.length; j++) {
            collectHashtags(posts[j].content);
        }
    }
}

function collectHashtags(text) {
    if (!text) return;
    var matches = text.match(/#[a-zA-Z0-9_]+/g);
    if (!matches) return;
    
    for (var i = 0; i < matches.length; i++) {
        allHashtags.add(matches[i]);
    }
}

function jsString(value) {
    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function isOwnPost(post) {
    if (!post) return false;
    if (currentUser && badgedUsers.has(currentUser)) return true;
    return post.author === currentUser ||
        post.originPeerId === peerId ||
        post.originPeerId === localClientId ||
        post.originPeerId === preferredPeerId;
}

function migrateDefaultUserIdentity() {
    if (currentUser === '@user') return;
    
    var changedFeed = false;
    for (var i = 0; i < feedPosts.length; i++) {
        if (feedPosts[i].author === '@user') {
            feedPosts[i].author = currentUser;
            feedPosts[i].originPeerId = feedPosts[i].originPeerId || localClientId;
            changedFeed = true;
        }
        if (Array.isArray(feedPosts[i].likedBy)) {
            var likedIndex = feedPosts[i].likedBy.indexOf('@user');
            if (likedIndex !== -1) {
                feedPosts[i].likedBy[likedIndex] = currentUser;
                changedFeed = true;
            }
        }
    }
    
    var changedCommunityPosts = false;
    for (var commId in communityPosts) {
        var posts = communityPosts[commId] || [];
        for (var p = 0; p < posts.length; p++) {
            if (posts[p].author === '@user') {
                posts[p].author = currentUser;
                posts[p].originPeerId = posts[p].originPeerId || localClientId;
                changedCommunityPosts = true;
            }
            if (Array.isArray(posts[p].likedBy)) {
                var communityLikedIndex = posts[p].likedBy.indexOf('@user');
                if (communityLikedIndex !== -1) {
                    posts[p].likedBy[communityLikedIndex] = currentUser;
                    changedCommunityPosts = true;
                }
            }
        }
    }
    
    var changedCommunities = false;
    for (var c = 0; c < communities.length; c++) {
        if (communities[c].owner === '@user') {
            communities[c].owner = currentUser;
            changedCommunities = true;
        }
    }
    
    localStorage.setItem('yaping_currentUser', currentUser);
    if (changedFeed) saveFeedPosts();
    if (changedCommunityPosts) saveCommunityPosts();
    if (changedCommunities) saveCommunities();
}

// ===== PEER.JS FUNCTIONS =====
function initializePeer() {
    if (typeof Peer === 'undefined') {
        console.warn('Peer.js belum dimuat. Feed lokal tetap berjalan.');
        renderRightSidebar();
        showToast('⚠️ Mode online belum siap. Post lokal tetap tersimpan.');
        return;
    }
    
    // Pakai PeerJS public cloud supaya semua pengunjung website masuk jaringan Yaping yang sama.
    createPeerInstance({}, false);
}

function createPeerInstance(options, allowFallback) {
    try {
        peerReady = false;
        currentPeerOptions = options || {};
        peer = new Peer(preferredPeerId, options || {});
        attachPeerEvents(allowFallback);
        renderRightSidebar();
    } catch (e) {
        console.log('Gagal membuat peer:', e);
        if (allowFallback) {
            createPublicPeer();
        }
    }
}

function attachPeerEvents(allowFallback) {
    peer.on('open', function(id) {
        peerId = id;
        peerReady = true;
        preferredPeerId = id;
        localStorage.setItem('yaping_preferredPeerId', id);
        console.log('Peer ID: ' + id);
        broadcastPeerId();
        startAutoConnect();
        startBootstrapDiscovery();
        renderRightSidebar();
        showToast('✅ Online siap: ' + id);
    });
    
    peer.on('connection', handleIncomingConnection);
    
    peer.on('error', function(err) {
        console.log('Peer error:', err);
        
        if (err && err.type === 'unavailable-id') {
            preferredPeerId = 'yaping-' + createLocalId('peer').replace(/[^a-zA-Z0-9-]/g, '');
            localStorage.setItem('yaping_preferredPeerId', preferredPeerId);
            createPeerInstance({}, allowFallback);
            return;
        }
        
        if (!peerReady && allowFallback && !peerFallbackStarted) {
            createPublicPeer();
            return;
        }
        
        renderRightSidebar();
    });
    
    peer.on('disconnected', function() {
        peerReady = false;
        renderRightSidebar();
    });
    
    peer.on('close', function() {
        peerReady = false;
        renderRightSidebar();
    });
}

function createPublicPeer() {
    peerFallbackStarted = true;
    try {
        if (peer && !peer.destroyed) peer.destroy();
    } catch (e) {
        console.log('Gagal menutup peer lokal:', e);
    }
    
    console.log('Local peer server unavailable, using public server');
    createPeerInstance({}, false);
}

function broadcastPeerId() {
    // Store peer ID di local storage untuk auto-discovery
    if (peerId) {
        localStorage.setItem('yaping_myPeerId', peerId);
        // Notify connected peers
        broadcastPeerMessage({
            type: 'peer-id',
            peerId: peerId,
            user: currentUser
        });
    }
}

function startAutoConnect() {
    // Auto-connect ke known peers secara berkala
    if (autoConnectInterval) clearInterval(autoConnectInterval);
    
    connectToKnownPeers();
    autoConnectInterval = setInterval(function() {
        connectToKnownPeers();
        broadcastPeerMessage({
            type: 'peer-list',
            knownPeerIds: getShareablePeerIds()
        });
    }, 5000); // Coba setiap 5 detik
}

function startBootstrapDiscovery() {
    if (bootstrapDiscoveryStarted || !peerReady) return;
    
    bootstrapDiscoveryStarted = true;
    bootstrapStatus = 'mencari jaringan';
    connectToBootstrapSlots();
    claimBootstrapSlot(0);
    
    if (bootstrapRetryInterval) clearInterval(bootstrapRetryInterval);
    bootstrapRetryInterval = setInterval(function() {
        connectToBootstrapSlots();
        if (!bootstrapReady) {
            claimBootstrapSlot(0);
        }
        renderRightSidebar();
    }, 15000);
    
    renderRightSidebar();
}

function getBootstrapSlotIds() {
    var ids = [];
    for (var i = 1; i <= bootstrapSlotCount; i++) {
        ids.push(bootstrapRoomName + '-' + i);
    }
    return ids;
}

function isBootstrapPeerId(id) {
    return !!id && id.indexOf(bootstrapRoomName + '-') === 0;
}

function connectToBootstrapSlots() {
    var slots = getBootstrapSlotIds();
    for (var i = 0; i < slots.length; i++) {
        autoConnectToPeer(slots[i]);
    }
}

function claimBootstrapSlot(index) {
    if (!peerReady || bootstrapReady || bootstrapClaimInProgress || typeof Peer === 'undefined') return;
    
    var slots = getBootstrapSlotIds();
    if (index >= slots.length) {
        bootstrapStatus = 'tersambung ke slot publik';
        renderRightSidebar();
        return;
    }
    
    var slotId = slots[index];
    if (slotId === peerId || slotId === bootstrapSlotId) {
        claimBootstrapSlot(index + 1);
        return;
    }
    
    bootstrapClaimInProgress = true;
    bootstrapStatus = 'mencari slot ' + (index + 1) + '/' + slots.length;
    renderRightSidebar();
    
    var slotPeer = null;
    var finished = false;
    var timer = null;
    
    function tryNextSlot() {
        if (finished) return;
        finished = true;
        bootstrapClaimInProgress = false;
        if (timer) clearTimeout(timer);
        try {
            if (slotPeer && !slotPeer.destroyed) slotPeer.destroy();
        } catch (e) {
            console.log('Gagal menutup slot bootstrap:', e);
        }
        claimBootstrapSlot(index + 1);
    }
    
    try {
        slotPeer = new Peer(slotId, currentPeerOptions || {});
    } catch (e) {
        console.log('Gagal membuat slot bootstrap:', e);
        bootstrapClaimInProgress = false;
        claimBootstrapSlot(index + 1);
        return;
    }
    
    timer = setTimeout(function() {
        tryNextSlot();
    }, 5000);
    
    slotPeer.on('open', function(id) {
        if (finished) return;
        finished = true;
        bootstrapClaimInProgress = false;
        if (timer) clearTimeout(timer);
        
        bootstrapPeer = slotPeer;
        bootstrapSlotId = id;
        bootstrapReady = true;
        bootstrapStatus = 'slot publik aktif';
        if (connections[id]) {
            try {
                connections[id].close();
            } catch (e) {
                console.log('Gagal menutup koneksi ke slot sendiri:', e);
            }
            delete connections[id];
            delete pendingConnections[id];
            forgetActiveConnection(id);
        }
        
        slotPeer.on('connection', function(conn) {
            wireConnection(conn);
        });
        
        slotPeer.on('error', function(err) {
            console.log('Bootstrap slot error:', err);
        });
        
        slotPeer.on('close', function() {
            bootstrapReady = false;
            bootstrapSlotId = null;
            bootstrapPeer = null;
            bootstrapStatus = 'slot terputus';
            renderRightSidebar();
        });
        
        renderRightSidebar();
    });
    
    slotPeer.on('error', function(err) {
        console.log('Bootstrap slot unavailable:', slotId, err);
        tryNextSlot();
    });
}

function connectToKnownPeers() {
    // Try to connect to peers yang sudah diketahui tapi belum terhubung
    var peersToTry = knownPeerIds.concat(activeConnections).concat(getBootstrapSlotIds());
    for (var i = 0; i < peersToTry.length; i++) {
        var remotePeerId = peersToTry[i];
        if (remotePeerId !== peerId && (!connections[remotePeerId] || !connections[remotePeerId].open)) {
            console.log('Auto-connecting to: ' + remotePeerId);
            autoConnectToPeer(remotePeerId);
        }
    }
}

function autoConnectToPeer(remotePeerId) {
    if (!peer || !peerReady || !remotePeerId || remotePeerId === peerId || remotePeerId === bootstrapSlotId) return;
    if (connections[remotePeerId] && connections[remotePeerId].open) return;
    if (pendingConnections[remotePeerId]) return;
    
    try {
        pendingConnections[remotePeerId] = true;
        var conn = peer.connect(remotePeerId, { reliable: true });
        wireConnection(conn);
    } catch(e) {
        delete pendingConnections[remotePeerId];
        console.log('Error auto-connecting:', e);
    }
}

function handlePeerData(data, remotePeerId) {
    if (!data || !data.type) return;
    
    if (data.peerId && data.peerId !== peerId) {
        rememberPeerId(data.peerId);
        if (data.peerId !== remotePeerId) {
            autoConnectToPeer(data.peerId);
        }
    }
    
    if (Array.isArray(data.knownPeerIds)) {
        mergeKnownPeerIds(data.knownPeerIds);
    }
    
    if (data.type === 'peer-id') {
        // Register known peer
        rememberPeerId(data.peerId);
    } else if (data.type === 'hello' || data.type === 'sync') {
        mergeCommunities(data.communities);
        var feedAdded = mergeFeedPostsWithComments(data.feedPosts);
        var communityAdded = mergeCommunityPostsWithComments(data.communityPosts);
        if (feedAdded + communityAdded > 0) {
            addNotification('Sinkron ' + (feedAdded + communityAdded) + ' postingan dari ' + (data.fromUser || 'teman'), 'sync');
        }
    } else if (data.type === 'post') {
        var incomingPost = data.post || data;
        incomingPost.fromPeerId = data.fromPeerId || remotePeerId;
        incomingPost.originPeerId = data.fromPeerId || remotePeerId;
        if (upsertFeedPost(incomingPost, true)) {
            addNotification((incomingPost.author || data.fromUser || 'Teman') + ' memposting: ' + (incomingPost.content || '').substring(0, 30), 'post');
            broadcastPeerMessage({ type: 'post', post: incomingPost }, remotePeerId);
        }
    } else if (data.type === 'community-post') {
        mergeCommunities(data.communities);
        var commPost = data.post || data;
        var commId = commPost.communityId || data.communityId;
        commPost.fromPeerId = data.fromPeerId || remotePeerId;
        commPost.originPeerId = data.fromPeerId || remotePeerId;
        if (commId && upsertCommunityPost(commId, commPost, true)) {
            addNotification((commPost.author || data.fromUser || 'Teman') + ' memposting di komunitas', 'comm');
            broadcastPeerMessage({ type: 'community-post', communityId: commId, post: commPost, communities: data.communities || [] }, remotePeerId);
        }
    } else if (data.type === 'delete-post') {
        if (removeDeletedPost(data)) {
            broadcastPeerMessage(data, remotePeerId);
        }
    } else if (data.type === 'like-post') {
        applyIncomingLike(data, remotePeerId);
    } else if (data.type === 'new-comment') {
        // Terima komentar baru dari peer lain
        applyIncomingComment(data, remotePeerId);
    } else if (data.type === 'connection') {
        addNotification(data.message, 'connection');
    } else if (data.type === 'peer-list') {
        mergeKnownPeerIds(data.knownPeerIds);
    }
}

function applyIncomingLike(data, remotePeerId) {
    if (!data || !data.postId) return false;

    var scope = data.scope === 'community' ? 'community' : 'feed';
    var commId = data.communityId || data.commId || null;
    var posts = scope === 'community' ? (communityPosts[commId] || []) : feedPosts;
    var index = findPostIndexById(posts, data.postId);
    if (index === -1) return false;

    var post = posts[index];
    var incomingLikes = parseInt(data.likes, 10);
    if (!isNaN(incomingLikes) && incomingLikes >= LIKE_SPIKE_LIMIT) {
        post.likes = incomingLikes;
        handleLikeSpikePost(post, scope, commId, true);
        return true;
    }

    if (!isNaN(incomingLikes) && incomingLikes >= 0) {
        post.likes = incomingLikes;
    }
    if (Array.isArray(data.likedBy)) {
        post.likedBy = data.likedBy;
    }

    if (scope === 'community') {
        saveCommunityPosts();
        if (currentViewedCommunity === parseInt(commId, 10)) {
            var feedEl = document.getElementById('comm-posts-feed');
            if (feedEl) feedEl.innerHTML = renderCommunityPosts(parseInt(commId, 10));
        }
    } else {
        saveFeedPosts();
        renderFeed();
    }

    renderMyPosts();
    updateProfileStats();
    broadcastPeerMessage(data, remotePeerId);
    return true;
}

function applyIncomingComment(data, remotePeerId) {
    if (!data || !data.postId || !data.comment) return false;
    var comment = data.comment;
    if (commentHasXSSAttempt(comment)) {
        rejectXSSPayload('incoming-comment');
        return false;
    }

    // Cegah komentar duplikat
    if (!comment.id) return false;

    var changed = false;
    if (data.scope === 'community' && data.commId) {
        var cPosts = communityPosts[data.commId] || [];
        for (var i = 0; i < cPosts.length; i++) {
            if (String(cPosts[i].id) === String(data.postId)) {
                if (!Array.isArray(cPosts[i].comments)) cPosts[i].comments = [];
                // Cek duplikat berdasarkan comment id
                var alreadyHas = false;
                for (var d = 0; d < cPosts[i].comments.length; d++) {
                    if (cPosts[i].comments[d].id === comment.id) { alreadyHas = true; break; }
                }
                if (!alreadyHas) {
                    cPosts[i].comments.push(comment);
                    changed = true;
                }
                break;
            }
        }
        if (changed) {
            saveCommunityPosts();
            if (currentViewedCommunity === parseInt(data.commId, 10)) {
                var feedEl = document.getElementById('comm-posts-feed');
                if (feedEl) feedEl.innerHTML = renderCommunityPosts(parseInt(data.commId, 10));
            }
            // Teruskan ke peer lain
            broadcastPeerMessage(data, remotePeerId);
        }
    } else {
        var idx = findPostIndexById(feedPosts, data.postId);
        if (idx !== -1) {
            if (!Array.isArray(feedPosts[idx].comments)) feedPosts[idx].comments = [];
            var alreadyHasFeed = false;
            for (var e = 0; e < feedPosts[idx].comments.length; e++) {
                if (feedPosts[idx].comments[e].id === comment.id) { alreadyHasFeed = true; break; }
            }
            if (!alreadyHasFeed) {
                feedPosts[idx].comments.push(comment);
                changed = true;
            }
        }
        if (changed) {
            saveFeedPosts();
            renderFeed();
            renderMyPosts();
            // Teruskan ke peer lain
            broadcastPeerMessage(data, remotePeerId);
        }
    }
    return changed;
}

function handleIncomingConnection(conn) {
    wireConnection(conn);
    console.log('Incoming connection from: ' + conn.peer);
}

function wireConnection(conn) {
    if (!conn || !conn.peer) return;
    
    connections[conn.peer] = conn;
    rememberPeerId(conn.peer);
    var pendingTimer = setTimeout(function() {
        if (conn && !conn.open) {
            delete pendingConnections[conn.peer];
            if (connections[conn.peer] === conn) {
                delete connections[conn.peer];
            }
            renderRightSidebar();
        }
    }, 8000);
    renderRightSidebar();
    
    conn.on('open', function() {
        clearTimeout(pendingTimer);
        delete pendingConnections[conn.peer];
        connections[conn.peer] = conn;
        rememberPeerId(conn.peer);
        rememberActiveConnection(conn.peer);
        sendSyncToConnection(conn);
        conn.send({
            type: 'peer-list',
            peerId: peerId,
            knownPeerIds: getShareablePeerIds()
        });
        renderRightSidebar();
        console.log('Connected to: ' + conn.peer);
    });
    
    conn.on('data', function(data) {
        handlePeerData(data, conn.peer);
    });
    
    conn.on('error', function(err) {
        console.log('Connection error to ' + conn.peer + ':', err);
        clearTimeout(pendingTimer);
        delete pendingConnections[conn.peer];
        delete connections[conn.peer];
        forgetActiveConnection(conn.peer);
        renderRightSidebar();
    });
    
    conn.on('close', function() {
        clearTimeout(pendingTimer);
        delete pendingConnections[conn.peer];
        delete connections[conn.peer];
        forgetActiveConnection(conn.peer);
        renderRightSidebar();
    });
    
    if (conn.open) {
        sendSyncToConnection(conn);
    }
}

function rememberPeerId(id) {
    if (!id || id === peerId || id === bootstrapSlotId) return;
    if (knownPeerIds.indexOf(id) === -1) {
        knownPeerIds.push(id);
        saveStoredJSON('yaping_knownPeerIds', knownPeerIds);
    }
}

function mergeKnownPeerIds(ids) {
    if (!Array.isArray(ids)) return 0;
    
    var added = 0;
    for (var i = 0; i < ids.length; i++) {
        var before = knownPeerIds.length;
        rememberPeerId(ids[i]);
        if (knownPeerIds.length > before) added++;
    }
    
    if (added > 0) {
        connectToKnownPeers();
    }
    return added;
}

function addUniquePeerId(list, id) {
    if (!id || id === peerId || isBootstrapPeerId(id)) return;
    if (list.indexOf(id) === -1) list.push(id);
}

function getShareablePeerIds() {
    var ids = [];
    addUniquePeerId(ids, peerId);
    
    for (var i = 0; i < knownPeerIds.length; i++) {
        addUniquePeerId(ids, knownPeerIds[i]);
    }
    
    for (var j = 0; j < activeConnections.length; j++) {
        addUniquePeerId(ids, activeConnections[j]);
    }
    
    for (var connId in connections) {
        if (connections[connId] && connections[connId].open) {
            addUniquePeerId(ids, connId);
        }
    }
    
    return ids;
}

function rememberActiveConnection(id) {
    if (!id || id === peerId) return;
    if (activeConnections.indexOf(id) === -1) {
        activeConnections.push(id);
        saveStoredJSON('yaping_activeConnections', activeConnections);
    }
}

function forgetActiveConnection(id) {
    activeConnections = activeConnections.filter(function(activeId) {
        return activeId !== id;
    });
    saveStoredJSON('yaping_activeConnections', activeConnections);
}

function getOpenConnectionCount() {
    var count = 0;
    for (var id in connections) {
        if (connections[id] && connections[id].open) count++;
    }
    return count;
}

function sendSyncToConnection(conn) {
    if (!conn || !conn.open) return;
    
    conn.send({
        type: 'hello',
        peerId: peerId,
        fromUser: currentUser,
        bootstrapSlotId: bootstrapSlotId,
        knownPeerIds: getShareablePeerIds(),
        communities: communities,
        feedPosts: feedPosts,
        communityPosts: communityPosts,
        sentAt: Date.now()
    });
}

function broadcastPeerMessage(payload, exceptPeerId) {
    if (!payload) return;
    
    payload.peerId = peerId;
    payload.fromPeerId = peerId;
    payload.fromUser = currentUser;
    payload.knownPeerIds = getShareablePeerIds();
    payload.sentAt = Date.now();
    
    for (var id in connections) {
        if (id === exceptPeerId) continue;
        var conn = connections[id];
        if (conn && conn.open) {
            try {
                conn.send(payload);
            } catch (e) {
                console.log('Gagal mengirim ke peer ' + id + ':', e);
            }
        }
    }
}

function connectToPeerFromSidebar() {
    var input = document.getElementById('peerConnectInput');
    var remotePeerId = input ? input.value.trim() : '';
    
    if (!remotePeerId) {
        showToast('⚠️ Masukkan Peer ID cadangan dulu.');
        return;
    }
    
    if (remotePeerId === peerId) {
        showToast('⚠️ Itu Peer ID kamu sendiri.');
        return;
    }
    
    rememberPeerId(remotePeerId);
    autoConnectToPeer(remotePeerId);
    if (input) input.value = '';
    showToast('🔄 Menghubungkan ke ' + remotePeerId);
}

function copyPeerId() {
    if (!peerId) {
        showToast('⚠️ Peer ID belum siap.');
        return;
    }
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(peerId).then(function() {
            showToast('✅ Peer ID disalin.');
        }).catch(function() {
            fallbackCopyPeerId();
        });
    } else {
        fallbackCopyPeerId();
    }
}

function fallbackCopyPeerId() {
    var input = document.getElementById('myPeerIdInput');
    if (!input) return;
    input.select();
    document.execCommand('copy');
    showToast('✅ Peer ID disalin.');
}

function renderRightSidebar() {
    var sidebar = document.getElementById('right-sidebar');
    if (!sidebar) return;
    
    var peerScriptReady = typeof Peer !== 'undefined';
    var statusText = peerReady ? 'Online' : (peerScriptReady ? 'Menghubungkan...' : 'Offline');
    var statusColor = peerReady ? 'var(--fb-green)' : (peerScriptReady ? 'var(--fb-text-light)' : '#c0392b');
    var networkText = peerReady ? (bootstrapReady ? 'Tersambung otomatis' : bootstrapStatus) : 'menunggu';
    var connectionCount = getOpenConnectionCount();
    var connectionText = connectionCount > 0 ? connectionCount : (peerReady ? 'menunggu' : '0');
    
    var connectionHTML = '';
    var hasConnections = false;
    for (var id in connections) {
        if (!connections[id] || !connections[id].open) continue;
        hasConnections = true;
        connectionHTML += '<div class="connection-item">' +
            '<div class="connection-info">' +
                '<div class="connection-id">Peer Yaping</div>' +
                '<small>tersambung</small>' +
            '</div>' +
        '</div>';
    }
    
    if (!hasConnections) {
        connectionHTML = '<div class="sidebar-empty">Jaringan Yaping sudah aktif. Post akan sinkron otomatis saat ada pengguna lain online.</div>';
    }
    
    sidebar.innerHTML =
        '<div class="sidebar-box">' +
            '<div class="sidebar-box-title">Online P2P</div>' +
            '<div class="sidebar-stat"><span>Status</span><strong style="color:' + statusColor + '">' + statusText + '</strong></div>' +
            '<div class="sidebar-stat"><span>Jaringan</span><strong>' + escapeHtml(networkText) + '</strong></div>' +
            '<div class="sidebar-stat"><span>Peer aktif</span><strong>' + escapeHtml(String(connectionText)) + '</strong></div>' +
            '<div class="peer-connection mt-8">' +
                '<div class="connections-list">' + connectionHTML + '</div>' +
            '</div>' +
        '</div>';
}

// ===== MEDIA UPLOAD FUNCTIONS (MP3, MP4, Images) =====
function triggerMediaUpload() {
    var input = document.getElementById('mediaUpload');
    if (input) input.click();
}

function handleMediaUpload(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    // Validasi ukuran file (max 2GB)
    var MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
    if (file.size > MAX_FILE_SIZE) {
        showToast('❌ Ukuran file terlalu besar (max 2GB). Ukuran file: ' + formatFileSize(file.size));
        return;
    }
    
    // Tentukan tipe media berdasarkan MIME type
    var mediaType = 'unknown';
    if (file.type.startsWith('image/')) {
        mediaType = 'image';
    } else if (file.type.startsWith('audio/')) {
        mediaType = 'audio';
    } else if (file.type.startsWith('video/')) {
        mediaType = 'video';
    }
    
    // Validasi format yang diizinkan
    var allowedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/mp3', 'video/mp4'];
    var isAllowed = false;
    for (var i = 0; i < allowedFormats.length; i++) {
        if (allowedFormats[i] === file.type || file.name.endsWith('.mp3') || file.name.endsWith('.mp4')) {
            isAllowed = true;
            break;
        }
    }
    
    if (!isAllowed) {
        showToast('❌ Format file tidak didukung. Gunakan: JPG, PNG, GIF, MP3, atau MP4');
        return;
    }
    
    var reader = new FileReader();
    reader.onload = function(e) {
        postMedia = e.target.result;
        postMediaType = mediaType;
        var preview = document.getElementById('post-preview-img');
        var img = document.getElementById('post-img-preview');
        
        if (preview && img) {
            if (mediaType === 'image') {
                img.src = postMedia;
                img.style.display = 'block';
            } else if (mediaType === 'audio') {
                img.innerHTML = '<audio controls style="width:100%;max-width:300px;"><source src="' + escapeAttr(postMedia) + '" type="audio/mpeg"></audio>';
                img.style.display = 'block';
            } else if (mediaType === 'video') {
                img.innerHTML = '<video controls style="width:100%;max-width:300px;"><source src="' + escapeAttr(postMedia) + '" type="video/mp4"></video>';
                img.style.display = 'block';
            }
            preview.style.display = 'block';
            showToast('✅ Media berhasil diunggah! (' + file.name + ')');
        }
    };
    reader.readAsDataURL(file);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function triggerMediaUploadCommunity() {
    var input = document.getElementById('communityMediaUpload');
    if (input) input.click();
}

function removePostImage() {
    postMedia = null;
    postMediaType = null;
    var preview = document.getElementById('post-preview-img');
    var input = document.getElementById('mediaUpload');
    if (preview) preview.style.display = 'none';
    if (input) input.value = '';
}

function handleProfilePhotoUpload(event) {
    var file = event.target.files[0];
    if (!file) return;

    // Validasi ukuran file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Ukuran foto terlalu besar (maksimal 5MB)');
        return;
    }

    // Validasi tipe file
    var validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showToast('Format file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP');
        return;
    }

    var reader = new FileReader();
    reader.onload = function(e) {
        var photoData = e.target.result;
        currentUserPhoto = photoData;
        
        // Show preview
        var preview = document.getElementById('photo-preview');
        var container = document.getElementById('photo-preview-container');
        if (preview && container) {
            preview.src = photoData;
            container.style.display = 'block';
        }
        
        // Update profile avatar
        renderProfileAvatar();
        renderSidebarProfilePic();
        
        showToast('Foto profil dipilih. Klik "Simpan Perubahan" untuk menyimpan.');
    };
    reader.readAsDataURL(file);
}

function renderProfileAvatar() {
    var avatarEl = document.getElementById('profile-avatar-big');
    if (!avatarEl) return;

    var safePhoto = sanitizeMediaSrc(currentUserPhoto, 'image');
    
    if (safePhoto) {
        avatarEl.innerHTML = '<img src="' + escapeAttr(safePhoto) + '" class="profile-photo" alt="Foto Profil">';
        avatarEl.classList.add('has-photo');
    } else {
        avatarEl.textContent = '👤';
        avatarEl.classList.remove('has-photo');
    }
}

function renderSidebarProfilePic() {
    var sidebarPic = document.querySelector('.sidebar-profile-pic');
    if (!sidebarPic) return;

    var safePhoto = sanitizeMediaSrc(currentUserPhoto, 'image');
    
    if (safePhoto) {
        sidebarPic.innerHTML = '<img src="' + escapeAttr(safePhoto) + '" alt="Foto Profil">';
        sidebarPic.classList.add('has-photo');
    } else {
        sidebarPic.textContent = '👤';
        sidebarPic.classList.remove('has-photo');
    }
}

function getPostUserPhotoHTML(author) {
    var safePhoto = sanitizeMediaSrc(currentUserPhoto, 'image');
    if (author === currentUser && safePhoto) {
        return '<img src="' + escapeAttr(safePhoto) + '" class="post-user-photo" alt="Foto">';
    }
    return '<span style="width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;">👤</span>';
}

// ===== KOMENTAR =====
function toggleComments(postId, scope, commId) {
    openComments[postId] = !openComments[postId];
    if (scope === 'community' && commId) {
        var feedEl = document.getElementById('comm-posts-feed');
        if (feedEl) feedEl.innerHTML = renderCommunityPosts(parseInt(commId, 10));
    } else if (scope === 'my-posts') {
        renderMyPosts();
    } else {
        renderFeed();
    }
}

function submitComment(postId, scope, commId) {
    if (enforceSecurityBan()) return;

    var inputEl = document.getElementById('cmt-input-' + postId);
    var text = inputEl ? inputEl.value.trim() : '';
    if (!text) { showToast('⚠️ Tulis komentar dulu!'); return; }
    if (text.length > 500) { showToast('❌ Komentar terlalu panjang (max 500 karakter)'); return; }
    if (hasXSSAttempt(text)) {
        if (inputEl) inputEl.value = '';
        triggerSecurityBan('comment-xss-attempt');
        return;
    }

    var comment = {
        id: createLocalId('cmt'),
        author: currentUser,
        content: text,
        createdAt: Date.now()
    };

    if (scope === 'community' && commId) {
        var cPosts = communityPosts[commId] || [];
        for (var i = 0; i < cPosts.length; i++) {
            if (String(cPosts[i].id) === String(postId)) {
                if (!Array.isArray(cPosts[i].comments)) cPosts[i].comments = [];
                cPosts[i].comments.push(comment);
                break;
            }
        }
        saveCommunityPosts();
        openComments[postId] = true;
        var feedEl = document.getElementById('comm-posts-feed');
        if (feedEl) feedEl.innerHTML = renderCommunityPosts(parseInt(commId, 10));
        // Broadcast ke peer
        broadcastPeerMessage({
            type: 'new-comment',
            postId: postId,
            scope: 'community',
            commId: commId,
            comment: comment
        });
    } else {
        var idx = findPostIndexById(feedPosts, postId);
        if (idx !== -1) {
            if (!Array.isArray(feedPosts[idx].comments)) feedPosts[idx].comments = [];
            feedPosts[idx].comments.push(comment);
            saveFeedPosts();
            openComments[postId] = true;
            if (scope === 'my-posts') {
                renderMyPosts();
            } else {
                renderFeed();
            }
            // Broadcast ke peer
            broadcastPeerMessage({
                type: 'new-comment',
                postId: postId,
                scope: 'feed',
                commId: null,
                comment: comment
            });
        }
    }
    showToast('✅ Komentar ditambahkan!');
}

function renderCommentSection(post, scope, commId) {
    var postId = post.id;
    var comments = Array.isArray(post.comments) ? post.comments : [];
    var isOpen = openComments[postId] ? true : false;

    var scopeArg = "'" + scope + "'";
    var commArg = commId ? (',' + commId) : '';
    var toggleCall = 'toggleComments(\'' + jsString(postId) + '\',' + scopeArg + commArg + ')';
    var submitCall = 'submitComment(\'' + jsString(postId) + '\',' + scopeArg + commArg + ')';

    var html = '';

    if (isOpen) {
        html += '<div class="comment-section">';
        // Input area
        html += '<div class="comment-input-row">' +
            '<span style="font-size:18px;line-height:1;">👤</span>' +
            '<input type="text" id="cmt-input-' + escapeAttr(postId) + '" class="comment-input" placeholder="Tulis komentar..." ' +
            'onkeypress="if(event.key===\'Enter\'){' + submitCall + ';event.preventDefault();}" maxlength="500">' +
            '<button class="comment-submit-btn" onclick="' + submitCall + '">Kirim</button>' +
        '</div>';

        // Comment list
        if (comments.length > 0) {
            html += '<div class="comment-list">';
            for (var i = 0; i < comments.length; i++) {
                var c = comments[i];
                html += '<div class="comment-item">' +
                    '<strong>' + escapeHtml(c.author) + '</strong>' + getBadgeHTML(c.author) + ' ' +
                    escapeHtml(c.content) +
                    '<span class="comment-meta"> · ' + formatTimeAgo(c.createdAt) + '</span>' +
                '</div>';
            }
            html += '</div>';
        } else {
            html += '<div style="font-size:11px;color:#999;padding:4px 0 2px;">Belum ada komentar. Jadilah yang pertama!</div>';
        }

        html += '</div>';
    }

    return html;
}

// ===== HASHTAG FUNCTIONS =====
function countWords(text) {
    if (!text) return 0;
    var trimmed = text.trim();
    if (trimmed.length === 0) return 0;
    return trimmed.split(/\s+/).length;
}

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
    return formatPostContent(text);
}

function viewUserProfile(username) {
    // Jika username adalah diri sendiri, langsung ke tab profil
    if (username === currentUser) {
        switchToTab('profile');
        return;
    }

    // Kumpulkan post milik user ini dari feed
    var userPosts = [];
    for (var i = 0; i < feedPosts.length; i++) {
        if (feedPosts[i].author === username) userPosts.push(feedPosts[i]);
    }
    // Kumpulkan juga dari community posts
    for (var commId in communityPosts) {
        var cPosts = communityPosts[commId] || [];
        for (var j = 0; j < cPosts.length; j++) {
            if (cPosts[j].author === username) userPosts.push(cPosts[j]);
        }
    }
    userPosts.sort(function(a, b) { return b.createdAt - a.createdAt; });

    var postsHtml = '';
    if (userPosts.length === 0) {
        postsHtml = '<div class="sidebar-empty" style="padding:10px 0;">Belum ada postingan.</div>';
    } else {
        var limit = Math.min(userPosts.length, 5);
        for (var k = 0; k < limit; k++) {
            var p = userPosts[k];
            var preview = p.content ? p.content.substring(0, 100) + (p.content.length > 100 ? '…' : '') : '(media)';
            postsHtml += '<div style="padding:7px 0;border-bottom:1px solid #e8edf5;">' +
                '<div style="font-size:11px;color:#777;">' + formatTimeAgo(p.createdAt) + '</div>' +
                '<div style="font-size:12px;margin-top:3px;">' + escapeHtml(preview) + '</div>' +
            '</div>';
        }
        if (userPosts.length > 5) {
            postsHtml += '<div style="font-size:11px;color:#3b5998;padding-top:6px;">+' + (userPosts.length - 5) + ' postingan lainnya</div>';
        }
    }

    var content =
        '<div style="text-align:center;padding:12px 0 16px;">' +
            '<div style="font-size:52px;line-height:1;">👤</div>' +
            '<div style="font-size:17px;font-weight:bold;margin-top:8px;color:#3b5998;display:flex;align-items:center;justify-content:center;gap:6px;">' + escapeHtml(username) + getBadgeHTML(username) + '</div>' +
            '<div style="font-size:11px;color:#777;margin-top:3px;">' + (badgedUsers.has(username) ? '✅ Akun Resmi' : 'Member Yaping') + '</div>' +
        '</div>' +
        '<div style="border-top:1px solid #d8dfea;padding-top:10px;">' +
            '<div style="font-weight:bold;font-size:12px;margin-bottom:6px;color:#333;">📝 Postingan Terakhir (' + userPosts.length + ')</div>' +
            postsHtml +
        '</div>';

    showModal('Profil ' + username, content);
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
        html += '<div class="hashtag-item" onclick="viewHashtag(\'' + jsString(tag) + '\')">' +
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
    
    // Dari feed posts
    for (var f = 0; f < feedPosts.length; f++) {
        if (feedPosts[f].content.indexOf(hashtag) !== -1) {
            posts.push({
                type: 'feed',
                post: feedPosts[f]
            });
        }
    }
    
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
    
    // Sort by likes first, then by date
    posts.sort(function(a, b) {
        var likesA = a.post.likes || 0;
        var likesB = b.post.likes || 0;
        if (likesB !== likesA) {
            return likesB - likesA;
        }
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
        var deleteButton = '';
        if (isOwnPost(post)) {
            deleteButton = posts[i].type === 'community'
                ? '<button class="post-delete-btn" onclick="deleteCommunityPost(' + posts[i].commId + ',\'' + jsString(post.id) + '\')">Hapus</button>'
                : '<button class="post-delete-btn" onclick="deleteFeedPost(\'' + jsString(post.id) + '\')">Hapus</button>';
        }
        
        var mediaHTML = renderPostMedia(post);
        
        html += '<div class="content-box">' +
            '<div class="post-card">' +
                '<div class="post-card-header">' +
                    '<span class="post-username" onclick="viewUserProfile(\'' + jsString(post.author) + '\')">' + getUserDisplayHTML(post.author) + '</span>' +
                    '<span style="display:flex;align-items:center;gap:6px;margin-left:auto;">' +
                        '<span class="post-timestamp">' + timeAgo + '</span>' +
                        deleteButton +
                    '</span>' +
                '</div>' +
                '<div class="post-body">' + parsePostWithHashtags(post.content) + '</div>' +
                mediaHTML +
                '<div class="post-footer">' +
                    '<div class="post-actions-left">' +
                        '<button class="like-btn' + (isLiked ? ' liked' : '') + '" onclick="' + (posts[i].type === 'feed' ? 'likeFeedPost' : 'likeCommunityPost') + '(' + (posts[i].type === 'community' ? posts[i].commId + ',' : '') + '\'' + jsString(post.id) + '\')">' + 
                            (isLiked ? '❤️' : '🤍') + ' ' + post.likes + '</button>' +
                        '<button class="comment-btn" onclick="showToast(\'💬 Buka postingan untuk komentar!\')">💬 ' + (Array.isArray(post.comments) ? post.comments.length : 0) + ' Komentar</button>' +
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
        var commId = safeInteger(comm.id, null);
        if (commId === null) continue;
        var isMember = joinedCommunities.indexOf(comm.id) !== -1 || joinedCommunities.indexOf(commId) !== -1;
        html += '<li class="comm-list-item">' +
            '<div class="comm-icon">' + escapeHtml(comm.category) + '</div>' +
            '<div class="comm-info">' +
                '<div class="comm-name" onclick="viewCommunity(' + commId + ')">' + escapeHtml(comm.name) + '</div>' +
                '<div class="comm-meta">' + escapeHtml(comm.desc) + ' • 👥 ' + safeCount(comm.members) + ' anggota</div>' +
            '</div>' +
            '<div class="comm-actions">' +
                (isMember 
                    ? '<button class="primary-btn" onclick="viewCommunity(' + commId + ')">Lihat</button>' 
                    : '<button class="primary-btn" onclick="joinCommunity(' + commId + ')">Gabung</button>') +
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
    renderRightSidebar();
    broadcastPeerMessage({
        type: 'sync',
        communities: [newComm],
        feedPosts: [],
        communityPosts: {}
    });
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
    comm.members = safeCount(comm.members) + 1;
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
    commId = safeInteger(commId, null);
    if (commId === null) return;

    var comm = null;
    for (var i = 0; i < communities.length; i++) {
        if (safeInteger(communities[i].id, null) === commId) {
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
    var isMember = joinedCommunities.indexOf(commId) !== -1 || joinedCommunities.indexOf(String(commId)) !== -1;
    var safeBanner = sanitizeColor(comm.banner, '#4472CA');
    var memberCount = safeCount(comm.members);
    
    // Render post box (hanya jika member)
    var postBoxHTML = '';
    if (isMember) {
        postBoxHTML = '<div class="content-box">' +
            '<div class="box-title">💬 Buat Postingan</div>' +
            '<textarea id="communityPostInput" class="comm-post-input" placeholder="Tulis sesuatu untuk ' + escapeAttr(comm.name) + '..."></textarea>' +
            '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
                '<button class="option-btn" onclick="addEmoji(\'communityPostInput\')" style="font-size:11px;">😊 Emoji</button>' +
                '<button class="option-btn" onclick="triggerMediaUploadCommunity()" style="font-size:11px;">📹 Media</button>' +
                '<input type="file" id="communityMediaUpload" accept=".mp3,.mp4,image/*" style="display:none;" onchange="handleMediaUpload(event)">' +
                '<button class="primary-btn" onclick="submitCommunityPost(' + commId + ')">Bagikan</button>' +
            '</div>' +
            '<div id="community-post-preview-img" style="display:none;margin-top:10px;"><img id="community-post-img-preview" src="" alt="preview" style="max-width:300px;"></div>' +
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
    
    // Owner controls (edit/delete buttons)
    var isOwner = comm.owner === currentUser;
    var ownerControlsHTML = '';
    if (isOwner) {
        ownerControlsHTML = '<div style="display:flex;gap:8px;margin-top:12px;">' +
            '<button class="option-btn" onclick="showEditCommunityModal(' + commId + ')">✏️ Edit Nama</button>' +
            '<button class="option-btn" onclick="showEditBannerModal(' + commId + ')">🎨 Ubah Banner</button>' +
            '<button class="option-btn" style="background-color:#ff4444;color:white;" onclick="deleteCommunity(' + commId + ')">🗑️ Hapus Komunitas</button>' +
        '</div>';
    }
    
    detailTab.innerHTML = 
        '<div class="content-box">' +
            '<a class="back-link" onclick="switchToTab(\'komunitas\');return false;">← Kembali ke Komunitas</a>' +
            '<div class="comm-detail-banner" style="background-color:' + safeBanner + ';height:150px;border-radius:8px;margin-bottom:12px;"></div>' +
            '<div class="comm-detail-header">' +
                '<div class="comm-detail-icon">' + escapeHtml(comm.category) + '</div>' +
                '<div class="comm-detail-info">' +
                    '<div class="comm-detail-name">' + escapeHtml(comm.name) + '</div>' +
                    '<div style="font-size:12px;color:var(--fb-text-light);margin-bottom:8px;">' + escapeHtml(comm.desc) + '</div>' +
                    '<div class="comm-detail-meta">👥 ' + memberCount + ' anggota • Oleh ' + escapeHtml(comm.owner) + 
                    (isMember ? ' • <span style="color:var(--fb-green)">✅ Anggota</span>' : '') + '</div>' +
                    ownerControlsHTML +
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
    if (enforceSecurityBan()) return;

    var input = document.getElementById('communityPostInput');
    var text = input ? input.value.trim() : '';
    
    if (!text) {
        showToast('⚠️ Tulis sesuatu dulu ya!');
        if (input) input.focus();
        return;
    }
    
    // Validasi batas 1000 kata
    var wordCount = countWords(text);
    if (wordCount > 1000) {
        showToast('❌ Jumlah kata terlalu banyak! Max 1000 kata. Anda menulis: ' + wordCount + ' kata');
        return;
    }

    if (hasXSSAttempt(text)) {
        if (input) input.value = '';
        triggerSecurityBan('community-post-xss-attempt');
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
        id: createLocalId('comm'),
        communityId: commId,
        author: currentUser,
        content: text,
        likes: 0,
        likedBy: [],
        createdAt: Date.now(),
        media: postMedia || null,
        mediaType: postMediaType || null,
        originPeerId: peerId || localClientId,
        scope: 'community'
    };
    
    // Simpan ke communityPosts
    upsertCommunityPost(commId, newPost, true);
    
    // Reset input & update UI
    if (input) input.value = '';
    postMedia = null;
    postMediaType = null;
    var preview = document.getElementById('post-preview-img');
    if (preview) preview.style.display = 'none';
    showToast('✅ Postingan dibagikan ke ' + comm.name);
    
    // Broadcast ke connected peers
    broadcastPeerMessage({
        type: 'community-post',
        communityId: commId,
        post: newPost,
        communities: [comm]
    });
    
    // Update notifikasi untuk owner komunitas
    if (comm.owner !== currentUser) {
        addNotification(currentUser + ' memposting di ' + comm.name, 'comm');
    }
}

// ===== KOMUNITAS: RENDER POSTS =====
function renderCommunityPosts(commId) {
    commId = safeInteger(commId, null);
    if (commId === null) return '';

    var posts = [];
    var rawPosts = communityPosts[commId] || [];
    for (var n = 0; n < rawPosts.length; n++) {
        var normalizedPost = normalizePost(rawPosts[n], 'community', commId);
        if (normalizedPost) posts.push(normalizedPost);
    }
    
    // Sort by likes (descending) first, then by date
    posts.sort(function(a, b) {
        var likesA = a.likes || 0;
        var likesB = b.likes || 0;
        if (likesB !== likesA) {
            return likesB - likesA;
        }
        return b.createdAt - a.createdAt;
    });
    communityPosts[commId] = posts;
    
    if (posts.length === 0) {
        return '<div class="sidebar-empty">Belum ada diskusi. Jadilah yang pertama! 🎉</div>';
    }
    
    var html = '';
    for (var i = 0; i < posts.length; i++) {
        var post = posts[i];
        var timeAgo = formatTimeAgo(post.createdAt);
        var likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
        var isLiked = likedBy.indexOf(currentUser) !== -1;
        var deleteButton = isOwnPost(post) ? '<button class="post-delete-btn" onclick="deleteCommunityPost(' + commId + ',\'' + jsString(post.id) + '\')">Hapus</button>' : '';
        
        // Get community to check if poster is owner
        var communityOwner = null;
        for (var c = 0; c < communities.length; c++) {
            if (communities[c].id === commId) {
                communityOwner = communities[c].owner;
                break;
            }
        }
        
        // Add OP badge if poster is community owner
        var opBadge = '';
        if (post.author === communityOwner) {
            opBadge = ' <span style="background-color:#FFD700;color:#000;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:bold;">Owner Komunitas</span>';
        }
        
        var mediaHTML = renderPostMedia(post);
        
        html += '<div class="post-card" style="margin-bottom:8px;">' +
            '<div class="post-card-header" style="display:flex;align-items:center;gap:8px;padding:8px 12px;">' +
                '<div style="display:flex;align-items:center;gap:6px;">' +
                    getPostUserPhotoHTML(post.author) +
                    '<span class="post-username" onclick="viewUserProfile(\'' + jsString(post.author) + '\')">' + getUserDisplayHTML(post.author) + '</span>' +
                '</div>' +
                opBadge +
                '<span style="display:flex;align-items:center;gap:6px;margin-left:auto;">' +
                    '<span class="post-timestamp">' + timeAgo + '</span>' +
                    deleteButton +
                '</span>' +
            '</div>' +
            '<div class="post-body">' + parsePostWithHashtags(post.content) + '</div>' +
            mediaHTML +
            '<div class="post-footer">' +
                '<div class="post-actions-left">' +
                    '<button class="like-btn' + (isLiked ? ' liked' : '') + '" onclick="likeCommunityPost(' + commId + ',\'' + jsString(post.id) + '\')">' + 
                        (isLiked ? '❤️' : '🤍') + ' ' + post.likes + '</button>' +
                    '<button class="comment-btn' + (openComments[post.id] ? ' comment-btn-active' : '') + '" onclick="toggleComments(\'' + jsString(post.id) + '\',\'community\',' + commId + ')">💬 ' + (Array.isArray(post.comments) ? post.comments.length : 0) + ' Komentar</button>' +
                '</div>' +
                '<button class="share-btn" onclick="showToast(\'🔗 Link disalin!\')">🔗 Bagikan</button>' +
            '</div>' +
            renderCommentSection(post, 'community', commId) +
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
        if (String(posts[i].id) === String(postId)) {
            post = posts[i];
            break;
        }
    }
    if (!post) return;
    
    if (!Array.isArray(post.likedBy)) post.likedBy = [];
    if (isNaN(parseInt(post.likes, 10))) post.likes = 0;
    
    var idx = post.likedBy.indexOf(currentUser);
    if (idx === -1) {
        post.likes++;
        post.likedBy.push(currentUser);
    } else {
        post.likes = Math.max(0, post.likes - 1);
        post.likedBy.splice(idx, 1);
    }

    if (handleLikeSpikePost(post, 'community', commId, true)) return;
    
    saveCommunityPosts();
    
    // Re-render jika sedang view komunitas ini
    if (currentViewedCommunity === commId) {
        var feedEl = document.getElementById('comm-posts-feed');
        if (feedEl) feedEl.innerHTML = renderCommunityPosts(commId);
    }

    broadcastPeerMessage({
        type: 'like-post',
        scope: 'community',
        communityId: commId,
        postId: postId,
        likes: post.likes,
        likedBy: post.likedBy
    });
}

function deleteCommunityPost(commId, postId) {
    var posts = communityPosts[commId];
    if (!posts) return;
    
    var index = findPostIndexById(posts, postId);
    if (index === -1) return;
    
    var post = posts[index];
    if (!isOwnPost(post)) {
        showToast('⚠️ Kamu hanya bisa menghapus postingan sendiri.');
        return;
    }
    
    if (!confirm('Hapus postingan ini?')) return;
    
    posts.splice(index, 1);
    saveCommunityPosts();
    rebuildHashtags();
    
    if (currentViewedCommunity === commId) {
        var feedEl = document.getElementById('comm-posts-feed');
        if (feedEl) feedEl.innerHTML = renderCommunityPosts(commId);
    }
    renderMyPosts();
    updateProfileStats();
    renderRightSidebar();
    
    broadcastPeerMessage({
        type: 'delete-post',
        scope: 'community',
        communityId: commId,
        postId: postId,
        originPeerId: post.originPeerId || peerId || localClientId
    });
    
    showToast('🗑️ Postingan dihapus.');
}

// ===== KOMUNITAS: OWNER CONTROLS =====
function showEditCommunityModal(commId) {
    var comm = null;
    for (var i = 0; i < communities.length; i++) {
        if (communities[i].id === commId) {
            comm = communities[i];
            break;
        }
    }
    if (!comm || comm.owner !== currentUser) {
        showToast('⚠️ Hanya pemilik komunitas yang bisa mengedit.');
        return;
    }
    
    var newName = prompt('Masukkan nama komunitas baru:', comm.name);
    if (!newName || newName.trim() === '') {
        return;
    }
    
    if (newName.length > 100) {
        showToast('❌ Nama komunitas terlalu panjang (max 100 karakter)');
        return;
    }
    
    comm.name = newName.trim();
    saveCommunities();
    viewCommunity(commId);
    renderCommunities('all');
    renderCommunities('mine');
    showToast('✅ Nama komunitas diperbarui!');
}

function showEditBannerModal(commId) {
    var comm = null;
    for (var i = 0; i < communities.length; i++) {
        if (communities[i].id === commId) {
            comm = communities[i];
            break;
        }
    }
    if (!comm || comm.owner !== currentUser) {
        showToast('⚠️ Hanya pemilik komunitas yang bisa mengubah banner.');
        return;
    }
    
    var colors = [
        '#4472CA', '#70AD47', '#FFC000', '#FF5050', '#9DC3E6',
        '#92D050', '#FFD966', '#C5504B', '#7030A0', '#00B050'
    ];
    
    var colorOptions = '';
    for (var i = 0; i < colors.length; i++) {
        var selected = colors[i] === comm.banner ? ' (✓)' : '';
        colorOptions += colors[i] + selected + '\n';
    }
    
    var newBanner = prompt('Pilih warna banner komunitas:\n\n' + colorOptions + '\nMasukkan kode warna (contoh: #4472CA):', comm.banner || '#4472CA');
    
    if (!newBanner || newBanner.trim() === '') {
        return;
    }
    
    // Validate hex color
    if (!/^#[0-9A-F]{6}$/i.test(newBanner.trim())) {
        // Check if it's in the color list
        var isValid = false;
        for (var j = 0; j < colors.length; j++) {
            if (colors[j] === newBanner.trim()) {
                isValid = true;
                break;
            }
        }
        if (!isValid) {
            showToast('❌ Format warna tidak valid. Gunakan format #RRGGBB');
            return;
        }
    }
    
    comm.banner = newBanner.trim();
    saveCommunities();
    viewCommunity(commId);
    renderCommunities('all');
    renderCommunities('mine');
    showToast('✅ Banner komunitas diperbarui!');
}

function deleteCommunity(commId) {
    var comm = null;
    var commIndex = -1;
    for (var i = 0; i < communities.length; i++) {
        if (communities[i].id === commId) {
            comm = communities[i];
            commIndex = i;
            break;
        }
    }
    
    if (!comm || comm.owner !== currentUser) {
        showToast('⚠️ Hanya pemilik komunitas yang bisa menghapus.');
        return;
    }
    
    if (!confirm('Hapus komunitas ini? Semua postingan akan hilang dan tidak bisa dikembalikan!')) {
        return;
    }
    
    if (!confirm('Yakin? Tindakan ini tidak bisa dibatalkan!')) {
        return;
    }
    
    // Hapus dari communities
    communities.splice(commIndex, 1);
    
    // Hapus dari communityPosts
    if (communityPosts[commId]) {
        delete communityPosts[commId];
    }
    
    // Hapus dari joinedCommunities jika ada
    var joinIndex = joinedCommunities.indexOf(commId);
    if (joinIndex !== -1) {
        joinedCommunities.splice(joinIndex, 1);
    }
    
    // Simpan perubahan
    saveCommunities();
    saveCommunityPosts();
    saveJoinedCommunities();
    
    // Kembali ke tab komunitas
    switchToTab('komunitas');
    renderCommunities('all');
    renderCommunities('mine');
    renderRightSidebar();
    
    showToast('🗑️ Komunitas berhasil dihapus!');
}

// ===== HOME: SUBMIT POST =====
function submitPost() {
    if (enforceSecurityBan()) return;

    var input = document.getElementById('postInput');
    var text = input ? input.value.trim() : '';
    
    if (!text) {
        showToast('⚠️ Tulis sesuatu dulu ya!');
        if (input) input.focus();
        return;
    }

    // Validasi batas 1000 kata
    var wordCount = countWords(text);
    if (wordCount > 1000) {
        showToast('❌ Jumlah kata terlalu banyak! Max 1000 kata. Anda menulis: ' + wordCount + ' kata');
        return;
    }

    if (hasXSSAttempt(text)) {
        if (input) input.value = '';
        triggerSecurityBan('feed-post-xss-attempt');
        return;
    }

    // Buat post object
    var newPost = {
        id: createLocalId('feed'),
        author: currentUser,
        content: text,
        likes: 0,
        likedBy: [],
        createdAt: Date.now(),
        media: postMedia || null,
        mediaType: postMediaType || null,
        originPeerId: peerId || localClientId,
        scope: 'feed'
    };
    
    // Tambah ke feed
    upsertFeedPost(newPost, true);
    
    // Reset input & hapus preview
    if (input) input.value = '';
    postMedia = null;
    postMediaType = null;
    var preview = document.getElementById('post-preview-img');
    if (preview) preview.style.display = 'none';
    
    showToast('✅ Postingan dibagikan! 🎉');
    
    // Broadcast ke connected peers
    broadcastPeerMessage({
        type: 'post',
        post: newPost
    });
}

// ===== HOME: RENDER FEED =====
function renderFeed() {
    var feed = document.getElementById('feed');
    if (!feed) return;
    
    feedPosts = normalizeFeedPosts(feedPosts);
    
    // Jika belum ada post asli, tampilkan empty state, bukan dummy post.
    if (feedPosts.length === 0) {
        feed.innerHTML = 
            '<div class="content-box">' +
                '<div class="sidebar-empty">Belum ada postingan asli. Tulis post pertama kamu di atas.</div>' +
            '</div>';
        return;
    }
    
    // Sort posts by likes (descending) first, then by date
    var sortedPosts = feedPosts.slice();
    sortedPosts.sort(function(a, b) {
        var likesA = a.likes || 0;
        var likesB = b.likes || 0;
        if (likesB !== likesA) {
            return likesB - likesA; // Sort by likes descending
        }
        return b.createdAt - a.createdAt; // Then by date descending
    });
    
    // Render semua posts dari sortedPosts
    var html = '';
    for (var i = 0; i < sortedPosts.length; i++) {
        var post = sortedPosts[i];
        var timeAgo = formatTimeAgo(post.createdAt);
        var likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
        var isLiked = likedBy.indexOf(currentUser) !== -1;
        var deleteButton = isOwnPost(post) ? '<button class="post-delete-btn" onclick="deleteFeedPost(\'' + jsString(post.id) + '\')">Hapus</button>' : '';
        
        var mediaHTML = renderPostMedia(post);
        
        html += '<div class="post-card" style="margin-bottom:8px;">' +
            '<div class="post-card-header" style="display:flex;align-items:center;gap:8px;padding:8px 12px;">' +
                '<div style="display:flex;align-items:center;gap:6px;">' +
                    getPostUserPhotoHTML(post.author) +
                    '<span class="post-username" onclick="viewUserProfile(\'' + jsString(post.author) + '\')">' + getUserDisplayHTML(post.author) + '</span>' +
                '</div>' +
                '<span style="display:flex;align-items:center;gap:6px;margin-left:auto;">' +
                    '<span class="post-timestamp">' + timeAgo + '</span>' +
                    deleteButton +
                '</span>' +
            '</div>' +
            '<div class="post-body">' + parsePostWithHashtags(post.content) + '</div>' +
            mediaHTML +
            '<div class="post-footer">' +
                '<div class="post-actions-left">' +
                    '<button class="like-btn' + (isLiked ? ' liked' : '') + '" onclick="likeFeedPost(\'' + jsString(post.id) + '\')">' + 
                        (isLiked ? '❤️' : '🤍') + ' ' + post.likes + '</button>' +
                    '<button class="comment-btn' + (openComments[post.id] ? ' comment-btn-active' : '') + '" onclick="toggleComments(\'' + jsString(post.id) + '\',\'feed\')">💬 ' + (Array.isArray(post.comments) ? post.comments.length : 0) + ' Komentar</button>' +
                '</div>' +
                '<button class="share-btn" onclick="showToast(\'🔗 Link disalin!\')">🔗 Bagikan</button>' +
            '</div>' +
            renderCommentSection(post, 'feed', null) +
        '</div>';
    }
    feed.innerHTML = html;
}

function likeFeedPost(postId) {
    var index = findPostIndexById(feedPosts, postId);
    if (index === -1) return;
    
    var post = feedPosts[index];
    if (!Array.isArray(post.likedBy)) post.likedBy = [];
    if (isNaN(parseInt(post.likes, 10))) post.likes = 0;
    
    var idx = post.likedBy.indexOf(currentUser);
    if (idx === -1) {
        post.likes++;
        post.likedBy.push(currentUser);
    } else {
        post.likes = Math.max(0, post.likes - 1);
        post.likedBy.splice(idx, 1);
    }

    if (handleLikeSpikePost(post, 'feed', null, true)) return;

    saveFeedPosts();
    renderFeed();
    updateProfileStats();
    
    // Broadcast like to peers
    broadcastPeerMessage({
        type: 'like-post',
        scope: 'feed',
        postId: postId,
        likes: post.likes,
        likedBy: post.likedBy
    });
}

function deleteFeedPost(postId) {
    var index = findPostIndexById(feedPosts, postId);
    if (index === -1) return;
    
    var post = feedPosts[index];
    if (!isOwnPost(post)) {
        showToast('⚠️ Kamu hanya bisa menghapus postingan sendiri.');
        return;
    }
    
    if (!confirm('Hapus postingan ini?')) return;
    
    feedPosts.splice(index, 1);
    saveFeedPosts();
    rebuildHashtags();
    renderFeed();
    renderMyPosts();
    updateProfileStats();
    renderRightSidebar();
    
    broadcastPeerMessage({
        type: 'delete-post',
        scope: 'feed',
        postId: postId,
        originPeerId: post.originPeerId || peerId || localClientId
    });
    
    showToast('🗑️ Postingan dihapus.');
}

// ===== PROFILE: RENDER MY POSTS =====
function renderMyPosts() {
    var feed = document.getElementById('my-posts-feed');
    if (!feed) return;
    
    var myPosts = [];
    for (var i = 0; i < feedPosts.length; i++) {
        if (feedPosts[i].author === currentUser) {
            myPosts.push(feedPosts[i]);
        }
    }
    
    if (myPosts.length === 0) {
        feed.innerHTML = '<div class="sidebar-empty">Kamu belum memiliki postingan. Yuk mulai berbagi! ✨</div>';
        return;
    }
    
    // Sort by likes descending, then by date
    myPosts.sort(function(a, b) {
        var likesA = a.likes || 0;
        var likesB = b.likes || 0;
        if (likesB !== likesA) {
            return likesB - likesA;
        }
        return b.createdAt - a.createdAt;
    });
    
    var html = '';
    for (var j = 0; j < myPosts.length; j++) {
        var post = myPosts[j];
        var likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
        var isLiked = likedBy.indexOf(currentUser) !== -1;
        var deleteButton = isOwnPost(post) ? '<button class="post-delete-btn" onclick="deleteFeedPost(\'' + jsString(post.id) + '\')">Hapus</button>' : '';
        
        var mediaHTML = renderPostMedia(post);
        
        html += '<div class="post-card" style="margin-bottom:8px;">' +
            '<div class="post-card-header">' +
                '<span class="post-username" onclick="viewUserProfile(\'' + jsString(post.author) + '\')">' + getUserDisplayHTML(post.author) + '</span>' +
                '<span style="display:flex;align-items:center;gap:6px;">' +
                    '<span class="post-timestamp">' + formatTimeAgo(post.createdAt) + '</span>' +
                    deleteButton +
                '</span>' +
            '</div>' +
            '<div class="post-body">' + parsePostWithHashtags(post.content) + '</div>' +
            mediaHTML +
            '<div class="post-footer">' +
                '<div class="post-actions-left">' +
                    '<button class="like-btn' + (isLiked ? ' liked' : '') + '" onclick="likeFeedPost(\'' + jsString(post.id) + '\')">' +
                        (isLiked ? '❤️' : '🤍') + ' ' + post.likes + '</button>' +
                    '<button class="comment-btn' + (openComments[post.id] ? ' comment-btn-active' : '') + '" onclick="toggleComments(\'' + jsString(post.id) + '\',\'my-posts\')">💬 ' + (Array.isArray(post.comments) ? post.comments.length : 0) + ' Komentar</button>' +
                '</div>' +
                '<button class="share-btn" onclick="showToast(\'🔗 Link disalin!\')">🔗 Bagikan</button>' +
            '</div>' +
            renderCommentSection(post, 'my-posts', null) +
        '</div>';
    }
    
    feed.innerHTML = html;
}

// ===== PROFILE: UPDATE STATS =====
function updateProfileStats() {
    var el;
    var myPostCount = 0;
    var likesGiven = 0;
    
    for (var f = 0; f < feedPosts.length; f++) {
        if (feedPosts[f].author === currentUser) myPostCount++;
        if (Array.isArray(feedPosts[f].likedBy) && feedPosts[f].likedBy.indexOf(currentUser) !== -1) likesGiven++;
    }
    
    for (var commId in communityPosts) {
        var posts = communityPosts[commId] || [];
        for (var p = 0; p < posts.length; p++) {
            if (posts[p].author === currentUser) myPostCount++;
            if (Array.isArray(posts[p].likedBy) && posts[p].likedBy.indexOf(currentUser) !== -1) likesGiven++;
        }
    }
    
    el = document.getElementById('pi-username'); if (el) el.textContent = currentUser;
    el = document.getElementById('pi-fullname'); if (el) el.textContent = currentFullname;
    el = document.getElementById('pi-posts'); if (el) el.textContent = myPostCount;
    el = document.getElementById('pi-likes'); if (el) el.textContent = likesGiven;
    
    var myComms = 0;
    for (var i = 0; i < communities.length; i++) {
        if (communities[i].owner === currentUser) myComms++;
    }
    el = document.getElementById('pi-comms'); if (el) el.textContent = myComms;
    
    // Sidebar & profile header — tampilkan badge jika ada
    el = document.getElementById('sidebar-username');
    if (el) el.innerHTML = escapeHtml(currentUser) + getBadgeHTML(currentUser);
    el = document.getElementById('profile-username-display');
    if (el) el.innerHTML = escapeHtml(currentUser) + getBadgeHTML(currentUser);
    el = document.getElementById('profile-fullname-display');
    if (el) el.textContent = currentFullname;
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
        var el = document.getElementById('edit-username'); if (el) { el.maxLength = USERNAME_MAX_LENGTH; el.value = currentUser; }
        el = document.getElementById('edit-fullname'); if (el) el.value = currentFullname;
        el = document.getElementById('edit-bio'); if (el) el.value = currentBio;
        
        // Show photo preview if exists
        var safePhoto = sanitizeMediaSrc(currentUserPhoto, 'image');
        if (safePhoto) {
            var preview = document.getElementById('photo-preview');
            var container = document.getElementById('photo-preview-container');
            if (preview && container) {
                preview.src = safePhoto;
                container.style.display = 'block';
            }
        }
        
        var sec = document.getElementById('profile-edit-section');
        if (sec) sec.classList.remove('hidden');
    }
}

// ===== PROFILE: SAVE =====
function saveProfile() {
    var elUser = document.getElementById('edit-username');
    var elName = document.getElementById('edit-fullname');
    var elBio = document.getElementById('edit-bio');
    
    var newUsername = elUser ? (elUser.value.trim() || currentUser) : currentUser;
    var newFullname = elName ? (elName.value.trim() || 'Pengguna Yaping') : 'Pengguna Yaping';
    var newBio = elBio ? elBio.value.trim() : '';

    if (newUsername.length > USERNAME_MAX_LENGTH) {
        showToast('❌ Username maksimal ' + USERNAME_MAX_LENGTH + ' karakter.');
        if (elUser) {
            elUser.value = newUsername.slice(0, USERNAME_MAX_LENGTH);
            elUser.focus();
        }
        return;
    }
    
    currentUser = newUsername;
    currentFullname = newFullname;
    currentBio = newBio;
    localStorage.setItem('yaping_currentUser', currentUser);
    localStorage.setItem('yaping_currentFullname', currentFullname);
    localStorage.setItem('yaping_currentBio', currentBio);
    
    // Save profile photo if updated
    if (currentUserPhoto) {
        localStorage.setItem('yaping_currentUserPhoto', currentUserPhoto);
    }
    
    // Update display
    renderProfileAvatar();
    renderSidebarProfilePic();
    updateProfileStats();
    renderRightSidebar();
    renderFeed();
    
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
        feedPosts = [];
        communityPosts = {};
        saveFeedPosts();
        saveCommunityPosts();
        rebuildHashtags();
        renderFeed();
        renderMyPosts();
        updateProfileStats();
        renderRightSidebar();
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

function showModal(title, content) {
    var titleEl = document.getElementById('modal-title');
    var bodyEl = document.getElementById('modal-body');
    var overlay = document.getElementById('modal-overlay');
    
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = content;
    if (overlay) overlay.classList.remove('hidden');
}

window.escapeHtml = escapeHtml;
window.formatPostContent = formatPostContent;
window.renderMediaSecure = renderMediaSecure;
