/* ================= plaza: a shared 3D square ================= */
// three.js loads only when someone opens the plaza. Positions, chat bubbles and
// emotes travel as room presence (never stored); houses come from people/<id> cards.
const THREE_URL = TEST ? "/vendor/three/three.module.js" : "https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js";
let T = null, threeP = null, plaza = null;
function loadThree() {
  if (!threeP) threeP = import(THREE_URL).then(m => (T = m)).catch(e => { threeP = null; throw e; });
  return threeP;
}
let plazaReturnWorld = null;
async function openPlaza() {
  if ($("#plaza").classList.contains("open")) return;
  if (visiting) goHome(true);
  hide("#preview"); hide("#people"); exitIdle();
  show("#plaza"); $("#pzLoading").hidden = false; $("#pzLoadText").textContent = "Opening the plaza…";
  sfx("open");
  try { await loadThree(); }
  catch { $("#pzLoadText").textContent = "Couldn't load the 3D plaza. Check your connection, then try again."; return; }
  if (!$("#plaza").classList.contains("open")) return;
  try { if (!plaza) plaza = createPlaza(T); }
  catch { $("#pzLoadText").textContent = "This browser can't show the 3D plaza (WebGL is off)."; return; }
  plaza.start();
  $("#pzLoading").hidden = true;
  plazaReturnWorld = musicWorld; setMusicWorld("pluck");
  setTimeout(() => $("#pzCanvas").focus({ preventScroll: true }), 30);
}
function closePlaza() {
  if (!$("#plaza").classList.contains("open")) return;
  if (plaza) plaza.stop();
  hide("#plaza"); hide("#photoSheet"); sfx("back");
  setPresence({ w: visiting ? "visit" : "menu", p: null, m: null });
  if (plazaReturnWorld && state.pages[page]) setMusicWorld(pageWorld(state.pages[page].id));
}
$("#plazaBtn").onclick = openPlaza;
$("#pzClose").onclick = closePlaza;
$("#pzClinic").onclick = () => openClinic();
$("#pzPeople").onclick = () => openPeople("neighbors");
$("#pzPhoto").onclick = () => plaza && plaza.photo();

