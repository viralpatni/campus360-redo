// ============================================
// Campus360 — WebSocket Server for Real-Time Chat
// Run: npm install && npm start
// ============================================

const WebSocket = require('ws');
const mysql = require('mysql2/promise');

const WS_PORT = 8082;

// MySQL config (must match php/config.php)
const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'campus360',
};

// userId → Set<WebSocket>
const clients = new Map();

let db;

async function initDB() {
  db = await mysql.createPool(DB_CONFIG);
  console.log('[DB] Connected to MySQL');
}

// ===== WebSocket Server =====
async function start() {
  await initDB();

  const wss = new WebSocket.Server({ port: WS_PORT });
  console.log(`[WS] WebSocket server running on ws://localhost:${WS_PORT}`);

  wss.on('connection', (ws) => {
    let userId = null;

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      switch (msg.type) {

        // --- Auth: register this connection ---
        case 'auth':
          userId = String(msg.userId);
          if (!clients.has(userId)) clients.set(userId, new Set());
          clients.get(userId).add(ws);
          console.log(`[WS] User ${userId} connected (${clients.get(userId).size} tabs)`);
          ws.send(JSON.stringify({ type: 'auth_ok' }));
          break;

        // --- New message: broadcast to conversation members ---
        case 'new_message':
          if (!userId) return;
          try {
            const convId = msg.conversationId;
            // Get all members of this conversation
            const [members] = await db.execute(
              'SELECT user_id FROM conversation_members WHERE conversation_id = ?',
              [convId]
            );
            const payload = JSON.stringify({
              type: 'new_message',
              conversationId: convId,
              message: msg.message,
            });
            // Send to all online members except sender
            members.forEach(row => {
              const uid = String(row.user_id);
              if (uid === userId) return;
              sendToUser(uid, payload);
            });
          } catch (e) {
            console.error('[WS] broadcast error:', e.message);
          }
          break;

        // --- Typing indicator ---
        case 'typing':
          if (!userId) return;
          try {
            const convId = msg.conversationId;
            const [members] = await db.execute(
              'SELECT user_id FROM conversation_members WHERE conversation_id = ?',
              [convId]
            );
            const payload = JSON.stringify({
              type: 'typing',
              conversationId: convId,
              userId: userId,
              userName: msg.userName || '',
            });
            members.forEach(row => {
              const uid = String(row.user_id);
              if (uid === userId) return;
              sendToUser(uid, payload);
            });
          } catch (e) {}
          break;

        // --- Invite notification ---
        case 'new_invite':
          if (!userId) return;
          const toUser = String(msg.toUserId);
          sendToUser(toUser, JSON.stringify({
            type: 'new_invite',
            fromUserId: userId,
            fromUserName: msg.fromUserName || '',
          }));
          break;
      }
    });

    ws.on('close', () => {
      if (userId && clients.has(userId)) {
        clients.get(userId).delete(ws);
        if (clients.get(userId).size === 0) clients.delete(userId);
        console.log(`[WS] User ${userId} disconnected`);
      }
    });

    ws.on('error', () => {});
  });
}

function sendToUser(userId, payload) {
  const sockets = clients.get(userId);
  if (!sockets) return;
  sockets.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

start().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
