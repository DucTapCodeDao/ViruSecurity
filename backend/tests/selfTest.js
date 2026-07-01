"use strict";

const assert = require("assert");

const { GAME_CONFIGS }                  = require("../src/config/gameConfig");
const { createGame, games }             = require("../src/core/gameManager");
const { revealCell, toggleWarning }     = require("../src/core/gameLogic");
const { generateBoard }                 = require("../src/core/board");
const { DIRS, isInside, randomInt }     = require("../src/utils/helpers");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTestGame(config) {
  const game = createGame(config);
  games.delete(game.id);
  return game;
}

// virusZone: shape random nên phải generate board trước,
// sau đó mới pick được ô enabled để click — không thể dùng random blind.
function pickFirstCell(game, fallbackRow, fallbackCol) {
  if (game.mode !== "virusZone") return [fallbackRow, fallbackCol];

  generateBoard(game, null, null); // pre-generate để biết shape

  // Lấy tất cả ô enabled rồi chọn ngẫu nhiên 1 ô
  const enabled = [];
  for (let r = 0; r < game.rows; r++)
    for (let c = 0; c < game.cols; c++)
      if (!game.board[r][c].disabled && !game.board[r][c].virus) enabled.push([r, c]);

  return enabled[randomInt(enabled.length)];
}

// ─── Board invariants ─────────────────────────────────────────────────────────

function countViruses(game) {
  let count = 0;
  for (let r = 0; r < game.rows; r++)
    for (let c = 0; c < game.cols; c++)
      if (!game.board[r][c].disabled && game.board[r][c].virus) count++;
  return count;
}

function calculateAdjacentDirectly(game, row, col) {
  let count = 0;
  for (const [dr, dc] of DIRS) {
    const nr = row + dr, nc = col + dc;
    if (isInside(game.rows, game.cols, nr, nc) && game.board[nr][nc].virus)
      count++;
  }
  return count;
}

function assertBoardInvariants(game) {
  assert.strictEqual(countViruses(game), game.viruses, "Virus count mismatch");

  let revealedSafe = 0;
  let warnings     = 0;

  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      const cell = game.board[r][c];
      if (cell.disabled) continue;

      if (cell.virus) {
        assert.strictEqual(cell.adjacent, 0, "Virus cell không cần adjacent count");
      } else {
        assert.strictEqual(
          cell.adjacent,
          calculateAdjacentDirectly(game, r, c),
          `Wrong adjacent at (${r},${c})`
        );
      }

      if (cell.revealed && !cell.virus) revealedSafe++;
      if (cell.warned) warnings++;

      assert(
        !(cell.revealed && cell.warned),
        `Ô (${r},${c}) không thể vừa revealed vừa warned`
      );
    }
  }

  assert.strictEqual(game.revealedSafeCount, revealedSafe, "revealedSafeCount mismatch");
  assert.strictEqual(game.warningsUsed,      warnings,     "warningsUsed mismatch");
}

// ─── Mode-specific stubs ──────────────────────────────────────────────────────

function runModeSpecificTests(game, preset) {
  switch (preset.mode) {
    case "detective":
      // TODO: assertCSPSolvable(game) — sau khi detectiveMode.js implement CSP
      break;
    case "maze":
      // TODO: assertSafePathExists(game) — sau khi mazeMode.js implement A*
      break;
    case "virusZone":
      // Đã test đầy đủ trong modeTests.js
      break;
  }
}

// ─── Core test runner ─────────────────────────────────────────────────────────

