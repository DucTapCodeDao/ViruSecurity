// api.js — giao tiếp với backend
// Dùng global object API thay vì ES module export
// để tương thích với Vue 3 CDN (không qua bundler).

const BASE = "https://virusecurity-backend.onrender.com";

async function _request(method, path, body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);

  const res  = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const API = {
  async startGame({ mode, difficulty }) {
    const data = await _request("POST", "/api/games/start", { mode, difficulty });
    return data.game;
  },

  async getGame(id, debug = false) {
    const q    = debug ? "?debug=true" : "";
    const data = await _request("GET", `/api/games/${id}${q}`);
    return data.game;
  },

  async revealCell(gameId, row, col) {
    return _request("POST", `/api/games/${gameId}/reveal`, { row, col });
  },

  async warnCell(gameId, row, col) {
    return _request("POST", `/api/games/${gameId}/warn`, { row, col });
  },

  async deleteGame(gameId) {
    return _request("DELETE", `/api/games/${gameId}`);
  },

  async saveScore({ playerName, gameId, mode, difficulty, timeMs, moves }) {
    return _request("POST", "/api/scores", {
      playerName, gameId, mode, difficulty, timeMs, moves,
    });
  },

  async getLeaderboard(mode, difficulty = "easy", limit = 10) {
    return _request("GET", `/api/leaderboard/${mode}?difficulty=${difficulty}&limit=${limit}`);
  },

  // MỚI: lấy 27 sample block từ backend — nguồn dữ liệu duy nhất, không cần
  // hardcode trùng lặp ở frontend nữa. Dùng cho modal "Xem mẫu block" Maze Mode.
  async getMazeSampleBlocks() {
    const data = await _request("GET", "/api/maze/sample-blocks");
    return data.blocks;
  },

  async healthCheck() {
    return _request("GET", "/health");
  },
};