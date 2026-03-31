<?php
// get_pyqs.php
// Returns paginated list of PYQs
header('Content-Type: application/json');

$metaFile = __DIR__ . '/pyq_meta.json';
$meta = file_exists($metaFile) ? json_decode(file_get_contents($metaFile), true) : [];
$category = isset($_GET['category']) ? $_GET['category'] : '';
$search = isset($_GET['search']) ? strtolower($_GET['search']) : '';
$page = isset($_GET['page']) ? intval($_GET['page']) : 1;
$pageSize = 10;
$filtered = array_filter($meta, function($item) use ($category, $search) {
    $catMatch = !$category || strtolower($item['category']) === strtolower($category);
    $searchMatch = !$search || strpos(strtolower($item['subject']), $search) !== false || strpos(strtolower($item['year']), $search) !== false;
    return $catMatch && $searchMatch;
});
$filtered = array_values($filtered);
$total = count($filtered);
$start = ($page - 1) * $pageSize;
$end = min($start + $pageSize, $total);
$pyqs = [];
for ($i = $start; $i < $end; $i++) {
    $item = $filtered[$i];
    $pyqs[] = [
        'subject' => $item['subject'],
        'year' => $item['year'],
        'category' => $item['category'],
        'uploadDate' => $item['uploadDate'],
        'url' => '../uploads/pyqs/' . $item['filename']
    ];
}
$hasMore = $end < $total;
echo json_encode(['pyqs' => $pyqs, 'hasMore' => $hasMore]);
