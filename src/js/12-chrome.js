/* ================= overlays + keys ================= */
const MODALS = ["#editor", "#settings", "#search", "#keys", "#logos", "#bdSheet", "#plaza", "#clinic", "#people", "#stampSheet", "#photoSheet", "#confirm", "#welcome", "#tour", "#bmSheet", "#stackSheet", "#sesDoneSheet", "#projSheet"];
function show(s) { $(s).classList.add("open"); syncModal(); }
function hide(s) {
  const el = $(s); el.classList.remove("open"); syncModal();
  // don't leave focus inside something hidden, or the next key press goes nowhere
  if (el.contains(document.activeElement)) document.activeElement.blur();
}
function syncModal() { document.body.classList.toggle("modal-open", MODALS.some(m => $(m).classList.contains("open"))); }
const anyOverlay = () => ["#start", "#preview", "#idle", ...MODALS].some(m => $(m).classList.contains("open"));
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if ($("#confirm").classList.contains("open")) closeConfirm(false);
    else if ($("#tour").classList.contains("open")) endTour(false);
    else if ($("#clinic").classList.contains("open")) closeClinic();
    else if ($("#welcome").classList.contains("open")) { closeWelcome(); sfx("back"); }
    else if ($("#photoSheet").classList.contains("open")) { hide("#photoSheet"); sfx("back"); }
    else if ($("#stampSheet").classList.contains("open")) { hide("#stampSheet"); sfx("back"); }
    else if ($("#people").classList.contains("open")) { hide("#people"); sfx("back"); }
    else if ($("#plaza").classList.contains("open")) {
      if (document.activeElement === $("#pzSay")) $("#pzCanvas").focus();
      else if (!$("#pzCard").hidden) $("#pzCard").hidden = true;
      else closePlaza();
    }
    else if ($("#editor").classList.contains("open")) { hide("#editor"); sfx("back"); }
    else if ($("#sesDoneSheet").classList.contains("open")) closeSesDone(false);
    else if ($("#bmSheet").classList.contains("open")) { hide("#bmSheet"); sfx("back"); }
    else if ($("#preview").classList.contains("open") && $("#stackSheet").classList.contains("open")) closePreview();
    else if ($("#stackSheet").classList.contains("open")) closeStack();
    else if ($("#projSheet").classList.contains("open")) closeProject();
    else if ($("#settings").classList.contains("open")) { hide("#settings"); sfx("back"); }
    else if ($("#search").classList.contains("open")) { hide("#search"); sfx("back"); }
    else if ($("#keys").classList.contains("open")) { hide("#keys"); sfx("back"); }
    else if ($("#logos").classList.contains("open")) closeLogos();
    else if ($("#bdSheet").classList.contains("open")) { hide("#bdSheet"); sfx("back"); }
    else if ($("#preview").classList.contains("open")) closePreview();
    else if (editMode) $("#editBtn").click();
    else if (visiting) goHome(true);
    return;
  }
  if (anyOverlay()) return;
  if (e.target.matches("input,textarea,select")) return;
  if (e.key === "/") { e.preventDefault(); openSearch("find"); return; }
  // 1-9 open the tiles on this page, in reading order
  if (/^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
    const b = track.children[page] && track.children[page].querySelectorAll(".slot")[+e.key - 1];
    if (b && b.dataset.id) { e.preventDefault(); b.focus({ preventScroll: true }); b.click(); }
    return;
  }
  if (e.key === "?") { e.preventDefault(); openKeys(); return; }
  if ((e.key === "p" || e.key === "P") && !e.metaKey && !e.ctrlKey && room) { e.preventDefault(); openPlaza(); return; }
  if (e.key === "PageDown" || e.key === "]") { goPage(page + 1); return; }
  if (e.key === "PageUp" || e.key === "[") { goPage(page - 1); return; }
  if (e.key.startsWith("Arrow")) {
    const cur = document.activeElement.closest && document.activeElement.closest(".slot");
    const cols = innerWidth <= 760 ? 3 : 4;
    const pg = track.children[page]; if (!pg) return;
    const slots = [...pg.querySelectorAll(".slot")];
    if (!cur) { e.preventDefault(); slots[0].focus(); return; }
    let i = slots.indexOf(cur); if (i < 0) return;
    e.preventDefault();
    const dx = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0, dy = e.key === "ArrowDown" ? cols : e.key === "ArrowUp" ? -cols : 0;
    if (dx && ((dx > 0 && i % cols === cols - 1) || (dx < 0 && i % cols === 0))) {
      const np = page + dx; if (np < 0 || np >= state.pages.length) return;
      goPage(np); const row = Math.floor(i / cols);
      setTimeout(() => track.children[np].querySelectorAll(".slot")[row * cols + (dx > 0 ? 0 : cols - 1)]?.focus({ preventScroll: true }), 30);
      return;
    }
    const ni = i + dx + dy; if (ni >= 0 && ni < slots.length) slots[ni].focus({ preventScroll: true });
  }
});
$("#preview").addEventListener("click", e => { if (e.target.classList.contains("pv-wrap")) closePreview(); });
$("#editor").addEventListener("click", e => { if (e.target.id === "editor") { hide("#editor"); sfx("back"); } });
$("#settings").addEventListener("click", e => { if (e.target.id === "settings") { hide("#settings"); sfx("back"); } });

