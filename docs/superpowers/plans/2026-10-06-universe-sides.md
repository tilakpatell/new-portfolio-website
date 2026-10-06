# Universe sides implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each crew on the universe map flies in its own universe of enemies, allies, civilians and set pieces, read from one tested registry, with a way to add characters and NPCs with their own AI.

**Architecture:** `universe/sides.js` is pure data plus small pure helpers; every system that today switches on `family` (`scene.js`, `director.js`, `traffic.js`, `wingmen.js`, `leviathans.js`, `skirmishes.js`, `footScene.js`, `online/protocol.js`) takes its answer from the crew's side. New ships are built in code (`trafficKit.js`) in `fleetBreakingbad.js` and the existing fleet files. NPC brains (`npcRules.js`) are a pure state-machine engine with intents the scene draws.

**Tech Stack:** React 19, Vite 8, Three.js r186, vitest. Pure rules in `.js` with a `.test.js` beside each.

**Spec:** `docs/superpowers/specs/2026-10-06-universe-sides-design.md`

## Global Constraints

- Game rules live in pure tested modules apart from the drawing; tests first.
- No runtime calls to asset services; no new downloaded models in Lane A or B.
- British spelling, curly quotes, plain sentences; comments say why.
- No Star Wars after Return of the Jedi beyond The Mandalorian and Ahsoka.
- `npm run lint`, `npm test`, `npm run build` all green before a push.
- Commit messages: one plain sentence about what changed.

## Review Focus

1. A crew id that isn't a crew (`sideOf('nope')`) must give `null`, and every system must keep working with no ship picked (a quieter mix of every side's traffic, no hunts). Test in `sides.test.js` and `director.test.js`.
2. Another pilot's hunters of a kind this pilot's side doesn't use must still draw and be hittable: `createHunters` gets every side's `factions` and `kinds`, and `protocol.js`'s whitelist is `allKinds`. Test in `protocol.test.js`.
3. A faction with no `hunted` line in a crew must fail `crews.test.js`, not fall silent on the comms.
4. `director.update` with a side that lacks an event's need (Breaking Bad has no `council`) must never return that event. Test in `director.test.js`.
5. Built kinds named by a side must exist in `BUILT_KINDS` (or `GLB`), or the fleet silently draws a TIE. Test in `sides.test.js` against `trafficModels.BUILT_KINDS` and `glbFleet.GLB`.

---

## Lane A: the registry and the rewiring (one PR)

### Task A1: `sides.js`

**Files:**
- Create: `src/components/universe/sides.js`, `src/components/universe/sides.test.js`

