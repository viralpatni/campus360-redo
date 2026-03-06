<?php
// ============================================
// Campus360 — Forum API (posts, follows, likes, comments)
// ============================================

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {

  // ==========================================
  // FEED
  // ==========================================
  case 'get_feed':
    $userId = requireAuth();
    $page   = max(1, intval($_GET['page'] ?? 1));
    $limit  = 20;
    $offset = ($page - 1) * $limit;

    // Feed = all public posts + private posts from people I follow (accepted)
    $stmt = $pdo->prepare("
      SELECT p.*, u.name AS author_name, u.username AS author_username,
             (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS like_count,
             (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comment_count,
             (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) AS liked_by_me
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.visibility = 'public'
         OR p.user_id = ?
         OR (p.visibility = 'private' AND p.user_id IN (
              SELECT following_id FROM follows WHERE follower_id = ? AND status = 'accepted'
            ))
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    ");
    $stmt->execute([$userId, $userId, $userId, $limit, $offset]);
    $posts = $stmt->fetchAll();

    jsonResponse(['success' => true, 'posts' => $posts]);
    break;

  // ==========================================
  // CREATE POST
  // ==========================================
  case 'create_post':
    $userId     = requireAuth();
    $content    = trim($_POST['content'] ?? '');
    $visibility = $_POST['visibility'] ?? 'public';
    $imagePath  = $_POST['image_path'] ?? null;

    if (!$content && !$imagePath) {
      jsonResponse(['success' => false, 'error' => 'Post cannot be empty'], 400);
    }
    if (!in_array($visibility, ['public', 'private'])) {
      $visibility = 'public';
    }

    $stmt = $pdo->prepare("INSERT INTO posts (user_id, content, image_path, visibility) VALUES (?, ?, ?, ?)");
    $stmt->execute([$userId, $content, $imagePath, $visibility]);

    jsonResponse(['success' => true, 'post_id' => $pdo->lastInsertId()]);
    break;

  // ==========================================
  // DELETE POST
  // ==========================================
  case 'delete_post':
    $userId = requireAuth();
    $postId = intval($_POST['post_id'] ?? 0);

    $stmt = $pdo->prepare("DELETE FROM posts WHERE id = ? AND user_id = ?");
    $stmt->execute([$postId, $userId]);

    jsonResponse(['success' => $stmt->rowCount() > 0]);
    break;

  // ==========================================
  // LIKE / UNLIKE
  // ==========================================
  case 'like_post':
    $userId = requireAuth();
    $postId = intval($_POST['post_id'] ?? 0);

    try {
      $stmt = $pdo->prepare("INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)");
      $stmt->execute([$postId, $userId]);
      jsonResponse(['success' => true, 'action' => 'liked']);
    } catch (PDOException $e) {
      // Already liked — unlike
      $stmt = $pdo->prepare("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?");
      $stmt->execute([$postId, $userId]);
      jsonResponse(['success' => true, 'action' => 'unliked']);
    }
    break;

  // ==========================================
  // COMMENTS
  // ==========================================
  case 'get_comments':
    requireAuth();
    $postId = intval($_GET['post_id'] ?? 0);

    $stmt = $pdo->prepare("
      SELECT c.*, u.name AS author_name, u.username AS author_username
      FROM post_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    ");
    $stmt->execute([$postId]);

    jsonResponse(['success' => true, 'comments' => $stmt->fetchAll()]);
    break;

  case 'add_comment':
    $userId  = requireAuth();
    $postId  = intval($_POST['post_id'] ?? 0);
    $content = trim($_POST['content'] ?? '');

    if (!$content) {
      jsonResponse(['success' => false, 'error' => 'Comment cannot be empty'], 400);
    }

    $stmt = $pdo->prepare("INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)");
    $stmt->execute([$postId, $userId, $content]);

    jsonResponse(['success' => true, 'comment_id' => $pdo->lastInsertId()]);
    break;

  // ==========================================
  // FOLLOW SYSTEM
  // ==========================================
  case 'send_follow':
    $userId    = requireAuth();
    $targetId  = intval($_POST['user_id'] ?? 0);

    if ($targetId === $userId) {
      jsonResponse(['success' => false, 'error' => 'Cannot follow yourself'], 400);
    }

    // Check if already following or pending
    $stmt = $pdo->prepare("SELECT id, status FROM follows WHERE follower_id = ? AND following_id = ?");
    $stmt->execute([$userId, $targetId]);
    $existing = $stmt->fetch();

    if ($existing) {
      if ($existing['status'] === 'accepted') {
        jsonResponse(['success' => false, 'error' => 'Already following']);
      } elseif ($existing['status'] === 'pending') {
        jsonResponse(['success' => false, 'error' => 'Follow request already pending']);
      } else {
        // Was rejected, allow re-request
        $stmt = $pdo->prepare("UPDATE follows SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt->execute([$existing['id']]);
        jsonResponse(['success' => true, 'message' => 'Follow request sent']);
      }
    } else {
      $stmt = $pdo->prepare("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)");
      $stmt->execute([$userId, $targetId]);
      jsonResponse(['success' => true, 'message' => 'Follow request sent']);
    }
    break;

  case 'respond_follow':
    $userId    = requireAuth();
    $followId  = intval($_POST['follow_id'] ?? 0);
    $response  = $_POST['response'] ?? '';

    if (!in_array($response, ['accepted', 'rejected'])) {
      jsonResponse(['success' => false, 'error' => 'Invalid response'], 400);
    }

    $stmt = $pdo->prepare("UPDATE follows SET status = ? WHERE id = ? AND following_id = ? AND status = 'pending'");
    $stmt->execute([$response, $followId, $userId]);

    jsonResponse(['success' => $stmt->rowCount() > 0]);
    break;

  case 'unfollow':
    $userId   = requireAuth();
    $targetId = intval($_POST['user_id'] ?? 0);

    $stmt = $pdo->prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ?");
    $stmt->execute([$userId, $targetId]);

    jsonResponse(['success' => true]);
    break;

  case 'get_follow_requests':
    $userId = requireAuth();

    $stmt = $pdo->prepare("
      SELECT f.id, f.follower_id, f.created_at, u.name, u.username, u.regno
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    ");
    $stmt->execute([$userId]);

    jsonResponse(['success' => true, 'requests' => $stmt->fetchAll()]);
    break;

  case 'get_followers':
    $userId   = requireAuth();
    $targetId = intval($_GET['user_id'] ?? $userId);

    $stmt = $pdo->prepare("
      SELECT u.id, u.name, u.username, u.regno
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = ? AND f.status = 'accepted'
    ");
    $stmt->execute([$targetId]);

    jsonResponse(['success' => true, 'followers' => $stmt->fetchAll()]);
    break;

  case 'get_following':
    $userId   = requireAuth();
    $targetId = intval($_GET['user_id'] ?? $userId);

    $stmt = $pdo->prepare("
      SELECT u.id, u.name, u.username, u.regno
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = ? AND f.status = 'accepted'
    ");
    $stmt->execute([$targetId]);

    jsonResponse(['success' => true, 'following' => $stmt->fetchAll()]);
    break;

  case 'search_users':
    $userId = requireAuth();
    $q = trim($_GET['q'] ?? '');

    if (strlen($q) < 2) {
      jsonResponse(['success' => true, 'users' => []]);
    }

    $like = "%$q%";
    $stmt = $pdo->prepare("
      SELECT u.id, u.name, u.username, u.regno,
             (SELECT status FROM follows WHERE follower_id = ? AND following_id = u.id LIMIT 1) AS follow_status
      FROM users u
      WHERE u.id != ?
        AND (u.name LIKE ? OR u.username LIKE ? OR u.regno LIKE ?)
      LIMIT 20
    ");
    $stmt->execute([$userId, $userId, $like, $like, $like]);

    jsonResponse(['success' => true, 'users' => $stmt->fetchAll()]);
    break;

  // ==========================================
  // USER PROFILE (for forum sidebar)
  // ==========================================
  case 'get_profile':
    $userId   = requireAuth();
    $targetId = intval($_GET['user_id'] ?? $userId);

    $stmt = $pdo->prepare("SELECT id, name, username, regno, created_at FROM users WHERE id = ?");
    $stmt->execute([$targetId]);
    $user = $stmt->fetch();

    if (!$user) {
      jsonResponse(['success' => false, 'error' => 'User not found'], 404);
    }

    // Counts
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM follows WHERE following_id = ? AND status = 'accepted'");
    $stmt->execute([$targetId]);
    $user['follower_count'] = $stmt->fetchColumn();

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM follows WHERE follower_id = ? AND status = 'accepted'");
    $stmt->execute([$targetId]);
    $user['following_count'] = $stmt->fetchColumn();

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM posts WHERE user_id = ?");
    $stmt->execute([$targetId]);
    $user['post_count'] = $stmt->fetchColumn();

    // Follow status from current user's perspective
    if ($targetId != $userId) {
      $stmt = $pdo->prepare("SELECT status FROM follows WHERE follower_id = ? AND following_id = ?");
      $stmt->execute([$userId, $targetId]);
      $user['follow_status'] = $stmt->fetchColumn() ?: null;
    }

    jsonResponse(['success' => true, 'user' => $user]);
    break;

  default:
    jsonResponse(['success' => false, 'error' => 'Unknown action'], 400);
}
