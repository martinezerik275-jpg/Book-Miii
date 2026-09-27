/* ================= onboarding: welcome, tours, check-in ================= */
// Progress lives in this browser and, for signed-in people, in the private
// data/users/<id>/onboarding doc, so a second device doesn't start over.
const WHATS_NEW = 1;          // bump when a release deserves a new "what's new" tour
const ONB_FLAGS = ["avatar", "plaza", "say", "visit", "stamp"];
const PAWS_SVG = `<svg viewBox="0 0 120 120" role="img"><path d="M26 52c-12 6-15 30-6 38 7 6 14-2 14-12z" fill="#C77B4A"/><path d="M94 52c12 6 15 30 6 38-7 6-14-2-14-12z" fill="#C77B4A"/><path d="M28 118c4-16 16-24 32-24s28 8 32 24z" fill="#F7F9FB" stroke="#D3DAE1" stroke-width="2"/><path d="M44 96c-2 10 4 16 10 16" fill="none" stroke="#4A5160" stroke-width="3" stroke-linecap="round"/><circle cx="55" cy="112" r="4" fill="#CFD6DE"/><circle cx="60" cy="62" r="38" fill="#F6D2A2"/><path d="M24 52c8-20 64-20 72 0" fill="none" stroke="#5C6470" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="32" r="12" fill="#E6EDF4" stroke="#9AA6B2" stroke-width="3"/><ellipse cx="56" cy="28" rx="4" ry="2.5" fill="#fff"/><ellipse cx="60" cy="80" rx="19" ry="14" fill="#FFF1DE"/><ellipse cx="60" cy="72" rx="7" ry="5" fill="#2B2A33"/><path d="M38 60q6-8 12 0M70 60q6-8 12 0" fill="none" stroke="#2B2A33" stroke-width="4" stroke-linecap="round"/><path d="M53 85q7 6 14 0" fill="none" stroke="#2B2A33" stroke-width="3" stroke-linecap="round"/><circle cx="34" cy="74" r="6" fill="#FF8FA6" opacity=".55"/><circle cx="86" cy="74" r="6" fill="#FF8FA6" opacity=".55"/></svg>`;
document.querySelectorAll(".paws").forEach(el => { el.innerHTML = PAWS_SVG; });

const onbBlank = () => ({ welcomed: 0, whatsNew: 0, flags: {}, hideList: false, reward: 0 });
let onb = onbBlank(), onbRef = null, onbLoaded = false, identityReady = false, onbShown = false, onbSaveT = null;
const onbKey = () => "studio-menu-onboard:" + (me.id || "anon");
function loadLocalOnb() {
  onb = onbBlank();
  try { mergeOnb(JSON.parse(localStorage.getItem(onbKey()))); } catch {}
}
function mergeOnb(o) {
  if (!o || typeof o !== "object") return;
  ["welcomed", "whatsNew", "reward"].forEach(k => { onb[k] = Math.max(+onb[k] || 0, +o[k] || 0); });
  onb.hideList = onb.hideList || o.hideList === true;
  const f = o.flags && typeof o.flags === "object" ? o.flags : {};
  ONB_FLAGS.forEach(k => { if (+f[k]) onb.flags[k] = Math.max(+onb.flags[k] || 0, +f[k]); });
}
// `now`: write straight away (finishing the welcome or tour is when people tend to leave)
function saveOnb(now) {
  try { localStorage.setItem(onbKey(), JSON.stringify(onb)); } catch {}
  if (!onbRef || me.canWrite === false) return;
  clearTimeout(onbSaveT);
  const write = () => onbRef.set(JSON.parse(JSON.stringify(onb))).catch(() => {});
  if (now) write(); else onbSaveT = setTimeout(write, 600);
}
function loadOnboarding() {
  loadLocalOnb();
  if (!db || !me.id) { onbLoaded = true; renderCheckin(); maybeOnboard(); return; }
  onbRef = db.doc("data/users/" + me.id + "/onboarding");
  onbRef.get().then(s => { if (s.exists) mergeOnb(s.data()); }).catch(() => {})
    .finally(() => { onbLoaded = true; try { localStorage.setItem(onbKey(), JSON.stringify(onb)); } catch {} renderCheckin(); maybeOnboard(); });
}
function onbFlag(k) {
  if (onb.flags[k]) return;
  onb.flags[k] = Date.now(); saveOnb(); renderCheckin();
  if ($("#welcome").classList.contains("open")) renderWelcome();
}
const mineNow = () => (visiting ? homeState : state);
const studioName = () => (hubOwner ? spaceTitle(hubOwner) : "the studio");
const ownerFirst = () => (hubOwner && personName(hubOwner, "").split(" ")[0]) || "the owner";

