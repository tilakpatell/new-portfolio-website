# Rapier as the body, the AI as the brain. The design

Date: 2026-10-09. Status: a conceptual blueprint, designed from the owner’s brief, waiting for the owner’s review before a plan is written. No code changes with it. The plan, once approved, goes to `docs/superpowers/plans/2026-10-09-rapier-body-ai-brain.md`; the decision entry to `docs/decisions/2026-10-09-rapier-as-the-body.md`.

## What the owner asked

“Architect a gameplay and AI system that embeds the Rapier Physics Engine natively throughout the entire runtime. The AI logic acts as the brain (making decisions), while Rapier acts as the body (movement controllers, collisions, physical forces).” Four things were asked for: a decoupled loop with a predictable order a frame; an extensible combat state machine whose active state writes velocity into Rapier’s kinematic character controller, and whose eyes are Rapier’s scene queries; hit registration through Rapier’s events, sensors or casts, with a hit coordinating a state change (stunned) with a physical reaction (knockback, a ragdoll); and the practices that keep it at 60 fps in a browser.

## Where the site is today

Read from the code on this branch. Every piece below exists and is tested in Node; nothing here replaces one.

**Rapier is the body of the props, not of the people.** `src/lib/physics/world.js` wraps `@dimforge/rapier3d-compat@0.21.0` as data: `createPhysics` gives `add(desc)`, `remove`, `step(dt)`, `onSubstep(fn)`, `alpha`, `onOrigin`; a fixed 1/60 s step with an accumulator and at most four substeps a call; contact-force events as a body’s `onHit`; three collision groups (`floor`, `object`, `bumper`); a floating origin. Rapier is imported there only, dynamically, so a page that never drives never downloads it. The vehicle, the heightfield, the props and the pusher sit beside it. Nothing in it is a character controller, a scene query or a sensor (`docs/stack/physics-rapier.md`).

**The brains are pure and already good.** `src/lib/ai/` has perception (beliefs with a detection timer, intuition, a coast and a fade), a behaviour tree, utility picking, context steering, position picking, influence maps, squads and tokens, and the seam to the body (`body.js`: a brain’s step read into speed, side, turn and look for the animator; `react.js`: what a figure plays when something happens to it). Every hostile on the galaxy surface, every watcher in Middle-earth, the hunters, the Decepticons run on it (`docs/superpowers/HANDOFF-npc-intelligence.md`).

**Combat is pure too, and its geometry is its own.** `src/lib/combat/` has the bolt step (`bolt.js`: a segment a frame against the world’s `solids`, the bodies’ capsules and the raised blades), the blade’s swept segment (`blade.js`), a duellist’s mind (`duel.js`: approach, circle, attack, recover, block, parry, stagger, dead), accuracy, aim and lock-on. The world hands these what is solid: on the galaxy surface, the circles and boxes `placer` makes (`surface/solids.js`), and `walker.js`’s `lineClear` is the line of sight. Everything a figure walks into, sees past or is hit through is decided by hand-written 2D and capsule maths, not by the physics engine that holds the props beside it.

**The runtime already has the loop.** `src/runtime/runtime.js` calls a world’s `step(dt, snapshot, now)` and then its `draw(...)` once a frame, with `dt` clamped to 50 ms; it moves the floating origin before the step; its workers are a pool for assets, not for simulation. A world module decides everything inside `step`.

**A ragdoll exists, without Rapier.** `src/lib/three/ragdollPhysics.js` is a Verlet body of points along the skeleton, settled against whatever the caller says is solid. The galaxy’s ground soldiers fall on it, four at once on the high tier.

So the gap is exact: the site has a brain, a combat ruleset and a physics engine, and they do not share a body. Movement, sight and hits each keep their own idea of the world.

## Decisions

Made for the owner, who asked for the design without checking in; each the choice a careful colleague would make. The long versions go in the decision entry once this is approved.

