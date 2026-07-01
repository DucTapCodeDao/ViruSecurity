"use strict";

/*
  Minesweeper backend logic + simple HTTP API + stress tests.

  Run server:
    node minesweeper-backend.js

  Run tests:
    node minesweeper-backend.js test 1000

  No npm packages required. This file uses only built-in Node.js modules.
*/

const http = require("http");
const crypto = require("crypto");
const assert = require("assert");

const DEFAULT_PORT = Number(process.env.PORT || 3000);


function generateBoard(game, firstRow = null, firstCol = null) {
  if (game.boardGenerated) return;

  const board = createEmptyBoard(game.rows, game.cols);
  const safeZone = new Set();

  if (
    game.safeFirstClick &&
    Number.isInteger(firstRow) &&
    Number.isInteger(firstCol) &&
    isInside(game.rows, game.cols, firstRow, firstCol)
  ) {
    for (const key of getSafeZone(game.rows, game.cols, firstRow, firstCol, game.mines)) {
      safeZone.add(key);
    }
  }

  const candidates = [];

  for (let r = 0; r < game.rows; r += 1) {
    for (let c = 0; c < game.cols; c += 1) {
      if (!safeZone.has(keyOf(r, c))) {
        candidates.push([r, c]);
      }
    }
  }

  if (candidates.length < game.mines) {
    throw new Error("Not enough available cells to place mines");
  }

  // Fisher-Yates shuffle
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  for (let i = 0; i < game.mines; i += 1) {
    const [r, c] = candidates[i];
    board[r][c].mine = true;
  }

  for (let r = 0; r < game.rows; r += 1) {
    for (let c = 0; c < game.cols; c += 1) {
      if (board[r][c].mine) continue;

      let count = 0;

      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;

        if (isInside(game.rows, game.cols, nr, nc) && board[nr][nc].mine) {
          count += 1;
        }
      }

      board[r][c].adjacent = count;
    }
  }

  game.board = board;
  game.boardGenerated = true;
}



function revealCell(game, row, col) {
  validatePosition(game, row, col);

  if (game.status !== "playing") {
    return {
      changed: false,
      message: `Game is already ${game.status}`,
      game: serializeGame(game),
    };
  }

  generateBoard(game, row, col);

  const cell = game.board[row][col];

  if (cell.flagged) {
    return {
      changed: false,
      message: "Cannot reveal a flagged cell. Unflag it first.",
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

  game.moves += 1;

  if (cell.mine) {
    cell.revealed = true;
    game.status = "lost";
    game.endedAt = nowIso();

    return {
      changed: true,
      message: "Boom! You clicked on a mine.",
      game: serializeGame(game),
    };
  }

  const revealed = revealSafeArea(game, row, col);
  checkWin(game);

  return {
    changed: true,
    revealed,
    message: game.status === "won" ? "You won!" : "Cell revealed.",
    game: serializeGame(game),
  };
}

function toggleFlag(game, row, col) {
  validatePosition(game, row, col);

  if (game.status !== "playing") {
    return {
      changed: false,
      message: `Game is already ${game.status}`,
      game: serializeGame(game),
    };
  }

  generateBoard(game, null, null);

  const cell = game.board[row][col];

  if (cell.revealed) {
    return {
      changed: false,
      message: "Cannot flag a revealed cell.",
      game: serializeGame(game),
    };
  }

  cell.flagged = !cell.flagged;
  game.flagsUsed += cell.flagged ? 1 : -1;

  return {
    changed: true,
    message: cell.flagged ? "Cell flagged." : "Cell unflagged.",
    game: serializeGame(game),
  };
}

function serializeGame(game, options = {}) {
  const revealMines = options.revealMines === true || game.status === "lost";
  const board = [];

  for (let r = 0; r < game.rows; r += 1) {
    const row = [];

    for (let c = 0; c < game.cols; c += 1) {
      const cell = game.boardGenerated ? game.board[r][c] : null;

      const publicCell = {
        row: r,
        col: c,
        state: "hidden", // hidden | flagged | revealed
        value: null,     // null hoặc 0-8 hoặc "mine"
      };

      if (!cell) {
        row.push(publicCell);
        continue;
      }

      if (cell.flagged && !cell.revealed) {
        publicCell.state = "flagged";
      }

      if (cell.revealed) {
        publicCell.state = "revealed";
        publicCell.value = cell.mine ? "mine" : cell.adjacent;
      }

      if (revealMines && cell.mine) {
        publicCell.state = cell.revealed ? "revealed" : "hidden";
        publicCell.value = "mine";
        publicCell.isMine = true;
      }

      row.push(publicCell);
    }

    board.push(row);
  }

  return {
    id: game.id,
    rows: game.rows,
    cols: game.cols,
    mines: game.mines,
    status: game.status,
    boardGenerated: game.boardGenerated,
    revealedSafeCount: game.revealedSafeCount,
    totalSafeCells: game.rows * game.cols - game.mines,
    flagsUsed: game.flagsUsed,
    minesLeftEstimate: game.mines - game.flagsUsed,
    moves: game.moves,
    createdAt: game.createdAt,
    endedAt: game.endedAt,
    board,
  };
}

async function handleRequest(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const parts = url.pathname.split("/").filter(Boolean);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        activeGames: games.size,
      });
      return;
    }

    if (
      req.method === "POST" &&
      parts[0] === "api" &&
      parts[1] === "games" &&
      parts[2] === "start"
    ) {
      const body = await readJsonBody(req);
      const game = createGame(body);

      sendJson(res, 201, {
        message: "Game created.",
        game: serializeGame(game),
      });

      return;
    }

    if (parts[0] === "api" && parts[1] === "games" && parts[2]) {
      const gameId = parts[2];
      const game = getGameOrThrow(gameId);

      if (req.method === "GET" && parts.length === 3) {
        const revealMines = url.searchParams.get("debug") === "true";

        sendJson(res, 200, {
          game: serializeGame(game, { revealMines }),
        });

        return;
      }

      if (req.method === "DELETE" && parts.length === 3) {
        games.delete(gameId);

        sendJson(res, 200, {
          message: "Game deleted.",
        });

        return;
      }

      if (req.method === "POST" && parts[3] === "reveal") {
        const body = await readJsonBody(req);

        const result = revealCell(
          game,
          Number(body.row),
          Number(body.col)
        );

        sendJson(res, 200, result);
        return;
      }

      if (req.method === "POST" && parts[3] === "flag") {
        const body = await readJsonBody(req);

        const result = toggleFlag(
          game,
          Number(body.row),
          Number(body.col)
        );

        sendJson(res, 200, result);
        return;
      }
    }

    sendJson(res, 404, {
      error: "Not found",
      routes: [
        "GET /health",
        "POST /api/games/start",
        "GET /api/games/:id",
        "POST /api/games/:id/reveal",
        "POST /api/games/:id/flag",
        "DELETE /api/games/:id",
      ],
    });
  } catch (err) {
    sendJson(res, err.status || 500, {
      error: err.message || "Internal server error",
    });
  }
}

