# Studio Menu

A Wii-menu-style bookmark launcher published as a claude.ai **artifact**, now with
per-person spaces and a shared 3D plaza. See `docs/ARCHITECTURE.md` for the design.

## Layout
- `src/index.html`: page shell. `<!-- @css -->`, `<!-- @js -->`, `<!-- @include partials/x.html -->` are build markers.
- `src/css/NN-*.css`, `src/js/NN-*.js`: concatenated **in filename order** by `scripts/build.mjs`.
  JS files are fragments of ONE script inside an IIFE (shared scope), not ES modules.
  Top-level `let`/`const` run in order, so a file may only *call* things from later files inside
  functions that run after load. Shared globals live in `src/js/01-core.js`; boot is `90-boot.js`, last.
- `src/capabilities.json`: the artifact's runtime capabilities and db access rules. It's the single
  source for publishing and for the test host (`tests/harness/rules.mjs` enforces the same rules).
- `original/studio-menu.live.html`: the pre-split live snapshot (history only; don't edit).
- `dist/studio-menu.html`: build output (gitignored). This is the file that gets published.

## Commands
- `npm run build`: build `dist/studio-menu.html`
- `npm test`: build, then Playwright against a local fake artifact host (`tests/harness/server.mjs`)
- `node tests/harness/server.mjs`: run the host by hand on http://localhost:4173 (page needs `?test`)

## Rules that matter
- **Data**: the owner's menu is `menu/main` (never rename it: that's the live data). Others:
  `spaces/<id>`, `people/<id>`, `social/<id>`. Notes: `data/users/<id>/private`. Presence (plaza position,
  chat, emotes, status) is room presence and is never stored.
- Everything read from `db` or `room` came from another person: render with `textContent`, validate
  shapes (`decodeAvatar`, `normalize` drops non-http links), never build HTML from it.
- The viewer blocks `window.confirm/alert/prompt`, downloads by link, and third-party hosts. Use
  `askConfirm()`, the `downloads` capability, and CDN scripts only from cdn.jsdelivr.net/npm or cdnjs.
- Keep the existing look: tokens in `src/css/01-tokens.css` (light + dark), M PLUS Rounded 1c,
  bezel tiles, `.pill`, `.round`, `.sheet`. Reduced motion must keep working.
- three.js is loaded lazily (`loadThree()` in `25-plaza.js`); tests serve it from node_modules.
  Keep the pinned version in `THREE_URL` in sync with `package.json`.
- Onboarding (`27-onboarding.js`): first visits get a welcome (newcomer or visitor), the owner gets a
  "what's new" tour, and everyone gets a check-in card. Bump `WHATS_NEW` when a release deserves a new
  tour. Progress is in `data/users/<id>/onboarding`; tests skip it unless `openAs(..., { onboarding: true })`.
- Add a Playwright test for any multi-user behavior; `openAs(browser, who)` gives each person their
  own context. Close contexts (`afterEach(closeAll)`) or WebGL contexts run out.

## Publishing
Use the `publish-studio-menu` skill (`.claude/skills/publish-studio-menu/SKILL.md`). Never publish
without reading the live artifact first, and never change `capabilities` without saying so.
