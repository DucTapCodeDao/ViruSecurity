// Giao tiếp với backend qua fetch. Dùng global object API thay vì ES module
// export để tương thích với Vue 3 CDN (không qua bundler).

const BASE = "http://localhost:3000";

// Helper nội bộ: gửi HTTP request và parse JSON response; throw nếu response không ok.
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
  // Tạo game mới trên server với mode + difficulty.
  async startGame({ mode, difficulty }) {
    const data = await _request("POST", "/api/games/start", { mode, difficulty });
    return data.game;
  },

  // Lấy trạng thái game; debug=true để server trả về vị trí virus.
  async getGame(id, debug = false) {
    const q    = debug ? "?debug=true" : "";
    const data = await _request("GET", `/api/games/${id}${q}`);
    return data.game;
  },

  // Mở ô (row, col).
  async revealCell(gameId, row, col) {
    return _request("POST", `/api/games/${gameId}/reveal`, { row, col });
  },

  // Bật/tắt warning flag trên ô (row, col).
  async warnCell(gameId, row, col) {
    return _request("POST", `/api/games/${gameId}/warn`, { row, col });
  },

  // Xoá game khỏi server.
  async deleteGame(gameId) {
    return _request("DELETE", `/api/games/${gameId}`);
  },

  // Lưu điểm sau khi thắng.
  async saveScore({ playerName, gameId, mode, difficulty, timeMs, moves }) {
    return _request("POST", "/api/scores", {
      playerName, gameId, mode, difficulty, timeMs, moves,
    });
  },

  // Lấy bảng xếp hạng theo mode + difficulty, tối đa limit dòng.
  async getLeaderboard(mode, difficulty = "easy", limit = 10) {
    return _request("GET", `/api/leaderboard/${mode}?difficulty=${difficulty}&limit=${limit}`);
  },

  // Lấy 27 sample block từ backend — nguồn dữ liệu duy nhất cho modal "Xem mẫu
  // block" Maze Mode, tránh hardcode trùng lặp ở frontend.
  async getMazeSampleBlocks() {
    const data = await _request("GET", "/api/maze/sample-blocks");
    return data.blocks;
  },

  // Kiểm tra server có đang chạy không.
  async healthCheck() {
    return _request("GET", "/health");
  },
};