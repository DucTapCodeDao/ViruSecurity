"use strict";

const { isInside, keyOf, DIRS, httpError, nowIso } = require("../utils/helpers");
const { generateBoard }                             = require("./board");

// Kiểm tra (row, col) có hợp lệ trong board của game không, throw nếu sai.
function validatePosition(game, row, col) {
  if (!Number.isInteger(row) || !Number.isInteger(col))
    throw httpError(400, "row and col must be integers");

  if (!isInside(game.rows, game.cols, row, col))
    throw httpError(400, "row and col are outside the board");
}

// Mở (flood-fill) các ô an toàn liên tiếp bắt đầu từ (startRow, startCol) bằng
// BFS, dừng lan ở ô có adjacent > 0; bỏ qua ô disabled/virus/warned/revealed.
function revealSafeArea(game, startRow, startCol) {
  const revealed = [];
  const queue    = [[startRow, startCol]];
  const visited  = new Set();

  while (queue.length > 0) {
    const [row, col] = queue.shift();
    const key        = keyOf(row, col);

    if (visited.has(key)) continue;
    visited.add(key);

    if (!isInside(game.rows, game.cols, row, col)) continue;

    const cell = game.board[row][col];

    if (cell.disabled || cell.virus || cell.warned || cell.revealed) continue;

    cell.revealed = true;
    game.revealedSafeCount++;

    revealed.push({ row, col, value: cell.adjacent });

    if (cell.adjacent === 0) {
      for (const [dr, dc] of DIRS) {
        const nr = row + dr, nc = col + dc;
        if (isInside(game.rows, game.cols, nr, nc)) queue.push([nr, nc]);
      }
    }
  }

  return revealed;
}

// Riêng cho Maze Mode: ở lần reveal đầu tiên của game, mở toàn bộ ô không phải
// virus trong macro-cell (khối 3x3) chứa ô vừa click, làm gợi ý ban đầu cho
// người chơi (kể cả ô có adjacent > 0 mà flood-fill chuẩn không tự mở tới).
function revealMazeFirstClickHint(game, clickRow, clickCol) {
  const { MACRO_SIZE } = require("../modes/mazeMode");

  const macroRow = Math.floor(clickRow / MACRO_SIZE);
  const macroCol = Math.floor(clickCol / MACRO_SIZE);
  const originR  = macroRow * MACRO_SIZE;
  const originC  = macroCol * MACRO_SIZE;

  const revealedExtra = [];

  for (let r = originR; r < originR + MACRO_SIZE && r < game.rows; r++) {
    for (let c = originC; c < originC + MACRO_SIZE && c < game.cols; c++) {
      const cell = game.board[r][c];
      if (cell.virus || cell.warned || cell.revealed) continue;

      cell.revealed = true;
      game.revealedSafeCount++;
      revealedExtra.push({ row: r, col: c, value: cell.adjacent });
    }
  }

  return revealedExtra;
}

// Kiểm tra điều kiện thắng: số ô an toàn đã mở khớp tổng số ô an toàn của board
// (virusZone đếm thực tế từ board vì có ô disabled, mode khác dùng công thức).
function checkWin(game) {
  let totalSafe;

  if (game.mode === "virusZone") {
    totalSafe = 0;
    for (let r = 0; r < game.rows; r++)
      for (let c = 0; c < game.cols; c++) {
        const cell = game.board[r][c];
        if (!cell.disabled && !cell.virus) totalSafe++;
      }
  } else {
    totalSafe = game.rows * game.cols - game.viruses;
  }

  if (game.revealedSafeCount === totalSafe) {
    game.status  = "won";
    game.endedAt = nowIso();
  }
}

