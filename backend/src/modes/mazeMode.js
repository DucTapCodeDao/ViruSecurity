"use strict";

const { createEmptyBoard, computeAdjacent }               = require("../core/board");
const { isInside, keyOf, httpError }                      = require("../utils/helpers");
const { MAZE_SAMPLE_BLOCKS }                              = require("./mazeSampleBlocks");

const CROSS_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

const MACRO_SIZE         = 3;
const MAX_BOARD_ATTEMPTS = 300;

// Trả về số nguyên ngẫu nhiên trong khoảng [min, max] (cả 2 đầu).
function randomInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

// Xoay 1 block 90° theo chiều kim đồng hồ quanh tâm khối 3x3.
function rotateCW(cells) {
  return cells.map(([r, c]) => [c, 2 - r]);
}

// Lật ngang 1 block (đối xứng trục dọc).
function mirrorH(cells) {
  return cells.map(([r, c]) => [r, 2 - c]);
}

// Áp dụng 1 phép biến đổi ngẫu nhiên (xoay 0-3 lần + lật có/không) lên block.
function applyRandomTransform(cells) {
  let result = cells;
  const rotations = randomInt(0, 3);
  for (let i = 0; i < rotations; i++) result = rotateCW(result);
  if (Math.random() < 0.5) result = mirrorH(result);
  return result;
}

// Chọn ngẫu nhiên 1 block gốc và trả về 1 biến thể ngẫu nhiên của nó.
function randomBlockVariant() {
  const base = MAZE_SAMPLE_BLOCKS[randomInt(0, MAZE_SAMPLE_BLOCKS.length - 1)];
  return applyRandomTransform(base);
}

// Sinh đủ 8 biến thể (4 góc xoay x 2 lật) của 1 block.
function allVariantsOf(baseCells) {
  const variants = [];
  let rotated = baseCells;
  for (let r = 0; r < 4; r++) {
    variants.push(rotated);
    variants.push(mirrorH(rotated));
    rotated = rotateCW(rotated);
  }
  return variants;
}

// Kiểm tra ô (localR, localC) có virus trong block hay không.
function cellHasVirus(cells, localR, localC) {
  return cells.some(([r, c]) => r === localR && c === localC);
}

// Trả về 1 biến thể ngẫu nhiên (trong toàn bộ 27 block x 8 biến thể) sao cho
// mọi ô trong localCells đều trống.
function randomVariantWithEmptyCells(localCells) {
  const candidates = [];
  for (const base of MAZE_SAMPLE_BLOCKS) {
    for (const variant of allVariantsOf(base)) {
      const allEmpty = localCells.every(([lr, lc]) => !cellHasVirus(variant, lr, lc));
      if (allEmpty) candidates.push(variant);
    }
  }
  if (candidates.length === 0) return null;
  return candidates[randomInt(0, candidates.length - 1)];
}

// Chia board thành lưới macro-cell (mỗi macro-cell đúng MACRO_SIZE x MACRO_SIZE ô).
function buildMacroGrid(rows, cols) {
  if (rows % MACRO_SIZE !== 0 || cols % MACRO_SIZE !== 0) {
    throw httpError(
      500,
      `Maze: rows/cols (${rows}x${cols}) phải chia hết cho ${MACRO_SIZE} để ghép sample block.`
    );
  }
  return { macroRows: rows / MACRO_SIZE, macroCols: cols / MACRO_SIZE };
}

// Đặt nguyên vẹn 1 block vào macro-cell tại gốc (originR, originC).
function placeBlockAt(board, cells, originR, originC) {
  if (!cells) return -1;
  let placedCount = 0;
  for (const [dr, dc] of cells) {
    const r = originR + dr, c = originC + dc;
    board[r][c].virus = true;
    placedCount++;
  }
  return placedCount;
}

// ─── Dijkstra + A* ───
// Heuristic Manhattan cho A*.
function heuristic(r, c, endR, endC) {
  return Math.abs(r - endR) + Math.abs(c - endC);
}

