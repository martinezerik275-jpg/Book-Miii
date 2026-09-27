/* ================= search + launcher ================= */
// "find" opens the channel's banner; "launch" (Ctrl/Cmd+K) opens the site straight away.
let sItems = [], sSel = 0, sMode = "find";
function openSearch(mode) {
  sMode = mode === "launch" ? "launch" : "find";
  $("#search").dataset.mode = sMode;
  $("#sInput").placeholder = sMode === "launch" ? "Open a channel: type a few letters, then Enter" : "Search channels, tags, notes";
  show("#search"); $("#sInput").value = ""; runSearch(); sfx("select");
  $("#sInput").focus();          // focus now, so the first letters typed aren't lost
}
const stackOf = c => c.stack && byId(c.stack);
const whereName = c => stackOf(c) ? stackOf(c).name : (state.pages[pageOf(c)] || {}).name;
function runSearch() {
  const q = $("#sInput").value.trim().toLowerCase();
  const byName = (a, b) => a.name.localeCompare(b.name);
  if (!q) {
    const favs = state.channels.filter(c => c.fav).sort(byName);
    const recent = state.channels.filter(c => c.lastOpen && !c.fav).sort((a, b) => b.lastOpen - a.lastOpen).slice(0, 6);
    const rest = state.channels.filter(c => !favs.includes(c) && !recent.includes(c)).sort(byName);
    sItems = [...favs.map(c => ({ c, g: "Favorites" })), ...recent.map(c => ({ c, g: "Recent" })), ...rest.map(c => ({ c, g: favs.length || recent.length ? "Everything else" : "" }))];
  } else {
    const score = c => {
      const n = c.name.toLowerCase();
      if (n.startsWith(q)) return 4;
      if (n.split(/\s+/).some(w => w.startsWith(q))) return 3;
      if (n.includes(q)) return 2;
      return [c.desc, c.notes, c.url, c.client, ...(c.tags || []), whereName(c)].join(" ").toLowerCase().includes(q) ? 1 : 0;
    };
    sItems = state.channels.map(c => ({ c, s: score(c) })).filter(x => x.s)
      .sort((a, b) => b.s - a.s || (b.c.opens || 0) - (a.c.opens || 0) || byName(a.c, b.c)).map(x => ({ c: x.c, g: "" }));
  }
  sSel = 0; drawResults();
}
const opensSite = c => sMode === "launch" && !c.kind && c.url;
function drawResults() {
  const box = $("#sResults"); box.innerHTML = "";
  if (!sItems.length) { box.innerHTML = '<div class="empty-note">No channels match. Try a tag like "free" or a site name.</div>'; return; }
  let group = null;
  sItems.forEach(({ c, g }, i) => {
    if (g && g !== group) { const h = document.createElement("div"); h.className = "result-group"; h.textContent = g; box.appendChild(h); }
    group = g;
    const r = document.createElement(opensSite(c) ? "a" : "button"); r.className = "result" + (i === sSel ? " sel" : ""); r.dataset.i = i;
    if (opensSite(c)) { r.href = c.url; r.target = "_blank"; r.rel = "noopener noreferrer"; }
    const m = document.createElement("div"); m.className = "mini"; const sc = document.createElement("div"); sc.className = "screen";
    if (c.kind === "flow") { sc.style.setProperty("--h", c.hue); const gl = document.createElement("div"); gl.className = "glyph"; cardGlyph(gl, c); sc.appendChild(gl); } else fillScreen(sc, c);
    m.appendChild(sc);
    const t = document.createElement("div"); t.className = "rt"; const b = document.createElement("b"); b.textContent = (c.fav ? "\u2605 " : "") + c.name;
    const sp = document.createElement("span");
    sp.textContent = { flow: "Workflow", stack: "Stack", project: "Project" }[c.kind] ? { flow: "Workflow", stack: "Stack", project: "Project" }[c.kind] + (c.desc ? " \u00b7 " + c.desc : "") : (c.desc || domainOf(c.url));
    t.append(b, sp);
    const k = document.createElement("span"); k.className = "rk"; k.textContent = opensSite(c) ? "Open site \u21b5" : "\u21b5";
    r.append(m, t, k);
    r.onclick = e => pickResult(i, e);
    r.onpointerenter = () => { if (sSel !== i) { sSel = i; sfx("hover", i % PER, tileWorld(c)); box.querySelectorAll(".result").forEach(n => n.classList.toggle("sel", +n.dataset.i === i)); } };
    box.appendChild(r);
  });
}
function pickResult(i, ev) {
  const it = sItems[i]; if (!it) return; const c = it.c;
  hide("#search");
  if (opensSite(c)) {
    // a real link click (mouse, or .click() from Enter) opens the site in a new tab
    if (!ev) { const a = $("#sResults").querySelector(`.result[data-i="${i}"]`); if (a) a.click(); return; }
    noteOpen(c); sfx("launch", 0, tileWorld(c)); return;
  }
  if (ev && ev.preventDefault) ev.preventDefault();
  revealItem(c);
}
// show a channel wherever it lives: its page, or inside its stack
function revealItem(c) {
  const st = stackOf(c);
  goPage(pageOf(st || c), true); render();
  const tile = track.querySelector(`[data-id="${(st || c).id}"]`);
  setTimeout(() => { if (st) { openStack(st, tile); setTimeout(() => openItem(c), 250); } else openItem(c, tile); }, reduceMotion ? 0 : 380);
}
$("#sInput").addEventListener("input", runSearch);
$("#sInput").addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault(); if (!sItems.length) return;
    sSel = (sSel + (e.key === "ArrowDown" ? 1 : -1) + sItems.length) % sItems.length; sfx("hover", sSel % PER); drawResults();
    $("#sResults").querySelector(".result.sel")?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") { e.preventDefault(); pickResult(sSel); }
});
$("#search").addEventListener("click", e => { if (e.target.id === "search") { hide("#search"); sfx("back"); } });
$("#searchBtn").onclick = () => openSearch("find");
function openKeys() { show("#keys"); sfx("select"); setTimeout(() => $("#kClose").focus(), 20); }
$("#keysBtn").onclick = openKeys;
$("#kClose").onclick = () => { hide("#keys"); sfx("back"); };
$("#keys").addEventListener("click", e => { if (e.target.id === "keys") { hide("#keys"); sfx("back"); } });

/* ================= edit mode ================= */
$("#editBtn").onclick = () => { if (visiting) return; editMode = !editMode; sfx(editMode ? "confirm" : "back"); render(); toast(editMode ? "Edit mode on" : "Edit mode off"); };

