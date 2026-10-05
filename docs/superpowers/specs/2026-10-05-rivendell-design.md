# Rivendell, the fourth walkable town (design)

## Intent

The towns follow the films' road: the Shire, Bree, Weathertop, and now Rivendell, at `#/middle-earth/rivendell`. Frodo wakes in the house of Elrond after the Ford. In the films, Rivendell is where the Fellowship is made: Bilbo again, the shards of Narsil, the Council of Elrond, "I will take it", and nine walkers setting out. This chapter is all of that, in an elven valley you can walk about in. The films' clips board stays below the town, as it is now.

What a town needs (as for the Shire, Bree and Weathertop):

- the iconic thing first: the valley at golden autumn light, with waterfalls off the cliffs and the house of Elrond on its terraces;
- named characters with their films' lines;
- things to do that come from famous scenes;
- no unseen walls, and colliders that match what you see;
- nothing downloaded.

## What you do

1. **The house of Elrond** (`awake`). Frodo wakes in a bed by a window full of light, with Gandalf in the chair. "Where am I?" "You are in the house of Elrond, and it is ten o'clock in the morning, on October the twenty-fourth, if you want to know." Then Sam bursts in. Seal `elrond`.
2. **My old ring** (`bilbo`). Find Bilbo in his room off the terrace, writing his book. He gives you Sting and the mithril shirt ("It's light as a feather, and as hard as dragon scales"). "I don't suppose I could… hold it, once more?" The Ring comes out, and his face changes. Pull it back in time: a timing game, where you close your hand before his reaches it. Seal `oldring`.
3. **The blade that was broken** (`narsil`). In the hall of Narsil, a painting of Isildur cutting the Ring from Sauron's hand, and the shards laid out before a statue. Boromir: "The blade that cut the Ring from Sauron's hand." Put the shards back in the order they lay: a short drag-and-drop puzzle over the painting. Seal `narsil`.
4. **The Council of Elrond** (`council`). The court on the cliff, the Ring on its stone plinth, and the Free Peoples arguing. Gimli swings his axe at the Ring and it shatters (watch it happen). The voices rise and the Eye flickers in the Ring. Stand, at the right moment, and say it: "I will take it! I will take it to Mordor… though I do not know the way." Seal `iwilltakeit`.
5. **The Fellowship** (`fellowship`). Gather the Nine about the valley: Sam from the bushes ("Mr. Frodo's not going anywhere without me!"), Merry and Pippin ("We're coming too!"; "Anyway, you need people of intelligence on this sort of mission… quest… thing"), Gandalf, Aragorn ("You have my sword"), Legolas ("And you have my bow"), Gimli ("And my axe!") and Boromir. At the court Elrond names them: "You shall be the Fellowship of the Ring." Pippin: "Great! Where are we going?" They walk out of the south gate together. Seal `fellowship`.

Also about the valley: Arwen and Aragorn on the bridge at dusk (the Evenstar), Elrond on the terrace, elves with harps, and the falls.

## The place

Metres, the towns' conventions: +x east, +z south. A hobbit is 1.55 tall, Big Folk about 2.3, elves about 2.4.

- A walkable disc of radius 56, in a deep valley running north to south. Cliffs rise all round past the disc, with three waterfalls falling off them: two to the east, a tall one to the north-west.
- A river runs down the valley's east side in a rocky gorge and goes out south. One slender arched bridge crosses it to the east bank.
- The house of Elrond stands on terraces on the west side.
  - The main hall faces east, with slender columns, pointed arches and curved roofs, and its balcony is the bedroom where Frodo wakes.
  - Bilbo's room is a little pavilion to the south-west.
  - The hall of Narsil is a long colonnade on the north terrace.
  - The Council court is a round paved court on a spur over the river, ringed with carved chairs, with the plinth in the middle. It looks out at the falls.
  - The south gate is a path down through birches and beeches to the valley's mouth.
- Autumn: beeches and birches in gold and red, leaves falling, golden late-afternoon light, then dusk for the bridge.

## How it fits

- Shared town code in `towns/` (walker, talk, story, TownHud, keys, ground, bake, the online travellers as ghosts). Elves, Gandalf, Bilbo, Aragorn, Legolas, Gimli and Boromir are toy figures (`makeFolk` looks), as the towns' people are.
- `towns/rivendell/`:
  - `layout.js`: the terraces, the river, the bridge, the colliders and who's about. Pure and tested.
  - `story.js`: the quests, the seals and the conversations. Tested.
  - `rules.js`: the Ring and Bilbo's hand (timing), the shards (puzzle), the council (the moment to stand), and gathering the Nine. Pure and tested.
  - `props.js`: elven architecture (pavilions, colonnades, arches, curved roofs, balustrades), the bridge, the falls, the council court and its chairs, the painting and the shards, the bed, Bilbo's desk, autumn trees.
  - `scene.js`, `RivendellWorld.jsx`, `sounds.js` (falls, harps, the council's voices, the axe shattering).
- localStorage `tp-rivendell-done` and `tp-rivendell-at`; dev hook `window.__RIVENDELL__`.
- Seals `elrond`, `oldring`, `narsil`, `iwilltakeit`, `fellowship` in `Achievements.jsx`; the chapter keeps its place and the clips below. Weathertop's road ends here.
- Without 3D, the five scenes are listed as cards.