// Tìm đường đi an toàn (tránh virus) từ start đến end bằng A*.
function findPathAStar(board, rows, cols, start, end) {
  const [startR, startC] = start;
  const [endR, endC]     = end;
  if (board[startR][startC].virus || board[endR][endC].virus) return false;

  const startKey = keyOf(startR, startC);
  const endKey   = keyOf(endR, endC);

  const gScore = new Map([[startKey, 0]]);
  const open   = [[heuristic(startR, startC, endR, endC), startR, startC]];
  const closed = new Set();

  while (open.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) if (open[i][0] < open[bestIdx][0]) bestIdx = i;
    const [, r, c] = open.splice(bestIdx, 1)[0];
    const key = keyOf(r, c);

    if (key === endKey) return true;
    if (closed.has(key)) continue;
    closed.add(key);

    for (const [dr, dc] of CROSS_DIRS) {
      const nr = r + dr, nc = c + dc, nkey = keyOf(nr, nc);
      if (!isInside(rows, cols, nr, nc) || board[nr][nc].virus || closed.has(nkey)) continue;

      const tentativeG = gScore.get(key) + 1;
      if (gScore.has(nkey) && tentativeG >= gScore.get(nkey)) continue;

      gScore.set(nkey, tentativeG);
      open.push([tentativeG + heuristic(nr, nc, endR, endC), nr, nc]);
    }
  }

  return false;
}
// ─── Hết Dijkstra + A* ───

// Quy đổi toạ độ thật (r, c) sang (macroRow, macroCol, localRow, localCol).
function locateInMacroGrid(r, c) {
  return {
    macroRow: Math.floor(r / MACRO_SIZE),
    macroCol: Math.floor(c / MACRO_SIZE),
    localRow: r % MACRO_SIZE,
    localCol: c % MACRO_SIZE,
  };
}

// Ghép mọi macro-cell với 1 block (xoay/lật ngẫu nhiên), áp dụng các ràng buộc
// requiredEmpty (ô phải trống) cho macro-cell tương ứng.
function buildBoardFromBlocks(rows, cols, grid, requiredEmpty) {
  const board = createEmptyBoard(rows, cols);
  let totalVirusPlaced = 0;
  let failed = false;

  const constraintsByMacro = new Map();
  for (const req of requiredEmpty) {
    const key = `${req.macroRow},${req.macroCol}`;
    if (!constraintsByMacro.has(key)) constraintsByMacro.set(key, []);
    constraintsByMacro.get(key).push([req.localRow, req.localCol]);
  }

  for (let mr = 0; mr < grid.macroRows; mr++) {
    for (let mc = 0; mc < grid.macroCols; mc++) {
      const originR = mr * MACRO_SIZE;
      const originC = mc * MACRO_SIZE;
      const key = `${mr},${mc}`;
      const constraints = constraintsByMacro.get(key);

      const variant = constraints
        ? randomVariantWithEmptyCells(constraints)
        : randomBlockVariant();

      const placed = placeBlockAt(board, variant, originR, originC);
      if (placed === -1) { failed = true; continue; }
      totalVirusPlaced += placed;
    }
  }

  computeAdjacent(board, rows, cols);
  return { board, totalVirusPlaced, failed };
}

// Sinh board cho Maze Mode: ghép các macro-cell từ sample block (xoay/lật ngẫu
// nhiên), đảm bảo tồn tại đường đi an toàn (0,0) → (rows-1, cols-1) qua A*,
// retry toàn bộ layout nếu chưa thoả.
function generateMazeBoard(game, firstRow, firstCol) {
  const { rows, cols } = game;
  const start = [0, 0];
  const end   = [rows - 1, cols - 1];

  const grid = buildMacroGrid(rows, cols);

  const requiredEmpty = [
    { ...locateInMacroGrid(start[0], start[1]) },
    { ...locateInMacroGrid(end[0], end[1]) },
  ];

  if (
    game.safeFirstClick &&
    Number.isInteger(firstRow) && Number.isInteger(firstCol) &&
    isInside(rows, cols, firstRow, firstCol)
  ) {
    requiredEmpty.push({ ...locateInMacroGrid(firstRow, firstCol) });
  }

  for (let attempt = 0; attempt < MAX_BOARD_ATTEMPTS; attempt++) {
    const candidate = buildBoardFromBlocks(rows, cols, grid, requiredEmpty);

    if (candidate.failed) continue;
    if (!findPathAStar(candidate.board, rows, cols, start, end)) continue;

    game.board   = candidate.board;
    game.viruses = candidate.totalVirusPlaced;
    return;
  }

  throw httpError(
    400,
    `Maze: không thể ghép sample block thành board có đường đi sau ${MAX_BOARD_ATTEMPTS} lần thử ` +
    `(rows=${rows}, cols=${cols}). Hãy kiểm tra lại bộ sample block trong mazeSampleBlocks.js.`
  );
}

module.exports = { generateMazeBoard, findPathAStar, MACRO_SIZE };