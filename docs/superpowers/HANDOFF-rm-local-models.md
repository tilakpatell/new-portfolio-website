# Handoff: the Rick and Morty multiverse's models, the local slice

Plan: `docs/superpowers/plans/2026-10-06-rick-and-morty-multiverse.md` (on
`claude/happy-goodall-lemwtr` until it merges). Spec: its "model standard".
Branch: `claude/local-models`.

Two sessions made the plan's models on the same Meshy account, so each took
a fixed slice and claimed it in `scripts/rm-models.json` before paying: the
cloud session Phase 1, this one Phase 2's people and props (Task 2.1) and
Phase 6's vehicles (Task 6.1), 26 assets. Meshy's community was searched
first and has none of them (`docs/research/2026-10-06-meshy-community-rick-and-morty.md`).

## Done

Every asset went through the whole gate: prompt checked against the wiki
before paying, concept judged against the wiki, model judged from four
sides, rig judged walking, running and idling beside Rick; each verdict by
two judges. Credited in `public/games/credits.json`, `done` in the ledger.

**Rigged figures**, in `public/games/meshy/<name>{,-idle,-walk,-run}.glb`
(Space Beth and Dr. Wong also `-sit`), heights for `meshyCast`'s `MESHY`:

| Name | Height (m) | Size | Small misses, kept |
| --- | ---: | ---: | --- |
| `spacebeth` | 1.68 | 1.2 MB | eyebrow ring drawn as two studs |
| `rickprime` | 1.85 | 1.2 MB | holster on the left thigh (see below), hair a brighter blue |
| `drwong` | 1.72 | 1.1 MB | fringe lighter than the show's |
| `nancy` | 1.6 | 1.0 MB | hair kept behind her shoulders (rig) |
| `tricia` | 1.62 | 1.0 MB | hair a shoulder-length bob (rig), brows heavy |
| `diane` | 1.68 | 0.9 MB | bangle and ring on the same hand |
| `pencilvester` | 1.6 | 0.9 MB | |
| `sleepygary` | 1.78 | 0.9 MB | |
| `hamurai` | 1.8 | 1.3 MB | |
| `amishcyborg` | 1.78 | 1.1 MB | |
| `mrbeauregard` | 1.85 | 0.9 MB | |
| `cousinnicky` | 1.8 | 0.9 MB | side hair behind the ears |
| `frankenstein` | 2.1 | 0.9 MB | skin a paler green than the show's |

**Props, creatures and vehicles**, in `public/models/c137/rm/<name>.glb`:
`snuffles`, `reversegiraffe`, `photographyraptor`, `tinkles`, `babywizard`,
`mrsrefrigerator`, `ghostinajar` (0.3 to 0.7 MB); `jerry-ship`,
`spacebeth-ship`, `zigerion-ship`, `storytrain`, `gotron-ferret`, `gotron`
(heroes at 40,000 faces, 0.9 to 1.4 MB).

**Rick Prime** is made from his third concept mirrored (`use rickprime
round3/rickprime.png flip`): the image model drew his pad on the wrong
shoulder every time, and mirroring puts it on his right as in the show, his
holster landing on the left thigh as the lesser miss. Meshy's auto-rig gave
his boot shafts a few per cent of the other leg's bones, which tore a fin
off each boot top in the walk and run on three rigs and two models; the
runner's `ankles` flag mends the weights at fetch (each vertex below the
knees keeps its own leg's bones, and the foot's share above the ankle moves
to the shin). Any tall-booted figure can take the same flag.

## Left

1. **The ghost's jar** (`ghostinajar`). Meshy made no clear glass in two
   tries, so the model is the ghost alone. The scene builds the jar (a
   transmissive glass cylinder with a gold lid), makes the ghost glow, and
   scales his height to about 0.7 so he reads as the show's squat bell. His
   mouth is a ridge, not a dark line: the ink pass should outline it.
2. **Gotron's green shin** (`gotron`). Its back and heel are blue, which
   shows only from behind. Recolour those texels green in code, or stand it
   with its back to something.
3. **Into the world**: the plan's Tasks 2.2 to 2.4 and 6.2 to 6.3 place
   these (`MESHY` and `RIGGED` in `portal/meshyCast.js`, the props by name
   from `/models/c137/rm/`).
4. **Fold the runner in.** `scripts/meshy-rm-local.mjs` is the plan's `rm`
   pipeline for this slice's names alone, kept apart while the other session
   wrote Task 0.2 into `scripts/meshy.mjs`. Every task id is in
   `scripts/meshy-tasks.json`, so once these names are in `meshy.mjs`'s
   `rm` set it never pays for them again; then delete the runner.

## Checking it

- `node scripts/rm-cast-shot.mjs lab/x nancy:1.6,tricia:1.62 idle,walk,run front,side --fit`
  with the dev server on 5197 (`npx vite --port 5197`): the figures beside
  Rick through the cast's own loader.
- `BASE=http://127.0.0.1:5197 node scripts/glb-shot.mjs public/models/c137/rm/gotron.glb lab/gotron.png three,front,side,back`
  for a prop from four sides.
- On Windows, a script that uses glTF-Transform's functions must use the
  sharp that `ndarray-pixels` loads: two libvips in one process fail every
  texture ("colourspace: parameter space not set"). The runner does.
- Credits spent: 1,794 of the account's (4,860 to 3,066), against the plan's 1,159 for the
  slice. The judging was strict and most assets needed a second or third
  concept; the gate's rerolls are what the overrun bought.
