# Handoff: the Rick and Morty multiverse, Phase 3

Plan: `docs/superpowers/plans/2026-10-06-rick-and-morty-multiverse.md`
(Phase 3 ticked, with a note of where it differs). Spec: its "model
standard". Branch: `claude/rm-multiverse-phase3`.

## Done

- **Phase 3's fifteen assets**, made through the gate with
  `scripts/meshy-rm-local.mjs` (its `PHASE3` set, the prompts rewritten
  from the wiki's stills): Big Morty (with a seated clip), Slick Morty, the
  campaign manager, Rick D. Sanchez III, Simple Rick, Evil Rick and the
  three Locos, rigged, in `public/games/meshy/`; the Supreme Guard and
  Garment District Ricks for the crowd (full-size in
  `node_modules/.cache/meshy-full/`, baked by `scripts/crowd.mjs`); Morty
  Mart, The Creepy Morty, the Citadel from space and the NX-5 in
  `public/models/c137/rm/`. Sketchfab and Meshy's community had nothing
  that passed. Credits: 2,316 before, 1,598 after.
- **Mortytown** (Tasks 3.2 and 3.3): the lift in the concourse's
  south-west shopfronts, the district (`mortytown.js`, `district.js`,
  `townsfolk.js`) and the Locos quest (`locos.js`, `story.js`), with its
  achievement.
- **The Citadel from space** (Task 3.4): the model takes over from the
  built one once it's loaded; `CITADEL_PARTS` follow it.
- **The NX-5 Planet Remover** (Task 3.5): `remover.js`, `removerView.js`,
  the director's `remover` event in Rick's universe, the crew's lines, the
  landing refusal and the achievement.
- The runner's task-id saves merge with what's on disk, so two of its
  steps can run side by side (one id was lost before; recovered from
  Meshy's task list).

## Not done, from the plan

- **Phase 0, Tasks 0.3 to 0.6** (lazy areas, the dial, destinations as
  data, the dial on screen) were never merged, and **Phase 1** (Customs,
  Planet Squanch, Gazorpazorp, Bird World, and their thirteen assets) was
  never made: nothing of either is on any branch.
- Phases 4 to 6, and Phase 6's places for Rick Prime, the Zigerion ship
  and the Story Train (their models are made).
- The NX-5 isn't carried online: other pilots don't see yours (as with
  the Star Destroyer). `remover.js` keeps damage per pilot, ready for a
  protocol action if it's wanted.

## Checking it

- `npm run lint`, `npx vitest run`, `npm run build`.
- Dev server on 5197: `npx vite --port 5197 --strictPort`.
- `OUT=lab/shots node scripts/citadel-shots.mjs` (the lift, Mortytown's
  views, the hunt); headless Chromium draws in software, so a run takes
  some minutes.
- The NX-5 by hand: on the map as Rick's cruiser, by a planet, in the
  console `__universeDebug.happen('remover')`.
