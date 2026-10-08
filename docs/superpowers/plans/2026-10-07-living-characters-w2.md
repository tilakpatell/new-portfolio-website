# Living characters, W2: Rick and Morty and Star Wars, to the highest bar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every Rick and Morty and Star Wars character onto the W1 layer (animator, body, react), add the ambient and social AI the spec describes, the player's reactions and emotes, and prove "natural" with a foot-slide check.

**Architecture:** Phase A builds what every world needs (the figure adapters, `lib/ai/needs` and `social`, the emote wire, the check script); phase B moves each world on, one agent per world on disjoint files; phase C checks them in a browser. Brains keep their decisions; bodies show them.

**Tech Stack:** three.js, vitest, the W1 modules (`src/lib/three/{animator,clipLibrary,locomotion,gait,animBudget}.js`, `src/lib/ai/{body,react}.js`).

**Spec:** `docs/superpowers/specs/2026-10-07-living-characters-design.md` (sections "The seam from brain to body", "Ambient and social life", "W2").

## Global Constraints

- Callers' shapes stay (W1 plan's list). A world not in this plan must look and behave exactly as before.
- Every key, line, event, save key, achievement and dev hook works as before. Infiltration-style solvers and seeded rules stay deterministic: bodies show decisions, never make them.
- Player reactions are short, on the upper layer where possible, and cut by any input.
- Foot slide under 0.15 m/s planted-toe drift for every figure on clips or `gait.js`.
- `src/lib/ai/*` free of three.js and `Math.random`.
- Emote key: `B` where free; where a world binds `B` (the universe on foot and the galaxy surface use it for gadgets/keys: check `KEYS` tables), the next free of `Z`, `U`, `T`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- A figure whose model fails to load and falls back to shapes (`cast.js`, `toonPerson`, `built()`): reactions and look calls must no-op, not throw.
- Many figures at once (the Citadel rally, the Battlefront armies on a phone tier): `animBudget` keeps frame time within today's; no new mixer per frame.
- A reaction requested during a base state (a seated person hit or greeted): plays on the upper layer over the sit, never stands them up.
- Online ghosts and peers from an older client without `emote`/`motion` in the packet: fall back to today's behaviour.
- A brain mode no `MODE_BODY` row covers: falls back to locomotion only.

---

### Task A1: the figure adapters

**Files:** `src/components/rickmorty/portal/meshyCast.js` (`make`), `src/components/universe/footScene.js` (`rigged`, `loadModel`, `rigScene`, `built`), `src/components/galaxy/surface/actors.js` (`modelFigure`, statics), their tests.

