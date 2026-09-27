/* ================= search ================= */
let sItems = [], sSel = 0;
function openSearch() { show("#search"); $("#sInput").value = ""; runSearch(); sfx("select"); setTimeout(() => $("#sInput").focus(), 20); }
function runSearch() {
  const q = $("#sInput").value.trim().toLowerCase();
  sItems = state.channels.filter(c => !q || [c.name, c.desc, c.notes, c.url, ...(c.tags || []), (state.pages[pageOf(c)] || {}).name].join(" ").toLowerCase().includes(q))
    .sort((a, b) => (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name));
  sSel = 0; drawResults();
}
function drawResults() {
  const box = $("#sResults"); box.innerHTML = "";
  if (!sItems.length) { box.innerHTML = '<div class="empty-note">No channels match. Try a tag like "free" or a site name.</div>'; return; }
  sItems.forEach((c, i) => {
    const r = document.createElement("button"); r.className = "result" + (i === sSel ? " sel" : "");
    const m = document.createElement("div"); m.className = "mini"; const sc = document.createElement("div"); sc.className = "screen"; fillScreen(sc, c); m.appendChild(sc);
    const t = document.createElement("div"); t.className = "rt"; const b = document.createElement("b"); b.textContent = c.name;
    const s = document.createElement("span"); s.textContent = c.desc || domainOf(c.url); t.append(b, s);
    r.append(m, t);
    r.onclick = () => pickResult(i); r.onpointerenter = () => { if (sSel !== i) { sSel = i; sfx("hover", i % PER, tileWorld(c)); [...box.children].forEach((n, j) => n.classList.toggle("sel", j === i)); } };
    box.appendChild(r);
  });
}
function pickResult(i) {
  const c = sItems[i]; if (!c) return; hide("#search");
  goPage(pageOf(c), true); render();
  const tile = track.querySelector(`[data-id="${c.id}"]`);
  setTimeout(() => openPreview(c, tile), reduceMotion ? 0 : 380);
}
$("#sInput").addEventListener("input", runSearch);
$("#sInput").addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault(); if (!sItems.length) return;
    sSel = (sSel + (e.key === "ArrowDown" ? 1 : -1) + sItems.length) % sItems.length; sfx("hover", sSel % PER); drawResults();
    $("#sResults").children[sSel]?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") { e.preventDefault(); pickResult(sSel); }
});
$("#search").addEventListener("click", e => { if (e.target.id === "search") { hide("#search"); sfx("back"); } });
$("#searchBtn").onclick = openSearch;
function openKeys() { show("#keys"); sfx("select"); setTimeout(() => $("#kClose").focus(), 20); }
$("#keysBtn").onclick = openKeys;
$("#kClose").onclick = () => { hide("#keys"); sfx("back"); };
$("#keys").addEventListener("click", e => { if (e.target.id === "keys") { hide("#keys"); sfx("back"); } });

/* ================= edit mode ================= */
$("#editBtn").onclick = () => { if (visiting) return; editMode = !editMode; sfx(editMode ? "confirm" : "back"); render(); toast(editMode ? "Edit mode on" : "Edit mode off"); };

