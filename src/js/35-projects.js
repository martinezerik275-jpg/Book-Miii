/* ================= projects: a job's workflow, tools, files, board and time ================= */
const STATUS_WORD = { planning: "Planning", active: "In progress", review: "In review", delivered: "Delivered" };
function dueText(p) {
  if (!p.due) return "";
  const d = new Date(p.due + "T00:00:00"), today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((d - today) / 86400000);
  if (p.status === "delivered") return "Delivered";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1 && days <= 14) return "Due in " + days + " days";
  if (days < 0) return (-days) + (days === -1 ? " day late" : " days late");
  return "Due " + d.toLocaleDateString([], { month: "short", day: "numeric" });
}
const dueClass = p => { if (!p.due || p.status === "delivered") return ""; const days = Math.round((new Date(p.due + "T00:00:00") - new Date().setHours(0, 0, 0, 0)) / 86400000); return days < 0 ? "late" : days <= 3 ? "soon" : ""; };
function fillProjectTile(sc, p) {
  fillScreen(sc, p);
  if (visiting) return;          // status and dates are private to the project's owner
  const st = document.createElement("span"); st.className = "flow-badge pj-status " + p.status; st.textContent = STATUS_WORD[p.status];
  sc.appendChild(st);
  const due = dueText(p);
  if (due) { const d = document.createElement("span"); d.className = "pj-due " + dueClass(p); d.textContent = due; sc.appendChild(d); }
}

let pjOpen = null;
function openProject(p) {
  pjOpen = p.id; renderProject(); show("#projSheet"); sfx("open", 0, tileWorld(p));
  setTimeout(() => $("#pjStart").focus({ preventScroll: true }), 40);
}
const closeProject = () => { hide("#projSheet"); pjOpen = null; sfx("back"); };
$("#pjClose").onclick = closeProject;
$("#projSheet").addEventListener("click", e => { if (e.target.id === "projSheet") closeProject(); });
function renderProject() {
  const p = pjOpen && byId(pjOpen); if (!p) { hide("#projSheet"); return; }
  const sc = $("#pjScreen"); fillScreen(sc, p); paintBannerMedia(sc, p);
  $("#pjName").textContent = p.name;
  const meta = $("#pjMeta"); meta.innerHTML = "";
  [p.client, dueText(p)].filter(Boolean).forEach((t, i) => { const s = document.createElement("span"); s.textContent = t; if (i === 1 || !p.client) s.className = "pj-due " + dueClass(p); meta.appendChild(s); });
  $("#pjDesc").textContent = p.desc || "";
  [...$("#pjStatus").children].forEach(b => { b.classList.toggle("on", b.dataset.v === p.status); b.disabled = !!visiting; });
  // pinned tools open straight away
  const pins = $("#pjPins"); pins.innerHTML = "";
  p.pins.map(byId).filter(c => c && !c.kind).forEach(c => {
    const a = document.createElement("a"); a.className = "pj-pin"; a.href = c.url; a.target = "_blank"; a.rel = "noopener noreferrer";
    const m = document.createElement("div"); m.className = "mini"; const s2 = document.createElement("div"); s2.className = "screen"; fillScreen(s2, c); m.appendChild(s2);
    const n = document.createElement("span"); n.textContent = c.name;
    a.append(m, n); a.onclick = () => { noteOpen(c); sfx("launch", 0, tileWorld(c)); };
    pins.appendChild(a);
  });
  if (!pins.children.length) pins.innerHTML = '<p class="hint">Pin the tools this job uses in Edit project.</p>';
  const files = $("#pjFiles"); files.innerHTML = "";
  p.files.forEach(f => {
    const li = document.createElement("li"), a = document.createElement("a");
    a.href = f.u; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = f.t || domainOf(f.u);
    const d = document.createElement("span"); d.textContent = domainOf(f.u);
    li.append(a, d); files.appendChild(li);
  });
  if (!p.files.length) files.innerHTML = '<li class="hint">No links yet.</li>';
  renderBoard(p);
  $("#pjNotes").textContent = p.notes || "";
  const flow = byId(p.flow);
  $("#pjStart").hidden = !flow || flow.kind !== "flow";
  $("#pjStart").textContent = flow ? "Start " + flow.name : "Start session";
  $("#pjEdit").hidden = !!visiting;
  $("#pjAddImg").hidden = !!visiting;
  renderProjectLog();
}
$("#pjStatus").onclick = e => {
  const b = e.target.closest("button"), p = byId(pjOpen); if (!b || !p || visiting) return;
  p.status = b.dataset.v; persist(state); render(); renderProject(); sfx(p.status === "delivered" ? "complete" : "tick");
};
$("#pjStart").onclick = () => {
  const p = byId(pjOpen), f = p && byId(p.flow); if (!f) return;
  if (!flowSteps(f).length) { toast("Add steps to " + f.name + " first."); return; }
  hide("#projSheet"); pjOpen = null;
  const first = flowSteps(f)[0].ch; noteOpen(first);
  const a = document.createElement("a"); a.href = first.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.click();
  startSession(f, p.id);
};
$("#pjEdit").onclick = () => { const p = byId(pjOpen); hide("#projSheet"); pjOpen = null; if (p) openEditor(p); };
async function renderProjectLog() {
  const p = pjOpen && byId(pjOpen); if (!p) return;
  const items = visiting ? [] : (await readLog()).filter(x => x.project === p.id);
  const total = items.reduce((a, x) => a + x.mins, 0);
  $("#pjTotal").textContent = items.length ? fmtMins(total) : "No sessions yet";
  $("#pjTotal").classList.toggle("empty", !items.length);
  $("#pjTotalSub").textContent = items.length ? `across ${items.length} ${items.length === 1 ? "session" : "sessions"}` : (visiting ? "" : "Start a session to track time here.");
  const ol = $("#pjLog"); ol.innerHTML = "";
  items.slice(0, 6).forEach(x => {
    const li = document.createElement("li");
    const b = document.createElement("b"); b.textContent = new Date(x.start).toLocaleDateString([], { month: "short", day: "numeric" }) + " · " + fmtMins(x.mins);
    const s = document.createElement("span"); s.textContent = x.note || x.flowName;
    li.append(b, s); ol.appendChild(li);
  });
}

