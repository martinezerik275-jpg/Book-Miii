/* ================= people: presence, neighbors, my card, status ================= */
// people/<id> = { avatar, card: { title, blurb, listed, hue, tiles }, updatedAt }
function watchPeople() {
  db.collection("people").onSnapshot(snap => {
    const next = {};
    snap.docs.forEach(d => { next[d.id] = d.data(); });
    people = next;
    resolveNames(Object.keys(people)).then(() => { renderPeopleList(); renderVisitBar(); if (plaza) plaza.rebuildHouses(); });
    renderSocialChrome();
  }, () => {});
}
const mayWrite = () => !!(db && me.id && me.canWrite !== false);
function myCard() { return (me.id && people[me.id]) || null; }
async function saveMyCard(patch) {
  if (!mayWrite()) throw { code: "invalid_argument" };
  const cur = myCard() || {};
  const next = Object.assign({}, cur, patch, { updatedAt: Date.now() });
  next.card = Object.assign({ title: "", blurb: "", listed: false, hue: 200, tiles: 0 }, cur.card || {}, patch.card || {});
  await db.doc("people/" + me.id).set(next);
  people[me.id] = next;
}
// keep the tile count on my card current (only once I have a card)
let cardTilesT = null;
function updateMyCard(s) {
  const card = myCard(); if (!card || !card.card || !mayWrite()) return;
  const n = s.channels.length, hue = (s.channels[0] && s.channels[0].hue) || card.card.hue;
  if (card.card.tiles === n && card.card.hue === hue) return;
  clearTimeout(cardTilesT);
  cardTilesT = setTimeout(() => saveMyCard({ card: { tiles: n, hue } }).catch(() => {}), 1200);
}

/* ---------- presence: who has the page open right now ---------- */
let presenceBase = {};
function setPresence(patch) {
  Object.assign(presenceBase, patch);
  if (room) room.presence(patch).catch(() => {});
}
function connectRoom(r) {
  room = r;
  setPresence({ w: "menu", av: encodeAvatar(myAvatar()), st: statusForPresence() });
  room.onPeers(ch => {
    peersNow = ch.peers.slice();
    resolveNames(peersNow.map(p => p.by));
    if (plaza) plaza.syncPeers(ch);
    renderSocialChrome(); renderPeopleList();
  }, () => {});
}
const onlineIds = () => new Set(peersNow.filter(p => p.by && !p.isMe).map(p => p.by));
const presenceOf = id => { const p = peersNow.find(x => x.by === id && !x.isMe); return p ? p.presence || {} : null; };

/* ---------- status + focus timer ---------- */
const STATUS_KEY = "studio-menu-status", SHARE_KEY = "studio-menu-share-now";
const STATUS = { around: "Around", focus: "Focusing", break: "On a break", away: "Away" };
let myStatus = { k: "around", until: 0 }, shareNow = false, focusT = null;
try { const s = JSON.parse(localStorage.getItem(STATUS_KEY)); if (s && STATUS[s.k]) myStatus = s; } catch {}
try { shareNow = localStorage.getItem(SHARE_KEY) === "1"; } catch {}
function statusForPresence() { return { k: myStatus.k, until: myStatus.until || 0 }; }
function setMyStatus(k) {
  myStatus = { k, until: k === "focus" ? Date.now() + 25 * 60000 : 0 };
  try { localStorage.setItem(STATUS_KEY, JSON.stringify(myStatus)); } catch {}
  setPresence({ st: statusForPresence() });
  renderStatusUI(); tickFocus();
}
function tickFocus() {
  clearTimeout(focusT);
  if (myStatus.k !== "focus") { $("#date").dataset.focus = ""; tick(); return; }
  const left = myStatus.until - Date.now();
  if (left <= 0) { sfx("complete"); toast("Focus session done. Time for a break."); setMyStatus("break"); return; }
  const m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
  $("#date").dataset.focus = "1";
  $("#date").textContent = "Focus " + m + ":" + String(s).padStart(2, "0") + " left";
  focusT = setTimeout(tickFocus, 1000);
}
function statusLine(pr) {
  if (!pr) return "";
  const st = pr.st && STATUS[pr.st.k] ? pr.st : null;
  let out = st && st.k !== "around" ? STATUS[st.k] : "";
  if (st && st.k === "focus" && st.until > Date.now()) out += " · " + Math.ceil((st.until - Date.now()) / 60000) + " min left";
  if (pr.now && typeof pr.now.n === "string" && Date.now() - (pr.now.at || 0) < 45 * 60000) out += (out ? " · " : "") + "in " + pr.now.n.slice(0, 40);
  if (pr.w === "plaza") out = "In the plaza" + (out ? " · " + out : "");
  return out || "Online";
}
function workingIn(c) {
  if (!shareNow || !c) return;
  setPresence({ now: { n: c.name, at: Date.now() } });
}

