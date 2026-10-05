# The shipyard, the wardrobe and the quality pass: design

Date: 2026-10-05. Status: approved in conversation; this is the written spec.

## Intent

What the user said: "I want you to make it so we can customize our Rick and
Morty and characters, and the models are higher quality and really good
along with the ship design like how No Man's Sky has modular stuff. Look
online for other repos that do this kind of stuff and mods that can help it."

Decisions (asked and answered, 2026-10-05):

- Ships: **a shipyard, for any crew.** A new hull, the garage build, put
  together from modules (cockpit, hull, wings, engines, tail, extras) that
  snap onto each other by sockets. Any crew can fly it in place of their
  stock ship. A seeded Roll button picks a whole ship, the way No Man's Sky
  picks one; any slot can also be picked by hand. The hangar's paint and
  parts still apply, and other pilots see the build.
- Characters: **variant, colours and gear.** Rick and Morty each wear any of
  the rigged variants the site already has, recoloured, with gear on their
  bones (hats, glasses, an eyepatch, a portal gun). It applies wherever they
  appear, and goes online.
- Quality: **"whatever looks the best. Quality over quantity."** Fewer parts,
  each finished properly, before more of them.
- Workflow: **build and merge on our own.** Each sub-project is its own PR,
  merged to main once lint, the tests and the build are clean.

Constraint found while exploring: this container's network policy refuses
`api.meshy.ai` and `api.sketchfab.com` (only GitHub and npm get out), so no
new model can be generated or downloaded from here. Everything below is
built in code or from the models already in the repo. The HD Meshy presets
(part 3) are written ready, for a session that can reach Meshy.

## What already exists

- The hangar (`universe/outfit.js`, `Hangar.jsx`): paint and stat parts per
  ship, bolted on at each ship's hardpoints (`universe/modules.js` MOUNTS),
  kept in `tp-universe-loadout`, sent online as ids only (`online/protocol.js`
  `hi`: `k`, `p`, `o`).
- The ships (`universe/shipModels.js` `buildShip(kind, T)`): built in code,
  then a model mounted over the stand-in. Rick's cruiser is the Meshy saucer
  with Rick and Morty seated (`rickmorty/cruiser3d.js`).
- The crews (`universe/crews.js`): the ship's id is the crew's id
  (`cruiser`, `xwing`, `falcon`, `rv`), kept in `tp-universe-ship`.
- The cast (`rickmorty/portal/meshyCast.js` `createMeshyCast`): Meshy GLBs,
  toon-shaded, skinned on one shared 24-bone skeleton (Hips … Head,
  LeftHand, RightHand …), clips loaded per figure, `make(kind)` clones one.
  Rigged Rick and Morty variants in `public/games/meshy/`: rick, tinyrick,
  cowboyrick, factoryrick, constructionrick, sweaterrick, suitrick,
  detectiverick, councilrick-a/b/c; morty, evilmorty, copmorty.
  `shirted()` already swaps Morty's yellow for another colour in the shader.
- Where Rick and Morty are drawn: the C-137 world (`rickmorty/world/scene.js`,
  Morty is the player), the Citadel (`rickmorty/citadel/people.js`, Rick is
  the player), the cruiser's seats (`cruiser3d.js`), the universe's crews on
  foot (`universe/footScene.js` PARTY), the galaxy's surfaces and peers
  (`loadPartyFigure`), the cockpit (`cockpit/vehicles/cruiser.js`).

## What the research turned up

Reported in full by the research pass; what the design takes from it:

- **No Man's Sky's descriptors** (STEP wiki DESCRIPTOR files; NMSDK proc-gen
  docs): a ship is a tree of slot pools; each pool keeps one child, by
  weighted chance from a seed, and the pick recurses into the child's own
  pools. Part ids read class + slot + variant (`FIGHT_WINGA`). The 2025
  Corvette builder snaps parts at connectors and paints the whole ship from
  one palette. The garage build is this: slots, a seeded weighted pick, and
  sockets.
- **a1studmuffin/SpaceshipGenerator** (MIT): seeded extrusion of a box into
  a hull, details placed by face normal (engines aft, antennas up), mirrored,
  bevelled. Its idea of placing detail by the hull's own faces is used for
  greebles; the hulls themselves are lofted (hulls.js `loft`), which reads
  better at the chase camera's size.
- **M3-org/CharacterStudio** (MIT): traits as separate meshes on one shared
  skeleton, colour pickers, a manifest of traits. The wardrobe's shape: a
  manifest of bodies, colour regions and gear, all on the one Meshy skeleton.
- **Toon quality**: an inverted-hull ink line needs smoothed normals, or it
  cracks where a mesh's normals split at its UV seams; rim light through
  `onBeforeCompile`; two or three bands of light.
- **CC0 kits** (Kenney Space Kit, Quaternius spaceships, majadroid's CC0
  ship components) and CC-BY Sketchfab Rick and Morty models were found, but
  their hosts are blocked here; noted in the spec's last section as the way
  to go further.

## Part 1: the quality pass (first, because everything after shows it)

