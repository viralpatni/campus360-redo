-- ============================================
-- Campus360 Database Schema
-- Run this in phpMyAdmin or MySQL CLI
-- ============================================

CREATE DATABASE IF NOT EXISTS campus360
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE campus360;

-- ----- Users -----
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  username    VARCHAR(50)   NOT NULL UNIQUE,
  regno       VARCHAR(20)   NOT NULL UNIQUE,
  email       VARCHAR(150)  NOT NULL UNIQUE,
  password    VARCHAR(255)  NOT NULL,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----- Chat Invites -----
CREATE TABLE IF NOT EXISTS chat_invites (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  from_user   INT           NOT NULL,
  to_user     INT           NOT NULL,
  status      ENUM('pending','accepted','rejected') DEFAULT 'pending',
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (from_user) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user)   REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_invite (from_user, to_user)
) ENGINE=InnoDB;

-- ----- Conversations (direct + group) -----
CREATE TABLE IF NOT EXISTS conversations (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  type        ENUM('direct','group') NOT NULL DEFAULT 'direct',
  name        VARCHAR(100)  DEFAULT NULL,
  created_by  INT           NOT NULL,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----- Conversation Members -----
CREATE TABLE IF NOT EXISTS conversation_members (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  user_id         INT NOT NULL,
  joined_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)         REFERENCES users(id)          ON DELETE CASCADE,
  UNIQUE KEY unique_member (conversation_id, user_id)
) ENGINE=InnoDB;

-- ----- Messages -----
CREATE TABLE IF NOT EXISTS messages (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id       INT NOT NULL,
  message_type    ENUM('text','image','video','audio') DEFAULT 'text',
  content         TEXT,
  file_path       VARCHAR(500) DEFAULT NULL,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id)       REFERENCES users(id)          ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----- Indexes for performance -----
CREATE INDEX idx_messages_conv   ON messages(conversation_id, created_at);
CREATE INDEX idx_invites_to      ON chat_invites(to_user, status);
CREATE INDEX idx_invites_from    ON chat_invites(from_user, status);
CREATE INDEX idx_conv_members    ON conversation_members(user_id);