/* tooltips + hover ticks for chrome buttons */
const tip = $("#tip");
document.addEventListener("pointerover", e => {
  const t = e.target.closest("[data-tip]");
  if (!t || t.contains(e.relatedTarget)) return;
  if (!t.classList.contains("dot")) sfx("tick");
  const r = t.getBoundingClientRect(); tip.textContent = t.dataset.tip;
  const above = r.top > innerHeight * .5;
  tip.style.left = (r.left + r.width / 2) + "px"; tip.style.top = (above ? r.top - 40 : r.bottom + 10) + "px";
  tip.classList.add("show");
});
document.addEventListener("pointerout", e => { const t = e.target.closest("[data-tip]"); if (t && !t.contains(e.relatedTarget)) tip.classList.remove("show"); });
document.addEventListener("pointerover", e => {
  const p = e.target.closest(".pill,.result,.seg button");
  if (p && !p.contains(e.relatedTarget)) sfx("tick");
});

/* ================= custom cursor ================= */
const cur = $("#cursor");
if (matchMedia("(pointer: fine)").matches) {
  document.body.classList.add("custom-cursor");
  let tx = -100, ty = -100, cx = -100, cy = -100, running = false;
  const loop = () => {
    const k = reduceMotion ? 1 : .35; cx += (tx - cx) * k; cy += (ty - cy) * k;
    if (Math.abs(tx - cx) < .3 && Math.abs(ty - cy) < .3) { cx = tx; cy = ty; running = false; }
    cur.style.transform = `translate3d(${cx}px,${cy}px,0)`;
    if (running) requestAnimationFrame(loop);
  };
  const kick = () => { if (!running) { running = true; requestAnimationFrame(loop); } };
  addEventListener("pointermove", e => {
    tx = e.clientX; ty = e.clientY; kick();
    const hot = e.target.closest && e.target.closest("button,a,.slot,input[type=range],select");
    cur.classList.toggle("hot", !!hot);
  });
  addEventListener("pointerdown", () => cur.classList.add("down"));
  addEventListener("pointerup", () => cur.classList.remove("down"));
  document.addEventListener("pointerleave", () => { tx = ty = -100; kick(); });
}

/* ================= clock ================= */
function tick() {
  const d = new Date();
  $("#time").textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M/i, "");
  if (!$("#date").dataset.focus) $("#date").textContent = d.toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" });
  $("#idleTime").textContent = $("#time").textContent;
  $("#idleDate").textContent = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  if (state) { applyLighting(); if (state.theme === "time") applyTheme(); }
}
let clockT; function scheduleClock() { tick(); clearTimeout(clockT); clockT = setTimeout(scheduleClock, 60000 - Date.now() % 60000 + 50); }
scheduleClock();

