# His engine, our universe: the Expanse retired, its chunking and physics given to every world. The design

Date: 2026-10-08. Status: design, written from the owner’s brief by an architecting session, for Opus 5.5 implementation sessions working one lane each. The plan is `docs/superpowers/plans/2026-10-08-his-engine-our-universe.md`; the hand-off is `docs/superpowers/HANDOFF-his-engine.md`.

## What the owner asked

“The previous sessions thought I wanted an actual car game like Bruno Simon. I wanted his physics engine and other features like infinite worlds with chunking like Minecraft, to then see how he made it so good and apply it to the universe I made (all the worlds and characters and galaxies). Remove the Expanse. The point of the Expanse was to learn how we can implement its chunking and smart physics in the rest of the universe and the existing worlds.”

Three asks:

1. **The Expanse goes.** The driven planet at `/universe/expanse/:seed`, the generated sectors past the map’s rim, the pocket universes: none of it is a destination the owner wants.
2. **What it taught stays.** The chunked, worker-made, seeded land; Rapier stepped his way; the car; the view-fitted detail layers; the sleep discipline. These were built as libraries and they are kept.
3. **The existing universe takes them.** The universe map, the galaxy and its worlds, the planets you land on, the fandom worlds, and the characters that walk and drive in them, each take the pieces that make it load faster, hold a frame and feel solid, and none is rewritten.

## Where the site is today

Read from the code in this session. Line counts are from `main` at `4f8b3272`.

