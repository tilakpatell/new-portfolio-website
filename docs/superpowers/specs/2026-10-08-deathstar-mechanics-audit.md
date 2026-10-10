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
| 8 | The game AI | Vader's duels and the Emperor's lightning never ran. On every station, Vader, the Royal Guards and the Emperor flee a hostile Rebel. | `force.js`'s `vaderMind` and `emperorMind` and `saber.js`'s duel model were written and tested but never called. Anyone without a gun is frightened. Hostile people with a script never fight. | `rules/play/duel.js`: blade fighters close in and fight with `saber.js`'s strokes, guards and parries. Vader pushes and chokes, and the Emperor throws lightning, which is halved through a guard and never kills on its own. Your blade strokes light (fire), heavy (fire with your guard up), guards and parries (aim) and dodges (jump). A story's Vader gives ground at half his health and is never killed. His blows take 60% of their duel damage off you, and a Royal Guard's take 45%. |

### Found along the way, by playing every story with the keys alone

| # | Where the story stopped | Root cause | Fix |
|---|---|---|---|
| 9 | DS1, the control room's door: Chewbacca never comes out | He is 2.28 m tall, and the door is 2 m, so the wall over it blocked him for good (Vader, at 2.03 m, too). | The wall over a doorway carries `over` (`layout.js`). Someone taller than a man stoops under it when the door is open (`walker.js`). |
| 10 | DS1, walking Chewbacca to Level 5 as your prisoner | The bay's corridor door is the Empire's only, and companions were refused it while you passed in armour. The garrison treated him as an enemy, and he fled from them. | Whoever walks with you goes through the doors you may (`canPass`, and the doors' `near`). Your companions and the garrison see each other as you and the garrison do (`perceive`). |
| 11 | DS1, shooting out AA-23's cameras | The cameras were tagged `cameras`, while bolts only break `aa23-camera-N`. A bolt also had to strike the wall near a camera, and they hang well out from it. | Each camera is tagged by its spot's name. The counted things in your room stand in the bolts' way as targets (`battle.js`). |
| 12 | DS1, the compactor | The route (and the HUD's marker) led to the sealed hatch. The way down is the chute, a jump, and routes never took jumps. The comlink then lost E to the hatch's keypad, so the walls crushed you on every try. | `routeTo` goes only by doors you can open, then by a jump that lands where the target is ("Way on" on the marker), then through a locked door as a last resort. What the step names comes first for E. Those with you come down the chute after you. |
| 13 | DS1, the chasm | Shots kept landing while the swing scene had the keys, and you died in it. | Nobody is shot while a scene plays. |
| 14 | DS2, Vader's duel | Vader's blade stayed unlit and he stood in no stance, because a scripted fighter never counted as raised. | His blade is lit and his stance held while `duel.js` has him fighting. |

## Second round (9 October)

The owner reported: "In free roam, when I go up the stairs to the room and press E, it doesn't work." That room is Docking Control 327, up the stair from Bay 327. Its consoles had no tag, so E was never offered at them. The second round measured every prop and every member of the crew in free roam, every story scene's camera, and ten minutes of free roam on each station.

| # | What was measured | Root cause | Fix |
|---|---|---|---|
| 15 | In free roam, E did nothing at any console, bank, terminal, crew station, screen or intercom. That includes Docking Control's consoles up the bay's stair. | Only tagged things could be used, and furnished consoles carry no tag. | `rules/play/readouts.js`: such a console reads out lines about its room (a bay's traffic, a block's cells, the command centre's fleet), in turn. It reports the section's security when the section isn't calm. |
| 16 | E did nothing in front of 40 of the crew: officers, the superlaser's gunners, Death Star troopers, TIE pilots, the Royal Guards, the Gonk and mouse droids, and Leia in free roam. | A talk was found only for stormtroopers, technicians and the archivist, or for anyone the story names. | `rules/talks/crew.js` gives small talk to anyone who passes for one of the crew's own. The Royal Guards say nothing, and the droids answer anyone. In free roam, Leia walks with you once she is rescued. |
| 17 | A patrolling trooper you talked to walked off mid-sentence. | The talk didn't reach the crew's minds. | Whoever you talk to stops, turns to you and plays the talk clip until the talk ends (`stepCrew`'s `talking`). |
| 18 | At the superlaser's switch, E read out the crew station beside it. With an operator standing at the switch, E opened small talk instead. | The nearest thing won, whatever it was, and people always came before things. | A tagged thing is reached before a console that only reads out, and before a seat. A tagged thing as squarely before you as a person comes before small talk with them. Among equals, a thing in front of you comes before one behind you. |
| 19 | E sometimes missed what the crosshair was on. | E reached along the body's facing. While you stand, a glance of up to a radian doesn't turn the body. | E reaches along where the camera looks (`you.look`). |
| 20 | No seat could be sat in. The officers at the conference table sat with their hips through their chairs' backs, and the throne's sitter sank into its seat. | Sitters were placed at the seat's middle, while the sit clip puts the knees over its origin and the hips 0.33 m behind. | E sits you in an empty chair, bench, throne or meditation chamber, and E or a step stands you up. `rules/seats.js` puts every sitter's figure at the seat's front edge, lifted to its top. The throne's seat is now as deep as one sits in. |
| 21 | Luke's saber stayed on the throne's armrest after you took it, or after the Emperor pulled it to Luke. E kept offering it. | The saber was merged into the room's mesh, and nothing checked whether it had been taken. | The saber is drawn on its own and hidden once `saber` is carried (and shown again if a checkpoint goes back). E isn't offered there once you have it. |
| 22 | The talk box and the subtitle under it showed the same line twice. | Both showed every line said. | A line the talk box shows isn't repeated in the subtitles. |

Measured and found sound:

- **Every story scene's camera** (all four stories played by autoplay, every shot sampled every half second): every camera stands in a room. The only lines to the subject that a wall cuts are into the command centre's window (the superlaser's shot, which looks out through the glass) and over the chasm (where the line dips past the ledge's floor height).
- **Ten minutes of free roam** on each station, touring rooms at random: nobody walked on the spot in your room, and nobody stood outside a room or inside furniture, apart from sitters in their seats.
- **The second station's Imperial procession**: Vader kneels, the Emperor says "Rise, my friend" and walks the aisle, and his guards follow him.

## Not changed

- Searchers sometimes stand a few seconds in a cell doorway before going on, and free-roam patrols walk as they should. The 400 s or so of "walking without moving" in the first walker audit was people who were asleep (more than three doors from you), not stuck.
- A lockdown still seals a section for 10 s after the last sighting. That is part of the game, and the HUD says "Sealed".

## Held by tests

- `rules/play/act.test.js`: E at every story target, on both sides of both stations.
- `rules/nav.test.js`: a way out from beside a box's corner, and a leg from one door to another in the same wall that stays off the wall.
- `rules/story.test.js` and `rules/stories/stories.test.js`: checkpoints keep what you carry.
- `rules/play/play.test.js`: Vader's prisoner walks the dock with no alarm, and his guards don't flee.
- `scene/camera.test.js`: the camera stops at a box at its height and at a pillar, and passes over a low crate.
- `rules/play/duel.test.js`: Vader closes in and cuts, a guard turns his strokes, your blade beats him down, the story's Vader yields at half health, the Royal Guard fights, and the Emperor's lightning burns but never kills.
- `rules/route.test.js`: the way to the compactor goes by the chute.
- `rules/walker.test.js`: one taller than a man stoops through an open low door.
- `rules/play/autoplay.test.js` (opt-in: `DS_AUTOPLAY=1`, and `DS_AUTOPLAY_SEEDS=1,2,3` for more seeds): all four stories played start to end with the keys alone. All four finish.
- `rules/play/act.test.js`: in free roam E does something wherever it is offered (consoles' readouts and seats included); the crew talk; the one you talk to stops and turns to you; E reaches along the look; the superlaser's switch beats the console beside it; a seat is sat in, held and stood up from, and isn't offered while someone sits in it.
- `rules/seats.test.js`: a sitter is drawn with the knees at the seat's front edge, at the seat's height, anywhere along a bench.
- `rules/talk.test.js`: the crew's small talk, by who you pass for.
- `scene/clips.test.js`: every clip the scene asks for is in the library.
