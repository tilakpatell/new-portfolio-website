# The Battlefront rulebooks: the hand values

Everything under `src/data/bf2017/` is written by `node scripts/bf2017-data.mjs all --root <export> --level hoth_01 --era Orig` from the 2017 game’s data, each number with a `_source` naming its record, except the two files below, which carry `"source": "hand"`. One line per hand value: what it is, why it is by hand, and where to look to replace it.

## `maps/hoth.stages.json`

The stage order and objectives of Hoth’s Galactic Assault are a logic graph in the game (`PF_GameMode_Conquest_Staged`, `FantasyBattle_Logic`’s `Delay`, `Compare` and `IntHub` nodes), readable by a person and not by a script. What the data does say, and this file follows:

- **Three stages**, not four: the strings name `STAGE1` to `STAGE3`, each with a line per team (`TAKE OUT THE WALKERS` / `TAKE OUT ANY THREATS TO THE AT-ATS`; `STOP THE IMPERIALS FROM ENTERING THE BASE` / `ADVANCE AND SECURE THE HANGAR AREA`; `HOLD OFF THE IMPERIAL ATTACKERS UNTIL OUR ESCAPE` / `STOP THE REBELS FROM ESCAPING`). The ids are `walkers`, `hangars`, `escape`.
- **walkers**: two escorts, one per walker path: `FantasyBattle_Logic:123` starts beside the AT-AT spawner `FantasyBattle_Logic:59` and `:303` beside `:208`, both ending at the hangar gates. The six `uplink` objectives are the six 3 m-high volumes in `FantasyBattle_Logic` along the paths; that they are the uplinks the Rebels arm to call the bombers is read from where they sit, not from the graph. Check it against `PF_EscortTracker` and the `SW02_VO_Walker` prefab’s links.
- **hangars**: the two 10 m-high volumes `FantasyBattle_Shapes:33` and `:68` sit behind the two hangar gates (the gate spheres `FantasyBattle_Shapes:73` and `:23`, radius 12.09 m, each with a `PF_Hoth_Destruction_Gate` and a `PF_CapturePoint`: `FantasyBattle_Logic:209` and `:134`). Which is east and which west is a guess: east is the larger X (251 m against 179 m), taking +X as east. Swap the two `name`s if the game’s compass says otherwise.
- **escape**: the three `PF_Interact_PlanetaryBattle_Bomb` prefabs deep in the base (`FantasyBattle_Logic:4`, `:131`, `:63`, west to east) take the three fuel strings in that order: depot, pipes (`_FUEL_SILO` reads “FUEL PIPES”), station. The order is a guess; the names are the game’s.
- **spawns**: each stage’s spawn areas (`SpawnLocationFinderShapeData`, Empire team 2 attacking, Rebels team 1 defending) are chosen by how far the front has come, on the Z of each area’s centre: walkers, attack Z −900 to −1150, defend −1150 to −1420; hangars, attack −1150 to −1420, defend −1420 to −1600; escape, attack −1420 to −1720, defend −1600 to −1720. The data’s own switch is each area’s `Enabled` flag, set by the graph; read it there to replace the bands. The drawing behind these choices is `docs/superpowers/evidence/battlefront-lane0/hoth-layout.svg`.
- `vehicles`: the AT-AT in the walkers stage, from the map’s `vehicleSpawns`.

## `points.json`

Battle Points are a logic graph too (`Prefabs/GameplaySupply/PF_Gameplay_BattlePoints_Local`: an `IntEntityData` default 1000 and an `EventToInt` of 1 to 4). Until that graph is read:

- `earn.kill` 100, `assist` 50, `vehicleKill` 150, `heroKill` 250: the game as played.
- `earn.objectiveTick` 10 a second on an objective, `objectiveDamage` 1 a point of damage to one, `squadSpawn` 25: the game as played.
- `cost.aerial` 1000, `enforcer` 2000, `infiltrator` 2000: the deploy screen as played (the three kinds are the data’s `Class_Special_*`).
- `cost.vehicles.default` 500, the AT-ST (`Kit_Vehicle_ATST`) 1500, the AT-AT (`Vehicle_Ground_AT-AT_MP`, the map’s walker) 0 since the mode gives it: as played. Keys are `vehicles.json` row ids.
- `cost.heroes.default` 4000: as played.
- `limits.heroesPerTeam` 1, `reinforcementsPerTeam` 4: as played.
- `bpRate` 1: the Instant Action option `InstantActionBPRate`’s default (“DEFAULT” of SLOW, DEFAULT, FAST; `ai.json`’s `instantAction`) as a multiplier.

## Read, not by hand, but worth knowing

- Weapon names are the strings `ID_W_<id>`; class names `ID_C_<CLASS>_TROOPER` or `ID_C_<CLASS>` (the Specialist has neither: its name is empty); hero names `ID_CHAR_<HERO>`. Ability and star card names follow no key the data shows and are left out.
- Vader’s armour levels read 850, 875, 900, 950 (`Affector_Health_DarthVader_VaderArmor1..4`).
- A mount’s own health is 1 (`WSMountHealthComponentData`): its rider takes the hits.