- **The Expanse is three things in one folder** (`src/components/expanse/`, 34 files, 3,507 lines): the sector generator and its drawing past the rim (`gen/`, `scene/`: seeds, names, tables, a 3 × 3 chunk grid of 80,000-unit sectors, a star-field for the rest), the pocket universes (`pocket.js`, `/universe?seed=<word>`), and the driven planet (`surface/`: the stream, the worker, the driver’s rules, the buggy, the scene, the HUD, the page). The universe map imports the first two (`universe/scene.js:197`, `layout.js:22`, `online/protocol.js:69`, `online/rosterWhere.js:12`, `pages/Universe.jsx:38`); the third is reached only by its route.
- **The libraries it was built on are not in that folder.** `src/lib/land/` (820 lines: a planet’s knobs from a seed, the relief layers the galaxy shares, rivers traced per region, a 64 m cell’s heights, water, mask, props and mesh), `src/lib/physics/` (1,284 lines: Rapier as data with a fixed 1/60 s step, an accumulator, a floating origin and a round planet’s gravity; a heightfield per cell; props asleep; his car; a walker’s capsule that shoves; the bedrock slab; bodies from a model’s node names), the look pieces in `src/lib/three/` (land map and material, water with his shallows, tracks, puffs, leaves, wind lines, his chase view with the optimal area, grass that takes the tracks), and the runtime’s chunk services (`src/runtime/chunkGrid.js`, `workers.js`, `origin.js`). Every one is pure where it can be and tested in Node.
- **Who uses them.** The Expanse surface is the only consumer of the land, the heightfield, the catch slab, the car, the land map, the water, the tracks, the puffs, the leaves, the wind lines and the chase view. The landings use the physics world and the pusher (`universe/landings/physics.js`: props, people as capsules, shots as rays, on a ball with gravity to its middle). Minecraft (`minecraft/stream.js`), the galaxy’s ground war (`galaxy/surface/ground/population.js`, soldiers per 48 m cell) and the Expanse use the chunk grid. The Death Star’s inside streams its rooms its own way (`deathstar/inside/scene/stream.js`). `lib/three/lod.js`’s `createLodSet` and `kit.js`’s `createPool` have no caller outside their tests.
- **The galaxy’s worlds** (`galaxy/surface/`, 36,080 lines; `scene.js` 3,556) are a fixed patch: one height function (`terrain.js`: the shared layers, a site’s flats and pits, a fine relief) over ±640 m, built whole at scene start, a far skirt to 9,000 m, the player held within `site.reach` (590). The walker (`walker.js`, 429 lines) is its own: circles and boxes in a 16 m grid (`createSolids`), `pushOut`, `groundAt` from the height function, floors over the land, wading. Props come from hand lists and seeded scatter over the whole patch, built at scene start as one `InstancedMesh` a material. Water is Gerstner waves (`water.js`, `ocean.js`). Nothing streams; nothing sleeps.
- **The landings** (`universe/landings/`, 31 files, 5,774 lines; `footScene.js` 3,618) are small planets a few hundred metres round, in map units (`METRE = 0.027`). Props and the people are on Rapier already; the player’s own walk (`foot.js`) is pure numbers over the sphere with a radius for bumping, not a body.
- **The universe map** (`universe/scene.js`, 5,861 lines) is 36,000 units to the edge, the Rick and Morty sector at z −48,000 with its own edge of 6,000, and everything in it built when the scene is: twelve fandom planets, six stations, the belt, the wonders, the traffic, the hunters, the NPC ships. Far places are already one draw of points past `realAt` (`farStars.js`); the real meshes stay built. The ship is its own flight model (`ship.js`’s `step`, explicit Euler, a 0.05 s cap); it turns back at the main sector’s edge unless the space is `expanse` (`OPEN_SPACE`). No floating origin: the map draws from a camera recentred at 3,000 (`DRAW_FAR`) and that is enough at 48,000.
- **The fandom worlds** each do their own thing, and most are small and flat. Albuquerque is a disc of 420 m with an analytic height (`albuquerque/world/rules.js`’s `groundHeight`), its car a planar bicycle model over it (`stepCar`), its colliders a spatial hash (`COLLIDERS`, cells of 24 m). The Shire is a disc of 64 m (`shire/rules.js`), the towns discs of 46 to 110 m (Amon Hen’s and Orthanc’s terrain wider), every ground an analytic function baked into a mesh, every collider a hand circle or box, the figure stepped by `shire/rules.js`’s `stepHobbit` or the shared `towns/walker.js` (208 lines; the office and the Citadel use it too). Invincible is the one big one: a flight over 6,400 m of analytic coast and hills with instanced towers and a 100 m grid for what is near (`invincible/world/map.js`). Cybertron’s game, the office, the compound and C-137’s street are flat floors with hand solids. Mario 64, Minecraft and the Death Star’s inside have physics of their own that fit their games. Minecraft is the one world streamed in chunks from a seed (`minecraft/stream.js`), in a worker, its save the seed and the edits. Five walkers exist: the galaxy’s `walker.js`, the landings’ `foot.js`, `towns/walker.js`, the Shire’s `stepHobbit`, the compound’s `stepHero`; none is a body.
- **In flight beside this**, as open pull requests on 8 October (read for their files, not merged; the lanes below say which to wait for):
  - **#705 `claude/remove-expanse`**: removes the driven planet only (`expanse/surface/`, the page, the route, the gate, the guide, the tour, the probe journey, the `planet` kind), keeps the sectors and the pockets “as part of the universe map”, and deletes the stream, the job, the driver’s rules and the scene rather than lifting them. Its base is an older `main` (it reads as conflicting). It closed #700 unmerged.
  - **#700 `claude/one-feel-car`** (closed, not merged): one feel’s 1C: `lib/vehicleFeel.js`, `lib/three/vehicleBody.js`, `lib/physics/carTuning.js`, pure and tested, proven on the buggy. The library halves are right; the buggy half goes.
  - **#656 `claude/smooth-worlds`**: `lib/three/chunks.js` (a scene’s own cells on the XZ plane, built and prepared through the GPU queue, shown within `near`, let go past twice `far`, retried on failure; for content made on the main thread, beside `runtime/chunkGrid.js` which is for worker answers with generations), `galaxy/surface/thingCells.js` (the galaxy’s placed things by cell on it), `universe/nearGrid.js` (the map’s near planet maps and deep space’s models by 1,500-unit cell, at most two heavy cells held), `lib/three/bakeCache.js`.
  - **#669**: the nature kit on seven Star Wars worlds (`galaxy/surface/placer.js`, `scene.js`, `sites/`, a new `nature.js` and `layout.js`). **#566**: lava on Mustafar and Nevarro (`galaxy/surface/walker.js`, `water.js`, `scene.js`). **#579**: the NPC architecture (`lib/ai/schedule.js`, a budgeted schedule for brains; `lib/sim/fixedStep.js`). **#701**: one feel’s 1A (adds `expanse/surface/look.js`, edits the buggy). **#702**: 1D, the panel. **#706**: kit worlds Phase 2 (`puffs.js`, `leaves.js`, `weather.js`). **#679**: multiplayer foundations (`online/protocol.js`, `nostr.js`, `client.js`).
  - The designs of one feel, kit worlds, WebGPU acceleration, universe vastness and squads each name the Expanse somewhere; section “What this does to the lanes in flight” says what each does now.

