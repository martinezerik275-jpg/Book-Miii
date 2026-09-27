/* ================= data ================= */
function blankState() {
  return { rev: 0, pages: [{ id: uid(), name: "Home" }], channels: [],
    audio: { music: null, musicName: "", sfx: {}, sfxNames: {}, musicVol: 0.4, sfxVol: 0.7, musicOn: true, tune: true, pauseHidden: true },
    theme: "auto", lighting: true, idle: { on: true, mins: 5 }, sound: { worlds: {}, follow: true },
    backdrop: { asset: null, kind: "image", name: "", fit: "cover", dim: 0.25, blur: 0, lines: true }, skin: "wii" };
}
const SKINS = ["wii", "cube", "dream", "cabin"];
const PROJECT_STATUS = ["planning", "active", "review", "delivered"];
const isHex32 = v => typeof v === "string" && /^[0-9a-f]{32}$/.test(v);
const isImgData = v => typeof v === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(v);
const httpUrl = v => typeof v === "string" && /^https?:\/\//i.test(v) ? v : "";
const str = (v, n) => typeof v === "string" ? v.slice(0, n) : "";
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
  if (!SKINS.includes(s.skin)) s.skin = "wii";
  const ids = new Set(s.pages.map(p => p.id));
  s.pages.forEach(p => { if (!p.id) p.id = uid(); if (!p.name) p.name = "Page"; });
  // assign free slots, overflow into new pages
  const used = {};
  s.channels.forEach(c => {
    c.id = c.id || uid(); c.tags = Array.isArray(c.tags) ? c.tags : [];
    c.hue = Number.isFinite(+c.hue) ? +c.hue : 200;
    // spaces can come from other people: only web links, never javascript: or data: URLs
    if (typeof c.url !== "string" || !/^https?:\/\//i.test(c.url)) c.url = "";
    if (c.kind === "flow") {
      c.steps = Array.isArray(c.steps) ? c.steps.filter(x => x && x.ch).slice(0, 8) : []; c.url = "";
      c.steps.forEach(st => { st.checks = Array.isArray(st.checks) ? st.checks.map(x => str(x, 80)).filter(Boolean).slice(0, 8) : []; });
    }
    if (c.kind === "project") {
      c.url = ""; c.flow = typeof c.flow === "string" ? c.flow : "";
      c.pins = Array.isArray(c.pins) ? c.pins.filter(x => typeof x === "string").slice(0, 12) : [];
      c.client = str(c.client, 80); c.due = /^\d{4}-\d{2}-\d{2}$/.test(c.due) ? c.due : "";
      if (!PROJECT_STATUS.includes(c.status)) c.status = "active";
      c.files = Array.isArray(c.files) ? c.files.map(f => f && ({ t: str(f.t, 60), u: httpUrl(f.u) })).filter(f => f && f.u).slice(0, 12) : [];
      c.board = Array.isArray(c.board) ? c.board.filter(b => b && (isHex32(b.asset) || isImgData(b.data))).map(b => b.asset ? { asset: b.asset } : { data: b.data }).slice(0, 12) : [];
    }
    if (c.banner && !(c.banner && isHex32(c.banner.asset) && ["image", "video"].includes(c.banner.kind))) delete c.banner;
    c.opens = Math.max(0, Math.floor(+c.opens || 0)) || undefined; c.lastOpen = +c.lastOpen || undefined; c.fav = c.fav === true || undefined;
    if (!ids.has(c.page)) c.page = s.pages[0].id;
  });
  // stacks hold channels and workflows; a member lives inside its stack, not on the grid
  const stacks = new Set(s.channels.filter(c => c.kind === "stack").map(c => c.id));
  s.channels.forEach(c => {
    if (c.stack && (!stacks.has(c.stack) || c.kind === "stack" || c.kind === "project")) delete c.stack;
    if (c.stack) c.slot = -1;
  });
  s.channels.filter(c => !c.stack).forEach(c => {
    used[c.page] = used[c.page] || new Set();
    if (!(c.slot >= 0 && c.slot < PER) || used[c.page].has(c.slot)) c.slot = -1;
    else used[c.page].add(c.slot);
  });
  s.channels.filter(c => c.slot === -1 && !c.stack).forEach(c => {
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
// The shared copy leaves private fields out (notes, how often you open things, project
// client/dates/files/moodboard): they live in the private data/users/<id> doc.
const PRIVATE_KEYS = ["notes", "opens", "lastOpen", "client", "due", "status", "files", "board"];
function sharedBody(s) {
  const body = JSON.parse(JSON.stringify(s));
  if (privRef) body.channels.forEach(c => PRIVATE_KEYS.forEach(k => { delete c[k]; }));
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
/* private store: data/users/<id>/private = { notes: { <id>: text }, fields: { <id>: { opens, lastOpen, client, … } } } */
let privSaved = "";
function privateOf(s) {
  const notes = {}, fields = {};
  s.channels.forEach(c => {
    if (c.notes) notes[c.id] = c.notes;
    const f = {}; PRIVATE_KEYS.forEach(k => { if (k !== "notes" && c[k] != null && c[k] !== "" && !(Array.isArray(c[k]) && !c[k].length)) f[k] = c[k]; });
    if (Object.keys(f).length) fields[c.id] = f;
  });
  return { notes, fields };
}
// fill in private values the shared copy doesn't carry
function applyPrivate(s) {
  if (!s) return;
  s.channels.forEach(c => {
    if (privData.notes[c.id] != null) c.notes = privData.notes[c.id];
    const f = privData.fields[c.id]; if (f) PRIVATE_KEYS.forEach(k => { if (k !== "notes" && f[k] != null) c[k] = f[k]; });
  });
}
function savePrivate(s) {
  if (!privRef || !privLoaded) return;
  const d = privateOf(s), j = JSON.stringify(d);
  if (j === privSaved) return;
  privSaved = j; privData = d;
  privRef.set(d).catch(() => { privSaved = ""; });
}
// small private-only changes (open counts) skip the shared write entirely
function savePrivateOnly(s) {
  try { localStorage.setItem(lsKey(), JSON.stringify(s)); } catch {}
  if (privRef) savePrivate(s); else persist(s);
}
const byId = id => state.channels.find(c => c.id === id);
const flowSteps = f => (f.steps || []).map(st => ({ ch: byId(st.ch), note: st.note || "", checks: st.checks || [] })).filter(x => x.ch && x.ch.kind !== "flow");
const chAt = (pid, slot) => state.channels.find(c => !c.stack && c.page === pid && c.slot === slot);
const pageOf = c => state.pages.findIndex(p => p.id === c.page);
const domainOf = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u || ""; } };
const glyphOf = c => (c.icon && c.icon.trim()) || (c.name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2) || "?";

