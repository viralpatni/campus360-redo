// ============================================
// Campus360 — Forum JS (forum.html)
// ============================================

const AUTH_API = 'php/auth.php';
const CHAT_API = 'php/chat.php';
const UPLOAD_API = 'php/upload.php';

let currentUser = null;
let activeConversationId = null;
let lastMessageTime = null;
let pollInterval = null;
let conversations = [];

// ===== INITIALIZATION =====
(async function init() {
  // Check auth
  try {
    const res = await fetch(AUTH_API + '?action=check');
    const data = await res.json();
    if (!data.loggedIn) {
      window.location.href = 'login.html';
      return;
    }
    currentUser = data.user;
    document.getElementById('currentUserName').textContent = currentUser.name;
  } catch (e) {
    window.location.href = 'login.html';
    return;
  }

  // Load data
  loadConversations();
  loadInvites();

  // Poll for new messages every 2s
  pollInterval = setInterval(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId, true);
    }
    loadInvites();
  }, 2000);
})();

// ===== SIDEBAR TABS =====
document.querySelectorAll('.sidebar-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
  });
});

// ===== MOBILE SIDEBAR TOGGLE =====
document.getElementById('toggleSidebar')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('hidden');
});

// ===== LOGOUT =====
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch(AUTH_API + '?action=logout');
  window.location.href = 'login.html';
});

// ===== LOAD CONVERSATIONS =====
async function loadConversations() {
  try {
    const res = await fetch(CHAT_API + '?action=get_conversations');
    const data = await res.json();
    if (!data.success) return;

    conversations = data.conversations;
    renderConversations(conversations);
  } catch (e) { /* silent */ }
}

function renderConversations(convos) {
  const list = document.getElementById('conversationList');
  if (!convos.length) {
    list.innerHTML = '<div class="sidebar-empty">No conversations yet.<br>Search for users to start chatting!</div>';
    return;
  }

  list.innerHTML = convos.map(c => {
    const isGroup = c.type === 'group';
    const name = isGroup ? c.group_name : (c.other_user?.name || 'Unknown');
    const sub = isGroup ? 'Group' : (c.other_user?.username || '');
    const initial = name.charAt(0).toUpperCase();
    const preview = c.last_message ? truncate(c.last_message, 35) : 'No messages yet';
    const time = c.last_message_time ? formatTime(c.last_message_time) : '';
    const activeClass = c.id == activeConversationId ? ' active' : '';

    return `
      <div class="sidebar-item${activeClass}" data-conv-id="${c.id}" onclick="openConversation(${c.id})">
        <div class="sidebar-avatar${isGroup ? ' group' : ''}">${initial}</div>
        <div class="sidebar-item-info">
          <div class="sidebar-item-name">${escHtml(name)}</div>
          <div class="sidebar-item-preview">${escHtml(preview)}</div>
        </div>
        <div class="sidebar-item-meta">${time}</div>
      </div>
    `;
  }).join('');
}

// Filter conversations
document.getElementById('filterConversations').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = conversations.filter(c => {
    const name = c.type === 'group' ? c.group_name : (c.other_user?.name || '');
    return name.toLowerCase().includes(q);
  });
  renderConversations(filtered);
});

// ===== LOAD INVITES =====
async function loadInvites() {
  try {
    const res = await fetch(CHAT_API + '?action=get_invites&type=received');
    const data = await res.json();
    if (!data.success) return;

    const badge = document.getElementById('inviteBadge');
    if (data.invites.length > 0) {
      badge.textContent = data.invites.length;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }

    renderInvites(data.invites);
  } catch (e) { /* silent */ }
}

