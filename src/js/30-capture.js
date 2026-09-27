/* ================= capture: undo, quick add, bookmark import ================= */
// A toast with one action button ("Undo"). The plain toast() stays for messages.
function toastAction(msg, label, fn, ms = 6000) {
  const t = $("#toast"); t.textContent = "";
  const span = document.createElement("span"); span.textContent = msg;
  const b = document.createElement("button"); b.type = "button"; b.className = "toast-act"; b.textContent = label;
  b.onclick = () => { t.classList.remove("show", "has-act"); fn(); };
  t.append(span, b); t.classList.add("show", "has-act");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show", "has-act"), ms);
}

/* ---------- undo: snapshots of my space before each bigger change ---------- */
const undoStack = [];
function checkpoint(label) {
  if (visiting) return;
  undoStack.push({ label, data: JSON.stringify(state) });
  if (undoStack.length > 20) undoStack.shift();
  noteVersion(label);
}
function undo() {
  const last = undoStack.pop();
  if (!last || visiting) { toast("Nothing to undo"); return; }
  state = normalize(JSON.parse(last.data)); applyPrivate(state);
  persist(state); render(); sfx("back"); toast("Undid: " + last.label);
}
addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !e.target.matches("input,textarea,select") && !anyOverlay()) {
    e.preventDefault(); undo();
  }
});

/* ---------- quick add: paste or drop a link anywhere on the menu ---------- */
const looksLikeUrl = t => /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#][^\s]*)?$/i.test(t.trim());
function nameFromHost(host) {
  const parts = host.replace(/^(www|app|m)\./, "").split(".");
  const word = parts.length > 2 && parts[parts.length - 2].length <= 3 ? parts[parts.length - 3] : parts[0];
  return word.charAt(0).toUpperCase() + word.slice(1);
}
function quickAdd(raw, title) {
  if (visiting) { toast("Go home to add channels to your space."); return; }
  let url = raw.trim(); if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  let host = ""; try { const u = new URL(url); if (/\./.test(u.hostname)) host = u.hostname.replace(/^www\./, ""); } catch {}
  if (!host) { toast("That doesn't look like a link."); sfx("error"); return; }
  const dup = state.channels.find(c => c.url === url);
  if (dup) { toast(dup.name + " is already on your menu"); openPreview(dup, track.querySelector(`[data-id="${dup.id}"]`)); return; }
  checkpoint("add " + host);
  const pid = state.pages[page].id;
  let target = firstFree(pid) >= 0 ? pid : (state.pages.find(p => firstFree(p.id) >= 0) || {}).id;
  if (!target) { target = uid(); state.pages.push({ id: target, name: "New page" }); }
  const c = { id: uid(), name: (title || "").trim().slice(0, 60) || nameFromHost(host), url, desc: "", tags: [], notes: "", icon: "",
    hue: Math.floor(Math.random() * 360), page: target, slot: firstFree(target) };
  state.channels.push(c);
  state = normalize(state); persist(state); render(); goPage(pageOf(c), true);
  sfx("confirm");
  toastAction("Added " + c.name, "Undo", undo);
  autoDescribe(c.id);
}
// if Claude is available, fill in a description, tags and an icon in the background
async function autoDescribe(id) {
  if (!sample) return;
  const c = byId(id); if (!c) return;
  try {
    const out = await sample.json(
      `You help a videographer, 3D artist and game developer organize creative bookmarks.\nLink: ${c.url}\n` +
      `From what you know about this site (don't invent specifics you aren't sure of), return JSON only: ` +
      `{"name": "the site's usual short name", "desc": "one or two plain sentences on what it's useful for in a creative workflow, under 220 characters", ` +
      `"tags": ["2 to 4 short lowercase tags"], "icon": "one fitting emoji"}`, { modelTier: "quick" });
    const cur = byId(id); if (!cur || visiting) return;
    if (out && typeof out.name === "string" && out.name.trim() && cur.name === nameFromHost(new URL(cur.url).hostname.replace(/^www\./, ""))) cur.name = out.name.trim().slice(0, 60);
    if (out && typeof out.desc === "string" && !cur.desc) cur.desc = out.desc.slice(0, 400);
    if (out && Array.isArray(out.tags) && !cur.tags.length) cur.tags = out.tags.filter(t => typeof t === "string").slice(0, 4).map(t => t.slice(0, 30));
    if (out && typeof out.icon === "string" && !cur.icon && !cur.iconAsset && !cur.iconData) cur.icon = out.icon.slice(0, 4);
    persist(state); render();
  } catch {}
}
document.addEventListener("paste", e => {
  if (e.target.matches && e.target.matches("input,textarea,select,[contenteditable]") || anyOverlay() || visiting) return;
  const text = (e.clipboardData && e.clipboardData.getData("text/plain") || "").trim();
  if (!text || /\s/.test(text) || !looksLikeUrl(text)) return;
  e.preventDefault(); quickAdd(text);
});
// links dragged from the browser (address bar, a page) arrive as text/uri-list
const hasLink = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes("text/uri-list") && !hasFiles(e);
addEventListener("dragover", e => { if (hasLink(e) && !anyOverlay() && !visiting) { e.preventDefault(); $("#viewport").classList.add("link-over"); } });
addEventListener("dragleave", e => { if (!e.relatedTarget) $("#viewport").classList.remove("link-over"); });
addEventListener("drop", e => {
  $("#viewport").classList.remove("link-over");
  if (!hasLink(e) || anyOverlay() || visiting) return;
  e.preventDefault();
  const uri = e.dataTransfer.getData("text/uri-list").split(/\r?\n/).find(l => l && !l.startsWith("#"));
  const html = e.dataTransfer.getData("text/html"), title = html ? (new DOMParser().parseFromString(html, "text/html").body.textContent || "") : "";
  if (uri && /^https?:/i.test(uri)) quickAdd(uri, title.trim() && title.trim() !== uri ? title : "");
});

