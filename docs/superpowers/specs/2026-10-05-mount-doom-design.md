# Mount Doom (design)

## Intent

The last town on the films' road, at the top of the Mordor chapter (`#/middle-earth/mordor`). Frodo and Sam cross the plain of Gorgoroth to the mountain, and the Ring goes into the fire. The 2D Gorgoroth crossing and the Ring below it on the page stay as they are.

## What you do

1. **Get in line** (`column`). Down into Gorgoroth in orc-gear, swept up in a marching column.
   - Keep your place in the line as the drums quicken and slow (hurry, hang back).
   - Out of place too long and the slaver's whip finds you; three lashes and they look at you properly.
   - At the camp the column halts, a brawl breaks out, and you slip away.
   Seal `maggots`.
2. **Under the Eye** (`gorgoroth`). East across the open plain to the mountain's foot.
   - The Eye's searchlight sweeps to and fro across the plain, along a line that creeps towards you.
   - Keep in a rock's shadow, on the side away from the Tower, when it passes.
   - In the light too long and it finds you.
   Seal `gorgoroth` (shared with the old crossing).
3. **I can carry you** (`carry`). At the foot, Frodo can't go on.
   - "I can't carry it for you, but I can carry you!" As Sam, carry him up the last of the road: left, right, left; the same foot twice and you stumble.
   - When the mountain shakes, stand still till it stops, or slide back.
   - At the door, Gollum attacks.
   Seal `carryyou`.
4. **The Crack of Doom** (`crack`). At the edge of the fire.
   - Frodo can't throw it in. "The Ring is mine."
   - Gollum takes it, finger and all, and falls into the fire.
   - Frodo hangs from the edge: reach for his hand while he reaches for yours, before his grip goes.
   Seal `ringbearer` (shared with the old Ring section).
5. **The eagles are coming** (`eagles`). The mountain erupts and the Tower falls.
   - On a rock in a river of lava: "I'm glad to be with you, Samwise Gamgee. Here at the end of all things."
   - Then the eagles. Steer Gwaihir out through the fountains of fire.
   Seal `eagles`.

## The place

- **One world, plain and mountain together:**
  - the plain to the west (`plain`), with its road, the camps and the rocks;
  - the kit's mountain at the middle, turned so its road starts due west at the crossing's end (`slope`);
  - Barad-dûr far to the north-east, its Eye's beam aimed at the searching light, and at the end at the mountain.
- **The Sammath Naur** (`crack`), drawn apart: the spur over the chasm.

## How it fits

- **`towns/doom/`:**
  - `layout.js`, `story.js`, `rules.js` and their tests;
  - `props.js` (by a worker);
  - `scene.js`, `DoomWorld.jsx`, `sounds.js`, `doom.css`.
- **Storage:** `tp-doom-done` and `tp-doom-at`; dev hook `window.__DOOM__`.
- **The chapter:** the existing `mordor` chapter gains `maggots`, `carryyou` and `eagles`.