// Decide what a person sees the first time they arrive.
function maybeOnboard() {
  if (onbShown || !identityReady || !onbLoaded || $("#start").classList.contains("open")) return;
  onbShown = true;
  if (me.isOwner) { if ((onb.whatsNew || 0) < WHATS_NEW) setTimeout(() => runTour("whatsnew"), 350); return; }
  if (onb.welcomed) return;
  if (!mayWrite()) { openWelcome("guest"); return; }
  const mine = mineNow();
  // someone who already built a space before the welcome existed gets the short tour instead
  if (mine && mine.channels.length >= 3) { onb.welcomed = Date.now(); saveOnb(); setTimeout(() => runTour("whatsnew"), 350); return; }
  openWelcome("newcomer");
}
function replayWelcome() {
  hide("#keys"); hide("#people");
  onb.welcomed = 0; onb.hideList = false; saveOnb();
  if (me.isOwner) runTour("whatsnew");
  else openWelcome(mayWrite() ? "newcomer" : "guest");
}
$("#kReplay").onclick = replayWelcome;
$("#ppReplay").onclick = replayWelcome;

/* ---------- welcome wizard ---------- */
const WC_STEPS = { newcomer: ["hello", "look", "space", "channels", "done"], guest: ["guest"] };
let wc = { mode: "newcomer", i: 0, picks: null };
function openWelcome(mode) {
  wc = { mode, i: 0, picks: null };
  const card = myCard(), c = (card && card.card) || {};
  $("#wcName").value = c.title || (me.name ? me.name.split(" ")[0] + "’s studio" : "");
  $("#wcBlurb").value = c.blurb || "";
  $("#wcListed").checked = c.listed !== false;
  $("#wcAddMsg").textContent = ""; $("#wcUrl").value = "";
  renderWelcome(); show("#welcome"); sfx("open");
  setTimeout(() => $("#wcNextBtn").focus(), 60);
}
function renderWelcome() {
  const steps = WC_STEPS[wc.mode], step = steps[wc.i], last = wc.i === steps.length - 1;
  document.querySelectorAll("#welcome .wc-step").forEach(s => { s.hidden = s.dataset.step !== step; });
  const T2 = {
    hello: ["Welcome to " + studioName(), "I'm Dr. Paws. Everyone here gets their own space for bookmarks, an animal avatar, and a spot in the plaza. Let's get you checked in. It takes about a minute."],
    look: ["First, your look", "This is you in the plaza. Pick an animal, scrubs and a hat in the Avatar Clinic, or keep the one I picked."],
    space: ["Now, your space", "Your space is your own menu of channels. Give it a name so neighbors know whose it is."],
    channels: ["Add a few channels", hubOwner !== me.id ? "Tap any of " + ownerFirst() + "’s channels to copy it into your space, or paste a link of your own." : "Paste links to the sites you use most."],
    done: ["You're checked in!", "Here's where to go next. The check-in card in the corner ticks things off as you try them."],
    guest: ["Welcome to " + studioName(), "I'm Dr. Paws. You're visiting, so here's what you can do."],
  }[step];
  $("#wcTitle").textContent = T2[0]; $("#wcLead").textContent = T2[1];
  const dots = $("#wcDots"); dots.innerHTML = "";
  if (steps.length > 1) steps.forEach((_, i) => { const d = document.createElement("i"); d.className = i === wc.i ? "on" : i < wc.i ? "past" : ""; dots.appendChild(d); });
  $("#wcCount").textContent = steps.length > 1 ? `Step ${wc.i + 1} of ${steps.length}` : "";
  $("#wcBack").hidden = wc.i === 0;
  $("#wcSkip").hidden = last && wc.mode === "newcomer";
  $("#wcSkip").textContent = wc.mode === "guest" ? "Close" : "Skip for now";
  $("#wcNextBtn").textContent = step === "hello" ? "Start check-in" : step === "done" ? "Finish" : step === "guest" ? (room ? "Walk the plaza" : "Look around") : "Next";
  if (step === "look") {
    const a = myAvatar();
    paintChip($("#wcChip"), a);
    $("#wcLookName").textContent = (a.nick || "Your") + " " + SPECIES[a.s].n.toLowerCase();
    $("#wcLookHint").textContent = onb.flags.avatar ? "Looking good. You can change it any time." : "Picked at random to start.";
  }
  if (step === "channels") renderPicks();
  if (step === "done") renderNextList();
  if (step === "guest") $("#wcGuestAsk").textContent = "Ask " + ownerFirst() + " to share this menu with you as a Contributor. Then your space and avatar are saved here.";
}
function closeWelcome() {
  hide("#welcome");
  if (!onb.welcomed) { onb.welcomed = Date.now(); saveOnb(true); }
  renderCheckin(true);
}
$("#wcSkip").onclick = () => { closeWelcome(); sfx("back"); };
$("#wcBack").onclick = () => { if (wc.i > 0) { wc.i--; renderWelcome(); sfx("back"); } };
$("#wcNextBtn").onclick = async () => {
  const steps = WC_STEPS[wc.mode], step = steps[wc.i];
  if (step === "space") {
    const btn = $("#wcNextBtn"); btn.disabled = true;
    const mine = mineNow();
    try {
      await saveMyCard({ avatar: encodeAvatar(myAvatar()), card: { title: $("#wcName").value.trim(), blurb: $("#wcBlurb").value.trim(), listed: $("#wcListed").checked,
        tiles: mine.channels.length, hue: (mine.channels[0] && mine.channels[0].hue) || 200 } });
      renderPeopleList(); if (plaza) plaza.rebuildHouses();
    } catch { toast("Couldn't save your space's name. You can set it later under People."); }
    finally { btn.disabled = false; }
  }
  if (step === "guest") { closeWelcome(); if (room) openPlaza(); return; }
  if (wc.i === steps.length - 1) { closeWelcome(); sfx("complete"); return; }
  wc.i++; renderWelcome(); sfx("select");
};
$("#wcClinic").onclick = () => openClinic();

