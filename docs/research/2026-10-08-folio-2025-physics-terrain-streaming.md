# Bruno Simon's folio-2025, read for the physics, the natural look and the streaming

Date: 2026-10-08. Read from a checkout of `github.com/brunosimon/folio-2025` (`sources/Game/`, `static/`, `scripts/`) for the design `docs/superpowers/specs/2026-10-08-natural-worlds-design.md`. Three passes, one each: the physics, the vehicle and the game loop; the terrain, the rivers, the grass, the trees, the wind, the fog and the light; the world's size, what follows the camera, what loads when. Line numbers are from the checkout at the time of reading.

The earlier notes on his 2019 folio and on grass and foliage in general are `docs/research/2026-10-06-bruno-simon-folio.md` and `docs/research/2026-10-06-ground-grass-foliage-techniques.md`. Three of his pieces are already in this repo, ported from the same source: `src/lib/three/grass.js` (his Grass.js), `src/lib/three/wind.js` (his Wind.js), `src/lib/three/groundmap.js` and `src/lib/three/house.js` (his Terrain.js mask and his MeshDefaultMaterial's shade-as-a-colour, fog-as-the-sky and ground bounce). What this note adds is everything round them: the rigid bodies and the car, the water, the trees and leaves, the tracks, and how the world is sized to the camera.

## The short version

- **The engine is Rapier (wasm), stepped once a frame at the frame's delta (capped at 1/30 s, times a time scale of 2).** Everything is a rigid body from Blender's naming: `*Physical*` nodes with `cuboid*`/`tube*`/`hull*`/`trimesh*`/`ball*` children as colliders. Props spawn asleep, light (0.02 to 0.1) against a 2.5 chassis, and are put back to sleep when outside the camera's ground radius. Collision events are opt-in and thresholded.
- **The car is Rapier's `DynamicRayCastVehicleController`** on a chassis of three cuboids: the mass box with its centre of mass 0.5 m below it (the anti-roll trick), a top box, and a bigger zero-mass "bumper" in its own collision group that pushes props but never touches the floor. Suspension rest length and stiffness are changed at run time per wheel: that is the jump and the low-rider. Top speed is soft (`force / (1 + overflow)`); you must stop before reversing; an idle brake of 0.06 coasts the car to a stop; auto-unflip after 3 s upside down.
- **The ground is one mask texture (R paving, G grass, B water depth) over a 192 m square, and a flat heightfield** whose only relief is the river beds (0 down to −1.5 m). The visible floor is a camera-following plane displaced by `−1.5·B`, snapped to its cell grid so it never swims. **The water is a flat white quad at −0.3 m** that only draws where B > 0.17; between the bank and that line the floor's depth gradient shows through, blurred, with animated contour lines (`fract((B + t·0.5)·10) − (1.3 − 1.3B) + perlin`), voronoi ice as it gets cold and voronoi-ring splashes in rain.
- **Everything that follows the camera is sized from one "optimal area":** the four screen corners projected onto the ground give a centre and a radius; the floor plane, the grass patch, the water quad, the snow grid, the rain, the leaves, the shadow camera and the fog near/far all take it. Grass is 78,400 single-triangle blades wrapped toroidally round that centre (`mod(p − c + h, s) − h`), re-deriving everything from the wrapped world position.
- **One wind function (two scrolled perlin octaves) moves the grass tips, rotates the leaf cut-outs on the trees, sways the flowers, pushes the falling leaves and times the ripples**, so the scene breathes as one.
- **Tracks are a GPU ring buffer of wheel contact points, drawn as ribbons by a top-down camera into a 512² render target over 40 m**, which the ground, the grass (`G × (1 − r)`) and the snow all read. That is how the car flattens grass and carves snow for free on the main pass.
- **The world is finite (192 m) and nothing streams:** one GLB holds every area, every body exists from boot, and the loader is two flat batches with no priority. Past the edge a kinematic slab follows the player under the sea. What transfers to an infinite world is the optimal area, the wrapped detail layers, the sleeping discipline, and the per-area frustum gating; what must be added is chunked heightfields and masks made off-thread, chunked colliders, and seeded placement per cell.

## Part 1: physics, the vehicle and the game loop

All paths are relative to `sources/Game/` in the folio-2025 checkout. Library versions from its `package.json`: `@dimforge/rapier3d ^0.17.3`, `three ^0.183.2` (the WebGPU/TSL build).

### 1. Physics engine

**Library.** Rapier3d (wasm, the non-compat package). It is dynamic-imported late in boot so it loads in parallel with the big GLB batch: `Game.js:129 const rapierPromise = import('@dimforge/rapier3d')`, awaited together with resources at `Game.js:181 const [ newResources, RAPIER ] = await Promise.all([ resourcesPromise, rapierPromise ])`, then stored as `this.game.RAPIER`. Only after that are `Terrain`, `Physics`, `PhysicsWireframe`, `PhysicsVehicle`, `Zones`, `Player` constructed (`Game.js:185-190`). Everything created before (Objects, World step 0, View) does not touch physics.

**World creation.** `Physics.js:10-25`:
```js
this.world = new this.game.RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 })
this.eventQueue = new this.game.RAPIER.EventQueue(true)
```
All integration-parameter overrides are commented out (`Physics.js:13-24, 47-57`), i.e. Rapier defaults: 4 solver iterations, contact_erp 0.2, allowed linear error 0.001, prediction distance 0.002, no CCD, minIslandSize 128. Only gravity.y is debug-bindable.

**Timestep: variable, no substeps, no interpolation.** Each tick does `this.world.timestep = this.game.ticker.deltaScaled` then `this.world.step(this.eventQueue)` (`Physics.js:242, 262`). `deltaScaled` is the frame delta clamped to 1/30 s and multiplied by the time scale (default 2, see section 3), so the physics world advances up to 1/15 s of simulated time per frame in one step. Visuals copy body transforms directly after the step; there is no fixed accumulator or render interpolation.

**Per-frame water damping** (`Physics.js:244-259`): for every registered physical, `waterDepth = max(-translation.y, water.surfaceElevation)` (surface is at `-0.3`, `Water.js:10`); if `> 0` the body gets linear/angular damping 1, else its own stored `linearDamping`/`angularDamping` (defaults 0.1/0.1, `Physics.js:90-91`). Gravity-scale buoyancy is commented out.

**Body factory `getPhysical(desc)`** (`Physics.js:84-238`) is the single entry point. Description fields: `type` (`dynamic` default | `fixed` | `kinematicPositionBased` | `kinematicVelocityBased`), `position`, `rotation` (quaternion), `canSleep`, `sleeping`, `enabled`, `linearDamping`, `angularDamping`, `mass`, `friction`, `frictionRule` (`average|min|max|multiply` -> `CoefficientCombineRule`), `restitution`, `category`, `onCollision`, `contactThreshold`, `collidersOverwrite`, `waterGravityMultiplier` (stored but unused), and `colliders[]`. Each collider entry has `shape` in `cuboid | ball | cylinder | trimesh | hull (convexHull) | heightfield`, `parameters` spread straight into the `ColliderDesc` constructor, optional `position`, `quaternion`, `mass`, `centerOfMass`, `friction`, `restitution`, `category`.

Defaults applied per collider: `setDensity(0.1)` (`:172`), then if a collider `mass` is given it overrides via `setMass` or `setMassProperties(mass, centerOfMass, {1,1,1}, identityQuat)` (`:174-180`); if a body-level `mass` is given it is split evenly: `setMass(mass / colliders.length)` (`:184`). Friction default `0.2` (`:192`), restitution default `0.15` (`:204`). Collision events are opt-in: only when `onCollision` or `contactThreshold` is set does it call `setActiveEvents(CONTACT_FORCE_EVENTS)` and `setContactForceEventThreshold(contactThreshold ?? 15)` (`:214-222`). The body's starting transform and sleep state are saved as `physical.initialState` (`:229-233`) for resets.

**Collision groups** (`Physics.js:30-39`): three membership bits `all=1, object=2, bumper=4`, combined into Rapier's 32-bit `(memberships << 16) | filter`:
- `floor`: member `all`, collides with `all`.
- `object` (default): member `all|object`, collides with `all|bumper`.
- `bumper`: member `bumper`, collides with `object` only.
Net effect: the car's oversized "bumper" cuboid pushes dynamic props but never touches the floor/heightfield, so it cannot snag terrain.

**Events** (`Physics.js:281-312`): after the step, `eventQueue.drainContactForceEvents`; each collider's `parent()` body carries `userData.object.physical.onCollision` (set in `Objects.js:88`). The callback gets a normalised force `event.maxForceMagnitude() / (mass1 + mass2)` and a world position (the non-origin body's translation). This is used purely for impact sounds and crate detonation. Collision-start events are commented out as "not handy". Note `getFromModel` deliberately does not attach `onCollision` to auto-loaded dynamic props: "removed, too expensive" (`Objects.js:148-155`).

**Sleeping / culling.** Props are created `sleeping: true`; `Objects.update()` (`Objects.js:304-361`) copies body transform to visuals only when `needsUpdate` or `!isSleeping() && isEnabled()`. When the camera focus moves by a whole metre (rounded x/z), any awake, enabled body farther than `view.optimalArea.radius` (the ground radius of the camera frustum) is forced to `sleep()` (`:349-358`). Anything that falls below `water.depthElevation = -1.5` (`Water.js:11`) is reset to its initial transform (`:344-347`). Reset (`resetObject`, `:227-270`) disables the body, sets translation/rotation/velocities with `wakeUp=false`, resets forces, re-enables one frame later, re-sleeps if it started asleep, and flags `needsUpdate` one frame after that.

