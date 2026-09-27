---
name: publish-studio-menu
description: Build, test and publish Studio Menu to its claude.ai artifact (preview or live). Use when asked to ship, publish, deploy or update the Studio Menu artifact.
---

# Publish Studio Menu

Artifacts:
- **Live** (pinned, the owner's real menu): https://claude.ai/artifact/PHzcJUDEgTroYfg1cyVQbY
- **Preview**: see the link recorded in `docs/ARCHITECTURE.md` under "Artifacts", if one exists.

Steps:
1. `npm test`. Stop on any failure; fix it first.
2. Read the target artifact with the Artifact tool (`action: "read"`, `url`). Read the whole saved
   file. If it differs from what this repo last published (someone edited it in the page, or a
   newer version exists), stop and tell the user what changed before overwriting it.
3. Publish `dist/studio-menu.html` with the Artifact tool and that `url`:
   - Pass `capabilities` from `src/capabilities.json` **only** if it changed since the last publish,
     and say in your reply which rules or capabilities changed. Omitting it keeps the stored set.
   - Never pass `force`. Never pass `icon` on a republish.
4. Verify once: `ArtifactData` `list` on `people` and `get` on `hub/info`. Then do a read of
   `spaces` with `as_level: "interact"`; it must not show anything under `data/users`.
5. Tell the user the link and what shipped, in a few lines.

Live-only cautions:
- `menu/main` is the owner's real data. Don't write to it with ArtifactData unless asked.
- The first owner visit after the spaces release moves channel notes into
  `data/users/<owner>/private` and strips them from `menu/main`. That's expected.