function makeTestGame(config) {
  const game = createGame(config);

  // Không để game test làm đầy bộ nhớ server.
  games.delete(game.id);

  return game;
}

function runSelfTests(iterations = 1000) {
  const startedAt = Date.now();
  const presets = [
    DIFFICULTIES.easy,
    DIFFICULTIES.medium,
    DIFFICULTIES.hard,
  ];

  for (let i = 0; i < iterations; i += 1) {
    const preset = presets[i % presets.length];

    const firstRow = randomInt(preset.rows);
    const firstCol = randomInt(preset.cols);
    const game = makeTestGame(preset);

    const result = revealCell(game, firstRow, firstCol);

    assert.strictEqual(
      result.changed,
      true,
      "First reveal should change the board"
    );

    assert.strictEqual(
      game.board[firstRow][firstCol].mine,
      false,
      "First click should be safe"
    );

    assert.notStrictEqual(
      game.status,
      "lost",
      "First click should not lose"
    );

    assertBoardInvariants(game);

    // Test flag / unflag.
    let hiddenSafe = null;

    for (let r = 0; r < game.rows && !hiddenSafe; r += 1) {
      for (let c = 0; c < game.cols; c += 1) {
        const cell = game.board[r][c];

        if (!cell.mine && !cell.revealed) {
          hiddenSafe = [r, c];
          break;
        }
      }
    }

    if (hiddenSafe) {
      toggleFlag(game, hiddenSafe[0], hiddenSafe[1]);

      assert.strictEqual(
        game.board[hiddenSafe[0]][hiddenSafe[1]].flagged,
        true,
        "Cell should be flagged"
      );

      const flaggedReveal = revealCell(game, hiddenSafe[0], hiddenSafe[1]);

      assert.strictEqual(
        flaggedReveal.changed,
        false,
        "Flagged cell should not be revealed"
      );

      toggleFlag(game, hiddenSafe[0], hiddenSafe[1]);

      assert.strictEqual(
        game.board[hiddenSafe[0]][hiddenSafe[1]].flagged,
        false,
        "Cell should be unflagged"
      );
    }

    assertBoardInvariants(game);

    // Mở hết ô an toàn thì phải thắng.
    for (let r = 0; r < game.rows; r += 1) {
      for (let c = 0; c < game.cols; c += 1) {
        const cell = game.board[r][c];

        if (!cell.mine && !cell.revealed) {
          revealCell(game, r, c);
        }
      }
    }

    assert.strictEqual(
      game.status,
      "won",
      "Revealing all safe cells should win"
    );

    assertBoardInvariants(game);

    // Game khác: mở trúng mìn thì phải thua.
    const losingGame = makeTestGame(preset);
    revealCell(losingGame, firstRow, firstCol);

    let minePos = null;

    for (let r = 0; r < losingGame.rows && !minePos; r += 1) {
      for (let c = 0; c < losingGame.cols; c += 1) {
        if (losingGame.board[r][c].mine) {
          minePos = [r, c];
          break;
        }
      }
    }

    assert(minePos, "A mine position should exist");

    revealCell(losingGame, minePos[0], minePos[1]);

    assert.strictEqual(
      losingGame.status,
      "lost",
      "Revealing a mine should lose"
    );

    assertBoardInvariants(losingGame);
  }

  const elapsedMs = Date.now() - startedAt;

  console.log(`Passed ${iterations} test iterations in ${elapsedMs}ms.`);
}

function runDemo() {
  const game = createGame({ difficulty: "easy" });

  revealCell(game, 0, 0);

  console.log("Public game object returned to frontend:");
  console.log(JSON.stringify(serializeGame(game), null, 2));

  console.log("\nDebug board with mines shown only for local testing:");
  printBoardForDebug(game, true);
}

module.exports = {
  createGame,
  revealCell,
  toggleFlag,
  serializeGame,
  generateBoard,
  runSelfTests,
  startServer,
};

if (require.main === module) {
  const mode = process.argv[2] || "server";

  if (mode === "test") {
    const iterations = Number(process.argv[3] || 1000);

    if (!Number.isInteger(iterations) || iterations < 1) {
      console.error("Usage: node minesweeper-backend.js test 1000");
      process.exit(1);
    }

    runSelfTests(iterations);
  } else if (mode === "demo") {
    runDemo();
  } else if (mode === "server") {
    startServer(DEFAULT_PORT);
  } else {
    console.error("Unknown mode. Use: server | test | demo");
    process.exit(1);
  }
}