**Debug wireframe** (`PhysicsWireframe.js:44-58`): `world.debugRender()` vertices/colours poured into a `LineSegments` buffer each tick at phase 4, off by default.

### 2. Vehicle

**Model: Rapier's built-in `DynamicRayCastVehicleController`** (Bullet-style raycast vehicle) on a custom chassis rigid body: `PhysicsVehicle.js:69 this.controller = this.game.physics.world.createVehicleController(this.chassis.physical.body)`.

**Chassis** (`PhysicsVehicle.js:87-109`): a dynamic body via `objects.add(null, {...})`, `friction: 0.4`, `canSleep: false`, three cuboid colliders (half-extents):
```js
{ shape: 'cuboid', mass: 2.5, parameters: [ 1.3, 0.4, 0.85 ], position: { x: 0, y: -0.1, z: 0 }, centerOfMass: { x: 0, y: -0.5, z: 0 } }, // Main
{ shape: 'cuboid', mass: 0,   parameters: [ 0.5, 0.15, 0.65 ], position: { x: 0, y: 0.4, z: 0 } },                                   // Top
{ shape: 'cuboid', mass: 0,   parameters: [ 1.5, 0.5, 0.9 ],  position: { x: 0.1, y: -0.2, z: 0 }, category: 'bumper' },             // Bumper
```
Total mass 2.5 with the centre of mass pushed 0.5 m below the main box: this is the anti-roll trick. The bumper is a larger zero-mass box in the `bumper` group (hits props, ignores floor). Forward axis is +X, side +Z, up +Y (`:23-25`). Chassis `onCollision` plays `hitDefault`. Mass is cached as `this.chassis.mass` for impulse scaling.

**Wheels** (`PhysicsVehicle.js:111-201`): four wheels added with placeholder params, then configured by `updateSettings()`:
```js
offset: { x: 0.90, y: 0, z: 0.75 }, radius: 0.4,
directionCs: { x: 0, y: -1, z: 0 }, axleCs: { x: 0, y: 0, z: 1 },
frictionSlip: 0.9, maxSuspensionForce: 150, maxSuspensionTravel: 2,
sideFrictionStiffness: 3, suspensionCompression: 10, suspensionRelaxation: 2.7, suspensionStiffness: 25
```
Wheel order: 0 = (+x,+z) front-right, 1 = (+x,-z) front-left, 2/3 rear. Wheels 0 and 1 steer (`:488-489`). Suspension rest length and stiffness are set every frame per wheel from the player's per-wheel suspension state (`:495-496`) using `suspensionsHeights = { low: 0.88, mid: 1.23, high: 1.63 }` and `suspensionsStiffness = { low: 20, mid: 30, high: 40 }` (`:31-40`). This is how "jump" works: pressing Space sets all four wheels to `high` (rest length 0.88 -> 1.63, stiffness 40), the spring shoves the chassis up; the numpad keys set individual corners to `mid` (low-rider). Honk pops a random wheel to `mid` for 0.15 s (`Player.js:503-520`).

**Driving constants** (`PhysicsVehicle.js:14-21`): `steeringAmplitude 0.5` rad, `engineForceAmplitude 300`, `boostMultiplier 2`, `topSpeed 5`, `topSpeedBoost 40`, `brakeAmplitude 35`, `idleBrake 0.06`, `reverseBrake 0.4`.

**Pre-physics update** (phase 2, `PhysicsVehicle.js:457-513`):
```js
const topSpeed = lerp(this.topSpeed, this.topSpeedBoost, player.boosting)
const overflowSpeed = Math.max(0, this.speed - topSpeed)
let engineForce = (player.accelerating * (1 + player.boosting * boostMultiplier)) * engineForceAmplitude / (1 + overflowSpeed) * ticker.deltaScaled
```
Top speed is soft: force decays as 1/(1+overflow) rather than clamping. Brake: `player.braking` (0/1); if not braking and |accelerating| < 0.1, `brake = idleBrake` (coast friction); if speed > 0.5 and the input opposes travel direction (`goingForward` flag), `brake = reverseBrake` and `engineForce = 0` (you must stop before reversing). `brake *= brakeAmplitude * deltaScaled`. Note both force and brake are pre-multiplied by `deltaScaled`, a quirk inherited from tuning at ~1/30 s. Steering is applied raw (`steering * 0.5`). Ice: if `wheelGroundObject(i).parent()` is the ice body, `frictionSlip` lerps toward `0.04` by `iceRatio` (`:499-507`). Finally `controller.updateVehicle(delta)` with `delta = quality.level === 1 ? 1/60 : min(1/60, ticker.deltaAverage)` (`:511-512`): the vehicle controller runs at a capped/averaged dt even though the world steps at the full scaled delta.

**Post-physics measurement** (phase 5, `:515-578`): velocity is derived from position difference, `speed = |velocity| / deltaScaled`, `xzSpeed`, `forwardRatio = direction·forward`, `goingForward = forwardRatio > 0.5`, `forwardSpeed = speed * forwardRatio`; Euler angles `xRotation ('XYZ')`, `yRotation ('YXZ')`, `zRotation ('ZYX')`. Per wheel it caches `wheelIsInContact`, `wheelContactPoint`, `wheelSuspensionLength`, and `lastTouchTime`; `justTouchedCount` counts wheels that touched within the last 0.2 s when the contact count rises (used for landing spring sounds, `Player.js:626-630`).

**State detectors:** `stop` hysteresis (`speed < 0.04` stop, `> 0.7` start, `:203-230`); `upsideDown` when `up·(0,-1,0)*0.5+0.5 > 0.3` (`:232-260`); `stuck` when accumulated travel over the last 3 s of accelerating input is `< 0.5` m (`:262-314`); `flip` detection accumulates `smallestAngle` deltas of x/z rotation while all 4 wheels are airborne and fires on landing when `|accX| < 1 && |accZ| > 5` rad, sign = front/back flip (`:344-402`).

**Auto-unflip** (`PhysicsVehicle.js:404-438`, triggered from `Player.js:358-393` after 3 s upside down, repeating until upright): impulse `(0, flip.force=5, 0) * mass`, then torque impulse: if the up axis is dominant (fully inverted) `torqueX = 0.8 * mass` in body space; if on its side, `torqueX = sidewardDot * 0.4 * mass`, `torqueZ = -forwardDot * 0.8 * mass`, rotated by the body quaternion. **Respawn** (`moveTo`, `:446-455`) sets translation/rotation and zeroes both velocities; respawn points come from `respawnsReferences.glb` empties named `respawn<Name>` with y forced to 4 (`Respawns.js:150-169`) and `getClosest` by xz distance; `Player.respawn` wraps it in an overlay fade. Enabling/disabling the body is used while in menus (`activate/deactivate`, `:580-590`). External forces: `Explosions.js:26-66` applies `applyImpulseAtPoint(impulse * mass, position)` one frame later with direction `(dir xz normalised*0.5, y=1)` and strength `remapClamp(dist, 1, radius=7, 1, 0) * 4`, and the tornado applies a continuous impulse `strength * deltaScaled * tornado.strength * 30` with a 45° tangential twist (`Tornado.js:234-253`).

**Wheel visuals** (`World/VisualVehicle.js:418-468`): chassis mesh copies physics position/quaternion. Visual steering is smoothed: `steering += (player.steering * 0.5 - steering) * deltaScaled * 16`. Wheel spin `forwardSpeed / radius * 0.006` per frame (frozen while brake is held without throttle). Vertical position: `wheelY = min(basePosition.y - suspensionLength, -0.5)` then eased `y += (wheelY - y) * 25 * deltaScaled`; the suspension strut mesh is scaled `|y| - 0.5`. Wheels 0 and 2 are mirrored by `rotation.y = π`.

**Tracks / trails from wheel contact.** Each wheel owns a `Track(0.5, 'r')` and the vehicle a `Track(1.5, 'g')` (`VisualVehicle.js:251, 287`); each frame `groundTrack.update(physicalWheel.contactPoint, physicalWheel.inContact)` (`:467`) and `mainGroundTrack.update(position, position.y < 1.5)`. A `Track` (`Tracks.js:94-250`) is a 128-point ring buffer in a 128×1 float `DataTexture`; new points are pushed only every 1/30 s and 0.2 m, and the alpha channel is the contact flag. A GPU vertex shader extrudes a ribbon perpendicular to successive points (`:142-177`). All track ribbons are rendered by a top-down orthographic camera (40 m square, 512² RT, following `tracks.focusPoint`) into a render target (`Tracks.js:18-34, 76-90`), and `Terrain.terrainNode` multiplies the grass channel by `1 - tracks.r` to flatten grass under the wheels (`Terrain.js:98-103`). Boost trails are `Trails` (`Trails.js`): 32-sample ring buffers advanced every 0.4 m with alpha decaying at 0.2/s, drawn as an open 4-sided cylinder re-oriented per segment in the vertex shader. There is no dust particle system driven by wheels; Snow/Leaves read the tracks RT instead.

### 3. Game loop ordering