function runSelfTests(iterations = 1000) {
  const startedAt = Date.now();

  const presets = Object.entries(GAME_CONFIGS).flatMap(([mode, levels]) =>
    Object.entries(levels).map(([difficulty, cfg]) => ({
      ...cfg, mode, difficulty,
    }))
  );

  let passed = 0;

  for (let i = 0; i < iterations; i++) {
    const preset = presets[i % presets.length];
    const tag    = `[${preset.mode}/${preset.difficulty}]`;

    const game = makeTestGame(preset);
    const [firstRow, firstCol] = pickFirstCell(
      game,
      randomInt(preset.rows),
      randomInt(preset.cols)
    );

    // Test 1: Click đầu tiên luôn an toàn
    const result = revealCell(game, firstRow, firstCol);

    assert.strictEqual(result.changed, true,
      `${tag} First reveal should change the board`);
    assert.strictEqual(game.board[firstRow][firstCol].virus, false,
      `${tag} First click should be safe`);
    assert.notStrictEqual(game.status, "lost",
      `${tag} First click should not lose`);

    assertBoardInvariants(game);

    // Test 2: Toggle warning
    let hiddenSafe = null;
    for (let r = 0; r < game.rows && !hiddenSafe; r++)
      for (let c = 0; c < game.cols; c++) {
        const cell = game.board[r][c];
        if (!cell.disabled && !cell.virus && !cell.revealed)
          { hiddenSafe = [r, c]; break; }
      }

    if (hiddenSafe) {
      const [wr, wc] = hiddenSafe;

      toggleWarning(game, wr, wc);
      assert.strictEqual(game.board[wr][wc].warned, true,
        `${tag} Cell should be warned`);

      const warnedReveal = revealCell(game, wr, wc);
      assert.strictEqual(warnedReveal.changed, false,
        `${tag} Warned cell should NOT be revealed`);

      toggleWarning(game, wr, wc);
      assert.strictEqual(game.board[wr][wc].warned, false,
        `${tag} Cell should be un-warned`);
    }

    assertBoardInvariants(game);

    // Test 3: Mở hết ô an toàn → thắng
    for (let r = 0; r < game.rows; r++)
      for (let c = 0; c < game.cols; c++) {
        const cell = game.board[r][c];
        if (!cell.disabled && !cell.virus && !cell.revealed)
          revealCell(game, r, c);
      }

    assert.strictEqual(game.status, "won",
      `${tag} Revealing all safe cells should win`);

    assertBoardInvariants(game);

    // Test 4: Mở trúng virus → thua
    const losingGame = makeTestGame(preset);
    const [lr, lc]   = pickFirstCell(losingGame, firstRow, firstCol);
    revealCell(losingGame, lr, lc);

    let virusPos = null;
    for (let r = 0; r < losingGame.rows && !virusPos; r++)
      for (let c = 0; c < losingGame.cols; c++)
        if (losingGame.board[r][c].virus) { virusPos = [r, c]; break; }

    assert(virusPos, `${tag} A virus position should exist`);
    revealCell(losingGame, virusPos[0], virusPos[1]);
    assert.strictEqual(losingGame.status, "lost",
      `${tag} Revealing a virus should lose`);

    assertBoardInvariants(losingGame);

    // Test 5: Mode-specific
    runModeSpecificTests(game, preset);

    passed++;
  }

  const elapsed  = Date.now() - startedAt;
  const coverage = presets.map(p => `${p.mode}/${p.difficulty}`).join(", ");
  console.log(`✓ Passed ${passed}/${iterations} iterations in ${elapsed}ms`);
  console.log(`  Coverage: ${coverage}`);
}

// ─── Debug helper ─────────────────────────────────────────────────────────────

function printBoardForDebug(game, revealAll = false) {
  for (let r = 0; r < game.rows; r++) {
    const row = [];
    for (let c = 0; c < game.cols; c++) {
      const cell = game.board[r][c];
      if (cell.disabled)              { row.push(" "); continue; }
      if (revealAll || cell.revealed) row.push(cell.virus ? "V" : String(cell.adjacent));
      else if (cell.warned)           row.push("!");
      else                            row.push(".");
    }
    console.log(row.join(" "));
  }
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = { runSelfTests, assertBoardInvariants, printBoardForDebug, countViruses };