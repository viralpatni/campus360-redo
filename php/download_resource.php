<?php
require_once __DIR__ . '/config.php';

ini_set('display_errors', 0);

$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($id <= 0) {
    http_response_code(400);
    echo 'Invalid resource id';
    exit;
}

try {
    $stmt = $pdo->prepare('SELECT original_filename, mime_type, file_data, file_size FROM study_resources WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $file = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$file) {
        http_response_code(404);
        echo 'Resource not found';
        exit;
    }

    $filename = $file['original_filename'] ?: ('resource_' . $id);
    $mimeType = $file['mime_type'] ?: 'application/octet-stream';
    $size = (int) $file['file_size'];

    if (ob_get_length()) {
        ob_end_clean();
    }

    header('Content-Description: File Transfer');
    header('Content-Type: ' . $mimeType);
    header('Content-Disposition: attachment; filename="' . addslashes($filename) . '"');
    header('Content-Length: ' . $size);
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('Pragma: public');

    echo $file['file_data'];
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo 'Failed to download resource';
}
