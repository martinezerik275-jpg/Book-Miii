/* ================= audio ================= */
let ctx = null, sfxBus = null, musicBus = null, musicEl = null, genTimer = null, ducked = false, genOut = null, awayPaused = false;
const sfxBuffers = {};
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];
function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  sfxBus = ctx.createGain(); sfxBus.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.connect(ctx.destination);
}
function tone(freq, t, dur, vol, type = "sine", dest = sfxBus) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}
/* ---------- sound worlds ---------- */
const WORLDS = {
  marimba: { name: "Marimba", voice: "marimba", root: 62, color: "#E0A155", gain: 1.2, mgain: 1.1,
    tags: ["3d", "blender", "add-on", "add-ons", "assets", "rigging", "animation", "materials", "camera match", "python", "camera", "modeling"] },
  bells: { name: "Bells", voice: "bells", root: 65, color: "#7CC4F0", gain: 1, mgain: 1,
    tags: ["reference", "film stills", "inspiration", "moodboard", "color", "palettes", "gallery", "stock", "ideas", "fx", "free packs", "castlevania", "art", "video"] },
  piano: { name: "Piano", voice: "piano", root: 60, color: "#B7A6E8", gain: 1.1, mgain: 1.1,
    tags: ["tutorial", "tutorials", "courses", "docs", "articles", "learn", "techniques", "cinematography", "photoshop", "motion design", "game art", "article"] },
  synth: { name: "Synth", voice: "synth", root: 57, minor: true, color: "#E57BC0", gain: 1, mgain: .8,
    tags: ["ai", "voice", "upscale", "3d capture"] },
  pluck: { name: "Pluck", voice: "pluck", root: 67, color: "#7ED1A6", gain: 1, mgain: .9,
    tags: ["files", "cloud", "planning", "boards", "production", "call sheets", "index", "software", "converter", "dvd"] },
  glass: { name: "Glass", voice: "glass", root: 64, color: "#9FE3E0", gain: 1, mgain: 1,
    tags: ["music", "sfx", "footage", "textures", "marketplace", "presets", "creators"] },
  chip: { name: "Chip", voice: "chip", root: 60, color: "#F2D35B", gain: 1, mgain: .7,
    tags: ["game", "games", "gamedev", "game dev", "fnaf", "roblox", "releases", "pixel"] }
};
const WORLD_IDS = Object.keys(WORLDS);
function worldTags(id) { const t = state && state.sound && state.sound.worlds[id]; return Array.isArray(t) ? t : WORLDS[id].tags; }
function worldForTags(tags) {
  for (const raw of tags || []) {
    const t = String(raw).toLowerCase().trim();
    const direct = WORLD_IDS.find(id => id === t || WORLDS[id].name.toLowerCase() === t);
    if (direct) return { w: direct, by: raw, direct: true };
    for (const id of WORLD_IDS) if (worldTags(id).includes(t)) return { w: id, by: raw };
  }
  return null;
}
function worldOf(c) {
  if (!c) return null;
  const hit = worldForTags(c.tags); if (hit) return hit.w;
  if (c.kind === "flow") { const f = flowSteps(c)[0]; if (f) return worldOf(f.ch); }
  return null;
}
function pageWorld(pid) {
  const n = {}; let best = null;
  state.channels.forEach(c => { if (c.page !== pid) return; const w = worldOf(c); if (w) { n[w] = (n[w] || 0) + 1; if (!best || n[w] > n[best]) best = w; } });
  return best || "bells";
}
const tileWorld = c => (c && (worldOf(c) || pageWorld(c.page))) || "bells";
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function scaleDeg(W, i) { const sc = W.minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9]; return sc[i % 5] + 12 * Math.floor(i / 5); }
function note(freq, t, dur, vol, type = "sine", dest = sfxBus, o = {}) {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, t); if (o.detune) osc.detune.value = o.detune;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + (o.attack || 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let last = osc;
  if (o.cut) {
    const f = ctx.createBiquadFilter(); f.type = "lowpass";
    f.frequency.setValueAtTime(Math.min(o.cut, 18000), t);
    if (o.cutTo) f.frequency.exponentialRampToValueAtTime(Math.min(o.cutTo, 18000), t + dur * 0.7);
    osc.connect(f); last = f;
  }
  last.connect(g); g.connect(dest); osc.start(t); osc.stop(t + dur + 0.03);
  return g;
}
function voice(kind, f, t, v, dest) {
  switch (kind) {
    case "marimba": note(f, t, .55, v, "sine", dest); note(f * 3.93, t, .09, v * .3, "sine", dest); note(f * 9.2, t, .025, v * .1, "sine", dest); break;
    case "piano": note(f, t, 1.2, v * .75, "triangle", dest, { cut: f * 7, cutTo: f * 2 }); note(f * 2, t, .5, v * .22, "sine", dest); note(f, t, 1, v * .3, "sine", dest, { detune: 5 }); break;
    case "synth": note(f, t, .55, v * .4, "sawtooth", dest, { cut: f * 8, cutTo: f * 1.3, attack: .008 }); note(f, t, .55, v * .3, "sawtooth", dest, { detune: 11, cut: f * 6, cutTo: f }); break;
    case "pluck": note(f, t, .4, v * .5, "square", dest, { cut: f * 10, cutTo: f * 1.1, attack: .002 }); note(f * 2, t, .12, v * .15, "sine", dest); break;
    case "glass": note(f, t, 1.1, v * .6, "sine", dest, { attack: .02 }); note(f * 2.01, t, .8, v * .32, "sine", dest, { attack: .02 }); note(f * 4.2, t, .3, v * .1, "sine", dest); break;
    case "chip": note(f, t, .09, v * .26, "square", dest, { attack: .001 }); note(f * 2, t + .045, .09, v * .18, "square", dest, { attack: .001 }); break;
    default: note(f, t, 1.3, v, "sine", dest); note(f * 2.76, t, .4, v * .22, "sine", dest); note(f * 5.4, t, .15, v * .07, "sine", dest);
  }
}
const hoverBase = W => 72 + (W.root % 12) - (W.root % 12 > 7 ? 12 : 0);
function previewWorld(id) {
  if (!ctx || ctx.state !== "running") { toast("Click to begin first to hear sounds."); return; }
  const W = WORLDS[id], now = ctx.currentTime, v = state.audio.sfxVol;
  if (v <= 0) return; sfxBus.gain.value = v;
  [0, 1, 2, 3, 4, 5, 7].forEach((d, i) => voice(W.voice, mtof(hoverBase(W) + scaleDeg(W, d)), now + i * 0.09, 0.1 * W.gain, sfxBus));
}

