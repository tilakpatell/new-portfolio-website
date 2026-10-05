# The first galaxy mission you can play: Endor's speeder bike chase

The galaxy (`/galaxy`) gives each of its eighteen systems a mission. Two are live (the trench run and boarding the Death Star); sixteen are briefings (`systems.js`, `status: 'soon'`). The plan for them is `2026-10-05-galaxy-games-design.md`. This is the first one built: Endor's, *The Speeder Bike Chase*, on the surface engine that's already there (`galaxy/surface/`), because Endor already has the forest, the speeder bikes, the scout troopers, the bunker and the riding.

## What a visitor gets

From the Endor briefing (`/galaxy/endor/mission`), **Play** opens `/galaxy/endor/surface?mission=chase`. No landing: you're on a speeder bike at the scout troopers' camp, four scouts already racing off through the redwoods for the bunker. A three-second count, then go. Catch them: shoot them off their bikes, or come alongside and shove them into a tree. A scout reaching the bunker raises the alarm and the mission's lost. All four down and it's won, with your time, stars, your best, and **Again** or **Back to the system**.

- The bike's cannon fires forward (F, the touch Fire button), with a little aim assist toward a scout near the line of fire.
- Trees don't move. Hit one hard and you're thrown off and back on a second and a half later (a time penalty, never the end).
- The scouts shoot back over their shoulders when you're on their tail; health comes back as everywhere on the surface, and running out only throws you off, as a tree does.
- The scouts quicken when you're close and ease off when you've fallen far behind, so it stays a race.
- Your crew say a line at the start, at the first scout down, when one's near the bunker, and at the end: the site's own words, per ship's crew.

## Units

- `galaxy/surface/missions/chase.js` (pure, tested): the route, the scouts and the result.
  - `planRoute(waypoints, solids, opts)`: the waypoints sampled every few metres and pushed clear of every trunk and rock by a margin, then smoothed; `{ pts, len, at(s), project(x, z) }`.
  - `newChase(mission, route)` and `stepChase(chase, dt, { you, solids })` → events (`count`, `go`, `down`, `bump`, `shoot`, `escaped`, `won`, `lost`). Scouts move by distance along the route, at their own speed and lane; a shove or a hit knocks them off their lane, and a scout that meets a solid at speed is down.
  - `hitScout`, `knockYou`, `aimAssist`, `starsFor`.
- `galaxy/surface/missions/index.js`: the missions, by system (`MISSIONS.endor.chase`): waypoints, scouts, speeds, lanes, stars, lines, achievement.
- `galaxy/surface/missions/chaseScene.js`: the drawing. Each scout a speeder bike (`placer`'s, as the rides are) with a scout trooper on it (`figures.js`), placed from the rules each frame; their blaster fire through the surface's `blaster`; a flash and a tumbling bike when one goes down.
- `galaxy/surface/scene.js`: with `ctx.mission`, start on the mission's bike at its start (no landing), fire while riding, the mission's crash rule in place of the respawn, and the mission's state out to the page.
- `pages/GalaxySurface.jsx` and `galaxy/surface/ChaseHud.jsx`: the count, the scouts left, how close the leading scout is to the bunker, the clock, and the result card.
- `systems.js`: Endor's game `status: 'live'`, `to: '/galaxy/endor/surface?mission=chase'`. `Achievements.jsx`: `speederchase`.

## Kept for later

Online: the chase is solo; other pilots on Endor still show as they do on its surface. A shared chase (scouts on the wall clock, `down` told to the room) is the galaxy-games spec's way, for when a second mission wants it too.

## Done when

- `chase.test.js` covers the route staying clear of solids, scouts moving and escaping, a shove into a tree, a shot taking a scout down, the won and lost results, aim assist and stars.
- In Chromium, `/galaxy/endor/surface?mission=chase` starts on the bike with four scouts ahead; a DEV-hook run catches them and reaches the result card; another lets one escape. Screenshots of the chase and the card.
- Lint, the tests, the build and the smoke check green.
