<?php
// get_resources.php
// Returns paginated list of study resources
header('Content-Type: application/json');

echo json_encode(['resources' => $resources, 'hasMore' => $hasMore]);

$metaFile = __DIR__ . '/resource_meta.json';
$meta = file_exists($metaFile) ? json_decode(file_get_contents($metaFile), true) : [];
$category = isset($_GET['category']) ? $_GET['category'] : '';
$search = isset($_GET['search']) ? strtolower($_GET['search']) : '';
$page = isset($_GET['page']) ? intval($_GET['page']) : 1;
$pageSize = 10;
$filtered = array_filter($meta, function($item) use ($category, $search) {
    $catMatch = !$category || strtolower($item['category']) === strtolower($category);
    $searchMatch = !$search || strpos(strtolower($item['name']), $search) !== false;
    return $catMatch && $searchMatch;
});
$filtered = array_values($filtered);
$total = count($filtered);
$start = ($page - 1) * $pageSize;
$end = min($start + $pageSize, $total);
$resources = [];
for ($i = $start; $i < $end; $i++) {
    $item = $filtered[$i];
    $resources[] = [
        'name' => $item['name'],
        'category' => $item['category'],
        'uploadDate' => $item['uploadDate'],
        'url' => '../uploads/resources/' . $item['filename']
    ];
}
$hasMore = $end < $total;
echo json_encode(['resources' => $resources, 'hasMore' => $hasMore]);
