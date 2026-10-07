# Handoff: Invincible, the open world

Session of 2026-10-05. The ask: "really improve and make 3d models and stuff for invincible and make it a 3d world not just a site. Make it a lot better", merging to main as it's built. Spec: `docs/superpowers/specs/2026-10-05-invincible-world-design.md`.

## Done (merged)

- [#157](https://github.com/tilakpatell/new-portfolio-website/pull/157), the flyable city: `/invincible` opens on it. `map.js` and `flight.js` (tested), the land shader, 6,700 towers, 5,500 houses, the landmarks modelled in code, the sound-barrier boom, craters, the HUD (speed, Mach, height, compass, map) and noon, dusk or night.
- [#172](https://github.com/tilakpatell/new-portfolio-website/pull/172), people and things to do:
  - the cast built in code (Atom Eve, Mom, Cecil, Allen, townspeople), with Eve on patrol and speech balloons;
  - `quests.js` (tested): Dad's rings, eight title cards and rescues;
  - clouds, the airliner, and five achievements.
- [#183](https://github.com/tilakpatell/new-portfolio-website/pull/183), traffic and pedestrians: `traffic.js` (tested) and `life.js`.
- [#194](https://github.com/tilakpatell/new-portfolio-website/pull/194), space:
  - `orbit.js` (tested) and `space.js`: the Earth from the Earth page's maps, the Moon, Mars, Allen and Thragg, and the re-entry burn;
  - the land is now a 40 km disc, and the far plane moves out with height;
  - per-instance shader numbers are now `flat`, which fixed the speckled walls.

- [#203](https://github.com/tilakpatell/new-portfolio-website/pull/203), combat:
  - `fight.js` (tested) and `flaxans.js`: the Flaxan portal over the river, punches with a lunge, ramming, bolts;
  - Cecil starts it, or it comes four minutes in;
  - the guide's tips, moved into `components/guide/pages.js` after another session's refactor.
- [#205](https://github.com/tilakpatell/new-portfolio-website/pull/205), polish:
  - the first visit drops Mark in from the sky under the INVINCIBLE title card;
  - E by Dad scrolls down to *Think, Mark!*;
  - the minimap is placed for phones.

## Part 2 (2026-10-07): seen, alive, with a story

The owner's ask: the world “is hard to see, has bugs, and nothing to do and needs better NPC AI, missions, everything”, with better, cohesive models (Meshy, the PC's gen3d runner, or Sketchfab). Spec: `docs/superpowers/specs/2026-10-07-invincible-world-2-design.md`. Plan: `docs/superpowers/plans/2026-10-07-invincible-world-2.md`, eleven tasks, one pull request each. Shots from the sweep that started it are described in the spec's first section. On 2026-10-07 the egress proxy allowed `api.meshy.ai` and `api.sketchfab.com`, and `MESHY_API_KEY` and `SKETCHFAB_API_TOKEN` were in the environment.

### The cast (Task 4), 2026-10-07

The owner asked for the models to be made from the show's own art on the Invincible wiki (amazon-invincible.fandom.com). `scripts/meshy-invincible.mjs` gained a `refs` step: each figure names its wiki file (`ref`), which is downloaded into `lab/meshy/invincible/ref/` (git-ignored, so the studio's pictures are never committed) and sent to Meshy's image-to-3D. Only the models are shipped.

- Made from the wiki's art and rigged on Meshy's humanoid skeleton: Mark (remade), Omni-Man, Thragg, Atom Eve, Cecil, Debbie, Allen, a Mauler and Doc Seismic, about 16.5 k triangles each with a 2 K atlas. The Sketchfab Omni-Man and Thragg are gone, and with them two other artists' looks.
- Made from words in the spec's `STYLE` line: three townspeople (`civA`, `civB`, `civC`) and three props (`bank`, `heli`, `truck`).
- Two Meshy accounts: `MESHY_API_KEY` and `MESHY_API_KEY_ACC_2`; `MESHY_ACCOUNT=2` sends new tasks to the second, and each task entry keeps its `acct`, since a task can only be read with its own account.
- Credits: 328 in all. Account 1: 160 (eight models at 15, eight rigs at 5), 7 left. Account 2: 168 (Mark, Thragg and Cecil remade and rigged, 45; six concept images, 18; the townspeople's and props' six models, 90; three rigs, 15). Account 2's balance moved by more than this while it ran (down to 675, then topped up to about 5,000), so something else shares that account; it had 5,039 left at the merge.
- Judged on `docs/gen3d/invincible/cast-sheet.webp` (`node scripts/inv-cast-sheet.mjs`, with `npx vite --port 5188` running): one look, one saturation, the heights in the spec's ratios.
- Wrong twice on Meshy, so sent to the PC's runner: Thragg (his skin came out light, even with a texture prompt; #441) and Cecil (a pale, blank face; #442). Their second Meshy versions stand in until the runner's pull requests come; those models will need rigging on Meshy from their GLBs (`/v1/rigging` takes a model URL).
- Known: Mark's back has a yellow smear where Meshy guessed the unseen side (the old model had it too); the wiki has no back view to fix it from.
- Wired: `people.js`'s `personFor(kind, seed, template)` gives the world's people the HD figure when there is one that can be posed (the bones a pose needs are checked) and the kit's person otherwise; `loadCast(names)` loads the templates, a missing file giving the kit's person. Eve, Debbie, Cecil and Allen in space are now the HD figures; Omni-Man and Thragg are the new models. `cast.test.js` checks every `CAST` file, height and credit.

### The cast again, sharper and moving (2026-10-07, after the owner's “why are the textures so low res and animations horrible”)

Found: the first cast was made on `meshy-6-lite` at 16 k triangles, whose own texture is a thousand islands a few texels each, and shipped as WebP at sharp's default quality; and nothing moved but `lib/three/rig.js`'s poses (bones aimed in code), so every walk, wave and talk was a puppet's.

- Remade on `meshy-7.1`: about 30 k triangles, the texture painted at 4K and atlased again at 2K (`reatlas`), WebP at quality 90. Mark's close-up shows a face, muscle and a clean back panel where the lite model had a blur and a smear.
- Motion-captured clips from Meshy's library, by kind of figure (`CLIPS` in `scripts/meshy-invincible.mjs`: hero, person, brute, caster), and two made from words with Meshy's text to motion (`MOTIONS`: `hover` and `fly`, which the library has none of; one task an account, put on every flyer within its three days). `fetch` merges them into the figure's file under the game's names, the hips held in place (the game moves the figure) and pinned outright for the clips that leave the ground (`hover`, `fly`, `land`).
- `lib/three/rig.js`: a figure with clips has `act(name, { fade, speed, once, at })`, `tick(dt)`, `clips` and `acting`; a `pose()` stops them, so a role without a clip is posed as before (`rig.test.js`).
- Wired: Mark plays idle, walk and run (at the pace he goes), hover, fly and hit; the landing crouch and the punch stay posed (aimed and snappy). The fly clip lies along its flight head first, so `carry(…, { ahead: true })` turns his front, not his crown, along it. Eve likewise. Townspeople, Debbie and Cecil play idle, walk, talk, wave, phone, run and cheer, each from its own moment in the clip; Cecil's folded arms stay posed. Other players' figures (the ghosts) play Mark's clips on the ground and hovering.
- `scripts/clip-shot.mjs` (with `scripts/preview/clip-shot.html`) draws a figure's clips, four moments each, for judging them.
- Not used: `land` (the library's “Dive Down and Land” is a dive and a somersault).
- Thragg and Cecil: their texture prompts were the trouble (a `texture_prompt` overrides the picture's own colours), so both were made again from the picture alone. Cecil came right; Thragg's costume still came out pale, so `retexture` paints his model again with the wiki picture as its style, and `skin` paints his skin his own colour in the bake (Meshy made it light in all five tries). Issues #441 and #442 for the PC's runner were closed as not needed.
- The townspeople are simplified to 12 k triangles in the bake (`tris`): a dozen can be in sight at once, and at 31 k the plaza drew 1.70 M triangles on the low tier, over the 1.5 M budget. With them at 12 k: plaza 1.48 M, Eve's shot 1.46 M, Burger Mart 1.36 M, the school 1.41 M.
- Credits for this round: about 1,020 on account 2 (fifteen meshy-7.1 models at 30 and two remade, rigs at 5, clips at 3 each and the two motions at 10, two retextures at 10). Account 2 had 2,973 left after it; its balance moved by more than this session spent while it ran, as before.

### Task 1: the sweep, the metrics and one clock (2026-10-07)

Every shot in `scripts/inv-world-check.mjs` was run on the low tier at 960×540: the city shots at noon and again at night, plus a phone run (W=390). A scratch diag script covered corrupt saves, a dive into the river, Eve, a lost WebGL context and a click on the time button while the city loads. The fixes went in file by file, then a review. At the end `npm run lint`, `npm test` (367 files, 4,347 tests; the one skip, `dickansh/seal.test.js`, needs a password) and `npm run build` pass. `npx vitest run src/components/invincible` runs 109 tests in 8 files.

One finding changes the spec. The old script set the time only when a shot named one, so every shot after `streetnight` kept the night while the button said Noon. The spec's “from high up the city is murk” (item 3) came from such a frame. At noon, `high` reads: downtown, the river and the hills. What's left there is the low tier's aliasing (no MSAA, `avengers/hq/engine.js:22`), which turns the outer suburbs to speckle. Shots now default to noon.

#### The metrics

`--metrics` prints `name band=… mark=…` after each shot. It measures the saved PNG itself, decoded with sharp, on the canvas only: the `.iw-canvas` box under the site header (x 0, y 76, 960×477 at 960×540), cut to what's on screen. The HUD over the canvas counts, as a player sees it.

- Luma is 0.2126 R + 0.7152 G + 0.0722 B on the sRGB values as stored, 0 to 1, not made linear.
- band: the mean over every column, rows 35–75 % of the canvas.
- mark: the difference between the mean of the 60×90 px box round him and the mean of the ring out to 100×130 px. The box is centred on `api.project([x, y + 0.9, z])` from `sim.h.p` (his feet), through the scene's own camera, read just after the shot. It prints `mark=off` when he's behind the camera or off the canvas.
- `BOX=1` also writes `inv-<name>.box.png` with the band (cyan), the box (magenta) and the ring (yellow) drawn on. The shots themselves stay clean.
- Two runs agree to 3 decimals. Porch moves by 0.001–0.002, because the title card spins.

“Before” is HEAD's world measured with the new script; “after” is this task's tree. Every shot is at noon except `streetnight`. Task 2's targets: band 0.30–0.65 at noon and 0.12–0.35 at night; mark ≥ 0.18.

| Shot | Band before | Band after | Mark before | Mark after |
|---|---|---|---|---|
| spawn | 0.498 | 0.498 | 0.167 | 0.167 |
| street | 0.365 | 0.365 | 0.047 | 0.047 |
| downtown | 0.316 | 0.316 | 0.042 | 0.044 |
| streetnight (night) | 0.172 | 0.172 | 0.015 | 0.015 |
| high | 0.442 | 0.442 | 0.039 | 0.041 |
| porch | 0.506 | 0.506 | 0.128 | 0.126 |

The bands are already in range. Mark misses everywhere: the best is spawn at 0.167, the worst streetnight at 0.015, and he's 0.04–0.05 in the air over the city. This task didn't change the look, so the numbers barely move; that's Task 2's job.

#### The sweep

Fixed here:

- A `null` in `tp-inv-world-quests` took the whole `/invincible` page down, *Think, Mark!* too, on every reload. `newQuests` read `null.best` in `World`'s `useState`, and the route's error boundary caught it. `newQuests` now takes anything (`quests.js:68`) and keeps only real card episodes, once each, a `best` above 0 and a whole number of rescues. `keptQuests` can't throw (`InvWorld.jsx:81`). Before, `cards: ['x', 99, 1, 1, …]` counted 9 of 8, and the last card could never be found.
- The time label could lie. `api.setTime` changed only the scene, and a click during “Over the city…” changed the label but not the sky. Now `time` is one state (`InvWorld.jsx:127`). `syncTime` (`:159`) gives the scene the latest time, one call at a time, and the loader awaits it. `scene.setTime` (`scene.js:188`) queues too, latest wins: two quick presses of T can't land the wrong way round, and a sky that loads as he goes up to space leaves space's look alone. The dev hook keeps its shape; its `api.setTime(name)` sets the state and resolves once the scene has the time. `streetnight`'s button now says Night.
- A saved position was barely checked. A string `face` gave a black canvas of NaN geometry and was saved back; inside a tower he was pushed out sideways; at y 9,500 he was stuck. `isSafeStart(world, at)` (`map.js:358`) turns down anything that isn't three finite numbers, or is off the world, at or above 9,000 m, over water, under the land, or inside a building, house, shop, landmark or bridge. A roof, a bridge deck and the pavement by a wall pass. `placeHero` (`InvWorld.jsx:93`) checks it once the scene's world exists; a place it turns down gives the spawn and the first-visit drop. A bad face becomes the spawn's. Only a place `isSafeStart` takes is saved back (`:247`). A bad `tp-inv-world-time` gives noon.
- The ceiling trap. At the top of the sky only a climb faster than 20 m/s got him out, and a hero pinned there could never make one. Now any climb into it goes out, flying level along it doesn't, and after re-entry he can go straight back up (`flight.js:314`).
- A boost into the river skimmed at 260 m/s, splashed 7–8 times in 0.35 s and hit the next bridge. Now there's one `splash {at, speed}` and a stop at the surface, in the air; holding down or boost into the water does nothing more (`flight.js:207`, `:234`). It's drawn as a crown of spray, mist and droplets, with no crater (`fx.js:278`). It knocks the camera, and above 40 m/s it scares the people near it. It's heard as `splashSound(speed)`, at most once every 0.4 s.
- The river ran through the hills in a sheer slot, its walls 60–180 m high. Now it's a 450 m valley with its banks at town level (`map.js:21`, `:81`), and 74 hill pines that stood in the water are gone. Everything else in `buildWorld` is unchanged.
- `dt`: `stepQuests`, `stepFight` and `npcs.update` clamp it to 0.05 s themselves; NaN or below 0 is no step at all. Tested with `dt = 60`. This also stopped bolts tunnelling through him under the dev speedup.
- Tunnelling: a card, a catch and a Flaxan ram now test the path since the last step, so at 260 m/s and 20 fps he can't fly through one (`quests.js:94`, `fight.js:76`). A move of 300 m or more in one step is a jump, not a flight: before, a dev-hook jump across ring 0 started Dad's lesson.
- The rescue in space. There was no stray beacon in any case (checked in the browser), but the faller hung in mid-air while he was away. `stepQuests` now runs in space too (`InvWorld.jsx:464`): the faller falls and is missed, nobody calls, and whoever he carries stays carried. In space the goal chip shows no city distance.
- Eve already resumed when he left. Now she also gives up on a hero who parks by her (`npcs.js:38`, `EVE`): she stops within 55 m and waits while he's within 75 m, 45 s with him or 6 s if he hangs back.
- The camera ended up inside Mark beside a tower (`eve`, `rescue`, and with his back to a wall). `placeCamera` (`scene.js:335`) swings round him or up off the wall, and the near plane is capped at 0.3 × its distance to him. New shot: `wallback`.
- The wind played on while the tab was hidden or the world scrolled away. It fades out now (`sounds.js` `hush`, `InvWorld.jsx:357`).
- Input: a blur, a hidden tab or the world going out of view clears the keys, the stick, the touch buttons and drags (`release`, `InvWorld.jsx:300`). The stick follows one finger, so a second finger lifting off no longer zeroes it.
- DPR: a `matchMedia(resolution)` listener refits the canvas and the HUD when only the density changes. The compass and the map are sized to their CSS box × DPR, so they're sharp on 2× screens; the minimap stays round.
- The HUD's Height in space is over the nearest of the Earth, the Moon and Mars (`InvWorld.jsx:573`). On the Moon it reads 0 m, not 81 km.
- The re-entry plasma was a cream egg with a hard top edge: the sheath's fill over the bright Earth tipped the bloom's near-hard threshold. The sheath now glows at its outline and leading cap (`fx.js:186`), and Mark shows through it.
- Found while fixing: a time change in space moved the planets' sun but not the light on Mark (`scene.js` `putUpTime`).
- Found in review: a soft landing in the city unlocked Mars, since every `land` event was taken as the Moon's or Mars'. Now only a `land` with a `body` counts (`InvWorld.jsx:553`).
- The HUD overlap, as a stopgap. The compass sits under the buttons, however many rows they wrap to (`--iw-under`, `world.css:72`). Its type is in CSS px, 10.5 px on phones (it was about 5). Labels never overlap each other or N, E, S and W. Task 3's `layoutCompass` replaces all this.
- The script: shots default to noon; a jump between shots clears `sim.quests.prev`; a city shot after a space shot now comes down through the top of the sky first. Before, `dusk` and `night` in a full run were black frames of space, 200 m over the Earth's sphere.

Left for a later task:

- Mark is hard to see at night (`streetnight` mark 0.015, `orbitnight`) and about 25 px tall at speed (`boost`). Task 2.
- Noon is flat: black tower windows, and one grey for the streets and walls. Task 2.
- The far hills bleach white at noon, since the fog tint is fixed (`scene.js:44`), and the HDRI's own clouds show as dark banks at 7.6 km. Task 2, fog from the sky.
- From high up, the outer city is speckle on the low tier. Task 2, the street widths at distance.
- The river ends where the mountains rise at the world's north edge (`ground.js` `landAt`); the old slot hid it. Task 2, with the river's edge.
- In the city the HUD's Height counts from the river bed (`InvWorld.jsx:573`; `groundAt` is −8 there). `river` reads 33 m at y 25, which is 27.5 m over the water. It wants `Math.max(groundAt, WATER_Y)`, as `:56` has. Task 3.
- Compass labels butt up against the cardinals (“Burger MartW”, “GDAN”), a label can sit up to 48 px off its dot (`porch`'s Graysons'), and a mark whose label won't fit is a bare dot (`rings`, `photo`). Task 3, `layoutCompass`'s second row.
- The site's “Achievement unlocked” toast covers the HUD's bottom centre (`boost`). Task 3.
- Bolts hit a point. They no longer tunnel through a hovering hero, but one meeting a hero flat out head-on can still pass through. Done in Task 7, `foes.js`.
- The Flaxan portal's swirl has a horizontal seam across its left half (`flaxans.js`, the `fight` shot). Done in Task 7, `villains.js`.
- The `fight` shot shows the portal and “12 left” but no Flaxans: with `dt` clamped, `sim.speedup` no longer fast-forwards them. Done in Task 7: the shot waits on `sim.foes`.
- The person he carries isn't drawn in space, because the whole challenges group is hidden there. Task 9, `challenges.js`.
- Dad's “lesson lost” comes on Mark's first step back in the city, not as he leaves. Task 6.
- `eve`: Mark is whole now, but Eve is behind a tower and only her balloon shows. Task 6, with its `eve` shot.
- The script waits on the wall clock, and headless Chromium draws about a frame a second, so the minimap can be the previous shot's (`suburb` shows `curb`'s, `seismic` shows `chase`'s). `sim.snap` is never cleared, so his clips jump a second a frame and the poses are arbitrary (`scene.js:495`). Task 9, which drives the shots through the dev hook and waits on state.
- `moon` and `mars` look straight down at the surface from 70 and 90 m, and the side step lands him on the Moon, so they come out a flat grey and a flat brown. Task 11, with its shots.

Checked and already right, so nothing to reproduce: Eve resuming once he's gone, the cards and Try again after a lost WebGL context, keys cleared on blur, the stick cleared on a cancelled touch, and the rescue beacon.

Not the world's: the small grey and orange pill at the bottom left of every shot is a site-wide widget, and it shows on the error page too.

#### The stubs

Eight new shots frame where Task 9's missions will be. Nothing is started yet. Numbers are from this task's tree, at noon.

| Shot | What it frames | band | mark |
|---|---|---|---|
| `bank` | The hall's east colonnade, the plaza's east strip and the crossing | 0.307 | 0.002 |
| `chase` | West along the downtown street at z −120, 30 m up | 0.142 | 0.004 |
| `seismic` | The school's front and quad from 20 m up | 0.410 | 0.079 |
| `maulers` | Street level on x 40: the hall on the left, the east block on the right | 0.312 | 0.032 |
| `eveescort` | Eve flying off his left among the towers | 0.184 | 0.065 |
| `dadlesson` | Behind ring 0, lit, looking along the course toward downtown | 0.453 | 0.005 |
| `gdasiege` | From 90 m over the east bank: the GDA's hangar and office, small, under the card's light shaft | 0.393 | 0.026 |
| `photo` | The hall's front from the plaza's south-east corner | 0.475 | 0.135 |

`chase` is dark even at noon: it's a street between glass towers. Place shots now take `pitch`. Follow shots take `side` (how far he sits to the right of the target) and `turn` (added to the target's heading; 0.5 by default).

### Task 2: seeing Mark and the city (2026-10-07)

- `people.js` `castMaterial(root, { rim, floor })` gives every figure one finish: matte (roughness 0.78, no metal, env 0.2), the colour map's saturation lifted 10 %, and a cool Fresnel rim on a shared uniform (`setCastRim`, set by the scene's time of day: 0.35 noon, 0.7 dusk, 1.2 night). It chains onto any `onBeforeCompile` already on a material and keys its program cache. Mark's near-black texels are raised to a navy floor (`SUIT.floor` 0x2a3754), so his arms and legs stay on a dark street or at night.
- A spotlight follows him from over the camera's shoulder (no shadow; 0 at noon, 20 at dusk, 45 at night). The camera hovering or standing sits 3.6 m back (it was 5.2 standing and 6.5 hovering), his feet about a third of the way up the frame; at speed the pull-back is as it was.
- `LOOK.noon`: sun 4.2, fill 0.3, env 1.15. The fog's colour comes from the sky photo's horizon (`sky.js` `skyBands`, once per photo), which fixed the bleached hills: the house look had been fogging everything to a fixed cream.
- Noon windows are a lighter, sky-reflecting pane above the lowest two storeys; dusk and night window light is up 20 %. Street lines widen with distance up to 2× so the grid reads from height; the river and the coast have a bright edge; the five places have a faint beacon by day, bright by night.

Metrics (`--metrics`; targets: band 0.30–0.65 noon, 0.12–0.35 night; mark ≥ 0.18):

| Shot | Band before | Band after | Mark before | Mark after |
|---|---|---|---|---|
| spawn | 0.498 | 0.618 | 0.167 | 0.199 |
| street | 0.365 | 0.491 | 0.047 | 0.161 |
| streetnight | 0.172 | 0.210 | 0.015 | 0.203 |
| downtown | 0.316 | 0.521 | 0.044 | 0.025 |
| high | 0.442 | 0.488 | 0.041 | 0.020 |
| porch | 0.506 | 0.623 | 0.126 | 0.189 |

Every band is in range, and Mark passes in spawn, streetnight and porch. He misses in street, downtown and high, where he hangs over towers and grid whose mean grey is close to his: the measure compares mean luminance only, and a yellow and blue figure on grey-blue towers averages out the same while reading plainly to the eye (he is about a third of the frame tall and clearly picked out in each of those shots). Not forced further: the suit would have to go pale. A colour-difference measure would judge these better.
- Low tier, triangles: plaza 1.47 M, boost 1.33 M, dusk and night 1.33 M; within the 1.5 M budget.

### Task 3: the HUD (2026-10-07)

- `hud.js` (tested) decides where things go: `layoutCompass` (names at least 72 px apart, a second row under the dots for those that would touch, half a gap clear of the headings, none where the buttons overlap the strip's right end, off-strip marks clipped to a side), `titleMode` (the title becomes a chip 2.5 s after he first moves, or at once when there's an objective), `objectiveText` (metres under 1 km, then kilometres) and `markerSize` (for Task 9's 3D marker; never under 24 px).
- `InvHud.jsx` holds the HUD's markup, out of `InvWorld.jsx`; the frame loop still writes into its elements directly through `hud`.
- The four top buttons are now a time chip (the one place the time of day is read) and one Menu (time of day, controls, other players, Think, Mark!), which closes on a click elsewhere or Escape.
- The objective line sits under the compass, centred. The gauge shows the zone (City under 300 m, Sky above, Space). The map is 200 px on desktop and 140 px on phones, where it sits under the objective line.
- `--iw-under` (the bottom of the buttons, however they wrap) is now set on the stage, so the compass, the objective line and the phone's map all follow it.
- Not done here: the 3D chevron over a target and the route on the map, which wait on missions (Task 9).

### Task 5: the crowd's brains (2026-10-07)

- `brains.js` (tested) gives each townsperson a brain. The states are idle, chat, wander, look, wave, gather, flee and cheer.
  - wander: a few steps; a passer-by keeps to their pavement, within 20 m of home.
  - look: when Mark is within 30 m.
  - wave: when he hangs within 15 m (not again for 20 s).
  - gather: when he lands within 25 m. They walk to 6 m from him, face him with phones up, and leave after 12 s or when he takes off.
  - flee: from a slam, an impact, a low boom or a knock-out within 40 m. They run at 4 m/s for 6 s and stay frightened for 20 s, so they don't come and gawp.
  - cheer: 4 s, when a fight within 80 m is won.
  - Each step is at most 0.05 s, so a hidden tab is one short step.
- `npcs.js` steps a brain for each person at Burger Mart, the school steps and the plaza (three groups), moves and turns them from it, and poses them from `poseOf` (their motion-captured clips). The manager keeps his arms folded when idle. Debbie and Cecil keep their own ways.
- Who is out goes by the time of day (`crowdCount`): all at noon, 70 % at dusk, 35 % at night, and nobody on the school steps at night.
- `scene.js` passes the crowd what happened in the frame (slam, knock-out, won, the time). Cars within 60 m of a fight's knock-outs and hits back away at 4 m/s for 3 s (`traffic.js`'s `reverse` scare, tested).
- New shots: `plazanight`, `burgernight`, `schoolnight`.

### Task 6: Eve and Dad (2026-10-07)

- `companions.js` (tested) holds their rules. Each step is at most 0.05 s.
  - Eve patrols her loop round downtown, over the towers on it (20 m above the highest roof within 30 m, a little before she gets there; she never flies into one).
  - When Mark hangs still within 300 m of her for 4 s, she comes over to 6 m from him with a line. She waits 45 s at most, then flies on, and won't come again until he's been off past 300 m.
  - When he flies off from beside her, she holds 8 m off his left for 40 s, then goes back to her loop.
  - A foe still standing within 400 m: she goes for it and knocks one out every 8 s (`fight.js` takes her `eveHit` and knocks that foe out, `by: 'eve'`).
  - E beside her: she stops, says a line and waits 5 s.
  - Dad watches over downtown by day. At the rings he follows 50 m behind and 20 m above Mark, with a word at each of the first three rings (the first too, though the lesson starts once Mark is through it), and a hurry-up every 30 s past 90 s. At dusk and night he stands on the porch beside Debbie. In the last episode (`mission: 'ep7'`, Task 9) he leads the spar through his points, waiting at each until Mark is within 20 m.
- `npcs.js` steps Eve from these rules; `scene.js` steps Dad and passes both the live foes, the lesson, the time and an E press for Eve. What they say and do goes in `sim.companion`; `InvWorld.jsx` speaks the lines (in their voices where a recording exists) and gives Eve's blow to the next fight step.
- `api.debug.dad(p, dir)` reads Dad's rules, or puts him at `p`. New shot: `porchdusk`; `dadlesson` now starts the lesson and frames Dad behind Mark; `eveescort` frames Eve off his left.

### Task 7: the villains (2026-10-07)

- `fight.js` and `flaxans.js` are gone. `foes.js` (tested, 26 cases, the Flaxan tests moved as they were) holds every villain's rules, and `villains.js` draws them. The state is `newFoes(seed)`; `spawnFoes(state, kind, n, at)` adds some; `startInvasion` is the Flaxans' dozen through the portal as before; `stepFoes(state, hero, { punch, look, eveHit }, dt, { cars })` has `stepFight`'s shape (`push`, `stun`, and the events), so `InvWorld.jsx`'s handling of a knock and a stun is unchanged. `portalOpen`, `foeAt`, `standing` and `anyOf` read it.
  - `flaxan` as before; `flaxanElite` takes two blows and fires three bolts at once, fanned, for 16.
  - `mauler` (2.6 m, on the ground): runs at Mark at 8 m/s when he is on the ground or under 6 m up and stops 2 m short; within 3 m a swing every 1.4 s, a 0.4 s wind-up, 18 and a knock of 10 m; with Mark 6 m up and out of reach within 60 m, a car from the traffic within 30 m (held 0.6 s over his head, thrown at 35 m/s, 22 on a hit) or one off the street when none is near; a punch sends a car back, and a Mauler in its way takes the blow. Three blows knock one out, with a 0.8 s stagger at each before; a ram over 45 m/s too.
  - `seismic` (Doc Seismic): drifts round a 30 m circle 20 m over his `at`, quakes every 6 s (a ring out along the ground at 30 m/s to 160 m, a `floored` knock-down for a hero standing on it, and a `shake` the camera takes by distance), blasts within 40 m for 14 and a knock of 15 m. Five blows; a ram or Eve only hits him.
  - A blow's knock is sized from `flight.js`'s stop rate (`knock(m)`), so “10 m” is 10 m.
  - Bolts now test their path each step, so one meeting him head-on flat out can't pass through.
  - `clear` ends any fight; `won` still follows it for the Flaxans (their achievement and line).
- `villains.js`: the portal (a new whirl shader, no seam), the Flaxans on the kit as before, the Maulers and Doc Seismic as the cast's figures on their own clips (`charge`, `swing`, `throw`, `hit`, `down`; `quake`, `blast`, `hover`), the thrown cars on `life.js`'s car geometry tumbling with a dust trail, and the quake rings along the ground with a skirt of dust. Flaxans vanish once down; the Maulers and Doc Seismic lie there till it's over. A cast model that didn't load gives a kit figure of its colour.
- `scene.js` makes it with the `mauler` and `seismic` templates, passes the foes' events to it and to the camera (a knock-out's trauma by their size, a quake's by distance), gives Eve and the crowd whoever is still standing, and while a Mauler is about writes `sim.cars` (where the traffic's cars are) for him to take one: `traffic.js`'s `takeCar` (tested) puts a taken car back on the grid out of sight.
- `InvWorld.jsx` steps `stepFoes` as it did `stepFight`; the objective line names who is about (“Flaxans over the river · 12 left”, “The Mauler twins · 2 standing”, “Doc Seismic over the school”) and the compass marks the portal while it is open and each Mauler and Doc Seismic. Sounds: a thud for a hit and a car sent back, a crumble for a car landing, a boom for a quake, the laser for a blast.
- Shots: `fight` now waits on the state (four Flaxans through and two within 45 m of him), not on the clock, and shows them; `maulers` spawns the twins on the street past the bank, 14 m ahead; `seismic` spawns Doc Seismic over the school and frames him from 16 m. Shots take `foes: [kind, n, at]` (`at: 'place'` is the shot's place) and `at: 'foe'`. The dev hook has `api.spawn(kind, n, at)` and `api.debug.villains`.
- Triangles on the low tier: fight 1.00 M, maulers 1.79 M, seismic 1.45 M. `maulers` is over the 1.5 M budget: that street already drew 1.76 M in the stub (the hall and the east block with the traffic); the two figures add about 30 k. Left for Task 11's pass over the budget.
- Not in this task: missions start them (Task 9); for now only the Flaxans come on their own, and the dev hook spawns the rest.

### Task 8: the missions' rules (2026-10-07)

- `missions.js` (tested, 18 cases) is the season and the radio as rules only. `MISSIONS` has the seven episodes (`ep1`…`ep7`, in the spec's order, with their givers, start points, lines, steps and achievements) and the side calls (`side: true`): `chase`, `everace` and `photo1`…`photo5`. `STORY` is the episodes' ids; `missionOf(id)`, `nextStory(doneIds)`, `placeOf(id)`, `PHOTO_SPOTS`.
- `startMission(id, now)` gives progress `{ id, step, count, t, stepT, hp, best, seen, away, done, fail }`; `stepOf(progress)` says what the step under way needs set up (`spawn`, `car`, `wave`, its text), and `feedMission(progress, event)` takes one event and gives `{ progress, out }`: `step` (the next one begun, with the same), `count`, `hp`, `done` (with the time and the achievement) or `fail` (why: `time`, `late`, `lost`, `left`, `abandoned`). Events: `at` each frame (his `p`, `mode`, `speed`, `face`, and `npcs` and `car` positions for the steps that want them), `tick`, `talk`, `caught`, `ko`, `ring`, `hurt`, `use`, `land` (with `body` for the Moon), `abandon`. A `tick` is at most 0.05 s.
- Steps: `reach` (`y: null` is any height), `land` and `slam` (`at` a point, `{ car: true }` or `{ npc }`), `talk`, `catch`, `defeat` (`kind` one or a list, `n`), `race` (`gates` in order; `ring: true` takes `./quests.js`'s ring events for Dad's course, otherwise flying within `r`), `escort` (`npc`, `to`, `r`; failing after `grace` seconds more than `within` from them), `protect` (`what`, `hp`, `time`), `through` (`at`, `r`, `speed`), `use` (`id`; a photo also wants him within `r` of `at`, facing within `within` of `face`).
- `markerOf(progress, scene)` is the step's marker: a point, the next gate, or what the scene says is there (`npcs[id]`, `car`, `foes[0]`, `faller`, `bodies.moon`); the last seen is kept in progress when the scene has none.
- `loadStory(saved)` takes anything and keeps real episodes and times; `keepStory(story, id, time)` adds one done.
- Places the map doesn't name: the bank at `[65, 0, 0]`, where the tower east of the plaza across the street stands (its door at `[50, 0, 0]` on the pavement, facing the hall; Task 9 puts the bank model there and takes the tower out), the hangar's door, the school's roof, Dad's four points for the talk (over downtown, the river, the school, then home), the three gates home from the Moon (space's frame), Eve's eight gates (each over a downtown crossing) and the five photo spots. The test checks every marker, gate and spawn point in the city is on open ground or in the air.
- Not here: starting them in the world, the cards, the markers drawn, the getaway truck, the waves (Task 9); the radio's timing (Task 10).

### Task 9: missions in the world (2026-10-07)

- The season runs in the world. `InvWorld.jsx` holds the mission under way (`sim.mission`, `./missions.js`'s progress), feeds it what happens (`at` each frame, `tick`, Dad's `ring`s, a rescue's `caught`, a `ko`, a `land` or `slam`, `talk` beside Dad, Allen or Eve, the hangar's `hurt`, Think, Mark!'s `use`) and acts on what comes out: a step's `spawn` (through `spawnFoes`), its `car` (`./getaway.js`), its `wave` (more every so often), `count`, `hp`, `done` (the achievement, the story kept in `tp-inv-world-story`, the end card) and `fail` (why, with Again).
- Starting one: E at the GDA opens Cecil's board (`MissionCard.jsx`, `kind: 'board'`): the episodes in order, done ones with their best time and Again, the next with Go, the rest locked. E beside Dad starts the first episode (if it's next) or the last (if it's next, at dusk or night, when he's on the porch); otherwise E beside him is the spar as before. Q asks before abandoning (Q again or the button); Escape closes any card. The title card is 2.5 s in the episode's colour with the camera's one swing round him (none under reduced motion).
- Markers: `markerOf` each HUD tick, drawn as a 3D chevron over the target (`scene.js` `createMarker`, sized by `hud.js`'s `markerSize`, through anything in front), as a triangle on the compass and a dot on the map in the mission's colour; the objective line is the step's words, the distance, the count, the hangar's health and the clock, in the mission's colour.
- `getaway.js` (tested, 3 cases): a car on the street grid, turning one in three at crossings or when the city ends, stopped where it is; episode 2's truck pulls out from the bank's door, the radio's chase from wherever he is. `scene.js` draws it as `CAST.truck` (a van from `life.js` if the model won't load), and the bank as `CAST.bank` on its block east of the plaza (`map.js` `blockKind` 'bank', landmark `bank` at `[68, 0, 0]`, 24 m square; the tower there is gone). A Mauler's swing within 32 m of the hangar takes 10 off it in episode 6. Doc Seismic's quakes in episode 3 put a student at the school roof's south edge (a `fall` rescue in `quests.js`, waving 7 s then over), one at a time, four in all.
- Think, Mark!'s result comes back through a ref the page shares (`pages/Invincible.jsx`: `thinkMark`), as `use thinkmark`, won or lost; the last episode ends on it.
- Achievements added: `maulers`, `seismic`, `gda`, `season`.
- Dev hook: `api.mission(id)` starts one, `api.feed(event)` gives it an event, `api.story()` reads what's kept. Shots `bank chase seismic maulers gdasiege` start their mission, drive it to the step they frame (`drive`), hold the clock for the shot, then drive it to the end (`finish`) and print `done in … s`.
- Not here: the radio's timing (`chase`, `everace`, the photos start only through the hook), Eve's ghost in her race, Allen racing home (Task 10); the sounds and the docs' shots (Task 11). Known: the Flaxans' portal closes as the last of the second wave goes down, before episode 5's last step (fly through where it was); the bank model's own lettering reads GDA.

## How to check

- `npx vitest run src/components/invincible/world`: map, flight, orbit, quests, traffic, hud, brains, companions and foes (51 tests at the space merge, 89 after Task 1, 168 after Task 7, 186 after Task 8, 189 after Task 9).
- With the dev server running, `OUT=/tmp/shots node scripts/inv-world-check.mjs [--metrics] [shot …]`.
  - Shots, in the order they run: `spawn street curb streetnight downtown high suburb river boost porch gda burger school plaza eve jet clouds rings card wallback rescue fight climb orbit orbitnight moon reentry allen mars thragg dusk night`.
  - The missions, started and driven to their end through the hook (Task 9): `bank chase seismic maulers gdasiege`; the stubs that only frame a place: `eveescort dadlesson porchdusk photo`.
  - A shot is at noon unless it names a time.
  - `--metrics` prints `name band=… mark=…` after each shot (see Task 1 above for how it measures). `BOX=1` with it also writes `inv-<name>.box.png`, the band, box and ring drawn on.
  - Each shot is roughly 10 s in SwiftShader at 960×540, low tier.
- Dev hook: `window.__INVWORLD__ = { api, sim }`.
  - `api.setTime(name)` sets the HUD's one clock and resolves once the scene has the time.
  - `sim.h` is the hero; `sim.yaw` and `sim.pitch` are the camera.
  - `sim.snap` puts the camera and the pose where they're going.
  - `sim.hold` freezes Eve and the jet.
  - `api.zone` and `api.setZone` read and set the zone; `api.debug` holds `npcs`, `jet`, `villains`, `world`, `bodies`, `allen`, `thragg` and `dad`.
  - `api.spawn(kind, n, at)` calls villains; `api.mission(id)`, `api.feed(event)` and `api.story()` run the missions.

## Not done / next ideas

1. **Combat.** Done after this handoff was first written: `fight.js` (tested) and `flaxans.js`. The Flaxans come through a portal over the river, started by Cecil (E at the GDA) or on their own four minutes in. Punch with J, F, a click or pad X (a lunge carries him to one a little way off), or ram one at speed. Their bolts knock him about. Next could be bosses in the open world (Omni-Man sparring, Thragg in space), which *Think, Mark!* has rules for.
2. **Phones.** The low tier draws about 1.2–1.4M triangles in town, the 'small' counts already applied. Phone frame rate hasn't been measured on hardware. Levers, if it's slow:
   - fewer suburb trees and houses drawn far off (a distance cull on the instanced meshes);
   - the land disc's ring step;
   - traffic counts (`scene.js`, `createTraffic`).
3. **Interiors.** No interiors yet. The Graysons' house, the GDA's operations floor and Burger Mart's counter would follow the C-137 and Office patterns.
4. **Online ghosts.** These aren't wired up. `middleearth/towns/useTravellers` in a room of its own, as Avengers HQ does it, would show other players flying about.
5. **Polish seen in QA and left as is:**
   - house and yard trees are low-poly blobs;
   - the HDRI's own clouds still show faintly in the darkening sky above about 7 km;
   - the jet's livery hasn't been seen up close.

## Where things are

Everything is in `src/components/invincible/world/`. The page mounts it in `src/pages/Invincible.jsx`. The achievements are in `src/components/Achievements.jsx`: `soundbarrier`, `dadsrings`, `titlecards`, `rescue`, `mimic`, `karman`, `moonwalk`, `redplanet`. The guide entries are in `src/components/Guide.jsx` under `/invincible`.
