<?php
file_put_contents(__DIR__ . '/../debug_log.txt', "--- API Hit " . date('Y-m-d H:i:s') . " ---\n", FILE_APPEND);
file_put_contents(__DIR__ . '/../debug_log.txt', "Request: " . print_r($_REQUEST, true) . "\n", FILE_APPEND);

// ============================================
// Campus360 — Events API (clubs, events, RSVPs)
// ============================================
// Endpoints: ?action=get_events|get_event|create_event|update_event|cancel_event
//            |rsvp|get_rsvps|get_clubs|get_club_profile|follow_club|get_my_followed_clubs
// ============================================

require_once __DIR__ . '/config.php';
ini_set('display_errors', 0);

header('Content-Type: application/json');

$action = $_GET['action'] ?? $_POST['action'] ?? '';

// Helper: check if current user is a club account
function requireClub() {
    $userId = requireAuth();
    global $pdo;
    $stmt = $pdo->prepare("SELECT account_type FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user || $user['account_type'] !== 'club') {
        jsonResponse(['success' => false, 'error' => 'Club account required'], 403);
    }
    return $userId;
}

switch ($action) {

  // ==========================================
  // GET EVENTS (paginated, filterable)
  // ==========================================
  case 'get_events':
    requireAuth();
    $page     = max(1, intval($_GET['page'] ?? 1));
    $limit    = 20;
    $offset   = ($page - 1) * $limit;
    $category = $_GET['category'] ?? '';
    $clubId   = intval($_GET['club_id'] ?? 0);
    $status   = $_GET['status'] ?? 'upcoming';

    $where = ["e.status = ?"];
    $params = [$status];

    if ($category && $category !== 'all') {
        $where[] = "cp.category = ?";
        $params[] = $category;
    }

    if ($clubId) {
        $where[] = "e.club_id = ?";
        $params[] = $clubId;
    }

    $whereStr = implode(' AND ', $where);

    // If fetching upcoming events, hide past ones (even if status is 'upcoming')
    // This ensures the list starts with today/future events
    // Logic: If (End Date OR Start Date) >= Today, show it.
    if ($status === 'upcoming') {
        $whereStr .= " AND (COALESCE(e.event_date_end, e.event_date) >= CURDATE())";
    }

    $params[] = $limit;
    $params[] = $offset;

    $stmt = $pdo->prepare("
      SELECT e.*,
             u.name AS club_name, u.username AS club_username,
             cp.category AS club_category, cp.logo_path AS club_logo,
             (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'interested') AS interested_count,
             (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'going') AS going_count
      FROM events e
      JOIN users u ON e.club_id = u.id
      LEFT JOIN club_profiles cp ON u.id = cp.user_id
      WHERE $whereStr
      ORDER BY e.event_date ASC, e.event_time_start ASC
      LIMIT ? OFFSET ?
    ");
    $stmt->execute($params);
    $events = $stmt->fetchAll();

    // Attach current user's RSVP status
    $userId = $_SESSION['user_id'];
    foreach ($events as &$ev) {
        $stmt2 = $pdo->prepare("SELECT status FROM event_rsvps WHERE event_id = ? AND user_id = ?");
        $stmt2->execute([$ev['id'], $userId]);
        $ev['my_rsvp'] = $stmt2->fetchColumn() ?: null;
    }

    jsonResponse(['success' => true, 'events' => $events]);
    break;

  // ==========================================
  // GET SINGLE EVENT
  // ==========================================
  case 'get_event':
    requireAuth();
    $eventId = intval($_GET['event_id'] ?? 0);
    if (!$eventId) {
        jsonResponse(['success' => false, 'error' => 'Event ID required'], 400);
    }

    $stmt = $pdo->prepare("
      SELECT e.*,
             u.name AS club_name, u.username AS club_username,
             cp.category AS club_category, cp.logo_path AS club_logo, cp.description AS club_description,
             (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'interested') AS interested_count,
             (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'going') AS going_count
      FROM events e
      JOIN users u ON e.club_id = u.id
      LEFT JOIN club_profiles cp ON u.id = cp.user_id
      WHERE e.id = ?
    ");
    $stmt->execute([$eventId]);
    $event = $stmt->fetch();

    if (!$event) {
        jsonResponse(['success' => false, 'error' => 'Event not found'], 404);
    }

    // Current user's RSVP
    $userId = $_SESSION['user_id'];
    $stmt2 = $pdo->prepare("SELECT status FROM event_rsvps WHERE event_id = ? AND user_id = ?");
    $stmt2->execute([$eventId, $userId]);
    $event['my_rsvp'] = $stmt2->fetchColumn() ?: null;

    jsonResponse(['success' => true, 'event' => $event]);
    break;

  // ==========================================
  // CREATE EVENT (club only)
  // ==========================================
  case 'create_event':
    file_put_contents(__DIR__ . '/../debug_log.txt', "--- Create Event Call " . date('Y-m-d H:i:s') . " ---\n", FILE_APPEND);
    file_put_contents(__DIR__ . '/../debug_log.txt', "POST: " . print_r($_POST, true) . "\n", FILE_APPEND);

    try {
        $clubId = requireClub();
    } catch (Exception $e) {
        file_put_contents(__DIR__ . '/../debug_log.txt', "Auth Error: " . $e->getMessage() . "\n", FILE_APPEND);
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 403);
    }
    file_put_contents(__DIR__ . '/../debug_log.txt', "Club ID: $clubId\n", FILE_APPEND);

    $title      = trim($_POST['title'] ?? '');
    $desc       = trim($_POST['description'] ?? '');
    $eventDate  = $_POST['event_date'] ?? '';
    $timeStart  = $_POST['event_time_start'] ?? '';
    $timeEnd    = $_POST['event_time_end'] ?? null;
    $eventDateEnd = $_POST['event_date_end'] ?? null;
    $venue      = trim($_POST['venue'] ?? '');
    $posterPath = $_POST['poster_path'] ?? null;
    $regLink    = trim($_POST['registration_link'] ?? '');
    $maxCap     = !empty($_POST['max_capacity']) ? intval($_POST['max_capacity']) : null;
    $odProvided = intval($_POST['od_provided'] ?? 0);
    $odStart    = $_POST['od_time_start'] ?? null;
    $odEnd      = $_POST['od_time_end'] ?? null;

    if (!$title || !$eventDate || !$timeStart) {
        file_put_contents(__DIR__ . '/../debug_log.txt', "Validation Failed: Missing required fields\n", FILE_APPEND);
        jsonResponse(['success' => false, 'error' => 'Title, date, and start time are required'], 400);
    }

    try {
        $stmt = $pdo->prepare("
          INSERT INTO events (club_id, title, description, event_date, event_date_end, event_time_start, event_time_end,
                              venue, poster_path, registration_link, max_capacity,
                              od_provided, od_time_start, od_time_end)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $params = [
            $clubId, $title, $desc, $eventDate, $eventDateEnd ?: null, $timeStart, $timeEnd ?: null,
            $venue, $posterPath, $regLink ?: null, $maxCap,
            $odProvided, $odStart ?: null, $odEnd ?: null
        ];
        file_put_contents(__DIR__ . '/../debug_log.txt', "Params: " . print_r($params, true) . "\n", FILE_APPEND);
        
        $stmt->execute($params);

        $newId = $pdo->lastInsertId();
        file_put_contents(__DIR__ . '/../debug_log.txt', "Success: Event ID $newId\n", FILE_APPEND);
        jsonResponse(['success' => true, 'event_id' => $newId]);
    } catch (PDOException $e) {
        file_put_contents(__DIR__ . '/../debug_log.txt', "DB Error: " . $e->getMessage() . "\n", FILE_APPEND);
        jsonResponse(['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
    }
    break;

  // ==========================================
  // UPDATE EVENT (club owner only)
  // ==========================================
  case 'update_event':
    $clubId  = requireClub();
    $eventId = intval($_POST['event_id'] ?? 0);

    // Verify ownership
    $stmt = $pdo->prepare("SELECT id FROM events WHERE id = ? AND club_id = ?");
    $stmt->execute([$eventId, $clubId]);
    if (!$stmt->fetch()) {
        jsonResponse(['success' => false, 'error' => 'Event not found or not yours'], 404);
    }

    $fields = [];
    $params = [];

    $allowed = [
        'title' => 's', 'description' => 's', 'event_date' => 's',
        'event_time_start' => 's', 'event_time_end' => 's', 'venue' => 's',
        'poster_path' => 's', 'registration_link' => 's',
        'max_capacity' => 'i', 'od_provided' => 'i',
        'od_time_start' => 's', 'od_time_end' => 's', 'status' => 's',
    ];

    foreach ($allowed as $field => $type) {
        if (isset($_POST[$field])) {
            $fields[] = "$field = ?";
            $params[] = $type === 'i' ? intval($_POST[$field]) : $_POST[$field];
        }
    }

    if (empty($fields)) {
        jsonResponse(['success' => false, 'error' => 'No fields to update'], 400);
    }

    $params[] = $eventId;
    $stmt = $pdo->prepare("UPDATE events SET " . implode(', ', $fields) . " WHERE id = ?");
    $stmt->execute($params);

    jsonResponse(['success' => true]);
    break;

  // ==========================================
  // CANCEL EVENT (club owner only)
  // ==========================================
  case 'cancel_event':
    $clubId  = requireClub();
    $eventId = intval($_POST['event_id'] ?? 0);

    $stmt = $pdo->prepare("UPDATE events SET status = 'cancelled' WHERE id = ? AND club_id = ?");
    $stmt->execute([$eventId, $clubId]);

    jsonResponse(['success' => $stmt->rowCount() > 0]);
    break;

  // ==========================================
  // RSVP (toggle interested / going / remove)
  // ==========================================
  case 'rsvp':
    $userId  = requireAuth();
    $eventId = intval($_POST['event_id'] ?? 0);
    $status  = $_POST['status'] ?? '';  // 'interested', 'going', or 'remove'

    if (!$eventId) {
        jsonResponse(['success' => false, 'error' => 'Event ID required'], 400);
    }

    if ($status === 'remove') {
        $stmt = $pdo->prepare("DELETE FROM event_rsvps WHERE event_id = ? AND user_id = ?");
        $stmt->execute([$eventId, $userId]);
        jsonResponse(['success' => true, 'action' => 'removed']);
    }

    if (!in_array($status, ['interested', 'going'])) {
        jsonResponse(['success' => false, 'error' => 'Invalid RSVP status'], 400);
    }

    // Check max capacity for 'going'
    if ($status === 'going') {
        $stmt = $pdo->prepare("SELECT max_capacity FROM events WHERE id = ?");
        $stmt->execute([$eventId]);
        $event = $stmt->fetch();
        if ($event && $event['max_capacity']) {
            $stmt2 = $pdo->prepare("SELECT COUNT(*) FROM event_rsvps WHERE event_id = ? AND status = 'going'");
            $stmt2->execute([$eventId]);
            $currentGoing = $stmt2->fetchColumn();

            // Check if user already has an RSVP (not counting towards new addition)
            $stmt3 = $pdo->prepare("SELECT status FROM event_rsvps WHERE event_id = ? AND user_id = ?");
            $stmt3->execute([$eventId, $userId]);
            $existing = $stmt3->fetchColumn();

            $effectiveCount = ($existing === 'going') ? $currentGoing : $currentGoing;
            if (!$existing && $currentGoing >= $event['max_capacity']) {
                jsonResponse(['success' => false, 'error' => 'Event is at full capacity'], 400);
            }
            if ($existing && $existing !== 'going' && $currentGoing >= $event['max_capacity']) {
                jsonResponse(['success' => false, 'error' => 'Event is at full capacity'], 400);
            }
        }
    }

    // Upsert RSVP
    $stmt = $pdo->prepare("
      INSERT INTO event_rsvps (event_id, user_id, status)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE status = VALUES(status)
    ");
    $stmt->execute([$eventId, $userId, $status]);

    jsonResponse(['success' => true, 'status' => $status]);
    break;

  // ==========================================
  // GET RSVPS (club owner — for their event)
  // ==========================================
  case 'get_rsvps':
    $clubId  = requireClub();
    $eventId = intval($_GET['event_id'] ?? 0);

    // Verify ownership
    $stmt = $pdo->prepare("SELECT id FROM events WHERE id = ? AND club_id = ?");
    $stmt->execute([$eventId, $clubId]);
    if (!$stmt->fetch()) {
        jsonResponse(['success' => false, 'error' => 'Event not found or not yours'], 404);
    }

    $stmt = $pdo->prepare("
      SELECT r.status AS rsvp_status, r.created_at AS rsvp_date,
             u.id AS user_id, u.name, u.username, u.regno, u.email
      FROM event_rsvps r
      JOIN users u ON r.user_id = u.id
      WHERE r.event_id = ?
      ORDER BY r.status DESC, r.created_at ASC
    ");
    $stmt->execute([$eventId]);

    jsonResponse(['success' => true, 'rsvps' => $stmt->fetchAll()]);
    break;

  // ==========================================
  // GET CLUBS (directory)
  // ==========================================
  case 'get_clubs':
    requireAuth();
    $category = $_GET['category'] ?? '';

    $where = "u.account_type = 'club' AND u.is_approved = 1";
    $params = [];

    if ($category && $category !== 'all') {
        $where .= " AND cp.category = ?";
        $params[] = $category;
    }

    $userId = $_SESSION['user_id'];

    $stmt = $pdo->prepare("
      SELECT u.id, u.name, u.username,
             cp.description, cp.category, cp.logo_path,
             (SELECT COUNT(*) FROM club_follows cf WHERE cf.club_id = u.id) AS follower_count,
             (SELECT COUNT(*) FROM events e WHERE e.club_id = u.id AND e.status = 'upcoming') AS upcoming_events,
             (SELECT COUNT(*) FROM club_follows cf WHERE cf.club_id = u.id AND cf.user_id = ?) AS is_following
      FROM users u
      LEFT JOIN club_profiles cp ON u.id = cp.user_id
      WHERE $where
      ORDER BY follower_count DESC
    ");
    $stmt->execute(array_merge([$userId], $params));

    $clubs = $stmt->fetchAll();
    foreach ($clubs as &$club) {
        $club['is_following'] = (int)$club['is_following'] > 0;
    }

    jsonResponse(['success' => true, 'clubs' => $clubs]);
    break;

  // ==========================================
  // GET CLUB PROFILE
  // ==========================================
  case 'get_club_profile':
    requireAuth();
    $clubId = intval($_GET['club_id'] ?? 0);
    if (!$clubId) {
        jsonResponse(['success' => false, 'error' => 'Club ID required'], 400);
    }

    $stmt = $pdo->prepare("
      SELECT u.id, u.name, u.username, u.created_at,
             cp.description, cp.category, cp.logo_path,
             (SELECT COUNT(*) FROM club_follows cf WHERE cf.club_id = u.id) AS follower_count,
             (SELECT COUNT(*) FROM events e WHERE e.club_id = u.id) AS total_events
      FROM users u
      LEFT JOIN club_profiles cp ON u.id = cp.user_id
      WHERE u.id = ? AND u.account_type = 'club' AND u.is_approved = 1
    ");
    $stmt->execute([$clubId]);
    $club = $stmt->fetch();

    if (!$club) {
        jsonResponse(['success' => false, 'error' => 'Club not found'], 404);
    }

    // Is current user following?
    $userId = $_SESSION['user_id'];
    $stmt2 = $pdo->prepare("SELECT id FROM club_follows WHERE user_id = ? AND club_id = ?");
    $stmt2->execute([$userId, $clubId]);
    $club['is_following'] = (bool)$stmt2->fetch();

    // Club's events
    $stmt3 = $pdo->prepare("
      SELECT e.*,
             (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'interested') AS interested_count,
             (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'going') AS going_count
      FROM events e
      WHERE e.club_id = ?
      ORDER BY e.event_date DESC
      LIMIT 20
    ");
    $stmt3->execute([$clubId]);
    $club['events'] = $stmt3->fetchAll();

    jsonResponse(['success' => true, 'club' => $club]);
    break;

  // ==========================================
  // FOLLOW / UNFOLLOW CLUB
  // ==========================================
  case 'follow_club':
    $userId = requireAuth();
    $clubId = intval($_POST['club_id'] ?? 0);

    if (!$clubId) {
        jsonResponse(['success' => false, 'error' => 'Club ID required'], 400);
    }

    // Check if already following
    $stmt = $pdo->prepare("SELECT id FROM club_follows WHERE user_id = ? AND club_id = ?");
    $stmt->execute([$userId, $clubId]);

    if ($stmt->fetch()) {
        // Unfollow
        $stmt = $pdo->prepare("DELETE FROM club_follows WHERE user_id = ? AND club_id = ?");
        $stmt->execute([$userId, $clubId]);
        jsonResponse(['success' => true, 'action' => 'unfollowed']);
    } else {
        // Follow
        $stmt = $pdo->prepare("INSERT INTO club_follows (user_id, club_id) VALUES (?, ?)");
        $stmt->execute([$userId, $clubId]);
        jsonResponse(['success' => true, 'action' => 'followed']);
    }
    break;

  // ==========================================
  // GET MY FOLLOWED CLUBS
  // ==========================================
  case 'get_my_followed_clubs':
    $userId = requireAuth();

    $stmt = $pdo->prepare("
      SELECT u.id, u.name, u.username,
             cp.category, cp.logo_path,
             (SELECT COUNT(*) FROM events e WHERE e.club_id = u.id AND e.status = 'upcoming') AS upcoming_events
      FROM club_follows cf
      JOIN users u ON cf.club_id = u.id
      LEFT JOIN club_profiles cp ON u.id = cp.user_id
      WHERE cf.user_id = ?
      ORDER BY u.name ASC
    ");
    $stmt->execute([$userId]);

    jsonResponse(['success' => true, 'clubs' => $stmt->fetchAll()]);
    break;

  default:
    jsonResponse(['success' => false, 'error' => 'Unknown action'], 400);
}
