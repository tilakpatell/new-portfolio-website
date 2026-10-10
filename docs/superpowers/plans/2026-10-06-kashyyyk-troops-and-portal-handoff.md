# Kashyyyk's soldiers and Rick's portal jump: handoff

Date: 2026-10-06. Branch: `claude/game-models-animations-b1f66a`. Written by
the session that started this work, which ran out of usage partway. The
owner asked for it to be merged as it stood and finished in another session.

## What the owner asked for (verbatim)

1. "Add better models as I went to kasyhykk in star wars land and the
   troopers are all horrible wookie models or t pose soliders they should
   shoot and have proper AI and think for themselves."
2. "The portal animation (for hyperspace) for rick and morty make it better
   so we see the ship go in the portal and stuff and make it be the same in
   the star wars galaxy"

## Done in this branch

- `scripts/meshy-troopers.mjs`: bake, rig, clips, fetch for the galaxy's
  soldiers. All ten Battlefront II remaster soldiers (clone, battledroid,
  superdroid, stormtrooper, snowtrooper, hothtrooper, sandtrooper,
  scouttrooper, shoretrooper, deathtrooper) were rigged with Meshy onto the
  site's usual 24-bone Meshy skeleton (the one Rick's clips play on).
  Spent: 50 credits for the rigs and 18 for the clips, from the account in
  `~/.tilakverse.env`. That account had 1793 credits left afterwards.
- Output: `public/models/galaxy/troops/<kind>.glb` (rigged, no clips,
  meshopt and WebP at 1024) and `public/models/galaxy/troops/clip-<name>.glb`
  (skeleton and animation only), made on the clone's rig:
  `hit` (177 Gunshot_Reaction), `die` (183 Shot_and_Fall_Backward),
  `dieFwd` (184 Shot_and_Fall_Forward), `dieBlown` (182 Shot_and_Blown_Back),
  `kneel` (165 Kneeling_Reload), `taunt` (88 Chest_Pound_Taunt).
- Task ids are in `scripts/meshy-troopers-tasks.json`. Running `fetch` again
  costs nothing. Running `rig` or `clips` again does not pay twice.
- Nothing is wired into the game yet. The site looks exactly as it did.

If any `troops/*.glb` is missing, fetch it again for free:

```bash
node --env-file=$HOME/.tilakverse.env scripts/meshy-troopers.mjs fetch
```

## Why Kashyyyk looks bad today (diagnosed)

- Kashyyyk's ground site is `src/components/galaxy/surface/sites/forest.js`
  (`kashyyyk`). Its `life` has Wookiees, clones, B1s, B2s, AT-RTs and so on.
  They only wander and talk (`surface/actors.js`). Nobody fights anyone.
- `wookiee` has no model, so `surface/figures.js` builds it from capsules.
  These are the "horrible wookie models".
- `clone`, `battledroid`, `superdroid` and the other troopers resolve to the
  Battlefront models in `catalog/battlefront.js`, which override the
  Sketchfab ones. These are static, unrigged and in a T-pose, so
  `actors.js modelFigure` slides them about with a bob. These are the
  "t pose soliders".
- A rigged, textured Chewbacca already exists: `public/models/cockpit/chewie.glb`
  (`CREW.chewie` in `surface/crew.js`, walked on Rick's clips through
  `loadPartyFigure`). Generic Wookiees can use it, with a little scale and
  fur-tint variety, at no cost.

## Plan for the soldiers (not started)

1. **Figures.** Add the ten kinds to `surface/crew.js` `CREW` as
   `{ url: '/models/galaxy/troops/<kind>.glb', tall }`, plus `wookiee` →
   chewie.glb. `actors.js anyFigure` tries `crewFigure` first, so every
   world's life, quests (`activity.js` imports crewFigure too) and the
   galactic assault (`missions/assaultScene.js`) then walk on Rick's
   idle, walk and run (`rickmorty/portal/clips.js borrowClips`, `retarget`
   by hips height). Load the six `clip-*` files the same way. They were made
   on the clone's rig, so retarget them from that file's own Hips height,
   not `RICK_HIPS`. Check each model in the page at its real size before
   calling it done (see `scripts/glb-shot.mjs`). The B1 droid's thin limbs
   are the most likely to rig badly.
