/* ================= settings ================= */
const SFX_KINDS = [["hover", "Hover"], ["open", "Open channel"], ["back", "Back"], ["page", "Page turn"]];
let sfxUploadKind = null;
function openSettings() { renderSettings(); showTab(stTab); show("#settings"); sfx("select"); }
function renderSettings() {
  renderVersions(); renderSkins();
  const a = state.audio;
  $("#stMusicVol").value = a.musicVol; $("#stSfxVol").value = a.sfxVol; $("#stTune").checked = a.tune !== false; $("#stAway").checked = a.pauseHidden !== false;
  $("#stMusicName").innerHTML = ""; const mn = document.createElement("span");
  mn.textContent = a.music ? (a.musicName || "Your track") : "Built-in ambient loop"; $("#stMusicName").appendChild(mn);
  $("#stMusicUp").hidden = !assets; $("#stMusicReset").hidden = !a.music || !assets;
  const box = $("#stSfx"); box.innerHTML = "";
  SFX_KINDS.forEach(([k, label]) => {
    const r = document.createElement("div"); r.className = "list-row";
    const n = document.createElement("div"); n.className = "name"; n.textContent = label;
    const sub = document.createElement("div"); sub.className = "sub"; sub.textContent = a.sfx[k] ? (a.sfxNames[k] || "Custom sound") : "Built-in"; n.appendChild(sub);
    const play = document.createElement("button"); play.className = "pill small"; play.textContent = "Play"; play.onclick = () => sfx(k === "hover" ? "hover" : k, 4);
    r.append(n, play);
    if (assets) {
      const up = document.createElement("button"); up.className = "pill small"; up.textContent = "Upload";
      up.onclick = () => { sfxUploadKind = k; $("#stSfxFile").click(); }; r.appendChild(up);
      if (a.sfx[k]) { const rs = document.createElement("button"); rs.className = "pill small"; rs.textContent = "Reset";
        rs.onclick = () => { delete a.sfx[k]; delete a.sfxNames[k]; delete sfxBuffers[k]; save(); renderSettings(); }; r.appendChild(rs); }
    }
    box.appendChild(r);
  });
  $("#stUploadHint").textContent = assets ? "Short WAV, MP3 or OGG files work best for effects." : "Sound uploads are available when you open this page on claude.ai as its owner.";
  const pbox = $("#stPages"); pbox.innerHTML = "";
  state.pages.forEach((p, i) => {
    const r = document.createElement("div"); r.className = "list-row";
    const inp = document.createElement("input"); inp.type = "text"; inp.value = p.name; inp.maxLength = 30; inp.setAttribute("aria-label", "Page name");
    inp.onchange = () => { p.name = inp.value.trim() || "Page"; save(); render(); };
    const count = state.channels.filter(c => c.page === p.id).length;
    const cnt = document.createElement("span"); cnt.className = "sub"; cnt.textContent = count + "/" + PER;
    const up = document.createElement("button"); up.className = "x"; up.textContent = "↑"; up.setAttribute("aria-label", "Move page up"); up.disabled = i === 0;
    up.onclick = () => { state.pages.splice(i - 1, 0, state.pages.splice(i, 1)[0]); save(); render(); renderSettings(); };
    const del = document.createElement("button"); del.className = "x"; del.textContent = "✕"; del.setAttribute("aria-label", "Delete page");
    del.disabled = state.pages.length === 1;
    del.onclick = async () => {
      if (count && !await askConfirm(`Delete "${p.name}"? Its ${count} channel(s) move to another page.`, "Delete page")) return;
      if (!state.pages.includes(p)) return;
      i = state.pages.indexOf(p);
      state.pages.splice(i, 1); state.channels.forEach(c => { if (c.page === p.id) { c.page = state.pages[0].id; c.slot = -1; } });
      state = normalize(state); save(); render(); renderSettings();
    };
    r.append(inp, cnt, up, del); pbox.appendChild(r);
  });
  $("#stSync").textContent = ref ? "Your channels sync across your devices." : "Saving in this browser only. Cloud sync hasn't connected yet.";
  [...$("#stTheme").children].forEach(b => b.classList.toggle("on", b.dataset.v === state.theme));
  $("#stLight").checked = !!state.lighting;
  $("#stIdle").checked = !!state.idle.on; $("#stIdleMins").value = String(state.idle.mins); $("#stIdleMins").disabled = !state.idle.on;
  $("#stFollow").checked = state.sound.follow !== false;
  const wb = $("#stWorlds"); wb.innerHTML = "";
  WORLD_IDS.forEach(id => {
    const W = WORLDS[id], used = state.channels.filter(c => worldOf(c) === id).length;
    const r = document.createElement("div"); r.className = "world-row";
    const top = document.createElement("div"); top.className = "top";
    const dot = document.createElement("span"); dot.className = "world-dot"; dot.style.background = W.color;
    const b = document.createElement("b"); b.textContent = W.name;
    const sub = document.createElement("span"); sub.className = "sub"; sub.textContent = used === 1 ? "1 tile" : used + " tiles";
    const pl = document.createElement("button"); pl.className = "pill small"; pl.textContent = "Play"; pl.onclick = () => previewWorld(id);
    top.append(dot, b, sub, pl);
    const inp = document.createElement("input"); inp.type = "text"; inp.value = worldTags(id).join(", ");
    inp.setAttribute("aria-label", W.name + " keywords");
    inp.onchange = () => {
      state.sound.worlds[id] = inp.value.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
      save(); renderSettings(); if (state.pages[page]) setMusicWorld(pageWorld(state.pages[page].id));
    };
    r.append(top, inp); wb.appendChild(r);
  });
}
$("#settingsBtn").onclick = openSettings;
let stTab = "music";
function showTab(t, focus) {
  stTab = t;
  document.querySelectorAll(".st-rail [role=tab]").forEach(b => {
    const on = b.dataset.tab === t; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  });
  document.querySelectorAll(".st-pane").forEach(p => p.classList.toggle("on", p.dataset.pane === t));
  $(".st-panes").scrollTop = 0;
}
$(".st-rail").addEventListener("click", e => { const b = e.target.closest("[role=tab]"); if (b && b.dataset.tab !== stTab) { showTab(b.dataset.tab); sfx("select"); } });
$(".st-rail").addEventListener("keydown", e => {
  const tabs = [...document.querySelectorAll(".st-rail [role=tab]")], i = tabs.findIndex(b => b.dataset.tab === stTab);
  const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
  if (k) { e.preventDefault(); const n = tabs[(i + k + tabs.length) % tabs.length]; showTab(n.dataset.tab, true); sfx("tick"); }
});
$(".st-rail").addEventListener("pointerover", e => { const b = e.target.closest("[role=tab]"); if (b && !b.contains(e.relatedTarget)) sfx("tick"); });
$("#stIdleNow").onclick = () => { hide("#settings"); setTimeout(enterIdle, 150); };
$("#stClose").onclick = () => { hide("#settings"); sfx("back"); };
$("#stMusicVol").oninput = e => { state.audio.musicVol = +e.target.value; applyMusicVolume(); };
$("#stMusicVol").onchange = save;
$("#stSfxVol").oninput = e => { state.audio.sfxVol = +e.target.value; };
$("#stSfxVol").onchange = () => { save(); sfx("hover", 5); };
$("#stTune").onchange = e => { state.audio.tune = e.target.checked; save(); };
$("#stAway").onchange = e => { state.audio.pauseHidden = e.target.checked; save(); };
$("#stLight").onchange = e => { state.lighting = e.target.checked; applyLighting(); save(); };
$("#stIdle").onchange = e => { state.idle.on = e.target.checked; $("#stIdleMins").disabled = !state.idle.on; save(); };
$("#stIdleMins").onchange = e => { state.idle.mins = +e.target.value; save(); };
$("#stFollow").onchange = e => { state.sound.follow = e.target.checked; save(); if (state.pages[page]) setMusicWorld(pageWorld(state.pages[page].id)); };
$("#stAddPage").onclick = () => { state.pages.push({ id: uid(), name: "New page" }); save(); render(); renderSettings(); };
$("#stTheme").onclick = e => { const b = e.target.closest("button"); if (!b) return; state.theme = b.dataset.v; applyTheme(); save(); renderSettings(); };
$("#stMusicUp").onclick = () => $("#stMusicFile").click();
$("#stMusicFile").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f || !assets) return;
  try { toast("Uploading music…"); const r = await assets.upload(f);
    state.audio.music = r.id; state.audio.musicName = f.name; save(); renderSettings(); startMusic(true); toast("Music track set"); }
  catch { toast("Couldn't upload that file. Try an MP3 or OGG under 20 MB."); }
};
$("#stMusicReset").onclick = () => { state.audio.music = null; state.audio.musicName = ""; save(); renderSettings(); startMusic(true); };
$("#stSfxFile").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; const k = sfxUploadKind; if (!f || !assets || !k) return;
  try { toast("Uploading sound…"); const r = await assets.upload(f);
    state.audio.sfx[k] = r.id; state.audio.sfxNames[k] = f.name; save(); await loadSfx(k, r.id); renderSettings(); sfx(k === "hover" ? "hover" : k, 4); }
  catch { toast("Couldn't upload that file. Try a WAV, MP3 or OGG."); }
};
$("#stExport").onclick = async () => {
  const data = JSON.stringify({ pages: state.pages, channels: state.channels }, null, 2);
  if (downloads) { try { await downloads.save({ filename: "studio-menu-channels.json", data }); } catch { } }
  else { try { await navigator.clipboard.writeText(data); toast("Copied your channels to the clipboard"); } catch { toast("Export isn't available here"); } }
};
$("#stImport").onclick = () => $("#stImportFile").click();
$("#stImportFile").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.channels) || !Array.isArray(d.pages)) throw 0;
    if (!await askConfirm(`Replace your menu with ${d.channels.length} channels from this file?`, "Replace")) return;
    state.pages = d.pages; state.channels = d.channels; state = normalize(state); save(); page = 0; render(); renderSettings(); toast("Channels imported");
  } catch { toast("That file isn't a Studio Menu export."); }
};
function applyTheme() {
  let t = state.theme;
  if (t === "time") { const h = hourNow(); t = (h >= 19.5 || h < 6.5) ? "dark" : "light"; }
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}
function hourNow() { const d = new Date(); return d.getHours() + d.getMinutes() / 60; }

