// DOM Elements
const postInput = document.getElementById('postInput');
const postBtn = document.getElementById('postBtn');
const feed = document.getElementById('feed');
const postCountEl = document.getElementById('postCount');
const likeGivenEl = document.getElementById('likeGiven');

// Load data from localStorage
let posts = JSON.parse(localStorage.getItem('yapingPosts')) || [];
let communities = JSON.parse(localStorage.getItem('myCommunities')) || [
    "🎮 Gaming Enthusiasts",
    "📚 Book Lovers Club",
    "🌱 Eco Warriors",
    "💻 Tech Talk Daily"
];

// Initial Render
renderPosts();
updateProfileStats();
renderCommunities();

// --- POSTING LOGIC ---
postBtn.addEventListener('click', createPost);

function createPost() {
    const content = postInput.value.trim();
    if (!content) return alert("Silakan tulis sesuatu!");

    const newPost = {
        id: Date.now(),
        user: '@user',
        content: content,
        timestamp: new Date().toLocaleString('id-ID'),
        likes: 0,
        likedByMe: false
    };

    posts.unshift(newPost);
    savePosts();
    renderPosts();
    updateProfileStats();
    postInput.value = '';
}

function savePosts() {
    localStorage.setItem('yapingPosts', JSON.stringify(posts));
}

function renderPosts() {
    feed.innerHTML = '';
    posts.forEach(post => {
        const postEl = document.createElement('div');
        postEl.className = 'post-card';
        postEl.innerHTML = `
            <div class="post-header">
                <span>${post.user}</span>
                <span>${post.timestamp}</span>
            </div>
            <div class="post-content">${escapeHtml(post.content)}</div>
            <div class="post-actions">
                <button class="like-btn ${post.likedByMe ? 'active' : ''}" onclick="toggleLike(${post.id})">
                    ❤️ ${post.likes}
                </button>
            </div>
        `;
        feed.appendChild(postEl);
    });
}

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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateProfileStats() {
    postCountEl.textContent = posts.length;
    likeGivenEl.textContent = posts.filter(p => p.likedByMe).length;
}

// --- TAB SWITCHING LOGIC ---
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const savedTab = localStorage.getItem('activeTab') || 'home';
activateTab(savedTab);

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        activateTab(tabName);
        localStorage.setItem('activeTab', tabName);
    });
});

function activateTab(tabName) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

window.switchToTab = function(tabName) {
    activateTab(tabName);
    localStorage.setItem('activeTab', tabName);
};

// --- COMMUNITY LOGIC ---
function saveCommunities() {
    localStorage.setItem('myCommunities', JSON.stringify(communities));
}

function renderCommunities() {
    const listContainer = document.getElementById('communityList');
    listContainer.innerHTML = '';

    communities.forEach((comm, index) => {
        const li = document.createElement('li');
        
        // Membuat elemen klik untuk membuka detail
        const nameSpan = document.createElement('span');
        nameSpan.textContent = comm;
        nameSpan.style.cursor = 'pointer';
        nameSpan.style.flex = '1';
        nameSpan.onclick = () => openCommunityDetail(comm); // Event klik

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Hapus';
        deleteBtn.className = 'delete-comm-btn';
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // Mencegah trigger klik nama
            deleteCommunity(index);
        };

        li.appendChild(nameSpan);
        li.appendChild(deleteBtn);
        listContainer.appendChild(li);
    });
}

window.deleteCommunity = function(index) {
    if (confirm('Yakin ingin menghapus komunitas ini?')) {
        communities.splice(index, 1);
        saveCommunities();
        renderCommunities();
    }
};

window.addCommunity = function() {
    const input = document.getElementById('newCommunityInput');
    const name = input.value.trim();
    if (!name) return alert("Masukkan nama komunitas!");
    if (communities.includes(name)) return alert("Komunitas sudah ada!");

    communities.push(name);
    saveCommunities();
    renderCommunities();
    input.value = '';
};

// --- FITUR BARU: DETAIL KOMUNITAS ---
const communityDetailView = document.getElementById('community-detail-view');
const mainHeader = document.getElementById('mainHeader');
const mainNav = document.getElementById('mainNav');

function openCommunityDetail(name) {
    // Set nama komunitas di tampilan detail
    document.getElementById('detailCommName').textContent = name;
    
    // Tampilkan view detail
    communityDetailView.classList.remove('hidden');
    
    // Sembunyikan header dan tab utama agar fokus ke detail
    mainHeader.style.display = 'none';
    mainNav.style.display = 'none';
}

window.closeCommunityDetail = function() {
    // Sembunyikan view detail
    communityDetailView.classList.add('hidden');
    
    // Tampilkan kembali header dan tab utama
    mainHeader.style.display = 'flex';
    mainNav.style.display = 'flex';
}

window.toggleFollow = function(btn) {
    if (btn.classList.contains('following')) {
        btn.classList.remove('following');
        btn.textContent = 'Follow';
    } else {
        btn.classList.add('following');
        btn.textContent = 'Following';
    }
}
