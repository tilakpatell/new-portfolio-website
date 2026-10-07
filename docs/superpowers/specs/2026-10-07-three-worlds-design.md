# Coruscant, Yavin 4 and Bespin, made whole: the look, the models, the people and the war on the ground

Date: 2026-10-07. Status: agreed in conversation, section by section; the plan
is `docs/superpowers/plans/2026-10-07-three-worlds.md`. Builds on
`2026-10-07-house-look-design.md` (the house look, the ground map, Bruno's
grass and wind, the core kit), `2026-10-07-npc-intelligence-design.md` §3 (the
surface on the AI toolkit) and `2026-10-07-gcw-allegiance-design.md` revision
3a (three wars and the Hutts), and changes none of their decisions. Where a
section below says more than those specs, this one wins for these three worlds.

## Intent

What the user asked: make Coruscant, Yavin and Bespin much, much better, with
textures as good as Bruno Simon's, models that are right, in-depth NPCs, the
AI and the faction war properly wired, and all of it cohesive.

What the code does today, read against that:

- The galaxy's surfaces (`src/components/galaxy/surface/`) draw with three's
  own lights and a shadow map, grey shade, a fog of one colour, and their own
  grass (`surface/grass.js`) and detail-map code (`kit.js`'s `withDetail`).
  The house look, the ground map, the lib's grass and wind and the core kit
  (`src/lib/three/{house,groundmap,grass,wind,core}.js`) are on the Shire only.
- Coruscant's towers are code-built boxes with painted stripes; Bespin's
  skyline is cylinders; Lando, Lobot, the Ugnaughts, the Wing Guards and Dex
  are `figures.js` block figures. Interiors on these three worlds are props,
  not zones you go into (Yavin's hangar aside).
- The surface's people wander on timers and its enemies read your true
  position every frame (`actors.js`, `hostiles.js`, `activity.js`); the AI
  toolkit (`src/lib/ai/`) is built and is on the universe map's characters
  and hunters, not on the ground.
- The war (`gcw.js`) is one-sided and nothing on a surface knows who holds
  the system. The allegiance spec and plan are written; only their first PR
  (the documents) is merged.

Done looks like this. The three worlds draw through the house look with the
Shire's polish: shade is a colour, fog is the sky, grass is Bruno's, every
built surface wears a real scan at real scale. Cloud City is a city, Coruscant
glows to the horizon at sunset, Yavin's jungle floor is grass and litter under
a canopy. Where a block figure stood there is a rigged model. You go into
Dex's, the Outlander Club, the Jedi Temple, the war room, the freezing
chamber, the reactor gantry. The people see you, lose you, look for you, want
things, and say different things by era, by who holds the world, by your side
and rank and what you have done. You swear to a side in one of three wars,
and the world you land on is garrisoned by whoever holds it; each of the three
has a ground battle that moves the holotable. Everything is pure where it can
be, tested in Node, checked in a headless browser, merged one PR at a time.

## Decisions

### 1. The look engine (one PR, every world)

`surface/scene.js` moves onto the house pieces; every one of the seventeen
worlds gets it in the one PR, the three worlds then tuned in their own.

- **A site may give a `look`**: `{ shadow, edge, fogBelow, halo, exposure }`,
  merged over `lib/three/house.js`'s `LOOK` by `lookOf(site)` (pure,
  `surface/look.js`). Left out, the shadow colour is worked out from the sky:
  the zenith colour mixed a third toward the horizon's, darkened.
- **The scene**: `const house = createHouse(lookOf(site))`;
  `renderer.toneMapping = house.toneMapping`; exposure is the site's own
  (default 1) times `house.exposure`, so brightness tuned under ACES holds
  under Neutral. Each frame, after the sky updates: `house.light({ sun,
  hemi })` and `house.sky({ low: horizon, high: zenith, below: fogBelow,
  sunDir, halo })` from the site's sky (a sky body such as Yavin's gas giant
  is a picture in the dome, not light). `house.adopt(scene)` runs once after
  `groundWorld` has baked (the Shire's rule: after the floor light), and
  `placer.js`, `activity.js`, `actors.js` and the zones call `house.adopt`
  on whatever they add later, so a spawned trooper or a loaded model is in
  the look too. Skies, water, weather, beams, sprites and anything with `fog
  = false` are unlit materials and untouched.
- **The ground map**: `createGroundMap({ area: the walkable square (±HALF),
  size: 512, heightSize: 128, paint, height })`. `paint(x, z)` is the ground
  shader's own palette rule written once in JS (`surface/groundPaint.js`,
  pure): height between `hLow`/`hHigh` picks low/high, slope past `rockAt`
  picks rock, the accent noise and its cover, the deep colour below, the
  wet band at the water; it returns the grass amount from `grass.js`'s
  cover rule (none on steep ground, under water, on flats, the landing pad,
  the places' built ground; drifts by noise). `ground.js` reads the map's
  colour under its own grain and scan up close (`map.paint(material)`), so
  the floor, the grass and the bounce agree; `house.ground(map)` turns low
  downward faces toward it. The shader's own rule stays for the far ground,
  beyond the map.
- **Grass and wind**: `lib/three/grass.js` replaces `surface/grass.js`
  (`side` 280/200/120 by tier, `size` 44 m, blade height from `site.grass.h`,
  width `w`, colour from the map at the root, the look's shade at the root).
  One `lib/three/wind.js` per world (`angle` from `site.ground.wind`,
  `strength` from `site.grass?.wind ?? 0.4`); kit parts flagged `sway: {
  strength, height }` (fronds, plants, creepers, banners, cloth, cables) take
  `wind.sway`. The surface's own cover map test moves to the lib's.
- **Worlds with no ground** (`noGround`: Bespin, Coruscant, Kamino): no map,
  no grass; the look and the sky fog only; the bounce is off.
- **The core kit**: `kit.js`'s `withDetail` and `dress` become
  `lib/three/core.js`'s `wear` (triplanar, at the scan's real size), so a
  part at any size carries the right grain. Every solid role maps to a core
  role: `stone, metal, paint, concrete, deck, tiles, adobe, wood, bark,
  rock, sand, snow, mud`; glow, glass and cloth stay as they are. Loaded
  models keep their own maps; `wear` goes on them only where a site says
  (`wear: 'stone'` on a thing) for a Meshy atlas that is mush.
- **`?debug`**: `surface/tune.js`, the Shire's `tune.js` shape, bound to the
  look, the wind, the grass, exposure and fog, with the copy-as-code button
  printing a site `look` block.
- **Tests**: `groundPaint.test.js` (the map's colour equals the shader rule at
  sampled points, within a byte; grass is 0 on a flat, under water and on
  steep ground), `look.test.js` (`lookOf` merges, defaults from the sky,
  rejects nonsense), the lib's grass and wind tests as they are,
  `shading.test.js` unchanged (the surface stays `'glsl'`).
- **Check**: `OUT=lab/check JSON=1 node scripts/galaxy-check.mjs surface <all
  seventeen>` on main first (the baseline, kept as `lab/baseline/surface-high.json`,
  git-ignored) and then on the branch with `BUDGET=` pointing at it (no
  breach past +10%, never over 600 calls or 2.5M triangles, no page error),
  and a before/after sheet per world in the PR body.

### 2. Coruscant (`sites/core.js`, `props/core.js`, a `sites/coruscant.js` of its own)

Coruscant's site moves out of `core.js` into `sites/coruscant.js` (the file
is over a thousand lines; the three worlds each get a file).

