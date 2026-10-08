# One house UI: the worlds' HUD kit (stream D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Revision 2 (read first):** the spec's section 8 lists amendments D1–D4: kit components take resolved props only and the Menu opens the guide through `openGuide` from `src/lib/palette.js`, never `GuideLink` (D1); `hud.js` keeps Invincible's signatures so its tests move verbatim (D2); the Shire's stylesheet is `src/components/middleearth/shire/shire.css` (D3); the Menu's way out reads the view: "Universe map" or "Classic site" (D4). Strike "or the `GuideLink`" from the Global Constraints.

**Goal:** One HUD kit in the world runtime, laid out by tested rules, that every world's HUD is moved onto one pull request at a time, each keeping its own face and colours, so spacing, words and components agree across the worlds.

**Architecture:** `src/runtime/hud/` holds pure rules (`hud.js`), the frame (`Hud.jsx`), one component per concept and `hud.css` with the spacing tokens. Invincible's `hud.js`/`InvHud.jsx` is the model and moves in first; `TownHud.jsx` second (fourteen worlds share it); then one world per pull request. Skins are CSS variables, as the Shire family already does.

**Tech Stack:** React 19, plain CSS, vitest (pure rules), `scripts/autopilot-check.mjs` screenshots.

**Spec:** `docs/superpowers/specs/2026-10-07-audience-tours-and-ui-audit-design.md`, sections 5.5 and 5.6. The findings and the world × concept table: `docs/research/2026-10-07-tours-and-ui-audit/ui-worlds-games.md` (unverified claims: check each at its `file:line` before acting). Rules of the house: `docs/health/RULES.md` (worlds are islands; a repair changes no pixel except the one intended; files under 800 lines).

## Global Constraints

