# Ship contact: hitting a ship does something

Date: 2026-10-09. The owner's ask: "if we hit a ship, it does stuff like collisions", across the site, the worlds and the games. This is the design; the plan is `docs/superpowers/plans/2026-10-09-ship-contact.md`.

## What exists today

The site has one flight simulation, `src/components/universe/ship.js`, flown on two maps: the universe map (`universe/scene.js`) and the Star Wars galaxy (`galaxy/scene.js`). Everything the owner can fly into on those maps falls into three groups, and only the first two do anything on contact:

| what you fly into | today | where |
| --- | --- | --- |
| planets, stars, moons, wonders, the Citadel, the Death Star | a bump under 2.4 units a second of closing speed, a crash over it (`SHIP.crash`), through `step(ship, input, dt, solids)` | `ship.js:545-590`, `scene.js`'s `startCrash` |
| rocks (the belt, the rim, the debris streams) | swept each frame against a grid; a bump at the boost or under, shields off above it, the ship slowed, the rock gone a minute | `universe/rockHits.js`, `scene.js`'s `rocksHit` |
| the galaxy's battle capital ships | their hull spheres are solids (`galaxy/warfront.js`'s `hulls()`), so a planet's rule | `warfront.js:303-306` |
| **every other ship** | **nothing: you fly through it** | |

"Every other ship" is a long list: hunters (TIEs, interceptors, Vader, the Federation's patrols, the Council's cruisers), the ordinary traffic (freighters, saucers, X-wings in formation, a Star Destroyer high over the map), wingmen, the ships of someone else's skirmish, the named characters' ships, other pilots online and the hunters after them, the fleet war's fighters at the front, the director's capital ship dropped out of hyperspace beside you, the Rick and Morty sector's standing fleet, the galaxy's Interdictor. Two of these already reach you the other way round: a hunter with the `rammer` trait bursts on you (`hunterRules.js:1112-1116`), and a TIE in the trench run rams at `TRENCH.tie.ram`.

Games with ships of their own kind already collide: Dead man's tide's ships ram each other at sea (`caribbean/tide/rules.js`'s `collide`), the trench run's X-wing hits walls, catwalks, turrets and TIEs (`deathstar/trench.js`), Cybertron's vehicles bump (`cybertron/game/rules.js`). C-137's cruiser flies a street with a Federation ship on its tail (`rickmorty/world/ship.js`) and the two never touch; the cockpit page and the cruiser scroll page are not flown. None of those is in this design.

## Goal

On both flight maps, flying your ship into any other ship does what flying into a rock or a planet does, scaled to what you hit:

- **A glance** (closing slowly, under `CONTACT.soft`): the ships are kept apart, your speed takes a small cut, a soft bump sounds, the crew say nothing.
- **A ram** (closing faster, under a crash): sparks where you met, your shields take a hit that grows with the closing speed and the other ship's size, your ship is thrown back under the boost, the camera shakes and flares, the crew say their bump line. The other ship takes the hit too: a fighter or a small ship goes up (a kill, with everything a kill means today: the pop, the fire, the crew's line, heat, standing, the law), a tougher one takes hits as if shot and flies on.
- **A crash** (closing over `SHIP.crash` into something big: a capital ship, a sector battleship, a Star Destroyer in the traffic): the planet's crash, played on its hull, and the way back as ever.

The ships' own feel stays as the game-feel design (`2026-10-08-game-feel-design.md`, lane 2C) will set it: this design uses the scene's `shake`, `flare` and `kick` as the rocks do and adds no hitstop of its own.

## Not in this design

