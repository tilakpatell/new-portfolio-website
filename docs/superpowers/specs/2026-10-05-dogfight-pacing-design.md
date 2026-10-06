# Dogfights you can win, and traffic that lives: design

Date: 2026-10-05. Status: written from the user's request; built and merged
in parts, each its own PR.

## Intent

What the user said: "The enemies that attack in space are very very fast
making it hard to fight them and lock on. Improve these mechanics really
well. Also improve traffic and overall universe density and make cool
things."

What that means here: the hunters on the universe map (and in the galaxy,
which flies the same rules) fly their attack runs at their top speed, 19 to
26 map units a second, against a ship that cruises at 5.5 and turns at 2
radians a second. A TIE crosses the whole gun range in well under a second,
turns twice as fast as you can, and is past before the lock has settled.
The fix is pacing, not nerfing: a fight should happen at the pilot's speed,
with the guns helping the nose onto what they're locked to, the way
Battlefront's and Squadrons' do.

## Decisions

Made for the user, who asked for this to be done without checking in.

- **Pure rules stay pure.** Everything is numbers in `hunterRules.js` and
  `targeting.js`, tested in Node; `scene.js` only reads them. The galaxy's
  hunters (`galaxy/hunted.js`) get the same without a change there.
- **The fight envelope.** A hunter in the fight (swinging out to its
  station, or on a run) flies at a speed matched to yours: a little faster
  than you (`FIGHT.match` times yours, plus `FIGHT.margin`), never under a
  floor of its own top speed (`FIGHT.floor`) and never over its top. Far
  off (past `FIGHT.closeFrom`) it closes at its top speed, so a pack still
  arrives; inside `FIGHT.engageAt` it's wholly at the fight speed. Swinging
  out to its station it hurries the further the station is (`FIGHT.hurry`),
  so it gets out ahead of you to turn in and a run comes from in front. So at
  cruise a TIE comes past at about 9, not 19, and a pass takes seconds; boost
  and it opens up with you, a TIE still a shade slower than your boost (you
  can outrun one), an interceptor not. A pack after prey flies at the floor.
- **Fighters turn like fighters.** Their nose rate comes down to a little
  over yours at cruise (`turnRate`), and drops with speed as yours does
  (`turnRateAt`, `FIGHT.stiff` of it gone at top speed): the quick pass is
  a straight one, and the turn-in is wide enough to follow.
- **A lock that holds.** The pick-up cone widens to about 29°, the hold to
  60°, and a target slipping out of it gets two seconds' grace. The hit box
  on a hunter is a touch bigger (`hitRadius`: `size * 0.9 + 0.12`, shared
  with the hunters seen in another pilot's sky).
- **The nose follows the lock.** With a lock and its lead point inside
  `AIM.trackCone`, the stick gets a nudge toward the lead (`trackNudge`):
  up to `AIM.trackMax` of full stick, proportional to the angle off, fading
  to nothing at the cone's edge, and letting go on any axis the pilot
  pushes the other way. Only for a lock on a hunter, one picked by hand, or
  one just fired at (not a passing pilot or a part of the Citadel the guns
  happened on), and never in the whole-map view. A new slider, Lock tracking (`controls.js`
  `track`, 0 is off), scales it. The autopilot and a jump take no nudge.
- **Traffic lives.** More groups and flybys; ships that come in to a place
  and dock (shrinking into it) and launch out of it, only where there's
  something to land on (not a star, the black hole, a nebula or the Star
  Wars gate); fighter wings that peel apart after a flyby; civilians that
  run while a fight is on; bigger convoys. The belt and the dust are
  denser.
- **Friends in a long fight.** A wing of two (X-wings for Luke and Han,
  Birdperson for Rick, either for Walt and Jesse) comes up from behind
  when a hunt drags on or the shields run low, once a hunt. It covers you:
  each goes only after a hunter coming at you, makes a pass of a few
  seconds and comes back on your wing, fires real bolts that miss more
  than they hit, and leaves once the sky is clear (`wingRules.js`, pure and
  tested; `wingmen.js` draws it). A help, not a turret: on its own it takes
  most of half a minute to see off a pack of three. `deepspace.js`, `planets.js`,
  `stations.js`, the hulls and the hangar are another session's and aren't
  touched.

## Checked how

Vitest for every rule: the envelope (at cruise a TIE's wanted speed is near
yours, far off its top, boosting its top), the turn (slower at speed), a
whole fight at cruise flown at the fight speed and still shot at, the
nudge (toward a target right, up, with the bank allowed for, none past the
cone or with the setting off, giving way to the stick), the lanes (docking
ends at the place, launching starts there, both clear of everything). Lint,
tests and the build clean before each merge.
