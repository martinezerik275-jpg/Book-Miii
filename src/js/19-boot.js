/* ================= boot ================= */
let local = null; try { local = JSON.parse(localStorage.getItem(LS_KEY)); } catch {}
state = normalize(local || blankState());
applyTheme(); applyLighting(); applyBackdrop(); render(); renderSession();

function whenClaude(cb, tries = 0) {
  if (window.claude && typeof window.claude.use === "function") return cb();
  if (tries < 50) setTimeout(() => whenClaude(cb, tries + 1), 200);
}
whenClaude(() => {
  claude.use("db").then(d => {
    if (!d) return; db = d; ref = db.doc("menu/main");
    ref.onSnapshot(snap => {
      if (saving) return;
      if (!snap.exists) { if (local && local.channels && local.channels.length) save(); return; }
      const data = JSON.parse(JSON.stringify(snap.data()));
      if (gotRemote && (data.rev || 0) === state.rev && JSON.stringify(data.channels) === JSON.stringify(state.channels)) return;
      gotRemote = true;
      const hadMusic = state.audio.music;
      state = normalize(data);
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
      applyTheme(); applyLighting(); applyBackdrop(); render(); renderSession();
      if (ctx) { loadAllSfx(); if (hadMusic !== state.audio.music) startMusic(true); else applyMusicVolume(); }
      if ($("#settings").classList.contains("open")) renderSettings();
    }, () => {});
  }).catch(() => {});
  claude.use("assets").then(a => { assets = a || null; }).catch(() => {});
  claude.use("sample").then(s => { sample = s || null; }).catch(() => {});
  claude.use("downloads").then(d => { downloads = d || null; }).catch(() => {});
});
