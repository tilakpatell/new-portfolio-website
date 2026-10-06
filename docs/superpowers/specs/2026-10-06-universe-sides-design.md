# Sides: each crew's own universe of enemies and allies: design

Date: 2026-10-06. Status: written from the user's request; built in parts,
each its own PR, merged as they land.

## Intent

What the user said: "Right now when we switch characters from Breaking Bad
to Star Wars to Rick and Morty make them all have very unique and a lot of
enemies and allies and make the universe actually like a universe.
Architect how we can add other characters and NPCs in depth with their own
smart game logic and AI."

What that means here: the universe map (`src/components/universe/`) is
flown with one of four crews (`crews.js`: Rick and Morty in the cruiser,
Luke and Artoo in an X-wing, Han and Chewie in the Falcon, Walt and Jesse
in the RV). Who comes after you, who helps, who passes by and what the
director sets going depends on a `family` string ('starwars', 'rickmorty'
or 'both') that is hard-coded in seven places (`scene.js`'s `FAMILY`,
`SIDES` and `AHEAD`; `traffic.js`'s `FAMILY`, `KINDS`, `CIVIL`, `ESCORT`
and `DISTRESS`; `director.js`'s `EVENTS[].families`; `hunterRules.js`'s
`FACTIONS[].family`; `leviathans.js`'s `pass`; `footScene.js`'s squads,
which are always the Federation's). Walt and Jesse's RV is 'both': Breaking
Bad has no universe of its own. The Empire is three fighter kinds and
Vader; the Federation is one patrol fighter and the Council. Allies are a
wing of X-wings or Birdperson, nobody else.

Done looks like: pick a crew and the whole map is theirs. Walt and Jesse
are chased by the DEA, the cartel and Gus's people, helped by Saul, Mike
and the boys, and pass Pollos trucks and Madrigal freighters. Luke and Han
meet an Empire with bombers and gunboats, four bounty hunters and pirates,
and are covered by Y-wings, A-wings and Rogue Squadron. Rick and Morty are
hunted by Gromflomite gunships, the Council, Evil Morty's guard and the
Zigerions, helped by Birdperson, Squanchy and Mr. Poopybutthole. And every
one of those is one data entry away from the next: a new enemy, ally,
civilian, set piece or character is a row in a registry with its own
behaviour hooks, not another `if (family === …)`.

## Decisions

Made for the user, who asked for this to be done without checking in.

- **A side is data; the systems read it.** One registry,
  `universe/sides.js` (pure, tested), says for each crew's side everything
  the map needs: its hunter factions by role, its allies, its civilians,
  its set pieces, its leviathan, its ground troops, its names and colours.
  Every system that today switches on `family` takes its answer from the
  side instead. `'both'` goes away: the RV is `breakingbad`.
- **No new downloaded models in this lane.** Every new ship is built in
  code with `trafficKit.js`, as the Federation's and the Empire's are. A
  later lane may swap in Sketchfab or Meshy models through `glbFleet.js`'s
  `built: true` stand-ins (the same way the X-wing and the interceptor are
  loaded over their built ones); nothing here waits on that.
- **The hunters' flight rules stay one engine.** `hunterRules.js`'s
  `createHunt` already takes `factions` and `kinds`; a side's factions are
  passed in. New behaviour (a bomber's run, a gunboat holding off, a
  pirate who leaves when hurt, the Cousins who never fire first) is a
  per-kind `trait` the engine reads, tested as pure rules, not a fork.
- **Characters are NPC specs with brains.** A named character (Saul, Mike,
  Boba Fett, Birdperson, Squanchy, Evil Morty) is an entry in
  `universe/npcs/` with a `brain` (a small state machine the engine runs
  per frame on plain numbers), its lines, its ship or figure, and its
  relationships (who it fights, who it helps, who it runs from). One
  engine, `universe/npcRules.js`, runs every brain the same way; the
  drawing never decides anything.
- **Lines are keyed by what the side names.** `crews.js` gains lines for
  every faction, ally and event its side can bring, and `crews.test.js`
  checks that against `sides.js`, so a new faction without a line is a red
  test, not a silent comms box.
- **The wire stays small.** `online/protocol.js`'s hunter whitelist is
  built from `sides.js`'s kinds, so another pilot's new hunters draw
  right. Nothing else changes on the wire.

## The parts

### 1. The registry (`universe/sides.js`, tested)

```js
export const SIDES = {
  starwars: { label, crews: ['xwing', 'falcon'], factions, allies, civil, convoy, distress, escort, pieces, leviathan, troops, bounty, pirates, ahead },
  rickmorty: { … crews: ['cruiser'] … },
  breakingbad: { … crews: ['rv'] … },
};
export const sideOf = (crewId) => side id or null;
export const factionsOf = (sideId) → hunterRules-shaped FACTIONS (for createHunters);
export const kindsOf = (sideId) → HUNTER_KINDS (merged, for createHunters and the wire);
export const allKinds → every hunter kind on every side (the wire's whitelist);
export const pick(side, role, rand) → a faction id for 'hunt' | 'bounty' | 'pirates' | 'capital';
```

- `factions`: `{ id: { kinds: [[kind, weight]…], ace, laser, size, role: 'hunt' | 'bounty' | 'pirates' | 'capital', portal?, trait? } }`.
  Hunt factions are what the director's `hunt` sends (weighted by `weight`);
  `bounty` is one tough one alone; `pirates` is who attacks someone in
  distress; `capital` is the one a capital ship launches.
- `kinds`: the side's own `HUNTER_KINDS` rows (`size, speed, accel, hp,
  fire, tail, lead, spread, trait`), named in `names`.
- `allies`: `{ kind: { speed, accel, turn, fire, spread, size, colour, who } }`,
  wingRules-shaped; `wingOf(side, rand)` picks one for a long fight.
- `civil`, `convoy`, `escort`, `distress`: traffic kinds, as `traffic.js`
  has them today, per side.
- `pieces`: which set pieces this side can have (`destroyer`, `council`,
  `roadblock`…) and what each launches.
- `leviathan`: `'purrgil' | 'cromulon' | 'bear'`.
- `troops`: `foot.js`'s `TROOPS` rows by kind, and `squads(n)` → which
  kinds come on the n-th squad.
- `ahead`: what to build ahead (scene's `AHEAD`).

Tests: every crew has a side; every kind a faction names is in `kindsOf`
and `names`; every faction has a role; `pick` never returns a faction of
another role; `allKinds` has no duplicates with different stats; each side
has at least one hunt faction, one ally, one civil, one distress and one
escort kind; every troop kind has a `TROOPS` row.

### 2. The sides' content

**Star Wars** (`xwing`, `falcon`). Hunters: the Empire (TIEs, interceptors,
TIE bombers with a slow heavy run that drops a bomb that bursts in your
path; Vader as ace), an Imperial gunboat (tough, holds range, a capital's
launch), bounty hunters one at a time (Boba Fett in Slave I as now; IG-88
in the IG-2000, Bossk in the Hound's Tooth, Dengar in the Punishing One,
each built in code), pirates (Weequay skiffs on a freighter in distress).
Allies: X-wings (Red Two), Y-wings (Gold Squadron: slow, their bolts hit
hard), A-wings (Green Squadron: fast, strafe and leave), and Rogue
Squadron's lead who calls out. Civilians as now. Set pieces: the Star
Destroyer; a Nebulon-B frigate on your side that drops in behind you in a
long fight and its wing launches. Leviathan: purrgil.
Troops on foot: stormtroopers (rifle), scout troopers (pistol, quick),
and a probe droid that calls them in (built figures on the shared skeleton
as Luke and Artoo are: `footScene.js`'s `built`).

**Rick and Morty** (`cruiser`). Hunters: the Federation (patrols;
Gromflomite gunships, tough, that hold off and pour fire), the Council of
Ricks (as now, out of portals), Evil Morty's guard (Morty fighters in
yellow, quick, that swarm) with Evil Morty's own ship as ace, the
Zigerions (a simulation ship that flickers and vanishes when hit, hard to
lock), bounty: Phoenixperson as now, and Krombopulos Michael (one ship,
never fires until you do). Pirates: Gromflomite bugs as now. Allies:
Birdperson, Squanchy's ship (close in, hard-hitting), Mr. Poopybutthole's
little ship (fast, cheerful, leaves soon). Civilians as now. Set pieces:
the Council's portals; a Federation cruiser that drops in and launches
gunships. Leviathan: the Cromulon. Troops: the Federation's as now, plus
Evil Morty's Morty guard (Meshy: `evilmorty` body from the wardrobe,
yellow).

**Breaking Bad** (`rv`). The RV has wings now, so everyone in Albuquerque
has them too: a winged SUV, a lowrider with a jet, a Pollos truck with
rockets. Hunters: the DEA (Hank's black SUVs in twos and threes, white
roof-light bar, blue laser; Hank's own SUV as ace, with a spotlight that
pins you), the cartel (Tuco's lowriders, quick and wild, a wide spread;
the Cousins' Mercedes as a bounty pair that never fires first: they close,
tail, and fire only once you've fired), Gus's people (Pollos Hermanos box
trucks with rocket packs, tough, holding range, launched by the Madrigal
freighter set piece; Gus's Volvo as a quiet ace), Jack's gang (pickups,
pirates on a freighter in distress). Allies: Saul's white Cadillac on your
wing ("Better call Saul"), Mike's sedan (slow, every shot counts), Badger
and Skinny Pete in a beater (chatty, miss a lot). Civilians: Pollos
trucks, Madrigal freighters, a Vamonos Pest van, hot-air balloons from the
fiesta drifting high over the map (big, slow, one at a time). Set pieces: a
DEA roadblock (SUVs and a helicopter with a searchlight drop in ahead and
interdict you); a Madrigal freighter jumping in and launching trucks.
Leviathan: the pink teddy bear, one eye, drifting past, that the crew have
a word about. Troops: DEA agents (vests, pistols, Albuquerque's `hank.glb`
kind), cartel gunmen (Tuco's, rifles), and Jack's crew.

Every crew says something for each faction (`hunted`), ally (`wingmen`),
set piece, leviathan and troop kind its side can bring; the test says so.

### 3. Rewiring the systems

- `scene.js`: `FAMILY`, `either`, `SIDES`, `AHEAD` go; `sideOf(state.kind)`
  gives a `side` object and every call reads it. `createHunters` is made
  with `factions: factionsOf(all)` and `kinds: kindsOf(all)` (all sides, so
  another pilot's hunters draw whoever they are). `happen` picks by role.
- `director.js`: `EVENTS[].families` becomes `EVENTS[].needs` (`'hunt'`,
  `'capital'`, `'council'`…) and `update` takes `{ side }`; an event comes
  when the side has what it needs. Tested as now, by side.
- `traffic.js`: `KINDS`, `CIVIL`, `ESCORT`, `DISTRESS` read the side.
- `wingmen.js`/`wingRules.js`: `WING_KINDS` from `sides.js`'s allies.
- `leviathans.js`: `pass(ship, side)`; the bear is a new builder.
- `skirmishes.js`: `start` takes the side's `{ faction, escort, civil }`.
- `footScene.js`: squads from `side.troops`; the cast loads the side's
  figures; `TROOP_GUN` from the troop row.
- `hunterRules.js`: `trait` on a kind: `'bomber'` (a slow straight run that
  drops a bomb: a slow laser with a burst radius), `'holdoff'` (fires from
  range, never closes under `near × 2`), `'spotlight'` (pins the HUD: an
  event the scene scrambles the lock on), `'quietUntilFired'` (no shots
  until you've hit one of its pack), `'flicker'` (a hit has a 50% chance to
  make it untargetable for two seconds). Each a pure rule with a test.
- `online/protocol.js`: the whitelist is `allKinds`.

### 4. NPCs with their own logic and AI (the way in for new characters)

A named character is more than a hunter kind. `universe/npcs/index.js`
registers each one:

```js
{
  id: 'saul', side: 'breakingbad', role: 'ally' | 'enemy' | 'neutral',
  ship: 'saulcaddy' (a built kind) | figure: 'saul' (a Meshy cast kind, on foot),
  brain: 'wingman' | 'bounty' | 'merchant' | 'informant' | custom id,
  relations: { likes: ['rv'], fears: ['dea'], hunts: [] },
  lines: { hello, hit, leaving, seen, dead } (by crew),
  stats: { speed, accel, turn, hp, fire, spread },
}
```

`universe/npcRules.js` (pure, tested) runs every brain as a state machine
over plain numbers each frame: `createBrains({ rand })` → `add(npc, at)`,
`update(dt, world)` → events, where `world` is `{ you, hunters, allies,
traffic }` as positions and velocities. Brains ship with the engine:

- `wingman`: wingRules' flight (join, cover, pass, rest, leave).
- `bounty`: hunterRules' flight, alone, `quietUntilFired` optional.
- `merchant`: parks at a station, offers a trade on the radio when you're
  near (the hangar's parts), runs from a fight.
- `informant`: flies to you, says where the next event is, leaves.
- `rival`: another pilot's shape: dogfights you to a draw, then leaves.

Every brain reads only `world` and its own state, returns intents
(`{ thrust, turn, fire, say }`), and the scene draws and voices them. A
new character is a registry row and, at most, a new brain file with a
test. Relations feed the engine: an NPC that `fears` a faction leaves when
it arrives; one that `hunts` one goes after it (the skirmish engine,
generalised).

### 5. Scope by lane

- **Lane A (this PR): the registry and the rewiring.** `sides.js` with the
  three sides' data, `scene.js`, `director.js`, `traffic.js`, `wingmen.js`,
  `leviathans.js`, `skirmishes.js`, `footScene.js` and `protocol.js` read
  it; Breaking Bad's first ships built in code (`fleetBreakingbad.js`:
  the DEA SUV, Hank's SUV, the lowrider, the Pollos truck, Saul's Cadillac);
  lines for all of it; tests green.
- **Lane B: the sides' depth.** The rest of the built ships (the bounty
  hunters, the gunboat, the bomber, the Morty fighters, the Zigerion
  ship, Squanchy's and Mr. Poopybutthole's ships, Mike's sedan, the beater,
  the balloons, the pink bear), the traits in `hunterRules.js`, the new set
  pieces, the ground troops per side.
- **Lane C: NPCs.** `npcRules.js` and the first five brains; Saul, Mike,
  Fett, Birdperson, Squanchy, Evil Morty as registry rows; the merchant and
  the informant on the map.

## Not in scope

The galaxy (`src/components/galaxy/`) keeps its own `hunted.js` factions;
it may import a side's later. No Star Wars after Return of the Jedi beyond
The Mandalorian and Ahsoka. No new content in `src/data/`.
