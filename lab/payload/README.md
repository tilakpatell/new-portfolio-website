# The front door’s payload

What `/` (the universe map) downloads in its first 12 seconds, measured by
`scripts/payload-check.mjs` on a production build (`npm run build`, served by
`vite preview`), in headless Chromium at 1280 × 720 on `high`. JavaScript is
counted both as it came over the wire (gzip) and unpacked (what Vite’s build
report and the brief count). A returning visit has the intro seen; a first
visit starts at the welcome.

| | before (main) | after |
|---|---|---|
| assets, returning visit | 7.00 MB in 83 requests (GLB 2.94, images 3.84) | **2.62 MB** in 58 (GLB 0, images 2.42) |
| assets, first visit | 7.82 MB in 86 (GLB 3.75: Chewie’s 0.74 among them) | **2.63 MB** in 60 (GLB 0) |
| JavaScript, returning visit | 2.91 MB unpacked, 0.99 MB wire, 117 chunks | **2.37 MB** unpacked, 0.80 MB wire, 85 chunks |
| JavaScript, first visit | 2.97 MB unpacked, 1.02 MB wire, 126 chunks | **2.38 MB** unpacked, 0.80 MB wire, 92 chunks |

The JSON beside this note has every number: `before-*.json` on main,
`after-*.json` on this branch.

## What moved

- **The planets’ own models** (Optimus and Megatron round Cybertron, the
  Venator and the two Star Destroyers by the Star Wars place, the cruiser,
  Mario, the Pearl, the sitar…, 2.9 MB) load as each planet comes near:
  `universe/nearby.js`’s `wanted`, inside 8 radii, or in view with its disc
  24 px or more across the radius. From the home system the fandoms’
  planets are 7 to 18 px, their models a pixel or two.
- **The fandom planets’ maps** start at their `-sm` size on a desktop and get
  the full file as the planet comes near (`planets.js`’s `farFile` and
  `upgradeMaps`, swapped into the same texture, so nothing else changes):
  1.4 MB less. A planet a few pixels across samples a small mip level of
  either.
- **The landings on foot** (`footScene.js` and what it brings: 159 kB) are a
  dynamic import, asked for as a planet you could land on comes near; until
  it’s here, `nearby.js`’s `standIn` answers that nobody’s on foot.
- **The war front** (`front.js`, `battle.js`, `battleScene.js` and the
  galaxy’s models) is fetched only for a side whose war is ready on the map:
  none is yet.
- **The model credits** (`data/modelCredits.json`, 95 kB unpacked) are fetched
  when a credit comes within 200 px of the screen, not carried in the code
  of every page that shows one.
- **The nav map** (M) is fetched the first time it opens.
- **The core pages’ idle prefetch** waits, at the front door only, until you
  reach for the nav or ⌘K, or 20 s (the idle callback otherwise came while
  the universe’s own code was still arriving).
- **Chewie** (0.74 MB) is fetched as the crawl starts, not at the welcome.

## What’s left

JavaScript is 2.37 MB against a 2.2 MB target. What remains is mostly drawn
in the first frame or built for it: three.js (0.74 MB), the universe scene
(0.23 MB), the `planets` chunk (0.30 MB: planets, stations, and the built
fleets). The built fandom fleets (`fleetStarwars`, `fleetRickmorty*`,
`fleetBreakingbad`, the galaxy’s `fleetRebels`: about 136 kB unpacked) are
the next 0.14 MB, but the scene builds one of every kind as it starts (for
its shaders), and the galaxy builds them through the same table
(`galaxy/fleet.js`, `galaxy/models.js`), so making them lazy means the
traffic, the hunters and the warm-up asking for a fleet’s builders by where
you are, across the galaxy’s lane too. The planet cards (`interests/cards.jsx`
with `Photo` and the photos list, about 60 kB) and the Hangar are statically
imported by `UniversePanel.jsx` and `UniverseMap.jsx`, which an open PR is
changing.
