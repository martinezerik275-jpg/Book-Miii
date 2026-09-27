# Studio Menu roadmap

Studio Menu is a Wii-style bookmark launcher for creative work first: video, 3D, motion, game dev.
The social layer (spaces, plaza, avatars) is built. It waits until the everyday tool is excellent.

**Guiding rule:** a feature earns its place if it gets a creative person to the right tool, file or
step faster, or keeps their workflow organized with less effort. Wii-menu charm is the finish on
that, not a replacement for it.

Sizes: **S** is about a session, **M** a few sessions, **L** a larger project.
Status: `done`, `preview` (on the preview artifact, not live), `next`, `later`.

---

## Where things stand

| Area | Status | Notes |
|---|---|---|
| Menu, channels, workflows, sessions, search, logos, backdrops, sound worlds, idle | done | The original foundation |
| Split into `src/` modules, build, Playwright tests, publish skill | done | |
| Private channel notes, in-page confirm (delete/import now work), safe links | done | Live as version 12 |
| Spaces, neighbors, plaza, Avatar Clinic, stamps, status, photo booth | done | Live as version 12 |
| Onboarding: welcome, tours, check-in card, Dr. Paws | preview | Needs a live multi-user check before release |
| Phase 1: quick add, bookmark import, favorites/recents, launcher, undo, version history, stacks | preview | Favorites and Recent are sections at the top of search and the launcher, not a separate page |
| Phase 3: session log, step checklists, workflow templates, projects, moodboard | preview | |
| Phase 4: channel banners, controller, menu skins, boot and idle polish, phone pass | preview | Banners need uploads (owner and editors) |
| Multi-user test on claude.ai | later | See Phase 4 |

---

## Phase 1: The launcher is fast and hard to lose (preview)

What someone does dozens of times a day: find a tool, open it, add a new one.

| Item | Size | What it is | Why it matters |
|---|---|---|---|
| **Quick add** | S | Paste a link anywhere on the menu (or drop one from the browser) and it becomes a tile in the next free slot, with the name taken from the site. Undo in the toast. | Adding today means opening the editor and filling a form. Capture should take one gesture. |
| **Import browser bookmarks** | M | Read the standard bookmarks export (`bookmarks.html`) from Chrome, Firefox or Safari. Folders become pages; pick which to bring in. | Nobody starts from zero. This is the fastest way to a full, useful menu. |
| **Recents and favorites** | S | Count opens per channel (stored with the channel). A "Recent" row in search and an optional pinned "Favorites" page that fills itself. | The tools used most should be closest. |
| **Launcher** | S | Ctrl/Cmd+K opens search already filtered to "open": type 2 to 3 letters, Enter opens the site directly, no banner. Number keys 1 to 9 open tiles on the current page. | Keyboard-first speed for people mid-edit. |
| **Undo and history** | M | Undo the last change (delete, move, import) and keep the last 20 menu versions in a private doc with "restore this version". | Makes bold edits safe. The shared menu is the only copy of years of curation. |
| **Stacks (folders)** | M | A tile that holds more tiles (like a Wii channel group). Opens as a small grid on top of the menu. | 12 slots a page fills fast. Stacks keep related tools together (every texture site in one tile). |

## Phase 2: Channels that know creative work (next up)

Make each tile carry the details a creative actually needs when they open it.

| Item | Size | What it is | Why it matters |
|---|---|---|---|
| **Quick links inside a channel** | S | Up to 6 deep links per channel (Blender Docs: Geometry Nodes, Shading, Python API). Shown in the banner, searchable. | One tile per site, many destinations. |
| **Licence and cost** | S | Per channel: Free / Free with credit / Paid / Subscription, the renewal date, and which account you use (never the password). Filters in search: "free only". | Asset and music sites live or die on licence terms, and subscriptions sneak up. |
| **Credit helper** | S | For "free with credit" channels, keep the attribution text and copy it in one click. | Crediting assets correctly is a chore every editor repeats. |
| **Tag views** | S | Click a tag to see every tile with it across pages, as a temporary page. Sound worlds already use tags; this makes them navigable. | Find "all LUT sites" without remembering which page they're on. |
| **Claude, organize my menu** | M | Uses the existing "Draft with Claude" capability: suggest pages, tags and duplicates for the whole menu, shown as a preview you accept item by item. | A one-off tidy-up that would otherwise take an afternoon. |

