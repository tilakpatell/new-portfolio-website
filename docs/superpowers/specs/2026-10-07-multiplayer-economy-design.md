# Multiplayer you can see, pilots you can reach, and one economy: design

Date: 2026-10-07. Status: written from the owner's request by an
architecting session, for an Opus 5.5 implementation session. Built in
three pull requests (the plan: `docs/superpowers/plans/2026-10-07-multiplayer-economy.md`).

## Intent

What the owner said: “Improve the multiplayer aspect of the game and the
UI. Being able to see name tags better, jump to their ship locations. See
their allied factions and make a entire economy system to upgrade and
stuff. Make it robust and it should be the same throughout universes but
they unlock stuff.”

What that means here. The site's multiplayer (`src/components/universe/online/`)
is one room on the Nostr relays carrying every pilot's hello, poses, shots
and hunters. It works, and the pieces around it are thin:

- **Name tags** (`online/pilots.js`, `online.css`'s `.universe-tag`) are a
  small pill at a fixed size, gone past 140 map units, with nothing but the
  callsign and a shield bar. On a busy map you can't tell an ally from a
  stranger at a glance, and you can't see anyone far off.
- **Reaching a pilot**: the roster's “Go” button (`Online.jsx`) only changes
  page. On the universe map or in a galaxy system there is no way to fly
  to someone: you look for a dot.
- **Who they fly for**: the roster shows a ship and a paint job. Nothing
  says a pilot flies for the Rebellion, is wanted by the Empire, or is a
  Captain this campaign, though every one of those is known locally
  (`universe/standing.js`, `galaxy/allegiance.js`, `galaxy/ranks.js`).
- **Progression**: the hangar (`Hangar.jsx`, `outfit.js`, `shipyard/parts.js`)
  gates a few parts behind achievements and gives the rest away. Kills,
  rescues, battles won and quests done earn nothing you can spend. The
  galaxy's war has points and ranks (`galaxy/warState.js`) but they stay
  in the galaxy.

Done looks like: a pilot's tag is readable from across the map and tells
you at once whether they are with you, against you, or nobody's. One click
in the roster flies you to anyone who is somewhere you can fly. Each row
of the roster says whose side they are on and what they have become. And
everything you do, on the universe map, in its sectors, in the galaxy and
down on its worlds, pays into one wallet and one flight record that the
hangar spends, with each universe offering its own things to buy once you
have earned your way to them there.

## Decisions

1. **The economy is local-first.** Credits, experience and what you own
   live in this browser's storage. The wire carries only your level, so no
   pilot can be made richer or poorer by another, and nothing needs the
   shared-tally machinery. Robust means nothing to cheat and nothing to
   desync.
2. **One wallet, many shops.** `economy.js` is one pure module and one
   save key for the whole site. Each universe (the Star Wars, Rick and
   Morty and Breaking Bad sides, the galaxy) earns into it at its own
   rates and sells its own catalogue entries, each gated by that
   universe's own marks: an achievement from it, a standing with its law,
   a rank in its war, or a level.
3. **Nothing anyone has is taken away.** Every part, module and paint
   fitted anywhere when the wallet first appears is granted as owned. The
   achievement locks already in `outfit.js` and `parts.js` stay; a price
   is added beside them. Stock parts are always owned and free.
4. **Tags are DOM, as they are.** The tag stays a positioned element set as
   text only (a peer's name is untrusted). It grows readable: a minimum
   size on screen, a distance read-out past arm's length, a far mode
   (name and distance only) out to the edge of the map, and a colour by
   relation. Allies off screen get an edge marker like the threat arrows.
5. **Flying to a pilot is a goal like any other.** The autopilot already
   flies to a named goal with a parking spot (`ship.js`'s `autopilot`,
   `scene.js`'s `travel`); `frontSpace` shows how a goal is added at run
   time. A pilot becomes the goal `pilot:<id>`, its park re-aimed from
   their latest pose, and the trip uses the drive you have chosen (the
   hyperdrive included), so it works across sectors through the portals
   as a trip to any world does.
6. **Factions are read, not declared.** A pilot's side comes from the ship
   they fly (`sides.js`'s `sideOf`); their standing levels, their oath and
   rank come in the hello as a small whitelisted record (`f`). Readers
   believe only ids and names in the lists they already have.

## Design

### Part 1: the wallet and the flight record (`economy.js`)

A pure module beside `standing.js`, tested in Node, no three.js and no DOM.

```
createEconomy({ saves }) → {
  credits, xp, level, owned (Set), spent, earned,
  earn(what, n = 1, { side }) → { credits, xp, levelUp: level | null },
  canBuy(item) → { ok, why },   // 'owned' | 'credits' | 'locked:<need>'
  buy(item) → boolean,
  owns(id) → boolean,
  grant(ids),                   // the migration, and quest rewards
  record() → { credits, xp, level, kills, rescues, wins, quests, bySide: {…} },
  on(fn) → off,
}
```

- **Save**: `runtime/saves.js` registered key `tp-pilot`, version 1, shape
  `{ credits, xp, owned: [ids], tally: { what: n }, bySide: { side: { what: n } } }`.
  Migration from nothing: `owned` is every part id in `tp-universe-loadout`,
  every module id in `tp-universe-hull` and `tp-universe-garage`, every
  paint in use, for every crew. Written on every change, debounced.
- **Earning**: an `EARN` table, `{ what: { credits, xp } }`, pure data.
  Keys match what the scenes already emit or note: `killHunter`,
  `killAce`, `killCapital`, `killPirate`, `killPilot`, `rescued`, `helped`,
  `hunterHelped` (you shot one off someone else), `siegePart`, `warPoints`
  (per point, from `warState.addPoints`), `warWin`, `questDone`, `found`,
  `standingUp` (a good level reached), `allyMade`. Killing civilians and
  patrols earns nothing (standing already punishes it; the economy must
  not reward it or make it a wash). A side multiplier (`SIDE_RATES`) lets
  a universe pay differently; all 1 to start.
- **Level**: `LEVELS` thresholds on xp (`[0, 50, 150, 350, 700, 1200, 2000,
  3200, 5000, 7500, 11000]`, eleven levels, the last the cap), a title
  per level (`TITLES`: “Rookie” to “Legend”), `levelOf(xp)`.
- **Buying**: an item is `{ id, price, needs }` from the catalogue. `canBuy`
  checks owned, credits, then every `needs`: `achievement` (from the
  achievements list passed in), `level`, `standing: { side, axis, level }`
  (from `standing.js`'s saved state for that side), `rank: { side, id }`
  (from `warState.mine` through `ranks.rankOf`). The reason is a string
  the hangar turns into a sentence.

### Part 2: the catalogue (`catalog.js`)

A pure module that reads `outfit.js`'s `PARTS`, `shipyard/parts.js`'s
modules and `paint.js`'s `PAINTS` and gives each a `price` and `needs`,
so the three lists stay the source of their shapes and this is the source
of their cost. Stock entries: price 0, always owned. Existing achievement
locks become `needs.achievement`. Prices in bands by what the item does
(a boost or punch share of 0.25 is about 400 credits; a plant module 600;
a paint 150), tuned so a first part is bought in the first ten minutes of
flying and the best fit in a few evenings. Each entry carries `from`: the
universe it belongs to (`starwars`, `rickmorty`, `breakingbad`, `galaxy`
or `null` for anyone's), used to group the shop and to pick which
universe's lock a sentence names.

New entries so each universe has something to earn there (data only, no
new models in this work: each is a paint or a stat part on the existing
builders):

- Star Wars: “Rebel Alliance” and “Imperial grey” paints (needs the matching
  oath), “Red Squadron” markings (rank Flight Leader), an “Incom targeting
  computer” guns part (standing `trusted` with the Empire is not the
  Rebel's way: this one needs `rebels`).
- Rick and Morty: “Citadel issue” paint (standing `trusted` with the
  Federation), “Council of Ricks” fins (level 5).
- Breaking Bad: “Los Pollos” paint (standing `hero` with the civilians),
  “Vamonos Pest” thrusters (level 3).
- Galaxy: “Hutt gold” paint (level 8: a rank names one side, so “Captain in any war” can’t be asked).

### Part 3: earning in the scenes

Each place calls one `earn` at the point it already notes a deed or emits
an event, nothing else:

- `universe/scene.js`: beside `deed(...)` (the hunter kills, `rescued`,
  `helped`, `capitalKill`, `capitalHurt`), and where it emits `{ type: 'kill',
  kind: 'pilot' }`; `hunterHelped` from `client.js`'s `helped` event. The
  Citadel siege's parts from its `siege` events.
- `galaxy/warfront.js`: beside `addPoints` and `addWin`.
- `pages/GalaxySurface.jsx`: on `questDone` and `found`.
- `pages/Universe.jsx` and `pages/Galaxy.jsx`: `standingUp` when a
  `standing` event reaches a good level; `allyMade` from the client's
  alliance.

The page shows a short “+120 ¢” note in the HUD's note slot (the one the
hyperdrive uses) and a level-up card through the same slot. `useEconomy()`
in a provider above the pages gives the hangar and the roster one
instance.

### Part 4: the shop in the hangar

`Hangar.jsx` keeps its tabs. Each part row gains a price pill. A part you
do not own shows “Buy · 400 ¢”; one you cannot afford shows the price
dimmed and “short 120 ¢”; one still locked shows its lock and the sentence
(“Swear to the Rebellion in the galaxy”, “Reach level 5”, “Be trusted by
the Federation”). Buying fits it at once. The build tab's roll picks only
from owned and open modules; a module that is not owned shows its price
in the picker. A “Record” card (a new small component, `Record.jsx`) opens
from the hangar's header and from the roster's “You're …” row: credits,
level and title, the next level's bar, kills, rescues, battles and wins,
quests, and a line per side: standing levels and, for the galaxy, oath and
rank.

### Part 5: the wire

`protocol.js`'s hello gains:

- `lv`: level, an integer 1 to 11, clamped.
- `f`: `{ s: side id, st: { law, civil, outlaw } as level names or null,
  w: war id or null, o: side id of the oath or null, r: rank id or null }`.
  `readHello` keeps only values in `sides.js`'s `SIDES`, `standing.js`'s
  `LEVELS`, `galaxy/sides.js`'s `WARS` and `SIDES`, and `ranks.js`'s
  `RANKS`; anything else reads as null. The hello goes out again when any
  of it changes (the client's `setProfile` compares it).

`relation(me, peer)` in a new pure `relations.js`: `'ally'` (an alliance),
`'friend'` (same oath side, or the same universe side's law trusts both of
you), `'foe'` (opposite oath sides in the same war, or they are wanted by
your side's law), `'none'`. Tested.

### Part 6: the tags

`pilots.js` and `online.css`:

- The tag is `name · distance` with the shield bar; past `TAG_NEAR` (40
  units) the distance shows (“1.2 km”: a map unit is treated as 10 m for
  the read-out, as the nav distance does); past `TAG_MID` (140) the tag is
  the far mode, a smaller pill with the name and distance, fading out at
  `TAG_FAR` (600); allies are never faded (their tag stays at the edge).
- `--relation` sets the colour: ally green as now, friend blue, foe red,
  none the current salmon. `data-level` adds a small “Lv 7” chip; a rank
  id, when sent, adds its name as a second line in the near mode only.
- Minimum font size 12 px on screen whatever the distance; the tag scales
  from 1 (near) to 0.8 (far), no smaller.
- Off screen, an ally or a pilot you are flying to gets an edge marker:
  the HUD's `.universe-threat` arrows have the geometry; a sibling class
  `.universe-mate` in the same place, green, with the name, at most four.
  `scene.js`'s HUD step fills it from `pilots.targets` and the allies.
- The galaxy's `GalaxyView.jsx` already has the tags box and passes it to
  `pilots.update`; it gets the same tags by sharing the code.
- A click or tap on a tag opens the roster on that pilot (a `tp:pilot`
  event the `Online` component listens for), so the tag is a way in to
  ally or fly-to.

### Part 7: flying to a pilot

- `scene.js`: `travel('pilot:<id>')`. The goal is added to the space the
  way `frontSpace` adds `front`: `pilotSpace(id)` with a park 6 units
  behind the pilot's sampled pose, on their heading, at their height. The
  park is recomputed every second while the trip runs (`state.auto.park`),
  so a moving pilot is caught. Arrival within 8 units ends the trip and
  the HUD notes “With <name>”. If the pilot leaves the place or goes
  stale, the trip ends with “<name> has gone”. Through the hyperdrive, the
  jump lands at the park as it was at the flash. Across sectors `legOf`
  routes through the portal as for any world; the park is resolved after
  `portalThrough` from `state.then`.
- `galaxy/scene.js`: the same, in its own `state.auto` (it imports
  `autopilot` already), for a pilot in the same system.
- `Online.jsx`: each row gets “Fly to” when the pilot is in the same
  flight place and you have a ship; “Go” stays for another page, and when
  that page is a flight place it sets `follow = id` in the online state so
  the scene flies to them once the ship is in (the page clears it on
  arrival or after 60 s).
- `Universe.jsx` and `Galaxy.jsx`: handle `{ type: 'arrived', id: 'pilot:…' }`
  and the follow hand-off.

### Not in scope

- Trading credits between pilots, or any shared economy state.
- New 3D models (the catalogue's new entries are paints and stat parts on
  existing builders).
- A leaderboard across pilots.
- Changing the hunters, the war's balance or standing's numbers.

## Error handling

- Storage missing or corrupt: `saves.js` falls back to a fresh wallet; the
  migration runs on the next good read.
- A hello with a bad `f` or `lv` reads as the hello it would be without
  them.
- A fly-to on a pilot who leaves: the trip ends cleanly, the autopilot is
  off, the HUD says so; no stale goal stays in the space.
- A buy with too few credits is refused by `canBuy` before `buy`; the
  hangar never calls `buy` without it.

## Testing

- `economy.test.js`: earning, level thresholds, buying (owned, short,
  locked by each kind of need), the migration from loadouts and hulls,
  the save round trip and a corrupt save.
- `catalog.test.js`: every part, module and paint has an entry; stock is
  free; each `needs` names ids that exist; prices are in band.
- `relations.test.js`: each relation from each pair of records.
- `protocol.test.js`: `lv` and `f` round trip; junk reads as null.
- `pilots` tag logic that is pure (which mode, which colour, the distance
  text) is in a small `tagRules.js`, tested.
- `scene` travel to a pilot: `nav.test.js`-style test on `pilotSpace` and
  the re-aimed park (pure), and `scripts/flyto-check.mjs`: two Playwright
  contexts online on the universe map, one flies to the other, and ends
  within reach.
- `scripts/online-check.mjs` extended: the roster row shows the other's
  side and level.
- A hangar check in the browser: a fresh profile earns from a kill
  (`window.__universeDebug`), buys a part, and the part is fitted and
  owned after a reload.
- `npm run lint`, `npm test`, `npm run build` clean before every push.
