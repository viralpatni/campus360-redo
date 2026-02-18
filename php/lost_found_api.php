<?php
require_once __DIR__ . '/config.php';

// Ensure JSON response
header('Content-Type: application/json');

// Handle Action
$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    // ==========================================
    // GET ITEMS
    // ==========================================
    case 'get_items':
        try {
            $type = $_GET['type'] ?? 'lost'; // 'lost' or 'found'
            $search = trim($_GET['search'] ?? '');
            $myItems = isset($_GET['my_items']) && $_GET['my_items'] === 'true';
            
            $sql = "SELECT i.*, u.name as user_name, u.email as user_email 
                    FROM lost_found_items i 
                    JOIN users u ON i.user_id = u.id 
                    WHERE 1=1";
            
            $params = [];

            if ($type !== 'all') {
                $sql .= " AND i.type = ?";
                $params[] = $type;
            }

            if ($search) {
                $sql .= " AND (i.title LIKE ? OR i.description LIKE ? OR i.location LIKE ?)";
                $term = "%$search%";
                $params[] = $term;
                $params[] = $term;
                $params[] = $term;
            }

            if ($myItems) {
                if (!isset($_SESSION['user_id'])) {
                    jsonResponse(['success' => false, 'error' => 'Not logged in'], 401);
                }
                $sql .= " AND i.user_id = ?";
                $params[] = $_SESSION['user_id'];
            }

            $sql .= " ORDER BY i.status ASC, i.created_at DESC";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

            jsonResponse(['success' => true, 'items' => $items, 'current_user_id' => $_SESSION['user_id'] ?? null]);

        } catch (PDOException $e) {
            jsonResponse(['success' => false, 'error' => 'DB Error: ' . $e->getMessage()], 500);
        }
        break;

    // ==========================================
    // GET STATS
    // ==========================================
    case 'get_stats':
        try {
            $stmt = $pdo->query("SELECT type, COUNT(*) as count FROM lost_found_items GROUP BY type");
            $stats = $stmt->fetchAll(PDO::FETCH_KEY_PAIR); // ['lost'=>10, 'found'=>5]
            jsonResponse(['success' => true, 'stats' => $stats]);
        } catch (Exception $e) { 
            jsonResponse(['success'=>false, 'error'=>$e->getMessage()]); 
        }
        break;

    // ==========================================
    // CREATE ITEM
    // ==========================================
    case 'create_item':
        requireAuth(); // JSON response if fail
        $userId = $_SESSION['user_id'];

        $type = $_POST['type'] ?? 'lost';
        $title = trim($_POST['title'] ?? '');
        $desc = trim($_POST['description'] ?? '');
        $location = trim($_POST['location'] ?? '');
        $date = $_POST['date'] ?? date('Y-m-d');
        $contact = trim($_POST['contact_info'] ?? '');
        $imagePath = $_POST['image_path'] ?? null;

        if (!$title || !$type) {
            jsonResponse(['success' => false, 'error' => 'Title and Type are required'], 400);
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO lost_found_items (user_id, type, title, description, location, event_date, contact_info, image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$userId, $type, $title, $desc, $location, $date, $contact, $imagePath]);
            
            jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
        } catch (PDOException $e) {
            jsonResponse(['success' => false, 'error' => 'DB Error: ' . $e->getMessage()], 500);
        }
        break;

    // ==========================================
    // RESOLVE / DELETE ITEM
    // ==========================================
    case 'update_status':
        requireAuth();
        $userId = $_SESSION['user_id'];
        $itemId = $_POST['id'] ?? null;
        $status = $_POST['status'] ?? 'resolved'; // 'resolved' or 'open'

        if (!$itemId) jsonResponse(['success' => false, 'error' => 'Missing ID'], 400);

        try {
            // Check ownership
            $stmt = $pdo->prepare("SELECT user_id FROM lost_found_items WHERE id = ?");
            $stmt->execute([$itemId]);
            $item = $stmt->fetch();

            if (!$item) jsonResponse(['success' => false, 'error' => 'Item not found'], 404);
            
            if ($item['user_id'] != $userId) {
                jsonResponse(['success' => false, 'error' => 'Unauthorized'], 403);
            }

            $update = $pdo->prepare("UPDATE lost_found_items SET status = ? WHERE id = ?");
            $update->execute([$status, $itemId]);

            jsonResponse(['success' => true]);
        } catch (PDOException $e) {
            jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
        }
        break;
        
    case 'delete_item':
        requireAuth();
        $userId = $_SESSION['user_id'];
        $itemId = $_POST['id'] ?? null;

        if (!$itemId) jsonResponse(['success' => false, 'error' => 'Missing ID'], 400);

        try {
            // Check ownership
            $stmt = $pdo->prepare("SELECT user_id FROM lost_found_items WHERE id = ?");
            $stmt->execute([$itemId]);
            $item = $stmt->fetch();

            if (!$item) jsonResponse(['success' => false, 'error' => 'Item not found'], 404);
            
            if ($item['user_id'] != $userId) { 
                jsonResponse(['success' => false, 'error' => 'Unauthorized'], 403);
            }

            $del = $pdo->prepare("DELETE FROM lost_found_items WHERE id = ?");
            $del->execute([$itemId]);

            jsonResponse(['success' => true]);
        } catch (PDOException $e) {
            jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
        }
        break;

    default:
        jsonResponse(['success' => false, 'error' => 'Invalid action'], 400);
}
?>