- **One world, three uses.** Rapier’s world becomes the one place where “what is solid” lives: the static scene as fixed colliders, props as dynamic bodies (as now), every figure as a kinematic capsule on Rapier’s `KinematicCharacterController`. Movement, sight and hits all ask the same world. `solids.js`’s circles, `walker.js`’s `lineClear` and `bolt.js`’s capsule list become callers of Rapier queries, not rival geometries. Their pure maths stays for the tests and for a world that opts out.
- **The brain writes intent, never a transform.** A brain’s only output is an intent: a horizontal velocity, a facing, and an action. A movement layer turns intent into a controller move each substep. Nothing in `src/lib/ai/` sees a Rapier handle.
- **Casts for what moves fast, events for what lingers.** A blade stroke and a bolt are shape casts and ray casts over their motion within the step (continuous, no tunnelling, one hit a swing by construction). Sensor colliders with collision events are for volumes that persist: an alert zone, a bite reach, a trigger. Contact-force events stay the props’ `onHit`. This is the one choice that most shapes the combat layer; the why is in section 3.
- **Knockback goes through the controller, never round it.** A kinematic body takes no impulse, so a hit writes a decaying knock velocity that the movement layer adds to the intent and the controller slides along walls as it would for a walk. A stunned figure is one whose intent is empty while its knock plays out.
- **Death keeps the Verlet ragdoll; Rapier answers what it lands on.** `ragdollPhysics`’s `collide` is answered by a point projection against the fixed colliders, so a body lands on the real floor and slides off the real ledge. A full Rapier articulated ragdoll is a later entry, not this one.
- **Thinking has a rate; sensing has a budget.** No brain thinks every frame; no frame fires more queries than a budget says. Both scale by distance to the player and by the device tier.
- **Layers as the rules say.** New physics pieces in `src/lib/physics/` (pure, Node-tested against the real engine, Rapier reached through the handle `createPhysics` returns, never imported again); the mind in `src/lib/ai/`; damage rules in `src/lib/combat/`; the bone-to-hitbox glue in `src/lib/three/combat/`; a world’s wiring beside its scene. British spelling, curly quotes, comments that say why.

## The shape

```
src/lib/physics/
  world.js          (as now) + drainCollisionEvents for sensors, a query pipeline
                    handle, a per-frame query budget
  groups.js         the collision-group table: who meets whom, who is seen by what
  character.js      createCharacter(phys, desc): the kinematic capsule on Rapier’s
                    controller; move(intent, dt) a substep; knock(v); grounded; pose
  queries.js        ray(), sweep(), overlap(), floorAt(): the eyes, with filters,
                    exclusions and the budget; every result plain numbers
  zones.js          createZone(phys, desc): a sensor volume with enter/leave events
src/lib/ai/
  mind.js           createMind(STATES, opts), mindStep(): the combat state machine,
                    states as a table, interrupts first, an intent out
  states/           patrol.js, search.js, chase.js, attack.js, stunned.js, flee.js,
                    dead.js: one file a state, each pure
src/lib/combat/
  damage.js         resolve(hit, attack, victim) → { damage, dir, force, kind }; the
                    knock and stun tables; one hit an attack a victim
  strike.js         the melee sweep: a blade or fist capsule cast over its motion
                    within the window, through queries.sweep
src/lib/three/combat/
  hitboxRig.js      reads a figure’s bones each frame into the shapes strike.js
                    casts (a blade segment, a fist, a bite) and the hurtbox offsets
src/components/<world>/
  <world>Physics.js the world’s static colliders from what it already builds
                    (placer’s solids, the heightfield), and the wiring of the three
                    layers into its step
```

## 1. System overview: who talks to whom

Four parts, one direction of flow a frame.

```
          input snapshot                          (the runtime)
                │
                ▼
   ┌───────────────────────┐   beliefs, intents   ┌───────────────────────┐
   │  AI layer             │ ───────────────────▶ │  Movement layer       │
   │  perception + mind    │                      │  character.js         │
   │  (src/lib/ai)         │ ◀─────────────────── │  (src/lib/physics)    │
   └───────────────────────┘   grounded, blocked, └───────────────────────┘
                ▲              knock left                 │ a move a substep
                │ query answers                           ▼
   ┌───────────────────────┐                     ┌───────────────────────┐
   │  Combat layer         │  casts, overlaps    │  Rapier world         │
   │  strike, bolt, damage │ ◀──────────────────▶│  world.js, queries.js │
   │  (src/lib/combat)     │  hits, events       │  (src/lib/physics)    │
   └───────────────────────┘                     └───────────────────────┘
                │ struck, knock, die                      │ positions, alpha
                ▼                                         ▼
          reactions (react.js) ──────────────▶  Visuals: figures, animator,
          state change (mind.on)                 hitbox rig, camera, draw
```

