<?php
// ============================================
// Campus360 — Chat API
// ============================================
// Endpoints: ?action=search_users|send_invite|respond_invite|get_invites
//            |get_conversations|get_messages|send_message
//            |create_group|add_member|get_members
// ============================================

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {

    // ===== SEARCH USERS =====
    case 'search_users':
        $userId = requireAuth();
        $query  = trim($_GET['q'] ?? '');

        if (strlen($query) < 2) {
            jsonResponse(['success' => true, 'users' => []]);
        }

        $like = "%{$query}%";
        $stmt = $pdo->prepare(
            "SELECT id, name, username, regno FROM users
             WHERE id != ? AND (name LIKE ? OR username LIKE ? OR regno LIKE ?)
             LIMIT 20"
        );
        $stmt->execute([$userId, $like, $like, $like]);
        jsonResponse(['success' => true, 'users' => $stmt->fetchAll()]);
        break;

    // ===== SEND CHAT INVITE =====
    case 'send_invite':
        $userId = requireAuth();
        $toUser = intval($_POST['to_user'] ?? 0);

        if (!$toUser || $toUser === $userId) {
            jsonResponse(['success' => false, 'error' => 'Invalid user'], 400);
        }

        // Check if invite or conversation already exists
        $stmt = $pdo->prepare(
            "SELECT id, status FROM chat_invites
             WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)"
        );
        $stmt->execute([$userId, $toUser, $toUser, $userId]);
        $existing = $stmt->fetch();

        if ($existing) {
            if ($existing['status'] === 'accepted') {
                jsonResponse(['success' => false, 'error' => 'Already connected']);
            }
            if ($existing['status'] === 'pending') {
                jsonResponse(['success' => false, 'error' => 'Invite already pending']);
            }
            // If rejected, allow re-invite by updating
            $stmt = $pdo->prepare("UPDATE chat_invites SET from_user = ?, to_user = ?, status = 'pending', updated_at = NOW() WHERE id = ?");
            $stmt->execute([$userId, $toUser, $existing['id']]);
            jsonResponse(['success' => true, 'message' => 'Invite re-sent']);
        }

        $stmt = $pdo->prepare("INSERT INTO chat_invites (from_user, to_user) VALUES (?, ?)");
        $stmt->execute([$userId, $toUser]);
        jsonResponse(['success' => true, 'message' => 'Invite sent']);
        break;

    // ===== RESPOND TO INVITE =====
    case 'respond_invite':
        $userId   = requireAuth();
        $inviteId = intval($_POST['invite_id'] ?? 0);
        $response = $_POST['response'] ?? ''; // 'accepted' or 'rejected'

        if (!$inviteId || !in_array($response, ['accepted', 'rejected'])) {
            jsonResponse(['success' => false, 'error' => 'Invalid request'], 400);
        }

        // Verify invite belongs to this user
        $stmt = $pdo->prepare("SELECT * FROM chat_invites WHERE id = ? AND to_user = ? AND status = 'pending'");
        $stmt->execute([$inviteId, $userId]);
        $invite = $stmt->fetch();

        if (!$invite) {
            jsonResponse(['success' => false, 'error' => 'Invite not found'], 404);
        }

        // Update status
        $stmt = $pdo->prepare("UPDATE chat_invites SET status = ? WHERE id = ?");
        $stmt->execute([$response, $inviteId]);

        // If accepted, create a direct conversation
        if ($response === 'accepted') {
            $stmt = $pdo->prepare("INSERT INTO conversations (type, created_by) VALUES ('direct', ?)");
            $stmt->execute([$userId]);
            $convId = $pdo->lastInsertId();

            $stmt = $pdo->prepare("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)");
            $stmt->execute([$convId, $invite['from_user'], $convId, $invite['to_user']]);

            jsonResponse(['success' => true, 'message' => 'Invite accepted', 'conversation_id' => $convId]);
        }

        jsonResponse(['success' => true, 'message' => 'Invite rejected']);
        break;

    // ===== GET INVITES =====
    case 'get_invites':
        $userId = requireAuth();
        $type   = $_GET['type'] ?? 'received'; // 'received' or 'sent'

        if ($type === 'received') {
            $stmt = $pdo->prepare(
                "SELECT ci.id, ci.from_user, ci.status, ci.created_at,
                        u.name, u.username, u.regno
                 FROM chat_invites ci
                 JOIN users u ON u.id = ci.from_user
                 WHERE ci.to_user = ? AND ci.status = 'pending'
                 ORDER BY ci.created_at DESC"
            );
        } else {
            $stmt = $pdo->prepare(
                "SELECT ci.id, ci.to_user, ci.status, ci.created_at,
                        u.name, u.username, u.regno
                 FROM chat_invites ci
                 JOIN users u ON u.id = ci.to_user
                 WHERE ci.from_user = ?
                 ORDER BY ci.created_at DESC"
            );
        }
        $stmt->execute([$userId]);
        jsonResponse(['success' => true, 'invites' => $stmt->fetchAll()]);
        break;

    // ===== GET CONVERSATIONS =====
    case 'get_conversations':
        $userId = requireAuth();

        $stmt = $pdo->prepare(
            "SELECT c.id, c.type, c.name AS group_name, c.created_at,
                    (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
                    (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message_time
             FROM conversations c
             JOIN conversation_members cm ON cm.conversation_id = c.id
             WHERE cm.user_id = ?
             ORDER BY last_message_time DESC, c.created_at DESC"
        );
        $stmt->execute([$userId]);
        $conversations = $stmt->fetchAll();

        // For direct chats, get the other user's info
        foreach ($conversations as &$conv) {
            if ($conv['type'] === 'direct') {
                $stmt2 = $pdo->prepare(
                    "SELECT u.id, u.name, u.username, u.regno
                     FROM conversation_members cm
                     JOIN users u ON u.id = cm.user_id
                     WHERE cm.conversation_id = ? AND cm.user_id != ?"
                );
                $stmt2->execute([$conv['id'], $userId]);
                $conv['other_user'] = $stmt2->fetch();
            }
        }

        jsonResponse(['success' => true, 'conversations' => $conversations]);
        break;

    // ===== GET MESSAGES =====
    case 'get_messages':
        $userId = requireAuth();
        $convId = intval($_GET['conversation_id'] ?? 0);
        $after  = $_GET['after'] ?? null; // timestamp for polling

        if (!$convId) {
            jsonResponse(['success' => false, 'error' => 'Conversation ID required'], 400);
        }

        // Verify user is member
        $stmt = $pdo->prepare("SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?");
        $stmt->execute([$convId, $userId]);
        if (!$stmt->fetch()) {
            jsonResponse(['success' => false, 'error' => 'Not a member of this conversation'], 403);
        }

        if ($after) {
            $stmt = $pdo->prepare(
                "SELECT m.id, m.sender_id, m.message_type, m.content, m.file_path, m.created_at,
                        u.name AS sender_name, u.username AS sender_username
                 FROM messages m
                 JOIN users u ON u.id = m.sender_id
                 WHERE m.conversation_id = ? AND m.created_at > ?
                 ORDER BY m.created_at ASC"
            );
            $stmt->execute([$convId, $after]);
        } else {
            $stmt = $pdo->prepare(
                "SELECT m.id, m.sender_id, m.message_type, m.content, m.file_path, m.created_at,
                        u.name AS sender_name, u.username AS sender_username
                 FROM messages m
                 JOIN users u ON u.id = m.sender_id
                 WHERE m.conversation_id = ?
                 ORDER BY m.created_at ASC
                 LIMIT 100"
            );
            $stmt->execute([$convId]);
        }

        jsonResponse(['success' => true, 'messages' => $stmt->fetchAll()]);
        break;

    // ===== SEND MESSAGE =====
    case 'send_message':
        $userId  = requireAuth();
        $convId  = intval($_POST['conversation_id'] ?? 0);
        $type    = $_POST['message_type'] ?? 'text';
        $content = trim($_POST['content'] ?? '');
        $filePath = $_POST['file_path'] ?? null;

        if (!$convId) {
            jsonResponse(['success' => false, 'error' => 'Conversation ID required'], 400);
        }

        if ($type === 'text' && !$content) {
            jsonResponse(['success' => false, 'error' => 'Message cannot be empty'], 400);
        }

        // Verify membership
        $stmt = $pdo->prepare("SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?");
        $stmt->execute([$convId, $userId]);
        if (!$stmt->fetch()) {
            jsonResponse(['success' => false, 'error' => 'Not a member'], 403);
        }

        $stmt = $pdo->prepare(
            "INSERT INTO messages (conversation_id, sender_id, message_type, content, file_path) VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->execute([$convId, $userId, $type, $content, $filePath]);

        jsonResponse(['success' => true, 'message_id' => $pdo->lastInsertId()]);
        break;

    // ===== CREATE GROUP =====
    case 'create_group':
        $userId  = requireAuth();
        $name    = trim($_POST['name'] ?? '');
        $members = json_decode($_POST['members'] ?? '[]', true);

        if (!$name) {
            jsonResponse(['success' => false, 'error' => 'Group name required'], 400);
        }

        $stmt = $pdo->prepare("INSERT INTO conversations (type, name, created_by) VALUES ('group', ?, ?)");
        $stmt->execute([$name, $userId]);
        $convId = $pdo->lastInsertId();

        // Add creator as member
        $stmt = $pdo->prepare("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)");
        $stmt->execute([$convId, $userId]);

        // Add other members (must be connected via accepted invite)
        foreach ($members as $memberId) {
            $memberId = intval($memberId);
            if ($memberId === $userId) continue;

            // Check that they are connected
            $stmt2 = $pdo->prepare(
                "SELECT 1 FROM chat_invites
                 WHERE status = 'accepted'
                 AND ((from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?))"
            );
            $stmt2->execute([$userId, $memberId, $memberId, $userId]);
            if ($stmt2->fetch()) {
                $stmt3 = $pdo->prepare("INSERT IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)");
                $stmt3->execute([$convId, $memberId]);
            }
        }

        jsonResponse(['success' => true, 'conversation_id' => $convId]);
        break;

    // ===== ADD MEMBER TO GROUP =====
    case 'add_member':
        $userId = requireAuth();
        $convId = intval($_POST['conversation_id'] ?? 0);
        $newMember = intval($_POST['user_id'] ?? 0);

        if (!$convId || !$newMember) {
            jsonResponse(['success' => false, 'error' => 'Invalid request'], 400);
        }

        // Verify requester is a member
        $stmt = $pdo->prepare("SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?");
        $stmt->execute([$convId, $userId]);
        if (!$stmt->fetch()) {
            jsonResponse(['success' => false, 'error' => 'Not a member'], 403);
        }

        // Verify it's a group
        $stmt = $pdo->prepare("SELECT type FROM conversations WHERE id = ?");
        $stmt->execute([$convId]);
        $conv = $stmt->fetch();
        if (!$conv || $conv['type'] !== 'group') {
            jsonResponse(['success' => false, 'error' => 'Not a group conversation'], 400);
        }

        $stmt = $pdo->prepare("INSERT IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)");
        $stmt->execute([$convId, $newMember]);
        jsonResponse(['success' => true]);
        break;

    // ===== GET MEMBERS =====
    case 'get_members':
        $userId = requireAuth();
        $convId = intval($_GET['conversation_id'] ?? 0);

        if (!$convId) {
            jsonResponse(['success' => false, 'error' => 'Conversation ID required'], 400);
        }

        // Verify user is member
        $stmt = $pdo->prepare("SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?");
        $stmt->execute([$convId, $userId]);
        if (!$stmt->fetch()) {
            jsonResponse(['success' => false, 'error' => 'Not a member'], 403);
        }

        $stmt = $pdo->prepare(
            "SELECT u.id, u.name, u.username, u.regno
             FROM conversation_members cm
             JOIN users u ON u.id = cm.user_id
             WHERE cm.conversation_id = ?"
        );
        $stmt->execute([$convId]);
        jsonResponse(['success' => true, 'members' => $stmt->fetchAll()]);
        break;

    default:
        jsonResponse(['success' => false, 'error' => 'Invalid action'], 400);
}
