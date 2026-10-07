# Handoff: the Star Wars galaxy, in phases (6 October 2026)

For a session on either account, with no history. The spec is
`docs/superpowers/specs/2026-10-06-galaxy-phases-design.md`. It holds the
owner's ask, the Wookieepedia facts, the lanes other sessions hold and the
phase list. Phase 1's plan is
`docs/superpowers/plans/2026-10-06-galaxy-phase1-seas.md`. The code is the
truth where this disagrees with it.

## Done: Phase 1, seas (merged)

- `surface/ocean.js` (pure, tested):
  - `SEAS[id]` holds each world's swell, shallows, sea bed, caps, surf and
    wash: Scarif lagoon, Kamino storm, Naboo lake, Kashyyyk surf, and
    Dagobah and Yavin swamp, with a fallback by `water.kind`;
  - `heightAt` is the shader's Gerstner sum, damped by depth;
  - `bakeDepth` gives the depth plus the distance to the waterline (a
    chamfer transform), so the surf is the same width on any slope;
  - `discRings` and `snapCentre`.
- `surface/water.js`: sea and swamp draw on a disc round the camera
  (23.7k vertices on high, 7.7k on small), displaced in the vertex shader.
  An RG depth texture (512² on high, 256² on small) drives the shading:
  - shallows and the bed showing through;
  - the swell standing up in the shallows;
  - breakers 5–28 m out;
  - wash bands running in, lace at the edge;
  - whitecaps from the pinch;
  - swamp scum;
  - the sky by Fresnel, light through the crests, the sun's road.
  Lava and cloud keep the old plane. `createWater(…, { heightAt, small, id
  })` returns `height(x, z, t)` and `depth`, for floating things later.
- `surface/scene.js`: two lines (the `createWater` options and
  `water?.update(t, camera)`).
- Measured in Chromium (Metal), at the shore spot nearest the landing,
  before and after (`scripts/sea-shot.mjs`). Triangles went up about 47k
  on each sea world (the disc). The frame's p50 is unchanged:

  | World | Before calls / tris | After calls / tris |
  | --- | --- | --- |
  | Scarif | 49 / 1,231,474 | 49 / 1,278,512 |
  | Kamino | 53 / 896,596 | 65 / 942,179 |
  | Naboo | 79 / 564,667 | 89 / 610,586 |
  | Kashyyyk | 43 / 745,242 | 56 / 792,293 |
  | Dagobah | 78 / 1,123,018 | 78 / 1,170,056 |
  | Yavin | 34 / 1,109,859 | 47 / 1,156,910 |

  The extra calls on four worlds weren't traced. The sea is one draw, so
  they are likely weather or shadow-pass variance between runs. Check them
  with `galaxy-check.mjs` and the budget file. `lab/baseline/` isn't in
  this checkout, so the gate wasn't run.
- Not done: the final whole-branch review (the owner ran out of usage).
  Read the diff once.

## Done: Phase 1 polish

- `surface/floats.js` (pure, tested): `floatPose` (a boat's height, pitch
  and roll from the water under its bow, stern and sides), `diveAt` (an
  aiwha's glide and its dive through the surface once a cycle), `sprayAt`
  (how much spray a wave throws off a leg).
- `water.js`: spray off `site.water.legs` (Kamino: the pad's column and
  20 stilts), `splash(x, z, k)`, one Points draw; `far`, `farMix` and
  `sky` per sea keep Scarif turquoise to the horizon.
- Kamino's aiwhas dive into the sea and out (`dive` on a life spec),
  splashing each way. The bongo on Lake Paonga rides the swell (`float`
  on a thing). The camera stays 0.6 m over the wave under it.
- Checked in Chromium on SwiftShader (so no frame times): Scarif's far
  water stays turquoise; Kamino's spray pool fills (260 drops on the
  small tier); the bongo rolls; no page errors.

## Phase 2, bases: under way

The plan is `docs/superpowers/plans/2026-10-07-galaxy-phase2-bases.md`.

- Done, Task 1: the scanned roles `tiles` (Poly Haven
  `large_floor_tiles_02`, 1 m slabs) and `deck` (`metal_plate`, a tread
  plate).
- Done, Task 2: `surface/decals.js`, with insignia (Rebel, Imperial,
  Republic) and scorches as flat geometry.
- Done, Task 3: Echo Base's corridors, a zone behind the hangar's
  back-left door. The rooms are in `sites/echoLayout.js` (pure, tested);
  `props/echo.js` draws them:
  - ice walls with steel arches every 4 m;
  - the command centre: the holo-table, the tactical screen under the
    starbird, Rieekan and Toryn Farr;
  - the medical centre's bacta tank;
  - the cavern, with tauntauns.
  Dev: `__surfaceDo('zone', 'echo')`.