- **The Rapier world** is the one truth about where things are and what is solid. It is stepped at a fixed 1/60 s. It answers queries only about its last step.
- **The AI layer** never touches a body. It reads what the queries and the perception say, decides, and writes an intent per figure.
- **The movement layer** owns the figures’ bodies. Each substep it turns the held intent (plus gravity, plus any knock) into a controller move. It reports back what the controller found: grounded or not, slid along a wall or not, how much knock is left.
- **The combat layer** owns attacks and damage. An attack in its contact window casts its shape over its motion; a hit is resolved once per attack per victim into damage, a direction and a force; the result goes two ways at once, to the victim’s mind (a state change) and to the victim’s character (a knock), and to the visuals (a reaction clip, sparks, hit-stop).
- **The visuals** are last and read-only: positions interpolated by `alpha`, the animator fed by `body.js`’s seam, the hitbox rig refreshed from bones for the next frame’s casts.

The runtime is not changed. A world module does all of this inside its `step`, and its `draw` draws.

## 2. Component responsibilities

### The AI layer (`src/lib/ai/`)

Owns: what each figure believes, what mode it is in, what it wants to do this tick.

- **Perception** (as now, `perception.js`): beliefs per target from sight, hearing and stims. Its `seesThrough(a, b)` is answered by `queries.ray` (section 2, spatial sensing). It runs at the figure’s think rate, not every frame.
- **The mind** (`mind.js`, new): a state machine whose states are a table, so a world adds a state by adding a row.

  ```
  STATES = {
    patrol:  { tick(bb, w, dt) → intent | { to: 'chase' | 'suspicious' } },
    search:  { enter(bb, w), tick, exit },
    chase:   { tick },
    attack:  { tick },          // wraps duel.js for a duellist, the shot tokens for a shooter
    stunned: { enter, tick },   // intent empty; leaves on its timer
    flee:    { tick },
    dead:    { enter },         // terminal
  }
  createMind(STATES, { start, seed, rate }) → mind
  mindStep(mind, bb, w, dt) → intent
  mind.on(event, ctx)        // struck, lost, found, allyDown, guardBroken: an interrupt
  ```

  The rules that make it predictable: interrupts are looked at before the active state ticks (`struck` wins over everything but `dead`; `lost` moves chase to search; `found` moves search or patrol to chase); every transition goes through `exit` then `enter`; a state may use `utility.pick`, `tree.tick` or `spatial.pickPlace` inside its `tick` (the tools stay as they are); `bb` is the blackboard the toolkit already uses; `w` is the world as the figure may see it (its beliefs, the squad, the tokens, the query functions), never the truth. A state ticks only when its figure’s think timer is due; between ticks the last intent is held.

- **The intent** is the one thing the brain outputs, and the one thing the movement layer reads:

  ```
  intent: { vel: { x, z } (m/s, world axes), face: yaw, jump?: bool,
            act?: 'strike' | 'block' | 'shoot' | null, clip?, mode }
  ```

  `mode` rides along for `body.js`, which turns it into what the animator plays. Nothing else about the figure’s motion is the brain’s to say.

- **Steering** (`steer.js`, as now) is how `vel` is chosen inside a state: interest toward the belief or the picked place, danger from the obstacle whiskers and the ledge probe (section 2), separation from the squad. The context map is why a chase round a crate does not stall against it.

### The movement layer (`src/lib/physics/character.js`)

Owns: a figure’s body, and the only writes to it.

```
createCharacter(phys, { position, radius, halfHeight, mass, group: 'character',
  offset = 0.02, step: { height: 0.35, minWidth: 0.2 }, slope: { climb: 50°, slide: 60° },
  snap: 0.3, pushes: true, gravity })
  → { body, collider, move(intent, dt), knock(v), grounded, blocked, position(out),
      quaternion(out), prev (the pose before the last substep), yaw, remove() }
```