let lastHover = 0;
function sfx(kind, slot = 0, world = null) {
  if (!ctx || ctx.state !== "running") return;
  const v = state.audio.sfxVol; if (v <= 0) return;
  const now = ctx.currentTime;
  if (kind === "hover" && now - lastHover < 0.03) return;
  if (kind === "hover") lastHover = now;
  sfxBus.gain.value = v;
  const rate = state.audio.tune !== false ? Math.pow(2, PENTA[slot % PER] / 12) : 1;
  const custom = { hover: "hover", open: "open", launch: "open", back: "back", page: "page" }[kind];
  const W = WORLDS[world] || WORLDS[(state.pages[page] && pageWorld(state.pages[page].id)) || "bells"];
  if (custom && sfxBuffers[custom]) {
    const s = ctx.createBufferSource(); s.buffer = sfxBuffers[custom];
    if (kind === "hover") s.playbackRate.value = Math.pow(rate, 0.5);
    s.connect(sfxBus); s.start(); return;
  }
  switch (kind) {
    case "hover": voice(W.voice, mtof(hoverBase(W) + (state.audio.tune !== false ? scaleDeg(W, slot % PER) : 0)), now, 0.11 * W.gain, sfxBus); break;
    case "tick": tone(1760, now, 0.045, 0.05, "triangle"); break;
    case "select": tone(784, now, 0.09, 0.09); tone(1175, now + 0.05, 0.12, 0.08); break;
    case "confirm": [784, 988, 1175, 1568].forEach((f, i) => tone(f, now + i * 0.05, 0.22, 0.07)); break;
    case "open": [0, 1, 2, 3, 5].forEach((d, i) => voice(W.voice, mtof(hoverBase(W) - 12 + scaleDeg(W, d)), now + i * 0.045, 0.075 * W.gain, sfxBus)); tone(mtof(hoverBase(W) - 24), now, 0.5, 0.05, "triangle"); break;
    case "launch": voice(W.voice, mtof(hoverBase(W) + scaleDeg(W, 5)), now, 0.09 * W.gain, sfxBus); voice(W.voice, mtof(hoverBase(W) + scaleDeg(W, 7)), now + 0.07, 0.08 * W.gain, sfxBus); break;
    case "ignite": {
      for (let i = 0; i < 9; i++) voice(W.voice, mtof(hoverBase(W) - 12 + scaleDeg(W, i)), now + i * 0.04, 0.07 * W.gain, sfxBus);
      [0, 2, 4].forEach(d => voice(W.voice, mtof(hoverBase(W) + scaleDeg(W, d)), now + 0.42, 0.07 * W.gain, sfxBus));
      tone(mtof(hoverBase(W) - 24), now + 0.42, 0.9, 0.06, "triangle");
      break;
    }
    case "step": voice(W.voice, mtof(hoverBase(W) + scaleDeg(W, slot)), now, 0.09 * W.gain, sfxBus); voice(W.voice, mtof(hoverBase(W) + scaleDeg(W, slot + 2)), now + 0.06, 0.07 * W.gain, sfxBus); break;
    case "complete": [0, 2, 4, 5, 7, 9].forEach((d, i) => voice(W.voice, mtof(hoverBase(W) - 12 + scaleDeg(W, d)), now + i * 0.07, 0.08 * W.gain, sfxBus)); [0, 2, 4].forEach(d => voice("glass", mtof(hoverBase(W) + scaleDeg(W, d)), now + 0.5, 0.06, sfxBus)); break;
    case "idleIn": [7, 5, 4, 2, 0].forEach((d, i) => voice("glass", mtof(hoverBase(W) - 12 + scaleDeg(W, d)), now + i * 0.11, 0.05, sfxBus)); break;
    case "idleOut": [0, 2, 4, 7].forEach((d, i) => voice("glass", mtof(hoverBase(W) - 12 + scaleDeg(W, d)), now + i * 0.07, 0.05, sfxBus)); break;
    case "back": tone(988, now, 0.1, 0.08); tone(659, now + 0.07, 0.16, 0.08); break;
    case "error": tone(330, now, 0.12, 0.09, "triangle"); tone(262, now + 0.1, 0.18, 0.09, "triangle"); break;
    case "page": {
      const len = 0.32, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / d.length);
      const s = ctx.createBufferSource(); s.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.2;
      f.frequency.setValueAtTime(600, now); f.frequency.exponentialRampToValueAtTime(3200, now + len);
      const g = ctx.createGain(); g.gain.value = 0.22;
      s.connect(f); f.connect(g); g.connect(sfxBus); s.start(now);
      break;
    }
  }
}
async function loadSfx(k, id) {
  if (!ctx || !id) return;
  try { const r = await fetch("/_blob/" + id); const ab = await r.arrayBuffer(); sfxBuffers[k] = await ctx.decodeAudioData(ab); } catch {}
}
function loadAllSfx() { Object.entries(state.audio.sfx || {}).forEach(([k, id]) => { if (!sfxBuffers[k]) loadSfx(k, id); }); }

