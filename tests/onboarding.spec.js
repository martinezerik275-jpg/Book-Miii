import { test, expect } from "@playwright/test";
import { OWNER, MAYA, LEO, seedMenu, reset, docs, openAs, closeAll, tiles } from "./helpers.js";

test.beforeEach(async ({ request }) => { await reset(request, { "menu/main": seedMenu() }); });
test.afterEach(closeAll);
const tick = s => s.replace(/’/g, "'");

test("a newcomer checks in: look, name, first channels", async ({ browser, request }) => {
  const maya = await openAs(browser, MAYA, { onboarding: true });
  const wc = maya.locator("#welcome");
  await expect(wc).toHaveClass(/open/);
  await expect(maya.locator("#wcTitle")).toContainText("Welcome to");
  await maya.click("#wcNextBtn");                                   // hello -> look
  await maya.click("#wcClinic");
  await maya.getByRole("button", { name: /Bunny/ }).click();
  await maya.click("#clSave");
  await expect(maya.locator("#wcLookHint")).toHaveText("Looking good. You can change it any time.");
  await maya.click("#wcNextBtn");                                   // look -> space
  await maya.fill("#wcName", "Maya's Lab");
  await maya.click("#wcNextBtn");                                   // space -> channels (saves the card)
  await expect.poll(async () => (await docs(request))["people/u_maya"]?.card?.title).toBe("Maya's Lab");
  await expect(maya.locator("#wcPicks .wc-pick")).toHaveCount(3);   // the owner's channels, ready to copy
  await maya.locator("#wcPicks .wc-pick", { hasText: "Texturelabs" }).click();
  await maya.locator("#wcPicks .wc-pick", { hasText: "Artlist" }).click();
  await expect(maya.locator("#wcPicks .wc-pick.on")).toHaveCount(2);
  await maya.fill("#wcUrl", "polyhaven.com"); await maya.press("#wcUrl", "Enter");
  await expect(maya.locator("#wcAddMsg")).toContainText("Added polyhaven.com");
  await expect.poll(async () => (await docs(request))["spaces/u_maya"]?.channels?.map(c => c.name).sort()).toEqual(["Artlist", "Polyhaven", "Texturelabs"]);
  await maya.click("#wcNextBtn");                                   // channels -> done
  await expect(maya.locator("#wcNext li")).toHaveCount(3);
  await maya.screenshot({ path: "test-results/welcome-done.png" });
  await maya.click("#wcNextBtn");                                   // finish
  await expect(wc).not.toHaveClass(/open/);
  // the check-in card picks up what's already done
  await expect(maya.locator("#checkin")).toBeVisible();
  await expect(maya.locator("#ciCount")).toHaveText("3/7");
  await expect(tiles(maya)).toHaveCount(3);
  await maya.screenshot({ path: "test-results/checkin.png" });
  await expect.poll(async () => (await docs(request))["data/users/u_maya/onboarding"]?.welcomed).toBeGreaterThan(0);
  expect((await docs(request))["data/users/u_maya/onboarding"].flags.avatar).toBeGreaterThan(0);
  // a reload doesn't greet her again
  await maya.reload(); await maya.click("#beginBtn");
  await maya.waitForTimeout(800);
  await expect(wc).not.toHaveClass(/open/);
  expect(maya.errors).toEqual([]);
});

