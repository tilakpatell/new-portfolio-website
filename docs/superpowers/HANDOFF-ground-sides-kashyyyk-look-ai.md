# Handoff: the galaxy's ground (Kashyyyk, sides, AI, look, layouts)

Date: 2026-10-08. Branch `claude/game-layout-textures-ai-7a0553` (worktree
`.claude/worktrees/game-layout-textures-ai-7a0553`). Paused because the
usage limit was near; the owner asked for it to carry on once it resets.

Spec: `docs/superpowers/specs/2026-10-07-ground-sides-kashyyyk-look-ai-design.md`.
Plan: `docs/superpowers/plans/2026-10-07-ground-sides-kashyyyk-look-ai.md`
(executed with superpowers:subagent-driven-development; the ledger with
every ruling and deferred minor is in the git-ignored
`.superpowers/sdd/2026-10-07-ground-sides-kashyyyk-look-ai/progress.md`).

The owner gave standing permission to push and merge each PR as it is
ready, after checking open branches and other sessions for conflicts.

## Done

- **PR 2, merged** (tilakpatell/tilakpatell.com#613, `3034c5ff`): Tasks 1–5.
  The validity guard for every world, Kashyyyk's beach reshaped, deep water
  a wall, Gree's three waves with allies, `garrisonQuest` gone, the Battle of
  Kashyyyk assault, Kashyyyk's war weight 3.
- **On this branch, reviewed, not yet merged:** Task 6 (`siteWar.js`,
  `oathIn`, `groundEffects`), Task 7 (`standing.js`), Task 8 (`landing.js`,
  covert spots on 15 worlds, Coruscant's covert pad), and a merge of main
  (`ab27e3f3`).
- **Task 9, in progress, not reviewed:** commit `5787cd97` (the garrison's
  attitude, givers by side, talk with your side) plus a WIP commit on top of
  it (`GalaxySurface.jsx`). The implementer was stopped while running the
  full galaxy suite, so it is unverified.

## Next, in order

1. Finish Task 9: run `npx vitest run src/components/galaxy`, fix what's
   broken, do the brief's browser checks (a)–(d) (an enemy world's garrison
   hunts you; your own side's salutes with your rank; unsworn is unchanged;
   Geonosis has no stormtroopers), then a task review
   (`task-9-brief.md` in the ledger folder; brief from the plan's Task 9).
2. Open and merge PR 3 (Tasks 6–9). Before merging: merge `origin/main`,
   trial-merge against every open branch (`git merge-tree`), run tests,
   lint and build in the real worktree. Note: on 2026-10-08 a galaxy run
   in a scratch worktree failed 8 tests (battles, gcw, skyTraffic,
   warfront, warpieces, activity ×2, insideForest) with the machine under
   heavy load; check them alone before believing them.
3. PR 4, Tasks 10–14 (soldiers who think). The peer session "NPC AI and
   enemy difficulty" (branch `claude/npc-ai-enemy-difficulty-c4db62`) is
   space-only and won't touch `galaxy/surface`, `lib/ai`, `actors.js` or
   `missions/*`; it offers `universe/difficulty.js difficultyOf(id)` for
   scaling.
4. PR 5, Tasks 15–19 (the look). PR 6, Tasks 20–25 (layouts; leave Mustafar
   and Nevarro alone).

## Browser checks

A scratch driver lived in the session's scratchpad (gone with it). To
rebuild: start Vite in-process with `hmr: false` on a free port, launch
`~/Library/Caches/ms-playwright/chromium-1243/...` with
`--use-angle=metal --disable-gpu-vsync --disable-frame-rate-limit`
through `playwright-core`, set localStorage `tp-3d=on`, `tp-intro=1`,
`tp-sound=off` with `addInitScript`, open `#/galaxy/<id>/surface`, wait for
`window.__surface().phase === 'walk'`. Top-downs: render
`window.__surfaceScene.scene` with an orthographic camera from above and
`renderer.domElement.toDataURL()`. Chromium needs the Bash sandbox off.
