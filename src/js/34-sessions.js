/* ================= sessions: checklists, the log, templates ================= */
/* ---------- checklist panel under the session dock ---------- */
let sesPanelOpen = false;
function renderSesPanel() {
  const panel = $("#sesPanel"), f = session && byId(session.flowId);
  if (!f || !sesPanelOpen) { panel.hidden = true; $("#sesChecks").setAttribute("aria-expanded", "false"); return; }
  panel.hidden = false; $("#sesChecks").setAttribute("aria-expanded", "true");
  panel.innerHTML = "";
  flowSteps(f).forEach((st, i) => {
    const sec = document.createElement("section"); sec.className = "sp-step" + (session.done.includes(i) ? " done" : "");
    const h = document.createElement("b"); h.textContent = (i + 1) + ". " + st.ch.name; sec.appendChild(h);
    if (st.note) { const n = document.createElement("span"); n.className = "hint"; n.textContent = st.note; sec.appendChild(n); }
    st.checks.forEach((item, j) => {
      const key = i + ":" + j;
      const lab = document.createElement("label"); lab.className = "check";
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!session.checked[key];
      cb.onchange = () => {
        if (cb.checked) session.checked[key] = 1; else delete session.checked[key];
        persistSession(); sfx(cb.checked ? "tick" : "back"); renderSession();
      };
      lab.append(cb, document.createTextNode(" " + item)); sec.appendChild(lab);
    });
    panel.appendChild(sec);
  });
}
$("#sesChecks").onclick = () => { sesPanelOpen = !sesPanelOpen; renderSesPanel(); sfx("select"); };

/* ---------- finishing: a summary and an optional note, then into the log ---------- */
let sesPending = null;
function finishSession(s, f) {
  const steps = flowSteps(f), total = steps.reduce((a, st) => a + (st.checks || []).length, 0);
  sesPending = { id: uid(), flow: f.id, flowName: f.name, project: s.project || "", start: s.start,
    mins: Math.max(1, Math.round((Date.now() - s.start) / 60000)), steps: s.done.length, of: steps.length,
    checks: Object.keys(s.checked || {}).length, checksOf: total, note: "" };
  sesPanelOpen = false;
  $("#sdSum").textContent = `${f.name} · ${fmtMins(sesPending.mins)} · ${sesPending.steps} of ${sesPending.of} steps` + (total ? ` · ${sesPending.checks} of ${total} checks` : "");
  $("#sdNote").value = "";
  show("#sesDoneSheet"); setTimeout(() => $("#sdNote").focus(), 40);
}
function closeSesDone(save) {
  const entry = sesPending; sesPending = null; hide("#sesDoneSheet");
  if (!entry) return;
  if (save) { entry.note = $("#sdNote").value.trim().slice(0, 140); logSession(entry); sfx("confirm"); toast("Saved to " + entry.flowName + "'s history"); }
  else sfx("back");
}
$("#sdForm").onsubmit = e => { e.preventDefault(); closeSesDone(true); };
$("#sdSkip").onclick = () => closeSesDone(false);
const fmtMins = m => m < 60 ? m + " min" : Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " min" : "");

/* ---------- the log: one private doc per month ---------- */
const LOG_KEY = "studio-menu-log";
let logCache = null;
const monthKey = t => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
async function readLog() {
  if (logCache) return logCache;
  logCache = [];
  if (db && me.id) {
    const months = [0, 1, 2, 3, 4, 5].map(k => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k); return monthKey(d); });
    const snaps = await Promise.all(months.map(m => db.doc("data/users/" + me.id + "/log-" + m).get().catch(() => null)));
    snaps.forEach(s => { if (s && s.exists && Array.isArray(s.data().items)) logCache.push(...s.data().items); });
  } else { try { logCache = JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch { logCache = []; } }
  logCache.sort((a, b) => b.start - a.start);
  return logCache;
}
async function logSession(entry) {
  await readLog();
  logCache.unshift(entry);
  if (db && me.id && me.canWrite !== false) {
    const m = monthKey(entry.start), items = logCache.filter(x => monthKey(x.start) === m).slice(0, 400);
    db.doc("data/users/" + me.id + "/log-" + m).set({ items }).catch(() => {});
  } else try { localStorage.setItem(LOG_KEY, JSON.stringify(logCache.slice(0, 300))); } catch {}
  if ($("#projSheet").classList.contains("open")) renderProjectLog();
}
// the last few sessions of a workflow, shown on its banner
async function renderFlowHistory(f) {
  const box = $("#pvHistory"); box.hidden = true; box.innerHTML = "";
  if (!f || f.kind !== "flow" || visiting) return;
  const items = (await readLog()).filter(x => x.flow === f.id);
  if (!items.length || pvChannel !== f) return;
  const total = items.reduce((a, x) => a + x.mins, 0);
  const h = document.createElement("b"); h.textContent = `History · ${items.length} ${items.length === 1 ? "session" : "sessions"}, ${fmtMins(total)}`;
  const ol = document.createElement("ol");
  items.slice(0, 4).forEach(x => {
    const li = document.createElement("li");
    li.textContent = new Date(x.start).toLocaleDateString([], { month: "short", day: "numeric" }) + " · " + fmtMins(x.mins) + (x.note ? " · " + x.note : "");
    ol.appendChild(li);
  });
  box.append(h, ol); box.hidden = false;
}

