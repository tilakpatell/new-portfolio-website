# Dimension C-137, the world: design

Date: 2026-10-05. Status: approved in conversation; this is the written spec.

## Intent

The Rick and Morty page (`/c-137`) opens on a world you walk about in 3D, the
way Albuquerque opens on its town and the Shire chapter on Hobbiton: the
Smiths' street, with the Smith house, Rick's garage lab and Harry Herpson High
School, and through a portal in the garage, an alien street with the Blips and
Chitz arcade, where Roy: A Life Well Lived is playable.

What the user said: "Make a Rick and Morty world on top of the page itself.
Use all the skills like superpowers, caveman, and three.js and make it
awesome. Make the house and lab and school, and get the 3d models or generate
with meshy. Rick and Morty: Roy: A Life Well Lived in a Blips and Chitz
arcade."

Decisions (asked and answered, 2026-10-05):

- Getting about: **both**. Walk as Morty (third person), and board Rick's
  space cruiser parked in the driveway to fly over the neighbourhood.
- Inside: **walk-in 3D rooms with the page's toys in them**. The living-room
  TV plays Interdimensional Cable, the butter robot is at the breakfast table,
  Rick's workbench has the Meeseeks box, the plumbus and a Portal panic
  cabinet; the school has a new pop quiz.
- Roy: **a whole life in five stages**, scored by Roy's age at death, against
  Morty's 55, with a secret "off the grid" ending like Rick's.
- Blips and Chitz: **through a portal** in Rick's garage, on an alien street
  with its own sky.

