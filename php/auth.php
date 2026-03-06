<?php
// ============================================
// Campus360 — Authentication API
// ============================================
// Endpoints: ?action=signup|login|logout|check|get_user
// ============================================

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {

    // ===== SIGNUP =====
    case 'signup':
        $name         = trim($_POST['name'] ?? '');
        $username     = trim($_POST['username'] ?? '');
        $regno        = trim($_POST['regno'] ?? '');
        $email        = trim($_POST['email'] ?? '');
        $password     = $_POST['password'] ?? '';
        $accountType  = $_POST['account_type'] ?? 'student';

        // Validate
        if (!$name || !$username || !$email || !$password) {
            jsonResponse(['success' => false, 'error' => 'All fields are required'], 400);
        }

        // Students need regno, clubs don't
        if ($accountType === 'student' && !$regno) {
            jsonResponse(['success' => false, 'error' => 'Registration number is required'], 400);
        }

        if (strlen($password) < 6) {
            jsonResponse(['success' => false, 'error' => 'Password must be at least 6 characters'], 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['success' => false, 'error' => 'Invalid email format'], 400);
        }

        if (!in_array($accountType, ['student', 'club'])) {
            $accountType = 'student';
        }

        // Check duplicates
        $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? OR email = ? OR (regno = ? AND regno != '')");
        $stmt->execute([$username, $email, $regno ?: '']);
        if ($stmt->fetch()) {
            jsonResponse(['success' => false, 'error' => 'Username, email, or registration number already exists'], 409);
        }

        // Clubs start unapproved, students auto-approved
        $isApproved = ($accountType === 'student') ? 1 : 0;

        // Insert user
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (name, username, regno, email, password, account_type, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$name, $username, $regno ?: '', $email, $hash, $accountType, $isApproved]);

        $userId = $pdo->lastInsertId();

        // If club, create club profile
        if ($accountType === 'club') {
            $clubDesc     = trim($_POST['club_description'] ?? '');
            $clubCategory = $_POST['club_category'] ?? 'other';
            $validCats = ['tech','cultural','sports','social','academic','other'];
            if (!in_array($clubCategory, $validCats)) $clubCategory = 'other';

            $stmt = $pdo->prepare("INSERT INTO club_profiles (user_id, description, category) VALUES (?, ?, ?)");
            $stmt->execute([$userId, $clubDesc, $clubCategory]);

            jsonResponse(['success' => true, 'message' => 'Club account created. Awaiting admin approval.', 'user' => [
                'id'           => $userId,
                'name'         => $name,
                'username'     => $username,
                'account_type' => 'club',
                'is_approved'  => 0,
            ]]);
        }

        // Auto-login after student signup
        $_SESSION['user_id']      = $userId;
        $_SESSION['username']     = $username;
        $_SESSION['name']         = $name;
        $_SESSION['account_type'] = 'student';

        jsonResponse(['success' => true, 'user' => [
            'id'           => $userId,
            'name'         => $name,
            'username'     => $username,
            'regno'        => $regno,
            'account_type' => 'student',
        ]]);
        break;

    // ===== LOGIN =====
    case 'login':
        $identifier = trim($_POST['identifier'] ?? '');  // username or email
        $password   = $_POST['password'] ?? '';

        if (!$identifier || !$password) {
            jsonResponse(['success' => false, 'error' => 'Username/email and password are required'], 400);
        }

        $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? OR email = ?");
        $stmt->execute([$identifier, $identifier]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password'])) {
            jsonResponse(['success' => false, 'error' => 'Invalid credentials'], 401);
        }

        // Block unapproved club accounts
        if ($user['account_type'] === 'club' && !$user['is_approved']) {
            jsonResponse(['success' => false, 'error' => 'Your club account is pending admin approval'], 403);
        }

        // Set session
        $_SESSION['user_id']      = $user['id'];
        $_SESSION['username']     = $user['username'];
        $_SESSION['name']         = $user['name'];
        $_SESSION['account_type'] = $user['account_type'];

        jsonResponse(['success' => true, 'user' => [
            'id'           => $user['id'],
            'name'         => $user['name'],
            'username'     => $user['username'],
            'regno'        => $user['regno'],
            'account_type' => $user['account_type'],
        ]]);
        break;

    // ===== LOGOUT =====
    case 'logout':
        session_destroy();
        jsonResponse(['success' => true]);
        break;

    // ===== CHECK SESSION =====
    case 'check':
        if (isset($_SESSION['user_id'])) {
            $stmt = $pdo->prepare("SELECT id, name, username, regno, account_type FROM users WHERE id = ?");
            $stmt->execute([$_SESSION['user_id']]);
            $user = $stmt->fetch();
            if ($user) {
                jsonResponse(['success' => true, 'loggedIn' => true, 'user' => $user]);
            }
        }
        jsonResponse(['success' => true, 'loggedIn' => false]);
        break;

    // ===== GET USER INFO =====
    case 'get_user':
        requireAuth();
        $uid = intval($_GET['id'] ?? 0);
        if (!$uid) {
            jsonResponse(['success' => false, 'error' => 'User ID required'], 400);
        }
        $stmt = $pdo->prepare("SELECT id, name, username, regno FROM users WHERE id = ?");
        $stmt->execute([$uid]);
        $user = $stmt->fetch();
        if (!$user) {
            jsonResponse(['success' => false, 'error' => 'User not found'], 404);
        }
        jsonResponse(['success' => true, 'user' => $user]);
        break;

    // ===== APPROVE CLUB (admin only) =====
    case 'approve_club':
        $adminId = requireAuth();
        $stmt = $pdo->prepare("SELECT account_type FROM users WHERE id = ?");
        $stmt->execute([$adminId]);
        $admin = $stmt->fetch();
        if (!$admin || $admin['account_type'] !== 'admin') {
            jsonResponse(['success' => false, 'error' => 'Admin access required'], 403);
        }

        $clubId = intval($_POST['club_id'] ?? 0);
        if (!$clubId) {
            jsonResponse(['success' => false, 'error' => 'Club ID required'], 400);
        }

        $stmt = $pdo->prepare("UPDATE users SET is_approved = 1 WHERE id = ? AND account_type = 'club'");
        $stmt->execute([$clubId]);

        jsonResponse(['success' => true, 'message' => 'Club approved']);
        break;

    // ===== LIST PENDING CLUBS (admin only) =====
    case 'pending_clubs':
        $adminId = requireAuth();
        $stmt = $pdo->prepare("SELECT account_type FROM users WHERE id = ?");
        $stmt->execute([$adminId]);
        $admin = $stmt->fetch();
        if (!$admin || $admin['account_type'] !== 'admin') {
            jsonResponse(['success' => false, 'error' => 'Admin access required'], 403);
        }

        $stmt = $pdo->prepare("
            SELECT u.id, u.name, u.username, u.email, u.created_at,
                   cp.description, cp.category
            FROM users u
            LEFT JOIN club_profiles cp ON u.id = cp.user_id
            WHERE u.account_type = 'club' AND u.is_approved = 0
            ORDER BY u.created_at DESC
        ");
        $stmt->execute();

        jsonResponse(['success' => true, 'clubs' => $stmt->fetchAll()]);
        break;

    default:
        jsonResponse(['success' => false, 'error' => 'Invalid action'], 400);
}
