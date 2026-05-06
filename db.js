// ============================================
// YAPING - Supabase Database Integration
// db.js — simpan di folder yang sama dengan index.html
// ============================================

var SUPABASE_URL = 'https://lzxjjiebpnhjeifnnqms.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6eGpqaWVicG5oamVpZm5ucW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzYxMjYsImV4cCI6MjA5Mjc1MjEyNn0.Tro63bLrHih8EJ4cVBt4SDy2lhVE4P3LQ4T81TFGKRI';

// ===== SUPABASE REST HELPER =====

function sbHeaders() {
    return {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Prefer': 'return=representation'
    };
}

function sbUrl(table, query) {
    return SUPABASE_URL + '/rest/v1/' + table + (query ? '?' + query : '');
}

async function sbGet(table, query) {
    try {
        var res = await fetch(sbUrl(table, query), {
            method: 'GET',
            headers: sbHeaders()
        });
        if (!res.ok) throw new Error('GET ' + table + ' failed: ' + res.status);
        return await res.json();
    } catch (e) {
        console.warn('[DB] sbGet error:', e);
        return null;
    }
}

async function sbInsert(table, data) {
    try {
        var res = await fetch(sbUrl(table), {
            method: 'POST',
            headers: sbHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            var errText = await res.text();
            if (errText.includes('duplicate key') || errText.includes('23505')) return null;
            throw new Error('INSERT ' + table + ' failed: ' + res.status + ' ' + errText);
        }
        return await res.json();
    } catch (e) {
        console.warn('[DB] sbInsert error:', e);
        return null;
    }
}

async function sbUpsert(table, data, onConflict) {
    try {
        var headers = Object.assign({}, sbHeaders());
        headers['Prefer'] = 'resolution=merge-duplicates,return=representation';
        var url = sbUrl(table, onConflict ? 'on_conflict=' + onConflict : '');
        var res = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            var errText = await res.text();
            throw new Error('UPSERT ' + table + ' failed: ' + res.status + ' ' + errText);
        }
        return await res.json();
    } catch (e) {
        console.warn('[DB] sbUpsert error:', e);
        return null;
    }
}

