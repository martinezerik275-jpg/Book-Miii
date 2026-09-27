/* ================= the Wii finish: banners, skins, gamepad, idle summary ================= */
/* ---------- channel banners: a looping video or image behind the banner, like a channel preview ---------- */
function paintBannerMedia(screen, c) {
  screen.querySelectorAll(".pv-media").forEach(n => n.remove());
  screen.classList.remove("has-media");
  const b = c && c.banner; if (!b) return;
  const box = document.createElement("div"); box.className = "pv-media"; box.setAttribute("aria-hidden", "true");
  if (b.kind === "video") {
    const v = document.createElement("video"); v.src = "/_blob/" + b.asset; v.muted = true; v.loop = true; v.playsInline = true;
    if (!reduceMotion) { v.autoplay = true; v.play().catch(() => {}); }
    box.appendChild(v);
  } else { const img = document.createElement("img"); img.src = "/_blob/" + b.asset; img.alt = ""; box.appendChild(img); }
  screen.prepend(box); screen.classList.add("has-media");
}
function renderBannerRow() {
  const can = !!assets;
  $("#edBannerBtn").disabled = !can;
  $("#edBannerBtn").textContent = edBanner ? "Replace banner" : "Add a banner image or video";
  $("#edBannerClear").hidden = !edBanner;
  $("#edBannerHint").textContent = !can ? "Banners use uploads, which the menu's owner and editors can add."
    : edBanner ? (edBanner.kind === "video" ? "A video banner is set." : "An image banner is set.") : "Plays behind the tile's banner when you open it, like a Wii channel preview. Up to 20 MB.";
}
$("#edBannerBtn").onclick = () => $("#edBannerFile").click();
$("#edBannerClear").onclick = () => { edBanner = null; renderBannerRow(); sfx("back"); };
$("#edBannerFile").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f || !assets) return;
  const video = /^video\//.test(f.type);
  if (!video && !/^image\//.test(f.type)) { toast("Use an image or an MP4/WebM video."); return; }
  if (f.size > 20 * 1024 * 1024) { toast("That file is over 20 MB. Export a shorter or smaller version."); return; }
  const btn = $("#edBannerBtn"); btn.disabled = true; btn.textContent = "Uploading…";
  try { const r = await assets.upload(f); edBanner = { asset: r.id, kind: video ? "video" : "image" }; sfx("confirm"); }
  catch { toast("Couldn't upload that file."); sfx("error"); }
  finally { renderBannerRow(); }
};

/* ---------- menu skins ---------- */
const SKIN_INFO = { wii: ["Wii", "#27B4E8", "#E8ECF0"], cube: ["Cube", "#7B5CE0", "#E6E2F3"], dream: ["Dream", "#F07A2A", "#F1F1EE"], cabin: ["Cabin", "#C9793E", "#EDE3D6"] };
function applySkin() {
  if (!state || state.skin === "wii") document.documentElement.removeAttribute("data-skin");
  else document.documentElement.setAttribute("data-skin", state.skin);
}
function renderSkins() {
  const box = $("#stSkins"); if (!box) return; box.innerHTML = "";
  Object.entries(SKIN_INFO).forEach(([k, [name, accent, bg]]) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "skin" + (state.skin === k ? " on" : "");
    b.setAttribute("role", "radio"); b.setAttribute("aria-checked", state.skin === k); b.dataset.v = k;
    const sw = document.createElement("span"); sw.className = "skin-sw"; sw.style.background = `linear-gradient(135deg, ${bg} 50%, ${accent} 50%)`;
    const n = document.createElement("b"); n.textContent = name;
    b.append(sw, n);
    b.onclick = () => { if (visiting) return; state.skin = k; applySkin(); save(); renderSkins(); sfx("confirm"); };
    box.appendChild(b);
  });
}

/* ---------- idle screen: today at a glance ---------- */
async function paintIdleToday() {
  const el = $("#idleToday"); el.textContent = "";
  if (visiting) return;
  const bits = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  try {
    const mins = (await readLog()).filter(x => x.start >= +today).reduce((a, x) => a + x.mins, 0);
    if (mins) bits.push(fmtMins(mins) + " in sessions today");
  } catch {}
  const next = state.channels.filter(c => c.kind === "project" && c.due && c.status !== "delivered").sort((a, b) => a.due.localeCompare(b.due))[0];
  if (next) bits.push(next.name + ": " + dueText(next).toLowerCase());
  el.textContent = bits.join("  ·  ");
}

/* ---------- gamepad: move with the d-pad or stick, A opens, B goes back ---------- */
// Keys are replayed as keyboard events so every screen behaves exactly as it does with a keyboard.
const PAD = { 12: "ArrowUp", 13: "ArrowDown", 14: "ArrowLeft", 15: "ArrowRight", 0: "Enter", 1: "Escape", 4: "[", 5: "]", 3: "/", 9: "k" };
let padTimer = 0; const padHeld = {};
function padKey(key) {
  const t = document.activeElement || document.body;
  if (key === "Enter") { if (t && t !== document.body && t.click) t.click(); return; }
  const opts = { key, bubbles: true, cancelable: true, ctrlKey: key === "k" };
  t.dispatchEvent(new KeyboardEvent("keydown", opts));
}
// polled on a timer: steadier than animation frames, which browsers pause under load
function padLoop() {
  const now = performance.now();
  if ($("#plaza").classList.contains("open") || document.hidden) return;
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  if (!pads.length) { clearInterval(padTimer); padTimer = 0; return; }
  const g = pads[0], pressed = {};
  Object.keys(PAD).forEach(i => { if (g.buttons[i] && g.buttons[i].pressed) pressed[PAD[i]] = 1; });
  const [ax, ay] = [g.axes[0] || 0, g.axes[1] || 0];
  if (ax < -0.6) pressed.ArrowLeft = 1; if (ax > 0.6) pressed.ArrowRight = 1;
  if (ay < -0.6) pressed.ArrowUp = 1; if (ay > 0.6) pressed.ArrowDown = 1;
  Object.keys(PAD).map(i => PAD[i]).concat(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]).forEach(k => {
    if (!pressed[k]) { delete padHeld[k]; return; }
    const h = padHeld[k];
    if (!h) { padHeld[k] = { next: now + 380 }; padKey(k); }
    else if (k.startsWith("Arrow") && now >= h.next) { h.next = now + 120; padKey(k); }   // arrows repeat while held
  });
}
addEventListener("gamepadconnected", () => {
  if (!padTimer) padTimer = setInterval(padLoop, 40);
  toast("Controller connected: d-pad to move, A to open, B to go back");
});
