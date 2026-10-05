---
name: autopilot
description: The site's self-improvement loop. Use for a scheduled autopilot run ("You are the tilakverse autopilot"), for "run the autopilot", for "Revert change N" / "undo change N", and for "pause the autopilot" / "stop the autopilot". One run makes one improvement well, checks it in a browser, merges it and logs it on the /changes page; or it does nothing and says why.
---

# Autopilot

One run, one improvement, finished and merged, or none. Quality and performance over quantity: the site owner's word. Design: `docs/superpowers/specs/2026-10-05-autopilot-design.md`. Owner's notes: `docs/autopilot/README.md`.

Work directly, no subagents, terse output. Use the skills the work calls for: `threejs-*` for anything drawn (`threejs-textures`, `threejs-materials`, `threejs-aaa-graphics-builder`, `threejs-debug-profiler` most), `design-taste-frontend` for anything laid out, `test-driven-development` for any rule, `systematic-debugging` for anything broken, `verification-before-completion` before any claim.

## 1. Orient

```bash
git fetch origin main && git checkout -B main origin/main
npm ci
cat docs/autopilot/budget.json docs/autopilot/backlog.md
ls src/data/changes/ | tail -3        # the newest entries: read them
git log --oneline -15
```

Read `docs/superpowers/HANDOFF-*.md` only for the area you pick.

## 2. Budget: may this run do anything?

Stop, with nothing changed and a one-line report, when any of these holds:

- `docs/autopilot/budget.json` has `"paused": true`.
- Today already has `runsPerDay` entries in `src/data/changes/` (count the files whose `date` is today).
- The plan is most of the way used. Call `mcp__claude-code-remote__get_session` with no arguments and read `external_metadata.rate_limit_info`:
  - `utilization` present and `>= stopAtUtilization` (0.8) → stop.
  - `status` not `allowed` (`allowed_warning`, `rejected`, …) → stop.
  - `isUsingOverage` true → stop.
  - No `utilization` field (a promotional or unmetered limit) and `status` `allowed` → go on.
- `main` is red in a way you can't fix in this run (say which check and why).

When you stop for the budget, say so in the report and do nothing else: no commit, no PR, no backlog edit.

## 3. Pick one thing

In this order, first match wins:

