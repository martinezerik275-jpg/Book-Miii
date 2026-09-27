/* ================= stamps: a guestbook for each space ================= */
// social/<my id> = { to: [space ids], stamps: { <space id>: { s, note, at } } }
// Each visitor writes only their own doc; a space's owner finds stamps with
// an array-contains query on `to`.
const STICKERS = { paw: "🐾", bandage: "🩹", stetho: "🩺", pill: "💊", star: "⭐", blossom: "🌸", clover: "🍀", heart: "💗" };
const SEEN_KEY = "studio-menu-stamps-seen";
let stampsIn = [], stampTarget = null, stampPick = "paw";
function watchStamps() {
  db.collection("social").where("to", "array-contains", me.id).onSnapshot(snap => {
    stampsIn = snap.docs.map(d => {
      const st = ((d.data() || {}).stamps || {})[me.id];
      return st && STICKERS[st.s] ? { from: d.id, s: st.s, note: String(st.note || "").slice(0, 80), at: +st.at || 0 } : null;
    }).filter(Boolean).sort((a, b) => b.at - a.at);
    resolveNames(stampsIn.map(s => s.from)).then(renderStampBook);
    renderSocialChrome(); renderStampBook();
  }, () => {});
}
function seenAt() { try { return +localStorage.getItem(SEEN_KEY) || 0; } catch { return 0; } }
const newStampCount = () => stampsIn.filter(s => s.at > seenAt() && s.from !== me.id).length;
function markStampsSeen() {
  if (!stampsIn.length) return;
  try { localStorage.setItem(SEEN_KEY, String(Math.max(...stampsIn.map(s => s.at)))); } catch {}
  renderSocialChrome();
}
function renderStampBook() {
  const box = $("#ppStamps"); if (!box) return;
  box.innerHTML = "";
  if (!stampsIn.length) { box.innerHTML = '<div class="empty-note">No stamps yet. When someone visits your space they can leave one here.</div>'; return; }
  const seen = seenAt();
  stampsIn.forEach(st => {
    const row = document.createElement("div"); row.className = "stamp-row" + (st.at > seen ? " new" : "");
    const big = document.createElement("span"); big.className = "sticker"; big.textContent = STICKERS[st.s];
    const txt = document.createElement("div"); txt.className = "pp-text";
    const b = document.createElement("b"); b.textContent = personName(st.from);
    const note = document.createElement("span"); note.textContent = st.note || "Left a stamp";
    const when = document.createElement("span"); when.className = "pp-online"; when.textContent = ago(st.at);
    txt.append(b, note, when);
    const back = document.createElement("button"); back.className = "pill small"; back.textContent = "Visit back";
    back.onclick = () => { hide("#people"); visitSpace(st.from); };
    back.hidden = !(people[st.from] && people[st.from].card) && st.from !== hubOwner;
    row.append(big, txt, back); box.appendChild(row);
  });
}
function openStamp(id) {
  if (!id || !mayWrite()) { toast("Leaving stamps needs Contributor access to this menu."); return; }
  stampTarget = id;
  const box = $("#skStickers"); box.innerHTML = "";
  Object.entries(STICKERS).forEach(([k, e]) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "sticker-btn"; b.dataset.k = k;
    b.setAttribute("role", "radio"); b.setAttribute("aria-label", k); b.textContent = e;
    b.onclick = () => { stampPick = k; paintStickers(); sfx("tick"); };
    box.appendChild(b);
  });
  $("#skTitle").textContent = "Stamp " + spaceTitle(id);
  $("#skNote").value = "";
  paintStickers(); show("#stampSheet"); sfx("select");
}
function paintStickers() { [...$("#skStickers").children].forEach(b => { const on = b.dataset.k === stampPick; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); }); }
const closeStamp = () => { hide("#stampSheet"); sfx("back"); };
$("#skClose").onclick = closeStamp; $("#skCancel").onclick = closeStamp;
$("#stampSheet").addEventListener("click", e => { if (e.target.id === "stampSheet") closeStamp(); });
$("#skForm").onsubmit = async e => {
  e.preventDefault();
  const id = stampTarget; if (!id) return;
  const btn = $("#skSave"); btn.disabled = true;
  try {
    const ref2 = db.doc("social/" + me.id), snap = await ref2.get();
    const cur = snap.exists ? snap.data() : {};
    const stamps = Object.assign({}, cur.stamps || {}, { [id]: { s: stampPick, note: $("#skNote").value.trim().slice(0, 80), at: Date.now() } });
    const to = [...new Set([...(cur.to || []), id])].slice(-200);
    await ref2.set({ to, stamps });
    hide("#stampSheet"); sfx("complete"); toast("Stamped " + spaceTitle(id));
  } catch { sfx("error"); toast("Couldn't leave the stamp. Your access may be view-only."); }
  finally { btn.disabled = false; }
};
