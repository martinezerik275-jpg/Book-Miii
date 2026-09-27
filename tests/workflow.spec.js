import { test, expect } from "@playwright/test";
import { OWNER, seedMenu, reset, docs, openAs, closeAll, tiles } from "./helpers.js";

test.beforeEach(async ({ request }) => { await reset(request, { "menu/main": seedMenu() }); });
test.afterEach(closeAll);
const month = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };

test("paste or drop a link to add it; undo takes it back", async ({ browser, request }) => {
  const page = await openAs(browser, OWNER);
  await page.evaluate(() => {
    const dt = new DataTransfer(); dt.setData("text/plain", "polyhaven.com");
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
  });
  await expect(tiles(page)).toHaveCount(4);
  await expect(page.locator(".page.current .slot.tile", { hasText: "Polyhaven" })).toHaveCount(1);
  await expect(page.locator("#toast .toast-act")).toHaveText("Undo");
  await page.click("#toast .toast-act");
  await expect(tiles(page)).toHaveCount(3);
  // a link dragged in from the browser, with its page title
  await page.evaluate(() => {
    const dt = new DataTransfer(); dt.setData("text/uri-list", "https://www.shotdeck.com/"); dt.setData("text/html", '<a href="https://www.shotdeck.com/">ShotDeck</a>');
    document.querySelector("#viewport").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.locator(".page.current .slot.tile", { hasText: "ShotDeck" })).toHaveCount(1);
  await expect.poll(async () => (await docs(request))["menu/main"].channels.map(c => c.name)).toContain("ShotDeck");
  expect(page.errors).toEqual([]);
});

test("import browser bookmarks: folders become pages, duplicates skipped", async ({ browser }) => {
  const page = await openAs(browser, OWNER);
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
    <DT><H3>Textures</H3><DL><p>
      <DT><A HREF="https://texturelabs.org">Texturelabs</A>
      <DT><A HREF="https://ambientcg.com">ambientCG</A>
      <DT><A HREF="https://polyhaven.com/textures">Poly Haven</A>
    </DL><p>
    <DT><H3>Edit</H3><DL><p><DT><A HREF="https://frame.io">Frame.io</A><DT><A HREF="javascript:alert(1)">Bad</A></DL><p>
    <DT><A HREF="https://news.ycombinator.com">HN</A>
  </DL>`;
  await page.click("#settingsBtn"); await page.click(".st-rail [data-tab=backup]");
  await page.setInputFiles("#bmFile", { name: "bookmarks.html", mimeType: "text/html", buffer: Buffer.from(html) });
  await expect(page.locator("#bmSheet")).toHaveClass(/open/);
  await expect(page.locator("#bmList .bm-row")).toHaveCount(3);
  await expect(page.locator("#bmList .bm-row", { hasText: "Textures" })).toContainText("2 links");   // Texturelabs is already on the menu
  await page.locator("#bmList .bm-row", { hasText: "Bookmarks" }).locator("input").uncheck();
  await expect(page.locator("#bmGo")).toHaveText("Import 3 bookmarks");
  await page.click("#bmGo");
  const names = await page.evaluate(() => window.__sm.state.pages.map(p => p.name));
  expect(names).toEqual(["Home", "Textures", "Edit"]);
  await expect(tiles(page)).toHaveCount(2);                // we land on the first new page
  await page.keyboard.press("Control+z");
  await expect.poll(() => page.evaluate(() => window.__sm.state.pages.length)).toBe(1);
  expect(page.errors).toEqual([]);
});

test("favorites, recents and the Ctrl+K launcher; opens stay private", async ({ browser, request }) => {
  const page = await openAs(browser, OWNER);
  await page.context().route(/artlist\.io/, r => r.fulfill({ status: 200, contentType: "text/html", body: "artlist" }));
  await tiles(page).nth(1).click();                        // Blender Docs
  await page.click("#pvFav");
  await expect(page.locator("#pvFav")).toHaveText("★ Favorite");
  await page.click("#pvBack");
  await page.keyboard.press("Control+k");
  await expect(page.locator("#search")).toHaveAttribute("data-mode", "launch");
  await expect(page.locator(".result-group").first()).toHaveText("Favorites");
  await page.keyboard.type("art");
  const [tab] = await Promise.all([page.context().waitForEvent("page"), page.keyboard.press("Enter")]);
  expect(tab.url()).toContain("artlist.io");
  await tab.close();
  await expect(page.locator("#search")).not.toHaveClass(/open/);
  await expect.poll(async () => (await docs(request))["data/users/u_owner/private"]?.fields?.c3?.opens).toBe(1);
  const shared = (await docs(request))["menu/main"].channels.find(c => c.id === "c3");
  expect(shared.opens).toBeUndefined();                    // usage never reaches the shared menu
  await page.click("#searchBtn");
  await expect(page.locator(".result-group")).toHaveText(["Favorites", "Recent", "Everything else"]);
  // number keys open tiles on the page
  await page.keyboard.press("Escape");
  await page.keyboard.press("3");
  await expect(page.locator("#preview")).toHaveClass(/open/);
  await expect(page.locator("#pvName")).toHaveText("Artlist");
  expect(page.errors).toEqual([]);
});

test("undo a delete, and restore an earlier version", async ({ browser, request }) => {
  const page = await openAs(browser, OWNER);
  await page.click("#editBtn");
  await tiles(page).nth(0).click({ force: true });
  await page.click("#edDelete"); await page.click("#cfYes");
  await expect(tiles(page)).toHaveCount(2);
  await page.click("#toast .toast-act");
  await expect(tiles(page)).toHaveCount(3);
  await expect.poll(async () => (await docs(request))["data/users/u_owner/history"]?.versions?.length).toBeGreaterThan(0);
  await tiles(page).nth(2).click({ force: true });
  await page.click("#edDelete"); await page.click("#cfYes");
  await expect(tiles(page)).toHaveCount(2);
  await page.click("#editBtn");
  await page.click("#settingsBtn"); await page.click(".st-rail [data-tab=backup]");
  await expect(page.locator("#stVersions .list-row").first()).toContainText("delete Artlist");
  await page.locator("#stVersions .list-row").first().getByRole("button", { name: "Restore" }).click();
  await page.click("#cfYes");
  await expect.poll(() => page.evaluate(() => window.__sm.state.channels.length)).toBe(3);
  expect(page.errors).toEqual([]);
});

test("stacks: make one, drop a tile in, open it, take it out", async ({ browser }) => {
  const page = await openAs(browser, OWNER);
  await page.click("#editBtn");
  await page.locator(".page.current .slot.empty").first().click({ force: true });
  await page.click("#edKind [data-v=stack]");
  await page.fill("#edName", "Textures");
  await page.click("#edSave");
  const stack = page.locator(".page.current .slot.stack");
  await expect(stack).toContainText("0 inside");
  // drag Texturelabs onto the stack
  const from = await tiles(page).first().boundingBox(), to = await stack.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 40, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 }); await page.mouse.up();
  await expect(stack).toContainText("1 inside");
  await page.click("#editBtn");
  await stack.click();
  await expect(page.locator("#stackSheet")).toHaveClass(/open/);
  await page.locator("#skGrid .slot").first().click();
  await expect(page.locator("#pvName")).toHaveText("Texturelabs");
  await page.keyboard.press("Escape");
  await page.locator("#skGrid .sk-out").first().click();
  await expect(page.locator("#skGrid .slot")).toHaveCount(0);
  await expect(page.locator(".page.current .slot.tile", { hasText: "Texturelabs" })).toHaveCount(1);
  expect(page.errors).toEqual([]);
});

test("a workflow from a template, a checklist, and a logged session", async ({ browser, request }) => {
  const page = await openAs(browser, OWNER);
  await page.click("#editBtn");
  await page.locator(".page.current .slot.empty").first().click({ force: true });
  await page.click("#edKind [data-v=flow]");
  await page.selectOption("#edTemplate", "video");
  await expect(page.locator("#edName")).toHaveValue("Video edit");
  await expect(page.locator("#edTemplateHint")).toContainText("Matched 1 of 6");   // Artlist is the music step
  // keep three steps and fill the gaps
  for (let i = 0; i < 3; i++) await page.locator("#edSteps .step-row").last().locator("button[aria-label='Remove step']").click();
  await page.locator("#edSteps .step-row").nth(0).locator("select").selectOption("c1");
  await page.locator("#edSteps .step-row").nth(1).locator("select").selectOption("c2");
  await page.click("#edSave");
  await page.click("#editBtn");
  await page.locator(".page.current .slot.flow").click();
  await page.click("#pvOpen");                              // start session
  await expect(page.locator("#sesChecks")).toHaveText("Checklist 0/8");
  await page.click("#sesChecks");
  await page.locator("#sesPanel input[type=checkbox]").first().check();
  await expect(page.locator("#sesChecks")).toHaveText("Checklist 1/8");
  for (let i = 0; i < 2; i++) {
    const [tab] = await Promise.all([page.context().waitForEvent("page"), page.click("#sesNext")]); await tab.close();
  }
  await expect(page.locator("#sesNext")).toHaveText("Finish session");
  await page.click("#sesNext");
  await expect(page.locator("#sesDoneSheet")).toHaveClass(/open/);
  await page.fill("#sdNote", "Rough cut done");
  await page.click("#sdForm button[type=submit]");
  await expect.poll(async () => (await docs(request))["data/users/u_owner/log-" + month()]?.items?.[0]?.note).toBe("Rough cut done");
  await page.locator(".page.current .slot.flow").click();
  await expect(page.locator("#pvHistory")).toContainText("1 session");
  expect(page.errors).toEqual([]);
});

test("projects: brief, pins, files, moodboard, status and time", async ({ browser, request }) => {
  const page = await openAs(browser, OWNER);
  const tomorrow = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); });
  await page.click("#editBtn");
  await page.locator(".page.current .slot.empty").first().click({ force: true });
  await page.click("#edKind [data-v=project]");
  await page.fill("#edName", "Portcast Ep. 9");
  await page.fill("#edClient", "Portcast");
  await page.fill("#edDue", tomorrow);
  await page.selectOption("#edPinAdd", "c3");
  await page.click("#edAddFile");
  await page.locator("#edFiles .file-row input").nth(0).fill("Project folder");
  await page.locator("#edFiles .file-row input").nth(1).fill("drive.google.com/folder/abc");
  await page.fill("#edNotes", "Client wants a 30s cut");
  await page.click("#edSave");
  await page.click("#editBtn");
  const tile = page.locator(".page.current .slot.project");
  await expect(tile).toContainText("Due tomorrow");
  await tile.click();
  await expect(page.locator("#projSheet")).toHaveClass(/open/);
  await expect(page.locator("#pjPins .pj-pin span")).toHaveText(["Artlist"]);
  await expect(page.locator("#pjFiles a")).toHaveAttribute("href", "https://drive.google.com/folder/abc");
  await page.click("#pjStatus [data-v=review]");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8Dwn4GBgYGJAQoANPsBB3Yv5XcAAAAASUVORK5CYII=", "base64");
  await page.setInputFiles("#pjImgFile", { name: "ref.png", mimeType: "image/png", buffer: png });
  await expect(page.locator("#pjBoard .pj-img")).toHaveCount(1);
  await page.screenshot({ path: "test-results/project.png" });
  // client, dates, links and the board stay private
  await expect.poll(async () => { const d = await docs(request); const id = d["menu/main"].channels.find(c => c.kind === "project")?.id; return d["data/users/u_owner/private"]?.fields?.[id]?.client; }).toBe("Portcast");
  const shared = (await docs(request))["menu/main"].channels.find(c => c.kind === "project");
  expect([shared.client, shared.due, shared.files, shared.board, shared.notes]).toEqual([undefined, undefined, undefined, undefined, undefined]);
  expect(shared.pins).toEqual(["c3"]);
  expect(page.errors).toEqual([]);
});

test("the Wii finish: skins, banners, boot, controller, idle summary", async ({ browser, request }) => {
  const seeded = seedMenu();
  seeded.channels[0].banner = { asset: "0123456789abcdef0123456789abcdef", kind: "image" };
  seeded.channels.push({ id: "p1", kind: "project", name: "Reel", hue: 50, page: "p1", slot: 3, pins: [], flow: "", status: "active",
    due: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) });
  await reset(request, { "menu/main": seeded });
  const page = await openAs(browser, OWNER, { begin: false });
  await page.click("#beginBtn");
  await expect(page.locator("body")).toHaveClass(/booting/);
  // skin
  await page.click("#settingsBtn"); await page.click(".st-rail [data-tab=look]");
  await page.click("#stSkins [data-v=cube]");
  await expect(page.locator("html")).toHaveAttribute("data-skin", "cube");
  await expect.poll(async () => (await docs(request))["menu/main"].skin).toBe("cube");
  await page.keyboard.press("Escape");
  // banner media behind the preview
  await tiles(page).first().click();
  await expect(page.locator("#pvScreen .pv-media img")).toHaveAttribute("src", "/_blob/0123456789abcdef0123456789abcdef");
  await page.keyboard.press("Escape");
  // a controller: right on the d-pad moves focus, A opens
  await page.evaluate(() => {
    const blank = () => Array.from({ length: 17 }, () => ({ pressed: false }));
    window.__pad = { buttons: blank(), axes: [0, 0] };
    navigator.getGamepads = () => [window.__pad];
    dispatchEvent(new Event("gamepadconnected"));
    document.querySelector(".page.current .slot").focus();
  });
  const press = async i => { await page.evaluate(i => { window.__pad.buttons[i] = { pressed: true }; }, i); await page.waitForTimeout(200); await page.evaluate(i => { window.__pad.buttons[i] = { pressed: false }; }, i); await page.waitForTimeout(80); };
  await press(15);
  await expect.poll(() => page.evaluate(() => document.activeElement.dataset.slot)).toBe("1");
  await press(0);
  await expect(page.locator("#preview")).toHaveClass(/open/);
  await expect(page.locator("#pvName")).toHaveText("Blender Docs");
  await press(1);
  await expect(page.locator("#preview")).not.toHaveClass(/open/);
  // idle screen names the next due project
  await page.click("#idleBtn");
  await expect(page.locator("#idleToday")).toContainText("Reel: due in 2 days");
  expect(page.errors.filter(e => !/404/.test(e))).toEqual([]);   // the fake banner image has no file behind it
});

test("phone: project sheet and banner fit", async ({ browser, request }) => {
  const seeded = seedMenu();
  seeded.channels.push({ id: "p1", kind: "project", name: "Reel", hue: 50, page: "p1", slot: 3, pins: ["c1", "c2"], flow: "", status: "active" });
  await reset(request, { "menu/main": seeded });
  const page = await openAs(browser, OWNER, { viewport: { width: 390, height: 780 } });
  await page.locator(".page.current .slot.project").click();
  expect(await page.evaluate(() => { scrollTo(200, 0); return scrollX; })).toBe(0);
  const box = await page.locator(".pj-sheet").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/project-phone.png" });
});
