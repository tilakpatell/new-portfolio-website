# Super Mario 64, a fan tribute on Dot Matrix island

A Super Mario 64–style game to play as Mario: Peach's castle is the hub, its paintings are the way into five worlds, and fifteen Power Stars open the castle's doors on the way to Bowser. It is built for this site from scratch in Three.js on the world runtime. No ROM, no emulator, no ripped models, music or sounds.

## What the owner asked for (agreed in brainstorming)

- An N64 Mario game in the game world (Dot Matrix, the Gaming planet), played as Mario, level by level: "the one with Peach's castle, where you go in the portal and there are worlds".
- Mario by name, as a fan tribute, on the same footing as the site's other tribute worlds. The README's disclaimer adds Super Mario and Nintendo.
- A hub and five courses, three stars each.
- Three looks: **Modern** (the default), **Ultra** and **N64** (a retro filter over the same modern assets). The textures must be modern and very good.
- Models from Sketchfab first (downloadable, CC BY or CC0, fan-made, never rips), then other online CC0 sources (Poly Haven, ambientCG, Quaternius, Kenney), then the Meshy community, and Meshy.ai generation only as a last resort (it spends credits).
- Reached two ways: a giant N64 on the island (walk up, press B, the game opens full-screen over the island), and its own page, `#/dot-matrix/64`.
- Shipped in slices: each one is merged with main, goes up as a pull request and is merged to main once CI is green.

## Architecture

A world module on `src/runtime` (`{ id: 'mario64', shading: 'glsl', create(rt, props) }`), in `src/components/mario64/`:

```
rules/            pure JS, no three.js, tested with vitest
  vec.js          vec3 and angle helpers
  collide.js      triangles → floors, walls and ceilings by their normal; a grid; dynamic colliders; water and lava; raycasts
  mario.js        Mario: the action state machine and its physics, health, coins and lives
  camera.js       the Lakitu camera: orbit, 45° steps, zoom, follow, pushed in by walls
  actors.js       every foe and object, each { make, step, touch }
  game.js         the sim: areas, Mario, actors, stars, doors, paintings, deaths; events out
courses/
  shapes.js       box, ramp, cylinder, cone, heightfield, strip, ring → triangles with a material key
  castle.js       the hub: the grounds and the castle inside
  bobomb.js  snow.js  beach.js  haunt.js  bowser.js
  index.js
scene.js          shapes → meshes with PBR materials; sky, water, lava, fog, shadows
models.js         Mario and the cast: a loaded model when there is one, a stand-in made in code always
pose.js           procedural animation: bone rotations keyed over time, one clip per action
looks.js          Modern, Ultra and N64: the post chain for each
textures.js       the material table: each key's texture set, repeat and tint
sounds.js         synthesised effects and original music per course
module.js         the world module
Mario64.jsx       HUD, title, pause, star select, dialogs, touch controls
mario64.css
pages/Mario64.jsx the route #/dot-matrix/64
```

**Data flow.** A course file is the one source for both what you stand on (`collide.js` gets its triangles) and what you see (`scene.js` gets the same shapes as meshes), so they cannot disagree. Props from Sketchfab are dressing: they collide through simple shapes the course gives them, never through their own meshes. The rules run at a fixed 30 Hz like the original, in SM64's units (Mario is 160 tall); the drawing is in metres (units ÷ 100) and interpolates between steps, so it is smooth at 60 Hz and above. `game.js` tells `Mario64.jsx` what happened through `rt.events` (`hud`, `dialog`, `card`, `starGet`, `pause`, `title`, `over`, `finale`). The save is `tp-m64`, version 1, through `rt.saves`: the stars per course, the look, the sound.

## Mario

The rules use SM64's per-frame numbers at 30 Hz: gravity −4 a frame (terminal −75), a top run of 32, and a jump of 42 + speed ÷ 4.

- **On the ground:**
  - Analog walking and running, with a skid when turning hard.
  - Crouch and crawl.
  - Punch, punch, kick.
  - Slides on steep or slippery floors, and the butt slide.
  - The belly slide after a dive.
- **Jumps:**
  - Single, double (A within 5 frames of landing while moving), triple (the third, at speed over 20).
  - Backflip (crouch + A), side flip (reverse + A), long jump (run + Z + A).
  - Wall kick: A within 5 frames of hitting a wall.
- **In the air:** ground pound (Z) and dive (B). Ledge grab and climb. Fall damage from over 1150 (3 wedges). Knockback when hurt.
- **In water:** treading on the surface. Strokes on A, pitch with the stick. Air that runs out, which costs health under water.
- **Carrying:** B picks up a Bob-omb, a baby penguin, or King Bob-omb from behind. Bowser by the tail: hold B, spin with the stick, let go to throw.
- **Health:** an 8-wedge power meter, healed by coins. Lava burns 3 wedges and throws you up. Lives and 1-Ups.