2. **Guns.** `src/components/universe/gunplay.js` already holds, aims
   (arms, chest and head) and kicks guns on this skeleton. `createGunplay(fig, kind, { unit: 1 })`
   is what the galaxy surface's party uses (`surface/scene.js` around line
   487). Add `dc15` (the clone DC-15A), `e5` (the droids' E-5) and `wrist`
   (the B2's wrist blasters) to `GUNS`, in the middle of the list, to stay
   clear of other branches. The Wookiees use the existing `bowcaster`.
   `locomotion.js` gives the flinch (`hurt`), the drop at the knees (`down`)
   and `fallTurn`, and footScene's troops show how it fits together (around
   line 2505).
3. **Fighting.** Make a pure, seeded, Node-tested rules module (say
   `surface/skirmish.js` and `skirmish.test.js`, in the style of
   `missions/assault.js`) plus a scene part (`surface/skirmishScene.js`, in
   the style of `missions/assaultScene.js`). A site opts in with
   `site.skirmish`. On Kashyyyk the Republic (clones and Wookiees) holds the
   beachhead barricades and the Separatists (B1s and B2s) come out of the
   lagoon in waves. The battle never ends, and the droid kills you make
   count for the `beachhead` quest (`tag: 'lagoondroids'`, kill events to
   `questEvent`). Each unit thinks for itself on a timer:
   - It perceives enemies in range, with line of sight through the solids
     (`world.solids`: circles and boxes, with `top` heights).
   - It picks a target by distance, by who is shooting at it and by how low
     the target's health is.
   - It runs to cover that blocks the threat. Make the cover spots once,
     from the solids near the field. Units duck behind cover (the `kneel`
     clip) and pop up to fire bursts.
   - It reloads after a magazine.
   - Clones sometimes flank a target that is in cover.
   - Wookiees charge at close range and chest-pound after a kill.
   - B1s stop to shoot.
   - B2s walk forward while firing.
   - A unit falls back when hurt.
   - Being shot at suppresses a unit: it is less accurate and more likely
     to take cover.

   Each unit has its own numbers (health, range, rate of fire, burst,
   accuracy near and far, damage, cover use, bravery). It dies on a death
   clip, picked by which way the shot pushed it, then comes back later at
   its side's spawn. Enemies shoot you through `blaster.enemy`, three at a
   time at most. Their shots at each other go through `blaster.tracer`.
   Your bolts hit them: add the skirmish's targets to `shootable()` and send
   hits to it from `struck()` in `surface/scene.js`. Remove the beach's
   wandering clones, B1s and B2s from Kashyyyk's `life` (keep Gree, Yoda,
   Tarfful, Chewbacca and the villages). Give the barricade's box solid
   (`props/forest.js` `barricade`) a `top` of about 1.25 so that soldiers
   can shoot over it standing and are hidden kneeling. Add a few crates,
   rocks and logs between the water and the barricades for cover. The
   field runs from the lagoon (about [120…160, 40…90]) to the barricades
   (about [20…66, 54…58]). Check it from above in the page before tuning.
4. **Verify** in a real GPU browser (memory: hq-3d-browser-testing; a Vite
   in-process plus Playwright Chromium `--use-angle=metal
   --disable-gpu-vsync --disable-frame-rate-limit` script). Watch the
   soldiers take cover, fire and fall, and take motion captures, not only
   stills.

## Plan for the portal (not started; a worker was stopped before editing)

- Today: Rick's cruiser's jump on the universe map is
  `components/jumps/PortalJump.jsx`, a full-screen 2D shader over the page
  on the shared jump timeline (`hyperspace3d/timeline.js` `T`). It hides the
  ship, so you never see it go in. Arrival shows a tiny billboard portal
  (`universe/crash.js arrive`).
- In the galaxy, `pages/Galaxy.jsx` dispatches a plain
  `new Event('tp:hyperspace')` at the jump's `spool`, so even Rick's cruiser
  jumps to lightspeed there. Make it `jumpEvent(crew?.jump, …)`.
- Build a shared 3D gate, `src/lib/three/portalGate.js`. It is a big disc of
  the show's goo (`lib/three/swirl.js portal()`) facing along the flight
  line, with the settle on opening, a lip glow and motes, and a pinch shut
  with a flash. The ship is clipped at the gate's plane with
  `material.clippingPlanes`. `lib/three/portalFx.js` shows how to clone
  shared materials and put them back afterwards.
- Universe map (`universe/scene.js`): `travel()` sets
  `state.jump.at = now + HYPER.flash`, and `fly()` moves the ship at that
  moment. Galaxy (`galaxy/scene.js jumpFrame`): the phases are
  `align → spool (1.2 s) → tunnel (held) → exit (1.1 s)`. The sequence:
  1. The portal gun fires a green bolt.
  2. A gate opens ahead.
  3. The cruiser flies in, sinking into the green, while the camera holds
     back.
  4. Under the overlay, the exit gate opens at the arrival point.
  5. The cruiser flies out nose first, with a short camera shot from ahead
     or the side that blends back to the chase view.
  6. The gate pinches shut.
- Overlay: add a "staged" mode (`jumpEvent(style, { staged: true })`, with
  App's Lightspeed passing it to the jump). It keeps the screen clear until
  about 0.95 s, wipes the goo in from the centre by `T.jump` and keeps
  `onPeak` where it is. The vortex runs until `T.tunnel`, then a hole opens
  outward to show the arrival. Put the numbers in `jumps/timing.js` and test
  them in `timing.test.js`. Navigations through the portal keep today's 2D
  version.
