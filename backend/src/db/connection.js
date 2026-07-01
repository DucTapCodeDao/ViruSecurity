"use strict";

const mysql = require("mysql2/promise");

// Pool kết nối MySQL (chịu nhiều request đồng thời tốt hơn single connection),
// config đọc từ .env, không hardcode credential.
const pool = mysql.createPool({
  host:              process.env.DB_HOST     || "localhost",
  port:              Number(process.env.DB_PORT || 3306),
  user:              process.env.DB_USER     || "root",
  password:          process.env.DB_PASS     || "",
  database:          process.env.DB_NAME     || "virusecurity",
  waitForConnections: true,
  connectionLimit:   10,    // tối đa 10 connection song song
  queueLimit:        0,     // queue không giới hạn khi pool đầy
  timezone:          "Z",   // lưu datetime dạng UTC
});

// Kiểm tra kết nối DB khi server khởi động, báo lỗi ngay thay vì để âm thầm
// đến khi có request đầu tiên.
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