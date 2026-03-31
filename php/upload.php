<?php
// ============================================
// Campus360 — File Upload API
// ============================================
// POST with multipart/form-data: file + type (image|video|audio)
// ============================================

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

$userId = requireAuth();

function bytesFromIni(string $value): int {
    $value = trim($value);
    if ($value === '') return 0;
    $unit = strtolower(substr($value, -1));
    $num  = (float)$value;
    switch ($unit) {
        case 'g': $num *= 1024;
        case 'm': $num *= 1024;
        case 'k': $num *= 1024;
    }
    return (int)$num;
}

function uploadErrorMessage(int $code): string {
    switch ($code) {
        case UPLOAD_ERR_OK:
            return '';
        case UPLOAD_ERR_INI_SIZE:
            return 'File exceeds server upload_max_filesize limit';
        case UPLOAD_ERR_FORM_SIZE:
            return 'File exceeds MAX_FILE_SIZE limit';
        case UPLOAD_ERR_PARTIAL:
            return 'File upload was partial; please retry';
        case UPLOAD_ERR_NO_FILE:
            return 'No file selected';
        case UPLOAD_ERR_NO_TMP_DIR:
            return 'Server missing temporary upload directory';
        case UPLOAD_ERR_CANT_WRITE:
            return 'Server could not write uploaded file';
        case UPLOAD_ERR_EXTENSION:
            return 'Upload blocked by server extension';
        default:
            return 'Unknown upload error';
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'error' => 'POST required'], 405);
}

// Detect requests larger than post_max_size before relying on $_FILES.
$contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
$postMaxSize   = bytesFromIni((string)ini_get('post_max_size'));
if ($postMaxSize > 0 && $contentLength > $postMaxSize) {
    jsonResponse([
        'success' => false,
        'error'   => 'Request is larger than server post_max_size (' . ini_get('post_max_size') . ')',
    ], 413);
}

// Be tolerant to common field names: `file` (primary), `image` (legacy), or first file key.
$file = null;
if (isset($_FILES['file'])) {
    $file = $_FILES['file'];
} elseif (isset($_FILES['image'])) {
    $file = $_FILES['image'];
} elseif (!empty($_FILES)) {
    $first = reset($_FILES);
    if (is_array($first)) $file = $first;
}

if (!$file) {
    jsonResponse(['success' => false, 'error' => 'No file received by server'], 400);
}

if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $errorCode = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
    jsonResponse([
        'success' => false,
        'error'   => uploadErrorMessage($errorCode),
        'code'    => $errorCode,
    ], 400);
}

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
