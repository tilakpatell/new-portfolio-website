# Handoff: Cybertron's world (`#/cybertron`)

Spec: `docs/superpowers/specs/2026-10-05-cybertron-world-design.md`.
Plan: `docs/superpowers/plans/2026-10-05-cybertron-world.md`.
Code: `src/components/cybertron/game/`. The rules are in `rules.js`
(tested by `rules.test.js`), the areas are in `areas/` (tested by
`areas.test.js`), `sim.js` puts them together (tested by `sim.test.js`,
including a run through every mission), `scene.js` and `stage/*.js` draw
them, and `GameWorld.jsx` drives them.

The owner's asks:
- Make the Transformers world properly 3D and better.
- Use models from the era: the Aligned continuity, High Moon's War for
  Cybertron and Fall of Cybertron, and Transformers: Prime. Search for
  models first and generate only if none can be found.
- Make the planet look like Cybertron at war: concentric megastructures,
  molten seams and energon cracks.
- Iacon at war, with Team Prime's base and Jasper linked to it by bridges.
- Make PRs and merge them to main regularly.

## Done (all merged)
- **The planet at war** (PR #178). The hero globe and the universe
  map's Cybertron share `skin.js` (energon, fire and city lights) and
  `war.js` (bursts over the fighting). The maps come from
  `scripts/build-cybertron-planet.mjs`.
- **The world** (PR #217):
  - 35 Sketchfab models under CC BY: `catalog.js`,
    `scripts/sketchfab-cybertron.mjs`, credited as `cybertron-<kind>`.
  - Three areas: Iacon, Team Prime's base and Jasper.
  - Seven missions, each with an achievement.
  - The transformation in `chunks.js`.
  - The autorig for the Prime robots that came without a skeleton.
- **The universe map's orbit** (PR #226). The orbiting Optimus and Megatron
  are now War for Cybertron's and Fall of Cybertron's, frozen in a pose by
  the import script's `pose`. They also stand on the landing.
- **Megatron's tank** (PR #235). He spends 12 s as a robot, then changes
  for 2.1 s, then spends 6.5 s as a tank charging and shelling, then changes
  back for 1.6 s (`MEGATRON` in `rules.js`). The change is drawn with his
  model's own clip (`catalog.js` `clips.toVehicle`/`toRobot`). Also in this
  PR: the campaign test, and a "transform to talk" prompt when you're in the
  truck.
- **Iacon's look** (PR #239):
  - Fall of Cybertron towers built from `prism`, `wedge` and ribs.
  - Collars and crowns on the towers.
  - Slit lights (`platedMaterial({ lights: 'slits' })`).
  - Every outdoor area's metal is lit by a PMREM of its own sky.
- **Phones**: while playing, the world takes the whole screen. The touch
  buttons fit their labels. The guide's `?` and the scroll saber hide.

## Checking it
- Dev only: `#/cybertron?quality=high&autoplay` starts playing.
- `window.__CY__.go('base' | 'jasper' | 'iacon')` crosses to an area.
  `window.__CY__.sim` is the sim: move `sim.player`, push enemies, or set
  a mission.
- Under the headless software renderer, a frame takes about a second.
  After teleporting the player, wait 20–30 s before a screenshot, because
  the chase camera eases in.

## Left
- **Out of scope in the spec, still open**:
  - Playing as Megatron (the Decepticon side), and Kaon.
  - Online players in the world (`useTravellers`, as Avengers HQ does).
- Barricade isn't in the fight yet. `catalog.js` has him, with his
  transformation clip, but `sim.js`'s `MODEL` doesn't use him. He could
  change and drive at you the way Megatron does. His clip's
  timings would need finding the same way: render a contact sheet of
  frames (a gitignored `lab/sheet.html` taking `file@time@yaw`) and read
  off where the change starts and ends.
- Prime's Optimus stands with his upper arms a little out, because his
  shoulder armour is broad. A per-model `stand` pose in `catalog.js` would
  fix it if it bothers anyone.
- Iacon could take more Fall of Cybertron detail:
  - pipes and conduits between the towers
  - a few huge ring structures, as on the planet
  - the deck's trenches
- Waking Metroplex finishes the mission, but Metroplex doesn't move on the
  skyline. A slow turn of his head, or lights coming on, would sell it.
