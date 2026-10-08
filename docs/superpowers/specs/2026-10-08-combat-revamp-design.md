# Combat revamp: strokes from clips, bolts that obey the world, a look that works without a mouse

Date: 2026-10-08. Status: designed from the owner's request, built in lanes, each lane a pull request merged to `main` once it stands. The audit it rests on is `docs/research/2026-10-08-combat-feel-and-offline-motion.md`; read it first.

## Intent

What the owner said: the lightsaber's rigging and its combat are terrible; the figures in the Star Wars galaxy and the Rick and Morty worlds can't shoot properly or hit enemies; it should feel good with a mouse and without one (a trackpad, touch); make the saber much better, look at what others do, use the 5090 and the assets we have to make saber and blaster combat fun and accurate; build it in Opus sessions, each feature a pull request merged to main as a checkpoint.

What that means here, in order of how much a player feels it:

1. A stroke should look like a stroke. Today the arm is tweened along a yaw/pitch arc while the legs play a borrowed clip. Thirty-one Quaternius sword clips exist, nine of them baked, and nothing plays them.
2. A hit should be the blade touching them. Today it's a flat cone round the player, centred on the camera, during a timer.
3. A shot should go where the crosshair is and stop at the first thing in the way. Today it ignores walls, the crosshair appears three seconds late, and the universe's shots go to an auto-lock up to 28° off the reticle.
4. Looking should not need a held button. Today every on-foot world looks by click-and-drag, so a trackpad can't aim and fire at once.
5. Enemies should fence and shoot like people: lead a moving target, miss first, not see through walls, swing a blade that can be parried on contact.

## Decisions

Made for the owner, who asked for this to be designed and built without checking in; each the choice a careful colleague would make.

