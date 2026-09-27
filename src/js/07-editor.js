/* ================= editor ================= */
let edTarget = null, edPid = null, edSlot = 0, edAsset = null, edData = null, edKind = "channel", edSteps = [], edStyle = "color", edBg = null;
function setEdKind(k) {
  edKind = k; $("#edForm").dataset.kind = k;
  [...$("#edKind").children].forEach(b => b.classList.toggle("on", b.dataset.v === k));
  const isNew = !edTarget;
  $("#edTitle").textContent = (isNew ? "Add " : "Edit ") + (k === "flow" ? "workflow" : "channel");
  $("#edSave").textContent = k === "flow" ? "Save workflow" : "Save channel";
  $("#edDescLbl").textContent = k === "flow" ? "What this session is for" : "What it's for";
  if (k === "flow" && !edSteps.length) edSteps = [{ ch: "", note: "" }, { ch: "", note: "" }];
  renderEdSteps(); updateWorldLine();
}
$("#edKind").onclick = e => { const b = e.target.closest("button"); if (b) { setEdKind(b.dataset.v); sfx("tick"); } };
function channelOptions(sel, value) {
  sel.innerHTML = '<option value="">Choose a site…</option>';
  state.pages.forEach(p => {
    const chs = state.channels.filter(c => c.page === p.id && c.kind !== "flow").sort((a, b) => a.slot - b.slot);
    if (!chs.length) return;
    const g = document.createElement("optgroup"); g.label = p.name;
    chs.forEach(c => { const o = document.createElement("option"); o.value = c.id; o.textContent = c.name; g.appendChild(o); });
    sel.appendChild(g);
  });
  sel.value = value || "";
}
function renderEdSteps() {
  const box = $("#edSteps"); box.innerHTML = "";
  edSteps.forEach((st, i) => {
    const r = document.createElement("div"); r.className = "step-row";
    const n = document.createElement("span"); n.className = "step-n"; n.textContent = i + 1;
    const sel = document.createElement("select"); sel.setAttribute("aria-label", "Site for step " + (i + 1)); channelOptions(sel, st.ch);
    sel.onchange = () => { st.ch = sel.value; updateWorldLine(); };
    const inp = document.createElement("input"); inp.type = "text"; inp.placeholder = "Note (optional)"; inp.maxLength = 80; inp.value = st.note || "";
    inp.setAttribute("aria-label", "Note for step " + (i + 1)); inp.oninput = () => { st.note = inp.value; };
    const up = document.createElement("button"); up.type = "button"; up.className = "x"; up.textContent = "↑"; up.setAttribute("aria-label", "Move step up"); up.disabled = i === 0;
    up.onclick = () => { edSteps.splice(i - 1, 0, edSteps.splice(i, 1)[0]); renderEdSteps(); sfx("tick"); };
    const del = document.createElement("button"); del.type = "button"; del.className = "x"; del.textContent = "✕"; del.setAttribute("aria-label", "Remove step");
    del.onclick = () => { edSteps.splice(i, 1); renderEdSteps(); sfx("back"); };
    r.append(n, sel, inp, up, del); box.appendChild(r);
  });
}
$("#edAddStep").onclick = () => { if (edSteps.length >= 8) { toast("A workflow can have up to 8 steps."); return; } edSteps.push({ ch: "", note: "" }); renderEdSteps(); sfx("select"); };
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
  $("#edTitle").textContent = c ? "Edit channel" : "Add channel";
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
  edSteps = c && c.kind === "flow" ? (c.steps || []).map(x => ({ ch: x.ch, note: x.note || "" })) : [];
  $("#edKind").hidden = !!c;
  setEdKind(c && c.kind === "flow" ? "flow" : "channel");
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
  if (!$("#edName").value.trim()) return formError(edKind === "flow" ? "Give the workflow a name." : "Give the channel a name.", $("#edName"));
  if (edKind === "flow") return saveFlow();
  let url = $("#edUrl").value.trim(); if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
  let okUrl = false; try { const u = new URL(url); okUrl = /\./.test(u.hostname) || u.hostname === "localhost"; } catch {}
  if (!okUrl) return formError("Add a link, like texturelabs.org or https://texturelabs.org.", $("#edUrl"));
  const data = {
    name: $("#edName").value.trim(), url, desc: $("#edDesc").value.trim(),
    tags: $("#edTags").value.split(",").map(t => t.trim()).filter(Boolean).slice(0, 8),
    notes: $("#edNotes").value.trim(), icon: $("#edIcon").value.trim(), hue: +$("#edHue").value, iconAsset: edAsset, iconData: edData, iconStyle: edStyle, iconBg: edBg
  };
  const newPid = $("#edPage").value;
  if (edTarget) {
    Object.assign(edTarget, data);
    if (newPid !== edTarget.page) { edTarget.page = newPid; edTarget.slot = firstFree(newPid); }
  } else {
    const pid = newPid; let slot = (pid === edPid && !chAt(pid, edSlot)) ? edSlot : firstFree(pid);
    state.channels.push(Object.assign({ id: uid(), page: pid, slot }, data));
  }
  state = normalize(state); save(); hide("#editor"); sfx("confirm"); render();
  const c = edTarget || state.channels[state.channels.length - 1]; goPage(pageOf(c), true);
  toast(edTarget ? "Channel saved" : "Channel added");
};
function saveFlow() {
  const steps = edSteps.filter(s => s.ch).map(s => ({ ch: s.ch, note: (s.note || "").trim() }));
  if (steps.length < 2) { formError("Pick at least two sites for the steps.", null); return; }
  const data = {
    kind: "flow", name: $("#edName").value.trim(), url: "", desc: $("#edDesc").value.trim(),
    tags: edTagList().slice(0, 8), notes: "", icon: $("#edIcon").value.trim(), hue: +$("#edHue").value,
    iconAsset: edAsset, iconData: edData, iconStyle: edStyle, iconBg: edBg, steps
  };
  const newPid = $("#edPage").value;
  if (edTarget) {
    Object.assign(edTarget, data);
    if (newPid !== edTarget.page) { edTarget.page = newPid; edTarget.slot = firstFree(newPid); }
  } else {
    const slot = (newPid === edPid && !chAt(newPid, edSlot)) ? edSlot : firstFree(newPid);
    state.channels.push(Object.assign({ id: uid(), page: newPid, slot }, data));
  }
  state = normalize(state); save(); hide("#editor"); sfx("confirm"); render();
  const c = edTarget || state.channels[state.channels.length - 1]; goPage(pageOf(c), true);
  toast(edTarget ? "Workflow saved" : "Workflow added");
}
function firstFree(pid) { for (let i = 0; i < PER; i++) if (!chAt(pid, i)) return i; return -1; }
$("#edDelete").onclick = () => {
  if (!edTarget) return;
  if (!confirm(`Delete "${edTarget.name}" from your menu?`)) return;
  state.channels = state.channels.filter(c => c !== edTarget);
  save(); hide("#editor"); sfx("back"); render(); toast("Channel deleted");
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

