# Handoff: the galaxy's model library (Sketchfab and Meshy)

Branch `claude/eloquent-darwin-foskak`. The owner asked for high-quality Star Wars models for everything in the galaxy, from Sketchfab where somebody had made them and from Meshy where nobody had: ships, people, creatures, vehicles, landmarks. A kind the worlds or the fleets already asked for now loads its model in place of the one built in code; the rest wait in the catalogues for a world, a fleet or a hero to ask for them.

## Done

### Ships (`src/components/galaxy/models.js`, far-off copies by `scripts/galaxy-lod.mjs`)
- **Sketchfab** (`scripts/sketchfab-galaxy.mjs`): the YT-2400 (`freighter`), Xg-1 (`gunboat`), GR-75 (`transport`), cloud cars, IG-2000, the Interdictor and the second Death Star, all of them built in code before. Cloud City stays built: `world.js`'s solids and landing goal fit the built disc, and the Sketchfab saucer was untextured.
- **Meshy**, each lifted out of Wookieepedia's picture of it (`scripts/meshy-galaxy-library.mjs`): the Hound's Tooth, Punishing One, Hammerhead and Gauntlet (built in code before), and the Twilight, Scimitar, TIE Defender, V-wing, Eta-2, Hyena, Sentinel, Zeta, Fang and Naboo yacht, which nothing flies yet (each has a built `STAND_IN`). All of the Meshy ones came nose to -x: `nose: Math.PI / 2`.

