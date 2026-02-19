-- ============================================
-- Campus360 Lost & Found Schema
-- Run this AFTER database.sql
-- ============================================

USE campus360;

CREATE TABLE IF NOT EXISTS lost_found_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    type        ENUM('lost', 'found') NOT NULL,
    title       VARCHAR(100) NOT NULL,
    description TEXT,
    location    VARCHAR(100),
    event_date  DATE,
    image_path  VARCHAR(255),
    status      ENUM('open', 'resolved') DEFAULT 'open',
    contact_info VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
