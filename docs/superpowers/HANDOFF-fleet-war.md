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

## Left, in order

1. **PR C: the high-quality Star Wars capitals.**
   - Import Daniel Andersson's Imperial II (`b8bd2d35f7604670ab85242c06c6d280`), MC80 Home One (`9b5e5e5192f64a7faad93a3bfd2efaf2`) and Nebulon-B (`19b1b0126f8248c28ce38863413c30b8`) from Sketchfab, at about 100k triangles and 2K textures. Credit them.
   - Use them on the high tier.
   - Re-place `SUBSYSTEMS`, `TURRETS` and `HULLS` on them from screenshots.
   - Done looks like: the `galaxy-war-check` screenshots show the new hulls, and the markers sit on the domes, the bridge and the reactor.
2. **PR D: Rick and Morty's war.**
   - The Council's dreadnought and the Federation's battleship. Scout Sketchfab first, then Meshy.
   - Their subsystems.
   - `ready: true`. The war goes at its real places: the Citadel, C-137 and the Federation's.
   - Bring back a universe browser check: the front, auto-joined.
   - Done looks like: the check, flying the cruiser, plays a battle through.
3. **PR E: Breaking Bad's war.** The same, for Gus's superlab barge and the cartel's hacienda.
4. **Smaller:**
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