- A world imports the kit from `src/runtime/hud` only; never from another world.
- Each migration changes positions only to the kit's rows, words only to the glossary (spec 5.2), and components only to the kit's; the world's title face, big-number face and colours stay through skin variables.
- Before and after screenshots per world, desktop and `--phone`, compared by eye; the world's own check script where one exists (`scripts/*-check.mjs`, `scripts/abq-qa.mjs`).
- No game-rule change. HUD numbers written to refs in the frame loop, not state (Invincible's pattern).
- Every world's "Controls" opens the site's guide (`openGuide` or the `GuideLink`), so keys are written once in `guide/pages.js`.
- Nothing under 0.7 rem; text over the 3D on `--hud-glass` (no blur over a live scene).

## Review Focus

1. A phone with the guide's `?` tucked and a world's thumbs: the right column reserves `--guide-reserve`; nothing overlaps at 390 × 844 with safe-area insets.
2. The Shire family after `TownHud` moves: all fourteen skins still apply (`--shire-glass`, `--shire-gold`, `--shire-line` renamed to `--hud-*` with the old names aliased for one release).
3. The achievement toast on a world route: moved off the HUD's foot (top centre or above the thumbs), still readable.
4. A world whose minimap was a 150 px canvas: drawn at device pixel ratio, same CSS size as before.
5. The kit's `kbd` and stream C's `.kbd`: D ships `.kbd` in `hud.css` scoped under `.hud`; when C's global lands, D's rule is deleted (note in the handoff).

---

### Task 1: The kit's rules (pure)

**Files:**
- Create: `src/runtime/hud/hud.js`, `src/runtime/hud/hud.test.js`
- Reference: `src/components/invincible/world/hud.js` and its test

**Interfaces:**
- Produces: `layoutRows({ view, touch, buttonsBottom }) -> { top, foot, thumbs }` (y offsets from tokens and the measured buttons); `titleMode({ moved, objective, t }) -> 'full' | 'chip'` (chip 2.5 s after the first move or at once with an objective); `objectiveText({ label, metres }) -> 'label · 310 m'`; `markerSize(d) >= 24`; `stackUnder(items, gap) -> tops[]`; `layoutCompass` generalised from Invincible's; `promptText({ key, verb, thing }) -> 'E Go in · Burger Mart'`.

- [ ] Port Invincible's tests, add the new ones; run; implement; commit: "The HUD's rules, for every world".

### Task 2: The components and the tokens

**Files:**
- Create: `src/runtime/hud/Hud.jsx` (frame: top row with title, objective, counters slot, one `Menu`; foot row; thumbs row; `data-touch`), `Menu.jsx` (Settings, Controls → guide, Things to do, Players, Universe map; closes on Esc and click-away), `Prompt.jsx`, `Objective.jsx`, `Toast.jsx` (top centre), `Bubble.jsx` and `QuestList.jsx` (moved from `src/components/middleearth/towns/TownHud.jsx`, re-exported there), `PlayersChip.jsx` ("N others here"), `Stick.jsx` (116/46, from the best existing stick: compare `src/components/games/pad.js` and the sticks listed in the research's section 6), `TouchButton.jsx` (64, 52), `hud.css` (`--hud-pad: clamp(0.75rem, 2vw, 1.25rem)`, `--hud-pad-b: max(var(--hud-pad), env(safe-area-inset-bottom))`, `--guide-reserve: calc(16px + 42px + 0.9rem)`, `--hud-foot`, `--hud-glass`, `--z-place`, `.hud kbd`)
- Modify: `src/runtime/runtime.css` (import or sit beside), `src/runtime/README` comment in `WorldHost.jsx`

- [ ] Build each; a Storybook is not in the repo, so check in a world (Task 3). Commit per component.

### Task 3: Invincible onto the kit

**Files:**
- Modify: `src/components/invincible/world/InvHud.jsx`, `InvWorld.jsx`, `world.css`; delete `src/components/invincible/world/hud.js` (its tests moved in Task 1)

- [ ] `node scripts/autopilot-check.mjs --skip lint,test --routes /invincible --shots hud-inv --before` on `main` first.
- [ ] Replace the magic numbers (`world.css:139` 9.5 rem, `:133` `+112px`) with the rows; "Controls" opens the guide; add `GuideCue` to the first hint. Shots after; compare. Commit; pull request.

### Task 4: TownHud onto the kit (fourteen worlds)

**Files:**
- Modify: `src/components/middleearth/towns/TownHud.jsx` (becomes a thin skin over the kit), `shire.css` (positions from the kit; the hand sum at `:99` goes), the skins in `office/world/world.css`, `rickmorty/citadel/citadel.css`, each town's css (variable renames aliased)

- [ ] Shots before on `/middle-earth/shire`, `/scranton`, `/c-137/citadel`, one more town; migrate; shots after; pull request.

### Task 5: One world a pull request

In this order, each with before/after shots and its check script: Albuquerque (`AbqWorld.jsx`, four bottom buttons → Menu), Avengers (`CompoundWorld.jsx`, up to nine chips → Menu + counters), C-137 (`RmWorld.jsx`), Cybertron (`GameWorld.jsx`, show the `?` instead of hiding it), Dot Matrix (`DotMatrixWorld.jsx`, the B/X key mismatch), Earth (`EarthWorld.jsx`), the galaxy surface (`GalaxySurface.jsx`, `ChaseHud.jsx`, `AssaultHud.jsx`, `WarHud.jsx`), the Caribbean (`DeadMansTide.jsx`), Mario 64, Minecraft, the music room, the Death Star's trench run. Where a world's HUD sits inside a world file over 800 lines, move the HUD markup into `<World>Hud.jsx` first (the rules' split recipe), as its own commit.

- [ ] For each: verify the findings for that world in `ui-worlds-games.md`; migrate; words from the glossary ("Leave" + Esc, "Things to do", "Menu", "Again", "Close"); shots; pull request.

### Task 6: The toast, the metrics, the rules

**Files:**
- Modify: `src/components/Achievements.jsx:337-357` (toast position on world routes: read `worldAt(pathname)`), `docs/health/RULES.md` (HUD section), `scripts/health.mjs` + `scripts/health/hud-kit.mjs` (worlds whose HUD imports nothing from `src/runtime/hud`; fixture; test; budget at today's value)

- [ ] Commit; pull request. Update `docs/superpowers/HANDOFF-world-runtime.md` with the kit and the migration order's state.
