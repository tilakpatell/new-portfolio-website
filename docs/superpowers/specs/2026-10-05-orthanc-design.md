# Orthanc (design)

## Intent

A hidden chapter, off the films' road: the inside of the tower of Orthanc, at `#/middle-earth/orthanc`. Gandalf's visit to Isengard, as he told it at the Council of Elrond (and as the films showed it):
- Saruman the White in his great hall;
- the library of lore;
- the palantír on its pillar;
- the duel of the wizards;
- the long stair up inside the tower;
- the pinnacle, the moth, and Gwaihir the Windlord.

## Finding it

- No pin on the map, no "on to" from any chapter, no seal on the map. The road from the Shire to Mordor is as it was.
- Click (or tap) the tower itself, standing black in its ring at Isengard, on the map's 3D diorama. The only hint is the pointer, which turns to a hand over it.
- On the flat map (no graphics chip), a click on Isengard's name does the same.
- It's in the ⌘K palette, beside the Citadel of Ricks (the other hidden place there).
- Finding it wins `orthanc`; the end wins `windlord`.

## What you do

1. **Saruman the White** (`hall`). Through the great doors into the hall, to Saruman by his throne. Ask him about the Ring, or call him Saruman of Many Colours (and his robe shows it).
2. **The library of lore** (`library`). Through the arch to the lectern: the making of the Rings, and Saruman's notes on the palantíri in the margin.
3. **The palantír** (`palantir`). Hold to look into the stone:
   - the vision comes (the Eye on its tower, then the armies being made under Isengard);
   - the Eye stirs, then turns to search the stone: look away till it turns back;
   - stare too long and its notice grows faster; let it fill and it finds you.
4. **The duel of the wizards** (`duel`). Saruman raises his staff and brings it down:
   - block late in the raise, or as it falls;
   - then push him back while he's off balance;
   - a block or a push at nothing fumbles.

   Three pushes, and he takes your staff anyway.
5. **The long stair** (`stair`). Up, on rails, Saruman behind you. At each window, a sight of Isengard and the Voice of Saruman: the trees felled, the pits, the Uruk-hai mustered.
6. **The pinnacle** (`pinnacle`). A prisoner in the storm:
   - a moth flutters at the north edge;
   - keep your hand under it, through the gusts, till it settles, and whisper to it;
   - Gwaihir comes, and passes under the edge: jump while he's beneath you, and fly away north.

   Seal `windlord`.

And, behind the northern case in the library, low down, a jar of Longbottom Leaf. Saruman laughed at Gandalf's love of the halflings' leaf.

## The place

- **The hall** (`hall`):
  - eight-sided, its faces cut in facets of polished black stone, with eight pillars and a vault;
  - the throne on its dais, and the palantír on its pillar under a black cloth;
  - braziers, and shafts of grey light from the high windows;
  - the library through the arch to the east.
- **The tower** (`stair`, `top`), in the middle of Isengard:
  - the ring wall, the pits glowing, the felled trees and the host of the White Hand;
  - the stair shaft inside its top;
  - the pinnacle between the four horns.
- **The vision**, drawn apart: Barad-dûr and the Eye (from Mordor's kit).

## The games, as rules (`rules.js`, tested)

- `newGaze` and `stepGaze`: the palantír.
- `newDuel`, `stepDuel`, `block` and `push`: the duel.
- `newStair` and `stepStair`: the stair.
- `newMoth` and `stepMoth`: the moth.
- `newLeap`, `stepLeap`, `leap` and `lapOf`: Gwaihir.

## How it fits

- **`towns/orthanc/`:**
  - `layout.js`, `story.js`, `rules.js` and their tests;
  - `props.js`, built on Mordor's kit for Gwaihir, Barad-dûr and the orcs;
  - `scene.js`, `OrthancWorld.jsx`, `sounds.js`, `orthanc.css`.
- **`middleearth/hidden.js`:** the places off the road. `MiddleEarth.jsx` opens them like chapters, without the walk, and with no next or previous.
- **Storage:** `tp-orthanc-done`, `tp-orthanc-at`, `tp-orthanc-leaf` and `tp-orthanc-colours`; dev hook `window.__ORTHANC__`.
- **Online:** other travellers show in the hall as pale Gandalfs (`useTravellers('orthanc')`).