The Meshy cast and the cruiser are inked by `inkHull` (cruiser3d.js) and in
other places by their own copies. Meshy meshes are split at every UV seam,
so pushing back faces out along the mesh's own normals opens gaps in the ink
wherever two pieces of the atlas meet.

- `src/lib/three/ink.js` (new): `smoothNormals(geometry)` welds positions
  (quantised to 1e-4 of the mesh's size) and averages the face normals at
  each welded point into an `inkNormal` attribute; `inkHull(root, width,
  { clipY })` is cruiser3d.js's, moved here, pushing along `inkNormal` when
  there is one. Pure geometry, tested in Node (a split cube's ink normals
  agree at its corners).
- `rimToon(material, { color, power, strength })` in the same file: a rim
  term added to MeshToonMaterial through `onBeforeCompile`, with its own
  program cache key.
- The Meshy cast (`meshyCast.js` `paint`) gets smoothed ink normals and a
  soft rim; the cruiser, the C-137 world and the Citadel take the shared
  `inkHull`. Textures get anisotropy 8.
- Check: screenshots before and after of Morty, Rick and the cruiser close
  up (Playwright, Chromium in the container), no gaps in the ink.

## Part 2: the shipyard (the garage build)

### Data (pure, tested): `src/components/universe/shipyard/`

- `parts.js`: the modules, by slot. A module is `{ id, slot, name, blurb,
  mass, power, does: { boost, accel, cruise, agility, level, plant },
  weight (for the roll), sockets }`. Slots, in build order: `hull`,
  `cockpit`, `wings`, `engines`, `tail`, `extras`. The hull is the root and
  carries the sockets every other slot snaps to (`cockpit`, `wing` (one
  side, mirrored), `engine` (one or more), `tail`, `top`), each a position
  and a turn in the build's frame (BUILT units, nose −z). Wings carry a
  `tip` socket of their own, which extras such as wingtip lights use, so the
  pick recurses as No Man's Sky's does.
  Quality over quantity: four hulls (Dart, Saucer, Hauler, Needle), three
  cockpits (Bubble, Canopy, Visor), four wing sets (Swept, Delta, Twin-boom,
  Stub), three engine sets (Twin cans, Ring drive, Quad), three tails (Fin,
  Twin fins, None), three extras (Antenna, Radar dish, Running lights). Each
  hull also names its plant (MW) for the hangar's parts.
- `build.js`: a build is `{ hull, cockpit, wings, engines, tail, extras,
  seed }` of ids. `readBuild(raw)` (anything unknown becomes the slot's
  first), `rollBuild(seed)` (a seeded weighted pick per slot, mulberry32, a
  pick a hull rules out skipped), `statsOfBuild(build)` (the multipliers the
  build gives the ship as it comes, and its plant), `writeBuild` /
  `readBuildWire` (an array of ids, for the wire), `buildCode` /
  `parseBuildCode` (a short code to share a build: base-36 indices).
- Tests: every id round-trips; `rollBuild` is deterministic per seed and
  covers every part over 500 seeds; unknown ids fall back; codes round-trip.

### Geometry: `src/components/universe/shipyard/modules3d.js`

- Each module is built in code in its own frame, the way hulls.js builds the
  X-wing and the Falcon: lofted sections (`loft`), turned profiles
  (`turned`), bevelled plates, the panel maps hulls.js makes (`panelMaps`,
  exported), merged by material, so a whole build is a handful of draws.
- `assemble(build)` puts each module on its socket (`socket.matrix ×
  plug⁻¹`), mirrors the paired ones, and returns `{ group, stand, glow,
  engines (where the exhaust leaves), mounts (MOUNTS for modules.js, read off
  the hull's sockets), nose }`, the same face as shipModels.js's built ships,
  so livery.js paints it and modules.js bolts the hangar's parts on.
- Glass canopies as in cruiser3d.js's dome; engine glow as shipModels.js's.

### Flying it

- `shipModels.js` `buildShip(kind, T, { build })`: with a build, the garage
  build is the ship (no model mounted over it); `ENGINES` come from the
  build. `modules.js` takes the build's MOUNTS.
- `outfit.js` `statsOf(kind, loadout, build)`: a build's multipliers under
  the parts', and its plant in place of `PLANT[kind]`.
- The hull choice is per crew: `tp-universe-hull` keeps `{ crewId: 'stock'
  | build }`. The crew's cockpit view, lines and on-foot party stay theirs.
- Universe scene: `setBuild(build | null)` rebuilds the ship as setShip
  does. Galaxy scene: the same build. Online: `hi` carries `b` (the build's
  wire array), read by `readBuildWire`; `pilots.js` builds others' ships
  with it.

### The shipyard panel

- A **Shipyard** tab in the hangar (Hangar.jsx), first in the row: a Stock /
  Garage build switch, then a row per slot with its modules (name, what it
  does, mass and power), Roll (a new seed), a Code field to copy or paste a
  build. Every change is on the ship at once, as the hangar's are (the map
  stays flyable behind it), and the chase camera already shows it.
