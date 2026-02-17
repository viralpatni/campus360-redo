// ============================================
// Campus360 — Forum JS (forum.html)
// ============================================

const AUTH_API  = 'php/auth.php';
const FORUM_API = 'php/forum_api.php';
const UPLOAD_API = 'php/upload.php';

let currentUser = null;
let currentPage = 1;
let postVisibility = 'public';
let selectedImage = null;

// ===== INIT =====
(async function init() {
  try {
    const res = await fetch(AUTH_API + '?action=check');
    const data = await res.json();
    if (!data.loggedIn) { window.location.href = 'login.html'; return; }
    currentUser = data.user;
    document.getElementById('userName').textContent = currentUser.name;

    // Set profile
    const initial = currentUser.name.charAt(0).toUpperCase();
    document.getElementById('myAvatar').textContent = initial;
    document.getElementById('composerAvatar').textContent = initial;
    document.getElementById('myName').textContent = currentUser.name;
    document.getElementById('myUsername').textContent = '@' + currentUser.username;

    loadProfile();
    loadFeed();
    loadFollowRequests();

    // Poll for new stuff every 5s
    setInterval(() => {
      loadFollowRequests();
    }, 10000);
  } catch (e) {
    window.location.href = 'login.html';
  }
})();

// ===== LOGOUT =====
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch(AUTH_API + '?action=logout');
  window.location.href = 'login.html';
});

// ===== PROFILE =====
async function loadProfile() {
  try {
    const res = await fetch(FORUM_API + '?action=get_profile');
    const data = await res.json();
    if (data.success) {
      document.getElementById('myPosts').textContent = data.user.post_count;
      document.getElementById('myFollowers').textContent = data.user.follower_count;
      document.getElementById('myFollowing').textContent = data.user.following_count;
    }
  } catch (e) {}
}