/* music: uploaded track, or a gentle generated loop */
function applyMusicVolume() {
  const a = state.audio, vol = a.musicOn ? a.musicVol * (ducked ? 0.35 : 1) : 0;
  if (musicEl) musicEl.volume = Math.min(1, vol);
  if (musicBus) musicBus.gain.setTargetAtTime(vol, ctx.currentTime, 0.25);
  $("#musicBtn").classList.toggle("on", !!a.musicOn);
}
function duckMusic(on) { ducked = on; if (ctx) applyMusicVolume(); }
function stopMusic() {
  if (musicEl) { musicEl.pause(); musicEl.src = ""; musicEl = null; }
  clearInterval(genTimer); genTimer = null;
}
function startMusic(restart) {
  if (!ctx) return;
  if (restart) stopMusic();
  applyMusicVolume();
  if (!state.audio.musicOn) { stopMusic(); return; }
  if (state.audio.music) {
    if (musicEl) return;
    musicEl = new Audio("/_blob/" + state.audio.music); musicEl.loop = true; applyMusicVolume();
    musicEl.play().catch(() => {});
  } else if (!genTimer) startGenerative();
}
let musicWorld = "bells", worldChange = false; const livePads = [];
function setMusicWorld(w) {
  if (state && state.sound && state.sound.follow === false) w = "bells";
  if (!WORLDS[w] || w === musicWorld) return;
  musicWorld = w; worldChange = true;
}
const PROG_MAJOR = [[5, 9, 12, 16], [4, 7, 11, 14], [2, 5, 9, 12], [0, 4, 7, 11]];
const PROG_MINOR = [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [-5, -2, 2, 5]];
function startGenerative() {
  // soft music-box loop over a slow four-chord cycle; effect chain is built once and reused
  if (!genOut) {
    const delay = ctx.createDelay(); delay.delayTime.value = 0.43;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    delay.connect(fb); fb.connect(delay); delay.connect(lp); lp.connect(wet); wet.connect(musicBus);
    genOut = ctx.createGain(); genOut.connect(musicBus); genOut.connect(delay);
  }
  const out = genOut;
  const stepDur = 60 / 76 / 2; let step = 0, next = ctx.currentTime + 0.1;
  const pattern = [0, 2, 1, 3, 2, 1, 3, 0];
  const bell = (m, t, v) => { const W = WORLDS[musicWorld]; voice(W.voice, mtof(m), t, v * W.mgain, out); };
  const pad = (ch, t) => ch.forEach(m => {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = "triangle"; o.frequency.value = mtof(m - 12); f.type = "lowpass"; f.frequency.value = 900;
    const len = stepDur * 16;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.018, t + 1.2); g.gain.linearRampToValueAtTime(0.0001, t + len);
    o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + len + 0.1);
    livePads.push({ g, end: t + len });
  });
  const chordFor = bar => {
    const W = WORLDS[musicWorld], r = W.root % 12, base = 60 + r - (r > 6 ? 12 : 0);
    return (W.minor ? PROG_MINOR : PROG_MAJOR)[bar].map(d => base + d);
  };
  genTimer = setInterval(() => {
    if (next < ctx.currentTime) next = ctx.currentTime + 0.05;
    const ahead = document.hidden ? 1.6 : 0.3; // background tabs only wake timers about once a second
    if (worldChange) {
      worldChange = false;
      const t = Math.max(next, ctx.currentTime);
      for (let i = livePads.length - 1; i >= 0; i--) {
        const p = livePads[i];
        if (p.end > t) { try { p.g.gain.cancelScheduledValues(t); p.g.gain.setTargetAtTime(0.0001, t, 0.35); } catch {} }
        livePads.splice(i, 1);
      }
      step = Math.ceil(step / 16) * 16;       // start the new world on a fresh bar
    }
    for (let i = livePads.length - 1; i >= 0; i--) if (livePads[i].end < ctx.currentTime) livePads.splice(i, 1);
    while (next < ctx.currentTime + ahead) {
      const bar = Math.floor(step / 16) % 4, ch = chordFor(bar), s = step % 16;
      if (s === 0) { pad(ch, next); bell(ch[0] - 12, next, 0.05); }
      if (s % 2 === 0 && Math.random() < 0.72) bell(ch[pattern[(s / 2) % 8]] + (Math.random() < 0.25 ? 12 : 0), next, 0.045);
      else if (s % 2 === 1 && Math.random() < 0.14) bell(ch[Math.floor(Math.random() * 4)] + 12, next, 0.025);
      next += stepDur; step++;
    }
  }, 100);
}
$("#musicBtn").onclick = () => {
  state.audio.musicOn = !state.audio.musicOn; save();
  if (state.audio.musicOn) startMusic(true); else { applyMusicVolume(); stopMusic(); }
  toast(state.audio.musicOn ? "Music on" : "Music off");
};

/* ================= tab switching ================= */
document.addEventListener("visibilitychange", () => {
  const away = document.hidden;
  document.body.classList.toggle("away", away);
  if (!ctx) return;
  if (away && state.audio.pauseHidden !== false) {
    awayPaused = true;
    musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    if (musicEl) musicEl.pause();
    clearInterval(genTimer); genTimer = null;
    setTimeout(() => { if (document.hidden && awayPaused) ctx.suspend(); }, 400);
  } else if (!away && awayPaused) {
    awayPaused = false;
    ctx.resume().then(() => {
      if (!state.audio.musicOn) return;
      if (musicEl) musicEl.play().catch(() => {});
      else if (!state.audio.music) startGenerative();
      musicBus.gain.setValueAtTime(0, ctx.currentTime);
      applyMusicVolume();
    });
  }
});