## Phase 3: Workflows become projects (preview)

Workflows exist (up to 8 steps, a session dock, a timer) but nothing is kept once a session ends.
Your other artifacts (reel trackers, editing session prep, work log) show projects are the real unit
of work.

| Item | Size | What it is | Why it matters |
|---|---|---|---|
| **Session log** | S | When a workflow session ends, save it: which workflow, when, how long, steps done, a one-line note. A "History" view per workflow. | Time spent per task, and proof of what got done, without a separate tracker. |
| **Step checklists** | S | Each workflow step gets a short checklist ("export ProRes 422 HQ", "check audio peaks"), ticked during the session. | Delivery specs are easy to forget at the end of a long edit. |
| **Workflow templates** | S | Starter workflows for common pipelines (Shoot → Ingest → Edit → Grade → Mix → Deliver; Model → UV → Texture → Light → Render) that fill in with your own channels. | Gets people from bookmarks to a working pipeline in one click. |
| **Projects** | L | A project tile: name, client, due date, status, its workflow, pinned channels, links to files (Drive, Frame.io), and notes. The session log rolls up per project. | The launcher becomes the start of every job, not only a list of sites. |
| **Moodboard shelf** | M | Drop reference images onto a project; they live in the project (assets for editors, small images otherwise). | Reference stays next to the tools it's for. |

## Phase 4: The Wii finish (preview)

| Item | Size | What it is |
|---|---|---|
| **Channel banners** | M | Upload a short looping video or image per channel that plays in the banner, like Wii channel previews. |
| **Gamepad and remote-style control** | S | Move between tiles and open them with a game controller (the Gamepad API), with the same sounds. |
| **Menu skins** | M | Alternate looks (GameCube indigo, Dreamcast swirl, cozy cabin) built on the existing colour tokens. |
| **Boot and idle polish** | S | A short start animation that uses your own tiles; the idle screen shows today's project and the time spent. |
| **Phone layout pass** | S | Bigger touch targets, swipe between pages, a bottom sheet for the banner. |

## Phase 5: Social, when the foundation is solid (later)

Everything here builds on what's already live. Social comes after Phases 1 to 3.

| Item | Size | Notes |
|---|---|---|
| **Multi-user test on claude.ai** | S | **Required before more social work.** Two accounts (one Contributor, one Viewer) on the live link: spaces, visiting, borrowing, stamps, plaza presence, chat, the onboarding welcome for both roles. Record findings here. |
| **Release onboarding to live** | S | After the multi-user test. Onboarding is on the preview only. |
| Plaza on phones: joystick, bigger buttons | S | |
| Plaza performance: shared materials, minified three.js, pause in background | M | |
| Owner moderation: hide someone from the plaza, word filter | M | Fits the current access rules. |
| Accessible "who's here" list; calmer camera for reduced motion | S | |
| House interiors: channels as framed pictures | L | |
| Co-working: shared focus timer, shared workflow sessions | M | Bridges social and workflow; the best social feature for this app. |
| Seasonal events (Halloween first) | M | |
| Public version outside claude.ai | L | See `docs/ARCHITECTURE.md`, "If it outgrows the artifact". |

---

## Platform limits to design around

- The page can't fetch other websites (only jsDelivr/cdnjs scripts), so it can't read page titles,
  favicons or check for dead links. Names come from the domain or from Claude's knowledge; logos
  come from "Drop logos".
- Uploads (`assets`) are for editors; everyone else stores small images inside their data.
- 5,000 database documents per artifact; 256 KiB per document. Session logs and version history
  must be grouped (for example one document per month) rather than one per entry.
- `window.confirm`, `alert` and download links are blocked; use `askConfirm()` and `downloads`.
- Private per-person data (notes, open counts, project client/dates/files/moodboard, onboarding,
  version history, the session log) lives under `data/users/<id>/`. Everything else in a space is
  readable by anyone who can open the menu.
