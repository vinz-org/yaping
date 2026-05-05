// ============================================
// YAPING - Supabase Database Integration
// db.js — simpan di folder yang sama dengan index.html
// ============================================

var SUPABASE_URL = 'https://klekcbbeyvxltavjyofl.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsZWtjYmJleXZ4bHRhdmp5b2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Nzg5NzUsImV4cCI6MjA4OTQ1NDk3NX0.A7OF8g2ydgEI9h7JnRUkIjCFHcVMws8J8fkVOHoFXBM';

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
            // Ignore duplicate key errors gracefully
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

            // Join broadcast channel yaping-sync
            realtimeWs.send(JSON.stringify({
                topic: 'realtime:yaping-public',
                event: 'phx_join',
                payload: { config: { broadcast: { self: false }, presence: { key: '' } } },
                ref: '1'
            }));

            // Subscribe to feed_posts changes
            subscribeTable('feed_posts');
            subscribeTable('community_posts');
            subscribeTable('communities');

            if (typeof showToast === 'function') showToast('🗄️ Database terhubung!');
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

    // Handle postgres_changes
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

    // Update existing or insert new
    var existingIdx = findPostIndexById(feedPosts, post.id);
    if (existingIdx !== -1) {
        // Update likes/comments from DB
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

        // Fetch all data from DB and merge into localStorage-backed state
        var [dbComms, dbFeedPosts, dbCommPosts] = await Promise.all([
            sbGet('communities', 'order=created_at.desc&limit=200'),
            sbGet('feed_posts', 'order=created_at.desc&limit=500'),
            sbGet('community_posts', 'order=created_at.desc&limit=1000')
        ]);

        var added = 0;

        // Merge communities
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

        // Merge feed posts
        if (Array.isArray(dbFeedPosts)) {
            var feedAdded = 0;
            for (var k = 0; k < dbFeedPosts.length; k++) {
                var post = dbRowToPost(dbFeedPosts[k]);
                if (!post) continue;
                if (findPostIndexById(feedPosts, post.id) === -1) {
                    feedPosts.push(post);
                    feedAdded++;
                } else {
                    // Update likes/comments from DB (source of truth)
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

        // Merge community posts
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

        // Now push local-only posts to DB (posts that exist locally but not in DB)
        await dbPushLocalPosts();

        // Setup realtime subscriptions
        setupRealtime();

    } catch (e) {
        console.error('[DB] Init error:', e);
        dbReady = false;
    }
}

async function dbPushLocalPosts() {
    // Push feed posts that don't exist in DB yet
    for (var i = 0; i < feedPosts.length; i++) {
        var post = feedPosts[i];
        await sbUpsert('feed_posts', postToDbRow(post), 'id');
    }

    // Push community posts
    for (var commId in communityPosts) {
        var posts = communityPosts[commId] || [];
        for (var j = 0; j < posts.length; j++) {
            await sbUpsert('community_posts', communityPostToDbRow(posts[j]), 'id');
        }
    }

    // Push communities
    for (var k = 0; k < communities.length; k++) {
        await sbUpsert('communities', communityToDbRow(communities[k]), 'id');
    }
}

// ===== HOOKS INTO EXISTING FUNCTIONS =====
// These wrap the existing save functions to also sync to DB.

var _origSaveFeedPosts = null;
var _origSaveCommunityPosts = null;
var _origSaveCommunities = null;

function dbInstallHooks() {
    // Hook saveFeedPosts
    _origSaveFeedPosts = window.saveFeedPosts;
    window.saveFeedPosts = function() {
        if (_origSaveFeedPosts) _origSaveFeedPosts();
        // Sync latest feed post to DB (async, fire and forget)
        if (dbReady && feedPosts.length > 0) {
            var latest = feedPosts[0];
            sbUpsert('feed_posts', postToDbRow(latest), 'id');
        }
    };

    // Hook saveCommunityPosts
    _origSaveCommunityPosts = window.saveCommunityPosts;
    window.saveCommunityPosts = function() {
        if (_origSaveCommunityPosts) _origSaveCommunityPosts();
        if (!dbReady) return;
        // Sync changed community posts (fire and forget)
        for (var commId in communityPosts) {
            var posts = communityPosts[commId] || [];
            if (posts.length > 0) {
                sbUpsert('community_posts', communityPostToDbRow(posts[0]), 'id');
            }
        }
    };

    // Hook saveCommunities
    _origSaveCommunities = window.saveCommunities;
    window.saveCommunities = function() {
        if (_origSaveCommunities) _origSaveCommunities();
        if (!dbReady) return;
        if (communities.length > 0) {
            sbUpsert('communities', communityToDbRow(communities[0]), 'id');
        }
    };
}

// Full sync: called after major write operations (like post, like, comment, delete)
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
// Called from script.js DOMContentLoaded after local init is done.
window.dbInit = dbInit;
window.dbSyncPost = dbSyncPost;
window.dbSyncCommunityPost = dbSyncCommunityPost;
window.dbSyncCommunity = dbSyncCommunity;
window.dbInstallHooks = dbInstallHooks;
window.sbUpsert = sbUpsert;
window.sbDelete = sbDelete;