async function sbUpdate(table, matchKey, matchVal, data) {
    try {
        var res = await fetch(sbUrl(table, matchKey + '=eq.' + encodeURIComponent(matchVal)), {
            method: 'PATCH',
            headers: sbHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('UPDATE ' + table + ' failed: ' + res.status);
        return await res.json();
    } catch (e) {
        console.warn('[DB] sbUpdate error:', e);
        return null;
    }
}

async function sbDelete(table, matchKey, matchVal) {
    try {
        var res = await fetch(sbUrl(table, matchKey + '=eq.' + encodeURIComponent(matchVal)), {
            method: 'DELETE',
            headers: sbHeaders()
        });
        if (!res.ok) throw new Error('DELETE ' + table + ' failed: ' + res.status);
        return true;
    } catch (e) {
        console.warn('[DB] sbDelete error:', e);
        return false;
    }
}

// ===== SERVER-SIDE BAN SYSTEM =====
// Ban disimpan di Supabase sehingga tidak bisa dihindari dengan hapus localStorage atau VPN.
// Table: yaping_bans { id, username, client_id, reason, created_at, expires_at, is_permanent }

var _serverBanCache = null;
var _serverBanChecked = false;

async function dbCheckServerBan() {
    // Ambil clientId dari localStorage (jika dihapus, akan dibuat baru tapi ban by username tetap berlaku)
    var clientId = localStorage.getItem('yaping_clientId') || '';
    var username = localStorage.getItem('yaping_currentUser') || '';

    try {
        // Cek ban berdasarkan client_id ATAU username
        var query = '';
        if (clientId && username) {
            query = 'or=(client_id.eq.' + encodeURIComponent(clientId) + ',username.eq.' + encodeURIComponent(username) + ')';
        } else if (clientId) {
            query = 'client_id=eq.' + encodeURIComponent(clientId);
        } else if (username) {
            query = 'username=eq.' + encodeURIComponent(username);
        }

        if (!query) return null;

        var rows = await sbGet('yaping_bans', query + '&order=created_at.desc&limit=1');
        if (!Array.isArray(rows) || rows.length === 0) return null;

        var ban = rows[0];

        // Cek apakah ban sudah expired (kecuali permanent)
        if (!ban.is_permanent) {
            var expiresAt = new Date(ban.expires_at).getTime();
            if (Date.now() >= expiresAt) {
                return null; // Ban sudah habis
            }
        }

        return ban;
    } catch (e) {
        console.warn('[DB] dbCheckServerBan error:', e);
        return null;
    }
}

async function dbSetServerBan(username, clientId, reason, durationMonths, isPermanent) {
    var now = new Date();
    var expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + (durationMonths || 3));

    var banData = {
        username: username || '',
        client_id: clientId || '',
        reason: reason || 'violation',
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        is_permanent: isPermanent === true
    };

    try {
        await sbInsert('yaping_bans', banData);
        console.log('[DB] Server ban set for:', username);
    } catch (e) {
        console.warn('[DB] dbSetServerBan error:', e);
    }
}

// ===== REALTIME =====
var realtimeWs = null;
var realtimeConnected = false;
var realtimeCallbacks = {};

function setupRealtime() {
    try {
        var wsUrl = SUPABASE_URL.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + SUPABASE_ANON_KEY + '&vsn=1.0.0';
        realtimeWs = new WebSocket(wsUrl);

        realtimeWs.onopen = function() {
            realtimeConnected = true;
            console.log('[DB] Realtime connected');

            realtimeWs.send(JSON.stringify({
                topic: 'realtime:yaping-public',
                event: 'phx_join',
                payload: { config: { broadcast: { self: false }, presence: { key: '' } } },
                ref: '1'
            }));

            subscribeTable('feed_posts');
            subscribeTable('community_posts');
            subscribeTable('communities');
            // Tidak ada toast "database terhubung" — dihapus sesuai permintaan
        };

        realtimeWs.onmessage = function(ev) {
            try {
                var msg = JSON.parse(ev.data);
                handleRealtimeMessage(msg);
            } catch (e) { /* ignore */ }
        };

        realtimeWs.onclose = function() {
            realtimeConnected = false;
            console.log('[DB] Realtime disconnected, retrying in 5s...');
            setTimeout(setupRealtime, 5000);
        };

        realtimeWs.onerror = function(e) {
            console.warn('[DB] Realtime error:', e);
        };
    } catch (e) {
        console.warn('[DB] Realtime setup failed:', e);
    }
}

function subscribeTable(tableName) {
    if (!realtimeWs || !realtimeConnected) return;
    realtimeWs.send(JSON.stringify({
        topic: 'realtime:public:' + tableName,
        event: 'phx_join',
        payload: {
            config: {
                postgres_changes: [{ event: '*', schema: 'public', table: tableName }]
            }
        },
        ref: tableName + '-sub'
    }));
}

function handleRealtimeMessage(msg) {
    if (!msg || !msg.event) return;

    if (msg.event === 'postgres_changes' || (msg.payload && msg.payload.type)) {
        var payload = msg.payload || {};
        var record = payload.record || payload.new;
        var table = payload.table || (msg.topic && msg.topic.replace('realtime:public:', ''));

        if (!record || !table) return;

        if (table === 'feed_posts') {
            if (payload.type === 'DELETE') {
                handleRealtimeFeedDelete(payload.old_record);
            } else {
                handleRealtimeFeedPost(record);
            }
        } else if (table === 'community_posts') {
            if (payload.type === 'DELETE') {
                handleRealtimeCommunityDelete(payload.old_record);
            } else {
                handleRealtimeCommunityPost(record);
            }
        } else if (table === 'communities') {
            handleRealtimeCommunity(record);
        }
    }
}

function handleRealtimeFeedPost(row) {
    if (!row) return;
    var post = dbRowToPost(row);
    if (!post) return;

    var existingIdx = findPostIndexById(feedPosts, post.id);
    if (existingIdx !== -1) {
        feedPosts[existingIdx].likes = post.likes;
        feedPosts[existingIdx].likedBy = post.likedBy;
        feedPosts[existingIdx].comments = post.comments;
        saveFeedPosts();
        renderFeed();
        renderMyPosts();
    } else {
        upsertFeedPost(post, true);
    }
}

function handleRealtimeFeedDelete(row) {
    if (!row || !row.id) return;
    var idx = findPostIndexById(feedPosts, row.id);
    if (idx !== -1) {
        feedPosts.splice(idx, 1);
        saveFeedPosts();
        renderFeed();
        renderMyPosts();
        updateProfileStats();
    }
}

function handleRealtimeCommunityPost(row) {
    if (!row) return;
    var commId = row.community_id;
    var post = dbRowToPost(row, commId);
    if (!post) return;

    if (!communityPosts[commId]) communityPosts[commId] = [];
    var existingIdx = findPostIndexById(communityPosts[commId], post.id);
    if (existingIdx !== -1) {
        communityPosts[commId][existingIdx].likes = post.likes;
        communityPosts[commId][existingIdx].likedBy = post.likedBy;
        communityPosts[commId][existingIdx].comments = post.comments;
        saveCommunityPosts();
        if (typeof currentViewedCommunity !== 'undefined' && currentViewedCommunity === parseInt(commId, 10)) {
            var feedEl = document.getElementById('comm-posts-feed');
            if (feedEl) feedEl.innerHTML = renderCommunityPosts(parseInt(commId, 10));
        }
    } else {
        upsertCommunityPost(commId, post, true);
    }
}

function handleRealtimeCommunityDelete(row) {
    if (!row || !row.id || !row.community_id) return;
    var commId = row.community_id;
    if (!communityPosts[commId]) return;
    var idx = findPostIndexById(communityPosts[commId], row.id);
    if (idx !== -1) {
        communityPosts[commId].splice(idx, 1);
        saveCommunityPosts();
        if (typeof currentViewedCommunity !== 'undefined' && currentViewedCommunity === parseInt(commId, 10)) {
            var feedEl = document.getElementById('comm-posts-feed');
            if (feedEl) feedEl.innerHTML = renderCommunityPosts(parseInt(commId, 10));
        }
    }
}

function handleRealtimeCommunity(row) {
    if (!row || !row.id) return;
    var comm = dbRowToCommunity(row);
    if (!comm) return;
    var exists = false;
    for (var i = 0; i < communities.length; i++) {
        if (String(communities[i].id) === String(comm.id)) { exists = true; break; }
    }
    if (!exists) {
        communities.unshift(comm);
        saveCommunities();
        renderCommunities('all');
        renderRightSidebar();
    }
}

// ===== DATA CONVERTERS =====

function postToDbRow(post) {
    return {
        id: post.id,
        author: post.author || '@user',
        content: post.content || '',
        likes: post.likes || 0,
        liked_by: post.likedBy || [],
        created_at: post.createdAt || Date.now(),
        media: post.media || null,
        media_type: post.mediaType || null,
        origin_peer_id: post.originPeerId || null,
        comments: post.comments || []
    };
}

function communityPostToDbRow(post) {
    return {
        id: post.id,
        community_id: post.communityId,
        author: post.author || '@user',
        content: post.content || '',
        likes: post.likes || 0,
        liked_by: post.likedBy || [],
        created_at: post.createdAt || Date.now(),
        media: post.media || null,
        media_type: post.mediaType || null,
        origin_peer_id: post.originPeerId || null,
        comments: post.comments || []
    };
}

function dbRowToPost(row, communityId) {
    if (!row) return null;
    var post = {
        id: row.id,
        author: row.author,
        content: row.content || '',
        likes: row.likes || 0,
        likedBy: Array.isArray(row.liked_by) ? row.liked_by : (row.liked_by ? JSON.parse(row.liked_by) : []),
        createdAt: row.created_at,
        media: row.media || null,
        mediaType: row.media_type || null,
        originPeerId: row.origin_peer_id || null,
        comments: Array.isArray(row.comments) ? row.comments : (row.comments ? JSON.parse(row.comments) : []),
        scope: communityId ? 'community' : 'feed'
    };
    if (communityId !== undefined) post.communityId = parseInt(communityId, 10);
    return post;
}

function communityToDbRow(comm) {
    return {
        id: comm.id,
        name: comm.name,
        description: comm.desc || comm.description || '',
        category: comm.category || '🎮',
        members: comm.members || 1,
        owner: comm.owner || '@user',
        banner: comm.banner || '#4472CA',
        created_at: comm.createdAt || Date.now()
    };
}

function dbRowToCommunity(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        desc: row.description || '',
        category: row.category || '🎮',
        members: row.members || 1,
        owner: row.owner,
        banner: row.banner || '#4472CA',
        createdAt: row.created_at
    };
}