## `maps/sb_endor.stages.json`

Endor’s space level (`Levels/Space/SB_Endor_01`) says its Starfighter Assault plainly: `SpaceBattle_Gameplay`’s `SpaceBattleObjectiveListEntityData` lists the phases in order (`Phase 1 - Corvettes`, `Phase 2 - Mines`, `Phase 3 - MC80`, then an empty `Intermission`), each with its objectives by name, the attacker (`Team2`, the Empire) and the defender (`Team1`, the Rebels), and its side objectives (the TIE bomber flights). The map row keeps it as `spaceBattle`. What the hand file adds:

- **Five stages, from three phases**: the MC80’s phase is three in the game’s strings (`…_PHASE_3` the top, `…_PHASE_3B` from beneath, `…_PHASE_3C` the rear engines), so the stages are `corvettes`, `mines`, `top`, `beneath`, `engines`, the last breaking the MC80 up.
- **corvettes**: `CR90_A`, `_B`, `_C` are the three `PF_CorvetteCR90_01` in `SpaceBattle_SecondaryObjective_Cruisers` (`:69`, `:377`, `:875`), in the layer’s order; each sinks its corvette.
- **mines**: the six `PF_Endor_SpaceBattles_Transmitter_Objective` in `SpaceBattle_ScriptedEvents` (named `REBEL MINE` in the prefab) take `Destroy Mine A` to `F` in the layer’s order: a guess.
- **top, beneath, engines**: the MC80 target prefabs (`Objectives/PF_SpaceBattles_MC80_target_*`) each hold one part of the MC80 the mode’s sub-level places (`TL01` the large nodule 01, `TL02` 02, `TR01` 04, `TR02` 03, `bottom_front` 05, `bottom_left` 06, `bottom_right` the nodule hangar, the final stage’s engines the engine target collision); `MC80 A1` to `A4` and `B1` to `B3` take them in that order: a guess.
- **gates and hp** (`opensAt` 0, 150, 270, 360, 440 s; hp 210, 240, 200, 170, 160): hand, so a battle the AI fights alone runs its ten minutes about as the galaxy’s battles do (`universe/battlePlan.js`’s `PLAN`).
- **bombers**: four of the eleven TIE bomber flights, one a stage, three bombers each (the layer’s `Vehicle_Air_TieBomber` spawns stand in threes), at hand times.
- **camera**: the level’s intro and outro cameras are Cinematics tracks (`Partition_*` `GroupTrackRootData`), not `CameraEntityData`; the hand camera is behind the Star Destroyer, looking at the MC80.
- **fighters**: the level’s own classes as the galaxy’s kinds: X-wing, A-wing, Y-wing; TIE fighter, TIE interceptor, TIE bomber.

## `maps/sb_kamino.stages.json`

Kamino’s space level (`Levels/Space/SB_Kamino_01`), read the same way: the Separatists (`Team2`) attack, the Republic (`Team1`) defends; the phases are `Phase  - Venator Bridges` (the game’s own double space), `Phase 2 - Cruisers`, `Phase 3 - Venator Returns`, and the last is two stages by its strings (`…_PHASE_3` the engines, `…_PHASE_3_A` the beam weapon). Its launch points are its phases’ own layers (`SpaceBattle_Phase1` to `3`; Fondor’s `_EmpireSpawns` and `_RebelSpawns`, the droid battleship’s `Spacebattle_Phase1`), each spawn kept with its `phase`.

- **ships**: the mode’s sub-level places two Venators (`venatorstardestroyer_hull_01`, `#0` and `#1` in its order), three Republic cruisers (`jedicruiser_hull_01`, 318 m, drawn as the galaxy’s corvette at their own length) and three Providence dreadnoughts. The Venator with the engines’ and the beam weapon’s health states is the one that returns: the flagship.
- **bridges**: `Bridge A` and `B` are the first Venator’s two control towers (`venatorcontroltowerleft_healthstate#0`, `right#0`): which is A is a guess.
- **cruisers**: `Cruiser A` to `C` the three cruisers in the sub-level’s order; each sinks its ship.
- **engines, beam**: `Engine A` the left engines’ health state, `B` the right’s (a guess); `Laser` the laser base’s.
- **gates and hp**, **bombers** (two of the droid bomber flights), **camera**: hand, as Endor’s.
- The level is fought low over Tipoca City, on Kamino’s ocean (its art places the city’s pillars and domes at sea level), not in orbit: its pack wants the surface’s frame, or the city left out, and is not built yet.
- The game’s Team1 is the light side’s in every level read so far (Hoth, Endor, Kamino), as the battle’s team 0 is.

`maps/sb_fondor.json` and `maps/sb_droidbattleship.json` are the rulebooks alone (their systems are not in the galaxy yet): Fondor’s phases are Cruisers, Shields, Clamps and Reactor; the droid battleship’s Tractor Beams, Generators, Towers and Reactor.
