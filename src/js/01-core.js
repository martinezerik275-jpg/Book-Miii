const $ = (s, r = document) => r.querySelector(s);
const PER = 12;
const LS_KEY = "studio-menu-v1";
const uid = () => Math.random().toString(36).slice(2, 10);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let state, page = 0, editMode = false;
let db = null, ref = null, assets = null, sample = null, downloads = null;
let saveTimer = null, saving = false, gotRemote = false;

/* ---------- identity + social state (see docs/ARCHITECTURE.md) ---------- */
const TEST = /[?&]test\b/.test(location.search);   // local test host only; never true on claude.ai
const ME_KEY = "studio-menu-me";
let user = null, room = null, privRef = null, privData = { notes: {}, fields: {} }, privLoaded = false;
// me.canWrite: true/false once the platform says, null when it said nothing
const me = { id: null, isOwner: false, canWrite: null, name: "" };
let hubOwner = null;                        // the artifact owner's id; their space lives at menu/main
let visiting = null, homeState = null;      // while visiting, `state` is theirs and `homeState` is mine
let people = {};                            // people/<id> cards, live
let peersNow = [];                          // everyone with the page open right now (room)