function renderInvites(invites) {
  const list = document.getElementById('inviteList');
  if (!invites.length) {
    list.innerHTML = '<div class="sidebar-empty">No pending invites</div>';
    return;
  }

  list.innerHTML = invites.map(inv => `
    <div class="sidebar-item">
      <div class="sidebar-avatar">${inv.name.charAt(0).toUpperCase()}</div>
      <div class="sidebar-item-info">
        <div class="sidebar-item-name">${escHtml(inv.name)}</div>
        <div class="sidebar-item-preview">@${escHtml(inv.username)} · ${escHtml(inv.regno)}</div>
        <div class="invite-actions">
          <button class="invite-btn accept" onclick="respondInvite(${inv.id}, 'accepted')">✓ Accept</button>
          <button class="invite-btn reject" onclick="respondInvite(${inv.id}, 'rejected')">✕ Reject</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function respondInvite(inviteId, response) {
  const formData = new FormData();
  formData.append('action', 'respond_invite');
  formData.append('invite_id', inviteId);
  formData.append('response', response);

  const res = await fetch(CHAT_API, { method: 'POST', body: formData });
  const data = await res.json();

  if (data.success) {
    loadInvites();
    if (response === 'accepted') {
      loadConversations();
    }
  }
}

// ===== SEARCH USERS =====
let searchTimeout = null;
document.getElementById('userSearchInput').addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (q.length < 2) {
    document.getElementById('searchResults').innerHTML = '<div class="sidebar-empty">Type at least 2 characters to search</div>';
    return;
  }
  searchTimeout = setTimeout(() => searchUsers(q), 300);
});

async function searchUsers(query) {
  try {
    const res = await fetch(CHAT_API + '?action=search_users&q=' + encodeURIComponent(query));
    const data = await res.json();
    if (!data.success) return;

    const list = document.getElementById('searchResults');
    if (!data.users.length) {
      list.innerHTML = '<div class="sidebar-empty">No users found</div>';
      return;
    }

    list.innerHTML = data.users.map(u => `
      <div class="sidebar-item">
        <div class="sidebar-avatar">${u.name.charAt(0).toUpperCase()}</div>
        <div class="sidebar-item-info">
          <div class="sidebar-item-name">${escHtml(u.name)}</div>
          <div class="sidebar-item-preview">@${escHtml(u.username)} · ${escHtml(u.regno)}</div>
        </div>
        <button class="invite-btn accept" onclick="sendInvite(${u.id})" style="flex-shrink:0">Invite</button>
      </div>
    `).join('');
  } catch (e) { /* silent */ }
}

async function sendInvite(userId) {
  const formData = new FormData();
  formData.append('action', 'send_invite');
  formData.append('to_user', userId);

  const res = await fetch(CHAT_API, { method: 'POST', body: formData });
  const data = await res.json();

  if (data.success) {
    alert(data.message || 'Invite sent!');
  } else {
    alert(data.error || 'Could not send invite');
  }
}

// ===== OPEN CONVERSATION =====
async function openConversation(convId) {
  activeConversationId = convId;
  lastMessageTime = null;

  // Update sidebar active state
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  const activeEl = document.querySelector(`[data-conv-id="${convId}"]`);
  if (activeEl) activeEl.classList.add('active');

  // Find conversation info
  const conv = conversations.find(c => c.id == convId);

  // Show chat area
  document.getElementById('chatEmpty').style.display = 'none';
  const activeChat = document.getElementById('activeChat');
  activeChat.style.display = 'flex';

  // Set header
  const isGroup = conv?.type === 'group';
  const name = isGroup ? conv.group_name : (conv?.other_user?.name || 'Chat');
  const sub = isGroup
    ? 'Group Chat'
    : (conv?.other_user ? `@${conv.other_user.username} · ${conv.other_user.regno}` : '');

  document.getElementById('chatName').textContent = name;
  document.getElementById('chatSub').textContent = sub;
  document.getElementById('chatAvatar').textContent = name.charAt(0).toUpperCase();
  document.getElementById('chatAvatar').className = 'sidebar-avatar' + (isGroup ? ' group' : '');
  document.getElementById('viewMembersBtn').style.display = isGroup ? 'inline-block' : 'none';

  // Load messages
  await loadMessages(convId, false);

  // Hide sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.add('hidden');
  }
}

// ===== LOAD MESSAGES =====
async function loadMessages(convId, polling = false) {
  let url = CHAT_API + '?action=get_messages&conversation_id=' + convId;
  if (polling && lastMessageTime) {
    url += '&after=' + encodeURIComponent(lastMessageTime);
  }

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success || convId != activeConversationId) return;

    if (!polling) {
      // Full load
      renderMessages(data.messages, false);
    } else if (data.messages.length > 0) {
      // Append new messages
      renderMessages(data.messages, true);
    }

    // Track last message time
    if (data.messages.length > 0) {
      lastMessageTime = data.messages[data.messages.length - 1].created_at;
    }
  } catch (e) { /* silent */ }
}

function renderMessages(messages, append = false) {
  const container = document.getElementById('chatMessages');

  if (!append) {
    container.innerHTML = '';
  }

  messages.forEach(msg => {
    const isSent = msg.sender_id == currentUser.id;
    const div = document.createElement('div');
    div.className = 'message ' + (isSent ? 'sent' : 'received');

    let mediaHtml = '';
    if (msg.file_path) {
      if (msg.message_type === 'image') {
        mediaHtml = `<div class="message-media"><img src="${escHtml(msg.file_path)}" alt="Image" onclick="window.open('${escHtml(msg.file_path)}','_blank')" /></div>`;
      } else if (msg.message_type === 'video') {
        mediaHtml = `<div class="message-media"><video src="${escHtml(msg.file_path)}" controls></video></div>`;
      } else if (msg.message_type === 'audio') {
        mediaHtml = `<div class="message-media"><audio src="${escHtml(msg.file_path)}" controls></audio></div>`;
      }
    }

    const contentHtml = msg.content ? `<div>${escHtml(msg.content)}</div>` : '';

    div.innerHTML = `
      <div class="message-sender">${escHtml(msg.sender_name)}</div>
      <div class="message-bubble">
        ${contentHtml}
        ${mediaHtml}
      </div>
      <div class="message-time">${formatTime(msg.created_at)}</div>
    `;

    container.appendChild(div);
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// ===== SEND MESSAGE =====
document.getElementById('sendBtn').addEventListener('click', sendTextMessage);
document.getElementById('messageInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendTextMessage();
  }
});

async function sendTextMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content || !activeConversationId) return;

  input.value = '';

  const formData = new FormData();
  formData.append('action', 'send_message');
  formData.append('conversation_id', activeConversationId);
  formData.append('message_type', 'text');
  formData.append('content', content);

  try {
    const res = await fetch(CHAT_API, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      // Immediately show the message
      renderMessages([{
        sender_id: currentUser.id,
        sender_name: currentUser.name,
        message_type: 'text',
        content: content,
        file_path: null,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }], true);
    }
  } catch (e) { /* silent */ }
}

// ===== FILE UPLOAD =====
document.getElementById('attachBtn').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !activeConversationId) return;

  // Determine type
  let type = 'image';
  if (file.type.startsWith('video/')) type = 'video';
  else if (file.type.startsWith('audio/')) type = 'audio';

  // Upload file
  const uploadData = new FormData();
  uploadData.append('file', file);
  uploadData.append('type', type);

  try {
    const uploadRes = await fetch(UPLOAD_API, { method: 'POST', body: uploadData });
    const uploadResult = await uploadRes.json();

    if (!uploadResult.success) {
      alert(uploadResult.error || 'Upload failed');
      return;
    }

    // Send message with file
    const msgData = new FormData();
    msgData.append('action', 'send_message');
    msgData.append('conversation_id', activeConversationId);
    msgData.append('message_type', type);
    msgData.append('content', '');
    msgData.append('file_path', uploadResult.file_path);

    const msgRes = await fetch(CHAT_API, { method: 'POST', body: msgData });
    const msgResult = await msgRes.json();

    if (msgResult.success) {
      renderMessages([{
        sender_id: currentUser.id,
        sender_name: currentUser.name,
        message_type: type,
        content: '',
        file_path: uploadResult.file_path,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }], true);
    }
  } catch (e) {
    alert('Upload failed. Please try again.');
  }

  e.target.value = '';
});

// ===== CREATE GROUP =====
document.getElementById('createGroupBtn').addEventListener('click', async () => {
  document.getElementById('groupModal').classList.add('active');
  document.getElementById('groupNameInput').value = '';
  document.getElementById('selectedMembers').innerHTML = '';

  // Load connected users (from accepted direct conversations)
  const list = document.getElementById('groupMemberList');
  list.innerHTML = '<div class="sidebar-empty">Loading...</div>';

  try {
    const res = await fetch(CHAT_API + '?action=get_conversations');
    const data = await res.json();
    if (!data.success) return;

    const directUsers = data.conversations
      .filter(c => c.type === 'direct' && c.other_user)
      .map(c => c.other_user);

    if (!directUsers.length) {
      list.innerHTML = '<div class="sidebar-empty">No connected users yet. Accept invites first.</div>';
      return;
    }

    list.innerHTML = directUsers.map(u => `
      <label class="member-select-item">
        <input type="checkbox" value="${u.id}" data-name="${escHtml(u.name)}" />
        <span>${escHtml(u.name)} (@${escHtml(u.username)})</span>
      </label>
    `).join('');
  } catch (e) {
    list.innerHTML = '<div class="sidebar-empty">Error loading users</div>';
  }
});

document.getElementById('cancelGroupBtn').addEventListener('click', () => {
  document.getElementById('groupModal').classList.remove('active');
});

document.getElementById('confirmGroupBtn').addEventListener('click', async () => {
  const name = document.getElementById('groupNameInput').value.trim();
  if (!name) { alert('Please enter a group name'); return; }

  const checkboxes = document.querySelectorAll('#groupMemberList input[type="checkbox"]:checked');
  const memberIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

  if (memberIds.length === 0) { alert('Please select at least one member'); return; }

  const formData = new FormData();
  formData.append('action', 'create_group');
  formData.append('name', name);
  formData.append('members', JSON.stringify(memberIds));

  try {
    const res = await fetch(CHAT_API, { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      document.getElementById('groupModal').classList.remove('active');
      await loadConversations();
      openConversation(data.conversation_id);
    } else {
      alert(data.error || 'Failed to create group');
    }
  } catch (e) {
    alert('Network error');
  }
});

// ===== VIEW GROUP MEMBERS =====
document.getElementById('viewMembersBtn').addEventListener('click', async () => {
  if (!activeConversationId) return;
  document.getElementById('membersModal').classList.add('active');

  const list = document.getElementById('membersList');
  list.innerHTML = '<div class="sidebar-empty">Loading...</div>';

  try {
    const res = await fetch(CHAT_API + '?action=get_members&conversation_id=' + activeConversationId);
    const data = await res.json();

    if (data.success) {
      list.innerHTML = data.members.map(m => `
        <div class="sidebar-item">
          <div class="sidebar-avatar">${m.name.charAt(0).toUpperCase()}</div>
          <div class="sidebar-item-info">
            <div class="sidebar-item-name">${escHtml(m.name)}</div>
            <div class="sidebar-item-preview">@${escHtml(m.username)} · ${escHtml(m.regno)}</div>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    list.innerHTML = '<div class="sidebar-empty">Error loading members</div>';
  }
});

document.getElementById('closeMembersBtn').addEventListener('click', () => {
  document.getElementById('membersModal').classList.remove('active');
});

// ===== UTILITIES =====
function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, len) {
  return str.length > len ? str.substring(0, len) + '…' : str;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
