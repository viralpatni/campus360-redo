<?php
// ============================================
// Campus360 — Internships API Endpoint
// ============================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

require_once __DIR__ . '/scraper.php';

$action = $_GET['action'] ?? 'fetch';
$source = $_GET['source'] ?? 'all';
$query  = $_GET['q'] ?? '';

$scraper = new InternshipScraper(3600); // 1 hour cache TTL

try {
    switch ($action) {
        case 'fetch':
            if ($source === 'internshala') {
                $result = $scraper->scrapeInternshala(false);
            } elseif ($source === 'webscraper') {
                $result = $scraper->scrapeWebscraperDemo(false);
            } else {
                $result = $scraper->scrapeAll(false);
            }
            break;

        case 'refresh':
            if ($source === 'internshala') {
                $result = $scraper->scrapeInternshala(true);
            } elseif ($source === 'webscraper') {
                $result = $scraper->scrapeWebscraperDemo(true);
            } else {
                $result = $scraper->scrapeAll(true);
            }
            break;

        case 'search':
            $result = $scraper->search($query, $source, false);
            break;

        default:
            $result = [
                'success' => false,
                'error'   => 'Unknown action. Use: fetch, refresh, or search',
            ];
            break;
    }
} catch (Exception $e) {
    $result = [
        'success' => false,
        'error'   => 'Server error: ' . $e->getMessage(),
    ];
    http_response_code(500);
}

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