The renderer drives everything: `Rendering.js:68 renderer.setAnimationLoop(t => ticker.update(t))`. `Ticker.update` (`Ticker.js:24-61`): `delta = min(elapsedSeconds - elapsed, maxDelta = 1/30)`; `deltaScaled = delta * scale`; `elapsedScaled += deltaScaled`; a 30-sample rolling `deltaAverage`; TSL uniforms for elapsed/delta (scaled and unscaled); a frame-count `wait(frames, cb)` queue; then `events.trigger('tick')`. `Time.js` sets `defaultScale = 2` (`Time.js:11`) and mirrors it onto gsap's global timeline; bullet time remaps the scale to `0.5` with in-speed 3 and out-speed 0.3 per second (`Time.js:35-70`). So the simulation runs at 2× real time by default, a core part of the arcade feel.

Phase ordering comes from `Events.on(name, cb, order)` which stores callbacks in a sparse array indexed by order and iterates `for (const order in callbacks)` (`Events.js:8-21, 50-63`). Subscriptions found in code: Time 0, Inputs 0 (`Inputs.js:55`), Player:pre 1, PhysicsVehicle:pre 2, Physics 3, PhysicsWireframe 4, Objects 4, PhysicsVehicle:post 5, Player:post 6, View 7, Zones 8, VisualVehicle 8, Tracks 9, Terrain/Trails/Floor/Areas/Bricks etc. 10, InstancedGroup 13, Audio 14, Rendering 998. This matches readme "Game loop" (readme.md:22-108). Key consequence: input -> player intent -> vehicle forces -> world step -> transforms copied to visuals -> camera -> everything that depends on camera. Because physics bodies subscribe to the same tick, there is no separate fixed-step thread.

### 4. Terrain

`Terrain.js` is data only: `subdivision 128`, `size 192` m (`:12-13`), a 1×16 canvas gradient for dirt/water colour, and TSL nodes: `terrainNode(worldXZ)` samples `terrainTexture` with UV `pos / 128 / 1.5 + 0.5` (so the texture covers 192 m) and returns RGBA data (r = slab mask, g = grass, b = depth/height), after knocking grass out with the tracks RT. `Floor.js` builds the visual and the collider. Visual (`Floor.js:33-118`): a `PlaneGeometry` of side `round(optimalArea.radius*2)+1` with 1.5 m cells that follows the camera, snapped to the cell grid (`:178-179`) so vertices never swim; displacement `y += terrainData.b * -1.5` (`:84`). Collider (`Floor.js:120-153`): heights are read from `terrainModel.glb` (`scene.children[0].geometry`), scattered into a `rowsCount²` grid by rounding `x,z / 192 + 0.5` to indices, and passed as `ColliderDesc.heightfield(rows-1, cols-1, heights, { x: 192, y: 1, z: 192 })` on a fixed body with `friction 0.2`, `restitution 0.15`, `category 'floor'`. The visual displacement texture and the physics GLB are authored to match but are separate assets; the car follows terrain purely by the wheel raycasts hitting the heightfield. A kinematic "bedrock" cuboid (12×1×12 m) is enabled only when the player is within 6 m of the 192 m edge and is teleported under the player each frame (`Floor.js:155-208`) so you cannot fall off the heightfield.

### 5. Objects.js / InstancedGroup

**GLB naming convention** (`Objects.getFromModel`, `Objects.js:114-219`): a node whose name matches `/physical/i` gets a body; `/dynamic/i` or `/kinematicPositionBased/i` in the name picks the type, otherwise `fixed`. Direct children named `trimesh*`, `hull*`, `cuboid*`, `tube*` (cylinder, params `[scale.y/2, scale.x/2]`), `ball*` (`[scale.y/2]`) become colliders using the child's local position/quaternion and, for cuboid, half the scale; those children are removed from the visual. Blender custom properties `userData.restitution/friction/category/mass/prevent/preventAutoAdd/preventFrustum` flow through. `Area.setObjects` (`Area.js:32-70`) and `Scenery` (`Scenery.js:222-244`) call `addFromModel` for every child of `areas.glb` / `scenery.glb` with `sleeping: true`, so all level geometry is trimesh/hull/primitive fixed bodies declared in Blender.

**Props via InstancedGroup** (Bricks, Benches, Fences, Lanterns, ExplosiveCrates, bowling pins, cookies, fans): `InstancedGroup.getBaseAndReferencesFromInstances(children)` clones the first instance as the base mesh and makes an `Object3D` reference per placement. Each reference is registered with `objects.add({ model: reference, parent: null }, { type: 'dynamic', position, rotation, sleeping: true, ... })` so the reference Object3D (never added to the scene) is what `Objects.update` writes the body transform into. Each class's tick (phase 10) sets `reference.needsUpdate = true` for awake bodies, and `InstancedGroup.update` (phase 13) recomputes `localMatrix.premultiply(reference.matrixWorld)` only for flagged references and sets `instanceMatrix.needsUpdate` once (`InstancedGroup.js:88-116`). Tuning: bricks `friction 0.7, mass 0.1`, cuboid half-extents `[0.5625, 0.375, 0.75]`, `contactThreshold 15` (`Bricks.js:33-47`); crates `mass 0.02`, half `0.5`, `contactThreshold 0` so any touch explodes (`ExplosiveCrates.js:103-117`); lanterns `mass 0.1`, half `[0.35, 0.5, 0.35]`, threshold 10; benches/fences `mass 0.1`, colliders extracted from the base model, threshold 10; pins `friction 0.5, mass 0.02, linearDamping 0.1, angularDamping 0.5, contactThreshold 5` (note `resitution: 0.5` is a typo so default 0.15 applies) (`BowlingArea.js:288-306`); bowling bumpers kinematic with `restitution 1, friction 0`; cookies `cylinder [0.275, 0.625]`; trees fixed cylinders `[2.5, 0.15]` friction 0.7; pole lights fixed cuboids `[0.2, 1.7, 0.2]`. Pin "down" = body up-vector y < 0.5 (`BowlingArea.js:730-732`). Global defaults again: density 0.1, friction 0.2, restitution 0.15, damping 0.1/0.1.

### 6. Performance tricks

- Rapier wasm loaded in parallel with assets; physics classes constructed only after both resolve.
- Every prop spawns asleep; awake bodies outside the camera ground radius are put back to sleep each time the focus moves 1 m; visual sync happens only for awake+enabled bodies or explicit `needsUpdate`.
- Instanced rendering for all repeated props with per-instance matrix updates gated by a dirty flag; one `instanceMatrix.needsUpdate` per group per frame.
- Collision events opted in per body with high thresholds (5–15) and disabled entirely for auto-loaded props.
- Bumper collider isolated into its own group to avoid floor contacts; no CCD; default solver iterations.
- Vehicle controller dt capped at 1/60 (averaged) while world dt is the clamped frame delta; frame delta hard-capped at 1/30 so tab switches cannot explode the sim.
- Light bodies (0.02–0.1) vs a 2.5 chassis: the car bulldozes props convincingly without destabilising itself; `maxSuspensionForce 150` with stiffness 25 and low CoM keep it planted.
- Area frustum culling via `zoneFrustum` empties tested against the camera ground quad (`Area.js:104-177`), and `Area.update` only runs when in frustum.

### 7. Details worth copying

- **Low centre of mass via `setMassProperties`** on the chassis (`PhysicsVehicle.js:96`) instead of anti-roll bars.
- **Suspension-as-jump/low-rider**: changing rest length + stiffness per wheel at runtime (`:495-496`).
- **Soft top speed** `force / (1 + overflow)` and **must-stop-to-reverse** `reverseBrake` logic (`:460-480`).
- **Idle brake 0.06** to make the car coast to a stop without feeling sticky.
- **Flip detection** by integrating `smallestAngle` deltas while airborne (`:356-402`), **stuck detection** via a 3 s sliding window of travel (`:262-314`), and **auto-unflip** with mass-scaled impulse/torque chosen by which body axis points up (`:404-438`).
- **Camera** (`View.js:620-788`): focus point snaps to the car while tracking, a "magnet" pulls a detached focus back with force proportional to distance (`multiplier 0.25`, `:642-649`), position lerps with `delta*10`, zoom ratio adds `speedAmplitude -0.4 * smoothstep(focusSpeed, 5, 40)` so the camera pulls back at speed (`:696-702`), spherical offset `phi = π*0.31 (desktop) / 0.27 (mobile)`, `theta = π/4`, radius 15–30 (+9 on narrow aspect), FOV 25. Camera roll is a damped spring kicked by explosions: `velocity = -value*100*dt; speed += velocity; value += speed*dt; speed *= 1 - 4*dt` (`:721-725`).
- **Time scale 2 with bullet time 0.5**, applied to both the physics timestep and gsap.
- **Ground tracks as a GPU ring buffer rendered top-down into an RT** that the terrain shader samples, so tracks are free on the main pass and also feed snow/grass.
- **Edge bedrock**: a kinematic slab teleported under the player near the heightfield border.
- **Reset protocol**: disable body, set transform with `wakeUp=false`, re-enable next frame, re-sleep, flag visual update a frame later, which avoids explosions from overlapping resets.

## Part 2: terrain, rivers, grass, trees, wind, fog and light

Paths relative to `sources/` unless they start with `static/` or `scripts/`.

**Framing fact:** this is `three@0.183.2` running `WebGPURenderer` with **TSL node materials**, not GLSL `ShaderMaterial`s. Every shader excerpt below is TSL (JS chained nodes), translated to GLSL-ish pseudocode where it helps. There is no `.glsl` anywhere in the repo. One custom material class, `MeshDefaultMaterial` (`Game/Materials/MeshDefaultMaterial.js`), implements the entire look for everything in the world; three.js's own Lambert lighting is bypassed.

