import { test, expect } from "@playwright/test";
import { OWNER, MAYA, LEO, seedMenu, reset, docs, openAs, closeAll, tiles } from "./helpers.js";

test.beforeEach(async ({ request }) => { await reset(request, { "menu/main": seedMenu() }); });
test.afterEach(closeAll);

test("owner sees their menu, and notes move to the private doc", async ({ browser, request }) => {
  const page = await openAs(browser, OWNER);
  await expect(tiles(page)).toHaveCount(3);
  await expect.poll(async () => (await docs(request))["data/users/u_owner/private"]).toEqual({ notes: { c1: "login: erik" }, fields: {} });
  await expect.poll(async () => (await docs(request))["menu/main"].channels[0].notes).toBeUndefined();
  await expect.poll(async () => (await docs(request))["hub/info"]).toEqual({ ownerId: "u_owner" });
  // the note is still there for the owner
  await tiles(page).first().click();
  await expect(page.locator("#pvNotes")).toHaveText("login: erik");
  expect(page.errors).toEqual([]);
});

test("delete asks in the page and works (window.confirm is blocked in the viewer)", async ({ browser, request }) => {
  const page = await openAs(browser, OWNER);
  await page.click("#editBtn");
  await tiles(page).nth(2).click({ force: true });   // tiles wobble in edit mode
  await page.click("#edDelete");
  await expect(page.locator("#confirm")).toHaveClass(/open/);
  await page.click("#cfYes");
  await expect(tiles(page)).toHaveCount(2);
  await expect.poll(async () => (await docs(request))["menu/main"].channels.length).toBe(2);
});

test("a contributor gets their own empty space and can't touch the owner's", async ({ browser, request }) => {
  const owner = await openAs(browser, OWNER);
  const maya = await openAs(browser, MAYA);
  await expect(maya.locator("#emptyMsg")).toContainText("This is your space");
  await maya.click("#emptyAdd");
  await maya.fill("#edName", "Poly Haven"); await maya.fill("#edUrl", "polyhaven.com");
  await maya.click("#edSave");
  await expect(tiles(maya)).toHaveCount(1);
  await expect.poll(async () => (await docs(request))["spaces/u_maya"]?.channels?.[0]?.name).toBe("Poly Haven");
  expect((await docs(request))["menu/main"].channels.length).toBe(3);
  await expect(tiles(owner)).toHaveCount(3);
  expect([...owner.errors, ...maya.errors]).toEqual([]);
});

test("listing, visiting, borrowing and stamping", async ({ browser, request }) => {
  const owner = await openAs(browser, OWNER);
  const maya = await openAs(browser, MAYA);
  // Maya lists her space
  await maya.click("#peopleBtn");
  await maya.click("#ppRail [data-tab=me]");
  await maya.fill("#ppTitleIn", "Maya's Lab");
  await maya.check("#ppListed");
  await maya.click("#ppSave");
  await expect(maya.locator("#ppMsg")).toContainText("listed");
  await maya.click("#ppClose");
  // she visits the owner's space from Neighbors and borrows a channel
  await maya.click("#peopleBtn");
  await maya.click("#ppRail [data-tab=neighbors]");
  await expect(maya.locator("#ppList .pp-row")).toHaveCount(2);
  await maya.locator("#ppList .pp-row", { hasText: "owner of this menu" }).getByRole("button", { name: "Visit" }).click();
  await expect(maya.locator("#visitBar")).toBeVisible();
  await expect(tiles(maya)).toHaveCount(3);
  await tiles(maya).first().click();
  await expect(maya.locator("#pvNotes")).toHaveText("");           // private notes never travel
  await expect(maya.locator("#pvEdit")).toHaveText("Add to my space");
  await maya.click("#pvEdit");
  await expect.poll(async () => (await docs(request))["spaces/u_maya"]?.channels?.map(c => c.name)).toEqual(["Texturelabs"]);
  await maya.click("#pvBack");
  // leave a stamp
  await maya.click("#vbStamp");
  await maya.click("#skStickers [data-k=stetho]");
  await maya.fill("#skNote", "Great textures!");
  await maya.click("#skSave");
  await expect.poll(async () => (await docs(request))["social/u_maya"]?.to).toEqual(["u_owner"]);
  // owner sees the stamp badge and the stamp
  await expect(owner.locator("#peopleBadge")).toHaveText("1");
  await owner.click("#peopleBtn");
  await owner.click("#ppRail [data-tab=stamps]");
  await expect(owner.locator("#ppStamps .stamp-row")).toContainText("Great textures!");
  await expect(owner.locator("#ppStamps .stamp-row b")).toHaveText("Maya Chen");
  // go home
  await maya.click("#vbHome");
  await expect(maya.locator("#visitBar")).toBeHidden();
  await expect(tiles(maya)).toHaveCount(1);
  expect([...owner.errors, ...maya.errors]).toEqual([]);
});

test("a view-only guest can visit but not save", async ({ browser, request }) => {
  const leo = await openAs(browser, LEO);
  await leo.click("#peopleBtn");
  await leo.click("#ppRail [data-tab=me]");
  await expect(leo.locator("#ppSave")).toBeDisabled();
  await expect(leo.locator("#ppMsg")).toContainText("view-only");
  expect(Object.keys(await docs(request)).filter(k => k.includes("u_leo"))).toEqual([]);
});

test("phone width: no sideways scroll", async ({ browser }) => {
  const page = await openAs(browser, OWNER, { viewport: { width: 390, height: 780 } });
  // nothing laid out past the right edge, and the page can't be scrolled sideways
  const past = await page.evaluate(() => [...document.querySelectorAll("#app *")].filter(e => e.getBoundingClientRect().right > innerWidth + 1).length);
  expect(past).toBe(0);
  expect(await page.evaluate(() => { scrollTo(200, 0); return scrollX; })).toBe(0);
  await page.screenshot({ path: "test-results/menu-phone.png" });
});

test("status and 'working in' show up for neighbors", async ({ browser }) => {
  const owner = await openAs(browser, OWNER);
  const maya = await openAs(browser, MAYA);
  await maya.click("#peopleBtn"); await maya.click("#ppRail [data-tab=me]");
  await maya.fill("#ppTitleIn", "Maya's Lab"); await maya.check("#ppListed"); await maya.click("#ppSave");
  await maya.click("#ppStatus [data-v=focus]");
  await maya.check("#ppShareNow");
  await expect(maya.locator("#date")).toContainText("Focus 24:");
  await owner.click("#peopleBtn");
  await expect(owner.locator("#ppList .pp-row", { hasText: "Maya's Lab" }).locator(".pp-online")).toContainText("Focusing · 25 min left");
  await expect(owner.locator("#ppList .pp-row", { hasText: "Maya's Lab" })).toContainText("0 tiles");
  expect([...owner.errors, ...maya.errors]).toEqual([]);
});

test("links from someone else's space can't run script", async ({ browser, request }) => {
  const evil = seedMenu(); evil.channels[0].url = "javascript:alert(1)";
  await reset(request, { "menu/main": seedMenu(), "spaces/u_maya": evil, "people/u_maya": { card: { title: "Trap", listed: true } } });
  const owner = await openAs(browser, OWNER);
  await owner.evaluate(() => window.__sm);                    // loaded
  await owner.click("#peopleBtn");
  await owner.locator("#ppList .pp-row", { hasText: "Trap" }).getByRole("button", { name: "Visit" }).click();
  await expect(tiles(owner)).toHaveCount(3);
  await tiles(owner).first().click();
  expect(await owner.locator("#pvOpen").getAttribute("href")).toBe("");
});
