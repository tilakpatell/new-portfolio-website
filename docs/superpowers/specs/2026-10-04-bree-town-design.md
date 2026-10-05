# Bree, the second walkable town (design)

## Intent

"Build the other towns": more places to walk about like Hobbiton, along the
Ring's road. Bree comes first. It is the next stop after the Shire, and the
Shire kit's timber, plaster and slate suit it. Bree becomes a chapter of the
Middle-earth page (`/#/middle-earth/bree`), between the Shire and Rivendell.

What the user wants from a world (memory notes `world-pages-bar`,
`albuquerque-town-bar`):

- the iconic thing first;
- named characters with their lines;
- things to do that come from famous scenes;
- no unseen walls, and colliders that match what you see;
- no downloads that aren't needed.

Success: Bree reads as the films' Bree at a glance (a wet night, a stockade,
tall timber houses, a lit inn). You can play its five scenes in order, earn
five seals, and walk on to Rivendell. It runs on the same device tiers as
the Shire, with the same fallback to cards when there is no 3D.

## What you do

The film's Bree, in the rain at night, then dawn.

1. **What's your business in Bree?** (`gate`). You start on the road outside
   the West Gate in the rain. Knock, and Harry the gatekeeper opens his hatch
   and asks your business. You answer from a choice of replies. The right
   ones get the gate opened. Seal `breegate`.
2. **Mr. Underhill** (`pony`). Go into the Prancing Pony (an inside scene,
   like Bag End). Barliman Butterbur asks your name. "Baggins" makes the room
   go quiet and a hooded man look up; "Underhill" is the answer. Then he says
   "Gandalf? … Not seen him for six months." Seal `underhill`.
3. **It comes in pints?** (`pints`). Pippin wants one. Pour pints at
   Butterbur's tap: hold to pour, let go between the lines on the tankard,
   and mind the foam. Three good ones. Seal `pints`.
4. **Not nearly frightened enough** (`strider`). Ask about the man by the
   fire. Butterbur names him Strider. Pippin blurts out "Frodo Baggins? He's
   over there", you jump up, and the Ring slips on. Take it off before the
   Eye finds you. Strider pulls you aside: "Are you frightened?" "Yes." "Not
   nearly frightened enough. I know what hunts you." Night falls. Seal
   `strider`.
5. **Through Bree unseen** (`slip`). The Black Riders have broken the West
   Gate and four Nazgûl search the lanes on foot. Get from the inn to Strider
   at the East Gate without being seen. They can't see through walls, they
   can smell you up close, and wearing the Ring shows you to all of them. A
   caught try starts again at the inn door. Seal `slipaway`.

At dawn the rain stops. Strider, Sam and Bill the pony wait at the East
Gate, and the road leads on to Rivendell.

