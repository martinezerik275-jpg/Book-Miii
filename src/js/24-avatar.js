/* ================= avatars: data model ================= */
// Stored compactly in people/<id>.avatar and in room presence:
//   { s: species, f: fur, c: scrubs, h: hat, x: extra, e: eyes, nick }
const SPECIES = {
  cat: { n: "Cat", e: "🐱" }, dog: { n: "Pup", e: "🐶" }, bunny: { n: "Bunny", e: "🐰" }, bear: { n: "Bear", e: "🐻" },
  fox: { n: "Fox", e: "🦊" }, panda: { n: "Panda", e: "🐼" }, mouse: { n: "Mouse", e: "🐭" }, frog: { n: "Frog", e: "🐸" },
};
const FURS = ["#F6D2A2", "#E9A15F", "#C77B4A", "#8C6450", "#F5F1EA", "#B9BEC8", "#6F727C", "#F2B8C6", "#A7D98C", "#F7E08A"];
const SCRUBS = ["#79C6E8", "#8FD6B0", "#F4A6C1", "#B7A5EF", "#FFD37A", "#5E86D6", "#FF9480", "#F7F9FB"];
const HATS = { none: "None", nurse: "Nurse cap", surgical: "Surgical cap", mirror: "Head mirror", flower: "Flower", bow: "Bow" };
const EXTRAS = { none: "None", stetho: "Stethoscope", bandage: "Bandage", glasses: "Glasses", clipboard: "Clipboard" };
const EYES = { dot: "Round", happy: "Happy", sparkle: "Sparkly" };
const AVATAR = { SPECIES, FURS, SCRUBS, HATS, EXTRAS, EYES };
const AV_KEY = "studio-menu-avatar";

function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function randomAvatar(seed) {
  let h = seed == null ? Math.floor(Math.random() * 2 ** 32) : hashStr(seed);
  const pick = arr => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return arr[h % arr.length]; };
  const s = pick(Object.keys(SPECIES));
  return { s, f: s === "frog" ? "#A7D98C" : pick(FURS.filter(f => f !== "#A7D98C")), c: pick(SCRUBS),
    h: pick(Object.keys(HATS)), x: pick(Object.keys(EXTRAS)), e: pick(Object.keys(EYES)), nick: "" };
}
// Anything read from shared state is untrusted: keep only known values.
function decodeAvatar(a, seed) {
  const d = randomAvatar(seed || "someone");
  if (!a || typeof a !== "object") return d;
  const hex = v => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : null;
  return { s: SPECIES[a.s] ? a.s : d.s, f: hex(a.f) || d.f, c: hex(a.c) || d.c, h: HATS[a.h] ? a.h : d.h,
    x: EXTRAS[a.x] ? a.x : d.x, e: EYES[a.e] ? a.e : d.e, nick: typeof a.nick === "string" ? a.nick.slice(0, 20) : "" };
}
const encodeAvatar = a => { const d = decodeAvatar(a); return { s: d.s, f: d.f, c: d.c, h: d.h, x: d.x, e: d.e, nick: d.nick }; };
function myAvatar() {
  const card = me.id && people[me.id];
  if (card && card.avatar) return decodeAvatar(card.avatar, me.id);
  try { const a = JSON.parse(localStorage.getItem(AV_KEY)); if (a) return decodeAvatar(a, me.id); } catch {}
  return randomAvatar(me.id || "me");
}

/* ================= avatars: 3D ================= */
// Built from primitives with toon shading: round heads, stubby limbs, scrubs.
let toonRamp = null;
function toonMat(T, color, opts = {}) {
  if (!toonRamp) {
    const d = new Uint8Array([90, 170, 255]);
    toonRamp = new T.DataTexture(d, 3, 1, T.RedFormat); toonRamp.minFilter = toonRamp.magFilter = T.NearestFilter; toonRamp.needsUpdate = true;
  }
  return new T.MeshToonMaterial(Object.assign({ color, gradientMap: toonRamp }, opts));
}
function shade(hex, k) {   // k<0 darker, k>0 lighter
  const n = parseInt(hex.slice(1), 16), ch = [n >> 16, (n >> 8) & 255, n & 255];
  return "#" + ch.map(v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k).toString(16).padStart(2, "0")).join("");
}