**Collision**, as in SM64:
- A triangle is a floor (normal y > 0.01), a ceiling (< −0.01) or a wall.
- The floor is the highest one at most 78 above Mario, so he steps up small ledges. A drop with no floor is a wall.
- Walls push him out along their normal, checked at two heights. Each step is four quarter steps, so nothing tunnels.
- Moving platforms are dynamic colliders, carrying what stands on them.
- Each floor has a class: default, slippery or rough. The class decides when Mario slides.

**Controls:**

| | Keyboard | Gamepad | Touch |
|---|---|---|---|
| move | WASD or arrows (C walks) | left stick | the left stick |
| A: jump | Space or K | A | A |
| B: attack, grab, dive | J or F | B or X | B |
| Z: crouch, pound | Shift or L | LT or RB | Z |
| camera | Q and E turn, mouse drag, wheel zooms | right stick, LB zooms | drag on the right half, ⟲ ⟳ |
| pause | Esc or P | Start | ❚❚ |

## The castle and the courses

There are 15 stars. Course names are the site's own, in the spirit of the original. A star card opens each course. A star ends the visit, "Star get!", and Mario is back in the castle in front of the painting.

**The hub: Peach's castle.**
- The grounds: a lawn, the moat, a drawbridge, trees, a waterfall.
- Inside: a marble foyer with the red carpet and the stairs, and the painting rooms behind star doors:

| Painting | Course | Stars to open |
|---|---|---|
| 1 | Bob-omb Ridge | open |
| 2 | Frosty Peak | 1 |
| 3 | Koopa Cove | 3 |
| 4 | Boo's Manor | 5 |
| 5 | Bowser's Lava Road | 8 (the big star door) |

Signs and Toad give hints.

**1. Bob-omb Ridge.** A grassy spiral mountain. Iron balls roll down the path, Bob-ombs walk, and a Chain Chomp is on its post.
- ★ King Bob-omb on the summit: grab him from behind, throw him three times.
- ★ Eight red coins.
- ★ Free the Chain Chomp: pound its post three times and it smashes the gate.

**2. Frosty Peak.** A snow mountain with a cabin on the summit and an ice chute.
- ★ Race the big penguin down the slide.
- ★ Carry the lost baby penguin to its mother.
- ★ The red coins on the frozen pond's ice floes.

**3. Koopa Cove.** A beach, palms, the cove, a sunken ship and a cave under the sea.
- ★ Open the ship's four chests in the right order. A wrong one shocks Mario and shuts them all.
- ★ Race Koopa the Quick round the island.
- ★ Swim through the coral cave's five rings.

**4. Boo's Manor.** A foggy graveyard and a mansion: the hall, the library, the balcony, the attic.
- ★ Boos hide their faces when Mario looks at them; hit them from behind. Five gone, and Big Boo comes for three hits.
- ★ The red coins through the rooms.
- ★ Wall-kick up the outside wall to the balcony.

**5. Bowser's Lava Road.** Platforms over a lava sea: rotating bridges, seesaws, flamethrowers, Thwomps, lifts and firebars.
- ★ The red coins along the road.
- ★ The Thwomps' gauntlet, a path to one side.
- ★ The pipe down to Bowser's arena. Grab his tail, spin him, throw him into the bombs round the edge three times. He breathes fire and stomps to tilt the floor. The last star, a thank-you ending and an achievement.

**Throughout:** coins (every 8 heal a wedge, 50 give a life), 1-Up mushrooms, deaths and lives. Game over goes back to the title.

## The looks

All three use the same models and textures.

- **Modern**, the default:
  - `MeshStandardMaterial` throughout, with scanned PBR texture sets (colour, normal, AO / roughness / metal).
  - Each course lit by its HDRI and a real sun, with soft shadow maps that follow Mario.
  - ACES tone mapping, a light bloom, fog matched to the sky.
  - Water with moving normals and a Fresnel edge. Glowing lava with a heat shimmer.
  - Terrain blends grass, rock and path by slope and painted masks, with triplanar rock on cliffs.
- **Ultra:** Modern, plus ground-truth ambient occlusion, depth of field on menus and the star get, sharper shadows, the 2K textures and planar reflections on water. Offered on high-tier devices.
- **N64:** the Modern picture drawn at 320 × 240, in 15-bit colour with an ordered dither, a soft upscale and heavier fog.

On slow devices the quality level (`runtime/quality.js`) lowers resolution, then shadows, then effects, on its own. Phones use the 512-pixel texture sets.

A blob shadow straight under Mario and each foe is kept in every look: it is how you judge a jump.

## Assets

- **Textures and skies.** From Poly Haven and ambientCG (CC0), through the `hq-assets.mjs` pipeline into `public/hq/tex/` and `public/hq/sky/`:
  - Already there: grass, rock, brick, planks, bark, thatch and the rest.
  - New: snow, ice, beach sand, castle stone, roof tiles, marble, carpet, wallpaper, old floorboards, lava, cobblestone, volcanic rock, and a water normal.