People to talk to outdoors, each with lines from the films (or the book
where the films are silent): Harry Goatleaf, Sam, Merry, Pippin, Bill Ferny
at his door, a Bree-lander, the man with the carrot (the director's cameo),
and Strider at dawn. The Ring button works as it does in the Shire.

## The place

Metres, the Shire's conventions: +x east, +z south, a hobbit 1.55 tall. Big
Folk are about 2.3 tall, and their doors and houses are built to that size,
so the hobbits look small.

- A walkable disc of radius 46. The town sits inside a stockade of
  sharpened logs (radius 34). The West Gate faces the road from the Shire
  and the East Gate the road on. The stockade is the visible edge of the
  town.
- Outside the West Gate the road runs west between the dike's earth banks.
  At the walkable edge the road goes on into the dark and rain. Walking
  into the edge there gets one line, "Back to the Shire? Not with the Ring
  in your pocket.", instead of a silent wall.
- The East Road is Bree's high street. It runs from gate to gate past the
  well and the market stalls. The Prancing Pony stands on its north side,
  three storeys under a sign of a rearing white pony, with its stable yard
  beside it.
- About a dozen tall timber-framed houses line the street and two lanes.
  They rise up the slope towards Bree-hill, which stands beyond the stockade
  to the north-east, wooded. Bill Ferny's dark house is down the south lane.
  The gatekeeper's lodge is inside the West Gate.
- Mud streets with puddles, rain, lit windows and door lanterns. At night,
  two riderless black horses stand by the smashed West Gate.

## How it's built

New code lives under `src/components/middleearth/towns/`. The parts any
later town can use are generic. Bree's own parts are in `towns/bree/`.

Generic, pure and tested:

- `walker.js`: a walker over circle, box (turnable) and wall-segment
  colliders inside a disc. Gates can be closed walls. It is the Shire's
  `push`/`stepHobbit` made data-driven.
- `watchers.js`: the generic "sneak past watchers". Patrol rounds, a sight
  cone, smell up close, walls that block sight, and alert, chase, give-up
  and catch. Events like the Shire's `stepHunt`.
- `talk.js`: conversations as data, with nodes, lines, choices and endings.
- `story.js`: quests as data (`needs`, `go`, `where`), and progress (what's
  open, what's next, the objective, the time of day). Also `nearest(list,
  x, z)` for spots and people.

Generic, drawing:

- `rain.js`: streaks falling in a box round the camera (one draw) and
  splashes.
- `ground.js`: terrain from a town's `height` and `paint`, and puddles.
- `bake.js`: `bake()`, `farTree()` and `dotTexture()`, moved out of
  `shire/scene.js` (which imports them back) so both towns share them.
- `TownHud.jsx`: the HUD parts both towns need, generic: the corner map,
  the quest list, the speech bubble, the conversation panel and the touch
  stick. They reuse the `shire-*` classes, so they look the same.

Bree:

- `bree/layout.js`: the layout, `height`, the colliders (each measured from
  the builder that draws it), roads, spots, the cast and the patrol rounds.
- `bree/story.js`: the quests, the lines, the conversations, and the
  Nazgûl's settings.
- `bree/pints.js`: the pouring rules.
- `bree/props.js`: the builders, made with helpers that `shire/props.js`
  now exports: a tall house (two or three floors, jettied, slate or thatch,
  stone or timber below), the Prancing Pony and its sign, the stockade and
  its gates (each with a hatch that opens, leaves that swing, and a smashed
  version), the lodge, the stable, the well, market stalls, a standing
  Nazgûl, and Bill the pony.
- `bree/inn.js`: the Pony's common room, built under the world like Bag
  End. Beams, a fire, the bar with its barrels and tap, tables of
  Bree-landers, the hobbits' table, and Strider in the dark corner with his
  pipe glowing. There is a camera for each beat.
- `bree/scene.js`: `createBreeWorld(canvas)` → `{ render, fx, aim,
  screenOf, resize, dispose, lost, info }`, the same shape as the Shire's.
- `bree/BreeWorld.jsx`: the walking, the HUD, the five scenes, and cards
  without 3D. It follows `ShireWorld.jsx`, built from `TownHud` parts.
- `bree/sounds.js`: rain and its gusts, the gate hatch, the tap and a
  tankard set down, and the inn's murmur. The Nazgûl's scream comes from
  the film clip, with the Shire's synthesised `shriek` as the fallback.

Small changes elsewhere:

- `shire/props.js` exports its builder helpers, and `createShireKit`
  returns `K`.
- `shire/sky.js`: `makeAtmosphere` takes `moods` (it defaults to the
  Shire's).
- `chapters.js` gets a Bree chapter (`stop: 'bree'`, `at: [262, 200]`, its
  five seals). `chapters.test.js` follows.
- `Achievements.jsx` gets the five seals.
- `MiddleEarth.jsx` lazy-loads `BreeWorld` for the chapter. The Shire's
  East Road now leads to Bree ("On to Bree").
- Dev hook `window.__BREE__ = { api, sim, complete }`. localStorage
  `tp-bree-done` and `tp-bree-at`, as JSON.

Nothing is downloaded: Bree is drawn in code, so `WORLD_MB` stays 1. The
low tier gets fewer houses' details, no rain splashes, fewer streaks and no
guests.

## Testing

- Unit tests for the walker (collision against each kind of collider,
  turned boxes, closed gates, the disc), watchers (sight, walls blocking
  sight, smell, chase and lose, catch), talk (choices, endings), story
  (order, the time of day), pints (good, short, spilt, three to win), and
  Bree's layout (every spot and cast member stands clear of the colliders
  and can reach the inn door from the start, every patrol stays on open
  ground).
- In a browser: the tour script (`TOUR_URL=/#/middle-earth/bree
  TOUR_HOOK=__BREE__ node lab/tour.mjs`) at the gate, on the street, inside
  the Pony, at night with the Nazgûl, and at dawn. Headless Chromium on
  Metal, as in the memory note `hq-3d-browser-testing`.
- Lint, the full test run, and a build.

## Not in this round

- More towns (Rivendell, Edoras, Minas Tirith). The generic parts are there
  for them.
- Moving the Shire onto the generic parts.
- Downloaded models for Bree.
