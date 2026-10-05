# Invincible: the open world

Date: 2026-10-05. The ask: "really improve and make 3d models and stuff for invincible and make it a 3d world not just a site. Make it a lot better." Merge to main as it's built.

## What it is

`/invincible` opens on a 3D world you fly about as Invincible, like `/avengers`, `/c-137` and `/scranton` open on theirs. The page underneath stays (Think, Mark!, the GDA's files, the lines).

The world is the Graysons' city and what's round it, about 6 km across: a downtown of towers, a river with bridges, the suburbs where the Graysons live, the coast, hills to the north. You start on the Graysons' front lawn. Flying is the point, so it has to feel like the show: hang in the air, cruise, then go flat out and break the sound barrier with a cone of vapour and a boom; come down hard and the ground cracks.

## Decisions (assumptions, open to correction)

- **Models are built in code.** The environment's network policy blocks `api.meshy.ai`, `api.sketchfab.com` and Poly Haven, so nothing new can be generated or downloaded. Mark, Omni-Man and Thragg stay the existing GLBs. Everyone and everything new (Atom Eve, Debbie, Cecil, the townspeople, Flaxans, the Graysons' house, the landmarks, cars) is modelled in code, from the humanoid kit (`avengers/hq/kit/humanoid.js`, a style per figure) and plain geometry.
- **The HQ engine** (`avengers/hq/engine.js`) draws it: tiers, bloom, the CC0 skies, shadows. It is what Think, Mark! already uses, so the skies, the facade shader (`lib/three/facade.js`) and the rig (`lib/three/rig.js`) all carry over.
- **Rules apart from drawing**, as every world here: `map.js` (the layout, colliders, a spatial hash) and `flight.js` (the flying) are pure and tested; `scene.js` draws; `InvWorld.jsx` drives.
- **No online ghosts** in the first pass. (`useTravellers` could be added later the way Avengers does it.)

## Layout (`map.js`)

Metres, y up, ground at 0 in town. The city centre at the origin.

- **Downtown**: a grid of 80 m blocks (20 m streets) within ~900 m of the centre; towers up to ~320 m, heights falling off with distance. A plaza in the middle with the Guardians of the Globe's hall.
- **The river** runs north–south east of downtown (x ≈ 1050–1250), three bridges across it.
- **Midtown / outer city**: lower blocks to ~1.6 km.
- **Suburbs**: west (x < −1700), smaller blocks of houses on lawns, the Graysons' house, the high school, a strip with Burger Mart.
- **The coast**: south (z > 2200) is the sea.
- **Hills**: rise north beyond z < −2300; mountains round the horizon (drawn only).
- **GDA**: an unmarked block with a hangar and a helipad on the east bank.
- Colliders: every building is a box (`x0 x1 z0 z1 y1`), looked up through a grid hash (`near(x, z, r)`), so flight never scans the whole city. `groundAt(x, z)` is the height of the land; `waterAt(x, z)` true over the river and sea.

## Flying (`flight.js`)

State: position, velocity, facing, mode (`ground`, `air`), `speed` tier, timers. Input: a move vector from the camera (x, z), up/down, `boost` held, `jump`.

- **On the ground**: walk 4 m/s, run 9 m/s (Shift); Space takes off (a jump into the air at 12 m/s up, mode `air`).
- **In the air**: no input → hover (velocity eases to 0, no gravity: he flies). Input → accelerates toward the camera-relative direction at cruise speed 40 m/s; Space climbs, C dives.
- **Boost** (Shift in the air): accelerates to 260 m/s over ~3 s along where the camera looks. Crossing 120 m/s fires a `boom` event once (the sound barrier); dropping under 90 m/s resets it.
- **Landing**: coming down onto the ground or a roof: under 18 m/s, a soft landing; over that, a `slam` event with its speed (the scene cracks the ground and kicks up dust, the camera shakes), and a 0.6 s crouch before he moves.
- **Buildings**: he can't pass through. A wall hit under 60 m/s stops him along it (slides along); over that, an `impact` event (debris), he bounces off at a third of the speed. (60, not the 30 first planned: cruise is 40, and flying into a wall at a cruise should be a bump, not a crash.)
- **Ceiling**: the sky goes on up. Above 3 km the air thins (`space` event at 12 km in a later part); the first pass caps at 4 km.
- Fixed steps of 1/120 s, same at any frame rate.

## Drawing (`scene.js` and parts)

- `ground.js`: the land as one big plane drawn by a shader from world position (streets, sidewalks, lane paint, crossings, blocks, lawns, parks), so it is sharp from the street and from 2 km up; the hills as a displaced ring; the river and sea as water with sky reflection.
- `city.js`: every building one instance of the facade shader's box (one draw); roof clutter instanced; houses in the suburbs (code-built, instanced by part); trees; street lamps that glow at night.
- `landmarks.js`: the Graysons' house, the high school, Burger Mart, the Guardians' hall, the GDA, bridges.
- `people.js`: Mark (the GLB, posed by the rig: hover, fly flat out with a fist ahead, stride, landing crouch), Omni-Man, and code-built figures.
- `fx.js`: the vapour cone and shock ring at the sound barrier, speed lines, a trail at speed, the landing crater (a decal) and dust ring, debris.
- Camera: behind and above Mark, pulled back and widened with speed; kept out of buildings; drag or arrow keys to look.
- Time of day: noon by default; dusk and night selectable (the facade's windows light up).

## The HUD (`InvWorld.jsx`)

Title, speed (m/s and Mach), altitude, a compass with the landmarks, a minimap, the prompt for what's near (E), the controls card. Touch: a stick on the left, look on the right, buttons for up, down and boost. Gamepad as the other worlds.

## Things to do (later parts)

1. Flight lesson: Omni-Man's rings from the house to downtown, timed.
2. Rescues: a person falling off a tower, a car off a bridge: catch them before the ground.
3. The eight title cards hidden on rooftops (the page's episodes).
4. The Flaxans' portal over the river: knock them back by flying into them at speed.
5. Spar with your father: opens Think, Mark! over the page.
6. Space: fly up through the sky into orbit, see the Earth (the Earth page's textures), and the Moon and Mars.

Progress kept in localStorage (`tp-inv-world`), achievements in `Achievements.jsx`.

## Testing

- `map.test.js`: every landmark's door on open ground; no building in the river or sea; the spawn clear; `near` finds the same boxes as a full scan.
- `flight.test.js`: hover holds still; cruise reaches 40 m/s; boost fires one `boom`; a building stops him; hard landing fires `slam`; frame-rate independence.
- Lint, the whole suite, `vite build`, and screenshots in headless Chromium before each merge.
