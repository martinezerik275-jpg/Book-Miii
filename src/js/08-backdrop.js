/* ================= custom backdrop ================= */
const bdSrc = b => b.asset ? "/_blob/" + b.asset : (b.data || "");
let bdShown = "";          // what's loaded in the page layer, so a settings change doesn't reload the file
function paintBackdrop(media, dim, b, isPreview) {
  const src = bdSrc(b), key = b.kind + "|" + src;
  if (media.dataset.key !== key) {
    media.dataset.key = key; media.innerHTML = ""; media.style.backgroundImage = "";
    if (src && b.kind === "video") {
      const v = document.createElement("video");
      v.src = src; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = !reduceMotion; v.setAttribute("aria-hidden", "true");
      media.appendChild(v); if (!reduceMotion && !document.hidden) v.play().catch(() => {});
    } else if (src) media.style.backgroundImage = `url("${src}")`;
  }
  const v = media.querySelector("video");
  if (v) v.style.objectFit = b.fit === "contain" ? "contain" : "cover";
  else {
    media.style.backgroundSize = b.fit === "tile" ? "auto" : b.fit;
    media.style.backgroundRepeat = b.fit === "tile" ? "repeat" : "no-repeat";
  }
  const blur = isPreview ? b.blur * 0.4 : b.blur;
  media.style.setProperty("--bd-blur", blur + "px");
  media.style.setProperty("--bd-scale", blur ? 1 + blur / 120 + 0.02 : 1);
  dim.style.setProperty("--bd-dim", b.dim);
}
function applyBackdrop() {
  const b = state.backdrop, on = !!bdSrc(b);
  document.body.classList.toggle("has-bd", on);
  document.body.classList.toggle("bd-lines", on && b.lines);
  if (on) paintBackdrop($("#bdMedia"), $("#backdrop .bd-dim"), b, false);
  else { $("#bdMedia").innerHTML = ""; $("#bdMedia").style.backgroundImage = ""; $("#bdMedia").dataset.key = ""; }
  if ($("#bdSheet").classList.contains("open")) renderBackdropSheet();
}
function renderBackdropSheet() {
  const b = state.backdrop, on = !!bdSrc(b);
  $("#bdEmpty").hidden = on;
  const pm = $("#bdPrevMedia");
  if (on) paintBackdrop(pm, $("#bdPrevDim"), b, true); else { pm.innerHTML = ""; pm.style.backgroundImage = ""; pm.dataset.key = ""; $("#bdPrevDim").style.setProperty("--bd-dim", 0); }
  $("#bdPreview").classList.toggle("lines", on && b.lines);
  $("#bdRemove").hidden = !on;
  $("#bdControls").style.opacity = on ? 1 : .45; $("#bdControls").style.pointerEvents = on ? "" : "none";
  [...$("#bdFit").children].forEach(x => { x.classList.toggle("on", x.dataset.v === b.fit); x.disabled = b.kind === "video" && x.dataset.v === "tile"; });
  $("#bdDim").value = b.dim; $("#bdBlur").value = b.blur; $("#bdLines").checked = !!b.lines;
  $("#bdPick").textContent = on ? "Replace file" : "Import file";
  if (!$("#bdStatus").dataset.busy) $("#bdStatus").textContent = on ? (b.name || "Custom backdrop") : "";
}
function openBackdrop() { renderBackdropSheet(); show("#bdSheet"); sfx("select"); }
async function setBackdropFile(f) {
  if (!f) return;
  const isVideo = /^video\//.test(f.type) || /\.(mp4|webm)$/i.test(f.name);
  const isImage = /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|svg)$/i.test(f.name);
  if (!isVideo && !isImage) { sfx("error"); toast("Use an image (PNG, JPG, WebP, GIF) or a video (MP4, WebM)."); return; }
  if (f.size > 20 * 1024 * 1024) { sfx("error"); toast("That file is over 20 MB. Export a smaller version and try again."); return; }
  const st = $("#bdStatus"); st.dataset.busy = "1"; st.textContent = "Uploading " + f.name + "…";
  $("#bdPick").disabled = true;
  try {
    if (assets) {
      const r = await assets.upload(f);
      state.backdrop.asset = r.id; delete state.backdrop.data;
    } else {
      if (isVideo) throw new Error("novideo");
      state.backdrop.data = await shrinkImage(f, 1100); state.backdrop.asset = null;
    }
    state.backdrop.kind = isVideo ? "video" : "image"; state.backdrop.name = f.name;
    if (isVideo && state.backdrop.fit === "tile") state.backdrop.fit = "cover";
    save(); applyBackdrop(); sfx("complete"); toast("Backdrop set");
  } catch (e) {
    sfx("error");
    toast(e && e.message === "novideo" ? "Video backdrops need cloud storage. Open the menu from its claude.ai link." : "Couldn't upload that file. Try a different image or a smaller video.");
  } finally { delete st.dataset.busy; $("#bdPick").disabled = false; renderBackdropSheet(); }
}
$("#bdBtn").onclick = openBackdrop;
$("#stBackdrop").onclick = () => { hide("#settings"); openBackdrop(); };
$("#bdClose").onclick = () => { hide("#bdSheet"); sfx("back"); };
$("#bdSheet").addEventListener("click", e => { if (e.target.id === "bdSheet") { hide("#bdSheet"); sfx("back"); } });
$("#bdPick").onclick = () => $("#bdFile").click();
$("#bdFile").onchange = e => { const f = e.target.files[0]; e.target.value = ""; setBackdropFile(f); };
$("#bdRemove").onclick = () => {
  state.backdrop.asset = null; delete state.backdrop.data; state.backdrop.name = "";
  save(); applyBackdrop(); sfx("back"); toast("Backdrop removed");
};
$("#bdFit").onclick = e => { const x = e.target.closest("button"); if (!x || x.disabled) return; state.backdrop.fit = x.dataset.v; applyBackdrop(); save(); sfx("tick"); };
$("#bdDim").oninput = e => { state.backdrop.dim = +e.target.value; applyBackdrop(); };
$("#bdBlur").oninput = e => { state.backdrop.blur = +e.target.value; applyBackdrop(); };
$("#bdDim").onchange = save; $("#bdBlur").onchange = save;
$("#bdLines").onchange = e => { state.backdrop.lines = e.target.checked; applyBackdrop(); save(); };
const bdPrev = $("#bdPreview");
bdPrev.addEventListener("dragover", e => { if (hasFiles(e)) { e.preventDefault(); bdPrev.classList.add("over"); } });
bdPrev.addEventListener("dragleave", () => bdPrev.classList.remove("over"));
bdPrev.addEventListener("drop", e => {
  if (!hasFiles(e)) return; e.preventDefault(); e.stopPropagation(); bdPrev.classList.remove("over");
  setBackdropFile(e.dataTransfer.files[0]);
});
bdPrev.addEventListener("click", () => { if (!bdSrc(state.backdrop)) $("#bdFile").click(); });
document.addEventListener("visibilitychange", () => {
  const v = $("#bdMedia video"); if (!v) return;
  if (document.hidden) v.pause(); else if (!reduceMotion) v.play().catch(() => {});
});

