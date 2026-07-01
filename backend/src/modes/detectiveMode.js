"use strict";

const { createEmptyBoard, computeAdjacent, getSafeZone } = require("../core/board");
const { isInside, keyOf }     = require("../utils/helpers");
const { isFullySolvable }     = require("../core/solver");

const MAX_ATTEMPTS = 200;

// ─── Backtracking + CSP ───
// Sinh board cho Detective Mode: đặt virus ngẫu nhiên (loại trừ safe zone),
// verify bằng CSP solver (isFullySolvable); nếu không solvable thì backtrack
// toàn cục (re-shuffle lại toàn bộ layout) và thử lại, tối đa MAX_ATTEMPTS lần;
// cứ 20 lần thất bại thì giảm 1 virus để nới lỏng constraint, đảm bảo không crash.
function generateDetectiveBoard(game, firstRow, firstCol) {
  const { rows, cols } = game;

  const protectedCells = new Set();
  if (
    game.safeFirstClick &&
    Number.isInteger(firstRow) && Number.isInteger(firstCol) &&
    isInside(rows, cols, firstRow, firstCol)
  ) {
    for (const key of getSafeZone(rows, cols, firstRow, firstCol, game.viruses)) {
      protectedCells.add(key);
    }
  }

  const baseCandidates = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!protectedCells.has(keyOf(r, c))) baseCandidates.push([r, c]);

  let board;
  let virusTarget = game.viruses;
  let attempt = 0;
  let solved  = false;

  while (attempt < MAX_ATTEMPTS && !solved) {
    attempt++;

    board = createEmptyBoard(rows, cols);

    const candidates = [...baseCandidates];
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const placeCount = Math.min(virusTarget, candidates.length);
    for (let i = 0; i < placeCount; i++) {
      const [r, c] = candidates[i];
      board[r][c].virus = true;
    }

    computeAdjacent(board, rows, cols);

    const checkRow = Number.isInteger(firstRow) ? firstRow : 0;
    const checkCol = Number.isInteger(firstCol) ? firstCol : 0;
    solved = isFullySolvable(board, rows, cols, checkRow, checkCol);

    if (!solved && attempt % 20 === 0 && virusTarget > 1) {
      virusTarget--;
    }
  }

  if (!solved) {
    throw new Error(
      `Detective: không thể sinh board fully-solvable sau ${MAX_ATTEMPTS} lần thử ` +
      `(rows=${rows}, cols=${cols})`
    );
  }

  game.board   = board;
  game.viruses = virusTarget;
}
// ─── Hết Backtracking + CSP ───

module.exports = { generateDetectiveBoard };