- **Look**: `{ shadow: '#5a4a7a', edge: [0.12, 0.8], fogBelow: 0.7, halo:
  '#ff9a50' }`: violet shade, the sunset's amber at the horizon, the blue
  overhead; towers melt into the haze by distance.
- **Windows**: `skyscraper` and `corutower` materials gain a window grid in
  the shader (`props/windows.js`, pure GLSL in a tested rewrite): a seeded
  grid per instance, lit cells in two whites (6500 K and amber), denser low
  down, a slow flicker; emissive so bloom catches it. The far city reads as
  the film's.
- **Skylanes**: each `airlane` adds an emissive ribbon along its path (a thin
  additive strip, two tones for the two directions) under the instanced
  airspeeders. Spire warning lights blink red on the tallest towers.
- **Surfaces**: platforms `deck`; the Processional Way and the Senate plaza
  `tiles`; the Works `metal` with rust; 500 Republica `concrete`; all through
  `wear`.
- **Zones** (`props/inside.js` pattern, each with `rooms` and `lamps`):
  - **Dex's Diner**: the counter, booths, the grill with nuna on it, the
    WA-7 waitress droid on her wheel (a Sketchfab model if one passes, else
    built), Dex behind the counter (rigged model, lane 5), Obi-Wan's stool.
    The `dart` quest's talk step moves inside.
  - **The Outlander Club**: a long bar, dejarik tables (the `dejarik` kind the
    site has), neon in magenta and cyan, a crowd, Elan Sleazebaggano at the
    bar, Zam Wesell in the back who leaves when you come near.
  - **The Jedi Temple**: the great hall (columns, the four statues), the
    Archives (holobook stacks in blue, Jocasta Nu), and the training room
    where the `training` quest's remotes fly. The door is at the top of the
    Processional.
