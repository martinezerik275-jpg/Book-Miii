/* ================= stacks: a tile that holds tiles ================= */
const membersOf = st => state.channels.filter(c => c.stack === st.id);
function fillStackTile(sc, st) {
  sc.style.setProperty("--h", st.hue);
  const inside = membersOf(st), show = inside.slice(0, 4);
  const fan = document.createElement("div"); fan.className = "fan stack-fan";
  show.forEach((c, i) => {
    const cd = document.createElement("div"); cd.className = "card";
    cd.style.setProperty("--ch", c.hue); cd.style.setProperty("--i", i); cardGlyph(cd, c); fan.appendChild(cd);
  });
  if (!show.length) { const cd = document.createElement("div"); cd.className = "card"; cd.style.setProperty("--ch", st.hue); cd.style.setProperty("--i", 0); cd.textContent = "+"; fan.appendChild(cd); }
  const ic = document.createElement("span"); ic.className = "flow-icon"; cardGlyph(ic, st);
  const bd = document.createElement("span"); bd.className = "flow-badge"; bd.textContent = inside.length + " inside";
  sc.append(fan, ic, bd);
}
let openStackId = null;
function openStack(st, tile) {
  openStackId = st.id;
  renderStack(); show("#stackSheet"); sfx("open", 0, tileWorld(st));
  setTimeout(() => ($("#skGrid .slot") || $("#skClose")).focus({ preventScroll: true }), 40);
}
function renderStack() {
  const st = openStackId && byId(openStackId);
  if (!st) { hide("#stackSheet"); return; }
  $("#skName").textContent = st.name;
  const inside = membersOf(st);
  $("#skDesc").textContent = st.desc || (inside.length === 1 ? "1 tile" : inside.length + " tiles");
  $("#skEdit").hidden = !!visiting;
  $("#skTip").hidden = !!visiting || inside.length > 0;
  const grid = $("#skGrid"); grid.innerHTML = "";
  inside.forEach((c, i) => {
    const cell = document.createElement("div"); cell.className = "sk-cell";
    const b = document.createElement("button"); b.className = "slot tile"; b.dataset.id = c.id; b.setAttribute("aria-label", c.name);
    const sc = document.createElement("div"); sc.className = "screen";
    if (c.kind === "flow") { b.classList.add("flow"); fillFlowTile(sc, c); } else fillScreen(sc, c);
    const np = document.createElement("div"); np.className = "nameplate"; np.textContent = c.name;
    b.append(sc, np);
    b.onclick = () => openItem(c, b);
    b.onpointerenter = () => sfx("hover", i % PER, tileWorld(c));
    cell.appendChild(b);
    if (!visiting) {
      const out = document.createElement("button"); out.className = "sk-out"; out.type = "button"; out.textContent = "Take out";
      out.setAttribute("aria-label", "Take " + c.name + " out of the stack");
      out.onclick = () => {
        checkpoint("take " + c.name + " out of " + st.name);
        delete c.stack; c.page = st.page; c.slot = -1;
        state = normalize(state); save(); render(); renderStack(); sfx("back");
        toastAction(c.name + " is back on " + (state.pages[pageOf(c)] || {}).name, "Undo", () => { undo(); renderStack(); });
      };
      cell.appendChild(out);
    }
    grid.appendChild(cell);
  });
  if (!inside.length) grid.innerHTML = '<p class="empty-note">This stack is empty.</p>';
}
const closeStack = () => { hide("#stackSheet"); openStackId = null; sfx("back"); };
$("#skClose").onclick = closeStack;
$("#stackSheet").addEventListener("click", e => { if (e.target.id === "stackSheet") closeStack(); });
$("#skEdit").onclick = () => { const st = byId(openStackId); hide("#stackSheet"); openStackId = null; if (st) openEditor(st); };