/* ---------- workflow templates ---------- */
// Each step names a role and the words that usually identify a site for it; your own
// channels are matched by name, link and tags, and unmatched steps wait for you to pick.
const TEMPLATES = [
  { id: "video", name: "Video edit", icon: "🎬", desc: "From footage to delivery", steps: [
    { hint: "files", m: ["drive", "dropbox", "frame.io", "box", "files", "cloud", "backup"], note: "Ingest and back up", checks: ["Copy cards to two drives", "Name and sort clips", "Make proxies"] },
    { hint: "editing", m: ["premiere", "resolve", "davinci", "final cut", "capcut", "avid", "edit"], note: "Cut", checks: ["Selects", "Rough cut", "Fine cut"] },
    { hint: "music", m: ["artlist", "epidemic", "musicbed", "soundstripe", "music", "audio"], note: "Music and sound", checks: ["License the track", "Mix levels"] },
    { hint: "color", m: ["lut", "color", "grade", "resolve", "colour"], note: "Grade", checks: ["Balance every shot", "Look pass"] },
    { hint: "review", m: ["frame.io", "vimeo", "review", "wipster", "drive"], note: "Client review", checks: ["Upload a review copy", "Collect notes"] },
    { hint: "delivery", m: ["youtube", "vimeo", "upload", "deliver", "drive"], note: "Deliver", checks: ["Master (ProRes 422 HQ)", "Web H.264", "Captions", "Thumbnail"] },
  ] },
  { id: "3d", name: "3D render", icon: "🧊", desc: "Reference to final frames", steps: [
    { hint: "reference", m: ["pinterest", "pureref", "reference", "film-grab", "shotdeck", "artstation", "inspiration"], note: "Gather reference", checks: ["Mood and lighting refs", "Scale refs"] },
    { hint: "modeling", m: ["blender", "maya", "cinema", "houdini", "zbrush", "3d", "modeling"], note: "Model", checks: ["Blockout", "Clean topology"] },
    { hint: "textures", m: ["poly haven", "polyhaven", "ambientcg", "texture", "quixel", "materials"], note: "Texture", checks: ["UVs", "Materials assigned"] },
    { hint: "rendering", m: ["blender", "octane", "redshift", "render", "arnold"], note: "Light and render", checks: ["Test render", "Final samples", "Render passes"] },
    { hint: "compositing", m: ["after effects", "nuke", "fusion", "resolve", "comp"], note: "Composite", checks: ["Color", "Glow and grain"] },
  ] },
  { id: "game", name: "Game build", icon: "🎮", desc: "Design, build, playtest, ship", steps: [
    { hint: "planning", m: ["notion", "docs", "miro", "trello", "board", "planning"], note: "Plan the build", checks: ["Scope for this build", "Task list"] },
    { hint: "assets", m: ["itch", "kenney", "sketchfab", "asset", "opengameart", "pixel"], note: "Assets", checks: ["Licenses checked"] },
    { hint: "engine", m: ["unity", "unreal", "godot", "roblox", "gamemaker", "engine"], note: "Build", checks: ["Feature done", "Bugs from last playtest"] },
    { hint: "sound", m: ["freesound", "sfx", "zapsplat", "sound", "audio"], note: "Sound", checks: ["SFX pass", "Volume balance"] },
    { hint: "release", m: ["itch", "steam", "discord", "release", "github"], note: "Playtest and release", checks: ["Build uploaded", "Patch notes", "Post to players"] },
  ] },
  { id: "motion", name: "Motion graphics", icon: "✨", desc: "Boards to animated piece", steps: [
    { hint: "reference", m: ["pinterest", "behance", "dribbble", "reference", "inspiration", "art"], note: "Reference", checks: ["Style frames refs"] },
    { hint: "design", m: ["figma", "illustrator", "photoshop", "affinity", "design"], note: "Style frames", checks: ["Key frames designed", "Fonts licensed"] },
    { hint: "animation", m: ["after effects", "cavalry", "rive", "animation", "motion"], note: "Animate", checks: ["Timing pass", "Easing polish"] },
    { hint: "music", m: ["artlist", "epidemic", "music", "sfx", "audio"], note: "Sound", checks: ["Music licensed", "SFX hits"] },
    { hint: "delivery", m: ["youtube", "vimeo", "instagram", "upload", "drive"], note: "Export", checks: ["Master export", "Social cut-downs"] },
  ] },
  { id: "thumb", name: "Thumbnail", icon: "🖼️", desc: "A thumbnail from reference to upload", steps: [
    { hint: "reference", m: ["pinterest", "reference", "youtube", "inspiration"], note: "Reference", checks: ["Three strong refs"] },
    { hint: "design", m: ["photoshop", "figma", "canva", "affinity", "photopea", "design"], note: "Design", checks: ["Readable at small size", "Face or subject clear"] },
    { hint: "fonts", m: ["font", "dafont", "google fonts", "typography"], note: "Type", checks: ["Font licensed"] },
    { hint: "upload", m: ["youtube", "studio", "upload"], note: "Upload", checks: ["A/B variant ready"] },
  ] },
  { id: "podcast", name: "Podcast episode", icon: "🎙️", desc: "Record to published", steps: [
    { hint: "recording", m: ["riverside", "zoom", "squadcast", "record"], note: "Record", checks: ["Levels checked", "Backup recording"] },
    { hint: "editing", m: ["descript", "audition", "premiere", "resolve", "edit"], note: "Edit", checks: ["Cuts", "Loudness -16 LUFS"] },
    { hint: "music", m: ["artlist", "epidemic", "music"], note: "Music", checks: ["Intro and outro"] },
    { hint: "show notes", m: ["notion", "docs", "notes"], note: "Show notes", checks: ["Links", "Timestamps"] },
    { hint: "publishing", m: ["spotify", "apple", "youtube", "anchor", "buzzsprout", "publish"], note: "Publish", checks: ["Episode art", "Scheduled"] },
  ] },
];
function renderTemplates() {
  const sel = $("#edTemplate");
  sel.innerHTML = '<option value="">Choose a template…</option>';
  TEMPLATES.forEach(t => { const o = document.createElement("option"); o.value = t.id; o.textContent = t.icon + " " + t.name + " (" + t.steps.length + " steps)"; sel.appendChild(o); });
  sel.closest(".field").hidden = edKind !== "flow" || !!edTarget;
}
function matchChannel(words, used) {
  const pool = state.channels.filter(c => !c.kind && c.url && !used.has(c.id));
  const text = c => [c.name, c.url, ...(c.tags || [])].join(" ").toLowerCase();
  for (const w of words) { const hit = pool.find(c => text(c).includes(w)); if (hit) return hit; }
  return null;
}
$("#edTemplate").onchange = () => {
  const t = TEMPLATES.find(x => x.id === $("#edTemplate").value); if (!t) return;
  const used = new Set();
  edSteps = t.steps.map(st => { const c = matchChannel(st.m, used); if (c) used.add(c.id); return { ch: c ? c.id : "", note: st.note, checks: st.checks.slice(), hint: st.hint }; });
  if (!$("#edName").value.trim()) $("#edName").value = t.name;
  if (!$("#edDesc").value.trim()) $("#edDesc").value = t.desc;
  if (!$("#edIcon").value.trim()) $("#edIcon").value = t.icon;
  const missing = edSteps.filter(s => !s.ch).length;
  $("#edTemplateHint").textContent = missing ? `Matched ${edSteps.length - missing} of ${edSteps.length} steps to your channels. Pick a site for the rest.` : `All ${edSteps.length} steps matched to your channels.`;
  renderEdSteps(); updateMini(); updateWorldLine(); sfx("confirm");
};
