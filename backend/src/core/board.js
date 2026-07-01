"use strict";

const { isInside, keyOf, DIRS } = require("../utils/helpers");

// Tạo board rows x cols toàn ô trống (chưa có virus, chưa revealed/warned/disabled).
function createEmptyBoard(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      virus:    false,
      adjacent: 0,
      revealed: false,
      warned:   false,
      disabled: false,
    }))
  );
}

// Trả về Set<keyOf> các ô an toàn 3x3 quanh (row, col); thu nhỏ về 1 ô nếu
// vùng an toàn chiếm quá nhiều chỗ khiến không đủ ô trống để đặt virus.
function getSafeZone(rows, cols, row, col, viruses) {
  const zone = new Set();

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = row + dr;
      const nc = col + dc;
      if (isInside(rows, cols, nr, nc)) zone.add(keyOf(nr, nc));
    }
  }

  if (rows * cols - zone.size < viruses) {
    return new Set([keyOf(row, col)]);
  }

  return zone;
}

// Tính số virus kề cạnh cho mỗi ô trống (bỏ qua ô virus và ô disabled).
function computeAdjacent(board, rows, cols) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].virus || board[r][c].disabled) continue;

      let count = 0;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (isInside(rows, cols, nr, nc) && board[nr][nc].virus) count++;
      }
      board[r][c].adjacent = count;
    }
  }
}

// Sinh board kiểu classic: đặt virus ngẫu nhiên (Fisher-Yates) ngoài safe zone
// quanh first click. Dùng làm base cho Detective Mode và fallback cho các mode khác.
function generateClassicBoard(game, firstRow, firstCol) {
  const board   = createEmptyBoard(game.rows, game.cols);
  const safeZone = new Set();

  if (
    game.safeFirstClick &&
    Number.isInteger(firstRow) &&
    Number.isInteger(firstCol) &&
    isInside(game.rows, game.cols, firstRow, firstCol)
  ) {
    for (const key of getSafeZone(game.rows, game.cols, firstRow, firstCol, game.viruses)) {
      safeZone.add(key);
    }
  }

  const candidates = [];
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      if (!safeZone.has(keyOf(r, c))) candidates.push([r, c]);
    }
  }

  if (candidates.length < game.viruses) {
    throw new Error("Not enough available cells to place viruses");
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  for (let i = 0; i < game.viruses; i++) {
    const [r, c] = candidates[i];
    board[r][c].virus = true;
  }

  computeAdjacent(board, game.rows, game.cols);
  game.board = board;
}

// Điểm vào duy nhất từ gameLogic.js: gọi đúng generator theo game.mode (lazy
// require để tránh circular dependency với các mode file), set game.board.
function generateBoard(game, firstRow = null, firstCol = null) {
  if (game.boardGenerated) return;

  switch (game.mode) {
    case "detective": {
      const { generateDetectiveBoard } = require("../modes/detectiveMode");
      generateDetectiveBoard(game, firstRow, firstCol);
      break;
    }
    case "maze": {
      const { generateMazeBoard } = require("../modes/mazeMode");
      generateMazeBoard(game, firstRow, firstCol);
      break;
    }
    case "virusZone": {
      const { generateVirusZoneBoard } = require("../modes/virusZoneMode");
      generateVirusZoneBoard(game, firstRow, firstCol);
      break;
    }
    default:
      throw new Error(`Unknown game mode: "${game.mode}"`);
  }

  game.boardGenerated = true;
}

module.exports = {
  createEmptyBoard,
  getSafeZone,
  computeAdjacent,
  generateClassicBoard,
  generateBoard,
};