- The other ship being pushed or steered off by the contact. A hunter, a traffic ship or a pilot flies on as its own rules say; only your ship is moved. Hunters already have `pull` and `breakOff` for the powers, and a later change may knock them with it.
- Telling another pilot that you rammed them. The protocol believes a hit only from a pilot who fired a shot that passed near (`online/protocol.js`'s `aimedAt`), so a ram comes off your shields only. A `ram` wire action is a protocol change for another day.
- C-137's cruiser and the Federation ship, the cockpit page, the cruiser scroll page.
- Changing anything in the games that already collide (the tide, the trench run).
- Hitstop, dust and sound by force on these maps: lane 2C's.

## The shape

Three pieces, one pure and shared, one a world's collector, one wiring in each scene. No new dependency.

### 1. The law: `src/lib/combat/contact.js` (pure, tested)

What a contact between two ships is and what it does, with no three.js and nothing of either map, so the galaxy and the universe share it and both are tested in Node.

```
CONTACT = {
  soft: 1.3,     // closing speed (units a second) under which it's a glance (SHIP.crash's 2.4 × 0.55, as a planet's soft bump)
  crash: 2.4,    // and over which a big ship is a crash (SHIP.crash; a small ship is never a crash)
  base: 6,       // shields a ram takes, at least
  perSize: 7,    // and for each unit of the other ship's size (its length, as the fleets give it)
  perSpeed: 0.5, // and for each unit a second of closing speed past `soft`
  most: 45,      // at most (ROCK_HIT.most)
  cool: 0.35,    // seconds after a contact before another with the same ship counts
  slow: 0.3,     // the share of your speed kept after a ram (ROCK_HIT.slow)
  glance: 0.85,  // and after a glance
  punchEvery: 5, // a ram is worth one hit on the other ship, and one more for each of these units a second past `soft`
  punchMost: 4,
}
bodyRadius(size) → size × 0.5 + 0.08        // a ship's body for contact (tighter than hunterRules' hitRadius, which forgives a laser)
sweptSpheres(a0, a1, b0, b1, r) → k | null  // targeting.js's sweptHit, for { x, y, z } points or [x, y, z] arrays; targeting.js re-exports it
closingSpeed(vYou, vThem, normal) → units a second along `normal` (from them toward you), 0 when parting
contact(into, size) → { kind: 'glance' | 'ram', damage, punch, keep }
  // glance: damage 0, punch 0, keep CONTACT.glance
  // ram: damage = min(most, base + perSize × size + perSpeed × (into − soft)), punch = min(punchMost, 1 + floor((into − soft) / punchEvery)), keep CONTACT.slow
```

A big ship (a capital, a battleship, a Star Destroyer, the Interdictor) is not a body for this law at all: it is a solid, and `ship.js`'s `step` already plays a planet against it (the push out, the bump, the crash). That is deliberate: one rule for "too big to move", and the galaxy's battle hulls already work this way.

### 2. The collector: `src/components/universe/shipHits.js` (no three.js, tested with fakes)

One sweep of your ship's way this frame against every small ship the scene has, whichever system flies it.

```
createShipHits({ sources, cool = CONTACT.cool }) → { sweep(before, after, dt, now) → hit | null }
hit: { body, k, at: { x, y, z }, normal: { x, y, z }, into, outcome: contact(into, body.size) }
```

`sources` is a list of functions, each answering this frame's bodies from one system:

```
body: { key, id, kind, at: { x, y, z }, prev?: { x, y, z }, vel?: { x, y, z }, size, r?, side: 'foe' | 'friend' | 'civil' | 'law' | 'pilot', hit(punch) → { down, at, size, kind, civil? } | null }
```

- `at` is where it is now and `prev` where it was last frame (`at` again if the system keeps no last place); `vel` is read when there is one, else taken from `prev` and `dt`.
- `r` is its body; `bodyRadius(size)` when left out.
- `hit(punch)` is the system's own way of taking a ram's hits: the same path a shot takes (`hunters.damage(id, n)`, a traffic member going alive false and its model given back, a skirmish or NPC `hit`), so a kill by ramming pays, counts and is said exactly as a kill by shooting. A pilot's `hit` tells nobody (see Not in this design) and answers `null`.
- The sweep tests `sweptSpheres(before, after, body.prev ?? body.at, body.at, body.r + SHIP.radius)` for each body whose `at` is within `reach` of `after` (`reach` = the longest body radius plus the frame's way, so a fast frame still finds what it passed), takes the earliest `k`, skips a body whose `key` is within `cool` of its last contact, and answers one hit a frame at most. A `friend` body is swept too: a wingman is something to bounce off, but the scene never hurts one (its outcome is forced to `glance`).

Every system that flies ships gains a `bodies` getter (or `bodies(p, r)` where it already filters by distance) answering that shape, each a few lines reading what it keeps, and each tested beside the file:

| system | bodies from | side | `hit(punch)` |
| --- | --- | --- | --- |
| `universe/hunters.js` | `hunt.live`: alive, not gone, not hidden, **not a `rammer`** (its own burst stands) | foe | `hunt.damage(id, punch)` |
| `universe/traffic.js` (`bodies(p, r)`) | the live groups' members within `r`, as `near` does, **small ones only** (`!type.big && size ≤ 2`) | civil, law or foe as `near` tells them | the member goes down as `hit` does (`alive` false, the model given back) |
| `universe/wingmen.js` | `wing.live` | friend | null |
| `universe/skirmishes.js` | the skirmish's hunters, its escort and the freighter | foe, friend, civil | `sk.hit(before, after, punch)` |
| `universe/npcs.js` | `brains.live` | foe when `hostile`, else friend | `npcs.hit(before, after, punch)` when hostile |
| `universe/online/pilots.js` | `ships` that are `shown` and not parked (`foot`), and the `ghosts` (other pilots' hunters) | pilot (friend when `ally`), foe | a pilot: null; a ghost: as `hit` does, telling its pilot |
| `universe/front.js` | the battle's `fighters` that are alive and not your team | foe | `battle.hit(before, after, punch)` |
| `galaxy/warfront.js` | the same, from its battle | foe | the same |

The traffic's big ships, the director's capital ship (`setpieces.js`), the sector fleet (`sectorFleet.js`) and the galaxy's Interdictor are **solids**, not bodies: each gains a `solids` getter answering `[{ id, at: [x, y, z], r }]` from its hull (the capital's `hull` chain of spheres, placed; a sector ship as one sphere of `size × 0.16` at its middle; a big traffic ship as one of `size × 0.3`; the Interdictor's one sphere), and the scene adds them to the list it hands `step` each frame.

### 3. The wiring, in each scene

A few dozen lines each, beside the rocks:

- **The solids of the frame.** `solidsNow()` = the map's solids plus the moving big ships' `solids`, built once a frame and handed to `step` (and kept on the scene so `startCrash` finds the solid it names: today it searches `SOLIDS`, which the moving ones are not in). The galaxy's `state.space.solids` is not changed (its autopilot and `parkBy` read it); the frame's list is only `step`'s.
- **The sweep.** After `rocksHit`, while flying and not in a crash, a jump, a dive, held, frozen, on foot, on the map view, nor a ghost (the galaxy's `powers.mods.ghost`): `shipHits.sweep(before, ship, dt, state.clock)`. Nothing from the sweep while `state.clock < state.safeUntil` hurts you (just back from a crash), as the rocks do; the push and the bump still happen.
- **A glance**: your ship is put back to touching (`at + normal × (r + SHIP.radius)`), its speed times `keep`, `state.shake` to at least 0.25, and `{ type: 'bump', id: body.kind, hard: false }` is emitted (Comms plays `bumpSound`).
- **A ram**: `pops.hit` at the point, `hurt(outcome.damage)` (so a ram with nothing left is being shot down, as today), your speed to `sign × max(SHIP.boost, |speed| × keep)` like a rock, `state.shake` 0.9, `state.flare` 1.6, `state.kick` 0.6, `state.note` "Hit a <kind>: shields −N" for 2.5 s, and `{ type: 'bump', id: body.kind, hard: true }` so the crew say their bump line. Then `body.hit(outcome.punch)`: a result with `down` is played as a kill by your guns is, through the scene's own kill path (`hunters`: `burn`, the `kill` event, `heat`, `killed(hh)`; traffic: the `kill` event, `heat`, `deed`; the galaxy: `scored`). The plan names each site; nothing about what a kill does is written twice.
- **A crash** into a moving solid: `startCrash` as it is, with the solid found in the frame's list, `crashFx.hit` with `body: null` (no planet shell under a ship) and the crash told with `kind: 'ship'` so the crew's `crashInto` falls back to their crash line.

## How it feels, by the numbers

| what you hit | closing speed | result |
| --- | --- | --- |
| a TIE (size 0.3) side-on at cruise, both turning | 1 | glance: pushed off, speed × 0.85, a soft bump |
| a TIE head-on, you at cruise (6), it at its 8 | 14 | ram: shields −14 (6 + 2.1 + 6.4), it goes down (punch 3 against hp 1), you thrown back under the boost |
| a freighter (size 0.7) crossing your bows at the boost (12) | 12 | ram: shields −16, it goes up (civil: heat, a deed, the law) |
| Vader's TIE Advanced (hp 6) at cruise | 6 | ram: shields −10, Vader takes 1 hit and comes on |
| a Star Destroyer's hull at cruise | 6 | crash, as into a planet |
| a Star Destroyer's hull, nosing in at a crawl | 1 | a soft bump off it, as a planet's |

Tuned by hand in dev after the first build; the table is the starting point, every number in one place.

## Tests

- `lib/combat/contact.test.js`: the law's thresholds and caps (a glance at 1.29, a ram at 1.31; the most; the punch at 1.3, 6.3 and 30); `sweptSpheres` against `targeting.test.js`'s cases; `closingSpeed` parting is 0.
- `universe/shipHits.test.js`: two fake sources; the earliest body along the way wins; a body outside reach is never asked; the cooldown holds a key for 0.35 s and not 0.36; a `friend` is a glance at any speed; a fast frame (a way of 40 units) still finds a body in its middle; a body with no `prev` is swept where it is.
- Each system's `bodies` or `solids` getter: one test beside its file, with the file's existing fakes (`hunters.test.js`'s fake fleet, `traffic.test.js`'s, `front.test.js`'s battle, `setpieces.test.js`, `sectorFleet.test.js`, `wingmen.test.js`, `warfront.test.js`; `pilots`, `skirmishes` and `npcs` get a small new test each).
- The scenes are checked in a browser: `node scripts/autopilot-check.mjs --routes /universe,/galaxy` still passes, and a dev hook (`__universeDebug.ram()`: a hunter put dead ahead at cruise) shows the ram in a screenshot.

## Rules kept

- Layers: `lib/combat` knows no world; `universe/shipHits.js` knows only plain objects; the galaxy imports it from `universe/` as it already imports `universe/hunters` (an island break that stands today, counted in `boundary-breaks`; no new kind of break).
- `universe/scene.js` is over the ceiling already; it gains the wiring only (under 60 lines) and loses the `sweptHit` body to the lib. No other file nears 800 lines.
- Every new rule is in a pure file with a test; every scene edit is additive; no line is reformatted; British spelling; no new dependency.
