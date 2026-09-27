const $ = (s, r = document) => r.querySelector(s);
const PER = 12;
const LS_KEY = "studio-menu-v1";
const uid = () => Math.random().toString(36).slice(2, 10);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let state, page = 0, editMode = false;
let db = null, ref = null, assets = null, sample = null, downloads = null;
let saveTimer = null, saving = false, gotRemote = false;

