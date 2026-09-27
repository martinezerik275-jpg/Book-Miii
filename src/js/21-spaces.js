/* ================= spaces: visit someone's menu, borrow from it ================= */
// A space is a whole menu state. The owner's lives at menu/main (unchanged from
// before spaces existed); everyone else's at spaces/<their id>.
const spacePath = id => id === hubOwner ? "menu/main" : "spaces/" + id;
const nameOf = {};                     // id -> display name, resolved through user.profiles()
async function resolveNames(ids) {
  ids = [...new Set(ids.filter(Boolean))];
  if (!user || !ids.length) return;
  try { const ps = await user.profiles(ids); ids.forEach(id => { nameOf[id] = (ps[id] && ps[id].name) || ""; }); } catch {}
}
// what to call a person: their plaza nickname, their account name, or a neutral word
function personName(id, fallback = "Someone") {
  const card = people[id], nick = card && card.avatar && card.avatar.nick;
  if (id && id === me.id) return nick || me.name || "You";
  return nick || nameOf[id] || fallback;
}
function spaceTitle(id) {
  const card = people[id];
  if (card && card.card && card.card.title) return card.card.title;
  const n = personName(id, "");
  return n ? n + "’s space" : "A neighbor’s space";
}

function visitSpace(id, from) {
  if (!db || !id) return;
  if (id === me.id) { goHome(); return; }
  if (visiting) { visiting.unsub && visiting.unsub(); } else homeState = state;
  const v = visiting = { id, from: from || (visiting && visiting.from) || "", unsub: null, loaded: false };
  editMode = false; exitIdle();
  hide("#people"); hide("#preview");
  document.body.classList.add("visiting");
  setPresence({ w: "visit" });
  onbFlag("visit");
  resolveNames([id]).then(renderVisitBar);
  renderVisitBar();
  v.unsub = db.doc(spacePath(id)).onSnapshot(snap => {
    if (visiting !== v) return;
    if (!snap.exists) {
      if (!v.loaded) { state = normalize(blankState()); page = 0; applyAll(); v.loaded = true; }
      return;
    }
    const s = normalize(JSON.parse(JSON.stringify(snap.data())));
    s.channels.forEach(c => { delete c.notes; });
    const hadMusic = state.audio.music;
    state = s; if (!v.loaded) page = 0; v.loaded = true;
    applyAll();
    if (ctx && hadMusic !== state.audio.music) startMusic(true);
  }, () => { if (visiting === v) goHome(); });
  sfx("open");
}
function goHome(silent) {
  if (!visiting) return;
  const from = visiting.from;
  visiting.unsub && visiting.unsub();
  const hadMusic = state.audio.music;
  visiting = null; state = homeState || state; homeState = null; page = 0;
  document.body.classList.remove("visiting");
  setPresence({ w: "menu" });
  hide("#preview"); applyAll(); renderSession(); renderVisitBar(); renderSocialChrome();
  if (ctx && hadMusic !== state.audio.music) startMusic(true);
  if (!silent) sfx("back");
  if (from === "plaza" && !silent) openPlaza();
}
function renderVisitBar() {
  const bar = $("#visitBar");
  if (!visiting) { bar.hidden = true; return; }
  bar.hidden = false;
  const id = visiting.id, card = people[id];
  paintChip($("#vbChip"), card && card.avatar);
  $("#vbName").textContent = spaceTitle(id);
  const who = personName(id, "");
  $("#vbSub").textContent = visiting.loaded ? (who ? "by " + who + " · " : "") + state.channels.length + (state.channels.length === 1 ? " tile" : " tiles") : "Loading…";
  $("#vbPlaza").hidden = visiting.from !== "plaza";
  $("#vbHome").hidden = !me.id;                 // no identity: nowhere else to go
  $("#vbStamp").hidden = !me.id || me.canWrite === false;
}
$("#vbHome").onclick = () => goHome(true);
$("#vbPlaza").onclick = () => { goHome(true); openPlaza(); };
$("#vbStamp").onclick = () => openStamp(visiting && visiting.id);

/* borrow: copy a channel (or a workflow with its steps) into my own space */
// put a copy of someone's channel (or workflow shell) into space `mine`, reusing a matching link
function placeIn(mine, obj) {
  let p = mine.pages.find(pg => firstFreeIn(mine, pg.id) >= 0);
  if (!p) { p = { id: uid(), name: "Borrowed" }; mine.pages.push(p); }
  obj.page = p.id; obj.slot = firstFreeIn(mine, p.id); mine.channels.push(obj);
}
const copyFields = ch => ({ name: ch.name, desc: ch.desc || "", tags: (ch.tags || []).slice(0, 8), notes: "", icon: ch.icon || "", hue: ch.hue,
  iconAsset: ch.iconAsset || null, iconData: ch.iconData || null, iconStyle: ch.iconStyle, iconBg: ch.iconBg || null });
function copyChannelInto(mine, ch) {
  const hit = mine.channels.find(x => x.kind !== "flow" && x.url && x.url === ch.url);
  if (hit) return hit.id;
  const n = Object.assign({ id: uid(), url: ch.url }, copyFields(ch));
  placeIn(mine, n); return n.id;
}
function borrow(c) {
  const mine = homeState; if (!mine || !c) return;
  if (me.canWrite === false) { toast("Saving to your space needs Contributor access."); return; }
  const fromSpace = state;
  if (c.kind === "flow") {
    if (mine.channels.some(x => x.kind === "flow" && x.name === c.name)) { toast("You already have a workflow called " + c.name); return; }
    const steps = (c.steps || []).map(st => { const ch = fromSpace.channels.find(x => x.id === st.ch); return ch ? { ch: copyChannelInto(mine, ch), note: st.note || "" } : null; }).filter(Boolean);
    placeIn(mine, Object.assign({ id: uid(), kind: "flow", url: "", steps }, copyFields(c)));
  } else {
    if (mine.channels.some(x => x.kind !== "flow" && x.url === c.url)) { toast(c.name + " is already in your space"); return; }
    copyChannelInto(mine, c);
  }
  homeState = normalize(mine);
  persist(homeState);
  sfx("confirm"); toast("Added " + c.name + " to your space");
}
function firstFreeIn(s, pid) { for (let i = 0; i < PER; i++) if (!s.channels.some(c => c.page === pid && c.slot === i)) return i; return -1; }
