# Moria, the fifth walkable town (design)

## Intent

The towns follow the films' road: the Shire, Bree, Weathertop, Rivendell, and now Moria, at `#/middle-earth/moria`. The user asked for the whole story, piece by piece, as far as Mordor. In the films, Moria is the dark heart of the first film:
- the Doors of Durin by moonlight, and the Watcher in the Water;
- the long dark, and the fork Gandalf can't remember;
- the great halls of Dwarrowdelf when he risks a little more light;
- Balin's tomb, Pippin and the well ("Fool of a Took!"), and the drums in the deep;
- the cave troll and Frodo's mithril;
- the Bridge of Khazad-dûm: "You shall not pass!" and "Fly, you fools!"

The page's existing Doors (the ithildin under the moon) and Bridge (the duel as Gandalf) stay below the town, as more to do.

## What you do

1. **Speak, friend, and enter** (`doors`). Night at the West-gate. Walk the lakeshore under the cliff to the Doors. Gandalf tries his spells; you work out the riddle ("What's the Elvish word for friend?", "Mellon"). Then the Watcher in the Water: tentacles rise from the lake and slam down where you're running, so dodge them to the open doors. Seal `mellon` (the Doors section's seal too).
2. **The long dark** (`dark`). Inside, by Gandalf's staff-light, you reach three passages. "I have no memory of this place." One breathes cold air: follow your nose. The other two end in rock-falls. Choose right, and Gandalf risks a little more light: the great realm and dwarf-city of Dwarrowdelf. Seal `dwarrowdelf`.
3. **Fool of a Took!** (`tomb`). Gimli runs ahead to the Chamber of Mazarbul: Balin's tomb in a shaft of daylight, and the book: "We cannot get out… they are coming." Pippin touches the dwarf at the well. Catch what falls: the skull, then the body, but never the bucket and chain. Drums in the deep. Seal `fooloftook`.
4. **The cave troll** (`troll`). Goblins at the doors, and they have a cave troll. Keep out of its sight behind the columns and the tomb while the others fight. Then a spear finds Frodo, but "He's alive!" It's mithril. Seal `mithril`.
5. **The Bridge of Khazad-dûm** (`bridge`). Flee down the stair and across the bridge with the Balrog behind. Dodge falling stone, leap the broken gap ("Nobody tosses a dwarf!"), and run. On the bridge, Gandalf turns: "You shall not pass!" He falls: "Fly, you fools!" Seal `flyyoufools`.

## The place

Metres, the towns' conventions. There are two walkable areas, drawn in one scene, set apart:

- **The West-gate** (outside, at night): a strip of shore under a sheer cliff, with the lake to the south and the Doors in the cliff with holly trees either side.
- **The halls** (inside, dark):
  - the passage in from the Doors;
  - the fork's three archways;
  - the great hall of pillars, about 60 × 40 m;
  - the Chamber of Mazarbul off its north side.
- **The stair and the bridge**: a separate stretch for the flight. The bridge is narrow, over the abyss, with fire far below.

## How it fits

- **Shared code:** `towns/` (walker, watchers, talk, story, TownHud, keys, the online travellers as ghosts).
- **`towns/moria/`:**
  - `layout.js`: both areas, the colliders, who's about;
  - `story.js`;
  - `rules.js`: the Watcher, the falling dwarf, the troll's hunt, the flight;
  - `props.js`: the West-gate, the tentacles, the hall, the fork, the chamber, the stair and bridge, the troll, goblins, the Balrog;
  - `scene.js`, `MoriaWorld.jsx`, `sounds.js`.
- **Storage:** `tp-moria-done` and `tp-moria-at`; dev hook `window.__MORIA__`.
- **Seals:** `mellon` (shared), `dwarrowdelf`, `fooloftook`, `mithril` and `flyyoufools`. Rivendell's road leads here; Moria's goes on to Lothlórien.
