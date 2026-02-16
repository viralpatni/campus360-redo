<?php
// ============================================
// Campus360 — Database Configuration
// ============================================

session_start();

// --- Database credentials ---
define('DB_HOST', 'localhost');
define('DB_NAME', 'campus360');
define('DB_USER', 'root');
define('DB_PASS', '');          // Default WAMP root password is empty

// --- PDO Connection ---
try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

// --- Helper: JSON response ---
function jsonResponse($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

// --- Helper: require logged-in user ---
function requireAuth() {
    if (!isset($_SESSION['user_id'])) {
        jsonResponse(['success' => false, 'error' => 'Not authenticated'], 401);
    }
    return $_SESSION['user_id'];
}