- The body is `kinematicPositionBased` with one capsule collider, so Rapier reports it to queries and events without the solver ever moving it. Its pose is set only by `move`, called from the physics world’s `onSubstep` hook, so a figure moves exactly once a substep and never between.
- `move` builds the step’s displacement: `intent.vel × dt`, plus the vertical speed it keeps for itself (gravity integrated, zeroed on the ground, a jump as a set speed), plus `knock × dt` with the knock decaying by `KNOCK.decay` a second, plus the controller’s autostep and snap-to-ground. It calls `computeColliderMovement` with the exclusion filter (its own collider, sensors), reads `computedMovement`, sets `setNextKinematicTranslation`, and reads `computedGrounded`. `blocked` is true when the asked horizontal movement and the computed one differ by more than a tolerance: the steering reads it as danger ahead on its next tick.
- With `pushes`, the controller’s `setApplyImpulsesToDynamicBodies` is on with the figure’s `mass`, so walking into a barrel shoves it (the pusher’s job, on the controller).
- Facing is `setNextKinematicRotation` from `intent.face`, turned at the figure’s turn rate, so the hurtbox and the strike shapes face where the figure does.
- It keeps `prev`, the pose before the last substep, so the visuals can interpolate by `alpha`.
- The player’s figure is a character like any other, driven by an intent the input makes. That is the point: one body for everyone.

### The combat layer (`src/lib/combat/` and `src/lib/physics/queries.js`)

Owns: what an attack is, what it hits, and what a hit does. Three sources of hits, one resolver.

- **Melee** (`strike.js`, new): an attack is `{ id, owner, shape: 'capsule' | 'ball', args, window: [t0, t1], damage, kind, reach }`. Each substep inside its window the hitbox rig gives the shape’s pose now and before; `queries.sweep` casts the shape over that motion against the `hurtbox` group, excluding the owner. The first hit on each new victim within this attack’s `id` is a hit; the same victim is never hit twice by one swing. `blade.js`’s segment maths stays as the Node fixture and as the fine test for a clash between two blades (blade on blade is not a hurtbox hit; it is a `clash`, and `strike.js` asks `blade.js` for it).
- **Projectiles** (`bolt.js`, as now): the bolt step keeps its API; the world’s `solids(a, b)` becomes `queries.ray` against `floor | object | character` and the bodies’ capsules are the `hurtbox` group through the same ray. One code path for every shot on every world.
- **Area** (a Force push, a pound, an explosion): `queries.overlap` with a ball at the point against `hurtbox` for figures and `object` for props; each figure in it is a hit with a direction from the centre, each prop gets `Body.push` (as now).
- **Persistent volumes** (`zones.js`, new): a sensor collider on a fixed or kinematic body with `COLLISION_EVENTS` and `ActiveCollisionTypes` widened so a kinematic figure counts; `world.js` drains `drainCollisionEvents` after each step beside the contact-force drain and hands a zone its `enter`/`leave` pairs with the figures’ handles. For a rancor’s bite reach, a town’s alarm, a trigger on the ground.
- **The resolver** (`damage.js`, new): `resolve(hit, attack, victim) → { damage, dir, force, kind, where }`. `dir` is the attack’s travel (a blade’s sweep direction, a bolt’s line, from the centre for area), `force` from the kind (`KNOCK = { light: 2.5, heavy: 6, lethal: 8 }` m/s at the chest, tuned later), `where` head or chest from the hit point’s height. It is pure and tested with recorded hits.

What a resolved hit does, in order, all in the same frame: the victim’s health; `mind.on('struck', { dir, force, kind })` (the state change: `stunned` for `react.js`’s seconds, `dead` on lethal); `character.knock(dir × force)` (the physical reaction); `react.on('hit' | 'down', ctx)` for the clip; the world’s own feel (hit-stop on the two animators involved, shake, sparks, sound). The mind and the body are told separately on purpose: a world that wants a brute no hit can stagger changes its `STATES.stunned`, not its damage.

### What stays where it is

