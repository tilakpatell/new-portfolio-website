# Handoff: Invincible, the open world

Session of 2026-10-05. The ask: "really improve and make 3d models and stuff for invincible and make it a 3d world not just a site. Make it a lot better", merging to main as it's built. Spec: `docs/superpowers/specs/2026-10-05-invincible-world-design.md`.

## Done (merged)

- [#157](https://github.com/tilakpatell/new-portfolio-website/pull/157), the flyable city: `/invincible` opens on it. `map.js` and `flight.js` (tested), the land shader, 6,700 towers, 5,500 houses, the landmarks modelled in code, the sound-barrier boom, craters, the HUD (speed, Mach, height, compass, map) and noon, dusk or night.
- [#172](https://github.com/tilakpatell/new-portfolio-website/pull/172), people and things to do:
  - the cast built in code (Atom Eve, Mom, Cecil, Allen, townspeople), with Eve on patrol and speech balloons;
  - `quests.js` (tested): Dad's rings, eight title cards and rescues;
  - clouds, the airliner, and five achievements.
- [#183](https://github.com/tilakpatell/new-portfolio-website/pull/183), traffic and pedestrians: `traffic.js` (tested) and `life.js`.
- [#194](https://github.com/tilakpatell/new-portfolio-website/pull/194), space:
  - `orbit.js` (tested) and `space.js`: the Earth from the Earth page's maps, the Moon, Mars, Allen and Thragg, and the re-entry burn;
  - the land is now a 40 km disc, and the far plane moves out with height;
  - per-instance shader numbers are now `flat`, which fixed the speckled walls.

- [#203](https://github.com/tilakpatell/new-portfolio-website/pull/203), combat:
  - `fight.js` (tested) and `flaxans.js`: the Flaxan portal over the river, punches with a lunge, ramming, bolts;
  - Cecil starts it, or it comes four minutes in;
  - the guide's tips, moved into `components/guide/pages.js` after another session's refactor.
- [#205](https://github.com/tilakpatell/new-portfolio-website/pull/205), polish:
  - the first visit drops Mark in from the sky under the INVINCIBLE title card;
  - E by Dad scrolls down to *Think, Mark!*;
  - the minimap is placed for phones.

## Blocked

The session's network policy refused `api.meshy.ai`, `api.sketchfab.com` and Poly Haven, with a 403 from the egress proxy. Every new model is code. The owner can allow those hosts in the environment's network settings. Then `scripts/meshy-invincible.mjs` could make HD figures for Atom Eve, Debbie, Cecil and Allen, in place of the kit figures in `people.js`. The `CAST` pattern in `../cast.js` and `lib/three/rig.js` already pose any rigged GLB.

## How to check

- `npx vitest run src/components/invincible/world`: map, flight, orbit, quests, traffic (51 tests at the space merge).
- With the dev server running, `OUT=/tmp/shots node scripts/inv-world-check.mjs [shot …]`.
  - Shots: `spawn street curb downtown high suburb river boost porch gda burger school plaza eve jet clouds rings card rescue climb orbit orbitnight moon reentry allen mars thragg dusk night streetnight`.
  - Each shot is roughly 10 s in SwiftShader at 960×540, low tier.
- Dev hook: `window.__INVWORLD__ = { api, sim }`.
  - `sim.h` is the hero; `sim.yaw` and `sim.pitch` are the camera.
  - `sim.snap` puts the camera and the pose where they're going.
  - `sim.hold` freezes Eve and the jet.
  - `api.zone` and `api.setZone` read and set the zone; `api.debug` holds `npcs`, `jet`, `world`, `bodies`, `allen` and `thragg`.

## Not done / next ideas

1. **Combat.** Done after this handoff was first written: `fight.js` (tested) and `flaxans.js`. The Flaxans come through a portal over the river, started by Cecil (E at the GDA) or on their own four minutes in. Punch with J, F, a click or pad X (a lunge carries him to one a little way off), or ram one at speed. Their bolts knock him about. Next could be bosses in the open world (Omni-Man sparring, Thragg in space), which *Think, Mark!* has rules for.
2. **Phones.** The low tier draws about 1.2–1.4M triangles in town, the 'small' counts already applied. Phone frame rate hasn't been measured on hardware. Levers, if it's slow:
   - fewer suburb trees and houses drawn far off (a distance cull on the instanced meshes);
   - the land disc's ring step;
   - traffic counts (`scene.js`, `createTraffic`).
3. **Interiors.** No interiors yet. The Graysons' house, the GDA's operations floor and Burger Mart's counter would follow the C-137 and Office patterns.
4. **Online ghosts.** These aren't wired up. `middleearth/towns/useTravellers` in a room of its own, as Avengers HQ does it, would show other players flying about.
5. **Polish seen in QA and left as is:**
   - house and yard trees are low-poly blobs;
   - the HDRI's own clouds still show faintly in the darkening sky above about 7 km;
   - the jet's livery hasn't been seen up close.

## Where things are

Everything is in `src/components/invincible/world/`. The page mounts it in `src/pages/Invincible.jsx`. The achievements are in `src/components/Achievements.jsx`: `soundbarrier`, `dadsrings`, `titlecards`, `rescue`, `mimic`, `karman`, `moonwalk`, `redplanet`. The guide entries are in `src/components/Guide.jsx` under `/invincible`.
