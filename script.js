// DOM Elements
const postInput = document.getElementById('postInput');
const postBtn = document.getElementById('postBtn');
const feed = document.getElementById('feed');
const postCountEl = document.getElementById('postCount');
const likeGivenEl = document.getElementById('likeGiven');

// Load posts from localStorage on startup
let posts = JSON.parse(localStorage.getItem('yapingPosts')) || [];

// Load communities with metadata (owner, createdAt)
let communitiesData = JSON.parse(localStorage.getItem('yapingCommunities')) || [
    { id: 1, name: "🎮 Gaming Squad", owner: "@qwertty", createdAt: Date.now() },
    { id: 2, name: "😂 Meme", owner: "@dudememe", createdAt: Date.now() },
    { id: 3, name: "💻 Tech Talk Daily", owner: "@techguru", createdAt: Date.now() }
];

// Current user (simulated)
const currentUser = "@user";

// Render existing posts
renderPosts();
updateProfileStats();
renderCommunities();

// Event Listener for Posting
postBtn.addEventListener('click', () => {
    const content = postInput.value.trim();
    if (!content) return alert("Please write something!");
    
    const newPost = {
        id: Date.now(),
        user: currentUser,
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

// Save communities to localStorage
function saveCommunities() {
    localStorage.setItem('yapingCommunities', JSON.stringify(communitiesData));
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

// ===== COMMUNITY FUNCTIONS =====

// Render communities list
function renderCommunities() {
    const listContainer = document.getElementById('communityList');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    communitiesData.forEach(comm => {
        const li = document.createElement('li');
        li.style.cursor = 'pointer';
        li.style.padding = '12px';
        li.style.borderBottom = '1px solid #eee';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        
        // Community name (clickable)
        const nameSpan = document.createElement('span');
        nameSpan.textContent = comm.name;
        nameSpan.style.flex = '1';
        nameSpan.onclick = () => openCommunityDetail(comm);
        
        li.appendChild(nameSpan);
        
        // Only show delete button if user is the owner
        if (comm.owner === currentUser) {
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Hapus';
            deleteBtn.className = 'delete-comm-btn';
            deleteBtn.style.background = '#ffebee';
            deleteBtn.style.color = '#d32f2f';
            deleteBtn.style.border = 'none';
            deleteBtn.style.padding = '5px 10px';
            deleteBtn.style.borderRadius = '4px';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.style.fontSize = '0.8rem';
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent opening detail view
                deleteCommunity(comm.id);
            };
            li.appendChild(deleteBtn);
        } else {
            // Show owner info instead of delete button
            const ownerSpan = document.createElement('span');
            ownerSpan.textContent = comm.owner;
            ownerSpan.style.fontSize = '0.8rem';
            ownerSpan.style.color = '#666';
            li.appendChild(ownerSpan);
        }
        
        listContainer.appendChild(li);
    });
}

// Delete community (only for owner)
window.deleteCommunity = function(commId) {
    if (confirm('Yakin ingin menghapus komunitas ini?')) {
        communitiesData = communitiesData.filter(c => c.id !== commId);
        saveCommunities();
        renderCommunities();
    }
};

// Add new community with 2-week cooldown
window.addCommunity = function() {
    const input = document.getElementById('newCommunityInput');
    const name = input.value.trim();
    
    if (!name) {
        alert("Masukkan nama komunitas!");
        return;
    }
    
    // Check if community with same name exists
    if (communitiesData.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        alert("Komunitas dengan nama ini sudah ada!");
        return;
    }
    
    // Check 2-week cooldown (14 days = 14 * 24 * 60 * 60 * 1000 ms)
    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
    const userCommunities = communitiesData.filter(c => c.owner === currentUser);
    
    if (userCommunities.length > 0) {
        const latestCommunity = userCommunities.reduce((latest, current) => {
            return current.createdAt > latest.createdAt ? current : latest;
        });
        
        const timeSinceLastCreation = Date.now() - latestCommunity.createdAt;
        
        if (timeSinceLastCreation < TWO_WEEKS_MS) {
            const daysRemaining = Math.ceil((TWO_WEEKS_MS - timeSinceLastCreation) / (24 * 60 * 60 * 1000));
            alert(`Anda harus menunggu ${daysRemaining} hari lagi sebelum membuat komunitas baru! (Cooldown 2 minggu)`);
            return;
        }
    }
    
    // Create new community
    const newCommunity = {
        id: Date.now(),
        name: name,
        owner: currentUser,
        createdAt: Date.now()
    };
    
    communitiesData.push(newCommunity);
    saveCommunities();
    renderCommunities();
    input.value = '';
    alert("Komunitas berhasil dibuat!");
};

// Open community detail view
window.openCommunityDetail = function(community) {
    // Hide main content
    document.getElementById('home-tab').classList.remove('active');
    document.getElementById('komunitas-tab').classList.remove('active');
    document.getElementById('profile-tab').classList.remove('active');
    document.querySelector('.tab-nav').style.display = 'none';
    document.querySelector('.app-header').style.display = 'none';
    
    // Create or show community detail view
    let detailView = document.getElementById('communityDetailView');
    if (!detailView) {
        detailView = document.createElement('div');
        detailView.id = 'communityDetailView';
        detailView.className = 'tab-content active';
        document.querySelector('.container').appendChild(detailView);
    }
    
    const isOwner = community.owner === currentUser;
    const daysSinceCreation = Math.floor((Date.now() - community.createdAt) / (24 * 60 * 60 * 1000));
    
    detailView.innerHTML = `
        <div style="padding: 20px;">
            <button onclick="closeCommunityDetail()" style="background: none; border: none; color: #4a6da7; font-size: 1rem; cursor: pointer; margin-bottom: 20px;">
                ← Kembali
            </button>
            
            <div style="background: #1a1a1a; height: 150px; border-radius: 12px; margin-bottom: 60px;"></div>
            
            <div style="display: flex; align-items: flex-end; margin: -50px 20px 20px;">
                <div style="width: 80px; height: 80px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; border: 4px solid #f8f9fa;">
                    👥
                </div>
                <div style="margin-left: 15px; flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <h2 style="margin: 0; font-size: 1.3rem;">${community.name}</h2>
                        <svg style="width: 20px; height: 20px; background: #1d9bf0; border-radius: 50%; padding: 2px;" viewBox="0 0 24 24" fill="white">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                    </div>
                    <p style="color: #666; font-size: 0.9rem; margin: 5px 0;">${community.owner} • Dibuat ${daysSinceCreation} hari yang lalu</p>
                </div>
                <button onclick="toggleFollow(this)" style="background: #1d9bf0; color: white; border: none; padding: 10px 24px; border-radius: 20px; font-weight: 700; cursor: pointer;">
                    Follow
                </button>
            </div>
            
            <div style="background: white; border-radius: 12px; padding: 20px; margin: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                <div style="font-weight: 700; margin-bottom: 10px;">${community.owner} (owner)</div>
                <div style="color: #666;">Selamat datang di ${community.name}! Komunitas ini dibuat ${daysSinceCreation} hari yang lalu.</div>
                ${isOwner ? `<div style="margin-top: 15px; padding: 10px; background: #e8f5e9; border-radius: 8px; color: #2e7d32; font-size: 0.9rem;">✓ Anda adalah pemilik komunitas ini</div>` : ''}
            </div>
            
            ${isOwner ? `
            <div style="background: white; border-radius: 12px; padding: 20px; margin: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                <h3 style="margin-bottom: 10px;">Pengaturan Komunitas</h3>
                <button onclick="deleteCommunity(${community.id})" style="background: #ffebee; color: #d32f2f; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    Hapus Komunitas
                </button>
            </div>
            ` : ''}
        </div>
    `;
    
    detailView.classList.add('active');
    window.scrollTo(0, 0);
};

// Close community detail view
window.closeCommunityDetail = function() {
    const detailView = document.getElementById('communityDetailView');
    if (detailView) {
        detailView.remove();
    }
    
    // Show main content again
    document.querySelector('.tab-nav').style.display = 'flex';
    document.querySelector('.app-header').style.display = 'flex';
    activateTab('komunitas');
};

// Toggle follow button
window.toggleFollow = function(btn) {
    if (btn.textContent === 'Follow') {
        btn.textContent = 'Following';
        btn.style.background = '#e8f5e9';
        btn.style.color = '#2e7d32';
        btn.style.border = '1px solid #2e7d32';
    } else {
        btn.textContent = 'Follow';
        btn.style.background = '#1d9bf0';
        btn.style.color = 'white';
        btn.style.border = 'none';
    }
};
