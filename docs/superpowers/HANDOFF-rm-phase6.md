# Handoff: the Rick and Morty multiverse, Phase 6 and the long tail

Plan: `docs/superpowers/plans/2026-10-06-rick-and-morty-multiverse.md`.
Branch: `claude/gifted-fermi-m29jzj` (merged to main as it went).

The destinations' data is split for the health check's `big-files`:
`dimensions/place.js` (the box, the headings and `place()`), `rows1.js`,
`rows2.js`, `rows3.js` (the dial's rows in order), and `destinations.js`
(joins them, the dial, `destinationById`, `linkTarget`, `validArrive`).

The user's asks for this lane: finish the multiverse fully, make it large
and performant with a lot to do; work directly (no subagents, no
workflows); merge PRs regularly; never a figure or a prop drawn in code
where a model can stand (Meshy, Sketchfab through the scout, or the user's
own); NPCs that do things, not just stand and talk.

## Done

- **Task 6.3** (rows 13 and 14): the Zigerions' simulation
  (`dimensions/simulation.js`) and the Story Train (`storytrain.js`).
- **Task 6.4** (row 15): Rick Prime's fortress (`fortress.js`).
- **The long tail** (rows 16–24, the plan's Phase 7, nine of its entries):
  Froopyland, Mr. Nimbus's beach, the Gromflomite base, Heist-Con, Snake
  Planet, Nuptia 4, St. Gloopy Noops, the Immortality Field Resort and the
  Get Schwifty show (`froopyland.js`, `nimbus.js`, `gromflomites.js`,
  `heistcon.js`, `snakeplanet.js`, `nuptia.js`, `gloopynoops.js`,
  `resort.js`, `schwifty.js`).
- **NPC behaviour** for every destination, in `world/npc.js` (on the AI
  toolkit's context steering, `src/lib/ai/steer.js`), which `dimensions/stage.js`
  and the street's `visitors.js` share: the street has four walkers
  (Jessica, Brad, Mr. Goldenfold, Ethan; `rules.js`'s street PEOPLE with `ai`
  and `roams`). A person or one of
  the crowd carries `ai` in `destinations.js`:
  - `wander: [[dx, dz], …]`, `speed`, `pause`: walks the points in turn,
    steered round the place's solids and the others;
  - `watch: r`: turns to Morty within r;
  - `bark: { r, lines, every }`: a line said in passing (RmWorld's toast);
  - `hunt: { speed, catchR, near?, lose?, until?, always?, line? }`: goes
    for him while the place is hunting (`S.hunt(true)` from a builder's
    action), on its own within `near` (given up past `lose`), or from the
    start (`always`); within `catchR` it tells RmWorld `caught`. Morty is
    put back at the place's way in with the place's `caught` line (or the
    hunter's `line`), and the place settles (`calm`).
  Builders talk to RmWorld through the render state's `emit(name, data)`
  ('caught', 'bark', 'done'); `RmWorld.jsx`'s `npc()` handles them after
  each frame (`s.events`). Anyone who roams is marked `roams` and left out
  of the colliders (`rules.js`).
- **Task 6.5, the Rick and Morty system on the map**: four small planets
  round the Citadel, `universes.js`'s `MOONS` (kind `moon`, found by `byId`
  but not in `UNIVERSES`, so not in the map's order, the mini-map or the
  pages' links). `layout.js` places them at their `at` and lists them with
  the order in `BODIES`; `ship.js`'s `PLANETS`, the scene's planets,
  `deep.js`'s `PLACES` and `nav.js`'s `DESTINATIONS` read `BODIES`/`MOONS`,
  so they're solid, lit, drawn (plain spheres in their palette and air),
  closed to the drive, and the autopilot goes to them. Landed on like a
  fandom's planet: `landings/landings.js` entries and `landings/rmmoons.js`
  (the C-137 landing's portal, the women's gate, suckulents and cat trees,
  perches, cogs; the houses and the people are models). Tests in
  `deep.test.js` (clear of the Citadel's parts, each other, the fandoms and
  the wars), `landings.test.js`, `nav.test.js` (a moon's last leg to the
  autopilot is slower, inside the Citadel's space). Not on the mini-map yet.
- **Rows 30–34**: Mr. Goldenfold's dream (`dream.js`, Scary Terry hunts
  from the start, `lose` lets a hider shake him), the agency (`agency.js`,
  id `agency`, Jaguar's cell door swings on 'unlocked'), the Meeseeks' golf
  course (`meeseeks.js`, id `meeseeksgolf`: the box is an `escape`, and every
  Meeseeks hunts on 'swarm'), the vat of acid (`vat.js`) and Dimension 35-C
  (`dim35c.js`). Scary Terry, Jaguar, Mrs. Pancakes, the agency's guards
  and the sewer rats are `PHASE11`'s models.
- **Rows 26–29**: Cronenberg World (`cronenberg.js`, the cast's own
  Cronenbergs hunting), the Blood Dome (`blooddome.js`, a second duel: step
  into the ring and Hemorrhage comes), the Federation prison (`prison.js`,
  switches then Rick, past patrols) and the cable studio (`cable.js`, id
  `cablestudio`, ten of the channels' people barking their lines).
- **Evil Rick's lair** (row 25, `evilrick.js`): the quest line the user asked
  for. Free three Mortys from the dome (`collect` with `start: true`: the
  place is told 'collected' and nothing is done yet), Evil Rick comes
  (`hunt.duel`, `dimensions/duel.js`, tested: he strikes within reach every
  1.3 s, Morty fires with F into a cone 8 m long; hearts in the HUD;
  beaten, Morty falls and comes round at the door; Evil Rick at nought
  falls and stays down, the task done), then Evil Morty (sitting with his
  arms crossed, the `sitcross` clip) is spoken to and leaves through a
  yellow portal.
- **Clips** beyond idle, walk and run (`SHARED_CLIPS` in `meshyCast.js`,
  `public/games/meshy/clips-<name>.glb`): drink, cheer, wave, happy, hit,
  fall, scared, shoot, dance, punch, taunt, shot, sitcross. Made once on
  Nimbus's rig with `scripts/meshy-rm-local.mjs clips <clip> nimbus` and
  `CLIP_PREFIX=clips … fetchclips nimbus`, since every Meshy figure is on
  the same 24-bone skeleton and `clips.js`'s `retarget` scales them to each
  figure's hips. `cast.play(c, clip, { loop, hold })` and `c.play`/`c.stop`
  play one over the idle/walk/run blend; `api.play` is Morty's. Rick's
  `fidget: 'drink'` sips every so often. A hotspot's `anim` plays one when
  it's used (the mic: dance); RmWorld plays `scared` when he's caught, `hit`
  and `fall` in a duel, `shoot` when he fires, `cheer` when a thing's done. Rick's, Morty's and Evil
  Rick's own rigs are on the first Meshy account (`MESHY_API_KEY`), which
  another session ran down to 7 credits; the shared clips route needs no
  credits there.
- **Data for things to do**: a place's `collect: { task, spots, escape? }`
  (every spot used on a visit is the task done, or starts the escape clock
  and tells the builder `collected`), and `caught`.
- **Models** (Meshy, the `MESHY_API_KEY_ACC_2` account in the environment;
  `scripts/meshy-rm-local.mjs`'s `PHASE7` and `PHASE8`): nebulon,
  storylord, ticketsguy (rigged), zigerion-b, zigerion-c; simman, poptart,
  toasterhouse, omegadevice, primedrone; tommy, nimbus, atlantean, miles
  (rigged), froopy-a, froopy-b, heistotron, heister-a, heister-b, fart,
  snake-a, snake-b, snakeastronaut, snakerocket; hemorrhage, cornvelious
  (rigged), deathstalker-a, deathstalker-b, armothy, brainalyzer and the ten
  cable figures (`PHASE10`); glexo, glipglop, risotto,
  watert (rigged), nuptiamachine, mytholog, shrimply, gloopnurse,
  resortguest-a, resortguest-b, dirlycar, icet (`PHASE9`). The Omega Device's tanks
  hold the site's own `rick`. `dimensions/models.test.js` fails if any
  destination's model file (or a rigged one's idle and walk clips) is
  missing from `public/`.
- README's C-137 row lists every place.
- The Pickle Rick sewer run, `world/sewer/`: a lane runner opened from the
  agency's hole in the floor (hotspot `sewer`, a `PLACES` entry in
  `RmWorld.jsx` like Roy's, behind `GpuGate`). `rules.js` is the pure game
  (`newRun`, `stepRun`, `progress`: three lanes, hops, rats to squash or
  zap, grates to hop, screws for the laser, three hearts, won at `goal`;
  tested), `scene.js` draws it (the drain's segments recycled, the pickle
  and the rats from the Meshy cast), `Sewer.jsx` is the frame (keys, pad,
  HUD, cards, `onLeave(won)`; won completes the `sewer` task).

## Not done

- Mr. Frundles. (The cable figures went to a studio of their own rather
  than the alien street, which has no NPC layer.) Jaguar is at the agency,
  and the Pickle Rick sewer run is `world/sewer/` (below).
- The map's Birdperson is still the code-built one (`HANDOFF-rm-phase1.md`).
- Nothing on the dial has a sound of its own yet (the escape clock uses
  `portalOpen`; caught uses `ouch`).

## How to check

- `npm run lint`, `npx vitest run`, `npm run build`, and
  `node scripts/health.mjs --check --skip build` (CI runs all four).
- Dev server `npx vite --port 5197 --strictPort`, then
  `OUT=/tmp/shots node scripts/c137-shots.mjs simulation storytrain fortress froopyland nimbus gromflomites heistcon snakeplanet nuptia gloopynoops resort schwifty evilrick cronenberg blooddome prison cablestudio dream agency meeseeksgolf vat dim35c`.
- A scripted playthrough through the dev hook: `scripts/_play.mjs` is not
  kept; `window.__C137__.warp(area, x, z)`, `.act()`, `.api.act(area, 'npcs')`
  (where the place's people are) and `localStorage['tp-c137-done']` are
  what one needs. Headless Chromium runs the sim at a few frames a second
  (dt capped at 0.1 s), so a hunter takes several times longer to reach
  Morty than in a real browser.
- Meshy: `MESHY_API_KEY=$MESHY_API_KEY_ACC_2 node --no-warnings scripts/meshy-rm-local.mjs balance`.
