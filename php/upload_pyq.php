<?php
// upload_pyq.php
// Handles PYQ uploads
header('Content-Type: application/json');

$pyqDir = '../uploads/pyqs/';
if (!is_dir($pyqDir)) {
    mkdir($pyqDir, 0777, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['pyqFile'])) {
    $subject = isset($_POST['pyqSubject']) ? preg_replace('/[^a-zA-Z0-9]/', '_', $_POST['pyqSubject']) : 'Unknown';
    $year = isset($_POST['pyqYear']) ? preg_replace('/[^a-zA-Z0-9]/', '_', $_POST['pyqYear']) : 'Unknown';
    $category = isset($_POST['pyqCategory']) ? $_POST['pyqCategory'] : 'General';
    $fileTmp = $_FILES['pyqFile']['tmp_name'];
    $fileExt = pathinfo($_FILES['pyqFile']['name'], PATHINFO_EXTENSION);
    $safeName = $subject . '_' . $year . '_' . uniqid() . '.' . $fileExt;
    $target = $pyqDir . $safeName;
    $uploadDate = date('Y-m-d H:i:s');
    $errorDetails = [];
    if (!is_uploaded_file($fileTmp)) {
        $errorDetails['phpFileError'] = $_FILES['pyqFile']['error'];
        $errorDetails['tmpName'] = $fileTmp;
        echo json_encode(['success' => false, 'error' => 'No valid file uploaded', 'details' => $errorDetails]);
        exit;
    }
    if (move_uploaded_file($fileTmp, $target)) {
        // Save metadata
        $metaFile = __DIR__ . '/pyq_meta.json';
        $meta = file_exists($metaFile) ? json_decode(file_get_contents($metaFile), true) : [];
        if (!is_array($meta)) $meta = [];
        $meta[] = [
            'subject' => $subject,
            'year' => $year,
            'filename' => $safeName,
            'category' => $category,
            'uploadDate' => $uploadDate
        ];
        $json = json_encode($meta, JSON_PRETTY_PRINT);
        if ($json === false) {
            echo json_encode(['success' => false, 'error' => 'Metadata encoding failed']);
            exit;
        }
        file_put_contents($metaFile, $json);
        echo json_encode(['success' => true, 'filename' => $safeName]);
    } else {
        $errorDetails['phpFileError'] = $_FILES['pyqFile']['error'];
        $errorDetails['tmpName'] = $fileTmp;
        $errorDetails['target'] = $target;
        $errorDetails['permissions'] = is_writable(dirname($target));
        echo json_encode(['success' => false, 'error' => 'Upload failed', 'details' => $errorDetails]);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'No file uploaded']);
}
