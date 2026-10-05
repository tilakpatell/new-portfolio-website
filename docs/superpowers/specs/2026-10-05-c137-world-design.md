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

## Amendment 3 (2026-10-05, from the user): the house inside, as the show draws it, and the way down from the lab

The user sent stills of the kitchen, Morty's room, the entry, the dining room
and the living room, and asked for more things in the rooms, and for the lab's
way down (they chose both: a hatch in the lab floor down to Rick's secret
underground lab, and a clearer door between the garage and the kitchen).

- **Kitchen:** olive-green walls, wood plank floor, a sloped ceiling with two
  pendant lamps; tan cabinets with brown frames above and below the counters
  (pale grey tops); the sink under a window, a paper-towel roll on the wall, a
  knife block; a steel range hood over the stove; a white fridge with magnets
  and notes; a breakfast nook: a small table and chairs by a window with yellow
  curtains; arched doorways out.
- **Living room:** cream walls under exposed wooden ceiling beams; a mint-green
  couch (Jerry sits on it), a teal armchair, a wooden coffee table on an olive
  rug, a bookcase, a table lamp, a mirror and a potted plant, a sliding glass
  door to the back yard, Snuffles' red dog bed; the TV keeps playing cable.
- **Entry:** pink walls, arched doorways, the red rug, a white staircase with
  white balusters and wood treads, a grandfather clock, a wall sconce, a framed
  grid of horse photos (Beth), the front door.
- **Dining room:** cream walls, the table under a yellow-green checked cloth,
  six blue upholstered chairs, salmon curtains, framed paintings (one of
  sunflowers), a pendant lamp; the butter robot on the table.
- **Morty's room:** pale walls with blue trim and cracked plaster, green
  carpet, a round space rug (planets and a sun), the bed with a beige spread, a
  blue nightstand with a red lamp and a little elephant, a bookshelf of books
  and toys, a wall shelf with a robot toy and a gadget, posters (a magnet, a
  small one, a beach with palm trees — no pin-up), a SCIENCE pennant, a
  dartboard on the door, a green jacket on a hook, a red desk with a rocket
  model and a chair, a ceiling light.
- **More things:** mugs and a coffee maker on the counters, pictures on walls,
  rugs, plants.
- **The lab's ways out:** the door between the garage and the kitchen is a
  clear, framed door on both sides; a floor hatch in the lab opens (it lifts as
  Morty comes near) onto a ladder down to **Rick's secret lab**, a new walkable
  room under the garage: concrete and riveted steel, pipes and cables along the
  ceiling, glowing green vats (one with a floating pickle), a big humming
  machine, consoles with green screens, a rack of gadgets, a containment cell,
  a tank of portal fluid, warning signs; the ladder back up. A new thing to do:
  find Rick's secret lab.

## Amendment 4 (2026-10-05, from the user): the President, the Federation, the clone lab, Morty's Mind Blowers and a cruiser with a personality

The user sent stills (a Federation agent in a diner booth; the President with
his generals; the President full length; the Mind Blowers memory room; Rick's
clone lab) and asked for the President and the Galactic Federation, the
underground lab under the house as the clone lab, Morty's Mind Blowers, and a
ship with a personality. Their choices: restyle the secret lab as the clone
lab; the Mind Blowers room off it; the President and the Federation on the
street **and** an Oval Office room **and** Shoney's; the cruiser with a voice
and a face. They asked for the show's own pictures to be looked up first:
those are in `lab/refs/c137/` (git-ignored; the fandom wiki's stills, by its
API): `shoneys.jpg` (the diner outside), `diner-layout.jpg` (its inside, a
layout drawing), `diner-booth.png`, `oval-office.jpg`, `whitehouse-hall.jpg`,
`president-generals.jpg`, `president-*.{jpg,webp}`, `fedagent-diner.jpg`,
`gromflomite-3.jpg`, `fedship-{1,2}.jpg`, `fedlogo.jpg`, `fed-oval.jpg`,
`fed-whitehouse.png`, `mindblowers-{room,1,2}`, `clone-lab.jpg`.

