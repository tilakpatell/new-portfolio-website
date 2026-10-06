# Missions as quests: Lothal's *The Star Map*, and a way for more

Endor's chase (`2026-10-05-endor-chase-design.md`) made the first briefing playable, with rules of its own. Most of the galaxy's other missions are a run of things the surface's quest engine already does (`surface/quests.js`: ride, reach, race through gates against the clock, shoot what fires back, use something, with lines and effects). So a mission can be a quest: `missions/index.js` gives it `kind: 'quest'`, a start, a ride and the quest itself, and the surface scene runs it as it runs any quest, from the start, to the result card.

## Lothal: The Star Map

The briefing's three objectives, on Lothal's plains (`sites/outer.js`):

1. **The run**: on Sabine's speeder bike from the landing out between rock spires (Lothal's own line is "tall grass to the horizon, stone spires": spires now stand there, in a slalom along the way and scattered beyond), through six gates to the old Imperial tower, inside 40 s (at full throttle it's about 10 s; the time is for a run with a crash or two in it).
2. **The map**: at the foot of the tower, fit the map together (E).
3. **The tower**: Shin Hati's mercenaries come for it; bring down six, then Shin Hati herself, who closes in with a lightsaber.

Won: the time over the whole mission, stars (under 60 s, under 90 s), your best, the `starmapride` achievement. Lost: out of time on the run, or knocked down; Again starts from the bike.

The tower is a place of Lothal's own (`tower`, the surface's `lookout`), and a speeder bike waits by the landing for anyone exploring, not only the mission.

## How

- `missions/index.js`: the mission (`kind: 'quest'`, `ride`, `start`, `yaw`, `stars`, `achievement`, `lines`, `quest`), and `outcomeOf(events)`, pure and tested: a quest's `done` is won, its `fail` is lost.
- `surface/scene.js`: with a quest mission, start on its ride (no landing), begin its quest once the world's in, keep its clock, and end it on its outcome or on being knocked down; `questOf` knows the mission's quest; Again restarts both. The mission view is the chase's shape (`phase`, `t`, `result`), so the page's card serves both.
- `ChaseHud.jsx`: for a quest mission, only the result card (the quest's own panel shows the steps); every mission's `ends` gives the card its titles and a line for each way to lose, so the card isn't the chase's alone.
- `pages/GalaxySurface.jsx`: the mission's own quest isn't one of the world's (no toast, not in the done list, no Drop it).
- `systems.js`: Lothal's game live, "Ride it now".

## Done when

- Tests: the mission's steps are the engine's, its spawns are figures that exist, its gates and the tower are on the site, and `outcomeOf` reads the events right.
- In Chromium: `/galaxy/lothal/surface?mission=starmap` starts on the bike with the run's first gate on the compass; development hooks reach won and lost; no console errors.
