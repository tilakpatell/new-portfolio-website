# Battlefront lane 0: the extractor and the rulebooks. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 2017 game's tuning tables, team rosters, AI tables and Hoth's Galactic Assault layout are read from the Frosty export by a tested extractor and committed as small JSON rulebooks under `src/data/bf2017/`, with every number traceable to its asset, so lanes 1 to 5 build on data and not on memory.

**Architecture:** Pure parsers (`scripts/lib/bf2017-ebx.mjs`) load one EBX JSON asset, resolve its internal `$ref`s and external `$asset` pointers, read transforms and shapes and walk numbers; builders (`scripts/lib/bf2017-rulebook.mjs`) follow each kind's reference chain (ability → weapon → firing, sway, overheat, projectile; team → faction, heroes, specials, vehicles; level → mode layers) into the rulebook rows the spec's section 8 defines; the CLI (`scripts/bf2017-data.mjs`) runs them against `--root` and writes `src/data/bf2017/*.json`. Hand-authored values live in two small files with `"source": "hand"`. `src/lib/battlefront/rulebook.js` gives the rules typed access.

**Tech Stack:** Node 22 (`fs`, `zlib` for `.json.gz`), Vitest, the repo's `scripts/lib/args.mjs`, `scripts/lib/bf2017-paths.mjs` (`isSequel`), `scripts/lib/bf2017-manifest.mjs` (the models manifest, for vehicle model names).

**Spec:** `docs/superpowers/specs/2026-10-10-battlefront-game-design.md` (sections "What the game files hold", "Decisions" 2 and 10, "The mechanics catalogue", 8 "Rulebook formats", 12 "Open assumptions" 1 to 4 and 6).

## Global Constraints

- The export root is `C:\Users\tilak\Downloads\BF2_Extract\web` on the owner's machine (data as `data/<Name>.json`, index `data.tsv`, strings `../web_opt/strings/English.json`, map manifests `../web_opt/maps/<path>.json`); in a cloud session it is `lab/assets/bf2017/` after `node scripts/bf2017-fetch.mjs data '<glob>'` (the fetch gains a `data` command in Task 7; the bucket holds `data/` as `.json.gz`). The CLI takes `--root` and reads both layouts (`.json` or `.json.gz`).
- Nothing from the export is committed except fixtures (one asset each, under 40 KB, under `scripts/fixtures/bf2017/data/`) and the rulebooks. The rulebooks together stay under 2 MB; `maps/hoth.json` under 600 KB.
- Every numeric leaf in a rulebook has a `_source` sibling naming `<asset>#<Type>.<Property.Path>`, or the row carries `"source": "hand"` and a line in `src/data/bf2017/NOTES.md`. `src/data/bf2017/rulebook.test.js` walks every file and fails otherwise.
- The sequel era is refused by `isSequel` from `scripts/lib/bf2017-paths.mjs`, extended with the faction and level names: `NewEra`, `FirstOrder`, `Resistance`, `Jakku`, `Takodana`, `StarKiller`, `Crait`, `Resurgent`, `Kylo`, `Rey`, `Finn`, `Phasma`, `BB9E`, `ep7`, `ep9`. A refused name is skipped and counted, never written.
- Coordinates stay the export's: metres, +Y up, +Z forward; yaw = `Math.atan2(forward.x, forward.z)`.
- `src/data` imports nothing but data; the JSON is imported with `import x from './x.json'` (Vite handles it) by `src/lib/battlefront/rulebook.js` only.
- Files under 800 lines; tests beside files, under a second, no network; British spelling and curly quotes in prose; commits one plain sentence with the session's attribution lines; merge commits, never force-push.
- Before the PR: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## Review Focus

1. **An asset whose chain is broken** (a `$asset` that names a record not in the export, or a `$ref` out of range): the builder returns the row with that field absent and a `_missing` list, never throws, and the CLI prints one line per missing link. Task 2's test `a weapon whose projectile is missing still has its firing row`.
2. **A `.json.gz` root** (the bucket layout): `loadAsset` reads it the same as `.json`. Task 1's test `reads a gzipped asset`.
3. **Two spawn points with one transform** (the export has duplicates between `Logic` and `Spawns` layers): `mapRow` keeps one, keyed by position rounded to 0.01 m and team. Task 6's test `duplicate spawns collapse`.
4. **A team file that lists a sequel-era hero** (`Heroes_Dark` lists Kylo beside Vader): the hero is dropped and counted in `refused`, the rest kept. Task 4's test `sequel heroes are refused from a team`.
5. **A stage that names a volume id not in the map** (a typo in the hand file): `rulebook.test.js` fails naming the stage and the id. Task 8's test.

---

## File structure

