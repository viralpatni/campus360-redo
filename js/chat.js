// ============================================
// Campus360 — Chat JS (chat.html)
// ============================================

const CHAT_API = 'php/chat.php';
const AUTH_API = 'php/auth.php';

let currentUser = null;    // { id, name, username, regno }
let activeConvId = null;   // currently open conversation ID
let conversations = [];    // cached conversation list
let msgPollTimer = null;   // message polling interval
let notifPollTimer = null; // notification polling interval
let lastMsgTime = null;    // for incremental message fetching
let renderedMsgIds = new Set(); // track rendered message IDs to prevent duplicates

// ===== INIT =====
(async function init() {
  try {
    const res = await fetch(AUTH_API + '?action=check');
    const data = await res.json();
    if (!data.loggedIn) {
      window.location.href = 'login.html';
      return;
    }
    currentUser = data.user;
    loadConversations();
    loadNotifications();
    // Poll for new notifications every 10s
    notifPollTimer = setInterval(loadNotifications, 10000);
  } catch (e) {
    window.location.href = 'login.html';
  }
})();

// ===== HELPER: initials from name =====
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

// ===== HELPER: format timestamp =====
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ===== HELPER: toast =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ===== LOGOUT =====
async function logout() {
  try { await fetch(AUTH_API + '?action=logout'); } catch (e) {}
  window.location.href = 'login.html';
}

// ===== SIDEBAR TAB SWITCHING =====
function switchTab(tab) {
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.sidebar-tab[data-tab="${tab}"]`).classList.add('active');
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(tab === 'chats' ? 'tabChats' : 'tabNotifications').classList.add('active');
}

// ============================================================
// CONVERSATIONS (Chats Tab)
// ============================================================

async function loadConversations() {
  try {
    const res = await fetch(CHAT_API + '?action=get_conversations');
    const data = await res.json();
    if (data.success) {
      conversations = data.conversations;
      renderConversations();
    }
  } catch (e) {
    console.error('Failed to load conversations:', e);
  }
}

function renderConversations(filter = '') {
  const list = document.getElementById('convList');
  let filtered = conversations;
  if (filter) {
    const q = filter.toLowerCase();
    filtered = conversations.filter(c => {
      const name = getConvName(c).toLowerCase();
      return name.includes(q);
    });
  }

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-list">
      ${filter ? 'No matching conversations' : 'No conversations yet.<br>Click <b>+ New Chat</b> to start!'}
    </div>`;
    return;
  }

  list.innerHTML = filtered.map(c => {
    const name = getConvName(c);
    const initials = getInitials(name);
    const active = activeConvId === c.id ? ' active' : '';
    const preview = c.last_message || 'No messages yet';
    const time = formatTime(c.last_message_time);
    return `<div class="conv-item${active}" onclick="openChat(${c.id})">
      <div class="conv-avatar">${initials}</div>
      <div class="conv-info">
        <div class="conv-name">${escHtml(name)}</div>
        <div class="conv-preview">${escHtml(preview)}</div>
      </div>
      <div class="conv-meta">
        <span class="conv-time">${time}</span>
      </div>
    </div>`;
  }).join('');
}

function getConvName(conv) {
  if (conv.type === 'group') return conv.group_name || 'Group';
  if (conv.other_user) return conv.other_user.name || conv.other_user.username;
  return 'Chat';
}

function getConvUsername(conv) {
  if (conv.other_user) return '@' + conv.other_user.username;
  return '';
}

// ============================================================
// OPEN CHAT & MESSAGES
// ============================================================

async function openChat(convId) {
  activeConvId = convId;
  lastMsgTime = null;

  // Clear any existing poll
  if (msgPollTimer) clearInterval(msgPollTimer);

  // Show chat view
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('chatView').style.display = 'flex';

  // Find conversation data
  const conv = conversations.find(c => String(c.id) === String(convId));
  const name = conv ? getConvName(conv) : 'Chat';
  const username = conv ? getConvUsername(conv) : '';

  // Update header
  document.getElementById('chatAvatar').textContent = getInitials(name);
  document.getElementById('chatName').textContent = name;
  document.getElementById('chatStatus').textContent = conv.type === 'group' ? 'Group chat' : (username || 'Direct message');

  // Update info panel
  document.getElementById('infoAvatar').textContent = getInitials(name);
  document.getElementById('infoName').textContent = name;
  document.getElementById('infoStatus').textContent = username;
  document.getElementById('infoBio').textContent = conv.type === 'group' ? 'Group conversation' : 'Direct conversation';

  // Re-render conversation list to highlight active
  renderConversations(document.getElementById('searchInput').value);

  // Hide sidebar on mobile
  document.getElementById('sidebar').classList.add('hidden-mobile');

  // Load messages
  await loadMessages(convId);

  // Start polling for new messages every 3s
  msgPollTimer = setInterval(() => pollMessages(convId), 3000);
}

