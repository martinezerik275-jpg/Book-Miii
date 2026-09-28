// Local stand-in for the claude.ai artifact host, for tests and local runs.
// Serves the built page plus a fake `db` / `room` / `user` backend that the
// in-page mock (claude-mock.js) talks to over fetch + Server-Sent Events.
//
//   node tests/harness/server.mjs            # http://localhost:4173/?test&as=owner
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { access } from "./rules.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = +process.env.PORT || 4173;
const rules = JSON.parse(readFileSync(join(root, "src/capabilities.json"), "utf8")).db.rules;

let docs = new Map();          // path -> body
let peers = new Map();         // peer -> { peer, by, guest, presence, res, uid, level }
let users = new Map();         // uid -> name

const clone = x => JSON.parse(JSON.stringify(x));
const isObj = x => x && typeof x === "object" && !Array.isArray(x);
function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = isObj(v) && isObj(a[k]) ? merge(a[k], v) : v;
  return out;
}
function send(res, ev) { res.write(`data: ${JSON.stringify(ev)}\n\n`); }
function visibleDocs(uid, level) {
  const out = {};
  for (const [p, d] of docs) if (access(rules, p, uid, level).read) out[p] = d;
  return out;
}
function broadcastDoc(path) {
  for (const c of peers.values()) {
    if (!access(rules, path, c.uid, c.level).read) continue;
    send(c.res, { type: "doc", path, data: docs.has(path) ? docs.get(path) : null });
  }
}
const peerView = p => ({ peer: p.peer, by: p.by, guest: p.guest, presence: p.presence });
function broadcast(ev) { for (const c of peers.values()) send(c.res, ev); }

async function body(req) {
  let s = ""; for await (const ch of req) s += ch; return s ? JSON.parse(s) : {};
}
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json" };
function file(res, p) {
  if (!existsSync(p)) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  res.end(readFileSync(p));
}

// claude.ai publishes the page inside its own skeleton, whose styles come first. Serve the same so
// anything the page forgets to set (body text colour, font, color-scheme) shows up here too.
const SKELETON = "<style>:root{color-scheme:light}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}</style>";
function page(res) {
  const p = join(root, "dist/studio-menu.html");
  if (!existsSync(p)) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": TYPES[".html"], "cache-control": "no-store" });
  res.end(readFileSync(p, "utf8").replace(/<head>/i, "<head>" + SKELETON));
}

createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const q = Object.fromEntries(u.searchParams);
  try {
    if (u.pathname === "/" || u.pathname === "/index.html") return page(res);
    if (u.pathname === "/mock/claude-mock.js") return file(res, join(root, "tests/harness/claude-mock.js"));
    if (u.pathname.startsWith("/vendor/three/")) return file(res, join(root, "node_modules/three/build", u.pathname.slice(14)));

    if (u.pathname === "/mock/stream") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      const p = { peer: q.peer, by: q.uid || null, guest: q.guest === "1", presence: {}, res, uid: q.uid || null, level: q.level };
      if (q.uid && q.name) users.set(q.uid, q.name);
      peers.set(p.peer, p);
      send(res, { type: "hello", docs: visibleDocs(p.uid, p.level), peers: [...peers.values()].map(peerView), users: Object.fromEntries(users) });
      broadcast({ type: "peer", ...peerView(p) });
      if (q.uid && q.name) broadcast({ type: "user", id: q.uid, name: q.name });
      req.on("close", () => { peers.delete(p.peer); broadcast({ type: "left", peer: p.peer }); });
      return;
    }
    if (u.pathname === "/mock/write" && req.method === "POST") {
      const { op, path, data, uid, level } = await body(req);
      if (!access(rules, path, uid, level).write) {
        res.writeHead(403, { "content-type": "application/json" });
        return res.end(JSON.stringify({ code: "invalid_argument", message: "write not permitted at " + path }));
      }
      if (op === "delete") docs.delete(path);
      else if (op === "update") {
        if (!docs.has(path)) { res.writeHead(400); return res.end(JSON.stringify({ code: "invalid_argument", message: "no such document" })); }
        docs.set(path, merge(docs.get(path), data));
      } else docs.set(path, clone(data));
      broadcastDoc(path);
      res.writeHead(200); return res.end("{}");
    }
    if (u.pathname === "/mock/presence" && req.method === "POST") {
      const { peer, presence } = await body(req);
      const p = peers.get(peer); if (!p) { res.writeHead(404); return res.end("{}"); }
      p.presence = presence; broadcast({ type: "peer", ...peerView(p) });
      res.writeHead(200); return res.end("{}");
    }
    if (u.pathname === "/mock/emit" && req.method === "POST") {
      const { peer, topic, data } = await body(req);
      const p = peers.get(peer); if (p) broadcast({ type: "emit", topic, data, peer, by: p.by, guest: p.guest });
      res.writeHead(200); return res.end("{}");
    }
    // test control
    if (u.pathname === "/mock/reset" && req.method === "POST") {
      const { docs: seed = {}, users: us = {} } = await body(req);
      docs = new Map(Object.entries(seed)); users = new Map(Object.entries(us));
      res.writeHead(200); return res.end("{}");
    }
    if (u.pathname === "/mock/docs") {
      res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(Object.fromEntries(docs)));
    }
    res.writeHead(404); res.end("not found");
  } catch (e) {
    res.writeHead(500); res.end(String(e && e.stack || e));
  }
}).listen(PORT, () => console.log(`studio-menu test host on http://localhost:${PORT}`));
