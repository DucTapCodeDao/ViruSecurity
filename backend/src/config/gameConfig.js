"use strict";

// Cấu hình theo mode → difficulty → { rows, cols, viruses, ...extras }.
const GAME_CONFIGS = {

  detective: {
    easy:   { rows: 9,  cols: 9,  viruses: 10 },
    medium: { rows: 16, cols: 16, viruses: 35 },
    hard:   { rows: 16, cols: 30, viruses: 75 },
  },

  // Maze: rows/cols phải chia hết cho MACRO_SIZE=3 (xem mazeMode.js). Độ khó
  // đến từ kích cỡ map, viruses chỉ mang tính tham khảo (generator tự ghi đè
  // game.viruses bằng tổng thực tế sau khi sinh board).
  maze: {
    easy:   { rows: 9,  cols: 9,  viruses: 18  },
    medium: { rows: 12, cols: 12, viruses: 60  },
    hard:   { rows: 15, cols: 15, viruses: 120 },
  },

  // virusZone: targetCells là số ô tối đa trong shape do DFS sinh ra; viruses
  // chỉ đặt bên trong shape và phải nhỏ hơn targetCells.
  virusZone: {
    easy:   { rows: 12, cols: 12, viruses: 12, targetCells: 60  },
    medium: { rows: 18, cols: 18, viruses: 30, targetCells: 160 },
    hard:   { rows: 24, cols: 24, viruses: 70, targetCells: 320 },
  },

};

// Danh sách mode/difficulty, tự suy ra từ GAME_CONFIGS để không hardcode string.
const MODES = Object.keys(GAME_CONFIGS);

const DIFFICULTIES = Object.keys(GAME_CONFIGS.detective);

module.exports = { GAME_CONFIGS, MODES, DIFFICULTIES };