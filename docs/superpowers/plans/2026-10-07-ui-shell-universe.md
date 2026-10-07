# One house UI: the shell, the classic pages and the universe map (stream C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One token layer, one component per concept, one word per thing across the shell, the classic pages and the universe map's HUD, without changing the site's character.

**Architecture:** Tokens and the shared kit land in `src/index.css` and `src/components/ui.jsx` first; the glossary in `src/lib/words.js` with a test that greps the retired words out; then each surface is brought onto them one pull request at a time, screenshots before and after. The universe gets `hud.css` and `words.js` of its own, reading the shared ones.

**Tech Stack:** plain CSS on tokens, Tailwind 3 utilities, React 19, vitest; `scripts/autopilot-check.mjs` for screenshots.

**Spec:** `docs/superpowers/specs/2026-10-07-audience-tours-and-ui-audit-design.md`, sections 5.1–5.4 and 5.6. The findings: `docs/research/2026-10-07-tours-and-ui-audit/ui-shell-classic.md` and `ui-universe.md`. The findings are unverified claims: check each at its `file:line` and ask whether a strong designer would make the change without flattening the site (the `design-taste-frontend` skill's audit-first rules) before acting on it; drop the ones that fail.

## Global Constraints

- No visual redesign: colours, fonts, the house look and the nav map's style stay. A change is a consolidation, a spacing or type-scale fix, or a word.
- No pixel changes outside the finding being fixed: shoot before (`--before`) and after; compare by eye.
- Crew lines, in-world signs and fiction keep their words; only system text changes (the words test has an allow-list).
- One pull request per surface: tokens and kit; shell; each classic page group; the universe. Each green on CI and `node scripts/health.mjs --check --skip build`.
- Comments say why, British spelling, curly quotes.

## Review Focus

1. Dark mode and every company theme after the token changes: `--z-*`, `--fs-*`, `--t-*` must not change a colour; shoot `/home` in two themes and dark mode.
2. The phone nav at 390 px after `.seg`/`.kbd` consolidation: `navFit` still drops the right items.
3. The command palette's `kbd` and the guide's `kbd` after `.kbd`: same height, the palette's still readable on its backdrop.
4. The universe map's first minute on a phone after the button cull: the thumbs, the panel handle and the way in still reachable with the guide's `?` and the switcher clear.
5. The words test: a retired word inside a crew line must pass (allow-list), the same word in `UniversePanel.jsx` system text must fail.

---

### Task 1: Tokens

**Files:**
- Modify: `src/index.css:10-67` (add `--z-page/nav/float/sheet/dialog/cover/top`, `--t-fast/base/slow`, `--fs-xs … --fs-display-1` (eleven), `--shadow-float`, `--shadow-dialog`, `--edge-x/y`, `--page-top`, `--measure`), the existing rules that hard-code the values these replace (z-indexes in `extras.css`, `tour.css`, `offer.css`, `worldgate.css`, `commandpalette.css`; font sizes in `.eyebrow/.label/.lead` etc.)
- Test: `src/styles/tokens.test.js` (new): reads `src/index.css`, asserts each token exists once on `:root`, and that no stylesheet under `src/components` or `src/styles` sets `z-index:` to a bare number (list the files; allow a `/* why */` comment on the same line).

- [ ] Write the test; run; expect failures for the bare z-indexes.
- [ ] Add the tokens; replace the bare values; run; commit: "Tokens for depth, time and type".

### Task 2: The kit: `.kbd`, `.seg`, `<CloseButton>`, `<Layer>`, `<Notice>`, `icons.js`

**Files:**
- Modify: `src/components/ui.jsx`, `src/index.css`, `src/styles/extras.css`
- Create: `src/components/icons.js` (one export per meaning: `IconUniverse`, `IconGuide`, `IconTour`, `IconDownload`, `IconClose`, `IconGo`, …), `src/components/Layer.jsx`, `src/components/Notice.jsx`
- Test: `src/components/ui.test.js` (pure helpers only: `layerKind` class names, `noticeCorner`)

- [ ] `.kbd` from `.guide-kbd` (promote; keep `.guide-kbd` as an alias for one release); `.seg` from the six segmented controls (`extras.css:327-363,972-976,992-995,618-623`, `lazy/resume.css:17-19`, `lazy/travel.css:288-291`); `<CloseButton size>` 36/44 with `aria-label`; `<Layer kind="sheet|dialog|cover">` one backdrop colour, one entrance, Esc closes, focus return; `<Notice corner>` for the toast, the nudge, the tour offer and the world gate's pill.
- [ ] Move the four notices and the ten layers onto them one at a time, shooting the routes they appear on.
- [ ] Commit per component.

### Task 3: The glossary and its test

**Files:**
- Create: `src/lib/words.js`, `src/lib/words.test.js`

**Interfaces:**
- Produces: `WORDS = { universe: 'the universe', classic: 'the classic site', guide: 'the guide', colours: 'colours', startOver: 'Start over', navMap: 'the nav map', boost: 'boost', jump: 'jump', land: 'land', dock: 'dock', goIn: 'go in', leave: 'Leave', again: 'Again', menu: 'Menu', thingsToDo: 'Things to do', close: 'Close', esc: 'Esc', downloadPdf: 'Download the PDF', … }`; `RETIRED = [{ re: /\bnav computer\b/i, use: 'navMap' }, …]` from the spec's 5.2 table; `ALLOW = [/* file globs: crews.js, voicelines.js, in-world signs */]`.
- Test: walks the shell files (`src/components/*.jsx`, `src/components/guide/*`, `src/components/tour/*`, `src/pages/{Home,Experience,Projects,Resume,Contact,Travel,Changes,Terminal}.jsx`) and the universe HUD files (`UniversePanel.jsx`, `NavMap.jsx`, `Hangar.jsx`, `FlightSettings.jsx`, `online/*.jsx`, `nav.js` labels), extracts string literals and JSX text, and fails on a retired word outside `ALLOW`, naming file, line and the word to use.

- [ ] Write the test; run; it fails on today's wording (that list is the work).
- [ ] Commit the module and test (test allowed to fail until Tasks 4–6 land? No: never commit a red test. Instead the test takes a `PENDING` set of files it skips, emptied file by file as each task lands.)

### Task 4: The shell and the classic pages

**Files:**
- Modify: `src/components/Nav.jsx`, `ViewSwitch.jsx`, `Guide.jsx`, `GuidePanel.jsx`, `CommandPalette.jsx`, `Footer.jsx`, `Achievements.jsx` (toast), `feed/Feed.jsx`, `pages/{Home,Experience,Projects,Resume,Contact,Travel,Changes}.jsx`, `styles/extras.css`, `styles/lazy/*.css`

- [ ] Work through `ui-shell-classic.md` section 4 finding by finding, verified as the header says; apply the glossary; fold the duplicates listed in its section 3 (copy buttons, bullets, link styles, kicker styles, fact rows) into the kit or one component; the readability floor (`--fs-xs` minimum, muted 4.5:1); touch targets 44 px on coarse pointers; the page header rhythm on Experience, Résumé and Travel.
- [ ] One pull request for the shell, one for the pages. Shots: `/home`, `/experience`, `/projects`, `/resume`, `/contact`, `/travel`, `/changes`, desktop and `--phone`.

### Task 5: The universe map's HUD

**Files:**
- Create: `src/components/universe/hud.css` (`--hud-pad`, the rows, `hud-sheet`, `hud-dialog`, `hud-chip`, `hud-toast`, `hud-cta`, `--hud-warn`, four alphas), `src/components/universe/words.js` (the universe rows of the glossary: drives, places, verbs; imported by the panel, the nav map, the scene's prompts, `guide/pages.js`'s `/universe` entry and `tour/briefs.js`'s `/universe/fly`)
- Modify: `UniversePanel.jsx`, `UniverseMap.jsx` (HUD parts), `NavMap.jsx` (words only), `Hangar.jsx`, `FlightSettings.jsx`, `Comms.jsx`, `online/*.jsx`, `universe.css`, `online.css`, `scene.js` (prompt strings), `nav.js` (labels)

- [ ] Follow `ui-universe.md` section 10's order: tokens and rows; the glossary; readability (text over 3D on glass, the first-flight hint cut to five keys, the panel's paragraph to one sentence); staging (the phone's first minute). Verify each finding first.
- [ ] Shots: `/universe` desktop and phone, with a ship picked (seed `tp-universe-ship`) and without.
- [ ] Commit per step; one pull request.

### Task 6: Rules written down

**Files:**
- Modify: `docs/health/RULES.md` (a "UI" section: the spec's 5.1 and the glossary's location)
- Create: `scripts/health/kbd-styles.mjs` (rules styling `kbd` outside `src/index.css`; lower is better), register it in `scripts/health.mjs`, add a fixture under `scripts/health/fixtures/`, extend `scripts/health.test.mjs`; add its budget to `docs/health/budgets.json` at today's value.

- [ ] Commit; open the pull request.