// ===== PUBLIC API =====

var dbReady = false;

async function dbInit() {
    try {
        console.log('[DB] Initializing Supabase connection...');

        // Cek server ban SEBELUM melakukan apapun
        var serverBan = await dbCheckServerBan();
        if (serverBan) {
            window._serverBan = serverBan;
            showServerBanScreen(serverBan);
            return;
        }

        var [dbComms, dbFeedPosts, dbCommPosts] = await Promise.all([
            sbGet('communities', 'order=created_at.desc&limit=200'),
            sbGet('feed_posts', 'order=created_at.desc&limit=500'),
            sbGet('community_posts', 'order=created_at.desc&limit=1000')
        ]);

        var added = 0;

        if (Array.isArray(dbComms)) {
            for (var i = 0; i < dbComms.length; i++) {
                var comm = dbRowToCommunity(dbComms[i]);
                if (!comm) continue;
                var exists = false;
                for (var j = 0; j < communities.length; j++) {
                    if (String(communities[j].id) === String(comm.id)) { exists = true; break; }
                }
                if (!exists) { communities.push(comm); added++; }
            }
            if (added > 0) {
                communities.sort(function(a, b) { return b.createdAt - a.createdAt; });
                saveCommunities();
                renderCommunities('all');
            }
        }

        if (Array.isArray(dbFeedPosts)) {
            var feedAdded = 0;
            for (var k = 0; k < dbFeedPosts.length; k++) {
                var post = dbRowToPost(dbFeedPosts[k]);
                if (!post) continue;
                if (findPostIndexById(feedPosts, post.id) === -1) {
                    feedPosts.push(post);
                    feedAdded++;
                } else {
                    var idx = findPostIndexById(feedPosts, post.id);
                    feedPosts[idx].likes = post.likes;
                    feedPosts[idx].likedBy = post.likedBy;
                    feedPosts[idx].comments = post.comments;
                }
            }
            if (feedAdded > 0) {
                feedPosts.sort(function(a, b) { return b.createdAt - a.createdAt; });
                saveFeedPosts();
                renderFeed();
                renderMyPosts();
                updateProfileStats();
                renderRightSidebar();
            }
        }

        if (Array.isArray(dbCommPosts)) {
            var commAdded = 0;
            for (var m = 0; m < dbCommPosts.length; m++) {
                var cRow = dbCommPosts[m];
                var cid = cRow.community_id;
                var cPost = dbRowToPost(cRow, cid);
                if (!cPost) continue;
                if (!communityPosts[cid]) communityPosts[cid] = [];
                if (findPostIndexById(communityPosts[cid], cPost.id) === -1) {
                    communityPosts[cid].push(cPost);
                    commAdded++;
                } else {
                    var cIdx = findPostIndexById(communityPosts[cid], cPost.id);
                    communityPosts[cid][cIdx].likes = cPost.likes;
                    communityPosts[cid][cIdx].likedBy = cPost.likedBy;
                    communityPosts[cid][cIdx].comments = cPost.comments;
                }
            }
            if (commAdded > 0) {
                saveCommunityPosts();
                if (typeof currentViewedCommunity !== 'undefined' && currentViewedCommunity) {
                    var feedEl = document.getElementById('comm-posts-feed');
                    if (feedEl) feedEl.innerHTML = renderCommunityPosts(currentViewedCommunity);
                }
            }
        }

        dbReady = true;
        console.log('[DB] Sync selesai!');

        await dbPushLocalPosts();
        setupRealtime();

    } catch (e) {
        console.error('[DB] Init error:', e);
        dbReady = false;
    }
}

