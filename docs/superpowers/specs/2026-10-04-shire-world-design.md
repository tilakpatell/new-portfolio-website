# The Shire, the world — design

Clicking the Shire on the Middle-earth map used to open a 2D map with a Back / On stepper. Now it opens **Hobbiton, the world**: a walkable 3D Shire on the evening of Bilbo's birthday party, with five things to do. The road stepper stays underneath it.

## Brief

- **Player promise.** Walk about Hobbiton as Frodo on the day of the party, and do what hobbits do: pinch Farmer Maggot's mushrooms, blow smoke rings with Gandalf, set off the fireworks. Then the party ends, the Ring is yours, and a Black Rider comes up the road.
- **Target feeling.** Cosy and golden, then a chill at night.
- **Primary verb.** Walk (third person, camera follows; drag to look round).
- **Secondary verbs.** Interact (E / tap), run (Shift), puff (smoke rings), launch (fireworks), hide and hold still (the Rider), put on the Ring (R).
- **5–30 s loop.** Walk to a marked place → its activity → a seal on the quest list → the next place lights up.
- **1–5 min arc.** Day: three open activities in any order. The fireworks bring the night. Bag End opens (the Ring). With the Ring, the East Road has a Rider on it. Then the road goes ever on, to Rivendell.
- **Lose / learn / retry.** Maggot's dogs catch you and you're put back at his gate with nothing. Smoke rings run out of pipe-weed. The cheer drains if the fireworks stall. The Rider finds you if you're on the road, moving, or wearing the Ring. Each restarts in a second.
- **Better player.** Reads the dogs' sight cones and times runs past them; leads Gandalf's drifting ring; varies colours and spreads bursts; gets under the roots early and doesn't touch the Ring.
- **Non-goals.** No combat, no inventory beyond the Ring, no downloads (everything is built in code), no physics engine (circles and boxes on a heightfield).

## Core loop

Player **walks** to **a place on the quest list** while **dogs, a draining cheer, or a Rider** create risk; success gives **a seal (achievement) and the next part of the story (night, Bag End, the Rider, the road)**; failure puts them **back at the start of that activity**, instantly.

## The places (metres; +x east, +z south; north is −z)

| Place | Where | What |
| --- | --- | --- |
| Bag End | mound at (−18, −24), door faces south | the Hill's top; bench at (−13.5, −18.5) with Gandalf; the Ring (after the party) |
| Bagshot Row | holes at (−34, −11), (−27, −10) (Sam's), (−8, −11) | Sam in his garden |
| Party Field | Party Tree (20, −20); pavilion (27, −11); Gandalf's cart (12, −12) | the fireworks |
| The Water | pond centre (−6, 14), 12 × 7; stream east to the edge | mill at (−21, 12), wheel at (−18.6, 12) |
| Bridge | over the stream at x = 12, z 11 – 19 | the way south |
| Green Dragon | (14, 34), door faces north | Rosie, a lit inn at night |
| Maggot's field | fenced x −50 … −26, z 22 … 40, gate on the north side x −40 … −36 | mushrooms, three dogs, scarecrow, barn at (−56, 31) |
| East Road | lane (−50, −4) → (45, −4) → (56, 4) → (70, 12) | the Rider; hiding hollow under the roots at (52, 9.5) |
| Pasture | (40, −30) | sheep |

The world is a disc of radius 64 you can walk in, rising into wooded hills to 100.

## Activities

1. **Shortcut to mushrooms** (open). Ten mushrooms in Maggot's field. Three dogs patrol; each has a sight cone drawn on the ground. Seen → bark → chase (faster than a walk, slower than a run) for five seconds, or until you're out of the field. Caught: Maggot puts you back at his gate and the mushrooms you were carrying grow back.
2. **Smoke rings** (open). Sit with Gandalf on the bench. His big ring drifts and bobs; aim your pipe (↑/↓ or pointer), puff (Space / tap). Thread three of yours through his in eight puffs.
3. **Gandalf's fireworks** (open). At his cart: night falls. Click or tap the sky to launch. The cheer drains; bursts fill it, more for a new colour, a new part of the sky, and quick runs. Fill it within forty seconds and Merry and Pippin light the dragon.
4. **Keep it secret, keep it safe** (after the fireworks). Bilbo has gone. Inside Bag End, the envelope on the mantel; throw the Ring in the fire to see the letters, take it out. Now R puts it on (the world goes grey, the sound to wind and whispers).
5. **Get off the road!** (with the Ring). Hoofbeats on the East Road. Get into the hollow under the roots before the Rider comes, and keep still while it sniffs. Moving, being on the road, or wearing the Ring gives you away.

After all five: walk east out of the Shire, and the page goes on to Rivendell.

## Achievements

`mushrooms`, `smokerings`, `fireworks`, `secretsafe`, `getoffroad` — shown as seals on the Shire on the map.

## Files

- `src/components/middleearth/shire/rules.js` — layout, height, collisions, walking, the activities' rules, progress. No drawing; tested in `rules.test.js`.
- `src/components/middleearth/shire/props.js` — the buildings, trees, animals and the Rider, made in code.
- `src/components/middleearth/shire/scene.js` — the world in WebGL (lib/stage3d), driven by the component's state.
- `src/components/middleearth/shire/ShireWorld.jsx`, `shire.css`, `sounds.js` — HUD, input, quest list, sound.
- `src/pages/MiddleEarth.jsx` — the Shire chapter opens on the world; the road stepper stays below.

Without WebGL, the activities are listed as cards and the road stepper is still there.