## What Bruno does that we keep, and where each piece now lives

The research note (`docs/research/2026-10-08-folio-2025-physics-terrain-streaming.md`) has every number. The Expanse ported these; this table is what survives it and who takes each.

| His mechanism | Ours, kept | Who takes it now |
|---|---|---|
| Rapier, stepped at the frame (we step fixed 1/60 with an accumulator), bodies as data, three collision groups | `lib/physics/world.js` | the galaxy’s worlds (new), the landings (as today), Albuquerque (new) |
| props spawn asleep, light, instanced; awake bodies outside the camera’s ground radius put back to sleep | `lib/physics/props.js`, `world.js`’s `sleepOutside`, `lib/three/kit.js`’s pools | the galaxy’s worlds, the landings (`settle` today, the area’s radius after) |
| his car: the three-cuboid chassis with its low centre of mass, the bumper in its own group, the ray-cast vehicle, soft top speed, must-stop-to-reverse, auto-unflip | `lib/physics/vehicle.js` | Albuquerque’s Aztek (the natural-worlds design’s own “Step 2: wheels” brief, now the one car) |
| a heightfield from the same heights the ground is drawn from; the bedrock slab under the player where the ground is not in yet | `lib/physics/heightfield.js`, `catch.js` | the galaxy’s worlds, per cell round the player |
| the ground as a mask every layer reads (grass, water depth, paving), the shallows look, the tracks the grass lies flat under, the puffs, the leaves, one wind | `lib/three/landmap.js`, `land.js`, `river.js`, `tracks.js`, `puffs.js`, `leaves.js`, `wind.js`, `grass.js` | the galaxy’s worlds, site by site: the land as cells and the water where a site asks for rivers; the tracks under their rides; grass, wind and puffs as today |
| the optimal area: the screen’s four corners on the ground size the floor, the grass, the water, the shadow camera and the fog, so nothing is simulated off screen | `lib/three/view.js`’s `optimalArea` (pure) | any world with a chase or third-person camera: the galaxy’s worlds and the landings first; the universe map’s radius for what is real |
| the world streamed in cells, made off the main thread, a bounded amount built a frame, dropped behind with hysteresis, late answers refused | `runtime/chunkGrid.js`, `workers.js`, the Expanse’s `stream.js` (lifted to the runtime, below), `lib/three/gpuWork.js` | the galaxy’s worlds (land cells), the universe map (places), as Minecraft and the ground war do already |
| a floating origin for an endless land | `runtime/origin.js`, `world.js`’s `onOrigin` | kept for Minecraft and any endless world after; no authored world needs it (the map’s 48,000 is fine in floats) |
| colliders from a model’s node names | `lib/physics/fromModel.js`, `lib/three/colliders.js` (one feel, 1E, merged) | every world that loads a GLB into Rapier |
| a kinematic capsule that follows a walker and shoves what it meets | `lib/physics/pusher.js` | the landings’ people (today); every NPC on a Rapier world (new) |
| the walker as a body: his world has no walker; Rapier’s character controller is the one he would use | `lib/physics/walker.js` (new) | the galaxy’s worlds, the landings’ player, after them any world that walks on Rapier |

Not kept: the buggy (a car built in code for a world with no other car), the Expanse HUD, the sector generator, the pocket universes, the star-field of sectors, the driven planet’s page and route. They go with the folder.

## Decisions

### 1. The whole Expanse goes, and the map gets its edge back

Lane 0 is #705 taken the rest of the way: it starts from `claude/remove-expanse`, merges `main`, restores from `origin/main`’s history the four files decision 2 lifts (so the move is a move, with its tests), and then deletes the sectors and the pockets too.