- **People** (deepened in section 6): Dex, Elan, Jocasta Nu, Padmé and C-3PO
  at 500 Republica, the Senate Guards, clones on the Processional, the
  Coruscant Guard on the platform, commuters, Yoda in the hall.
- **Things to do**: `training` and `dart` stay (moved into the zones);
  added:
  - **The assassin's speeder**: a race in Anakin's airspeeder (`ride:
    'airspeeder'`, a flying ride: `rides.js` gains `fly: { alt, climb }`)
    through gates laid along the airlanes, 60 s par, ending on the Outlander
    Club's platform.
  - **Order 66** (the Clone Wars theatre, or any era as a memory): clones
    turn on the Temple steps; a `shoot` step with a squad of eight (`squad`
    tokens, section 6) and a duellist (a clone commander with a `guard`).
  - **A dart at the club**: the `dart` collect step is in the Outlander zone,
    and the talk step in Dex's.

### 3. Yavin 4 (`sites/yavin.js`, `props/forest.js`'s `YAVIN`)

- **Look**: `{ shadow: '#3a4a3a', edge: [0.18, 0.85], halo: '#fff0c0' }`:
  green-grey shade, a warm halo through the canopy.
- **Ground**: the ground map carries a canopy term: `paint` darkens and
  thins the grass under the trees' crowns (the scatter's placements are
  known when the map is painted), so the floor is grass in the clearings,
  litter and roots under the canopy. `grass: { h: [0.18, 0.5], cover: 0.55,
  wind: 0.5 }`; the leaf-litter scan stays as the map's detail. Ferns,
  plants and creepers sway. The god-ray shafts (`shaftGeometry`) stay, tinted
  by the look's halo.
- **Surfaces**: the temple's stone `stone` through `wear` on the built
  parts; the hangar floor keeps its `deck` and scorches.
- **Zones**:
  - **The war room**: Dodonna's briefing hall under the hangar: rows of
    pilots, the holographic Death Star and its trench (an additive wireframe
    that plays on a `signal`), Dodonna at the lectern, Leia beside him.
  - **The ceremony hall**: the summit's throne room, the medal dais, the
    banners, the whole Rebellion in rows (instanced figures), Leia with the
    medals.
  - **The inner stair** joins hangar → war room → the summit hall: floors
    tagged, a climb inside the temple (the model's solids stay; the stair is
    a zone of its own, three rooms).