### 0. What is baked offline vs generated at runtime

Offline (Blender + `scripts/compress.js`):
- `static/terrain/terrain.glb` (730 KB raw / 26 KB draco): one mesh `terrain`, 16,641 verts = a 129×129 grid, POSITION range x,z ∈ [−96, 96], y ∈ [−1.5, 0]. Used **only as the physics heightfield** (see §1).
- `static/terrain/terrain.png`: 512×512 RGBA mask over the same 192×192 m square. Channels (inferred from every consumer): **R = "slab/furniture" mask** (paved/built areas; 52% non-zero), **G = grass mask** (30% non-zero), **B = water depth 0→1** (55% non-zero, 10% fully deep). Loaded with `flipY=false` (`Game/Game.js:145`), KTX preset `uastc --genmipmap --assign_oetf linear` (`scripts/compress.js:92`).
- `static/palette.png`: 128×4 RGB, ~24–28 distinct values per channel; the global colour palette every Blender mesh is UV-mapped onto. Loaded `NearestFilter`, no mipmaps, sRGB (`Game/Game.js:107`).
- `static/foliage/foliageSDF.png` 128×128 grayscale leaf-card cutout, `static/floor/slabs.png` 256×256 grayscale tiling slab pattern, `static/overlay/overlayPattern.png`.
- Prop GLBs (`scenery.glb`, `benches`, `fences`, …) with two materials `palette` and `black`, and **reference GLBs** that are just placed empties: `oakTreesReferences.glb` (48 nodes = 24 trees), `birchTreesReferences` (26), `cherryTreesReferences` (20), `bushesReferences.glb` (130 icospheres), `flowersReferences.glb` (108 points), `respawnsReferences`, `tornadoPathReferences`.
- Compression: `gltf-transform etc1s --quality 255` then `draco --quantize-position 12 --quantize-normal 6 --quantize-texcoord 6` (`scripts/compress.js:30-60`); textures via `toktx` etc1s (masks as single-channel `--target_type R`), uastc for palette/terrain.

Runtime-generated: the three 128×128 noise textures (§5), two 1×16 canvas gradients, the grass triangle soup, foliage card-spheres, flower clusters, snow grid + its elevation render target, the wheel-track render target, falling-leaf compute buffers, wind-line curves, and the shoreline/ripple/ice/splash masks (all procedural in the fragment shader).

### 1. Terrain

**Not a visible GLB.** `Game/World/Floor.js:20` grabs `terrainModel.scene.children[0].geometry` and `setPhysical()` (`Floor.js:120-153`) walks its vertices into a `Float32Array heights[129*129]`, then creates a Rapier `heightfield` collider `[128, 128, heights, {x:192, y:1, z:192}]`, `friction 0.2`, `restitution 0.15`, category `floor`. The constants come from `Game/Terrain.js:12-13`: `subdivision = 128`, `size = 192`.

**The visible ground is a camera-following plane** (`Floor.js:35-41`): `PlaneGeometry(size, size, size/1.5, size/1.5)` with `size = round(optimalArea.radius*2)+1`, `cellSize 1.5`, normals deleted. In `update()` it snaps to the 1.5 m grid: `mesh.position.x = round(optimalArea.position.x / cellSize) * cellSize` (`Floor.js:178-179`) so vertices never swim. It is displaced in the vertex stage from the texture, not from the mesh:

```js
// Floor.js:79-87
material.positionNode = Fn(() => {
    const uvDim = min(min(uv().x, uv().y).mul(20), 1)      // taper at plane edges
    const newPosition = positionLocal
    newPosition.y.addAssign(terrainData.b.mul(-1.5).mul(uvDim))  // B = water depth → down to -1.5
    return newPosition
})()
```

So the riverbed is just `y = -1.5 * B`. The physics mesh and the visual surface agree because both come from the same Blender source. There is **no LOD and no chunking**: one plane sized to the view, and all terrain lookups are texture fetches in world space:

```js
// Terrain.js:88-106
worldPositionToUv = position.div(128).div(1.5).add(0.5)          // 192 m → 0..1
terrainNode = (position) => {
    const data = texture(terrainTexture, uv)
    const tracks = texture(tracks.renderTarget.texture, position.sub(-tracks.halfSize).sub(tracksDelta).div(tracks.size))
    data.g.mulAssign(tracks.r.oneMinus())                      // wheels flatten grass
    return data
}
```

**Colouring** is a 1×16 canvas gradient looked up by depth, then grass mixed in (`Terrain.js:45-49, 108-117`):

```js
colors = [{stop:0.1,'#ffa94e'}, {stop:0.3,'#5bc2b9'}, {stop:0.9,'#13375f'}]   // dirt → turquoise → deep blue
baseColor = texture(gradientTexture, vec2(0, terrainData.b.oneMinus()))
baseColor = mix(baseColor, grassColor /* '#b8b62e' */, terrainData.g)
```

`Floor.js:47-66` adds paving: `slab = R * perlin(xz*0.03)`, `slabColor = mix('#a87762', '#ffcf8b', slabsTexture(xz*0.175))`, `finalColor = mix(baseColor, slabColor, slab)`. The floor material uses `normalNode: vec3(0,1,0)`, `shadowNode: terrainData.g` (grass areas are pushed toward the shadow tint), `hasWater:false`, `hasLightBounce:false`, `receiveShadow = true`, no cast. No vertex colours, no splat, no baked AO: the terrain's whole look is 3 mask channels + a 3-stop gradient + a palette-tinted slab tile.

Outside the 192 m square a kinematic "bedrock" cuboid (half 6×0.5×6) follows the player at `depthElevation - 0.5` (`Floor.js:155-174, 181-208`) so you drive on the sea floor.

### 2. Water

`Game/Water.js:10-14`: `surfaceElevation = -0.3`, `depthElevation = -1.5`, `surfaceThickness = 0.013`.

**Geometry**: a single `PlaneGeometry(1,1,1,1)` rotated flat, scaled to `optimalArea.radius*2`, `y = -0.3`, following the camera (`WaterSurface.js:65-69, 380-398, 426`). No ribbon, no spline, no depth texture. Because the floor descends to −1.5 where B=1 and sits at 0 where B=0, the flat quad at −0.3 intersects the riverbed exactly where `B ≈ 0.2`, and the **B channel doubles as a "distance from shore" field** for every effect.

**Material** (`WaterSurface.js:298-311`): `MeshDefaultMaterial({ depthWrite:false, colorNode: color(0xffffff), alphaNode: detailsMask(), alphaTest:0, transparent:true, hasCoreShadows:false, hasDropShadows:true, hasLightBounce:false, hasFog:true, hasWater:false })`. The surface is *white where the mask is 1, invisible elsewhere*. The white gets multiplied by day-cycle light colour/intensity, receives shadow tint and fog like everything else, so the "water colour" is just `lightColor*intensity` fogged. The depth-based colour you see near banks is the floor gradient underneath.

The mask is the max of four procedural layers (`WaterSurface.js:242-268`):

```js
// Shore (WaterSurface.js:226-231): everything deeper than B=0.17 is solid surface
shoreNode = step(0.17, terrainData.b)

// Ripples (92-112): contour bands that follow the depth field and drift with wind time
baseRipple  = (B + wind.localTime*0.5) * 10                       // ripplesSlopeFrequency = 10
rippleIndex = floor(baseRipple)
noise       = perlin( positionWorld.xz + rippleIndex/0.345 ) at freq 0.1   // each band gets its own noise offset
ripples     = fract(baseRipple) - (1 - remap(B,0,1,-0.3,1)) + noise
ripples     = step( remap(ripplesRatio,0,1,-1,-0.4), ripples )    // ripplesRatio = remapClamp(temperature, 0,-3, 1,0)

// Ice (139-150): voronoi cells grow out from the shore as temperature drops 0 → -5
ice = remapClamp(B, 0, iceRatio, 0, 1); ice = step(voronoi(xz*0.3).g /*edge distance*/, ice)

// Rain splashes (179-211): expanding rings from voronoi distance, hashed per cell, visible ∝ rain²
splash = fract(voronoi(xz*0.33).r - (localTime*6 + hash(cellId*123456) + perlin(xz*0.0825)))
splash = 1 - step(0.3 * remapClamp(voronoi.g, 0.14, 1, 0, 1), splash)
splash *= step(splashesRatio, fract(hash(cellId*654321) + perlin))
```

Since shore is already 1 for B ≥ 0.17, ripples/ice/splashes are only visible in the shallow band B ∈ (0, 0.17): you get animated white contour lines hugging every bank, which is the signature look. The material is rebuilt (shader recompiled) whenever any of the three ratios crosses 0.0001 so unused branches cost nothing (`WaterSurface.js:431-446`).

**Fake refraction** (desktop quality only, `WaterSurface.js:273-289, 313-344`): the material's `outputNode` is replaced by

```js
blur = hashBlur(viewportSharedTexture(screenUV), 0.01, { repeats: 25, premultipliedAlpha: true })
final = select(surfaceAlpha < 0.5, blur, vec4(baseOutput.rgb, 1))
```

i.e. in the shallow band it writes a blurred copy of the already-rendered opaque frame (the bank and riverbed), making the shallows look wet/refractive. On mobile it is plain transparent.

**Shadows**: `mesh.castShadow = true` with `maskShadowNode = detailsMask() > 0.5`; it also receives drop shadows.

