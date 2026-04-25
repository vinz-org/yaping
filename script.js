// DOM Elements
const postInput = document.getElementById('postInput');
const postBtn = document.getElementById('postBtn');
const feed = document.getElementById('feed');
const postCountEl = document.getElementById('postCountEl'); // Updated ID
const likeGivenEl = document.getElementById('likeGivenEl'); // Updated ID

// Load posts from localStorage on startup
let posts = JSON.parse(localStorage.getItem('yapingPosts')) || [];

// Data Komunitas (Dummy + User Created)
let communities = JSON.parse(localStorage.getItem('myCommunities')) || [
    "🎮 Gaming Enthusiasts",
    "📚 Book Lovers Club",
    "🌱 Eco Warriors",
    "💻 Tech Talk Daily"
];

// Render existing posts and communities
renderPosts();
updateProfileStats();
renderCommunities();

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

// ===== LOGIKA KOMUNITAS =====

function saveCommunities() {
    localStorage.setItem('myCommunities', JSON.stringify(communities));
}

function renderCommunities() {
    const listContainer = document.getElementById('communityList');
    listContainer.innerHTML = '';

    communities.forEach((comm, index) => {
        const li = document.createElement('li');
        
        // Tampilkan nama komunitas
        const nameSpan = document.createElement('span');
        nameSpan.textContent = comm;
        
        // Tombol Hapus
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Hapus';
        deleteBtn.className = 'delete-comm-btn';
        deleteBtn.onclick = () => deleteCommunity(index);

        li.appendChild(nameSpan);
        li.appendChild(deleteBtn);
        listContainer.appendChild(li);
    });
}

// Fungsi Hapus Komunitas
window.deleteCommunity = function(index) {
    if(confirm('Yakin ingin menghapus komunitas ini?')) {
        communities.splice(index, 1);
        saveCommunities();
        renderCommunities();
    }
}

// Fungsi Tambah Komunitas Baru
window.addCommunity = function() {
    const input = document.getElementById('newCommunityInput');
    const name = input.value.trim();

    if (!name) {
        alert("Masukkan nama komunitas!");
        return;
    }

    // Cek duplikat sederhana
    if (communities.includes(name)) {
        alert("Komunitas ini sudah ada!");
        return;
    }

    communities.push(name);
    saveCommunities();
    renderCommunities();
    input.value = ''; // Kosongkan input
}