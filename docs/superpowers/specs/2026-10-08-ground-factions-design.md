# The ground war: factions that hold ground, soldiers that fight each other, and a world that fills in around you

Date: 2026-10-08. Written from three read-only audits of `origin/main` at
`e3cd53e9` (the surface's combat runtime, the repo's chunking and rigging
infrastructure, and every handoff, spec and research note about NPCs on
the ground). To be built in the PRs the plan lists
(`docs/superpowers/plans/2026-10-08-ground-factions.md`).

## Intent

What the user said: "Improve the fighting of NPCs on the ground and spawn
areas based on factions etc. We need to make it dynamic and new. There is
chunking logic, rigging logic, research and a lot of work in the repo we
can use to make this robust."

Done looks like this. You land on a world and the ground belongs to
someone. The holder's troops stand at their posts and walk their beats
in the turf round the pad; a world the war is fighting over has a second
turf, the attacker's, out past the ridge, and between the two a front
where patrols meet and fight without you. Walk out of the pad's turf and
the world fills in round you as you go: a post on the hill, a patrol on
the road, a squad digging in behind rocks, each made once, kept where
you left it, dead where you killed it, and let go of again behind you.
Who you are to each of them is the war's doing: sworn to the holder you
walk through their lines and they salute; sworn to the other side you
set down out of sight and every patrol is a hunt; unsworn you are nobody
and they watch you go by. Soldiers on both sides fight the same way,
with the same guns, through the same rules: they see before they shoot,
shoot only what they have a line to, miss more at range and when they
or you are running, take cover from the line of fire, break when their
squad does, and when a bolt takes one down it falls the way it was hit,
as a ragdoll onto the ground it stood on.

## What is there today (the evidence)

Three stacks place and run NPCs on the surface, and they share no code:

1. **Quest hostiles** (`activity.js`, `hostiles.js`): a quest step's
   `spawn` list, placed once round `at` with `rng(7)`, alive only while
   the step is shown, no respawn. The head is the good one:
   `hostileStep` on `lib/ai` (senses, a belief, a utility pick among
   hold, strafe, close, back, cover, flank, look, search; shot tokens,
   three a world; a group search). Hostility is a flag on the spawn
   (`hostile`, `side: 'yours'`), never a side. A shot at a friendly NPC
   is a probability roll (`scene.js:2886`, 0.45), not a bolt.
2. **The garrison** (`garrison.js` into `actors.js`): six to ten of the
   holder's troops round the landing, two beats and a few posts, from
   `effectsFor`'s `troops`. They wander and talk and never fight,
   whatever `effects.hostile` says. Placed once, never replaced.
3. **Battlefront assaults** (`missions/assault.js`): the one place two
   sides fight each other, by squads on `lib/ai/squad` (nerve, posture,
   frontline, flankers), with its own hp (100), damage (26), respawn
   and tickets, on authored posts.

Each has its own hp scale, death code, token pool, and kind-to-weapon
table (`garrison.js`'s `FAMILIES`, `activity.js`'s `ARMS`, `needs.js`'s
`SOLDIERS`, `warEffects.js`'s `OWNERS.troops`, `universe/sides.js`'s
`troops`). The surface is not chunked: one fixed square (`HALF = 640`),
everything placed at once. Characters have no mesh LOD and no distance
throttle on their AI (only on their animation).

What the repo already has that this design stands on:

- `src/lib/ai/`: utility, perception, squad (confidence, posture,
  frontline, tokens), spatial (cover, flank spots), steer, influence,
  search, body, react. All pure and tested. Influence maps and context
  steering are built and not yet used by any world.
- `src/runtime/chunkGrid.js`: pure cell bookkeeping (nearest first,
  ahead along the heading, a hysteresis band, a generation that refuses
  late answers). Used by the expanse (`expanse/surface/stream.js`, 64 m
  cells, two built a frame) and Minecraft.