- Every module is open from the start except three earned ones, each with
  an achievement already on the site (Ring drive: `showmewhatyougot`;
  Saucer hull: `offthegrid`; Radar dish: `trench`), shown locked with the
  hint, as the hangar's parts are.

## Part 3: the wardrobe (Rick and Morty)

### Data (pure, tested): `src/components/rickmorty/wardrobe/looks.js`

- `WHO = ['rick', 'morty']`. For each: `bodies` (the rigged variants above,
  each `{ id, name, asset, h, regions }`), the colour `regions` that body
  can take (Rick: coat, shirt, trousers, hair; Morty: shirt, trousers, hair,
  shoes; a variant lists only the regions its texture has), `SWATCHES` (16
  named colours from the show, ids only: lab white, portal green, Morty
  yellow, Meeseeks blue, plumbus pink, Squanchy orange, Council grey…), and
  `GEAR` by slot (head: cowboy hat, party hat, beanie, top hat, crown,
  headphones; face: sunglasses, goggles, eyepatch; hand: portal gun,
  plumbus, laser pistol).
- A look is `{ body, colors: { region: swatch id }, gear: { head, face,
  hand } }`. `readLook(who, raw)`, `writeLook` / `readLookWire` (ids only,
  as the hangar's), `LOOK_KEY = 'tp-wardrobe'` (`{ rick: look, morty:
  look }`), `defaultLook(who)`. Tests: round trips, unknown ids fall back,
  a region a body doesn't have is dropped.

### Putting it on: `src/components/rickmorty/wardrobe/dress.js`

- **Zones from the skeleton**: each vertex's strongest bone (JOINTS_0 /
  WEIGHTS_0) gives it a zone: head (neck, Head, head_end, headfront), torso
  and arms, legs (UpLeg, Leg), feet (Foot, ToeBase). Written once per
  geometry as a `zone` attribute.
- **Regions by colour within a zone**: the shader keeps `shirted()`'s idea,
  generalised: each region is a zone set and a colour key (hue window,
  saturation and value ranges), so Rick's light-blue hair (head) and
  light-blue shirt (torso) are told apart. The swatch replaces the colour at
  the texel's own brightness, as `shirted()` does. Keys are per body, tuned
  by screenshot.
- **Gear on bones**: code-built pieces (toon, inked, smooth), parented to
  the bone (`Head` for head and face gear, `RightHand` for hand gear), sized
  by the figure's height, with an offset per body (a cowboy's hat sits on
  his hat). Built in `wardrobe/gear.js`, one merged mesh per piece.
- `dressFigure(figure, look)` on a figure from `createMeshyCast().make()`;
  `bodyAsset(look)` says which asset to make. One call wherever Rick or
  Morty are made: the C-137 world's Morty, the Citadel's Rick, the cruiser's
  seats, the universe's crew on foot and the galaxy's.

### The wardrobe panel

- `Wardrobe.jsx`: Rick | Morty, then Body, Colours (a swatch row per
  region), Gear (per slot), Reset. A turntable preview of its own on a small
  canvas (the cast's toon look, drag to turn), so it reads well anywhere.
- Opened from the C-137 world's HUD (a Wardrobe button and `C`), the
  Citadel's HUD, and the hangar when the crew is Rick and Morty (a Crew
  button). Kept in `tp-wardrobe`.
- Online: `hi` carries `l` (each of the two looks' wire arrays), read by
  `readLookWire`; the crews on foot and in the cruiser's seats of others
  wear theirs.

## Error handling

- Anything read from storage or the wire goes through the readers: an id
  that isn't in the tables is the slot's default. No colour or shape ever
  comes off the wire, only ids.
- A model that doesn't load keeps its stand-in, as today; gear on a
  stand-in is skipped.
- A shader that won't compile is the toon material without the region swap.

## Testing

- Vitest for every pure module (parts, build, looks, ink normals, zones from
  a hand-made skinned geometry).
- `npm run lint`, `npm test`, `npm run build` clean before every merge.
- Screenshots in Chromium (Playwright) of the hangar's shipyard tab with
  three rolled builds, the wardrobe preview with three looks, and Morty in
  the C-137 world dressed, looked at before each merge.

## Order of work (each a PR, merged)

1. This spec and the plan.
2. The quality pass (ink and rim).
3. The shipyard: data and tests, then modules, assembly and flying, then
   the hangar tab and online.
4. The wardrobe: data and tests, then zones, regions and gear, then the
   panel, then putting it on everywhere and online.
5. HD Meshy presets in `scripts/meshy.mjs` (an `hd` set: Rick, Morty and the
   saucer at about 40k faces and 2k textures), ready to run where
   `api.meshy.ai` is reachable.

## Further, once the network allows

- Allow `api.meshy.ai` and `api.sketchfab.com` in the environment's network
  settings, then run the `hd` set, and fetch the CC-BY portal gun and Morty
  (sean4297) to compare against the code-built gear.
- CC0 ship kits (Kenney Space Kit, majadroid's components) as more modules,
  each given sockets.
