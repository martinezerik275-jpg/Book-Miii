/* ================= start ================= */
$("#start").addEventListener("click", () => {
  initAudio(); if (ctx && ctx.state !== "running") ctx.resume();
  $("#start").classList.remove("open");
  if (state.pages[page]) { musicWorld = pageWorld(state.pages[page].id); if (state.sound.follow === false) musicWorld = "bells"; }
  setTimeout(() => { sfx("open"); startMusic(); loadAllSfx(); }, 60);
  lastActivity = Date.now();
  const first = track.children[page]?.querySelector(".slot");
  if (first && !matchMedia("(pointer: fine)").matches) {} // leave focus alone on touch
});

