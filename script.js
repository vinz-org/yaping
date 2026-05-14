function renderRightSidebar() {
    var sidebar = document.getElementById('right-sidebar');
    if (!sidebar) return;
    
    var currentUser = typeof getCurrentUsername === 'function' ? getCurrentUsername() : '@user';
    var followers = (typeof userFollowers !== 'undefined' && userFollowers[currentUser]) ? userFollowers[currentUser] : [];
    var following = (typeof userFollowing !== 'undefined' && userFollowing[currentUser]) ? userFollowing[currentUser] : [];
    
    sidebar.innerHTML =
        '<div class="sidebar-box">' +
            '<div class="sidebar-box-title">👥 Pengikut & Diikuti</div>' +
            '<div class="sidebar-stat"><span>Pengikut</span><strong>' + followers.length + '</strong></div>' +
            '<div class="sidebar-stat"><span>Diikuti</span><strong>' + following.length + '</strong></div>' +
            '<div style="margin-top: 12px; display: flex; gap: 8px;">' +
                '<button class="secondary-btn" onclick="showFollowers()" style="flex: 1; padding: 6px; font-size: 11px;">Pengikut</button>' +
                '<button class="secondary-btn" onclick="showFollowing()" style="flex: 1; padding: 6px; font-size: 11px;">Diikuti</button>' +
            '</div>' +
        '</div>';
}
