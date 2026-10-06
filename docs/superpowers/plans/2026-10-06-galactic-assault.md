# Galactic Assault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Battlefront-style battle for command posts, two armies and you, playable on Hoth and Geonosis at `/galaxy/<system>/surface?mission=assault`.

**Architecture:** Pure, seeded, tested rules (`missions/assault.js`) run the posts, the phases, the tickets and every soldier; a drawing module (`missions/assaultScene.js`) shows them in the surface scene with the surface's own blaster, figures and models; the scene gains the mission kind beside the chase (shooting at the battle's targets, going down, deploying, Again); a HUD (`AssaultHud.jsx`) carries the choose, deploy, live and result cards. Maps are data on `missions/index.js`.

**Tech Stack:** React 19, three.js r186, Vitest, Playwright (headless Chromium) for the browser checks. **Spec:** `docs/superpowers/specs/2026-10-06-galactic-assault-design.md`

## Global Constraints

- No sequel-trilogy content. Lines are the site's own words; short famous lines only.
- Rules pure and tested, drawing apart. New pure logic gets its test first.
- No runtime calls to asset services: the snowtrooper is imported ahead by `scripts/sketchfab-surface.mjs people snowtrooper` and credited in `src/data/modelCredits.json` (done, in the first commit).
- Soldiers a side from `lib/device`'s tier: `high` 14, `mid` 9, `low` 6; the scene disposes everything it makes.
- British spelling, curly quotes in copy, comments say why. Commits one plain sentence.
- `docs/health/budgets.json`: no new file over 400 lines counts against `big-files` (30 now): keep `assault.js`, `assaultScene.js` and `AssaultHud.jsx` under it, or split.

## Review Focus

1. A long frame (a tab back from the background, `dt` 1 s): `stepBattle` substeps at 0.1 s so no soldier walks through a wall and no post flips in one tick (Task 1 test).
2. Every soldier of a side down and no tickets while you, on that side, are still up: not lost yet; lost the moment you go down (Task 1 test).
3. A post fought over by equal numbers: the meter holds, nothing flips (Task 1 test).
4. Deploying at a post your side doesn't hold (contested, or the enemy's): refused, no ticket spent (Task 1 test).
5. Again after a result, and Again while it runs: a fresh battle sharing nothing with the last, you back at the choose card (Task 5, dev-hook check).

---

### Task 1: The rules

**Files:** Create `src/components/galaxy/surface/missions/assault.js`, `src/components/galaxy/surface/missions/assault.test.js`

**Interfaces:**
- Consumes: `pushOut`, `createSolids` from `../walker`; `rng` from `../noise`; `starsFor` from `./chase`.
- Produces:
  - `RULES = { capture: 0.08, advantage: 4, respawn: 6, range: 48, every: 1.1, accuracy: [0.55, 0.15], damage: 26, yours: 34, atYou: 7, hp: 100, walk: 3, engaged: 0.65, turn: 4, step: 0.1, atYouMax: 3, spacing: 1.4, retarget: 2 }`, `SOLDIERS = { high: 14, mid: 9, low: 6 }`.
  - `newBattle(mission, { n = 14, seed = 1 } = {}) → battle` (phase `'choose'`, nobody moving).
  - `chooseSide(battle, side: 'attack' | 'defend')` → the battle starts (`'run'`), the defenders inside the live posts, the attackers at their fixed post.
  - `stepBattle(battle, dt, you: { x, z } | null, env: { solids, reach }) → events[]`: `{ type: 'shot', from: [x, y, z], to: [x, y, z], side, atYou, hit }`, `{ type: 'down', id, by }`, `{ type: 'spawn', id }`, `{ type: 'neutral', post, by }`, `{ type: 'capture', post, side, you }`, `{ type: 'phase', phase, name }`, `{ type: 'kill', victim, side, by }`, `{ type: 'end', won, why }`.
  - `hitSoldier(battle, id, damage = RULES.yours, by = 'you') → event | null`.
  - `deploy(battle, postId) → { x, z, yaw } | null` (a ticket spent on success); `canDeploy(battle, post) → boolean`; `youDown(battle)`.
  - `objectiveFor(battle, side, x, z) → [x, z] | null`.
  - `battleView(battle) → { phase, t, key, phaseIndex, phaseCount, phaseName, posts: [{ id, name, letter, owner, meter, taking, inside, live, fixed }], tickets, you: { side, up, kills, captures, in, state }, feed, result }`.
  - `endBattle(battle, won, why)` (dev hooks).

