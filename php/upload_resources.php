<?php
// upload_resource.php
// Handles resource uploads
header('Content-Type: application/json');

$resourceDir = '../uploads/resources/';
if (!is_dir($resourceDir)) {
    mkdir($resourceDir, 0777, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['resourceFile'])) {
    $name = isset($_POST['resourceName']) ? $_POST['resourceName'] : $_FILES['resourceFile']['name'];
    $fileTmp = $_FILES['resourceFile']['tmp_name'];
    $fileExt = pathinfo($_FILES['resourceFile']['name'], PATHINFO_EXTENSION);
    $safeName = preg_replace('/[^a-zA-Z0-9-_\.]/', '_', $name) . '.' . $fileExt;
    $target = $resourceDir . $safeName;
    $category = isset($_POST['resourceCategory']) ? $_POST['resourceCategory'] : 'General';
    $uploadDate = date('Y-m-d H:i:s');
    if (move_uploaded_file($fileTmp, $target)) {
        // Save metadata
        $metaFile = __DIR__ . '/resource_meta.json';
        $meta = file_exists($metaFile) ? json_decode(file_get_contents($metaFile), true) : [];
        $meta[] = [
            'name' => $name,
            'filename' => $safeName,
            'category' => $category,
            'uploadDate' => $uploadDate
        ];
        file_put_contents($metaFile, json_encode($meta, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true, 'filename' => $safeName]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Upload failed']);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'No file uploaded']);
}
