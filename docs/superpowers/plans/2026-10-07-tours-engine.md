# Tour engine (stream A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Revision 2 (read first):** the spec's section 8 lists amendments A1–A19 after a review; they override this plan's text where they differ. In short: `clear()` not `busy()` (A1); two waits and `resolveChapter`, no `rendered()` (A2); ending on POP/PUSH only, feed moves ignored (A3); `release: ['?', 'palette']` is its own field, never `keys` (A4); `ctx = { key, touch, ship }` (A5); `openTour` ignores Event arguments, `?tour=hiring` alias (A6); dots per chapter, `actions` as their own row (A7); chapter `brief` marks the basics seen (A8); the panel untucks while touring (A9); light-route actions are excursions with a carry-on notice (A10); toasts queue (A11); the scene pauses under a centred card (A12); `SHELL_STOPS` values given (A13); `addVisited(list, key)` (A14); `done: { key, is } | null`, no passwords/ROMs in the catalogue (A15); `openGuide({ tab: 'checklist' })` and the tab is called "The checklist" (A16, A17); `heavy` chapters (A18); `matchPath` in route tests (A19). `isPaletteKey` lives in `src/lib/palette.js` (not a combo that already exists there).

**Goal:** Make the site tour able to carry an audience, cross routes, save progress, start from a link, and read its stops from a things-to-do catalogue that the guide also lists as a checklist.

**Architecture:** The pure rules stay in `src/lib/tour.js` (progress, link parsing, plan composition, readiness) and a new `src/lib/visited.js`; `src/components/tour/TourHost.jsx` learns to navigate and wait; `src/components/tour/Tour.jsx` learns a waiting state and a `cta` button; `src/data/todo.js` is the catalogue; `GuidePanel.jsx` gains a "Things to do" tab. Stream B writes the copy against the interfaces fixed here.

**Tech Stack:** React 19, react-router-dom 7 (HashRouter), vitest (Node, no DOM), plain CSS on the theme tokens.

**Spec:** `docs/superpowers/specs/2026-10-07-audience-tours-and-ui-audit-design.md`, sections 3.2–3.5, 3.8 and 4. Read `docs/research/2026-10-07-tours-and-ui-audit/tour-system.md` sections 8 and 11 first: they list what breaks on a route change.

## Interface as built (revision 2; stream B: follow these)

Everything in the spec's section 8 for stream A is in. Where the code chose between readings:

- **Stops**: `{ id, title, text: string | ({ key, touch, ship }) => string, at?, keys?, touch?, release?: ['?', 'palette'], wait?: true, actions?: [{ label, to? , href?, download?, tour? }], todo? }`. `keys`/`touch` are only ever the key-table rows. At most four actions are drawn. An action with `to` on a light route is an excursion (the tour stops, a note offers "Carry on … · chapter n of N" with Carry on and Stop); any other `to` ends the tour; `tour` ends this one (as done when it is the last stop) and starts that audience; `href` is a plain link (`download` for the PDF).
- **Chapters**: `{ id, title, path, stops, brief?, heavy?, phone? }`. `path: null` stays on the page before. `brief: '/universe/fly'` replaces `stops` with `BRIEFS[brief]` and marks the basics seen once its last stop is passed. `heavy: true` with `phone: { path?, stops, title? }`: on a coarse pointer the chapter is `{ ...chapter, ...phone }`.
- **`compose(TOURS, [['recruiter', 'home', 'hood'], ['player', 'galaxy', 'colours'], END])`**: by chapter id, inclusive; a chapter object goes in as it is. An id it can't find throws (B's test sees it at import).
- **`planFor(tours, audience, view, here, { coarse })`** prepends `{ id: 'shell', title: 'Getting about', path, stops }` with `SHELL_STOPS` (spec A13; `mixed` uses the hiring tour's). The shell has no hello; B's lists open with their own (A13's `chapters/shared.js` hello) as the first stop of their first chapter.
- **`startAt(chapters, { chapter, stop, todo })`** → `{ c, stop }` or null; `openTour({ audience, chapter?, stop?, todo?, to?, only? })`; `only: true` runs one chapter alone (the guide's chapter list) and finishing it is not finishing the tour. An audience with no chapters yet falls back to the view's tour.
- **The catalogue**: `THINGS_TO_DO` (not `TODO`: the health check counts the uppercase word), `todoFor`, `isDone(row, { unlocked, visited, stored })`, `done` one of `{ achievement }`, `{ visited }` (a route or a list, all needed), `{ key, is? }` (`SHELL_KEYS` in `src/lib/visited.js`; `storedKey` reads local then session storage), or `null`. A stop's `todo` is a row's `id`.
- **Visited**: the shell records the pathname and, when different, `guideKeyFor(pathname)` (A14 says the key; A15's row ticks on the exact project path; both are kept).
- **The guide**: tab ids `'page' | 'site' | 'checklist'`, the third named "The checklist"; `openGuide({ tab: 'checklist' })`; the terminal's `checklist` (`todo` still works); ⌘K "Open the checklist".
- **Names**: `TOUR_NAMES` = "The hiring tour", "The player’s tour", "The whole tour"; links take `?tour=hiring|recruiter|player|all`; the offer's buttons "I’m hiring", "I’m here to play", "Both".
- **Achievements**: `tourRecruiter`, `tourPlayer` exist (B's Task 4 is done).
- `steps.test.js` passes `ctx = { key, touch, ship }`, and its key test accepts the five names. Its other cases still assume flat lists; B extends them to chapter lists.

## Global Constraints

- Tests beside files, Node only, under a second, no network (`docs/health/RULES.md`). Never skip or quieten a test.
- `src/data` imports nothing but data; `src/lib` knows no React (`RULES.md`, Layers).
- A chapter `path` is a light route only: `/home`, `/experience`, `/projects`, `/projects/:id`, `/resume`, `/contact`, `/travel`, `/terminal`, `/changes`, `/universe`. Never `/`. Worlds by `cta` only.
- The tour never auto-loads a world; a `cta` ends the tour with progress saved.
- `tp-tour` keeps "unset means offer" semantics; old string values still read.
- Copy: British spelling, curly quotes, sentence case. Comments say why, in the file's voice.
- `node scripts/health.mjs --check --skip build` must stay green (no new big files, no lint disables).

## Review Focus

1. A link `?tour=recruiter` on a first visit at `/#/home`: the intro gate does not fire there, but the offer must not race the deep link (write `tp-tour` before the 1200 ms poll).
2. A stop whose chapter page never renders its target (a nav item dropped by `navFit` at this width): the 8 s timeout shows the centred card; the tour never hangs.
3. The browser Back button during an audience tour: the tour ends cleanly, inert is lifted, focus returns.
4. A `cta` taken into a gated world on a phone: the gate shows as today, the basics follow, the tour's progress is saved at that chapter.
5. Old `tp-tour` values `'done'`, `'skipped'`, `'offered'` and garbage JSON: no throw, sensible shape.

---

### Task 1: Progress, link parsing and the run detail (pure)

**Files:**
- Modify: `src/lib/tour.js`
- Test: `src/lib/tour.test.js`

**Interfaces:**
- Produces: `readProgress(raw) -> { offered: boolean, audience?: string, chapter?: string, stop?: string, done: string[] }`; `writeProgress(prev, patch) -> object`; `parseTourLink(search) -> { audience, chapter? } | null` (accepts `tour=recruiter|player|all`, maps `all` to `mixed`); `openTour(detail?)` now dispatches `new CustomEvent(TOUR_EVENT, { detail })`; `AUDIENCES = ['recruiter', 'player', 'mixed']`; `LIGHT_ROUTES` regex.

- [ ] Write failing tests for `readProgress` (strings, bad JSON, new shape), `writeProgress`, `parseTourLink`, `isLightRoute`.
- [ ] Run `npx vitest run src/lib/tour.test.js`; expect failures naming the missing exports.
- [ ] Implement in `src/lib/tour.js`. Keep `TOUR_KEY`, `offerHere` (now `offerHere(pathname, progress)` where `progress == null` means offer).
- [ ] Run the test; expect pass. Run `src/lib/restart.test.js` too.
- [ ] Commit: "The tour keeps structured progress and reads an audience from a link".

### Task 2: Plans and chapters (pure)

**Files:**
- Modify: `src/lib/tour.js`
- Test: `src/lib/tour.test.js`

**Interfaces:**
- Consumes: `TOURS` (from `steps.js`) now has `universe`, `classic` (flat stop lists, as today) and `recruiter`, `player`, `mixed` as chapter lists `[{ id, title, path, stops }]`. `mixed` is `compose(TOURS, [['recruiter', 1, 7], ['player', 2, 9], 'end'])`. (Stream B fills them; this task uses fixtures.)
- Produces: `planFor(tours, audience, view) -> chapters[]` (prepends the view's tour as chapter `shell`, trimmed to stops whose ids are in `SHELL_STOPS[audience]`); `flatten(chapters) -> stops[]` with each stop carrying `chapter` and `path`; `nextIndex(stops, i, dir) -> number`; `compose(tours, recipe)`; `stopIndexFor(stops, { chapter, stop, todo })`.

- [ ] Write failing tests with a small fixture of two chapter lists: shell chapter first and trimmed; mixed order and unique ids; `flatten` stamps `path`; `stopIndexFor` by chapter, by stop id, by todo id, and -1 when absent.
- [ ] Run; expect failures.
- [ ] Implement.
- [ ] Run; expect pass. Commit: "The tour's plan: chapters, composition and where a link lands".

### Task 3: Readiness (pure)

**Files:**
- Modify: `src/lib/tour.js`
- Test: `src/lib/tour.test.js`

**Interfaces:**
- Produces: `readyFor(stop, { busy, hasTarget, rendered }) -> boolean` (true when `!busy() && rendered() && (!stop.at || hasTarget(stop.at))`); `WAIT_MS = 8000`; `waitUntil(check, { tick, timeout, now }) -> Promise<'ready' | 'timeout'>` with injected timers (no real `setTimeout` in tests).

- [ ] Tests: ready when all predicates hold; not ready while busy; a stop without `at` ignores `hasTarget`; `waitUntil` resolves `ready` on the tick that passes, `timeout` after `WAIT_MS` of ticks.
- [ ] Implement; run; commit: "A stop waits until its page is ready, eight seconds at most".

### Task 4: Visited routes (pure) and the shell writing them

**Files:**
- Create: `src/lib/visited.js`, `src/lib/visited.test.js`
- Modify: `src/lib/restart.js` (add `tp-visited-ever`), `src/lib/restart.test.js`, `src/App.jsx` (write on pathname change, in the existing effect near `ScrollToTop`)

**Interfaces:**
- Produces: `VISITED_KEY = 'tp-visited-ever'`; `addVisited(list, pathname) -> list` (normalises to the route's guide key or the path for projects; cap 200); `hasVisited(list, to) -> boolean` (prefix match for a world's deeper paths).

- [ ] Tests for `addVisited` (dedup, cap, normalisation) and `hasVisited`.
- [ ] Implement; wire in `App.jsx` with `local.get/set`; add the key to `restart.js`; update `restart.test.js`.
- [ ] Run `npx vitest run src/lib`; commit: "The site remembers which pages it has shown you".

### Task 5: The catalogue

**Files:**
- Create: `src/data/todo.js`, `src/data/todo.test.js`

**Interfaces:**
- Produces: `TODO = [{ id, title, to, area, kind, audience, seconds, phone, blurb, done: { achievement } | { visited } }]`, about sixty rows from `docs/research/2026-10-07-tours-and-ui-audit/things-to-do.md` ("Recruiter-tour shortlist" plus two or three headline rows per world); `todoFor(audience) -> rows` (`mixed` is all); `isDone(row, { unlocked, visited }) -> boolean`.

- [ ] Tests: ids unique; every `to` is a route in `src/App.jsx` (read the file as `steps.test.js`'s `marked()` does) or a hash/query on one; `area` is a key of `GUIDES`; `done.achievement` is a key of `ACHIEVEMENTS` (import from `src/components/Achievements.jsx` in the test only); `audience` in the three; `seconds` a positive number; `blurb` under 140 characters, curly quotes only.
- [ ] Write the rows; run; commit: "The catalogue of things to do".

### Task 6: TourHost carries the audience, navigates and waits

**Files:**
- Modify: `src/components/tour/TourHost.jsx`, `src/components/tour/Tour.jsx`, `src/components/tour/tour.css`

**Interfaces:**
- Consumes: Tasks 1–3. `Tour` receives `stops` (flattened), `start` index, `onNavigate(path)`, `onProgress(i)`, `onEnd(how)`, `onCta(to)`.
- Produces: `TourHost` handles `tp:tour` with `detail = { audience, chapter?, stop?, todo? }` or none (view tour, as today); reads `?tour=` on mount and on `search` change, writes progress, strips the parameter with `navigate(pathname, { replace: true })`, starts the tour; key `tour:<audience>` stable across routes; the kind-flip effect applies to view tours only; an audience tour ends when the pathname changes to one the tour did not ask for.

- [ ] In `Tour.jsx`: a `waiting` state per stop: on index change, if `stop.path !== location.pathname` call `onNavigate(stop.path)`; then `waitUntil(() => readyFor(stop, { busy, hasTarget: (n) => Boolean(targetOf(n)), rendered }))`; while waiting show the card centred with the chapter title and "One moment…"; on `timeout` show the stop centred. `rendered()` = `#main` has an element child that is not the Suspense fallback (give the fallback `data-fallback`). Keep `inertBehind` but re-run it after a navigate (new `footer`).
- [ ] `cta`: a `.btn .btn-ghost .btn-sm` on the card; clicking calls `onCta(to)`: `TourHost` saves progress, ends the run, navigates.
- [ ] `keys: 'release'`: at such a stop the capture handler lets `?` and the palette shortcut through (check `e.key === '?'` and the palette's combo from `src/lib/palette.js`).
- [ ] Progress: `onProgress(i)` writes `{ audience, chapter, stop }` every stop; `done` adds the audience at the end; `mixed` adds both.
- [ ] Achievements: `unlock('tour')` as today plus `tourRecruiter`/`tourPlayer` (stream B adds the ids to `ACHIEVEMENTS`; add them here if B has not: `tourRecruiter: { name: 'Shown the work', desc: 'Took the recruiter’s tour' }`, `tourPlayer: { name: 'Shown the ropes', desc: 'Took the player’s tour' }`).
- [ ] Hand-check in the browser (`npm run dev`, or the autopilot check with `--routes /home,/universe`): dispatch `window.dispatchEvent(new CustomEvent('tp:tour', { detail: { audience: 'recruiter' } }))` with a fixture chapter list wired temporarily if B's copy is not merged; the card follows across `/home` → `/experience`.
- [ ] Commit: "The tour crosses pages: it navigates, waits for the page, and saves where you are".

### Task 7: The offer asks who you are; ⌘K, the guide's site tab and the terminal

**Files:**
- Modify: `src/components/tour/TourHost.jsx` (the offer), `src/components/tour/offer.css`, `src/components/CommandPalette.jsx:92`, `src/components/GuidePanel.jsx:86-95`, `src/pages/Terminal.jsx:92,518-521`

- [ ] Offer: "New here? Here to hire, here to play, or both?" with buttons Hire, Play, Both (`btn btn-primary btn-sm` for Both, ghosts for the others) and "Not now"; wraps on a phone.
- [ ] Palette: three items replacing `a-tour`, keywords kept; a fourth "Things to do" opening the guide's tab (Task 8).
- [ ] Guide's "The site" tab: three buttons; under each, a disclosure listing the chapters (titles from `TOURS`), each starting at that chapter; "Carry on the … tour (chapter n of N)" when progress has an unfinished audience.
- [ ] Terminal: `tour`, `tour recruiter`, `tour player`, `tour all`; `help` line updated.
- [ ] Update `src/components/tour/steps.test.js` key assertion to the five names (coordinate with B: B owns the content; this task only widens the assertion).
- [ ] Commit: "Four ways into the three tours".

### Task 8: The "Things to do" tab

**Files:**
- Modify: `src/components/GuidePanel.jsx`, `src/components/Guide.jsx` (tab list), `src/styles/extras.css` (guide styles) or a new `src/components/guide/todo.css`
- Create: `src/components/guide/TodoList.jsx`

**Interfaces:**
- Consumes: `TODO`, `todoFor`, `isDone` (Task 5); `useAchievements().unlocked`; `local.get(VISITED_KEY, [])`; `openTour({ audience, todo })` (Task 6, `stopIndexFor` by `todo`).

- [ ] `TodoList`: a `.seg` filter (Hire, Play, Everything; default from the last tour's audience, else Everything), "n of N done", groups by `area` in the guide's order with the guide's titles, each row: title, blurb, `seconds` as "1 min", a tick (`RiCheckLine`) when done, "Show me" (`btn btn-ghost btn-sm`) calling `openTour({ audience: filter, todo: row.id })`, which falls back to `navigate(row.to)` when no stop has that `todo` (TourHost does the fallback).
- [ ] Phone: rows wrap; the tab scrolls inside the panel as the others do.
- [ ] Commit: "Things to do: the guide lists what there is, and ticks it off".

### Task 9: Hand-off

- [ ] `npm run lint && npm test && node scripts/health.mjs --check --skip build`.
- [ ] `node scripts/autopilot-check.mjs --routes /home,/universe --shots tours-a` and look at the shots.
- [ ] Update `docs/superpowers/HANDOFF-site-tour.md` ("Done" and "Checking it") for the engine; commit; open the pull request against `main` with the before/after shots.