- **Rick's clone lab** (the `basement` area, restyled from the concrete secret
  lab; the hatch and the ladder stay): a round, high, dark-navy room; big
  blue and black pipes across the ceiling with red lamps; in the middle the
  clone machine: a tall dark cylinder hung from the ceiling, a dozen black
  hoses curving down from it to a round base with orange lights, and a glass
  tube on the base glowing cyan with a Rick clone floating in it; grated
  plates on the floor before it; the walls round the back covered in pale
  blue screens (cells with red dots, DNA helices, panels with yellow rings,
  one with Rick's face, waving); spot lamps over the screens; curved pale-blue
  desks along both sides with an angle lamp, a pink cone flask, stacked radio
  boxes, a laptop, a box of dials with two valves, books; Pickle Rick in a jar
  on a desk; a dark floor of hexagon tiles with glowing cyan lines. A door in
  its side wall leads on to Morty's Mind Blowers.
- **Morty's Mind Blowers** (a new room, `mindblowers`, off the clone lab): a
  round room, its walls shelves from floor to ceiling in four or five tiers,
  dark teal with lit green strips, racked with glowing memory vials (most
  cyan, many red, some purple and pink, a few green and yellow); a round
  ceiling light with a radial pattern; the mint reclining chair in the middle
  with the white memory helmet on a grey cart beside it; more vials standing
  on the floor, glowing. Sitting in the chair plays memories one after another
  (a flash in the vial's colour, then a one-line caption, the site's own
  wording): blue for Morty's mistakes, purple for the family's, red for
  Rick's, pink for the one from the liquor cabinet. A new thing to do: watch
  Morty's Mind Blowers.
- **The President's visit** (the street): outside the Smith house, the
  President (navy suit, red tie, white shirt) with a Secret Service agent
  (black suit, sunglasses, earpiece) by his black limousine with two small
  flags. Talk to him: he wants Rick; he says he'll be in the Oval Office and
  has had a way in put in Rick's garage, gets in the limo and the motorcade
  drives off down the street. A new thing to do: meet the President.
- **The Oval Office** (a new room, `oval`, through a second portal in the
  garage, open only once Morty has met the President): the oval room in cream
  with tall windows behind the desk hung with gold drapes, the big wooden desk
  with a phone and folders, the US flag and a gold-fringed flag behind it, the
  blue rug with the seal, two cream couches facing over a coffee table, a
  fireplace with a painting over it, a grandfather clock, doors with
  pediments, columns; the President behind the desk and two generals (green
  uniforms, medals) standing by. A new thing to do: visit the Oval Office.
- **Shoney's** (on the street, in place of the house on the north side at the
  east end): the diner as the still has it, pale yellow walls, a brown roof
  with red trim, red-striped awnings, glass doors and the tall yellow sign
  framed in red, a parking lot in front with two cars. Inside (a new room,
  `diner`): booths in deep red along the windows with blinds, round tables,
  a counter with stools along the other side, a checked floor, ceiling fans
  and pendant lamps, a door to the kitchen; a Federation agent in a black suit
  sits in a booth over eggs, sausage, a mug of coffee and the ketchup; talk to
  him. A new thing to do: have breakfast at Shoney's.
- **The Galactic Federation** (the street): Federation agents in black suits
  (green fly heads, red compound eyes) stand at posts along the sidewalks,
  their heads turning to watch Morty; talk to them. A Federation patrol ship
  (the show's: a dark green rounded hull, glowing green lights along its top,
  round red lights, two pale green engine pods with green jets) circles over
  the street; while Morty flies the cruiser it falls in behind and follows,
  slower than the cruiser at full speed, and turns back to its loop when he's
  far ahead or landed.
- **The cruiser's personality**: the ship talks, in the browser's spoken voice
  (calm, low, a little slow) with a caption, in its own manner: polite,
  literal, quietly menacing and over-protective, with "Keep Summer safe" its
  one catchphrase from the show; every other line is the site's own. It
  speaks when Morty boards, takes off, flies fast, reaches the ceiling, has
  the Federation ship on his tail, lands, gets out and walks off, tries to
  land where he can't, and now and then when he's near it parked; never two
  lines at once, never the same line twice running, each kind of line on its
  own cooldown. It falls silent with the page's sound off, and a "Ship's
  voice" switch in the panel turns the voice (not the captions) off; the
  choice is kept in `tp-c137-shipvoice`. Its face: the headlights are eyes,
  pale yellow with dark pupils; parked, they blink now and then and turn to
  follow Morty; flying fast, they narrow.
- **People's lines** (the President, the generals, the agents, the Secret
  Service) are the site's own, in their manner; no quoted show dialogue.
- New models (Meshy, `scripts/meshy.mjs`, set `c137`): `president`,
  `fedagent`, `general`, `secretservice` (rigged, with clips; the agent also
  seated), `limo`, `fedship`, `shoneys`; each with a code-drawn stand-in.
- Also: walking onto the open hatch drops Morty down it, as E does.

## Amendment 5 (2026-10-05, from the user): a show-sized garage, the school's people, jumping, and a bigger world to fly over

Each part ships and merges on its own, as it's finished.

- **Rick's garage, the show's size and layout**: one car wide (7.2 m across,
  8 m deep, inside the street's 8 m wide garage), laid out from the show's
  stills: the L-shaped workbench along the back wall and down the west wall
  under a window, the pegboard and the corkboard over it, Rick at it; the
  washer and dryer beside it under the clock; the plumbus machine in the
  corner by the kitchen door; the wire shelving on the east wall past that
  door; the long slate worktable in the middle (the Meeseeks box on it); the
  portal and the Portal panic cabinet on the west wall; the President's portal
  on the east wall by the garage door; bare joists overhead with three
  fluorescent fittings; and the hatch in the corner opposite the kitchen door
  (the south-west), as the show's wiki puts it.
- **The school's people**: Mr. Goldenfold (his mustard sweater and moustache),
  Principal Vagina, Jessica, Brad, Tammy, Ethan and Tiny Rick, as Meshy models
  from their looks in the show, in a classroom laid out from the show's
  stills. Coach Feratu is never seen in the show (only mentioned), so he
  isn't drawn.
- **Jumping**: Space jumps on foot. Morty lands on what's low enough to stand
  on (the porch and its steps, beds, couches, tables, counters, desks, the
  kerb) and falls off its edges; anything taller, and every ceiling, stops him.
- **A bigger world, no invisible walls**: more streets of solid houses round
  the Smiths'; the edges are things you can see (hedges, fences, a tree line)
  rather than an invisible stop; the cruiser flies much further and higher.