async function loadMessages(convId) {
  try {
    const res = await fetch(CHAT_API + '?action=get_messages&conversation_id=' + convId);
    const data = await res.json();
    if (data.success) {
      renderedMsgIds.clear();
      renderAllMessages(data.messages);
      if (data.messages.length > 0) {
        lastMsgTime = data.messages[data.messages.length - 1].created_at;
      }
    }
  } catch (e) {
    console.error('Failed to load messages:', e);
  }
}

async function pollMessages(convId) {
  if (convId !== activeConvId) return;
  try {
    let url = CHAT_API + '?action=get_messages&conversation_id=' + convId;
    if (lastMsgTime) url += '&after=' + encodeURIComponent(lastMsgTime);
    const res = await fetch(url);
    const data = await res.json();
    if (data.success && data.messages.length > 0) {
      appendMessages(data.messages);
      lastMsgTime = data.messages[data.messages.length - 1].created_at;
      // Also refresh conversation list to update last message preview
      loadConversations();
    }
  } catch (e) {}
}

function renderAllMessages(msgs) {
  const container = document.getElementById('messages');
  container.innerHTML = '';
  renderedMsgIds.clear();
  if (msgs.length === 0) {
    container.innerHTML = '<div class="empty-list" style="padding:40px">No messages yet. Say hello! 👋</div>';
    return;
  }
  container.innerHTML = '<div class="date-divider"><span>Conversation Start</span></div>';
  msgs.forEach(m => appendSingleMessage(container, m));
  requestAnimationFrame(() => container.scrollTop = container.scrollHeight);
}

function appendMessages(msgs) {
  const container = document.getElementById('messages');
  // Remove "no messages" placeholder if present
  const placeholder = container.querySelector('.empty-list');
  if (placeholder) { container.innerHTML = ''; }
  msgs.forEach(m => appendSingleMessage(container, m));
  requestAnimationFrame(() => container.scrollTop = container.scrollHeight);
}

function appendSingleMessage(container, m) {
  // Skip if we already rendered this message (prevents duplicates from polling)
  if (m.id) {
    if (renderedMsgIds.has(String(m.id))) return;
    renderedMsgIds.add(String(m.id));
  }

  const isSent = String(m.sender_id) === String(currentUser.id);
  const bubble = document.createElement('div');
  bubble.className = 'msg ' + (isSent ? 'sent' : 'received');

  let content = '';
  if (!isSent) {
    content += `<div class="msg-sender">${escHtml(m.sender_name)}</div>`;
  }
  if (m.message_type === 'image' && m.file_path) {
    content += `<img class="msg-img" src="${escHtml(m.file_path)}" alt="image">`;
  }
  content += escHtml(m.content || '');
  bubble.innerHTML = content;
  container.appendChild(bubble);

  const timeEl = document.createElement('div');
  timeEl.className = 'msg-time ' + (isSent ? 'sent-time' : 'received-time');
  timeEl.textContent = formatTime(m.created_at);
  container.appendChild(timeEl);
}

