"use strict";

const http = require("http");
const { handleRequest } = require("./src/api/routes");

// Tạo HTTP server và bắt đầu lắng nghe trên port được truyền vào.
function startServer(port) {
  const server = http.createServer(handleRequest);
  server.listen(port, () => {
    console.log(`ViruSecurity backend running → http://localhost:${port}`);
    console.log(`Health check               → http://localhost:${port}/health`);
  });
  return server;
}

module.exports = { startServer };