# Lane V's cast: the vehicles the game replaces, kind by kind

Every vehicle kind the galaxy shows, with the Battlefront II (2017) model that replaces it, read from the drop's manifest (`web/models.jsonl`, fetched 2026-10-10) and checked with `node scripts/bf2017-fetch.mjs --list`. The import commands are `scripts/bf2017-vehicles.mjs`'s `CAST` (run it with a kind, a `--group`, or nothing for all); the catalogue rows land in `src/components/galaxy/surface/catalog/bf2017-vehicles.js`.

Tiers: **walker** (on the game's own rig, with its clip pack: `src/lib/three/rigSets.js`), **ride** (the visitor boards it: `rides.js`), **prop** (stands in a world's `things`), **fleet** (the space layer and the horizon, through the `.far` cut). Worlds are where a `sites/*.js` entry names the kind today.

## Walkers

| kind | the game's model | rig (clips) | tier | worlds |
| --- | --- | --- | --- | --- |
| atat | `gameplay/vehicles/ground/at-at/old/atat_mesh` (skinned; the gameplay composite `…/at-at/vehicle_ground_at-at_sp_mesh` has no skin) | `Gameplay/Vehicles/Ground/AT-AT/ATAT_Ske` (39) | walker, prop | hoth, scarif |
| atst | `gameplay/vehicles/ground/atst/atst_static_donotuse_mesh` (rigid; bound at import) | `Cinematics/Objects/ATST/ATST_Ske01` (69; no skinned AT-ST is in the drop) | walker, prop | endor, sorgan |
| atte | `gameplay/vehicles/ground/at_te/at_te_mesh` | `Gameplay/Vehicles/Ground/AT_TE/AT_TE_Ske` (41) | walker | geonosis |
| atrt | `gameplay/vehicles/ground/atrt/atrt_mesh` | `Gameplay/Vehicles/Ground/ATRT/ATRT_Ske` (31) | walker (its clone rider the site's) | kashyyyk |
| droideka | `gameplay/vehicles/ground/droideka_01/droideka_01_mesh` | `Gameplay/Vehicles/Ground/Droideka_01/Droideka_01_Ske` (52) | walker, prop | geonosis, naboo |
| (atm6) | `s1/gameplay/vehicles/ground/atm6/atm6_mesh` | `S1/…/ATM6_Ske` (22) | **left out**: The Last Jedi's, the sequel era | — |

## Ground vehicles and droids

| kind | the game's model | tier | worlds |
| --- | --- | --- | --- |
| aat | `gameplay/vehicles/ground/aat/vehicle_ground_aat_static_donotuse_mesh` | prop | naboo |
| mtt | `gameplay/vehicles/ground/mtt/vehicle_ground_mtt_static_donotuse_mesh` | prop | naboo |
| stap | `gameplay/vehicles/ground/stap/stap_static_mesh` | prop | (in the catalogue, no world places it yet) |
| barc | `gameplay/vehicles/ground/barc/barc_speeder_static_donotuse_mesh` | prop | geonosis, kashyyyk |
| speederbike | `gameplay/vehicles/ground/74z/speederbike_static_donotuse_mesh` (the 74-Z) | ride, chase | endor, geonosis, kashyyyk, lothal, mustafar, scarif |
| landspeeder | `gameplay/vehicles/ground/x34/vehicle_ground_x34_static_donotuse_mesh` (the X-34) | ride | tatooine |
| homingspider | `gameplay/vehicles/ground/homingspiderdroid/vehicle_ground_homingspiderdroid_static_donotuse_mesh` | prop | (none yet) |
| dwarfspider | `gameplay/vehicles/ground/dwarfspiderdroid/dwarfspiderdroid_skinned_mesh` (a statue: its skeleton has no clips in the drop) | prop | (none yet) |
| (hailfire) | `gameplay/vehicles/ground/hailfiredroid/meshp_hailfiredroid_bb_smooth_mesh`: one LOD, a smoothing shell, not the droid | **not taken** | — |
| (turbotank) | `gameplay/vehicles/stationary/hcvwa9_turbotank/*`: only its turrets and missile, no hull | **not taken** | — |

## Turrets

| kind | the game's model | tier | worlds |
| --- | --- | --- | --- |
| eweb | `gameplay/vehicles/stationary/e-web/e-web_mesh` | prop | hoth, nevarro |
| turret (the DF.9) | `gameplay/vehicles/stationary/df9/old/df9_01_static_mesh` (with its barrel; `df9/df9_mesh` is the tower alone) | prop | hoth |
| atgar | `gameplay/vehicles/stationary/atgar14fdptower/atgar14fdptower_mesh` | prop | (none yet) |
| markii | `gameplay/vehicles/stationary/markii/vehicle_markii_deployed_mesh` | prop | (none yet) |
| turbolaser | `gameplay/vehicles/stationary/turbolaser/turretturbolaser_01_mesh` | prop | (none yet) |
| aaturret | `gameplay/vehicles/stationary/turretantiair_yavin/turretantiair_yavin_livingworld_mesh` | prop | (none yet) |

## Fighters and their cockpits

Each with a cockpit is imported in the frame its manifest bounds give (`--hull-frame`), and its cockpit (`<kind>cockpit`, `…_cockpit_mesh`) in the same frame, so the seat is where the hull's cockpit is; the import says whether the cockpit lies inside the hull.

| kind | the game's model | cockpit | tier | worlds |
| --- | --- | --- | --- | --- |
| snowspeeder | `gameplay/vehicles/air/airspeeder/airspeeder_static_donotuse_mesh` | `airspeeder_cockpit_mesh` | prop | hoth |
| xwing | `gameplay/vehicles/air/xwing_t65/vehicle_air_xwing_t65_static_donotuse_mesh` | `vehicle_air_xwing_t65_cockpit_mesh` | fleet | (space) |
| parkedxwing | `gameplay/vehicles/air/xwing_red5/xwing_red5_landing_mesh` (gear down) | — | prop | hoth |
| ywing | `gameplay/vehicles/air/ywing/vehicle_air_ywing_static_donotuse_mesh` | `vehicle_air_ywing_cockpit_mesh` | prop, fleet | scarif, yavin |
| awing | `…/air/awing/vehicle_air_awing_01_static_donotuse_mesh` | `vehicle_air_awing_cockpit_mesh` | fleet | (space) |
| uwing | `…/air/uwing/vehicle_air_uwing_static_donotuse_mesh` | — (none in the drop) | fleet | (space) |
| tiefighter | `…/air/tiefighter/vehicle_air_tiefighter_static_donotuse_mesh` | `vehicle_air_tiefighter_cockpit_mesh` | fleet | (space) |
| tiebomber | `…/air/tiebomber/vehicle_air_tiebomber_static_donotuse_mesh` | `vehicle_air_tiebomber_cockpit_mesh` | fleet | (space) |
| tieinterceptor | `…/air/tieinterceptor/vehicle_air_tieinterceptor_static_donotuse_mesh` | — (none in the drop) | fleet | (space) |
| tieadvanced | `…/air/tieadvancedx1/vehicle_air_tieadvancedx1_static_donotuse_mesh` | `vehicle_air_tieadvanced_cockpit_mesh` | fleet | (space) |
| falcon | `…/air/millenniumfalcon/vehicle_air_millenniumfalcon_static_donotuse_mesh` | `vehicle_air_millenniumfalcon_ot_cockpit_mesh` | fleet | (space) |
| slave1 | `…/air/slave1/vehicle_air_slave1_static_donotuse_mesh` | `vehicle_air_slave1_cockpit_mesh` | fleet | (space) |
| laat | `…/air/laat/vehicle_air_laat_gunship_mesh` | `vehicle_air_laat_cockpit_mesh` | prop | geonosis |
| arc170 | `…/air/arc170/vehicle_air_arc170_static_donotuse_mesh` | `vehicle_air_arc170_cockpit_mesh` | fleet | (space) |
| n1fighter | `…/air/n1starfighter/vehicle_air_n1starfighter_static_donotuse_mesh` | `vehicle_air_n1starfighter_cockpit_mesh` | prop, fleet | naboo |
| vwing | `…/air/vwing/vehicle_air_vwing_static_donotuse_mesh` | `vehicle_air_vwing_cockpit_mesh` | fleet | (space) |
| vulture | `…/air/vulturedroid/vehicle_air_vulturedroid_static_donotuse_mesh` | — (a droid) | fleet | (space) |
| trifighter | `…/air/droidtrifighter/vehicle_air_droidtrifighter_static_donotuse_mesh` | — (a droid) | fleet | (space) |
| hyena | `…/air/hyenabomber/vehicle_air_hyenabomber_static_donotuse_mesh` | — (a droid) | fleet | (space) |
| cloudcar | `…/air/cloudcar/vehicle_air_cloudcar_static_donotuse_mesh` | `vehicle_air_cloudcar_cockpit_mesh` | prop | (bespin, when lane W places it) |
| (towcable) | `gameplay/vehicles/air/airspeeder/old/towcablerope_skinned_mesh` (`TowCableRope_skeleton`, no clips) | — | **left**: no tow-cable rule on the site yet | — |

## Capital ships (the fleets)

The drop's gameplay capital ships (`gameplay/vehicles/capital/*`) are kits placed by each level's data: the hull and the details sit in one frame, but the engines, turrets and clusters are pieces at the origin with no placement in the manifest. The space layer's backdrops (`objects/props/_battlebeyond/*`, `objects/props/landmarks/_rebelalliance/bd_*`) are whole ships, and those are what the fleets take:

| ship | the game's model | length | LODs (triangles) |
| --- | --- | --- | --- |
| Imperial Star Destroyer | `objects/props/_battlebeyond/stardestroyer_01/stardestroyer_01_mesh` | 1,576 m | 15,882 · 7,937 · 3,970 · 1,822 · 991 |
| Nebulon-B frigate | `objects/props/landmarks/_rebelalliance/bd_frigatenebulonb_01/frigatenebulonb_01_mesh` | 299 m | 16,029 · 7,987 · 3,942 · 1,845 · 866 |
| MC80 star cruiser | `objects/props/_battlebeyond/starcruisermc80_01/starcruisermc80_01_mesh` | 1,172 m | 20,189 · 10,939 · 5,391 · 2,660 · 1,294 |
| CR90 corvette | `gameplay/vehicles/corvette/corvettecr90/corvettecr90_01_mesh` (whole, the gameplay one) | 134 m | 84,625 · 45,473 · 24,020 · 11,937 · 6,838 · 3,200 |
| (Venator, Lucrehulk, Arquitens) | `gameplay/vehicles/capital/{venatorclass_stardestroyer,lucrehulkclass_droidbattleship,imperialcruiser}/*` (the "imperial cruiser" is the Arquitens light cruiser, not a Star Destroyer) | — | kits only: **left** |