- The Death Star's interior, the most finished NPC-against-NPC combat
  on the site: `deathstar/inside/rules/fight.js` (six tactics on
  utility, shot tokens, cover and flank from the layout), `combat.js`
  (bolts that fly and stop at the first body or wall, swept a whole
  step), `scene/people.js` (`lodPick`: live, still, hidden by distance
  and a count per tier; two figures made a frame), `scene/figures.js`
  (`loadPerson`: play, base, look, aim, hold a gun, fall).
- `src/lib/three/animator.js` (locomote, layered play, look, lodRate),
  `clipLibrary.js` (the dotted clip families, `die.fwd` / `die.back` /
  `die.blown`, `hit.chest` / `hit.head`, `aim.pistol` / `shoot.pistol`,
  `crouch`), `animBudget.js` (a rate per figure by distance and view,
  a cap on how many run at full rate), `ragdollPhysics.js`
  (`rigRagdoll`: a Verlet body on Meshy's skeleton that falls the way
  it was pushed and settles), `figureCalls.js`.
- `galaxy/warEffects.js`'s `effectsFor` (owner, yours, hostile, troops,
  heat), the war table's `control`, `front` and `attack` per system,
  `allegiance.js`, `sides.js`.
- The unbuilt parts of
  `docs/superpowers/specs/2026-10-07-ground-sides-kashyyyk-look-ai-design.md`:
  sections 1 to 6 (the ground's war, friend or foe, the covert landing,
  the garrison's attitude, talk by side, soldiers who think). This
  design absorbs them; where it names one of their modules it keeps the
  name and signature that spec gave, so the two documents agree.

## Decisions

Every rules module named here is pure (no three.js, no DOM), seeded
through a `rand` argument where it needs one, tested in Node beside the
file, and under 800 lines. The new code lives in
`src/components/galaxy/surface/ground/`, one folder, with `index.js` as
its barrel; `scene.js` (already 3,518 lines) gains one call to create it
and one to update it and loses the garrison wiring it has now.

### 1. The ground keeps its film's war (`galaxy/siteWar.js`)

As the ground-sides spec's section 1. `SITE_WAR[sysId]` gives each world
the war its film is set in (`clone`: Geonosis, Kamino, Kashyyyk,
Mustafar, Naboo, Coruscant; `gcw`: Tatooine, Hoth, Endor, Yavin, Bespin,
Scarif, Dagobah; `remnant`: Nevarro, Sorgan, Mandalore, Lothal).
`oathIn(a, war)` in `allegiance.js` is your oath in that war.
`groundEffects(sysId, a, now)` is `effectsFor(sysId, warNow(now, war),
oathIn(a, war))` plus `{ side, rank, war, control, front, attack }`,
`control` the holder's hold of the system (0 to 1) and `front` /
`attack` whether the war is fighting over it now, both from the war
table's row. The page and the flown landing both call it. A world not
in the table uses the theatre, as now.

### 2. Friend or foe (`ground/standing.js`)

As the ground-sides spec's section 2, plus the relation between any two
sides, which NPC-against-NPC needs:

- `SIDE_OF_KIND`: every trooper, droid and walker kind to a side of the
  site's war (`stormtrooper` the Empire's in the Civil War and the
  Remnant's in the Remnant War; `clone` the Republic's; `rebel`,
  `hothtrooper` the Rebellion's or the New Republic's; `battledroid`,
  `superdroid`, `droideka`, `dwarfspider` the Separatists'; `mercenary`,
  `weequay` the Hutts'). Natives are `native` with a `leans`.
- `relation(a, b, war)` → `'ally' | 'enemy' | 'neutral'` for two sides:
  the same side allies; the two sides of the war enemies; the Hutts
  enemies of both; a native allied to the side it leans to and neutral
  to the other; `null` (a civilian, an animal) neutral to all.
- `standingOf(npcSide, you)` → the same three for you, from `relation`
  with your oath: unsworn you are neutral to everyone, and everyone to
  you, except one that has been shot by you (section 6).

### 3. Turf: who holds which ground (`ground/turf.js`)

A site's ground is split into turfs, each a disc of ground one side
holds. A turf: `{ id, at: [x, z], r, holder, posts: [[x, z]], beats:
[[[x, z], …]], strength }`.

- `holder` is `'owner'` (whoever the war says holds the system),
  `'other'` (the war's other side), `'hutt'`, `'native'`, or a side id
  for a turf that is always one side's (Jabba's palace).
- A site may author `turf: [...]` with posts and beats drawn where its
  buildings are. Most will not: `turfsOf(site, effects, world)` derives
  them:
  - the **pad turf**: the owner's, round `site.land.at`, r 90, two
    beats and three posts placed as `garrison.js`'s `garrisonAt` places
    them now (so the pad looks as it did);
  - the **far turf**, only while the system is a front or under attack
    (`effects.front || effects.attack`): the other side's, r 110, its
    centre on the ring 220 to 300 m from the pad at the bearing furthest
    from the pad turf's posts, snapped to the flattest dry standable
    ground there (`sites/validity.js`'s `standable`, `terrain.js`'s
    heights), with three posts on its near edge facing the pad;
  - a **Hutt turf** on a Hutt-held world (owner is `hutt`): the pad
    turf's, with `mercenary` troops, and no far turf (nobody fights the
    Hutts on the ground).
