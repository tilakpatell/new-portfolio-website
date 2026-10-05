# The autopilot

The site improves itself. A Routine on the owner's Claude account fires every four hours and starts a fresh Claude Code session in this repo with one instruction: follow `.claude/skills/autopilot/SKILL.md`. That skill is the whole protocol. Each run makes **one** improvement, done well, or none:

1. checks the budget (below) and stops if it's spent or paused;
2. picks one thing: something broken first, then the top of `backlog.md`, then a finding of its own;
3. builds it on a branch, with the repo's skills and the owner's standing rules;
4. runs `node scripts/autopilot-check.mjs` (lint, tests, build, bundle sizes, every page in a headless browser, screenshots);
5. opens a pull request, waits for CI, merges;
6. writes the entry for the **ship's log** at `/changes` (`src/data/changes/<id>.json`, a screenshot in `public/changes/`), and ticks the backlog.

## Seeing what changed

Open [/changes](https://tilakpatell.com/#/changes) (or ⌘K → "What's changed"). Each entry has its date, kind, summary, a screenshot, the page it touched and its pull request.

## Undoing a change

Tell any Claude session (a new one is fine): **`Revert change 12`**, with a reason if you like. It follows the skill's "Undoing a change": `scripts/autopilot-revert.mjs` reverts that entry's merge commit, keeps the entry in the log marked reverted, and the change goes out through a pull request of its own. If a later change built on it, the session says which and asks.

## Pausing, stopping, pacing

- **Pause**: set `"paused": true` in `docs/autopilot/budget.json` (any session can: "pause the autopilot"). Runs still fire but do nothing until it's `false` again.
- **Stop**: switch the Routine off on claude.ai (Routines → "Autopilot: one improvement"), or tell a session "stop the autopilot".
- **Pace**: the Routine's cron (every four hours by default) and `runsPerDay` in `budget.json`.
- **The plan**: every run reads the session's own rate-limit view and does nothing at `stopAtUtilization` (80%) of the plan or beyond, when the status isn't `allowed`, or in overage. Where the plan reports no utilisation figure, only the status is used; the pace knobs are then the real limit. Your usage is on claude.ai under Settings → Usage.

## Checking it by hand

```bash
npm ci
node scripts/autopilot-check.mjs                       # everything
node scripts/autopilot-check.mjs --only smoke          # just the pages (build first)
node scripts/autopilot-check.mjs --routes /avengers --shots 0012 --phone
node scripts/autopilot-log.mjs --next                  # the next entry number
```

## Files

| Where | What |
| --- | --- |
| `.claude/skills/autopilot/SKILL.md` | the protocol every run follows |
| `docs/autopilot/backlog.md` | what to do next, in order; ticked as it's done |
| `docs/autopilot/budget.json` | `paused`, `runsPerDay`, `stopAtUtilization` |
| `src/data/changes/*.json`, `src/data/changes.js` | the ship's log, one file an entry |
| `src/pages/Changes.jsx` | the `/changes` page |
| `public/changes/` | the screenshots |
| `scripts/autopilot-check.mjs` | the gate: lint, tests, build, bundle, smoke, screenshots |
| `scripts/autopilot-log.mjs` | writes an entry |
| `scripts/autopilot-revert.mjs` | takes a change out |
| `.github/workflows/ci.yml` | lint, tests, build on every pull request |