// channels step: one-tap copies from the owner's space, or paste a link
async function renderPicks() {
  const box = $("#wcPicks"), mine = mineNow();
  const have = new Set(mine.channels.map(c => c.url));
  $("#wcPickHint").textContent = mine.channels.length ? mine.channels.length + (mine.channels.length === 1 ? " channel" : " channels") + " in your space so far." : "";
  if (wc.picks === null) {
    wc.picks = [];
    box.innerHTML = '<p class="hint">Loading…</p>';
    if (db && hubOwner !== me.id) {
      try {
        const s = await db.doc("menu/main").get();          // the owner's space, even before hub/info has loaded
        if (s.exists) wc.picks = normalize(JSON.parse(JSON.stringify(s.data()))).channels.filter(c => c.kind !== "flow" && c.url).slice(0, 12);
      } catch {}
    }
  }
  box.innerHTML = "";
  box.hidden = !wc.picks.length;
  wc.picks.forEach(c => {
    const b = document.createElement("button"); b.type = "button"; b.className = "wc-pick";
    const added = have.has(c.url);
    b.classList.toggle("on", added); b.setAttribute("aria-pressed", added);
    const m = document.createElement("div"); m.className = "mini"; const sc = document.createElement("div"); sc.className = "screen"; fillScreen(sc, c); m.appendChild(sc);
    const n = document.createElement("span"); n.textContent = c.name;
    b.append(m, n);
    b.onclick = () => { if (added) return; addToMine(c); sfx("hover", wc.picks.indexOf(c) % PER, tileWorld(c)); renderPicks(); };
    box.appendChild(b);
  });
}
function addToMine(c) {
  const mine = mineNow();
  copyChannelInto(mine, c);
  const n = normalize(mine);
  if (visiting) homeState = n; else state = n;
  persist(n); if (!visiting) render();
}
$("#wcAdd").onsubmit = e => {
  e.preventDefault();
  let url = $("#wcUrl").value.trim(); if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  let host = ""; try { const u = new URL(url); if (/\./.test(u.hostname)) host = u.hostname.replace(/^www\./, ""); } catch {}
  if (!host) { $("#wcAddMsg").textContent = "That doesn't look like a link. Try something like polyhaven.com."; sfx("error"); return; }
  if (mineNow().channels.some(c => c.url === url)) { $("#wcAddMsg").textContent = "That one's already in your space."; return; }
  const word = host.split(".")[0];
  addToMine({ name: word.charAt(0).toUpperCase() + word.slice(1), url, hue: Math.floor(Math.random() * 360), tags: [] });
  $("#wcUrl").value = ""; $("#wcAddMsg").textContent = "Added " + host + ". Rename it later in edit mode.";
  sfx("confirm"); renderPicks();
};
function renderNextList() {
  const box = $("#wcNext"); box.innerHTML = "";
  const items = [
    room && ["Walk into the plaza", "Meet whoever is around. Dr. Paws is by the clinic.", () => { closeWelcome(); openPlaza(); }],
    ["Take a quick tour", "See what each button on the menu does.", () => { closeWelcome(); runTour("menu"); }],
    ["Browse neighbors", "Visit other people's spaces and leave a stamp.", () => { closeWelcome(); openPeople("neighbors"); }],
  ].filter(Boolean);
  items.forEach(([t, s, go]) => {
    const li = document.createElement("li"), b = document.createElement("button"); b.type = "button"; b.className = "wc-go";
    const bt = document.createElement("b"); bt.textContent = t; const sp = document.createElement("span"); sp.textContent = s;
    b.append(bt, sp); b.onclick = () => { sfx("select"); go(); };
    li.appendChild(b); box.appendChild(li);
  });
}