`duel.js` is the inside of a duellist’s `attack` state; `accuracy.js`, `aim.js`, `lockOn.js` are unchanged; `squad.js`’s tokens still say who may strike or shoot; `react.js` still says what a figure plays; `body.js` still reads the step for the animator (it reads the character’s pose now, which is the same shape).

## 2b. Spatial sensing: the eyes

All through `queries.js`, all against the Rapier world’s last step, all returning plain numbers.

```
ray(from, dir, max, { groups, exclude, solid = true }) → { dist, at, normal, body } | null
sweep(shape, from, to, { groups, exclude })             → { toi, at, normal, body } | null
overlap(shape, at, { groups, exclude })                 → [body…]
floorAt(x, z, { from = 3, down = 6 })                   → { y, normal } | null
```

- **Line of sight**: `ray` from the figure’s eye to the target’s chest, groups `floor | object | character`, excluding the figure itself and every sensor (`QueryFilterFlags.EXCLUDE_SENSORS`). Clear if nothing is hit before the target, or the first hit is the target. Called by `perception.sense` as its `seesThrough`, at the figure’s think rate, one ray a belief, so a figure with one target costs one ray a tick.
- **Obstacle whiskers**: on each think tick, `sweep` of the figure’s own capsule along its chosen heading and the two headings ±35° beside it, 2 m ahead, groups `floor | object | character`. A hit under 2 m writes `steer.danger` in that slot scaled by closeness; the context map does the rest. Three casts a tick, not a frame.
- **Ledges**: `floorAt` 0.8 m ahead on the heading; no floor within the drop the figure accepts writes danger straight ahead. One ray a tick, only for figures the world marks as `careful` (a trooper on a landing pad, not a Goomba).
- **Reach**: before a strike, `sweep` of the weapon’s shape along the facing for the attack’s reach against `hurtbox`; a hit says the target is in reach and nothing is in the way. This is the same call the strike itself makes, so an attack the brain chose is one the blade can land.
- **Hearing, smell, the squad’s shared sightings**: no physics; `perception.js` and `squad.js` as now.
- **The player’s aim** (`aim.js`): the camera ray through `ray` against `floor | object`, the targets through `overlap` of a thin capsule along the ray against `hurtbox`; `assist` unchanged.

Every query goes through a budget (section 4). A query refused by the budget returns the last answer the caller kept, so a frame over budget degrades to a stale belief, never to a figure that sees through a wall.

## 3. The execution lifecycle: one frame

The order a world module’s `step(dt, input, now)` follows, then `draw`. The runtime calls them once a frame.

```
 1. origin        the runtime moved the floating origin before step; bodies shifted (as now)
 2. input         the snapshot → the player’s intent (vel, face, act)
 3. sense         for each figure whose think timer is due: queries (LOS rays, whiskers,
                  ledge), perception.sense → beliefs; stims from last frame’s events
 4. think         for each due figure: mind.on(queued interrupts), mindStep → intent held
 5. animate       mixer.update(dt) for every figure in view; the animator’s root motion
                  is read into the intent’s vel for a clip that travels (a lunge)
 6. rig           hitboxRig reads bones → each live attack’s shape pose (prev, now);
                  hurtbox offsets refreshed for a crouch or a fall
 7. step physics  phys.step(dt): for each 1/60 s substep:
                    a. onSubstep hooks: every character.move(intent, STEP)
                       (gravity, knock decay, controller move, grounded, blocked)
                    b. strike.sweep for each attack in its window over this substep’s
                       motion (its hits collected)
                    c. Rapier world.step (props, the vehicle, sensors)
                    d. contact-force events → onHit (as now); collision events → zones
 8. bolts         bolts.step(dt) over the stepped world (rays)
 9. resolve       damage.resolve for each hit, once an attack a victim: health, mind.on
                  ('struck' | 'dead'), character.knock, react.on, the world’s feel
10. sync          figures take position = lerp(prev, now, phys.alpha); the seam
                  (body.js) feeds the animator’s next blend; camera after the player
11. events        HUD numbers emitted at the throttled rate (as now)
12. draw          the runtime’s draw: the scene as it is
```