- **People**: Dodonna, Red Leader, Wedge, Biggs, Gold Leader, the aide, the
  techs, the astromechs, the sentry, Leia.
- **Things to do**: `remotes` stays; added:
  - **The briefing**: reach the war room, talk to Dodonna, the hologram
    plays (`signal: 'brief'`), Gold Leader asks his question.
  - **Scramble**: a race on foot from the war room to your fighter through
    the hangar's taxi-line gates, 40 s par; `leave` into the trench run
    (`/deathstar`).
  - **The medal ceremony**: after the trench run is won (the Death Star
    achievement), reach the summit hall; the doors open, the cheer.

### 4. Bespin (`sites/bespin.js`, `props/edge.js`'s Bespin parts → `props/bespin.js`)

- **Look**: `{ shadow: '#c07a8a', edge: [0.1, 0.78], halo: '#ffb070',
  fogBelow: 0.95 }`: rose shade, gold hour.
- **The cloud sea**: `water.kind: 'clouds'` gains a second, slower cloud
  layer scrolling the other way and sun glints along the sun's azimuth, so
  the sea below has depth.
- **The city**: the deck wears `deck` in Cloud City's cream (`tiles` on the
  plaza), rails along every walkway and bridge, the lamps warm emissives.
  The cylinder towers go: Meshy tower clusters (section 5, two variants)
  stand on the deck in their place, with the built `cloudblock` kept for the
  low fill. The far city stays a skyship.
- **Zones**:
  - **The dining room**: the white curved corridor in, the long table, Vader
    at its head (he stands when you enter), Boba Fett at his side.
  - **The carbon-freezing chamber**: red-lit, the steam vents, the platform
    that lowers (a floor that moves on a `signal`), the Ugnaughts, the
    carbonite slab.
  - **The reactor gantry**: the shaft's wind, the gantry you walk out on, the
    control room, the window Luke was blown through; a `fall` below the
    gantry sends you to the weather vane.
  - **The way out**: Lando's corridor to the Falcon, the Wing Guards, the
    door Lobot opens.
- **People**: Lando, Lobot, the Wing Guards, the Ugnaughts, the citizens,
  Boba Fett, Vader, the stormtroopers, Leia and Chewie in the corridor.
- **Things to do**: `han` stays; added:
  - **The freezing**: in the chamber, hold the platform against Ugnaughts
    and stormtroopers (a `shoot` step with a squad), then the carbonite
    lowers (`signal: 'freeze'`), Fett takes it.
  - **The duel**: Vader on the gantry, a `blade` and `guard` duellist with
    the Force push (`hostile.force`: a push every so often, `combatRules`'s
    `pushVelocity`); going down is the fall, respawn at the vane; the talk
    at the end has his line.
  - **Lobot's codes**: `use` steps at two panels; the Wing Guards turn and
    fight the stormtroopers beside you (a friendly squad, section 6), the
    run to the platform.

### 5. Models (Meshy up to about 400 credits; Sketchfab free)

- **Meshy from film stills** (`scripts/meshy-galaxy-buildings-fill.mjs`'s
  pattern, a new `scripts/meshy-galaxy-three.mjs` and
  `meshy-galaxy-three-tasks.json`, gated on the four-view sheet, remade or
  dropped when wrong): Cloud City tower cluster, two variants (`cloudtower`,
  `cloudtower2`); the plaza façade (`cloudplaza`); Dex's Diner (`dexdiner`,
  replacing the built one); the Outlander Club's front (`club`); 500
  Republica (`republica`). About 245 credits.
