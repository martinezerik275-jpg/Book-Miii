/* ================= preview ================= */
let pvChannel = null, pvSourceTile = null;
function openPreview(c, tile) {
  pvChannel = c; pvSourceTile = tile;
  const isFlow = c.kind === "flow";
  fillScreen($("#pvScreen"), c, true);
  $("#banner").classList.toggle("is-flow", isFlow);
  $("#pvName").textContent = c.name;
  const route = $("#pvRoute"), list = $("#pvSteps"); route.innerHTML = ""; list.innerHTML = "";
  if (isFlow) {
    const steps = flowSteps(c);
    $("#pvDomain").textContent = steps.length === 1 ? "1 step" : steps.length + " steps";
    const stops = document.createElement("div"); stops.className = "stops";
    const rail = document.createElement("div"); rail.className = "rail"; rail.innerHTML = '<div class="pulse"></div>'; stops.appendChild(rail);
    steps.forEach((st, i) => {
      const a = document.createElement("a"); a.className = "stop"; a.href = st.ch.url; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.style.setProperty("--ch", st.ch.hue); a.style.setProperty("--n", i);
      const cd = document.createElement("span"); cd.className = "card"; cardGlyph(cd, st.ch);
      const nm = document.createElement("b"); nm.textContent = st.ch.name;
      const num = document.createElement("span"); num.className = "num"; num.textContent = i + 1;
      a.append(cd, num, nm); stops.appendChild(a);
      const li = document.createElement("li"), la = document.createElement("a");
      la.href = st.ch.url; la.target = "_blank"; la.rel = "noopener noreferrer";
      const m = document.createElement("div"); m.className = "mini"; const sc = document.createElement("div"); sc.className = "screen"; fillScreen(sc, st.ch); m.appendChild(sc);
      const t = document.createElement("div"); const b = document.createElement("b"); b.textContent = (i + 1) + ". " + st.ch.name;
      const sp = document.createElement("span"); sp.textContent = st.note || st.ch.desc || domainOf(st.ch.url); t.append(b, sp);
      la.append(m, t); li.appendChild(la); list.appendChild(li);
    });
    route.appendChild(stops);
    $("#pvOpen").textContent = "Start session";
    $("#pvEdit").textContent = "Edit workflow";
    if (steps.length) $("#pvOpen").href = steps[0].ch.url; else $("#pvOpen").removeAttribute("href");
    $("#pvOpen").classList.toggle("disabled-link", !steps.length);
  } else {
    $("#pvDomain").textContent = domainOf(c.url);
    $("#pvOpen").textContent = "Open site"; $("#pvEdit").textContent = "Edit channel";
    $("#pvOpen").classList.remove("disabled-link");
  }
  $("#pvDesc").textContent = c.desc || (isFlow ? "No description yet. Use Edit workflow to add one." : "No description yet. Use Edit channel to add one.");
  const tg = $("#pvTags"); tg.innerHTML = "";
  (c.tags || []).forEach(t => { const s = document.createElement("span"); s.className = "tag"; s.textContent = t; tg.appendChild(s); });
  $("#pvNotes").textContent = isFlow ? "" : (c.notes || "");
  if (!isFlow) $("#pvOpen").href = c.url;
  show("#preview"); sfx("open", 0, tileWorld(c)); duckMusic(true);
  const banner = $("#banner");
  if (tile && !reduceMotion) {
    const t = tile.getBoundingClientRect(), b = banner.getBoundingClientRect();
    banner.style.transition = "none";
    banner.style.transform = `translate(${t.left - b.left}px,${t.top - b.top}px) scale(${t.width / b.width},${t.height / b.height})`;
    banner.getBoundingClientRect();
    banner.style.transition = "transform .45s cubic-bezier(.2,.9,.25,1)";
    banner.style.transform = "none";
  }
  setTimeout(() => $("#pvOpen").focus({ preventScroll: true }), 50);
}
function closePreview() {
  hide("#preview"); sfx("back"); duckMusic(false);
  if (pvSourceTile && document.contains(pvSourceTile)) pvSourceTile.focus({ preventScroll: true });
}
$("#pvBack").onclick = closePreview;
$("#pvOpen").onclick = e => {
  const c = pvChannel;
  if (c && c.kind === "flow") {
    if (!flowSteps(c).length) { e.preventDefault(); sfx("error"); toast("Add steps to this workflow first."); return; }
    hide("#preview"); duckMusic(false); startSession(c);
  } else sfx("launch", 0, tileWorld(c));
};
$("#pvSteps").addEventListener("pointerover", e => { const a = e.target.closest("a"); if (a && !a.contains(e.relatedTarget)) sfx("tick"); });
$("#pvEdit").onclick = () => { const c = pvChannel; hide("#preview"); duckMusic(false); openEditor(c); };

