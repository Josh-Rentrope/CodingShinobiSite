import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "Vanilla");
const port = Number(process.env.PORT ?? 4173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  let file;
  try {
    file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
  } catch {
    file = "";
  }
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  const respond = (file, stats) => {
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": stats.size,
    });
    fs.createReadStream(file).pipe(res);
  };

  fs.stat(file, (err, stats) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    if (stats.isDirectory()) {
      // Resolve clean routes like /September-2026-Recap to their index.html
      const index = path.join(file, "index.html");
      fs.stat(index, (err2, stats2) => {
        if (err2 || !stats2.isFile()) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        respond(index, stats2);
      });
      return;
    }
    if (!stats.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    respond(file, stats);
  });
});

server.listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}`);
});
