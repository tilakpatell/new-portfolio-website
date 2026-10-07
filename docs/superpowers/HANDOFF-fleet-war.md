# Handoff: the fleet war

The design is `docs/superpowers/specs/2026-10-06-fleet-war-design.md` and the plan is `docs/superpowers/plans/2026-10-06-fleet-war.md`.

## Done

- **PR #301:** rocks hurt at super speed (`rockHits.js`, the belt, the rim and the debris streams), and the flare's coronal mass ejection was redone (`cme.js`).
- **PR B (this one):** the war and its battles.
  - `wars.js` and `war.js`: the data and the front's state.
  - `battle.js`: the Fleet Assault sim, balanced on seeded AI-only battles. They run 6–12 minutes with mixed outcomes.
  - `battleScene.js` and `battleFx.js`: the drawing.
  - `front.js`: the front on the map.
  - `BattleHud.jsx`: the bar, the side picker and the end card.
  - The crews' lines.
  - The nav map's war line and the trip to the front.
  - The holotable's rings round the systems each side holds.
  - The Star Wars war is live. Rick and Morty's and Breaking Bad's are data only, with `ready: false`.
- **PR F: the Galactic Civil War, in the galaxy** (spec revision 2).
  - `fit.js`: worlds grown wider than their ships.
  - `tally.js`: the shared tally.
  - `gcw.js`: the war on a shared clock. Its balance was simulated over eight campaigns.
  - `battles.js`: a battle at every system.
  - `battle.js`: sized, kept off its planet, on the clock, shared.
  - `warfront.js` and `warState.js`, in the galaxy's flight scene.
  - The holotable's war table.
  - The `war` and `fight` actions on the wire.
  - The universe map lets the Star Wars front go: `BattleHud` is gone, and the universe front puts you in on your crew's side.

- **PR G: the set pieces** (`warpieces/`, `tunnel.js`).
  - **Endor:**
    - the shield generator on the moon holds the Death Star's shield up;
    - the superlaser fires on Rebel cruisers;
    - the Executor dives into the station when its bridge goes;
    - the reactor run.
  - **Hoth:**
    - the ion cannon disables Star Destroyers;
    - while the Empire attacks, GR-75 transports run for the jump. Six out and Hoth's held.
  - **Scarif:** the Hammerhead's ram puts two Star Destroyers onto the Shield Gate, and the shield drops.
  - **Any battle:**
    - a hangar run into a Star Destroyer's reactor;
    - batteries on the hulls as targets.
  - The crews have galaxy lines for all of it.

- **PR C: the capitals’ close-up cut.** A desktop with a graphics card (detail high or ultra) flies Daniel Andersson’s Imperial II (84k triangles) and Nebulon-B (100k) in place of the lighter ones, each with its own far-off copy (`galaxy/models.js` `HQ`, `withHq`; `scripts/sketchfab-galaxy.mjs destroyerhq nebulonhq`; `scripts/galaxy-lod.mjs hq/destroyer hq/nebulon`). The Imperial II is imported barely metal and brightened (`metal`, `gain`), or its grey plates come out near black under one sun. Home One’s close-up cut was tried and left: the same Sketchfab model as `moncal`, it came out plainer in the battle than the 40k one. `SUBSYSTEMS`, `TURRETS` and `HULLS` are shares of the length and hold on both cuts (the shield generators’ markers sit at the domes).
- **PR D: Rick and Morty's war.** On (`ready: true`), at its real places: seven sectors from just off the Citadel to the sky over Earth C-137, which the Federation holds, as in the show. Its flagships were made with Meshy from the show's own pictures (`scripts/meshy-war.mjs`; a still from the Rick and Morty wiki, kept in `lab/meshy/war/ref/`, lifted out by image-to-image, then image-to-3D): the Federation's battleship as the show drew it, dark green and black with red lights, and the Council's dreadnought in the Citadel's look (the Council has no warship of its own in the show). A first try from words alone came out as designs of their own and was dropped. Each stands in as `councilship`/`fedcruiser` till it loads. Their subsystems, batteries and hulls were placed from shots. Objective markers now fit their names (`battleFx.js` `fitPx`; the cards had cut "Destroy: Shield generator" off at both ends, in the galaxy too). `scripts/universe-war-check.mjs [cruiser|rv]` (starts its own Vite, real GPU) flies the front through: auto-joined on the crew's side, the phases down, the flagship broken, the war saved, the nav map's front button.