function buildAvatar(T, raw) {
  const a = decodeAvatar(raw);
  const g = new T.Group(), rig = new T.Group(); g.add(rig);
  const M = c => toonMat(T, c);
  const fur = a.s === "panda" ? "#F7F7F4" : a.f, dark = shade(fur, -0.28), light = shade(fur, 0.55);
  const pink = "#F6A7B8", ink = "#2B2A33";
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = rig) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const sph = r => new T.SphereGeometry(r, 20, 14);

  // blob shadow
  const sh = new T.Mesh(new T.CircleGeometry(0.42, 24), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; g.add(sh);

  // legs + feet
  const legs = [-1, 1].map(sd => {
    const pivot = new T.Group(); pivot.position.set(0.12 * sd, 0.34, 0); rig.add(pivot);
    mesh(new T.CapsuleGeometry(0.085, 0.14, 4, 10), M(shade(a.c, -0.08)), 0, -0.12, 0, pivot);
    mesh(sph(0.1), M(dark), 0, -0.27, 0.04, pivot).scale.set(1, 0.7, 1.25);
    return pivot;
  });
  // body in scrubs, with a pocket and a name badge
  const body = mesh(new T.CapsuleGeometry(0.27, 0.22, 6, 16), M(a.c), 0, 0.58, 0);
  mesh(new T.BoxGeometry(0.1, 0.08, 0.02), M(shade(a.c, -0.12)), -0.12, 0.6, 0.265);
  mesh(new T.BoxGeometry(0.09, 0.045, 0.02), M("#FFFFFF"), 0.12, 0.66, 0.255);
  mesh(new T.ConeGeometry(0.09, 0.1, 3), M(light), 0, 0.79, 0.2).rotation.set(Math.PI + 0.35, 0, 0);
  // arms
  const arms = [-1, 1].map(sd => {
    const pivot = new T.Group(); pivot.position.set(0.3 * sd, 0.74, 0); rig.add(pivot);
    mesh(new T.CapsuleGeometry(0.07, 0.18, 4, 10), M(a.c), 0.02 * sd, -0.13, 0, pivot).rotation.z = 0.18 * sd;
    mesh(sph(0.075), M(fur), 0.05 * sd, -0.29, 0, pivot);
    return pivot;
  });
  // head
  const head = new T.Group(); head.position.set(0, 1.08, 0); rig.add(head);
  const skull = mesh(sph(0.36), M(fur), 0, 0, 0, head); skull.scale.set(1.06, 0.94, 0.96);
  const muzzle = mesh(sph(0.15), M(a.s === "frog" ? light : light), 0, -0.1, 0.27, head); muzzle.scale.set(1.25, 0.8, 0.75);
  const noseC = { cat: pink, bunny: pink, mouse: pink, frog: shade(fur, -0.4) }[a.s] || ink;
  mesh(sph(0.045), M(noseC), 0, -0.05, 0.38, head).scale.set(1.3, 0.9, 0.9);
  // eyes
  const eyeY = a.s === "frog" ? 0.3 : 0.04, eyeZ = a.s === "frog" ? 0.12 : 0.31, eyeX = a.s === "frog" ? 0.16 : 0.13;
  if (a.s === "frog") [-1, 1].forEach(sd => mesh(sph(0.12), M(fur), eyeX * sd, 0.26, 0.05, head));
  if (a.s === "panda") [-1, 1].forEach(sd => { const p = mesh(sph(0.085), M("#2E2D35"), eyeX * sd, 0.03, 0.29, head); p.scale.set(1, 1.2, 0.5); p.rotation.z = 0.5 * sd; });
  const eyes = [-1, 1].map(sd => {
    const e = new T.Group(); e.position.set(eyeX * sd, eyeY, eyeZ); head.add(e);
    if (a.e === "happy") {
      const arc = mesh(new T.TorusGeometry(0.045, 0.014, 6, 12, Math.PI), M(ink), 0, -0.01, 0.01, e);
    } else {
      const r = a.e === "sparkle" ? 0.058 : 0.045;
      mesh(sph(r), M(ink), 0, 0, 0, e).scale.set(1, 1.15, 0.6);
      mesh(sph(r * 0.35), new T.MeshBasicMaterial({ color: 0xffffff }), r * 0.35, r * 0.4, r * 0.45, e);
      if (a.e === "sparkle") mesh(sph(r * 0.18), new T.MeshBasicMaterial({ color: 0xffffff }), -r * 0.35, -r * 0.35, r * 0.45, e);
    }
    return e;
  });
  // blush
  [-1, 1].forEach(sd => {
    const b = mesh(new T.CircleGeometry(0.05, 16), new T.MeshBasicMaterial({ color: 0xff8fa6, transparent: true, opacity: 0.55, depthWrite: false }), 0.21 * sd, -0.08, 0.29, head);
    b.rotation.y = 0.55 * sd;
  });
  // ears
  const ears = [];
  const ear = (sd, build) => { const p = new T.Group(); head.add(p); build(p, sd); ears.push(p); return p; };
  [-1, 1].forEach(sd => {
    switch (a.s) {
      case "cat": case "fox": ear(sd, (p, s) => {
        const tall = a.s === "fox" ? 0.3 : 0.22;
        p.position.set(0.2 * s, 0.26, 0); p.rotation.z = -0.35 * s;
        mesh(new T.ConeGeometry(a.s === "fox" ? 0.13 : 0.12, tall, 4), M(fur), 0, tall / 2, 0, p).rotation.y = Math.PI / 4;
        mesh(new T.ConeGeometry(0.07, tall * 0.7, 4), M(a.s === "fox" ? "#FFFFFF" : pink), 0, tall * 0.4, 0.04, p).rotation.y = Math.PI / 4;
      }); break;
      case "dog": ear(sd, (p, s) => {
        p.position.set(0.3 * s, 0.12, 0); p.rotation.z = 0.25 * s;
        mesh(sph(0.12), M(dark), 0, -0.12, 0, p).scale.set(0.55, 1.25, 0.4);
      }); break;
      case "bunny": ear(sd, (p, s) => {
        p.position.set(0.13 * s, 0.28, 0); p.rotation.z = -0.12 * s;
        mesh(new T.CapsuleGeometry(0.075, 0.34, 4, 10), M(fur), 0, 0.24, 0, p);
        mesh(new T.CapsuleGeometry(0.04, 0.26, 4, 8), M(pink), 0, 0.24, 0.045, p);
      }); break;
      case "bear": case "panda": ear(sd, (p, s) => {
        p.position.set(0.25 * s, 0.26, 0);
        mesh(sph(0.11), M(a.s === "panda" ? "#2E2D35" : fur), 0, 0, 0, p).scale.set(1, 1, 0.6);
        if (a.s === "bear") mesh(sph(0.06), M(light), 0, 0, 0.04, p).scale.set(1, 1, 0.5);
      }); break;
      case "mouse": ear(sd, (p, s) => {
        p.position.set(0.27 * s, 0.25, -0.02); p.rotation.z = -0.3 * s;
        mesh(new T.CylinderGeometry(0.17, 0.17, 0.04, 20), M(fur), 0, 0.08, 0, p).rotation.x = Math.PI / 2;
        mesh(new T.CylinderGeometry(0.11, 0.11, 0.045, 20), M(pink), 0, 0.08, 0.005, p).rotation.x = Math.PI / 2;
      }); break;
    }
  });
  // tail
  const tail = new T.Group(); tail.position.set(0, 0.45, -0.27); rig.add(tail);
  switch (a.s) {
    case "cat": for (let i = 0; i < 6; i++) mesh(sph(0.05), M(fur), 0, i * 0.06, -i * 0.035 - (i > 3 ? (i - 3) * 0.02 : 0), tail); break;
    case "fox": { const t = mesh(sph(0.12), M(fur), 0, 0.06, -0.12, tail); t.scale.set(0.85, 0.85, 1.7); mesh(sph(0.07), M("#FFFFFF"), 0, 0.1, -0.3, tail); break; }
    case "dog": mesh(new T.CapsuleGeometry(0.045, 0.14, 4, 8), M(dark), 0, 0.08, -0.03, tail).rotation.x = -0.7; break;
    case "bunny": mesh(sph(0.09), M("#FFFFFF"), 0, 0, 0, tail); break;
    case "bear": mesh(sph(0.06), M(fur), 0, 0, 0, tail); break;
    case "panda": mesh(sph(0.06), M("#2E2D35"), 0, 0, 0, tail); break;
    case "mouse": mesh(new T.CylinderGeometry(0.018, 0.012, 0.42, 6), M(pink), 0, 0.05, -0.18, tail).rotation.x = -1.2; break;
  }
  // hat
  const top = new T.Group(); top.position.y = 0.3; head.add(top);
  switch (a.h) {
    case "nurse": {
      const cap = mesh(new T.CylinderGeometry(0.2, 0.24, 0.13, 16, 1, false, 0, Math.PI * 2), M("#FFFFFF"), 0, 0.02, 0.08, top); cap.rotation.x = -0.35;
      mesh(new T.BoxGeometry(0.1, 0.03, 0.01), new T.MeshBasicMaterial({ color: 0xe8474f }), 0, 0.06, 0.25, top).rotation.x = -0.35;
      mesh(new T.BoxGeometry(0.03, 0.1, 0.01), new T.MeshBasicMaterial({ color: 0xe8474f }), 0, 0.06, 0.25, top).rotation.x = -0.35;
      break;
    }
    case "surgical": { const c = mesh(new T.SphereGeometry(0.33, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(shade(a.c, -0.05)), 0, -0.12, 0, top); c.scale.set(1.08, 0.75, 1); break; }
    case "mirror": {
      const band = mesh(new T.TorusGeometry(0.34, 0.025, 6, 30), M("#5C6470"), 0, -0.12, 0, top); band.rotation.x = Math.PI / 2 - 0.25;
      mesh(new T.CylinderGeometry(0.09, 0.09, 0.02, 20), new T.MeshStandardMaterial({ color: 0xdfe6ee, metalness: 0.9, roughness: 0.15 }), 0, -0.02, 0.33, top).rotation.x = Math.PI / 2 - 0.3;
      break;
    }
    case "flower": {
      const f = new T.Group(); f.position.set(0.2, 0, 0.12); top.add(f);
      for (let i = 0; i < 5; i++) { const an = i / 5 * Math.PI * 2; mesh(sph(0.045), M("#FFB3C7"), Math.cos(an) * 0.055, Math.sin(an) * 0.055, 0, f); }
      mesh(sph(0.035), M("#FFD66B"), 0, 0, 0.02, f); break;
    }
    case "bow": {
      const b = new T.Group(); b.position.set(-0.18, 0.02, 0.1); b.rotation.z = 0.3; top.add(b);
      [-1, 1].forEach(sd => mesh(new T.ConeGeometry(0.07, 0.12, 12), M("#F0607E"), 0.06 * sd, 0, 0, b).rotation.z = -Math.PI / 2 * sd);
      mesh(sph(0.035), M("#D94C6C"), 0, 0, 0, b); break;
    }
  }
  // extra
  switch (a.x) {
    case "stetho": {
      const t = mesh(new T.TorusGeometry(0.17, 0.018, 6, 24, Math.PI * 1.2), M("#4A5160"), 0, 0.78, 0.08); t.rotation.set(Math.PI / 2 + 0.5, 0, Math.PI * 1.1);
      mesh(new T.CylinderGeometry(0.045, 0.045, 0.02, 16), new T.MeshStandardMaterial({ color: 0xcfd6de, metalness: 0.85, roughness: 0.2 }), 0.05, 0.56, 0.27).rotation.x = Math.PI / 2;
      break;
    }
    case "bandage": {
      const b = mesh(new T.BoxGeometry(0.12, 0.045, 0.012), M("#F2D0A4"), -0.19, 0.02, 0.28, head); b.rotation.set(0, -0.5, 0.5);
      break;
    }
    case "glasses": {
      [-1, 1].forEach(sd => mesh(new T.TorusGeometry(0.065, 0.012, 6, 18), M("#34363F"), eyeX * sd, eyeY, eyeZ + 0.05, head));
      mesh(new T.BoxGeometry(0.1, 0.012, 0.012), M("#34363F"), 0, eyeY + 0.01, eyeZ + 0.05, head);
      break;
    }
    case "clipboard": {
      const cb = new T.Group(); cb.position.set(0.02, -0.3, 0.12); cb.rotation.set(-0.4, -0.3, 0); arms[1].add(cb);
      mesh(new T.BoxGeometry(0.2, 0.26, 0.02), M("#B07A4A"), 0, 0, 0, cb);
      mesh(new T.BoxGeometry(0.16, 0.2, 0.005), M("#FFFFFF"), 0, -0.01, 0.013, cb);
      break;
    }
  }
  g.userData = { rig, body, head, arms, legs, ears, tail, eyes, a, phase: Math.random() * 6, emote: null };
  return g;
}

// Animate one avatar. `moving` is 0..1 walking speed; emote = { k, t0 } in seconds.
function animateAvatar(g, t, dt, moving) {
  const u = g.userData, r = u.rig;
  u.phase += dt * (6 + 5 * moving) * (moving > 0.05 ? 1 : 0.25);
  const sw = Math.sin(u.phase) * 0.7 * moving;
  u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw;
  u.arms[0].rotation.x = -sw * 0.8; u.arms[1].rotation.x = sw * 0.8;
  u.arms[0].rotation.z = 0; u.arms[1].rotation.z = 0;
  r.position.y = Math.abs(Math.sin(u.phase)) * 0.06 * moving;
  r.rotation.y = 0;
  const breathe = 1 + Math.sin(t * 2.2 + u.phase) * 0.015;
  u.body.scale.set(1, breathe, 1);
  u.head.rotation.z = Math.sin(t * 1.3 + u.phase) * 0.04;
  u.tail.rotation.y = Math.sin(t * (moving > 0.05 ? 9 : 3)) * 0.35;
  const wig = (t + u.phase) % 5 < 0.25 ? Math.sin(((t + u.phase) % 5) * 25) * 0.25 : 0;
  u.ears.forEach((e, i) => { e.rotation.x = wig * (i ? 1 : -1); });
  const blink = (t * 0.7 + u.phase) % 4 < 0.12 ? 0.15 : 1;
  u.eyes.forEach(e => { e.scale.y = blink; });
  const em = u.emote;
  if (!em) return;
  const k = t - em.t0;
  if (k > 1.8) { u.emote = null; return; }
  switch (em.k) {
    case "wave": u.arms[1].rotation.z = 2.5 + Math.sin(k * 14) * 0.35; u.arms[1].rotation.x = 0; break;
    case "jump": r.position.y = Math.abs(Math.sin(k * Math.PI / 0.6)) * 0.45 * (k < 1.2 ? 1 : 0); u.legs.forEach(l => { l.rotation.x = -0.4; }); break;
    case "dance": r.rotation.y = k * Math.PI * 2 / 0.9; r.position.y = Math.abs(Math.sin(k * 10)) * 0.08;
      u.arms[0].rotation.z = -1.2 - Math.sin(k * 10) * 0.4; u.arms[1].rotation.z = 1.2 + Math.sin(k * 10) * 0.4; break;
    case "cheer": u.arms[0].rotation.z = -2.6 + Math.sin(k * 16) * 0.2; u.arms[1].rotation.z = 2.6 - Math.sin(k * 16) * 0.2; r.position.y = Math.abs(Math.sin(k * 8)) * 0.12; break;
    case "heart": u.arms[0].rotation.z = -0.9; u.arms[1].rotation.z = 0.9; u.arms[0].rotation.x = u.arms[1].rotation.x = -1.2; u.head.rotation.z = Math.sin(k * 4) * 0.15; break;
  }
}
function disposeTree(o) {
  o.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) [].concat(n.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
}
