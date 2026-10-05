# Cirith Ungol (design)

## Intent

The towns follow the films' road. Gollum's "other way" into Mordor, at `#/middle-earth/cirith-ungol`:
- Minas Morgul glowing green in its valley, and the Witch-king's army marching out over the bridge;
- the endless stairs up the cliff;
- Gollum's lie about the lembas, and Frodo sending Sam home;
- Shelob's lair, the webs, and the phial of Galadriel;
- Sam coming back: "Let him go, you filth!";
- the Tower of Cirith Ungol, and Sam climbing it for Frodo.

## What you do

1. **Minas Morgul** (`morgul`). Crouch among the rocks by the road while the green light goes up from the city and the Witch-king's host crosses the bridge:
   - the Ring pulls you towards the city;
   - hold back from it, and from the Witch-king when he stops on his steed and turns his head, feeling for you;
   - let the pull reach you and you stand up and walk into the open.
   Seal `minasmorgul`.
2. **The stairs** (`stairs`). Up the endless stair cut in the cliff, behind Gollum:
   - you tire as you climb, and rest on the ledges;
   - don't stop where the stair is crumbling.
   At the top, the lembas thrown away, and Gollum's lie. You send Sam home. Seal `stairs`.
3. **Shelob's lair** (`shelob`). Alone in the tunnels, through the webs and the bones, to the far side:
   - Shelob hunts you in the dark;
   - raise the phial ("Aiya Eärendil Elenion Ancalima!") when she comes close, and she shrinks from it;
   - the phial's light fades with use.
   Seal `aiyaearendil`.
4. **Samwise the Brave** (`samwise`). Now as Sam: Shelob has Frodo bound in silk. Fight her with Sting and the phial:
   - dodge her strikes;
   - stab when she rears;
   - when she's hurt enough, she crawls away.
   Then the orcs come, and take Frodo away. Seal `samwisethebrave`.
5. **The Tower** (`tower`). Still as Sam, into the Tower of Cirith Ungol. The orcs have fallen out over Frodo's mithril and are fighting each other. Get past them up the stairs to the top. "I'm not going to leave you." Seal `tower`.

## The place

Three small areas, drawn apart in one scene:
- **The Morgul vale** (`vale`): a rocky shelf above the road, with the city across the valley, its bridge and its green light.
- **The stairs** (`stairs`): on rails up the cliff face.
- **The lair and the pass** (`lair`):
  - tunnels of black rock thick with web;
  - the pass out to the open;
  - the Tower beyond, with a stairwell inside it, walked on its floor.

## The games, as rules (`rules.js`, tested)

- `newMorgul` and `stepMorgul`: the pull, the Witch-king's pauses, and holding back.
- `newClimb` and `stepClimb`: stamina, ledges and crumbling steps.
- `newLair` and `stepLair`: Shelob's hunt (`../watchers.js`) and the phial's light and fading.
- `newDuel`, `stepDuel` and `strike`: her strikes and rears, your dodges and stabs.
- The Tower uses `../watchers.js` for the orcs.

## How it fits

- **`towns/cirithungol/`:** `layout.js`, `story.js`, `rules.js`, `props.js` (by a worker), `scene.js`, `CirithUngolWorld.jsx`, `sounds.js`, `cirithungol.css`.
- **Storage:** `tp-cirithungol-done` and `tp-cirithungol-at`; dev hook `window.__CIRITHUNGOL__`.
- **Seals:** `minasmorgul`, `stairs`, `aiyaearendil`, `samwisethebrave` and `tower`. The Marshes' road leads here; this one goes on to Mordor.
