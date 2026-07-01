-- ViruSecurity Database Schema
-- Chạy: mysql -u root -p virusecurity < database/schema.sql

CREATE DATABASE IF NOT EXISTS virusecurity
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE virusecurity;

-- Lưu mỗi lượt thắng; chỉ insert khi game.status = 'won'.
CREATE TABLE IF NOT EXISTS scores (
  id          INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  player_name VARCHAR(50)      NOT NULL,
  mode        ENUM('detective','maze','virusZone') NOT NULL,
  difficulty  ENUM('easy','medium','hard')         NOT NULL,
  time_ms     INT UNSIGNED     NOT NULL,
  moves       INT UNSIGNED     NOT NULL,
  created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- game_id để đối chiếu, không FK vì game lưu in-memory
  game_id     VARCHAR(24)      NOT NULL
);

-- Index cho leaderboard query (lọc mode+difficulty, sắp theo time_ms)
CREATE INDEX idx_leaderboard ON scores (mode, difficulty, time_ms ASC);

-- Index cho tra cứu lịch sử theo người chơi
CREATE INDEX idx_player ON scores (player_name, mode);