- **Meshy rigged figures** (`scripts/meshy-galaxy.mjs`, images 9, models 30,
  rig 5 each; the crew's skeleton so `loadPartyFigure` walks them): Lando,
  Lobot, an Ugnaught, a Wing Guard. Dex is four-armed: a model without the
  rig, standing (`still: true`) behind his counter. About 170 credits. Where
  Meshy refuses a likeness, the soft look is tried once, then the built
  figure stays.
- **Sketchfab** (`scripts/sketchfab-surface.mjs`, a new group
  `catalog/three.js`): a WA-7 droid, Jocasta Nu, a carbon-freezing platform,
  a Senate pod, a Coruscant police speeder, a dejarik table is already in.
  Each is looked at on the contact sheet and deleted if it is a cartoon, a
  flat diorama or untextured. Credits in `src/data/modelCredits.json`.
- `scripts/flatten-glb.mjs` repaints an atlas that came out as mush; a built
  prop stays wherever a model would be worse. The budget is a cap, not a
  target.

### 6. The people (spec §3 of `npc-intelligence-design.md`, these worlds first)

`actors.js`, `hostiles.js` and `activity.js` go onto `src/lib/ai/`. Nothing a
visitor can do changes; every site file works unchanged.

- **Perception**: a hostile has `senses` from its kind (`hostiles.js`'s
  `SENSES`: a trooper 110° and 45 m, a droid all round, a duellist 30 m, a
  beast by smell) and a belief of you (`perception.sense` with the surface's
  `sightClear` over the solids). It fires and steers at the belief. Lost, it
  goes to where you were, looks (`search`, cautious: one looks, the rest
  cover, a `?` sprite over the head), and gives up or finds you (`found`
  line).
- **Choice**: `strafeStep` and the chase become `utility.pick` over `{ hold,
  strafe, close, back, flank, cover }`, `spatial.pickPlace` for the point
  (cover from your line of fire for a blaster; in your view for a duellist);
  tokens per spawn group (`shot: 3`, `melee: 1`), and whoever has no token
  moves.
- **Squads**: a spawn group is a squad (`squad.createSquads`); confidence
  from losses sets its posture: `retreat` in halves with the other half
  covering, `press` with flankers from the lane ends. A friendly squad
  (`spawn.side: 'yours'`: Bespin's turned Wing Guards) fights beside you,
  with the same rules, against the hostile tag.
- **Needs**: a site may give `wants: [{ id, at, r, kind }]` (a counter, a
  fuel line, a cloud car, a lane) and a life entry `needs: [kinds]`; a
  wanderer with needs picks its next want by utility (distance, how long
  since, a little random) and goes, pauses, goes on. Coruscant's commuters
  (diner → platform → lane), Yavin's techs (fuel line → crates → a fighter),
  Bespin's Ugnaughts (cloud car → chamber). Off by default.
- **Relations**: `relations: { fears: [kinds], chases: [kinds] }` on a life
  entry, read through perception: a Wing Guard flees stormtroopers he has
  seen, Ugnaughts scatter from a fight, a Senate Guard chases Elan.
- **Dialogue trees** (`surface/talk.js`, pure, tested): a named person's
  `says` may be a tree: `{ when: { era, owner, side, hero, done: [quests],
  rank }, lines, else }` nested; `talkFor(spec, ctx)` picks the lines. The
  scene's `ctx` is `{ era, owner (the war's), side (yours), rank, hero, done
  }`. Lando has one thing for a Rebel commander, another for an Imperial
  ensign, a third once `han` is done. Each of the three worlds' named people
  has a tree; the rest keep their lists.
- **Tests**: `hostiles.test.js` (a trooper cannot see you behind a wall for
  `intuition` seconds; a squad of six holds at most three shot tokens; a
  squad with half its members down retreats), `needs.test.js` (a want is not
  picked twice in a row), `talk.test.js` (every branch reachable; the else
  always present).

### 7. The war on the ground (`gcw-allegiance-design.md` revision 3a, whole)

The pure modules first, as that spec's plan has them (its PRs 2–4):
`galaxy/sides.js` (six factions and the Hutts), `allegiance.js` (the oath per
war, the theatre), `gcw.js` two-sided on the routes, regions, worth, weight
and an early end, `ranks.js`, `warEffects.js`, `warCast.js`, `battles.js`
with six kinds and a template per war system per war, `universe/battle.js`'s
`objectivesOn`, aces and runners; then the table, the panel and the HUD (its
§7) and the lines (§6). Nothing in it is cut.

Then the ground, for the three worlds first and every world after:

- **`effects` reaches the surface**: `travel.js`'s `surfaceProps` carries
  `effectsFor(sys, war, allegiance)`; `scene.js` keeps it and works it again
  on the war's step. A site's trooper kinds in `life` and in a quest's
  `spawn` are mapped through `effects.troops` (`troopKind(kind, effects)`,
  pure in `warEffects.js`: `stormtrooper` → `clone` in a Republic-held
  system of the Clone Wars, `rebel` where the Rebellion holds it, `remnant`
  under the Remnant; a site's own named figures are untouched).
- **The garrison at the landing**: `garrisonAt(site, effects)` (pure, tested)
  adds life at the landing in the holder's colours: Coruscant's platform
  (clones, stormtroopers, Senate Guards or New Republic troopers), Yavin's
  field (Rebels; or an Imperial search party with a probe droid), Bespin's
  bridges (Wing Guards; or stormtroopers on every bridge). Flyovers are the
  owner's traffic. The named people's trees read `owner`.
- **A ground battle per world** (`missions/assault.js` data, the Battlefront
  engine as Hoth's and Geonosis's): Coruscant's **Temple steps** (posts: the
  platform, the Processional, the Temple door; the lines by era: clones
  against droids, stormtroopers against Rebels, New Republic against the
  Remnant), Yavin's **temple perimeter** (the field, the hangar, the summit),
  Bespin's **platforms** (327, the plaza, the east platform). Each is on
  `?mission=assault`, offered from the holotable and the panel ("Fight it on
  the ground"). The choose card is the oath; `endBattle`'s result posts
  `addWin` and `addPoints` to the war through `warState.js`. Their soldiers
  are squads (section 6).
- **Voice**: the commanders on the comms by system and side (`warCast.js`),
  the hero's `side` and assault lines, the crews' lines by stance.

### 8. Order, tests and checks

One PR each, merged when CI is green, in this order:

1. The look engine (section 1), every world, with the before/after sheet.
2. Coruscant's look and interiors (section 2).
3. Yavin's look and interiors (section 3).
4. Bespin's look and interiors (section 4).
5. Models (section 5): generated in the background from PR 2 on, wired in
   one PR once gated.
6. The people (section 6): the engine onto the toolkit, then the three
   worlds' trees, needs and relations.
7. The war, pure (section 7, the allegiance plan's PRs 2–4).
8. The war's table, panel, HUD and lines (the allegiance plan's PRs 5–6).
9. The war on the ground: effects, garrisons, the three ground battles.

Before every push: `npm run lint`, `npm test`, `npm run build`, `node
scripts/health.mjs --check --skip build`. Every PR with surface changes:
`scripts/galaxy-check.mjs surface` on the worlds it touches against the
baseline taken from main, and `scripts/surface-shot.mjs` views in the
PR body. The war PRs: `scripts/galaxy-war-check.mjs` with `SIDE=` and `KIND=`
runs, `scripts/assault-check.mjs` for the ground result reaching the tally.
Models: the four-view sheet per model in the PR.

## Out of scope

- The other fourteen worlds' interiors, trees and garrisons beyond what the
  engine PRs give every world (they get the look, the grass, the toolkit and
  the garrison mapping; their own zones and trees are later lanes).
- gen3d (the owner's desktop): where Meshy gets a famous design wrong, an
  issue labelled `gen3d` is opened, and the built prop stays meanwhile.
- Voice lines for the new dialogue (an issue labelled `voices` lists them).
- The universe map's wars (Rick and Morty's, Breaking Bad's).
- The sequel trilogy, anywhere.
