<?php
// ============================================
// Campus360 — Internships API (v2)
// Reads from MySQL — no more JSON file cache
// ============================================
// Endpoints:
//   ?action=list         — paginated listing with filters
//   ?action=search&q=... — full-text search
//   ?action=stats        — category/source counts
//   ?action=refresh      — trigger a fresh scrape (user-triggered)
//   ?action=bookmark     — toggle bookmark (POST)
//   ?action=bookmarks    — get user's bookmarks
//   ?action=filters      — available filter options
// ============================================

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');

$action = $_GET['action'] ?? $_POST['action'] ?? 'list';

// --- Smart auto-scrape: check if data is stale (>30 min) ---
$SCRAPER_DIR = realpath(__DIR__ . '/../scraper');
$CACHE_TTL = 1800; // 30 minutes
$LOCK_FILE = $SCRAPER_DIR . '/scraper.lock';

/**
 * Check if scraper is currently running
 */
function isScraperRunning() {
    global $LOCK_FILE;
    if (!file_exists($LOCK_FILE)) return false;
    $lockTime = intval(file_get_contents($LOCK_FILE));
    // Consider stale locks (older than 10 minutes) as not running
    if (time() - $lockTime > 600) {
        @unlink($LOCK_FILE);
        return false;
    }
    return true;
}

/**
 * Trigger background scrape
 */
function triggerBackgroundScrape($source = 'all') {
    global $SCRAPER_DIR, $LOCK_FILE;

    if (isScraperRunning()) return false;

    // Write lock file
    file_put_contents($LOCK_FILE, time());

    $cmd = "node " . escapeshellarg($SCRAPER_DIR . '/index.js');
    if ($source !== 'all') {
        $cmd .= " --source=" . escapeshellarg($source);
    }

    // Determine OS and run in background
    if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
        // Windows: use start /B for background
        $cmd = "start /B cmd /c \"$cmd && del " . str_replace('/', '\\', $LOCK_FILE) . "\"";
        pclose(popen($cmd, 'r'));
    } else {
        // Linux: use nohup
        $cmd = "nohup $cmd > /dev/null 2>&1 && rm -f " . escapeshellarg($LOCK_FILE) . " &";
        exec($cmd);
    }

    return true;
}

/**
 * Check if data is stale and auto-trigger scrape
 */
function autoScrapeIfStale() {
    global $pdo, $CACHE_TTL;

    // Check last scrape time
    $stmt = $pdo->query("SELECT MAX(updated_at) as last_update FROM internships");
    $row = $stmt->fetch();
    $lastUpdate = $row['last_update'] ?? null;

    if (!$lastUpdate) {
        // No data at all — must scrape
        triggerBackgroundScrape();
        return true;
    }

    $lastTime = strtotime($lastUpdate);
    if (time() - $lastTime > $CACHE_TTL) {
        // Data is stale — trigger background scrape
        triggerBackgroundScrape();
        return true;
    }

    return false; // Data is fresh
}

