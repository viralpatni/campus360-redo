<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS study_resources (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL DEFAULT 'General',
        original_filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(150) NOT NULL DEFAULT 'application/octet-stream',
        file_data LONGBLOB NOT NULL,
        file_size INT UNSIGNED NOT NULL,
        uploaded_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_resources_category (category),
        INDEX idx_resources_created (created_at),
        CONSTRAINT fk_resources_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => 'Failed to prepare resource table'], 500);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'error' => 'Invalid request method'], 405);
}

if (!isset($_FILES['resourceFile']) || $_FILES['resourceFile']['error'] !== UPLOAD_ERR_OK) {
    jsonResponse(['success' => false, 'error' => 'No valid file uploaded'], 400);
}

$displayName = trim($_POST['resourceName'] ?? $_FILES['resourceFile']['name']);
$category = trim($_POST['resourceCategory'] ?? 'General');
$tmpPath = $_FILES['resourceFile']['tmp_name'];
$originalFilename = $_FILES['resourceFile']['name'];
$mimeType = $_FILES['resourceFile']['type'] ?: 'application/octet-stream';
$fileSize = (int) $_FILES['resourceFile']['size'];
$uploadedBy = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;

if ($displayName === '') {
    jsonResponse(['success' => false, 'error' => 'Resource name is required'], 400);
}

$fileData = file_get_contents($tmpPath);
if ($fileData === false) {
    jsonResponse(['success' => false, 'error' => 'Failed to read uploaded file'], 500);
}

try {
    $stmt = $pdo->prepare('INSERT INTO study_resources (name, category, original_filename, mime_type, file_data, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmt->bindValue(1, $displayName);
    $stmt->bindValue(2, $category === '' ? 'General' : $category);
    $stmt->bindValue(3, $originalFilename);
    $stmt->bindValue(4, $mimeType);
    $stmt->bindValue(5, $fileData, PDO::PARAM_LOB);
    $stmt->bindValue(6, $fileSize, PDO::PARAM_INT);
    if ($uploadedBy === null) {
        $stmt->bindValue(7, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue(7, $uploadedBy, PDO::PARAM_INT);
    }
    $stmt->execute();

    jsonResponse([
        'success' => true,
        'id' => (int) $pdo->lastInsertId(),
        'name' => $displayName
    ]);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => 'Database save failed'], 500);
}
