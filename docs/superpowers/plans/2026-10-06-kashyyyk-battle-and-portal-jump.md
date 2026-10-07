# Kashyyyk's battle and Rick's portal jump: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On Kashyyyk's beach the Republic (clones and Wookiees) and the Separatists (B1s and B2s) fight a battle that never ends, with rigged soldiers who carry guns and think for themselves. Rick's cruiser goes through a real 3D portal on the universe map and in the galaxy: you see it fly into the gate and out of the next one.

**Handoff:** `docs/superpowers/plans/2026-10-06-kashyyyk-troops-and-portal-handoff.md` (the owner's words, the diagnosis and the outline this plan follows).

**Architecture:** The fight's rules are a pure, seeded module (`surface/skirmish.js`), tested in Node, in the style of `missions/assault.js`. A scene part (`surface/skirmishScene.js`) draws it the way `missions/assaultScene.js` draws an assault. A site opts in with `site.skirmish`. The soldiers are the Meshy-rigged Battlefront models already in `public/models/galaxy/troops/`, loaded once a kind and copied (SkeletonUtils) for each soldier, walking on Rick's clips plus six combat clips. The jump is a shared 3D gate (`lib/three/portalGate.js`) that both maps open in front of the cruiser and at its arrival point. The page overlay gets a "staged" mode that stays clear while the ship goes in and opens back up while it comes out.

**Tech stack:** React 19, Vite 8, three.js, Vitest 5 (plain Node, no DOM), Playwright with the container's Chromium for captures.

## Global constraints

- No API keys: no new models. Everything uses what is in the repo.
- Lint (`npx eslint .`), tests (`npx vitest run`) and the build (`npx vite build`) clean before the push.
- Gun kinds go in the middle of `GUNS` (another branch adds at the end).
- A figure whose model never loads still fights (as a built figure or nothing) without throwing.
- Reduced motion: the portal jump falls back to the overlay as it is today. The battle still runs, without camera shake.

## Review focus

- The rules must stay deterministic for a seed and never produce NaN positions over ten minutes of play.
- Line of sight respects heights: a 1.25 m barricade hides a kneeling soldier and lets a standing one fire over it.
- At most three enemies fire at you at once.
- Shared figures: copies share geometry and materials. Nothing per soldier may write to a shared material.
- The jump's clipping planes must be removed and the ship's own materials put back, even when the jump is cut short (page left, reduced motion, Interdictor).

---

### Task 1: The soldiers' figures

**Files:** `src/components/galaxy/surface/crew.js`, `crew.test.js`, `src/components/universe/footScene.js` (one export)

- [ ] `CREW` gains `clone`, `battledroid`, `superdroid`, `stormtrooper`, `snowtrooper`, `hothtrooper`, `sandtrooper`, `scouttrooper`, `shoretrooper`, `deathtrooper` (`/models/galaxy/troops/<kind>.glb`, their real heights) and `wookiee` (chewie.glb, 2.2 m).
- [ ] Rigged crew load once a URL (template), each figure a SkeletonUtils copy rigged with Rick's idle, walk and run (`footScene.js` exports `rigCopy`).
- [ ] `combatClips()` loads the six `clip-*.glb` once; each figure retargets them from the clip file's own hips height.
- [ ] A figure gets `pose(name)` (`kneel`, `taunt`, `hit`, `die`, `dieFwd`, `dieBlown`, or null) layered over the locomotion weights.
- [ ] Tests: every troop kind has a file on disk and a height; `fileOf`; `variety(i)` gives the Wookiees a spread of sizes.

### Task 2: Guns

**Files:** `src/components/universe/gunplay.js`, `gunplay.test.js`

- [ ] `dc15` (the clone's DC-15A), `e5` (the droids' E-5) and `wrist` (the B2's wrist blasters, built along the forearm) in the middle of `GUNS`, each with a muzzle, and a fore-end where it has one.
- [ ] Tests: each builds with a muzzle in front of the grip.

### Task 3: The rules (`surface/skirmish.js`)

**Files:** create `src/components/galaxy/surface/skirmish.js`, `skirmish.test.js`

- [ ] `UNITS`: per kind numbers (hp, range, burst, rate, magazine, reload, accuracy near and far, damage, cover use, bravery, speed, and the kind's habits: `flank`, `charge`, `stopToShoot`, `advanceFiring`).
- [ ] `lineOfSight(solids, from, to)` with heights (a solid's `top`, ignoring ones with a `base`).
- [ ] `coverSpots(solids, field)`: spots along low walls and round rocks and trunks, made once.
- [ ] `newSkirmish(spec, { n, seed, solids, ground })`, `stepSkirmish(b, dt, you, env)` → events (`shot`, `down`, `kill`, `spawn`, `taunt`, `wave`), `hitUnit(b, id, damage, push, by)`, `skirmishView(b)`.
- [ ] Each unit thinks on its own timer: perceives enemies with line of sight; picks a target by distance, by who shot at it and by low health; takes cover from its threat; ducks (kneels) and pops up to fire bursts; reloads; clones flank a target in cover; Wookiees charge and melee at close range and pound their chests after a kill; B1s stop to shoot; B2s walk forward firing; a hurt unit falls back; suppression lowers aim and drives units into cover. Death picks a clip by which way the shot pushed. The Republic comes back one at a time at its spawn, the Separatists in waves out of the lagoon.
- [ ] Tests for each behaviour, plus ten minutes of play with no NaNs and both sides still fighting.

### Task 4: The scene and Kashyyyk

**Files:** create `src/components/galaxy/surface/skirmishScene.js`; modify `surface/scene.js`, `sites/forest.js`, `sites/quests.js`, `props/forest.js`

- [ ] Bodies from Task 1 with guns from Task 2 (`createGunplay`), aimed at the target while standing to fire, the gun kicking on each shot; kneel, flinch, death clips; corpses cleared after a while.
- [ ] Shots between soldiers through `blaster.tracer`, at you through `blaster.enemy` (three at most). Your bolts hit soldiers: the skirmish's targets join `shootable()` and `struck()` sends hits to it. A droid you kill counts for `beachhead` (`kill` with tag `lagoondroids`).
- [ ] Kashyyyk: `skirmish` (sides, field, spawns, cover), the beach's wandering clones, B1s and B2s gone from `life`, the barricade's solid gets `top: 1.25`, crates, rocks and logs between the water and the barricades. The beachhead quest's own droids give way to the battle's.

### Task 5: The portal jump

**Files:** create `src/lib/three/portalGate.js`; modify `components/jumps/timing.js`, `timing.test.js`, `styles.js`, `PortalJump.jsx`, `App.jsx`, `pages/Galaxy.jsx`, `universe/scene.js`, `galaxy/scene.js`

- [ ] `portalGate.js`: `createGateFx({ parent })` → `open({ at, normal, radius })` a disc of the show's goo facing along the flight line (settles on opening, a lip glow, motes), `clip(object, gate, side)` clips an object's materials at the gate's plane (cloned, put back by the handle), `shut()` pinches it with a flash. Pure timing (`gateAt(t)`) tested in Node.
- [ ] `jumps/timing.js`: `stagedAt(t)`: clear until 0.95 s, the goo wiping in from the centre by `T.jump`, the vortex until `T.tunnel`, then a hole opening outward. Tested.
- [ ] `jumpEvent(style, { staged })`, App passes `staged` to the jump, `PortalJump` uses `stagedAt` when staged.
- [ ] Universe map: the cruiser's jump fires a green bolt, opens a gate ahead, flies in while the camera holds back; at the flash it parks, the exit gate opens behind it, and it flies out nose first under a short camera shot from the side that blends back to the chase view; the gate pinches shut.
- [ ] Galaxy: `Galaxy.jsx` dispatches `jumpEvent(crew?.jump, { staged })` at `spool`; `jumpFrame` opens the gate ahead in `spool` and the exit gate in `exit`, the same way.

### Task 6: Check it and ship it

- [ ] Playwright (container Chromium, SwiftShader): Kashyyyk from above and at eye level, a motion capture of soldiers taking cover, firing and falling; the universe map's cruiser jump and the galaxy's, frame by frame.
- [ ] Full tests, lint, build. Commit and push to `claude/festive-meitner-ctyhqf`.

---

## Status (2026-10-07)

Done in this branch (`claude/festive-meitner-ctyhqf`):

- **Soldiers.** All ten rigged Battlefront soldiers and any Wookiee (Chewie's model, four shades) are crew figures. Every world's troopers, the quests' enemies and the assaults' soldiers walk on Rick's clips with the six fight clips layered on (`crew.js`). Guns: `dc15`, `e5`, `wrist`, `e11` (`gunplay.js`). `scripts/preview/troops.html` lines them up in any pose.
- **Battles.** `surface/skirmish.js` (rules, 29 tests) and `surface/skirmishScene.js` (drawing) with `surface/soldier.js` (one soldier's figure, gun, aim and poses). Battles on **Kashyyyk** (the Republic holds the sandbar's barricades, the droids wade ashore from the north: the lagoon is north and east of the beach, not where the handoff guessed), **Geonosis** (the droids hold the landing ground's south edge, the clones come off the LAATs) and **Hoth** (the Rebels hold the trenches, the snowtroopers come off the north ridge). None runs during a mission.
- **Your side** (the owner's follow-up: "it depends which faction we choose in the galaxy war system: if we choose the bad guys we can help the Separatists"): main's galactic war oath (`galaxy/sides.js`, `galaxy/allegiance.js`, `tp-gcw-side`: one oath a war, for a campaign of three days; the other side in the same war a turncoat's), sworn on main's holotable and panel. Each battle's sides carry their `side` in it (Kashyyyk's and Geonosis's the Clone Wars', Hoth's the Civil War's), and `skirmish.js`'s `yourSide` puts you with the side you swore to in its war; unsworn there, with the one leaning your other oath's way (sworn to the Empire, you're with the droids on Kashyyyk); sworn to nothing, your crew's suggestion, else the liberators. The battle's HUD switch (`SkirmishHud.jsx`: "Turn your coat" when it would make you one) is an oath to the other side, the same as main's assault choose card (`pages/GalaxySurface.jsx`'s `swearTo`, with main's achievements), and puts you at your side's rally point. The scene gets the whole oath (`oath`: the surface page's, or `travel.js`'s on the landing's handover, so a battle made before its page is up is on your side), and the take-off's handover gives the sky your side from its first frame.
- **The assaults and the quests' enemies** use the same bodies: guns in hand, aimed, shots from the muzzle, flinches, death clips. Every hit goes through one router in `surface/scene.js`.
- **Portal jump.** `lib/three/portalGate.js` (choreography tested), staged mode in `PortalJump.jsx` (`timing.js stagedAt`), on the universe map (`universe/scene.js`) and in the galaxy (`galaxy/scene.js`, which now uses the crew's own jump: the RV's Blue Sky too). The scene waits for the overlay to start drawing (`timeline.js markJumpStart`/`overlayFrom`), since a first jump's overlay loads late. Checked frame by frame in the browser on the universe map (the shot, the gate opening, the cruiser sinking into it, the pinch, the vortex, the hole opening onto it coming out of the exit gate, the camera back behind it) and in the galaxy (Tatooine to Naboo: in through the gate, out of the next one, the gate shut, the camera behind it). The galaxy panel says the ship's own words for its jump ("Through the portal").
- Checks: `scripts/kashyyyk-check.mjs` (Kashyyyk on both sides, Geonosis for the droids and then the clones: both clean), `scripts/portal-check.mjs` (steps the page's clock). On software WebGL a screenshot moves the page's fake clock on by as long as it takes, so run one check at a time: two at once can carry a jump past its frames.

### Known limits

- A battle draws each soldier's gun as about fifteen small meshes (gunplay.js builds them in code): a full battle adds a few hundred draw calls. Merging each gun's geometry once a kind would cut that if a phone struggles.
- Fighting for the Separatists, Commander Gree's beachhead quest can't be finished (it counts droids you bring down).
- Oaths last a campaign (three days, main's design): after it, the battles fall back to your crew's suggestion or the liberators till you swear again.
- A world's battle never ends, so it doesn't count in the war's tally (main's galactic assaults do: `addWin`/`addPoints`).

### Other eras: models Meshy has to make first

The battles need rigged soldiers on both sides. These worlds don't have them yet, so they have no battle:

| World | Battle | Missing |
|---|---|---|
| Endor | the shield bunker: scout troopers against the strike team and the Ewoks | `endortrooper`, `ewok` |
| Scarif, Yavin | the beach, the temple: shoretroopers and death troopers against the Rebellion | `rebeltrooper` |
| Naboo | the grass plains: the droid army against the Gungans | `gungan` |

Their prompts are in `scripts/meshy-galaxy.mjs` (`ASSETS`). With `MESHY_API_KEY` set (about 44 credits each):

```bash
for step in images models rig fetch; do node --env-file=$HOME/.tilakverse.env scripts/meshy-galaxy.mjs $step endortrooper rebeltrooper ewok gungan; done
```

Then for each kind: a `CREW` entry in `surface/crew.js` (`{ name, tall }`), a `UNITS` entry in `surface/skirmish.js`, a gun in `surface/soldier.js`'s `SOLDIER_GUNS` (the Ewoks' spears: `melee`, as the Wookiees'), and a `skirmish` on the site, laid out as Kashyyyk's is. Check the field's terrain first; the test in `skirmish.test.js` checks the layout.
