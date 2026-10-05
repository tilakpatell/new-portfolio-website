# Web-swinging: how Insomniac do it, and how the compound does it

Research behind the swinging at Avengers HQ (`src/components/avengers/world/rules.js`, the "swinging, and climbing" section). Insomniac haven't published their code, so this is put together from what their developers have said in interviews and at GDC, the classic Spider-Man 2 (2004) write-ups, and three open re-creations whose source can be read. Nothing here is copied from any of them: the compound's code is its own, built on the ideas.

## What Insomniac have said

- **Webs stick to real things.** Every web has to attach to a point on the edge of a building or a tree, and the city's architecture is tagged with where webs can go. The engine picks the swing point that keeps your momentum and keeps you heading where you're going. ([Variety](https://variety.com/2018/gaming/news/spider-man-tech-insomniac-interview-1202930094/), [PlayStation Blog](https://blog.playstation.com/2018/09/06/insomniac-interview-the-tech-behind-marvels-spider-man/))
- **It isn't pure physics.** A perfectly simulated person on a rope wouldn't feel like a superhero. Physics is used for collision, but custom "hero states" drive the swing. ([PlayStation Blog](https://blog.playstation.com/2018/09/06/insomniac-interview-the-tech-behind-marvels-spider-man/), [Game Developer](https://www.gamedeveloper.com/design/making-insomniac-s-i-spider-man-i-do-what-a-spider-can))
- **A push off the buildings.** Swinging from an anchor on a building would naturally carry you into that building, which makes it hard to swing down the middle of a street, so the game adds a force out from the building. Streets were also made narrower than real ones, to keep the swing angles steep. ([report of the director's comments](https://thafcc.wordpress.com/2018/09/13/marvels-spider-man-ps4-game-twists-physics-to-make-web-swinging-super-fun/))
- **Release timing is a mechanic.** Letting go at the end of the swing launches you forward; letting go early sends you down toward the street. ([Game Developer](https://www.gamedeveloper.com/design/making-insomniac-s-i-spider-man-i-do-what-a-spider-can))
- **Recovery, not punishment.** Hitting a building turned into running up it and jumping off, because playtesters found stopping dead frustrating. ([report](https://thafcc.wordpress.com/2018/09/13/marvels-spider-man-ps4-game-twists-physics-to-make-web-swinging-super-fun/))
- **Make the player feel better than they are.** Hang time and carried momentum were chosen over realism. ([Cheat Code Central](https://www.cheatcc.com/articles/how-insomniac-tuned-spider-man-s-swing-to-feel-so-fast/))
- **The camera sells the speed.** Field of view and follow distance both grow with speed (which ends up as a dolly zoom), each web shot bumps the field of view, and the camera's pitch follows the arc. ([analysis of the swing camera](https://jbsiraudin.github.io/blog/spiderman-dolly)) The GDC 2019 talk on it all is Doug Sheahan's [*Concrete Jungle Gym: Building Traversal in Marvel's Spider-Man*](https://www.gdcvault.com/play/1026084/Concrete-Jungle-Gym-Building-Traversal).

## Spider-Man 2 (2004), where it started

Jamie Fristrom's swinging attached to real geometry by casting rays out from the character, held him on a rope by projecting him back onto the sphere round the anchor whenever he got further than the rope's length, and kept a *desired* rope length apart from the current one so the rope could shorten smoothly to keep him off the ground. He hangs with his up along the rope. Steering in the air helps, and walls should push you back gently rather than stop you. ([Tuts+, Spider-Man 2 and Energy Hook swinging](https://code.tutsplus.com/swinging-physics-for-player-movement-as-seen-in-spider-man-2-and-energy-hook--gamedev-8782t))

## Open re-creations read for this

- [spider-man-nyc](https://github.com/SBhat2026/spider-man-nyc) (Three.js on real Manhattan data): anchors scored by how far ahead, how steeply up and how far away they are; velocity turned toward where you look at about 1.15 rad/s ("swing where you look"); gravity eased at the top of a flight for hang time; a quarter-second beat before the next web after letting go, because spamming webs farmed speed; a small extra kick for letting go on the rising part of the arc.
- [spiderbench](https://github.com/xikhar/spiderbench) (Three.js; view-only licence, read and not used): a "desired anchor point" ahead and above, further with speed, kept within a height band over the street so chains dip back into the canyon rather than climb the skyline; anchors on faces the player is well in front of, between about 30° and 75° up; a check that the arc down to its lowest point is clear; a swing's bottom kept no more than about 6 m under where it caught, so chains hold their height; a push off facades alongside; corner swings biased toward the street you're turning into.
- [Spider-Man movement engine for Roblox](https://github.com/TheStrongestOfTomorrow/Spiderman-Roblox-Script): alternating hands by which side the anchor is on, procedural arm aim and body roll into turns, dive speed converted into the swing, a quick forward web zip, corner whips, wall-sprints and ledge vaults.

## What the compound does, and where

| Idea | In `rules.js` |
| --- | --- |
| Webs only stick to real things: every roof edge, the lawn's trees, the firs round it, the floodlight masts | `ANCHORS` (`edgeAnchors`, `woodsAnchors`, `MASTS`) |
| Swing about a point a couple of metres out from the wall, not the wall itself | `edgeAnchors` (`OUT`) |
| A desired point ahead (further with speed) and above (within a height band over the ground); anchors scored by distance to it, angle up (26° to 75°), sideways offset; in front of their wall; line of sight and a clear arc | `aimWeb` |
| Steering bends the search toward where you want to go | `aimWeb(h, turn)` |
| The hand on the anchor's side | `aimWeb` → `hand` |
| A rope: projected back onto the sphere, pulls but never pushes | `stepAir` |
| Desired rope length: clears the ground and roofs, and dips no more than 6 m under where it caught | `ropeFor`, `SWING.dip` |
| Swing where you steer: velocity turned toward the stick, speed kept | `steerToward`, `SWING.assist` |
| Push off a wall alongside, and move the pivot with it | `alongside`, `SWING.push` |
| The swing pumps along its arc, but never past a 72° arc | `SWING.pump`, `SWING.pumpMax` |
| A dive into a web turns the fall into speed | `attach`, `SWING.dive` |
| Let go on the way up: flung on and up; on the way down: dropped; past the anchor on the upswing: a perfect release and a flip | `letGo`, `SWING.release`, `SWING.perfect` |
| A beat before the next web, so spamming webs doesn't pump speed | `SWING.rearm` |
| Hang time at the top of a flight | `SWING.hang` |
| A web zip: a burst along the way he's going, twice a flight | `webZip`, `SWING.zip` |
| Hitting a wall runs him up it with the speed he hit it with; a jump kicks off; over the top onto the roof | `stepWall`, `SWING.wallRun` |

And in the drawing (`scene.js`, `swing.js`): the rig's swing pose with the web arm up the line and the body along it, leaning into turns; a forward flip on a perfect release; a field-of-view bump on every web and zip; field of view and camera distance growing with speed; the camera's pitch following the arc; the web shot out in a blink and a splash where it stuck; a mark on the anchor the next web would catch.
