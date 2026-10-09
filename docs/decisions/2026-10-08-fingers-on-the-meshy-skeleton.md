# Fingers added to the Meshy skeleton, not a new skeleton

Date: 2026-10-08. The long version: `docs/superpowers/specs/2026-10-08-npc-player-rigging-design.md`.

## Context

The question: every humanoid on the site (about 270 figure files: the galaxy’s crew and troopers, Middle-earth’s cast, the office, Albuquerque, Rick and Morty, Invincible, the cockpits) stands on Meshy’s 24-bone skeleton, which ends at the wrist. No finger, thumb or twist bones; the only finger motion is `grip.js`’s morph round a gun. Every clip (254 in `clipLibrary.js`) is written on those 24 names. The owner asked for better hands, fingers, a crouch and respect for each body’s art style.

What was measured in the session (a gltf-transform pass over the GLBs, kept as `scripts/rig-audit.mjs`): 24 joints and 0 fingers on every Meshy file read (Luke, Vader, the stormtrooper, the clone, the battle droid, Aragorn, Mark, Omni-Man, Michael, Walt, Rick, Morty, C-3PO, Chewie); fingers on the six that are not Meshy’s (the Ithorian 47 joints, Thor 34, the Hulk 279, Spider-Man 176, Mario 63, Bumblebee 131). The Universal Animation Library mannequins (Rigify `DEF-*` and Unreal names) carry three joints a finger, and `scripts/ual-bake.mjs` drops them because the target has none.

The ways to fingers:

| way | cost | what it does to the 254 clips |
| --- | --- | --- |
| re-rig every figure (Mixamo, AccuRIG, UniRig, Tripo) | minutes to an hour a figure, by hand or on a GPU; a service or an install | strands them: every clip would need retargeting onto new names and new rests |
| Meshy’s rig again | 5 credits a figure, and Meshy’s rig has no fingers | nothing |
| add finger bones to each file by its own geometry, under the hand bone, with weights split from the hand’s | one script, run once, free, idempotent | none: a clip names no finger, so a finger it does not drive stays at rest, as today |

## Decision

Finger bones (and one forearm twist bone a side) are added to each Meshy figure by `scripts/hands-extend.mjs` from the hand’s own vertices, named as Mixamo names them without the prefix, each in one canonical rest frame (+y along the finger, +z out of the back of the hand). The skeleton stays Meshy’s; hand poses are scalars in that frame (`handPoses.js`), so one table fits three-joint hands, two-joint thumbs, toy mittens and the game-rip rigs. The library’s finger motion is carried by the same retarget that carries its bodies.

## Consequences

- One skeleton on the site still; every existing clip plays unchanged; a figure the script cannot read keeps the morph grip.
- A hand the geometry cannot split (a mitten) gets one finger group; it curls as one, which at the site’s distances reads as a hand.
- Skinning does more bone-matrix work a figure (54 against 24); the crowds are under `animBudget`, and the Citadel and Edoras are measured before Phase 2 ships.
- The re-baked UAL files roughly double (about 2.5 MB more across the library, loaded a clip at a time).
- New figures keep coming through Meshy’s rig or `rig-transfer.mjs` and get their fingers from the same script, so the pipeline is unchanged.

## Revisit when

- A free auto-rigger gives fingers on Meshy-quality meshes in one command on the desktop and names them to a convention `rig.js` reads; then new figures could carry fingers from birth, though the 270 would still be extended.
- The hand sheet shows the geometric split failing on more than a tenth of the cast.
- A world needs a face (a jaw, eyes): that is a new design, not this one.
