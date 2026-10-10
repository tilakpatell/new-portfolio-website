# Handoff: the crews' ship powers

The owner asked for "powers for the ship character u have (Rick and Morty vs Luke etc)". The design is the investigation's report, `docs/superpowers/handoff/galaxy-overhaul/find-powers-findings.json` (its proposals, constraints and open questions), with the decisions taken on those questions in that folder's `README.md`. The work is on `claude/gw-powers`, branched from `claude/galaxy-war-overhaul`.

## Done: the galaxy (phase 1)

Each crew has a power on G, on a cooldown, and a big one on X, charged by what you shoot down (five kills, or two and a half minutes of flying).

| Crew | G | X |
| --- | --- | --- |
| Luke and Artoo (X-wing) | Force Focus: everyone else's time at 0.35 for 5 s, the guns' help onto the lead and the lock's tracking turned up (onto the game's own ships only); 22 s | Torpedo salvo: four, each homing on its own target |
| Han and Chewie (Falcon) | Never tell me the odds: a corkscrew and sidestep the lasers fly through, and everyone on a run or your tail broken off; 12 s | Chewie on the quad guns: 12 s of shots all the way round, seven in ten landing |
| Rick and Morty (cruiser) | The portal gun: out 5 units behind the lock, facing the way it goes, or a 40-unit hop on; 10 s | Wubba lubba dub dub: the death ray from the nose, ten ticks a second for 3.5 s, the stick heavy |
| Walt and Jesse (RV) | Magnets: everyone within 22 units of a point 6 ahead held in a ball with their guns jammed, 4 s; 20 s | Say my name: a crystal of fulminated mercury thrown ahead, a 10-unit blast |

- `universe/shipPowers.js` (pure, tested): the cards, the ready, active, cooling and charging states, `mods` and `aimHelp` (what the scene changes while one's on), `chargeFor` (what fills the big one: never a shield or a capital ship's hull, and no more than five hits' worth from any one thing), the charge and the cooldown kept in the session across a landing (`tp:ship-powers`, read back only for the same crew), and the geometry (the portal's exit, a trench-aware `clearOfSolids`, the targets, the beam, the blast, the corkscrew).
- `universe/hunterRules.js`: the hunters' hooks. A ghost's lasers fly on past it; `pull` holds them at the magnet; `breakOff` sends everyone on a run away; `swallow` takes the lasers near a portal's mouth.
- `universe/battlePowers.js` (pure, tested on a real battle): the war's battles. `stepBattle` steps a battle with a power's hold on it: Force Focus's slowed time for its fighters, bolts and batteries, its clock put back on real time after (the defender wins on the clock, so a power can't stretch it); a ghost its bolts fly past (`b.ghost`, the one line `battle.js` reads); the fighters Walt's magnet holds dragged into a ball round its point. `holdFighters` is the magnet's grab. A power's damage on a battle is a shot aimed at its target through the battle's own `hit()` (`shotAt`), so its shared objectives, shields and aces count as the guns' do, and a power's punch on an objective is cut (`sub`) so one big one can't take a shield generator down alone.
- `galaxy/powers.js`: the glue in `galaxy/scene.js`, whose `strike` and `scored` are the scene's hit chain (kills by a power still pay, through `hunterEarn` and `hunterHelped`, but never charge the big one). `galaxy/warfront.js` passes the hold through (`update`'s fifth argument, `you`) and adds `pull`.
- `universe/powerFx.js` draws them, every mesh hidden while idle. `PowerBar.jsx` with `powers.css` is the HUD: two tiles with a cooldown ring each, touch buttons on a phone, beside the deflectors on a window under 700 px tall (where the flight settings' button would cover them), and a line in the first-flight hint.
- The crews' lines (each crew's `powers` in `crews.js`, through `linesFor(crew, 'power', id, sub)`: using it, the big one charged, a big haul, a refusal by why), a `power` branch in `Comms.jsx`, the sounds in `sounds.js`, and the guide's rows for G and X.
- Refused, with a line and no cooldown spent: a portal through Scarif's shield, out of the tractor beam or a set piece's hold, or with nowhere to come out clear of something solid with room to turn off it; a magnet with nobody near. Nothing's usable mid-jump or in a dive. Being shot down, crashing and jumping stop whatever's on (the charge stays). With motion reduced there are no powers, no bar and no effects.

## Where the code differs from the design

