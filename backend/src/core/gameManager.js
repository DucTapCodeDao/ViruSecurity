"use strict";

const { makeId, nowIso, httpError } = require("../utils/helpers");
const { GAME_CONFIGS, MODES }       = require("../config/gameConfig");

// In-memory store: key là game.id, value là game object.
const games = new Map();

// Chuẩn hoá input tạo game: xác định mode + difficulty hợp lệ, lấy preset rồi
// cho phép override rows/cols/viruses/targetCells, validate toàn bộ giá trị.
function normalizeGameConfig(input = {}) {

  const mode =
    typeof input.mode === "string" && MODES.includes(input.mode)
      ? input.mode
      : "detective";

  const difficulty =
    typeof input.difficulty === "string" &&
    GAME_CONFIGS[mode][input.difficulty.toLowerCase()]
      ? input.difficulty.toLowerCase()
      : "easy";

  const preset = GAME_CONFIGS[mode][difficulty];

  const rows    = Number(input.rows    ?? preset.rows);
  const cols    = Number(input.cols    ?? preset.cols);
  const viruses = Number(input.viruses ?? preset.viruses);

  if (!Number.isInteger(rows) || rows < 2 || rows > 50)
    throw httpError(400, "rows must be an integer from 2 to 50");

  if (!Number.isInteger(cols) || cols < 2 || cols > 50)
    throw httpError(400, "cols must be an integer from 2 to 50");

  if (!Number.isInteger(viruses) || viruses < 1 || viruses >= rows * cols)
    throw httpError(400, "viruses must be an integer from 1 to rows*cols - 1");

  const targetCells =
    mode === "virusZone"
      ? Number(input.targetCells ?? preset.targetCells)
      : null;

  if (
    mode === "virusZone" &&
    (!Number.isInteger(targetCells) || targetCells < viruses + 1)
  ) {
    throw httpError(400, "targetCells must be an integer greater than viruses");
  }

  return { mode, difficulty, rows, cols, viruses, targetCells };
}

// Tạo 1 game object mới (chưa sinh board) từ options, lưu vào in-memory store.
function createGame(options = {}) {
  const { mode, difficulty, rows, cols, viruses, targetCells } =
    normalizeGameConfig(options);

  const id = makeId();

  const game = {
    id,

    mode,
    difficulty,

    rows,
    cols,
    viruses,
    targetCells,

    board:          null,
    boardGenerated: false,
    safeFirstClick: options.safeFirstClick !== false,

    status:    "playing",
    createdAt: nowIso(),
    endedAt:   null,

    revealedSafeCount: 0,
    warningsUsed:      0,
    moves:             0,
  };

  games.set(id, game);
  return game;
}

// Lấy game theo id từ store, throw 404 nếu không tồn tại.
function getGameOrThrow(id) {
  const game = games.get(id);
  if (!game) throw httpError(404, `Game '${id}' not found`);
  return game;
}

module.exports = { games, normalizeGameConfig, createGame, getGameOrThrow };