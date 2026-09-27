/* ================= version history: earlier copies of my menu ================= */
// Kept privately in data/users/<id>/history (or this browser when there's no account),
// newest first. A version is saved before big changes and at most every 10 minutes otherwise.
const HIST_KEY = "studio-menu-history", HIST_MAX = 10, HIST_BYTES = 200000;
let histList = null, histRef = null, histLast = 0;
async function loadHistory() {
  if (histList) return histList;
  histList = [];
  if (db && me.id) {
    histRef = db.doc("data/users/" + me.id + "/history");
    try { const s = await histRef.get(); if (s.exists && Array.isArray(s.data().versions)) histList = s.data().versions; } catch {}
  } else { try { histList = JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch { histList = []; } }
  histLast = histList[0] ? histList[0].at : 0;
  return histList;
}
const BIG = /^(import|delete|restore)/;
async function noteVersion(label) {
  if (visiting || !state) return;
  if (!BIG.test(label) && Date.now() - histLast < 10 * 60000) return;
  histLast = Date.now();
  const snap = { at: Date.now(), label: String(label).slice(0, 60), tiles: state.channels.length,
    data: JSON.stringify({ pages: state.pages, channels: state.channels }) };
  await loadHistory();
  histList.unshift(snap);
  histList = histList.slice(0, HIST_MAX);
  while (histList.length > 1 && JSON.stringify(histList).length > HIST_BYTES) histList.pop();
  if (histRef && me.canWrite !== false) histRef.set({ versions: histList }).catch(() => {});
  else try { localStorage.setItem(HIST_KEY, JSON.stringify(histList)); } catch {}
  if ($("#settings").classList.contains("open")) renderVersions();
}
async function renderVersions() {
  const box = $("#stVersions"); if (!box) return;
  await loadHistory();
  box.innerHTML = "";
  if (!histList.length) { box.innerHTML = '<p class="hint">No earlier versions yet. One is saved before your next big change.</p>'; return; }
  histList.forEach((v, i) => {
    const r = document.createElement("div"); r.className = "list-row";
    const n = document.createElement("div"); n.className = "name";
    n.textContent = new Date(v.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const sub = document.createElement("div"); sub.className = "sub"; sub.textContent = "Before: " + v.label + " · " + v.tiles + " tiles"; n.appendChild(sub);
    const b = document.createElement("button"); b.className = "pill small"; b.textContent = "Restore";
    b.onclick = async () => {
      if (visiting) return;
      if (!await askConfirm("Put your menu back the way it was " + ago(v.at) + "? Your current menu is saved as a version first.", "Restore")) return;
      checkpoint("restore " + new Date(v.at).toLocaleDateString());
      try {
        const d = JSON.parse(v.data);
        state.pages = d.pages; state.channels = d.channels; state = normalize(state); page = 0;
        persist(state); render(); renderSettings(); sfx("complete"); toastAction("Menu restored", "Undo", undo);
      } catch { toast("That version couldn't be read."); }
    };
    r.append(n, b); box.appendChild(r);
  });
}