**Interfaces:**
- Produces: `SIDES` (`{ starwars, rickmorty, breakingbad }`), `sideOf(crewId) → sideId | null`, `sideFor(crewId) → side | null`, `factionsOf(sideId | null) → FACTIONS` (every side's when null), `kindsOf(sideId | null) → HUNTER_KINDS`, `namesOf(sideId | null)`, `allKinds` (array), `pick(side, role, rand) → factionId | null`, `wingOf(side, rand) → allyKind`, `squadKinds(side, n) → kinds[]`, `AHEAD_OF(side)`.
- A side: `{ id, label, crews, factions: { id: { kinds, ace?, laser, size, role, weight?, portal?, from? } }, kinds: HUNTER_KINDS rows, names, allies: { kind: WING_KINDS row + colour }, civil: [], traffic: [], convoy: { escort }, distress: { civil, pirates }, pieces: [], leviathan, troops: { kind: TROOPS row + gun }, squads: (n) => kinds[], ahead: { kind: n } }`.
- Hunt factions carry `role: 'hunt'`; one tough one alone `role: 'bounty'`; who attacks the distress call `role: 'pirates'`; what a capital ship launches `role: 'capital'`.

- [ ] Write `sides.test.js`: every crew in `CREWS` has a side; each side has ≥1 hunt faction, ≥1 bounty, 1 pirates, ≥1 ally, ≥1 civil, a distress civil, an escort, a leviathan, ≥2 troop kinds; every kind a faction names is in `kindsOf(side)` and `namesOf(side)` and in `BUILT_KINDS` or `GLB`; every ally kind is in `BUILT_KINDS` or `GLB`; `pick(side, 'hunt', rand)` only returns hunt factions over 200 draws; `allKinds` has no two sides disagreeing on one kind's stats; `sideOf('nope') === null`; `factionsOf(null)` has every side's factions.
- [ ] Run `npx vitest run src/components/universe/sides.test.js`; expect FAIL (module missing).
- [ ] Write `sides.js` with Star Wars and Rick and Morty as they are today (moved from `hunterRules.FACTIONS`, `HUNTER_KINDS`, `NAMES`, `wingRules.WING_KINDS`, `traffic.js`'s tables, `scene.js`'s `AHEAD`, `foot.js`'s `TROOPS`), and Breaking Bad new: factions `dea` (hunt: `suv` ×3, `suvace`), `cartel` (hunt: `lowrider`), `pollos` (capital: `pollostruck`), `cousins` (bounty: `cousins`), `jacks` (pirates: `pickup`); kinds with stats in the spec's spirit (SUV like a TIE but hp 2; lowrider like an interceptor with spread 1.6; truck hp 4 speed 17; cousins hp 7 speed 25 tail 0.5; pickup hp 1); allies `saulcaddy` (xwing's row, colour white), `mikesedan` (speed 20, fire [1.6, 2.4], spread 0.05); civil `pollostruck`, `madrigal`, `pestvan`; traffic `suv`, `lowrider`; convoy escort `mikesedan`; distress civil `madrigal`, pirates `jacks`; pieces `['roadblock']`; leviathan `'bear'`; troops `dea` (cop's row, gun `coppistol`), `cartel` (gromflomite's row, gun `rifle`); squads n<1 `['dea']`, n<3 `['dea','dea','cartel']`, else `['dea','cartel','cartel','cartel']`.
- [ ] `hunterRules.js`: `FACTIONS`, `HUNTER_KINDS`, `NAMES` re-exported from `sides.js` (`factionsOf(null)`, `kindsOf(null)`, `namesOf(null)`) so nothing else breaks; `wingRules.js`'s `WING_KINDS` likewise from the sides' allies.
- [ ] Run the test; expect PASS. Run `npm test`; expect all green.
- [ ] Commit: "Add the sides registry: who each crew meets, as data".

### Task A2: Breaking Bad's built ships

**Files:**
- Create: `src/components/universe/fleetBreakingbad.js`
- Modify: `src/components/universe/trafficModels.js:986` (spread `BREAKINGBAD_FLEET` into `BUILD`), `src/components/universe/traffic.js` TYPES (rows for `suv`, `suvace`, `lowrider`, `pollostruck`, `madrigal`, `pestvan`, `saulcaddy`, `mikesedan`, `cousins`, `pickup`).

**Interfaces:**
- Produces: `export const FLEET = { suv, suvace, lowrider, pollostruck, madrigal, pestvan, saulcaddy, mikesedan, cousins, pickup }`, each `(k) → { root: Mesh[], update?(t) }` as `fleetRickmorty.js`'s are, nose along +z, about 1 long in z.

- [ ] Build each with `trafficKit.js` (`loft`, `box8`, `plateXZ`, `rod`, `ball`, `standard`, `glowMaterial`): a car body is a `loft` of `box8` sections with a glass `loft` cabin, four wheel `turned`s, a pair of swept `plateXZ` wings at the sills, and a jet `turned` under the boot with a `glow` cone; the SUV black with a white-and-blue `glow` light bar (`mark: 'bar'`, blinked red and blue); Hank's SUV the same with a `glow` spotlight ball; the lowrider low and long in candy red with gold `metal` trim; the Pollos truck a white box with a red-and-yellow stripe and rocket pods; Madrigal a long blue container ship; the pest van a yellow box with a `glow` sign; Saul's Cadillac white with a `glow` "LWYRUP"-coloured plate; Mike's sedan dull brown; the Cousins' Mercedes silver, two together as one kind (two bodies side by side in one model); Jack's pickup rust red with a `glow` headlight pair.
- [ ] `sides.test.js` passes (every kind now in `BUILT_KINDS`); `npm run build` passes.
- [ ] Commit: "Build Albuquerque's winged cars for the universe map".

### Task A3: the systems read the side

**Files:**
- Modify: `src/components/universe/scene.js` (`FAMILY`, `either`, `SIDES`, `AHEAD`, `happen`, `helpFrom`, `farFight`, `stockUp`, `createHunters` call), `director.js` + `director.test.js`, `traffic.js`, `wingmen.js`, `leviathans.js`, `skirmishes.js`, `footScene.js` (squads, `needCast`, `TROOP_GUN`), `online/protocol.js` + `protocol.test.js`.

**Interfaces:**
- Consumes: Task A1's exports.
- `director.js`: `EVENTS[id].needs` (`'hunt' | 'capital' | 'council' | 'bounty' | 'pirates' | 'leviathan' | null`), `update(dt, { side, heat, busy, travelling, calm })` where `side` is a side object or null; an event is a choice when `needs` is null or `side.has(needs)`. `sides.js` gives each side `has(need)`.
- `leviathans.js`: `pass(ship, side, rand)`; the bear is a Task B item, so Lane A maps `'bear'` to the Cromulon's builder with the bear's name (an honest stand-in, and the crew's line says bear).
- `footScene.js`: squads from `squadKinds(side, S.squads)`; `TROOPS` from `side.troops` merged over `foot.js`'s; `needCast` from the side's troop kinds (the Meshy cast has no DEA or cartel figures: `built` stand-ins, as Luke is, until Lane B).

- [ ] `director.test.js`: replace `family` with `side` objects from `SIDES`; add: Breaking Bad never gets `council` or `destroyer`; every side gets `hunt`, `distress`, `convoy`, `bounty`, `leviathan`; a null side gets nothing.
- [ ] Run; expect FAIL. Change `director.js`; run; expect PASS.
- [ ] `protocol.test.js`: a pack with a Breaking Bad kind (`suv`) reads back; with a kind that's nowhere (`'tractor'`) is dropped. Run; FAIL. `protocol.js` imports `allKinds` from `../sides`; PASS.
- [ ] `scene.js`: `const side = () => sideFor(state.kind)`; `happen`: `hunt` → `hunters.pack(pick(side, 'hunt'), …)`; `council` → as now, only when `side.has('council')`; `destroyer`/`capital` → `pick(side, 'capital')`; `distress` → `pick(side, 'pirates')`; `bounty` → `pick(side, 'bounty')` (the Slave I load as now when the pick is `fett`); `helpFrom` → `wingOf(side)`; `farFight` → `side.skirmish` (`{ faction, escort, civil }` from the side's first hunt faction, its first ally and its distress civil); `stockUp` → `side.ahead`; `createHunters(map, { …, factions: factionsOf(null), kinds: kindsOf(null) })`.
- [ ] `traffic.js`: `kinds()`, `convoy`, `distress`, `setCrew` from `sideFor(crew)` (`traffic`, `civil`, `convoy.escort`, `distress.civil`); with no crew, every side's.
- [ ] `wingmen.js`: `COLOUR` from the sides' allies' `colour`.
- [ ] `footScene.js` as above.
- [ ] `npm test`, `npm run lint`, `npm run build` green; `node scripts/autopilot-check.mjs --routes /universe` and look at the screenshot.
- [ ] Commit: "Every system on the universe map reads the crew's side".

### Task A4: the crews' lines

**Files:**
- Modify: `src/components/universe/crews.js`, `crews.test.js`

- [ ] `crews.test.js`: for each crew, `linesFor(crew, 'hunted', f)` for every faction id of its side; `linesFor(crew, 'event', 'wingmen', ally)` for every ally kind; `'event', 'leviathan', side.leviathan`; `'foot', 'kill', troop` for every troop kind. Run; FAIL for the RV (dea, cartel, pollos, cousins, jacks, saulcaddy, mikesedan, bear, dea/cartel troops).
- [ ] Write the RV's lines (Walt and Jesse, a few words each, the site's own), and the X-wing's and Falcon's `wingmen` keyed by ally kind. PASS.
- [ ] Commit: "Walt and Jesse have a word for everyone in Albuquerque's sky".

### Task A5: docs, PR, merge

- [ ] `docs/architecture.md`: one bullet for `sides.js` under `src/components/universe/`; update the `hunters.js`, `traffic.js`, `director.js` bullets' first lines to say they read the side.
- [ ] `docs/superpowers/HANDOFF-universe-sides.md`: Done (this PR), Left (Lanes B and C, in order), Checking it (`/universe`, pick the RV in the hangar, `window.__tp?.director?.soon('hunt')` if exposed, else fly a minute).
- [ ] Push, open the PR, CI green, merge.

## Lane B: the sides' depth (Opus session; one PR per bullet or two)

### Task B1: hunter traits (`hunterRules.js`, tested)
- `trait` on a kind, read in `createHunt`'s per-hunter step: `bomber` (a straight run at 0.6 of the fight's speed that fires one slow laser (speed 14, damage 30, `burst: 1.2` map units: a hit inside the radius counts), then breaks); `holdoff` (never closes under `FIGHT.near * 2.5`; fires from range); `quietUntilFired` (`pack.provoked` false until `hit`/`damage` lands on any of its pack; no shots before); `flicker` (a hit that doesn't down it sets `hidden` 2 s: not in `targets`, not drawn); `spotlight` (on a run inside `FIGHT.range * 0.6`, event `{ type: 'spotlit' }` once a run: the scene sets `state.static = 1.5`).
- Tests per trait with the seeded rand, as `hunterRules.test.js` does.
- Assign: `tiebomber` bomber, `gunboat` holdoff, `cousins` quietUntilFired, `zigerion` flicker, `suvace` spotlight.
- [x] The five traits in `createHunt`, tested (`traits: …` in `hunterRules.test.js`); `TRAITS`, `BOMB`, `HOLDOFF`, `FLICKER` exported. As built: a holdoff kind takes its station 1.7 times further out and is pushed off you inside 1.6 × `HOLDOFF.near` whatever its mode (swinging out to a station ahead it would fly straight past you); a flickered one is off the wire and `damage` by number misses it too; a bomb's hit carries `bomb: true` and shakes the ship.
- [x] `suvace` spotlight and `cousins` quietUntilFired in `sides.js` (the other three wait for their kinds in B2); `sides.js` checks every kind's trait is one of `TRAITS` (`hunterRules.test.js`).
- [x] `hunters.js` hides a flickered model and draws a bomb fat; `scene.js` answers `spotlit` (`state.static` 1.5 s; the crew's `event.spotlit` line at most every 20 s), and `crews.test.js` wants that line of every crew whose side has a spotlight.

### Task B2: the rest of the built ships
- Star Wars: `tiebomber`, `gunboat`, `ig2000`, `houndstooth`, `punishingone`, `skiff` (pirates), `ywing`, `awing` (the galaxy has `ywing.glb`/`awing.glb`: add to `glbFleet.GLB` with `built: true` stand-ins).
- Rick and Morty: `gunship`, `mortyfighter`, `evilmortyship`, `zigerion`, `krombopulos`, `squanchship`, `poopyship`, `fedcruiser` (capital).
- Breaking Bad: `balloon` (big, slow civil), `bear` leviathan (`leviathans.js`: a one-eyed pink bear, drifting, turning slowly), `dearoadblock` set piece (`setpieces.js`: three SUVs and a helicopter drop in ahead with a searchlight cone; `interdict`).
- Each added to its side in `sides.js`; `sides.test.js` keeps every name honest.
- [x] Star Wars: `tiebomber` (bomber), `gunboat` (holdoff), `ig2000`, `houndstooth`, `punishingone` (`fleetStarwars.js`), `skiff` (the `weequay` pirates); `ywing` and `awing` built from `galaxy/fleetRebels.js` with `galaxy/lod/*.glb` over them (and `tiebomber`'s). Factions `navy` (the capital's launch), `ig88`, `bossk`, `dengar`, `weequay`. As built: allies may carry `damage`, `stay` and `tour` (`wingRules.js`, tested): the Y-wing hits for 2, the A-wing goes after 18 s whatever's on.
- [x] Rick and Morty: `gunship` (holdoff), `mortyfighter` and `evilmortyship` (the `mortys` hunt, ace), `zigerion` (flicker), `krombopulos` (bounty, quietUntilFired), `squanchship`, `poopyship`, `fedcruiser` (`fleetRickmortyFoes.js` and `fleetRickmortyFriends.js`, with what they share in `fleetRickmortyKit.js`: `fleetRickmorty.js` would have been 2,184 lines, over `docs/health/RULES.md`'s 1,500, so it was split as the rules say, every name kept and not a pixel changed). As built: the cruiser is the side's `capitalShip`, so Rick and Morty get the director's `destroyer` event too (its fighters `fedfleet`).
- [x] Breaking Bad: `balloon`, `beater` (ally), `gusvolvo` (the `pollos` ace, quietUntilFired), `deachopper` (`fleetBreakingbad.js`); `pollostruck` holds off. The bear was Lane A's. As built: the roadblock is the DEA pack in ahead plus `setpieces.js`'s `roadblock(ship)`, the helicopter hanging nose on with its searchlight, climbing away once they're seen off; a Madrigal freighter is Albuquerque's `capitalShip`, launching Gus's trucks.
- [x] Every capital ship through `setpieces.js`'s `destroyer(ship, kind)`; aces by kind in `Comms.jsx` (`hunted[ace]`, then `hunted.ace`); each ally's own `wingmen` line (`crews.test.js` checks they differ).

### Task B3: ground troops per side
- `foot.js` `TROOPS` rows for `stormtrooper`, `scout`, `probe` (droid: no gun, calls a squad: event `'called'`), `mortyguard`, `dea`, `cartel`, `jackscrew`.
- Figures: Star Wars built (as Luke: `footScene.js`'s `built`), Rick and Morty's `evilmorty` wardrobe body, Breaking Bad's from `public/models/albuquerque/` (`hank.glb`, `tuco.glb`, `declan.glb`: check each is on the Meshy skeleton with `scripts/`' inspect tooling; if not, built stand-ins).
- Lines per troop kind in each crew's `foot.kill`.
- [x] `foot.js` rows for `stormtrooper`, `scout`, `probe` (`calls: 8`: `march` returns `calls`, once each; `footScene.js` sends a squad of the side's others and says `foot.called`), `mortyguard`, `jackscrew`; tested in `foot.test.js`.
- [x] Figures by `side.troops[kind].figure` (`footScene.js`'s `troopLook`): `{ built }` (`LOOKS`: stormtrooper, scout, jackscrew; the probe droid its own build), `{ meshy }` (Evil Morty's guard is the cast's `mortyclone`, yellow), `{ url }` (the DEA is `hank.glb`, the cartel `tuco.glb`: all fourteen of `public/models/albuquerque/` have the Meshy skeleton's `Hips`, toes and `head_end`; loaded once a walk and copied). As built: the Star Wars crews no longer meet the Federation's troops on the ground; Jack's crew are built (there's no model of them; Declan's isn't theirs). `sides.test.js` checks each side's troops are its own, with real guns and figures that exist.
- [x] Lines: `foot.kill` for each new kind, `foot.called` for the X-wing and the Falcon (`crews.test.js`).

## Lane C: NPCs with brains (Opus session)

### Task C1: `npcRules.js` (pure, tested)
- `createBrains({ rand }) → { add(npc, at) → id, remove(id), update(dt, world) → { intents: [{ id, thrust, turn, pitch, fire, say }], events }, live }`.
- `world`: `{ you: { x, y, z, heading, pitch, speed }, hunters: targets[], allies: [], traffic: [] }`.
- Brains: `wingman` (delegates to `wingRules`), `bounty` (delegates to `createHunt` with one faction), `merchant`, `informant`, `rival`; each a file in `universe/npcs/brains/` exporting `(npc, state, world, dt, rand) → intent`.
- Relations: `fears` → `leaving` once a faction in `fears` is in `world.hunters`; `hunts` → the skirmish engine with the NPC as escort.

### Task C2: the registry and the first six
- `universe/npcs/index.js`: `saul`, `mike`, `fett`, `birdperson`, `squanchy`, `evilmorty`, with lines per crew in `crews.js` under `npc: { id: { hello, hit, leaving, seen } }`.
- `scene.js`: `createNpcs(map, { fleet, solids })` draws intents; the merchant parks at the nearest station and offers a part (the hangar's `modules.js`) on the radio; the informant says the director's next event.
- `crews.test.js`: every NPC on a crew's side has `hello` and `leaving` lines.
