# The Galactic Civil War, revision 3: allegiance, consequence, place and voice

Date: 2026-10-07. Status: written from the user's request for a deep rework,
without checking in; to be built in the PRs the plan lists
(`docs/superpowers/plans/2026-10-07-gcw-allegiance.md`). Supersedes the war
parts of `2026-10-06-fleet-war-design.md` revision 2 where they differ; the
rest of that spec (the battle engine, the set pieces, the tally, the scale)
stands.

## Intent

What the user said: "The galactic war in the Star Wars galaxy has no faction
choosing. It also has nothing to influence the wars throughout the galaxy.
It's also not area specific and doesn't hook up with the hero / character
logic and dialogue. Rework this and make it robust and architect it deeply."

What the code does today, read against that:

- **No side.** `warfront.js` hard-codes `REBELS = 0` and `battle.setYou(0)`;
  `gcw.js` keeps one `control` per system meaning *the Rebellion's*, and
  every point a pilot scores lifts it. `HoloMap.jsx` says "Held by the
  Rebellion" and nothing of you. The universe map's fronts (`front.js`) once
  had a side picker and `join(team)`; revision 2 took it out.
- **No consequence.** The war's `owner` of a system is read by two things:
  the holotable's rings and `battleAt`. Who hunts you (`systems.js`'s static
  `faction`, through `roamRules.js`), what flies by (`traffic`), the fleets
  parked at a planet (`world.js`'s `pieces`), the surface's troopers, the
  assault missions, the director's heat, the crews' lines: none of it knows
  who holds the system. Taking Coruscant changes a ring on a map.
- **Not of its place.** `battles.js` has five templates and one default line
  of battle; every battle is the same three-phase Fleet Assault; a front is
  picked by a seeded order with the set-piece systems first; an attack
  lands anywhere on the border, Hoth four times as often. Neighbours are
  the three nearest dots plus two hand-made links, not the galaxy's trade
  routes (`systems.js`'s `ROUTES`), and the regions (`REGIONS`) count for
  nothing. The surface's battles of Hoth and Geonosis are games beside the
  war, not battles in it.
- **Not in the characters' voices.** `lines.js`'s `battle` block is seven
  generic exchanges per crew (`front`, `join`, `gens`, `bridge`, `reactor`,
  `won`, `lost`), the same at Endor as at Naboo, the same whichever side
  you are on. Nobody of the films is in the war: no Ackbar, no Piett, no
  Vader on the comms. The hero you pick for the surface (`heroes.js`) has
  no bearing on anything in the sky, and the sky has no bearing on them.

Done looks like this. You swear to a side, the Rebellion or the Empire,
and the whole galaxy reads it: in your side's space you are escorted and
hailed, in the other's you are hunted and scanned. The war moves on
supply lines that are the films' own trade routes, region by region, and
what your side holds decides who is in orbit, who flies by, who meets you
on the ground, and which way the surface's battles are fought. Each system
fights its own kind of battle with its own fleets and its own commanders
on the comms, who speak to you by your rank and remember what you did at
the last one. The hero you play as has a side of their own and says so.
And a pilot on the other side, online, is in the same battle against you.

## Decisions

Made for the user. Each names the module that owns it; every rules module
is pure (no three.js, no DOM), seeded through a `rand` argument where it
needs one, and tested in Node before it is drawn.

### 1. Allegiance (`galaxy/allegiance.js`, pure, tested)

- **A side is a choice, kept.** `{ side: 'rebel' | 'empire' | null, since:
  campaign number, sworn: count of oaths this campaign }`, in
  `localStorage` `tp-gcw-side` (read and written in try/catch through
  `lib/hooks`' `local`). `readAllegiance(raw, { crew, hero, now })` makes it
  good; nothing kept is `side: null`.
- **Where you choose.** Three places, one function:
  - the holotable's war card (a two-button row under the campaign line);
  - the galaxy panel's war card at a system with a battle on, the first time
    a battle is in front of you with `side: null` (the scene says
    `battle.ask` and the panel offers the two buttons; the battle runs on
    while you decide, with you in nobody's sights: `setYou(null)`);
  - the surface's assault choose card, which already asks and now answers
    with the war's side (section 5).
- **Defaults are suggestions, not oaths.** `suggestSide({ crew, hero })`:
  the X-wing and the Falcon suggest `rebel`; Boba Fett as hero suggests
  `empire`; Rick's cruiser and the RV suggest nothing. A suggestion is
  shown as the highlighted button and never chosen for you.
- **Changing sides is allowed and costs something.** `swear(a, side, now)`
  on a different side this campaign sets `turncoat: true` until the
  campaign ends: your rank starts over, the side you left hunts you in its
  space as a deserter (the director's `bounty` comes sooner), and the lines
  say so once (`battle.turncoat`). The points you scored for the old side
  stay with it: the tally's keys carry the side (section 2).
- **The battle's team.** `teamFor(side, battle)`: in a liberation the
  Rebels attack (team 0), so a Rebel pilot is 0 and an Imperial pilot 1;
  in a defence the Empire attacks, so the reverse. `warfront.js` calls
  `battle.setYou(teamFor(...))` and `setYou(null)` while unsworn.

### 2. A two-sided war (`gcw.js`, `warState.js`, `universe/tally.js` unchanged)

- **Points carry a side.** `pointsKey(side, sys, step)` → `r:hoth:12` or
  `e:hoth:12`; `winKey(side, sys, step)` → `win:r:hoth:12`. A key of the
  old shape (`hoth:12`, `win:hoth:12`) is read as the Rebellion's, so a
  pilot on the previous build in the same campaign still counts. The key
  regex in `tally.js` already allows the colon.
- **Control moves by the difference.** In `history`, a system's control
  changes by `rebelPoints − empirePoints` (each in hundredths, as now) plus
  the seeded rate of the side whose fleets are working on it. An Imperial
  pilot's objectives and kills at a front push its control *down*; at a
  defence they help the attack. A win is counted for the side that won it,
  once, and is worth `GCW.points.win` either way.
- **A defender's work counts.** `universe/battle.js`'s events already say
  whose shot a `down` was and the kind; `warfront.js` scores, for the
  defending pilot, a bomber down near the defended flagship as an
  `intercept` (`GCW.points.intercept = 1`), a fighter down as `kill`, and
  holding out to the end as the `win`. Nothing new in the engine.
- **Supply.** `GCW.supply = 1` (%/hour): a front's rate gains `supply` for
  each neighbour its attacker holds beyond the first, and loses it for
  each the defender holds beyond the first. A front with two Rebel
  neighbours and three Imperial ones moves slower than one surrounded.
  This replaces nothing; it is added to the seeded rate before the players'
  points.
- **Neighbours are the routes.** `NEIGHBOURS` is built from
  `systems.js`'s `ROUTES`: two war systems are neighbours when they are
  the nearest war systems to consecutive points of the same route (each
  system is snapped to the route point nearest it, within
  `GCW.routeReach = 2.2` grid squares), plus the nearest two by distance so
  no system is cut off, plus `GCW.links` as now. `gcw.test.js` keeps its
  "all joined up" test and gains "every route's systems are a chain".
- **Regions.** `regionOf(id)` from `systems.js`'s `REGIONS` rings and the
  system's distance from the galaxy's centre (`systems.js` already places
  the rings by radius). `history` returns `regions: { [regionId]: { rebel,
  empire, total } }`, and a region held whole by one side gives that side's
  fronts bordering it `GCW.regionBonus = 2` (%/hour).
- **Worth and weight come from the system.** `systems.js` gains per war
  system `war: { worth, weight, kind, flagships?, cast? }` (section 4);
  `gcw.js` reads `weight` for the attack pick (Hoth's 4 moves there) and
  `worth` for the order of fronts and the major order: the highest-worth
  Imperial system bordering a Rebel one is the major order, ties broken by
  the campaign's seed. `GCW.majors` goes.
- **Campaign arcs.** The opening map stays. A campaign ends early when one
  side holds every war system (`history` returns `over: side | null`), and
  `warTable` says so: the holotable shows the result until the next
  campaign's start. `GCW.campaign` stays three days.
- **Your record.** `warState.js` gains `mine(now)` → `{ side, points,
  wins, battles, systems: [ids you fought at], major: boolean }` from the
  tally's own shares, and `rankOf(side, points)` from
  `galaxy/ranks.js` (data: six ranks a side, the Rebellion's from Flight
  Cadet to Commander, the Empire's from Ensign to Admiral, with the points
  each needs, `RANKS[side][i].at`). Rank is a title, nothing more: it
  names you on the comms and the holotable.

### 3. Consequence (`galaxy/warEffects.js`, pure, tested; the wiring named)

One function answers the galaxy: `effectsFor(sysId, war, allegiance)` →

```js
{
  owner: 'rebel' | 'empire',
  yours: boolean,                 // the owner is your side
  hostile: boolean,               // unsworn: false; otherwise !yours
  garrison: 'empire' | 'remnant' | 'rebellion' | 'separatists',
  hunt: boolean,                  // the director may send a hunt
  escort: boolean,                // your side's wing comes to meet you
  capital: 'destroyer' | 'moncal' | null,  // what the director can drop in
  traffic: string[],              // what flies by, in place of the system's own
  fleet: 'rebel' | 'empire' | null,        // whose ships park at the planet
  heat: number,                   // added to the director's heat: a front 1, an attack 2
  troops: 'stormtrooper' | 'rebel' | 'battledroid' | 'remnant',
  deserter: boolean,              // you turned your coat from this owner
}
```

- **Garrison.** The owner's. An Imperial system's garrison is `empire`,
  or `remnant` where the system's static `faction` is `remnant` (the shows'
  worlds keep Gideon's TIEs); a Rebel system's is `rebellion`. A system
  whose static `faction` is `separatists` keeps the droids as a second,
  always hostile garrison (the Clone Wars' leftovers), whoever holds it.
  `systems.js`'s `faction` stays what it is: the *era's* hunter, now only
  the flavour of the owner's garrison.
- **The Rebellion as hunters.** `hunted.js` gains a `rebellion` faction
  (`xwing` 3, `awing` 2, `ywing` 1, ace `redleader`: an X-wing with the
  TIE Advanced's numbers and Wedge's name on the bracket) and
  `rebelnavy` (what an MC80 launches), with their lines in every crew
  (`lines.test.js`'s `HUNTED` list grows by them). `roamRules.js`'s
  `galaxySide(sys, effects)` builds the side from `effects.garrison`
  instead of `sys.faction`; its `ROLES` gain `rebellion: { hunt:
  ['rebellion'], capital: 'rebelnavy', capitalShip: 'moncal', bounty:
  ['fett', 'ig88', 'bossk', 'dengar'], pieces: ['destroyer'] }` (the
  director's `destroyer` event draws the `capitalShip` kind: `scene.js`'s
  `pieces.destroyer(ship, kind)` already takes the kind).
- **Your side's space.** `hostile: false` means the director's `hunt` and
  `destroyer` events are not sent (`roam.update`'s `calm`), the bounty
  hunters still come (they are nobody's), and a new director event
  `escort` (in `ROAM_EVENTS`) sends your side's wing to fly beside you a
  while, the universe map's wingmen (`universe/wingmen.js`, `wingRules.js`
  rows: `xwing`/`awing`/`ywing` for the Rebellion; `tie`/`interceptor` rows
  added for the Empire) with a `hunted.escort` line. In a system under
  attack by the other side, `heat: 2` makes the director quicker.
- **Traffic.** `traffic` is the owner's: Rebel space `['xwing', 'ywing',
  'transport', 'shuttle']`, Imperial space `['tie', 'shuttle', 'gozanti']`,
  with the system's own list kept for anything civil in it (`systems.js`'s
  `traffic` entries that are not a warship). `world.js` reads it through
  the scene's `effects`.
- **The fleet in orbit.** A `pieces` entry of `type: 'fleet'` with a
  `side` is drawn only when `effects.fleet` is that side; a
  `type: 'battle'` piece (Endor's standing battle) is drawn when the system
  is a front or under attack and the war's own battle is in its lull, else
  not at all (the war's battle replaces it, as `quiet` does now).
  `garrisonFleet(effects)` gives a small fleet for systems with no piece:
  two Imperial escorts (`lightcruiser`, `gozanti`) or two Rebel ones
  (`corvette`, `nebulon`), placed by `battles.js`'s `obstacles` clear of
  the planet.
- **Deserters.** `deserter: true` (you were this owner's this campaign)
  sets `hunt: true` in that side's space and the director's `bounty`
  weight doubles.
- **Wiring.** `scene.js` works `effectsFor` out once per system entry and
  once per war step (the same `stateKey` `warfront.js` keeps), hands it to
  `roam.update` (as `side` and `calm`), `world.js` (`setEffects`), the
  traffic and `hunters` (`stock`), and the HUD (`info.effects`). No module
  reads `warNow` for itself but `HoloMap.jsx` and `warEffects.js`.

### 4. Place (`systems.js` `war`, `battles.js`, `warCast.js`)

- **Every war system has a `war` entry** in `systems.js`:
  `{ worth: 1 | 2 | 3, weight: 1 | 2 | 4, kind, flagships?: { rebel, empire },
  cast: { rebel: [ids], empire: [ids] } }`. `worth` is what it is to the
  war (Coruscant 3, Endor, Scarif, Hoth, Yavin, Lothal 2, the rest 1);
  `weight` how the Empire likes attacking it (Hoth 4, Yavin and Lothal 2,
  the rest 1); `kind` which battle is fought there (below); `flagships` the
  named ships of the films (`Home One`, `Executor`, `Profundity`,
  `Devastator`, `Chimaera`, `Ghost`, `Tantive IV`…); `cast` who is on the
  comms (below). `systems.test.js` checks every war system has one, every
  `kind` is a `BATTLE_KINDS` id and every cast id is in `warCast.js`.
- **Six kinds of battle** (`battles.js`'s `BATTLE_KINDS`), each data over
  the engine `universe/battle.js` already has (runners, `disable`, `avoid`,
  `addRunner`) plus one new option, `objectivesOn`, with no new sim:
  - `assault` (the default): Fleet Assault as now, the defender's flagship's
    generators, bridge, reactor.
  - `evacuation` (Hoth, Yavin, Lothal when attacked): the defender's
    transports run for the jump through the attack (`addRunner`, Hoth's
    piece made general in `warpieces/evacuation.js`); six out and the
    defence holds; the attacker's bombers go for them.
  - `siege` (Scarif, Endor, Coruscant): the Fleet Assault behind a gate or
    shield the set piece owns (Scarif's gate, Endor's generator, Coruscant's
    orbital shield: a `planetShield` world.js already draws); the gate's
    fall is phase 0.
  - `interdiction` (Mandalore, Nevarro, Mustafar, Kessel): the objectives
    are on the Interdictor among the escorts (`objectivesOn: 'interdictor'`
    in `layBattle`'s options: `battle.js` gains the option and puts the
    defender's subsystems on the first escort of that kind instead of the
    flagship; the flagship keeps its hull and batteries); when it goes the defender's fleet
    jumps out and the battle is won; the defender's pilot keeps the
    attacker's bombers off it.
  - `blockade` (Naboo, Kamino, Kashyyyk, Sorgan, Bespin): the attacker's
    runners (blockade runners, `corvette`s) must get through the defender's
    line to the planet; three through and the attacker wins; the engine's
    runners with the sides swapped from `evacuation`.
  - `ambush` (Tatooine, Geonosis, Dagobah's rubble, Alderaan's field): a
    smaller fight among the system's rocks (`avoid` from `rocks.js`'s
    fields), no capital line, the objective a single flagship's bridge,
    both sides' fighters doubled.
  Each kind has its own `BATTLE_KINDS[kind].text` for the holotable's card
  and the panel ("Run the blockade", "Hold the evacuation") and its own
  `lines` key (section 6).
- **A template for every war system**, in `battles.js`'s `TEMPLATES`,
  with the films' fleets and the `flagships` names: Naboo's Trade
  Federation-era Lucrehulk is not the Empire's, so Naboo's Imperial line is
  a `destroyer` and two `lightcruiser`s, and so on; `battles.test.js`
  checks every war system has a template, every ship kind it names has a
  size in `SIZE` and a model or stand-in the galaxy loads (`models.js`), and `layBattle` lays each one
  clear of its obstacles. The `DEFAULT` line stays for a system added
  later.
- **Aces.** A template's side may name `ace: { kind, name, hp }`: one
  fighter of that side flagged, drawn as its kind, its bracket name the
  ace's (`battle.js`'s `f.tgt.name`), its hull `hp`; Vader at Hoth and
  Endor and Bespin for the Empire, Wedge at Endor and Hoth, Hera's Ghost
  at Lothal for the Rebellion (as a fighter of kind `ghost`, which
  `models.js` loads). Shooting the ace down is `GCW.points.ace = 2` and the
  `battle.ace` line.
- **The surface is the war's ground.** Where a war system has a surface
  assault (`game.also` with `to` on `?mission=assault`: Hoth, Geonosis
  today), its holotable card and the galaxy panel offer "Fight it on the
  ground", and the assault's result counts (section 5).

### 5. The surface in the war (`surface/missions/assault.js`, `GalaxySurface.jsx`)

- **The choose card answers with the war.** `chooseSide(id)` stays; the
  HUD's card highlights the side the allegiance maps to (`attack`/`defend`
  by which side attacks: the assault data's `sides.attack.id`), and picking
  the other side on the card is the same oath as in the sky (`swear`).
- **The result counts.** `endBattle` already names the winner; the page
  posts `addWin(side, sys, step)` when your side won and `addPoints(side,
  sys, step, GCW.points.objective)` per post your side took while you were
  up, through `warState.js`, so the ground battle moves the system's
  control like the sky's. The page's `found`/`done` plumbing stays.
- **The garrison on the ground.** the trooper kinds a site's
  hostiles and life name (`surface/hostiles.js`, `sites/*.js`) are mapped
  through `effects.troops` (`stormtrooper`, `scouttrooper`,
  `sandtrooper`, `snowtrooper` by site; `rebel`/`hothtrooper` for the
  Rebellion; `battledroid`, `superdroid` for the droids): the figures
  the assault already imports. The surface page takes `effects` as a prop
  from the travel props (`travel.js`'s `surfaceProps`). A site's own
  scripted `life` (a Jawa, a bantha) is untouched.

### 6. Voice (`lines.js`, `warCast.js`, `heroes.js`, `Comms.jsx`)

- **Lines by side, then by kind, then by place.** `GALAXY_LINES[crew]
  .events.battle` becomes `{ [key]: { rebel: exchange, empire: exchange } }`
  for the keys `ask`, `front`, `join`, `gens`, `bridge`, `reactor`, `won`,
  `lost`, `turncoat`, `ace`, `escort`, `deserter`, `intercept`, `runners`,
  `gate`, `interdictor`, `blockade`; `linesFor(crew, 'event', 'battle',
  sub, side)` picks the side's (the universe map's `linesFor` gains a
  fifth argument it already has as `more`). A per-system override lives
  under `events.battleAt[sysId][key]` for the systems with a set piece or a
  film moment (Endor, Hoth, Scarif, Yavin, Coruscant, Lothal, Naboo,
  Bespin): the scene asks for `battleAt` first. `lines.test.js` checks
  every key has both sides in every crew and every `battleAt` key is one
  of the keys.
- **The commanders.** `galaxy/warCast.js` (data, tested): `CAST[id] = {
  id, name, side, rank, color, voice: null, systems: [ids], lines: {
  front, join, gens, bridge, reactor, won, lost, turncoat?, ace? } }`:
  Ackbar, Leia, Rieekan, Dodonna, Raddus, Hera, Mon Mothma, Wedge, Bail
  Organa for the Rebellion; Piett, Vader, Tarkin, Krennic, Thrawn,
  Gideon, Ozzel, Jerjerrod for the Empire. `castFor(sysId, side)` → the
  commander on the comms there (the system's `war.cast` first, else the
  side's general: Ackbar and Piett). A commander's line is said on the
  `comms` speaker with their name on the box: `Comms.jsx`'s `COMMS`
  speaker gains a per-line name (`['comms', text, clip?, { name, color }]`,
  the fourth element optional and ignored by every line today). The
  commander speaks first on each battle event, the crew answers with the
  side's line; the rank from section 2 is in the commander's greeting
  (`"Welcome to the fleet, Flight Cadet."`: `{rank}` in the text, filled
  by `warCast.say(line, { rank })`).
- **The hero's side.** `heroes.js` gains `side: 'rebel' | 'empire' |
  null` per hero (Luke, Leia, Han, Chewie, Ahsoka `rebel`; Boba Fett
  `empire`); `HeroPanel.jsx` shows it on the card ("Flies for the
  Rebellion"); `suggestSide` reads it; on the surface the hero's own two
  assault lines (`heroes.js`'s `lines: { ours, theirs }`, said when the
  assault starts on their side or against it) come through the surface's
  comms. A hero on the wrong side says `theirs` and fights anyway: a
  choice, not a wall.
- **Memory across battles.** `warState.js`'s `mine(now)` gives the
  scene whether you fought here before this campaign and how it went
  (`systems` with `{ id, wins, losses }`); the commander's `front` line has
  an `again` variant when you have (`lines.again` in the cast entry, the
  universe map's nemesis pattern).

### 7. The table and the panel (`HoloMap.jsx`, `GalaxyPanel.jsx`, `WarHud.jsx`)

- **The holotable** shows control from *your* side's view (an Imperial
  pilot sees the Empire's control; the rings are both sides' colours as
  now); the war card has the oath buttons, your rank and record, the
  regions' tallies, the major order with its `worth`, the battles on with
  their kinds; a system's card has the kind's text, the commanders, the
  ground battle's button where there is one.
- **The galaxy panel**'s war card (new, at a system in the war): owner,
  your side, the battle on and its clock, the oath buttons when unsworn.
- **A HUD line** (`galaxy/WarHud.jsx`, mounted by `GalaxyView.jsx` when
  `info.on`): the battle's kind and its objective in a line, your side's
  colour, the clock; the Citadel siege's style. No bars, no tickets.
- **Achievements** (`Achievements.jsx`): `gcwSworn` (took the oath),
  `gcwLiberator` (a system turned by a battle you were in), `gcwMajor`
  (won the major order's battle), `gcwTurncoat` (changed sides),
  `gcwAdmiral` (the top rank of either side).
- **The guide** (`guide/pages.js`): the war's tip rewritten for sides,
  ranks, regions and the ground.

### 8. Online

- The `war` message's keys carry the side (section 2); nothing else on
  the wire changes. `protocol.js`'s rate for `war` stays.
- A pilot of the other side in the same system is in the same battle on
  the other team: their `fight` shares land on the same objectives (an
  Imperial pilot at a liberation does the defender's work, which has no
  objective keys, so their `fight` message is empty and the war message
  carries their kills). Pilots are not targets of each other (the universe
  map's rule: no pilot-on-pilot fire), so two sides online fight the same
  AI from opposite ends.

## Out of scope

- A server, matchmaking or a leaderboard.
- New downloaded models: the Rebellion's hunters and escorts, the aces and
  the garrisons use the models the galaxy has.
- New set pieces beyond making Hoth's evacuation general. Coruscant's
  orbital shield uses `world.js`'s `planetShield`.
- The NPC intelligence toolkit (`2026-10-07-npc-intelligence-design.md`):
  the aces fly on `battle.js`'s rules; a later lane may give them brains.
- The universe map's wars (Rick and Morty's, Breaking Bad's): untouched.
- The sequel trilogy (revision 3a: the third era's war is the Remnant War).

## Testing

- Pure modules first, tests before code: `allegiance.js` (a bad save is
  unsworn; swearing twice in a campaign is a turncoat; `teamFor` both ways),
  `gcw.js` (the old key shape counts as the Rebellion's; Imperial points
  push a front down; supply and region bonuses; routes make chains; the
  major order is the highest worth; a campaign over early), `warEffects.js`
  (every system and both sides and unsworn give a full object; a deserter
  is hunted; separatist worlds keep their droids), `battles.js` (a template
  for every war system; each kind lays out; `objectivesOn` finds the
  Interdictor), `warCast.js` (every cast id a system names exists; every
  commander has every line; `{rank}` fills), `lines.js` (both sides for
  every key in every crew; `battleAt` keys valid), `heroes.js` (every hero
  has a side or null and two assault lines), `ranks.js` (monotone `at`),
  `warState.js` (`mine` sums only own shares; `rankOf` at the boundaries),
  `assault.js` (the result's posts counted once).
- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs
  --check --skip build` before every push.
- In a browser: `scripts/galaxy-war-check.mjs` gains a `SIDE=empire` run
  (sworn through the dev hook `window.__galaxyDebug.war.swear('empire')`,
  the battle joined on team 1, a kill counted as Imperial points, the
  holotable from the Empire's view) and a `KIND=` run per battle kind
  through `war.force(attacker, kind)`; `scripts/assault-check.mjs` checks
  the ground result reaches the war's tally.

## Revision 3a: a war for every era, and the Hutts

Added the same day, from the user's follow-up: "make sure each faction can
control or lose planets/areas. There is also Hutt space, so account for
that, and eras have different wars (Old Republic vs Republic vs Empire). If
it's easier just do the Republic's Clone Wars and the Empire's eras."
Where this section and the ones above differ, this one wins; everything
above that speaks of "the Rebellion" and "the Empire" reads, from here on,
as "a war's two sides".

### Three wars, one an era, fought at once

`galaxy/sides.js` (data, tested) holds the factions and the wars. The
galaxy's own three eras (`systems.js`'s `ERAS`) each fight theirs:

| war (`id`) | era | the side that liberates | the side that raids | short |
| --- | --- | --- | --- | --- |
| `clone` The Clone Wars | `republic` | `republic` Galactic Republic | `separatists` Confederacy of Independent Systems | Clone Wars |
| `gcw` The Galactic Civil War | `empire` | `rebel` Rebel Alliance | `empire` Galactic Empire | Civil War |
| `remnant` The Remnant War | `newrepublic` | `newrepublic` New Republic | `remnant` Imperial Remnant | Remnant War |

The sequel trilogy's war (the Resistance and the First Order) is not in
the galaxy, which has none of its films or systems; the third era's war is
the one its shows fight. A later lane can add a fourth row.

- `SIDES[id] = { id, code, name, short, colour, stance: 'light' | 'dark'
  | 'hutt', garrison, troops, fleet, traffic, fighters }`. `code` is the
  side's three letters in a tally key (`rep`, `sep`, `reb`, `imp`, `nr`,
  `rem`, `hut`); `stance` picks the crews' lines (below).
- `WARS[id] = { id, era, name, short, liberator, raider, opening: { [side]:
  [systems] } }`. Every war is fought over the same `WAR_SYSTEMS`; only the
  opening map differs:
  - `clone`: Republic `coruscant, kamino, naboo, kashyyyk, lothal, sorgan`;
    Hutts `tatooine, nevarro`; the Separatists the rest.
  - `gcw`: Rebels `yavin, hoth, lothal, kashyyyk, sorgan` (as now); Hutts
    `tatooine, nevarro`; the Empire the rest.
  - `remnant`: New Republic `coruscant, yavin, hoth, endor, naboo,
    kashyyyk, kamino, lothal, sorgan, bespin`; Hutts `tatooine, nevarro`;
    the Remnant the rest.
- All three wars are fought in every campaign, side by side, on one
  tally (a key's side code says whose and so which war). The holotable
  shows one at a time; the one you fight in is your **theatre**
  (`allegiance.war`, default `gcw`), and the sky's battles, garrisons and
  escorts are your theatre's.

### Every faction holds and loses systems

`gcw.js`'s state generalises: a system has an `owner` (any side id of the
war, the Hutts included) and `control`, the owner's hold, 1 whole and 0
lost. (The old `control` was the Rebellion's share; the holotable and
`warText.standing` turn the new one into "yours".)

- **Fronts**: a system held by anyone but the liberator, bordering the
  liberator, is a front (the first `GCW.fronts` in worth order). Its hold
  falls by the liberator's seeded rate, the supply and region terms, and
  `(liberator points − holder points)/100`; at 0 it is the liberator's,
  whole. Hutt worlds are fronts like any other.
- **Attacks**: every `GCW.attackEvery` the raider attacks a system of the
  liberator's *or the Hutts'* on its border (by `weight`); `GCW.raidEvery =
  12 h` the Hutts raid a main side's system bordering Hutt space
  (`GCW.raidRate = [20, 45]`). An attack's hold falls by its rate and
  `(attacker points − holder points)/100`; at 0 it is the attacker's;
  held to the end it is whole again. `history` returns `attacks: [{ sys, by,
  from, until, rate }]` (at most one raider attack and one Hutt raid).
- **Regions**: `history`'s `regions[r] = { [side]: count, total }` and
  `holder: side | null` (one side holds every war system in it). A region
  held whole gives its holder's fronts and attacks bordering it
  `GCW.regionBonus`.
- **Over**: a war is over early when its liberator or its raider holds
  every war system (the Hutts hold out too long to count); `over: side`.
- **Keys**: `pointsKey(side, sys, step)` → `` `${SIDES[side].code}:${sys}:${step}` ``,
  `winKey` → `` `win:${code}:${sys}:${step}` ``; `readKey` gives `{ side,
  war, win, sys, step }`; the old `hoth:12` and `win:hoth:12` are `rebel`'s.
  `history(war, n, ms, value)` and `warTable(war, ms, value)` take the war
  first; `warTables(ms, value)` gives all three.
- **The battle's sides**: `battleAt` gives `attacker` and `defender` side
  ids and `sides: [attacker, defender]`; `teamFor(side, battle) =
  battle.sides.indexOf(side)`, or `null` when it is −1 or you are unsworn.
  A Hutt battle is fought with the Hutts' pirates and gunboats.

### Allegiance per war

`tp-gcw-side` keeps `{ since, war, oaths: { [war]: { side, sworn,
turncoat } } }`; `current(a) → { war, side, sworn, turncoat }` is the flat
view everything else reads, so the rest of the spec's `allegiance.side` is
`current(a).side`. `swear(a, side, now)` swears in the war that side belongs
to and makes it the theatre; `setTheatre(a, war)` only moves the theatre.
`suggestSide({ crew, hero }, war)` suggests by stance: the X-wing and the
Falcon the war's `light` side, Fett the `dark`. The Hutts are not sworn to
(a later lane can sell their contract).

### What it changes downstream

- **ranks.js**: six ranks for each of the six sides: the Republic's
  Clone Cadet to General, the Separatists' Droid Cadet, Tactical Droid,
  Commander, General, Warlord and Head of State, the New Republic's as
  the Rebellion's, the Remnant's as the Empire's.
- **warEffects.js**: `garrison`, `troops`, `traffic`, `fleet` come from
  `SIDES[owner]`; the Hutts' garrison is the `weequay` pirates and a bounty
  hunter (`hutt` row in `roamRules`), traffic `['shuttle', 'transport']`,
  troops `'weequay'` where a surface has them else none. A Hutt world is
  `hostile` to everyone and hunts nobody: they sell you to the hunters
  (`bounty` weight up).
- **battles.js**: a template per war system *per war*
  (`TEMPLATES[war][sys]`, `DEFAULT[war]`), the Clone Wars' with the Venator,
  Acclamator, ARC-170 and Delta-7 against the Lucrehulk, Munificent,
  Providence, vultures and tri-fighters; the Remnant War's with the New
  Republic's X-wings and Nebulon-Bs against Gideon's cruiser and TIEs; a
  Hutt side of `gozanti`/`corvette` stand-ins and `weequay` fighters.
- **Lines** (`lines.js`): `events.battle[key] = { light, dark }`, with
  `{us}`, `{them}` and `{flagship}` filled from `SIDES` and the battle; a
  war may override a key under `events.battleWar[war][key]`, and a place
  under `battleAt`. Four crews × 17 keys × 2 stances, plus a `hutt` line
  for each crew's `front`, `won` and `lost` against the Hutts.
- **warCast.js**: each war's commanders: the Clone Wars' Yoda, Obi-Wan,
  Anakin, Ahsoka, Rex and Mace Windu against Grievous, Dooku, Ventress and
  Nute Gunray; the Civil War's as above; the Remnant War's Carson Teva,
  Hera and Mon Mothma against Gideon, Thrawn and Elsbeth; and Jabba for the
  Hutts (heard when they raid you or you take their world).
- **The holotable** has the three wars as tabs over the war card; picking
  one sets the theatre; Hutt space is drawn in the Hutts' colour.