**Vehicle interaction**: no splash particles from the surface itself. Instead: (a) `MeshDefaultMaterial.hasWater` paints a white waterline on *any* object crossing the plane: `nearWaterSurface = abs(positionWorld.y - (-0.3)) > 0.013; color = select(nearWaterSurface, color, '#ffffff')` (`MeshDefaultMaterial.js:92-97`); (b) falling leaves float on it (§4); (c) ice spawns a 256×256 kinematic cuboid collider whose friction lerps `0.5 → 0.02` and whose top rises from −1.5 to −0.3 with `iceRatio` (`WaterSurface.js:400-416, 449-466`).

### 3. Grass

`Game/World/Grass.js`. **One non-indexed draw of 280×280 = 78,400 single-triangle blades** (`subdivisions = 280`, line 12). Geometry (`49-90`): a jittered grid over `size = optimalArea.radius*2`; each blade stores its xz centre three times (`position` attribute has **itemSize 2**) plus a per-vertex `heightRandomness`. A dummy bounding sphere and `frustumCulled = false`.

Vertex stage (`139-182`):

```js
// toroidal wrap around the view centre → infinite grass with a fixed buffer
loop = position - center; loop = mod(loop + half, size) - half; position3 = vec3(loop.x,0,loop.y) + center
worldPosition = modelWorldMatrix * position3; bladePosition = worldPosition.xz          // varying → fragment

heightVariation = perlin(bladePosition * 0.0321).r + 0.5
height = bladeHeight * (0.6*heightRandomness + 0.4) * heightVariation * terrainData.g   // G scales height
shape  = vec3( bladeShape[i*2] * bladeWidth * G,  bladeShape[i*2+1] * height, 0 )       // [tip 0,1][left 1,0][right -1,0]
vertex = position3 + shape
angleToCamera = atan(wp.z - cam.z, wp.x - cam.x) - PI/2; vertex.xz = rotateUV(vertex.xz, angleToCamera, wp.xz)  // billboard
wind = wind.offsetNode(wp.xz) * tipness * height * 2; vertex += vec3(wind.x, 0, wind.y)   // tip only
vertex.y += step(G - 0.4, 0.1) * 100                                                      // hide where G ≤ 0.5
```

Blade size: `bladeWidth 0.1`, `bladeHeight 0.6`, both × `(1 + surfaceOverflow*0.5)` where `surfaceOverflow = max(0, size² − 2000)/2000` (`18-20, 102-103`): wider viewports get bigger blades so density looks constant. Fragment: `colorNode = terrain.colorNode(terrainData)` (blades are the same colour as the ground they stand on), `normalNode: vec3(0,1,0)` (no core shadow), `shadowNode = (1 − tipness) * G` → base of each blade is darkened by the shadow tint, tip is lit: a per-blade AO gradient (`129-137`). `receiveShadow = true`, no cast. No distance LOD; the "LOD" is the view-fitted area.

**Vehicle push** is via the tracks render target, not a position uniform: `Game/Tracks.js` renders a 512² RT of a 40×40 m orthographic top-down scene around `tracks.focusPoint`; each wheel owns a `Track(0.5,'r')` ribbon and the chassis a `Track(1.5,'g')` (`VisualVehicle.js:251, 287`). A `Track` is a 128-segment strip driven by a 128×1 float `DataTexture` of past contact points (shifted when the vehicle moved > 0.2 m and > 1/30 s; alpha from `trackData.a = touching`), additive-blended with edge/end fades (`Tracks.js:94-249`). `Terrain.terrainNode` then does `G *= 1 − tracks.r`, so blades in wheel paths shrink and vanish and spring back once the ribbon passes. The same RT carves snow (§6).

### 4. Trees, bushes, flowers, falling leaves

**Foliage** (`Game/World/Foliage.js`) serves tree canopies and bushes. Geometry (`34-87`): 80 `PlaneGeometry(0.8,0.8)` cards scattered inside a unit sphere with radius `1 − rng()³` (shell-biased), random roll, merged with `mergeGeometries`. Normals are overwritten with `lerp(vertexPosition, sphereNormal, 0.85)` so the whole puff shades like a sphere. Seeded `alea('foliage')`. Each reference becomes an instance matrix built with `object.up = (sin a, cos a, 0); object.lookAt(view.spherical.offset.normalize())` (`169-191`): cards face the camera's fixed isometric direction, so no per-frame billboarding. Rendered as `InstancedMesh` with `instance(object.count, instanceMatrix)` in `positionNode` (`155-160`, `StaticDrawUsage`).

Alpha and wind shimmer (`100-138`):

```js
rotatedUv = rotateUV(uv(), wind.offsetNode(positionLocal.xz).length() * 2.2, vec2(0.5))
alpha = texture(foliageSDF, rotatedUv).r − threshold(0.3)           // alphaTest 0.1 then discards
```

Rotating the cutout UV by wind magnitude makes the canopy edge "crawl". Colour: `mix(colorA, colorB, smoothstep(0,1, dot(normalWorld, lightDir)))` (`141-145`) with per-species pairs: oak/bush `#b4b536 → #d8cf3b`, birch `#ff4f2b → #ff903f`, cherry `#ff6d6d → #ff9990` (`World.js:69-71`, `Bushes.js:12-13`). Shadow fixes: `receivedShadowPositionNode = positionLocal + lightDir * shadowOffset(1)` (lookup moved toward the sun to kill card self-shadowing) and `maskShadowNode = foliageSDF.r > 0.5` so cast shadows are cut-outs (`163-166`). Trees only: **see-through** — `alpha = sdf * (smoothstep(3/r, 15/r, screenDistToVehicle) * 0.7 + 0.3)` using `visualVehicle.screenPosition`, aspect-corrected (`115-129, 214-220`).

**Trees** (`Trees.js`): the visual GLB has `treeBody` + several `treeLeaves` empties; trunks become one `InstancedMesh` with the palette material (`setBodies`, cast+receive), each leaves empty × each tree reference becomes a Foliage instance; physics is a fixed cylinder (half-height 2.5, radius 0.15) per tree.

**Flowers** (`Flowers.js`): 108 cluster points × 3–10 flowers each, jitter ±1.5 m, scale 0.6–1.0; each flower is 8 merged `0.08²` planes on a cone (`Spherical(1, π·0.2·rng, 2π·rng)`), UVs deleted; white, `DoubleSide`, wind `positionLocal + vec3(wind.x,0,wind.y) * clamp(y,0,1)`, `shadowOffset 0.25`; one `Mesh` with `instance()`.

**Falling leaves** (`Leaves.js`) are a TSL **compute** particle system: `count = 2^round(remap(yearCycles.leaves, 0.25,1, 7,11))` (128 in spring … 2048 in fall), `instancedArray` position/velocity buffers, skewed quads (`±0.15`), scale `0.25 × (0.5..1)`, colours `0x95513a → 0xf56a3a` by hash. Per-frame compute (`171-254`): vehicle push (`pushSideways 20`, `pushVelocity 100`, within 0.5–2 m, × speed), wind `max(0, wind.strength − perlin(xz*0.005 + dir*t)) * weight * 0.5`, explosion impulse, lift `v.y = min(|v.xz|,2) * remapClamp(y,0,6,1,0)`, damping `1.5` on land / `0.75` on water / `1.5` airborne, gravity `9.807 * weight(0.1–0.2)`, clamp to `floorY = remapClamp(B, 0.02,0.13, 0, −0.3) + 0.02` (they float on water), toroidal wrap. Vertex flutter: `rotateUV(xy, sin(x*3)*h)`, `rotateUV(yz, sin(z*3)*h)`.

Read again against the source (for `lib/three/leafSim.js` and `universe/landings/litter.js`, which port it):
- The leaf is `0.25 × (0.5..1)` of a **1 m** quad (`Leaves.js:42-52, 87, 133`): 12.5 to 25 cm.
- The count's `remap` is unclamped: spring (`leaves` 0) gives `2^round(5.67)` = 64, not 128; the 128 holds only clamped.
- The lift is assigned each tick, not added (`:231`), and gravity is a fall speed taken off once a tick (`:240`), both at his time-scaled frame; so is the vehicle push, whose `velocity` is a displacement per tick (`PhysicsVehicle.js:519`), not m/s.

**Wind lines** (`WindLines.js`, `Geometries/WindLineGeometry.js`): pool of 4 ribbons; a CatmullRom through 4 handles over 10 m with ±0.5 zigzag, 30 divisions, expanded in the vertex shader along tangent `(0,1,−1)` by `thickness(0.1) × bell(ratio) × window(|ratio − (progress*3−1)|)`, so a short white streak slides along the curve; mesh at `y = 2`, rotated to `wind.angle`, translated 1 m downwind over `duration = remapClamp(weather.wind, 0,1, 8,2)` s, spawned every 300–2000 ms. No fog/shadows.

**Wind field** (`Game/Wind.js:20-43`): `angle = π·0.6`, `direction = (sin,cos)`, `strength = remapClamp(weather.wind,0,1,0.1,1)`, `localTime += dt * 0.1 * strength`:

```js
offsetNode(p) = direction * ( perlin(p*0.5*0.2 + dir*t).r − 0.5  +  perlin(p*0.5*0.1 + dir*t*0.2).r − 0.5 ) * strength
```

Everything (grass tips, foliage cutout rotation, flowers, leaves, ripples via `localTime`) samples this one function, which is why the whole scene breathes together.

### 5. Noises.js

