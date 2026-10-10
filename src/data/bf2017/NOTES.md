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
- `cost.vehicles.default` 500, the AT-ST 1500, the AT-AT 0 (the mode gives it): as played.
- `cost.heroes.default` 4000: as played.
- `limits.heroesPerTeam` 1, `reinforcementsPerTeam` 4: as played.
- `bpRate` 1: the Instant Action option `InstantActionBPRate`’s default (“DEFAULT” of SLOW, DEFAULT, FAST; `ai.json`’s `instantAction`) as a multiplier.

## Read, not by hand, but worth knowing

- Weapon names are the strings `ID_W_<id>`; class names `ID_C_<CLASS>_TROOPER` or `ID_C_<CLASS>` (the Specialist has neither: its name is empty); hero names `ID_CHAR_<HERO>`. Ability and star card names follow no key the data shows and are left out.
- Vader’s armour levels read 850, 875, 900, 950 (`Affector_Health_DarthVader_VaderArmor1..4`).
- A mount’s own health is 1 (`WSMountHealthComponentData`): its rider takes the hits.