- **PR E: Breaking Bad's war** (`claude/peaceful-franklin-fvqb3q`, not yet a PR). On (`ready: true`), at its real places: seven sectors from Los Pollos, about 740 units off Albuquerque (the Breaking Bad world), out past the border to Don Eladio's hacienda at `[5800, 120, 300]`, clear of the Twins and the Maw (`wars.test.js` checks it). Its flagships were made with Meshy from words (`scripts/meshy-war.mjs`; the show has no flying ships to work from): Gus's superlab barge, a steel lab-and-laundry hull with hazard stripes and two roof domes, and Don Eladio's hacienda, terracotta and tile round a pool courtyard on a floating rock. They were made a second time: the first pair's tasks were on another Meshy account (moved to `tried` in `scripts/meshy-war-tasks.json`), which this key couldn't fetch. Noses: superlab `π/2` (thrusters at +x), hacienda `0` (Meshy mirrored its thruster block, so it flies with one either side, like the Federation's engine pods). Each stands in as `madrigal`/`lowrider` till it loads. Their subsystems, batteries and hulls were placed from shots, each objective clear of the hull spheres (a shot stops at the first it meets, so a buried one can't be hit): the superlab's shield generators are its two roof domes, its bridge the deckhouse's front, its reactor in the stern among the thrusters; the hacienda's are the back towers' domes, the main house over the front door, and the foot of the rock, with its batteries on the four towers' cannons.

## Left, in order

1. **The Federation battleship's bridge and reactor can't be shot.** Both sit inside its hull spheres (`wars.js` `SUBSYSTEMS.fedbattleship`, 0.10 and 0.13 of its length in), and a shot stops at the first sphere it meets, so no bolt from any side reaches them (a simulation over `battle.js`'s own hit rules: 0%; its generators 100%). With the Federation defending, its phases 2 and 3 fall only to `hit()` called straight at them, as `universe-war-check.mjs` does. Move them out to its surface, from shots, as the Breaking Bad flagships' were.
2. **Smaller:**
   - Voice the new lines (`npm run voices`, which needs the ElevenLabs key).
   - Measure frame time with 64 fighters on a real graphics chip.
   - Consider instancing the far fighters if it's slow.

## Checking it

- To check the set pieces, start the dev server with `npx vite --port 5188`, then run `OUT=/tmp/shots node scripts/galaxy-setpieces-check.mjs endor|hoth|scarif|hangar mid`.
  - It forces a battle at the system (`war.force`) and runs the battle on with `war.skip(seconds)`, because software GL steps it at about a twentieth of its pace.
  - At Endor it knocks out the generator, flies in through the mouth, pins into the chamber, shoots the reactor, pins out, cuts the escape short (`run.hurry`), and watches the station go.

- Start the dev server with `npx vite --port 5188`, then run `OUT=/tmp/shots node scripts/galaxy-war-check.mjs [system] mid`. Allow about four minutes.
  - It finds the battle on now (the major order's), drops in, and checks that you're in it on the Rebels' side.
  - It looks at it from a few places.
  - It takes the phases down with `hit()`, then checks that the war counted it and that the holotable shows the war.
  - (The pin's heading is `atan2(-dx, -dz)` to face `(dx, dz)`.)
- `scripts/rocks-check.mjs` and `scripts/flare-check.mjs` check PR A's pieces.
- Dev hooks:
  - `window.__universeDebug.front()` returns the front: `.where()`, `.info`, `.battle`, `.join(team)` and `.win(team)`.
  - `.rockFields` and `.smashed` hold the rock colliders.
- **Gotchas:**
  - The front is skipped under reduced motion, as the hunters are.
  - A battle's fought only within `ZONE.near` (900 units) of it. Leaving pauses it and coming back resumes it.
  - The save is `localStorage` `tp-war-starwars`. Delete it to start the war again.
