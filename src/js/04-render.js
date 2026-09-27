/* ================= render ================= */
const track = $("#track");
function render() {
  track.innerHTML = "";
  state.pages.forEach((p, pi) => {
    const pg = document.createElement("div"); pg.className = "page";
    const grid = document.createElement("div"); grid.className = "grid"; grid.setAttribute("role", "group"); grid.setAttribute("aria-label", p.name);
    for (let s = 0; s < PER; s++) {
      const c = chAt(p.id, s);
      const b = document.createElement("button");
      b.dataset.page = pi; b.dataset.slot = s;
      if (c) {
        b.className = "slot tile"; b.dataset.id = c.id; b.setAttribute("aria-label", c.name);
        const ob = document.createElement("span"); ob.className = "orbit"; b.appendChild(ob);
        const sc = document.createElement("div"); sc.className = "screen";
        if (c.kind === "flow") { b.classList.add("flow"); fillFlowTile(sc, c); } else fillScreen(sc, c);
        b.appendChild(sc);
        const np = document.createElement("div"); np.className = "nameplate"; np.textContent = c.name; b.appendChild(np);
      } else {
        b.className = "slot empty"; b.setAttribute("aria-label", "Empty slot, add a channel");
        b.innerHTML = '<span class="plus" aria-hidden="true">+</span>';
      }
      grid.appendChild(b);
    }
    pg.appendChild(grid); track.appendChild(pg);
  });
  $("#menuEmpty").hidden = state.channels.length > 0;
  if (page >= state.pages.length) page = state.pages.length - 1;
  document.body.classList.toggle("editing", editMode);
  $("#editBtn").classList.toggle("on", editMode);
  goPage(page, true);
}
function goPage(i, silent) {
  const n = state.pages.length;
  i = Math.max(0, Math.min(n - 1, i));
  if (i !== page && !silent) sfx("page");
  page = i;
  track.style.transform = `translateX(${-100 * page}%)`;
  [...track.children].forEach((pg, pi) => { pg.inert = pi !== page; pg.classList.toggle("current", pi === page); });
  $("#prev").hidden = page === 0; $("#next").hidden = page === n - 1;
  const dots = $("#dots"); dots.innerHTML = "";
  if (n > 1) state.pages.forEach((p, pi) => {
    const d = document.createElement("button"); d.className = "dot" + (pi === page ? " on" : "");
    d.setAttribute("aria-label", "Go to " + p.name); d.dataset.tip = p.name; d.dataset.index = pi;
    d.onclick = () => goPage(pi); d.onpointerenter = () => sfx("tick"); dots.appendChild(d);
  });
  setStatus();
  if (state.pages[page]) setMusicWorld(pageWorld(state.pages[page].id));
}
function setStatus(c) {
  const st = $("#status");
  if (c) { st.innerHTML = ""; const b = document.createElement("b"); b.textContent = c.name; const s = document.createElement("span");
    s.textContent = c.desc || (c.kind === "flow" ? flowSteps(c).length + " step workflow" : domainOf(c.url)); st.append(b, s); }
  else {
    const p = state.pages[page];
    st.innerHTML = ""; const b = document.createElement("b"); b.textContent = p ? p.name : "";
    const s = document.createElement("span");
    s.textContent = editMode ? "Editing. Drag tiles to rearrange, click one to change it." : (state.pages.length > 1 ? `Page ${page + 1} of ${state.pages.length}` : "");
    st.append(b, s);
  }
}

/* ================= tile interaction ================= */
track.addEventListener("pointerover", e => {
  const b = e.target.closest(".slot"); if (!b || b.contains(e.relatedTarget)) return;
  hoverSlot(b);
});
track.addEventListener("focusin", e => { const b = e.target.closest(".slot"); if (b) hoverSlot(b); });
track.addEventListener("pointerout", e => {
  const b = e.target.closest(".slot"); if (!b || b.contains(e.relatedTarget)) return;
  if (!e.relatedTarget || !e.relatedTarget.closest(".slot")) setStatus();
});
function hoverSlot(b) {
  const c = b.dataset.id && state.channels.find(x => x.id === b.dataset.id);
  if (c) { sfx("hover", +b.dataset.slot, tileWorld(c)); setStatus(c); }
  else { sfx("tick"); setStatus(); }
}
track.addEventListener("click", e => {
  if (suppressClick) return;
  const b = e.target.closest(".slot"); if (!b) return;
  const c = b.dataset.id && state.channels.find(x => x.id === b.dataset.id);
  if (c && !editMode) openPreview(c, b);
  else if (c) openEditor(c);
  else openEditor(null, state.pages[+b.dataset.page].id, +b.dataset.slot);
});
$("#prev").onclick = () => goPage(page - 1);
$("#next").onclick = () => goPage(page + 1);
$("#emptyAdd").onclick = () => openEditor(null, state.pages[page].id, 0);

// swipe
let sx = null;
$("#viewport").addEventListener("touchstart", e => { sx = (editMode && e.target.closest(".slot.tile")) ? null : e.touches[0].clientX; }, { passive: true });
$("#viewport").addEventListener("touchend", e => {
  if (sx == null || drag) return; const dx = e.changedTouches[0].clientX - sx; sx = null;
  if (Math.abs(dx) > 60) goPage(page + (dx < 0 ? 1 : -1));
});
// wheel
let wheelLock = 0;
$("#viewport").addEventListener("wheel", e => {
  if (anyOverlay()) return;
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(d) < 25 || Date.now() < wheelLock) return;
  wheelLock = Date.now() + 650; goPage(page + (d > 0 ? 1 : -1));
}, { passive: true });