Assumptions (stated in the design, not contradicted): cel-shaded and inked
like the show (Portal panic's look); the page's existing sections stay below
the world; models made with Meshy where the repo doesn't already have one,
each with a code-drawn stand-in; characters described to Meshy by look, never
by name (the repo's convention).

What's known of Roy (from the show, S2E2 "Mortynight Run", and S6E2): as a
boy Roy stares out of the window and dreams of the NFL; he plays high-school
football; he shelves the dream to provide for his family and takes a job at a
carpet store; in middle age he gets cancer ("I'm not ready to die"), and beats
it; back at the carpet store, a loose roll of carpet crushes him. Morty lived
to 55. Rick took Roy off the grid. No other dialogue is quoted.

## Success criteria

- `/c-137` opens on the 3D world, full width under the nav, with a HUD and a
  list of things to do; with no WebGL (or 3D off, or held on a phone) it is a
  grid of cards that open the same things.
- Morty walks (WASD/arrows, Shift runs, touch stick, gamepad) with the rigged
  Meshy Morty playing idle, walk and run; the camera follows behind.
- The cruiser boards with E at the driveway, flies (WASD steer and throttle,
  Space/Shift or R/F up and down), lands with E on open ground, and can't be
  flown into the houses or off the map.
- The three rooms can be walked into and out of; each hotspot opens its
  overlay; the garage's portal takes Morty to the alien street and back.
- Roy plays all five stages to an age at death, saves a best, shows Morty's
  55, and its off-the-grid route works.
- Rules for the world and for Roy are pure modules with Vitest tests, and the
  existing tests still pass. Lint, tests and the production build pass.
- The world keeps the site's 3D rules: loads only near the viewport, draws
  only on screen, starts from `lib/device`'s budget, slows down gracefully
  (`lib/three/pace`), falls back to cards on a lost context.
- Browser QA screenshots of the street, each room, the alien street, the
  arcade and each Roy stage.

## 1. Page

`src/pages/RickMorty.jsx` renders `<RmWorld />` first (like
`<AbqWorld />`), then the existing hero (portal gun, title, the
`[data-rm-launch]` portal the cruiser flies out of), then everything else as
now. `WORLD_MB['/c-137']` goes up to what the world downloads (estimated 8).

## 2. The world: `src/components/rickmorty/world/`

### rules.js (pure, tested)

Metres, +x east, +z south. Exports:

- `WORLD` (walkable bounds: a rectangle of the street, about 120 × 80 m) and
  `ANNEX` (the alien street, a separate area far off at x = 400, about
  60 × 40 m).
- The layout: `ROAD` (the street, east-west), `HOUSE` (Smith house),
  `GARAGE` (attached to it, door facing the driveway), `SCHOOL` (Harry Herpson
  High, at the east end), `NEIGHBOURS` (houses either side and across),
  `TREES`, `FENCES`, `DRIVEWAY` (where the cruiser parks), `ARCADE` (on the
  annex), `PORTALS` (garage ↔ annex).
- `COLLIDERS` / `WALLS` in `towns/walker.js`'s shape, so its `pushOut` does
  the walking collisions. Morty's stepping reuses `towns/walker.js`
  (`newWalker`, `stepWalker`-style movement, `behindYaw`, `cameraMove`).
- `DOORS`: each { id, x, z, r, to } — the house's front door, the garage
  door, the school's doors, the arcade's door — and the room each opens.
- `ROOMS`: each interior's walkable box (rooms are built under the world at
  `y = -60` offsets, like Bag End) and its `HOTSPOTS` { id, x, z, r, label,
  opens } (`cable`, `butter`, `jerry`, `meeseeks`, `plumbus`, `portalpanic`,
  `rick`, `portal`, `quiz`, `roy`, cabinets).
- `nearDoor`, `nearHotspot`, `inRoom` helpers.
- The cruiser: `newCruiser(at)`, `stepCruiser(c, input, dt)` (hover height,
  yaw, speed, climb; a floor of 2 m over roofs it's above, a ceiling of 40 m,
  kept inside `WORLD`), `canLand(c)` (over open ground, not a roof, slow), and
  `BOARD` (the driveway spot).
- `TASKS` and `progress(done)`: the things to do (watch cable, give the butter
  robot its purpose, summon a Meeseeks, see a plumbus made, play Portal panic,
  pass Goldenfold's quiz, fly the cruiser, go through the portal, play Roy,
  beat 55) and the objective line.
- `QUIZ`: ten multiple-choice questions on the show, and `grade(answers)`.

### scene.js (drawing only)

`createRmWorld(canvas, { onLost })` → `{ render(state, ms), resize, dispose,
lost, enterRoom(id), leaveRoom(), toAnnex(), fromAnnex(), fx(type) }`.

- Renderer from `lib/stage3d` / `lib/three/renderer` with `lib/device`'s
  budget; the ink outline pass and toon gradient from `portal/toon.js`.
- Sky: a bright suburban afternoon (gradient dome, puffy toon clouds); on the
  annex, a purple alien sky with two moons and floating rocks.
- Ground: toon grass, the asphalt street with a dashed line, sidewalks,
  driveways, lawns, picket fences, mailboxes, instanced trees and neighbour
  houses (one model, instanced, tinted).
- Buildings: Meshy GLBs `smith-house`, `school`, `arcade` (from
  `public/models/c137/`), the existing `garage` from `public/games/meshy/`;
  each has a stand-in drawn in code if it fails to load.
- People: Morty (player), Rick (in the lab), Summer, Beth and Jerry (in the
  house and yard), a Meeseeks by the box: `portal/meshyCast.js` for the ones
  it has, plus new Meshy figures for Summer, Beth and Jerry; a toon capsule
  figure as stand-in.
- The cruiser: `public/games/meshy/cruiser.glb`, with Rick in it while
  parked.
- The portal: a swirling green shader disc (the swirl in `../swirl.js` or a
  new one), on the garage's back wall and on the annex.
- Interiors (`interiors.js`): the Smith living room and kitchen (couch, TV
  with an animated static/channel texture, rug, the breakfast table with the
  butter robot), the garage lab (workbench, tools, shelves, the Meeseeks box,
  a plumbus, the Portal panic cabinet, the portal), Goldenfold's classroom
  (desks, chalkboard, his desk), and the Blips and Chitz arcade (`arcade.js`:
  neon sign, rows of cabinets with glowing screens, the Roy cabinet with its
  headset chair, a high-score board, the alien street outside it).
- Labels: a code-drawn sign on each building (house number, "Harry Herpson
  High School", "Blips and Chitz").

### RmWorld.jsx and world.css

Mirrors `AbqWorld.jsx` / `ShireWorld.jsx`: the canvas, `use3D`, `useInView`,
`useFrameLoop`, keys via `towns/keys.js`, touch stick, gamepad, HUD (title
"Dimension C-137", objective, things-to-do chip, a mini map, prompts "Go in
E", "Board E", "Land E"), toasts, and overlays (portal to `document.body`)
that open `Cable`, `ButterRobot`, `MeeseeksBox`, `PlumbusFactory`,
`PortalPanic`, `Quiz` and `Roy`. Leaving an overlay returns to the room.
Progress in `localStorage` (`tp-c137-*`). Achievements added to
`Achievements.jsx`: `roy` (lived a life as Roy), `royfiftyfive` (outlived
Morty's 55), `offthegrid` (took Roy off the grid), `goldstar` (passed the
quiz).

Cards fallback: the places and things to do as cards, each opening its
overlay.

## 3. Roy: `src/components/rickmorty/world/roy/`

### rules.js (pure, tested)

- `STAGES`: `kid` (ages 0–12), `football` (13–18), `carpet` (19–44),
  `cancer` (45), `finale` (46 →); `offgrid` replaces `carpet` and the finale's
  setting when chosen.
- `newLife()`, `stepLife(life, input, dt)`, and per-stage steps:
  - `kid`: a ball thrown at a swinging tire on a timing meter; 5 throws;
    hits add "dream".
  - `football`: three lanes, tacklers coming; dodge to the end zone; a tackle
    costs time; reaching the end zone at all scores the touchdown.
  - `carpet`: customers arrive asking for a colour; pick the matching roll of
    three before their patience runs out; sales add "family". At the start, a
    choice: take the job, or go off the grid (secret: only offered after a
    first life, or by holding the off-grid key).
  - `cancer`: a rhythm meter; hit on the beat enough times before it fills to
    beat it; fail and Roy dies at 45.
  - `finale`: rolls of carpet (or, off the grid, logs) tumble down three
    aisles, faster as he ages; each one dodged adds a year; one hit ends the
    life.
- `ageOf(life)`, `epitaph(life)` (a line for the end card), `MORTY_BEST = 55`.

### scene.js and Roy.jsx

A 3D vignette per stage (a backyard with a tire swing; a floodlit field; the
carpet store's aisles; a hospital room; the store again or a cabin in the
woods), toon-shaded, with a Roy figure (a toon figure in code, aged by
stage: hair greys, posture stoops). `Roy.jsx` shows the headset going on
(a fade through a green scan), the age ticking up in the corner, the stage
titles, the end card ("Roy, 0–N"), and the headset coming off back in the
arcade with the high-score board (yours vs Morty's 55). Best saved in
`localStorage` (`tp-c137-roy`).

## 4. Models: `scripts/meshy-c137.mjs`

Same pipeline and shape as `scripts/meshy-albuquerque.mjs` (text-to-image
`nano-banana-pro` → image-to-3d → rigging for people → fetch and bake with
gltf-transform: WebP textures, meshopt; task ids kept in
`scripts/meshy-c137-tasks.json`), with `scripts/meshy.mjs`'s Rick and Morty
style suffix. Assets:

| name | kind | out |
|---|---|---|
| smith-house | world | `public/models/c137/smith-house.glb` |
| school | world | `public/models/c137/school.glb` |
| arcade | world | `public/models/c137/arcade.glb` |
| roy-cabinet | prop | `public/models/c137/roy-cabinet.glb` |
| summer, beth, jerry | person (rigged, idle/walk) | `public/models/c137/<name>.glb` (+ clips) |

Credited in `public/games/credits.json` like the other Meshy models. The site
never calls Meshy at runtime.

## 5. Testing and QA

- Vitest: `world/rules.test.js` (bounds, colliders, doors, hotspots, cruiser
  floor/ceiling/landing, portal jumps, progress, quiz grading) and
  `world/roy/rules.test.js` (each stage's step, ageing, death at 45 on a
  failed cancer stage, finale ageing and ending, off-grid route, epitaph).
- `npm run lint`, `npm test`, `npm run build`.
- Playwright (Chromium in `/opt/pw-browsers`, the dev server, software GL)
  screenshots: the street, each room, the annex, the arcade, each Roy stage,
  the cards fallback.

## Out of scope

Multiplayer, voiced dialogue, new soundboard clips, changes to other pages.

## Amendment (2026-10-05, from the user): the Smith house, accurate

The user asked for the Smith house to be accurate and sent the show's front
elevation (and a rendered match), the ground- and first-floor plans, and
references for Summer (orange ponytail, hot pink tank top, purple phone) and
Jerry (olive-green polo tucked in with a brown belt, light blue jeans, dark
shoes).

**Outside**, seen from the street, left to right: a single-storey two-car
garage wing standing forward, steep front gable, tan four-panel garage door,
a white backboard with a red hoop on the gable; a single-storey middle
section set back, a wide brown-framed window, a brown front door under a
small pointed porch gable, a satellite dish on the roof; a two-storey wing
on the right with a hipped roof, a wide upstairs window onto a little
balcony with a wooden railing over a shingled lean-to above the wide
downstairs window, a red-brick planter of bushes. Cream stucco walls on a
dark red brick base, brown shingle roofs, a front walk edged in red brick,
a garden hose reel right of the door, a potted plant left of it. So the
garage is on the **west** (left from the street), the two-storey wing on the
east. The Meshy model is remade from this description, and the code-built
stand-in follows it too.

**Inside**, ground floor (the street side is south): kitchen (west, full
depth) with a door in its west wall to the garage (Rick's lab); living room
(north middle: couch facing the TV on its east wall); a room north-east;
dining room (yellow table) south of the living room; the entry way (red rug)
with the front door in its south wall; a hallway east from the entry; the
stairs up beside it; a room south-east. Upstairs: Summer's room and Morty's
room along the north, a hallway, the stairs, Beth and Jerry's room to the
south with the balcony off it. Where everyone is: Jerry on the couch, Beth
in the kitchen, Summer in her room on her phone, Rick in the garage.

## Amendment 2 (2026-10-05, from the user): the lab, the high school and Blips and Chitz, accurate

The user sent show stills of each.

**Rick's garage lab:** dark brown wood-plank walls, a dark beamed ceiling
with a long fluorescent light fixture, a pale grey-green concrete floor. Left
wall: a pegboard of tools, reels and coils over an L-shaped workbench (pale
grey top, dark cabinets under, one door open), a round-bottomed flask on a
stand with glass tubing, conical flasks and beakers of orange, green and pink
liquid, a green radio-like device, a desk lamp with a magnifier, a teal
gadget and a coil-wrapped gizmo on the bench, a red office chair. Back wall:
a corkboard of notes linked with red string and pins, a round wall clock
over a mountain-picture calendar, a pinkish-tan machine on a stand, a cream
washer and dryer. Right wall: an orange floral lampshade on a wall arm, grey
metal shelving of boxes ("Time travel stuff"), jars and alien curios (a
spiky ball, a green alien head).

**Harry Herpson High School:** red-brown brick with a cream band along the
top, flat roofs with air-conditioning units; a taller entrance block with
"HARRY HERPSON HIGH SCHOOL" in raised letters on the brick over a flat cream
canopy and glass double doors with side lights; a long single-storey wing to
the left with big many-paned windows; a two-storey wing to the right with
smaller windows; a flagpole with the US flag by the entrance; an "H.H.H.S."
marquee sign on a brick base; bushes and trees along the front; a
crosswalk. The Meshy model is remade to this (without the text: the
lettering, the marquee and the flagpole are drawn in code). **The
classroom:** pale blue square floor tiles, cream walls over a grey dado,
rows of chair-desks (pale wood tops, blue-grey seats), a "MATH! 2+2" poster
and a corkboard on the front wall, a round clock, a big world map on the
back wall, a bookcase, a row of windows on one side, fluorescent ceiling
panels. The teacher at the front desk.

**Blips and Chitz (inside):** a huge multi-level atrium under a starry
space ceiling: in the middle, a giant orange planet with "BLIPS AND CHITZ"
across it, hanging over a round central kiosk with colourful orbiting
spheres; tall diagonal neon pillars framed in yellow bulb chevrons; balconies
on two or three levels lined with glowing screens and game cabinets; round
teal-topped tables on the floor; magenta, purple, teal and gold neon. Roy's
cabinet sits on the floor among the others.
