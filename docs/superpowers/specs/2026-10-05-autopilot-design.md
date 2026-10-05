# The autopilot, and the ship's log — design

The site owner's ask: put the site in a loop. A fresh Claude session comes round on a schedule, with every skill the repo carries, makes one improvement well (a feature, or more often something faster or better-looking), checks it hasn't broken anything, merges it, and goes away; a month later the site is better than it was. The owner can see every change, with a picture of it, and tell any Claude session to take one out again. It runs until the owner's Claude plan is most of the way used, then stops of its own accord.

Three parts: **the autopilot** (a skill that is the whole protocol, and a scheduled Routine that runs a fresh session on it), **the ship's log** (`/changes`: every change the autopilot made, newest first, with a screenshot, the pull request, and the words to say to undo it), and **the guards** (CI on every pull request, and a check script that runs lint, the tests, the build and a smoke test of the pages in a real browser before anything is merged).

## Brief

- **Owner's word.** Quality and performance over quantity. High-quality textures. One change done well beats three done roughly. A run that can't do something well in its budget does nothing, and says so.
- **Nothing lands broken.** Every run must pass lint, the tests, the build and the smoke test locally, then CI on the pull request, before it merges. A run never leaves a half-done change on `main`.
- **Everything is visible.** Every change is one pull request, one merge commit and one entry in the log, with a screenshot of the page it touched.
- **Everything is reversible.** An entry is undone with one phrase to any Claude session (`Revert change 12`), which becomes its own pull request. The log keeps the entry, marked reverted, so the history stays whole.
- **It stops on its own.** Before doing anything, a run checks the plan's usage and a pause switch in the repo. At 80% of the plan, or when paused, it exits without a change.
- **Non-goals.** No backend, no runtime calls to asset services (the site's rule), no change to the owner's content in `src/data/` (roles, projects, résumé) without being asked, no new world unless the backlog says so, no mass renames or reformatting.

## The loop, one run

A Routine (a scheduled trigger on the owner's Claude account) fires on a cron and starts a fresh cloud session in the repo's environment with a short prompt: read `.claude/skills/autopilot/SKILL.md` and follow it. The skill is the protocol:

1. **Orient.** `npm ci`. Read `docs/autopilot/README.md`, `docs/autopilot/backlog.md`, the newest entries in `src/data/changes/`, and the latest handoff for anything in flight. Fetch `main`.
2. **Budget.** Stop if `docs/autopilot/budget.json` says `paused`, or if the session's own rate-limit view (`get_session` → `external_metadata.rate_limit_info`) says the plan is at 80% or more (`utilization ≥ 0.8`), over its limit (`status` not `allowed`) or in overage. Stop too if the day's runs already number `runsPerDay`.
3. **Pick one thing.** In this order: something broken on `main` (CI red, a page that throws in the smoke test); the top open item in the backlog; a finding from a quality audit of a page (a texture that's blurry or too big, a scene that drops frames, a bundle chunk that grew, a phone layout that broke). Finishing and polishing beat starting. A whole feature that won't fit one run is cut to a slice that stands on its own, with the rest left in the backlog.
4. **Branch.** `autopilot/<id>-<slug>` from `origin/main`, where `<id>` is the next entry number.
5. **Build it well.** The relevant skills apply (`threejs-*` for anything drawn, `design-taste-frontend` for anything laid out, `test-driven-development` for any rule). The site's standing rules hold (below).
6. **Check.** `node scripts/autopilot-check.mjs --routes <the routes touched> --shots <id>`: lint, tests, build, bundle sizes, then the pages in headless Chromium (no page errors, no console errors beyond the known noise, a canvas where there should be one), with screenshots of the touched routes into `public/changes/`.
7. **Ship.** Commit, push, open the pull request (title: the entry's title; body: the summary, the measured numbers, the screenshots). Write the entry with `node scripts/autopilot-log.mjs` (the pull request's number goes in it), commit, push. Wait for the `CI` check on the pull request to pass. Merge with a merge commit (the repo's convention, so the revert has one commit to undo). Never merge red.
8. **Hand off.** Tick the backlog item, or write what's left of it under it. Then a short report.

A run is one improvement, finished and merged, or none. Never two.

## The ship's log

One file per entry, `src/data/changes/<id>.json` (four digits, `0001.json`), so two runs never fight over one file. `src/data/changes.js` reads them all (`import.meta.glob`, eager) and sorts them newest first. `changes.test.js` checks every entry: unique ids, every field, a known kind, an ISO date, routes that start with `/`, screenshots that exist.

```json
{
  "id": 12,
  "date": "2026-10-07",
  "title": "Sharper ground on Hoth, for fewer bytes",
  "kind": "graphics",
  "summary": "Two or three sentences, in the site's voice: what changed and why it's better.",
  "routes": ["/galaxy/hoth/surface"],
  "pr": 151,
  "shots": ["/changes/0012-a.webp"],
  "measured": { "js": 5123456, "note": "Hoth's ground texture 1.9 MB → 0.6 MB" },
  "session": "session_…",
  "reverted": null
}
```

`kind` is one of `feature`, `graphics`, `performance`, `fix`, `content`, `infra`. `reverted`, when set, is `{ "date", "pr", "why" }`.

Screenshots are `public/changes/<id>-<letter>.webp`, 960 × 600, quality 78, at most two an entry; a 2D page is shot after its fonts and first paint, a 3D page after its first frames.

### The page

`/changes`, "The ship's log". The header says what it is and how to undo a change. A line of numbers (changes, since when, how many of each kind). Chips to filter by kind, and one to show the reverted ones. Then the entries, newest first, each a card: number, date and kind; title; summary; the routes it touched as links; its screenshots; the pull request; and the phrase to undo it, with a copy button. A reverted entry is dimmed and says when and why.

The footer and ⌘K link to it. It's a plain page: no 3D, nothing heavy, every image lazy with its size set.

## Undoing a change

`node scripts/autopilot-revert.mjs <id> --why "…"`, on a branch from `main`: it finds the entry's merge commit from its pull request number (`Merge pull request #<pr>` on `main`'s first-parent line), runs `git revert -m 1`, puts the entry back in the log marked reverted (the revert took it out), and commits. The session then pushes, opens the pull request and merges it, the same way as a change. If the revert conflicts (a later change built on it), the script says which later entries touched the same files, and the session resolves it by hand or tells the owner.

The phrase on the page is `Revert change 12`; the autopilot skill's "Undoing a change" section is what any session follows when it hears it.

## The guards

- `.github/workflows/ci.yml`: on every pull request to `main`, `npm ci`, lint, tests, build. The autopilot waits for it before merging. `deploy.yml` stays as it is.
- `scripts/autopilot-check.mjs`: the same three, then the bundle (total JS in `dist/assets`, the biggest chunks, and the entry chunk against the last entry's numbers), then the smoke test: `vite preview` on a free port, the core routes and any given with `--routes`, in headless Chromium with software WebGL, `tp-intro` set so the crawl doesn't play. A page fails on a `pageerror`, on a console error not in the known-noise list (relay sockets that can't connect from a sandbox, GitHub's rate limit), or when a 3D route draws no canvas. `--shots <id>` writes the screenshots.
- The budget knobs: `docs/autopilot/budget.json` (`paused`, `runsPerDay`), the Routine's own enable switch, and the plan's usage.

## Standing rules (the owner's, gathered from the handoffs)

- Quality over quantity. Finish before starting.
- No sequel trilogy (Episodes 7–9) anywhere in Star Wars content; after Episode 6 only The Mandalorian and Ahsoka.
- The site's own words: no copied dialogue beyond short famous lines; characters and marks as they are; new buildings, props and signs original.
- No runtime calls to asset services; everything generated or downloaded ahead of time and committed, credited in `public/cc0/README.md`, `public/games/credits.json` or `src/data/modelCredits.json`.
- Never print or commit a key. `MESHY_API_KEY` and `SKETCHFAB_API_TOKEN` live in `.env.local` and in the environment, nowhere else.
- Content is data: roles, projects, education in `src/data/`, and not for the autopilot to change.
- Game rules in a tested `rules.js`, apart from the drawing.
- Every scene starts from `lib/device`'s tier, lowers itself under `lib/three/pace`, and loads only when near. Phones ask before a heavy world downloads (`WORLD_MB`).
- Textures: WebP (or KTX2 where it pays), 2K at most on desktop with a `-sm` copy for phones, mipmapped, anisotropy from the tier, sRGB only on colour maps. A new texture earns its bytes: the entry says what it replaced and how big it is.
- British spelling, curly quotes, plain sentences, no exclamation-mark spam.
- Commit messages: one plain sentence about what changed; the session's attribution lines at the end.

## Budget

The Routine fires every four hours (`0 */4 * * *`): six runs a day at most, each one change. The plan's usage is read at the start of every run, and a run at 80% or more does nothing. The owner pauses it at any time: `paused: true` in `docs/autopilot/budget.json` (any session can do that in a pull request), or the Routine's switch on claude.ai, or `Stop the autopilot` to a session with the trigger tools.
