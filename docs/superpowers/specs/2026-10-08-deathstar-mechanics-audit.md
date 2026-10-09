# Aboard the Death Star: mechanics audit

The owner reported on 8 October 2026: "E as an Imperial doesn't work. Vader doesn't travel correctly in the story. The game AI needs improvement. The models can get stuck and freeze. Some viewing angles let you see through models."

This document records what the audit measured, the root cause of each problem, and the fix. Every finding was reproduced in Node through `rules/game.js`'s own `step()` before it was fixed.

## How it was measured

- **Autoplay.** `rules/play/autoplay.js` plays a story the way a person at the keys would: it walks the way `route.js` gives, rides the lifts, presses E at whatever a step names, picks talk lines, lies low and fights. Nothing is fed to the story behind the game's back. With your health topped up each step, all four stories (both stations, both sides) are played start to end. The run records the first step where a story stalls for 150 s.
- **E at every story target.** For each use, talk and choose step, you stand next to its target, facing it, and press E.
- **The camera.** It is posed from every 1.5 m of floor in every room, facing eight ways at three pitches. The audit counts poses where the eye ends up inside furniture or a ship.
- **Walkers.** Every room is visited in free roam, and the audit counts anyone near you who is walking without moving.

## Findings and root causes

| # | What the owner saw | What was measured | Root cause | Fix |
|---|---|---|---|---|
| 1 | E doesn't work as an Imperial | DS2 Imperial's first step (take the shuttle's call at the console) can't be done. Neither can DS1 Imperial's door override (`ctl-door`) or the beacon on the Falcon's hull. On the Rebel side, the AA-23 intercom, the dianoga and the comlink fail too. | A step's target that isn't a tagged prop or a person was never something E could reach. That covers a spot, a carried item, a person who is meant to be used, and a prop whose tag differs from the target's (`beacon-spot` against `beacon`). A talk step whose target was a thing told the story `used` and never opened the talk. | `act.js`'s `stepAt`: E does the current step's work at whatever it names (a person, a prop, a spot or a carried thing), and opens that step's talk for a talk or choose step. |
| 2 | (the same) | After a beat is failed, the comlink is gone, so the compactor can't be survived. | Checkpoints never kept what you carry, and `restore` emptied `g.items`. | Checkpoints fold `items`, and `restore` puts them back. |
| 3 | Vader doesn't travel correctly | On DS2 as a Rebel, the dock garrison sees Luke, raises an alarm and seals the dock. Vader and the Royal Guards run off ("flee"), and the escort can never be finished. | Nothing told the garrison that Luke was Vader's prisoner. Unarmed Imperials (Vader and the guards carry blades, not guns) flee from a hostile Rebel. Vader also followed Luke instead of leading him. | The story flag `prisoner`: nobody of the Empire's fights you unless the story says so. A new `lead` routine walks you to a spot and waits whenever you fall 5 m behind. |
| 4 | (the same) | On DS2 as an Imperial, the Emperor, Vader and the guards stand still at the ramp for the whole 40 s procession. | They were spawned as `scripted` with no script. | A script for each: Vader kneels, the Emperor says "Rise, my friend" and walks the aisle, and his guards follow two by two (new spots `aisle-*`). |
| 5 | Models get stuck | With real inputs, both DS1 stories stall at the control room's door. Searchers stick in cell doorways. | (a) A route between two doors in the same wall runs along the wall's own line, so a body meets the doorway's jamb end on and can't slide past it. (b) `route` gives no way at all from a point diagonally beside a box's corner. The clearance was measured as straight-line distance, but the box is grown square, which takes the point inside. | (a) `nav.js`'s `aprons`: a leg that runs along a door's wall meets the door square, from a point 0.8 m out. (b) `outOf`: the clearance an end gets from a box is the distance it stands out on its furthest-out side. |
| 6 | (the same) | An escort was never finished when the one you walk with arrives after you. | Arrivals were told to the story only when your room or spot changed. | The story is told again while you wait at a spot, whenever who is with you changes. |
| 7 | See through models | 3.5% of camera poses on DS1 and 1.5% on DS2 ended inside a solid. They are almost all in the bays, the dock and Hangar 272, inside the Falcon, the Lambdas and the TIEs. | The camera stopped at walls only. | `wallHits` also stops at the solids of the rooms the line starts and ends in (boxes with their heights, and round ones). Now 0%. |
| 8 | The game AI | Vader's duels and the Emperor's lightning never ran. On every station, Vader, the Royal Guards and the Emperor flee a hostile Rebel. | `force.js`'s `vaderMind` and `emperorMind` and `saber.js`'s duel model were written and tested but never called. Anyone without a gun is frightened. Hostile people with a script never fight. | The duel layer (next PR): blade fighters close in and fight with `saber.js`'s strokes, guards and parries. Vader pushes and chokes, the Emperor throws lightning, and your blade strokes, guards and parries against them. |

## Not changed

- Searchers sometimes stand a few seconds in a cell doorway before going on, and free-roam patrols walk as they should. The 400 s or so of "walking without moving" in the first walker audit was people who were asleep (more than three doors from you), not stuck.
- A lockdown still seals a section for 10 s after the last sighting. That is part of the game, and the HUD says "Sealed".

## Held by tests

- `rules/play/act.test.js`: E at every story target, on both sides of both stations.
- `rules/nav.test.js`: a way out from beside a box's corner, and a leg from one door to another in the same wall that stays off the wall.
- `rules/story.test.js` and `rules/stories/stories.test.js`: checkpoints keep what you carry.
- `rules/play/play.test.js`: Vader's prisoner walks the dock with no alarm, and his guards don't flee.
- `scene/camera.test.js`: the camera stops at a box at its height and at a pillar, and passes over a low crate.
- The autoplay run (`rules/play/autoplay.js`) finishes every story.