- `strength` is the war's hold: the owner's turfs `control`, the
  other's `1 − control`, a fixed turf 1. It scales how many stand there
  (section 4) and how often they are reinforced (section 7).
- `holderSide(turf, effects)` → the concrete side id.
- `turfAt(turfs, x, z)` → the turf whose disc you are in, the nearest
  centre winning where two overlap, or null (no man's land).
- `frontBetween(a, b)` → the line where two enemy turfs' discs face
  each other: its middle point and direction, where patrols meet and
  where the director stages raids.

### 4. Population: the world fills in round you (`ground/population.js`)

The soldiers on the ground are not placed at once; cells of ground are
populated as you come near and let go of behind you, on
`runtime/chunkGrid.js`.

- `createPopulation({ site, turfs, effects, tier, rand })` → `{ update({
  x, z, heading }) → { make: [soldier specs], drop: [ids] }, roster,
  cellOf, died(id), cleared(cell) }`.
- Cells are 48 m square, radius 3 (so about 170 m round you, past
  which the fog has most worlds), hysteresis 1, at most 1 cell in flight
  (one cell's figures are asked for a frame; the scene makes one figure
  a frame, `deathstar/inside/scene/people.js`'s `MAKE`).
- `rosterFor(cell, turfs, effects, tier, rand)` is seeded by the site's
  seed and the cell key, so a cell is the same every visit, and gives
  the soldiers that stand in the part of a turf the cell covers:
  - a post's holders (two at a post, one on low);
  - a beat's patrol (a squad of three walking the beat, two on low),
    counted once, in the cell its first point is in;
  - fill, by density × strength: `DENSITY = { high: 3, mid: 2, low: 1
    }` a cell, as pairs behind cover (`lib/ai/spatial`'s `cover`
    against the front, when the turf has a front; else anywhere
    standable);
  - nobody in no man's land, nobody in water, nobody inside a solid
    (`standable`), nobody within 25 m of `effects.covertAt` (the spot a
    covert landing put you: section 8 sets it) on a world you landed
    covertly on (you are out of sight).
- The roster is kept for the visit: a soldier killed stays dead when
  its cell is dropped and loaded again (`died(id)`); one that walked
  into another cell is kept by the cell it is in now. The population
  cap is `POP = { ultra: 32, high: 28, mid: 18, low: 10 }` live at once;
  when the cells round you ask for more, the furthest from you are not
  made (they are made when you come nearer).
- A soldier spec: `{ id, kind, side, role: 'post' | 'patrol' | 'fill',
  at: [x, z], yaw, home: [x, z], beat?, turf, squad }`. `squad` groups a
  post's pair, a patrol, and a fill pair.

Quest spawns and the Battlefront assaults keep their own placing in this
design (section 9 says when they move); the population is the world's
own people at war, under and around them.

### 5. Soldiers: one model for everyone who fights (`ground/troops.js`)

- `TROOPS[kind]` → `{ hp, weapon, range, speed, cone, nerve, tall }` for
  every kind in `SIDE_OF_KIND`: `hp` 100 for a trooper (the assault's
  and the mate's scale), 160 for a super battle droid, 60 for a B1;
  `weapon` a key of `weaponRules.js`'s `WEAPONS` (the stormtrooper's
  `rifle`, the Rebel's `a280`, the clone's `dc15` (added: a burst of
  three), the B1's `e5` (added: slow and wide), the mercenary's
  `westar`); `nerve` how much its squad's confidence moves it (a droid
  never breaks); `cone` and `range` its senses (`hostiles.js`'s
  `sensesFor` reads them).
- `newSoldier(spec, rand)` → `{ id, kind, side, hp, hpMax, weapon, b: {
  x, z, yaw }, home, leash, beat, mode, mind, beliefs, squad,
  suppressed, heat }`.
- `damageOf(weapon, dist)` the hit's damage from the weapon's row,
  falling past two thirds of its range; `hurt(s, damage)` → `'hurt' |
  'down'`; the shield and the parry stay `hostiles.js`'s.
- The one kind-to-weapon table. `activity.js`'s `ARMS`, `garrison.js`'s
  `FAMILIES` and `needs.js`'s `SOLDIERS` read from it in the PR that
  adds it (same values, their own names kept as re-exports), so there is
  one place.

### 6. The fight: everyone chooses among everyone (`ground/fight.js`)

`hostiles.js`'s `hostileStep` is the base, generalised from "you" to
"whoever is hostile":

- `senseAll(s, world, dt)` runs `lib/ai/perception`'s `sense` over
  every live body within 1.3 × range (you, your companion, every
  soldier of every side, a quest's targets), the world's solids its
  line of sight. Each belief carries the body's `side`; `relation`
  with the soldier's own side says whether it is a threat.
- `threatOf(s, belief)` orders the threats: shooting at it or its squad
  first, then nearest, then whether it has a line; a target it is
  already on keeps a little momentum. **An unsworn you is neutral until
  you shoot at or within 2 m of a soldier, then its squad counts you an
  enemy for `GRUDGE = 90` seconds.**
- `fightStep(s, world, dt, rand)` → `{ x, z, yaw, mode, moving, aim,
  fire, guessed }`: the utility pick `hostileStep` makes (hold, strafe,
  close, back, cover, flank, look, search, and `patrol` and `post` for a
  soldier with nobody to fight), with these added from the ground-sides
  spec's section 6:
  1. **No shot without a line**: `fire` only with a clear line to where
     the target is believed to be and facing it within 25°; it turns
     first. Lost, one short burst at the last place (suppression).
  2. **Close to range**: a target seen beyond range is advanced on;
     once engaged the leash is `roam + range` for the fight.
  3. **Aim with error**: `aimError(s, target, dist)` → radians: the
     weapon's spread × (1 to 2.2 by range) × (1 + the target's speed
     across its view / 6) × (1 + suppressed) and × 1.5 on the first
     shot of a burst.
  4. **Suppression and morale**: a bolt passing within 2 m sets
     `suppressed` for 1.5 s (worse aim, cover weighed higher). The
     squad's confidence is `lib/ai/squad`'s, from what is left of it
     against what it faces, kills and losses fading; its posture
     (`form`, `hold`, `retreat`, `press`) gates the options: a
     retreating squad's soldiers take `back` and `cover` only, in
     halves (`withdraw`); a pressing one sends `flankers` and its
     furthest `advance`. A leader down drops a bin (`morale`).
  5. **Tokens per target**: `squad.createTokens`, pools `shot` (3) and
     `melee` (1) **per target id**, so three may shoot at you while
     three others shoot at your companion; one scalar `scale` from the
     tier is the difficulty of every pool.
- `squadsOf(soldiers)` keeps `lib/ai/squad`'s `createSquads` (reach 18
  m) per side, merging and splitting as they move; a patrol is one from
  the start.