// ===== TAMPILKAN LAYAR BAN SERVER =====
function showServerBanScreen(banData) {
    if (!document.body) return;
    banData = banData || {};

    var isPermanent = banData.is_permanent === true;
    var expiresAt = isPermanent ? null : new Date(banData.expires_at).getTime();
    var expiresText = isPermanent
        ? 'PERMANEN — tidak ada batas waktu'
        : (expiresAt ? new Date(expiresAt).toLocaleString('id-ID') : '-');

    document.body.innerHTML =
        '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f0f2f5;font-family:Tahoma,Arial,sans-serif;padding:20px;">' +
            '<div style="width:min(520px,100%);background:white;border:1px solid #d8dfea;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,.12);padding:28px;text-align:center;">' +
                '<div style="font-size:48px;margin-bottom:12px;">🚫</div>' +
                '<h1 style="font-size:20px;color:#b00020;margin:0 0 12px;">Akun Diblokir</h1>' +
                '<p style="font-size:13px;line-height:1.6;color:#333;margin:0 0 16px;background:#fff3f3;border:1px solid #ffcccc;border-radius:4px;padding:12px;">' +
                    (isPermanent
                        ? 'Akun kamu telah di-<strong>ban permanen</strong> dari Yaping oleh moderator resmi karena melanggar aturan platform.'
                        : 'Akun kamu telah diblokir dari Yaping. Ban ini berlaku di semua perangkat dan tidak bisa dihindari.') +
                '</p>' +
                '<div style="font-size:12px;color:#555;margin-bottom:8px;background:#f5f5f5;border-radius:4px;padding:10px;">' +
                    '<div><strong>Alasan:</strong> ' + (banData.reason || 'Pelanggaran aturan') + '</div>' +
                    '<div style="margin-top:4px;"><strong>Status:</strong> ' + (isPermanent ? '<span style="color:#b00020;font-weight:bold;">PERMANEN</span>' : 'Sementara') + '</div>' +
                    '<div style="margin-top:4px;"><strong>Berakhir:</strong> ' + expiresText + '</div>' +
                '</div>' +
                (!isPermanent && expiresAt
                    ? '<div id="server-ban-timer" style="font-size:13px;font-weight:bold;color:#b00020;margin-bottom:12px;"></div>'
                    : '') +
                '<div style="font-size:11px;color:#aaa;margin-top:12px;">Ban ini dicatat di server. Menghapus data browser atau menggunakan VPN tidak akan membantu.</div>' +
            '</div>' +
        '</div>';

    if (!isPermanent && expiresAt) {
        (function startTimer() {
            var el = document.getElementById('server-ban-timer');
            function tick() {
                var rem = expiresAt - Date.now();
                if (rem <= 0) { location.reload(); return; }
                var d = Math.floor(rem / 86400000);
                var h = Math.floor((rem % 86400000) / 3600000);
                var m = Math.floor((rem % 3600000) / 60000);
                if (el) el.textContent = 'Sisa waktu: ' + d + ' hari ' + h + ' jam ' + m + ' menit';
            }
            tick();
            setInterval(tick, 60000);
        })();
    }
}