- Done, Task 4: the Theed Hangar's blast door to the generator, the
  controllers' room over it, pilasters, a polished floor and four more
  N-1s; the plaza in polished slabs.
- Done, Task 5: Kamino's static discharge towers. Two stand on the pad's
  rim and four out among the domes; lightning strikes them about every
  8–13 s (`surface/storm.js`, pure and tested). The pads' decks are in
  tread plate.
- Done, Task 6: Scarif's Pad 9 has its number painted on, and Yavin's
  hangar has its own floor, `hangarfloor`, laid 0.57 m over the ground,
  just above the temple model's own floor (measured by a ray in the page).
  The bunkers and the temple are models, so a decal on their code builds
  never shows.
- Done, Task 7: the owner said to use Meshy where needed, so the v-150 is a
  Meshy model, `v150`, lifted out of a still of it firing, 33 credits
  (`scripts/meshy-galaxy-buildings-bases.mjs`). It is sunk and tipped
  toward its aim; the built `ioncannon` (`shell: false`) is only its shot.
- Left:
  - spray seen from Kamino's deck;
  - a Citadel vault door;
  - Echo Base's trench lines. The lane file
    (`scripts/meshy-galaxy-buildings-bases.mjs`) takes more kinds.
- Checking, without walking: render from a free camera through the page's
  renderer (`window.__surfaceScene`), offset from a named object. The
  session's `.probe-cam.mjs` did this; `scripts/sea-shot.mjs` is the
  committed one for seas.

## Next, in order (the spec's phases)

1. **Phase 1 polish:** done (see below). Left: a bongo that dives to
   Otoh Gunga, and spray seen from the deck (the pad hides its own column).
2. **Phase 2, bases:**
   - Echo Base: its glacier mouth, its ice corridors with supports, Outpost
     Beta's ion cannon.
   - Scarif: the Citadel, Pad 9, the shield gate, bunkers in the palms.
   - The Great Temple's hangar, Theed's hangar and plaza, Tipoca's deck,
     domes and discharge towers.
   - CC0 PBR sets (Poly Haven, ambientCG) and decals. Sketchfab CC BY first
     (`scripts/sketchfab-surface.mjs`, token in `~/.tilakverse.env`), then
     Meshy from stills (quote the total once).
3. **Phase 3, ground AI:** `surface/ai/`, pure and tested:
   - perception: sight cones, line of sight through the solids, hearing;
   - memory and search;
   - squads with cover from the props' solids, flanking, suppression,
     retreat, reinforcements;
   - civilians' routines;
   - a utility scorer on a per-frame budget.
4. **Phase 4, the living lanes:**
   - read `systems.js`'s `traffic`;
   - add `ROAM_EVENTS`: convoys, distress calls, purrgil, meteors, patrols
     in formation, pirate ambushes;
   - a ship AI (patrol, trade, flee, pursue, escort, dogfight) on
     `galaxy/roam.js`.
5. **Phase 5, named NPCs:** Lando and Fett, then Wedge, Bossk, Hondo, Din
   Djarin and Hera. Each has a ship, lines, a standing and a memory (the
   universe map's `npcs` and `standing`).
6. **Phase 6, open systems and journeys:** `EDGE` from 900 to about 3,000,
   with places to find in each system, and a route finder over `LANES`.

## Lanes held by others (check before touching)

- `claude/galaxy-bugs`'s session: hull solids, the Death Star II, bloom
  and chromatic aberration, ship textures and scale, weapons for every
  crew on surfaces.
- `claude/sharp-carson-h9c6mp` (PR #383): foliage, the F-plan
  (`2026-10-06-foliage-landscape-design.md`).
- #410: fleet war capitals. #371: WebGPU worlds.

## Checking it

- Shots and counts:
  `OUT=<dir> TAG=after node scripts/sea-shot.mjs scarif,kamino,naboo`.
  It starts Vite in-process (no HMR) and the cached Chromium with
  `--use-angle=metal`, teleports to the shore nearest the landing, shoots,
  and prints the calls, the triangles and the p50. `ROOT=<other checkout>`
  shoots a before.
- Tests: `npx vitest run src/components/galaxy`. Long sims elsewhere time
  out when the machine is loaded; rerun them alone.
- Wookieepedia: WebFetch gets 402. Use the MediaWiki API with curl
  (`https://starwars.fandom.com/api.php?action=parse&page=<Page>&prop=wikitext&format=json`),
  as `scripts/galaxy-refs.mjs` does.
