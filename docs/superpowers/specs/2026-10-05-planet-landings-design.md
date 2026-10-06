# Planet landings: each world its own place

## What and why

On the universe map, `G` at a fandom planet sets the ship down and puts its crew on foot (`universe/foot.js`, `universe/footScene.js`). Today every planet looks the same down there: the planet's map blurred under some grit, a hundred grey-ish rocks in its palette, a thin glow on the horizon and black space overhead. Landing on Middle-earth should feel like the Shire; landing on Breaking Bad's planet should feel like the New Mexico desert.

Goal: when you land on a planet, the ground, the sky, what grows or stands about and the landmarks round the landing spot all belong to that planet's world.

Scope: the eleven landable fandom planets on the universe map (`universes.js`: music, middleearth, transformers, marvel, breakingbad, office, rickmorty, gaming, travel, caribbean, invincible). The galaxy's own worlds (`galaxy/surface/`) already have this and are out of scope. The Galactic Federation squads stay on every planet (they're after every crew, wherever it lands).

## Decisions

- **In place, not a new page.** The landing stays in the map's on-foot scene, so the descent, the walk round the planet, the squads and other pilots' crews (multiplayer) all keep working. Routing to a separate page per planet would lose that.
- **Reuse before making.** Every landmark comes first from what the repo already has: the world pages' code-built kits (the Shire's `createShireKit`, the galaxy surface's `createKit` and its `PROPS`/`SCATTER`) and the committed GLBs (`public/models/**`, `public/games/**`). Only what isn't there is fetched from Sketchfab (CC BY, credited in `src/data/modelCredits.json`) or, failing that, generated with Meshy, offline, committed. No runtime calls to asset services.
- **Data apart from drawing.** Each planet's landing is plain data (`universe/landings/landings.js`, tested in Node): its title, ground, sky, scatter and things, in metres on a flat frame round the landing spot. The builders live in one file per planet (`universe/landings/<id>.js`), loaded only when you land there (dynamic import), so the map's bundle doesn't grow.
- **One builder shape.** A landing builder is the galaxy surface's: `(kit, opts) → { object, solids? }` (`object` in metres, standing on y = 0, facing +z; `solids` circles or boxes in its own frame). It may return a promise (a GLB loading). Scatter builders return `{ parts, radius }` and are drawn instanced. So the galaxy surface's builders can be used as they are.

## How it fits together

```
footScene.begin(id)
  ├─ LANDINGS[id]            data: title, ground, sky, scatter, things
  ├─ createGround(…, ground) the patch, in the landing's own ground style
  ├─ createSky(sky)         a day sky round the camera, its sun, the air at the horizon
  └─ furnish(id, frame)     loads landings/<id>.js, builds the things and the scatter,
                            puts them on the sphere round the spot, and hands back
                            their solids (circles along the ground) for walk()
```

- **Placing on the sphere.** A thing at `[x, z]` metres (x to the right of the landing frame, z ahead) goes to `offset(frame, z·METRE, x·METRE, R)`; its up is the ground's normal there, its +z the frame's heading turned by `yaw`; it's scaled by `METRE` and sunk a little so its base sits on the curve. The planets are small (600–700 m across the middle at a person's scale: the horizon is about 45 m off), so the things stand within 10–60 m of the ship, the tall ones further out.
- **Solids.** Circles become `{ n, r }` obstacles for `walk()`. Boxes become a row of circles along their long side.
- **Clear of the ship.** Nothing stands within the ship's parking circle plus a margin; things keep clear of each other. Tested.
- **Ground styles.** The patch's shader gets a `style` and three colours: `grit` (today's), `grass`, `sand`, `plating` (with glowing seams), `tiles`, `pixel` and `asphalt`. Up close it's the style; toward the patch's edge it fades to the planet's own map, so it matches the sphere seen from above.
- **Sky.** The horizon glow becomes a sky dome round the camera: a zenith and a horizon colour, a sun glow toward the key light, drawn over space by day and fading to the stars at night. A planet can leave space showing through (`sky.space`, 0…1).
- **Arrival.** Landing emits `{ type: 'foot', id: 'arrive', title, sub }`, and the map shows the place's name as a title card for a few seconds.
- **Phones and mid-tier machines.** `small` halves the scatter; the things all stay (they're few, and they make the place). A thing of many little meshes is merged into one per material (`kit.merge`).
- **Disposal.** Everything a landing builds is owned and disposed when the crew take off.

## The planets

| Planet | Title | Ground | Sky | Things (from) |
| --- | --- | --- | --- | --- |
| middleearth | The Shire | grass | pale blue, warm horizon | Bag End, hobbit holes, the Party Tree, oaks, a signpost, sheep, fences, flowers, mushrooms (Shire kit) |
| breakingbad | The desert outside Albuquerque | sand | hard desert blue | the RV with its lab barrels, cacti, tumbleweed, the water tower (Sketchfab GLBs), rocks, scrub |
| rickmorty | Dimension C-137 | grass | C-137's cyan | the Smiths' house, the school, the President's limo, the Federation's ship, a portal (C-137 GLBs, swirl shader) |
| transformers | Cybertron | plating, energon seams | violet dusk, two moons | Optimus and Megatron, Kaon's gate and towers, energon crystals (Cybertron kits, universe GLBs) |
| marvel | Avengers HQ | grass with a helipad | day blue | the Quinjet, the heroes standing about, flags, trees (compound kit, Avengers GLBs) |
| office | Scranton Business Park | asphalt | overcast | the office block, cars, the cast, paper (Office kit and cast) |
| gaming | Dot Matrix | pixel | Game Boy green | the giant Game Boy, Mario and a Piranha Plant, pipes, blocks (universe GLBs, code-built) |
| travel | Earth | grass | blue | the 737, a signpost to every place visited (data/places), trees |
| caribbean | A Caribbean island | sand, the sea | tropical | palms, the Black Pearl at anchor, a chest, barrels, the fort (Caribbean GLBs) |
| invincible | The Graysons' city | asphalt | Viltrum's orange | towers round the edge, a crater, Mark and Omni-Man (Invincible GLBs, facade kit) |
| music | The courtyard | tiles (sandstone) | dusk | the pavilion, lamps, the sitar, harmonium, tabla and tanpura on a rug (music GLBs) |

## Testing

- `landings.test.js` (Node): every landable planet has a landing; titles and colours are valid; every thing's kind is a builder its planet file names; every GLB a landing names exists under `public/`; things clear the ship and each other; the scatter's counts are within budget.
- `foot.test.js` grows a test for placing on the sphere (`place()`): a thing at `[0, 10]` is 10 m ahead along the ground, upright.
- In the browser: land on each planet (Playwright, `?quality=low` and high), screenshot, check the frame time and triangle count.

## Shipping

Four pull requests, each merged to main when lint, tests and the build pass: (1) the framework with Middle-earth, Breaking Bad and Rick and Morty; (2) Transformers, Marvel, the Office and Gaming; (3) Earth, the Caribbean, Invincible and the music room; (4) locals to meet and walking up to a landmark to open its world's page, and the docs.
