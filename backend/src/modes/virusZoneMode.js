"use strict";

const { createEmptyBoard, computeAdjacent } = require("../core/board");
const { isInside, keyOf, DIRS }             = require("../utils/helpers");

// Sinh board cho Virus Zone Mode: tạo 1 vùng hình dạng ngẫu nhiên (shape) bằng
// DFS, sau đó đặt virus bên trong vùng đó, tránh safe zone quanh first click.
function generateVirusZoneBoard(game, firstRow, firstCol) {
  const board = createEmptyBoard(game.rows, game.cols);

  for (let r = 0; r < game.rows; r++)
    for (let c = 0; c < game.cols; c++)
      board[r][c].disabled = true;

  // ─── DFS random từ seed ngẫu nhiên để tạo shape ───
  const seedR = Math.floor(Math.random() * game.rows);
  const seedC = Math.floor(Math.random() * game.cols);

  const shapeCells = [];
  const visited    = new Set();
  const stack      = [[seedR, seedC]];

  while (stack.length > 0 && shapeCells.length < game.targetCells) {
    const idx    = Math.floor(Math.random() * stack.length);
    const [r, c] = stack.splice(idx, 1)[0];
    const key    = keyOf(r, c);

    if (visited.has(key)) continue;
    visited.add(key);

    board[r][c].disabled = false;
    shapeCells.push([r, c]);

    const shuffled = [...DIRS].sort(() => Math.random() - 0.5);
    for (const [dr, dc] of shuffled) {
      const nr = r + dr, nc = c + dc;
      if (isInside(game.rows, game.cols, nr, nc) && !visited.has(keyOf(nr, nc)))
        stack.push([nr, nc]);
    }
  }
  // ─── Hết DFS ───

  const safeZone = new Set();
  if (
    game.safeFirstClick &&
    Number.isInteger(firstRow) &&
    Number.isInteger(firstCol)
  ) {
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const nr = firstRow + dr, nc = firstCol + dc;
        if (isInside(game.rows, game.cols, nr, nc) && !board[nr][nc].disabled)
          safeZone.add(keyOf(nr, nc));
      }
  }

  const candidates = shapeCells
    .filter(([r, c]) => !safeZone.has(keyOf(r, c)))
    .sort(() => Math.random() - 0.5);

  const count = Math.min(game.viruses, candidates.length - 1);
  for (let i = 0; i < count; i++) {
    const [r, c] = candidates[i];
    board[r][c].virus = true;
  }

  computeAdjacent(board, game.rows, game.cols);
  game.board = board;
}

module.exports = { generateVirusZoneBoard };