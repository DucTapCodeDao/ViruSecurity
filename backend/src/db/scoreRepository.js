"use strict";

const { pool }       = require("./connection");
const { httpError }  = require("../utils/helpers");

// Lưu 1 điểm số khi người chơi thắng (gọi từ routes.js sau khi verify
// game.status === 'won'); timeMs tính từ game.createdAt → game.endedAt.
async function saveScore({ playerName, gameId, mode, difficulty, timeMs, moves }) {

  if (!playerName || typeof playerName !== "string" || playerName.trim() === "")
    throw httpError(400, "playerName is required");

  if (timeMs <= 0 || !Number.isInteger(timeMs))
    throw httpError(400, "timeMs must be a positive integer");

  const [result] = await pool.execute(
    `INSERT INTO scores (player_name, game_id, mode, difficulty, time_ms, moves)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [playerName.trim(), gameId, mode, difficulty, timeMs, moves]
  );

  return { id: result.insertId, playerName, mode, difficulty, timeMs, moves };
}

// Lấy toàn bộ lịch sử thắng của 1 người chơi, mới nhất trước (dùng cho "lịch
// sử của tôi" trên frontend).
async function getScoresByPlayer(playerName) {
  const [rows] = await pool.execute(
    `SELECT id, mode, difficulty, time_ms, moves, created_at
     FROM   scores
     WHERE  player_name = ?
     ORDER  BY created_at DESC`,
    [playerName]
  );
  return rows;
}

// Lấy điểm tốt nhất (time_ms nhỏ nhất) của 1 người ở 1 mode+difficulty cụ
// thể, dùng để so sánh khi vừa thắng ("Bạn đã phá kỷ lục của mình!").
async function getBestScore(playerName, mode, difficulty) {
  const [rows] = await pool.execute(
    `SELECT MIN(time_ms) AS best_time, MIN(moves) AS best_moves
     FROM   scores
     WHERE  player_name = ? AND mode = ? AND difficulty = ?`,
    [playerName, mode, difficulty]
  );
  return rows[0];   // { best_time: number | null, best_moves: number | null }
}

module.exports = { saveScore, getScoresByPlayer, getBestScore };