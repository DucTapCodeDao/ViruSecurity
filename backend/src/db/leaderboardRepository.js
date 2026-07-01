"use strict";

const { pool }      = require("./connection");
const { httpError } = require("../utils/helpers");

const VALID_MODES        = ["detective", "maze", "virusZone"];
const VALID_DIFFICULTIES = ["easy", "medium", "hard"];

// Lấy top N điểm tốt nhất (mỗi người chỉ tính 1 lần - điểm best_time của
// chính họ) theo mode + difficulty, sắp theo time_ms rồi moves tăng dần.
async function getTopScores(mode, difficulty = "easy", limit = 10) {
  if (!VALID_MODES.includes(mode))
    throw httpError(400, `mode phải là một trong: ${VALID_MODES.join(", ")}`);

  if (!VALID_DIFFICULTIES.includes(difficulty))
    throw httpError(400, `difficulty phải là một trong: ${VALID_DIFFICULTIES.join(", ")}`);

  // Ép kiểu integer, nhúng thẳng vào SQL (an toàn vì đã validate là số nguyên 1-100)
  const cap = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  const [rows] = await pool.execute(
    `SELECT  s.player_name,
             s.time_ms,
             s.moves,
             s.created_at
     FROM    scores s
     INNER JOIN (
       SELECT   player_name,
                MIN(time_ms) AS best_time
       FROM     scores
       WHERE    mode = ? AND difficulty = ?
       GROUP BY player_name
     ) best
       ON  s.player_name = best.player_name
       AND s.time_ms     = best.best_time
     WHERE   s.mode = ? AND s.difficulty = ?
     ORDER BY s.time_ms ASC, s.moves ASC
     LIMIT ${cap}`,
    [mode, difficulty, mode, difficulty]
  );

  return rows.map((row, i) => ({ rank: i + 1, ...row }));
}

// Tính thứ hạng của 1 người chơi (theo best_time) trong mode + difficulty,
// trả về null nếu người đó chưa có điểm nào.
async function getRank(playerName, mode, difficulty = "easy") {
  if (!VALID_MODES.includes(mode))
    throw httpError(400, `mode phải là một trong: ${VALID_MODES.join(", ")}`);

  const [check] = await pool.execute(
    `SELECT MIN(time_ms) AS best_time
     FROM   scores
     WHERE  player_name = ? AND mode = ? AND difficulty = ?`,
    [playerName, mode, difficulty]
  );

  if (!check[0] || check[0].best_time === null) return null;

  const [countRows] = await pool.execute(
    `SELECT COUNT(DISTINCT player_name) AS better_count
     FROM   scores
     WHERE  mode = ? AND difficulty = ?
       AND  time_ms < ?`,
    [mode, difficulty, check[0].best_time]
  );

  return Number(countRows[0].better_count) + 1;
}

module.exports = { getTopScores, getRank };