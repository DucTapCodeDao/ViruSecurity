"use strict";

const mysql = require("mysql2/promise");

// Pool kết nối MySQL (chịu nhiều request đồng thời tốt hơn single connection),
// config đọc từ .env (local) hoặc Environment Variables (Render/production).
// DB_SSL=true khi dùng Aiven hoặc cloud MySQL bắt buộc SSL.
const pool = mysql.createPool({
  host:              process.env.DB_HOST     || "localhost",
  port:              Number(process.env.DB_PORT || 3306),
  user:              process.env.DB_USER     || "root",
  password:          process.env.DB_PASS     || "",
  database:          process.env.DB_NAME     || "virusecurity",
  waitForConnections: true,
  connectionLimit:   10,
  queueLimit:        0,
  timezone:          "Z",

  // SSL: bật khi DB_SSL=true (Aiven cloud), tắt khi local
  ssl: process.env.DB_SSL === "true"
    ? { rejectUnauthorized: false }
    : undefined,
});

async function testConnection() {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.ping();
    console.log("✓ MySQL connected →", `${process.env.DB_HOST || "localhost"}/${process.env.DB_NAME || "virusecurity"}`);
  } finally {
    if (conn) conn.release();
  }
}

module.exports = { pool, testConnection };