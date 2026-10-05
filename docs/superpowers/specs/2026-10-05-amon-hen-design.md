# Amon Hen, the seventh walkable town (design)

## Intent

The towns follow the films' road. After the Argonath, the boats come to Parth Galen, the lawn on the western shore of Nen Hithoel, under the hill of Amon Hen, with the falls of Rauros roaring at the lake's foot. This is where the Fellowship breaks, at `#/middle-earth/amon-hen`. In the films:
- the camp, and Aragorn's plan ("We cross the lake at nightfall");
- Boromir finds Frodo alone in the woods and tries to take the Ring, and Frodo puts it on to get away;
- the Seat of Seeing on the summit, and the Eye;
- Aragorn: "I would have gone with you to the end";
- the Uruk-hai; Merry and Pippin draw them off ("Hey! Over here!");
- Boromir's last stand and the horn of Gondor;
- Frodo alone at the boats, and Sam wading in after him: "I made a promise, Mr. Frodo."

## What you do

1. **Parth Galen** (`camp`). Land at the lawn by the lake. Aragorn's plan: cross at nightfall, then on foot. Gather wood for the fire from the edge of the trees (five sticks), while the others talk. Then Sam looks round: "Where's Frodo?" You've gone up into the woods to think. Seal `parthgalen`.
2. **None of us should wander alone** (`boromir`). Among the old statues in the woods, Boromir finds you. He talks; you refuse him the Ring, and he lunges. Put the Ring on and get away:
   - in the Unseen world, Boromir can't see you, but he hears you if you run near him;
   - the Ring's pull rises while it's on;
   - get to the stair up the hill before it's too much.
   Seal `wanderalone`.
3. **The Seat of Seeing** (`seat`). Climb to the ruined seat on the summit. With the Ring on you see far, all the way to Barad-dûr, and the Eye sees you:
   - take the Ring off before its gaze closes on you;
   - its sweep comes round, and the Ring must come off between sweeps.
   Then Aragorn comes up the stair: you hold the Ring out to him, and he closes your hand on it. "I would have gone with you to the end." "Go, Frodo. Run!" Seal `seatofseeing`.
4. **Run, Frodo** (`run`). The Uruk-hai are in the woods. Get down through the trees to the shore unseen. Merry and Pippin draw some off ("Hey! Over here!"), and Boromir's horn sounds. Seal `runfrodo`.
5. **I made a promise** (`promise`). Push the boat out alone. Sam comes crashing down to the water and wades in after you, and he can't swim:
   - paddle back, and reach down for his hand as he comes up;
   - too early or too late and he goes under again.
   Then the two of you across the lake, towards the Emyn Muil and Mordor. Seal `promise`.

## The place

Metres, the towns' conventions. There is one walkable area, about 160 × 120 m:
- the lake (Nen Hithoel) to the east, with the lawn of Parth Galen on its shore, the camp, and the boats drawn up;
- woods rising west up the hill, with pines, beeches, ferns, mossy rocks, and the great broken statues of the kings of old;
- a ruined stair up to the summit, and the Seat of Seeing on its paved platform;
- across the water, the eastern shore and the hills of the Emyn Muil; to the south, the falls of Rauros in their spray.

The boat and Sam's rescue happen on the water near the shore, on rails.

## The games, as rules (`rules.js`, tested)

- `newWood`, `pickStick`: five sticks at the wood's edge.
- `newUnseen` and `stepUnseen`:
  - the Ring's pull while it's worn;
  - Boromir blundering after sounds (`../watchers.js` with a short sight);
  - you get away when you reach the stair.
- `newSeat` and `stepSeat`: the Eye's sweep, and taking the Ring off in a gap.
- `stepWatchers` (shared): the Uruk-hai hunting through the trees, and Merry and Pippin drawing some off.
- `newRescue` and `stepRescue`: Sam going under and coming up, and the moment to grab.

## How it fits

- **Shared code:** `towns/` (walker, watchers, talk, story, TownHud, keys, ghosts, wraiths' ring view).
- **`towns/amonhen/`:** `layout.js`, `story.js`, `rules.js`, `props.js` (by a worker), `scene.js`, `AmonHenWorld.jsx`, `sounds.js`, `amonhen.css`.
- **Storage:** `tp-amonhen-done` and `tp-amonhen-at`; dev hook `window.__AMONHEN__`.
- **Seals:** `parthgalen`, `wanderalone`, `seatofseeing`, `runfrodo` and `promise`. Lothlórien's road leads here; Amon Hen's goes on to the Dead Marshes.
- **Map:** new chapters go between Lothlórien and Mordor: `amon-hen`, `dead-marshes` (the Emyn Muil, the Marshes and the Black Gate), and `cirith-ungol`.