Deleted: `src/components/expanse/` entire, `src/pages/Expanse.jsx` and its test, the route in `App.jsx`, `WORLD_MB['/universe/expanse']` and `SEEDED` in `worlds/worlds.js`, the guide’s page and route and about, the tour’s brief, `scripts/perf-probe.mjs`’s `expanseDrive`, `docs/superpowers/previews/expanse-7-standing.webp`, `surface.css`.

The map: `universe/layout.js` loses `inExpanse`, `expanseSector` and the grid imports; `sectorOf` answers `main` or the Rick and Morty sector, as it did before the Expanse (a point past the main edge is `main`’s and the rim turns the ship). `ship.js`’s `OPEN_SPACE` loses `expanse: true`, so the main sector’s edge is an edge again; the Rick and Morty pocket’s edge was always a wall. `scene.js` loses `createExpanse` and the Expanse note. `online/protocol.js`’s `writePose` never appends a sector and `readPose` reads a pose of ten or eleven numbers the same, clamping x and z to the map’s `FAR` as it did for a pose without a sector (an older pilot out in a sector reads as null, which is where they were anyway: out of everyone’s range); the room name (`ROOM`) does not change, since the wire shape it reads did not. `rosterWhere.js` loses its Expanse branch. `pages/Universe.jsx` loses the pocket.

`/worlds`: `worlds/registry.js`’s `KINDS` becomes `['minecraft']`; `list()` leaves out a row of a retired kind and `worldUrl` of one is `/worlds`; a stored `pocket` or `planet` row is not deleted by the code (the visitor’s Remove does that) and `MyWorlds` shows none of them. `fileId` refuses a file of a retired kind. The infinite-worlds design’s Phase 6 (worlds for others) is unaffected: Minecraft is the world it shares.

Why the sectors go with the car: the owner named the Expanse as the misunderstanding and asked for the universe they made to be improved, not a generated one beside it. The sectors are in git; if endless space past the rim is wanted later, it is one lane that puts `rt.chunks` back under `scene.js` with the generator from history. The pocket universes were a way to reseed the sectors and have nothing to reseed.

### 2. What the Expanse proved is lifted, not deleted, before the folder goes

The driven planet’s pure halves are the surface kit every world below takes. They move down with their tests and their headers, renamed for what they are:

| Was | Becomes | What it is |
|---|---|---|
| `expanse/surface/stream.js` | `src/runtime/landStream.js` | the cells to ask for, build, re-mesh and drop round a focus, with a physics ring; a `sink` builds |
| `expanse/surface/job.js`, `worker.js` | `src/lib/land/job.js`, `src/lib/land/worker.js` | the worker’s one job: a cell and its mesh, or a mesh again |
| `expanse/surface/rules.js` | `src/lib/physics/driver.js` | a driver’s spawn, respawn to where it last stood dry, drowning, stuck |
| `expanse/surface/scene.js` (the land half) | `src/lib/three/landScene.js` | the cells’ ground, water, grass, puffs, leaves, wind lines, tracks, the sun and shadow camera on the area, a two-colour sky as the fog, in one group at minus the origin, with `build`, `remesh`, `unbuild`, `shift`, `follow`, `draw`, `lowerQuality` |
| `expanse/surface/module.js` (the wiring of stream, physics ring and origin) | `src/runtime/land.js`: `rt.land` | the service below |

Why lift and not rewrite: the four files are tested (the stream alone has 184 lines of tests pinning which cells are asked for and dropped) and were built to the runtime’s contracts; what they lack is a consumer, and lanes 2 and 4 are two.

**`rt.land`** is the one new runtime service: `rt.land.open({ spec | field, seed, kind, radius, physicsRadius = 1, physics = null, sink = null, makeWorker }) → { update(x, z, heading), heightAt(x, z), waterAt(x, z), cell(cx, cz), cells(), solid(cx, cz), stats(), dispose() }`. It defines the `'land'` worker once, runs `landStream` with the cells’ heights kept, and when it has a `physics` keeps a heightfield and the cell’s prop bodies for each cell in the physics ring and the catch slab under the focus until the ground is in. `spec` is JSON (it crosses to the worker): `landSpec(seed, type)`’s shape, plus the two fields decision 4 adds for an authored site. A world whose ground is its own function and small (Albuquerque) opens it with `field(x, z)` in place of `spec` and no `sink`: the cells are sampled on the main thread, nothing is drawn, and only the physics ring exists (the catch slab, the heightfields). `heightAt` and `waterAt` read the nearest loaded cell (`lib/land/cell.js`’s, the same triangles the mesh draws) and `NaN` where none is loaded, so a world can hold its walker until the ground is there.

