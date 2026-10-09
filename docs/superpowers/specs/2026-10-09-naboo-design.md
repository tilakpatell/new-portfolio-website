# Naboo, made whole: the lakes, Theed, the Gungans and the battle for the plains

Date: 2026-10-09. Written from a read of `origin/main` at `4e03ea67` (the
Naboo site, the surface engine, the ground war, the combat lanes, the
foliage and asset research) for the owner's ask, below. Built in the steps
`docs/superpowers/plans/2026-10-09-naboo.md` lists.

## What the owner asked for

“Architect the Naboo to be tremendously better and make it way, way, way,
way better, from features to visuals to everything, games, models,
textures, physics. Use all the research and stuff we have to help you.”

Done looks like this. You come down on the Great Grass Plains and the land
is Naboo's: a meadow of wind and flowers to the hills, cypresses in rows
along the Lake Country's shore, umbrella planes over the road to Theed,
holm oaks on the cliff, and out past the swamp the Gungans' great rooted
trees with reeds and lily pads at their feet. Theed stands on its cliff
over a gorge the river has cut, and the falls go over the edge in sheets
you can hear from the plain. The lake holds the sky, and Theed's domes,
and under it the amber bubbles of Otoh Gunga. There are things to do that
only Naboo has: take an N-1 up out of the hangar and run the gorge; take a
bongo down through the lake, into Otoh Gunga, and out through the planet's
core with something bigger behind you; walk the hangar's blast doors
through to the generator complex and meet a Sith with a double blade
between the laser gates; stand with the Gungan Grand Army behind its
shield while the droid army comes over the hill, and throw boomas at it;
and, from orbit, fly the N-1 into the droid control ship and finish the
battle for everyone on the ground. Every one of them is a game with rules
in a tested file, a mission on the system's briefing, and an ending.

## Assumptions (the owner was not here to ask)

1. “The Naboo” is the planet surface at `/galaxy/naboo/surface`
   (`src/components/galaxy/surface/`, site `naboo`), and the system's
   advertised space mission (“Into the Droid Control Ship”, `systems.js`,
   status `soon` today). The orbit view's blockade and the galaxy map are
   not changed beyond that mission.
2. The standing rules hold: no sequel trilogy; no runtime calls to asset
   services; the site's own words, short famous lines at most; rules in
   pure tested modules apart from the drawing; one art a world (the
   surface's scans and built props, `art-mix` stays at 7); the budgets in
   `docs/health/budgets.json` and `src/lib/budgets.js`; British spelling
   and curly quotes; files under 800 lines.
3. New models from a text or a picture are the owner's desktop's
   (`.claude/skills/desktop-jobs`): a cloud session asks and a model lands
   in a later pull request. So every new thing here is built in code
   first, as the worlds' other props and figures are, and the asks are
   filed for the versions that replace them. Nothing in this design waits
   on a model.
4. Rapier stays off the surface. The surface's movement is `walker.js`
   (walk, ride, solids, floors, water), tested and shared by every world
   and the Rick and Morty planets through `siteFrom`. Adding a second
   physics world for one planet's rides would give Naboo two movement
   models and the rest of the galaxy none of the new one; the dive and the
   flight below are `walker.js` modes, the boomas fly on the detonator's
   lob, and the droids fall as the ground war's ragdolls. The research's
   Rapier recipe (`docs/research/2026-10-08-folio-2025-physics-terrain-streaming.md`)
   remains the universe landings' and the Expanse's.
5. The foliage design's Naboo section (`docs/superpowers/specs/2026-10-06-foliage-landscape-design.md`,
   “Naboo (TPM, AOTC)”, checkpoint F11) is the owner's standing decision
   on what grows here, down to the colours. This design carries it out
   rather than replacing it, and takes its draw ledger (≈ 315 calls,
   ≈ 0.69 M triangles at high) as the target.

## What is there today (the evidence)

- `sites/core.js:24-350` is the site: a swell-and-hills plain, Theed's
  plateau an `island` layer at (−330, 300), the lake a negative island at
  (100, 330), eight places (the palace, the falls, the hangar, Lake Paonga,
  Varykino, the sacred place, the Gungan shield, the droid army), thirty-odd
  life entries, two kaadu rides, three flyovers. The water is one sea at
  level 0. The quests are `sites/quests.js:86-94`'s two: hold the line
  (twelve droids) and the kaadu race to the falls.
- `props/core.js` (1,893 lines, over the 1,500 ceiling) holds Naboo's
  builders: `theed`, `theedpalace`, `waterfall` (a scrolling streak sheet
  with four pulsing mist lumps), `n1fighter`, `royalship`, `hangar`,
  `plaza`, `boomas`, `stonehead`, `ruins`, `grove`, `shield`, `mtt`, `aat`,
  `droideka`, `bongo`, `otohgunga`, `varykino`, `shaak`, `nabootree`.
  The buildings audit's Naboo tweaks were applied on 2026-10-08 (the
  hangar's arch, the bubbles' amber, the plaza's statues); its one open
  item is the `theed` hall model, a baroque townhouse standing in for ten
  of thirteen placements.
- The screenshot (`docs/readme/surface-naboo.webp`): a flat green, five-lobe
  blob trees, the shield a bare bubble, nothing on the horizon. It reads as
  a lawn.
- No zones (nothing to go into), no `sound`, no `music`, no `look`, no
  mission, no assault map (`missions/assaults.js` has eight worlds; Naboo
  is not one), the space mission `soon`.
- The engine has, unused by Naboo: the ground war (`surface/ground/`:
  turf, population by 48 m cells, squads, bolts, a director, ragdolls);
  duellist spawns (`activity.js`: `blade`, `guard`, `parry`, `force`);
  flying rides (`walker.js:402`, the airspeeder); quest steps `race`,
  `use`, `enter`, `trip` with `floor`/`solid` tags switched `off`; the
  zone pattern (`sites/desert.js:371`); `lib/three/foliage.js` (wrap
  lighting, spherified normals, wind); the leaf card (`kit.js:107`);
  `lib/three/tracks.js` (grass flattened under wheels, nothing on the
  surface feeds it); `lib/three/river.js` (shallows, no world imports it);
  the detonator's lob (`scene.js:1980`); `actors.js`'s `dive` (an aiwha's
  glide into the sea).

