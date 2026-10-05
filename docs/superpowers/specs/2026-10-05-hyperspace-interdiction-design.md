# Hyperspace interdiction: design

Keep jumping about a galaxy far, far away (`/galaxy`, `src/components/galaxy/`) and the Empire notices. After ten to fifteen jumps an Imperial Interdictor cruiser is waiting on your lane: its gravity-well projectors pull you out of hyperspace short of where you were going, its TIEs launch, and the hyperdrive won't take again until you're clear of the well. Then you're on your way.

## The lore it leans on

The Immobilizer 418 Interdictor cruiser (a Star Destroyer's wedge with four gravity-well projector globes on its flanks) is the Empire's answer to a ship that keeps slipping away into hyperspace: its artificial mass shadows yank a ship out of lightspeed and hold it there. It's how the Empire sprang its traps in *Rebels* ("Stealth Strike") and across the old Expanded Universe, from Thrawn's campaigns on. Nothing here comes from the sequel trilogy (the site's rule: after *Return of the Jedi* only *The Mandalorian* and *Ahsoka*).

## What the visitor sees

1. **The count.** Every jump that gets as far as spooling up counts: a jump from the J key, from flying out of a system with the nose on a star, from the galaxy map, or from a link to another system. Coming round onto a bearing and then breaking off doesn't. The count is kept for the browser session (`sessionStorage`), so a page reload or a trip down to a planet and back doesn't wipe it.
2. **The trap.** The tenth to fifteenth jump of a cycle (the number is picked when the cycle starts) is the one. The tunnel is cut short somewhere in its middle: a jolt (shake, a flare, the camera kicked), the klaxon, and the ship drops out into the system it was headed for, but a long way out from the planet, in open space. Across the bow, broadside on, the Interdictor is coming out of hyperspace, smeared along its line of flight the way the universe map's Star Destroyers do. Its four globes glow. A faint shell shows the gravity well round it.
3. **The fight.** A moment later its TIEs launch (the Empire's, or the Imperial remnant's over the New Republic's worlds): the galaxy's usual hunters (`hunted.js` through `universe/hunters.js`), flagged `interdict`, four of them with a good chance of a TIE Advanced leading. They fight as hunters do, and online they're in everyone's sky as any pack is.
4. **The hold.** While the well holds you the hyperdrive won't spool: J, the map and links say so (the panel's banner turns red: "Interdicted: the Interdictor's gravity well holds you. No jump till you're clear of it.") and the sublight drive doesn't open up out in the open (the well holds the boost to the boost). The crew say what's happened, in their own voices.
5. **Getting clear.** Any one of: shoot the pack down; outrun them (they give up as hunters do) and fly out past the well's edge; or ride it out (a minute). Then the crew say the drive's back, the banner goes, the hyperdrive spools on the next J, and the Interdictor jumps away once its fighters are gone (as the Star Destroyers do). The count starts again, with a fresh number.
6. **An achievement**: *Interdicted*, for getting clear of the well the first time.

## Where it lives

- `src/components/galaxy/interdiction.js` (pure, tested): the count and the trap. `createInterdiction({ rand, store })` → `{ jumps, due, total, jumped() → { n, due, interdicted }, clear(), reset() }`; `store` is `{ get(), set(s) }` over a string (the scene passes `sessionStorage`). `INTERDICTION` holds the numbers: `jumps: [10, 15]`, `cut: [0.4, 0.65]` (where in the tunnel it bites), `far: 2.4` (how much further out than a normal arrival you drop), `well: 150` (map units), `hold: 60` (seconds, at most), `launch: 1.8` (seconds before the TIEs come). Also pure: `cutAt(dur, rand)`, `dropPoint(arrival, far)` (the arrival pushed out along its own bearing), `interdictorPlace(ship, side)` (ahead and off to one side, broadside on, where the TIEs launch from), `inWell(ship, at, r)`.
- `src/components/galaxy/interdictor.js`: the set piece, in three.js. `createInterdictor(parent, { models, small })` → `{ arrive(ship) → { hangar, at, heading }, leave(), update(dt, t) → busy, here, at, dispose() }`. The cruiser is a code-built hull (`fleetRebels.js`'s `interdictor`: the Star Destroyer's wedge at 600 m with four globes on the flanks, lit) placed through `models.slot`, with the drop-in smear and flash from `universe/setpieces.js` done the same way, the globes pulsing, and the well drawn as a thin fresnel shell round it, rippling.
- `src/components/galaxy/scene.js`: the jump counts as it spools; a jump that's due is cut at `cutAt`, drops at `dropPoint`, places the Interdictor, launches the pack with `interdict: true`, sets `state.interdicted`; `startJump` refuses while it's set (emits `{ type: 'jump', phase: 'held', to }`); the boost is held to `SHIP.boost` in the well; the hold lifts on cleared/escaped, out of the well, or the timer, with `{ type: 'event', id: 'wellclear' }`; the piece leaves once the hunters are gone. Events out: `{ type: 'interdicted', to, from }` as it bites (the comms already know the word and the klaxon).
- `src/components/galaxy/lines.js`: `interdicted` for all four crews (the galaxy's own words: hyperspace, the Interdictor, the well), laid over the crew's own by `galaxyCrew`; `events.wellclear`. `lines.test.js` checks both.
- `src/pages/Galaxy.jsx`, `GalaxyPanel.jsx`, `galaxy.css`: the red banner while interdicted, the held nudge, the achievement.
- `src/components/Achievements.jsx`: `interdicted`.

## What it doesn't do

- The Interdictor is yours alone: other pilots online see your TIEs (as they see any pack) but not the cruiser. A shared one would need it on the wall clock and on the wire; later, if ever.
- The universe map's own hyperspeed jumps don't count toward the galaxy's tally; the universe map has its own ambushes already.
- The cruiser can't be destroyed. Its fighters can.

## Order of work

1. This spec and the plan (PR 1).
2. The rules (`interdiction.js` and its tests), the hull, the lines, the achievement (PR 2).
3. The set piece and the scene, the page and the panel; looked at in a browser (PR 3).
4. The README and `docs/architecture.md` (PR 4, or with 3).