Three 128×128 textures rendered once at startup with a `QuadMesh` (`Game/Noises.js:136-292`), all `RepeatWrapping`:
- `voronoi`: RGBA half-float, `voronoiNode(uv, 8)` → `r = distance to nearest point`, `g = secondNearest − nearest` (edge distance), `b = hash(cellId)`.
- `perlin`: Red half-float, `perlinNode(uv, 6 cells, period 6).remap(0.1, 0.9, 0, 1)` (classic gradient noise, `*0.8+0.5`).
- `hash`: Red, `NearestFilter`, per-texel white noise.
Consumers: perlin — wind (×0.1/0.2 of pos×0.5), grass height (×0.0321), ripple offsets (×0.1), splash timing, slab blend (×0.03), leaves init (×0.02, +15 m x-shift) and wind (×0.005), snow elevation (×0.1 and ×0.07, multiplied), glitter gating (×0.05); voronoi — ice (×0.3), splashes (×0.33); hash — road glitter and snow glitter (×0.2) and the overlay dither.

### 6. Lighting and look

**Light**: one `DirectionalLight(0xffffff, 5)` with shadows (`Ligthing.js:108-116`), positioned on a sphere of radius `optimalArea.radius + 1` around `optimalArea.position` (follows the camera). Sun path from the day cycle (`180-193`): `theta = 0.72 + sin(−(p + 9/16)·2π)·1.25`, `phi = 0.63 + cos(…)·0.5·0.62`. Shadow camera: ortho ±`optimalArea.radius`, `near 1`, `far 1 + 2r`, `mapSize 2048` desktop / `512` mobile, `bias −0.001`, `normalBias 0.1`, `radius 3`/`2` (`153-173`). Not cascaded, not baked.

**Shading model**: the entire thing is `MeshDefaultMaterial.outputNode` (`MeshDefaultMaterial.js:67-134`), Lambert bypassed:

```js
outputColor = colorNode
// 1. fake ground bounce for under-facing surfaces near the ground
bounceOrientation = smoothstep(-1, 1, dot(n, vec3(0,-1,0)))
bounceDistance    = pow(max(0, (1.5 − max(0,y)) / 1.5), 2)
outputColor = mix(outputColor, terrain.colorNode(terrainNode(positionWorld.xz)), bounceOrientation*bounceDistance*1)
// 2. waterline band (see §2)
// 3. light
outputColor *= lightColor * lightIntensity                                  // day-cycle uniforms
// 4. shadows: toon core shadow + captured shadow map + per-material mask, max'd, as a TINT
coreShadowMix = smoothstep(1, −0.25, dot(n, lightDir))
dropShadowMix = 1 − catchedShadow            // receivedShadowNode multiplies catchedShadow and returns 1 to Lambert
combined      = clamp(max(coreShadowMix, dropShadowMix, shadowNode), 0, 1)
outputColor   = mix(outputColor, baseColor * shadowColor, combined)
// 5. fog, alpha test discard, reveal ring
outputColor = mix(outputColor, fog.color, fog.strength)
```

Shadows are therefore never black: they multiply the *unlit base colour* by a saturated `shadowColor` (`#6d3fff` day, `#4e009c` dusk, `#2f00db` night, `#db004f` dawn). The core-shadow ramp `smoothstep(1, −0.25, n·l)` is extremely wide, so most forms read as a soft two-tone.

**Fog** (`Game/Fog.js`): `strength = rangeFogFactor(near, far)` with `near/far = optimalArea.nearDistance + ratio × (farDistance − nearDistance)`, ratios per preset (day `0.315 → 1.25`, dusk `0 → 1.25`, night `−0.85 → 1`, dawn `0.3 → 1.25`). Fog colour is a **screen-space radial gradient** `mix(colorA, colorB, smoothstep(0, 1, length(viewportUV − center)))`, and the same node is `scene.backgroundNode` (`Fog.js:16-18`), so the horizon dissolves into an identical backdrop. No height fog.

**Day cycle** (`Cycles/DayCycles.js`): period `4 × 60 s` from `Date.now()`, smoothstep-interpolated keyframes at `0, 0.15 (day), 0.25 (dusk), 0.35–0.6 (night), 0.8 (dawn), 0.9 (day)`. Presets (lightColor / intensity / shadow / fogA / fogB): day `#ffd2c2 ×1.2 / #6d3fff / #00ffff → #9b89ff`; dusk `#ff8181 ×1.2 / #4e009c / #3e53ff → #ff4ce4`; night `#3240ff ×3.8 / #2f00db / #10266f → #490a42`; dawn `#ffa882 ×1.2 / #db004f / #f885ff → #ff7d24`. Year cycle (`YearCycles.js`): 365-day period; `leaves 0.25/0/0.25/1`, `temperature 5/15/25/15`, `humidity .8/.65/.5/.65`, `clouds .65/.45/.3/.65`, `wind .3/.2/.1/.25` for winter/spring/summer/fall.

**Weather** (`Game/Weather.js`): scalar "noise" `sin(x)·sin(1.678x)·sin(2.345x)` over `dayCycles.absoluteProgress`; `temperature = year + day + 7.5·noise(0.4t)`, `humidity = year + 0.2·noise(0.36t)`, `clouds = noise(0.44t)`, `wind = noise(t)·0.5+0.5`, `rain = remapClamp(humidity,.65,1) × remapClamp(clouds,0,1)`, `snow = remapClamp(rain,.05,.3)·remapClamp(T,0,−5) + remapClamp(T,0,10,0,−1)`. These drive: ripples (T 0→−3), ice (0→−5), splashes (rain²), rain lines (`RainLines.js`: 2048 quads, fall height 20, thickness 0.015, tangent `(0.707,−0.707)`, length `1→3`, speed `0.2→0.4`, incline `0.1→0.4` from wind; in snow they become `0.03`-long flakes at speed `0.05`), lightning chance `clouds·electricField·humidity`, and snow cover.

**Snow** (`World/Snow.js`): 256² ground quads (2 tris each, `pivot` attribute). A 257² Red half-float elevation RT is re-rendered every frame from `elevation + smoothstep(perlin(0.1)·perlin(0.07))·1`, carved by the tracks RT (`min(1−r, remapClamp(1−g, .5,1, .25,1))`), pushed down `−2·B` in water and `−2·R` on paving. Each quad's diagonal flips to the smaller height delta (`acDelta < bdDelta`), normals come from finite differences (`shift 0.2`), alpha fades with height above ground `smoothstep(0.022, 0.5, deltaY)`, and glitter = `pow(|fract-ish(hash(xz·0.2)·2 + variation)|·perlin, 1000) × 2`, with `variation += dt·0.0004 + cameraDelta·0.0004` so sparkles twinkle as the camera moves. The road uses the same glitter at `pow 100, ×0.3` (`Scenery.js:59-86`).

**Palette**: `Materials.createPalette()` → `MeshDefaultMaterial({ colorNode: texture(paletteTexture).rgb })`; `Materials.updateObject()` swaps every GLTF Lambert/Standard material for a `MeshDefaultMaterial` keyed by material name (`Materials.js:273-343`). Emissive props use `color / luminance(color) × intensity` (≥1 → bloom).

**Post**: `Rendering.js:74-104`: `RenderPipeline` with `scenePass → cheapDOF(renderOutput(scenePass)) + bloom(threshold 1, strength 0.25, smoothWidth 1, nMips 5 desktop / 2 mobile)`. `Passes/cheapDOF.js:27-53` is a tilt-shift: `strength = smoothstep(0.2, 0.5, |uv.y − 0.5|)`, `mix(tex, hashBlur(tex, strength × 0.003, repeats 25), strength)`. No tone mapping is set anywhere (defaults: `NoToneMapping`, sRGB output). A fullscreen `Overlay` (renderOrder 99) with a 128 px pattern tile and `±0.1` hash dither is used for transitions, and `Reveal` discards fragments beyond a radius from spawn with a `0.05`-thick emissive ring (`#e88eff × 5.5`).

### 7. Rendering pipeline, pixel ratio, quality

`WebGPURenderer({ antialias: pixelRatio < 2, powerPreference:'high-performance' })`, `pixelRatio = min(devicePixelRatio, 2)` (`Viewport.js:23-25`), `sortObjects = false` with opaque/transparent sorts by `renderOrder` only (`Rendering.js:40-60`), `shadowMap.enabled = true`. Extra per-frame targets: tracks RT (512², every tick), snow elevation RT (257², when snow > −0.9), leaves compute dispatch; startup-only: three noise RTs and a 32 px `CubeRenderTarget` pre-render that forces shader compilation (`PreRenderer.js`, desktop WebGPU only). Camera: `PerspectiveCamera(fov 25, 0.1, 200)`, `phi = π·0.31` (desktop) / `π·0.27`, `theta = π/4`, radius `15–30` (`View.js:336-344, 394`). **`view.optimalArea`** (`View.js:174-280`) projects the four screen corners onto `y = 0` and derives centre, radius, nearDistance, farDistance; floor, grass, water, snow, rain, leaves, light/shadow frustum and fog all size themselves from it, so nothing is simulated off-screen. `Quality.level` is `1` on mobile UA else `0` (`Quality.js:12-13`): shadow map 2048/512, shadow radius 3/2, bloom mips 5/2, DOF on/off, water screen-blur on/off, camera elevation.

### 8. Recipe: the ten things that make it read as one natural world