1. **Broken on `main`**: CI red (`mcp__github__actions_list` / the deploy workflow's last run), or a page that fails `node scripts/autopilot-check.mjs --only smoke` (build first). Fix it. That's the run.
2. **The top open item in `docs/autopilot/backlog.md`** (first unchecked `- [ ]`). If it won't fit one run, do the first slice that stands on its own and leave the rest written under it.
3. **A finding of your own**, from a quality audit of one page: a texture that's blurry up close or far bigger than it shows, a scene that drops frames at `?quality=mid`, a chunk that grew, a phone layout that broke, a sound that never stops, a world that downloads more than `WORLD_MB` says. Put it in the backlog first, then do it.

Finishing and polishing beat starting. Never pick two. Never pick a change to `src/data/` content (roles, projects, résumé, places) unless the backlog says so.

## 4. Branch

```bash
ID=$(node scripts/autopilot-log.mjs --next)      # e.g. 0012
git checkout -b autopilot/$ID-<slug> main
```

## 5. Build it well

The standing rules (the owner's, from the handoffs; `docs/superpowers/specs/2026-10-05-autopilot-design.md` has the list):

- No sequel trilogy (Episodes 7–9) anywhere; after Episode 6 only The Mandalorian and Ahsoka.
- The site's own words: no copied dialogue beyond short famous lines; new buildings, props and signs original.
- No runtime calls to asset services. Everything generated or fetched ahead and committed, credited in `public/cc0/README.md`, `public/games/credits.json` or `src/data/modelCredits.json`. Never print or commit a key.
- Game rules in a tested `rules.js`, apart from the drawing. New pure logic gets tests first.
- Every scene starts from `lib/device`'s tier (`budget()`), lowers itself under `lib/three/pace`, loads only when near (`lib/three/useScene`), and is disposed on leave. A world that downloads more updates `WORLD_MB` in `src/components/worlds/worlds.js`.
- Textures: WebP (KTX2 where it pays), 2K at most on desktop with a `-sm` copy for phones, mipmapped, anisotropy from the tier, `SRGBColorSpace` on colour maps only, `RepeatWrapping` only where tiled. A new texture earns its bytes; the entry says what it replaced and how big it is. The biggest wins are usually one texture that's far larger than the pixels it covers, a material without a normal map that looks flat, or a scan where a painted surface was.
- Triangles and draw calls: instance anything repeated, merge what's static, LOD or impostors far off (`scripts/hq-impostors.mjs` is the pattern). Measure with `renderer.info` before and after and say the numbers.
- British spelling, curly quotes (’ “ ”), plain sentences, no exclamation marks in a row. Comments say why, in the file's voice.
- Don't touch another session's open work (an open PR's files) and don't rename or reformat files you aren't changing.

## 6. Check

```bash
node scripts/autopilot-check.mjs --routes <the routes you touched, comma-separated> --shots $ID
```

Lint, tests, build, bundle sizes, then every core page and your routes in headless Chromium: no page error, no console error beyond the known noise, a canvas where there's 3D, and the screenshots into `public/changes/$ID-a.webp` (and `-b`). Red means fix and run again; never skip a step, never quiet a test. Look at the screenshots (`Read` them): if your change isn't visible or looks worse, it isn't done. For a phone layout, run it again with `--phone`.

## 7. Ship

1. Commit: one plain sentence about what changed, the body saying why and the numbers; end with the attribution lines the harness gives you. No model names in the message.
2. `git push -u origin autopilot/$ID-<slug>`.
3. Open the pull request (`mcp__github__create_pull_request`, base `main`; or `gh pr create` if that's what you have). Title: the entry's title. Body: the summary, the measured numbers, the checks that ran, and the screenshots as images (`https://raw.githubusercontent.com/tilakpatell/new-portfolio-website/autopilot/$ID-<slug>/public/changes/$ID-a.webp`). End with the harness's PR footer.
4. Write the entry, with the PR's number:
   ```bash
   node scripts/autopilot-log.mjs --title "…" --kind graphics --summary "…" --routes /a,/b --pr <n> --note "…" --session <this session's id>
   git add src/data/changes public/changes && git commit -m "Ship's log: change $ID" && git push
   ```
   Kinds: `feature`, `graphics`, `performance`, `fix`, `content`, `infra`. The summary is two or three sentences for a visitor, in the site's voice.
5. Wait for CI: `mcp__github__pull_request_read` with `method: get_check_runs` every minute, up to fifteen minutes, until the `CI` check run is `completed` with `success`. A failure is yours to fix (push, wait again). If no check run appears in five minutes, look at `mcp__github__actions_list`; without any CI, local green stands.
6. Merge: `mcp__github__merge_pull_request` with `merge_method: merge` (a merge commit, so a revert has one commit to undo). Then `git fetch origin main`.

Never merge red. Never force-push. Never merge two PRs in one run.

## 8. Hand off

- Tick the backlog item (`- [x]`, with the entry's number), or write what's left of it under it as new `- [ ]` lines. Put any new finding in the backlog too. Commit that to `main` directly only if it's the backlog alone (`git commit -m "Backlog: …"`, `git push origin main`); anything else goes through a PR.
- Report in a few lines: what changed, the PR link, the numbers, what the next run should look at. Or why nothing changed.

## Undoing a change

For "Revert change 12" (or "undo", "take out", "remove change 12"):

```bash
git fetch origin main && git checkout -B main origin/main && npm ci
git checkout -b autopilot/revert-0012 main
node scripts/autopilot-revert.mjs 12 --why "<the owner's reason, in a sentence>"
node scripts/autopilot-check.mjs --routes <the entry's routes>
git push -u origin autopilot/revert-0012
```

Then the pull request ("Revert change 12: <title>"), CI, merge, as in step 7. The script reverts the entry's merge commit, puts the entry back marked reverted (with its screenshots) and commits. If it stops on a conflict, it names the later entries that touched the same files: resolve by hand if the fix is clear (keep the later entries' work, remove this one's), else tell the owner which later changes are in the way and stop.

## Pausing and stopping

- "Pause the autopilot": set `"paused": true` in `docs/autopilot/budget.json`, commit to `main`, push. Resume: `false`.
- "Stop the autopilot" for good: `mcp__claude-code-remote__list_triggers`, then `mcp__claude-code-remote__update_trigger` with `enabled: false` on the Routine named "Autopilot: one improvement", or `delete_trigger`. Say which you did.
- Change the cadence: `update_trigger` with a new `cron_expression`. `runsPerDay` in `budget.json` caps it as well.

## Never

- Two changes in one run; a half-done change on `main`; a merge with a red check; a skipped or quietened test.
- A change to the owner's content or voice without the backlog saying so.
- A new dependency without saying why in the entry.
- Anything that calls out to a service at runtime.
- An entry without a screenshot, unless the change has nothing to see (then say so in the summary).
