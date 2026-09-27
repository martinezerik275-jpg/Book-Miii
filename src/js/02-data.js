/* ================= data ================= */
function blankState() {
  return { rev: 0, pages: [{ id: uid(), name: "Home" }], channels: [],
    audio: { music: null, musicName: "", sfx: {}, sfxNames: {}, musicVol: 0.4, sfxVol: 0.7, musicOn: true, tune: true, pauseHidden: true },
    theme: "auto", lighting: true, idle: { on: true, mins: 5 }, sound: { worlds: {}, follow: true },
    backdrop: { asset: null, kind: "image", name: "", fit: "cover", dim: 0.25, blur: 0, lines: true } };
}
function normalize(s) {
  const b = blankState();
  s = s && typeof s === "object" ? s : b;
  s.pages = Array.isArray(s.pages) && s.pages.length ? s.pages : b.pages;
  s.channels = Array.isArray(s.channels) ? s.channels : [];
  s.audio = Object.assign({}, b.audio, s.audio || {});
  s.audio.sfx = s.audio.sfx || {}; s.audio.sfxNames = s.audio.sfxNames || {};
  s.theme = s.theme || "auto"; s.rev = s.rev || 0;
  if (typeof s.lighting !== "boolean") s.lighting = true;
  s.backdrop = Object.assign({ asset: null, kind: "image", name: "", fit: "cover", dim: 0.25, blur: 0, lines: true }, s.backdrop || {});
  s.idle = Object.assign({ on: true, mins: 5 }, s.idle || {});
  s.sound = Object.assign({ worlds: {}, follow: true }, s.sound || {}); s.sound.worlds = s.sound.worlds || {};
  const ids = new Set(s.pages.map(p => p.id));
  s.pages.forEach(p => { if (!p.id) p.id = uid(); if (!p.name) p.name = "Page"; });
  // assign free slots, overflow into new pages
  const used = {};
  s.channels.forEach(c => {
    c.id = c.id || uid(); c.tags = Array.isArray(c.tags) ? c.tags : [];
    c.hue = Number.isFinite(+c.hue) ? +c.hue : 200;
    // spaces can come from other people: only web links, never javascript: or data: URLs
    if (typeof c.url !== "string" || !/^https?:\/\//i.test(c.url)) c.url = "";
    if (c.kind === "flow") { c.steps = Array.isArray(c.steps) ? c.steps.filter(x => x && x.ch) : []; c.url = ""; }
    if (!ids.has(c.page)) c.page = s.pages[0].id;
  });
  s.channels.forEach(c => {
    used[c.page] = used[c.page] || new Set();
    if (!(c.slot >= 0 && c.slot < PER) || used[c.page].has(c.slot)) c.slot = -1;
    else used[c.page].add(c.slot);
  });
  s.channels.filter(c => c.slot === -1).forEach(c => {
    let pi = s.pages.findIndex(p => p.id === c.page);
    for (;;) {
      const p = s.pages[pi]; used[p.id] = used[p.id] || new Set();
      let free = -1; for (let i = 0; i < PER; i++) if (!used[p.id].has(i)) { free = i; break; }
      if (free >= 0) { c.page = p.id; c.slot = free; used[p.id].add(free); break; }
      pi++; if (pi >= s.pages.length) s.pages.push({ id: uid(), name: "More" });
    }
  });
  return s;
}
// Each person's space is cached per device under its own key, so a shared
// computer (or an old cache of the owner's menu) never leaks into someone else's space.
const lsKey = () => (me.id && !me.isOwner) ? "studio-menu-space-" + me.id : LS_KEY;
function save() {
  if (visiting) return;            // someone else's space is read-only
  persist(state);
}
// The shared copy leaves channel notes out: they live in the private data/users/<id> doc.
function sharedBody(s) {
  const body = JSON.parse(JSON.stringify(s));
  if (privRef) body.channels.forEach(c => { delete c.notes; });
  return body;
}
function persist(s) {
  s.rev = (s.rev || 0) + 1;
  try { localStorage.setItem(lsKey(), JSON.stringify(s)); } catch {}
  savePrivate(s);
  updateMyCard(s);
  if (!ref) return;
  const target = ref;
  saving = true; clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await target.set(sharedBody(s)); if (me.canWrite === null) me.canWrite = true; }
    catch (e) {
      if (e && e.code === "invalid_argument") {
        me.canWrite = false; renderSocialChrome();
        toast("You can look around, but saving a space needs Contributor access. Your changes stay in this browser.");
      } else toast("Couldn't save to the cloud. Your changes are kept in this browser.");
    }
    setTimeout(() => { saving = false; }, 800);
  }, 450);
}
/* private notes: data/users/<id>/private = { notes: { <channelId>: text } } */
let privSaved = "";
function notesOf(s) { const n = {}; s.channels.forEach(c => { if (c.notes) n[c.id] = c.notes; }); return n; }
function applyPrivateNotes(s) { if (s) s.channels.forEach(c => { if (privNotes[c.id] != null) c.notes = privNotes[c.id]; }); }
function savePrivate(s) {
  if (!privRef || !privLoaded) return;
  const n = notesOf(s), j = JSON.stringify(n);
  if (j === privSaved) return;
  privSaved = j; privNotes = n;
  privRef.set({ notes: n }).catch(() => { privSaved = ""; });
}
const byId = id => state.channels.find(c => c.id === id);
const flowSteps = f => (f.steps || []).map(st => ({ ch: byId(st.ch), note: st.note || "" })).filter(x => x.ch && x.ch.kind !== "flow");
const chAt = (pid, slot) => state.channels.find(c => c.page === pid && c.slot === slot);
const pageOf = c => state.pages.findIndex(p => p.id === c.page);
const domainOf = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u || ""; } };
const glyphOf = c => (c.icon && c.icon.trim()) || (c.name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2) || "?";