try {
    switch ($action) {

        // ===== LIST with pagination + filters =====
        case 'list':
        case 'fetch':
            // Auto-scrape if data is stale
            $isRefreshing = autoScrapeIfStale();

            $page     = max(1, intval($_GET['page'] ?? 1));
            $limit    = min(500, max(1, intval($_GET['limit'] ?? 20)));
            $offset   = ($page - 1) * $limit;
            $source   = trim($_GET['source'] ?? '');
            $category = trim($_GET['category'] ?? '');
            $location = trim($_GET['location'] ?? '');
            $sort     = trim($_GET['sort'] ?? 'newest');

            $where = ['is_active = 1'];
            $params = [];

            if ($source && $source !== 'all') {
                $where[] = 'source = ?';
                $params[] = $source;
            }

            if ($category) {
                $where[] = '(category LIKE ? OR JSON_SEARCH(tags, "one", ?) IS NOT NULL)';
                $params[] = "%$category%";
                $params[] = $category;
            }

            if ($location === 'wfh') {
                $where[] = "(location LIKE '%work from home%' OR location LIKE '%remote%' OR JSON_SEARCH(tags, 'one', 'Work From Home') IS NOT NULL)";
            } elseif ($location === 'office') {
                $where[] = "location NOT LIKE '%work from home%' AND location NOT LIKE '%remote%'";
            }

            $whereClause = implode(' AND ', $where);

            // Sort
            $orderBy = match($sort) {
                'oldest'      => 'scraped_at ASC',
                'stipend_high' => "CAST(REGEXP_REPLACE(stipend, '[^0-9]', '') AS UNSIGNED) DESC",
                default        => 'scraped_at DESC',
            };

            // Total count
            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM internships WHERE $whereClause");
            $countStmt->execute($params);
            $total = $countStmt->fetchColumn();

            // Fetch page
            $stmt = $pdo->prepare("SELECT * FROM internships WHERE $whereClause ORDER BY $orderBy LIMIT ? OFFSET ?");
            $allParams = array_merge($params, [$limit, $offset]);
            $stmt->execute($allParams);
            $internships = $stmt->fetchAll();

            // Parse JSON tags
            foreach ($internships as &$item) {
                $item['tags'] = json_decode($item['tags'] ?? '[]', true) ?: [];
            }

            // Check bookmarks if user is logged in
            if (isset($_SESSION['user_id'])) {
                $ids = array_column($internships, 'id');
                if (!empty($ids)) {
                    $placeholders = implode(',', array_fill(0, count($ids), '?'));
                    $bmStmt = $pdo->prepare("SELECT internship_id FROM internship_bookmarks WHERE user_id = ? AND internship_id IN ($placeholders)");
                    $bmStmt->execute(array_merge([$_SESSION['user_id']], $ids));
                    $bookmarkedIds = $bmStmt->fetchAll(PDO::FETCH_COLUMN);

                    foreach ($internships as &$item) {
                        $item['bookmarked'] = in_array($item['id'], $bookmarkedIds);
                    }
                }
            }

            jsonResponse([
                'success'      => true,
                'internships'  => $internships,
                'refreshing'   => $isRefreshing || isScraperRunning(),
                'pagination'   => [
                    'page'       => $page,
                    'limit'      => $limit,
                    'total'      => intval($total),
                    'totalPages' => ceil($total / $limit),
                ],
            ]);
            break;

        // ===== REFRESH (user-triggered) =====
        case 'refresh':
            $source = trim($_GET['source'] ?? 'all');
            $triggered = triggerBackgroundScrape($source);
            $isRunning = isScraperRunning();

            jsonResponse([
                'success'   => true,
                'triggered' => $triggered,
                'running'   => $isRunning,
                'message'   => $triggered
                    ? 'Scraper started in background. New data will appear shortly.'
                    : ($isRunning ? 'Scraper is already running.' : 'Data is fresh, no refresh needed.'),
            ]);
            break;


        // ===== SEARCH (full-text) =====
        case 'search':
            $q     = trim($_GET['q'] ?? '');
            $page  = max(1, intval($_GET['page'] ?? 1));
            $limit = min(100, max(1, intval($_GET['limit'] ?? 20)));
            $offset = ($page - 1) * $limit;

            if (!$q) {
                jsonResponse(['success' => false, 'error' => 'Search query required'], 400);
            }

            // Try full-text search
            $searchQuery = preg_replace('/[^\w\s]/', '', $q);

            // Count
            $countStmt = $pdo->prepare(
                "SELECT COUNT(*) FROM internships
                 WHERE is_active = 1 AND (
                     MATCH(title, company, location, description) AGAINST (? IN NATURAL LANGUAGE MODE)
                     OR title LIKE ?
                     OR company LIKE ?
                     OR JSON_SEARCH(tags, 'one', ?) IS NOT NULL
                 )"
            );
            $likeQ = "%$q%";
            $countStmt->execute([$searchQuery, $likeQ, $likeQ, $q]);
            $total = $countStmt->fetchColumn();

            // Fetch
            $stmt = $pdo->prepare(
                "SELECT *, MATCH(title, company, location, description) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance
                 FROM internships
                 WHERE is_active = 1 AND (
                     MATCH(title, company, location, description) AGAINST (? IN NATURAL LANGUAGE MODE)
                     OR title LIKE ?
                     OR company LIKE ?
                     OR JSON_SEARCH(tags, 'one', ?) IS NOT NULL
                 )
                 ORDER BY relevance DESC, scraped_at DESC
                 LIMIT ? OFFSET ?"
            );
            $stmt->execute([$searchQuery, $searchQuery, $likeQ, $likeQ, $q, $limit, $offset]);
            $internships = $stmt->fetchAll();

            foreach ($internships as &$item) {
                $item['tags'] = json_decode($item['tags'] ?? '[]', true) ?: [];
                unset($item['relevance']);
            }

            jsonResponse([
                'success'     => true,
                'query'       => $q,
                'internships' => $internships,
                'pagination'  => [
                    'page'       => $page,
                    'limit'      => $limit,
                    'total'      => intval($total),
                    'totalPages' => ceil($total / $limit),
                ],
            ]);
            break;

        // ===== STATS =====
        case 'stats':
            $sourceStats = $pdo->query("SELECT source, COUNT(*) as count FROM internships WHERE is_active = 1 GROUP BY source ORDER BY count DESC")->fetchAll();
            $categoryStats = $pdo->query("SELECT category, COUNT(*) as count FROM internships WHERE is_active = 1 AND category != '' GROUP BY category ORDER BY count DESC")->fetchAll();
            $total = $pdo->query("SELECT COUNT(*) FROM internships WHERE is_active = 1")->fetchColumn();

            // Last scrape time
            $lastScrape = $pdo->query("SELECT MAX(updated_at) FROM internships")->fetchColumn();

            jsonResponse([
                'success'   => true,
                'total'     => intval($total),
                'sources'   => $sourceStats,
                'categories' => $categoryStats,
                'lastScrape' => $lastScrape,
            ]);
            break;

        // ===== AVAILABLE FILTERS =====
        case 'filters':
            $sources = $pdo->query("SELECT DISTINCT source FROM internships WHERE is_active = 1 ORDER BY source")->fetchAll(PDO::FETCH_COLUMN);
            $categories = $pdo->query("SELECT DISTINCT category FROM internships WHERE is_active = 1 AND category != '' ORDER BY category")->fetchAll(PDO::FETCH_COLUMN);

            jsonResponse([
                'success'    => true,
                'sources'    => $sources,
                'categories' => $categories,
            ]);
            break;

        // ===== TOGGLE BOOKMARK =====
        case 'bookmark':
            $userId = requireAuth();
            $internshipId = intval($_POST['internship_id'] ?? 0);

            if (!$internshipId) {
                jsonResponse(['success' => false, 'error' => 'Internship ID required'], 400);
            }

            // Check if already bookmarked
            $stmt = $pdo->prepare("SELECT id FROM internship_bookmarks WHERE user_id = ? AND internship_id = ?");
            $stmt->execute([$userId, $internshipId]);

            if ($stmt->fetch()) {
                // Remove bookmark
                $pdo->prepare("DELETE FROM internship_bookmarks WHERE user_id = ? AND internship_id = ?")->execute([$userId, $internshipId]);
                jsonResponse(['success' => true, 'bookmarked' => false]);
            } else {
                // Add bookmark
                $pdo->prepare("INSERT INTO internship_bookmarks (user_id, internship_id) VALUES (?, ?)")->execute([$userId, $internshipId]);
                jsonResponse(['success' => true, 'bookmarked' => true]);
            }
            break;

        // ===== GET USER'S BOOKMARKS =====
        case 'bookmarks':
            $userId = requireAuth();
            $page   = max(1, intval($_GET['page'] ?? 1));
            $limit  = min(100, max(1, intval($_GET['limit'] ?? 20)));
            $offset = ($page - 1) * $limit;

            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM internship_bookmarks WHERE user_id = ?");
            $countStmt->execute([$userId]);
            $total = $countStmt->fetchColumn();

            $stmt = $pdo->prepare(
                "SELECT i.*, ib.created_at as bookmarked_at
                 FROM internships i
                 INNER JOIN internship_bookmarks ib ON i.id = ib.internship_id
                 WHERE ib.user_id = ?
                 ORDER BY ib.created_at DESC
                 LIMIT ? OFFSET ?"
            );
            $stmt->execute([$userId, $limit, $offset]);
            $internships = $stmt->fetchAll();

            foreach ($internships as &$item) {
                $item['tags'] = json_decode($item['tags'] ?? '[]', true) ?: [];
                $item['bookmarked'] = true;
            }

            jsonResponse([
                'success'     => true,
                'internships' => $internships,
                'pagination'  => [
                    'page'       => $page,
                    'limit'      => $limit,
                    'total'      => intval($total),
                    'totalPages' => ceil($total / $limit),
                ],
            ]);
            break;

        default:
            jsonResponse(['success' => false, 'error' => 'Unknown action. Use: list, search, stats, filters, bookmark, bookmarks'], 400);
    }
} catch (Exception $e) {
    http_response_code(500);
    jsonResponse(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
}
