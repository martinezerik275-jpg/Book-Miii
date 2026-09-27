/* ================= shared UI helpers ================= */
// In-page confirmation: the artifact viewer makes window.confirm() return false.
let cfResolve = null;
function askConfirm(text, yes = "OK") {
  if (cfResolve) cfResolve(false);
  $("#cfText").textContent = text; $("#cfYes").textContent = yes;
  show("#confirm"); sfx("select");
  setTimeout(() => $("#cfYes").focus(), 30);
  return new Promise(res => { cfResolve = res; });
}
function closeConfirm(v) { if (!cfResolve) return; const r = cfResolve; cfResolve = null; hide("#confirm"); sfx(v ? "confirm" : "back"); r(v); }
$("#cfYes").onclick = () => closeConfirm(true);
$("#cfNo").onclick = () => closeConfirm(false);
$("#confirm").addEventListener("click", e => { if (e.target.id === "confirm") closeConfirm(false); });

// a small round badge standing in for a person: their animal on their fur colour
function paintChip(el, av) {
  const a = decodeAvatar(av);
  el.textContent = SPECIES[a.s].e;
  el.style.background = a.f;
}
const ago = t => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago"; return Math.floor(s / 86400) + " d ago";
};
