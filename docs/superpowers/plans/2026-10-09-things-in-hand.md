# Things in hand, and a word on E: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One held-item layer every rigged figure uses (grip from the hand's own skin, a carry over the walk), one rule for whom E talks to and what the body does, and the audits and browser checks that prove the models of Middle-earth, Rick and Morty and the galaxy walk, hold and answer.

**Architecture:** W-A builds the library (`lib/three/held.js`, the animator's arm layers, `lib/three/grip.js` moved, `lib/ai/talk.js`, `scripts/cast-audit.mjs`, `anim-check --held --talk`) with no caller changed but gunplay's imports. W-B moves Middle-earth on, W-C Rick and Morty, W-D the galaxy; each wave is green before the next starts. Pure rules in Node; a thin three.js layer; worlds keep their keys, lines and story beats.

**Tech Stack:** three.js (`AnimationMixer`, `SkinnedMesh.skeleton.boneInverses`, `SkeletonUtils`), vitest, Playwright's Chromium for the checks, the W1 modules (`src/lib/three/{animator,clipLibrary,locomotion,ik,rig,figureCalls}.js`, `src/lib/ai/react.js`).

**Spec:** `docs/superpowers/specs/2026-10-09-things-in-hand-design.md`

## Global Constraints

- Layers (`docs/health/RULES.md`): `src/lib/three` imports nothing from `src/components` or `src/runtime`; `src/lib/ai` imports no three.js and uses no `Math.random`; a world imports another world only through its `index.js` or `shared/`.
- A file stays under 800 lines (1,500 the ceiling); a moved module keeps every export name and leaves a re-export at its old path.
- Tests beside the file, under a second, no network; fixtures in `fixtures/` or the `*.fixture.js` beside the test.
- No new dependency. No Meshy or desktop job. No model names (of AI models) in code, docs or commits.
- Copy: British spelling, curly quotes, sentence case; the prompt key first (“E Talk · Gandalf”); the HUD through `src/runtime/hud/` only.
- Every key, line, quest, save key, achievement and dev hook works after as before; a figure whose model doesn't come keeps its stand-in and every call no-ops rather than throws.
- Before each commit: `npx eslint <files>` and `npx vitest run <folders>` green. Before each wave's last commit: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.
- Commits end with the harness's attribution lines given in the session; the branch is `claude/sharp-euler-0abmin`; push with `git push -u origin claude/sharp-euler-0abmin`.
- Thresholds (the spec's): grip to palm under 0.03 m scaled; item axis within 15° of the thumb line; `still` arm swing under 0.25 rad walking; `upright` within 25° of world up; planted-toe drift under 0.15 m/s; a reaction within 0.5 s of E; hand skin 40 vertices or more to give a frame; wrist clamp ±1.2 rad bend, ±1.4 rad twist; `still` weight 0.85 moving, 0 standing; talk reach 3, cone 1.2 rad, face past 1.05 rad; hold 1.5–6 s at text length / 14.

## Review Focus

1. A figure cloned by `SkeletonUtils.clone` shares geometry with its template: `holdItem` must cache the grip frame by template, never mutate the shared geometry except through `grip.js`'s per-figure morph path (Task 3's clone test).
2. An item held while a full-body one-shot plays (a fall, a sit) must stay in the hand and the `hands: 2` reach must let go, not fight the clip (Task 3's full-layer test).
3. E pressed with a spot and a person both in reach: the world's own order wins (a door before a talk in the galaxy, a spot before a person in Middle-earth); the person is never addressed by a key that opened a door (Tasks 8, 11, 14).
4. A town whose cast figure is a toy (the model not yet here, or the cast off on a phone saving data): E still plays the line and the Bubble; `react`/`look` on the toy no-op (Task 8's toy test).
5. The galaxy's `actors.say` for a bracketed line (what they do, not say) must look at you and play nothing on the upper layer, as before (Task 14's test).

---

## W-A: the library

### Task 1: `grip.js` moves to the library

**Files:**
- Create: `src/lib/three/grip.js` (the whole of `src/components/universe/grip.js`), `src/lib/three/grip.test.js` (its test moved)
- Modify: `src/components/universe/grip.js` → `export * from '../../lib/three/grip';` and nothing else; `src/components/universe/gunplay.js:38` imports from `../../lib/three/grip`
- Test: `src/lib/three/grip.test.js`, `src/components/universe/grip.test.js` (keep a one-line test: the old path's exports are the library's, same functions)

**Interfaces:** Produces `src/lib/three/grip.js` with the exact exports the universe file has today (`bendFinger`, `handShape`, `gripMorphs`, `ungrip` and any other it exports: read the file first).

- [ ] Move the file and its test (`git mv`), fix the imports inside; write the old-path test `expect(await import('./grip')).toEqual(await import('../../lib/three/grip'))`.
- [ ] Run: `npx vitest run src/lib/three/grip.test.js src/components/universe` → PASS.
- [ ] `npx eslint src/lib/three/grip.js src/components/universe/grip.js src/components/universe/gunplay.js` clean; `node scripts/health.mjs --check --skip build` clean (no world import rule broken: `lib/three` imports `three` only).
- [ ] Commit: `grip.js moves to the library, the universe's path a re-export`.

### Task 2: the animator's arm layers

**Files:**
- Modify: `src/lib/three/animator.js:70-74` (`MESHY_MASKS`, `MASK`), `:209-211` (`slots`, `fading`, `tokens` gain `'arm.r'`, `'arm.l'`), wherever `LAYERS`/`['full','upper','lower']` is enumerated (grep `upper` in the file), the header comment's `play(name, { layer })` line
- Modify: `src/lib/three/figureCalls.js` (its `LAYERS` and `holds` gain the two arm layers)
- Test: `src/lib/three/animator.test.js`, `src/lib/three/figureCalls.test.js`

**Interfaces:** Produces `MESHY_MASKS = { upper, lower, 'arm.r': ['RightShoulder','RightArm','RightForeArm','RightHand'], 'arm.l': ['LeftShoulder','LeftArm','LeftForeArm','LeftHand'] }`; `anim.play(name, { layer: 'arm.r' | 'arm.l' })`, `anim.stop('arm.r')`, `anim.playing('arm.r')`; a full-body play cuts the arm layers (the upper is not cut by one, and stays so); `anim.weight(layer, w)` scales how much of a layer is laid on, for the still carry's 0.85.

- [ ] Write the failing tests on `meshyRig()`: `play('walk', { layer: 'arm.r', loop: true })` over a standing idle moves only the four right-arm bones (every other bone's quaternion equals the idle's to 1e-6); `arm.r` and `arm.l` hold different clips at once; `play('fall')` on `full` cuts both (their promises resolve `'cut'`, `playing('arm.r')` is null).
- [ ] Run: `npx vitest run src/lib/three/animator.test.js -t arm` → FAIL (unknown layer).
- [ ] Implement: the masks, the slots, the layer loop in `after` (the same slerp-over path the upper layer takes; read `begin`/the layer section at `animator.js:331-420` and generalise the three names to a `LAYERS` list).
- [ ] Run the two test files → PASS. `npx eslint src/lib/three/animator.js src/lib/three/figureCalls.js`.
- [ ] Commit: `The animator lays an arm on its own layer`.

### Task 3: `held.js`

**Files:**
- Create: `src/lib/three/held.js`, `src/lib/three/held.test.js`
- Modify: `src/components/universe/gunplay.js:863-920` (`handFrame`, `handPoints` deleted there and imported from `../../lib/three/held`; `createGunplay` at `:1072-1081` calls the import), `src/lib/three/meshyRig.fixture.js` (a `withHands(rig, { verts = 60 })` helper that gives the model a `SkinnedMesh` whose vertices are skinned to each hand: a plate 8 cm long out the fingers along the bone's +y, 1 cm thin across x, 3 cm wide along z, plus a thumb nub at +z 2 cm (on this rig at rest the hand bone's x is lateral and its z forward, so this is a palm facing in and a thumb forward); the mesh bound with `bind(skeleton)` at rest)
- Test: `src/lib/three/held.test.js`, `src/components/universe/gunplay.test.js` (existing, must stay green)

**Interfaces:**
- Consumes: `ik.js` `palmFrame`, `reach`, `rotateWorld`, `setWorldQuaternion`; `rig.js` `findBones`; `grip.js` `gripMorphs`; `animator.js`'s `play(name, { layer: 'arm.r' })` (Task 2).
- Produces:
  - `handFrame(points, axes, body, left = false) → { along, thumb, normal, mean }` and `handPoints(root, hand) → [[x,y,z]…]` (as gunplay has them, moved).
  - `gripFrame(model, hand, { left = false, forward = +z, inward }) → { along, thumb, normal, mean, bind: Matrix4 } | null` (null under 40 points).
  - `HELD`: `{ [kind]: { axis: 'y', up: 'thumb' | 'fingers' | 'palm', hands: 1 | 2, hand: 'right' | 'left', carry: { still?: true, upright?: true } } }` for the spec's kinds: `staff`, `'white-staff'`, `torch`, `lantern`, `cane`, `umbrella`, `tankard`, `glass`, `bottle`, `sword`, `axe`, `dagger`, `horn`, `gaffi`, `spear`, `bow`, `tray`, `plate`, `bag`, `portalgun`, `plumbus`, `laser`, `carrot`, `pipe`, `ring`.
  - `holdItem(fig, item, kind, { hand = HELD[kind].hand, left, scale = 1, curl = false, offset = 0.012 }) → hold | null`; `hold = { item, hand (the Bone), kind, update(dt, { moving = false, busy = false }), release(), hide(on) }`. `fig`: `{ model, bones?, anim? }` (`anim` for the `still` carry: `anim.play(fig.idleName ?? 'idle', { layer, loop: true })` weighted through `anim.weight?.(layer, w)` if the animator offers it, else by playing and stopping; decide and pin it in the test). The grip: the item's `grip` child's position (else its origin) at `mean + normal × offset` in the hand's bind space, `axis` along `thumb`, `up` as the kind says; the transform computed in the bind pose (`bind`) and set as the item's local matrix under the hand, so the pose at attach time is irrelevant. `hands: 2`: a `grip2` child reached by the other hand with `ik.reach` in `update`, weight 1 unless `busy`. `upright`: in `update`, the hand turned by `rotateWorld` about the forearm's axis (twist, clamped ±1.4) and the wrist's across axis (bend, ±1.2) so the item's `up` in the world nears +y, weight 1 standing and moving. `release()`: the item back under its former parent at its former world transform; `hide(on)` its visibility.
  - A model with no hand bone, or no frame and no forearm: `holdItem` returns null, nothing attached.

- [ ] Write the failing tests (`withHands(meshyRig())`): `gripFrame` on the right hand gives `along` out the fingers (+y of the bone to within 10°), `thumb` toward the nub, `normal` out of the plate; the left hand's `normal` mirrored; a hand with 20 points gives null. `holdItem` with a staff (a Group with a `grip` child at (0,0.3,0), axis y): the grip's world position within 0.01 of the palm's `mean + normal × 0.012` in world; the same within 0.01 after `anim.update(0.3)` of a walk and when attached mid-walk (attach, step, compare); the staff's +y within 15° of the hand's thumb line in world; `up: 'fingers'` (a sword) puts the item's +y along `along`; `up: 'palm'` along `normal`. `scale: 0.5` halves its world length. `release()` restores the parent and world matrix within 1e-4. `curl: true` leaves the template's geometry's morph attributes untouched (a second `meshyRig` clone from the same geometry has none). The `still` carry: after `update(dt, { moving: true })` over a walk, the right arm's swing (the `RightArm` quaternion's angle from its idle pose) under 0.25 rad while the left arm swings more than that; standing, the arm follows the clip. `upright`: a tankard's +y after `update` nearer world +y than before and the hand's turn within the clamps. `hands: 2` with a `grip2` child: the left hand within 0.02 of `grip2` after `update`; with `busy: true` the left hand is where the clip put it. A model without `RightHand`: null.
- [ ] Run: `npx vitest run src/lib/three/held.test.js` → FAIL (module missing).
- [ ] Implement `held.js` (header comment in the house style: what it is, the API, the thresholds); move `handFrame`/`handPoints` out of gunplay.
- [ ] Run: `npx vitest run src/lib/three src/components/universe` → PASS (gunplay's tests unchanged).
- [ ] `npx eslint src/lib/three/held.js src/lib/three/meshyRig.fixture.js src/components/universe/gunplay.js`; commit: `held.js: one grip for every figure, from the hand's own skin`.

### Task 4: `lib/ai/talk.js`

**Files:**
- Create: `src/lib/ai/talk.js`, `src/lib/ai/talk.test.js`
- Modify: `src/lib/ai/index.js` (export `talkTarget`, `onTalk`, `createGreeter`)
- Test: `src/lib/ai/talk.test.js`

**Interfaces:** Produces:
- `talkTarget(people, you, { reach = 3, cone = 1.2, facing = null, floor = 3 }) → person | null`: `people: [{ id, x, z, y?, reach?, lines?: string[] | number }]` (a number: how many lines, for a world whose lines live elsewhere), `you: { x, z, y?, yaw? }`; a person with no `lines` (undefined, empty or 0) is skipped; a `y` further than `floor` is skipped; `facing` (or `you.yaw`) given: the one with the smallest angle off the facing among those within `cone`, else the nearest.
- `onTalk(person, you, { t = 0, lines = person.lines, said = person.said ?? 0 }) → { line, n, react: { event: 'say', hold, target: { x, y, z } } | null, face: boolean }`: `line = lines[said % lines.length]`, `n = said + 1` (the caller stores it), `hold = clamp(line.length / 14, 1.5, 6)`, `react` null when the line starts with `(`, `target` your eyes (`you.y ?? 0` plus `you.eyes ?? 1.55`), `face = |wrap(atan2(you − person) − person.face)| > 1.05` (yaw convention: `person.face` 0 along +x, + turning left, as `castRules.motionFrom` has it; the world converts).
- `createGreeter({ near = 2.8, far = 4.5 })` moved from `middleearth/castRules.js:150` (which re-exports it).

- [ ] Write the failing tests: nearest within reach without facing; the faced one with facing and cone, the nearest when none is in the cone; a person's own `reach` 8 found at 6; no lines, null; `y` 5 off, skipped; `onTalk` goes round the lines and `n` advances; hold 1.5 for a short line, 6 for a 200-character one; `(nods)` gives `react` null and `face` still computed; `face` true at 1.2 rad off, false at 0.9; the greeter once per approach, armed again past `far`.
- [ ] Run: `npx vitest run src/lib/ai/talk.test.js` → FAIL.
- [ ] Implement; `castRules.js` re-exports `createGreeter` from `../../lib/ai/talk` and its test still passes.
- [ ] Run: `npx vitest run src/lib/ai src/components/middleearth/castRules.test.js` → PASS. Commit: `talk.js: whom E talks to, and what the body does`.

### Task 5: `scripts/cast-audit.mjs`

**Files:**
- Create: `scripts/cast-audit.mjs`, `scripts/cast-audit.test.mjs`, `docs/superpowers/evidence/things-in-hand/README.md` (what each file in the folder is)
- Test: `scripts/cast-audit.test.mjs` (on `src/lib/three/fixtures/` or a tiny GLB written by the test with `@gltf-transform/core`, as `scripts/ual-bake.test.mjs` does; skip, as it does, where the pack is absent)

**Interfaces:** Produces `node scripts/cast-audit.mjs --world middleearth|rickmorty|galaxy [--json out] [--md out]`: reads the world's manifest through Vite's `ssrLoadModule` (the way `scripts/ual-bake.mjs --rig` loads `rig.js`; `galaxy-figures-audit.mjs` shows the galaxy's lists), and for each figure: `file`, `bytes`, `bones: { hips, handR, handL, toes, head }` (by `rig.js` `findBones` roles), `handSkin: { r, l }` (vertex counts skinned to each hand), `clips: { own: [...], borrowed: bool }`, `stride: bool` (`locomotion.strideOf` on the walk gives a number), `holds: kind | null` (the manifest's `held`/`item`/`weapon` where it has one), `warn: [...]`. A Markdown table and JSON. Exit 1 on a missing file, or `holds` set with `handSkin` under 40 and no forearm.

- [ ] Write the failing test: on a GLB with a Meshy-named skeleton and a skinned hand of 60 vertices, the row says `handSkin.r >= 40`, `bones.handR` true; on one with no hand bone and `holds: 'staff'`, exit 1 with the warning naming the figure.
- [ ] Implement; run `node scripts/cast-audit.mjs --world middleearth --md docs/superpowers/evidence/things-in-hand/audit-middleearth.md --json docs/superpowers/evidence/things-in-hand/audit-middleearth.json` and read it (what it finds is W-B's input).
- [ ] Run the test; `npx eslint scripts/cast-audit.mjs`; commit: `cast-audit.mjs: does each figure have hands, toes and its clips`.

### Task 6: `anim-check --held --talk`, the prompt's data attribute, the architecture note

**Files:**
- Modify: `scripts/anim-check.mjs` (new flags, the in-page sampler), `scripts/anim-check.test.mjs` (the pure parts: the held and talk verdicts from sampled numbers), `src/runtime/hud/Prompt.jsx:14` (`data-prompt={`${k} ${verb}${thing ? ` · ${thing}` : ''}`}` on the button), `src/runtime/hud/parts.test.jsx` (asserts it), `docs/architecture.md` ("Where things live": `held.js`, `grip.js`, `talk.js`, `cast-audit.mjs`), `docs/README.md` (a row for `docs/superpowers/evidence/`: the folder was on disk but not in the map)

**Interfaces:** Produces, in the page: `window.__talkers?.()` → `[{ id, name, x, z, y? }]` and `window.__teleport?.(x, z)` as the hooks each world adds in its wave (DEV only); the check uses them when present and reports `talk: skipped` when not. `--held`: every object with `userData.held = { kind, hand }` (set by `holdItem`) sampled per frame: grip-to-palm distance, axis-to-thumb angle, and for `still`/`upright` the arm's swing and the up angle; verdicts at the spec's thresholds. `--talk`: per talker, teleport beside (1.5 m off, facing them), read `[data-prompt]`'s text (must start `E Talk`), dispatch `keydown` `KeyE` on `window` (and `keyup`), sample the figure's `anim.playing('upper')` and `look` for 0.5 s of world time; a reaction within 0.5 s passes.

- [ ] Write the failing tests for the pure verdicts (`heldVerdict(samples, { scale }) → { ok, worst }`, `talkVerdict(samples) → { ok, at }`) exported from the script (as `anim-check.test.mjs` tests its pure parts today).
- [ ] Implement the flags, the sampler, the Prompt attribute and its test, the docs lines.
- [ ] Run: `npx vitest run scripts/anim-check.test.mjs src/runtime/hud` → PASS; `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` → clean. Commit: `anim-check holds and talks; the prompt says what it promises`. Push.

---

## W-B: Middle-earth

### Task 7: the toys' items through `holdItem`

**Files:**
- Modify: `src/components/middleearth/mapFigures.js:96-111` (each item: `hand.userData.held = { kind: item }`; a `grip` child on the item's shaft, haft or hilt (the bow's middle), not the hand's origin, which is 4 cm off the shaft; the bow's kind `bow`), `src/components/middleearth/kit.js:476-487` (Gandalf's staff group: `userData.held = { kind: 'staff' }`, a `grip` at its origin), `src/components/middleearth/shire/people.js:98-112` (the umbrella: `umbrella`), `src/components/middleearth/towns/bree/props.js:775-827` (the carrot: `carrot`), `src/components/middleearth/towns/edoras/scene.js:190-204` (tankards `tankard`, gripped at the handle; the bunch of simbelmynë `bottle`: stems in the fist, flowers up, kept upright), `src/components/middleearth/cast3d.js:262-273` (`c.hold(obj, boneName)` → `holdItem({ model: st.model, anim: st.anim }, obj, obj.userData.held?.kind ?? 'sword', { hand: boneName ? (boneName === 'LeftHand' ? 'left' : 'right') : the kind's, scale: the toy arm's world scale, curl: role === 'lead' || role === 'cast' })` (`scale` is the item's units to the world's, so the toy's world scale keeps it as long as it was; 1 / k would shrink it by the town's scale), the holds kept on `st.holds` and `update`d in `tickOne` after `anim.after`, released in `dispose`), `:362` (the loop reads the kind from the toy's hand and passes no bone, so an elf's bow goes to the left hand its kind names); `src/lib/three/held.js` (`busy` leaves the wrist to the clip too, so a drink reaches the lips and a fall isn't fought)
- Test: `src/components/middleearth/cast3d.test.js` (the staff test at `:231` extended), `src/components/middleearth/mapFigures.test.js` (if present; else a small one)

**Interfaces:** Consumes Task 3's `holdItem`. Produces: every toy item carries `userData.held.kind` and a `grip` child; `f.cast.holds` (array of holds) for the towns and tests.

- [ ] Write the failing tests: Gandalf's staff after `ready(f)`: its `grip` child's world position within 0.01 of the cast's right palm (`held.gripFrame`'s `mean` in world), the same after `tickCast` 0.5 s walking; the staff stays within 0.25 rad of upright while walking (`still` + `upright`); Legolas's bow is under `LeftHand`; `release` on dispose puts it back under the toy's arm; a toy whose model doesn't come keeps its staff in the toy's hand.
- [ ] Run → FAIL. Implement.
- [ ] Run: `npx vitest run src/components/middleearth` → PASS; `npx eslint` the files; commit: `Middle-earth's cast holds its things in its hands`.