test("finishing the check-in earns the graduation cap", async ({ browser, request }) => {
  const three = seedMenu(); three.channels.forEach(c => delete c.notes);
  await reset(request, { "menu/main": seedMenu(), "spaces/u_maya": three,
    "people/u_maya": { avatar: { s: "fox" }, card: { title: "Maya's Lab", listed: true } } });
  const owner = await openAs(browser, OWNER);
  const maya = await openAs(browser, MAYA, { onboarding: true });
  // she built a space before the welcome existed, so she gets the short tour instead
  await expect(maya.locator("#tour")).toHaveClass(/open/);
  await expect(maya.locator("#welcome")).not.toHaveClass(/open/);
  await maya.keyboard.press("Escape");
  await expect(maya.locator("#ciCount")).toHaveText("3/7");
  // walk into the plaza and say hi
  await maya.locator("#ciList button", { hasText: "Walk into the plaza" }).click();
  await expect(maya.locator("#pzLoading")).toBeHidden({ timeout: 30000 });
  await maya.fill("#pzSay", "hello!"); await maya.press("#pzSay", "Enter");
  await maya.click("#pzClose");
  // visit the owner's space and stamp it
  await maya.click("#peopleBtn");
  await maya.locator("#ppList .pp-row", { hasText: "owner of this menu" }).getByRole("button", { name: "Visit" }).click();
  await maya.click("#vbStamp"); await maya.click("#skSave");
  await expect(maya.locator("#ciDone")).toBeVisible();
  await expect(maya.locator("#ciCount")).toHaveText("7/7");
  await maya.click("#ciWear");
  await expect(maya.locator("#clHat button[data-v=grad]")).toHaveClass(/on/);
  await expect.poll(async () => (await docs(request))["data/users/u_maya/onboarding"]?.reward).toBeGreaterThan(0);
  expect([...owner.errors, ...maya.errors]).toEqual([]);
});

test("the owner gets a what's-new tour once, on any device", async ({ browser, request }) => {
  const owner = await openAs(browser, OWNER, { onboarding: true });
  await expect(owner.locator("#tour")).toHaveClass(/open/);
  await expect(owner.locator("#trTitle")).toHaveText("Your menu grew a neighborhood");
  await owner.click("#trNext");
  await expect(owner.locator("#trTitle")).toHaveText("People");
  const spot = await owner.locator("#trSpot").boundingBox(), btn = await owner.locator("#peopleBtn").boundingBox();
  expect(Math.abs((spot.x + spot.width / 2) - (btn.x + btn.width / 2))).toBeLessThan(3);   // spotlight sits on the button
  await owner.screenshot({ path: "test-results/tour.png" });
  await owner.keyboard.press("Escape");
  await expect(owner.locator("#tour")).not.toHaveClass(/open/);
  await expect.poll(async () => (await docs(request))["data/users/u_owner/onboarding"]?.whatsNew).toBe(1);
  // a fresh browser (no local progress) remembers through the private doc
  const again = await openAs(browser, OWNER, { onboarding: true });
  await again.waitForTimeout(900);
  await expect(again.locator("#tour")).not.toHaveClass(/open/);
});

test("a viewer gets the visitor welcome and meets Dr. Paws", async ({ browser }) => {
  const leo = await openAs(browser, LEO, { onboarding: true });
  await expect(leo.locator("#welcome")).toHaveClass(/open/);
  await expect(leo.locator("#wcGuestAsk")).toContainText("Contributor");
  await expect(leo.locator("#wcNextBtn")).toHaveText("Walk the plaza");
  await leo.click("#wcNextBtn");
  await expect(leo.locator("#pzLoading")).toBeHidden({ timeout: 30000 });
  await expect(leo.locator(".pz-label.npc b")).toHaveText("Dr. Paws");
  await expect(leo.locator(".pz-bubble", { hasText: "Welcome to the plaza" })).toBeVisible();
  await leo.screenshot({ path: "test-results/paws.png" });
  expect(leo.errors).toEqual([]);
});

test("replay from Shortcuts; welcome fits a phone", async ({ browser }) => {
  const maya = await openAs(browser, MAYA, { viewport: { width: 390, height: 780 } });
  await expect(maya.locator("#welcome")).not.toHaveClass(/open/);
  await maya.evaluate(() => document.querySelector("#kReplay").click());   // Shortcuts is hidden on phones; call it directly
  await expect(maya.locator("#welcome")).toHaveClass(/open/);
  expect(await maya.evaluate(() => { scrollTo(200, 0); return scrollX; })).toBe(0);
  const box = await maya.locator(".wc-sheet").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
  await maya.screenshot({ path: "test-results/welcome-phone.png" });
});