Why this order and not another: sensing reads the last step so it never sees a body half-moved (Rapier’s rule, “step before you ask”); thinking before animating means a clip chosen this tick starts this frame; rigging before the step means the sweep in 7b uses the blade’s pose for this frame and its pose from the last, so the cast covers exactly the motion the player sees; resolving after the step and after the bolts means every hit of the frame lands at once, so two figures striking each other in the same frame both take the hit (no order advantage); syncing after resolving means a knock that began this frame is visible this frame.

### The walkthrough: a trooper spots you, closes, and lands a hit

The figure is a trooper with a vibroblade on the galaxy surface. Its think rate is 10 Hz near you. Times are frames at 60 fps.

- **Frame 0, patrol.** The trooper’s timer is due. Step 3: its belief table is empty; `ray` from its eye to your chest, excluding itself and sensors, hits the crate between you: `seesThrough` says no. Step 4: `patrol.tick` keeps walking its route, `intent = { vel: toward the next waypoint at 1.4 m/s, face: along it, mode: 'patrol' }`. Step 7a: `move` asks the controller for 1.4 × 1/60 m along the route; the controller returns the same, grounded. Steps 10–12: the figure draws between its previous and current pose.
- **Frame 12, seen.** You step out. The next due tick’s ray reaches your chest first. `sense` starts the detection timer; at 9 m in a 30 m range it takes 0.6 s to fill. `mode: 'suspicious'` would be its interim; here the belief crosses the threshold at frame 48.
- **Frame 48, chase.** `found` is queued by perception; step 4 runs the interrupt first: `patrol.exit`, `chase.enter` (it claims a `run` token from the squad; the squad’s other trooper takes `cover`). `chase.tick`: `steer.seek` toward the belief’s `at`; the three whiskers: the centre sweep hits the crate at 1.6 m, so `danger` goes in that slot; the right whisker is clear; `resolve` gives a heading 30° right of the line. `intent = { vel: that heading at 4 m/s, face: at the belief, mode: 'chase' }`. Steps 7a: the controller moves it; `blocked` stays false.
- **Frames 49–100, closing.** The trooper does not think every frame; its intent is held and `move` runs it each substep. At frame 60 its tick re-casts: the crate is behind it, the centre is clear, the heading straightens. Its line of sight is re-asked once a tick (one ray). You back away; the belief coasts along your velocity between ticks.
- **Frame 102, in reach.** `chase.tick` asks the reach sweep: the blade’s capsule along its facing for 1.6 m hits your hurtbox, nothing in between. `to: 'attack'`. `attack.enter` claims the `melee` token (its squad-mate, without one, strafes). `attack.tick` wraps `duelStep`: `circle` for 0.4 s then `attack`, with `intent.act = 'strike'`, `clip: 'sword.light.a'`, `vel` from the clip’s root motion.
- **Frame 128, the window opens.** The clip’s baked contact window begins. Step 6: `hitboxRig` reads the hand bone and gives the blade capsule’s pose now and last frame. Step 7b: in each substep the sweep casts the capsule from last pose to this against `hurtbox`, excluding the trooper. Frame 131, substep 1: the cast reports a time of impact 0.4 along the motion, on your capsule, at chest height. The hit is recorded under this attack’s `id` with you as victim; the window’s remaining substeps find you again and are ignored.
- **Frame 131, the hit lands.** Step 9: `damage.resolve` → `{ damage: 2, dir: the blade’s sweep direction, force: 2.5, kind: 'light', where: 'chest' }`. Your health drops. Your mind (the player has none; the HUD takes the `combat` event) is skipped; your character takes `knock(dir × 2.5)`; `react.on('hit')` plays the hit clip on your upper layer; the world does its hit-stop on both animators, the sparks, the sound.
- **Frames 132–150, the knock plays out.** Each substep your `move` adds the knock to your input’s velocity; the knock decays by `KNOCK.decay`; the controller slides you along the wall behind you instead of through it. You are moving, not stunned: the player stays in control under a light hit.
- **The mirror, had you struck first.** Your blade’s sweep hits the trooper’s hurtbox at frame 128. `resolve` → `kind: 'heavy'`. `mind.on('struck')` interrupts `attack` (its token is released in `exit`), `stunned.enter` sets its timer from `react.js`’s table (1.2 s for a heavy); `stunned.tick` holds `intent = { vel: 0, face: as it was, mode: 'stunned' }`; `knock` throws it back 6 m/s decaying; `react.on('hit', { force })` plays the knock clip. Its squad hears `allyDown` only if it dies; here, at the timer’s end, `stunned` goes to `attack` if the belief is still in reach, else to `chase`. Had the hit been lethal: `dead.enter` removes the character (its body and hurtbox go from the world at the end of the step), the Verlet ragdoll takes the figure with `push = dir × force`, and its `collide` is answered by `queries.floorAt` and a point projection against `floor | object`, so it lands on the real crate.