### Task 8: E talks to the cast: the Shire, then the twelve towns

**Files:**
- Create: `src/components/middleearth/castTalk.js` (pure; test beside it): `townTalk(cast, you, { spot, reach = 2.8, facing }) → { id, name, lines } | null` through `talkTarget` (the cast rows `{ id, name, x, z, lines }`, `spot` non-null means a spot is nearer: null), `nextLine(pool, counts, id, you, person)` through `onTalk` (returns `{ line, bubble: { id, name, line }, react, face }` and advances `counts[id]`), `promptFor(person) → { verb: 'Talk', thing: person.name }`.
- Modify: `src/components/middleearth/shire/ShireWorld.jsx:653-672` (the proximity block: `person` → the greeting only (`attend` already waves); E (`:399-401`, `enter(s.near)`) when `s.near` is null and `townTalk` gives someone → `nextLine`, the Bubble, `castReact(fig, 'say', react)` and `castDo(fig, { look })`, the body's turn through `attend`'s rule when `face`; the story beats (`talk = 'gandalf'` at the bench and dawn, Lobelia) keep playing on approach), `:813` and `:883` (the prompt: `here` or, when none, `{ name: person.name, act: 'Talk' }` rendered through the kit's `Prompt`/`promptText` as the town already renders its prompt), DEV: `window.__talkers = () => castFor(sky).map(...)`, `window.__teleport = (x, z) => { sim.h.x = x; sim.h.z = z; }`.
- Modify, the same way, each of: `towns/bree/BreeWorld.jsx`, `rivendell/RivendellWorld.jsx`, `marshes/MarshesWorld.jsx`, `moria/MoriaWorld.jsx`, `minastirith/MinasTirithWorld.jsx`, `doom/DoomWorld.jsx`, `cirithungol/CirithUngolWorld.jsx`, `weathertop/WeathertopWorld.jsx`, `lorien/LorienWorld.jsx`, `orthanc/OrthancWorld.jsx`, `amonhen/AmonHenWorld.jsx`, `edoras/EdorasWorld.jsx` (each has its E handler and prompt at the lines the spec's map gives: bree 458/840, rivendell 537/882, marshes 448/803, moria 442/889, minastirith 443/748, doom 448/774, cirithungol 436/790, weathertop 539/1052, lorien 458/844, orthanc 435, amonhen 426, edoras 499; read each town's `rules.js` for its cast list and which lines are story beats, and keep those on approach).
- Test: `src/components/middleearth/castTalk.test.js`; each town's existing tests stay green.

**Interfaces:** Consumes Task 4's `talkTarget`, `onTalk`; `cast3d`'s `castReact`, `castDo`, `attend`. Produces the two DEV hooks on every town route for Task 6's check.

- [ ] Write the failing `castTalk.test.js`: a spot in reach wins (null); the faced person wins over the nearer; the pool goes round and `counts` advances; a bracketed line gives `react` null; `promptFor`.
- [ ] Implement `castTalk.js`; the Shire first; run the Shire's tests and `npx vitest run src/components/middleearth/shire`.
- [ ] Browser: `npx vite --port 5391 --strictPort --host 127.0.0.1 &`; `node scripts/anim-check.mjs --route '#/middle-earth/shire' --talk --held --json docs/superpowers/evidence/things-in-hand/shire.json` (find the Shire's route in `src/App.jsx`); exit 0. Commit: `The Shire answers E`.
- [ ] The twelve towns, one commit each or in threes: implement, run the town's tests, run the check on its route, commit `<Town> answers E`.
- [ ] Run: `npx vitest run src/components/middleearth` → PASS; `npm run lint`.

### Task 9: Middle-earth proven

**Files:**
- Create: `docs/superpowers/evidence/things-in-hand/audit-middleearth.md` (Task 5's, re-run), `anim-middleearth-<town>.json` (thirteen), `docs/superpowers/shots/things-in-hand/middleearth-<town>-held.webp` and `-talk.webp` (two routes at least: the Shire with Gandalf's staff, Edoras with Gimli's tankard and axe), `docs/superpowers/HANDOFF-things-in-hand.md` (W-A and W-B sections: what's on the layer, the audit's table, what the check found and what was fixed, what's left)
- Modify: whatever the checks fail on (a `clipSpeed` row, a `faceAhead`, a kind's grip offset)

- [ ] Run `anim-check` (feet, `--held`, `--talk`) on all thirteen towns and the map hub; fix each failure at its cause (never by raising a threshold); re-run until exit 0 everywhere.
- [ ] Shots: `scripts/kit-shot.mjs` or `glb-shot.mjs`'s pattern (read one) for the two routes, teleported beside the figure.
- [ ] `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` clean; commit `Middle-earth: things in hand, a word on E, proven`; push.

---

## W-C: Rick and Morty

### Task 10: the wardrobe, the interiors, Portal panic and Roy through `holdItem`

**Files:**
- Modify: `src/components/rickmorty/wardrobe/gear.js:431-458` (the hand slot: `holdItem({ model: figure.group }, obj, GEAR kind → `portalgun` | `plumbus` | `laser` | `bag`, { curl: true })` replaces `frames.hand`/`put(hand, …)`; the head and face frames stay; the returned hold released by the function `wearGear` returns), `src/components/rickmorty/wardrobe/looks.js:139-160` (each hand gear row names its `held` kind), `src/components/rickmorty/world/interiors/people.js:105-140` (`inHand(c, obj, { kind = 'glass', reach })` → `holdItem` with `upright`; `holding` no longer waits for a pose), `src/components/rickmorty/portal/Portal3D.js:802-810` (the hero's gun: `holdItem(player, gun, 'portalgun', { curl: true })`), `src/components/rickmorty/world/roy/scene.js:1204,1256,1259` (the cane `cane`, the football `bag`... read it: a ball is `palm`; add a `ball` kind to `HELD` (`palm`, no carry) if none fits), `src/components/rickmorty/portal/meshyCast.js:517` (`c.hand` kept; `c.hold(obj, kind, opts)` added, delegating, holds `update`d in `update(c, …)` at `:581` after the animator's `after`)
- Test: `src/components/rickmorty/wardrobe/gear.test.js` (the hand gear's grip at the palm, any pose), `src/components/rickmorty/world/interiors/people.test.js` (`inHand` before any update lands at the palm), `src/components/rickmorty/portal/meshyCast.test.js` (`c.hold`)

**Interfaces:** Consumes Task 3. Produces `c.hold(obj, kind, opts) → hold | null` on every meshyCast figure; `inHand(c, obj, { kind })`.

- [ ] Write the failing tests (the wardrobe's and the interiors' existing fixtures: read `gear.test.js` and `people.test.js` first).
- [ ] Implement; run `npx vitest run src/components/rickmorty` → PASS; `npx eslint` the files; commit: `Rick and Morty's hands hold through the library`.

### Task 11: E through `talkTarget` in C-137, the Citadel and the planets

**Files:**
- Modify: `src/components/rickmorty/world/RmWorld.jsx:808-880` (`act`: the talk target from `talkTarget(PEOPLE in area with lines, you, { reach, facing: s.h.yaw })` in place of `PEOPLE.find(TALK_TO…)`; `s.talk` gains `react` from `onTalk` and `face`), `src/components/rickmorty/world/npc.js:161-164` (`heard` plays `state.talk.react` when present, as it did its own; `face` turns the body through `turnTo` beyond the neck), `src/components/rickmorty/world/rules.js:590` (`PEOPLE` rows gain `lines` where their lines live elsewhere: the count), `src/components/rickmorty/citadel/CitadelWorld.jsx:646-661` and `src/components/rickmorty/planets/RmSurface.jsx:231` (the same: their talk target through `talkTarget`, the prompt `E Talk · Name` through the kit's `Prompt`), DEV hooks `__talkers`, `__teleport` on the three routes
- Test: `src/components/rickmorty/world/rules.test.js` (a pure `talkTargetIn(area, you)` exported from `rules.js` or a new `world/talk.js`: the faced person wins; a hunter with no lines is never a target), `npc.test.js` (a `heard` with `react` plays it once)

- [ ] Write the failing tests; implement; `npx vitest run src/components/rickmorty` → PASS.
- [ ] Browser: `anim-check --talk --held` on `#/c-137`, the Citadel's route and one planet (`#/c-137/gazorpazorp`); exit 0. Commit: `Rick and Morty answer E through one rule`.

### Task 12: Rick and Morty proven

- [ ] `node scripts/cast-audit.mjs --world rickmorty` → `docs/superpowers/evidence/things-in-hand/audit-rickmorty.{md,json}`; fix what it flags that a figure the world says holds something can't (a wardrobe body with a gloved hand: the forearm fallback is fine; note it).
- [ ] `anim-check` (feet, `--held`, `--talk`) on C-137, the Citadel, the eight planets (`#/c-137/<id>`: gazorpazorp, squanch, birdworld, gearworld, pluto, snakeplanet, purge, cronenberg) and Portal panic; fix at the cause; JSON to the evidence folder; two shots (Rick with the portal gun mid-talk; a glass in the interiors).
- [ ] HANDOFF's W-C section; the four checks clean; commit `Rick and Morty: things in hand, a word on E, proven`; push.

---

## W-D: the galaxy

### Task 13: the audit over the galaxy's figures, and its rows fixed

**Files:**
- Modify: `scripts/cast-audit.mjs` (the galaxy's manifest: `crewList.CREW`, `heroes.HEROES`, the troops, `catalog/people.js`, `deathstar/inside/rules/cast.js` `CAST`), `src/components/galaxy/surface/crewList.js` / `catalog/*.js` rows the audit flags (`clipSpeed`, `anim` names, `still`)
- Create: `docs/superpowers/evidence/things-in-hand/audit-galaxy.{md,json}`

- [ ] Run the audit; for each warning decide: a row fix (a figure with toes but no stride: its walk clip's name wrong in `anim`), a `still: true` that should walk (legs found: `legRig` path), or a note in the HANDOFF (no hand skin: the stand-in stays).
- [ ] `npx vitest run src/components/galaxy` → PASS (`catalog.test.js` checks clip names in files); commit: `The galaxy's figures audited; their rows mended`.

### Task 14: the galaxy's non-gun props and E through the rule

**Files:**
- Modify: `src/components/galaxy/surface/actors.js:816-850` (`talker` → `talkTarget` over the actors with lines or a quest, `facing` the player's yaw; `say(a)` → `onTalk` for the line, the hold and the reaction, the bracketed case kept: look, no clip; `face` → `faceAt`), `src/components/galaxy/surface/scene.js:1324-1325` (the order kept; `target()` passes the yaw), `src/components/galaxy/surface/figures.js` (a built gaffi stick for the Tusken: two cylinders and a club, `userData.held = { kind: 'gaffi' }`, `grip` and `grip2` children) and `actors.js:637` (the Tusken holds it through `holdItem` on its figure, two-handed; the `aim.pistol` raise stays), `src/components/deathstar/inside/scene/figures.js:393` (the held gun stays gunplay's; nothing else to hold there unless the audit lists one), DEV hooks `__talkers`, `__teleport` on `GalaxySurface` (through `__surfaceDo`) and the Death Star inside
- Test: `src/components/galaxy/surface/actors.test.js` (the faced talker wins; a bracketed line looks and plays nothing; `say` advances `a.said`), `scene`'s rules test on `target()`'s order (a door in reach and a talker: the door)

- [ ] Write the failing tests; implement; `npx vitest run src/components/galaxy src/components/deathstar` → PASS; commit: `The galaxy answers E through one rule; the Tusken holds his stick`.

### Task 15: the galaxy proven, the hand-off closed

- [ ] `anim-check` (feet, `--held`, `--talk`) on the seventeen surfaces (`#/galaxy/<world>/surface`: read `src/components/galaxy/surface/sites/index.js` for the ids) and `#/deathstar/inside`; fix at the cause; JSON to the evidence folder; two shots (a Tusken with the stick; a cantina talk).
- [ ] HANDOFF's W-D section and its "Left"; `docs/architecture.md` checked; the four checks clean; commit `The galaxy: things in hand, a word on E, proven`; push.

---

## Self-review notes

- Spec coverage: the held layer (3), the masks (2), `grip.js` moved (1), `talk.js` (4), the audit (5), the checks and the prompt (6), Middle-earth (7–9), Rick and Morty (10–12), the galaxy (13–15), the hand-off (9, 12, 15), the architecture note (6).
- Names used across tasks: `holdItem`, `gripFrame`, `HELD`, `hold.update/release/hide`, `talkTarget`, `onTalk`, `createGreeter`, `MESHY_MASKS['arm.r']`, `__talkers`, `__teleport`, `data-prompt`.
- Review Focus pins: 1 → Task 3 (clone test); 2 → Task 3 (`busy`, full-layer); 3 → Tasks 8, 11, 14 (order tests); 4 → Task 8 (toy test in the Shire's rules); 5 → Task 14.
