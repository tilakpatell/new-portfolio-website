# Lothlórien, the sixth walkable town (design)

## Intent

The towns follow the films' road: the Shire, Bree, Weathertop, Rivendell, Moria, and now Lothlórien, at `#/middle-earth/lorien`. Out of Moria, with Gandalf gone, the Fellowship comes into the golden wood. In the films:
- Gimli's warning about the sorceress, and Galadriel's voice in Frodo's mind;
- Haldir and the Galadhrim, arrows drawn ("The dwarf breathes so loud we could have shot him in the dark");
- Caras Galadhon, its flets and stairs, and Celeborn and Galadriel coming down the stair of light ("Eight there are here, yet nine there were set out from Rivendell");
- the lament for Gandalf, and Sam's verse about the fireworks;
- the Mirror at night: the Shire burning, the Eye; Frodo offers her the Ring, and she passes the test;
- the gifts at the landing: the bow, the daggers, the rope, three hairs for Gimli, and the phial of Eärendil for Frodo;
- the boats down the Anduin, Gollum on a log behind, and the Argonath.

The page's photographs of New Zealand ("The Mirror of Galadriel") stay below the town.

## What you do

1. **The golden wood** (`haldir`). Walk in over the Nimrodel among the mallorns. Gimli boasts; Galadriel's voice speaks in your head. Haldir and the Galadhrim surround you with bows drawn, and Aragorn talks you through in Elvish. Then follow Haldir along the path to Caras Galadhon: he walks on while you keep up, and waits if you fall behind. Seal `goldenwood`.
2. **Caras Galadhon** (`caras`). Climb the stair round the great mallorn to the high flet, among the lanterns. Celeborn and Galadriel come down to meet you: "Eight there are here…". Galadriel looks at each of you, and speaks in your mind; you answer her. Seal `carasgaladhon`.
3. **The Mirror** (`mirror`). Night, and the lament for Gandalf. Follow Galadriel down into the hollow where the Mirror stands. She pours the water. Look in: the Shire burning, then the Eye. The Ring pulls you towards the water:
   - hold back while the Eye looks for you;
   - rest when it doesn't, or your strength gives out.
   Offer her the Ring, and she is tempted ("All shall love me and despair!"), and passes the test. Seal `ipassthetest`.
4. **The gifts** (`gifts`). Morning at the landing by the river. Galadriel's gifts lie on a table:
   - Take each to the right companion: the bow to Legolas, the daggers to Merry or Pippin, the rope to Sam, the three golden hairs to Gimli.
   - The wrong one gets a line, not a gift.
   - Then she gives you the phial: "May it be a light to you in dark places, when all other lights go out." Seal `earendil`.
5. **The Argonath** (`argonath`). Down the Anduin in the elven boats with Sam. Steer clear of the rocks and the eddies; three hits and the boat ships too much water, so start the stretch again. Gollum follows on a log behind. Then the Pillars of the Kings rise out of the river: "Long have I desired to look upon the kings of old. My kin." Seal `argonath`. On to Amon Hen.

## The place

Metres, the towns' conventions. There are two zones in one scene, set apart:

- **The wood** (walkable), about 160 × 110 m:
  - the border and the Nimrodel stream at the west;
  - a path winding east through mallorns to the city;
  - Caras Galadhon round the great mallorn, with flets and lanterns;
  - the Mirror's hollow south of the great tree;
  - the landing on the Silverlode at the east.
- **The river** (on rails): the Anduin between cliffs, about 320 m long, with the Argonath near the end.

The climb up the great tree is on rails too (along the props kit's stair).

## The games, as rules (`rules.js`, tested)

- `newLead` and `stepLead`: Haldir walking a path ahead of you, waiting when you lag.
- `newPull` and `stepPull`: the Mirror's pull. Every so often the Eye looks (with a warning first). Holding back while it looks keeps the pull down; holding back costs strength, and resting restores it. Get through the vision with the pull under the water's edge.
- `newGifts`, `takeGift` and `giveGift`: four gifts, each with its right owners.
- `newBoat` and `stepBoat`: the river as distance `s` and how far across (`lat`), with its width varying, rocks, eddies that push you sideways, and hits that ship water.

## How it fits

- **Shared code:** `towns/` (walker, talk, story, TownHud, keys, the online travellers as ghosts). The Fellowship trail is Rivendell's `newParty`, `lead` and `followAt`.
- **`towns/lorien/`:** `layout.js`, `story.js`, `rules.js`, `props.js` (by a worker), `scene.js`, `LorienWorld.jsx`, `sounds.js`, `lorien.css`.
- **Storage:** `tp-lorien-done` and `tp-lorien-at`; dev hook `window.__LORIEN__`.
- **Seals:** `goldenwood`, `carasgaladhon`, `ipassthetest`, `earendil` and `argonath`. Moria's road leads here; Lothlórien's goes on to Amon Hen.
