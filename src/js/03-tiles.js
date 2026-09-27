function glyphHTML(c) {
  const g = document.createElement("div"); g.className = "glyph";
  if (c.iconAsset || c.iconData) { const img = document.createElement("img"); img.src = c.iconAsset ? "/_blob/" + c.iconAsset : c.iconData; img.alt = ""; g.appendChild(img); }
  else g.textContent = glyphOf(c);
  return g;
}
function iconStyleOf(c) { return (c.iconAsset || c.iconData) ? (c.iconStyle || "color") : "none"; }
function fillScreen(screen, c, keepRings) {
  screen.style.setProperty("--h", c.hue);
  const st = iconStyleOf(c);
  screen.classList.toggle("icon-app", st === "app"); screen.classList.toggle("icon-white", st === "white");
  if (st === "app") screen.style.setProperty("--ibg", c.iconBg || "#8894A2"); else screen.style.removeProperty("--ibg");
  [...screen.querySelectorAll(".glyph")].forEach(n => n.remove());
  const g = glyphHTML(c); if (keepRings) g.id = "pvGlyph"; screen.appendChild(g);
}

function cardGlyph(el, c) {
  el.textContent = "";
  const st = iconStyleOf(c);
  if (st === "app") el.style.background = c.iconBg || "#8894A2";
  else if (st === "white") el.style.background = "#fff";
  else el.style.removeProperty("background");
  if (c.iconAsset || c.iconData) { const img = document.createElement("img"); img.src = c.iconAsset ? "/_blob/" + c.iconAsset : c.iconData; img.alt = ""; el.appendChild(img); }
  else el.textContent = glyphOf(c);
}
function fillFlowTile(sc, f) {
  sc.style.setProperty("--h", f.hue);
  const steps = flowSteps(f), show = steps.slice(0, 3), n = show.length;
  const fan = document.createElement("div"); fan.className = "fan";
  show.forEach((st, i) => {
    const cd = document.createElement("div"); cd.className = "card";
    cd.style.setProperty("--ch", st.ch.hue); cd.style.setProperty("--i", n === 1 ? 0 : (i - (n - 1) / 2));
    cd.style.zIndex = i === Math.floor((n - 1) / 2) ? 3 : 1;
    cardGlyph(cd, st.ch); fan.appendChild(cd);
  });
  if (!n) { const cd = document.createElement("div"); cd.className = "card"; cd.style.setProperty("--ch", f.hue); cd.style.setProperty("--i", 0); cd.textContent = "+"; fan.appendChild(cd); }
  const ic = document.createElement("span"); ic.className = "flow-icon"; cardGlyph(ic, f);
  const bd = document.createElement("span"); bd.className = "flow-badge"; bd.textContent = steps.length === 1 ? "1 step" : steps.length + " steps";
  sc.append(fan, ic, bd);
}