The HUD, the buggy, the page and the route are not lifted. The buggy’s squash and lean are #700’s `lib/vehicleFeel.js`, `lib/three/vehicleBody.js` and `lib/physics/carTuning.js`, which lane 4 takes from that closed branch without the buggy half and proves on Albuquerque’s Aztek.

Two cell grids exist after #656 and both stay, each for what it is: `runtime/chunkGrid.js` (with `landStream` over it) is for cells answered by a worker, with generations so a late answer is refused; `lib/three/chunks.js` is for a scene’s own cells built on the main thread and prepared on the GPU queue, with retries. `rt.land` is on the first; the galaxy’s placed things (`thingCells.js`) and the map’s near maps (`nearGrid.js`) are on the second. A site that has land cells, thing cells and the ground war’s people cells has three grids, one a concern, and that is fine: each is pure and small, and none knows the others.

### 3. Characters: one walker on Rapier, the feel kept

`src/lib/physics/walker.js` (new, pure, tested against the engine): `addWalker(physics, { radius = 0.38, half = 0.55, position, step = 0.55, slope = 0.6, snap = 0.3 }) → { body, move(delta, dt) → { position, grounded, slid }, teleport(position), position(out), remove() }` on Rapier’s `KinematicCharacterController`: autostep up to `step` metres (the galaxy walker’s `WALK.step`), slopes to `slope` (its `WALK.steep`, as a gradient), snap to the ground within `snap` so a walk down a slope keeps its feet, and impulses on the dynamic bodies it walks into (so a crate asleep wakes and goes, his light props). On a round planet the controller’s up is the body’s own radial (the landings’ `gravity.centre`).

What a world keeps: its rules. The galaxy’s `walk(s, input, dt, world)` keeps every number in `WALK` (speeds, acceleration, air control, turn, jump, gravity, wading) and the floors over the land; what changes is one seam: `world.move(from, delta) → { to, grounded }` is how it meets the ground and the solids. On a world without Rapier, `move` is today’s `pushOut` and `groundAt` (the default, so every site plays as it does); on a site with Rapier, `move` is the walker’s. `createSolids`’s circles and boxes become fixed bodies through one pure `solidsToBodies(solids) → descs` (a circle a cylinder of its `top`, a box a cuboid turned by its yaw, a `base` lifting it), so a site’s hand colliders are not rewritten: they are read. The landings’ player (`foot.js`) takes the same walker on its sphere; its numbers stay in `FOOT`. The towns’ shared walker (`middleearth/towns/walker.js`, which the office and the Citadel use too) takes the same seam with the same default, so any of those worlds can be put on Rapier later by giving it a `move`; none is in this design’s lanes (section 7).

NPCs are pushers already on the landings; on a galaxy site with Rapier, every figure that walks gets one (`pusher.js`), and the solids they went round are bodies. A brain far outside the area’s radius steps every fourth frame and its pusher not at all; nearer, every frame. The mechanism is #579’s `lib/ai/schedule.js` (a budgeted schedule) once it is in, and `lib/three/animBudget.js`’s pattern until then.

Lane 1 touches `galaxy/surface/walker.js`, which #566 (lava) also edits: it merges after #566, or merges `main` once #566 is in before opening.

### 4. The galaxy’s worlds: the land as cells, the ground solid round you, the detail fitted to the view

A site’s ground is a height function today; it becomes a `spec` the worker can make cells from, with the same numbers:

