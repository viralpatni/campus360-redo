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
        $name     = trim($_POST['name'] ?? '');
        $username = trim($_POST['username'] ?? '');
        $regno    = trim($_POST['regno'] ?? '');
        $email    = trim($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';

        // Validate
        if (!$name || !$username || !$regno || !$email || !$password) {
            jsonResponse(['success' => false, 'error' => 'All fields are required'], 400);
        }

        if (strlen($password) < 6) {
            jsonResponse(['success' => false, 'error' => 'Password must be at least 6 characters'], 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['success' => false, 'error' => 'Invalid email format'], 400);
        }

        // Check duplicates
        $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? OR email = ? OR regno = ?");
        $stmt->execute([$username, $email, $regno]);
        if ($stmt->fetch()) {
            jsonResponse(['success' => false, 'error' => 'Username, email, or registration number already exists'], 409);
        }

        // Insert user
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (name, username, regno, email, password) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$name, $username, $regno, $email, $hash]);

        $userId = $pdo->lastInsertId();

        // Auto-login after signup
        $_SESSION['user_id']  = $userId;
        $_SESSION['username'] = $username;
        $_SESSION['name']     = $name;

        jsonResponse(['success' => true, 'user' => [
            'id'       => $userId,
            'name'     => $name,
            'username' => $username,
            'regno'    => $regno,
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

        // Set session
        $_SESSION['user_id']  = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['name']     = $user['name'];

        jsonResponse(['success' => true, 'user' => [
            'id'       => $user['id'],
            'name'     => $user['name'],
            'username' => $user['username'],
            'regno'    => $user['regno'],
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
            $stmt = $pdo->prepare("SELECT id, name, username, regno FROM users WHERE id = ?");
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

    default:
        jsonResponse(['success' => false, 'error' => 'Invalid action'], 400);
}
