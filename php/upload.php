<?php
// ============================================
// Campus360 — File Upload API
// ============================================
// POST with multipart/form-data: file + type (image|video|audio)
// ============================================

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

$userId = requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'error' => 'POST required'], 405);
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    jsonResponse(['success' => false, 'error' => 'No file uploaded or upload error'], 400);
}

$file = $_FILES['file'];
$type = $_POST['type'] ?? 'image'; // image, video, audio

// --- Validation ---
$maxSize = 50 * 1024 * 1024; // 50 MB
if ($file['size'] > $maxSize) {
    jsonResponse(['success' => false, 'error' => 'File too large (max 50MB)'], 400);
}

$allowedTypes = [
    'image' => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    'video' => ['video/mp4', 'video/webm', 'video/ogg'],
    'audio' => ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'],
];

$mime = mime_content_type($file['tmp_name']);
if (!isset($allowedTypes[$type]) || !in_array($mime, $allowedTypes[$type])) {
    jsonResponse(['success' => false, 'error' => 'File type not allowed'], 400);
}

// --- Save file ---
$uploadDir = __DIR__ . '/../uploads/' . $type . '/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = uniqid('c360_') . '_' . time() . '.' . $ext;
$savePath = $uploadDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $savePath)) {
    jsonResponse(['success' => false, 'error' => 'Failed to save file'], 500);
}

$relativePath = 'uploads/' . $type . '/' . $filename;

jsonResponse([
    'success'   => true,
    'path'      => $relativePath,
    'file_type' => $type,
    'file_name' => $file['name'],
]);
