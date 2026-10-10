# The universe further apart, the Star Wars gate, the jump into it and the maps' names. The design

Date: 2026-10-09. Explored with the owner; the design below was approved in chat ("Sounds good 1.5x is good write and implement"). Shots of where it starts are in the session's scratchpad (the gate at five distances, the jump frame by frame, both maps); the browser checks below retake them.

## What the owner asked for

"Make the planets in the universe more distant and make the exterior of star wars galaxy look better and the animation to get to there better. Fix the map names and stuff too."

## What that means here

1. **Further apart.** The fandoms' planets, the wonders and everything laid out by `scale.js`'s `SPREAD` sit 1.5 times as far apart as today (the owner's pick of 1.5x over 2x). Places keep their sizes.
2. **The gate looks like a galaxy behind a hyperspace gate**, from anywhere: from across the map a little spiral galaxy on the sky, nearer a lit ring in front of a spiral with depth, and in front of it no white glare.
3. **One jump.** Picking Star Wars (or flying into the gate) is one continuous move: the ship flies into the ring, lightspeed carries on into the tunnel, the galaxy is built under it, and you drop out of hyperspace at Tatooine. No black cards in the usual case.
4. **Names.** One name per place, the same on every surface; no name over another name or another place's dot on either map; names in the 3D view give way to each other.

## Where it is today

- `layout.js` / `scale.js`: `SPREAD = 4`. Fandoms on a golden-angle spiral from `2000·SPREAD` (8,000) out by `330·SPREAD`; the main sector's edge `9000·SPREAD` (36,000), its rim `8000–8600·SPREAD`; the Rick and Morty sector at z −48,000 with a 6,000 edge. Wonders (`deep.js`'s `spread`), lights (`lighting.js`), supernovae, wars and the far fights already scale by `SPREAD`. Fixed numbers that don't: the Expanse grid's `SECTOR = 80000` (`expanse/gen/grid.js`, half 40,000), the Rick and Morty origin, `online/protocol.js`'s `FAR = 60000`, the camera's far plane (30,000, `scene.js`).
- The gate (`galaxy/gateway.js`, `planets.js`'s `BUILDERS.starwars`): r 150, a billboard tunnel disc of 180 hard lanes and an unlit ring at luminance 1.13–1.53, under bloom's 1.7 threshold (`look.js`); a 7,000-point spiral whose sizes are fixed pixels (`uScale` 900), a flat glow plane whose arms are 14% of the core. From past 4,352 (`farStars.js`'s `realAt`) it's one yellow far star (the swatch), and inside that the whole group pops in at full brightness.
- The jump (`Universe.jsx`'s `go`, `flight.js`'s `enterPlan` → 1,250 ms, `jumps/jumpOut.js`, `hyperspace3d/timeline.js`, `galaxy/GalaxyView.jsx`, `GalaxyIntro.jsx`): the map freezes (the ship doesn't move), the crew's jump style plays (a portal for the cruiser, Blue Sky for the RV), the route changes at the flash, the tunnel holds up to 8 s while the galaxy builds, then on a first visit 4.2 s of "A long time ago…" over black, then the LoadingVeil if not ready. The galaxy's arrival is a linear FOV ease with no hyperspace exit. Flying into the gate bounces off its hidden r-150 sphere (`ship.js`), and `state.through` is never reset.
- Names: `nav.js` names a fandom by its `world` ("Avengers HQ", "A galaxy far, far away"); the 3D labels, MiniMap, HUD and panel by its `label` ("Marvel", "Star Wars"). The M chart (`NavMap.jsx`) has no overlap avoidance: the Portal on Dimension C-137, the gate's name across Glacia's dot, the Twins on Albuquerque, the Lantern on Halcyon, names past the round chart on phones. Mid-sentence capitals ("Race to A galaxy far, far away", "Near The Maw"). 3D names (`scene.js`'s `placeLabels`, `deepspace.js`'s wonder names) never avoid each other, and wonder names show across sectors. The galaxy map's names (`labelPlace.js`) avoid each other and the controls but not the region names (`MapSvg.jsx`): MID RIM lies on Mandalore.

## Decisions

### 1. Spread 1.5x (PR 1)

- `SPREAD` 4 → 6 (`scale.js`, and `universes.js`'s written copy). Everything already sized by it follows: fandoms from 12,000 out (the gate, index 0, ~12,080 from home) to ~33,800; wonders to ~40,300; the main edge 54,000; the rim 48,000–51,600.
- The Rick and Morty sector moves out with the edge: its origin to z −66,000 (the 6,000 gap between the two edges kept). Its own layout is unchanged.
- The Expanse grid's `SECTOR` 80,000 → 120,000, so the authored sector (0, 0) still reaches past the main edge (60,000 > 54,000) and the generated sectors stay outside it. Generated systems are where their seed puts them in the bigger cell; the seeds and names are unchanged.
- Fixed numbers raised by the same 1.5: online `FAR` 60,000 → 90,000 (with `FAST` unchanged), the camera's far plane 30,000 → 45,000.
- The no-ship overview pose (`flight.js`'s `overviewPose`) and the whole-map 3D view (`scene.js`) are re-fitted so the worlds are in the frame again.
- Free flight: the nearest fandom ~40 s of pulse drive from home (27 s today); the jump stays instant. Tests that pin trip times and distances are updated to the new numbers, not loosened.

### 2. Names (PR 2)

- **One name rule** (`universes.js`, pure, tested): `nameOf(u)` is the fandom's `label` everywhere a place is named (the M chart, its list, the Jump button, the prompts, the panel, the 3D labels, the MiniMap, the HUD); `worldOf(u)` (its `world`) is the subtitle where there's room ("Star Wars · A galaxy far, far away" in the chart's list and the panel). Mid-sentence uses `inSentence(name)`, which lowercases a leading "The"/"A" ("Race to the Maw", "Near the Veil").
- **The M chart's names are placed**, not pinned right: `galaxy/labelPlace.js` moves to `src/lib/labelPlace.js` (the galaxy path re-exports it), and `NavMap.jsx` runs it with every dot as an obstacle and the round chart as the bounds (a name may not leave the circle). The Portal folds into Rick and Morty's name ("Rick and Morty · portal") when they're closer than a name's height on the chart. The range rings are retuned to the spread chart (rings among the worlds).
- **3D names give way** (`labelRank.js`, pure, tested): each frame's visible names are ranked picked → aimed → going to → nearest, and a name whose box meets a higher-ranked one's is hidden (faded over 0.2 s, so nothing flickers). Wonder names and the front's card get the sector filter the planets have; wonder names are clamped inside the far plane as the far stars are.
- **The MiniMap** folds the six stations into one "Home system" mark at whole-map scale.
- **The galaxy map**: region names are obstacles for `labelPlace` (MID RIM no longer over Mandalore's name), and the label check covers it. Kamino's card keeps "Wild Space"; the map draws a small "Wild Space" tag beyond the Outer Rim ring by it.

### 3. The gate (PR 3)

All in `galaxy/gateway.js` (split into `gateway/galaxyDisc.js`, `gateway/ring.js`, `gateway/lod.js` to keep files in budget), drawn the same on every tier with `small` thinning counts:

- **The spiral** is painted once into a 1024 texture (512 small) by code: two log-spiral arms with dust lanes along their inner edges, a warm bulge, blue-white arms, pink knots of star birth, falling off to the rim. It's laid on three thin stacked discs a few units apart (parallax, and never a line edge-on), the brightest arms above bloom's threshold.
- **The stars** keep the 7,000 (2,600) points, sized in world units through the camera's real projection (DPR, height and FOV), with distance dimming, so they're neither one-pixel dust far off nor 14 px blobs near.
- **The ring** is a lit torus whose emissive is above the threshold (it glows), with eight pylons round it in place of the eight beacon spheres, and the outer ring kept. The **event surface** inside it is a disc facing its own way (no billboard), its streaks anti-aliased by `fwidth`, the centre blaze kept under the glare: no more white-out in front of it.
- **One gate light** (blue, short reach) on the Venator and the Star Destroyers round it.
- **From far off**, the gate is a landmark (`landmarks.js`): the painted spiral on the sky in its true direction, at least 3° across, so from home it reads as a galaxy far away, not a yellow star. Inside where it's real the landmark fades and the real group fades in (opacity, not visibility): nothing pops, and the far star's colour is the gate's.

### 4. The jump (PR 4)

- **One plan** (`flight.js`'s `gatePlan`, pure, tested): `approach` (1.1 s: the ship flies itself at the gate's centre, the chase camera swings in behind, the ring brightens and the surface's swirl quickens), `through` (0.35 s: crossing the ring plane starts the scene's own lightspeed streaks), then the jump overlay takes over at its streak phase (not its dark one) with the style **always lightspeed** for the gate, whoever's crew it is.
- **Through, not bounce**: the gate's body isn't solid to the ship (`portal: true` places), crossing its plane inside the ring is the trigger, and `state.through` resets when the scene starts.
- **Ready sooner**: the galaxy's chunks and the 3D jump are fetched when the gate's in view or picked (today: when picked, or at the portal event).
- **The card over the tunnel**: on a first visit, "A long time ago in a galaxy far, far away…." plays over the held tunnel while the galaxy builds, instead of after it. The tunnel's hold ends when the galaxy has drawn and the card has had its 3.6 s; the LoadingVeil shows only if it's still not ready after that.
- **Arrival**: the galaxy's own hyperspace exit (`hyperspaceExit`, as between systems) plays on arrival: streaks shrinking into stars, the speed eased down, the FOV eased (not linear), the drop-out sound.
- The overlay's darkening eases to full instead of stepping from 0.92.

## Out of scope

The galaxy's systems, its 3D content and the universe's other worlds' looks; the Rick and Morty sector's own layout; the hyperspace overlay's other styles.

## Testing

- Unit (Vitest, Node): the new spread numbers (`scale.test.js`, `layout.test.js`, `ship.test.js`, `nav.test.js`, `deep.test.js`, the Expanse grid and sector tests); `nameOf` / `inSentence`; `labelPlace` in a circle with dots as obstacles; `labelRank`; the gate's LOD weights; `gatePlan`'s phases; the jump style forced for the gate.
- Browser (headless Chromium on Metal, the repo's check scripts' way): `scripts/gate-check.mjs` takes the gate at five distances and the jump frame by frame, with a black-frame probe over the jump; `navmap-check.mjs` gains names-against-dots and the circle bound; the galaxy map check gains region names.
- Each PR: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, then a trial merge against the open branches (`claude/planets-data` also edits `gateway.js` and `layout.js`) and merge to main.