function createPlaza(T) {
  const canvas = $("#pzCanvas"), labels = $("#pzLabels");
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(50, 1, 0.1, 220);
  const rng = (s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(7);
  const M = c => toonMat(T, c);
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const colliders = [], portals = [], occluders = [];   // occluders: walls the camera must not sit behind
  const R_WORLD = 40;

  /* ---- sky + light (follows the hour, like the menu's lighting) ---- */
  const hemi = new T.HemisphereLight(0xffffff, 0x88a070, 1.3); scene.add(hemi);
  const sun = new T.DirectionalLight(0xfff1dc, 1.5); sun.position.set(12, 20, 8); scene.add(sun);
  const lampMats = [];
  function applySky() {
    const h = hourNow(), night = h >= 19.5 || h < 6.5, dusk = !night && (h >= 17.5 || h < 8);
    const sky = night ? 0x243463 : dusk ? 0xF6C3A8 : 0xBFE5FF;
    scene.background = new T.Color(sky); scene.fog = new T.Fog(sky, 45, 95);
    hemi.intensity = night ? 0.75 : 1.3; sun.intensity = night ? 0.35 : dusk ? 1.1 : 1.5;
    sun.color.set(night ? 0x9fb4ff : dusk ? 0xffc59a : 0xfff1dc);
    lampMats.forEach(m => { m.emissiveIntensity = night ? 1.4 : 0.25; });
  }

  /* ---- ground, plaza, fountain ---- */
  const ground = add(new T.CircleGeometry(46, 72), M("#9FD483")); ground.rotation.x = -Math.PI / 2;
  const stone = add(new T.CircleGeometry(9.4, 64), M("#EFE6D6"), 0, 0.02, 0); stone.rotation.x = -Math.PI / 2;
  const ring = add(new T.RingGeometry(9.4, 9.9, 64), M("#DCCFB8"), 0, 0.025, 0); ring.rotation.x = -Math.PI / 2;
  add(new T.CylinderGeometry(2.9, 3.1, 0.6, 40), M("#E4ECF3"), 0, 0.3, 0);
  const water = add(new T.CircleGeometry(2.6, 40), new T.MeshToonMaterial({ color: 0x7ED3F2, gradientMap: toonRamp, transparent: true, opacity: 0.9 }), 0, 0.56, 0); water.rotation.x = -Math.PI / 2;
  add(new T.CylinderGeometry(0.28, 0.4, 1.7, 16), M("#E4ECF3"), 0, 1.1, 0);
  add(new T.CylinderGeometry(1, 0.55, 0.3, 28), M("#E4ECF3"), 0, 1.95, 0);
  const drops = [];
  for (let i = 0; i < 18; i++) { const d = add(new T.SphereGeometry(0.07, 8, 6), new T.MeshBasicMaterial({ color: 0xbfeaff }), 0, 2, 0); d.userData.o = i / 18; drops.push(d); }
  colliders.push({ x: 0, z: 0, r: 3.3 });

  /* ---- trees, flowers, lamps, benches, clouds ---- */
  function tree(x, z, s) {
    const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
    add(new T.CylinderGeometry(0.18 * s, 0.26 * s, 1.3 * s, 8), M("#9A6B47"), 0, 0.65 * s, 0, g);
    const greens = ["#6DBF6A", "#7FCB72", "#5DAE62", "#8AD07A"];
    add(new T.SphereGeometry(1.1 * s, 16, 12), M(greens[Math.floor(rng() * 4)]), 0, 1.9 * s, 0, g);
    add(new T.SphereGeometry(0.75 * s, 14, 10), M(greens[Math.floor(rng() * 4)]), 0.45 * s, 2.5 * s, 0.1 * s, g);
    colliders.push({ x, z, r: 0.6 * s });
  }
  for (let i = 0; i < 34; i++) { const an = rng() * Math.PI * 2, r = 35 + rng() * 5; tree(Math.sin(an) * r, -Math.cos(an) * r, 0.9 + rng() * 0.6); }
  for (let i = 0; i < 10; i++) {
    const an = rng() * Math.PI * 2; if (Math.abs(an - Math.PI) < 0.55) continue;
    const r = 15 + rng() * 3; tree(Math.sin(an) * r, -Math.cos(an) * r, 0.7 + rng() * 0.3);
  }
  const petals = ["#FF9EB5", "#FFD166", "#FFFFFF", "#B39DFF", "#FF8C69"];
  const flowerGeo = new T.SphereGeometry(0.12, 8, 6), flowers = new T.InstancedMesh(flowerGeo, M("#ffffff"), 180);
  const mtx = new T.Matrix4();
  for (let i = 0; i < 180; i++) {
    const an = rng() * Math.PI * 2, r = 11 + rng() * 28;
    mtx.makeTranslation(Math.sin(an) * r, 0.12, -Math.cos(an) * r); flowers.setMatrixAt(i, mtx);
    flowers.setColorAt(i, new T.Color(petals[i % petals.length]));
  }
  scene.add(flowers);
  for (let i = 0; i < 8; i++) {
    const an = (i + 0.5) / 8 * Math.PI * 2, x = Math.sin(an) * 10.6, z = -Math.cos(an) * 10.6;
    add(new T.CylinderGeometry(0.07, 0.09, 2.6, 8), M("#4F5B6B"), x, 1.3, z);
    const lm = new T.MeshToonMaterial({ color: 0xfff4c9, emissive: 0xffd98a, emissiveIntensity: 0.3, gradientMap: toonRamp }); lampMats.push(lm);
    add(new T.SphereGeometry(0.26, 14, 10), lm, x, 2.75, z);
    colliders.push({ x, z, r: 0.25 });
  }
  for (let i = 0; i < 4; i++) {
    const an = (i / 4) * Math.PI * 2 + Math.PI / 4, x = Math.sin(an) * 7.2, z = -Math.cos(an) * 7.2;
    const b = new T.Group(); b.position.set(x, 0, z); b.rotation.y = Math.atan2(-x, -z); scene.add(b);
    add(new T.BoxGeometry(1.8, 0.12, 0.55), M("#C98B5B"), 0, 0.45, 0, b);
    add(new T.BoxGeometry(1.8, 0.45, 0.1), M("#C98B5B"), 0, 0.75, -0.25, b);
    [-0.75, 0.75].forEach(dx => add(new T.BoxGeometry(0.1, 0.45, 0.5), M("#6E5A4B"), dx, 0.22, 0, b));
    colliders.push({ x, z, r: 0.8 });
  }
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const c = new T.Group(); c.position.set((rng() - 0.5) * 90, 17 + rng() * 6, (rng() - 0.5) * 90); scene.add(c);
    for (let j = 0; j < 4; j++) add(new T.SphereGeometry(1.6 + rng() * 1.2, 12, 10), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }), j * 1.9 - 3, rng() * 0.8, rng() * 1.2, c);
    clouds.push(c);
  }

  /* ---- signs (text drawn on a canvas) ---- */
  function signTexture(text, bg = "#FFF9EE", fg = "#3A3F4A") {
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128;
    const g = cv.getContext("2d");
    g.fillStyle = bg; g.beginPath(); g.roundRect(6, 6, 500, 116, 34); g.fill();
    g.lineWidth = 8; g.strokeStyle = "rgba(0,0,0,.12)"; g.stroke();
    let size = 58; g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
    do { g.font = `800 ${size}px "M PLUS Rounded 1c", "Nunito", system-ui, sans-serif`; size -= 2; } while (g.measureText(text).width > 450 && size > 22);
    g.fillText(text, 256, 68);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    return tex;
  }

  /* ---- the Avatar Clinic ---- */
  {
    const CZ = 19;   // south of the fountain, inside the ring of houses
    const c = new T.Group(); c.position.set(0, 0, CZ); c.rotation.y = Math.PI; scene.add(c);
    occluders.push(add(new T.BoxGeometry(6, 3.2, 4.2), M("#FBFCFE"), 0, 1.6, 0, c));
    occluders.push(add(new T.BoxGeometry(6.5, 0.35, 4.7), M("#8FD0EE"), 0, 3.35, 0, c));
    add(new T.BoxGeometry(1.5, 2, 0.12), M("#8FD0EE"), 0, 1, 2.1, c);
    add(new T.BoxGeometry(0.06, 2, 0.14), M("#FBFCFE"), 0, 1, 2.12, c);
    [-2.1, 2.1].forEach(x => add(new T.BoxGeometry(1.1, 0.9, 0.1), new T.MeshToonMaterial({ color: 0xcfeeff, emissive: 0x6fb6de, emissiveIntensity: 0.2, gradientMap: toonRamp }), x, 1.9, 2.12, c));
    const cross = new T.MeshBasicMaterial({ color: 0xE8474F });
    add(new T.BoxGeometry(0.9, 0.3, 0.1), cross, 0, 4.3, 0, c); add(new T.BoxGeometry(0.3, 0.9, 0.1), cross, 0, 4.3, 0, c);
    add(new T.BoxGeometry(0.12, 0.8, 0.12), M("#C9D3DD"), 0, 3.8, 0, c);
    const sign = add(new T.PlaneGeometry(3.2, 0.8), new T.MeshBasicMaterial({ map: signTexture("Avatar Clinic", "#FFFFFF", "#D94452"), transparent: true }), 0, 2.72, 2.13, c);
    colliders.push({ x: -2, z: CZ, r: 2.3 }, { x: 2, z: CZ, r: 2.3 }, { x: 0, z: CZ + 0.7, r: 2 });
    const walk = add(new T.PlaneGeometry(1.6, CZ - 2.1 - 9.6), M("#E8DDC9"), 0, 0.015, (9.6 + CZ - 2.1) / 2); walk.rotation.x = -Math.PI / 2;
    portals.push({ x: 0, z: CZ - 2.9, label: "Enter the Avatar Clinic", act: () => openClinic() });
  }

  /* ---- houses: one per listed space ---- */
  const houseGroup = new T.Group(); scene.add(houseGroup);
  let houseKey = "", houseColliders = [];
  function rebuildHouses() {
    // stable order so houses don't move when people come and go: the owner first, then by id
    const ids = neighborIds().filter(id => id === hubOwner || (people[id] && people[id].card && people[id].card.listed))
      .sort((a, b) => (b === hubOwner) - (a === hubOwner) || (a < b ? -1 : 1)).slice(0, HOUSE_SLOTS.length);
    const key = JSON.stringify(ids.map(id => [id, spaceTitle(id), (people[id] && people[id].card || {}).hue]));
    if (key === houseKey) return; houseKey = key;
    houseGroup.children.slice().forEach(ch => { houseGroup.remove(ch); disposeTree(ch); });
    houseColliders.forEach(hc => colliders.splice(colliders.indexOf(hc), 1)); houseColliders = [];
    for (let i = occluders.length - 1; i >= 0; i--) if (occluders[i].userData.house) occluders.splice(i, 1);
    for (let i = portals.length - 1; i >= 0; i--) if (portals[i].house) portals.splice(i, 1);
    ids.forEach((id, i) => {
      const slot = HOUSE_SLOTS[i]; if (!slot) return;
      const R = slot.R, an = slot.an;
      const x = Math.sin(an) * R, z = -Math.cos(an) * R;
      const card = (people[id] && people[id].card) || {}, hue = Number.isFinite(+card.hue) ? +card.hue : 200;
      const h = new T.Group(); h.position.set(x, 0, z); h.rotation.y = Math.atan2(-x, -z); houseGroup.add(h);
      const wall = new T.Color().setHSL(hue / 360, 0.6, 0.86), roof = new T.Color().setHSL(hue / 360, 0.55, 0.6);
      const base = add(new T.BoxGeometry(3.2, 2.3, 2.8), toonMat(T, wall), 0, 1.15, 0, h);
      const rf = add(new T.ConeGeometry(2.55, 1.6, 4), toonMat(T, roof), 0, 3.1, 0, h); rf.rotation.y = Math.PI / 4; rf.scale.set(1, 1, 0.9);
      add(new T.BoxGeometry(0.35, 0.9, 0.35), M("#B9A28E"), 0.9, 3.4, -0.3, h);
      add(new T.BoxGeometry(0.85, 1.35, 0.1), M("#8A5E3C"), 0, 0.68, 1.41, h);
      add(new T.SphereGeometry(0.05, 8, 6), M("#F2C14E"), 0.28, 0.68, 1.48, h);
      [-1.05, 1.05].forEach(wx => add(new T.BoxGeometry(0.6, 0.55, 0.08), new T.MeshToonMaterial({ color: 0xfff6cf, emissive: 0xffd98a, emissiveIntensity: 0.15, gradientMap: toonRamp }), wx, 1.35, 1.41, h));
      add(new T.PlaneGeometry(2.6, 0.62), new T.MeshBasicMaterial({ map: signTexture(spaceTitle(id)), transparent: true }), 0, 1.95, 1.46, h);
      const path = add(new T.PlaneGeometry(1.2, R - 10.4), M("#E8DDC9"), Math.sin(an) * (R + 9.9) / 2, 0.015, -Math.cos(an) * (R + 9.9) / 2, houseGroup);
      path.rotation.x = -Math.PI / 2; path.rotation.z = -an;
      const col = { x, z, r: 2.1 }; colliders.push(col); houseColliders.push(col);
      base.userData.house = rf.userData.house = true; occluders.push(base, rf);
      const dx = -Math.sin(an), dz = Math.cos(an);
      portals.push({ house: true, id, x: x + dx * 2.6, z: z + dz * 2.6, label: id === me.id ? "Go into your space" : "Visit " + spaceTitle(id), act: () => { closePlaza(); id === me.id ? null : visitSpace(id, "plaza"); } });
    });
  }

  /* ---- avatars ---- */
  const me3 = { g: null, key: "", x: 0, z: 10, ry: Math.PI, moving: 0, emoteN: 0, sayN: 0 };
  const others = new Map();     // peer -> { g, key, x, z, ry, tx, tz, try, m, by, guest, eN, sN, label, bubble, bubbleT }
  const muted = new Set();
  function makeLabel() {
    const l = document.createElement("div"); l.className = "pz-label";
    const n = document.createElement("b"), s = document.createElement("span"); l.append(n, s);
    const b = document.createElement("div"); b.className = "pz-bubble"; b.hidden = true;
    labels.append(l, b); return { l, n, s, b };
  }
  function ensureMine() {
    const av = encodeAvatar(myAvatar()), key = JSON.stringify(av);
    if (key === me3.key) return;
    if (me3.g) { scene.remove(me3.g); disposeTree(me3.g); }
    me3.g = buildAvatar(T, av); me3.key = key; scene.add(me3.g);
    if (!me3.ui) me3.ui = makeLabel();
    me3.ui.l.classList.add("mine");
  }
  function syncPeers() {
    const seen = new Set();
    peersNow.forEach(p => {
      if (p.sameTab || !p.presence || p.presence.w !== "plaza" || !Array.isArray(p.presence.p)) return;
      const pr = p.presence, [x, z, ry] = pr.p.map(Number);
      if (![x, z, ry].every(Number.isFinite)) return;
      seen.add(p.peer);
      let o = others.get(p.peer);
      const av = decodeAvatar(pr.av, p.by || p.peer), key = JSON.stringify(av);
      if (!o) { o = { x, z, ry, eN: pr.e && pr.e.n, sN: pr.say && pr.say.n, ui: makeLabel() }; others.set(p.peer, o); sfx("tick"); }
      if (o.key !== key) { if (o.g) { scene.remove(o.g); disposeTree(o.g); } o.g = buildAvatar(T, av); o.key = key; scene.add(o.g); o.g.position.set(o.x, 0, o.z); }
      Object.assign(o, { tx: clampW(x), tz: clampW(z), try: ry, m: pr.m ? 1 : 0, by: p.by, guest: p.guest, isMe: p.isMe, nick: av.nick, pr });
      if (pr.e && pr.e.n !== o.eN) { o.eN = pr.e.n; playEmote(o.g, pr.e.k); }
      if (pr.say && pr.say.n !== o.sN && typeof pr.say.t === "string") {
        o.sN = pr.say.n;
        if (!muted.has(p.by || p.peer)) { showBubble(o, pr.say.t); logLine(whoIs(o), pr.say.t); }
      }
    });
    others.forEach((o, peer) => { if (!seen.has(peer)) { if (o.g) { scene.remove(o.g); disposeTree(o.g); } o.ui.l.remove(); o.ui.b.remove(); others.delete(peer); } });
    const n = others.size;
    $("#pzCount").textContent = n ? (n === 1 ? "1 other person here" : n + " other people here") : "Just you so far";
  }
  const clampW = v => Math.max(-R_WORLD, Math.min(R_WORLD, v));
  function whoIs(o) { return (o.nick || nameOf[o.by] || "Visitor") + (o.isMe ? " (your other tab)" : o.guest ? " (guest)" : ""); }
  function showBubble(o, text) { o.ui.b.textContent = text.slice(0, 120); o.ui.b.hidden = false; o.bubbleT = performance.now() + 6500; }
  function logLine(who, text) {
    const li = document.createElement("li"), b = document.createElement("b"); b.textContent = who; li.append(b, document.createTextNode(" " + text));
    const log = $("#pzLog"); log.appendChild(li); while (log.children.length > 30) log.firstChild.remove(); log.scrollTop = log.scrollHeight;
  }
  const hearts = [];
  let heartTex = null;
  function playEmote(g, k) {
    if (!g || !["wave", "jump", "dance", "heart", "cheer"].includes(k)) return;
    g.userData.emote = { k, t0: clock };
    if (k === "heart") {
      if (!heartTex) {
        const cv = document.createElement("canvas"); cv.width = cv.height = 64; const c2 = cv.getContext("2d");
        c2.fillStyle = "#FF6F91"; c2.beginPath(); c2.moveTo(32, 56); c2.bezierCurveTo(4, 36, 6, 8, 32, 20); c2.bezierCurveTo(58, 8, 60, 36, 32, 56); c2.fill();
        heartTex = new T.CanvasTexture(cv);
      }
      for (let i = 0; i < 5; i++) {
        const s = new T.Sprite(new T.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false }));
        s.scale.setScalar(0.35); s.position.set(g.position.x + (Math.random() - 0.5) * 0.6, 1.6, g.position.z + (Math.random() - 0.5) * 0.6);
        s.userData = { t0: clock + i * 0.15, vx: (Math.random() - 0.5) * 0.4 }; scene.add(s); hearts.push(s);
      }
    }
  }

  /* ---- my actions ---- */
  function emote(k) {
    ensureMine(); me3.emoteN++;
    playEmote(me3.g, k); setPresence({ e: { k, n: me3.emoteN } }); sfx("select");
  }
  let lastSay = 0;
  function say(text) {
    text = String(text || "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (!text) return;
    if (Date.now() - lastSay < 1200) { toast("Slow down a little."); return; }
    lastSay = Date.now(); me3.sayN++;
    setPresence({ say: { t: text, n: me3.sayN } });
    showBubble(me3, text); logLine(personName(me.id, "You") + " (you)", text); sfx("tick");
  }
  $("#pzChat").onsubmit = e => { e.preventDefault(); say($("#pzSay").value); $("#pzSay").value = ""; $("#pzCanvas").focus({ preventScroll: true }); };
  $("#pzEmotes").onclick = e => { const b = e.target.closest("[data-e]"); if (b) emote(b.dataset.e); };

  /* ---- input ---- */
  const keys = new Set();
  let yaw = 0, pitch = 0.42, dist = 8, walkTo = null, drag = null, cardPeer = null;
  const isOpen = () => $("#plaza").classList.contains("open") && !anyModalOverPlaza();
  addEventListener("keydown", e => {
    if (!isOpen() || e.target.matches("input,textarea,select")) return;
    const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { keys.add(k); walkTo = null; e.preventDefault(); }
    else if (k === "e" && nearPortal) { e.preventDefault(); nearPortal.act(); }
    else if (k === "enter") { e.preventDefault(); $("#pzSay").focus(); }
    else if ("12345".includes(k) && k.length === 1) emote(["wave", "jump", "dance", "heart", "cheer"][+k - 1]);
  });
  addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
  addEventListener("blur", () => keys.clear());
  const ray = new T.Raycaster(), ndc = new T.Vector2(), groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  canvas.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true; yaw -= dx * 0.006; pitch = Math.max(0.12, Math.min(1.15, pitch + dy * 0.004));
    drag.x = e.clientX; drag.y = e.clientY;
  });
  canvas.addEventListener("pointerup", e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; if (d.moved) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    // tap a person: their card; otherwise walk to the spot
    let hit = null, best = 1e9;
    others.forEach((o, peer) => {
      if (!o.g) return;
      const c = new T.Vector3(o.g.position.x, 0.8, o.g.position.z), dd = ray.ray.distanceToPoint(c);
      if (dd < 0.75 && ray.ray.origin.distanceTo(c) < best) { best = ray.ray.origin.distanceTo(c); hit = peer; }
    });
    if (hit) { openCard(hit); return; }
    hideCard();
    const pt = new T.Vector3(); if (ray.ray.intersectPlane(groundPlane, pt)) walkTo = { x: clampW(pt.x), z: clampW(pt.z) };
  });
  canvas.addEventListener("wheel", e => { dist = Math.max(4.5, Math.min(16, dist + e.deltaY * 0.01)); e.preventDefault(); }, { passive: false });

  function openCard(peer) {
    const o = others.get(peer); if (!o) return;
    cardPeer = peer;
    $("#pcName").textContent = whoIs(o);
    const card = o.by && people[o.by];
    $("#pcSub").textContent = [statusLine(o.pr) === "In the plaza" ? "" : statusLine(o.pr).replace(/^In the plaza · /, ""), card && card.card && card.card.listed ? spaceTitle(o.by) : ""].filter(Boolean).join(" · ") || "Hanging out in the plaza";
    $("#pcVisit").hidden = !(o.by && (o.by === hubOwner || (card && card.card)));
    $("#pcMute").textContent = muted.has(o.by || peer) ? "Unmute" : "Mute";
    $("#pzCard").hidden = false; sfx("select");
  }
  function hideCard() { $("#pzCard").hidden = true; cardPeer = null; }
  $("#pcVisit").onclick = () => { const o = others.get(cardPeer); hideCard(); if (o && o.by) { closePlaza(); visitSpace(o.by, "plaza"); } };
  $("#pcWave").onclick = () => { const o = others.get(cardPeer); if (o && o.g) me3.ry = Math.atan2(o.g.position.x - me3.x, o.g.position.z - me3.z); emote("wave"); hideCard(); };
  $("#pcMute").onclick = () => { const o = others.get(cardPeer); const k = o && (o.by || cardPeer); if (!k) return; muted.has(k) ? muted.delete(k) : muted.add(k); if (o) o.ui.b.hidden = true; hideCard(); toast(muted.has(k) ? "Muted. Their chat is hidden for you." : "Unmuted"); };
  let nearPortal = null;
  $("#pzPrompt").onclick = () => nearPortal && nearPortal.act();

  /* ---- loop ---- */
  let raf = 0, clock = 0, last = 0, lastSent = 0, sentKey = "";
  const tmpV = new T.Vector3(), camTarget = new T.Vector3(), camRay = new T.Raycaster();
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);
  function collide(p) {
    for (const c of colliders) {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.35;
      if (d < min && d > 1e-4) { p.x = c.x + dx / d * min; p.z = c.z + dz / d * min; }
    }
    const r = Math.hypot(p.x, p.z); if (r > R_WORLD) { p.x *= R_WORLD / r; p.z *= R_WORLD / r; }
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; clock += dt;
    ensureMine();
    // move
    let fx = 0, fz = 0;
    const f = { x: -Math.sin(yaw), z: -Math.cos(yaw) }, rt = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const fwd = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
    const str = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    fx = f.x * fwd + rt.x * str; fz = f.z * fwd + rt.z * str;
    if (walkTo && !fwd && !str) {
      const dx = walkTo.x - me3.x, dz = walkTo.z - me3.z, d = Math.hypot(dx, dz);
      if (d < 0.2) walkTo = null; else { fx = dx / d; fz = dz / d; }
    }
    const len = Math.hypot(fx, fz), speed = 4.4;
    if (len > 0.01) {
      const p = { x: me3.x + fx / len * speed * dt, z: me3.z + fz / len * speed * dt };
      collide(p);
      if (walkTo && Math.hypot(p.x - me3.x, p.z - me3.z) < speed * dt * 0.2) walkTo = null;   // blocked
      me3.x = p.x; me3.z = p.z;
      const target = Math.atan2(fx, fz);
      let dr = target - me3.ry; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); me3.ry += dr * Math.min(1, dt * 12);
      me3.moving = Math.min(1, me3.moving + dt * 6);
    } else me3.moving = Math.max(0, me3.moving - dt * 6);
    me3.g.position.set(me3.x, 0, me3.z); me3.g.rotation.y = me3.ry;
    animateAvatar(me3.g, clock, dt, me3.moving);
    // tell the room, a few times a second at most, only on change
    const pkey = [me3.x, me3.z, me3.ry].map(v => Math.round(v * 50) / 50).concat(me3.moving > 0.5 ? 1 : 0).join();
    if (pkey !== sentKey && now - lastSent > 110) {
      sentKey = pkey; lastSent = now;
      setPresence({ w: "plaza", p: [me3.x, me3.z, me3.ry].map(v => Math.round(v * 100) / 100), m: me3.moving > 0.5 ? 1 : 0 });
    }
    // others glide toward where they said they are
    const k = 1 - Math.exp(-dt * 10);
    others.forEach(o => {
      if (!o.g) return;
      o.x += (o.tx - o.x) * k; o.z += (o.tz - o.z) * k;
      let dr = o.try - o.ry; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); o.ry += dr * k;
      const moving = o.m || Math.hypot(o.tx - o.x, o.tz - o.z) > 0.08 ? 1 : 0;
      o.mv = (o.mv || 0) + ((moving) - (o.mv || 0)) * Math.min(1, dt * 6);
      o.g.position.set(o.x, 0, o.z); o.g.rotation.y = o.ry;
      animateAvatar(o.g, clock, dt, o.mv);
    });
    // camera follows, pulled in front of any wall between it and me
    const off = tmpV.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    let d = dist;
    camRay.set(camTarget.set(me3.x, 1.1, me3.z), off); camRay.far = dist;
    const hitW = camRay.intersectObjects(occluders, false)[0];
    if (hitW) d = Math.max(1.2, hitW.distance - 0.35);
    const want = camTarget.clone().addScaledVector(off, d);
    camera.position.lerp(want, hitW ? 1 : 1 - Math.exp(-dt * 8));
    camera.lookAt(me3.x, 1.1, me3.z);
    // scenery
    water.scale.setScalar(1 + Math.sin(clock * 2) * 0.01);
    drops.forEach(d => { const u = (clock * 0.6 + d.userData.o) % 1, an = d.userData.o * Math.PI * 2; d.position.set(Math.sin(an) * u * 1.9, 2.1 + u * 1.2 - u * u * 2.6, Math.cos(an) * u * 1.9); });
    clouds.forEach((c, i) => { c.position.x += dt * (0.3 + i * 0.05); if (c.position.x > 60) c.position.x = -60; });
    for (let i = hearts.length - 1; i >= 0; i--) {
      const s = hearts[i], u = clock - s.userData.t0;
      if (u < 0) { s.visible = false; continue; } s.visible = true;
      s.position.y += dt * 1.1; s.position.x += s.userData.vx * dt; s.material.opacity = Math.max(0, 1 - u / 1.6);
      if (u > 1.6) { scene.remove(s); s.material.dispose(); hearts.splice(i, 1); }
    }
    // doors nearby
    let near = null, nd = 1.9;
    portals.forEach(p => { const d = Math.hypot(p.x - me3.x, p.z - me3.z); if (d < nd) { nd = d; near = p; } });
    if (near !== nearPortal) { nearPortal = near; const pb = $("#pzPrompt"); pb.hidden = !near; if (near) { pb.textContent = near.label + "  ( E )"; sfx("tick"); } }
    renderer.render(scene, camera);
    placeLabels(now);
  }
  function placeLabel(ui, g, name, sub, now, bubbleT) {
    tmpV.set(g.position.x, 2.05 + g.userData.rig.position.y, g.position.z).project(camera);
    const vis = tmpV.z < 1 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1 && camera.position.distanceTo(g.position) < 34;
    ui.l.hidden = !vis;
    const x = (tmpV.x + 1) / 2 * canvas.clientWidth, y = (1 - tmpV.y) / 2 * canvas.clientHeight;
    if (vis) { ui.l.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`; if (ui.n.textContent !== name) ui.n.textContent = name; if (ui.s.textContent !== sub) ui.s.textContent = sub; ui.s.hidden = !sub; }
    const showB = vis && bubbleT && now < bubbleT;
    if (!showB) ui.b.hidden = true;
    else { ui.b.hidden = false; ui.b.style.transform = `translate(${x}px,${y - 34}px) translate(-50%,-100%)`; }
  }
  function placeLabels(now) {
    placeLabel(me3.ui, me3.g, personName(me.id, "You"), myStatus.k !== "around" ? STATUS[myStatus.k] : "", now, me3.bubbleT);
    others.forEach(o => { if (o.g) placeLabel(o.ui, o.g, whoIs(o), (statusLine(o.pr) || "").replace(/^In the plaza( · )?/, ""), now, muted.has(o.by) ? 0 : o.bubbleT); });
  }

  /* ---- photo: a polaroid of the current view ---- */
  let photoBlob = null, photoUrl = "";
  function photo() {
    renderer.render(scene, camera);
    const w = canvas.width, h = canvas.height, pad = Math.round(w * 0.04), foot = Math.round(w * 0.12);
    const cv = document.createElement("canvas"); cv.width = w + pad * 2; cv.height = h + pad + foot;
    const g = cv.getContext("2d");
    g.fillStyle = "#FFFDF8"; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(canvas, pad, pad, w, h);
    g.fillStyle = "#3A3F4A"; g.textAlign = "left"; g.textBaseline = "middle";
    const names = [...others.values()].map(o => whoIs(o)).slice(0, 4);
    g.font = `800 ${Math.round(foot * 0.3)}px "M PLUS Rounded 1c", system-ui, sans-serif`;
    g.fillText(names.length ? "With " + names.join(", ") : "Studio Plaza", pad, h + pad + foot * 0.4);
    g.font = `500 ${Math.round(foot * 0.2)}px "M PLUS Rounded 1c", system-ui, sans-serif`; g.fillStyle = "#7A8290";
    g.fillText(new Date().toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" }) + " · Studio Plaza", pad, h + pad + foot * 0.72);
    cv.toBlob(b => {
      if (!b) { toast("Couldn't take the photo."); return; }
      photoBlob = b; if (photoUrl) URL.revokeObjectURL(photoUrl); photoUrl = URL.createObjectURL(b);
      $("#phImg").src = photoUrl;
      $("#phSave").hidden = !downloads;
      $("#phHint").textContent = downloads ? "" : "Right-click the photo to copy or save it.";
      show("#photoSheet"); sfx("confirm");
    }, "image/png");
  }
  $("#phSave").onclick = async () => {
    if (!photoBlob || !downloads) return;
    try { await downloads.save({ filename: "studio-plaza-" + new Date().toISOString().slice(0, 10) + ".png", data: photoBlob }); toast("Photo saved"); }
    catch (e) { if (!e || e.code !== "declined") toast("Couldn't save the photo here."); }
  };
  $("#phClose").onclick = $("#phRetake").onclick = () => { hide("#photoSheet"); sfx("back"); };

  function start() {
    applySky(); resize(); rebuildHouses(); ensureMine(); syncPeers();
    // arrive between the clinic and the fountain, facing the fountain
    if (!me3.placed) { me3.placed = true; me3.x = (Math.random() - 0.5) * 3; me3.z = 7; me3.ry = Math.PI; yaw = 0; }
    setPresence({ w: "plaza", av: encodeAvatar(myAvatar()), p: [me3.x, me3.z, me3.ry].map(v => Math.round(v * 100) / 100), m: 0 });
    camera.position.set(me3.x, 5, me3.z + 8);
    last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; keys.clear(); hideCard(); }
  return { start, stop, syncPeers, rebuildHouses, photo, emote, say, get running() { return !!raf; }, get others() { return others; }, get me3() { return me3; } };
}
// inner ring skips due south, where the clinic's path runs; the outer ring sits between
const HOUSE_SLOTS = [
  ...[0, 1, 11, 2, 10, 3, 9, 4, 8, 5, 7].map(k => ({ R: 23.5, an: k / 12 * Math.PI * 2 })),
  ...Array.from({ length: 12 }, (_, k) => ({ R: 30.5, an: (k + 0.5) / 12 * Math.PI * 2 })),
];
const anyModalOverPlaza = () => ["#clinic", "#people", "#photoSheet", "#confirm", "#stampSheet"].some(m => $(m).classList.contains("open"));