/* ---------- import browser bookmarks (the bookmarks.html every browser exports) ---------- */
let bmGroups = [];
function parseBookmarks(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const groups = [], seen = new Set();
  const walk = (dl, name) => {
    const g = { name, links: [], on: true };
    [...dl.children].forEach(dt => {
      const a = dt.querySelector(":scope > a"), h = dt.querySelector(":scope > h3"), sub = dt.querySelector(":scope > dl");
      if (a && /^https?:\/\//i.test(a.getAttribute("href") || "")) {
        const u = a.getAttribute("href");
        if (!seen.has(u)) { seen.add(u); g.links.push({ name: (a.textContent || "").trim().slice(0, 60), url: u }); }
      } else if (h && sub) walk(sub, (h.textContent || "").trim().slice(0, 30) || "Folder");
    });
    if (g.links.length) groups.push(g);
  };
  const top = doc.querySelector("dl"); if (top) walk(top, "Bookmarks");
  return groups;
}
$("#stBookmarks").onclick = () => $("#bmFile").click();
$("#bmFile").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    bmGroups = parseBookmarks(await f.text());
    const have = new Set(state.channels.map(c => c.url));
    bmGroups.forEach(g => { g.links = g.links.filter(l => !have.has(l.url)); g.on = g.links.length > 0 && g.links.length <= 60; });
    bmGroups = bmGroups.filter(g => g.links.length);
    if (!bmGroups.length) { toast("No new bookmarks found in that file."); return; }
    hide("#settings"); renderBookmarks(); show("#bmSheet"); sfx("select");
  } catch { toast("That file isn't a bookmarks export. In your browser, export bookmarks as HTML."); }
};
function renderBookmarks() {
  const box = $("#bmList"); box.innerHTML = "";
  bmGroups.forEach(g => {
    const row = document.createElement("label"); row.className = "bm-row";
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = g.on;
    cb.onchange = () => { g.on = cb.checked; renderBookmarksCount(); sfx("tick"); };
    const t = document.createElement("div"); t.className = "pp-text";
    const b = document.createElement("b"); b.textContent = g.name;
    const s = document.createElement("span"); s.textContent = g.links.length + (g.links.length === 1 ? " link: " : " links: ") + g.links.slice(0, 4).map(l => l.name || domainOf(l.url)).join(", ") + (g.links.length > 4 ? "…" : "");
    t.append(b, s); row.append(cb, t); box.appendChild(row);
  });
  renderBookmarksCount();
}
function renderBookmarksCount() {
  const n = bmGroups.filter(g => g.on).reduce((a, g) => a + g.links.length, 0);
  $("#bmGo").disabled = !n || n > 400;
  $("#bmGo").textContent = n ? `Import ${n} ${n === 1 ? "bookmark" : "bookmarks"}` : "Import";
  $("#bmHint").textContent = n > 400 ? "That's a lot for one menu. Pick 400 or fewer at a time." : "Each folder becomes a page (or a few, 12 tiles each). Links already on your menu are skipped.";
}
$("#bmGo").onclick = () => {
  const groups = bmGroups.filter(g => g.on); if (!groups.length) return;
  checkpoint("import bookmarks");
  let added = 0; const firstNew = state.pages.length;
  groups.forEach((g, gi) => {
    for (let i = 0; i < g.links.length; i += PER) {
      const p = { id: uid(), name: (g.name + (i ? " " + (i / PER + 1) : "")).slice(0, 30) };
      state.pages.push(p);
      g.links.slice(i, i + PER).forEach((l, j) => {
        let host = ""; try { host = new URL(l.url).hostname.replace(/^www\./, ""); } catch { return; }
        state.channels.push({ id: uid(), name: l.name || nameFromHost(host), url: l.url, desc: "", tags: [], notes: "", icon: "",
          hue: (gi * 47 + j * 9) % 360, page: p.id, slot: j });
        added++;
      });
    }
  });
  state = normalize(state); persist(state); hide("#bmSheet"); render();
  goPage(firstNew, true);
  sfx("complete"); toastAction(`Imported ${added} bookmarks`, "Undo", undo, 8000);
};
const closeBm = () => { hide("#bmSheet"); sfx("back"); };
$("#bmClose").onclick = closeBm; $("#bmCancel").onclick = closeBm;