- **The battle hooks** are `battlePowers.js`, wrapped round the battle from outside, not `update(dt, you, { slow, ghost })`, `damage`, `blast` and `pull` inside `battle.js`. `claude/gw-battles` is rewriting the battle (a fixed-step sim split into `battleAi.js`, `battleCapitals.js` and the rest), and the wrapper uses only what a battle shows outside, which that rewrite keeps: its fighters' `pos`, `prev`, `seen`, `vel`, `cool`, `team` and `alive`, its `clock`, `you`, `update` and `hit`. Damage through `hit()` rather than a `damage(id, n)` keeps the director's shared outcome whole: there's no second path into an objective.
- **The portal** walks its exit back toward the ship until it's clear of everything solid with room ahead of it (6 units, or 1.5 s at the speed it comes out at), and is refused when there's nowhere like that, rather than pushing the exit a unit off the surface. Flown on with the real `step()` from such an exit at 0 to 12 u/s, there's no crash in 1 s with no hands nor in 4 s pulling up. It's kept inside the ceiling and floor too.
- **Force Focus** has no cadence: the X-wing's 0.12 s is already `FASTEST`, the wire's floor.
- **Chewie's bolts** fly at 60 u/s, not 90: at a few frames a second 90 crossed the screen in two.
- **The cooldown** is kept across a landing as well as the charge (as the moment it's over, so it runs on while you're down).
- **The charge** is written to the session the moment a kill adds to it, not only every two seconds: at a low frame rate those writes were far apart, and a landing could come first.
- **Voices**: the owner decided the new lines ship with the clip-backed ones and sound blips for the rest; no voices job was asked for. If the lines without clips are wanted voiced, that's the desktop's voices job (the `desktop-jobs` skill).

## Checking it

- `npx vitest run src/components/universe/shipPowers.test.js src/components/universe/battlePowers.test.js src/components/universe/hunterRules.test.js src/components/galaxy/warfront.test.js src/components/universe/crews.test.js src/components/guide`. `hunterRules.test.js` holds Force Focus to its measure: twenty seeded four-TIE fights land 1 hit in the 5 s window with it on, against 8 without.
- `scripts/galaxy-powers-check.mjs` (with the dev server up; `BASE=` for its address, `OUT=` for the shots): `layout` (the tiles meet nothing else and take their clicks at four window sizes), `portal` (a hop at a planet with no lock comes out short with room to turn, and 5 off the ground it's refused), `war xwing|falcon|rv` (in a forced battle at Tatooine: Force Focus slows its fighters while its clock keeps time, Chewie's shots land, the magnet holds them, the crystal's blast takes hull off, and a magnet with nobody near is refused). Under software GL each takes minutes.

## Merging

- **Into `claude/gw-battles`' battle:** `battle.js`'s `moveBolts` gains `&& !b.ghost` on `youOk`; in the rewrite the same line is in `battle.js` (`const youOk = youIn() && !b.over;`). `warfront.js`'s `update` takes `you` in both branches: the battles branch passes `{ shield, down }` from `galaxy/scene.js`, this one `powers.warOpts`; pass one object with both (`{ shield: state.shield, down: Boolean(state.crash), ...powers.warOpts }`), and step the battle through `stepBattle(battle, dt, …, you ?? {})` where the battles branch calls `battle.update`. Then run `battlePowers.test.js`, `warfront.test.js` and the battle scenario tests.
- `galaxy/scene.js` is 2,537 lines and `universe/crews.js` about 3,000; both were already over 1,500. The new modules are all under 600.

## Still to do

- **The universe map (phase 2):** the same rules, effects and bar on the universe map (`universe/scene.js`, `UniverseMap.jsx`). `shipPowers.js`, `powerFx.js`, `PowerBar.jsx` and the hunters' hooks are shared already; what's needed is glue like `galaxy/powers.js` over the universe scene's own hit chain (its weapons, skirmishes, NPCs and the front's battle), its solids (`ship.js`'s `SOLIDS`) and its edge, and keys that don't meet the phone's G. The universe map's heavy rounds are already named Proton torpedoes and Fulminated mercury (`weapons.js`); the design asks whether to rename them.
- **Optional:** achievements for the powers, and anything more online than the existing cosmetic flags (a pilot through a portal vanishes for the others by the pose's own flag). Powers never touch another pilot, and nothing new goes on the wire.
- The death ray fires down the nose while the lock's tracking steers the nose toward the target's lead, so with aiming left to the lock it can miss a quick target for half a second or so.