## Approaches considered

1. **Polish what is there.** Apply the audit's leftovers, swap the blob
   trees for the kit's low-poly ones, add a quest or two. Cheapest, and it
   leaves Naboo a lawn with better trees: the owner asked for “way, way,
   way better”, and the kit's toy trees are forbidden near the galaxy's
   photo-real buildings by `catalog/quaternius.js`'s own rule.
2. **A Naboo world of its own** (`src/components/naboo/`, as the Death
   Star's inside or Middle-earth's towns): its own scene, its own physics
   (Rapier), its own look. The most freedom, and the most code: every
   system the surface already has (the ground war, the quests, the heroes,
   the HUD, the party, the online peers) would be rebuilt or reached across
   an island boundary the rules forbid.
3. **Naboo as the surface engine's showpiece** (chosen). Keep the site data
   model, add to the engine only what Naboo needs and other worlds can use
   next (a dive ride, a local pool, timed solids, a bolt-stopping shield, a
   shutdown ending), and build Naboo's own content on top: five tree
   species from the foliage design, a river and a gorge, three interiors,
   five games, the space mission, built figures for everyone new, and the
   model asks. Every engine addition is small, pure where it can be, and
   tested; every piece of content is data in `sites/naboo.js`.

## Goals

- Naboo reads as Naboo from the landing: the meadow, the trees, the lake,
  the falls, Theed on its cliff, the shield on the plain, the swamp.
- Five games only Naboo has, each with a tested rule set, an ending card, a
  briefing line, an achievement: the generator duel, the core run, the
  battle for the plains, the falls run, the control ship.
- Three places to go into: the throne room, the generator complex, Otoh
  Gunga.
- Everyone new is a figure (built now, a model asked for), and no existing
  quest or line is lost.
- Within budget on every tier, and a phone can play all of it.

## Non-goals

- A time-of-day system, planar reflections, screen-space reflections,
  chunked terrain, Rapier on the surface, instanced skinning for the droid
  army: each a design of its own.
- A remade `theed` hall model: blocked on a reference the audit could not
  find. The spec drops the `rotunda` style from the model so the built drum
  shows, and no more.
- The other worlds' content. Engine changes land for all, content for
  Naboo.
- Voice lines: the new people's lines go into `voicelines.js` so the
  desktop can record them later; nothing here plays an unrecorded voice.

## 1. The files

Naboo moves out of the core group first, as a repair that changes no
pixel (`docs/health/RULES.md`, “A repair changes no pixel”):

```
sites/core.js            →  sites/core.js       (Kamino, Geonosis)
                            sites/naboo.js      (SITE, as coruscant.js and yavin.js)
props/core.js            →  props/core/index.js (a barrel, the same names)
                            props/core/naboo.js (the Naboo builders listed above)
                            props/core/coruscant.js, kamino.js, geonosis.js (the rest)
```

Then the new files, each under 800 lines:

