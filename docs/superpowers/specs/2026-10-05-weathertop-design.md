# Weathertop and the Ford, the third walkable town (design)

## Intent

The user wants the towns to go on along the films' story after Bree. "Start the other towns, like Rivendell, and the movie plotline basically". Between Bree and Rivendell the films have Weathertop: the ruined watchtower at night, the hobbits' fire, the five Nazgûl on the summit, the Morgul blade, the athelas, and Arwen's ride to the Ford of Bruinen. This chapter is all of that, at `#/middle-earth/weathertop`, between Bree and Rivendell on the map (the road's `weathertop` stop).

What a town needs (memory notes `world-pages-bar`, `albuquerque-town-bar`, the Shire and Bree):

- the iconic thing first (the ring of broken stones on the hilltop against the stars);
- named characters with their lines;
- things to do that come from famous scenes;
- no unseen walls, and colliders that match what you see;
- nothing downloaded.

## What you do

Dusk, then night, then the ride.

1. **Amon Sûl** (`climb`). You come up the road at dusk; Strider has gone up ahead. Climb the old stair through the crags to the ruin on the summit. "This was once the great watchtower of Amon Sûl." He hands out swords and goes off to look around, and you lie down in the dell to sleep. Seal `amonsul`.
2. **Put it out, you fools!** (`supper`). You wake in the dark to the smell of bacon. Down by the fire, Pippin has the pan on ("Tomatoes, sausages, nice crispy bacon") and Sam has "saved some for you, Mr. Frodo". The fire has to be out before the Nazgûl see it. It is five burning patches (the fire itself, the pan, a log rolled out, the grass, a blanket's corner); each burns hotter the longer it is left, and a hot one sets an out one beside it going again. Run onto each and stamp (E or Space, or tap Stamp) before the clock runs out. Then, "Ash on my tomatoes!", and a scream from below. Seal `putitout`.
3. **Fire against the dark** (`brand`). Five Nazgûl come up the slopes from all sides; get to the ruin on the summit. There Frodo stands with a burning brand, his back to the broken plinth, and they come in through the gaps in the walls. One won't come on into the brand's light while it faces it: it stops, and edges round to get out of the light. A thrust (Space or a click) drives back any in reach. The Ring pulls harder the closer they are (a meter); if it wins, or a blade reaches him, the scene starts again. Hold for forty seconds and Strider comes up the stair with fire in both hands. But one blade found Frodo in the dark. Seal `weathertop`.
4. **Kingsfoil** (`athelas`). You are Sam now. Frodo lies cold at the foot of the stair. "Sam! Do you know the athelas plant?" Search round the foot of the hill by lantern among the weeds for three plants of kingsfoil; they glow faintly when the lantern's near, the weeds never do. Frodo grows colder all the while. Seal `kingsfoil`.
5. **The Flight to the Ford** (`ford`). Bring the kingsfoil to Strider, and Arwen comes on Asfaloth: "He's fading… I'm the faster rider." You ride with her down the road through the Trollshaws, with the Nine behind. The road runs on by itself: steer between the fallen trees and the stones, and spur on (it needs a rest after). A hit slows you and the Nine close in. Over the ford, she turns on the far bank: "If you want him, come and claim him!" The river rises in horses of white water and takes them. Seal `bruinen`. Frodo wakes in Rivendell; the road goes on.

People: Strider (on the summit, at the foot, and at the end of the fight with a torch in each hand), Sam, Merry, Pippin (their films' lines at the fire and at the foot), Arwen on Asfaloth. Off the path at the hill's foot, the three stone trolls, and a word about them.

## The place

Metres, the towns' conventions: +x east, +z south, a hobbit 1.55 tall, Big Folk about 2.3.

- A walkable disc of radius 64. Weathertop is a high round hill in the middle, its summit 22 m up, crowned by a ring of broken walls and three standing broken arches about 19 m across, with a floor of cracked flagstones and a broken plinth in the middle. Round the crown is a ring of crags the stair is the only way through.
- The old stair climbs from the south-west foot round to the summit.
- The dell is a grassy hollow on the west shoulder, about halfway up, where the camp is: the fire, the pan, bedrolls and packs.
- Around the foot: heath, broken stones, a few dead trees, and the stone trolls in a clearing to the north-east.
- At the edge of the disc the land falls away into dark and mist.
- The ride is a separate stretch of road, set apart in the same scene (as Bag End's inside is). It runs about 600 m through birch and pine to the river: a shallow ford, wide and stony, with Rivendell's valley beyond it.

Sky: deep dusk while you climb, a night of stars and a low moon once you've lain down in the dell, the river under moonlight for the ride, and a grey dawn on the hill after.

## How it fits

- Shared town code in `towns/` (walker, talk, story, TownHud, keys, ground, bake, and the online travellers as ghosts); the Nazgûl from `towns/wraiths.js` (pale kings through the Ring); the Shire's kit for stone and the Black Riders' horses.
- `towns/weathertop/`:
  - `layout.js`: the hill, the stair, the crags, the dell, the colliders and who's about. Pure and tested.
  - `story.js`: the quests, the seals and the conversations. Tested.
  - `rules.js`: the fire, the brand fight, the athelas hunt and the ride, each tested with a player who does nothing (loses) and one who plays well (wins).
  - `props.js`: the ruin, the camp, the trolls, Asfaloth, the ford.
  - `scene.js`, `WeathertopWorld.jsx`, `sounds.js`.
- localStorage `tp-weathertop-done` and `tp-weathertop-at`; dev hook `window.__WEATHERTOP__`.
- Seals `amonsul`, `putitout`, `weathertop`, `kingsfoil`, `bruinen` in `Achievements.jsx`; the chapter goes between Bree and Rivendell in `chapters.js`, and Bree's road now goes on to Weathertop.
- Without 3D, the five scenes are listed as cards, as in the Shire.