**Interfaces:**
- Produces on every meshyCast figure: `c.anim` (an animator, or null when unrigged), with `c.mixer`, `c.act`, `c.update(t, move, hit, opts)`, `c.play`, `c.stop` delegating to it; `c.update` accepts `opts.motion` (locomotion's m) and `opts.frame`; `c.base(name)`, `c.look(target, opts)`, `c.react(event, ctx)` (through a per-figure `createReactions`). Sitting callers use `c.base('sit')` (`sit` maps to the figure's own `sit` clip or Rick's, as `sit.idle`'s stand-in when the UAL enter/exit don't suit the seat).
- Produces on every footScene figure (rigged, loaded, rigScene): `play`, `base`, `look`, `react`, `anim` beside the existing fields; `update(dt, move, motion)` unchanged.
- Produces for unrigged statics (galaxy `modelFigure`, R&M props, built shapes): `update` driven by `gait.js` (`sway` stepped by distance, `breathe` when still, seeded), so none is frozen and none glides at a constant height; `play`/`look`/`react` no-ops.

- [ ] Tests first: a meshyCast figure's `c.anim` exists and `c.play('wave')` reaches it; a sitter through `c.base('sit')` can `c.play('hit', { layer: 'upper' })` and stays seated; an unrigged figure's `react` returns null without throwing; a static's height moves with distance and breathes when still, two seeds out of step.
- [ ] Implement; `npx vitest run src/components/rickmorty src/components/universe src/components/galaxy src/lib` green.
- [ ] Commit.

### Task A2: `lib/ai/needs.js`, `lib/ai/social.js`, `lib/emote.js`

**Files:** create `src/lib/ai/needs.js`, `src/lib/ai/social.js` (+ tests; export from `src/lib/ai/index.js`), `src/lib/emote.js` (+ test); modify `src/components/middleearth/towns/ghosts.js` (packet `emote`, `motion` read when present), `src/components/galaxy/surface/peers.js` (same).

**Interfaces:**
- `createNeeds({ needs: { [need]: rate }, rand }) → { level(need), tick(dt), satisfy(need, amount) }`; `pickPlace(person, places, { t, schedule, rand }) → place | null` (utility pick: need level × distance falloff × momentum, slots free); `reserve(place, who)`, `release(place, who)`. A place is `{ id, at: [x, z], need, slots, clip, base?, duration, face? }`; a schedule `[{ from, to, want }]` in the world's sky hours. `galaxy/surface/needs.js`'s `pickWant`/`relate` keep working (it may delegate).
- `createSocial({ rand }) → { step(people, t, dt) → [{ who, mode: 'talk' | 'listen' | 'walk' | 'makeway' | 'greet', look?: id | {x,z}, with?: id, to?: {x,z} }] }`: conversation pairs and threes (meet a step apart, face, turns of seeded length, end), groups (leader + followers spaced by `steer.js` separate/follow), make-way (a danger slot along the player's heading inside 3 m), greet (head turn inside 6 m for one who knows the player or has a line, wave the first time, re-armed past 9 m).
- `EMOTES = ['wave', 'cheer', 'dance', 'taunt', 'sit']`; `createEmoteWheel()` (hold opens, release picks, tap repeats last); `emotePacket(e, t)` / `readEmote(p, now)` (an emote id and a start; stale after its clip's length).

- [ ] Tests first (seeded): slots never overbook; a schedule changes the pick; a conversation's turns alternate and end; a group keeps spacing; a walker steps out of the player's way; greet fires once per approach; an old packet without `emote` reads as none.
- [ ] Implement; `npx vitest run src/lib src/components/middleearth/towns src/components/galaxy/surface` green.
- [ ] Commit.

### Task A3: `scripts/anim-check.mjs`

**Files:** create `scripts/anim-check.mjs` (+ a short README block in its header).

**Interfaces:** `node scripts/anim-check.mjs --route '#/c-137' [--seconds 6] [--port 5391]`: opens the dev server's route in headless Chromium (the way `scripts/autopilot-check.mjs` launches it; `CHROME=` path honoured), waits for the world, then reads every `SkinnedMesh` in the page's three.js scene (through the world's dev hook, or a `window.__threeScenes` registry it adds in DEV in `src/lib/three/renderer.js`'s or `useScene`'s creation path), samples each figure's `LeftToeBase`/`RightToeBase` world position each frame, and reports per figure the planted toe's drift (m/s) while the toe is within 3 cm of its lowest, plus how many figures are at bind pose (every bone at rest) and how many share an idle phase. Exits non-zero when any figure in view exceeds 0.15 m/s.

- [ ] Implement; run it on `#/c-137` and `#/galaxy/tatooine/surface` against the branch: it reports (the numbers are W2's baseline; it may fail before phase B).
- [ ] Commit.

### Task B1: Portal panic (`src/components/rickmorty/portal/Portal3D.js`, `rules.js` events only)

Hero and enemies through `body.js` (strafers' hips turn, no crab-walk; eased yaw); `shoot` on the upper layer on a shot, `hit` on a flash, a death plays `die.*` / `fall` and lies 0.8 s before pooling, `cheer` on a wave cleared, `taunt` on a combo; the Gazorpian winds up on `punch`; allies stop to punch (velocity zeroed in reach) and `cheer` on poof; Snowball's legs walk (`gait.js` on its leg nodes); Evil Morty's `shoot`/`taunt`/`fall`. Events gain the figure's index where they lack it (no change to scoring). Tests: rules emit the index; a dying enemy is kept until its fall ends.

### Task B2: the Citadel and Mortytown (`src/components/rickmorty/citadel/*`)

Every figure on the adapters. Sitters through `base`, one-shots seated, heads looking at Rick (turn the body only past 70°, by dt); the cops' alert/search/catch through a `MODE_BODY` (the watcher modes) with `taunt`/`jab`; the Day Care Mortys `scared` then run, `cheer` when penned; the crowd loops become steered walkers with needs and a schedule (`needs.js`: the factory, the shops, the council, benches; `social.js`: pairs, groups, make-way for Rick), corners eased; the rally/day/election crowd: the nearest dozen instances promoted to live figures (`animBudget`), breathing and cheering on the election's beats, the instanced rest given a vertex-shader breathe with a per-instance phase; the council and clerks gesture when they speak (`sit.talk` / `talk` upper); the Locos crouch to hide and walk home; Rick reacts on seen, caught and won; the wardrobe figure waves on a change. Emote key bound.

### Task B3: C-137 and the dimensions (`src/components/rickmorty/world/*`)

`npc.js` onto `body.js` and `react.js`: hunters run on their run and search with their heads, locals greet with a wave and gesture while their bark plays (`say`), walkers walk round Morty and the limo (steer separate), the President walks to the limo and gets in; room people look at Morty while talking to him and gesture, sitters through `base` out of step (the three sit copies become one), Beth's wine, Rick at the bench; Total Rickall's shot on `shot`, the near ones `scared`; the stasis Ricks float without the flask; the arcade regulars wander between machines and cheer; Morty's shoot on the upper layer, `wave` when he opens a friendly talk, idle fidget; the rats' scurry on `gait.js`, per-rat phase. Emote key bound; ghosts read emotes.

### Task B4: the galaxy's ambient life (`src/components/galaxy/surface/actors.js`, `crew.js`, `needs.js`, `peers.js`)

Ambient crew on locomotion with motion from their step (no slide, no scissor), needs at every site that has places (each site's `wants` become places with clips: a cantina bar `drink`, a vaporator `kneel.fix`, a stall `interact`, a bench `sit`), conversations and groups (`social.js`), greet with a head turn and wave, scatter (`scared` then flee) at gunfire heard (`perception` stims from `activity.heard`), creatures stride-matched (no freezing mid-stride: walk-only clips stop at a contact pose; the rancor walks), Battlefront statues on the `gait.js` sway; peers' feet from `motion`, their emotes played.

### Task B5: the galaxy's hostiles (`src/components/galaxy/surface/hostiles.js`, `activity.js`, `heldBlade.js`)

Each hostile mode drawn through a galaxy `MODE_BODY`: strafe and back with hips to travel and chest to you, cover crouched and rising to fire, search with the head and a `?` over it (the HUD event `activity.update` already emits), look; firing with raised arms (`gunplay.js` on rigged NPCs, `aim.pistol`/`shoot.pistol` on the upper layer otherwise) from the muzzle; hit on the upper layer by where; deaths by direction (`die.fwd`/`die.back`/`die.blown`, the troopers' own where they have them) lying 2 s; duellists' blades parented to `RightHand`; allies the same.

### Task B6: the Battlefront (`src/components/galaxy/surface/missions/assault.js` body hooks only, `assaultScene.js`, `chaseScene.js`)

Posture drawn: crouch in cover via `down`/base, the halves advancing and retreating with the retreaters looking back, upper-body fire, deaths by direction, spawns that run in rather than pop; the statues on the `gait.js` sway until rigged; the speeder scouts seated (`drive`/`sit`), leaning into banks, turning to fire, falling off on a hit.

### Task B7: the galaxy's party and player (`src/components/galaxy/surface/scene.js`)

The mate fights (aims and fires at your target with `gunplay`, can be hit, plays hit and down), looks at what you look at, stops copying your yaw; your reactions (hit, down through `motion.down` + the `die.*` clip in place of the plank tip, cheer on a quest or a post, the roll as `roll` on the full layer over the existing roll motion) cut by input; riders seated (`sit`); emote wheel bound and sent.

### Phase C: checks

- [ ] `npm run lint`, `npm test`, `npx vite build`, `node scripts/health.mjs --check --skip build`.
- [ ] `node scripts/anim-check.mjs` on `#/c-137`, `#/c-137/citadel`, the Portal panic route, `#/galaxy/tatooine/surface` and a Battlefront mission: every figure under 0.15 m/s, no bind pose, idle phases spread.
- [ ] Shots of each in `docs/superpowers/shots/`, taken in the visible browser pane.
- [ ] Merge `origin/main`, push, PR.