/* ---------- moodboard ---------- */
function renderBoard(p) {
  const box = $("#pjBoard"); box.innerHTML = "";
  p.board.forEach((im, i) => {
    const cell = document.createElement("figure"); cell.className = "pj-img";
    const img = document.createElement("img"); img.alt = ""; img.src = im.asset ? "/_blob/" + im.asset : im.data; img.loading = "lazy";
    cell.appendChild(img);
    if (!visiting) {
      const x = document.createElement("button"); x.type = "button"; x.className = "x"; x.textContent = "✕"; x.setAttribute("aria-label", "Remove image");
      x.onclick = () => { p.board.splice(i, 1); persist(state); renderBoard(p); sfx("back"); };
      cell.appendChild(x);
    }
    box.appendChild(cell);
  });
  box.hidden = !p.board.length;
  $("#pjImgHint").textContent = visiting ? "" : p.board.length ? "" : "Drop reference images here, or add them from your computer.";
}
async function addBoardImages(files) {
  const p = byId(pjOpen); if (!p || visiting) return;
  const imgs = [...files].filter(f => /^image\//.test(f.type)); if (!imgs.length) return;
  const cap = assets ? 12 : 4;
  let added = 0;
  for (const f of imgs) {
    if (p.board.length >= cap) { toast(assets ? "A moodboard holds 12 images." : "A moodboard holds 4 images here. Owners and editors can keep 12."); break; }
    try {
      if (assets) { const r = await assets.upload(f); p.board.push({ asset: r.id }); }
      else {
        const data = await shrinkImage(f, 320);
        if (JSON.stringify(privateOf(state)).length + data.length > 230000) { toast("Your private storage is nearly full, so this image wasn't added."); break; }
        p.board.push({ data });
      }
      added++;
    } catch { toast("Couldn't read " + f.name + "."); }
  }
  if (added) { persist(state); renderBoard(p); sfx("confirm"); }
}
$("#pjAddImg").onclick = () => $("#pjImgFile").click();
$("#pjImgFile").onchange = e => { const f = [...e.target.files]; e.target.value = ""; addBoardImages(f); };
$("#projSheet").addEventListener("dragover", e => { if (hasFiles(e) && !visiting) { e.preventDefault(); e.stopPropagation(); $("#pjBoard").classList.add("over"); } });
$("#projSheet").addEventListener("dragleave", () => $("#pjBoard").classList.remove("over"));
$("#projSheet").addEventListener("drop", e => {
  if (!hasFiles(e)) return; e.preventDefault(); e.stopPropagation(); $("#pjBoard").classList.remove("over"); addBoardImages(e.dataTransfer.files);
});

/* ---------- project fields in the editor ---------- */
function renderProjectFields() {
  const flows = $("#edFlow"); flows.innerHTML = '<option value="">No workflow</option>';
  state.channels.filter(c => c.kind === "flow").forEach(f => { const o = document.createElement("option"); o.value = f.id; o.textContent = f.name; flows.appendChild(o); });
  flows.value = edTarget && edTarget.kind === "project" ? edTarget.flow : "";
  renderPins(); renderFiles();
}
function renderPins() {
  const box = $("#edPins"); box.innerHTML = "";
  edPins = edPins.filter(id => byId(id));
  edPins.forEach(id => {
    const c = byId(id), chip = document.createElement("span"); chip.className = "chip";
    const t = document.createElement("span"); t.textContent = c.name;
    const x = document.createElement("button"); x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label", "Unpin " + c.name);
    x.onclick = () => { edPins = edPins.filter(v => v !== id); renderPins(); sfx("back"); };
    chip.append(t, x); box.appendChild(chip);
  });
  channelOptions($("#edPinAdd"), "", edPins.length >= 12 ? "12 pinned (the most a project holds)" : "Pin a channel…", c => !c.kind && !edPins.includes(c.id));
  $("#edPinAdd").disabled = edPins.length >= 12;
}
$("#edPinAdd").onchange = e => { if (e.target.value) { edPins.push(e.target.value); renderPins(); sfx("tick"); } };
function renderFiles() {
  const box = $("#edFiles"); box.innerHTML = "";
  edFiles.forEach((f, i) => {
    const r = document.createElement("div"); r.className = "file-row";
    const t = document.createElement("input"); t.type = "text"; t.placeholder = "Name, like Project folder"; t.maxLength = 60; t.value = f.t || "";
    t.setAttribute("aria-label", "Link name"); t.oninput = () => { f.t = t.value; };
    const u = document.createElement("input"); u.type = "text"; u.inputMode = "url"; u.placeholder = "https://…"; u.value = f.u || "";
    u.setAttribute("aria-label", "Link address"); u.oninput = () => { f.u = u.value.trim(); };
    const x = document.createElement("button"); x.type = "button"; x.className = "x"; x.textContent = "✕"; x.setAttribute("aria-label", "Remove link");
    x.onclick = () => { edFiles.splice(i, 1); renderFiles(); sfx("back"); };
    r.append(t, u, x); box.appendChild(r);
  });
}
$("#edAddFile").onclick = () => { if (edFiles.length >= 12) { toast("A project holds up to 12 links."); return; } edFiles.push({ t: "", u: "" }); renderFiles(); sfx("select"); };
