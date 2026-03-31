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
    jsonResponse(['pyqs' => [], 'hasMore' => false], 200);
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
    $where[] = '(LOWER(subject) LIKE ? OR LOWER(exam_year) LIKE ?)';
    $params[] = '%' . strtolower($search) . '%';
    $params[] = '%' . strtolower($search) . '%';
}

$whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

$countStmt = $pdo->prepare("SELECT COUNT(*) AS total FROM pyq_files $whereSql");
$countStmt->execute($params);
$total = (int) $countStmt->fetchColumn();

$listSql = "SELECT id, subject, exam_year, category, created_at FROM pyq_files $whereSql ORDER BY id DESC LIMIT ? OFFSET ?";
$listStmt = $pdo->prepare($listSql);
$bindIndex = 1;
foreach ($params as $param) {
    $listStmt->bindValue($bindIndex++, $param, PDO::PARAM_STR);
}
$listStmt->bindValue($bindIndex++, $pageSize, PDO::PARAM_INT);
$listStmt->bindValue($bindIndex, $offset, PDO::PARAM_INT);
$listStmt->execute();

$pyqs = [];
while ($row = $listStmt->fetch(PDO::FETCH_ASSOC)) {
    $pyqs[] = [
        'subject' => $row['subject'],
        'year' => $row['exam_year'],
        'category' => $row['category'],
        'uploadDate' => $row['created_at'],
        'url' => 'php/download_pyq.php?id=' . (int) $row['id']
    ];
}

$hasMore = ($offset + count($pyqs)) < $total;
jsonResponse(['pyqs' => $pyqs, 'hasMore' => $hasMore]);
