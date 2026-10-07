# Handoff: the Rick and Morty multiverse, Phase 6 and the long tail

Plan: `docs/superpowers/plans/2026-10-06-rick-and-morty-multiverse.md`.
Branch: `claude/gifted-fermi-m29jzj` (merged to main as it went).

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
- **NPC behaviour** for every destination (`dimensions/stage.js`, on the
  AI toolkit's context steering, `src/lib/ai/steer.js`). A person or one of
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
  and `fall` in a duel, `shoot` when he fires. Rick's, Morty's and Evil
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

## Not done

- **Task 6.5**, the Rick and Morty system on the universe map. The map
  lands only on the fandoms' planets (`universes.js`, `landings/`), so four
  landable planets round the Citadel need a new kind of wonder in
  `deep.js`, drawn by `deepspace.js` and landed on by `footScene.js`
  (`planetOf`), plus `landings/` entries. Scoped but not started.
- The rest of the plan's Phase 7: Jaguar and the Pickle Rick sewer run (a
  game of its own), and Mr. Frundles. (The cable figures went to a studio
  of their own rather than the alien street, which has no NPC layer.)
- The map's Birdperson is still the code-built one (`HANDOFF-rm-phase1.md`).
- Morty's `cheer` clip isn't played anywhere yet (a thing done could play it).
- Nothing on the dial has a sound of its own yet (the escape clock uses
  `portalOpen`; caught uses `ouch`).

## How to check

- `npm run lint`, `npx vitest run`, `npm run build`, and
  `node scripts/health.mjs --check --skip build` (CI runs all four).
- Dev server `npx vite --port 5197 --strictPort`, then
  `OUT=/tmp/shots node scripts/c137-shots.mjs simulation storytrain fortress froopyland nimbus gromflomites heistcon snakeplanet nuptia gloopynoops resort schwifty evilrick cronenberg blooddome prison cablestudio`.
- A scripted playthrough through the dev hook: `scripts/_play.mjs` is not
  kept; `window.__C137__.warp(area, x, z)`, `.act()`, `.api.act(area, 'npcs')`
  (where the place's people are) and `localStorage['tp-c137-done']` are
  what one needs. Headless Chromium runs the sim at a few frames a second
  (dt capped at 0.1 s), so a hunter takes several times longer to reach
  Morty than in a real browser.
- Meshy: `MESHY_API_KEY=$MESHY_API_KEY_ACC_2 node --no-warnings scripts/meshy-rm-local.mjs balance`.
