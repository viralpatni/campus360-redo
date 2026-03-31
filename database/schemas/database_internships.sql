-- ============================================
-- Campus360 — Internships Database Schema
-- Run AFTER database.sql
-- ============================================

USE campus360;

-- Internship listings (scraped from multiple sources)
CREATE TABLE IF NOT EXISTS internships (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(500) NOT NULL,
    company         VARCHAR(300) NOT NULL DEFAULT 'Unknown',
    location        VARCHAR(300) DEFAULT 'Not specified',
    stipend         VARCHAR(200) DEFAULT 'Not disclosed',
    duration        VARCHAR(100) DEFAULT '',
    link            VARCHAR(1000) NOT NULL,
    source          VARCHAR(50) NOT NULL DEFAULT 'internshala',
    category        VARCHAR(100) DEFAULT '',
    tags            JSON DEFAULT NULL,
    apply_by        VARCHAR(100) DEFAULT '',
    start_date      VARCHAR(100) DEFAULT '',
    applicants      VARCHAR(100) DEFAULT '',
    description     TEXT DEFAULT NULL,
    skills          VARCHAR(1000) DEFAULT '',
    target_batch    VARCHAR(200) DEFAULT '',
    deadline        VARCHAR(200) DEFAULT '',
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    scraped_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_link (link(500))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User bookmarks for internships
CREATE TABLE IF NOT EXISTS internship_bookmarks (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    internship_id   INT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE,
    UNIQUE KEY unique_bookmark (user_id, internship_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Full-text index for search
ALTER TABLE internships ADD FULLTEXT INDEX ft_internships (title, company, location, description);