### People (`src/components/galaxy/surface/crew.js`, all walking on Rick's clips)
- **Sketchfab figures rigged by Meshy** (`scripts/meshy-galaxy.mjs` `bake` → `rigurl` → `fetch`, 5 credits each): Obi-Wan, Jango, Shaak Ti (`shaakti`: `shaak` is Naboo's grazing beasts), the Mandalorian (`mando`), Maul, Sidious, Rex, Bo-Katan, Vader, Fennec, Cara Dune, Greef Karga, a Rodian, an Inquisitor, a TIE pilot. The Wookiees use Chewie's model.
- **Meshy from words** (`images` → `models` → `rig` → `fetch`, about 44 credits each): Tuskens, Lando, a Twi'lek, Ugnaughts, Rebel soldiers, Senate guards, Lobot, Neimoidians, Bib Fortuna, Aqualish, Wuher, Mustafarians, a Jedi, Qui-Gon, Hondo, Ackbar, an Imperial officer, Dooku.
- **Standing, not rigged** (`catalog/library.js`): Anakin, Krennic, Cassian, Chirrut, Mace, Padmé. Their arms-down poses came out of the rigger broken (Padmé's lace cape went black), so they stand where the worlds put them.

### The worlds' things (`src/components/galaxy/surface/catalog/library.js`)
- **Sketchfab**: the AAT, E-Web, a parked X-wing, Theed's N-1s, the royal starship, the Juggernaut, Mos Espa houses.
- **Meshy creatures**: tauntauns, the acklay, kaadu, womp rats (0.85 m: Beggar's Canyon scales them 2.4×), bogwings, aiwhas, lava fleas; and the nexu, reek, varactyl, loth-cats, loth-wolves, blurrgs, happabores and fambaas for worlds to come.
- **Meshy vehicles**: Naboo's MTT and bongo; a skiff, swoop, STAP, AT-DP, flash speeder and Imperial troop transport for later.
- **Meshy landmarks over the built ones' walls and decks** (`solids: 'built'`): the Mos Eisley cantina (Tatooine's and Nevarro's), Varykino, Endor's shield generator; the Gungans' stone heads. Mustafar's collector rig is a library piece (`lavacollector`): its deck stands 4 m up, the duel's built deck 1 m.

### The pipeline, improved
- `scripts/meshy-galaxy.mjs` `bake`: waits out Sketchfab's 429s; poses skinned meshes (`unskinned`); drops lines and second UV sets; turns a sideways figure (`yaw`); `sheet: true` lays every material on one atlas before rigging (Meshy's rigger keeps one material and repaints the rest wrongly), with mirrored UV halves shifted per triangle, see-through texels made white and palette maps under 64 px flattened to their average. `fetch` caps figures at 30k triangles and writes `crew-<name>` credits for Sketchfab figures.
- `scripts/meshy-galaxy-buildings.mjs`: `shot`/`look` overrides per entry, `galaxy: true` to write a ship to `public/models/galaxy/`, `mirror: true` for a model made the other way round from the built one it stands over. The library lane is `scripts/meshy-galaxy-library.mjs` with its tasks in `scripts/meshy-galaxy-library-tasks.json`.
- `scripts/preview/crew.html` lists every crew figure.

### Wired into the worlds as well
- Named people take their own models: Qui-Gon (Naboo), Dooku and Mace (Geonosis, the arena quest), the adult Anakin at Varykino, Yoda's model for Coruscant's two Yodas (they were the Jedi figure shrunk to 0.38).
- Mustafar's high-ground tableau: Anakin stands at the foot of the bank (he was in the lava, ground 0.9 m against lava at 2.5 m), and he and Obi-Wan hold lit blades (`surface/heldBlade.js`, the duellists' saber code, now shared; a life entry's `blade: { color }`).
- The tauntaun, kaadu and bantha rides swap their built figure for the catalogue model once it's loaded (`scene.js`), so the ridden one matches the herd.
- The arena's roaming acklay and the womp rats use their models (`activity.js`'s built womp rat is gone).
- A duellist (the Dagobah cave Vader) prefers its standing model to a walking crew figure, so its blade stays where its hand is.

### Checked
- Each new model rendered and judged; every Meshy ship, vehicle and person audited twice (a workflow: one judge, then a blind second), disputes settled from straight-on renders.
- Ten worlds loaded headless (`galaxy-check.mjs` and `surface-shot.mjs`, one agent per world): no page or console errors; the most any reached was Naboo's 441 calls and Scarif's 1.59M triangles, and 19.9 MB of models (ceilings 600, 2.5M, 40 MB). An adversarial review of the code (each finding put to two refuters) found the shaak clash, the Yodas, the Mustafar tableau, the rides and Cloud City's solids: all fixed in `bda028b` (a confirming browser pass was running at the time of writing).
- `npx eslint .`, `npx vitest run` (4197 passed), `npx vite build`.

## Left, in order
1. **Small things the checks saw**: Coruscant's five temple Jedi and Geonosis's two are one face (the Meshy Jedi); a second and third Jedi would vary them. Obi-Wan on Mustafar idles turned a little off his facing (the borrowed idle clip). Static models that roam (the acklay, Yoda, the creatures) bob and slide rather than walk. The parked X-wing's `opts.stripe` doesn't recolour the model.
2. **Wire the library into worlds**: Utapau isn't a world (varactyls wait); Lothal could take loth-cats and loth-wolves (`sites/outer.js`), Nevarro and Arvala blurrgs and happabores, Naboo fambaas in the Gungan army, the arena nexu and reek beside the acklay, Jabba's skiff over the Sarlacc.
3. **Heroes**: Obi-Wan, Maul, Vader, Rex, Bo-Katan, Mace (standing only), Qui-Gon and Dooku are figures on the crew's skeleton; `galaxy/heroes.js` could offer them, with their sabers.
4. **Fleets**: the ten Meshy library ships fly as their stand-ins only if a set piece asks; `systems.js`'s `traffic` lists are still never read.
5. **Redo**: the dragonsnake (Meshy made a crocodile; the built one stays) and the TIE Striker (Wookieepedia's picture was a plain TIE) were dropped. The Hound's Tooth's stern and canopy are a little melted; a second take from `File:HoundsTooth_3quarters_view-SWE.png` with a cleaner lift would help.
6. **Meshy credits**: about 480 left on the second account at the end of this lane; another session spends from the same account.

## Checking it
- Dev server: `npx vite --port 5188 --strictPort --host 127.0.0.1`.
- A model from around it: `node scripts/glb-shot.mjs <file.glb> <out.png> three,top,front,left,right,rear` (top view: image down is +z, right is +x).
- The crew walking: `http://127.0.0.1:5188/scripts/preview/crew.html?only=obiwan,vader&move=0.5` (five at a time or the framing breaks).
- A world: `OUT=lab/check JSON=1 node scripts/galaxy-check.mjs surface <ids>` and `OUT=lab/shots node scripts/surface-shot.mjs <world> "<x>,<z>,<dist>,<deg>,<label>"`.
- Remake one: delete its entry in the tasks file, then `MESHY_TASKS=scripts/meshy-galaxy-library-tasks.json MESHY_REVIEW=lab/meshy/library node scripts/meshy-galaxy-buildings.mjs lift|models|fetch <kind>`, or `node scripts/meshy-galaxy.mjs images|models|rig|fetch <name>` for a person. Both read `MESHY_API_KEY` (the second account's key had the credits).
