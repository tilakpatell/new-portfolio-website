# Tour content (stream B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Revision 2 (read first):** the spec's section 8 lists amendments B1–B6 (and A5–A8, A13, A19, C3, which change what you write against). In short: Flying is the brief, not copy (B1); 13 world cards, galaxy and Death Star in chapter 3, first sentence from `PAGES[key].about` (B2); no achievements target, fold into the checklist chapter (B3); the hiring tour's stop order and targets changed, chapter 7 is `heavy` with a phone version, the end card uses `actions` (B4); the time budget and word caps (B5); end chapters `path: null`, the ships stop reads `ctx.ship` (B6); the stop shape in the Global Constraints below is superseded by spec 3.2 as amended (`actions`, `release`, `wait`; chapter `brief`, `heavy`, `path: null`); the visitor-facing name is "the hiring tour" (C3). Mixed composes by chapter id (spec 3.6).

**Goal:** Write the recruiter, player and mixed tours (chapters and stops), mark their targets in the pages, add the two achievements, and a Playwright walker that takes every tour end to end.

**Architecture:** Copy in `src/components/tour/chapters/{shared,recruiter,player}.js`, exported through `steps.js`'s `TOURS` as chapter lists; `data-tour` markers on the pages' own headings and controls; `scripts/tour-check.mjs` modelled on `scripts/autopilot-check.mjs`. Written against stream A's interfaces (`docs/superpowers/plans/2026-10-07-tours-engine.md`, Tasks 1–3 and 6); rebase on A before the pull request.

**Tech Stack:** plain JS data modules, vitest, playwright-core with the pre-installed Chromium.

