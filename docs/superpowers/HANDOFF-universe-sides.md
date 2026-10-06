# Handoff: the sides (each crew's own universe of enemies and allies)

Lane A was `claude/universe-sides` (#292); Lane B was #294 (traits), #298
(the ships) and #308 (troops); Lane C is `claude/universe-npcs`. The spec is
`docs/superpowers/specs/2026-10-06-universe-sides-design.md`; the plan is
`docs/superpowers/plans/2026-10-06-universe-sides.md`, every lane in.

## Done

- `universe/sides.js` (tested, `sides.test.js`): the three sides as data.
  `sideFor(crewId)`, `sideOf`, `factionsOf`, `kindsOf`, `namesOf`,
  `alliesOf`, `allKinds`, `pick(side, role, rand)`, `wingOf`, `squadKinds`,
  `AHEAD_OF`; each side's `has(need)` for the director.
- Every system reads the side: `scene.js` (no `FAMILY`, no `'both'`),
  `director.js` (`EVENTS[].needs`, `canHave`, `update(dt, { side })`),
  `traffic.js` (`kindsFor(side)`, `convoy(ship, side)`,
  `distress(ship, side)`), `wingmen.js` (bolt colours from the allies),
  `leviathans.js` (`pass(ship, side)`), `footScene.js` (squads, guns and the
  cast's figures from `side.troops`), `online/protocol.js` (the whitelist is
  every side's kinds through `galaxy/hunted.js`).
- Breaking Bad is a side: the DEA (`suv`, `suvace` with the spotlight),
  the cartel (`lowrider`), Gus's `pollostruck` (the capital's launch), the
  Cousins (bounty, one model of two cars), Jack's `pickup` (pirates);
  allies `saulcaddy` and `mikesedan`; civilians `pollostruck`, `madrigal`,
  `pestvan`; the `roadblock` event (the DEA in ahead, interdicting); the
  bear as its leviathan; `dea` and `cartel` troops on the ground (built
  stand-in figures until Lane B gives them Albuquerque's models). All
  built in code in `fleetBreakingbad.js`.
- Lines: the RV for every faction, ally, the roadblock, the bear, the
  skirmish and its troops; the X-wing and the Falcon for every troop kind.
  `crews.test.js` now reads the side, so a faction or ally without a line
  is a red test.

- Lane B1, hunter traits (`hunterRules.js`'s `TRAITS`, tested): `bomber`,
  `holdoff`, `quietUntilFired` (the Cousins), `flicker`, `spotlight`
  (Hank's SUV: the HUD whites out a moment and Walt and Jesse say so).
  The bomber, the holdoff and the flicker wait for their kinds (B2).

- Lane B2, the rest of the ships, built in code: Star Wars (TIE bombers,
  an assault gunboat, IG-88's IG-2000, Bossk's Hound's Tooth, Dengar's
  Punishing One, Weequay skiffs; Y-wings and A-wings on your wing, from the
  galaxy's builders and GLBs), Rick and Morty (gunships, Morty fighters,
  Evil Morty's ship, the Zigerions, Krombopulos Michael, Squanchy, Mr.
  Poopybutthole, a Federation cruiser), Breaking Bad (balloons, Badger's
  beater, Gus's Volvo, the DEA helicopter over the roadblock, a Madrigal
  freighter as the capital ship). Every side has a capital ship now.

- Lane B3, troops per side: stormtroopers, scout troopers and a probe
  droid that calls a squad in (Star Wars, built); Evil Morty's guard (the
  cast's Morty in yellow) with the Federation's; the DEA in Hank's figure,
  the cartel in Tuco's, Jack's crew built (Breaking Bad).

- Lane C, NPCs with brains: `npcRules.js` (the engine and its
  relations), `npcs/brains/` (merchant, informant, rival, wingman, bounty),
  the registry `npcs/index.js` (Saul and Mike, Fett and Lando, Birdperson,
  Squanchy and Evil Morty), `npcs.js` drawing them, `scene.js`'s `meet`
  bringing one by now and then, `director.foretell` for the informant's
  word, and each crew's lines for each character of its side.

## Left

1. More characters: each is a row in `npcs/index.js` and its lines in
   `crews.js`'s `npc` (`crews.test.js` says which are missing). Star Wars
   has only Fett and Lando; an informant for it (Wedge? a Rebel agent) and
   a rival for the Falcon (Bossk as a rival, not a bounty) would round it out.
2. The merchant's offer only names a part on the radio; making it a real
   trade (the hangar opening on that part, or the part unlocked) is the
   hangar's business (`Hangar.jsx`, `outfit.js`).
3. The car builders had one pass in Lane B2 (the wings and the cabin glass
   were fixed); Gus's Volvo and Mike's sedan read close at map scale.
4. `RmWorld.jsx` (the C-137 lane) took `main` over the health budget's
   `big-files` (31 against 30) as this lane closed: its owner splits it.

## Checking it

- `/universe`, pick the RV in the hangar (or set `tp-universe-ship` to
  `"rv"` in localStorage), fly a minute: DEA SUVs and lowriders go by;
  within a minute or two a hunt, a roadblock, a convoy of trucks with Mike
  at each end, a Madrigal freighter calling for help with pickups on it,
  the bear.
- In dev, `window.__universeDebug` has everything: `director.soon('roadblock')`,
  `hunters.pack('cousins', state.ship, { size: 1 })`,
  `wingmen.join('saulcaddy', state.ship, 2)`,
  `leviathans.pass(state.ship, { leviathan: 'bear' })`, `traffic.convoy(state.ship)`.
- To see every ship at once: a page at the project root that imports
  `/src/components/universe/trafficModels.js` and lays out `buildTraffic(kind)`
  for each kind asked for (this session's was `ships.local.html?kinds=…&view=three|side|top`,
  kept out of git with `.git/info/exclude`; not committed).
- The troops: land on a planet and walk out (or `startFoot` from
  `window.__universeDebug`); the first squad comes in thirty-odd seconds.
- A character: `meetNpc('saul')` (or `mike`, `lando`, `squanchy`,
  `evilmorty`) brings one ahead of you; step them by hand as the hunters
  (`npcs.update(1 / 60, t, { you: state.ship, hunters: [], stations: [], solids: [] })`)
  to see one arrive, then let the scene's own loop voice it.
- A capital ship or the helicopter: `director.soon('destroyer')` (any
  crew), `director.soon('roadblock')` (the RV).
- A trait in the browser: `hunters.pack('dea', state.ship, { size: 3, ace: true })`
  and Hank's SUV pins you (`state.static` goes up, the HUD whites out);
  `hunters.pack('cousins', state.ship, {})` sits on you without a shot till
  you hit it. Software WebGL in the container runs at a frame or two a
  second, so step the fight by hand in the page:
  `for (let i = 0; i < 600; i++) hunters.update(1 / 60, i / 60, state.ship)`.
- `npm run lint`, `npm test`, `npm run build` all green at the merge.
