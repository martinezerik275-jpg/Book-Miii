/* ================= Avatar Clinic: make your plaza animal ================= */
let clDraft = null, clView = null;
async function openClinic(patch) {
  clDraft = Object.assign(myAvatar(), patch || {});
  renderClinicOpts();
  $("#clStatus").textContent = mayWrite() ? "" : "Saved on this device. Others still see it in the plaza.";
  show("#clinic"); sfx("select");
  try { await loadThree(); } catch { $("#clTag").textContent = "Preview needs a connection"; return; }
  if (!$("#clinic").classList.contains("open")) return;
  try { startClinicView(); } catch { $("#clTag").textContent = "3D preview isn't available in this browser"; }
}
function closeClinic() {
  hide("#clinic"); sfx("back");
  if ($("#welcome").classList.contains("open")) renderWelcome();
  if (clView) { cancelAnimationFrame(clView.raf); clView.raf = 0; }
}
function segRow(box, map, key) {
  box.innerHTML = "";
  Object.entries(map).forEach(([v, label]) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.dataset.v = v;
    b.className = clDraft[key] === v ? "on" : "";
    b.onclick = () => { clDraft[key] = v; renderClinicOpts(); sfx("tick"); };
    box.appendChild(b);
  });
}
function swatchRow(box, colors, key, label) {
  box.innerHTML = "";
  colors.forEach(c => {
    const b = document.createElement("button"); b.type = "button"; b.className = "swatch" + (clDraft[key] === c ? " on" : "");
    b.style.background = c; b.setAttribute("aria-label", label + " " + c); b.setAttribute("aria-pressed", clDraft[key] === c);
    b.onclick = () => { clDraft[key] = c; renderClinicOpts(); sfx("tick"); };
    box.appendChild(b);
  });
}
function renderClinicOpts() {
  const sp = $("#clSpecies"); sp.innerHTML = "";
  Object.entries(SPECIES).forEach(([k, v]) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "sp-btn" + (clDraft.s === k ? " on" : "");
    b.setAttribute("aria-pressed", clDraft.s === k);
    const e = document.createElement("span"); e.textContent = v.e; e.setAttribute("aria-hidden", "true");
    const n = document.createElement("b"); n.textContent = v.n;
    b.append(e, n);
    b.onclick = () => { clDraft.s = k; if (k === "frog" && !FURS.includes(clDraft.f)) clDraft.f = "#A7D98C"; renderClinicOpts(); sfx("hover", Object.keys(SPECIES).indexOf(k)); };
    sp.appendChild(b);
  });
  swatchRow($("#clFur"), FURS, "f", "Fur");
  swatchRow($("#clScrubs"), SCRUBS, "c", "Scrubs");
  segRow($("#clHat"), Object.fromEntries(Object.entries(HATS).filter(([k]) => k !== "grad" || onb.reward || clDraft.h === "grad")), "h"); segRow($("#clExtra"), EXTRAS, "x"); segRow($("#clEyes"), EYES, "e");
  if (document.activeElement !== $("#clNick")) $("#clNick").value = clDraft.nick || "";
  $("#clTag").textContent = SPECIES[clDraft.s].n + (clDraft.h !== "none" ? " · " + HATS[clDraft.h] : "");
  if (clView) clView.rebuild();
}
$("#clNick").addEventListener("input", e => { clDraft.nick = e.target.value.slice(0, 20); });
$("#clRandom").onclick = () => { const nick = clDraft.nick; clDraft = randomAvatar(); clDraft.nick = nick; renderClinicOpts(); sfx("confirm"); };
$("#clClose").onclick = closeClinic; $("#clCancel").onclick = closeClinic;
$("#clinic").addEventListener("click", e => { if (e.target.id === "clinic") closeClinic(); });
$("#clSave").onclick = async () => {
  const av = encodeAvatar(clDraft);
  try { localStorage.setItem(AV_KEY, JSON.stringify(av)); } catch {}
  setPresence({ av });
  let cloud = false;
  if (mayWrite()) { try { await saveMyCard({ avatar: av }); cloud = true; } catch {} }
  onbFlag("avatar");
  closeClinic(); sfx("complete");
  toast(cloud ? "Avatar saved. See you in the plaza." : "Avatar saved on this device.");
  renderPeopleList(); renderVisitBar();
};

function startClinicView() {
  const canvas = $("#clCanvas");
  if (!clView) {
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 1.05, 4.3); camera.lookAt(0, 0.72, 0);
    scene.add(new T.HemisphereLight(0xffffff, 0xb8c4d0, 1.4));
    const sun = new T.DirectionalLight(0xffffff, 1.3); sun.position.set(2, 4, 3); scene.add(sun);
    const pad = new T.Mesh(new T.CylinderGeometry(0.85, 0.9, 0.08, 40), toonMat(T, "#DDF1FB")); pad.position.y = -0.04; scene.add(pad);
    const v = clView = { renderer, scene, camera, g: null, key: "", spin: 0.5, raf: 0, dragX: null };
    v.rebuild = () => {
      const key = JSON.stringify(encodeAvatar(clDraft)); if (key === v.key) return;
      if (v.g) { scene.remove(v.g); disposeTree(v.g); }
      v.g = buildAvatar(T, clDraft); v.key = key; scene.add(v.g);
      v.g.userData.emote = { k: "wave", t0: v.t || 0 };
    };
    canvas.addEventListener("pointerdown", e => { v.dragX = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", e => { if (v.dragX == null) return; v.spin += (e.clientX - v.dragX) * 0.012; v.dragX = e.clientX; });
    canvas.addEventListener("pointerup", () => { v.dragX = null; });
  }
  const v = clView;
  v.rebuild();
  let last = 0; v.t = 0;
  const loop = now => {
    v.raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; v.t += dt;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h && (canvas.width !== Math.round(w * v.renderer.getPixelRatio()))) { v.renderer.setSize(w, h, false); v.camera.aspect = w / h; v.camera.updateProjectionMatrix(); }
    if (v.dragX == null && !reduceMotion) v.spin += dt * 0.4;
    v.g.rotation.y = Math.sin(v.spin) * 0.9;
    animateAvatar(v.g, v.t, dt, 0);
    v.renderer.render(v.scene, v.camera);
  };
  cancelAnimationFrame(v.raf); v.raf = requestAnimationFrame(loop);
}
