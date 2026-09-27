import { test, expect } from "@playwright/test";
import { OWNER, MAYA, LEO, seedMenu, reset, docs, openAs, closeAll } from "./helpers.js";

test.beforeEach(async ({ request }) => { await reset(request, { "menu/main": seedMenu() }); });
test.afterEach(closeAll);

async function enterPlaza(page) {
  await page.click("#plazaBtn");
  await expect(page.locator("#pzLoading")).toBeHidden({ timeout: 30000 });
  await expect.poll(() => page.evaluate(() => window.__sm.plaza && window.__sm.plaza.running)).toBe(true);
}

test("two people meet in the plaza, chat and emote", async ({ browser }) => {
  const owner = await openAs(browser, OWNER);
  const maya = await openAs(browser, MAYA);
  await enterPlaza(owner);
  await expect(maya.locator("#plazaBadge")).toHaveText("1");          // she can see someone is there
  await enterPlaza(maya);
  await expect(owner.locator("#pzCount")).toHaveText("1 other person here");
  await expect(owner.locator(".pz-label b", { hasText: "Maya Chen" })).toBeVisible();

  // walking moves her avatar on the owner's screen
  const before = await owner.evaluate(() => [...window.__sm.plaza.others.values()][0].tz);
  await maya.locator("#pzCanvas").focus();
  // first visit: she arrives facing Dr. Paws and the clinic, so "forward" is south
  const z0 = await maya.evaluate(() => window.__sm.plaza.me3.z);
  await maya.keyboard.down("w"); await maya.waitForTimeout(1500); await maya.keyboard.up("w");
  const z1 = await maya.evaluate(() => window.__sm.plaza.me3.z);
  expect(z1).toBeGreaterThan(z0 + 0.3);
  await expect.poll(() => owner.evaluate(() => [...window.__sm.plaza.others.values()][0].tz)).toBeGreaterThan(before + 0.3);

  // chat bubble + log
  await maya.fill("#pzSay", "hi from the clinic!");
  await maya.press("#pzSay", "Enter");
  await expect(owner.locator(".pz-bubble", { hasText: "hi from the clinic!" })).toBeVisible();
  await expect(owner.locator("#pzLog")).toContainText("Maya Chen");

  // emote reaches the other side
  await maya.click("#pzEmotes [data-e=dance]");
  await expect.poll(() => owner.evaluate(() => { const o = [...window.__sm.plaza.others.values()][0]; return o.g.userData.emote && o.g.userData.emote.k; })).toBe("dance");

  await owner.screenshot({ path: "test-results/plaza-owner.png" });
  // leaving clears her from the owner's plaza
  await maya.click("#pzClose");
  await expect(owner.locator("#pzCount")).toHaveText("Just you so far");
  expect([...owner.errors, ...maya.errors]).toEqual([]);
});

test("avatar clinic saves a look that others see", async ({ browser, request }) => {
  const owner = await openAs(browser, OWNER);
  const maya = await openAs(browser, MAYA);
  await enterPlaza(owner);
  await maya.click("#peopleBtn"); await maya.click("#ppRail [data-tab=me]"); await maya.click("#ppAvatar");
  await maya.getByRole("button", { name: /Bunny/ }).click();
  await maya.click("#clHat button[data-v=nurse]");
  await maya.fill("#clNick", "Dr. Hops");
  await maya.screenshot({ path: "test-results/clinic.png" });
  await maya.click("#clSave");
  await expect.poll(async () => (await docs(request))["people/u_maya"]?.avatar?.s).toBe("bunny");
  await enterPlaza(maya);
  await expect(owner.locator(".pz-label b", { hasText: "Dr. Hops" })).toBeVisible();
  expect([...owner.errors, ...maya.errors]).toEqual([]);
});

test("listed spaces get a house; walking to its door visits", async ({ browser, request }) => {
  const maya = await openAs(browser, MAYA);
  await maya.click("#peopleBtn"); await maya.click("#ppRail [data-tab=me]");
  await maya.fill("#ppTitleIn", "Maya's Lab"); await maya.check("#ppListed"); await maya.click("#ppSave");
  await maya.click("#ppClose");
  const owner = await openAs(browser, OWNER);
  await enterPlaza(owner);
  // put the owner right at a house door and use the prompt
  await owner.evaluate(() => { const m = window.__sm.plaza.me3; m.x = 0; m.z = -20.6; });   // north house: the owner's own
  await expect(owner.locator("#pzPrompt")).toContainText("your space");
  await owner.evaluate(() => { const m = window.__sm.plaza.me3; m.x = Math.sin(Math.PI / 6) * 20.9; m.z = -Math.cos(Math.PI / 6) * 20.9; });
  await expect(owner.locator("#pzPrompt")).toContainText("Visit Maya's Lab");
  await owner.keyboard.press("e");
  await expect(owner.locator("#visitBar")).toBeVisible();
  await expect(owner.locator("#vbName")).toHaveText("Maya's Lab");
  await expect(owner.locator("#vbPlaza")).toBeVisible();
  await owner.click("#vbPlaza");
  await expect.poll(() => owner.evaluate(() => window.__sm.plaza.running)).toBe(true);
  expect([...owner.errors, ...maya.errors]).toEqual([]);
});

test("photo booth saves a png through downloads", async ({ browser }) => {
  const owner = await openAs(browser, OWNER);
  await enterPlaza(owner);
  await owner.click("#pzPhoto");
  await expect(owner.locator("#photoSheet")).toHaveClass(/open/);
  await owner.click("#phSave");
  await expect.poll(() => owner.evaluate(() => window.__downloads.map(d => d.filename.endsWith(".png") && d.size > 1000))).toEqual([true]);
});

test("a view-only guest can still walk and chat in the plaza", async ({ browser }) => {
  const owner = await openAs(browser, OWNER);
  const leo = await openAs(browser, LEO);
  await enterPlaza(owner); await enterPlaza(leo);
  await leo.fill("#pzSay", "just looking around"); await leo.press("#pzSay", "Enter");
  await expect(owner.locator(".pz-bubble", { hasText: "just looking around" })).toBeVisible();
});

test("plaza fits a phone", async ({ browser }) => {
  const page = await openAs(browser, OWNER, { viewport: { width: 390, height: 780 } });
  await enterPlaza(page);
  expect(await page.evaluate(() => { scrollTo(200, 0); return scrollX; })).toBe(0);
  await page.screenshot({ path: "test-results/plaza-phone.png" });
});
