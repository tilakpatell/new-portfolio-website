# Handoff: the Rick and Morty multiverse, Phase 5 (and where Phase 6 stands)

Plan: `docs/superpowers/plans/2026-10-06-rick-and-morty-multiverse.md`.
Branch: `claude/rm-multiverse-phase5`.

## Done

- **The Vindicators' ship** (row 12 of the dial, `dimensions/vindicators.js`):
  the hall of white and blue panels, the holo-table with its stain, the
  ship turning over it as a hologram, the beacon, the team's portraits, the
  stars, and the door Rick scrawled on. All six are there: Vance Maximus,
  Supernova, Alan Rails, Million Ants, Crocubot and Noob-Noob, each with a line.
- **Rick's rooms** (`dimensions/vindicatorsRules.js`, tested): three rooms
  (the swapped levers, a riddle, the button for the one Rick likes). A wrong
  pick sends him back to the hall; three right ones are the `vindicators`
  thing done. `RmWorld.jsx` asks them in the dial's overlay
  (`DimensionDial` now takes `title`, `lead`, `foot`, `label`). A hotspot
  of `kind: 'trial'` opens it. A place's `goal` is the hotspot the map points
  to when no talk or escape says.
- **A fix for the portal gun's dial**: its root class was `.rm-dial`, which
  interdimensional cable's round channel buttons also use (`rickmorty.css`:
  44 px, grid). The dial was squeezed to its head with the rows spilling out
  below. It's `.rm-dial-box` now.
- Models (Meshy, `~/.tilakverse.env` account): the six Vindicators rigged
  with idles, and the ship. A scripted playthrough passed with no page
  errors. Shots: `docs/superpowers/shots/2026-10-06-rm-phase5-*.webp`.

## Phase 6: started, not finished

- **Made but not rigged**: `nebulon`, `storylord`, `ticketsguy` (figures),
  and `zigerion-b`, `zigerion-c` (crowd). Their prompts are in
  `scripts/meshy-rm-local.mjs`'s `PHASE6`. Their image and model task ids are
  in `scripts/meshy-tasks.json`, on the `~/.tilakverse.env` account. Thumbnails
  are in `lab/meshy/rm/<name>-front.png`; judge them first. Next:
  `node --env-file=$HOME/.tilakverse.env scripts/meshy-rm-local.mjs rig nebulon storylord ticketsguy`,
  then `anim` for the same three, then `fetch` for all five. Copy
  `zigerion-b.glb` and `zigerion-c.glb` from `node_modules/.cache/meshy-full/`
  to `public/models/c137/rm/`.
- **Still to build**, as the plan's Tasks 6.3–6.5 describe:
  - the Zigerions' simulation (row 13);
  - the Story Train (row 14);
  - Rick Prime's fortress (row 15). `rickprime` is already made.
  - the Rick and Morty system on the universe map.
- Credits on the `~/.tilakverse.env` account: about 1,860. Other sessions
  spend from it too.

## Not done

- The map's Birdperson is still the code-built one (see
  `HANDOFF-rm-phase1.md`).
