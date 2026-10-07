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

## Part 2 (2026-10-07): seen, alive, with a story

The owner's ask: the world “is hard to see, has bugs, and nothing to do and needs better NPC AI, missions, everything”, with better, cohesive models (Meshy, the PC's gen3d runner, or Sketchfab). Spec: `docs/superpowers/specs/2026-10-07-invincible-world-2-design.md`. Plan: `docs/superpowers/plans/2026-10-07-invincible-world-2.md`, eleven tasks, one pull request each. Shots from the sweep that started it are described in the spec's first section. On 2026-10-07 the egress proxy allowed `api.meshy.ai` and `api.sketchfab.com`, and `MESHY_API_KEY` and `SKETCHFAB_API_TOKEN` were in the environment.

### The cast (Task 4), 2026-10-07

The owner asked for the models to be made from the show's own art on the Invincible wiki (amazon-invincible.fandom.com). `scripts/meshy-invincible.mjs` gained a `refs` step: each figure names its wiki file (`ref`), which is downloaded into `lab/meshy/invincible/ref/` (git-ignored, so the studio's pictures are never committed) and sent to Meshy's image-to-3D. Only the models are shipped.

- Made from the wiki's art and rigged on Meshy's humanoid skeleton: Mark (remade), Omni-Man, Thragg, Atom Eve, Cecil, Debbie, Allen, a Mauler and Doc Seismic, about 16.5 k triangles each with a 2 K atlas. The Sketchfab Omni-Man and Thragg are gone, and with them two other artists' looks.
- Made from words in the spec's `STYLE` line: three townspeople (`civA`, `civB`, `civC`) and three props (`bank`, `heli`, `truck`).
- Two Meshy accounts: `MESHY_API_KEY` and `MESHY_API_KEY_ACC_2`; `MESHY_ACCOUNT=2` sends new tasks to the second, and each task entry keeps its `acct`, since a task can only be read with its own account.
- Credits: 160 on account 1 (eight models at 15, eight rigs at 5; 7 left), and on account 2: 45 for Mark, Thragg and Cecil remade and rigged, 18 for six concept images, then the six models and three rigs. Account 2's balance fell by more than this session spent while it ran, so something else may share it.
- Judged on `docs/gen3d/invincible/cast-sheet.webp` (`node scripts/inv-cast-sheet.mjs`, with `npx vite --port 5188` running): one look, one saturation, the heights in the spec's ratios.
- Wrong twice on Meshy, so sent to the PC's runner: Thragg (his skin came out light, even with a texture prompt; #441) and Cecil (a pale, blank face; #442). Their second Meshy versions stand in until the runner's pull requests come; those models will need rigging on Meshy from their GLBs (`/v1/rigging` takes a model URL).
- Known: Mark's back has a yellow smear where Meshy guessed the unseen side (the old model had it too); the wiki has no back view to fix it from.
- Wired: `people.js`'s `personFor(kind, seed, template)` gives the world's people the HD figure when there is one that can be posed (the bones a pose needs are checked) and the kit's person otherwise; `loadCast(names)` loads the templates, a missing file giving the kit's person. Eve, Debbie, Cecil and Allen in space are now the HD figures; Omni-Man and Thragg are the new models. `cast.test.js` checks every `CAST` file, height and credit.

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
