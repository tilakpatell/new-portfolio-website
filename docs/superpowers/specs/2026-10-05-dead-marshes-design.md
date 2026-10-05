# The Emyn Muil, the Dead Marshes and the Black Gate (design)

## Intent

The towns follow the films' road. After Amon Hen, the story splits, and this follows Frodo and Sam into the second film, at `#/middle-earth/dead-marshes`:
- the Emyn Muil, its razor rock and the elven rope;
- Gollum creeping down the cliff in the night, caught, and sworn on the precious;
- the Dead Marshes: the lights, the faces in the water, and a Nazgûl on its fell beast overhead;
- the Black Gate, shut and watched, the Easterlings marching in, Sam slipping down the slope, and the elven cloak;
- "There is another way."

## What you do

1. **Real elvish rope** (`rope`). Down the cliff on Sam's rope in the storm. Hold to let the rope out, and swing to keep clear of the jagged outcrops. Three knocks and you fall, so start the climb down again. At the bottom, the rope comes loose by itself: "Real elvish rope." Seal `elvenrope`.
2. **Sméagol** (`smeagol`). Night at the cliff's foot. Lie still and pretend to sleep while Gollum creeps down the rock face, upside down:
   - move while he's looking, and he scuttles back up;
   - once he's close enough to reach for the Ring, grab him;
   - too soon and he gets away; too late and he's on Sam.
   Then the rope burns him, and he swears on the precious. Seal `swearontheprecious`.
3. **The Dead Marshes** (`marsh`). Follow Gollum through the marsh on the firm ground:
   - don't linger by the lights, or you'll be drawn into the water among the faces;
   - when the shriek comes, get down in the reeds before the Nazgûl passes over, and stay down till it's gone.
   Seal `deadmarshes`.
4. **The Black Gate** (`gate`). Along the slope above the Gate, to the lookout over it:
   - the Easterlings' scouts watch the slope;
   - throw the elven cloak over you (hold) and you're a rock to them, but you can't move under it.
   At the lookout, the Gate opens for the Easterlings' column. Gollum: "There is another way." Seal `anotherway`.

## The place

Three small areas, drawn apart in one scene (like Moria):
- **The Emyn Muil** (`emyn`), about 50 × 40 m:
  - a hollow among jagged grey rocks under a sheer cliff;
  - the rope's descent is on rails down the cliff face.
- **The Marshes** (`marsh`), about 140 × 60 m:
  - a winding line of firm ground through black pools, reeds and dead trees;
  - the candle-lights in the pools;
  - mist.
- **Before the Gate** (`gate`), about 120 × 60 m:
  - a slope of ash and rock above the road;
  - the Black Gate in its pass between the Towers of the Teeth;
  - the Easterlings' column on the road.

## The games, as rules (`rules.js`, tested)

- `newDescent` and `stepDescent`: the rope; outcrops, gusts, knocks.
- `newCreep`, `stepCreep` and `pounce`: Gollum's creep, his looks, and the moment to grab.
- `newLure` and `stepLure`: the lights pulling while you're near one.
- `newFell` and `stepFell`: the shriek, the pass overhead, and being down in time.
- Following Gollum is Lothlórien's `newLead` and `stepLead`. The scouts are `../watchers.js`, with the cloak making them notice nothing.

## How it fits

- **Shared code:** `towns/`.
- **`towns/marshes/`:** `layout.js`, `story.js`, `rules.js`, `props.js` (by a worker), `scene.js`, `MarshesWorld.jsx`, `sounds.js`, `marshes.css`.
- **Storage:** `tp-marshes-done` and `tp-marshes-at`; dev hook `window.__MARSHES__`.
- **Seals:** `elvenrope`, `swearontheprecious`, `deadmarshes` and `anotherway`. Amon Hen's road leads here; this one goes on to Cirith Ungol.