/* ---------- deck chrome ---------- */
function renderSocialChrome() {
  const social = !!db;
  $("#peopleBtn").hidden = !social; $("#plazaBtn").hidden = !room;
  const inPlaza = peersNow.filter(p => !p.isMe && p.presence && p.presence.w === "plaza").length;
  const pb = $("#plazaBadge"); pb.hidden = !inPlaza; pb.textContent = inPlaza;
  $("#plazaBtn").dataset.tip = inPlaza ? `Plaza · ${inPlaza} here now  ( P )` : "Plaza  ( P )";
  const fresh = newStampCount();
  const b = $("#peopleBadge"); b.hidden = !fresh; b.textContent = fresh;
  $("#ppStampCount").textContent = stampsIn.length ? stampsIn.length : "";
  renderVisitBar();
  if (!state) return;
  $("#emptyPeople").hidden = !!visiting || !db;
}

/* ---------- People sheet ---------- */
let ppTab = "neighbors";
function openPeople(tab) {
  if (!db) return;
  if (tab) ppTab = tab;
  renderPeopleList(); renderStampBook(); renderMySpace(); showPPTab(ppTab);
  show("#people"); sfx("select");
  if (ppTab === "stamps") markStampsSeen();
}
function showPPTab(t) {
  ppTab = t;
  document.querySelectorAll("#ppRail [role=tab]").forEach(b => { const on = b.dataset.tab === t; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; });
  document.querySelectorAll("#people .st-pane").forEach(p => p.classList.toggle("on", p.dataset.pane === t));
  if (t === "stamps") markStampsSeen();
}
$("#ppRail").addEventListener("click", e => { const b = e.target.closest("[role=tab]"); if (b && b.dataset.tab !== ppTab) { showPPTab(b.dataset.tab); sfx("select"); } });
$("#ppClose").onclick = () => { hide("#people"); sfx("back"); };
$("#people").addEventListener("click", e => { if (e.target.id === "people") { hide("#people"); sfx("back"); } });
$("#peopleBtn").onclick = () => openPeople();