## 4. Web optimisation: how it stays at 60 fps

The measure is the site’s own: the quality governor’s tier (`rt.quality`), the debug panel’s `tune()` groups for a world, and `scripts/perf-probe.mjs`. The budgets below are targets to hold on the mid tier with twenty figures in a fight; they are not measured yet and the plan’s first task measures them.

| part | a frame | how it is held |
| --- | --- | --- |
| Rapier step (≤ 4 substeps) | ≤ 1.5 ms | fixed step, substep cap, sleeping props, simple shapes |
| character moves (20) | ≤ 0.3 ms | one controller call a figure a substep, no allocation |
| queries | ≤ 0.3 ms | the budget: 24 rays + 8 sweeps + 4 overlaps a frame, staggered |
| thinking | ≤ 0.5 ms | 10 Hz near, 4 Hz mid, 1 Hz far; held intents between |
| sync + rig | ≤ 0.3 ms | only figures in view; bones read once |

The practices:

- **A fixed step with a cap** (as now): the loop never spirals when a frame is late; at four substeps the rest of the time is dropped and the world slows rather than the tab locking.
- **Think rates by distance and tier.** Each figure has a timer with its own phase offset, so twenty figures at 10 Hz think about two a frame, never all on one. The rings: within 25 m of the player 10 Hz, to 60 m 4 Hz, beyond 1 Hz with no queries (beliefs coast, the whiskers are skipped, the figure walks its route). The device tier (`lib/device`) scales the rings and the figure count, as it scales the soldier counts today.
- **Queries have a budget, and the budget degrades gracefully.** A per-frame counter in `queries.js`; a refused call returns the caller’s last answer. Line-of-sight rays go first (a figure that sees through a wall is the worst failure), whiskers second, ledge probes last.
- **Groups before geometry.** Every collider has a membership and a filter from `groups.js`; a query names the groups it wants, so Rapier’s broad phase skips what the brain does not care about. A hurtbox is in the `hurtbox` group only; a whisker never casts against it; a strike never casts against `floor`.
- **Casts, not dynamic bodies, for fast things.** A bolt as a dynamic body at 90 m/s would need continuous collision on every one and still wake what it passes; a ray a step costs nothing and never tunnels. A blade sweep as a cast is one call a substep in its window, and nothing between windows.
- **Sensors only where they persist.** A zone is one collider with events; it costs a broad-phase pair when a figure is inside and nothing otherwise. Figures carry no sensors by default.
- **Simple shapes, fixed trimeshes.** A figure is one capsule; a prop is a hull or a primitive (a moving trimesh falls through the floor, the rule as now); the ground is the heightfield; a building’s walls are cuboids from `placer`’s boxes, not its render mesh.
- **Sleep what is far.** `sleepOutside` (as now) for props; a character beyond the far ring is `enable(false)` and its intent cleared, so neither the controller nor the solver sees it; it wakes on its next due tick.
- **No allocation in the hot path.** The controller, the ray and the shape objects are made once per character and reused; `position(out)` and `quaternion(out)` fill arrays the caller owns (as `world.js` does); the interpolation writes into the figure’s own vectors.
- **One world, one wasm instance, warmed.** `preload()` already loads and warms the engine; a world that will fight calls it while the ship comes down. Rapier runs on the main thread by design: the brain’s queries are synchronous and a worker would cost a copy of every result and a frame of latency on every sight; the runtime’s worker pool stays for assets.
- **Interpolate, never extrapolate.** Figures draw at `lerp(prev, now, alpha)`, one substep behind at most (under 17 ms), which the eye does not see and which never shows a figure inside a wall it is about to be pushed out of.
- **Measure before tuning.** The world’s `tune()` groups expose the budget counters, the think rates and the substep count; the plan’s first PR lands the counters so every later number is read, not guessed.