**Spec:** `docs/superpowers/specs/2026-10-07-audience-tours-and-ui-audit-design.md`, sections 3.1, 3.2, 3.6, 3.7, 3.8. Source material: `docs/research/2026-10-07-tours-and-ui-audit/things-to-do.md` (the recruiter shortlist and each world's section) and the existing voice in `src/components/tour/steps.js` and `briefs.js`.

## Global Constraints

- The stop shape: `{ id, title, text: string | ({ key }) => string, at?, keys?, touch?, cta?: { label, to }, todo?: string, keys?: 'release' }`. A chapter: `{ id, title, path, stops }`. `TOURS.mixed = compose(TOURS, [['recruiter', 1, 7], ['player', 2, 9], 'end'])`.
- A chapter `path` is a light route (A's `LIGHT_ROUTES`); worlds, the galaxy and the Death Star by `cta` only; a `cta` card says the download size on a phone where `WORLD_MB` is over 10.
- Voice: short sentences, the site's own words, British spelling, curly quotes, no exclamation marks in a row; text per stop 12–45 words; the first stop of a tour has no `at`; the last mentions the guide or the checklist.
- Every `at` is marked somewhere under `src/components` or `src/pages` (extend `steps.test.js`'s `marked()` to read `src/pages` too).
- Only add attributes to pages stream C may be editing; never restyle in this stream.

## Review Focus

1. A recruiter tour on a phone: the nav's `pages`, `search`, `colours` stops fold into `menu`; every chapter still has at least one lit stop or a readable centred card.
2. A player tour started on the classic site (`view = classic`): chapter 2 navigates to `/universe` and waits for the map's panel; the stop's target is the panel, not a ship (no ship may be picked).
3. Word count: each audience tour reads in under the spec's minutes (words ÷ 3 per second plus 4 s a stop); the test enforces it.
4. The world cards' `cta` routes all exist and are gated worlds on a phone: the card's text says the size.
5. The walker's console-error filter uses `scripts/lib/noise.mjs`, as the autopilot check does, so a real error is not hidden.

---

### Task 1: Shared stops and the recruiter tour

**Files:**
- Create: `src/components/tour/chapters/shared.js`, `src/components/tour/chapters/recruiter.js`
- Modify: `src/components/tour/steps.js` (export `TOURS.recruiter`), `src/components/tour/steps.test.js`

- [ ] Extend `steps.test.js`: `TOURS` keys `['classic', 'universe', 'recruiter', 'player', 'mixed']`; for chapter tours: `path` matches the light-route list; ids unique across chapters; every `at` marked (pages included); every `cta.to` a route in `App.jsx`; every `todo` an id in `src/data/todo.js` (skip gracefully with a clear message if A's catalogue is not merged yet); the reading-time budget. Run; expect failure.
- [ ] Write the eight recruiter chapters from the spec's 3.6, using the research shortlist's showcase notes for the engineering lines. Chapter 7's stops reuse `panel`, `ships`, `navmap` targets and new `online`.
- [ ] Run the tests; commit: "The recruiter’s tour: the work, in five minutes".

### Task 2: The player tour and the mixed composition

**Files:**
- Create: `src/components/tour/chapters/player.js`
- Modify: `src/components/tour/steps.js` (`TOURS.player`, `TOURS.mixed`)

- [ ] Ten player chapters per the spec. Chapter 4 ("The worlds"): one card per world from `WORLDS` order in `src/components/worlds/worlds.js`, each with two or three headline things from the research's world sections and `cta: { label: 'Go there', to }`; a helper `worldCards()` builds them so the list cannot drift from `WORLDS` (test: one card per world).
- [ ] `mixed` via A's `compose`; until A merges, a local `compose` with the same signature in `steps.js` guarded by a comment, removed on rebase.
- [ ] Tests pass; commit: "The player’s tour, and the whole tour as the two folded together".

### Task 3: Targets in the pages

**Files:**
- Modify: `src/pages/Home.jsx` (`home-github`, `home-gameboy`), `src/pages/Experience.jsx` (`experience-roles`), `src/pages/Projects.jsx` (`projects-cartridges`, `projects-table`), `src/pages/Resume.jsx` (`resume-skills`, `resume-pdf`), `src/pages/Contact.jsx` (`contact-form`), `src/pages/Travel.jsx` (`travel-globe`), `src/pages/Changes.jsx` (`changes-log`), `src/pages/Terminal.jsx` (`terminal-input`), `src/components/universe/online/Online.jsx` (`online`), the achievements button (`achievements`; find it: `grep -rn "Achievements" src/components/Nav.jsx src/components/universe/UniversePanel.jsx`)

- [ ] Add `data-tour="…"` to the element that is the heading or the control itself (not a wrapper that spans the viewport). Where a section is lazy (the globe, the cartridges), mark the section's heading so the target exists before the 3D does.
- [ ] `npx vitest run src/components/tour`; commit: "Marks on the pages for the tours to light".

### Task 4: The achievements

**Files:**
- Modify: `src/components/Achievements.jsx` (`tourRecruiter`, `tourPlayer` after `tour`)

- [ ] Add the two ids and names from A's plan Task 6 (if A added them already, skip). Commit.

### Task 5: The walker

**Files:**
- Create: `scripts/tour-check.mjs`
- Modify: `scripts/autopilot-check.mjs` (run the walker when `--routes` includes a tour file? simpler: document the command in the handoff; optional flag `--tours`)

- [ ] `node scripts/tour-check.mjs [--phone] [--tour recruiter,player,mixed] [--shots <id>]`: build if `dist/` is stale (reuse the autopilot check's helpers by import or copy its `freePort`/serve pattern), serve, open a page with `tp-intro`, `tp-start`, `tp-quality` seeded as `autopilot-check.mjs:164-167` does, go to `/#/home?tour=recruiter` (player from `/#/universe`), then loop: wait up to 9 s for `.tour-spot` visible or `.tour-card[data-side="center"]` with text, record the stop's title and which, press `ArrowRight`; stop when the Done button appears and press it; assert the achievement toast or `tp-tour.done` includes the audience. Fail on a stop that timed out with a target, or a console error outside `NOISE`. Print a table per tour; with `--shots` save a PNG per stop under `public/changes/`-style naming in a scratch folder (not committed).
- [ ] Run it for all three on desktop and phone; fix copy or targets it reveals; commit: "A walker that takes every tour".

### Task 6: Hand-off

- [ ] Rebase on `origin/claude/tours-engine` (or `main` if A merged); resolve `steps.js` and `steps.test.js`.
- [ ] `npm run lint && npm test && node scripts/health.mjs --check --skip build && node scripts/tour-check.mjs`.
- [ ] Update `docs/superpowers/HANDOFF-site-tour.md`; open the pull request with the walker's table in the body.
