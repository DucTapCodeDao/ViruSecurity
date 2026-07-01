"use strict";

const { isInside, keyOf, DIRS } = require("../utils/helpers");

// ─── Backtracking + CSP ───
// Lõi CSP propagation dùng chung cho Detective Mode và Maze Mode (Rule 1:
// satisfied → ô ẩn còn lại an toàn; Rule 2: saturated → ô ẩn còn lại là virus;
// Subset rule: so sánh 2 constraint chồng lấp để suy ra phần dư). Trả về
// { revealed, knownVirus } tại fixpoint, không tự kết luận solvable hay không.
function runPropagation(board, rows, cols, startRow, startCol) {
  const revealed   = new Set();
  const knownVirus = new Set();

  if (board[startRow][startCol].virus || board[startRow][startCol].disabled) {
    return { revealed, knownVirus };
  }

  function floodReveal(row, col) {
    const queue = [[row, col]];
    while (queue.length > 0) {
      const [r, c] = queue.shift();
      const key = keyOf(r, c);
      if (revealed.has(key) || !isInside(rows, cols, r, c)) continue;

      const cell = board[r][c];
      if (cell.disabled || cell.virus) continue;

      revealed.add(key);

      if (cell.adjacent === 0) {
        for (const [dr, dc] of DIRS) {
          const nr = r + dr, nc = c + dc;
          if (isInside(rows, cols, nr, nc) && !revealed.has(keyOf(nr, nc))) queue.push([nr, nc]);
        }
      }
    }
  }

  floodReveal(startRow, startCol);

  let progress = true;

  while (progress) {
    progress = false;

    const constraints = [];
    for (const key of revealed) {
      const [r, c] = key.split(",").map(Number);
      const cell = board[r][c];
      if (cell.adjacent === 0) continue;

      const unknown = [];
      let knownVirusCount = 0;

      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (!isInside(rows, cols, nr, nc)) continue;
        if (board[nr][nc].disabled) continue;

        const nkey = keyOf(nr, nc);
        if (revealed.has(nkey)) continue;
        if (knownVirus.has(nkey)) { knownVirusCount++; continue; }
        unknown.push(nkey);
      }

      if (unknown.length > 0) {
        constraints.push({ remaining: cell.adjacent - knownVirusCount, unknown });
      }
    }

    for (const con of constraints) {
      if (con.remaining === 0) {
        for (const k of con.unknown) {
          if (!revealed.has(k)) {
            const [rr, cc] = k.split(",").map(Number);
            floodReveal(rr, cc);
            progress = true;
          }
        }
      } else if (con.remaining === con.unknown.length) {
        for (const k of con.unknown) {
          if (!knownVirus.has(k)) { knownVirus.add(k); progress = true; }
        }
      }
    }

    if (progress) continue;

    for (let i = 0; i < constraints.length && !progress; i++) {
      for (let j = 0; j < constraints.length; j++) {
        if (i === j) continue;
        const A = constraints[i], B = constraints[j];
        if (B.unknown.length === 0 || B.unknown.length >= A.unknown.length) continue;

        const setA = new Set(A.unknown);
        if (!B.unknown.every(k => setA.has(k))) continue;

        const setB     = new Set(B.unknown);
        const diff      = A.unknown.filter(k => !setB.has(k));
        const diffMines = A.remaining - B.remaining;

        if (diffMines === 0) {
          for (const k of diff) {
            if (!revealed.has(k)) {
              const [rr, cc] = k.split(",").map(Number);
              floodReveal(rr, cc);
              progress = true;
            }
          }
        } else if (diffMines === diff.length && diff.length > 0) {
          for (const k of diff) {
            if (!knownVirus.has(k)) { knownVirus.add(k); progress = true; }
          }
        }

        if (progress) break;
      }
    }
  }

  return { revealed, knownVirus };
}

// Dùng cho Detective Mode: kiểm tra TOÀN BỘ ô an toàn có suy luận được hết
// bằng CSP propagation hay không (không sót ô nào, không đoán bừa).
function isFullySolvable(board, rows, cols, startRow, startCol) {
  const { revealed } = runPropagation(board, rows, cols, startRow, startCol);

  let totalSafe = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!board[r][c].virus && !board[r][c].disabled) totalSafe++;

  return revealed.size === totalSafe;
}

// Dùng cho Maze Mode: chỉ cần suy luận được đường đến ô đích (endRow, endCol)
// bằng CSP propagation, không cần suy luận hết toàn bộ board.
function isPathDeducible(board, rows, cols, startRow, startCol, endRow, endCol) {
  const { revealed } = runPropagation(board, rows, cols, startRow, startCol);
  return revealed.has(keyOf(endRow, endCol));
}
// ─── Hết Backtracking + CSP ───

module.exports = { runPropagation, isFullySolvable, isPathDeducible };