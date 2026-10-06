# Minas Tirith (design)

## Intent

A second hidden chapter, off the films' road: Pippin in Minas Tirith, at `#/middle-earth/minas-tirith`. The Return of the King, from Pippin's side of it:
- the ride up through the seven gates on Shadowfax;
- the Court of the Fountain and the dead White Tree;
- the Steward in the hall of the kings;
- lighting the beacon;
- the siege, from the first wall;
- the morning the White Tree flowered.

## Finding it

- No pin, no "on to", no seal on the map; the road from the Shire to Mordor is as it was.
- Click (or tap) the white city itself on the map's 3D diorama. On the flat map, a click on its name.
- It's in the ⌘K palette, beside Orthanc.
- Finding it wins `minastirith`; the end wins `kingreturns`.
- The map's "road so far" counts the places off the road, and names one only once it's found.

## What you do

1. **The seven gates** (`ride`). On rails up the road through the city on Shadowfax, Gandalf behind Pippin:
   - steer across the street (A/D) round carts, barrels, crates, townsfolk and hens;
   - hold W to gallop; a knock slows him for a moment;
   - each gate is called as it's passed. No fail: knocks are only counted.
2. **The Court of the Fountain** (`court`). Off the horse under the seventh gate, then find Beregond of the Guard by the White Tree.
3. **Denethor, Steward of Gondor** (`steward`). Into the hall of the kings; offer your service. Pippin wears the black and silver of the Guard of the Tower from then on.
4. **The beacon** (`beacon`). Dusk, with Gandalf on the point of the prow. Then along the ledge up the mountain:
   - creep while the guard at the end eats his supper;
   - he stirs (the warning), then looks up the ledge: anyone moving is seen, and so is anyone in the open close to him;
   - hide behind the rocks; caught, and you're back at the last rock;
   - climb the pile (only moving is seen up there), and light it (E);
   - the camera flies the chain of beacons away north-west to Rohan.
5. **The siege of Gondor** (`walls`). Night, on the first wall by the trebuchets:
   - the range swings out and back across the field; loose (Space) when it's on a siege-tower, and lead it;
   - the engine takes two seconds to wind again;
   - a fell beast's scream now and then sends the range swinging wild;
   - bring down four towers before one reaches the wall (or start the siege again). Then the horns of Rohan.
6. **The White Tree in flower** (`crown`). Morning, the court full of flowers; the King under the blossoming tree. Seal `kingreturns`.

And on a little table by the Steward's chair, a dish of small red tomatoes. From the point of the prow, a look out over the Pelennor to Mordor.

## The place

- **The city** (`ride`, `court`, `beacon`, `walls`): seven walled levels (`WALL_R`, `LEVEL_Y`) round the knee of Mindolluin from `SPAN` north of east to `SPAN` south; the prow of rock through all of them, with the road's tunnels; the road and its gates (`ROAD`, `GATES`); the houses (`HOUSES`, seeded); the Citadel with the hall of the kings, the Tower of Ecthelion, the tree and the fountain; the beacon's ledge (`LEDGE`, `COVERS`, `PILE`); the Pelennor, the Anduin, the Mountains of Shadow; the seven beacon peaks (`BEACONS`); the host and the siege-towers.
- **The hall of the kings** (`hall`), drawn apart: black pillars, the kings in stone, the empty throne, the Steward's chair.

## The games, as rules (`rules.js`, tested)

- `newRide` and `stepRide`: the seven gates.
- `newSneak`, `stepSneak`, `exposed` and `lightBeacon`: the beacon.
- `newSiege`, `stepSiege`, `loose`, `rangeOf` and `flightOf`: the siege.

## How it fits

- **`towns/minastirith/`:**
  - `layout.js`, `story.js`, `rules.js` and their tests;
  - `props.js` (the city, the hall, the ledge, the peaks, the tree) and `folk.js` (Shadowfax from Weathertop's Asfaloth, the people, the Guards, the trebuchets, the siege-towers, the fell beasts from the Dead Marshes' kit);
  - `scene.js`, `MinasTirithWorld.jsx`, `sounds.js`, `minastirith.css`.
- **`middleearth/hidden.js`:** a second entry; `mapDiorama.js` tags the city's group so a tap finds it.
- **`middleearth/record.js`:** `HIDDEN_SEALS` and `offRoad()`, for the road so far.
- **Storage:** `tp-minastirith-done`, `tp-minastirith-at`, `tp-minastirith-tomato`; dev hook `window.__MINAS__`.
- **Online:** other travellers show in the court as pale Pippins (`useTravellers('minastirith')`).