1. **One 3-channel world mask drives everything.** `terrain.png` (512² over 192 m): R paving, G grass, B water depth. Floor colour, riverbed displacement (`−1.5·B`), shoreline (`step(0.17,B)`), ripple contours, ice growth, grass height/width/hide (`G`), leaf float height, snow carving and light bounce all read the same texture through `Terrain.terrainNode`, so every system agrees spatially.
2. **Depth gradient instead of water shading.** Ground colour = 1×16 gradient over `1−B` (`#ffa94e → #5bc2b9 → #13375f`) + grass `#b8b62e`; the water surface is a flat white quad at `−0.3` that only *draws* in deep water, letting the bank gradient show in the `0 < B < 0.17` band, blurred with `hashBlur(viewportSharedTexture, 0.01, 25)`.
3. **Shore detail as contour bands.** `fract((B + t·0.5)·10) − (1.3 − 1.3B) + perlin` thresholded → wavy white lines parallel to every bank, animated by wind time, plus voronoi ice (`step(edgeDist, remapClamp(B,0,iceRatio))`) and voronoi-ring rain splashes.
4. **Shadows are a colour, not darkness.** `mix(lit, base × shadowColor, max(coreShadow, dropShadow, mask))` with `#6d3fff`-class tints per time of day; the core ramp `smoothstep(1, −0.25, n·l)` is deliberately wide.
5. **Fake GI from the ground.** Under-facing fragments within 1.5 m pick up the terrain colour at their xz (`bounceOrientation × ((1.5−y)/1.5)²`).
6. **Fog = background.** `rangeFogFactor(near, far)` per preset, colour a screen-radial two-colour gradient that is also `scene.backgroundNode`; day-cycle presets change light, shadow tint and both fog colours together every 4 minutes.
7. **One wind function.** Two scrolled perlin octaves (`pos×0.1`, `pos×0.05`, second at 0.2× speed) × direction × strength feed grass tips (`×tipness×height×2`), foliage cutout rotation (`×2.2`), flower sway, leaf particles and ripple time.
8. **Cheap, dense, camera-fitted vegetation.** 78,400 one-triangle billboard blades in a toroidally wrapped buffer sized to the visible ground, coloured like the ground, with a per-blade base-to-tip shadow gradient; 80-card SDF-cutout spheres with sphere-blended normals for canopies and bushes, instanced, two-tone by `n·l`, shadow lookups offset 1 unit toward the sun.
9. **Interaction through render targets.** A 40 m/512 px top-down ribbon RT (`r` wheels 0.5, `g` chassis 1.5) flattens grass (`G × (1 − r)`) and carves snow; a 2048-leaf compute sim is pushed by vehicle velocity (`×100`) and sideways (`×20`) within 2 m; every object crossing `y = −0.3 ± 0.013` gets a white waterline.
10. **A single palette and a soft lens.** All Blender meshes sample a 128×4 nearest-filtered palette; no tone mapping, bloom at threshold 1 for emissives only, and a tilt-shift `hashBlur` (`smoothstep(0.2,0.5,|v−0.5|) × 0.003`, 25 taps) that keeps the horizontal band around the car crisp and softens top and bottom, selling the diorama scale.

Caveats worth carrying into a reimplementation: everything assumes a fixed isometric camera angle (foliage cards are not billboarded per frame), the view-fitted `optimalArea` is load-bearing for performance, and because colour math runs in custom `outputNode`s, standard three.js tone mapping/lights are effectively opt-out.

## Part 3: world size, streaming, looping, areas

Paths relative to the folio-2025 checkout; `sources/Game/` is abbreviated to `G/`.

### 1. World extent: a finite 192 m square with an "infinite sea" fallback

The world is authored, bounded and never loops. `G/Terrain.js:12-13` fixes the constants:

```js
this.subdivision = 128
this.size = 192
```

The terrain mesh `static/terrain/terrain.glb` is one Blender plane of 16,641 vertices (129×129, 1.5 m cells) spanning x,z ∈ [-96, +96], y ∈ [-1.5, 0] (read from the GLB accessor min/max). So the playable island is 192 m × 192 m and the terrain is essentially flat: "height" is only negative (water basins down to -1.5 m). The world-to-UV mapping on the GPU (`G/Terrain.js:88-91`) is `position / 128 / 1.5 + 0.5`, i.e. `position / 192 + 0.5`; `Map.worldToMap` uses the same `/ terrain.size + 0.5` then clamps to [0,1] (`G/Map.js:154-166`), so the minimap is literally the 192 m square.

Edges have no walls. Three things happen past x or z = ±96:

- The Rapier heightfield collider only covers 192 m (`G/World/Floor.js:148`: `{ shape: 'heightfield', parameters: [rowsCount-1, rowsCount-1, heights, { x: 192, y: 1, z: 192 }], category: 'floor' }`). Beyond it a "bedrock" kinematic cuboid of half-width 6 m sits at `water.depthElevation - 0.5` (= -2 m, `G/Water.js:10-11`) and is teleported under the player every frame once `|player.x| > 96 - 6` or `|player.z| > 96 - 6` (`G/World/Floor.js:155-173, 182-200`). Outside the island you drive on a 12 m moving slab 1.7 m under the water surface (-0.3 m); it is disabled again when you return.
- The visual floor is a camera-following plane (section 2) that keeps rendering; its material samples `terrainTexture` with default ClampToEdge wrapping, so past the edge it repeats the border texel (water). Driving > 120 m from the origin unlocks the "sea" achievement (`G/Player.js:643-645`).
- Falling: objects whose `y < depthElevation` are reset to their initial transform (`G/Objects.js:344-347`). The player never falls through anything; respawn (`G/Player.js:469-487`) is explicit (R key, "unstuck" button, map click, `die()`), and `Respawns.getClosest` picks the nearest of 18 named respawn points parsed from `static/respawns/respawnsReferences.glb` (positions range x -56..75, z -68..66; `G/Respawns.js:14-50`, y forced to 4).

Fog hides the horizon: `G/Fog.js:19-21` builds `rangeFogFactor(near, far)` from `view.optimalArea.nearDistance/farDistance`, modulated per time-of-day (`:45-47`); the camera far plane is 200 (`G/View.js:394`).

### 2. Camera-following detail layers: the "optimal area" and modulo looping

Everything that follows the camera is driven by `View.optimalArea`, computed once per resize (`G/View.js:213-281`): the camera is placed at its maximum orbit radius (`spherical.radius.edges = {min:15, max:30}` plus `nonIdealRatioOffset = 9` for portrait screens, `G/View.js:339-341`; on high quality multiplied by `1 - zoom.speedAmplitude` = 1.4 because speed zoom-out is allowed, `:220-223`), four corner rays are intersected with the y=0 plane, `basePosition` is the centre of the resulting ground quad, and `radius = basePosition.distanceTo(farPosition)` (`:263`). Per frame `optimalArea.position = basePosition + focusPoint.smoothedPosition` (`:758-760`) and the quad corners are offset by the focus point (`:762-766`). With FOV 25 (`:394`), phi = 0.31π, orbit up to 42 m, the radius lands around 25–35 m on a 16:9 screen, so loop tiles are ~50–70 m squares.

Grass (`G/World/Grass.js`): one non-indexed mesh of 280×280 = 78,400 triangles (`:12-14`), each blade a single triangle, generated on the CPU with a jittered grid of 2D positions (`:49-83`):

```js
const positionX = fragmentX + (Math.random() - 0.5) * this.fragmentSize   // :67
```

The vertex shader (`:139-181`) loops the blade around a `center` uniform fed each frame with `optimalArea.position.xz` (`:209`):

```js
const loopPosition = position.sub(this.center)                                   // :144
const halfSize = this.sizeUniform.mul(0.5)
loopPosition.x.assign(mod(loopPosition.x.add(halfSize), this.sizeUniform).sub(halfSize))   // :146
loopPosition.y.assign(mod(loopPosition.y.add(halfSize), this.sizeUniform).sub(halfSize))   // :147
const position3 = vec3(loopPosition.x, 0, loopPosition.y).add(vec3(this.center.x, 0, this.center.y))
```

There is no per-cell re-seeding: a blade that wraps keeps its `heightRandomness` attribute, but its world position changes, so everything world-dependent is re-derived from the wrapped world xz: terrain data via `terrain.terrainNode(bladePosition)` (`:124`), height variation from the perlin texture at `bladePosition * 0.0321` (`:154`), wind from `wind.offsetNode(worldPosition.xz)` (`:175`). Blades where the grass channel is low are hidden by shoving them 100 units up (`:126, :179`), the blade is billboarded toward the camera with `atan` (`:171`), `frustumCulled = false` and a dummy bounding sphere (`:87, :201`). The terrain height is NOT sampled for the blade: it stays at y=0 because the terrain is flat except water, where the grass channel is zero anyway. The blade count is constant; when the tile exceeds `surfaceIdeal = 2000` m² (`:19`) blade width/height are scaled up by `surfaceOverflow` (`:102-103, :39-40`) instead of adding blades.

Floor (`G/World/Floor.js`): a `PlaneGeometry(size, size, size/1.5, size/1.5)` with `size = round(radius*2)+1` (`:35-41`) snapped to the 1.5 m cell grid every frame so vertices never swim:

```js
this.mesh.position.x = Math.round(optimalArea.position.x / this.cellSize) * this.cellSize   // :178
```

