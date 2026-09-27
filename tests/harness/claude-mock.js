// In-page stand-in for the artifact runtime's `window.claude.use(name)`.
// Loaded before the app by tests (and by `?as=` local runs), talking to
// tests/harness/server.mjs. It covers the parts of db / room / user /
// downloads the app uses; it is not a full implementation of the contract.
(() => {
  const cfg = Object.assign({ uid: null, name: "", level: "view", guest: false }, window.__MOCK || {});
  const isOwner = cfg.level === "owner";
  const peerId = Math.random().toString(36).slice(2, 10);
  const clone = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
  const docs = new Map(), users = {}, peerMap = new Map();
  const docL = new Map(), queryL = new Set(), peerL = new Set(), topicL = new Map(), connL = new Set();
  let connected = false, myPresence = {};
  let readyResolve; const ready = new Promise(r => { readyResolve = r; });

  const parent = p => p.split("/").slice(0, -1).join("/");
  const snapOf = (path, meta) => {
    const has = docs.has(path), d = has ? clone(docs.get(path)) : undefined;
    return { id: path.split("/").pop(), exists: has, data: () => clone(d), metadata: meta || { fromCache: false, hasPendingWrites: false } };
  };
  const matches = (d, [f, op, v]) => {
    const x = d ? d[f] : undefined;
    switch (op) {
      case "==": return x === v; case "!=": return x !== v;
      case "<": return x < v; case "<=": return x <= v; case ">": return x > v; case ">=": return x >= v;
      case "in": return v.includes(x); case "not-in": return !v.includes(x);
      case "array-contains": return Array.isArray(x) && x.includes(v);
    }
    return false;
  };
  function runQuery(q) {
    let rows = [...docs.keys()].filter(p => parent(p) === q.path).filter(p => q.where.every(w => matches(docs.get(p), w)));
    if (q.order) { const [f, dir] = q.order; rows.sort((a, b) => ((docs.get(a)[f] > docs.get(b)[f]) - (docs.get(a)[f] < docs.get(b)[f])) * (dir === "desc" ? -1 : 1)); }
    else rows.sort();
    if (q.lim) rows = rows.slice(0, q.lim);
    return rows;
  }
  function deliverQuery(l) {
    const rows = runQuery(l.q), snaps = rows.map(p => snapOf(p));
    const prev = l.prev || [], changes = [];
    rows.forEach((p, i) => { const j = prev.indexOf(p); if (j < 0) changes.push({ type: "added", doc: snaps[i], oldIndex: -1, newIndex: i }); else changes.push({ type: "modified", doc: snaps[i], oldIndex: j, newIndex: i }); });
    prev.forEach((p, j) => { if (!rows.includes(p)) changes.push({ type: "removed", doc: snapOf(p), oldIndex: j, newIndex: -1 }); });
    l.prev = rows;
    l.next({ docs: snaps, size: snaps.length, empty: !snaps.length, docChanges: () => changes, metadata: { fromCache: false, hasPendingWrites: false } });
  }
  function docChanged(path) {
    (docL.get(path) || new Set()).forEach(fn => fn(snapOf(path)));
    queryL.forEach(l => { if (l.q.path === parent(path)) deliverQuery(l); });
  }

  async function write(op, path, data) {
    await ready;
    const r = await fetch("/mock/write", { method: "POST", body: JSON.stringify({ op, path, data, uid: cfg.uid, level: cfg.level }) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw { code: e.code || "unavailable", message: e.message || "write failed" }; }
  }
  function query(path, q = { where: [], order: null, lim: 0 }) {
    const self = {
      path,
      where: (f, op, v) => query(path, { ...q, where: [...q.where, [f, op, v]] }),
      orderBy: (f, dir = "asc") => query(path, { ...q, order: [f, dir] }),
      limit: n => query(path, { ...q, lim: n }),
      get: async () => { await ready; const snaps = runQuery({ path, ...q }).map(p => snapOf(p)); return { docs: snaps, size: snaps.length, empty: !snaps.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } }; },
      onSnapshot(next) { const l = { q: { path, ...q }, next }; ready.then(() => { queryL.add(l); deliverQuery(l); }); return () => queryL.delete(l); },
      doc: id => docRef(path + "/" + (id || Math.random().toString(36).slice(2, 12))),
      add: async data => { const d = docRef(path + "/" + Math.random().toString(36).slice(2, 12)); await d.set(data); return d; },
    };
    return self;
  }
  function docRef(path) {
    if (path.split("/").length % 2) throw new TypeError("document path needs an even number of segments: " + path);
    return {
      id: path.split("/").pop(), path,
      get: async () => { await ready; return snapOf(path); },
      set: data => write("set", path, data),
      update: data => write("update", path, data),
      delete: () => write("delete", path),
      acquire: async () => ({ acquired: true }),
      onSnapshot(next) {
        if (!docL.has(path)) docL.set(path, new Set());
        ready.then(() => { docL.get(path).add(next); next(snapOf(path)); });
        return () => docL.get(path).delete(next);
      },
      collection: sub => query(path + "/" + sub),
    };
  }
  const db = { doc: docRef, collection: p => query(p) };

  const peerObj = p => Object.freeze({ peer: p.peer, by: p.by, guest: !!p.guest, isMe: p.peer === peerId, sameTab: p.peer === peerId, kind: "viewer",
    presence: Object.freeze(p.presence || {}), updatedAt: p.updatedAt || Date.now() });
  let peerSnap = Object.freeze([]);
  function emitPeers(joined = [], left = [], updated = []) {
    peerSnap = Object.freeze([...peerMap.values()].map(peerObj));
    const ch = { peers: peerSnap, joined: joined.map(peerObj), left: left.map(peerObj), updated: updated.map(peerObj) };
    peerL.forEach(fn => fn(ch));
  }
  let presTimer = null;
  const room = {
    peers: () => peerSnap,
    connected: () => connected,
    onConnection(fn) { connL.add(fn); queueMicrotask(() => fn(connected)); return () => connL.delete(fn); },
    onPeers(fn) { peerL.add(fn); ready.then(() => fn({ peers: peerSnap, joined: peerSnap, left: [], updated: [] })); return () => peerL.delete(fn); },
    async presence(patch) {
      for (const [k, v] of Object.entries(patch)) { if (v === null) delete myPresence[k]; else myPresence[k] = clone(v); }
      if (JSON.stringify(myPresence).length > 4096) throw { code: "invalid_argument", message: "presence over 4 KiB" };
      clearTimeout(presTimer);
      presTimer = setTimeout(() => fetch("/mock/presence", { method: "POST", body: JSON.stringify({ peer: peerId, presence: myPresence }) }), 30);
    },
    async emit(topic, data) { await fetch("/mock/emit", { method: "POST", body: JSON.stringify({ peer: peerId, topic, data }) }); },
    on(topic, fn) { if (!topicL.has(topic)) topicL.set(topic, new Set()); topicL.get(topic).add(fn); return () => topicL.get(topic).delete(fn); },
    canSendToClaudeSession: async () => "off",
    sendToClaudeSession: async () => { throw { code: "claude_unavailable", message: "mock" }; },
  };

  const avatar = (id, name) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="20" fill="#8aa"/><text x="20" y="26" font-size="16" text-anchor="middle" fill="#fff">${(name || "?")[0]}</text></svg>`);
  const profile = id => ({ id, name: users[id] || "", avatarUrl: avatar(id, users[id]), color: "#5A8FD8", email: null, isMe: id === cfg.uid, guest: false });
  const user = {
    isOwner: async () => isOwner,
    canEdit: async () => isOwner || cfg.level === "admin",
    can: async n => n === "data.write" ? ["interact", "admin", "owner"].includes(cfg.level) : ["files.write", "assets.write"].includes(n) ? (isOwner || cfg.level === "admin") : false,
    id: async () => cfg.uid,
    me: async () => ({ id: cfg.uid, name: cfg.name || "", avatarUrl: avatar(cfg.uid, cfg.name), color: "#5A8FD8", email: null, isOwner, canEdit: isOwner || cfg.level === "admin" }),
    name: async () => cfg.name || "",
    profiles: async ids => { await ready; const out = {}; [].concat(ids).forEach(id => { out[id] = profile(id); }); return out; },
    search: async () => [],
  };
  window.__downloads = [];
  const downloads = { save: async ({ filename, data }) => { window.__downloads.push({ filename, size: data.size || data.length || data.byteLength || 0 }); return { status: "saved" }; } };

  const es = new EventSource(`/mock/stream?peer=${peerId}&uid=${encodeURIComponent(cfg.uid || "")}&name=${encodeURIComponent(cfg.name || "")}&level=${cfg.level}&guest=${cfg.guest ? 1 : 0}`);
  es.onmessage = m => {
    const ev = JSON.parse(m.data);
    if (ev.type === "hello") {
      Object.entries(ev.docs).forEach(([p, d]) => docs.set(p, d));
      Object.assign(users, ev.users);
      ev.peers.forEach(p => peerMap.set(p.peer, { ...p, updatedAt: Date.now() }));
      connected = true; connL.forEach(fn => fn(true));
      peerSnap = Object.freeze([...peerMap.values()].map(peerObj));
      readyResolve();
    } else if (ev.type === "doc") {
      if (ev.data === null) docs.delete(ev.path); else docs.set(ev.path, ev.data);
      docChanged(ev.path);
    } else if (ev.type === "peer") {
      const had = peerMap.has(ev.peer); peerMap.set(ev.peer, { ...ev, updatedAt: Date.now() });
      emitPeers(had ? [] : [ev], [], had ? [ev] : []);
    } else if (ev.type === "left") {
      const p = peerMap.get(ev.peer); if (!p) return; peerMap.delete(ev.peer); emitPeers([], [p], []);
    } else if (ev.type === "user") users[ev.id] = ev.name;
    else if (ev.type === "emit") (topicL.get(ev.topic) || new Set()).forEach(fn => fn({ topic: ev.topic, data: ev.data, peer: ev.peer, by: ev.by, guest: ev.guest, isMe: ev.peer === peerId, sameTab: ev.peer === peerId, kind: "viewer" }));
  };

  const ns = { db, room, user, downloads, assets: null, sample: null };
  window.claude = { use: name => new Promise(r => setTimeout(() => r(ns[name] || null), 5)) };
})();
