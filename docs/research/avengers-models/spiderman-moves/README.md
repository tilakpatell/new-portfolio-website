# Spider-Man's moves

Motion-captured `idle`, `walk`, `run` and `jump` clips for the HD Spider-Man
(`public/models/marvel/spiderman.glb`, unchanged), in
`public/models/sketchfab/avengers/spiderman-moves.glb` (122 KB: clips and
the 69 skeleton nodes they animate, no mesh, no textures). Built by
`node scripts/sketchfab-spiderman-moves.mjs <folder> --fetch`.

```js
const moves = await loader.loadAsync('/models/sketchfab/avengers/spiderman-moves.glb');
const mixer = new THREE.AnimationMixer(spiderman.scene); // spiderman.glb as GLTFLoader loads it
mixer.clipAction(THREE.AnimationClip.findByName(moves.animations, 'walk')).play();
```

All 212 tracks (53 bones a clip: pelvis, spine, neck, head, clavicles, arms,
legs, feet and fingers) bind to bones in `spiderman.glb` as three.js loads it,
checked in headless Chromium. Bones not animated (spine_02/04, neck_02,
the `*_twist_*` and `deform_*` helpers, the face) keep their rest pose and
follow their parents.

## Sources

| clip | from | licence |
| --- | --- | --- |
| idle, walk, jump | [Spider-Man 2 Advanced Suit 2.0 PS5](https://sketchfab.com/3d-models/spider-man-2-advanced-suit-20-ps5-90907e9f6ad04e299239f306d22848f8) by jerrylxia (`Idle`, `Walk`, `Jump`) | CC BY 4.0 |
| run | [Spider-Man 2 Symbiote Suit (PS5)](https://sketchfab.com/3d-models/spider-man-2-symbiote-suit-ps5-0845c06a538746c8a8111b241575bd9d) by jerrylxia (`Run`) | CC BY 4.0 |

Both are Mixamo-rigged. Credited in `src/data/modelCredits.json`
(`avengers-anim-spiderman-advanced`, `avengers-anim-spiderman-symbiote`) and
`public/cc0/README.md`.

Candidates I looked at and passed over: Basic Human Male and Puppet, used
for Cap (generic and stiff for Spider-Man); Low-Poly Spider-Man Advanced
Suit 2.0 (the same jump and a similar run, but no walk); Spiderman 2099
animated (a good crouched combat stance and sprint, but a Biped rig, a
sideways stance, and no walk or jump); Spider Man 3D Model (sachinkhirwar;
its clips are empty). The Symbiote suit's `Run` is a lighter, more athletic
stride, with more lean and more arm drive, than the Advanced suit's jog.

## Numbers (in the manifest, for a figure 1.75 m tall)

- `speeds.walk` **1.50 m/s**, `speeds.run` **5.08 m/s**: the median speed
  of the planted foot sliding back under the in-place body. Scale them with
  the figure's height.
- `jump.takeoff` **0.567 s**, `jump.land` **1.133 s** in a 1.933 s clip:
  the last frame with a foot on the ground before the flight, and the first
  frame back down. That's 0.567 s of airtime, so for a 0.63 s physics jump,
  play the airborne part at a `timeScale` of about 0.9. Before takeoff there's
  a crouch and wind-up (0 to 0.57 s), and after landing an absorb and
  recovery to standing (1.13 to 1.93 s).
- The jump's own rise is taken out: through the flight the hips go in a
  straight line from takeoff height to landing height, and the legs tuck
  under them. The game's physics supplies the arc.

## How it is retargeted

`retarget()` in `scripts/sketchfab-avengers.mjs`, with two additions:

1. **The source's rest is its bind pose** (`bind: true`). Sketchfab left
   these downloads' nodes posed partway through a clip, and their inverse
   bind matrices are in a Z-up mesh space. `bindPose()` rebuilds the T-pose
   from the inverse bind matrices, turned by whole quarter turns so it stands
   up facing +z, and the clips are carried over relative to that.
2. **Unreal fingers** (`thumb_01_l` … `pinky_03_r`) are mapped to Mixamo's.

Every clip plays in place, facing +z: the hips' drift over a cycle is taken
out. Each clip is then raised so that its lowest skinned vertex at the
lowest moment on the ground meets y = 0 (by 2.7 to 4.5 cm; otherwise the feet
sank about 3 cm). Keys a straight line would give are dropped, and rotations
are stored as normalised 16-bit values.

The in-place fix also corrects a bug in `retarget()`: it zeroed the first
frame's offset before shifting the other frames by it. Re-running the script
for Cap, Thor or Widow would now centre their hips slightly differently
(by however far their first frame was off-centre).

## Contact sheets

- `idle.jpg`, `walk.jpg`, `run.jpg`, `jump.jpg`: frames across, with front,
  three-quarter and side views down the rows.
- `joints-upper.jpg`, `joints-lower.jpg`: close-ups of the shoulders and
  elbows, then the hips and knees, at 0°, 45°, 90° and 180°, on the
  hardest frames. These are the run's furthest arm swing, the jump's deep
  crouch, its arms-up launch, the tuck and the landing.

I found no candy-wrapping, pinching or tearing at the shoulders, elbows,
wrists, hips or knees. The largest twist about a bone's own axis is 50° in
the upper arm (the run's back swing), 38° at the wrist and 43° at the thigh
(the jump's landing). The twist bones, left to follow their parents, carry
these without visible wrapping, so I didn't drive them.

## Not done

- The idle is the Advanced suit's ready stance: knees soft, shoulders
  forward, a slow breathing sway. It is only mildly crouched and springy.
  The deeper, wide-legged Spider-Man crouch I found (Spiderman 2099's `wait`)
  is turned sideways and on a Biped rig, so I didn't use it.
- None of the clips drive the twist or deform helper bones; see above.
