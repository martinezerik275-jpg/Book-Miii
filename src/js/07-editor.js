/* ================= editor ================= */
let edTarget = null, edPid = null, edSlot = 0, edAsset = null, edData = null, edKind = "channel", edSteps = [], edStyle = "color", edBg = null;
let edBanner = null, edPins = [], edFiles = [];
const KIND_WORD = { channel: "channel", flow: "workflow", stack: "stack", project: "project" };
function setEdKind(k) {
  edKind = k; $("#edForm").dataset.kind = k;
  [...$("#edKind").children].forEach(b => b.classList.toggle("on", b.dataset.v === k));
  document.querySelectorAll("#edForm [data-kinds]").forEach(el => { el.hidden = !el.dataset.kinds.split(" ").includes(k); });
  const isNew = !edTarget, word = KIND_WORD[k];
  $("#edTitle").textContent = (isNew ? "Add " : "Edit ") + word;
  $("#edSave").textContent = "Save " + word;
  $("#edDescLbl").textContent = { flow: "What this session is for", stack: "What's in it", project: "The brief, in a line or two" }[k] || "What it's for";
  $("#edNotesLbl").textContent = k === "project" ? "Project notes" : "Your notes";
  if (k === "flow" && !edSteps.length) edSteps = [{ ch: "", note: "", checks: [] }, { ch: "", note: "", checks: [] }];
  if (k === "flow") renderTemplates();
  if (k === "project") renderProjectFields();
  renderStackSelect(); renderBannerRow();
  renderEdSteps(); updateWorldLine();
}
$("#edKind").onclick = e => { const b = e.target.closest("button"); if (b) { setEdKind(b.dataset.v); sfx("tick"); } };
// every site on the menu, grouped by page (stacked ones listed under their stack)
function channelOptions(sel, value, placeholder = "Choose a site…", filter = c => !c.kind) {
  sel.innerHTML = ""; const o0 = document.createElement("option"); o0.value = ""; o0.textContent = placeholder; sel.appendChild(o0);
  const groups = state.pages.map(p => [p.name, state.channels.filter(c => !c.stack && c.page === p.id && filter(c)).sort((a, b) => a.slot - b.slot)]);
  state.channels.filter(c => c.kind === "stack").forEach(st => groups.push([st.name, state.channels.filter(c => c.stack === st.id && filter(c))]));
  groups.forEach(([label, chs]) => {
    if (!chs.length) return;
    const g = document.createElement("optgroup"); g.label = label;
    chs.forEach(c => { const o = document.createElement("option"); o.value = c.id; o.textContent = c.name; g.appendChild(o); });
    sel.appendChild(g);
  });
  sel.value = value || "";
}
function renderEdSteps() {
  const box = $("#edSteps"); box.innerHTML = "";
  edSteps.forEach((st, i) => {
    const wrap = document.createElement("div"); wrap.className = "step-wrap";
    const r = document.createElement("div"); r.className = "step-row";
    const n = document.createElement("span"); n.className = "step-n"; n.textContent = i + 1;
    const sel = document.createElement("select"); sel.setAttribute("aria-label", "Site for step " + (i + 1)); channelOptions(sel, st.ch, st.hint ? "Choose a site for " + st.hint + "…" : "Choose a site…");
    sel.onchange = () => { st.ch = sel.value; updateWorldLine(); };
    const inp = document.createElement("input"); inp.type = "text"; inp.placeholder = "Note (optional)"; inp.maxLength = 80; inp.value = st.note || "";
    inp.setAttribute("aria-label", "Note for step " + (i + 1)); inp.oninput = () => { st.note = inp.value; };
    const up = document.createElement("button"); up.type = "button"; up.className = "x"; up.textContent = "↑"; up.setAttribute("aria-label", "Move step up"); up.disabled = i === 0;
    up.onclick = () => { edSteps.splice(i - 1, 0, edSteps.splice(i, 1)[0]); renderEdSteps(); sfx("tick"); };
    const del = document.createElement("button"); del.type = "button"; del.className = "x"; del.textContent = "✕"; del.setAttribute("aria-label", "Remove step");
    del.onclick = () => { edSteps.splice(i, 1); renderEdSteps(); sfx("back"); };
    r.append(n, sel, inp, up, del);
    const cl = document.createElement("details"); cl.className = "step-checks"; if ((st.checks || []).length) cl.open = false;
    const sm = document.createElement("summary"); sm.textContent = "Checklist" + ((st.checks || []).length ? " (" + st.checks.length + ")" : "");
    const ta = document.createElement("textarea"); ta.rows = 3; ta.placeholder = "One item per line, like: Export ProRes 422 HQ";
    ta.setAttribute("aria-label", "Checklist for step " + (i + 1)); ta.value = (st.checks || []).join("\n");
    ta.oninput = () => { st.checks = ta.value.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 8); sm.textContent = "Checklist" + (st.checks.length ? " (" + st.checks.length + ")" : ""); };
    cl.append(sm, ta);
    wrap.append(r, cl); box.appendChild(wrap);
  });
}
$("#edAddStep").onclick = () => { if (edSteps.length >= 8) { toast("A workflow can have up to 8 steps."); return; } edSteps.push({ ch: "", note: "", checks: [] }); renderEdSteps(); sfx("select"); };
// channels and workflows can live in a stack
function renderStackSelect() {
  const sel = $("#edStack"), stacks = state.channels.filter(c => c.kind === "stack");
  sel.innerHTML = '<option value="">Not in a stack</option>';
  stacks.forEach(st => { const o = document.createElement("option"); o.value = st.id; o.textContent = st.name; sel.appendChild(o); });
  sel.value = (edTarget && edTarget.stack) || "";
  sel.closest(".field").hidden = !["channel", "flow"].includes(edKind) || !stacks.length;
}
function edTagList() { return $("#edTags").value.split(",").map(t => t.trim()).filter(Boolean); }
function updateWorldLine() {
  const line = $("#edWorld"); line.innerHTML = "";
  const tags = edTagList(), hit = worldForTags(tags);
  let w, why;
  if (hit) { w = hit.w; why = hit.direct ? "tagged directly" : "from the tag \u201c" + hit.by + "\u201d"; }
  else {
    const first = edKind === "flow" ? edSteps.map(s => byId(s.ch)).find(Boolean) : null;
    if (first && worldOf(first)) { w = worldOf(first); why = "from its first step"; }
    else { w = pageWorld($("#edPage").value || state.pages[page].id); why = "the page's world, since no tag matches"; }
  }
  const dot = document.createElement("span"); dot.className = "world-dot"; dot.style.background = WORLDS[w].color;
  const t = document.createElement("span"); t.innerHTML = "Sound world: <b></b> "; t.querySelector("b").textContent = WORLDS[w].name;
  t.append(document.createTextNode("(" + why + ")"));
  const pl = document.createElement("button"); pl.type = "button"; pl.className = "x"; pl.textContent = "▶"; pl.setAttribute("aria-label", "Play this sound world");
  pl.onclick = () => previewWorld(w);
  line.append(dot, t, pl);
}
$("#edTags").addEventListener("input", updateWorldLine);
$("#edPage").addEventListener("change", updateWorldLine);
function openEditor(c, pid, slot) {
  edTarget = c; edAsset = c ? c.iconAsset || null : null; edData = c ? c.iconData || null : null;
  edStyle = c && c.iconStyle || "color"; edBg = c && c.iconBg || null;
  $("#edErr").hidden = true; document.querySelectorAll("#edForm .field.bad").forEach(f => f.classList.remove("bad"));
  $("#edName").value = c ? c.name : ""; $("#edUrl").value = c ? c.url : "";
  $("#edDesc").value = c ? c.desc || "" : ""; $("#edTags").value = c ? (c.tags || []).join(", ") : "";
  $("#edNotes").value = c ? c.notes || "" : ""; $("#edIcon").value = c ? c.icon || "" : "";
  $("#edHue").value = c ? c.hue : Math.floor(Math.random() * 360);
  const sel = $("#edPage"); sel.innerHTML = "";
  state.pages.forEach(p => { const o = document.createElement("option"); o.value = p.id; o.textContent = p.name; sel.appendChild(o); });
  sel.value = c ? c.page : (pid || state.pages[page].id);
  edPid = c ? c.page : pid; edSlot = c ? c.slot : slot;
  $("#edDelete").hidden = !c;
  $("#edDraft").hidden = !sample; $("#edDraftHint").textContent = "";
  $("#edImgClear").hidden = !(edAsset || edData);
  edSteps = c && c.kind === "flow" ? (c.steps || []).map(x => ({ ch: x.ch, note: x.note || "", checks: (x.checks || []).slice() })) : [];
  edBanner = c && c.banner ? Object.assign({}, c.banner) : null;
  edPins = c && c.kind === "project" ? c.pins.slice() : []; edFiles = c && c.kind === "project" ? c.files.map(f => ({ ...f })) : [];
  $("#edClient").value = c && c.client || ""; $("#edDue").value = c && c.due || ""; $("#edStatus").value = c && c.status || "active";
  $("#edKind").hidden = !!c;
  setEdKind(c ? (c.kind || "channel") : "channel");
  updateMini(); show("#editor"); sfx("select");
  setTimeout(() => $("#edName").focus(), 30);
}
$("#edStyle").onclick = e => { const b = e.target.closest("button"); if (!b) return; edStyle = b.dataset.v; updateMini(); sfx("tick"); };
function updateMini() {
  const c = { name: $("#edName").value || "?", icon: $("#edIcon").value, hue: +$("#edHue").value, iconAsset: edAsset, iconData: edData, iconStyle: edStyle, iconBg: edBg };
  $("#edStyleRow").hidden = !(edAsset || edData);
  [...$("#edStyle").children].forEach(b => b.classList.toggle("on", b.dataset.v === edStyle));
  fillScreen($("#edMini .screen"), c);
}
["#edName", "#edIcon", "#edHue"].forEach(s => $(s).addEventListener("input", updateMini));
$("#edHue").addEventListener("input", () => { if (Math.random() < .35) sfx("tick"); });
$("#edCancel").onclick = () => { hide("#editor"); sfx("back"); };
function formError(msg, field) {
  const er = $("#edErr"); er.textContent = msg; er.hidden = false;
  document.querySelectorAll("#edForm .field.bad").forEach(f => f.classList.remove("bad"));
  if (field) { field.closest(".field").classList.add("bad"); field.focus(); }
  const sh = $("#edForm"); sh.classList.remove("shake"); void sh.offsetWidth; sh.classList.add("shake");
  sfx("error");
}
$("#edForm").onsubmit = e => {
  e.preventDefault();
  $("#edErr").hidden = true; document.querySelectorAll("#edForm .field.bad").forEach(f => f.classList.remove("bad"));
  const word = KIND_WORD[edKind];
  if (!$("#edName").value.trim()) return formError("Give the " + word + " a name.", $("#edName"));
  const data = {
    name: $("#edName").value.trim(), desc: $("#edDesc").value.trim(), tags: edTagList().slice(0, 8),
    icon: $("#edIcon").value.trim(), hue: +$("#edHue").value, iconAsset: edAsset, iconData: edData, iconStyle: edStyle, iconBg: edBg,
    banner: edBanner || undefined,
  };
  if (edKind === "channel") {
    let url = $("#edUrl").value.trim(); if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    let okUrl = false; try { const u = new URL(url); okUrl = /\./.test(u.hostname) || u.hostname === "localhost"; } catch {}
    if (!okUrl) return formError("Add a link, like texturelabs.org or https://texturelabs.org.", $("#edUrl"));
    Object.assign(data, { url, notes: $("#edNotes").value.trim() });
  } else if (edKind === "flow") {
    const steps = edSteps.filter(st => st.ch).map(st => ({ ch: st.ch, note: (st.note || "").trim(), checks: (st.checks || []).slice(0, 8) }));
    if (steps.length < 2) return formError("Pick at least two sites for the steps.", null);
    Object.assign(data, { kind: "flow", url: "", notes: "", steps });
  } else if (edKind === "stack") {
    Object.assign(data, { kind: "stack", url: "", notes: "" });
  } else {
    Object.assign(data, { kind: "project", url: "", notes: $("#edNotes").value.trim(), client: $("#edClient").value.trim(), due: $("#edDue").value,
      status: $("#edStatus").value, flow: $("#edFlow").value, pins: edPins.slice(0, 12),
      files: edFiles.map(f => ({ t: (f.t || "").trim(), u: /^https?:\/\//i.test(f.u) ? f.u.trim() : (f.u ? "https://" + f.u.trim() : "") })).filter(f => f.u) });
  }
  const stackId = ["channel", "flow"].includes(edKind) ? $("#edStack").value : "";
  const newPid = $("#edPage").value;
  if (edTarget) checkpoint("edit " + edTarget.name);
  let c = edTarget;
  if (c) {
    const wasStacked = !!c.stack;
    Object.assign(c, data); if (!data.banner) delete c.banner;
    if (stackId) c.stack = stackId;
    else { delete c.stack; if (wasStacked || newPid !== c.page) { c.page = newPid; c.slot = firstFree(newPid); } }
  } else {
    const slot = (newPid === edPid && !chAt(newPid, edSlot)) ? edSlot : firstFree(newPid);
    c = Object.assign({ id: uid(), page: newPid, slot }, data);
    if (stackId) c.stack = stackId;
    state.channels.push(c);
  }
  state = normalize(state); save(); hide("#editor"); sfx("confirm"); render();
  const shown = c.stack ? byId(c.stack) : c; if (shown) goPage(pageOf(shown), true);
  toast((edTarget ? word.charAt(0).toUpperCase() + word.slice(1) + " saved" : word.charAt(0).toUpperCase() + word.slice(1) + " added") + (c.stack && !edTarget ? " to " + byId(c.stack).name : ""));
};
function firstFree(pid) { for (let i = 0; i < PER; i++) if (!chAt(pid, i)) return i; return -1; }
$("#edDelete").onclick = async () => {
  if (!edTarget) return;
  const target = edTarget;
  const inside = target.kind === "stack" ? state.channels.filter(c => c.stack === target.id) : [];
  if (!await askConfirm(`Delete "${target.name}" from your menu?` + (inside.length ? ` Its ${inside.length} tiles go back onto the page.` : ""), "Delete")) return;
  checkpoint("delete " + target.name);
  inside.forEach(c => { delete c.stack; c.page = target.page; c.slot = -1; });
  state.channels = state.channels.filter(c => c !== target);
  state = normalize(state); save(); hide("#editor"); sfx("back"); render();
  toastAction(KIND_WORD[target.kind || "channel"].replace(/^./, m => m.toUpperCase()) + " deleted", "Undo", undo);
};
$("#edDraft").onclick = async () => {
  const name = $("#edName").value.trim(), url = $("#edUrl").value.trim();
  if (!name && !url) { $("#edDraftHint").textContent = "Add a name or link first."; return; }
  const btn = $("#edDraft"); btn.disabled = true; $("#edDraftHint").textContent = "Drafting…";
  try {
    const out = await sample.json(
      `You help a videographer, 3D artist and game developer organize creative bookmarks.\n` +
      `Site name: ${name}\nLink: ${url}\n` +
      `From what you know about this site (don't invent specifics you aren't sure of), return JSON only: ` +
      `{"desc": "one or two plain sentences on what the site is and what it's useful for in a creative workflow, under 220 characters", ` +
      `"tags": ["2 to 4 short lowercase tags"], "icon": "one fitting emoji"}`,
      { modelTier: "quick" });
    if (out && out.desc) $("#edDesc").value = String(out.desc).slice(0, 400);
    if (out && Array.isArray(out.tags) && !$("#edTags").value.trim()) $("#edTags").value = out.tags.slice(0, 4).join(", ");
    if (out && out.icon && !$("#edIcon").value.trim() && !edAsset) { $("#edIcon").value = String(out.icon).slice(0, 4); updateMini(); }
    $("#edDraftHint").textContent = "Drafted. Edit it to taste."; sfx("confirm");
  } catch (e) {
    if (e && e.code === "not_granted") { btn.hidden = true; $("#edDraftHint").textContent = ""; }
    else $("#edDraftHint").textContent = e && e.code === "rate_limited" ? "Too many requests. Try again in a minute." : "Couldn't draft a description. Write one yourself or try again.";
  } finally { btn.disabled = false; }
};
$("#edImgBtn").onclick = () => $("#edImgFile").click();
function shrinkImage(file, size = 160) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, size / Math.max(img.width, img.height));
      const cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(img.width * k)); cv.height = Math.max(1, Math.round(img.height * k));
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      let d = cv.toDataURL("image/webp", 0.85); if (!d.startsWith("data:image/webp")) d = cv.toDataURL("image/png");
      res(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(); };
    img.src = url;
  });
}
$("#edImgFile").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  if (!/^image\//.test(f.type)) { toast("Pick an image file (PNG, JPG, WebP or SVG)."); return; }
  const btn = $("#edImgBtn"); btn.disabled = true; btn.textContent = "Loading image…";
  try {
    try { const a = await analyzeLogo(f); edStyle = a.style; edBg = a.bg; } catch {}
    if (assets) {
      try { const r = await assets.upload(f); edAsset = r.id; edData = null; }
      catch { edData = await shrinkImage(f); edAsset = null; }
    } else { edData = await shrinkImage(f); edAsset = null; }
    $("#edImgClear").hidden = false; updateMini(); sfx("confirm"); toast("Image set. Save the channel to keep it.");
  } catch { sfx("error"); toast("Couldn't read that image. Try a PNG, JPG or WebP."); }
  finally { btn.disabled = false; btn.textContent = "Use an image as icon"; }
};
$("#edImgClear").onclick = () => { edAsset = null; edData = null; $("#edImgClear").hidden = true; updateMini(); sfx("back"); };

