/* ---------- drag to rearrange (edit mode): pick up a tile and carry it anywhere ---------- */
let drag = null, suppressClick = false;
const EDGE = () => (innerWidth <= 760 ? 30 : 76);
track.addEventListener("pointerdown", e => {
  if (!editMode || e.button !== 0 || drag) return;
  const b = e.target.closest(".slot.tile"); if (!b) return;
  drag = { id: b.dataset.id, src: b, x0: e.clientX, y0: e.clientY, pointerId: e.pointerId, active: false,
           ghost: null, over: null, edgeKey: "", edgeT: null, tempPage: null };
});
addEventListener("pointermove", e => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  if (!drag.active) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 7) return;
    startDrag();
  }
  e.preventDefault();
  moveDrag(e.clientX, e.clientY);
}, { passive: false });
addEventListener("pointerup", e => { if (drag && e.pointerId === drag.pointerId) endDrag(e.clientX, e.clientY, true); });
addEventListener("pointercancel", e => { if (drag && e.pointerId === drag.pointerId) endDrag(0, 0, false); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && drag && drag.active) { e.stopImmediatePropagation(); endDrag(0, 0, false); } }, true);

function startDrag() {
  const r = drag.src.getBoundingClientRect();
  try { drag.src.releasePointerCapture(drag.pointerId); } catch {}
  const g = drag.src.cloneNode(true);
  g.className = "slot tile drag-ghost"; g.removeAttribute("data-id"); g.setAttribute("aria-hidden", "true");
  g.style.width = r.width + "px"; g.style.height = r.height + "px";
  drag.dx = drag.x0 - r.left; drag.dy = drag.y0 - r.top;
  document.body.appendChild(g); drag.ghost = g; drag.active = true;
  drag.src.classList.add("dragging"); document.body.classList.add("is-dragging");
  $("#status").innerHTML = "<b>Moving</b><span>Drop on a slot, or hold at the screen edge or a page dot to change pages</span>";
  sfx("select");
}
function markSource() {
  const s = track.querySelector(`[data-id="${drag.id}"]`);
  if (s) s.classList.add("dragging"); drag.src = s; drag.over = null;
}
function moveDrag(x, y) {
  drag.ghost.style.transform = `translate3d(${x - drag.dx}px,${y - drag.dy}px,0) scale(1.1) rotate(-2deg)`;
  const el = document.elementFromPoint(x, y);
  const slot = el && el.closest(".page.current .slot");
  const over = slot && slot.dataset.id !== drag.id ? slot : null;
  if (over !== drag.over) {
    if (drag.over) drag.over.classList.remove("drop-target");
    drag.over = over;
    if (over) { over.classList.add("drop-target"); sfx("hover", +over.dataset.slot); }
  }
  // page changes: hold over a page dot, an arrow, or the left/right edge
  const vr = $("#viewport").getBoundingClientRect();
  const dot = el && el.closest(".dot");
  let key = "";
  if (dot) key = "d" + dot.dataset.index;
  else if (y > vr.top && y < vr.bottom) {
    if (x < vr.left + EDGE() || (el && el.closest("#prev"))) key = "e-1";
    else if (x > vr.right - EDGE() || (el && el.closest("#next"))) key = "e1";
  }
  if (key !== drag.edgeKey) {
    clearTimeout(drag.edgeT); drag.edgeT = null; drag.edgeKey = key;
    if (key) drag.edgeT = setTimeout(() => flipDuring(key), 480);
  }
}
function flipDuring(key) {
  if (!drag || drag.edgeKey !== key) return;
  drag.edgeT = null;
  if (key[0] === "d") { const t = +key.slice(1); if (t !== page) goPage(t); return; }
  const dir = +key.slice(1), np = page + dir;
  if (np < 0) return;
  if (np >= state.pages.length) {
    if (drag.tempPage) return;                       // only one new page per drag
    const id = uid(); drag.tempPage = id;
    state.pages.push({ id, name: "New page" });
    render(); markSource(); toast("New page. Drop the tile here to keep it.");
  }
  goPage(np);
  drag.edgeT = setTimeout(() => flipDuring(key), 900); // keep turning while held at the edge
}
function endDrag(x, y, commit) {
  const d = drag; drag = null;
  if (!d || !d.active) return;                       // a plain click: let the click handler run
  clearTimeout(d.edgeT);
  d.ghost.remove(); document.body.classList.remove("is-dragging");
  track.querySelectorAll(".drop-target,.dragging").forEach(n => n.classList.remove("drop-target", "dragging"));
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
  const c = state.channels.find(ch => ch.id === d.id);
  let moved = false;
  if (commit && c) {
    const el = document.elementFromPoint(x, y);
    const slot = el && el.closest(".page.current .slot");
    const dot = el && el.closest(".dot");
    const into = slot && slot.dataset.id && byId(slot.dataset.id);
    if (into && into.kind === "stack" && into.id !== d.id && !["stack", "project"].includes(c.kind)) {
      // dropping a tile on a stack puts it inside
      checkpoint("move " + c.name + " into " + into.name);
      c.stack = into.id; c.slot = -1; moved = true;
      setTimeout(() => toastAction(c.name + " is now in " + into.name, "Undo", undo), 50);
    } else if (slot && slot.dataset.id !== d.id) {
      const pid = state.pages[+slot.dataset.page].id, s2 = +slot.dataset.slot, other = chAt(pid, s2);
      if (other) { other.page = c.page; other.slot = c.slot; }
      c.page = pid; c.slot = s2; moved = true;
    } else if (dot) {
      const pid = state.pages[+dot.dataset.index].id;
      if (pid !== c.page) {
        const f = firstFree(pid);
        if (f >= 0) { c.page = pid; c.slot = f; moved = true; }
        else toast("That page is full. Open it and drop onto a tile to swap places.");
      }
    }
  }
  const tempEmpty = d.tempPage && !state.channels.some(ch => ch.page === d.tempPage);
  if (tempEmpty) state.pages = state.pages.filter(p => p.id !== d.tempPage);
  if (moved) { sfx("confirm"); save(); } else sfx("back");
  render();
  if (moved) goPage(pageOf(c.stack ? byId(c.stack) : c), true);
}