| File | Responsibility |
| --- | --- |
| `scripts/lib/bf2017-ebx.mjs` (+ test) | `readIndex`, `loadAsset`, `deref`, `follow`, `rootOf`, `objectsOf`, `numbersOf`, `transformOf`, `yawOf`, `pointsOf`, `resolveStrings` |
| `scripts/lib/bf2017-rulebook.mjs` (+ test) | `weaponRow`, `abilityRow`, `cardRow`, `classRow`, `heroRow`, `reinforcementRow`, `vehicleRow`, `teamRow`, `aiRulebook`, `mapRow`, `withSources`, `checkSources` |
| `scripts/bf2017-data.mjs` | the CLI: `all`, one rulebook, `fixture`, `--root`, `--level`, `--out`, `--dry` |
| `scripts/bf2017-fetch.mjs` | gains `data '<glob>'` (bucket `data/**.json.gz` into `lab/assets/bf2017/data/`) |
| `scripts/fixtures/bf2017/data/**` | the cut assets (Task 1 lists them) and `data.tsv`, `strings.json` (the ids the fixtures use) |
| `src/data/bf2017/*.json`, `maps/hoth.json`, `maps/hoth.stages.json`, `points.json`, `NOTES.md`, `rulebook.test.js` | the rulebooks and their test |
| `src/lib/battlefront/rulebook.js` (+ test) | typed accessors |
| `docs/assets/battlefront-2017.md` | a "Data" section |

---

### Task 1: The parsers

