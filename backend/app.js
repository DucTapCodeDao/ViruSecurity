"use strict";

require("dotenv").config(); // PHẢI là dòng đầu tiên — load .env trước khi bất kỳ module nào đọc process.env

const { startServer }  = require("./server");
const { runSelfTests } = require("./tests/selfTest");
const { createGame }   = require("./src/core/gameManager");
const { revealCell, serializeGame } = require("./src/core/gameLogic");
const { MODES }        = require("./src/config/gameConfig");
const { testConnection } = require("./src/db/connection");

const DEFAULT_PORT = Number(process.env.PORT || 3000);

// Chạy thử 1 ván cho mỗi mode ở easy và in kết quả ra console.
function runDemo() {
  console.log("═".repeat(52));
  console.log("  ViruSecurity — Demo");
  console.log("═".repeat(52));

  for (const mode of MODES) {
    console.log(`\n── ${mode} / easy ──`);

    const game = createGame({ mode, difficulty: "easy" });
    revealCell(game, 0, 0);

    const out = serializeGame(game);
    console.log(`  status : ${out.status}`);
    console.log(`  board  : ${out.rows}×${out.cols}  viruses: ${out.viruses}`);
    console.log(`  safe revealed: ${out.revealedSafeCount}/${out.totalSafeCells}`);
  }

  console.log("\n" + "═".repeat(52));
}

// Entry point:
//   node app.js             → khởi động server (default)
//   node app.js server      → khởi động server
//   node app.js test [n]    → chạy n vòng stress test (default 1000)
//   node app.js demo        → in kết quả 1 lượt chơi cho mỗi mode
if (require.main === module) {
  const cmd = process.argv[2] || "server";

  if (cmd === "server") {
    // Test DB connection khi khởi động; server vẫn chạy dù DB lỗi (chỉ mất
    // tính năng lưu điểm/leaderboard).
    testConnection().catch(err => {
      console.warn("⚠ MySQL không kết nối được:", err.message);
      console.warn("  → Game vẫn chạy bình thường, nhưng lưu điểm & leaderboard sẽ lỗi.");
      console.warn("  → Kiểm tra lại DB_HOST/DB_USER/DB_PASS/DB_NAME trong file .env");
    });

    startServer(DEFAULT_PORT);

  } else if (cmd === "test") {
    const n = Number(process.argv[3] || 1000);
    if (!Number.isInteger(n) || n < 1) {
      console.error("Usage: node app.js test [iterations]");
      process.exit(1);
    }
    runSelfTests(n);

  } else if (cmd === "demo") {
    runDemo();

  } else {
    console.error(`Unknown command: "${cmd}"`);
    console.error("Usage: node app.js [server|test|demo]");
    process.exit(1);
  }
}

module.exports = { runDemo };