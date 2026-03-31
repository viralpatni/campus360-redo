-- ============================================
-- Campus360 Forum Schema (follows, posts, likes, comments)
-- Run this AFTER database.sql
-- ============================================

USE campus360;

-- ----- Follows (follow request system) -----
CREATE TABLE IF NOT EXISTS follows (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  follower_id   INT NOT NULL,
  following_id  INT NOT NULL,
  status        ENUM('pending','accepted','rejected') DEFAULT 'pending',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (follower_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_follow (follower_id, following_id)
) ENGINE=InnoDB;

-- ----- Posts (public or private) -----
CREATE TABLE IF NOT EXISTS posts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  content     TEXT NOT NULL,
  image_path  VARCHAR(500) DEFAULT NULL,
  visibility  ENUM('public','private') DEFAULT 'public',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----- Post Likes -----
CREATE TABLE IF NOT EXISTS post_likes (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  post_id   INT NOT NULL,
  user_id   INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_like (post_id, user_id)
) ENGINE=InnoDB;

-- ----- Post Comments -----
CREATE TABLE IF NOT EXISTS post_comments (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  post_id   INT NOT NULL,
  user_id   INT NOT NULL,
  content   TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----- Indexes -----
CREATE INDEX idx_posts_user    ON posts(user_id, created_at);
CREATE INDEX idx_posts_vis     ON posts(visibility, created_at);
CREATE INDEX idx_follows_er    ON follows(follower_id, status);
CREATE INDEX idx_follows_ing   ON follows(following_id, status);
CREATE INDEX idx_comments_post ON post_comments(post_id, created_at);