function neighborIds() {
  const on = onlineIds(), ids = new Set();
  Object.entries(people).forEach(([id, p]) => { if (p.card && p.card.listed) ids.add(id); });
  if (hubOwner) ids.add(hubOwner);
  return [...ids].sort((a, b) => (b === me.id) - (a === me.id) || on.has(b) - on.has(a) || ((people[b] || {}).updatedAt || 0) - ((people[a] || {}).updatedAt || 0));
}
function renderPeopleList() {
  const box = $("#ppList"); if (!box) return;
  box.innerHTML = "";
  const ids = neighborIds(), on = onlineIds();
  if (!ids.length) { box.innerHTML = '<div class="empty-note">No shared spaces yet. List yours under My space to be the first house in the plaza.</div>'; return; }
  ids.forEach(id => {
    const card = people[id] || {}, c = card.card || {};
    const row = document.createElement("div"); row.className = "pp-row";
    const chip = document.createElement("span"); chip.className = "av-chip"; paintChip(chip, card.avatar);
    const txt = document.createElement("div"); txt.className = "pp-text";
    const b = document.createElement("b"); b.textContent = spaceTitle(id);
    const sub = document.createElement("span");
    const who = personName(id, "");
    const bits = [];
    if (who) bits.push(id === me.id ? "you" : who);
    if (c.tiles != null && id !== hubOwner) bits.push(c.tiles + (c.tiles === 1 ? " tile" : " tiles"));
    if (id === hubOwner) bits.push("owner of this menu");
    sub.textContent = bits.join(" · ");
    txt.append(b, sub);
    if (c.blurb) { const bl = document.createElement("span"); bl.className = "pp-blurb"; bl.textContent = c.blurb; txt.appendChild(bl); }
    if (on.has(id)) { const o = document.createElement("span"); o.className = "pp-online"; o.textContent = statusLine(presenceOf(id)); txt.appendChild(o); }
    const go = document.createElement("button"); go.className = "pill small" + (id === me.id ? "" : " primary");
    go.textContent = id === me.id ? "Your space" : "Visit";
    go.disabled = id === me.id && !visiting;
    go.onclick = () => { hide("#people"); id === me.id ? goHome() : visitSpace(id); };
    row.append(chip, txt, go); box.appendChild(row);
  });
}
function renderStatusUI() {
  [...$("#ppStatus").children].forEach(b => b.classList.toggle("on", b.dataset.v === myStatus.k));
  $("#ppShareNow").checked = shareNow;
}
function renderMySpace() {
  const card = myCard() || {}, c = card.card || {};
  renderStatusUI();
  $("#ppTitleIn").value = c.title || ""; $("#ppBlurb").value = c.blurb || ""; $("#ppListed").checked = !!c.listed;
  $("#ppTitleIn").placeholder = (me.name ? me.name.split(" ")[0] + "’s studio" : "My studio");
  const canSave = mayWrite();
  ["#ppTitleIn", "#ppBlurb", "#ppListed", "#ppSave"].forEach(s => { $(s).disabled = !canSave; });
  $("#ppMsg").textContent = canSave ? "" : me.id ? "Your access to this menu is view-only, so your space can't be saved here." : "Sign in to claude.ai to get a space.";
  $("#ppInvite").textContent = me.isOwner
    ? "Share this menu from claude.ai. People you give Contributor access get their own space and can build a house here. Viewers can walk the plaza and visit spaces, but can't save."
    : "Friends need access to this menu from its owner. With Contributor access they get their own space; viewers can visit and walk the plaza.";
}
$("#ppStatus").onclick = e => { const b = e.target.closest("button"); if (!b) return; setMyStatus(b.dataset.v); sfx("tick"); };
$("#ppShareNow").onchange = e => {
  shareNow = e.target.checked;
  try { localStorage.setItem(SHARE_KEY, shareNow ? "1" : "0"); } catch {}
  if (!shareNow) setPresence({ now: null });
};
$("#ppSave").onclick = async () => {
  const title = $("#ppTitleIn").value.trim(), blurb = $("#ppBlurb").value.trim(), listed = $("#ppListed").checked;
  const mine = visiting ? homeState : state;
  try {
    await saveMyCard({ avatar: encodeAvatar(myAvatar()), card: { title, blurb, listed, tiles: mine.channels.length, hue: (mine.channels[0] && mine.channels[0].hue) || 200 } });
    $("#ppMsg").textContent = listed ? "Saved. Your space is listed." : "Saved. Your space is unlisted.";
    sfx("confirm"); renderPeopleList(); if (plaza) plaza.rebuildHouses();
  } catch { $("#ppMsg").textContent = "Couldn't save. Your access may be view-only."; sfx("error"); }
};
$("#ppAvatar").onclick = () => { hide("#people"); openClinic(); };