## What it is not

- Not a rewrite of `duel.js`, `bolt.js`, `blade.js`, `perception.js`, `steer.js` or `squad.js`. Each keeps its API and its tests; each gains a caller that feeds it Rapier’s answers.
- Not the vehicles, the landings or the universe map’s ships. `vehicle.js` and `ship.js` stay as they are.
- Not a Rapier articulated ragdoll, not multibody joints. The Verlet ragdoll stays; a later entry may replace it.
- Not multiplayer. A remote pilot’s figure is a kinematic capsule set from the wire, and the same hurtbox; nothing on the wire changes.
- Not every world at once. The first world is the galaxy surface, where the hostiles, the duellists and the Battlefront armies already run on the toolkit and where `placer`’s solids map straight onto fixed colliders. Each further world is its own lane, as the runtime’s migration was.

## Tests

Every pure module has its test beside it, in Node against the real engine:

- `character.test.js`: a figure walks a slope under `climb` and slides on one over it; steps a 0.3 m kerb and not a 0.5 m one; is stopped by a wall and `blocked` says so; falls and lands with `grounded`; a knock of 6 m/s decays to under 0.1 within `KNOCK.decay`’s time and slides along a wall; `prev` and the pose differ by one substep’s motion.
- `queries.test.js`: a ray stops at a wall before a figure; excludes its own capsule and a sensor; a sweep reports the time of impact of a capsule onto a box; the budget refuses the 25th ray and the caller gets its last answer; `floorAt` finds the heightfield.
- `mind.test.js`: `struck` interrupts every state but `dead`; `exit` runs before `enter`; a held intent between ticks; the same seed gives the same transitions.
- `strike.test.js`: a blade cast over one substep hits a capsule it crosses and misses one it passes above; a victim is hit once per attack; a blade meeting a blade is a clash, not a hit.
- `damage.test.js`: the knock table, the direction of a sweep hit, head and chest from height.
- `zones.test.js`: enter and leave for a kinematic capsule crossing a sensor, in order, once each.
- The world’s wiring test with a fake runtime (the module pattern): a trooper spawned behind a crate cannot see the player until it steps out, chases, strikes, and the player’s health drops; the frame order above holds (asserted through counters).
- `scripts/perf-probe.mjs` with twenty figures: the table’s budgets.

## Adoption on the galaxy surface

1. Counters and the query budget first, with nothing using them: a PR that measures.
2. `groups.js`, `queries.js`, the collision-event drain in `world.js`; `solids.js` answers through `queries.ray` behind a flag, the old maths kept as the test fixture.
3. `character.js`; the player’s walker on it behind the same flag; a side-by-side check (`scripts/autopilot-check.mjs --only smoke` on the surface routes, then a walk in dev).
4. `mind.js` and the states; `hostileStep` becomes the `attack` and `chase` states’ inside; the surface’s hostiles move on characters.
5. `strike.js`, `damage.js`, `hitboxRig.js`; the saber’s sweep and the bolts’ solids through queries; the flag goes.
6. `zones.js` where the surface has a volume to want (the rancor’s bite).
7. The decision entry, the stack page’s “Where it is used”, the hand-off.

## Open questions for the owner

- **The player on the controller.** The design puts the player’s figure on the same character controller as the NPCs (one body for everyone). The surface’s current walker has feel the visitors know; moving it is the largest single change in the adoption. The alternative is NPCs on Rapier and the player on the walker, with the player’s hurtbox a kinematic capsule set from the walker each frame. The design recommends the first; the second is the smaller first lane.
- **Hurtbox detail.** One capsule a figure (this design) or head, chest and limbs on the one body with offsets from bones (a later row in `hitboxRig.js`, needed only when a headshot should count).
- **Which world first.** The galaxy surface (recommended: it has the most on the toolkit) or the Death Star inside (smaller, indoor, already has the richest saber effects).