// Xử lý hành động người chơi mở 1 ô: validate, sinh board nếu chưa có, kiểm tra
// trạng thái ô (disabled/warned/revealed), xử lý thua nếu trúng virus, hoặc
// flood-fill mở vùng an toàn (kèm hint riêng cho Maze ở lần đầu) và kiểm tra thắng.
function revealCell(game, row, col) {
  validatePosition(game, row, col);

  if (game.status !== "playing") {
    return {
      changed: false,
      message: `Game is already ${game.status}.`,
      game: serializeGame(game),
    };
  }

  generateBoard(game, row, col);

  const cell = game.board[row][col];

  if (cell.disabled) {
    return {
      changed: false,
      message: "This cell is outside the virus zone.",
      game: serializeGame(game),
    };
  }

  if (cell.warned) {
    return {
      changed: false,
      message: "Cannot reveal a warned cell. Remove warning first.",
      game: serializeGame(game),
    };
  }

  if (cell.revealed) {
    return {
      changed: false,
      message: "Cell is already revealed.",
      game: serializeGame(game),
    };
  }

  const isFirstReveal = game.moves === 0;

  game.moves++;

  if (cell.virus) {
    cell.revealed = true;
    game.status   = "lost";
    game.endedAt  = nowIso();

    return {
      changed: true,
      message: "INFECTED! You clicked on a virus.",
      game: serializeGame(game),
    };
  }

  const revealed = revealSafeArea(game, row, col);

  if (isFirstReveal && game.mode === "maze") {
    const hintCells = revealMazeFirstClickHint(game, row, col);
    for (const c of hintCells) {
      if (!revealed.some(r => r.row === c.row && r.col === c.col)) revealed.push(c);
    }
  }

  checkWin(game);

  return {
    changed: true,
    revealed,
    message: game.status === "won" ? "System secured! You won!" : "Cell revealed.",
    game: serializeGame(game),
  };
}

// Bật/tắt cảnh báo (warning) trên 1 ô chưa mở; không cho warn ô đã revealed hoặc disabled.
function toggleWarning(game, row, col) {
  validatePosition(game, row, col);

  if (game.status !== "playing") {
    return {
      changed: false,
      message: `Game is already ${game.status}.`,
      game: serializeGame(game),
    };
  }

  generateBoard(game, null, null);

  const cell = game.board[row][col];

  if (cell.disabled) {
    return {
      changed: false,
      message: "This cell is outside the virus zone.",
      game: serializeGame(game),
    };
  }

  if (cell.revealed) {
    return {
      changed: false,
      message: "Cannot warn a revealed cell.",
      game: serializeGame(game),
    };
  }

  cell.warned        = !cell.warned;
  game.warningsUsed += cell.warned ? 1 : -1;

  return {
    changed: true,
    message: cell.warned ? "Warning placed." : "Warning removed.",
    game: serializeGame(game),
  };
}

// Chuyển game object nội bộ thành dữ liệu public trả về client (ẩn vị trí virus
// trừ khi thua hoặc options.revealViruses, tính lại totalSafeCells cho virusZone).
function serializeGame(game, options = {}) {
  const revealViruses = options.revealViruses === true || game.status === "lost";
  const board         = [];

  for (let r = 0; r < game.rows; r++) {
    const row = [];

    for (let c = 0; c < game.cols; c++) {
      const cell = game.boardGenerated ? game.board[r][c] : null;

      const publicCell = {
        row:   r,
        col:   c,
        state: "hidden",  // hidden | warned | revealed | disabled
        value: null,      // null | 0–8 | "virus"
      };

      if (!cell) { row.push(publicCell); continue; }

      if (cell.disabled) {
        publicCell.state = "disabled";
        row.push(publicCell);
        continue;
      }

      if (cell.warned && !cell.revealed)  publicCell.state = "warned";

      if (cell.revealed) {
        publicCell.state = "revealed";
        publicCell.value = cell.virus ? "virus" : cell.adjacent;
      }

      if (revealViruses && cell.virus) {
        publicCell.state   = cell.revealed ? "revealed" : publicCell.state;
        publicCell.value   = "virus";
        publicCell.isVirus = true;
      }

      row.push(publicCell);
    }

    board.push(row);
  }

  let totalSafeCells;
  if (game.boardGenerated && game.mode === "virusZone") {
    totalSafeCells = 0;
    for (let r = 0; r < game.rows; r++)
      for (let c = 0; c < game.cols; c++) {
        const cell = game.board[r][c];
        if (!cell.disabled && !cell.virus) totalSafeCells++;
      }
  } else {
    totalSafeCells = game.rows * game.cols - game.viruses;
  }

  return {
    id:                  game.id,
    mode:                game.mode,
    difficulty:          game.difficulty,
    rows:                game.rows,
    cols:                game.cols,
    viruses:             game.viruses,
    status:              game.status,
    boardGenerated:      game.boardGenerated,
    revealedSafeCount:   game.revealedSafeCount,
    totalSafeCells,
    warningsUsed:        game.warningsUsed,
    virusesLeftEstimate: game.viruses - game.warningsUsed,
    moves:               game.moves,
    createdAt:           game.createdAt,
    endedAt:             game.endedAt,
    board,
  };
}

module.exports = {
  validatePosition,
  revealSafeArea,
  checkWin,
  revealCell,
  toggleWarning,
  serializeGame,
};