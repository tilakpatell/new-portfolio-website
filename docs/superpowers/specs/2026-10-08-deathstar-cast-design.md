# Aboard the Death Star: the cast made right, bodies that fall, and a station easy to play

Status: design, written 8 October 2026, for the owner’s ask of the same day. Builds on `2026-10-07-deathstar-inside-design.md` (the world as merged in #564, #628, #650, #661, #665).

## What the owner asked for

“Finish the death star implementation AND fix the models. Generate old Obi-Wan model and make sure all the models are rigged and work and the animations are correct and ragdoll and stuff. Make it easier to use. Make it perfect and iterate.”

The owner asks for no checkpoints (standing feedback: take the recommended picks and keep building), so the choices below were made for them.

## What a playthrough found (8 October, Metal Chromium)

- **Obi-Wan is the wrong man.** `galaxy/crew/obiwan.glb` is the Clone Wars Obi-Wan (young, red-haired, white tunic, red boots), on a station of 0 BBY.
- **C-3PO stands in a T-pose and slides.** His model is on a Mixamo rig (66 bones); the crew’s clips are on Meshy’s 24 bones, so none of them binds.
- **The Death Star trooper is a black silhouette.** The officer’s olive uniform multiplied by 0x2e2f33 leaves no detail; the Royal Guard (blue robes multiplied by red) comes out a near-black maroon.
- **Everyone with you stands inside you.** Companions are placed 1.4 m behind you; in the smuggling hold that is off the floor, so all five fall back to your own spot, and Chewbacca fills the camera. Nobody standing still is ever pushed apart.
- **Seated people stand.** Tarkin, Motti and Tagge are given posts at their chairs, so they stand at attention inside the conference table; Leia stands on her bench.
- **A few clips do everything.** The figures play Rick’s idle, walk and run and nine fight clips. Console work, talking, attention, crouching, sitting, sabre strokes and the Force all show as standing still, though the site’s clip library (`lib/three/clipLibrary.js`) has all of them on the same skeleton. The walk is paced by speed alone, so feet slide on turns and strafes.
- **The dead fall on a canned clip.** Every death is one of two falls played to its last frame: the same heap whatever the shot, through walls and over ledges.
- **Nothing shows the way.** The objective is text only; the station is dozens of rooms over levels and lifts, and a story beat can name a room four doors and a lift away.

## Decisions

1. **Old Ben made with Meshy, rigged here.** A concept (text-to-image, `nano-banana`, 3 credits) and an image-to-3D model (`meshy-6-lite`, textured, 15 credits): the account had 21 credits. Meshy’s rig is not used: `scripts/rig-transfer.mjs` moves the crew skeleton and skin weights of `jedi3` (the crew’s old robed man, A-posed by the same pipeline) onto the new mesh, so old Ben plays every shared clip. He is `public/models/deathstar/obiwan.glb`; the galaxy keeps its own Obi-Wan.
2. **Mixamo figures play the crew’s clips.** A clip made on Meshy’s skeleton is retargeted onto a Mixamo skeleton by bone name, through the two rest poses in the world (each bone’s turn from its rest, carried across), once per clip and model. C-3PO walks, sits and falls like everyone else.
3. **Dyes, not tints.** A kind’s colour becomes a dye: its materials keep their light and shade and take the dye’s hue (`dye` in the cast, applied in the shader), so the Death Star trooper is charcoal cloth with a sheen and the Royal Guard is crimson. `tint` stays for the few that want a multiply.
4. **One animator for the crew and the player.** The figures move onto `lib/three/animator.js`, as the galaxy’s, the office’s and the universe’s people already have: locomotion paced to the ground they cover (no skating, strafes and backward walks), base states (crouch, sit), one-shots over them, upper-body layers, and the head’s look. The rules already say what each person is doing; the scene maps it to clips:
   - poses: `attention` (a stance), `work` (at a console: typing and looking), `talk` (talking with their hands), `sit` (sat; new in the rules for posts on seats), `idle`;
   - fights: shooting while standing or walking, reloading, hit reactions by where they were hit and from which side, kneeling; sabre fighters take the sword clips for strokes, guards and parries; the Force has its casts for the one who uses it and lifted, choked, thrown or electrocuted for the one it is used on;
   - the player: crouch and crouch-walk, jump, land, strafe and walk backward while aiming.
5. **A real ragdoll.** `lib/three/ragdollPhysics.js`: a Verlet body for Meshy’s skeleton (a point at each joint, sticks along the bones, braces across the hips and the chest, cones at the elbows and knees), gravity, the shot’s push carried in from the last frames of the pose, friction, and collisions with the floor under each point and the station’s walls; the bones are turned to follow their points each frame. A body is played into a short hit for a quarter of a second, then let go; it settles on the deck, down stairs or over a ledge. Pure maths, tested in Node. The rules decide who dies and where the body lies; the drawing is the scene’s.
6. **Never on top of each other.** Companions are placed on free floor round you (a ring of candidates, the floor and the furniture checked), and the crew’s step pushes anyone standing within a body’s width of another apart, along the floor and out of the furniture.
7. **The way shown.** The story’s target becomes a route (rules/nav.js’s A*, doors and lifts), and the HUD shows a marker at the next door or the target itself, with its distance; off screen it sits on the screen’s edge as an arrow. The blueprint map draws the route. A first-time card shows the controls; the pause menu keeps them.

## Not in this pass

- Gen3d models for the IT-O and the dianoga (the code-built ones stay) and the Death Star trooper’s own model: the Meshy account is spent.
- Voices for Tarkin, the Emperor, Jerjerrod, Motti and Tagge (the voices pipeline, a desktop job).

## Testing

- Rules, Node, test first: companions placed on free floor; people pushed apart and kept off furniture; posts on seats sit; the route to each story step’s target goes through doors and lifts; the ragdoll’s sticks keep their lengths, it comes to rest on a floor, never passes a wall, and respects its cones.
- Scene, Node where pure: the clip a person’s state picks, the Mixamo name map, the dye’s colours, the weight transfer’s sums.
- In the browser (headless Chromium on Metal, `window.__deathstar`): every cast kind in a lineup idling and walking; a trooper shot from the front, the back and the side; a body falling down the chasm; the conference room sat; the hold with five companions; the objective marker on each story’s first beats. Screenshots judged by eye.
- Gates: lint, `npm test`, build, `health --check`, `pack-check`.
