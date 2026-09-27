/* ================= idle screen ================= */
let lastActivity = Date.now(), idleOpen = false, idleAt = 0, idlePos = null;
["pointermove", "pointerdown", "keydown", "wheel", "touchstart"].forEach(ev => addEventListener(ev, e => {
  lastActivity = Date.now();
  if (!idleOpen || Date.now() - idleAt < 900) return;
  if (ev === "pointermove") {
    if (!idlePos) { idlePos = [e.clientX, e.clientY]; return; }
    if (Math.hypot(e.clientX - idlePos[0], e.clientY - idlePos[1]) < 12) return;
  }
  if (ev === "keydown") { e.preventDefault(); e.stopPropagation(); }
  exitIdle();
}, { passive: ev !== "keydown", capture: true }));
function enterIdle() {
  if (idleOpen) return;
  idleOpen = true; idleAt = Date.now(); idlePos = null;
  const box = $("#idleFloat"); box.innerHTML = "";
  const pool = state.channels.slice().sort(() => Math.random() - .5).slice(0, 12);
  const W = innerWidth, H = innerHeight;
  pool.forEach((c, i) => {
    const depth = Math.random(), w = Math.round(80 + depth * 110);
    const t = document.createElement("div"); t.className = "float-tile";
    const x0 = Math.random() * (W - w), y0 = Math.random() * (H - w * .6);
    const x1 = Math.max(-w * .3, Math.min(W - w * .7, x0 + (Math.random() - .5) * W * .6));
    const y1 = Math.max(-w * .2, Math.min(H - w * .4, y0 + (Math.random() - .5) * H * .5));
    const dur = 26 + Math.random() * 34;
    Object.entries({ "--w": w + "px", "--o": (.28 + depth * .5).toFixed(2), "--x0": x0 + "px", "--y0": y0 + "px", "--x1": x1 + "px", "--y1": y1 + "px",
      "--r0": ((Math.random() - .5) * 14) + "deg", "--r1": ((Math.random() - .5) * 14) + "deg", "--d": dur + "s", "--dl": (-Math.random() * dur) + "s" })
      .forEach(([k, v]) => t.style.setProperty(k, v));
    t.style.zIndex = Math.round(depth * 10);
    const sc = document.createElement("div"); sc.className = "screen";
    if (c.kind === "flow") { sc.style.setProperty("--h", c.hue); const g = document.createElement("div"); g.className = "glyph"; cardGlyph(g, c); sc.appendChild(g); }
    else fillScreen(sc, c);
    t.appendChild(sc); box.appendChild(t);
  });
  paintIdleToday();
  tick(); show("#idle"); $("#idle").setAttribute("aria-hidden", "false"); tip.classList.remove("show"); document.body.classList.add("idling");
  sfx("idleIn");
}
function exitIdle() {
  if (!idleOpen) return;
  idleOpen = false; hide("#idle"); $("#idle").setAttribute("aria-hidden", "true"); document.body.classList.remove("idling");
  $("#idleFloat").innerHTML = ""; lastActivity = Date.now(); sfx("idleOut");
}
$("#idleBtn").onclick = e => { e.stopPropagation(); enterIdle(); };
setInterval(() => {
  if (!state.idle.on || idleOpen || document.hidden || drag) return;
  if (["#start", ...MODALS].some(m => $(m).classList.contains("open"))) return;
  if (Date.now() - lastActivity > state.idle.mins * 60000) enterIdle();
}, 10000);

