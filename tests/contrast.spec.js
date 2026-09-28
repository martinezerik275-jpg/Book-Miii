import { test, expect } from "@playwright/test";
import { OWNER, seedMenu, reset, openAs, closeAll } from "./helpers.js";

test.afterEach(closeAll);

// The artifact host wraps the page in its own styles (near-black body text); the test server does too.
// Every text element must stay readable against whatever is actually behind it.
function measure(page, sels) {
  return page.evaluate(sels => {
    const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const bgOf = el => {
      for (; el; el = el.parentElement) { const c = rgb(getComputedStyle(el).backgroundColor); if (c.length === 3 || c[3] > .5) return c.slice(0, 3); }
      return [255, 255, 255];
    };
    return sels.map(sel => {
      const el = document.querySelector(sel); if (!el) return { sel, ratio: 0, missing: true };
      const a = lum(rgb(getComputedStyle(el).color)), b = lum(bgOf(el));
      return { sel, ratio: +((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toFixed(2) };
    });
  }, sels);
}
const readable = rows => rows.filter(r => r.ratio < 4.5);
const SHEET = ["#stTitle", "#settings .list-row .name", "#settings label.check", "#settings h4"];

for (const [label, theme, skin] of [["dark by system", "auto", undefined], ["dark chosen", "dark", undefined], ["light", "light", undefined],
  ["cube dark", "dark", "cube"], ["dream dark", "dark", "dream"], ["cabin dark", "dark", "cabin"]]) {
  test(`text is readable: ${label}`, async ({ browser, request }) => {
    await reset(request, { "menu/main": { ...seedMenu(), theme, skin, audio: { ...seedMenu().audio, musicName: "Lobby" } } });
    const page = await openAs(browser, OWNER, { begin: false });
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => page.evaluate(() => window.__sm && window.__sm.state.theme)).toBe(theme);
    expect(readable(await measure(page, ["#start h1", "#beginBtn"]))).toEqual([]);
    await page.click("#beginBtn");
    await page.click("#settingsBtn");
    await expect(page.locator("#settings")).toHaveClass(/open/);
    const rows = await measure(page, SHEET);
    expect(rows.filter(r => r.missing).map(r => r.sel)).toEqual([]);
    expect(readable(rows)).toEqual([]);
  });
}