- `lib/land/shape.js` (new): `levelled` and `dug` move here from `galaxy/surface/terrain.js` unchanged (as `LAYERS` moved), and `makeCell` applies `spec.flats` and `spec.pits` after the layers and the rivers. `terrain.js` imports them back and its tests pass unchanged. A test pins that for every landable site, `makeHeight(ground, { relief })` and the cells’ `heightAt` agree within `1e-3` at 200 seeded points (the fine relief is a layer too, by name).
- Lane 2 starts after #656 (thing cells), #669 (the nature kit on the sites) and #566 are on `main`: all three edit `galaxy/surface/scene.js` and `placer.js`, and the thing cells are what this lane’s land cells sit beside.
- `galaxy/surface/scene.js` opens `rt.land` for a site that says `stream: true` (Yavin first; the plan names the order), the visual radius by tier from `lib/budgets` (a new column, `cells`: low 3, mid 4, high 6, ultra 7, the Expanse’s), the physics ring 1, the `sink` the `landScene` layers; a site without the flag builds its patch as today, pixel for pixel. Beyond `site.reach` the cells go on (the land is the same function), so a site that later lifts its reach is endless without another change; the reach itself stays a gameplay choice.
- Rivers are a site’s choice (`ground.rivers`, default none): a site with them gets his water (`river.js`) in place of the Gerstner plane where it has them, and its scatter keeps off the water (the mask’s G is 0 there already). Yavin has none in this design.
- Props: a cell’s scattered props (`lib/land`’s seeded scatter, now the kit’s species through `lib/land/flora.js` where kit worlds Phase 3 builds it) go into the kit’s pools (`createPool`’s `set(cellKey, items)`, `free(cellKey)`), and within the physics ring become sleeping bodies (`props.js`). The hand `things` of a site stay on #656’s `thingCells.js` (built and prepared by cell already) and draw as they do; their bodies come from `collidersOf` (1E) or their spec’s shape, asleep, added when their thing cell is shown and the land cell under it is solid.
- The view: the surface camera keeps its feel; `optimalArea({ fov, aspect, phi, theta, radius })` is read once a resize from its own numbers and handed to the grass (`size`), the shadow camera (±radius, following the player), the fog (`near + 0.315·(far − near)` to `near + 1.25·(far − near)`), `sleepOutside` (the radius, each metre the player moves) and the AI’s near ring. The tracks go under the rides (`tracks.js`, the grass takes them already).

What a visitor sees on Yavin after: the same world, loading in cells round the landing site instead of all at once (the progress bar shorter, no frame over 100 ms after the veil), the figure stopping against the same trees, a barrel that moves when walked into, the grass flattened under a speeder.

### 5. The universe map: places as cells

The map is one scene built at start. #656 gives it a grid for the near planet maps and deep space’s models (`universe/nearGrid.js` on `lib/three/chunks.js`: 1,500-unit cells, built and prepared within 1,500 of the camera or 3,000 ahead, shown within 1,500, hidden past 2,400, let go past 4,800, two heavy cells held). Lane 3 widens what that grid holds, not the grid: a place’s whole real content (its planet mesh and shader, its moons, its halo, its landing stand-ins, its local traffic) becomes items of it, built when the cell comes near and freed when it goes, with `near` for a light item its place’s own `realAt` (a place is real within `max(1500, reach × 20)`: up to 6,440 for Aurelia) rather than one number, pinned by a test that no place is ever both a star and a mesh. The far star it is drawn as beyond is `farStars.js`’s and never goes. The belt, the home system and the wonders are always built (the home system is where the map opens). A place’s state (claimed, at war, visited) lives in the rules, not in the mesh, so building and freeing changes nothing a visitor did; the director’s events keep their `where`. Lane 3 starts after #656 is on `main`.

The ship’s flight stays its own: no Rapier on the map (a flight model with a sphere test is the right physics for space, and his car has nothing to say about it). No floating origin (decision 1’s table).

### 6. Albuquerque’s car on his car

`albuquerque/world/rules.js`’s `stepCar` (the bicycle model) is replaced under the same interface by `lib/physics/vehicle.js` on the town’s ground made solid round the car by `rt.land` in its physics-only form (decision 2: a `field(x, z)` in place of a `spec`, cells sampled on the main thread from `groundHeight` at 1 m, no worker and no drawing, the ring of heightfields following the car), the kerbs and the buildings fixed cuboids read from the town’s own `COLLIDERS` by a reader of `solidsToBodies`’s shape (decision 3; the town’s boxes are axis-aligned `{ x, z, w, d, h }`), driven by `lib/physics/driver.js` for the respawn; its tilt, slide and yaw are then real and the one-feel design’s `vehicleFeel` (1C) lays the lean and squash over it. The Aztek’s numbers (top speed, acceleration) are its own table over `CAR`. The traffic’s cars stay kinematic (they follow their routes; bodies that shove, like the pushers). Nothing of the story, the town or the save changes.

