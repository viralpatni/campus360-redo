<?php
// Campus360 - Database Migration: Add event_date_end
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain');

try {
    echo "Checking events table structure...\n";
    
    // Check if column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM events LIKE 'event_date_end'");
    $exists = $stmt->fetch();

    if ($exists) {
        echo "Column 'event_date_end' already exists. No action needed.\n";
    } else {
        echo "Adding 'event_date_end' column...\n";
        $pdo->exec("ALTER TABLE events ADD COLUMN event_date_end DATE DEFAULT NULL AFTER event_date");
        echo "Success: Column added!\n";
    }

    echo "Migration complete.";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
