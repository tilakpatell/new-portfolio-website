# The physics rulebooks: what is the site’s, not the game’s

The rulebooks here are the Battlefront II (2017) physics records read by `scripts/lib/bf2017-physics-rules.mjs` (the design: `docs/superpowers/specs/2026-10-10-bf2017-physics-design.md`). Every number carries a `_source` naming the record, the object’s type and the property’s path. A value the records do not give is marked `"source": "hand"` and has a line here; `rulebook.test.js` fails otherwise.

Rebuild: `node scripts/bf2017-physics-rules.mjs soldier --root <export>` (the owner’s `C:\Users\tilak\Downloads\BF2_Extract\web`, or `lab/assets/bf2017` after a fetch of `data/Gameplay/Characters/**Physics*`).

## soldier.json

Thirteen `CharacterPhysicsData` records, one row each, the default `DefaultSoldierPhysics`.

- **`states.jump.fallback`** (`source: "hand"`): a record whose `JumpStateData.JumpHeight` is 0 (every hero record: their jump is their ability’s) or that has no jump state (the Pillio creature) jumps at the site’s 5.4 m/s, `walker.js`’s `WALK.jump`. A record with a height (the soldier’s 1.1 m, Yoda’s and the Ewok’s 1.6 m) jumps to that height under the site’s gravity: `soldier.js` gives the speed as √(2 g h).
- **The gravity** is not in these records (it is the level’s), so `soldier.js` keeps the site’s 15.5 m/s² (`CHARACTER.gravity`, the walker’s) so the galaxy feels one way everywhere; the jump height above is honoured under it.

## A correction to the design’s survey

The design read the soldier’s walk as 5.0 m/s and the sprint as × 1.5 (7.5 m/s), the crouch as 3.0. Those are the **`AnimationControlledStateData`**’s pose rows. The walk on the ground is **`OnGroundStateData`**’s: stand 3.8 m/s, back × 0.8, strafe × 0.9, sprint × 1.57 (5.97 m/s), acceleration gain 0.4, deceleration −15; crouch 2.5 m/s, no sprint. The rulebook keeps both states; `soldier.js` walks on `onGround`.
- **The gains’ unit** is not in the records. `soldier.js` reads `AccelerationGain` and `DecelerationGain` as the fraction of the gap to the wanted speed closed in one 30 Hz frame, by magnitude, never more than the whole gap: the soldier’s 0.4 closes 90% of a start in about a sixth of a second, its −15 stops within a substep and never reverses.