**Files:**
- Create: `scripts/lib/bf2017-ebx.mjs`, `scripts/lib/bf2017-ebx.test.mjs`
- Create fixtures (cut from the export with Task 7's `fixture` command once it exists; for now by hand: copy the file, keep it whole when under 40 KB, else keep the root object and every object a `$ref` from the root reaches, re-indexed): `scripts/fixtures/bf2017/data/data.tsv` (the rows of the fixtures only), `Gameplay/Equipment/Rifles/A280C/{WeaponFiring_A280C,W_BlasterRifle_A280C,WeaponSway_A280C,OverheatConfig_Rifle_A280C,Ability_Weapon_BlasterRifle_A280C}.json`, `Gameplay/Kits/MP/Assault/{Affector_AssaultHealth,Affector_AssaultHealthRegen,Ability_Assault_CombatRoll_CharacterState,Class_Assault}.json`, `Gameplay/Kits/Hero/DarthVader/{Ability_DarthVader_ForceChoke_02,Affector_Health_DarthVader,Kit_Hero_DarthVader}.json`, `Gameplay/Teams/MP/Orig/Team_Light_Orig_HO.json` (cut), `Gameplay/Teams/MP/Heroes_Light.json`, `AI/BattleAI/{Cover/CoverConstants,Tactics/AIRebelSoldierTactics,Templates/Rifleman_Template,Weapons/AIFiringPatterns}.json`, `Levels/MP/Hoth_01/FantasyBattle_Shapes.json`, `Levels/MP/Hoth_01/FantasyBattle_Logic.json` (cut to 12 spawns, 2 waypoints, 2 locators), `Levels/MP/Hoth_01/FantasyBattle_Gameplay.json` (cut to the 11 `CheckedLocalizedStringEntityData` and the 14 prefab references), one of them also saved as `.json.gz`; `strings.json` with the 11 Hoth ids.

**Interfaces:**
- Produces:
  - `readIndex(root) → Map<name, { type, file, bytes }>` from `<root>/data.tsv` (tab-separated `name type file bytes`, no header).
  - `loadAsset(root, name) → { name, type, guid, root, objects } | null` reading `<root>/data/<name>.json` or `.json.gz` (gunzip through `zlib.gunzipSync`); `null` when neither exists.
  - `rootOf(asset) → object` (`asset.objects[asset.root]`); `objectsOf(asset, type) → object[]`.
  - `deref(asset, v) → object | null` for `{ $ref: i }`; `follow(root, v) → asset | null` for `{ $asset: name }` through `loadAsset` with a per-process cache; `isSequel(name)` re-exported from `bf2017-paths.mjs` after Task 7 extends it.
  - `numbersOf(obj, { skip = SKIP_KEYS, depth = 8 }) → [[path, value]]` for every finite number not in `SKIP_KEYS = ['Identifier', 'TypeNameHash', 'Flags', 'TypeHash', 'OutHash', 'LightmapResolutionScale', 'HologramProjectorIndex']`, paths dotted (`FireLogic.RateOfFire`).
  - `transformOf(obj) → { at: [x, y, z], yaw } | null` from a `Transform` (`trans`, `forward`) or `BlueprintTransform`; `yawOf(forward) → Math.atan2(forward.x, forward.z)`.
  - `pointsOf(shape) → { points: [[x, z]], y, height, closed }` for `VolumeVectorShapeData` and `SpawnLocationFinderShapeData` (`y` is `Points[0].y`); spheres `{ at, r }` from `SphereData`; boxes `{ at, half: [x, y, z], yaw }` from `OBBData`.
  - `resolveStrings(ids, strings) → Record<id, text>` over `web_opt/strings/English.json`'s shape (read it once in Task 7 and write the fixture `strings.json` the same way).

- [ ] **Step 1: Failing tests** in `bf2017-ebx.test.mjs` with `ROOT = scripts/fixtures/bf2017/data`: `readIndex` has `Gameplay/Equipment/Rifles/A280C/WeaponFiring_A280C` of type `WeaponFiringDataAsset`; `loadAsset` returns 3 objects and `rootOf().$type === 'WeaponFiringDataAsset'`; `reads a gzipped asset` (the `.json.gz` copy) gives the same `guid`; `deref` of the root's `Data` gives a `WeaponFiringData`; `numbersOf` on object 1 includes `['FireLogic.RateOfFire', 600]`, `['Shot.InitialSpeed.z', 700]`, `['OverHeat.OverHeatThreshold', 0.8]` and excludes any `Identifier`; `transformOf` on the first `AlternateSpawnEntityData` of the Logic fixture gives `at` `[-31.6588, 313.1801, -975.2903]` to 4 places and `yaw` `Math.atan2(0.4769736, -0.878914952)` to 6 places; `pointsOf` on the first `VolumeVectorShapeData` of the Shapes fixture gives `points[0]` `[168.96, -1044.48]` and `y` `817.5338`; `follow` of `{ $asset: 'Gameplay/Kits/MP/Assault/Affector_AssaultHealth' }` loads it and a second call returns the same object; `loadAsset` of a name not in the fixtures is `null`.
- [ ] **Step 2: Run** `npx vitest run scripts/lib/bf2017-ebx.test.mjs` → FAIL (module missing).
- [ ] **Step 3: Implement** `bf2017-ebx.mjs` (header comment: what an EBX dump is, the pointer shapes, why numbers are walked by path).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Parsers for the Battlefront 2017 data dump`.

### Task 2: Weapons

**Files:**
- Create: `scripts/lib/bf2017-rulebook.mjs`, `scripts/lib/bf2017-rulebook.test.mjs`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `withSources(row, sources) → row` writes `<key>_source` siblings; `checkSources(json) → string[]` (paths of numeric leaves with neither a `_source` sibling nor a `source: 'hand'` on an ancestor), shared with `src/data/bf2017/rulebook.test.js` by copying the twelve-line function there (src/data imports nothing from scripts).
  - `weaponRow(root, abilityName) → { id, name, family, firing, heat | ammo, damage, dispersion, recoil, zoom, range, mods, colour, _missing }`: `id` the `W_` blueprint's short name lower-cased (`a280c`), `family` the folder (`Rifles` → `rifle`), the chain `Ability_Weapon_* → W_* (SoldierWeaponBlueprint: SoldierWeaponData.WeaponStates, BlasterWeaponData, WeaponOverheatModifier) → WeaponFiring_* → WeaponSway_* → OverheatConfig_*`, and the projectile from the firing data's `Shot.ProjectileData` or the ability's references (whichever resolves; record which in `_source`). `firing = { rof: FireLogic.RateOfFire, burst: Shot.NumberOfBulletsPerBurst, burstsPerMinute, speed: Shot.InitialSpeed.z, bulletsPerShot: Shot.NumberOfBulletsPerShot, deploy: DeployTime, charge: HoldAndRelease when MaxHoldTime > 0 }`; `heat = { perBullet: WeaponOverheatModifier.HeatPerBullet (else OverheatConfig.HeatPerBullet), dropPerSecond, dropDelay: OverheatDropDelay, threshold: OverHeatThreshold (the config's when the firing data's is 0), penalty: OverHeatPenaltyTime, overheatedDrop: OverheatedDropMultiplier, warning: HeatWarningThreshold, cooling: { window: [DifficultyInterval[0].Start, .End], shrink: OnSuccess, reset: OnFailure, successPenalty, failurePenalty, minHeat: MinimumTriggerHeat, vent: VentingSettings.Duration, super: [ActiveCooldownSuperInterval.Start, .End] } }` when `Ammo.MagazineCapacity === -1`, else `ammo = { magazine, magazines, reload: ReloadTimeBulletsLeft }`; `damage` from the projectile (the field names found in Task 2 step 3 are written into the module's header; expected `StartDamage`, `EndDamage`, `DamageFalloffStartDistance`, `DamageFalloffEndDistance` on a `BulletEntityData`-like object, with `BlasterWeaponData.ProjectileParameters.{Min,Max}DamageMultiplier` as `min`, `max`); `dispersion` one entry per `GunSwayData.Dispersion[i]` with `stance` = `['stand', 'crouch', 'prone', 'moving', 'zoomStand', 'zoomCrouch', 'zoomProne', 'zoomMoving'][i]` (the first six exist on the A280C); `recoil = { spring: CameraRecoilData.SpringConstant, damping }`; `range = SoldierWeaponData.MaxRangeMeterDistance`; `mods` the `U_<Weapon>_{Barrel,Cell,Scope}` names found in the folder; `colour` from the faction later (Task 4 fills it from `BlasterProjectileColorUnlockUserData_*`).

- [ ] **Step 1: Failing tests**: `weaponRow(ROOT, 'Gameplay/Equipment/Rifles/A280C/Ability_Weapon_BlasterRifle_A280C')` has `id 'a280c'`, `firing.rof 600`, `firing.burst 3`, `firing.speed 700`, `heat.perBullet 0.03334`, `heat.dropPerSecond 0.3`, `heat.threshold 0.8`, `heat.cooling.window [0.8, 0.65]`, `heat.cooling.super [0.4, 0.3]`, `heat.cooling.vent 1`, `dispersion[0]` `{ stance: 'stand', max: 0.8, perShot: 0.08, decay: 1, noFireDelay: 0.2 }`, `dispersion[3].min 0.5`, `recoil.spring 3000`, `range 200`, and `firing.rof_source` ends with `#FiringFunctionData.FireLogic.RateOfFire`; `a weapon whose projectile is missing still has its firing row` (a fixture copy with the projectile pointer renamed to a name not in the fixtures: `damage` absent, `_missing` has one entry, no throw); `checkSources` on the row is `[]` apart from `damage` when missing.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; on the real export (`BF2_ROOT`), run `node scripts/bf2017-data.mjs weapons --root $BF2_ROOT --dry --only a280c` once Task 7 exists, or a ten-line `node -e` now, to find the projectile chain and its damage field names; write them in the header comment and in `damage`'s mapping. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The weapon rulebook row, from ability to projectile`.

### Task 3: Classes, abilities and cards

**Files:**
- Modify: `scripts/lib/bf2017-rulebook.mjs`, its test

**Interfaces:**
- Produces:
  - `abilityRow(root, name) → { id, name, kind: 'active' | 'state' | 'passive', activation, active, recharge, cost, channels: string[], ranks: [{ modifiers: [{ property, op: 'set' | 'mul' | 'add', value }] }], _missing }` from `BasicPlayerAbilityAsset` (`ActivationTime`, `ActiveTime`, `RechargeTime`, `TriggerCost`, `BlockingChannels[].$ref → the channel asset's short name`, `AbilityModifiers[] → PlayerAbilityPropertyModifierActiveValue { ActiveTime }` and `PlayerAbilityPropertyOutput{Float,Int}ModifierValue { Value }` grouped by rank index where the modifier names a rank, else rank 0), `CharacterStatePlayerAbilityAsset` (`kind 'state'`), `PassivePlayerAbilityAsset` (`kind 'passive'`).
  - `cardRow(root, name) → abilityRow` for a `ValueUnlockAsset` (`U_Ability_*`, `SC_*`): the unlock's referenced ability or affector rows, `ranks` from `RankData[]` when the referenced asset is an affector.
  - `classRow(root, cls, era, faction) → { id: '<faction>-<era>-<cls>' lower, cls, era, faction, name, health, regen: { rate, delay }, weapon, abilities: [{ slot: 'left' | 'middle' | 'right', id }], cards: string[], kits: string[] }` from `Gameplay/Kits/MP/<Cls>/`: `Class_<Cls>` and `GP_<Cls>` (the ability slots from the gameplay prefab's ability set component, in order), `Affector_<Cls>Health.MaxHealth`, `Affector_<Cls>HealthRegen.RankData[0].{RegenerationRate, RegenerationDelay}`, `DefaultWeapon_<L|D>_<Cls>_<Era>` → the weapon ability name, `Kit_<L|D>_<Cls>_<Era>_<MAP>` names as `kits`.

- [ ] **Step 1: Failing tests**: `abilityRow` of Force Choke: `kind 'active'`, `recharge 25`, `active 1.5`, `activation 0.1`, `ranks.length >= 1`; of the Assault roll: `kind 'state'`, `cost 0.5`, `recharge 4`, `active 0.1`; `classRow(ROOT, 'Assault', 'Orig', 'L')` has `health 150`, `regen { rate: 30, delay: 6 }`, `weapon` ending `A280C` or the fixture's default (assert the `_source` names `DefaultWeapon_L_Assault_Orig`), `abilities.length 3` when the fixture `GP_Assault` is cut in (add it to the fixtures: under 40 KB cut to the ability set component), `cards` non-empty from the team's `AllPlayerAbilities` entries starting `SC_` (pass `{ team }` as a fourth argument).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Class, ability and star card rows`.

### Task 4: Heroes, reinforcements, vehicles and teams

**Files:**
- Modify: `scripts/lib/bf2017-rulebook.mjs`, its test; `scripts/lib/bf2017-paths.mjs` (`isSequel` gains the names in Global Constraints) and its test

**Interfaces:**
- Produces:
  - `teamRow(root, era, level) → { light: side, dark: side, refused: string[] }` from `Gameplay/Teams/MP/<Era>/Team_{Light,Dark}_<Era>_<MAP>` (`MAP` the level's two or three letter code: `HO`, `EN`, `MOS`, `YA`, `DS`, `SCAR`, `KASH`, `KAM`, `THEE`, `GEO`, `BES`; a table in the module): `side = { faction (WSFaction short name), classes: [classRow ids], heroes: [names from the Heroes_* asset], reinforcements: [names from SpecialSoldiers], vehicles: [names from Vehicles], heroVehicles, abilities: AllPlayerAbilities short names, emotes, voiceLines, colour }`, `colour` from the faction's `BlasterProjectileColorUnlockUserData_*` reference (`red`, `green`, `blue`).
  - `heroRow(root, name) → classRow fields + { id (the kit folder lower-cased: 'darthvader', 'luke'), side: 'light' | 'dark', armour: number[], saber: { hilt, colour } | null, abilities, clipPrefix }` from `Gameplay/Kits/Hero/<Hero>/`: `Kit_Hero_*`, `Class_Hero_*`, `GP_Hero_*`, `Affector_Health_*` (`MaxHealth`) and `_Armor1..4` as `armour`, `Ability_*` rows, `U_Lightsaber_Deflect_*` as `saber.deflect`, `clipPrefix` the hero's clip family (`Vader`, `Luke`, `Maul`… from `Characters/Heroes/Specializations/Hero_Lightsaber_<Hero>` or the kit name).
  - `reinforcementRow(root, name) → classRow fields + { kind: 'aerial' | 'enforcer' | 'infiltrator' (by a table of the Specials folder names) }` from `Gameplay/Kits/Specials/<Name>/`.
  - `vehicleRow(root, name) → { id, kind: 'ground' | 'air' | 'stationary' | 'mount' | 'capital', name, health, seats: [{ role, weapons: string[] }], speed, abilities: string[], overheat, model }` from `Gameplay/Vehicles/<Kind>/<Name>/<Name>{,_Gameplay,_Weapons,_AI}` (`VehicleBlueprint`'s health component, entries as seats, the weapons file's firing rows by `weaponRow`'s chain on vehicle weapons), `model` the manifest model name when `bf2017-manifest.mjs` finds one whose name contains the vehicle's.

- [ ] **Step 1: Failing tests**: `teamRow(ROOT, 'Orig', 'hoth_01').light` has `faction 'Faction_Light_Orig'`, `heroes` including `'Luke'` (by the Heroes_Light fixture) and `abilities` including `'Ability_Weapon_BlasterRifle_A280C'`; `sequel heroes are refused from a team` (a Heroes fixture with `Kylo` added: `refused` includes it, `heroes` does not); `heroRow` of Vader: `health 800`, `side 'dark'`, `abilities` includes the Force Choke row with `recharge 25`; `isSequel('Gameplay/Teams/MP/NewEra/Team_Light_NewEra_JA')` true, `isSequel('Gameplay/Kits/Hero/Luke/Kit_Hero_Luke')` false.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Hero, reinforcement, vehicle and team rows, the sequel era refused`.

### Task 5: The AI rulebook

**Files:**
- Modify: `scripts/lib/bf2017-rulebook.mjs`, its test

**Interfaces:**
- Produces: `aiRulebook(root) → { templates: { [role]: { targetLostTime, alertPropagationSpeed, fireHeightOffset, weapon, melee, loco } }, tactics: { [name]: { engage: { distance, suppression }, suppression: { value, time, area }, vehicleSuppression: { distance, reevaluate }, attack, hide, flee, closeCombat (each the numbers of its referenced settings object) } }, weapons: { [name]: numbers }, patterns: [{ id, bits: boolean[], delay }], cover: { constants: numbers, zones: { [name]: numbers }, queries: { [name]: [{ term, weight, params }] } }, difficulty: { [curveName]: [[x, y]] }, instantAction: { [option]: values } }` from `AI/BattleAI/**` and `Gameplay/Settings/GameDifficultySettings`, `Gameplay/Profiles/InstantActionParams/*`. A pattern's `bits` come from the 64-bit `Pattern` integer read as a BigInt, least significant bit first, trimmed after the highest set bit.

- [ ] **Step 1: Failing tests**: `tactics['AIRebelSoldierTactics'].engage.distance 40`, `.suppression.value 0.75`, `.suppression.time 10`, `.suppression.area 5`; `templates.rifleman.targetLostTime 10`, `.alertPropagationSpeed 2`; `cover.constants.SlotSpacing 2.2`, `.CrouchHeight 0.94`, `.StandHeight 1.7`; `patterns[0].id 1`, `patterns[0].delay 24`, `patterns[0].bits[0] === true` (290482175965396993 is odd); `patterns` has 24 entries when run on the fixture (the fixture holds all 24).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The AI rulebook: templates, tactics, cover, firing patterns, difficulty`.

### Task 6: The map rulebook

**Files:**
- Modify: `scripts/lib/bf2017-rulebook.mjs`, its test

**Interfaces:**
- Produces: `mapRow(root, level, { modes = MODE_LAYERS }) → { level, modes: string[], terrain, bounds, spawns, polygons, volumes, spheres, boxes, waypoints, vehicleSpawns, oob, locators, cameras, strings: string[], _missing }` where `level` is `Levels/MP/Hoth_01/Hoth_01` and `MODE_LAYERS = { galacticAssault: 'FantasyBattle', hvv: 'HeroArena', blast: 'TeamDeathmatch', strike: 'Mode9', supremacy: 'Mode1', extraction: 'Mode6', ewokHunt: 'Mode8', arcade: 'PlanetaryMissions' }`; a mode is in `modes` when `<level dir>/<Layer>.json` exists. For each present mode: `spawns` from every `AlternateSpawnEntityData` in `<Layer>_Logic`, `<Layer>_Spawns*`, `ModeDefend_Spawns_Team*` (`{ id: '<layer>:<index>', mode, team: 1 | 2, priority, enabled, at, yaw, layer }`, duplicates by `(team, at rounded 0.01)` collapsed, the first kept); `polygons` from `SpawnLocationFinderShapeData` (`team`, `pointsOf`); `volumes` from `VolumeVectorShapeData` in `<Layer>_Shapes*` and `<Layer>_Inf_Shapes_*` (`id: '<layer>:<index>'`, `layer`, and `kind: 'capture' | 'defend' | 'oob' | 'shape'` by the layer's name); `spheres`, `boxes` likewise; `waypoints` from `VehicleWaypointData` grouped by their chain (each has a next pointer or an index: read the field found and write it in the header) as `{ id, points: [[x, y, z]] }`; `oob` from `<Layer>_OOBTeam1/2`; `locators` and `cameras` from `LocatorEntityData`, `LocalLocatorEntityData`, `CameraEntityData` (`at`, `yaw`, `name`); `vehicleSpawns` and `terrain` copied from `<root>/../web_opt/maps/<path>.json` (`vehicleSpawns[]`, `terrain[0]` with its `world` and `detail` file names); `bounds` the min and max over spawns and volumes padded 50 m; `strings` the `CheckedLocalizedStringEntityData` ids in `<Layer>_Gameplay`.

- [ ] **Step 1: Failing tests** on the fixtures: `modes` includes `'galacticAssault'`; `spawns.length 12` from the cut Logic layer, the first `{ team: 2, priority: 1, enabled: false }` with `at[1]` `313.18` to 2 places; `duplicate spawns collapse` (a fixture with one spawn copied twice: one row); `polygons.length 54`, `volumes.length 16`, `spheres.length 2`, `boxes.length 2` from the Shapes fixture, the first volume `y 817.5338`; `waypoints.length >= 1` with `points.length >= 2`; `strings` includes `'ID_FANTASYBATTLES_HOTH_FUEL_SILO'`; `terrain.world.file` ends `hoth_01_terrain_height.png` (a cut `web_opt/maps/levels/mp/hoth_01/hoth_01.json` fixture with `terrain`, `vehicleSpawns` and empty `groups`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The map rulebook row: spawns, volumes, waypoints, out of bounds, terrain`.

### Task 6b: Lighting, cameras and the GUI

**Files:**
- Modify: `scripts/lib/bf2017-rulebook.mjs`, its test
- Add fixtures: `Levels/Lighting/Hoth/Sunny_01/VE_Sky_Arctic_Sunny_01.json`, `Levels/MP/Hoth_01/Default_Lighting.json` (cut to 3 sphere lights, 2 spot lights, 2 volumetrics, 1 probe volume, 2 prefab references), `Gameplay/Vehicles/Ground/AT-AT_MP/Vehicle_Ground_AT-AT_MP_Camera.json`, `UI/InGame/Hud/Weapons/<the heat bar widget>.json`, `UI/Customize/Screens/SpawnOverlayScreen.json` (cut to the root and its first level of children), `UI/Art/HUD/_TextureMappings/GenericSoldierHUDTextures.json`, two SVGs and one font file name list (`web_opt/svg` and `web_opt/fonts` are listed, not copied, in the fixture: a `files.txt`)

**Interfaces:**
- Produces:
  - `lightingRow(root, level) → maps/<level>.lighting.json` as the spec's section 8: `weathers` from every `VE_*` the level's sub-levels reference (`VisualEnvironmentReferenceObjectData` in `Sunset`, `Cloudy`, `HighEnd`, `Default`), each component's numbers under its key (`OutdoorLightComponentData → sun`, `SkyComponentData → sky`, `FogComponentData → fog`, `TonemapComponentData → exposure, bloom`, `ColorCorrectionComponentData → grading` with the `T_CC_*` name as `lut`, `DynamicAOComponentData → ao`, `ShadowsComponentData → shadows`, `SunFlareComponentData → flare`, `MotionBlurComponentData → motionBlur`, `WindComponentData → wind`, `EnlightenComponentData → enlighten`); `lights` from every `PbrSphereLightEntityData` and `PbrSpotLightEntityData` in `*Lighting*` and `Hangar_*` layers (`at`, `yaw`, `pitch` from the transform's forward, `colour`, `intensity`, `radius: AttenuationRadius`, `inner`, `outer`, `shadow`, `cull`), `volumetrics`, `probes` (`OBBData` sibling for `half`), `prefabs` (the `pf_light*` references with transforms and the light inside the prefab asset resolved once per prefab name).
  - `camerasRow(root, { soldierBlueprint, weapons, vehicles }) → cameras.json` as section 8 (`SoldierThirdPersonCameraData`, `SoldierCameraComponentData.ThirdPersonCameraArmLength`, `WeaponZoomLevelData.RenderFov`, each vehicle's `ThirdPersonCameraTransformerEntityData` in seat order and `VelocityRedirectCameraTransformerEntityData`).
  - `uiRow(root, widgetNames, { svgRoot, fontRoot }) → ui.json` as section 8: for each named `UIWidgetBlueprint`, its tree flattened (`anchor`, `size`, `children`, text fields with `stringId`, `font`, `size`, `colour`, icon fields with the SVG name through `_TextureMappings`, colours, `UI/Animation` timings), `icons` as `name → svg path` for the OT and PT icons (sequel refused), `fonts` from `web_opt/fonts`, `colours` from `UI/Configuration/*`; `copyUiAssets(root, out)` copies the referenced SVGs and the four HUD fonts (`LinotypeUnivers-520CnMedium`, `-620CnBold`, `RaxusPrimeNumericalMonospace_Regular`, `_Bold`) under `public/battlefront/`.

- [ ] **Step 1: Failing tests**: `lightingRow` on the fixtures: `weathers.sunny.sun.colour` `[1.0, 0.9559, 0.9176]` to 4 places, `.exposure.ev 10`, `.bloom.scale 0.1`, `.bloom.gaussians.length 5`, `.ao.hbao.radius 1.5`, `.wind.strength 5`, `.fog.curve` `[2.2311, −4.5655, 2.9244, −0.0088]`; `lights.length 5` with the first `{ kind: 'sphere', intensity: 55000, radius: 30 }` and colour `[22.26, 34.9, 48.0]`; a spot with `inner 70`, `outer 90`; `volumetrics[0].exponent 2`; `probes[0].res [5, 5, 5]`; `camerasRow` gives `soldier.arm 1.2`, `soldier.maxPitch 55`, `soldier.reducedArm { length: 0.5, minPitch: 5, maxPitch: 70 }`, `aim.a280c[0].fov 55`, `vehicles['vehicle_ground_at-at_mp'].seats[0].pitch [−35, 24]`, `.inertia { input: 0.8, none: 0.5 }`; `uiRow` on the heat bar widget gives a tree with at least one text or shape child and the deploy screen's `texts` with string ids; `icons` has no name matching `isSequel`; `fonts.length 23` from the list.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Lighting, camera and HUD rows from the game's records`.

### Task 7: The CLI, the fetch's `data` command, and the rulebooks run for real

**Files:**
- Create: `scripts/bf2017-data.mjs`, `scripts/bf2017-data.test.mjs` (the CLI's pure bits: `plan(args)`, the `_from` header, the writer)
- Modify: `scripts/bf2017-fetch.mjs` (`data '<glob>'`: lists `data/` by prefix, downloads matching `.json.gz` into `lab/assets/bf2017/data/`, and `data.tsv`; when #810's lane L has landed its `--all '<glob>'` on `main`, `data` is a thin alias over it, not a second downloader), its test if it has one
- Create by running: `src/data/bf2017/{weapons,classes,cards,heroes,reinforcements,vehicles,teams,ai,strings,cameras,ui}.json`, `src/data/bf2017/maps/hoth.json`, `maps/hoth.lighting.json`, `public/battlefront/{icons,fonts}/`

**Interfaces:**
- Produces: `node scripts/bf2017-data.mjs <all | weapons | classes | cards | heroes | reinforcements | vehicles | teams | ai | strings | map | lighting | cameras | ui> --root <dir> [--level hoth_01] [--era Orig] [--out src/data/bf2017] [--only <id,…>] [--dry]` and `node scripts/bf2017-data.mjs fixture <asset name> [--cut root]` (copies an asset into `scripts/fixtures/bf2017/data/`, cut to the root's reachable objects with `--cut root`, and appends its `data.tsv` row). Each rulebook file is `{ _from: { export: 'build 489592', date, root: sha1 of data.tsv's first 64 KB }, rows }`. `weapons` writes every weapon any Hoth team lists (`teams.json` first, then the weapons it names); `heroes` the OT and PT heroes the Hoth teams list; `vehicles` the Hoth teams' vehicles plus the map's `vehicleSpawns` blueprints; `strings` the ids every other file references, resolved from `web_opt/strings/English.json`.

- [ ] **Step 1: Failing tests** for `plan`: `plan(['all', '--root', 'x', '--level', 'hoth_01'])` lists the ten rulebooks in dependency order (`teams` before `weapons`, `map` before `strings`); `--dry` writes nothing (the writer is passed a fake).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the CLI over Tasks 1 to 6; the fetch's `data` command on the pattern of its `--list`. **Step 4: Run** → PASS.
- [ ] **Step 5: Run for real** on the owner's machine: `BF2_ROOT='C:/Users/tilak/Downloads/BF2_Extract/web' node scripts/bf2017-data.mjs all --root "$BF2_ROOT" --level hoth_01 --era Orig`. Record the counts it prints (rows per file, refused, missing) in the PR body. Check sizes (`maps/hoth.json` under 600 KB; the ten together under 2 MB). Open `weapons.json` and confirm the A280C row matches Task 2's numbers from the real file.
- [ ] **Step 6: Commit** in two: `The data CLI and the bucket fetch for the dump` and `The rulebooks for Hoth's Galactic Assault, from the game's data`.

### Task 8: The hand files and the rulebook test

**Files:**
- Create: `src/data/bf2017/maps/hoth.stages.json`, `src/data/bf2017/points.json`, `src/data/bf2017/NOTES.md`, `src/data/bf2017/rulebook.test.js`

**Interfaces:**
- Produces:
  - `hoth.stages.json`: `{ "source": "hand", "mode": "galacticAssault", "level": "Levels/MP/Hoth_01/Hoth_01", "attackers": "dark", "stages": [ { "id": "walkers", "name": "ID_FANTASYBATTLES_HOTH_STAGE1_TEAM2", "nameDefend": "ID_FANTASYBATTLES_HOTH_STAGE1_TEAM1", "objectives": [{ "type": "escort", "waypoints": "<waypoint id>", "health": 2, "disabledBy": "ioncannon" }], "spawns": { "attack": ["<polygon or spawn ids>"], "defend": [...] }, "tickets": 0, "timer": 0, "vehicles": ["Vehicle_Ground_AT-AT_MP"] }, { "id": "shield", "objectives": [{ "type": "arm", "volume": "<id>", "name": "ID_FANTASYBATTLES_HOTH_FUEL_SILO" }, …] }, { "id": "hangars", "objectives": [{ "type": "capture", "volume": "<id>", "name": "ID_FANTASYBATTLES_HOTH_EAST_HANGAR" }, { "type": "capture", "volume": "<id>", "name": "ID_FANTASYBATTLES_HOTH_WEST_HANGAR" }] }, { "id": "transports", "objectives": [{ "type": "arm", "volume": "<id>", "name": "ID_FANTASYBATTLES_HOTH_FUEL_DEPOT" }, { "type": "arm", "volume": "<id>", "name": "ID_FANTASYBATTLES_HOTH_FUEL_STATION" }] } ], "ticketsStart": 300, "ticketsTopUp": [0, 60, 60, 60], "stageTimer": 0 }`. The volume ids are chosen by hand from `hoth.json`: open the volumes, plot their centres against the spawn clusters (a twenty-line Node script writing an SVG under `docs/superpowers/evidence/battlefront-lane0/hoth-layout.svg`: volumes as polygons, spawns as dots by team, waypoints as lines), and name each by where it sits (the hangars are two volumes near the base's east and west doors; the fuel depot and station are inside; the shield generator's silo is between the walkers' start and the base). Write the reasoning in `NOTES.md`.
  - `points.json`: `{ "source": "hand", "earn": { "kill": 100, "assist": 50, "objectiveTick": 10, "objectiveDamage": 1, "vehicleKill": 150, "heroKill": 250, "squadSpawn": 25 }, "cost": { "aerial": 1000, "enforcer": 2000, "infiltrator": 2000, "vehicles": { "default": 500, "Vehicle_Ground_AT-ST_MP": 1500, "Vehicle_Ground_AT-AT_MP": 0 }, "heroes": { "default": 4000 } }, "limits": { "heroesPerTeam": 1, "reinforcementsPerTeam": 4 }, "bpRate": 1, "notes": "PF_Gameplay_BattlePoints_Local holds IntEntityData 1000 and an EventToInt 1..4; reconcile when read" }`.
  - `NOTES.md`: one line per hand value, why, and where to look to replace it.
  - `rulebook.test.js`: every rulebook this lane writes (the ten files and `maps/*.json`, listed by name in the test; not `strokes/`, which is #810's lane X and has its own test) parses; `checkSources` (copied) is `[]` for every file (hand files pass by their top-level `source`); every stage objective's `volume` or `waypoints` id exists in `maps/hoth.json`, every `spawns` id exists as a spawn or polygon id; every team's `classes`, `heroes`, `reinforcements`, `vehicles` id exists in its rulebook; every `name` string id exists in `strings.json`; no name anywhere matches `isSequel` (copy the list).

- [ ] **Step 1: Failing test** (the hand files absent). **Step 2: Run** `npx vitest run src/data/bf2017` → FAIL. **Step 3: Write** the hand files and the SVG. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Hoth's stages and the Battle Points table, by hand, and the rulebook test`.

### Task 9: Typed access for the rules

**Files:**
- Create: `src/lib/battlefront/rulebook.js`, `src/lib/battlefront/rulebook.test.js`

**Interfaces:**
- Produces: `loadRulebook() → rulebook` (static imports of every JSON; one object, frozen); `teamsFor(rb, level, era = 'Orig') → { light, dark }`; `weaponOf(rb, id)`, `classOf(rb, id)`, `heroOf(rb, id)`, `reinforcementOf(rb, id)`, `vehicleOf(rb, id)`, `abilityOf(rb, id)`, `cardOf(rb, id)`; `mapOf(rb, level) → maps/<level>.json`; `stagesOf(rb, level, mode) → maps/<level>.stages.json | null`; `lightingOf(rb, level) → maps/<level>.lighting.json`; `camerasOf(rb)`; `uiOf(rb)`; `stringOf(rb, id) → text | id`; `spawnsFor(map, { mode, team, ids })`; `volumeOf(map, id)`; `aiOf(rb) → ai.json rows`; `pointsOf(rb)`. Each throws an `Error` naming the id when it is not there (a rulebook typo is a bug, not a runtime case).

- [ ] **Step 1: Failing tests**: `weaponOf(rb, 'a280c').firing.rof === 600`; `classOf(rb, 'l-orig-assault').health === 150`; `heroOf(rb, 'darthvader').health === 800`; `stagesOf(rb, 'hoth', 'galacticAssault').stages.length === 4`; `stringOf(rb, 'ID_FANTASYBATTLES_HOTH_FUEL_SILO')` is a non-empty string not equal to the id; `weaponOf(rb, 'nope')` throws with `nope` in the message; `spawnsFor(mapOf(rb, 'hoth'), { mode: 'galacticAssault', team: 2 }).length > 50`; `lightingOf(rb, 'hoth').lights.length > 100`; `camerasOf(rb).soldier.arm === 1.2`; `uiOf(rb).widgets` has a deploy screen entry.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Docs**: `docs/assets/battlefront-2017.md` gains "## Data" (the CLI, the root, the rulebooks, the hand files, the fixture command); `docs/superpowers/HANDOFF-battlefront.md` lane 0 marked done with the counts.
- [ ] **Step 6: Commit** `Typed access to the rulebooks, and the data section of the assets page`. Then lint, test, build, health; PR titled `Battlefront lane 0: the extractor and the rulebooks for Hoth`.
