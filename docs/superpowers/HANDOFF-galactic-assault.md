# Handoff: Galactic Assault (a Battlefront battle on the galaxy's worlds)

Branch `claude/galactic-assault`. Design: `docs/superpowers/specs/2026-10-06-galactic-assault-design.md`. Plan: `docs/superpowers/plans/2026-10-06-galactic-assault.md`. Routes: `/galaxy/hoth/surface?mission=assault`, `/galaxy/geonosis/surface?mission=assault` (from each system's mission page: *The Battle of Hoth*, *The Battle of Geonosis*, "Fight it now").

## Done

- `src/components/galaxy/surface/missions/assault.js`: the rules, pure and seeded (`RULES`, `SOLDIERS` a side by tier, `newBattle`, `chooseSide`, `stepBattle`, `hitSoldier`, `deploy`, `canDeploy`, `youDown`, `objectiveFor`, `battleView`, `endBattle`), tested in `assault.test.js` (the posts' meters, the phases and tickets, the soldiers' walk round walls, their fire, the end both ways, a no-player simulation).
- `missions/assaults.js`: the two maps as data (sides, posts, phases, tickets, lines, barks); `missions/index.js` merges them into `MISSIONS`; `index.test.js` checks every post stands on level ground within reach, the phases cover the posts, the kinds exist, and each map plays out within fifteen minutes either way.
- `missions/assaultScene.js`: the drawing (soldiers as `actors.js`'s `anyFigure` of their kind, chevrons, the posts' columns and rings, tracers, the shots at you, the sides' barks).
- `surface/scene.js`: the kind beside the chase (`assault`): `fire()` and `shot()` at the battle's targets, `hurt()` to nothing puts you down (`state.off = 'down'`, your figure tips, no input), `input.side(id)` / `input.deploy(id)`, Again, the compass's quest mark on your side's objective, the blaster's pool at 72, the world's own troopers hidden (`life.hideKinds`), dev hooks `missionDo('side' | 'deploy' | 'win' | 'lose', arg)`.
- `surface/AssaultHud.jsx` and the `.assault-*` styles in `surface.css`; `pages/GalaxySurface.jsx` mounts it for the kind, keeps the best and unlocks `galacticassault`.
- `blaster.js`: `tracer(from, to, color)` and a `pool` option; `actors.js`: `anyFigure(kind, spec, kit)` exported, `hideKinds(kinds)`.
- A snowtrooper (CC BY, mrpanini.yt) brought in with `scripts/sketchfab-surface.mjs people snowtrooper` (`catalog/people.js`, 8000 triangles, 51 KB, untextured as it comes: white, as a snowtrooper is), credited in `src/data/modelCredits.json`.
- `systems.js`: Hoth's and Geonosis's games live; `Achievements.jsx`'s `galacticassault`; `guide/pages.js` tips; README, `docs/architecture.md`, the backlog.
- `scripts/assault-check.mjs`: plays a battle through its dev hooks in headless Chromium with a screenshot a step.

## The models, and the ones that aren't here

The original Battlefront II's models (and the fan remaster's) are LucasArts' and Disney's: ripped game assets stay out, as the standing rules say. The battle wears what the site has: Sketchfab CC models (the clone, the battle droid, the super battle droid, the snowtrooper) and the code-built figures (`props/ice.js`'s `hothtrooper`). A better model for any kind is a catalogue line in `catalog/people.js` and `node scripts/sketchfab-surface.mjs people <kind>` (with `SKETCHFAB_API_TOKEN`); someone with their own models and the right to use them puts a GLB at `public/models/galaxy/surface/<kind>.glb` standing on y = 0, facing +z, in metres (`scripts/fbx-to-glb.mjs` converts an FBX), adds the catalogue line, and the battle wears it. `scripts/sketchfab-scout.mjs "<query>"` finds candidates and leaves out anything whose page says it was ripped from a game.

## Left, in order

1. **Browser polish on real hardware.** Headless SwiftShader checks the flow, not the feel: play Hoth and Geonosis on a desktop, tune `RULES` (the soldiers' accuracy and `atYou` damage, the walk, the capture rate), the chevrons' size, the tracers' count, the bark cadence. Done when a battle on Hoth takes five to eight minutes and both sides can win.
2. **A soldier that aims.** The code-built figures swing their arms as they walk; the Sketchfab models are still (the snowtrooper's arms are at its sides, the clone and super battle droid have idle and walk clips). A rifle in each soldier's hands (`props/ice.js`'s `held` parts for the humanoids; a small built gun for the models) and a turn of the torso to the target would read as fighting. `universe/gunplay.js` is too heavy for thirty figures; a cheap pose is the thing.
3. **More maps**, each a `missions/assaults.js` entry: Kashyyyk's beach at Kachirho (clones and Wookiees against the droids coming out of the lagoon: posts on `sites/forest.js`'s beach, Kachirho and the command flats; the water's level is 0, so keep posts above it), Endor's bunker (Rebels against the stormtroopers and scouts), Scarif's beach. The test in `index.test.js` covers a new map as it is.
4. **Vehicles and heroes.** An AT-ST to board, a snowspeeder on Hoth, an AT-TE's guns on Geonosis; Vader or a Jedi for a streak. The games design's Hoth snowspeeder mission folds into this battle as its vehicle.
5. **Online.** One battle for everyone in the system from the wall clock (the rules are deterministic from a seed and a clock), with only what changes it sent, as the galaxy games design says.
6. **Geonosis's *Seismic Charges***, the flight through the rings, needs a second slot on the system's game once a system can carry two missions.

## Checking it

- Tests: `npx vitest run src/components/galaxy/surface/missions`.
- In a browser: the dev server (`npx vite --port 5188`), then `OUT=/tmp/shots node scripts/assault-check.mjs hoth,geonosis` (`SIDE=attack` to fight the other way). Screenshots: `assault-<id>-1-choose.png` … `5-lost.png`.
- By hand, in development: `window.__surface().mission` is the battle's view; `window.__surfaceDo('missionDo', 'side', 'attack')`, `window.__surfaceDo('missionDo', 'deploy', 'walkers')` (a post's id), `window.__surfaceDo('advance', 30)` runs thirty seconds without drawing, `window.__surfaceDo('missionDo', 'win')` / `'lose'` end it.
- Gotchas: `?quality=low` caps the soldiers at six a side (`SOLDIERS`); the posts' ids are the maps' (`missions/assaults.js`); the HUD's deploy card lists only your side's posts, disabled while the enemy's in them; the world's quests and places still work during a battle but their panel is hidden until it ends.