| File | What |
|---|---|
| `sites/naboo.js` | the whole site: places, things, scatter, life, rides, zones, quests, sound |
| `props/core/naboo.js` | the builders above, the falls rebuilt, `pool`, `reeds`, `lilypads`, `lasergate`, `bubble`, `opee`, `sando`, `catapult`, `theedarcade`, `theedstreet` |
| `props/insideNaboo.js` | `throneinside`, `generatorinside`, `otohinside` (`BOUNDS` as `insideCore.js`) |
| `flora/trees.js` | `cypress`, `plane`, `holmoak`, `gungan`, `beech` (the foliage design's §3 Naboo, built on `lib/three/foliage.js` and the leaf card) |
| `flora/trees.test.js` | each species' bounds, trunk solid, part count, no NaN |
| `missions/assaultsNaboo.js` | the battle for the plains' map, merged into `ASSAULTS` |
| `missions/corerun.js` | the core run's pure rules (the chase of the creatures, the sando's cue) |
| `galaxy/warpieces/lucrehulk.js` | the run into a Lucrehulk, on `run.js` |
| `rides.js` | `bongo`, `n1`, the kaadu's leap |
| `walker.js` | `dive`, `leap` |
| `sounds.js` | `falls` sources, the underwater filter, the `gungan` and `theed` tunes |
| `water.js` | the lake's probe (an env cubemap drawn once) |
| `figures.js` | `nabooguard`, `amidala`, `maul`, `bossnass` |
| `abilityRules.js` | `booma` |
| `missions/assault.js` | `shield` (a side's bubble that stops bolts), `shutdown` (the ending) |

## 2. The land and the water

### 2.1 The lie of the land

The layers stay (the plain, Theed's plateau, the lake, Padmé's island, the
swamp, the mountains) with these changes:

- **The river and the gorge.** A `channels` layer from the plateau's east
  edge at (−130, 300) east-south-east to the lake at (60, 330): depth 22 m,
  width 36 m, so Theed's cliff is a gorge wall and the falls land in a pool
  of their own at the foot, 22 m under the plain, which drains to the lake.
  The plateau's `island` gets `ragged: 0.06` so the cliff is a cliff.
- **The Lake Country's shore** is shaped for the road and the cypress
  rows: a `level` flat along the north shore from (200, 280) to (380, 320)
  at height 1.5 m, 24 m wide.
- **The swamp** deepens to −2.5 m at its middle so the reeds stand in
  water and the sacred place's flat stays dry.
- **Wind** 0.5 (the foliage design's number).

### 2.2 Water

- The sea stays at level 0 (the lake, the swamp's standing water, the
  river's foot) with `ocean.js`'s Naboo swell, its colours the foliage
  design's: lake `#2c3d3e` deep `#172526`, `clarity 5`, `caps 0`.
- **`pool`**, a new prop: a disc of still water at its own level (the
  falls' pool at −22 m is above nothing the sea reaches), the ocean's
  Fresnel-to-sky and sun glint, a slow ring ripple from its middle, and a
  foam ring where the falls land, drawn by a flat shader plane. Colours
  `#79A7B0` / `#517C79`. Two at the falls' foot (r 26, r 18).
- **The lake's probe** (high and ultra only): once the world is built and
  warm, a `WebGLCubeRenderTarget` (128 a face) rendered from (100, 2, 330)
  with the sky, the terrain and the hero props (Theed's plateau and its
  domes, the palace, Varykino) and nothing that moves, handed to
  `water.js`'s sea material as `uEnv`, mixed into the Fresnel term where
  today it takes the flat sky colour. The lake then holds Theed. Low and
  mid keep the flat colour. One frame's cost, once, through
  `lib/three/prepareScene`'s slices so it never lands in one frame
  (`docs/research/2026-10-07-frame-hitches.md`).
- **Reeds** and **lily pads**: `reeds` (clumps of bent blade cards with
  seed heads, `#3C5A2E`, the foliage design's reeds) and `lilypads` (flat
  discs 0.4–0.9 m with a notch, one in six a white flower), scattered only
  where the ground is between 1.8 m under and 0.2 m over the water
  (`scatter[].wet: [−1.8, 0.2]`, a new scatter filter beside `flat`): the
  swamp, the lake's north shore, the river's banks.

### 2.3 The falls, rebuilt

The falls are the thing you see from everywhere, so the builder is made
again (`props/core/naboo.js` `waterfall`):

- Three sheets, not one: the main sheet (the old streak texture, two
  octaves scrolling at different rates, alpha thinning toward the edges),
  a slower back sheet darker and wider, and a front sheet of strands
  (vertical quads, 20–30, alpha-cut, scrolling faster) so the fall has
  depth.
- The lip: water bulging over the stone, a `turned` profile with the
  ocean's sun glint.
- The foot: the mist lumps stay but become six, additive, breathing out
  of phase; plus a `spray` weather box (`weather.js`'s `spray` kind, 180
  particles) in a 30 × 16 × 20 m volume at the foot, only when within
  120 m (the placer's `near` throttle).
- The sound: `site.sound.falls: [{ at, r }]` sources: `sounds.js` makes
  one pink-noise roar, its gain `smoothstep(r, r/4, distance)` to the
  nearest source, updated each frame, a low-pass that opens as you near.
  Three sources at the three falls.
- Three falls as today, the middle one 18 m wide, the river's own,
  and the two flanking ones 10 m; `h` is now the gorge's 22 m plus the
  plateau's 39.5 m minus the pool's level, read from the terrain at build
  (`opts.h` left out), so the sheets always reach the water.

### 2.4 The trees and the meadow

Per the foliage design's Naboo table, as `flora/trees.js` builders
registered in `props/index.js`, each `{ object, solids: [trunk circle],
update? }` on `lib/three/foliage.js`'s material (wrap lighting, spherified
normals, the world's wind) with crowns of `kit.js`'s leaf cards and the
design's colours verbatim:

| Species | Form | Where (as `things`, rows by a helper in `sites/naboo.js`) |
|---|---|---|
| `cypress` | 12–20 m, a narrow cone of 7–9 stacked cards, 1:7 | rows along the Lake Country's shore flat, 7 m apart; pairs at Varykino's gate and terrace |
| `plane` | an umbrella crown 14–22 m wide on a pale mottled trunk, 5–7 card clusters | along the road up to Theed, both sides, 24 m apart; singles on the plain |
| `holmoak` | 8–14 m, a dense dark round crown, a short thick trunk | Theed's cliff edge and the plateau's parks |
| `gungan` | 30–50 m, a buttressed trunk with 6–10 rope roots to the ground, moss up the north side, a high thin canopy | the sacred place and the swamp, 10–20 |
| `beech` | 16–24 m, a smooth grey trunk, a broad open crown | the swamp's edges and the wood past the sacred place |

- `nabootree`, `grove` and `scatter.nabootree` are retired from the site
  (the builders stay for any other site until none uses them; `grove` has
  no other caller and goes).
- The meadow: `grass.cover 0.85`, `h [0.4, 0.8]` in the Lake Country and
  `[0.15, 0.3]` on the battle plain by a second cover band (`grass.bands:
  [{ at, r, h }]`, read by `groundPaint.js` and `grass.js`'s `coverAt`),
  the design's base `#405138`, mid `#718332`, tip `#8EA33D`; flowers kept
  at 3% (`grass.flower` is a dead field today: it goes, and the flowers are
  `kit.js`'s flower card as a scatter, `qflower`, from the kit's
  `Flower_1_Group` at the ground only, which the kit rule allows).
- Boulders `#716240` / `#9C8861` in threes to sevens on the Lake Country's
  slopes (`rock` scatter with `cluster: [3, 7]`, a new scatter option that
  places the n in clumps).
- Tracks: `scene.js` makes `lib/three/tracks.js`'s target for a site with
  `grass.tracks: true` and feeds it the rides' contact points (a kaadu's
  two feet, a speeder's one line), so the grass lies down behind the kaadu
  race. Other worlds opt in with the same flag later.

### 2.5 Air and light

The foliage design's: zenith `#79A2C9`, horizon `#cfe4ef`, haze `#8CA5B2`,
fog density 0.00075 (unchanged), a lake mist: `weather` gets a `mist` kind
(a flat box of large slow soft sprites, 80, at the water, within 160 m of
the lake's middle, colour `#dfeaee`, alpha 0.08). `look.shadow` `#2a3a4a`,
`look.edge [0.42, 0.9]`. The sun at az −2.4 el 0.62 stays. Shadows: the
±42 m cascade as today.

## 3. Theed

### 3.1 The city

- **`theed` halls**: the `rotunda` style leaves the model's `styles` so the
  built drum shows; the tint stays. Two new built props fill the plateau
  between them so Theed is a city, not halls on a lawn: `theedarcade` (a
  colonnade with a tiled roof, 24 m, arches as the existing `arch` helper,
  a solid wall behind) along the plaza's sides and the avenue to the
  hangar; `theedstreet` (a 40 m strip of paving with a kerb, lamps at 8 m,
  a planter every 16 m with a `holmoak` sapling) laid as segments from the
  palace to the hangar and the palace to the falls.
- **The plaza** keeps its statues; a `fountain` returns as a separate thing
  at the avenue's end (the film's plaza has none before the palace; the
  avenue's circle has one).
- **Life**: the citizens (6) stay; six more `villager` with `needs` and two
  `wants` (a market stall `kind: 'food'` on the street, a bench by the
  falls); the palace guards become `nabooguard` (a new built figure: a
  blue tunic, a maroon cap, a blaster) and gain two more at the throne
  room's door; `Captain Panaka` becomes a `nabooguard` named.

### 3.2 The throne room (zone `throne`)

- Door at the palace's front steps (`from(PALACE, [0, 44])`, the model's
  façade reaches z 46.8), prompt “Go into the palace”. Inside:
  `throneinside` (`props/insideNaboo.js`): a long hall 36 × 14 × 10 m,
  cream walls and gilt trim, a red carpet, tall windows down one side
  looking onto a painted falls (a glow panel with the streak texture
  scrolling behind frosted glass), the throne on three steps at the end,
  the council's chairs in a crescent. Lamps warm. Rooms: one.
- Life: `amidala` (a new built figure: the red gown, the white face and
  the red dots, the headdress; `still`, named Queen Amidala, lines in the
  site's voice and one famous one), Panaka at her right, Sabé at her left
  (a `villager` in the handmaiden's orange), two `nabooguard`.
- Quest **The throne room** (`palace`, giver Panaka, outside): 1 reach the
  plaza; 2 shoot the droids on the plaza (spawn 8 `battledroid` hp 1, 2
  `droideka` with shields, around (−235, 352)); 3 enter `throne`; 4 talk to
  the Queen. Done: “Now the control ship.” and the achievement
  `theedretaken`.

### 3.3 The hangar and the generator complex (zone `generator`)

- The hangar stays built and walkable. At its back wall a blast door
  (`blastdoor` built into `hangar`'s parts, a glow seam) is the zone's
  door: prompt “Through the blast doors”.
- Inside: `generatorinside`: a hall of catwalks over a pit (bounds
  [40, 30, 24], `fall: −6`, `respawn` at the entry), four walkways 3 m wide
  as `floors` crossing a void, railings, the reactor's columns rising out
  of the dark with red and blue light bands, and down one side the laser
  gate corridor: a 3 m wide walkway with four `lasergate` props across it.
- **`lasergate`**: a prop that owns a solid (`solids: [{ box, tag }]`) and
  a red field (an additive plane, flickering) and a timer: `opts: { period
  4.6, open 1.4, phase }`: the gate is shut for `period − open` seconds and
  open for `open`, offset by `phase`; the four gates' phases are 0, 1.15,
  2.3, 3.45 so they open in sequence from the hangar end, as filmed. While
  shut its solid is on and a bolt or a blade that crosses it is stopped
  (`solids.js`'s bolt raycast reads the same solid); while open the solid
  is off. The timer is a pure rule (`lasergate.js`, `gateState(t, opts) →
  { open, until }`, tested) and the prop sets its solid through the
  placer's `signal` sink each change (the placer already gives built
  things a `signal` channel; the prop calls `world.solids.off(tag, !open)`,
  which `walker.js`'s `createSolids` gains: `off(tag, bool)` sets `off` on
  every solid of the tag, the shape the floors already have).
- The melting pit at the corridor's end: a round room 14 m, a floor with
  a hole (a `floors` disc with `off: false` and a hole 2.4 m wide drawn in
  it; stepping in the hole is the zone's `fall`).
- Quest **Duel of the Fates** (`duel`, giver Panaka, after `palace`):
  1 reach the blast door; 2 enter `generator`; 3 shoot `maulguard` (6
  `battledroid` on the first catwalk); 4 reach the laser corridor; 5 shoot
  `maul` (one `maul` spawn at the corridor's far end, hp 10, `hostile: {
  range 14, chase 2.4, melee: true, reach 2.8, every 1.3, damage 18, delay
  0.8, parry 0.75, guard 4, blade: { color '#ff3b3b', double: true },
  force: { every 9, push: 7 } }`; `blade.double` lights a second blade out
  of the pommel, as the player's `double` stance does, through
  `heldBlade.js`); he retreats through the gates when they open and waits
  behind a shut one, which is the hostile brain's existing `back` tactic
  given a `holdAt` the spawn names (new: a spot it backs to and holds at
  until its guard is whole again; here the gate's far side), so the fight has the
  film's rhythm: fight, gates shut, wait, fight. 6 done: the Sith falls in
  the pit (the `end` effect `say` and `kill`), the achievement `fates`.
  `maul` is a new built figure in `figures.js` (black and red face, horns
  as six small cones, a black hooded robe) and a gen3d ask.
- The mission entry: `missions/index.js` `naboo.duel` (kind `quest`, on
  foot, `stars [240, 360]`, `to: '/galaxy/naboo/surface?mission=duel'`),
  shown on the system's briefing as an `also`.

## 4. The lake and Otoh Gunga

### 4.1 The bongo, a ride that dives

- `rides.js` `bongo: { name: 'the bongo', top 11, boost 11, accel 5, brake
  8, turn 1.1, hover 0, dive: { depth 40, rate 5, surface 0.6 }, bank 0.35,
  radius 3, grip 0.7, seat: [0, 1.0, 3.2], cam: [12, 3.5], hum: 'bongo'
  }` (`boost` equal to `top`: a dive ride spends the boost key on diving). The placed `bongo` thing on Lake Paonga becomes the ride (the site's
  `rides` lists it; the Meshy model stands in as today, its tail turning).
- `walker.js`'s `ride` gains `spec.dive`: the ride's y is kept between
  `water − surface` (its top at the surface, where it floats as today's
  `float` does) and `max(ground + 1.5, water − depth)`; `input.jump` rises
  at `rate`, `input.boost` dives at `rate` (a dive ride reads `boost` as
  down and never as speed), neither holds depth. Under water the
  ride's turn is the spec's and it pitches 0.3 rad into a climb or a dive
  (`s.pitch`, new, which the scene applies). The rider's figure sits
  inside (a `SEATS.bongo` with `hide: true`: the figure is not drawn, the
  canopy is closed).
- **Under water** (the scene, `scene.js`'s ride branch plus one new
  `underwater.js` helper for the look): while the camera is under the
  water level the fog becomes the lake's deep colour at density × 14, the
  post's grade takes a blue-green shade `(0.85, 1.0, 1.05)` and the
  vignette doubles, the sun glint is off, the sea mesh is drawn from below
  (double-sided while under), `weather` switches to `motes` (120, pale,
  drifting up), and `sounds.js` puts a 480 Hz low-pass on the master and
  plays the hum under it. The grass and the far trees are hidden under
  water (they are over it anyway). On low tier the grade and the motes
  are skipped; the fog and the filter stay.
- The lake floor under Paonga gets what a dive shows: `rock` clusters,
  `reeds` in the shallows, kelp (`kelp` scatter: tall card strands with
  the wind as a current), and Otoh Gunga's bubbles seen from below: the
  `otohgunga` builder draws each bubble whole (the spheres already are),
  with the lit interiors, and gains a dock ring at the floor at
  (40, −30, 110).

### 4.2 Otoh Gunga (zone `otoh`)

- The zone's door is reached in the bongo: `door: { at: [40, 110], r: 9,
  ride: 'bongo', prompt: 'Go into Otoh Gunga' }`; `scene.js`'s door check
  takes `ride` as a condition (you must be on that ride kind and within
  r). Coming out puts you back in the bongo at the dock.
- Inside: `otohinside`: a bubble hall (the inside of a sphere 24 m across,
  amber-lit, bronze ribs, the water's caustic drawn on the walls by a
  scrolling noise texture; a floor at its equator), a passage of three
  smaller bubbles, and the council chamber: a round room with Boss Nass's
  throne on a dais and the council on stools. `bossnass` is a new built
  figure (the Gungan body at scale 1.35 with the wide head and the robes;
  the existing Boss Nass life entry moves inside and is this figure). Jar
  Jar stands at the door with his lines. Light: amber lamps, a green-blue
  fog seen through the walls.
- Quest **There's always a bigger fish** (`corerun`): see 4.3.

### 4.3 The core run (mission `corerun`)

A mission of kind `quest` on the `bongo`, `missions/index.js`
`naboo.corerun`, rules in `missions/corerun.js`:

- The route: from Otoh Gunga's dock east under the lake, through a run of
  rock arches on the lake floor (`seaarch` props, 12, solids, a tunnel of
  them along the basin's floor from (60, 150) to (300, 400) with a dog-leg),
  to the surface at the gorge's pool under the falls (the river's channel
  joins the lake, so the route is continuous). Eight race gates (`race`
  step, `ride: 'bongo'`, `r 7`, `time 150`).
- The creatures: at gate 2 an `opee` spawns behind (a built creature: a
  crab-fish, 7 m, a long tongue drawn as a rod when it strikes) with
  `hostile: { chase 2.2, melee: true, reach 4, every 2, damage 14, dive:
  true }`: `activity.js`'s brains move on the ground today; an underwater
  hostile keeps `b.y` at the ride's depth (the `dive` flag on a spawn, read
  by `activity.js` as the actor's `dive` is), so it swims. At gate 5 the
  `sando` cue: `missions/corerun.js`'s `sandoAt(progress, t)` says when the
  sando (a built head and jaws, 30 m, rising out of the dark, no brain) is
  shown, where it rises, and the `kill` of the `opee` tag with the film's
  line; after gate 6 a second `opee` (the colo claw fish is the ask; the
  built one reuses `opee` with `opts.colo`) chases to the surface and the
  sando takes it at gate 8. The mission's `lines` are the crews'; the
  `why` on a loss `caught` (the opee's bite takes the bongo's health: the
  ride has `hp 100`, and a melee hit on a ride hurts the ride, not you:
  `scene.js`'s ride branch routes `hurt` to `state.riding.hp` when the
  spec says `hp`) or `time`.
- `stars [110, 135]`, achievement `biggerfish`.

## 5. The battle for the Great Grass Plains (mission `assault`)

### 5.1 The map (`missions/assaultsNaboo.js`)

- Sides: `GUNGANS = { id: 'gungans', name: 'The Gungan Grand Army', short:
  'Gungans', colour: '#ffb060', kinds: [['gungansoldier', 1]] }` (defend)
  against `SEPARATISTS` (attack) with kinds `[['battledroid', 4],
  ['superdroid', 1], ['droideka', 1]]`. `gungansoldier` is the `gungan`
  figure with a round energy shield on the left arm (a cyan disc, the
  `shield` prop's shader at 1.1 m) and a cesta (a two-pronged staff); its
  weapon is the `booma` (5.3) and its bolt colour `#5ab4ff`. `troops.js`'s
  table gains it (`side: 'gungans'`, hp 100, the booma's damage), and
  `standing.js` already counts the Gungans light.
- Posts, on the plain round the `battle` place (260, −250): the shield's
  heart (the fambaa's generator, 0, 0, r 18), the catapults (the left
  flank, −36, 20, r 16, the `catapult` prop: the film's booma catapult,
  built, three of them), the right flank's boomas (34, 14, r 16), the hill
  behind (−20, −60, r 20), the Gungans' retreat (the swamp's edge, −120,
  −120, r 18, `fixed: 'defend'`), the droids' staging (the ridge, 150,
  −130, r 22, `fixed: 'attack'`).
- Phases: 1 **The shield** (posts: the catapults, the boomas; tickets 90);
  2 **The generator** (the shield's heart; 70); 3 **The hill** (the hill;
  60). `tickets { attack 140, defend 150 }`. `hideLife`: the site's
  `gungan`, `kaadu`, `fambaa` and `battledroid` life while it is fought
  (the battle makes its own).
- `start [250, −200]`, `yaw 0.9`, `stars [420, 600]`, achievement
  `grassplains`.
- Vehicles: three `aat` move as the attackers' guns: `assault.js` gains
  `guns: [{ kind, at, path, every, damage, radius }]`, a gun that drives
  its path at 4 m/s, stops at the shield's edge, and fires a slow shell
  (a `bomb` on the detonator's lob) at the nearest defended post every
  `every` seconds; it is a target with hp 12 and goes still when killed.
  The `mtt` at the staging opens its rack (`signal: 'deploy'`, the
  existing prop gains it: the rack slides out) at each attackers' wave.

### 5.2 The shield rule

`assault.js` gains `shield: { post, r, at }`: while the named post is the
defenders', a bolt that crosses the sphere of radius `r` about `at` from
outside to inside is stopped (the mission hands `lib/combat/bolt.js`'s
`world.solids` a sphere test in front of the terrain's: `shieldHit(a, b,
shield) → { at, normal } | null`, pure, tested), and the AATs' shells
burst on it. Soldiers walk through. When the post falls the sphere is
gone: the `shield` prop's bubble (already a shader) takes `signal('down')`
and collapses over 1.2 s (its `uTime` and a `uDown` uniform). While the
shield holds, the defenders' bolts pass out freely, which is the film's
asymmetry and what makes phase 1 a siege.

### 5.3 The booma

`abilityRules.js` gains `booma: { name: 'Booma', about: 'A Gungan energy
ball, thrown. Droids in its burst stop, and a shield breaks.', cool: 3,
fuse: 0, speed: 14, lift: 5, radius: 4.5, damage: 2, stagger: 3, emp: true
}`. It flies on the detonator's lob (`scene.js`'s `bombs`, which already
take a spec) and bursts on landing (`fuse 0`: the first contact), a blue
burst; droids in the radius (any kind `troops.js` marks `droid: true`)
stagger for `stagger` seconds and lose their shield; anyone else takes
`damage`. In the battle, playing for the Gungans, your `power` slot is the
booma (the mission's `abilities: { defend: { power: 'booma' } }`, read by
`scene.js`'s `myAbility` when a mission names one for your side) and the
Gungan soldiers throw them as their shot (`troops.js`: a kind's `weapon:
'booma'` fires the lob instead of a bolt, the burst's stagger applied
through `fight.js`'s hit path as a `stagger` event). The booma is also the
`gungansoldier`'s weapon outside the battle.

### 5.4 The ending

`assault.js` gains `shutdown` on the map: when the defenders win (the
attackers out of tickets), every attacker standing is `down` at once with
`cause: 'shutdown'`; `assaultScene.js` drops each as a ragdoll where it
stands (the ground war's `fell` with `ragdoll: true`, up to its cap, the
rest on the `die` clip) over a 2 s spread, the AATs go dark, the `mtt`
stops, and the crews' `won` lines say the control ship is gone. When the
attackers win the Gungans kneel (`kneel` clip) and the lines say so. The
briefing (`systems.js`) adds the assault as an `also` with the text in the
site's voice.

### 5.5 The kaadu

- `rides.js` `kaadu` gains `leap: { up: 6.5, cool: 0.9 }`: Space on a
  `leap` ride jumps it (`walker.js`'s ride branch: `s.vy = up` when
  grounded and off cooldown, gravity as the walker's), so the kaadu clears
  the catapults and the rocks as the film's do. The kaadu race's gates
  gain two over low walls.
- Kaadu are rides in the battle too: two at the retreat post.

## 6. The N-1 and the falls run (mission `fallsrun`)

- `rides.js` `n1: { name: 'the N-1', top 48, boost 70, accel 16, brake 14,
  turn 1.3, hover 0, fly: { alt 60, climb 14, floor 0 }, bank 0.75, radius
  3.5, grip 0.9, seat: [0, 1.1, 1.6], cam: [16, 4], hum: 'n1' }`; the one
  N-1 on the hangar's apron is the ride (the `n1fighter` catalogue model,
  the figure hidden inside, `SEATS.n1 { hide: true }`), two engine glows
  that brighten with the throttle (the ride's `update` reads
  `state.speed`).
- `walker.js`'s flyer gains `spec.fly.pitch`: nose up 0.25 rad on climb,
  down 0.3 on descent, eased, and the bank as a spring (`bankSpring`:
  stiffness 9, damping 0.8, the game-feel audit's ask) for every ride.
- Mission `fallsrun` (kind `quest`, `ride: 'n1'`, `start` on the apron):
  a race of ten gates (`r 9`): up off the apron, over Theed's domes, down
  into the gorge under the falls (two gates at −10 m in the gorge, which
  the flyer reaches since `floor 0` is the terrain, and the gorge's floor
  is −22), out over the lake past Varykino and back to the apron;
  `time 95`, `stars [55, 70]`, achievement `fallsrun`. The crews' lines
  say try spinning.
- Above the reach the flyer is turned back as the walker is.

## 7. From orbit: into the droid control ship (mission `controlship`)

- The galaxy's battle at Naboo (`battlesWars.js` `naboo`, the Lucrehulks
  and the vultures) gains a warpiece: `galaxy/warpieces/lucrehulk.js`, on
  `run.js` as the Star Destroyers' hangar runs are, laid in the nearest
  Lucrehulk when the battle begins: the mouth is the ring's inner face
  (the hangar bay), the tunnel runs in through the ring to the core
  sphere, the reactor is a sphere of its own in the core, `escape 9`
  seconds, and the ship breaks up when it blows (the battle's existing
  `kill` of a capital with its debris). `warpieces/index.js` adds it for
  `naboo`.
- Mission `controlship` (`systems.js` `naboo.game`: `status: 'live'`, `to:
  '/galaxy/naboo?mission=controlship'`, `go: 'Fly it now'`): `Galaxy.jsx`
  reads `mission=controlship` as the Hoth and Endor set pieces are read
  (`warfront.js`'s `ctx.mission`), puts you in an N-1 (the ship kind the
  traffic already has) at the hangar's mouth on autopilot for the first
  12 s (the controls locked, the camera chasing, the crawl's line), then
  hands over in the thick of the vultures. The objective is the run; the
  card is the battle's `BattleEnd.jsx` with the mission's name.
- The crews' lines: the existing Naboo lines in `battleCrews/*.js` already
  cover the blockade; the mission adds `start`, the hangar, the reactor,
  `won` and `lost` in `missions`' shape for the four crews.
- Done on the ground: winning the run unlocks the achievement
  `controlship`, kept across visits as every achievement is
  (`src/components/Achievements.jsx`'s `unlock`, its list in `local`
  storage), and while it is unlocked the surface's droid life stands switched off
  (`still`, heads down) for the session, with the farmers' and citizens'
  lines changed by the `when` the talk tree has (`talk.js` gains `done:
  'controlship'` as it has for quests).

## 8. Figures and models

### 8.1 Built now (`figures.js`, `props/core/naboo.js`)

| Kind | What | Where |
|---|---|---|
| `nabooguard` | PEOPLE: blue tunic `#2a4a8a`, maroon cap `#6a2030`, tan trousers, a blaster | the palace, the hangar, the throne room |
| `amidala` | PEOPLE: red gown `#8a1a24` with gold, white face, red dots, a black headdress; `still` | the throne room |
| `maul` | PEOPLE: black robe, red-and-black face, six horn cones; the double blade from `heldBlade.js` | the generator complex |
| `bossnass` | the `gungan` body at 1.35 with a wide head, a green robe `#3a5a3a`, a staff | Otoh Gunga |
| `gungansoldier` | the `gungan` with the arm shield and the cesta | the battle, the shield |
| `opee` | BEASTS: a crab-fish 7 m, six legs folded, a wide mouth, a tongue rod | the core run |
| `sando` | a prop: head, jaws and the first 12 m of body, 30 m, rising | the core run |
| `catapult` | a prop: the Gungans' wooden booma catapult, a booma loaded | the battle |
| `theedarcade`, `theedstreet`, `pool`, `reeds`, `lilypads`, `kelp`, `seaarch`, `lasergate`, `fountain` | props | §2, §3, §4 |

### 8.2 Asked for (the owner's desktop, `node scripts/desktop/ask.mjs gen3d …`)

Filed by the plan's last step, `--dry-run` first, one issue each, a
picture over a prompt where Wookieepedia has one; the model lands in its
own pull request and is wired in a later change (the catalogue row
`made: 'gen3d'`, the built figure kept as the fallback):

| Name | What | Faces | Note |
|---|---|---|---|
| `maul` | Darth Maul, A-pose, no saber | 30000 | rigged by transfer; the blade stays built |
| `amidala` | Queen Amidala in the throne room gown | 30000 | `still` |
| `bossnass` | Boss Nass, robed | 30000 | `still` |
| `gungansoldier` | a Gungan soldier with the arm shield and cesta | 30000 | walks on the Gungan's legs |
| `nabooguard` | a Royal Naboo Security Forces guard | 30000 | |
| `opee` | the opee sea killer | 12000 | |
| `sando` | the sando aqua monster, head and forebody | 12000 | |
| `catapult` | the Gungan booma catapult | 10000 | |
| `theedhall` | a Theed hall from `TheedAttack.png`'s crop | 30000 | the owner's call; the audit's note stands |

The `theed` hall's remake stays the owner's decision; the ask carries the
audit's reference and odds.

## 9. Sound

- `site.sound: { wind 0.35, critters 0.3, ground: 'grass', falls: [...]
  }` (§2.3), the lake's lap as `sea 0.15`.
- `TUNES.gungan`: drums (two voices, a low skin and a high), a reed horn
  calling over them, 92 bpm, 8 bars, played at the sacred place and in
  Otoh Gunga (`zone.music`), and as the battle's defend-side theme at the
  start. `TUNES.theed`: a fanfare (a brass voice over a sustained chord,
  104 bpm, 8 bars) for the throne room and every Naboo mission's won card.
- The bongo's `hum` (a low pulsing drone, 55 Hz, with the speed), the
  N-1's (a high whine with a 2 Hz flutter), the kaadu's honk on a leap.
- The booma's burst (a short blue zap), the laser gate's open and shut
  (a rising and a falling hum), the sando's roar (`sounds.js`'s rancor
  roar an octave down, longer).
- Under water: the 480 Hz low-pass (§4.1).

## 10. HUD and touch

- The dive and the flight need two more buttons on touch: `SurfaceView.jsx`
  shows `Up` (76) and `Down` (64) `TouchButton`s while riding a `dive` or
  `fly` ride, in the right column under the guide's corner, the kit's
  rules (`src/runtime/hud/`). The kaadu's leap is the Jump button.
- The ride's health (the bongo in the core run) is the HUD's health bar
  while riding a ride with `hp`.
- The battle's HUD is `AssaultHud.jsx` as it is; the shield's state is a
  post chip's state (the shield's heart shows a halo while the shield
  holds).
- Prompts, key first, one sentence: “E Go into Otoh Gunga”, “E Through the
  blast doors”, “Space Up · Shift Down” shown once on entering a dive or
  fly ride as a toast.
- Things to do: the quest list gains the three missions' entries as the
  other worlds' do (`things-to-do.json` is research, not read by the
  site).

## 11. Performance and budgets

- At high, from the landing, after: ≤ 1.6 M triangles, ≤ 360 draw calls
  (the baseline is 1.38 M at 79 calls before the ground war; the foliage
  design's ledger for Naboo is ≈ 315 calls / 0.69 M once the lumps go,
  so the species must earn their triangles: each crown ≤ 1,800 triangles
  at LOD0, ≤ 400 at LOD1 past 120 m (the placer's `lod` for built kinds,
  a second cheaper build the species returns as `lod1`), the gungan tree
  ≤ 6,000).
- Mid and low: the scatter counts scale by `amounts.js` as today; the
  probe, the mist, the tracks and the spray are high and ultra only
  (`tier` read from `budget()`); the laser gates' flicker is one uniform.
- The zones are built high over the world and hide the outdoors as the
  others do; the generator complex's void is dark, not deep.
- `WORLD_MB['/galaxy']` stays 8: nothing new is downloaded (every new
  thing is built; the kit's `Flower_1_Group` is already on the site).
- Phones: the dive and the flight at `SMALL`'s amounts; the underwater
  grade off; the battle at `POP.low`.
- Measured before and after with `BUDGET= node scripts/galaxy-check.mjs
  surface naboo` at high and mid, and the numbers in the entries.

## 12. Testing

Pure, beside the file, under a second, no network:

- `sites/naboo.js` through `sites.test.js` and `validity.test.js` as
  every site (places, things placeable, givers dry, assault posts dry, the
  ground war's turfs standable with the new lake and gorge).
- `flora/trees.test.js`: each species builds, bounds within its stated
  height, one trunk solid, triangle count under its cap at LOD0 and LOD1.
- `lasergate.test.js`: `gateState` over a period, the phases in sequence,
  never two adjacent gates open at once at the film's phases.
- `walker.test.js`: `dive` keeps between the surface and the depth, rises
  on jump and dives on boost, never under the ground; `leap` once per
  cooldown and only grounded; `fly.pitch` eases; the bank spring settles.
- `missions/corerun.test.js`: the sando's cue at the gates it names, the
  opee's spawn and kill order, a loss on `caught` at hp 0.
- `missions/assault.test.js` (added cases): the shield stops an outside
  bolt and passes an inside one; a shell bursts on it; the shield's post
  falling removes it; `shutdown` downs every attacker on the defenders'
  win and nobody on the attackers'; a `booma` weapon's hit staggers a
  droid and hurts a soldier; a gun drives its path and stops at the
  shield.
- `abilityRules.test.js`: `booma` in `ABILITIES`, `fuse 0` bursts on
  contact.
- `assaultsNaboo` through `missions/index.test.js`'s map checks (posts on
  dry ground, phases name real posts, tickets positive).
- `warpieces/lucrehulk.test.js`: the run's mouth on the ring's inner face,
  the path inside the hull, the reactor in the core.
- `figures.test.js`: the new kinds build and stand at their height.
- `scripts/ai-e2e`: `ground.scenario.test.js` unchanged; a new
  `naboo.scenario.test.js` under `test:ai` plays the duel's gates and the
  core run's rules end to end on the site data.
- In a browser (`npx vite --port 5188`): `OUT=lab/shots node
  scripts/surface-shot.mjs naboo` at the landing (0,0,30,200), the falls
  from the plain (−60,330,120,110), Theed from the lake (100,330,220,250),
  the sacred place (−320,−230,60,40), the battle plain (260,−250,90,20),
  under the lake (`ZONE` not needed: a `DIVE=1` env the script gains puts
  the bongo 20 m down), each zone with `ZONE=<id>`; before shots on `main`
  first for the split's no-pixel check and for the entries; `galaxy-check`
  surface naboo at high and mid; `?mission=duel`, `corerun`, `assault`,
  `fallsrun` and `/galaxy/naboo?mission=controlship` each played to an
  ending through the dev hooks (`__surfaceDo('teleport' | 'advance')`).

## 13. Order of work

Seven steps, each its own commit series on the branch, each leaving the
site green (`npm run lint`, `npm test`, `npm run build`, `node
scripts/health.mjs --check --skip build`):

1. **The split** (no pixel changes): `sites/naboo.js`, `props/core/`.
2. **The land and the water**: the gorge, the pool, the falls, the species,
   the meadow, the reeds, the probe, the mist, the sounds.
3. **Theed**: the arcades and streets, the figures, the throne room, the
   generator complex, the laser gates, the duel.
4. **The lake**: the dive, the underwater look, Otoh Gunga, the core run.
5. **The battle**: the map, the shield, the booma, the guns, the shutdown,
   the kaadu's leap.
6. **The N-1**: the flight, the falls run, the touch buttons.
7. **Orbit**: the Lucrehulk run, the mission, the ground's reaction; then
   the gen3d asks filed, the briefing and the backlog updated, the entry
   on the changes page.

Steps 3 to 6 are independent of one another once 2 is in; 7 needs 5 for
the ground's reaction.

## 14. Risks

- **The probe on weak GPUs**: a cube render of the terrain costs six
  draws of the world once; sliced through `prepareScene` it is safe, and
  it is skipped under high. If it still hitches, it renders at 64.
- **The dive and the sea's depth bake**: the sea's shallows are coloured
  from a depth map at the lake's resolution; under water that map is
  irrelevant (the fog does the work), so the risk is only the sea's
  surface seen from below, which is the double-sided draw.
- **The duellist through gates**: the hostile brain's `back` tactic must
  respect a solid that switches on; `activity.js`'s movement already
  pushes out of solids each frame (`pushOut`), so a gate shutting on Maul
  pushes him to one side of it. The test in `naboo.scenario.test.js`
  covers a gate shutting with the duellist in it.
- **Population and the lake**: `validity.test.js` holds every roster
  soldier standable; the gorge and the deeper swamp move some of the
  ground war's turfs, and the test says where.
- **Scope**: seven steps is a lot. Each is a whole on its own, and the
  order is by what the owner sees first.
