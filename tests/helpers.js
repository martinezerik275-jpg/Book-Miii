import { expect } from "@playwright/test";

export const OWNER = { uid: "u_owner", name: "Erik Martinez", level: "owner" };
export const MAYA = { uid: "u_maya", name: "Maya Chen", level: "interact" };
export const LEO = { uid: "u_leo", name: "Leo Park", level: "view" };

export const seedMenu = () => ({
  rev: 3,
  pages: [{ id: "p1", name: "Home" }],
  channels: [
    { id: "c1", name: "Texturelabs", url: "https://texturelabs.org", desc: "Free textures", tags: ["textures", "free"], notes: "login: erik", hue: 30, page: "p1", slot: 0 },
    { id: "c2", name: "Blender Docs", url: "https://docs.blender.org", desc: "Manual", tags: ["blender", "docs"], hue: 200, page: "p1", slot: 1 },
    { id: "c3", name: "Artlist", url: "https://artlist.io", desc: "Music", tags: ["music"], hue: 320, page: "p1", slot: 2 },
  ],
  audio: { music: null, musicName: "", sfx: {}, sfxNames: {}, musicVol: 0.4, sfxVol: 0.7, musicOn: false, tune: true, pauseHidden: true },
  theme: "light", lighting: false, idle: { on: false, mins: 5 }, sound: { worlds: {}, follow: true },
  backdrop: { asset: null, kind: "image", name: "", fit: "cover", dim: 0.25, blur: 0, lines: true },
});

export async function reset(request, docs = {}) {
  await request.post("/mock/reset", { data: { docs } });
}
export async function docs(request) { return (await request.get("/mock/docs")).json(); }

// Open the page as one person in their own browser context (own storage, own peer).
const open = [];
export async function closeAll() { while (open.length) await open.pop().close(); }
export async function openAs(browser, who, { viewport } = {}) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 800 } });
  open.push(ctx);
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", e => page.errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/favicon|fonts\.g/.test(m.text())) page.errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.addInitScript(cfg => { window.__MOCK = cfg; }, who);
  await page.addInitScript({ path: new URL("./harness/claude-mock.js", import.meta.url).pathname });
  await page.goto("/?test");
  await page.click("#beginBtn");
  if (who.uid) await expect.poll(() => page.evaluate(() => window.__sm && window.__sm.me.id)).toBe(who.uid);
  return page;
}
export const tiles = page => page.locator(".page.current .slot.tile");
