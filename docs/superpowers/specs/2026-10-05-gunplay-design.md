# Gunplay and the crews on foot: design

Date: 2026-10-05. Status: written from the user's request; built and merged
in parts, each its own PR.

## Intent

What the user said: "make it so the weapons and shooting and general
character (us) animations are much much better and realistic. Really spend
time and perfect it for the various models."

What that means here: the crews you walk about as on the universe map's
planets (`universe/footScene.js`: Rick and Morty, Walt and Jesse, Chewie and
Han, Luke and Artoo) and on the galaxy's worlds (`galaxy/surface/scene.js`),
the Federation's squads that come at you, and the other pilots' crews met
online. Today each figure plays Meshy's idle, walk and run clips; a shot
raises a straight stiff arm along the line of fire and a gun of a few boxes
is set at the hand's position each frame; a hit squashes a trooper, a death
tips one over sideways like a plank; there is no muzzle flash, no recoil, no
reaction to being shot, and on the galaxy's worlds no gun at all.

## Decisions

Made for the user, who asked for this to be done without checking in; each
is the choice a careful colleague would make.

- **No new models.** This container can't reach Meshy or Sketchfab. Every
  figure stays the model it is; the guns are built in code, properly this
  time, and every improvement is in how the figures are posed and what
  happens round them. The HD figures of other worlds (`lib/three/rig.js`)
  aren't touched.
- **One skeleton, one system.** Every rigged figure on foot (the crews, the
  troops, the galaxy's Meshy people) is on Meshy's 24-bone skeleton with the
  same bone names. One module, `universe/gunplay.js`, holds the gun and
  poses the arms, the spine and the head over whatever clip is playing. The
  built figures (Luke, Artoo) grow the same bone names on their own groups
  so the same code drives them.
- **Wire protocol unchanged.** Other pilots already send `aim` (0…1) for
  each walker; their crews are drawn with the same gunplay from that. No new
  fields.
- **Rules stay pure.** What a trooper does (`foot.js` `march`) gains an
  `aim` number, tested in Node, so the drawing only reads it.

## The parts

### 1. Pure math (`lib/three/ik.js`, tested)

- `elbowFor(shoulder, target, upperLen, foreLen, pole)`: the elbow of a
  two-bone chain reaching for a point, bent toward a pole vector, clamped
  when the point is out of reach.
- `reach(upper, fore, hand, target, pole, weight)`: that solve applied to
  three Object3Ds (bones or groups), each turned in world space and slerped
  by `weight` from the pose the clip left it in.
- `aimBone(bone, child, dir, weight)`: turn a bone so its child lies along a
  world direction (footScene's `pointBone`, moved here).
- `setWorldQuaternion(bone, q, weight)`: a bone's world orientation set
  outright (the hand, so the gun it holds points where it should).
- `frameFrom(forward, up)`: the orientation with +z along a direction and +y
  as near an up as it can be (a gun's frame).
- `palmFrame(points)`: from a hand's vertex cloud in the hand bone's space,
  which local axis is the palm's normal (the thinnest), which runs along the
  fingers (the longest), and which across the knuckles.
- `spring(state, dt, k, c)`: a damped spring step for recoil.

### 2. Gunplay (`universe/gunplay.js`)

`GUNS`: each gun kind (`blaster` Han's DL-44, `laser` Morty's pistol,
`portal` Rick's, `pistol` Walt's revolver and Jesse's automatic, `bowcaster`
Chewie's, `rifle` the Gromflomites', the cop's pistol) as: how it's held
(one hand or two), where the hand sits on it, where the other hand goes (the
foregrip), where the muzzle is, how hard it kicks, whether it throws a
casing, the flash's colour and size, and `build(owned)` making the model in
code at real size (metres, muzzle toward +z).

`createGunplay(figure, gun)`: attaches the gun to `RightHand` through a
grip frame worked out once from the hand's own geometry (`palmFrame`), with
a per-model override table for the few whose hands fool it. Each frame,
after the clip has posed the body and the figure stands where it should:

- **Stance** by `aim` 0…1: lowered (the gun along the thigh, the hand turned
  to hold it, the clip's arm swing kept), ready (the gun up across the
  chest, both hands on a long gun), aimed (the right arm reaching to put the
  gun on the line of fire, the left hand on the foregrip of a long gun, the
  spine twisted toward the target up to 60°, the head turned to it).
- **Recoil**: a shot kicks the gun back along its barrel and up, on a
  spring; the arms follow because they reach for the gun's grip, the spine
  takes a little of it.

`fire()` returns the muzzle's world position and the barrel's direction, so
the shot leaves the gun and not a point in the air.

### 3. Shooting FX (in `footScene.js`, pooled)

Muzzle flash (two crossed planes and a disc, additive, 60 ms, the gun's
colour; one `PointLight` made with the scene so no shader recompiles, its
intensity up for the flash); bolts with a bright core and a soft sleeve;
impact sparks (a burst of short streaks under gravity) and a scorch on the
ground that fades; casings from the pistols, bouncing once; a flash of
emissive on a trooper hit; the camera kicked a touch on your own shot.

### 4. Bodies

Clips paced to the ground covered (a stride measured from each clip once,
so feet don't slide); a leap pose in the air and a crouch on landing; a lean
into turns, strafes and acceleration; a flinch when hit; a death that
buckles at the knees, drops the hips and lays the figure down the way the
shot pushed it, then fades into the ground; dust where feet land.

### 5. The galaxy's worlds

The crew there get their guns and the same stances, aimed along the camera
when you fire, with the muzzle flash and the shot from the muzzle. Peers
too.

## Order of work

One PR each, merged to main when lint, tests and build are clean.

1. This spec, the plan, `ik.js` with its tests, `march`'s `aim`.
2. Gunplay: the guns, the grip, the stances, recoil; wired for the party,
   the mate, the troops and the guests on the universe map.
3. Shooting FX.
4. Bodies.
5. The galaxy's worlds, the docs.

## Checked how

Vitest for every pure part. For the look of it, `scripts/preview/gunplay.html`
(through `npx vite`) stands every crew figure and trooper in a row, each
holding its gun, lowered, ready and aimed at a mark, from the front and the
side, and fires on a timer; Playwright screenshots of it are looked at
before each merge. The universe map itself is checked by landing on a
planet in Chromium.
