# The Battlefront II (2017) drop is a source for the galaxy, credited as EA DICE’s

Date: 2026-10-10. The long version: `docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md`; the numbers: `docs/superpowers/evidence/bf2017-assets/inventory.md`.

## Context

The owner extracted Star Wars Battlefront II (2017)’s models, and later its textures, clips and sound, into a private Supabase bucket (`bf2017-assets`), and holds permission to use them on this site, a non-commercial fan project. The drop is the whole game: every original- and prequel-trilogy hero and trooper, the hilts and blasters, the vehicles, and kits for most of the galaxy’s worlds, each model already cut at up to six levels of detail. Its people share one 250-joint rig with fingers (`Walrus_HumanMale`, Maya HumanIK names, which are Mixamo’s without the prefix). The galaxy today wears Meshy figures on a 24-bone skeleton, Sketchfab models, the 2005 remaster’s troopers (`battlefront.js`, with Harrisonfog’s permission) and boxes.

The owner’s answers (the spec’s “answers” section): deploy as today, with no gate; keep the 2017 rig rather than move its people onto Meshy’s; people first, then vehicles, then worlds.

## Decision

The 2017 drop is a source for the galaxy’s models, fetched ahead by `scripts/bf2017-fetch.mjs`, passed through `scripts/bf2017-import.mjs` and committed; nothing is fetched by a visitor. Every model is credited as EA DICE’s with `license: 'permission'` and the text “From EA DICE’s Star Wars Battlefront II (2017), used with permission on this non-commercial fan project; Star Wars and everything in it belong to Lucasfilm.” The site deploys as it does today. The sequel era stays out: the import refuses its folders. Every 2017 person keeps the 2017 rig whole, as DICE made it: body, fingers, face, cloth physics and weapon sockets (254 joints on Luke), so the game’s own clips and physics can drive it accurately when they arrive. No bone is pruned or renamed: the site learns the game’s skeleton, not the other way round.

## Consequences

- A whole rig costs a little: Luke’s plain cut is 706 KB, against 675 KB when it was tried pruned to the bones his body weights, which took his fingers and all 79 face bones with it.
- The import picks each cut from the drop’s LOD chain instead of simplifying, so a model keeps DICE’s own detail at every level the site loads.
- A new catalogue group, `catalog/bf2017.js`, comes last in `GROUPS`: a kind there takes over from the same kind anywhere else, the 2005 troopers’ included.
- This is the revisit `2026-10-08-fingers-on-the-meshy-skeleton.md` asked for: a rig that has fingers from birth. The Meshy figures keep their added fingers; the 2017 people bring their own, so the two skeletons live side by side, both on Mixamo’s names, and `rig.js` finds bones by role on either.
- The bucket key lives in `.env.local` only (or the cloud session’s environment); `.env.example` names it, empty.
- The credits page lists the 2017 models under “used with permission”, beside Harrisonfog’s.

## Revisit when

- The owner gates the site, or it stops being non-commercial: the permission was given for this shape of project.
- The classic bucket (`bf2-extract`) fills with something other than the 2005 game’s `.msh` and `.tga`, which `battlefront-import.mjs` already reads.
