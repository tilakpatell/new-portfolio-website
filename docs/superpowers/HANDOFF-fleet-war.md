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

## Left, in order

1. **PR C: the high-quality Star Wars capitals.**
   - Import Daniel Andersson's Imperial II (`b8bd2d35f7604670ab85242c06c6d280`), MC80 Home One (`9b5e5e5192f64a7faad93a3bfd2efaf2`) and Nebulon-B (`19b1b0126f8248c28ce38863413c30b8`) from Sketchfab, at about 100k triangles and 2K textures. Credit them.
   - Use them on the high tier.
   - Re-place `SUBSYSTEMS`, `TURRETS` and `HULLS` on them from screenshots.
   - Done looks like: `battle-check` screenshots show the new hulls, and the markers sit on the domes, the bridge and the reactor.
2. **PR D: Rick and Morty's war.**
   - The Council's dreadnought and the Federation's battleship. Scout Sketchfab first, then Meshy.
   - Their subsystems.
   - `ready: true`.
   - Done looks like: `battle-check` with the cruiser plays a battle through.
3. **PR E: Breaking Bad's war.** The same, for Gus's superlab barge and the cartel's hacienda.
4. **Smaller:**
   - Voice the new lines (`npm run voices`, which needs the ElevenLabs key).
   - Measure frame time with 64 fighters on a real graphics chip.
   - Consider instancing the far fighters if it's slow.

## Checking it

- `npx vite --port 5173`, then `OUT=/tmp/shots node scripts/battle-check.mjs xwing mid`. It flies to the front, picks a side, takes the phases down with the battle's own `hit()`, breaks the flagship and checks the end card, the save and the nav map. Software GL runs the battle at about a tenth of its pace, so allow 20 minutes.
- `scripts/rocks-check.mjs` and `scripts/flare-check.mjs` check PR A's pieces.
- Dev hooks:
  - `window.__universeDebug.front()` returns the front: `.where()`, `.info`, `.battle`, `.join(team)` and `.win(team)`.
  - `.rockFields` and `.smashed` hold the rock colliders.
- **Gotchas:**
  - The front is skipped under reduced motion, as the hunters are.
  - A battle's fought only within `ZONE.near` (900 units) of it. Leaving pauses it and coming back resumes it.
  - The save is `localStorage` `tp-war-starwars`. Delete it to start the war again.
