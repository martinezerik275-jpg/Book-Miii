/* ================= boot ================= */
// Render from this device's cache first; the platform answers later.
try { const m = JSON.parse(localStorage.getItem(ME_KEY)); if (m && m.id) { me.id = m.id; me.isOwner = !!m.isOwner; } } catch {}
let bootKey = lsKey(), local = null;
try { local = JSON.parse(localStorage.getItem(bootKey)); } catch {}
state = normalize(local || blankState());
function applyAll() { applySkin(); applyTheme(); applyLighting(); applyBackdrop(); render(); }
applyAll(); renderSession(); renderSocialChrome(); tickFocus();

function whenClaude(cb, tries = 0) {
  if (window.claude && typeof window.claude.use === "function") return cb();
  if (tries < 50) setTimeout(() => whenClaude(cb, tries + 1), 200);
}
const useCap = name => claude.use(name).catch(() => null);

whenClaude(async () => {
  useCap("assets").then(a => { assets = a || null; });
  useCap("sample").then(s => { sample = s || null; });
  useCap("downloads").then(d => { downloads = d || null; });
  const [u, d, r] = await Promise.all([useCap("user"), useCap("db"), useCap("room")]);
  user = u;
  if (u) {
    const m = await u.me();
    me.id = m.id; me.isOwner = !!m.isOwner; me.name = m.name || "";
    me.canWrite = await u.can("data.write");
    try { localStorage.setItem(ME_KEY, JSON.stringify({ id: me.id, isOwner: me.isOwner })); } catch {}
  }
  if (lsKey() !== bootKey) {               // a different person than this device's cache: load theirs
    bootKey = lsKey(); local = null;
    try { local = JSON.parse(localStorage.getItem(bootKey)); } catch {}
    state = normalize(local || blankState()); page = 0; applyAll();
  }
  if (d) connectDb(d);
  if (r) connectRoom(r);
  identityReady = true;
  loadOnboarding();
  renderSocialChrome();
});

function connectDb(d) {
  db = d;
  db.doc("hub/info").onSnapshot(snap => {
    const info = snap.exists ? snap.data() : null;
    hubOwner = info && info.ownerId || null;
    if (me.isOwner && me.id && hubOwner !== me.id) db.doc("hub/info").set({ ownerId: me.id }).catch(() => {});
    if (!me.id && hubOwner && !visiting) visitSpace(hubOwner);   // no identity here: show the owner's space
    renderSocialChrome();
  }, () => {});
  watchPeople();
  if (!me.id) return;
  watchStamps();
  privRef = db.doc("data/users/" + me.id + "/private");
  privRef.onSnapshot(snap => {
    const d = snap.exists ? snap.data() : null;
    privData = { notes: (d && d.notes) || {}, fields: (d && d.fields) || {} }; privSaved = JSON.stringify(privData); privLoaded = true;
    applyPrivate(visiting ? homeState : state);
    migrateNotes();
  }, () => {});
  ref = db.doc(me.isOwner ? "menu/main" : "spaces/" + me.id);
  ref.onSnapshot(snap => {
    if (saving) return;
    if (!snap.exists) {
      const mine = visiting ? homeState : state;
      if (local && local.channels && local.channels.length && me.canWrite !== false) persist(mine);
      return;
    }
    const data = JSON.parse(JSON.stringify(snap.data()));
    const mine = visiting ? homeState : state;
    const pub = list => JSON.stringify(list.map(c => { const o = { ...c }; PRIVATE_KEYS.forEach(k => { delete o[k]; }); return o; }));
    if (gotRemote && (data.rev || 0) === mine.rev && pub(data.channels) === pub(mine.channels)) return;
    gotRemote = true;
    legacyNotes = data.channels.some(c => PRIVATE_KEYS.some(k => c[k] != null));
    const incoming = normalize(data);
    // keep this device's private values until the private doc says otherwise
    incoming.channels.forEach(c => { const old = mine.channels.find(x => x.id === c.id); if (old) PRIVATE_KEYS.forEach(k => { if (c[k] == null && old[k] != null) c[k] = old[k]; }); });
    applyPrivate(incoming);
    try { localStorage.setItem(lsKey(), JSON.stringify(incoming)); } catch {}
    if (visiting) { homeState = incoming; migrateNotes(); return; }
    const hadMusic = state.audio.music;
    state = incoming;
    applyAll(); renderSession();
    if (ctx) { loadAllSfx(); if (hadMusic !== state.audio.music) startMusic(true); else applyMusicVolume(); }
    if ($("#settings").classList.contains("open")) renderSettings();
    migrateNotes();
  }, () => {});
}
// Older versions kept notes in the shared menu doc. Once the private doc has loaded,
// one save moves them there and strips them from the shared copy.
let legacyNotes = false;
function migrateNotes() {
  if (!legacyNotes || !privLoaded || !gotRemote || me.canWrite === false) return;
  legacyNotes = false;
  persist(visiting ? homeState : state);
}

if (TEST) window.__sm = {
  get state() { return state; }, get home() { return homeState; }, get visiting() { return visiting; },
  get me() { return me; }, get people() { return people; }, get peers() { return peersNow; },
  get plaza() { return plaza; }, get onb() { return onb; }, get undoStack() { return undoStack; }, readLog, TEMPLATES, normalize, AVATAR, encodeAvatar, decodeAvatar,
};
