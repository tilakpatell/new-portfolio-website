# Handoff: the Rick and Morty multiverse, Phase 1

Plan: `docs/superpowers/plans/2026-10-06-rick-and-morty-multiverse.md`.
Branch: `claude/rm-multiverse-phase1`.

## Done

- **Four places at the top of the dial** (rows 0–3 of the destinations'
  column), each a lazy area on `dimensions/stage.js`:
  - **Interdimensional Customs** (`customs.js`): the show's white hall, two
    scanner arches with a queue of travellers from other dimensions (the
    crowd copies), the Gromflomite agents at their desks, Krombopulos
    Michael, portal pads, a window on a yellow alien city. Take Rick's Mega
    Seeds, walk through the scanner, and the arch goes red. Get home through
    the portal inside a minute and it counts. Without the seeds the scanner
    stays green.
  - **Planet Squanch** (`squanch.js`): red grass, Squanchy's cat-tree house
    (Meshy) and two more (built), suckulents, and the wedding. Raise a glass
    and the Federation raids it: portals open, Gromflomites step out, the arch
    goes over and the guests run. Get home inside a minute. The wedding stays
    over afterwards.
  - **Gazorpazorp** (`gazorpazorp.js`): the women's city cut into a red rock
    wall, Mar-Sha at the gate, Morty Jr. with his book, two Gazorpians over a
    rock. Knock at the gate.
  - **Bird World** (`birdworld.js`): clay towers under umbrella canopies,
    teal crystals, Birdperson's tower-house (Meshy). Birdperson is at his door
    until the wedding; Phoenixperson stands there after it. Unity is
    visiting. Knock at the door.
- **One escape rule for all three timed places.** `destinations.js` gives a
  place an `escape` (`spot`, an optional `after` spot that has to come first
  and the line said if it hasn't, `s` seconds, `task`) and `acts` (a hotspot
  that tells the builder by name). `RmWorld.jsx` runs them all. The Purge
  Planet's siren now goes through the same code, and every place is told
  `calm` when Morty leaves it.
- **`after` on people and hotspots** (`rules.js`'s `present`, `stage.js`'s
  `make`): there only once that thing is done. `when(state)` lets a builder
  decide for a figure itself (the raid's agents, the guests).
- **The models**, made on the `~/.tilakverse.env` account (a task id only
  works on the account that made it): Squanchy, Birdperson, Phoenixperson,
  Unity, Mar-Sha, Morty Jr. (rigged), the Zigerion crowd copy, Squanchy's and
  Birdperson's houses. Krombopulos Michael is a Sketchfab model (CC BY,
  ELCHUPAAANOS) rigged by Meshy: `scripts/meshy-rm-local.mjs bake` turns it
  to face +z and stands it on the ground, then `rig` sends it as a data URI,
  and `fetch` credits it in `src/data/modelCredits.json`. Mar-Sha and Morty
  Jr. lost the arms on their heads in Meshy's A-pose pass; their models were
  made again with `pose: false`. Credits: 3,100 → 2,619.
- Shots: `docs/superpowers/shots/2026-10-06-rm-phase1-*.webp`. A scripted
  playthrough of all five timed and talk tasks passed with no page errors.

## Not done

- **Gwendolyn** is left out on purpose: the show's is a sex robot.
- **The map's Birdperson** (Task 1.5's second half) is still built in code
  (`universe/trafficModels.js`'s `birdperson`, and `phoenixperson`). Swapping
  in the Meshy figure means a flying pose. Several open PRs touch the
  universe, so it was left for later.
- Small misses: the Zigerion copy has two arms, not four. Morty Jr.'s normal
  hands are pale, not red. The wedding guests still block the way after they
  run, since `rules.js` counts a place's crowd as always there.
- Phases 5 and 6 are next. The `~/.tilakverse.env` account has 2,619 credits,
  enough for both.