- **One combat layer, under the worlds.** The rules are pure and tested in `src/lib/combat/` (no React, no three.js: numbers in, numbers out); the three.js-aware pieces (a blade's segment history, a bolt pool's meshes, a trail) in `src/lib/three/combat/`; the look controller and the reticle in `src/runtime/` (`look.js`, `hud/Reticle.jsx`). The galaxy surface, the universe's foot scene and the Rick and Morty worlds call these. Nothing in `src/lib` or `src/runtime` imports a world (`docs/health/RULES.md`, layers).
- **Clips drive strokes; code corrects them.** A stroke is a UAL2 sword clip played full-body through the animator; the contact window and the root's travel are baked into the clip's extras by `scripts/ual-bake.mjs`; a small IK correction (at most 0.25 rad) turns the sword hand toward the lock during the window so a clip made for a mannequin connects with a Wookiee. The procedural arm arcs (`combatRules.js`'s `swingPose`, `saber.js`'s `pose` during a stroke) go.
- **The blade is a segment, the body a capsule.** A hit is the blade's segment, swept from last frame's to this frame's in sub-steps, within a target capsule's radius, once per stroke per target, inside the clip's contact window. A clash is two blade segments within a blade's radius. Deflection is a bolt's segment crossing the blade's. No cones.
- **Bolts are projectiles.** One swept step for yours, theirs and theirs-at-theirs: the segment the bolt flew this frame against bodies' capsules and the world's solids (a raycast the world provides). The aim point comes from the camera's ray through the crosshair; the bolt flies from the muzzle to it. Hitscan, the dice for soldier-on-soldier hits and the separate tracer go.
- **Pointer lock is the look for mouse and trackpad.** A click on the canvas locks; the pointer's movement turns the camera; Esc releases; a glass prompt says so. Click-and-drag stays as the fallback where lock is refused or declined. Touch keeps its look pad. A world's Menu gets one setting, Look: Click to lock / Drag.
- **Aim assist scales with the input.** Magnetism (the shot bends toward the nearest target inside a cone, the crosshair untouched, cover still blocks it) and friction (the look slows over a target) for everyone; the cones are small for a mouse, wider for a trackpad, widest on touch, where a tap also snaps inside the cone. A lock-on (Tab, or the Lock touch button) frames the enemy and makes strokes and strafes relative to them.
- **Enemies on the same code.** Duellists are the rigged crew figures (Vader, Maul, Dooku, the Inquisitor, the three Jedi) on the same saber module, with a brain that is a small state machine. Shooters use the same bolt step, an accuracy model with range, movement, a forced first miss and a streak cap, and a line-of-sight test every frame.
- **The desktop makes what the library lacks.** Hilts and blasters as models now, through gen3d. A `motion` job (HY-Motion from text, or GVHMR from a reference clip, to BVH, retargeted onto Meshy's skeleton by the UAL retarget) comes behind a spike that proves the retarget on one clip. Re-rigging with fingers is noted and deferred: the whole site is on the 24-bone skeleton with 254 clips, and a mitten holding a hilt reads fine at the camera's distance.
- **The Death Star's inside keeps its saber.** It's a game inside a scrolling page with its own rules and tests; it moves to the shared module later if ever.
- **Wire protocol grows, never breaks.** The walk packet's `arms` (gun kind, lit, colour, stance, swinging) gains a stroke id so peers play the same clip; older readers stop before it, as they do now.

## The pieces

### 1. `src/runtime/look.js`: the look

`createLook({ host, onTurn, onLock, sensitivity, mode })` → `{ attach, detach, request(), release(), locked, mode, set(mode) }`.

- `mode`: `'lock'` (the default where `pointer: fine`), `'drag'`, `'touch'` (where `pointer: coarse`, `lib/device`'s `coarse`). The world's Menu offers Look: Click to lock / Drag; the choice is kept as `tp-look`.
- In `lock`: a `pointerdown` on the host asks `requestPointerLock({ unadjustedMovement: true })`, catching `NotSupportedError` and asking plainly; on `pointerlockchange` the first `pointermove` is dropped; each later `pointermove`'s `movementX/Y` is clamped to ±`SPIKE` (60 px) and handed to `onTurn(dx, dy)` scaled by `sensitivity` (yaw 0.0022 rad/px, pitch 0.0018, the galaxy's numbers halved for the finer input); `pointerrawupdate` is not read. Esc releases (the browser does; `pointerlockerror` and a `change` to null call `onLock(false)`). After a release the host shows the prompt again and a relock waits for the browser's cooldown (the next click after 1.25 s).
- In `drag`: as today (pointerdown, move, up with capture).
- In `touch`: nothing; the world's look pad or the kit's Stick turns the camera.
- The buttons while locked: left = the gun's shot or the saber's stroke; right held = the gun's sights or the saber's block; the wheel still zooms. The world binds them; `look.js` only reports `onButton(which, down)`.
- The kit's `Prompt` says "Click to look · Esc to release" over the canvas until locked, and nothing while locked. Trackpads lock fine in Chromium and Firefox; in Safari the pointer moves little under lock unless a button is held, so Safari on a Mac with no mouse defaults to `drag` plus the wider assist cone (the UA and `touchPoints` from `lib/device`).

### 2. `src/lib/combat/aim.js`: where a shot goes

Pure. `aimPoint(ray, solids, targets, { min = 1.5, max })` → `{ at, target, dist }`: the first of a target capsule or a solid along the camera's ray through the crosshair, else `max` along it; never nearer than `min` ahead of the shooter, so the muzzle's vector can't flip at a wall. `assist(dir, from, targets, cone)` → the direction bent toward the nearest target inside the cone: full pull inside `cone.inner`, falling to nothing at `cone.outer`, capped at `cone.cap` radians a frame; `friction(dir, from, targets, cone)` → the look's sensitivity multiplier (0.55 over a target, 1 off). `lead(target, vel, from, speed)` → where to aim so a bolt at `speed` meets the target.

The cones (`ASSIST`): mouse `{ inner: 0.02, outer: 0.05, cap: 0.01 }`; trackpad and drag `{ inner: 0.05, outer: 0.14, cap: 0.03 }`; touch and gamepad `{ inner: 0.09, outer: 0.21, cap: 0.05, snap: true }`. `lib/device` says which.

### 3. `src/lib/combat/bolt.js`: a bolt's flight

Pure. `createBolts({ pool = 48 })` → `{ fire(spec), step(dt, world), each(fn) }`. A bolt: `{ from, dir, speed, range, owner, damage, colour, deflect }`. `step` moves each by `speed · dt`, and tests the segment it flew: `world.solids(a, b)` (the world's raycast: terrain, props, walls; `null` or `{ at, normal }`), then `world.bodies` (capsules `{ id, a, b, r, side }`), nearest first; a hit ends the bolt with `{ what, at, normal }`. A bolt marked `deflect` that crosses a raised blade's segment within `BLADE.r` is turned (mirrored over the blade's facing, owner swapped, `deflected: true`) and flies on. A pool slot is taken from the dead first, then the oldest in flight.

The three.js pieces (`src/lib/three/combat/bolts.js`): the instanced bolt meshes and muzzle flashes, drawn from the pool's state. The galaxy's `blaster.js` and `ground/bolts.js`, the universe's `foot.js` bolts and Total Rickall's instant shot all become callers of the one step.

### 4. `src/lib/combat/accuracy.js`: how enemies shoot

Pure. `spread(shooter, target, { base, perMetre, moving, suppressed, first, streak })` → radians of scatter: `base + perMetre · range`, × 1.6 while the shooter moves, × the suppression, × 2.5 for the first volley at a fresh target (the telegraph), and after two hits in a row the next shot is thrown wide once (the streak cap). `scatter(dir, rad, rng)`. Enemies aim at `lead(…)` with their own error, test `world.solids` from their muzzle to the target every frame they want to fire, and lose the target (no shot, a last-seen point to move to) the frame the line is blocked; the 2.5 s of intuition stays for moving, not for shooting.

### 5. `src/lib/combat/blade.js`: the blade and what it touches

Pure. `createBlade({ r = 0.12 })` keeps the last `N = 8` frames of `{ base, tip, t }` (the ring buffer the trail draws from). `sweep(now, targets, { steps })` → the targets whose capsule the blade's segment crossed between last frame and this one, sampled at `steps` segments in between (4, or `ceil(tipTravel / 0.25 m)`), each with the nearest point; `clash(other)` → the point where two blades' segments pass within `2r`, or null; `crosses(a, b)` → whether a bolt's flown segment passes within `r` of the blade. The stroke keeps a `Set` of what it has hit; damage lands once per stroke per target, only inside the clip's contact window.

### 6. The saber (`galaxy/surface/saber.js`, rebuilt on 1–5)

- **Clips.** `scripts/ual-bake.mjs` gains the set `sword`: every UAL2 `Sword_*` clip, full-body, with extras `{ contact: [t0, t1], root: [[t, dx, dz]…] }` found by `attackTimes` (the hand's fastest span, widened 60 ms either side) and the hips' travel (from `UAL2_RM.glb`, the root-motion twin). `clipLibrary.js` registers them under `sword.*`. The old `ual-saber.glb` body-only file and `saberBody.js` go.
- **Stances to clips** (`combatRules.js`, the table reworked): single: light A, B, C then the Regular combo; heavy: Heavy A–D; dual and double keep the same clips with the left hilt mirrored as now; the block is `Sword_Block` held; the dash lunge is `Sword_Dash`; a stroke's direction comes from the movement key held at the click (W: the overhead, A or D: the side cut from that side, S: the rising cut, none: the combo's next). The parry is the first 0.25 s of the block.
- **Playing one.** `swing()` plays the clip on the animator's `full` layer; the stance's `speed` scales it; the root's travel moves the figure (the lunge becomes the clip's own step, scaled to reach the lock and capped at the stance's `lunge`); the lock turns the figure over the wind-up (the first 40% of the clip, eased), never snapped; inside the contact window the sword hand is corrected by two-bone IK toward the lock's chest by at most 0.25 rad; `blade.sweep` runs each frame of the window and `saberHit` lands what it finds. The hit's point is the sweep's nearest point, not `y + 1.1`.
- **Feel.** Hit-stop as now (`hitStop`), 120 ms on a parry; the camera nudges along the stroke; the trail from the blade's ring buffer, both blades in double and dual; sparks at the sweep's point; the clash sound on `clash`.
- **Blocking and deflecting.** Right button (or C, or the touch button) plays `Sword_Block` on the upper layer; the blade is up while it holds; bolts are turned by `crosses` when they arrive, not when fired, and a turned bolt goes back along its line toward its shooter (owner swapped), so a stormtrooper can be killed by his own bolt. The guard drains as now.
- **The mouse.** Left button strokes, right button blocks (`look.js`'s `onButton`); F and C keep working.
- **The throw** stays, now flying through `bolt.js`'s step with `world.solids`, so it stops at a wall and comes back.

### 7. Duellists (`src/lib/combat/duel.js`, `galaxy/surface/activity.js`)

Pure brain: `duelStep(d, you, dt, rng)` over states `approach` (close to `reach`), `circle` (strafe at reach, 1–2 s), `attack` (a stroke from the stance's table, the contact window from the clip), `recover`, `block` (raised when you start a stroke and the roll beats their `guard` rate, held through your contact window), `parry` (the block within `PARRY.window` before your contact: your stroke is turned, you stagger 0.6 s, they riposte), `stagger` (their guard broken, or hit), `dead`. Their swing's damage lands only when `blade.sweep` finds you inside their contact window; your block in the window turns it; your parry (the block pressed within the window before their contact) staggers them. `hostile.parry`'s random roll goes.

Every duellist is a rigged crew figure (`public/models/galaxy/crew/`: vader, maul, dooku, inquisitor, jedi, jedi2, jedi3) with a `saber` gunplay and this module; `heldBlade.js`'s unrigged arm goes. The Dagobah vision becomes a rigged Vader. Maul (Naboo), Dooku (Geonosis) and the Inquisitor (Lothal) are added as spawns with `blade` and `guard`.

### 8. Shooting (galaxy `scene.js`, universe `footScene.js`, `rickall.js`)

- The crosshair (`runtime/hud/Reticle.jsx`, on glass per the HUD rules) shows whenever a gun is up or the sights are on, in every world with a gun; it tightens with the sights and flashes on a hit.
- A shot: `aimPoint` from the camera's ray; `assist` by the device's cone; `bolts.fire` from the muzzle toward the point. The universe's third-person shot goes where the reticle is, bent by the assist's cone, no further; its first-person view-model aims at the same point as the bolt.
- Enemies: `accuracy.js` for the spread, `lead` for the aim, `world.solids` for the line; the mate is a body like any other; soldier-on-soldier shots are the same bolts and land where they land.
- Rick and Morty: Total Rickall's shot is a bolt with the room's solids; the duel dimension's shot too; the portal gun stays a dial.

### 9. Touch and the lock-on

Touch keeps its stick and buttons; the fire button taps snap inside the touch cone; a Lock button (and Tab) toggles the lock-on; the look pad's drag has friction over a target. On a coarse pointer the lock-on is on by default when a hostile comes within 14 m. The lock ring stays.

### 10. The desktop (`scripts/desktop`, `scripts/gen3d`, a new `scripts/motion`)

- **Now, gen3d**: hilts (Luke's, Vader's, Maul's double, Ahsoka's pair, Dooku's curved) and blasters (DL-44, E-11, A280, EE-3, DLT-19, WESTAR-34) from reference pictures, faces 6000, tex 1024; wired into `gunplay.js`'s `GUNS` as models in place of the boxes once each PR merges (the grip point and the muzzle named in the model, as the colliders are: `docs/assets/colliders.md`).
- **Then, a spike**: HY-Motion 1.0 on the desktop, one prompt ("a two-handed overhead sword strike, stepping forward"), its SMPL-H joints to BVH, a BVH→Rigify map into `ualRetarget.js`, baked as `ual-gen.strike.glb`, played on Luke in `scripts/preview/`. Done when the strike reads as a strike beside `Sword_Heavy_A`. If it does, the `motion` job: an issue labelled `motion`, `name`, `prompt` or `video`, the runner on the GPU, a PR with the clip and a four-frame sheet. If not, the note says why and the library's clips are what there is.

## Data flow, one frame on a galaxy surface

input snapshot (keys, `look.js`'s turn and buttons, the stick) → the camera's yaw and pitch → `aimPoint` (camera ray, world solids, hostiles' capsules) → `assist` → the player's intent: move, stroke (clip, direction), block, shot → the animator plays the clip (root travel moves the figure) → after the animator: the hilt in the hand, `blade.sweep` in the contact window, the IK correction → `bolts.step` (solids, capsules, blades) → hits: `saberHit`, `struck`, deflections → hit-stop, shake, sparks, sounds → `duelStep` and the shooters' `accuracy` for every hostile → the HUD's `combat` event (lock, guard, heat, reticle state) → draw.

## Testing

- Every pure module (`aim`, `bolt`, `accuracy`, `blade`, `duel`, the stance table) has its test beside it: a bolt that stops at a wall and one that passes a gap; magnetism that bends inside the cone and not outside; a lead that meets a walker; a sweep that hits a capsule the segment crosses and misses one it passes above; a clash where two segments cross; a parry inside the window and a block outside it; the duellist's states in order.
- `scripts/ual-bake.test.mjs` covers the `sword` set's extras (a contact window inside the clip, root travel that sums to the hips' displacement).
- `scripts/autopilot-check.mjs --routes` on Tatooine, Dagobah, a universe planet and Total Rickall before and after; the screenshots in the PR.
- A headless scenario test (`ground.scenario.test.js`'s pattern): a figure with a saber strokes at a capsule 1.8 m ahead and hits it; at 1.8 m and 2 m to the side, misses; a bolt fired at a target behind a wall stops at the wall.
- `scripts/anim-check.mjs` on a surface with a duellist: no foot drift over its limit through a combo.
- Checked by hand (and said so in the handoff): a trackpad on a Mac in Chrome and Safari, a mouse, a phone.

## Done when

- A stroke is a clip; the blade's sweep decides the hit; the hit point is on the blade.
- Blocking works: the blade held up on the right button, C or the touch button; a bolt that crosses it is turned back at its shooter and one that passes beside it is not; an enemy's stroke into the raised blade spends the guard and deals nothing; a block begun inside the parry window is a parry.
- Every bolt on the site stops at the first solid; the crosshair is up whenever a gun is; the universe's shot goes where the reticle is.
- A click locks the look on a mouse or a trackpad; a trackpad user can turn and fire; touch has friction and a snap.
- A duellist blocks, parries on contact and ripostes; a parry of yours staggers them.
- Enemies lead, miss first, can't shoot through walls.
- The hilts and blasters are requested from the desktop; the motion spike has an answer.
- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` green; no budget raised without a sentence saying why.