- **Models.** Scouted on Sketchfab with the existing scripts: Mario, Goomba, Bob-omb, King Bob-omb, Koopa, Boo, Bowser, Chain Chomp, Thwomp, Piranha Plant, penguins, Toad, the star, the coin and props.
  - Only downloadable models under CC BY or CC0, made by their uploaders. A model that says it was ripped or extracted from a game is skipped.
  - Then Quaternius, Kenney and Poly Haven for trees, rocks, fences, the ship, furniture and graves. Then the Meshy community. Then Meshy.ai, with the credits it spent written down.
  - Each one is simplified and meshopt-compressed with WebP textures into `public/m64/`, by `scripts/m64-assets.mjs` from `scripts/data/m64-assets.json`. The output is committed: the site never calls these services.
  - Every model is credited in `src/data/modelCredits.json`, so the credits page lists it.
  - About 25–40 MB in all, each course's models loaded when it is entered.
- **Stand-ins.** Every character has one made in code, so the game plays before and without any download, and a failed load never stops it.
- **Animation.** Mario gets a humanoid skeleton: the model's own when it has one, otherwise a skeleton worked out from its shape, as Cybertron's `autorig.js` does. Each action has a procedural pose clip in `pose.js`: bone rotations keyed over the action's time and blended between actions. The original's moves (the triple jump's flip, the long jump, the pound, swimming, the tail spin) need their own poses anyway.
- **Audio.** Original music for each course on a Web Audio synth sequencer (pads, bass, mallets, drums). Synthesised effects for the jump, coin, star, stomp, pound, splash, hurt, 1-Up, painting and Bowser's roar. All of it on the runtime's audio bus.

## UI, entry and saves

- **Title.** "Super Mario 64", a fan tribute, over the castle grounds with the camera circling. Press Start. Options for the look and the sound, and erasing the save.
- **HUD:**
  - The power meter's pie (shown when it isn't full).
  - Mario's lives, the coins, the stars, the red coins in a course, the air under water.
  - The course card with the star's name. "Star get!".
  - Dialog boxes, advanced with A.
- **Pause:**
  - Continue. Exit the course.
  - The look (Modern, Ultra, N64). The sound. The controls.
- **Touch:** a stick, A, B and Z, turning the camera, and pause. A drag on the right half turns the camera.
- **The island:**
  - A giant N64 with a cartridge in it stands near the Game Boy in the square.
  - `nearAction` gets the kind `'n64'`, with the prompt "Play the N64".
  - B opens the game full-screen over the island, and the island stops drawing while it is open. "Back to the island" and Esc from the title close it.
  - A villager's line and a sign point to it.
- **The route.**
  - `#/dot-matrix/64` mounts the same component, full-bleed.
  - Without 3D it says what the game is and how to turn 3D on.
  - It is in the universe's Dot Matrix pages, so it gets a prerendered page and a sitemap entry.
  - The command palette has an entry for it.
- **Saves:** `tp-m64` v1: `{ stars: { bobomb: [bool×3], … }, look, sound }`. An achievement, *Superstar*, for all fifteen stars.

## Testing

- **Unit tests (vitest):**
  - `collide`: floors, walls, ceilings, steps, corners, dynamic platforms, raycasts.
  - `mario`: each move's heights and speeds, the jump chain, wall-kick timing, pound, fall damage, swimming and air, slopes.
  - `camera`: steps, follow, wall push-in.
  - `actors`: stomps, bombs, King Bob-omb's three throws, the Chomp's post, Boos and facing, chests, rings, the races, Bowser's throws.
  - `game`: star flow, star doors, paintings, deaths and game over, saves.
- **Courses:**
  - Every course builds.
  - Every spawn, coin, star and foe stands over a floor and not inside a wall.
  - Each course has eight red coins where a star needs them.
  - Every painting leads to a course with a start.
- **Pilot:** a pilot that steers to waypoints and presses buttons plays each star's route in vitest, so every star is shown to be reachable.
- **Browser check:** `scripts/m64-check.mjs` (Playwright and Chromium) opens the route, starts, enters each course in each look, screenshots, and fails on console errors.
- **Gates:** lint, tests and build pass before every push.

## Slices

1. **The engine and the first world:**
   - Collision, Mario, the camera, the sim.
   - The castle (grounds and inside, five paintings, star doors) and Bob-omb Ridge, complete.
   - Stand-in models. The Modern look with the PBR textures.
   - The HUD and menus, touch, the island's N64, the route, and the docs.
2. **The cast:** the Sketchfab and CC0 models for Mario, the foes and the props, and the animation.
3. **Frosty Peak and Koopa Cove:** snow, slides and races, water, swimming, the ship.
4. **Boo's Manor and Bowser's Lava Road:** Boos, the lava road's machines, Bowser, the ending and the achievement.
5. **The looks and the sound:** Ultra and N64, the music, and a QA pass.

Each slice gets main merged in, then a pull request, then a merge to main once CI is green.

## Out of scope

Caps (wing, metal, vanish), the cannon, Yoshi, multiplayer ghosts, more than five courses, and voice clips.
