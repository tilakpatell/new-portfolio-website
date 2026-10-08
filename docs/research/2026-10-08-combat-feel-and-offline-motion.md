# Lightsaber and blaster combat: what the code does today, what the web does, what the desktop could make (2026-10-08)

Read-only audit of the site's combat code (galaxy surfaces, the universe's foot scenes, the Rick and Morty worlds) against the techniques the games the site borrows from use, and against what an RTX 5090 can generate ahead of time. The design that acts on this is `docs/superpowers/specs/2026-10-08-combat-revamp-design.md`.

## 1. What the code does today

### The lightsaber (`src/components/galaxy/surface/saber.js`, `combatRules.js`, `saberBody.js`)

- **A stroke is an arm tween, not a clip.** `saber.js` two-bone-IKs the right arm along a yaw/pitch arc from `combatRules.js`'s stance table; the body plays `ual-saber.glb`'s `Sword_Attack` on the legs and hips only. Nine UAL2 sword clips (`ual-sword.a/b/c`, `.light.a/b/c`, `.heavy`, `.block`, `.dash`) are baked and registered (`clipLibrary.js:174-182`) and nothing plays them. UAL2's source has twenty-two more sword clips (combos, recoveries, aerials, an uppercut, a ground pound) that were never baked.
- **A hit is a flat cone.** `combatRules.js:116` `arcHit`: a circle on XZ round the player plus a yaw arc centred on the *camera's* yaw, during a timer window (`saber.js:377`, `lead − 0.18` to `lead + 0.22`). The blade's geometry is never consulted; the hit point is fixed at `q.y + 1.1`. A swing above an enemy's head or below their feet lands the same.
- **Block and parry are booleans and timestamps.** Deflection is a cone round the *shooter's position* (`saberRules.js:62`), flagged at fire time (`scene.js:2960`), so raising the blade after a bolt is fired does nothing and lowering it still deflects. A parry is a C keydown within 0.22 s of an enemy swipe (`scene.js:2924`), no contact needed. A deflected bolt goes neutral; it never returns to the shooter.
- **Enemies don't fence.** Their melee lands on the decision (`activity.js:929`), not on contact; their 0.4 s swing is cosmetic. Their parry is `Math.random()` (`activity.js:654`). A rigged enemy's blade tests nothing (`heldBlade.js:72` `targets: []`). The ground fight (`ground/fight.js`) has no saber logic.
- **The mouse doesn't swing.** Left button drags the look; strokes are F (`scene.js:978-1000`).
- Dead code: `saberRules.js`'s `SWINGS`, `swingPose`, `nextSwing`, `arcHit` and `SABER.reach/half/damage` are unused in the site, only in their test; `protocol.js:394` duplicates the stance ids.
- The Death Star's inside has its own saber (`deathstar/inside/scene/saber.js`, blade-direction keyframes, timed blows, a once-per-pair clash). Nothing is shared.

### Blasters (`blaster.js`, `ground/bolts.js`, `universe/foot.js`, `rickmorty/world/interiors/rickall.js`)

- **The player's shot ignores walls.** `blaster.js:83-108` tests target spheres and the ground (in 1.5 m steps from 1 m out), never a prop or a wall; only the chase's bike cannon checks solids (`chaseScene.js:464`). An enemy behind a wall is hit.
- **The aim and the muzzle disagree.** The galaxy shoots along camera forward from a point 0.3 m off the camera's axis (`scene.js:1700-1703`): fine at range, a miss point-blank. The universe's foot scene sends a third-person shot to the auto-lock's chest up to 28° off the reticle (`footScene.js:2768`, cone 0.5 rad), and in first person the view-model gun aims at the lock while the bolt goes along the look (7–17° apart).
- **The crosshair appears three seconds after a shot** (`GalaxySurface.jsx:392`); hip fire is blind; the right-button sights show none.
- **Nobody leads.** Enemies aim at the true XZ now (`fight.js:257`, `activity.js:917`, `foot.js:347`); a bolt takes 0.2–0.5 s to arrive, so a sidestep always dodges. They know where you are for 2.5 s after losing sight and their bolts test no solids, so they shoot through walls (`hostiles.js:146`, `blaster.js:142-196`).
- **Dice where bolts should be.** Soldier-on-soldier hits are `Math.random() < 0.45` under a tracer (`scene.js:2918`); the assault's likewise (`assault.js:695`). The tracer's speed (140 m/s) and the logic's (90 m/s) differ, so it lands early and long.
- The 32-bolt ring overwrites live bolts (`blaster.js:70`). The mate is immune to soldiers' bolts (`groundScene.js:287`). Total Rickall shoots instantly along a sight line with no wall test (`rickall.js:279, 378`); the duel dimension's shot always lands in its cone (`duel.js:29`).
- Every gun is boxes and tubes built in code (`gunplay.js:101` `GUNS`); no GLB.
- Good news: every bolt test is swept (segment vs sphere) and nothing tunnels.

