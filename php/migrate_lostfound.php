<?php
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain');

try {
    echo "Checking lost_found_items table...\n";
    
    $sql = "CREATE TABLE IF NOT EXISTS lost_found_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type ENUM('lost', 'found') NOT NULL,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        location VARCHAR(100),
        event_date DATE,
        image_path VARCHAR(255),
        status ENUM('open', 'resolved') DEFAULT 'open',
        contact_info VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )";

    $pdo->exec($sql);
    echo "Success: Table 'lost_found_items' is ready.\n";

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
