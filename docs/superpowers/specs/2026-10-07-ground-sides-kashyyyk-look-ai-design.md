# The galaxy's ground: Kashyyyk's battle, sides you can trust, soldiers who think, and a look from this decade

Date: 2026-10-07. Written from five read-only audits of `origin/main` at
`9270e8cf` (Kashyyyk's battle and layout, allegiance on the ground, the
ground AI, the look, every planet's layout) and a browser survey of all
seventeen surfaces (spawn view, a top-down render and who stands there).
To be built in the PRs the plan lists
(`docs/superpowers/plans/2026-10-07-ground-sides-kashyyyk-look-ai.md`).

## Intent

What the user said: "Kashyyyk and some of the planets make no sense with
the layout. Also the textures need much improvement to look less 2000s web
browser game. Kashyyyk: fix the battle logic as no enemies came. Also if
you're aligned with another faction why do you land with the enemy faction
and talk with them on the ground? Improve the AI and think of these things
and implement them."

Done looks like this. You land on Kashyyyk and the beach is a battle: the
droids come out of the lagoon in waves, the clones and Wookiees at the
barricades fight them with you, and the Battle of Kashyyyk is there to
play in full. Every world shows the war its film is set in, so Geonosis
has droids and clones, not stormtroopers beside Count Dooku. Who holds a
world and whose side you swore to decide where you set down and how its
people treat you: a friendly garrison salutes, an enemy garrison hunts
you, and nobody on the other side hands you their quests. Enemies take
cover that actually stops bolts, don't shoot through walls, miss more at
range and on the move, and break when their squad does; your companion
fights. And the ground looks like a game made now: real sun shadows,
shade that keeps its texture, layered photo-scanned terrain, a filmic
tone curve.

## What is wrong today (the evidence)

### Kashyyyk's battle: why no enemies came

1. **The beachhead droids spawn under the lagoon.** Gree's quest
   (`sites/quests.js:39`) spawns at `[150, 40]`, where the ground is 2.3 to
   5.2 m below the water line. `activity.js:820` stands them on raw terrain
   (`groundAt`, which ignores water). They are leashed 6 m from their spawn
   (`hostiles.js:111`), see 58 m, and the barricades are 73 m away: they
   never come, never see you, and the step has no `at`, so no beam shows
   where they are.
2. **They are re-dressed as your own side.** Every quest goes through
   `garrisonQuest(q, effects.troops)` (`scene.js:387`), which swaps battle
   droids for the holder's troops. Kashyyyk is held by the war's liberator,
   so in the default Civil War theatre the droids spawn as Rebel troopers,
   and Commander Gree becomes "Rebel trooper".
3. **The ambient battle is underwater scenery.** The site's B1s, B2s and
   spider droids (`forest.js:533-537`) walk paths 3.6 to 5.9 m down, and
   only wander and talk. The spider-droid wreck "up the beach" lies 5.5 m
   under the lagoon with its smoke rising out of the water.
4. **Space almost never fights there.** Kashyyyk is always its war's
   liberator's, so it is never a front; only the raider's attacks (one per
   `GCW.attackEvery`, by `war.weight`, Kashyyyk's 1) bring a battle. The
   current campaign has none in any war.

### Sides on the ground

Nothing on the surface reads `effects.hostile`, `yours` or `deserter`:

- Landing ignores who holds the world: one `site.land` per site. Every
  landing puts the holder's 6 to 10 troops round your ship
  (`garrison.js garrisonAt`), saying "Move along."
- `garrisonLife` re-dresses named quest givers with the holder's kind and
  deletes their lines: Scarif's Lieutenant Sefla, Endor's Rebel scout,
  Hoth's deck officer and Dodonna become silent stormtroopers who still
  hand out Rebel quests.
- `garrisonQuest` turns quest enemies into the holder's troops, so on your
  own side's world you fight your own side.
- Talk gets `side` and `rank` only on a direct page load: the flown
  landing hands the scene `effectsFor`'s object, which has neither
  (`Galaxy.jsx:226`, `scene.js:3116`).
- **Every world shows the theatre's war, whatever film it is staged in.**
  In the default Civil War theatre, Geonosis and Kamino have 38
  stormtroopers beside Jedi, Dooku and phase-one clones, and Mustafar has
  18 Rebel troopers round Vader.

### The ground AI

- Nothing stops a bolt but the ground: cover hides a soldier from sight
  but not from shots, either way (`blaster.js:83-108,147-187`).
- An enemy fires with no line-of-sight or facing check, at your true
  position for 2.5 s after it lost you: it shoots round corners
  (`activity.js:897-954`, `perception.js:90-96`).
- Enemies have no collision with walls or rocks; cover and spawn spots are
  not checked against solids (`activity.js:803-805,439-441`;
  `hostiles.js:173`).
- A shooter that sees you just out of range scores no move and wanders off
  (`hostiles.js:99-108,157,165`); with the 6 m home tether you can snipe
  from outside its range.
- Detection is instant; every enemy within 60 m hears every shot.
- Aim is always your chest with a fixed spread: no penalty for range, for
  your speed or for being shot at (`scene.js:2888`).
- No suppression or morale on the surface (the assault and the space
  hunters have both).
- Enemies never target your companion; it never fires first; in a battle
  its shots do no damage (`scene.js:1118-1259`).
- Ally-against-enemy fire is a flat 45% roll with no line of sight
  (`scene.js:2846`); the assault's soldiers shoot through walls
  (`assault.js:527-568`) and your shots don't suppress them.
- Ambient walkers only avoid round solids and walk through box walls
  (`actors.js:534`).

### The look

It is not the texture resolution. In order of effect:

1. **No realtime shadows once a world has loaded.** `groundWorld` is called
   without `keepShadows` (`scene.js:3061-3074`), which turns the shadow pass
   off on any GPU with float colour buffers (`groundwork.js:127-139`). Only
   the floor keeps a baked shadow at 0.66 m a texel; buildings never shadow
   themselves or each other.
2. **Shade is replaced by a flat colour.** `house.js:77-88` paints any
   pixel under 16% light as albedo × one shadow colour, throwing away
   normal maps, scan relief and reflection on every shaded face.
3. **Flat ambient, near-linear tone.** Hemisphere 0.7 to 1.15 against a sun
   of 1.3 to 3.3, plus environment 0.4; the tone map passes everything under
   0.8 straight through (`post.js:142-148`).
4. **Coarse terrain.** One flat-projected scan per world fading out by
   90 m, cliffs untextured, colour from a 2.5 m-a-texel ground map, normals
   from a 5 m vertex grid (`ground.js`, `terrain.js`).
5. **Props:** a third of prop materials are flat colour; the scans' roughness
   and AO are never applied (`kit.js:452-463`, `core.js:88-114`). Foliage
   loses alpha-to-coverage on Retina screens (no MSAA at pixel ratio ≥ 1.75,
   `post.js:217`).
6. **Water** reflects a two-colour gradient (`water.js:205-220`).

Kashyyyk's own: its 180 scattered wroshyrs are grey (`bark: '#50554e'`)
smooth cylinders under the flat shade, and the lagoon's karsts read as
pale pillars with green discs.

### Layouts

The pattern behind "makes no sense": almost every world lands you in an
empty spot with its places 150 to 550 m out on a ring, no paths, and
scenes the films keep together scattered to opposite sides. The worst:

1. **Kashyyyk** (above, and: the fight is 167 m from where you land; you can
   wade across the whole lagoon, an invisible knee-deep floor out to the
   karsts; the barricades meet the attack end-on with all the cover behind
   them; the quest-giving Tarfful stands inside Kachirho's trunk, so his
   quest can't be started; two Grees, two Tarffuls; the command post is a
   ridge 236 m off with Yoda on it).
2. **Tatooine:** you land in empty sand 227 m from anything; Jabba's palace
   is 916 m from the Sarlacc; Docking Bay 94 can't be walked into.
3. **Geonosis:** the films' one hive complex (arena, foundry, Dooku's hangar)
   is split to four corners 350 to 750 m apart; the arena's collision box
   pushes you out of it; the foundry quest's pickups are inside the
   foundry's collision; Mace stands inside the arena's wall.
4. **Hoth:** Echo Base's hangar mouth faces the landing, its back to the
   walkers.
5. **Sorgan:** no water, though the world promises krill ponds; the village
   is five huts in a perfect ring; the AT-ST fight is 480 m away at the
   raiders' camp, not in the village.
6. **Naboo:** you land facing away from Theed; Theed is twelve halls with no
   street; the sacred grove stands in a 5 m pond.
7. **Lothal, Mandalore:** "Capital City" is four farmhouse domes and its
   factory is an Endor bunker 500 m off in the grass; Mandalore's mines are a
   sandstone needle 610 m from Sundari.
8. **Scarif, Yavin, Dagobah** (small): the last sunset is 778 m from the
   Citadel; you land 112 m short of Yavin's landing field; Luke's camp is
   137 m from his X-wing.

Mustafar and Nevarro are left to their open work (`claude/world-maps-lava`,
PR #566; `claude/nevarro-rebuild`).

## Decisions

Every rules module named here is pure (no three.js, no DOM), seeded through
a `rand` argument where it needs one, and tested in Node first.

### 1. The ground keeps its film's war (`galaxy/siteWar.js`)

- `SITE_WAR[sysId]`: the war a world's ground is staged in, from its
  `moment`: `clone` for Geonosis, Kamino, Kashyyyk, Mustafar, Naboo,
  Coruscant; `gcw` for Tatooine, Hoth, Endor, Yavin, Bespin, Scarif,
  Dagobah; `remnant` for Nevarro, Sorgan, Mandalore, Lothal.
  `battleLines.js`'s `PLACES` is the same table and is replaced by it.
- `oathIn(a, war)` (in `allegiance.js`): your oath in that war, the same
  flat shape `current(a)` gives for the theatre.
- `groundEffects(sysId, a, now)`: `effectsFor(sysId, warNow(now,
  SITE_WAR[sysId]), oathIn(a, war))` plus `side`, `rank` and `war`. The page
  and the flown landing both call it, so talk has your side and rank either
  way. A world not in the table uses the theatre, as now.

So the troops you meet are always of the film's era: on Geonosis the
holder is the Clone Wars' (the Separatists at the opening), and your
standing there is your Clone Wars oath (unsworn unless you swore in it).

### 2. Friend or foe (`surface/standing.js`)

- `SIDE_OF_KIND`: the trooper families as `garrison.js` names them, plus
  `droideka`, `dwarfspider`, `probe`, `deathtrooper`, `shoretrooper`, the
  `atst`/`atrt`/`atap`/`atte` walkers, mapped to a side **of the site's
  war** (`stormtrooper` is the Empire's in the Civil War and the Remnant's
  in the Remnant War; `clone`, `clonephase1` the Republic's; `rebel`,
  `hothtrooper` the Rebellion's or the New Republic's; `battledroid`,
  `superdroid`, `droideka`, `dwarfspider` the Separatists'; `mercenary`,
  `weequay` the Hutts').
- A life entry or quest giver may say its own `side`. Named people do:
  Gree, Yoda and the clones' officers are the Republic's, Dooku the
  Separatists', Dodonna the Rebellion's, and so on. Natives (Wookiees,
  Ewoks, Gungans, Jawas, Geonosians, Kaminoans) are `native` with a
  `leans` (the side they fight beside in the film: Wookiees, Ewoks,
  Gungans the light side; Geonosians the dark).
- `standingOf(npcSide, you)` → `'ally' | 'enemy' | 'neutral'`: ally when
  it's your side (or a native leaning your way); enemy when it is the
  other side of the same war and you are sworn in it; neutral otherwise
  (unsworn, the Hutts, natives leaning the other way, civilians).

### 3. Where you set down (`surface/landing.js`)

- `landingFor(site, effects)` → `{ at, yaw, covert, line }`:
  - the world is your side's, neutral (the Hutts'), or you are unsworn in
    its war: `site.land`, as now;
  - the other side holds it: `site.covert` (authored per site: out of the
    garrison's sight, 120 to 250 m from the pad, by cover), falling back to
    `covertFor(site, world)`, the flattest dry spot on a ring 150 to 220 m
    round the pad, furthest from the garrison's posts. The arrival line
    says so ("Imperial-held. We set down out of sight of the garrison.").
- Your ship stands there and the walk starts there. Taking off is as now.

### 4. The garrison's attitude (`garrison.js`, `activity.js`)

- On your side's world the landing party is friendly and says so by rank
  ("Commander." / "Good to have you back, General.").
- Unsworn, it is as today ("Move along.").
- On the other side's world it is **hostile**: the same party, spawned
  through `activity` as hostiles on a beat round the pad and at its posts.
  They don't talk; they detect you gradually (section 6) and come looking
  where they last saw you; the probe droid's sighting brings the nearest
  patrol. You can avoid them: you landed out of sight.
- `garrisonLife` only re-dresses **unnamed** troopers (no `id`, no
  `named`, no `quest`); named people and quest givers keep their kind,
  name and lines.
- `garrisonQuest` goes: quest spawns keep the kinds they were written
  with. With section 1 those are always the right era, and a quest's
  enemies are the enemies of whoever gave it.

### 5. Talk and quests by side

- A quest has a `side` (its giver's). Sworn to its enemy, the giver won't
  give it: a refusal line by stance ("I don't deal with Imperials."), and
  the quest isn't counted in "Things to do". Unsworn, anyone talks to you.
- An enemy figure shows no "Talk" prompt; walking up to one in its sight is
  being seen.
- Side-aware lines that exist (Lando, Padmé, Dex) now get your side and
  rank on every landing, and the life is rebuilt when you swear mid-visit.

### 6. Soldiers who think (`hostiles.js`, `activity.js`, `blaster.js`, `assault.js`, `actors.js`, `scene.js`)

In order of effect:

1. **Cover stops bolts.** Every bolt, yours and theirs, ends at the first
   solid it meets (`walker.js`'s solids: circles and boxes with `top`), as a
   spark on it. A box under the bolt's height is shot over.
2. **No shot without a line.** An enemy fires only when it has line of
   sight to where its target actually is and faces it within 25°; it turns
   first. Lost, it may send one short burst at where it last saw you
   (suppressive fire), which the cover in between takes.
3. **Bodies that collide.** Enemies slide along solids (`pushOut`, as you
   do); spawn and cover spots are moved out of solids and off deep water.
4. **Close to range.** An enemy that sees you beyond its range advances
   until it is in range; once it has seen you its leash stretches to
   `roam + range` for the fight.
5. **Awareness that builds.** Seeing you fills a meter over 0.4 s (near)
   to 1.5 s (far, or you crouched in cover); `?` while it fills, `!` when
   it has you. Shots are heard 60 m away with a clear line, 25 m without.
6. **Aim with error.** A shot's spread grows with range (×1 to ×2.2 at
   the edge), with how fast you're moving across its view, and with its
   suppression; the first shot of a burst is wider, and it tightens as it
   tracks you.
7. **Suppression and morale on the surface.** A bolt passing within 2 m
   suppresses (worse aim, more cover); a group that has lost half its
   number, or a hurt soldier, falls back to cover or home; a lone
   survivor may run.
8. **Targets are everyone.** Each enemy chooses among you, your companion
   and allies by threat (who is shooting it, how near, whether it has a
   line), with a belief per target.
9. **A companion who fights.** It engages any enemy that has seen you or is
   shooting within 35 m without waiting for your lock, sidesteps under
   fire, is shot at like you, and its hits count in battles.
10. **Ambient people avoid walls** (boxes as well as circles) and run round
    them when they flee.
11. **Battles see.** In `assault.js` a soldier fires only with a clear line
    (the solids between), and your shots suppress the soldiers they pass.

### 7. A look from this decade

1. **Sun shadows back.** `keepShadows: true` on high and ultra: the bake
   keeps the sky's occlusion, the sun casts in real time,
   `PCFSoftShadowMap`, map size from `budget().shadowMap` (2048 high, 4096
   ultra), the frustum following you (±60 m). Mid and low as now.
2. **Shade keeps its texture.** `house.js` gets a `tint` mode, used by the
   galaxy: the shadow colour multiplies three's own light instead of
   replacing it, so normal maps, scans and specular survive in shade.
3. **Layered terrain.** `ground.detail` becomes `ground.layers`: two or
   three photo-scanned ground layers (the world's own: Kashyyyk's mud,
   leaves and moss rock) blended by height, slope and a macro noise, rock
   triplanar on slopes (the cliffs get texture), each with its roughness and
   AO, anti-tiled (`lib/three/surface.js antiTile`), fading at 150 m into
   the colour map. A detail normal at a second, finer scale up close.
4. **A sharper ground.** A 2048² normal map baked from the pure height
   function over the walkable square (ultra 4096), and the ground map at
   1024 (2048 on ultra).
5. **A filmic tone curve and AO.** The surface's post gets Khronos PBR
   Neutral with a per-site grade, and GTAO on high and ultra (space keeps
   its own chain).
6. **Props** wear their scans' roughness and AO; scan strength up; rods and
   cylinders get more sides up close.
7. **Foliage** keeps MSAA 2 on high and ultra at any pixel ratio, so
   alpha-to-coverage works on Retina screens.
8. **Water** reflects the world's environment map, not a gradient.
9. **Kashyyyk** gets warm, deeply furrowed wroshyr bark on the bark scan,
   karsts on the rock scan with vertical streaks and moss, and the lagoon
   its filmed milky olive with real reflections.

Every change is checked against the same three views per world (the
landing, a mid view, a top-down) before and after, and frame time on high
must stay within 2 ms of before.

### 8. Kashyyyk, as Revenge of the Sith has it

- **The layout.** You land behind the line, as now (`[0, -40]`). The beach
  flat in front of Kachirho is the battlefield: the barricades run along
  the waterline facing the lagoon (south), with a `top` of 1.25 so soldiers
  shoot over them standing and hide kneeling, and cover between the water
  and the barricades (crates, rocks, logs, the spider-droid wreck moved up
  onto the sand). The droids wade ashore from the shallows straight in
  front, not from 100 m east. Deep water is a wall: past
  `site.water.wadeMax` (1.2 m) you can't go, on this world only.
- **The command post** moves to the beach's rear by Kachirho's foot, where
  Yoda and Gree stand (one Gree, the quest giver). **Tarfful** stands at
  Kachirho's foot outside the trunk, where you can talk to him; the
  duplicate Tarfful at the pod goes (Chewbacca waits there).
- **The beach battle.** The underwater B1s, B2s and spider droids leave the
  site's life. Clones and Wookiees hold the barricades (standing, facing
  the water). Gree's "The Battle of Kashyyyk" quest is three waves out of
  the shallows (six B1s; four B1s and two B2s; two droidekas and four
  B1s), each spawn on wading ground with a leash that reaches the
  barricades and an `at` for the beam, with four clones and Wookiees
  fighting beside you each wave (`side: 'yours'`).
- **The full battle.** `ASSAULTS.kashyyyk`: the Separatists come out of the
  lagoon for the beach, the gun line and Kachirho's lift, the Republic and
  the Wookiees holding (`sides: clone`, defenders `[['clone', 2],
  ['wookiee', 1]]`, attackers `[['battledroid', 3], ['superdroid', 1]]`);
  posts on dry ground; offered in the galaxy panel as "The Battle of
  Kashyyyk", "Fight it now".
- **Sides.** Kashyyyk's ground is the Clone Wars'. A Separatist lands
  covertly across the lagoon's far shore and the beach's defenders are
  hostile to them; Gree won't talk to them.
- **Space.** Kashyyyk's `war.weight` goes to 3, so the raider attacks it
  more often (the Separatists did, in the film), and `battles.js`'s name
  for it follows who attacks ("The Battle of Kashyyyk").

### 9. Layouts that make sense

The rule: **land by the main place, keep together what the film keeps
together, and give a town a street.** A site may have `paths` (flat,
painted strips joining places in story order, kept clear of the
scatter).

- **Tatooine:** land in Mos Eisley's bay (`model: false` on Bay 94 so it
  can be walked into); the Sarlacc pit within 220 m of Jabba's palace,
  across the dunes; Mos Eisley's arches over a street.
- **Geonosis:** the arena, foundry and Dooku's hangar within about 150 m of
  each other round the hive's mesas; land by the arena; the audit's
  arena-collision, foundry-pickup and Mace fixes applied.
- **Hoth:** Echo Base turned to face the walkers' approach; the wampa's
  cave, the probe's crater and Han's shelter grouped as one patrol area.
- **Naboo:** land facing Theed; Theed's halls lined along a paved road from
  the hangar to the palace; the grove moved onto dry ground.
- **Sorgan:** krill ponds round the village (a `swamp` water), the huts at
  the pond edge, the AT-ST spawned at the village.
- **Lothal:** the factory and the towers folded into Capital City.
  **Mandalore:** the mines' entrance (a pit and a ramp) beside Sundari.
- **Scarif:** the last sunset at the Citadel's foot. **Yavin:** land on the
  landing field. **Dagobah:** Luke's camp beside his X-wing.

### 10. A guard against "no enemies came"

`sites/validity.test.js`, over every site and every quest:

- every spawn point is on ground at least 0.2 m above the water (or within
  wading depth where `wade: true`), and outside every solid;
- every hostile spawn's leash reaches its step's `at` (or its giver), so it
  can come to you;
- every quest giver stands outside every solid, on walkable ground, within
  talking height of the ground;
- no named character appears twice in a site's life and quests;
- every assault post is on dry ground and outside solids.

## The PRs, in order

1. Spec and plan (this document and the plan).
2. **Kashyyyk** (section 8) and the validity test (section 10).
3. **The ground's war and sides** (sections 1 to 5).
4. **Soldiers who think** (section 6).
5. **The look** (section 7).
6. **Layouts** (section 9).

Each merges once CI is green, main merged in first and checked against
the open branches (`merge-via-pr-check-other-branches`).

## Testing

- Node: `siteWar`, `oathIn`, `groundEffects`, `standing`, `landingFor`,
  `covertFor`, the garrison's attitude, quest gating, the validity test,
  the AI rules (bolts against solids, line-of-sight firing, the aim model,
  awareness, suppression and morale, target choice), the Kashyyyk assault
  map, and `assault.js`'s line of sight.
- Browser (headless Chromium on Metal, the scenario driver): Kashyyyk's
  waves coming ashore and the allies fighting; the Battle of Kashyyyk
  running; a Rebel landing on an Imperial Endor (covert, hostile
  garrison), a Rebel on Rebel Hoth (salutes), unsworn on Tatooine
  (neutral); before and after shots of the look on Kashyyyk, Tatooine,
  Hoth, Endor, Naboo and Geonosis, with frame times on high.

## Out of scope

- New Meshy models: the buildings audit already queued 23 remakes
  (`scripts/meshy-galaxy-audit.mjs`).
- Space dogfighting AI, multiplayer, the universe map.
- Mustafar and Nevarro's layouts (open work elsewhere).

## Open branches that touch the same files

- `claude/festive-meitner-ctyhqf` (PR #453): its own Kashyyyk skirmish
  engine, 16 hours and 430 commits behind main, unmerged. This design
  builds Kashyyyk's battle on main's assault engine and quest system
  instead and leaves that branch alone.
- `claude/world-maps-lava` (PR #566): `ground.js`, `walker.js`,
  `scene.js`, `sites/outer.js`. The look's terrain work goes after it
  where it can; the wading limit is a new function in `walker.js`, not an
  edit of its lines.
- `claude/sharp-carson-h9c6mp` (PR #383): `props/forest.js`, `scene.js`,
  `sites/core.js`, `edge.js`, `forest.js`.
- `claude/ultra-models` (PR #556): `placer.js`, the catalogue.
