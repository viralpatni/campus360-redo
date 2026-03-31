<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS pyq_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subject VARCHAR(255) NOT NULL,
        exam_year VARCHAR(20) NOT NULL,
        category VARCHAR(100) NOT NULL DEFAULT 'General',
        original_filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(150) NOT NULL DEFAULT 'application/octet-stream',
        file_data LONGBLOB NOT NULL,
        file_size INT UNSIGNED NOT NULL,
        uploaded_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pyq_category (category),
        INDEX idx_pyq_created (created_at),
        CONSTRAINT fk_pyq_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => 'Failed to prepare PYQ table'], 500);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'error' => 'Invalid request method'], 405);
}

if (!isset($_FILES['pyqFile']) || $_FILES['pyqFile']['error'] !== UPLOAD_ERR_OK) {
    jsonResponse(['success' => false, 'error' => 'No valid file uploaded'], 400);
}

$subject = trim($_POST['pyqSubject'] ?? 'Unknown');
$year = trim($_POST['pyqYear'] ?? 'Unknown');
$category = trim($_POST['pyqCategory'] ?? 'General');
$tmpPath = $_FILES['pyqFile']['tmp_name'];
$originalFilename = $_FILES['pyqFile']['name'];
$mimeType = $_FILES['pyqFile']['type'] ?: 'application/octet-stream';
$fileSize = (int) $_FILES['pyqFile']['size'];
$uploadedBy = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;

if ($subject === '') {
    $subject = 'Unknown';
}
if ($year === '') {
    $year = 'Unknown';
}

$fileData = file_get_contents($tmpPath);
if ($fileData === false) {
    jsonResponse(['success' => false, 'error' => 'Failed to read uploaded file'], 500);
}

try {
    $stmt = $pdo->prepare('INSERT INTO pyq_files (subject, exam_year, category, original_filename, mime_type, file_data, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->bindValue(1, $subject);
    $stmt->bindValue(2, $year);
    $stmt->bindValue(3, $category === '' ? 'General' : $category);
    $stmt->bindValue(4, $originalFilename);
    $stmt->bindValue(5, $mimeType);
    $stmt->bindValue(6, $fileData, PDO::PARAM_LOB);
    $stmt->bindValue(7, $fileSize, PDO::PARAM_INT);
    if ($uploadedBy === null) {
        $stmt->bindValue(8, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue(8, $uploadedBy, PDO::PARAM_INT);
    }
    $stmt->execute();

    jsonResponse([
        'success' => true,
        'id' => (int) $pdo->lastInsertId(),
        'subject' => $subject,
        'year' => $year
    ]);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => 'Database save failed'], 500);
}
