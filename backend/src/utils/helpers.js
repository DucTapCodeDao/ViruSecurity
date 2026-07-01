"use strict";

const crypto = require("crypto");

// 8 hướng kề cạnh (kể cả đường chéo) — dùng trong computeAdjacent,
// revealSafeArea (BFS) và generateVirusZoneBoard (DFS lan shape).
const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1],          [ 0, 1],
  [ 1, -1],  [ 1, 0], [ 1, 1],
];

// Sinh game ID ngẫu nhiên dạng hex 24 ký tự.
function makeId() {
  return crypto.randomBytes(12).toString("hex");
}

// Timestamp ISO 8601, dùng cho createdAt / endedAt trong game object.
function nowIso() {
  return new Date().toISOString();
}

// Số nguyên ngẫu nhiên trong [0, max).
function randomInt(max) {
  return Math.floor(Math.random() * max);
}

// Kiểm tra (row, col) có nằm trong giới hạn board không.
function isInside(rows, cols, row, col) {
  return row >= 0 && row < rows && col >= 0 && col < cols;
}

// Tạo string key duy nhất cho ô (row, col), dùng trong Set/Map.
function keyOf(row, col) {
  return `${row},${col}`;
}

// Tạo Error kèm status code để routes.js bắt và trả đúng HTTP status.
function httpError(status, message) {
  const err    = new Error(message);
  err.status   = status;
  return err;
}

module.exports = { DIRS, makeId, nowIso, randomInt, isInside, keyOf, httpError };