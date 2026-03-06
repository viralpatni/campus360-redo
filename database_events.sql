-- ============================================
-- Campus360 Club Events Schema
-- Run this AFTER database.sql & database_forum.sql
-- ============================================

USE campus360;

-- ----- Extend users table -----
ALTER TABLE users
  ADD COLUMN account_type ENUM('student','club','admin') NOT NULL DEFAULT 'student' AFTER password,
  ADD COLUMN is_approved  TINYINT(1) NOT NULL DEFAULT 1 AFTER account_type;

-- ----- Club Profiles (extra info for club accounts) -----
CREATE TABLE IF NOT EXISTS club_profiles (
  user_id       INT PRIMARY KEY,
  description   TEXT,
  category      ENUM('tech','cultural','sports','social','academic','other') NOT NULL DEFAULT 'other',
  logo_path     VARCHAR(500) DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----- Events -----
CREATE TABLE IF NOT EXISTS events (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  club_id           INT NOT NULL,
  title             VARCHAR(200) NOT NULL,
  description       TEXT,
  event_date        DATE NOT NULL,
  event_time_start  TIME NOT NULL,
  event_time_end    TIME DEFAULT NULL,
  venue             VARCHAR(200),
  poster_path       VARCHAR(500) DEFAULT NULL,
  registration_link VARCHAR(500) DEFAULT NULL,
  max_capacity      INT DEFAULT NULL,
  od_provided       TINYINT(1) NOT NULL DEFAULT 0,
  od_time_start     TIME DEFAULT NULL,
  od_time_end       TIME DEFAULT NULL,
  status            ENUM('upcoming','live','completed','cancelled') NOT NULL DEFAULT 'upcoming',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----- Event RSVPs -----
CREATE TABLE IF NOT EXISTS event_rsvps (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  event_id    INT NOT NULL,
  user_id     INT NOT NULL,
  status      ENUM('interested','going') NOT NULL DEFAULT 'interested',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_rsvp (event_id, user_id)
) ENGINE=InnoDB;

-- ----- Club Follows (students follow clubs) -----
CREATE TABLE IF NOT EXISTS club_follows (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  club_id     INT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (club_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_club_follow (user_id, club_id)
) ENGINE=InnoDB;

-- ----- Indexes -----
CREATE INDEX idx_events_date       ON events(event_date, status);
CREATE INDEX idx_events_club       ON events(club_id);
CREATE INDEX idx_rsvps_event       ON event_rsvps(event_id);
CREATE INDEX idx_rsvps_user        ON event_rsvps(user_id);
CREATE INDEX idx_club_follows_user ON club_follows(user_id);
CREATE INDEX idx_club_follows_club ON club_follows(club_id);