- [ ] Write the failing tests: `newBattle` lays the posts out owned by the defenders with the fixed ones fixed, nobody up before a side is chosen; `chooseSide('attack')` spawns `n` a side, defenders inside live posts, attackers within their fixed post; a lone attacker inside a defenders' post (no defenders) neutralises it in `1 / 0.08` s (±0.3) and captures it in as long again, five attackers no faster than four; equal numbers hold the meter; a soldier alone across an empty field reaches its post within `d / 3 + 5` s; capturing every post of the phase advances it and tops the attackers' tickets up to the phase's; a side with no tickets and nobody up loses, unless you're up on it; `hitSoldier` four times downs a soldier and credits you; `deploy` at an enemy or contested post is null and costs nothing, at a held one spends one; `stepBattle(b, 1)` takes ten steps (a post's meter moves by at most `0.08 × 4 × 1`); a no-player simulation of a map with 200 attack tickets against 20 defend tickets ends with the attackers winning within 15 minutes, and the reverse the other way; `battleView` names every post with a letter and a `key` that changes when a post flips.
- [ ] Run `npx vitest run src/components/galaxy/surface/missions/assault.test.js`: fails (module missing).
- [ ] Implement as the spec says. Soldier AI each substep: respawn when down long enough and tickets remain (attackers at their post nearest the live posts they don't hold, defenders inside a live post of theirs, else the fixed one); objective every `retarget` s (attackers: live posts not theirs, defenders: live posts of theirs with enemies in or none assigned; score = distance + 25 × assigned); walk toward a per-assignment spot inside the post, turning at `turn` rad/s, `engaged` of the speed while firing, still inside; `pushOut` against `env.solids.near(x, z, 2)` at r 0.45; separation at `spacing`; clamp to `env.reach`; nearest enemy in `range` (you first, up to `atYouMax`); fire on `cool`: at you an `atYou` shot event, at a soldier a hit by chance `lerp(accuracy[0], accuracy[1], d / range)`.
- [ ] Run the test file: passes.
- [ ] Commit: `The galactic assault's rules: posts, phases, tickets and the soldiers, pure and tested`.

### Task 2: The blaster's tracers and the figures' lookup

**Files:** Modify `src/components/galaxy/surface/blaster.js`, `blaster.test.js`, `src/components/galaxy/surface/actors.js`

**Interfaces:**
- Produces: `createBlaster({ parent, world, pool = 32 })` with `tracer(from: [x,y,z], to: [x,y,z], color)` (a bolt that flies from here to there, harms nobody, flashes where it lands); `anyFigure(kind, spec, kit) → Promise<figure | null>` exported from `actors.js` (a crew model, a catalogue model, a built figure, a humanoid prop: the order `createActors` uses); `createActors(...).hideKinds(kinds: string[], hidden = true)`.

- [ ] Test `sweptHit` stays as it is (the file's existing test) and add a pure test for the pool size arithmetic if any is factored out; otherwise this task's proof is the browser check in Task 5.
- [ ] Implement `tracer` (shoot with `theirs = false`, `end = to`), the `pool` option, `anyFigure` (lift `figureOf` out of the closure; `createActors` calls it), `hideKinds` (sets `hidden` on every actor whose `spec.kind` is listed, as `hide` does by id).
- [ ] `npx vitest run src/components/galaxy/surface`: passes.
- [ ] Commit: `The blaster fires tracers for the battle, and a figure for any kind can be asked for by name`.

### Task 3: The maps

**Files:** Modify `src/components/galaxy/surface/missions/index.js`, `index.test.js`

**Interfaces:**
- Produces: `MISSIONS.hoth.assault`, `MISSIONS.geonosis.assault`, each `{ id: 'assault', system, kind: 'assault', name, line, start, yaw, ride: null, stars, achievement: 'galacticassault', sides: { attack, defend }, posts, phases, tickets, hideLife, lines, barks, ends }`.
- Hoth: the Empire attacks from the walkers' line (fixed post *The walkers' line* near `[300, 300]`'s plain, at the fallen walker's flat), the Rebellion defends: phase 1 *The trenches* (`[100, 370]`, r 24) and *The shield generator* (`[90, 240]`, r 20); phase 2 *The ion cannon* (`[-30, 340]`, r 20); phase 3 *Echo Base* (the mouth of the hangar, `[-150, 200]`'s flat, r 26); fixed post *Echo Base's hangar* for the Rebellion inside the glacier flat behind it. Tickets attack 90 / defend 140; phase top-ups 90, 70, 60. Sides: `attack: { id: 'empire', name: 'The Galactic Empire', short: 'Empire', colour: '#9fd0ff' , kinds: [['snowtrooper', 1]] }`, `defend: { id: 'rebels', name: 'The Rebel Alliance', short: 'Rebellion', colour: '#ff8a5a', kinds: [['hothtrooper', 1]] }`. `hideLife: ['snowtrooper', 'hothtrooper', 'vader']`.
- Geonosis: the Republic attacks from *The landing zone* (fixed, at the first battle's flat `[260, 170]`), the Separatists defend: phase 1 *The forward command post* (`[120, 330]`, r 18) and *The arena gate* (`[-200, 170]`, r 22, on the arena's flat edge); phase 2 *The droid foundry* (`[-330, -230]`, r 24); phase 3 *The core ships* (`[470, -120]`, r 26); fixed *The hive* for the Separatists at `[-40, -420]`. Tickets attack 100 / defend 150. Sides: `attack: { id: 'republic', name: 'The Grand Army of the Republic', short: 'Republic', colour: '#9fd0ff', kinds: [['clone', 1]] }`, `defend: { id: 'separatists', name: 'The Confederacy of Independent Systems', short: 'Separatists', colour: '#ffb060', kinds: [['battledroid', 3], ['superdroid', 1]] }`. `hideLife: ['clone', 'battledroid', 'superdroid']`.

- [ ] Write the failing tests in `index.test.js`: every assault's posts stand on dry ground within `REACH` and on a flat of its site (a flat's `at` within `flat.r` of the post, or the landing flat); its phases name only posts there are, every non-fixed post once; each side has a fixed post; its kinds are kinds there are (`buildFigure`, `SURFACE_MODELS` or `PROPS`); `hideLife` names kinds in the site's life; `start` is at the defenders' fixed post or the attackers'; a no-player simulation of each map on its own solids ends inside 15 minutes.
- [ ] Run: fails. Add the maps. Run: passes.
- [ ] Commit: `Hoth and Geonosis get a galactic assault each: their posts, phases and sides`.

### Task 4: Drawing the battle

**Files:** Create `src/components/galaxy/surface/missions/assaultScene.js`

**Interfaces:**
- Consumes: Task 1's rules; `anyFigure`, `blaster.tracer`, `blaster.enemy`.
- Produces: `createAssaultMission({ parent, world, blaster, mission, emit, say, sounds, kit, warm, tier, reduced }) → { begin(), restart(), update(dt, you) → { atYou: [{ from, spread, damage, color }] }, targets, hit(target, damage), running(), started(), view(), target(x, z), chooseSide(side), deploy(id), youDown(), force(how), dispose() }`.

- [ ] Implement: a holder a soldier with its kind's figure (`anyFigure`), a chevron sprite in the side's colour (`sizeAttenuation: false`), tipped over when down and hidden after 2.5 s; posts as a column of light and two rings (owner, meter) coloured by side; AI shots as tracers within 140 m of you, at most 12 a frame; `sounds.blast` for shots within 40 m, every 0.15 s at most; `emit({ type: 'mission', event, view })` on capture, phase, end; `say(mission.lines.start)` on choose, `won`/`lost` at the end, a bark from your side every 25 s or so.
- [ ] Proof: Task 5's browser check.
- [ ] Commit with Task 5.

### Task 5: The scene and the page

**Files:** Modify `src/components/galaxy/surface/scene.js`, `src/pages/GalaxySurface.jsx`; create `src/components/galaxy/surface/AssaultHud.jsx`; modify `src/components/galaxy/surface/surface.css`

- [ ] Scene: `assault` beside `chase`; `fire()` and `shot()` aim at `assault.targets` and call `assault.hit(target, RULES.yours)` while it runs; `hurt()` at nothing left while it runs sets `state.downed`, calls `assault.youDown()`, emits `down`; `input()` is still while downed, `target()` null, your figure tips in `place()`; `input.side(id)`, `input.deploy(id)` (puts you at the post, upright, full health), `restart()`; the compass's quest mark on `assault.target`; `missionDo('win' | 'lose' | 'side' | 'deploy', arg)`; `debug().mission`; `ready` calls `assault.begin()`; `dispose` disposes it; `life.hideKinds(mission.hideLife)` at begin; the blaster's pool 72 for an assault.
- [ ] Page: `AssaultHud` for `mission.kind === 'assault'` with `onSide`, `onDeploy`, `onAgain`, `onBack`; the quest panel hidden and the crosshair up while it runs; `shown` uses `v.key`; the win keeps the best and unlocks `mission.achievement`.
- [ ] HUD: the choose card (two side cards), the deploy card (your side's posts, tickets), the live strip (phase name, a chip a post with its letter, owner colour and meter), the tickets, the post ring when you're in one, the feed, your kills; the result card (title, stars, time, kills, captures, best, Again, look round, back). Styles in `surface.css` under `.assault-*`, after the chase's.
- [ ] Check in Chromium (dev server, `scripts/preview` style script or `scripts/autopilot-check.mjs --routes`): `/galaxy/hoth/surface?mission=assault` and Geonosis's: the cards, deploy, both armies, bolts, a post flipping, `window.__surfaceDo('missionDo', 'win')` and `'lose'` cards, Again; no console errors. Screenshots to `docs/superpowers/shots/`.
- [ ] `npm run lint`, `npx vitest run src/components/galaxy src/pages`: clean.
- [ ] Commit: `Galactic assault on the ground: the battle drawn, the surface scene fighting it and its HUD`.

### Task 6: Wiring and words

**Files:** Modify `src/components/galaxy/systems.js`, `src/components/Achievements.jsx`, `src/components/guide/pages.js`, `README.md`, `docs/architecture.md`, `docs/autopilot/backlog.md`; create `docs/superpowers/HANDOFF-galactic-assault.md`

- [ ] `systems.js`: Hoth's and Geonosis's `game` live, `to: '/galaxy/<id>/surface?mission=assault'`, `go: 'Fight it now'`, titles, roles, pitches, hows and three objectives for the ground battles.
- [ ] `Achievements.jsx`: `galacticassault: { name: 'Galactic assault', desc: 'Won a battle for the command posts on Hoth or Geonosis' }`.
- [ ] `guide/pages.js`: a tip on `/galaxy/surface` for the battle; `/galaxy/mission`'s tip names it.
- [ ] README (the galaxy's missions paragraph), `docs/architecture.md` (the galaxy's surface line), the backlog (a line under Features), the handoff (Done, Left, Checking it).
- [ ] `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`: clean.
- [ ] Commit: `The Battle of Hoth and the Battle of Geonosis go live as galactic assaults, with their words and the hand-off`.