/* ---------- spotlight tour ---------- */
const TOURS = {
  whatsnew: [
    { title: "Your menu grew a neighborhood", body: "Everyone who opens this menu now gets their own space, and there's a 3D plaza to meet in. Here's a quick look." },
    { el: "#peopleBtn", title: "People", body: "Neighbors' spaces, your stamp book, your status and focus timer, and your space's name." },
    { el: "#plazaBtn", title: "The plaza", body: "Walk around as an animal, chat and emote with whoever is here. The badge shows how many people are in it now." },
    { el: "#editBtn", title: "Your channels, same as before", body: "Editing, workflows, logos and backdrops work like they used to. Channel notes are private now: only you can read them." },
    { title: "One last thing", body: "Pick your animal before you head out. The check-in card in the corner tracks the rest.", action: ["Open the Avatar Clinic", () => openClinic()] },
  ],
  menu: [
    { el: "#editBtn", title: "Edit your space", body: "Turn on edit mode to add channels, drag tiles around, or build a workflow." },
    { el: "#searchBtn", title: "Search", body: "Find any channel by name, tag or note. Press / from anywhere." },
    { el: "#plazaBtn", title: "The plaza", body: "Walk around, chat and emote with whoever is here. Press P to jump in." },
    { el: "#peopleBtn", title: "People", body: "Visit neighbors, read your stamp book, and set your status or focus timer." },
    { el: "#settingsBtn", title: "Settings", body: "Music, sound effects, theme, backdrop and pages." },
  ],
};
let tour = null;
const visibleEl = el => el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).display !== "none";
function runTour(name) {
  const steps = TOURS[name].filter(s => !s.el || visibleEl($(s.el)));
  if (!steps.length) return;
  tour = { name, steps, i: 0 };
  show("#tour"); renderTour(); sfx("select");
}
function renderTour() {
  const s = tour.steps[tour.i], n = tour.steps.length, last = tour.i === n - 1;
  $("#trTitle").textContent = s.title; $("#trBody").textContent = s.body;
  $("#trCount").textContent = n > 1 ? `${tour.i + 1} of ${n}` : "";
  $("#trBack").hidden = tour.i === 0;
  $("#trSkip").hidden = last;
  $("#trNext").textContent = last ? (s.action ? s.action[0] : "Done") : "Next";
  const spot = $("#trSpot"), bub = $("#trBubble"), el = s.el && $(s.el);
  $("#tour").classList.toggle("centered", !el);
  if (el) {
    const r = el.getBoundingClientRect(), pad = 8, round = el.classList.contains("round");
    Object.assign(spot.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px", borderRadius: round ? "50%" : "22px" });
    spot.hidden = false;
    const bw = Math.min(360, innerWidth - 32), below = r.top < innerHeight / 2;
    bub.style.width = bw + "px";
    bub.style.left = Math.max(16, Math.min(innerWidth - bw - 16, r.left + r.width / 2 - bw / 2)) + "px";
    bub.style.top = below ? r.bottom + pad + 14 + "px" : "";
    bub.style.bottom = below ? "" : innerHeight - r.top + pad + 14 + "px";
  } else {
    spot.hidden = true;
    Object.assign(bub.style, { width: Math.min(420, innerWidth - 32) + "px", left: "", top: "", bottom: "" });
  }
  setTimeout(() => $("#trNext").focus({ preventScroll: true }), 30);
}
function endTour(completed) {
  if (!tour) return;
  const t = tour, s = t.steps[t.i]; tour = null;
  hide("#tour");
  if (t.name === "whatsnew") { onb.whatsNew = WHATS_NEW; if (!onb.welcomed) onb.welcomed = Date.now(); saveOnb(true); renderCheckin(true); }
  sfx(completed ? "confirm" : "back");
  if (completed && s.action) s.action[1]();
}
$("#trNext").onclick = () => { if (tour.i < tour.steps.length - 1) { tour.i++; renderTour(); sfx("tick"); } else endTour(true); };
$("#trBack").onclick = () => { if (tour.i > 0) { tour.i--; renderTour(); sfx("tick"); } };
$("#trSkip").onclick = () => endTour(false);
$("#tour").addEventListener("keydown", e => {
  if (e.key === "ArrowRight") { e.preventDefault(); $("#trNext").click(); }
  else if (e.key === "ArrowLeft" && tour && tour.i > 0) { e.preventDefault(); $("#trBack").click(); }
});
addEventListener("resize", () => { if (tour) renderTour(); });

/* ---------- check-in card ---------- */
const CI_OPEN_KEY = "studio-menu-checkin-open";
function checklist() {
  const saver = mayWrite(), card = myCard(), mine = mineNow();
  return [
    { k: "avatar", t: "Make your avatar", done: !!(card && card.avatar) || !!onb.flags.avatar, go: () => openClinic() },
    saver && { k: "space", t: "Name your space", done: !!(card && card.card && card.card.title), go: () => openPeople("me") },
    saver && { k: "channels", t: "Add 3 channels", done: !!mine && mine.channels.length >= 3, go: () => { if (visiting) goHome(true); const pid = state.pages[page].id; openEditor(null, pid, firstFree(pid)); } },
    room && { k: "plaza", t: "Walk into the plaza", done: !!onb.flags.plaza, go: openPlaza },
    room && { k: "say", t: "Say hi in the plaza", done: !!onb.flags.say, go: openPlaza },
    db && { k: "visit", t: "Visit a neighbor's space", done: !!onb.flags.visit, go: () => openPeople("neighbors") },
    saver && { k: "stamp", t: "Leave a stamp on a space", done: !!onb.flags.stamp, go: () => openPeople("neighbors") },
  ].filter(Boolean);
}
function renderCheckin(expand) {
  const box = $("#checkin");
  const on = !!onb.welcomed && !onb.hideList && identityReady;
  box.hidden = !on; document.body.classList.toggle("has-checkin", on);
  if (!on) return;
  const items = checklist(), done = items.filter(i => i.done).length, all = done === items.length;
  if (expand === true) try { localStorage.setItem(CI_OPEN_KEY, "1"); } catch {}
  let open = innerWidth > 560; try { const v = localStorage.getItem(CI_OPEN_KEY); if (v !== null) open = v === "1"; } catch {}
  box.classList.toggle("open", open); $("#ciToggle").setAttribute("aria-expanded", open);
  $("#ciCount").textContent = done + "/" + items.length;
  $("#ciBar").style.width = (100 * done / items.length) + "%";
  const list = $("#ciList"); list.innerHTML = "";
  items.forEach(it => {
    const li = document.createElement("li"); li.className = it.done ? "done" : "";
    const b = document.createElement("button"); b.type = "button"; b.textContent = it.t; b.disabled = it.done;
    b.setAttribute("aria-label", it.t + (it.done ? ", done" : ""));
    b.onclick = () => { sfx("select"); it.go(); };
    li.appendChild(b); list.appendChild(li);
  });
  list.hidden = all; $("#ciDone").hidden = !all;
  if (all && !onb.reward) {
    onb.reward = Date.now(); saveOnb();
    sfx("complete"); toast("All checked in! The graduation cap is in the Avatar Clinic.");
  }
}
$("#ciToggle").onclick = () => {
  const open = !$("#checkin").classList.contains("open");
  try { localStorage.setItem(CI_OPEN_KEY, open ? "1" : "0"); } catch {}
  renderCheckin(); sfx("tick");
};
$("#ciHide").onclick = () => { onb.hideList = true; saveOnb(); renderCheckin(); sfx("back"); };
$("#ciWear").onclick = () => openClinic({ h: "grad" });