// ===== FEED =====
async function loadFeed(page = 1) {
  try {
    const res = await fetch(FORUM_API + '?action=get_feed&page=' + page);
    const data = await res.json();
    if (!data.success) return;

    const container = document.getElementById('feedContainer');
    if (page === 1) container.innerHTML = '';

    if (data.posts.length === 0 && page === 1) {
      container.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <p>No posts yet. Be the first to share something!</p>
          </div>
        </div>`;
      document.getElementById('loadMoreBtn').style.display = 'none';
      return;
    }

    data.posts.forEach(post => {
      container.appendChild(createPostElement(post));
    });

    document.getElementById('loadMoreBtn').style.display =
      data.posts.length >= 20 ? 'block' : 'none';

    currentPage = page;
  } catch (e) { console.error('Feed error:', e); }
}

function loadMorePosts() {
  loadFeed(currentPage + 1);
}

function createPostElement(post) {
  const card = document.createElement('div');
  card.className = 'card post-card';
  card.id = 'post-' + post.id;

  const isMine = String(post.user_id) === String(currentUser.id);
  const liked = parseInt(post.liked_by_me) > 0;
  const initial = (post.author_name || '?').charAt(0).toUpperCase();
  const time = formatTime(post.created_at);

  let imageHtml = '';
  if (post.image_path) {
    imageHtml = `<img class="post-image" src="${escHtml(post.image_path)}" alt="Post image" onclick="window.open('${escHtml(post.image_path)}','_blank')" />`;
  }

  card.innerHTML = `
    <div class="post-header">
      <div class="post-avatar">${initial}</div>
      <div>
        <div class="post-author-name">${escHtml(post.author_name)}</div>
        <div class="post-meta">
          @${escHtml(post.author_username)} · ${time}
          <span class="post-badge ${post.visibility}">${post.visibility === 'public' ? '🌍 Public' : '🔒 Private'}</span>
        </div>
      </div>
      ${isMine ? `<button class="post-delete" onclick="deletePost(${post.id})" title="Delete post">🗑</button>` : ''}
    </div>
    ${post.content ? `<div class="post-content">${escHtml(post.content)}</div>` : ''}
    ${imageHtml}
    <div class="post-actions">
      <button class="post-action-btn ${liked ? 'liked' : ''}" onclick="toggleLike(${post.id}, this)">
        <span class="icon">${liked ? '❤️' : '🤍'}</span>
        <span class="like-count">${post.like_count}</span>
      </button>
      <button class="post-action-btn" onclick="toggleComments(${post.id})">
        <span class="icon">💬</span>
        <span>${post.comment_count} Comments</span>
      </button>
    </div>
    <div class="comments-section" id="comments-${post.id}">
      <div class="comments-list" id="comments-list-${post.id}"></div>
      <div class="comment-input-row">
        <input type="text" placeholder="Write a comment..." id="comment-input-${post.id}" onkeydown="if(event.key==='Enter')addComment(${post.id})" />
        <button class="comment-submit" onclick="addComment(${post.id})">Send</button>
      </div>
    </div>
  `;

  return card;
}

// ===== CREATE POST =====
async function createPost() {
  const textarea = document.getElementById('postContent');
  const content = textarea.value.trim();
  const btn = document.getElementById('postBtn');

  if (!content && !selectedImage) {
    showToast('Please write something or attach an image');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Posting...';

  try {
    let imagePath = null;

    // Upload image if selected
    if (selectedImage) {
      const uploadData = new FormData();
      uploadData.append('file', selectedImage);
      uploadData.append('type', 'image');
      const uploadRes = await fetch(UPLOAD_API, { method: 'POST', body: uploadData });
      const uploadResult = await uploadRes.json();
      if (uploadResult.success) {
        imagePath = uploadResult.file_path;
      } else {
        showToast(uploadResult.error || 'Image upload failed');
        btn.disabled = false;
        btn.textContent = 'Post';
        return;
      }
    }

    const formData = new FormData();
    formData.append('action', 'create_post');
    formData.append('content', content);
    formData.append('visibility', postVisibility);
    if (imagePath) formData.append('image_path', imagePath);

    const res = await fetch(FORUM_API, { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      textarea.value = '';
      selectedImage = null;
      document.getElementById('imagePreviewName').textContent = '';
      document.getElementById('postImageInput').value = '';
      showToast('Post published! 🎉');
      loadFeed(1);
      loadProfile();
    } else {
      showToast(data.error || 'Failed to create post');
    }
  } catch (e) {
    showToast('Network error');
  }

  btn.disabled = false;
  btn.textContent = 'Post';
}

// ===== VISIBILITY TOGGLE =====
function toggleVisibility() {
  const btn = document.getElementById('visToggle');
  if (postVisibility === 'public') {
    postVisibility = 'private';
    btn.innerHTML = '🔒 Private';
    btn.classList.add('private');
  } else {
    postVisibility = 'public';
    btn.innerHTML = '🌍 Public';
    btn.classList.remove('private');
  }
}

// ===== IMAGE ATTACH =====
document.getElementById('imageAttachBtn').addEventListener('click', () => {
  document.getElementById('postImageInput').click();
});

document.getElementById('postImageInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedImage = file;
    document.getElementById('imagePreviewName').textContent = file.name;
  }
});

// ===== LIKE / UNLIKE =====
async function toggleLike(postId, btn) {
  try {
    const formData = new FormData();
    formData.append('action', 'like_post');
    formData.append('post_id', postId);

    const res = await fetch(FORUM_API, { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      const icon = btn.querySelector('.icon');
      const count = btn.querySelector('.like-count');
      const current = parseInt(count.textContent);

      if (data.action === 'liked') {
        btn.classList.add('liked');
        icon.textContent = '❤️';
        count.textContent = current + 1;
      } else {
        btn.classList.remove('liked');
        icon.textContent = '🤍';
        count.textContent = Math.max(0, current - 1);
      }
    }
  } catch (e) {}
}

// ===== COMMENTS =====
async function toggleComments(postId) {
  const section = document.getElementById('comments-' + postId);
  if (section.classList.contains('open')) {
    section.classList.remove('open');
    return;
  }

  section.classList.add('open');
  await loadComments(postId);
}

async function loadComments(postId) {
  try {
    const res = await fetch(FORUM_API + '?action=get_comments&post_id=' + postId);
    const data = await res.json();
    if (!data.success) return;

    const list = document.getElementById('comments-list-' + postId);
    if (data.comments.length === 0) {
      list.innerHTML = '<div style="font-size:0.78rem; color:rgba(255,255,255,0.3); padding:0.3rem 0;">No comments yet</div>';
      return;
    }

    list.innerHTML = data.comments.map(c => `
      <div class="comment-item">
        <div class="comment-avatar">${(c.author_name || '?').charAt(0).toUpperCase()}</div>
        <div class="comment-body">
          <div class="comment-author">${escHtml(c.author_name)}</div>
          <div class="comment-text">${escHtml(c.content)}</div>
          <div class="comment-time">${formatTime(c.created_at)}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {}
}

async function addComment(postId) {
  const input = document.getElementById('comment-input-' + postId);
  const content = input.value.trim();
  if (!content) return;

  input.value = '';

  try {
    const formData = new FormData();
    formData.append('action', 'add_comment');
    formData.append('post_id', postId);
    formData.append('content', content);

    const res = await fetch(FORUM_API, { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      await loadComments(postId);
      // Update comment count in the post
      const postEl = document.getElementById('post-' + postId);
      if (postEl) {
        const commentBtn = postEl.querySelectorAll('.post-action-btn')[1];
        if (commentBtn) {
          const span = commentBtn.querySelector('span:last-child');
          const match = span.textContent.match(/(\d+)/);
          if (match) {
            span.textContent = (parseInt(match[1]) + 1) + ' Comments';
          }
        }
      }
    }
  } catch (e) {}
}

// ===== DELETE POST =====
async function deletePost(postId) {
  if (!confirm('Delete this post?')) return;

  try {
    const formData = new FormData();
    formData.append('action', 'delete_post');
    formData.append('post_id', postId);

    const res = await fetch(FORUM_API, { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      const el = document.getElementById('post-' + postId);
      if (el) el.remove();
      showToast('Post deleted');
      loadProfile();
    }
  } catch (e) {}
}

// ===== FOLLOW REQUESTS =====
async function loadFollowRequests() {
  try {
    const res = await fetch(FORUM_API + '?action=get_follow_requests');
    const data = await res.json();
    if (!data.success) return;

    const badge = document.getElementById('reqBadge');
    badge.textContent = data.requests.length > 0 ? `(${data.requests.length})` : '';

    const list = document.getElementById('followReqList');
    if (data.requests.length === 0) {
      list.innerHTML = '<div class="empty-state" style="padding:0.5rem;">No pending requests</div>';
      return;
    }

    list.innerHTML = data.requests.map(r => `
      <div class="follow-req-item" id="freq-${r.id}">
        <div class="follow-req-avatar">${r.name.charAt(0).toUpperCase()}</div>
        <div class="follow-req-info">
          <div class="follow-req-name">${escHtml(r.name)}</div>
          <div class="follow-req-sub">@${escHtml(r.username)}</div>
        </div>
        <div class="follow-req-actions">
          <button class="follow-req-btn accept" onclick="respondFollow(${r.id}, 'accepted')">✓</button>
          <button class="follow-req-btn reject" onclick="respondFollow(${r.id}, 'rejected')">✕</button>
        </div>
      </div>
    `).join('');
  } catch (e) {}
}

async function respondFollow(followId, response) {
  try {
    const formData = new FormData();
    formData.append('action', 'respond_follow');
    formData.append('follow_id', followId);
    formData.append('response', response);

    const res = await fetch(FORUM_API, { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      const el = document.getElementById('freq-' + followId);
      if (el) el.remove();
      showToast(response === 'accepted' ? 'Follow request accepted!' : 'Follow request rejected');
      loadFollowRequests();
      loadProfile();
      if (response === 'accepted') loadFeed(1);
    }
  } catch (e) {}
}

// ===== SEARCH USERS =====
let searchTimeout = null;
document.getElementById('userSearch').addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (q.length < 2) {
    document.getElementById('searchResults').innerHTML = '<div class="empty-state" style="padding:0.5rem;">Type to search</div>';
    return;
  }
  searchTimeout = setTimeout(() => searchUsers(q), 300);
});

async function searchUsers(query) {
  try {
    const res = await fetch(FORUM_API + '?action=search_users&q=' + encodeURIComponent(query));
    const data = await res.json();
    if (!data.success) return;

    const container = document.getElementById('searchResults');
    if (data.users.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:0.5rem;">No users found</div>';
      return;
    }

    container.innerHTML = data.users.map(u => {
      let btnClass = 'follow';
      let btnText = 'Follow';
      let btnAction = `sendFollow(${u.id}, this)`;

      if (u.follow_status === 'accepted') {
        btnClass = 'following';
        btnText = 'Unfollow';
        btnAction = `unfollowUser(${u.id}, this)`;
      } else if (u.follow_status === 'pending') {
        btnClass = 'pending';
        btnText = 'Pending';
        btnAction = '';
      }

      return `
        <div class="search-result-item">
          <div class="follow-req-avatar">${u.name.charAt(0).toUpperCase()}</div>
          <div class="follow-req-info">
            <div class="follow-req-name">${escHtml(u.name)}</div>
            <div class="follow-req-sub">@${escHtml(u.username)} · ${escHtml(u.regno)}</div>
          </div>
          <button class="follow-btn ${btnClass}" onclick="${btnAction}">${btnText}</button>
        </div>
      `;
    }).join('');
  } catch (e) {}
}

async function sendFollow(userId, btn) {
  try {
    const formData = new FormData();
    formData.append('action', 'send_follow');
    formData.append('user_id', userId);

    const res = await fetch(FORUM_API, { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      btn.className = 'follow-btn pending';
      btn.textContent = 'Pending';
      btn.onclick = null;
      showToast('Follow request sent!');
    } else {
      showToast(data.error || 'Could not send request');
    }
  } catch (e) { showToast('Network error'); }
}

async function unfollowUser(userId, btn) {
  try {
    const formData = new FormData();
    formData.append('action', 'unfollow');
    formData.append('user_id', userId);

    const res = await fetch(FORUM_API, { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      btn.className = 'follow-btn follow';
      btn.textContent = 'Follow';
      btn.setAttribute('onclick', `sendFollow(${userId}, this)`);
      showToast('Unfollowed');
      loadProfile();
    }
  } catch (e) {}
}

// ===== UTILITIES =====
function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (now - d) / 1000;

  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';

  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}
