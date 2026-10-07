# Handoff: the Rick and Morty sector

The plan was [PLAN-rm-sector.md](PLAN-rm-sector.md). The Rick and Morty
worlds used to sit in a cluster round the Citadel in the main map. They now
have a sector of their own, reached through a green portal. The work went in
as one PR per step of the plan's section 5, from the branch
`claude/rm-sector-opus`.

## What's done

1. **Sectors** (`layout.js`): `SECTORS` (main, and `rickmorty` with its
   origin at `[0, 0, -40000]` and an edge of 6000), plus `sectorOf`,
   `inSector`, `sectorOut`, `SECTOR_OF` and `SECTOR_RADIUS`. The Citadel
   sits at the sector's middle. The worlds sit on the sector's own
   golden-angle spiral (first 900 out, 450 more each, heights ±300),
   all more than 1000 apart. The sector's own sun is `curvesun`, a `star`
   wonder, so `lighting.js` lights the worlds from inside the sector.
   The ship's edge turn-back now works per sector (`ship.js` `step`).
   New ships start in the main sector only. `MAP_RADIUS` still counts the
   main sector only, so the main map's positions haven't moved. The Rick
   and Morty war keeps its old coordinates in the main sector, and the
   battles that were named after moved places now use other places from
   the show (`wars.js`).
2. **Portals**: `rmportal` beside the Rick and Morty planet and
   `rmportal-back` beside the Citadel. Both are non-solid `portal` wonders
   in `deep.js`, each with `leadsTo`. `portals.js` has the pure parts:
   `portalHit`, `exitSpot` and `transit`. The scene's `portalThrough`
   gives a flash, a HUD note and `{ type: 'sector' }`, which plays the
   portal sound in `Comms.jsx`. `sectorPortals.js` draws the portals.
   Rifts only open inside the ship's own sector.
3. **Nav map and routing**: `nav.js` has `legOf`, `portalBetween` and
   `TRANSIT`, and `distanceTo`/`tripTime` count the way through the
   portal. The scene's `travel` goes by the portal and then on to the
   place (`state.then`). The nav map opens on the chart of the ship's
   own sector (the `rickmorty` view, "The Curve") and draws the course
   to the portal. The mini-map marks the portal.
4. **Whose space**: `sides.js` `sideAt`/`crewAt` make the sector's
   hunters, director events, skirmishes, characters and traffic the Rick
   and Morty side's, whatever the crew. `curve.js` draws the sector's edge
   as the Central Finite Curve.
5. **More worlds**: Pluto, Snake Planet and Nuptia 4 are in, bringing the
   sector to seven worlds. They use only models that already existed
   (`public/models/c137/rm/`, `public/games/meshy/`), so no Meshy credits
   were spent.
6. **Docs**: README (the map paragraph and the C-137 row), and
   `architecture.md` (the sectors bullet).

The PRs: #485 (sectors), #494 (portals), #500 (nav map and routing),
#512 (whose space, the Curve), #521 (more worlds), and this one (docs).

Check: `node scripts/sector-check.mjs` with the dev server on port 5173. It
looks at the portal, flies home → Gazorpazorp in one trip (through the
portal on the way), opens the nav map there, lands, goes to the Citadel,
and flies home in one trip. Its shots go to `$OUT`. In headless Chromium
(software GL) the whole run takes about 25 minutes, and every step passes.
The new worlds' landings were checked with `scripts/landing-check.mjs pluto
snakeplanet nuptia`: each lands and shows its title card. That script's
120 s wait for the crew is too short in software GL, on every planet.
Don't edit `src/` while a check runs against the dev server: the hot
reload resets the page under it.

After the plan: the Immortality Field Resort became the eighth world
(Risotto Groupon, the guests and the Whirly Dirly car, all existing
models). The sector's sun got the home sun's reach (`light` in
`deep.js`, read by `lighting.js`), so the furthest world is lit at full
strength. And a hand-flown trip through a portal now lets go of a place
picked on the other side (`pages/Universe.jsx`, on `sector`).

## Not done, or left as is

- The Galactic Federation's own sector fleet from the plan (the
  `fleetRickmorty*` hulls as set dressing), and a Council of Ricks patrol
  kept near the Citadel. The sector uses the Rick and Morty side's
  existing hunters, director pieces (the Council, the NX-5) and traffic.
- The plan's other candidate worlds are still out: Cronenberg World and
  the Purge Planet. They need models the repo doesn't have yet (Meshy).
- The four older worlds' landings still use code-built rocks, gates, cogs
  and perches (`landings/rmmoons.js`). The new worlds use models for their
  set pieces and keep only the rock scatter.
- No crew lines were added for arriving at the new worlds. Crews have no
  per-moon `arrive` lines, the same as before.