// ===== SEND MESSAGE =====
async function sendMessage() {
  const input = document.getElementById('msgInput');
  const text = input.value.trim();
  if (!text || !activeConvId) return;

  input.value = '';

  try {
    const formData = new FormData();
    formData.append('action', 'send_message');
    formData.append('conversation_id', activeConvId);
    formData.append('content', text);
    formData.append('message_type', 'text');

    const res = await fetch(CHAT_API, { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      // Track this message ID so polling won't duplicate it
      if (data.message_id) renderedMsgIds.add(String(data.message_id));
      // Immediately show the sent message
      const container = document.getElementById('messages');
      const placeholder = container.querySelector('.empty-list');
      if (placeholder) { container.innerHTML = ''; }
      const now = new Date().toISOString();
      appendSingleMessage(container, {
        id: data.message_id,
        sender_id: String(currentUser.id),
        sender_name: currentUser.name,
        content: text,
        message_type: 'text',
        created_at: now,
      });
      requestAnimationFrame(() => container.scrollTop = container.scrollHeight);
      loadConversations();
    } else {
      showToast(data.error || 'Failed to send message');
    }
  } catch (e) {
    showToast('Network error. Make sure WAMP is running.');
  }
}

// ============================================================
// NOTIFICATIONS (Invites Tab)
// ============================================================

async function loadNotifications() {
  try {
    const res = await fetch(CHAT_API + '?action=get_invites&type=received');
    const data = await res.json();
    if (data.success) {
      renderNotifications(data.invites);
      const badge = document.getElementById('notifBadge');
      if (data.invites.length > 0) {
        badge.textContent = data.invites.length;
        badge.classList.add('show');
      } else {
        badge.classList.remove('show');
      }
    }
  } catch (e) {}
}

function renderNotifications(invites) {
  const list = document.getElementById('notifList');
  if (invites.length === 0) {
    list.innerHTML = '<div class="empty-list">No pending invites</div>';
    return;
  }
  list.innerHTML = invites.map(inv => `
    <div class="notif-item" id="notif-${inv.id}">
      <div class="notif-top">
        <div class="conv-avatar">${getInitials(inv.name)}</div>
        <div class="notif-info">
          <div class="notif-name">${escHtml(inv.name)}</div>
          <div class="notif-sub">@${escHtml(inv.username)} • ${escHtml(inv.regno)}</div>
        </div>
        <span class="notif-time">${formatTime(inv.created_at)}</span>
      </div>
      <div class="notif-actions">
        <button class="accept-btn" onclick="respondInvite(${inv.id}, 'accepted')">Accept</button>
        <button class="reject-btn" onclick="respondInvite(${inv.id}, 'rejected')">Reject</button>
      </div>
    </div>
  `).join('');
}

async function respondInvite(inviteId, response) {
  try {
    const formData = new FormData();
    formData.append('action', 'respond_invite');
    formData.append('invite_id', inviteId);
    formData.append('response', response);

    const res = await fetch(CHAT_API, { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      showToast(response === 'accepted' ? 'Invite accepted!' : 'Invite rejected');
      // Remove the invite from DOM
      const el = document.getElementById('notif-' + inviteId);
      if (el) el.remove();
      // Refresh
      loadNotifications();
      if (response === 'accepted') {
        loadConversations();
        switchTab('chats');
      }
    } else {
      showToast(data.error || 'Failed to respond');
    }
  } catch (e) {
    showToast('Network error');
  }
}

// ============================================================
// SEARCH MODAL (New Chat / Send Invite)
// ============================================================

let searchTimeout = null;

function openSearchModal() {
  document.getElementById('searchModal').classList.add('show');
  document.getElementById('userSearchInput').value = '';
  document.getElementById('searchResults').innerHTML = '<div class="search-empty">Type at least 2 characters to search</div>';
  setTimeout(() => document.getElementById('userSearchInput').focus(), 100);
}

function closeSearchModal() {
  document.getElementById('searchModal').classList.remove('show');
}

document.getElementById('userSearchInput').addEventListener('input', e => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (q.length < 2) {
    document.getElementById('searchResults').innerHTML = '<div class="search-empty">Type at least 2 characters to search</div>';
    return;
  }
  searchTimeout = setTimeout(() => searchUsers(q), 300);
});

async function searchUsers(query) {
  try {
    const res = await fetch(CHAT_API + '?action=search_users&q=' + encodeURIComponent(query));
    const data = await res.json();
    if (data.success) {
      renderSearchResults(data.users);
    }
  } catch (e) {
    document.getElementById('searchResults').innerHTML = '<div class="search-empty">Search failed</div>';
  }
}

function renderSearchResults(users) {
  const container = document.getElementById('searchResults');
  if (users.length === 0) {
    container.innerHTML = '<div class="search-empty">No users found</div>';
    return;
  }
  container.innerHTML = users.map(u => `
    <div class="search-result">
      <div class="conv-avatar">${getInitials(u.name)}</div>
      <div class="search-result-info">
        <div class="search-result-name">${escHtml(u.name)}</div>
        <div class="search-result-detail">@${escHtml(u.username)} • ${escHtml(u.regno)}</div>
      </div>
      <button class="invite-btn" id="invBtn-${u.id}" onclick="sendInvite(${u.id}, this)">Invite</button>
    </div>
  `).join('');
}

async function sendInvite(userId, btn) {
  btn.disabled = true;
  btn.textContent = 'Sending...';
  try {
    const formData = new FormData();
    formData.append('action', 'send_invite');
    formData.append('to_user', userId);

    const res = await fetch(CHAT_API, { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      btn.textContent = 'Sent ✓';
      showToast(data.message || 'Invite sent!');
    } else {
      btn.textContent = data.error || 'Error';
      showToast(data.error || 'Could not send invite');
      setTimeout(() => { btn.textContent = 'Invite'; btn.disabled = false; }, 2000);
    }
  } catch (e) {
    btn.textContent = 'Error';
    showToast('Network error');
    setTimeout(() => { btn.textContent = 'Invite'; btn.disabled = false; }, 2000);
  }
}

// ============================================================
// UTILITIES
// ============================================================

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function insertEmoji() {
  const emojis = ['😊','😂','❤️','🔥','👍','🎉','😎','🤔','💯','✨','🙌','😅'];
  const input = document.getElementById('msgInput');
  input.value += emojis[Math.floor(Math.random() * emojis.length)];
  input.focus();
}

function toggleInfoPanel() {
  document.getElementById('infoPanel').classList.toggle('hidden');
}

function showSidebar() {
  document.getElementById('sidebar').classList.remove('hidden-mobile');
}

// Search conversations in sidebar
document.getElementById('searchInput').addEventListener('input', e => {
  renderConversations(e.target.value);
});

// Enter to send
document.getElementById('msgInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') sendMessage();
});

// Close modal on overlay click
document.getElementById('searchModal').addEventListener('click', e => {
  if (e.target === document.getElementById('searchModal')) closeSearchModal();
});
