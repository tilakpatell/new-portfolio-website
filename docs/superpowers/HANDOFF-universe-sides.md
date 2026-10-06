# Handoff: the sides (each crew's own universe of enemies and allies)

Branch `claude/universe-sides`, merged to `main`. The spec is
`docs/superpowers/specs/2026-10-06-universe-sides-design.md`; the plan is
`docs/superpowers/plans/2026-10-06-universe-sides.md` (Lane A done here;
Lanes B and C are left).

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

## Left (in order; the plan has the detail)

1. **Lane B2, the rest of the ships**: Star Wars (`tiebomber`, `gunboat`,
   IG-88, Bossk, Dengar, pirate skiffs, Y-wings and A-wings from the
   galaxy's GLBs), Rick and Morty (gunships, Morty fighters, Evil Morty's
   ship, the Zigerions, Krombopulos Michael, Squanchy, Mr. Poopybutthole, a
   Federation cruiser), Breaking Bad (balloons, the roadblock as a set
   piece with a helicopter, the Madrigal freighter jumping in). Each is a
   `sides.js` row plus a builder; `sides.test.js` keeps every name honest.
2. **Lane B3, troops per side**: stormtroopers and scouts for Star Wars,
   Evil Morty's guard, Albuquerque's figures (`public/models/albuquerque/`:
   check they're on the Meshy skeleton) for the DEA and the cartel.
3. **Lane C, NPCs with brains**: `npcRules.js`, the five brains, the
   registry (`universe/npcs/`), Saul, Mike, Fett, Birdperson, Squanchy and
   Evil Morty as characters with lines and relations.
4. The car builders are first drafts (`fleetBreakingbad.js`): the wings'
   fins and the glass bands could be better shaped; a pass with the
   threejs-aaa-graphics-builder skill would help.

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
- To see every car at once: a page at the project root that imports
  `/src/components/universe/trafficModels.js` and calls `buildTraffic(kind)`
  for each of `fleetBreakingbad.js`'s `FLEET` keys (the session's harness
  was `cars-check.html`, not kept).
- A trait in the browser: `hunters.pack('dea', state.ship, { size: 3, ace: true })`
  and Hank's SUV pins you (`state.static` goes up, the HUD whites out);
  `hunters.pack('cousins', state.ship, {})` sits on you without a shot till
  you hit it. Software WebGL in the container runs at a frame or two a
  second, so step the fight by hand in the page:
  `for (let i = 0; i < 600; i++) hunters.update(1 / 60, i / 60, state.ship)`.
- `npm run lint`, `npm test`, `npm run build` all green at the merge.
