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

## Into the world (Phase 2 and Task 6.2)

- **Total Rickall** (Tasks 2.2, 2.3): the rules in `interiors/rickall.js`
  (tested), the crowd in `interiors/rickall3d.js`, fetched when the egg on
  the living room's bookcase first hatches. The ghost's jar is made there (a
  glass jar with a gold lid on a side table, the ghost glowing in it).
- **The family's friends** (Task 2.4), each fetched when their room is first
  entered and seated on the first frame of their sit clip (`seatOwn` in
  `interiors/people.js`): Mr. Poopybutthole on the couch (gone while
  Rickall's on), Snuffles on the dog bed by the sliding door, Space Beth on
  a stool at Rick's bench, Nancy and Tricia on the edge of Summer's bed,
  Diane as a cyan hologram in the clone lab (`hologram`).
- **Dr. Wong's office** (`wong`, `interiors/wong.js`, loaded on entry):
  its door on the house west of Shoney's (`WONG_HOUSE`), her armchair,
  the couch, the plant, the desk and diplomas; talking to her is the
  `wong` task and achievement.
- **The street's vehicles** (Task 6.2, `VEHICLES` in `rules.js`): Space
  Beth's ship and Jerry's car-ship on the Smiths' lawn either side of the
  walk, the Gotron (24 m) behind the houses across the street and the ferret
  east of it. They're solid, the cruiser flies over them and won't land on
  them, and `street.js` fetches them 3 s after the street is drawn.
- **Gotron's shin** is mended at fetch: `fix: 'shin'` recolours the blue
  texels of his left shin to its own green (`greenShin`).
- Shots: `docs/superpowers/shots/2026-10-06-rm-phase2-*.webp`
  (`node scripts/c137-shots.mjs rickall living summer garage basement wong lawn gotron`).

## Left

1. **Fold the runner in.** `scripts/meshy-rm-local.mjs` is the plan's `rm`
   pipeline for this slice's names alone, kept apart while the other session
   wrote Task 0.2 into `scripts/meshy.mjs`. Every task id is in
   `scripts/meshy-tasks.json`, so once these names are in `meshy.mjs`'s
   `rm` set it never pays for them again; then delete the runner (port
   `stiffenAnkles` and `greenShin` with it).
2. **Rick Prime, the Zigerion ship and the Story Train** are made but not
   placed: they wait on the dial (Phase 0's Tasks 0.4 to 0.6) and their
   places (Task 6.3's simulation and Story Train, Task 6.4's fortress).
3. **Merge**: this branch, `claude/local-models`, isn't merged to main yet.

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