async function dbPushLocalPosts() {
    for (var i = 0; i < feedPosts.length; i++) {
        var post = feedPosts[i];
        await sbUpsert('feed_posts', postToDbRow(post), 'id');
    }

    for (var commId in communityPosts) {
        var posts = communityPosts[commId] || [];
        for (var j = 0; j < posts.length; j++) {
            await sbUpsert('community_posts', communityPostToDbRow(posts[j]), 'id');
        }
    }

    for (var k = 0; k < communities.length; k++) {
        await sbUpsert('communities', communityToDbRow(communities[k]), 'id');
    }
}

// ===== HOOKS INTO EXISTING FUNCTIONS =====

var _origSaveFeedPosts = null;
var _origSaveCommunityPosts = null;
var _origSaveCommunities = null;

function dbInstallHooks() {
    _origSaveFeedPosts = window.saveFeedPosts;
    window.saveFeedPosts = function() {
        if (_origSaveFeedPosts) _origSaveFeedPosts();
        if (dbReady && feedPosts.length > 0) {
            var latest = feedPosts[0];
            sbUpsert('feed_posts', postToDbRow(latest), 'id');
        }
    };

    _origSaveCommunityPosts = window.saveCommunityPosts;
    window.saveCommunityPosts = function() {
        if (_origSaveCommunityPosts) _origSaveCommunityPosts();
        if (!dbReady) return;
        for (var commId in communityPosts) {
            var posts = communityPosts[commId] || [];
            if (posts.length > 0) {
                sbUpsert('community_posts', communityPostToDbRow(posts[0]), 'id');
            }
        }
    };

    _origSaveCommunities = window.saveCommunities;
    window.saveCommunities = function() {
        if (_origSaveCommunities) _origSaveCommunities();
        if (!dbReady) return;
        if (communities.length > 0) {
            sbUpsert('communities', communityToDbRow(communities[0]), 'id');
        }
    };
}

async function dbSyncPost(post, isDelete) {
    if (!dbReady) return;
    if (isDelete) {
        await sbDelete('feed_posts', 'id', post.id);
    } else {
        await sbUpsert('feed_posts', postToDbRow(post), 'id');
    }
}

async function dbSyncCommunityPost(post, isDelete) {
    if (!dbReady) return;
    if (isDelete) {
        await sbDelete('community_posts', 'id', post.id);
    } else {
        await sbUpsert('community_posts', communityPostToDbRow(post), 'id');
    }
}

async function dbSyncCommunity(comm, isDelete) {
    if (!dbReady) return;
    if (isDelete) {
        await sbDelete('communities', 'id', comm.id);
    } else {
        await sbUpsert('communities', communityToDbRow(comm), 'id');
    }
}

// ===== AUTO-START =====
window.dbInit = dbInit;
window.dbSyncPost = dbSyncPost;
window.dbSyncCommunityPost = dbSyncCommunityPost;
window.dbSyncCommunity = dbSyncCommunity;
window.dbInstallHooks = dbInstallHooks;
window.sbUpsert = sbUpsert;
window.sbDelete = sbDelete;
window.dbSetServerBan = dbSetServerBan;
window.dbCheckServerBan = dbCheckServerBan;
window.showServerBanScreen = showServerBanScreen;
