/* ================= workflow sessions ================= */
const SES_KEY = "studio-menu-session";
let session = null, sesTimer = null;
function startSession(f, projectId) {
  session = { flowId: f.id, done: [0], start: Date.now(), project: projectId || "", checked: {} };
  persistSession(); renderSession(); sfx("ignite", 0, tileWorld(f));
  toast("Session started: " + f.name);
}
function persistSession() { try { if (session) localStorage.setItem(SES_KEY, JSON.stringify(session)); else localStorage.removeItem(SES_KEY); } catch {} }
function endSession(done) {
  if (!session) return;
  const f = byId(session.flowId);
  if (done && f) { sfx("complete", 0, tileWorld(f)); finishSession(session, f); }
  else sfx("back");
  session = null; persistSession(); renderSession(); renderSesPanel();
}
function renderSession() {
  const dock = $("#session"), f = session && byId(session.flowId);
  if (!f) { dock.hidden = true; document.body.classList.remove("in-session"); clearInterval(sesTimer); sesTimer = null; if (session) { session = null; persistSession(); } return; }
  const steps = flowSteps(f);
  dock.hidden = false; document.body.classList.add("in-session");
  cardGlyph($("#sesIcon"), f); $("#sesName").textContent = f.name;
  const box = $("#sesSteps"); box.innerHTML = "";
  const nextIdx = steps.findIndex((_, i) => !session.done.includes(i));
  steps.forEach((st, i) => {
    const a = document.createElement("a"); a.className = "ses-step" + (session.done.includes(i) ? " done" : "") + (i === nextIdx ? " next" : "");
    a.href = st.ch.url; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.style.setProperty("--ch", st.ch.hue); a.dataset.tip = (i + 1) + ". " + st.ch.name + (st.note ? ": " + st.note : "");
    a.setAttribute("aria-label", a.dataset.tip); cardGlyph(a, st.ch);
    a.onclick = () => markStep(i);
    box.appendChild(a);
  });
  const nx = $("#sesNext");
  if (nextIdx >= 0) {
    nx.href = steps[nextIdx].ch.url; nx.target = "_blank"; nx.textContent = "Open next: " + steps[nextIdx].ch.name;
    nx.dataset.idx = nextIdx;
  } else {
    nx.removeAttribute("href"); nx.removeAttribute("target"); nx.textContent = "Finish session"; nx.dataset.idx = "done";
  }
  const total = steps.reduce((a, st) => a + (st.checks || []).length, 0), ticked = Object.keys(session.checked || {}).length;
  $("#sesChecks").hidden = !total;
  $("#sesChecks").textContent = "Checklist " + ticked + "/" + total;
  renderSesPanel();
  updateSesTime();
  if (!sesTimer) sesTimer = setInterval(updateSesTime, 1000);
}
function markStep(i) {
  if (!session) return;
  if (!session.done.includes(i)) session.done.push(i);
  const st = flowSteps(byId(session.flowId) || {})[i]; if (st) noteOpen(st.ch);
  persistSession(); sfx("step", i, tileWorld(byId(session.flowId)));
  setTimeout(renderSession, 0);
}
function updateSesTime() {
  if (!session) return;
  const sec = Math.floor((Date.now() - session.start) / 1000), h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s2 = sec % 60;
  $("#sesTime").textContent = (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s2).padStart(2, "0");
}
$("#sesNext").onclick = e => {
  const idx = e.currentTarget.dataset.idx;
  if (idx === "done") { e.preventDefault(); endSession(true); } else markStep(+idx);
};
$("#sesEnd").onclick = () => { tip.classList.remove("show"); endSession(false); };
$("#session").addEventListener("pointerover", e => { const a = e.target.closest(".ses-step,.pill"); if (a && !a.contains(e.relatedTarget)) sfx("tick"); });
try { session = JSON.parse(localStorage.getItem(SES_KEY)); } catch { session = null; }

