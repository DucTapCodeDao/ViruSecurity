"use strict";

const { games, createGame, getGameOrThrow } = require("../core/gameManager");
const { revealCell, toggleWarning, serializeGame } = require("../core/gameLogic");
const { sendJson, readJsonBody } = require("./middleware");
const { saveScore }     = require("../db/scoreRepository");
const { getTopScores }  = require("../db/leaderboardRepository");
const { MAZE_SAMPLE_BLOCKS } = require("../modes/mazeSampleBlocks");

// Kiểm tra URL path có khớp pattern không (segment bắt đầu bằng ":" là wildcard).
function matchPath(parts, pattern) {
  if (parts.length !== pattern.length) return false;
  return pattern.every((seg, i) => seg.startsWith(":") || seg === parts[i]);
}

// Xử lý toàn bộ HTTP request: set CORS header, parse URL, dispatch sang đúng
// route, trả lỗi với đúng status code nếu có exception.
async function handleRequest(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url   = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const parts = url.pathname.split("/").filter(Boolean);

  try {

    // GET /health
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true, activeGames: games.size });
      return;
    }

    // POST /api/games/start
    if (req.method === "POST" && matchPath(parts, ["api", "games", "start"])) {
      const body = await readJsonBody(req);
      const game = createGame(body);
      sendJson(res, 201, {
        message: "Game created.",
        game:    serializeGame(game),
      });
      return;
    }

    // GET /api/games/:id
    if (req.method === "GET" && matchPath(parts, ["api", "games", ":id"])) {
      const game          = getGameOrThrow(parts[2]);
      const revealViruses = url.searchParams.get("debug") === "true";
      sendJson(res, 200, { game: serializeGame(game, { revealViruses }) });
      return;
    }

    // DELETE /api/games/:id
    if (req.method === "DELETE" && matchPath(parts, ["api", "games", ":id"])) {
      games.delete(parts[2]);
      sendJson(res, 200, { message: "Game deleted." });
      return;
    }

    // POST /api/games/:id/reveal
    if (req.method === "POST" && matchPath(parts, ["api", "games", ":id", "reveal"])) {
      const body   = await readJsonBody(req);
      const game   = getGameOrThrow(parts[2]);
      const result = revealCell(game, Number(body.row), Number(body.col));
      sendJson(res, 200, result);
      return;
    }

    // POST /api/games/:id/warn
    if (req.method === "POST" && matchPath(parts, ["api", "games", ":id", "warn"])) {
      const body   = await readJsonBody(req);
      const game   = getGameOrThrow(parts[2]);
      const result = toggleWarning(game, Number(body.row), Number(body.col));
      sendJson(res, 200, result);
      return;
    }

    // POST /api/scores — lấy mode/difficulty/timeMs/moves từ game object trong
    // memory, không để frontend tự truyền lên để tránh giả mạo điểm.
    if (req.method === "POST" && matchPath(parts, ["api", "scores"])) {
      const body = await readJsonBody(req);

      if (!body.playerName || typeof body.playerName !== "string")
        throw { status: 400, message: "playerName is required" };

      if (!body.gameId || typeof body.gameId !== "string")
        throw { status: 400, message: "gameId is required" };

      const game = getGameOrThrow(body.gameId);

      if (game.status !== "won")
        throw { status: 400, message: "Chỉ lưu điểm khi game.status === 'won'" };

      const timeMs = new Date(game.endedAt).getTime() - new Date(game.createdAt).getTime();

      const score = await saveScore({
        playerName: body.playerName,
        gameId:     game.id,
        mode:       game.mode,
        difficulty: game.difficulty,
        timeMs,
        moves:      game.moves,
      });

      sendJson(res, 201, {
        message: "Score saved.",
        score,
      });
      return;
    }

    // GET /api/leaderboard/:mode?difficulty=easy&limit=10
    if (req.method === "GET" && matchPath(parts, ["api", "leaderboard", ":mode"])) {
      const mode       = parts[2];
      const difficulty = url.searchParams.get("difficulty") || "easy";
      const limit      = Number(url.searchParams.get("limit") || 10);

      const rows = await getTopScores(mode, difficulty, limit);

      sendJson(res, 200, {
        mode,
        difficulty,
        leaderboard: rows,
      });
      return;
    }

    // GET /api/maze/sample-blocks — trả về 27 sample block dùng để sinh map Maze,
    // là nguồn dữ liệu duy nhất để frontend và backend luôn khớp nhau.
    if (req.method === "GET" && matchPath(parts, ["api", "maze", "sample-blocks"])) {
      sendJson(res, 200, { blocks: MAZE_SAMPLE_BLOCKS });
      return;
    }

    // 404
    sendJson(res, 404, {
      error: "Route not found.",
      routes: [
        "GET    /health",
        "POST   /api/games/start              { mode, difficulty, rows?, cols?, viruses? }",
        "GET    /api/games/:id                [?debug=true]",
        "POST   /api/games/:id/reveal         { row, col }",
        "POST   /api/games/:id/warn           { row, col }",
        "DELETE /api/games/:id",
        "POST   /api/scores                   { playerName, gameId }",
        "GET    /api/leaderboard/:mode        [?difficulty=easy&limit=10]",
        "GET    /api/maze/sample-blocks",
      ],
    });

  } catch (err) {
    sendJson(res, err.status || 500, {
      error: err.message || "Internal server error.",
    });
  }
}

module.exports = { handleRequest };