- Brains are staggered: each soldier rethinks every `STEP.rethink` (0.4
  s) on its own phase, senses every 0.1 s, squads update every 0.5 s,
  so a frame runs at most a quarter of the brains. Soldiers past 120 m
  from you are not stepped (the cell holds them where they are); between
  60 and 120 m they sense and move but their fights are settled by the
  cheap rule in section 7.

### 7. Bolts that fly, and the director's war (`ground/bolts.js`, `ground/director.js`)

**Bolts.** A soldier's shot is a bolt that flies, as on the Death Star
(`combat.js`), never a probability roll: `createBolts()` → `{ fire({
from, dir, speed, side, owner, damage, range }, rand) → bolt, step(dt, {
bodies, seesThrough }) → events }`, every bolt swept the whole of its
step (`blaster.js`'s `sweptHit`, pure) against every body within its
reach and stopped by the first solid (`walker.js`'s `lineClear`). Events:
`hit` (bolt, target, point, dir), `wall` (point), `near` (a body it
passed within 2 m of: suppression). Your own bolts keep `blaster.js`'s
`fire` and hit any side's soldier through the same `targets` list
(`{ x, y, z, r, hit }`) `activity.js` exposes now; the population
exposes the same shape. A soldier's bolt at you is handed to
`blaster.enemy` as now, so your saber and shield rules are untouched.
Beyond 60 m from you a fight between soldiers is settled without bolts:
`farExchange(a, b, dt, rand)` rolls each shot's hit by the same
`aimError` and `damageOf`, so a fight on the ridge comes out the same
whether you watched it or not.

**The director.** `createDirector({ turfs, effects, tier, rand })` →
`{ update(dt, { you, population, squads }) → events }` runs the ground
war on a clock:

- **Patrols** walk their beats; two enemy patrols within sight of each
  other fight where they meet. The beats of a turf with a front are
  bent (`turf.js`) so one point lies on the front: contact is regular,
  not lucky.
- **Raids**: while the system is a front or under attack, every `RAID
  = 150` seconds (× `1 / strength` of the attacker's turf), a squad of
  four from the far turf is made at its near edge (through the
  population, counted in its cell) and sent at the nearest owner post:
  `press` posture from the start, `squad.frontline` between it and the
  post's holders. A raid that takes a post (every holder down) holds it
  until the owner's reinforcement arrives; the post's `holder` flips in
  the turf for the visit, and the HUD says so.
- **Reinforcement**: a post with everyone down, or a cleared cell, is
  filled again after `REINFORCE = 120` seconds (÷ strength): a squad
  walks in from the turf's nearest other post (or its edge), never pops
  in sight. Never within 60 m of you in view.
- **Hunts**: on a world whose holder is your enemy, the first soldier
  to have you (`!`) calls its squad; a probe droid's sighting (the
  garrison's, as now) calls the nearest patrol to where it saw you.
  Hunts stop when nobody has believed you for 20 s.
- **Caps**: at most two live fights (squads engaged) at once within 200
  m; the director does not start a raid while two are running. Nothing
  is simulated in cells that are not loaded.
- Events for the HUD: `{ type: 'contact' | 'raid' | 'post-lost' |
  'post-held' | 'hunt' | 'calm', side, at }` to `runtime/hud`'s Toast
  and Objective ("Rebels are raiding the north post", "Imperial patrol
  ahead"), one at a time, a toast at most every 12 s.

### 8. Where you set down, and how they treat you (`ground/landing.js`, `garrison.js`)

As the ground-sides spec's sections 3 and 4:

- `landingFor(site, effects, world)` → `{ at, yaw, covert, line }`: on
  your side's, a neutral, or an unsworn world `site.land`; on the other
  side's `site.covert` or `covertFor` (the flattest dry standable spot
  on the ring 150 to 220 m round the pad, furthest from the pad turf's
  posts, out of their line of sight). The line says so ("Imperial-held.
  We set down out of sight of the garrison.").
- The garrison is the pad turf's population. Friendly (your side's
  world) it salutes by rank and shows Talk; neutral (unsworn, the
  Hutts') it says "Move along" and watches; hostile it is section 6's
  soldiers from the start.
- `garrisonAt` goes: `garrison.js` keeps `garrisonLife` (re-dressing
  **unnamed** troopers only) and `troopKind`, and gains `padTurf(site,
  effects, faction)`, the derivation section 3 uses, placed as
  `garrisonAt` placed its people, so the pad looks the same.
  `garrisonQuest` goes (the film's war makes every quest's kinds the
  right era).

### 9. The old stacks, and what moves onto the new one

- **PR order** (the plan): sides and landing; turf and population with
  the fight against you; bolts, NPC-against-NPC and the director; then
  the migrations below, each its own PR.
- **Quest hostiles** stay on `activity.js` until the fight is proven;
  then `activity.js` makes its targets as `troops.js` soldiers and steps
  them with `fight.js` (their `hostile` spec's numbers winning over the
  kind's), and the roll at `scene.js:2886` goes. Their hp scale (1 to
  12 in the specs) is mapped by `hpOf(spec)` = spec.hp × 10 at that
  point, so no site file changes.
- **The companion** (`scene.js`'s `mateFight`, 160 lines) becomes a
  soldier of your side on the population with `role: 'mate'`: it
  chooses targets by section 6 and is shot by bolts, not grazes.
- **Assaults** keep `assault.js`'s rules (tickets, waves, posts) and
  take `troops.js`'s numbers, `bolts.js`'s bolts and `fight.js`'s line
  of sight and aim error, so the two armies and the population are one
  fight; Kashyyyk's assault (the ground-sides spec's section 8) is
  authored as far turf + assault map in that PR.
- **Talk and quests by side** (the ground-sides spec's section 5):
  with the migration of quest hostiles, since it needs the giver's side
  on the quest.

### 10. Bodies: rigged, budgeted, and falling (`ground/groundScene.js`)

The one three.js module of the folder composes it:

- Figures through `actors.js`'s `anyFigure` (walkers, the crew's rigged
  troopers, catalogue models, built figures), the one resolver;
  `activity.js`'s own resolver is retired in section 9's migration.
  Figures are pooled by kind: a dropped cell's figure is hidden and
  reused for the next of its kind, so a patrol crossing a cell boundary
  costs nothing.
- Animation on the site's animator through `figureCalls.js`'s
  `animatorCalls`, the body from `lib/ai/body`'s `bodyFrom` with
  `hostiles.js`'s `HOSTILE_BODY` table (plus `patrol` and `post` rows),
  reactions from `lib/ai/react` (`hit.chest` / `hit.head` by where the
  bolt landed; `die.fwd` / `die.back` / `die.blown` by its direction).
  Guns in hand through `universe/gunplay`'s `createGunplay` where the
  figure has a `RightHand` bone, as the quest hostiles have now.
- `lib/three/animBudget`'s rate per figure (near 12 m, far 40 m, `max`
  the tier's `POP`); `lodPick`'s live / still / hidden split, moved from
  `deathstar/inside/scene/people.js` to `src/lib/three/lodPick.js`
  (both worlds import it from there, the "something two worlds need
  moves down" rule).
- **Deaths**: within 40 m on high and ultra, a soldier that goes down
  is let go as a ragdoll (`rigRagdoll`, `collide` from the world's
  `heightAt` and solids, `push` the bolt's direction, `speed` by its
  damage), at most 4 live ragdolls at once (a fifth takes the clip);
  further off, or on mid and low, the direction's die clip; settled it
  is still, lies `DEATH.lie` and sinks, as now. A dead figure's pose is
  frozen and its animator stopped (it costs nothing).
- Frame budget: the folder's `update` is measured in `scripts/galaxy-check.mjs surface`
  with `BUDGET=`; the target is **2 ms a frame on high with POP live**,
  the animator's time apart. A brain over budget is the stagger's job
  (section 6), not a reason to raise the budget.

### 11. A guard against "no enemies came" (`sites/validity.test.js`)

The existing test grows:

- every derived turf's posts and beats are standable, dry and outside
  solids, on every site, in every war it can be in (owner the
  liberator, the raider, the Hutts), front on and off;
- the far turf is at least 160 m from the pad and its centre's line to
  the pad's nearest post is longer than every soldier's sight range;
- a covert landing is standable, dry, and out of every pad post's line
  of sight;
- every roster soldier of every cell within radius of the pad is
  standable;
- no two posts within 8 m of each other.

## Testing

- Node, beside each file: `siteWar`, `groundEffects`, `standing`
  (`relation` over every pair of sides in every war, natives, the Hutts),
  `turf` (derivation on a fixture site, `turfAt`, `frontBetween`,
  strength from control), `population` (a walk across cells: made, kept,
  dropped, dead stay dead, the cap), `troops`, `fight` (line of sight
  gating, aim error, suppression, posture gating, target choice among
  three sides, the grudge), `bolts` (a bolt stopped by a wall, a hit
  swept across a long step, `near`), `director` (a raid staged on the
  front, a post lost and held, reinforcement never in view, the caps),
  `landing`, and the validity test over every site.
- `test:ai`: `ground/ground.scenario.test.js`, headless on the rules
  alone: a Rebel on Imperial Endor (covert landing, a patrol that finds
  you, a hunt that gives up), a Rebel on Rebel Hoth (salutes, nobody
  fires), unsworn on Tatooine (neutral until you shoot), a front on
  Hoth (a raid reaches a post, the post is lost, reinforcement retakes
  it) and two patrols meeting on the front with you 150 m away (settled
  by `farExchange`, the dead counted).
- Browser: `scripts/galaxy-check.mjs surface` with `BUDGET=` on Endor,
  Hoth and Tatooine, high tier, before and after each PR: frame time,
  draws, triangles; `autopilot-check.mjs --only smoke`;
  `assault-check.mjs` unchanged until section 9's assault PR.
- A repair changes no pixel: the pad turf's people are placed as
  `garrisonAt` placed them, checked by the before and after shot of the
  landing on Tatooine.

## Out of scope

- New models or clips (the rigged troopers in `crewList.js` are enough;
  a kind with no rigged model gets `figures.js`'s built one, as now).
- Vehicles and walkers in the fight (they stay `actors.js`'s).
- Online: the population is per browser; peers see each other, not each
  other's soldiers (as the quest hostiles are today).
- Navmesh or flow fields: steering is `lib/ai/steer` with `pushOut`
  against solids, as the research chose.
- The look (the ground-sides spec's section 7) and layouts (section 9).

## Open branches that touch the same files

Checked at `e3cd53e9`, unmerged branches that change the files this
design touches:

- `claude/festive-meitner-ctyhqf` (PR #453): `activity.js`,
  `missions/assault.js`. Its own Kashyyyk skirmish engine, far behind
  main; the ground-sides spec already supersedes it. Not merged in.
- `claude/game-layout-textures-ai-7a0553`: `activity.js`, `garrison.js`.
  Check its PR before the population PR (section 4); if it is still open
  and alive, merge main into it first or take its garrison change here.

`scene.js` is touched by most surface work; keep the change there to the
two calls and the removed garrison wiring, and merge main before each PR.