The galaxy’s speeders and bikes (`walker.js`’s `ride`) keep their hover model: a speeder does not touch the ground, and his controller is for wheels. Cybertron’s truck form and the office’s cars are games on a page and keep their own motion; `look.js` (one feel) says so.

### 7. Everything else is left as it is, and says why

Minecraft (chunked, seeded, its own box physics that is the game), Mario 64 (the N64’s own), the Death Star’s inside (its rooms streamed by doors), the Avengers HQ games, Invincible, the Caribbean tide, Earth, C-137’s interiors, Dot Matrix, the music room, the page scenes: no chunking (none is bigger than its view), no Rapier (their collision is their game or they have none). Each world’s `look.js` (one feel, 1A) gains a `physics: 'rapier' | 'own' | 'none'` line with a `why` for the last two, read by `looks.test.js`, so the roster is checked, not remembered.

## The roster

Pieces: **S** streamed cells (`rt.land` or `rt.chunks`), **P** Rapier (`lib/physics`), **W** the walker, **C** the car, **A** the optimal area, **Z** the sleep discipline. A dash is “not this one, and `look.js` says why”.

| world | files | S | P | W | C | A | Z | lane |
|---|---|---|---|---|---|---|---|---|
| the galaxy’s worlds and sites | `galaxy/surface/` | land cells | heightfields, props, solids | yes | — (rides hover) | yes | yes | 2 |
| the landings and the foot scene | `universe/landings/`, `universe/footScene.js`, `universe/foot.js` | — (a few hundred metres) | as today | yes | — | yes | the area’s radius | 1 |
| the universe map | `universe/scene.js` | places | — (flight) | — | — | the radius for what is real | — | 3 |
| Albuquerque | `albuquerque/` | — | the town’s ground, kerbs, buildings | — | the Aztek | — | props | 4 |
| Middle-earth: the Shire, the towns | `middleearth/` | — (discs of 64 to 110 m, one view each) | — (hand circles and boxes, few) | the seam only (`towns/walker.js`) | — | — | — | 1 (the seam) |
| the office, the Citadel | `office/`, `rickmorty/citadel/` | — | — | the seam only (the same walker) | — | — | — | 1 (the seam) |
| Invincible | `invincible/` | — (a finding: its tower field by cell, later) | — | — (it flies) | — | — | — | — |
| C-137’s street, Cybertron, Avengers, the Caribbean | their folders | — (flat floors, one view) | — | — | — | — | — | — |
| Minecraft, Mario 64, the Death Star’s inside | their folders | their own | their own | their own | — | — | — | — |
| the galaxy map, Earth, Dot Matrix, the music room, the page scenes | their folders | — | — | — | — | — | — | — |

Two the owner may want next, named under the hand-off’s findings rather than done here: Invincible, whose 6,400 m of towers is the one authored world big enough for `rt.chunks` (its tower field and its life by cell, the ground staying analytic); and Middle-earth’s towns on the walker seam with their props as bodies, which is a town-by-town pass once lane 1 has the seam in `towns/walker.js`.

## What this does to the lanes in flight