### Looking (`scene.js:976-1031`, `footScene.js:3401`, `RmWorld.jsx:1518`)

- **No pointer lock anywhere.** Looking is click-and-drag in every on-foot world. A trackpad user can't drag and click at once, so they can't aim and fire. The wheel zooms. Touch has its own look pad (galaxy) or the kit's Stick (Rick and Morty).
- Aim assist today: a soft lock (galaxy: nearest in a 0.9 rad cone within 14 m, strokes home on it, shots don't; universe: a 0.5 rad auto-lock that shots go to; Rick and Morty: the yaw sweeps until a target is on the line).

### The rig

Meshy's 24-bone skeleton on every humanoid, no fingers, no twist bones (`docs/research/2026-10-07-rigging-and-models.md`). Clips come from Quaternius's UAL1 and UAL2 through `scripts/ual-bake.mjs` (a world-space delta retarget onto Luke's rest, 30 fps). The animator plays a base (locomotion or a state), one full-body one-shot, and hand-laid upper and lower layers (`lib/three/animator.js`). The desktop's gen3d pipeline makes models (TRELLIS.2, Hunyuan3D-2) and the voices pipeline makes lines; it neither rigs nor animates.

## 2. What the games do

- **Jedi Academy (OpenJK, `codemp/game/w_saber.c`).** The blade is sampled every 8 units between last frame's base/tip and this frame's, big swings split into angular slices; saber-vs-saber is a swept quad per blade; damage only inside the attack's frames and scaled by position in the swing; each victim hit once per swing with a 100 ms wound cooldown; a higher stance level breaks a lower parry. <https://github.com/JACoders/OpenJK/blob/master/codemp/game/w_saber.c>
- **Shinobi duel (three.js 0.186 + Mixamo, MIT, Sept 2026).** Attack clips time-warped so wind-up, contact and recovery land on fixed times; the parry window (0.25 s, 0.2 hard) shrinks when guard is mashed; a posture bar; an IK layer aligns the real blade to a reference during the hit window; lock-on frames both fighters; guard auto-faces within 8 m. <https://github.com/StarKnightt/shinobi-duel>
- **Hit-stop.** 40–90 ms frozen on a hit, 120–200 ms on a parry, the cancel window starting at the end of the freeze so combos stay consistent. <https://critpoints.net/2017/05/17/hitstophitfreezehitlaghitpausehitshit/>
- **Parry timing** anchored to the enemy's contact frame, not the swing's start (the complaint every game gets wrong first).
- **Third-person shooting.** Raycast from the camera through the crosshair to the aim point (the first solid, or far along the ray), then the bolt from the muzzle to that point; clamp the aim point to a minimum distance ahead so the muzzle vector never flips behind the figure at a wall.
- **Aim assist** (Halo's names): bullet magnetism (bend the shot toward the nearest target in a cone, crosshair untouched, still blocked by cover), reticle friction (lower look sensitivity over a target), sticky target, snap on sights. Starting numbers from a documented build: an inner cone of 3° at full pull, an outer cone of 8° falling to nothing, a per-frame pull cap. <https://cse125.ucsd.edu/2026/cse125g2/docs/structsystems_1_1GamepadAimAssistConfig.html>
- **Enemy accuracy** that reads as fair: spread = base + k·range + a movement penalty; the first volley at a fresh target misses on purpose (the telegraph); a streak cap (a hit lowers the next shot's chance).
- **Pointer lock gotchas.** `unadjustedMovement: true` is Chromium-only (catch `NotSupportedError` and lock plain); a 1–1.25 s cooldown between unlock and relock, and a user gesture needed; Safari's trackpad under pointer lock moves slowly unless a button is held; coalesced `pointerrawupdate` events carry movement inconsistently, so read `pointermove`/`mousemove` only; clamp `|movement|` per event (a trackpad's palm and inertia spike) and drop the first event after locking. <https://web.dev/articles/disable-mouse-acceleration>
- **Trackpad and touch.** A soft lock that the reticle magnetises to should be the default there, not an option; tap to fire snaps within the cone. Touch keeps `touch-action: none` on the canvas and the joystick above it.
- **Bolts as projectiles**, not hitscan: a fast finite speed with a swept test per step (segment vs capsules, and a solids raycast). It kills tunnelling, lets a blade deflect a bolt in flight, and a deflected bolt is the same code with the direction mirrored and the owner swapped.
- **Blade trail**: a ring buffer of (base, tip) per frame → a triangle strip fading with age; the same buffer feeds the swept hit test.

## 3. What the desktop can make ahead

- **Models** (already wired, `scripts/gen3d`): TRELLIS.2-4B (MIT, 24 GB) from a picture; hard-surface hilts, blasters and droids are its strength. Ask with `node scripts/desktop/ask.mjs gen3d …`.
- **Motion from text**: HY-Motion 1.0 (Tencent, Dec 2025, 1B flow-matching, 24–26 GB; outputs SMPL-H joints, BVH/FBX through the ComfyUI wrapper). Licence: any purpose, not valid in the EU, UK or South Korea; outputs are the user's. <https://github.com/Tencent-Hunyuan/HY-Motion-1.0>. MoMask (MIT, CPU, writes BVH straight from `gen_t2m.py`; trained on HumanML3D, whose data is non-commercial) is the easiest BVH path at lower quality. <https://github.com/EricGuo5513/momask-codes>
- **Motion from video**: GVHMR (SIGGRAPH Asia 2024; research and non-profit only, which a personal site is) for a fixed camera, TRAM (MIT) for a panning one; both output SMPL and need a SMPL → BVH step (the ComfyUI-MotionCapture wrapper has one). <https://github.com/zju3dv/GVHMR>
- **Rigging with fingers and twist**: SkinTokens (VAST, Feb 2026, MIT, 14 GB: a GLB in, a skinned GLB out, and `--use_skeleton` skins a skeleton you hand it) is the one to try; UniRig (MIT, 8 GB) is its predecessor; Make-It-Animatable (MIT) outputs Mixamo's 65-bone skeleton with fingers, so Mixamo clips retarget trivially. <https://github.com/VAST-AI-Research/SkinTokens>
- **Retargeting in three.js**: `SkeletonUtils.retargetClip` with `names`, `hip`, `scale` and `localOffsets` for the rest-pose mismatch (Meshy's A-pose against a T-pose); three-vrm's `loadMixamoAnimation` does the rest-pose-aware quaternion maths more robustly. `AnimationUtils.makeClipAdditive` for an aim or guard pose over locomotion; `CCDIKSolver` for a look or aim chain of three or more links; two-bone IK stays hand-written (`lib/three/ik.js`).

## 4. The verdicts

1. **Strokes are clips, hits are the blade.** Play the UAL2 sword clips full-body with contact windows baked as extras; sweep the blade's segment between frames against capsules; hit once per stroke per target, only inside the window; hit-stop on contact.
2. **Bolts are projectiles that obey the world.** One swept bolt step for yours, theirs and theirs-at-theirs, with a solids raycast; the aim point from the camera's ray; a crosshair whenever a gun is up; enemies that lead, spread with range, miss first and can't see through walls.
3. **Pointer lock for the mouse and the trackpad, a magnetised soft lock for everyone**, strongest on trackpad and touch; click swings, right button blocks or sights.
4. **Duellists on the same module**: the rigged crew figures (Vader, Maul, Dooku, the Inquisitor) with a real blade, a small fencing brain, and a parry window anchored to their contact frame.
5. **The desktop makes the hilts and blasters now** (gen3d), and gets a `motion` job (HY-Motion text-to-motion → BVH → the UAL retarget) for the strokes no library has, behind a spike that proves the retarget.
