// Kleiner lokaler Server zum Testen der App: node serve.mjs → http://localhost:5174
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = join(import.meta.dirname, "essen-match-app");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json" };

http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = normalize(join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": (types[extname(file)] || "application/octet-stream") + "; charset=utf-8" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nicht gefunden"); }
}).listen(5174, () => console.log("http://localhost:5174 →", root));
