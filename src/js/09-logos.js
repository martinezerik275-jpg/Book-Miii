/* ================= drop logos ================= */
// look at an image to guess how it should sit on a tile
function analyzeLogo(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    const timer = setTimeout(() => { URL.revokeObjectURL(url); rej(new Error("timeout")); }, 4000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const N = 48, cv = document.createElement("canvas"); cv.width = cv.height = N;
        const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N);
        const d = g.getImageData(0, 0, N, N).data, px = (x, y) => { const i = (y * N + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
        let cornerA = 0; [[1, 1], [N - 2, 1], [1, N - 2], [N - 2, N - 2], [N >> 1, 1], [1, N >> 1]].forEach(([x, y]) => { cornerA += px(x, y)[3]; });
        cornerA /= 6;
        let er = 0, eg = 0, eb = 0, en = 0;
        for (let i = 2; i < N - 2; i++) [[i, 2], [i, N - 3], [2, i], [N - 3, i]].forEach(([x, y]) => { const p = px(x, y); if (p[3] > 200) { er += p[0]; eg += p[1]; eb += p[2]; en++; } });
        let lum = 0, ln = 0;
        for (let y = 0; y < N; y += 2) for (let x = 0; x < N; x += 2) { const p = px(x, y); if (p[3] > 160) { lum += .2126 * p[0] + .7152 * p[1] + .0722 * p[2]; ln++; } }
        lum = ln ? lum / ln : 128;
        const hex = n => Math.round(n).toString(16).padStart(2, "0");
        const bg = en ? "#" + hex(er / en) + hex(eg / en) + hex(eb / en) : null;
        const style = cornerA > 200 ? "app" : (lum > 185 ? "color" : "white");
        res({ style, bg });
      } catch (e) { rej(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); rej(); };
    img.src = url;
  });
}
const NOISE = new Set(["logo", "logos", "icon", "icons", "favicon", "apple", "touch", "brand", "mark", "wordmark", "symbol", "official", "app", "png", "svg", "jpg", "jpeg", "webp", "copy", "final", "new", "square", "round"]);
function normName(str) {
  return String(str).toLowerCase().replace(/\.[a-z0-9]{2,4}$/, "").replace(/[_\-.+()\[\]]+/g, " ")
    .split(/\s+/).filter(w => w && !NOISE.has(w) && !/^\d{3,4}(px)?$/.test(w) && !/^\d+x\d+(px)?$/.test(w) && !/^\d+px$/.test(w) && !/^@?\d+x$/.test(w)).join(" ").trim();
}
const squash = x => x.replace(/[^a-z0-9]/g, "");
function bigrams(x) { const a = []; for (let i = 0; i < x.length - 1; i++) a.push(x.slice(i, i + 2)); return a; }
function dice(a, b) {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const A = bigrams(a), B = bigrams(b).slice(); let hit = 0;
  A.forEach(g => { const i = B.indexOf(g); if (i >= 0) { hit++; B.splice(i, 1); } });
  return 2 * hit / (A.length + B.length);
}
function tileKeys(c) {
  const keys = [squash(normName(c.name))];
  if (c.url) { try { const h = new URL(c.url).hostname.replace(/^www\./, "").replace(/^app\./, ""); keys.push(squash(h.split(".")[0])); keys.push(squash(h)); } catch {} }
  return keys.filter(Boolean);
}
function keyScore(fileKey, k) {
  if (k === fileKey) return 1;
  if (k.length >= 3 && fileKey.length >= 3 && (k.includes(fileKey) || fileKey.includes(k))) return .78 + .2 * Math.min(k.length, fileKey.length) / Math.max(k.length, fileKey.length);
  return dice(fileKey, k) * .9;
}
function matchScore(fileKey, c) {
  // the tile's name counts a little more than its web address, so two tiles on one site don't tie
  const [nameKey, ...domainKeys] = tileKeys(c);
  const byName = nameKey ? keyScore(fileKey, nameKey) : 0;
  const byDomain = Math.max(0, ...domainKeys.map(k => keyScore(fileKey, k) * .96));
  return Math.min(1, Math.max(byName, byDomain) + byName * .02);
}
const confOf = sc => sc >= .97 ? ["exact", "Exact match"] : sc >= .78 ? ["close", "Close match"] : sc >= .55 ? ["guess", "Best guess"] : ["none", "No match"];
let lgRows = [], lgBusy = false;
function openLogos() { if (!lgRows.length) renderLogos(); show("#logos"); sfx("select"); }
async function addLogoFiles(files) {
  const imgs = [...files].filter(f => /^image\//.test(f.type) || /\.(svg|png|jpe?g|webp|gif)$/i.test(f.name));
  if (!imgs.length) { toast("No images found. Drop PNG, SVG, JPG or WebP files."); sfx("error"); return; }
  const known = new Set(lgRows.map(r => r.file.name + r.file.size));
  const fresh = imgs.filter(f => !known.has(f.name + f.size)).map(f =>
    ({ file: f, url: URL.createObjectURL(f), key: squash(normName(f.name)), tile: "", score: 0, style: "color", bg: null, auto: true }));
  $("#lgSub").textContent = "Reading " + fresh.length + (fresh.length === 1 ? " image…" : " images…");
  await Promise.all(fresh.map(async row => { try { const a = await analyzeLogo(row.file); row.style = a.style; row.bg = a.bg; } catch {} }));
  lgRows.push(...fresh);
  autoMatch(); renderLogos();
  if (!$("#logos").classList.contains("open")) show("#logos");
  sfx("confirm");
}
function autoMatch() {
  const cands = state.channels, pairs = [];
  lgRows.forEach((r, ri) => { if (!r.auto) return; r.tile = ""; r.score = 0; cands.forEach(c => { const sc = matchScore(r.key, c); if (sc >= .55) pairs.push([sc, ri, c.id]); }); });
  pairs.sort((a, b) => b[0] - a[0]);
  const usedT = new Set(lgRows.filter(r => !r.auto && r.tile).map(r => r.tile)), doneR = new Set();
  pairs.forEach(([sc, ri, id]) => { if (doneR.has(ri) || usedT.has(id)) return; lgRows[ri].tile = id; lgRows[ri].score = sc; doneR.add(ri); usedT.add(id); });
}
function renderLogos() {
  const body = $("#lgBody"); body.innerHTML = "";
  if (!lgRows.length) {
    body.innerHTML = `<div class="lg-zone" id="lgZone"><b>Drop logo images or a whole folder here</b>
      <p>Name each file after its tile or its website, like "Artlist.png" or "film-grab.svg".<br>Square images, 256 pixels or larger, look best.</p>
      <div class="row"><button class="pill small primary" id="lgPick">Choose files</button><button class="pill small" id="lgPickDir">Choose folder</button></div></div>`;
    $("#lgPick").onclick = () => $("#lgFiles").click();
    $("#lgPickDir").onclick = () => $("#lgFolder").click();
    const z = $("#lgZone");
    z.addEventListener("dragover", e => { e.preventDefault(); z.classList.add("over"); });
    z.addEventListener("dragleave", () => z.classList.remove("over"));
    $("#lgSub").textContent = "Name each file after its tile, like \u201cArtlist.png\u201d.";
    $("#lgApply").disabled = true; $("#lgApply").textContent = "Apply logos"; $("#lgMore").hidden = true;
    return;
  }
  $("#lgMore").hidden = false;
  lgRows.forEach((r, i) => {
    const c = r.tile && byId(r.tile);
    const row = document.createElement("div"); row.className = "lg-row" + (c ? "" : " skip");
    const fb = document.createElement("div"); fb.className = "lg-file"; const im = document.createElement("img"); im.src = r.url; im.alt = ""; fb.appendChild(im);
    const nm = document.createElement("div"); nm.className = "lg-name"; const b = document.createElement("b"); b.textContent = r.file.name;
    const [cls, label] = c ? (r.auto ? confOf(r.score) : ["close", "Chosen by you"]) : ["none", "Skipped"];
    const cf = document.createElement("span"); cf.className = "lg-conf " + cls; cf.textContent = label;
    nm.append(b, cf);
    if (c && (c.iconAsset || c.iconData)) { const rep = document.createElement("span"); rep.className = "hint"; rep.style.display = "block"; rep.textContent = "Replaces its current image"; nm.appendChild(rep); }
    const ar = document.createElement("div"); ar.className = "lg-arrow"; ar.textContent = "→";
    const mini = document.createElement("div"); mini.className = "mini"; const sc = document.createElement("div"); sc.className = "screen"; mini.appendChild(sc);
    fillScreen(sc, Object.assign({}, c || { name: "?", hue: 210 }, { iconData: r.url, iconAsset: null, iconStyle: r.style, iconBg: r.bg }));
    const pick = document.createElement("div"); pick.className = "lg-pick";
    const sel = document.createElement("select"); sel.setAttribute("aria-label", "Tile for " + r.file.name);
    const skip = document.createElement("option"); skip.value = ""; skip.textContent = "Skip this file"; sel.appendChild(skip);
    state.pages.forEach(p => {
      const chs = state.channels.filter(x => x.page === p.id).sort((a, b2) => a.slot - b2.slot); if (!chs.length) return;
      const g = document.createElement("optgroup"); g.label = p.name;
      chs.forEach(x => { const o = document.createElement("option"); o.value = x.id; o.textContent = x.name; g.appendChild(o); });
      sel.appendChild(g);
    });
    sel.value = r.tile || "";
    sel.onchange = () => {
      lgRows.forEach((o, j) => { if (j !== i && o.tile === sel.value && sel.value) { o.tile = ""; o.auto = false; } });
      r.tile = sel.value; r.auto = false; sfx("tick"); renderLogos();
    };
    const seg = document.createElement("div"); seg.className = "seg";
    [["app", "App icon"], ["color", "On color"], ["white", "On white"]].forEach(([v, t]) => {
      const bt = document.createElement("button"); bt.type = "button"; bt.dataset.v = v; bt.textContent = t; bt.className = r.style === v ? "on" : "";
      bt.onclick = () => { r.style = v; sfx("tick"); renderLogos(); }; seg.appendChild(bt);
    });
    pick.append(sel, seg);
    row.append(fb, nm, ar, mini, pick); body.appendChild(row);
  });
  const n = lgRows.filter(r => r.tile).length;
  $("#lgSub").textContent = `${n} of ${lgRows.length} ${lgRows.length === 1 ? "file" : "files"} matched. Check the pairings, then apply.`;
  $("#lgApply").disabled = !n || lgBusy; $("#lgApply").textContent = n ? `Apply ${n} ${n === 1 ? "logo" : "logos"}` : "Apply logos";
}
function closeLogos() {
  if (lgBusy) return;
  lgRows.forEach(r => URL.revokeObjectURL(r.url)); lgRows = [];
  hide("#logos"); sfx("back");
}
$("#lgApply").onclick = async () => {
  const todo = lgRows.filter(r => r.tile && byId(r.tile)); if (!todo.length || lgBusy) return;
  lgBusy = true; $("#lgApply").disabled = true; $("#lgMore").disabled = true;
  const prog = $("#lgProg"); prog.classList.add("on"); let done = 0, failed = 0;
  for (const r of todo) {
    const c = byId(r.tile);
    try {
      if (assets) {
        try { const up = await assets.upload(r.file); c.iconAsset = up.id; c.iconData = null; }
        catch { c.iconData = await shrinkImage(r.file); c.iconAsset = null; }
      } else { c.iconData = await shrinkImage(r.file); c.iconAsset = null; }
      c.iconStyle = r.style; c.iconBg = r.bg;
      sfx("hover", done % PER, tileWorld(c));
    } catch { failed++; }
    done++; prog.firstElementChild.style.width = (100 * done / todo.length) + "%";
    $("#lgApply").textContent = `Uploading ${done} of ${todo.length}…`;
  }
  save(); render();
  lgBusy = false; $("#lgMore").disabled = false; prog.classList.remove("on"); prog.firstElementChild.style.width = "0";
  lgRows.forEach(r => URL.revokeObjectURL(r.url)); lgRows = [];
  hide("#logos"); sfx("complete");
  toast(failed ? `Applied ${todo.length - failed} logos. ${failed} couldn't be read.` : `Applied ${todo.length} ${todo.length === 1 ? "logo" : "logos"}`);
};
$("#lgFiles").onchange = e => { const f = [...e.target.files]; e.target.value = ""; if (f.length) addLogoFiles(f); };
$("#lgFolder").onchange = e => { const f = [...e.target.files]; e.target.value = ""; if (f.length) addLogoFiles(f); };
$("#lgMore").onclick = () => $("#lgFiles").click();
$("#lgClose").onclick = closeLogos; $("#lgCancel").onclick = closeLogos;
$("#logos").addEventListener("click", e => { if (e.target.id === "logos") closeLogos(); });
$("#logosBtn").onclick = openLogos;
$("#stLogos").onclick = () => { hide("#settings"); openLogos(); };

// drag files from your computer anywhere onto the menu
async function filesFromDrop(dt) {
  const out = [], items = dt.items ? [...dt.items] : [];
  const entries = items.map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (!entries.length) return [...dt.files];
  const walk = entry => new Promise(res => {
    if (entry.isFile) entry.file(f => { out.push(f); res(); }, () => res());
    else if (entry.isDirectory) {
      const rd = entry.createReader(), all = [];
      const readAll = () => rd.readEntries(async ents => { if (!ents.length) { for (const en of all) await walk(en); res(); } else { all.push(...ents); readAll(); } }, () => res());
      readAll();
    } else res();
  });
  for (const en of entries) await walk(en);
  return out;
}
let dragDepth = 0;
const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
const logoDropAllowed = () => !["#start", "#editor", "#settings", "#search", "#keys", "#idle", "#bdSheet"].some(m => $(m).classList.contains("open"));
addEventListener("dragenter", e => { if (!hasFiles(e) || !logoDropAllowed()) return; dragDepth++; if (!$("#logos").classList.contains("open")) $("#dropHint").classList.add("on"); });
addEventListener("dragleave", e => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $("#dropHint").classList.remove("on"); });
addEventListener("dragover", e => { if (hasFiles(e) && logoDropAllowed()) e.preventDefault(); });
addEventListener("drop", async e => {
  if (!hasFiles(e)) return; e.preventDefault(); dragDepth = 0; $("#dropHint").classList.remove("on");
  document.querySelectorAll(".lg-zone.over").forEach(z => z.classList.remove("over"));
  if (!logoDropAllowed()) return;
  const files = await filesFromDrop(e.dataTransfer); addLogoFiles(files);
});

