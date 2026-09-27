// A small re-implementation of the artifact db access rules (see
// artifact-capabilities db.d.ts), used by the local test server so tests
// exercise the same rules src/capabilities.json declares for production.
const LEVEL = { view: 0, interact: 1, admin: 2, owner: 3 };

export function access(rules, path, uid, level) {
  const segs = path.split("/");
  const lvl = LEVEL[level] ?? -1;
  const isOwner = level === "owner";
  let read = "view", write = "interact", hidden = false;

  const parsed = rules.map(r => ({ ...r, segs: r.path === "" ? [] : r.path.split("/") }))
    .sort((a, b) => a.segs.length - b.segs.length);

  for (const r of parsed) {
    const self = r.segs[r.segs.length - 1] === "{self}";
    const prefix = self ? r.segs.slice(0, -1) : r.segs;
    if (segs.length < r.segs.length) continue;
    if (!prefix.every((s, i) => s === segs[i])) continue;
    if (self) {
      if (segs[prefix.length] !== uid || !uid) {
        // a sibling's {self} subtree: private unless a rule AT the prefix opens it
        const opened = parsed.some(o => o.path === prefix.join("/"));
        if (!opened) hidden = true;
        continue;
      }
    }
    if (r.read) read = r.read;
    if (r.write) write = r.write;
  }
  if (hidden) return { read: false, write: false };
  const meets = need => isOwner || lvl >= LEVEL[need];
  return { read: meets(read), write: meets(write) && lvl >= LEVEL.interact };
}
