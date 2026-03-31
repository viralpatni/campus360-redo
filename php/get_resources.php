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
    jsonResponse(['resources' => [], 'hasMore' => false], 200);
}

$category = trim($_GET['category'] ?? '');
$search = trim($_GET['search'] ?? '');
$page = max(1, (int) ($_GET['page'] ?? 1));
$pageSize = 10;
$offset = ($page - 1) * $pageSize;

$where = [];
$params = [];

if ($category !== '') {
    $where[] = 'category = ?';
    $params[] = $category;
}

if ($search !== '') {
    $where[] = 'LOWER(name) LIKE ?';
    $params[] = '%' . strtolower($search) . '%';
}

$whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

$countStmt = $pdo->prepare("SELECT COUNT(*) AS total FROM study_resources $whereSql");
$countStmt->execute($params);
$total = (int) $countStmt->fetchColumn();

$listSql = "SELECT id, name, category, created_at FROM study_resources $whereSql ORDER BY id DESC LIMIT ? OFFSET ?";
$listStmt = $pdo->prepare($listSql);
$bindIndex = 1;
foreach ($params as $param) {
    $listStmt->bindValue($bindIndex++, $param, PDO::PARAM_STR);
}
$listStmt->bindValue($bindIndex++, $pageSize, PDO::PARAM_INT);
$listStmt->bindValue($bindIndex, $offset, PDO::PARAM_INT);
$listStmt->execute();

$resources = [];
while ($row = $listStmt->fetch(PDO::FETCH_ASSOC)) {
    $resources[] = [
        'name' => $row['name'],
        'category' => $row['category'],
        'uploadDate' => $row['created_at'],
        'url' => 'php/download_resource.php?id=' . (int) $row['id']
    ];
}

$hasMore = ($offset + count($resources)) < $total;
jsonResponse(['resources' => $resources, 'hasMore' => $hasMore]);