- **One feel**: 1A (#701) proves `painted` on the Shire alone and drops its Expanse files (`expanse/surface/look.js`, the buggy’s palette) when lane 0 lands, or lane 0 deletes them if 1A merges first; 1C (#700, closed) is reopened by lane 4 as its library halves on the Aztek; 2C loses “the Expanse (its remaining pieces)”. `expanseDrive` in their checks becomes `abqDrive` (lane 4 adds it) or `yavinWalk` (lane 2).
- **Kit worlds**: Phase 3 “flora and the Expanse drawn through pools” becomes “flora, and the galaxy’s cells drawn through pools”: `lib/land/flora.js` as written, its consumer lane 2 here. Its “done” on `/universe/expanse/7` becomes the same on `/galaxy/yavin/surface`.
- **WebGPU acceleration**: PR 5 “the Expanse surface” becomes “the galaxy surfaces”: the same `lib/three` shaders, their TSL twins, the flip on the surface module.
- **Infinite worlds**: Phases 4 and 5 are done and retired; Phase 6 stays for Minecraft. The design’s answer 3 (the Expanse) is history; `rt.chunks`, `rt.workers`, `rt.origin` are its lasting answer.
- **Universe vastness**: the Expanse’s star-field and sectors rows are gone; nothing else changes.
- **Ground factions**: names the Expanse’s stream as an example; the example is now `runtime/landStream.js`.

The hand-offs of those lanes get a line each (lane 0 edits them); their specs stay as the record.

## Testing

- Pure, in Node: `runtime/landStream.test.js` (moved; the same cells asked for and dropped as the Expanse’s test pinned), `lib/land/job.test.js` (moved), `lib/physics/driver.test.js` (moved), `runtime/land.test.js` (new: a fake pool answering from `makeCell`, a fake physics: the ring’s heightfields come and go as the focus moves, `heightAt` is `NaN` until a cell is in, the catch slab follows until then, an origin shift moves everything), `lib/three/landScene.test.js` (new: on `gpuFake.fixture.js`, builds and frees a cell, shifts), `lib/physics/walker.test.js` (new, against the engine: a capsule walks up a 0.5 m step and not a 0.7 m one, holds a 30° slope and slides a 40° one, keeps its feet down a slope, shoves a crate, walks round a planet with gravity to its middle), `lib/land/shape.test.js` (moved from the galaxy’s `terrain.test.js` lines for `levelled` and `dug`, which stay too), `galaxy/surface/terrain.test.js` gains the cells-agree test, `galaxy/surface/walker.test.js` gains `world.move` with both seams, `solidsToBodies.test.js`, `universe/online/protocol.test.js` reads a ten- and an eleven-number pose, `worlds/registry.test.js` on retired kinds, `albuquerque/world/rules.test.js` keeps its numbers under the new `stepCar`.
- Every lane: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --only smoke --routes <its routes>` with before and after shots in the pull request. Lane 2 runs `node scripts/galaxy-check.mjs` (within its level’s row) and the new `node scripts/perf-probe.mjs yavinWalk` (walk 300 m out and back on Yavin at high; after the veil no frame over 100 ms and p99 under 33 ms, quoted). Lane 3 runs `node scripts/universe-check.mjs` against its baseline. Lane 4 runs `node scripts/perf-probe.mjs abqDrive`.
- A repair changes no pixel (`docs/health/RULES.md`): a site without `stream: true`, the map before its radius moves, Albuquerque’s town: shot before and after, compared.

## Non-goals

- No endless space past the rim, no pocket universes, no generated planets: the Expanse is gone, not moved.
- No rewrite of any world’s rules, keys, saves, HUD or story. A world takes a seam (`world.move`, `stepCar`’s interface, a `stream` flag) and plays as it did.
- No Rapier on the universe map’s flight, the galaxy’s rides, Cybertron’s truck or the office’s cars.
- No WebGPU, no TSL, no new dependency, no new model.
- No weather, seasons, day cycle: a later lane on the house’s uniforms, as one feel says.

## Open assumptions, marked

- Rapier’s `KinematicCharacterController` on a sphere (up as the radial) is untested in this repo; lane 1’s first task checks it and, if it will not take a changing up, the landings’ player keeps `foot.js`’s own walk over a pusher and the hand-off says so.
- The galaxy surface’s scene at 3,556 lines is over the measure’s ceiling already; lane 2 splits what it touches (`land` into its own file beside `scene.js`) and leaves the rest, per the rules’ recipe.
- `nearGrid.js`’s `near` as a per-item `realAt` is a change to #656’s grid after it merges; if its `max` of two heavy cells cannot hold every place’s mesh within `realAt` on `low`, lane 3 keeps the heavy items (the near maps) at two and lets only the light ones (meshes, halos, stand-ins) follow `realAt`.
- The ground war’s soldiers already stream at 48 m cells with their own grid; lane 2 leaves that grid alone (two grids on one site is fine: one is land, one is people).
