"use strict";

// Ghi response JSON với status code và Content-Length header.
function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type":   "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

// Đọc và parse JSON body từ request stream; trả về {} nếu body rỗng.
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data",  chunk => { raw += chunk; });
    req.on("end",   ()    => {
      try   { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject({ status: 400, message: "Invalid JSON body" }); }
    });
    req.on("error", reject);
  });
}

module.exports = { sendJson, readJsonBody };