// DOM Elements
const postInput = document.getElementById('postInput');
const postBtn = document.getElementById('postBtn');
const feed = document.getElementById('feed');
const postCountEl = document.getElementById('postCount');
const likeGivenEl = document.getElementById('likeGiven');

// Load posts from localStorage on startup
let posts = JSON.parse(localStorage.getItem('yapingPosts')) || [];

// --- PEERJS SETUP ---
let peer;
let conn;
const myPeerId = 'user-' + Math.floor(Math.random() * 1000); // ID unik sementara

function initPeer() {
    peer = new Peer(myPeerId);

    peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
        // Di sini Anda bisa menampilkan ID ini agar user lain bisa connect
        alert("Silakan bagikan ID ini ke teman: " + id);
    });

    peer.on('connection', (connection) => {
        console.log('Someone connected!');
        conn = connection;
        
        // Kirim semua data saat pertama kali connect
        conn.on('open', () => {
            conn.send({ type: 'INIT', data: posts });
        });

        conn.on('data', (data) => {
            handleIncomingData(data);
        });
    });
}

function handleIncomingData(data) {
    if (data.type === 'NEW_POST') {
        // Tambahkan post baru dari teman
        posts.unshift(data.post);
        savePosts();
        renderPosts();
        updateProfileStats();
    } else if (data.type === 'LIKE_UPDATE') {
        // Update like dari teman
        const index = posts.findIndex(p => p.id === data.postId);
        if (index !== -1) {
            posts[index].likes = data.newLikes;
            savePosts();
            renderPosts();
            updateProfileStats();
        }
    } else if (data.type === 'INIT') {
        // Terima data awal dari teman (opsional, bisa digabung)
        console.log('Received initial data from peer');
    }
}

// Fungsi untuk mengirim data ke teman yang terkoneksi
function broadcastToPeers(type, payload) {
    if (conn && conn.open) {
        conn.send({ type, ...payload });
    }
}

// --- END PEERJS SETUP ---

// Render existing posts
renderPosts();
updateProfileStats();
initPeer(); // Mulai PeerJS

// Event Listener for Posting
postBtn.addEventListener('click', () => {
    const content = postInput.value.trim();
    if (!content) return alert("Please write something!");
    
    const newPost = {
        id: Date.now(),
        user: '@user',
        content: content,
        timestamp: new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }),
        likes: 0,
        likedByMe: false
    };
    
    posts.unshift(newPost); // Add to top
    savePosts();
    renderPosts();
    updateProfileStats();
    postInput.value = ''; // Clear input
    
    // Broadcast post baru ke teman
    broadcastToPeers('NEW_POST', { post: newPost });
});

// Save to localStorage
function savePosts() {
    localStorage.setItem('yapingPosts', JSON.stringify(posts));
}

// Render all posts
function renderPosts() {
    feed.innerHTML = '';
    posts.forEach(post => {
        const postEl = document.createElement('div');
        postEl.className = 'post-card';
        postEl.dataset.id = post.id;
        postEl.innerHTML = `
           <div class= "post-header " >
             <span >${post.user} </span >
             <span >${post.timestamp} </span >
           </div >
           <div class= "post-content " >${escapeHtml(post.content)} </div >
           <div class= "post-actions " >
             <button class= "like-btn ${post.likedByMe ? 'active' : ''} " onclick= "toggleLike(${post.id}) " >
              ❤️ ${post.likes}
             </button >
           </div >
        `;
        feed.appendChild(postEl);
    });
}

// Toggle Like Functionality
window.toggleLike = function(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    if (post.likedByMe) {
        post.likes--;
        post.likedByMe = false;
    } else {
        post.likes++;
        post.likedByMe = true;
    }
    
    savePosts();
    renderPosts();
    updateProfileStats();
    
    // Broadcast update like
    broadcastToPeers('LIKE_UPDATE', { postId, newLikes: post.likes });
};

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update profile stats
function updateProfileStats() {
    const totalPosts = posts.length;
    const totalLikesGiven = posts.filter(p => p.likedByMe).length;
    postCountEl.textContent = totalPosts;
    likeGivenEl.textContent = totalLikesGiven;
}

// ===== TAB SWITCHING LOGIC =====
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
// Load saved active tab from localStorage
const savedTab = localStorage.getItem('activeTab') || 'home';
activateTab(savedTab);
// Add click event to each tab button
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        activateTab(tabName);
        localStorage.setItem('activeTab', tabName); // Save preference
    });
});
function activateTab(tabName) {
    // Remove active class from all buttons and contents
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    // Activate selected tab
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}
// Fungsi untuk switch ke tab tertentu (digunakan saat klik profile picture)
window.switchToTab = function(tabName) {
    activateTab(tabName);
    localStorage.setItem('activeTab', tabName);
};