Its vertex shader displaces y by `terrainData.b * -1.5` (water depth from the texture, `:79-87`) and colours from the same texture (slabs = r, grass = g, water = b, plus the wheel-track render target). The plane has `receiveShadow` and the shadow camera also follows `optimalArea.position` with ortho half-extent = `optimalArea.radius` (`G/Ligthing.js:24-25, 153-172, ~199-204`).

The same `mod(p + half, size) - half` idiom is reused by RainLines (2048 quads, `G/World/RainLines.js:13, 187-193, 237`), Leaves (a GPU compute particle system of 2^7..2^11 leaves whose positions are wrapped in the update kernel around `focusPoint`, `G/World/Leaves.js:18, 148-159, 250-252, 297`), and Snow (a 256×256 displaced grid that renders its own elevation texture every frame from `terrainNode` + noise + tracks, with `roundedPosition` snapped to `subdivisionSize`, `G/World/Snow.js:14-16, 121, 265, 448-449`). WaterSurface is a single quad scaled to `radius*2` and just re-centred (`G/World/WaterSurface.js:384-385, 426-427`). WindLines is a pool of 4 meshes spawned at `focusPoint ± radius/2` (`G/World/WindLines.js:79-84, 159-160`). Wheel tracks are a 512 px, 40 m ortho render target whose camera follows the vehicle (`G/Tracks.js:11-12, 78-79`), read back by the floor, grass and snow shaders via `tracksDelta`.

### 3. Terrain data

Two authored sources, both loaded up front:

- `static/terrain/terrain.png` (512×512 RGBA, 334 KB; `.ktx` 350 KB) with `flipY = false` (`G/Game.js:145`). Channels: r = slab/furniture mask, g = grass density, b = water depth 0..1 (Blender sources `resources/textures/terrainFurniture.exr`, `terrainGrass.exr`, `terrainWater.exr`). GPU sampling is the TSL `terrainNode(positionWorld.xz)` in `G/Terrain.js:93-106`, shared by floor, grass, snow, leaves and water.
- `static/terrain/terrain.glb` (730 KB raw, 26 KB draco) gives the physics heights. `Floor.setPhysical` (`:120-153`) walks the 16,641 vertices, buckets them into a 129×129 `Float32Array` by `round((x/192 + 0.5) * 128)` and builds one Rapier heightfield. CPU-side height sampling otherwise does not exist; gameplay code treats ground as y≈0.

Resolution is 1.5 m per heightfield cell and 0.375 m per data texel; nothing is split or tiled.

### 4. Areas and zones

All areas live in one GLB: `static/areas/areas.glb` (3.29 MB raw, 639 KB with draco + ETC1S via `scripts/compress.js`; 737 nodes, 266 meshes, 13 textures, 120 nodes named `*Physical*`, 97 of them dynamic, 191 `cuboid` + 43 `tube` + 2 `hull` + 2 `ball` + 2 `trimesh` collider proxies). `Areas` instantiates one class per root node by name prefix (`G/World/Areas/Areas.js:23-48`), so every area and every rigid body exists from boot. Nothing area-specific is lazy except the Lab/Projects project screenshots, which are KTX2 textures fetched on demand when navigated to (`G/World/Areas/LabArea.js:455-495, 835-860`, `ProjectsArea.js:471-490`), and the Konami-code vehicle (`G/KonamiCode.js:59`).

Area base class (`G/World/Areas/Area.js`): `setObjects` (`:32-70`) calls `objects.addFromModel` on each child with `sleeping: true`; fixed-or-no-physics visuals are collected into `objects.hideable`. Two authored Blender empties per area, parsed by `References` (`ref*` prefix, `G/References.js:18`):

- `refZoneBounding` → `zones.create('cylinder', position, scale.x)`; `Zones.update` (`G/Zones.js:50-81`, tick priority 8) does a plain 2D `distanceTo` against the player each frame and fires `enter`/`leave`, which the area re-emits as `boundingIn`/`boundingOut` (`Area.js:72-102`). In practice these only drive achievements, audio and state; no physics is created or destroyed on enter.
- `refZoneFrustum` → a circle (`position`, `radius = scale.x`, `Area.js:104-118`) tested every tick with `circleIntersectsPolygon` against the four offset corners of the optimal-area ground quad (`:135-146`, `G/utilities/maths.js:144-167`). On transition it toggles `visible` on every hideable object3D (`:152-153, 166-167`) and emits `frustumIn/Out`; `update()` of the area only runs while `frustum.isIn` (`:27-28`). Radii from the GLB: circuit frustum 55 m, bowling 21.7 m, landing 13 m, most others 4–15 m.

Loading order (`G/Game.js`): batch 1 (`:103-109`) is only respawns GLB + 3 tiny textures so the intro circle and camera can exist; then `World.step(0)` builds the intro grid; `import('@dimforge/rapier3d')` (`:129`) runs concurrently with batch 2 (`:132-179`), a flat list of ~40 files with a progress callback feeding the intro ring; `Promise.all` (`:181`) gates Terrain → Physics → vehicle → Zones → Player → `World.step(1)` (`G/World/World.js:54-81`, every world system in one go) → optional `PreRenderer.render()` to warm shaders on WebGPU high quality (`:203-204`). `ResourcesLoader` (`G/ResourcesLoader.js:55-123`) is a counter-based `Promise` with a URL cache; there is no priority queue, no dependency graph, no streaming.

### 5. Quality tiers

`G/Quality.js:12-13`: `level = /Mobi|Android|iPhone|iPad|iPod/.test(UA) ? 1 : 0`, togglable from Options. Consumers: shadow map 2048 vs 512 and PCF radius 3 vs 2 (`G/Ligthing.js:23, 28, 170-171`); post `cheapDOF + bloom` vs `scene + bloom`, bloom mips 5 vs 2 (`G/Rendering.js:82, 90-104`); water surface blurred vs plain (`WaterSurface.js:330-344`); camera phi 0.31π vs 0.27π and speed zoom-out only on level 0, hence a smaller optimal area on mobile; vehicle controller step fixed to 1/60 on level 1. Pixel ratio is clamped to 2 regardless (`G/Viewport.js:24-25`); grass/leaf/rain counts do not change with tier.

### 6. Instancing and culling

`G/InstancedGroup.js` wraps a "base" object plus N reference `Object3D`s: for every mesh in the base it creates one `InstancedMesh(count)` whose per-instance matrix = `mesh.localMatrix × reference.matrixWorld` (`:92-120`), refreshed only for references flagged `needsUpdate`. Trees are two InstancedMeshes per species (trunks + `Foliage`, `G/World/Trees.js`); `Foliage` is 80 merged 0.8 m quads per clump, instanced via a 16-float `InstancedBufferAttribute` with `frustumCulled = false` (`G/World/Foliage.js:36, 200-211`). There is no LOD anywhere; the only distance-based visibility is the per-area frustum circle and the `hidden` term in the grass shader.

Physics coping strategy (`G/Objects.js:304-357`): every body is created at boot, dynamic ones `sleeping: true`; trees are fixed cylinders also flagged sleeping. Each frame `Objects.update` copies transforms only for awake+enabled bodies, resets anything below -1.5 m, and, whenever the rounded focus point changes by ≥1 m, force-sleeps any awake body farther than `optimalArea.radius` from the view. Nothing is removed; Rapier's island sleeping carries the ~150 bodies.

### 7. What transfers to an infinite, chunk-streamed procedural world

Transfers directly:
- The optimal-area abstraction (one ground-quad radius derived from camera + max zoom) as the single "detail budget" every layer keys off, including the shadow ortho frustum and fog range.
- Camera-looped detail layers with `mod(p - center + half, size) - half`, where the shader re-derives everything from wrapped *world* xz (noise, wind, density mask). Grid-snapping the floor mesh to the cell size avoids swimming.
- Fixed-count GPU layers that scale size instead of count past an ideal surface (grass `surfaceOverflow`).
- Rapier sleeping discipline: spawn asleep, wake by contact, force-sleep outside the radius, reset when below the floor.
- Frustum-circle gating of per-area `update()` and `visible`.
- Lazy KTX2 texture fetches for content the player navigates to; draco + ETC1S pipeline (`scripts/compress.js`).

Does not transfer:
- Terrain: one 512² RGBA texture and one 129² heightfield for 192 m; both assume a global UV `p/192 + 0.5` and a single collider. The floor displacement is a 1.5 m water dip, not real relief, so grass never samples height.
- One GLB for all areas and a flat two-batch loader with no priority or cancellation; all rigid bodies and instanced meshes exist for the whole session.
- The bedrock slab as an edge hack.

Must be added:
- Chunked heightfield generation off the main thread (Worker + transferable `Float32Array` per cell), producing both a height texture (or atlas indexed by chunk) and a Rapier heightfield per chunk; replace the global UV with `fract(p / chunkSize)` plus a chunk lookup, and give the grass/floor shaders a height sample so blades sit on relief.
- A chunk manager keyed on the focus position with hysteresis, that creates/removes `RigidBody`s (Rapier `removeRigidBody`) and GPU resources per chunk, loads in ring order, and caps work per frame.
- Deterministic per-cell placement: seed per chunk for trees/props (Bruno uses `seedrandom` for foliage shapes, `Foliage.js:9`), instance matrices into a pooled `InstancedMesh` per prop type, released on unload; for the grass wrap, hash the *wrapped world cell* in the shader instead of a vertex attribute for stable per-blade variation.
- A real resource queue (priority by distance, abortable fetches, LRU eviction).
- Keep the "fell below floor → reset" rule and a kinematic catch-plane for chunks whose collider has not arrived yet.
