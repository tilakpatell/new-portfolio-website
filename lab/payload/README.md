# The front door’s payload

What `/` (the universe map) downloads in its first 12 seconds, measured by
`scripts/payload-check.mjs` on a production build (`npm run build`, served by
`vite preview`), in headless Chromium at 1280 × 720 on `high`. JavaScript is
counted both as it came over the wire (gzip) and unpacked (what Vite’s build
report and the brief count). A returning visit has the intro seen; a first
visit starts at the welcome.

| | before (main, 2026-10-10) | after |
|---|---|---|
| assets, returning visit | 7.43 MB in 89 requests (GLB 2.94, images 4.26) | **4.47 MB** in 64 (GLB 0, images 4.26) |
| assets, first visit | 8.24 MB in 91 (GLB 3.75: Chewie’s 0.74 among them) | **4.47 MB** in 65 (GLB 0) |
| JavaScript, returning visit | 3.91 MB unpacked, 1.43 MB wire, 260 chunks | **3.28 MB** unpacked, 1.20 MB wire, 213 chunks |
| JavaScript, first visit | 3.90 MB unpacked, 1.43 MB wire, 262 chunks | **3.24 MB** unpacked, 1.19 MB wire, 213 chunks |

(Measured on 2026-10-06 the same way, before main's later work: assets
7.00 → 2.62 MB, JavaScript 2.91 → 2.37 MB.)

The JSON beside this note has every number: `before-*.json` on main,
`after-*.json` on this branch.

## What moved

- **The planets’ own models** (Optimus and Megatron round Cybertron, the
  Venator and the two Star Destroyers by the Star Wars place, the cruiser,
  Mario, the Pearl, the sitar…, 2.9 MB) load as each planet comes near:
  `universe/nearby.js`’s `wanted`, inside 8 radii, or in view with its disc
  24 px or more across the radius. From the home system the fandoms’
  planets are 7 to 18 px, their models a pixel or two.
- **The landings on foot** (`footScene.js` and what it brings: 159 kB) are a
  dynamic import, asked for as a planet you could land on comes near; until
  it’s here, `nearby.js`’s `standIn` answers that nobody’s on foot.
- **The model credits** (`data/modelCredits.json`, 95 kB unpacked) are fetched
  when a credit comes within 200 px of the screen, not carried in the code
  of every page that shows one.
- **The nav map** (M) is fetched the first time it opens.
- **The core pages’ idle prefetch** waits, at the front door only, until you
  reach for the nav or ⌘K, or 20 s (the idle callback otherwise came while
  the universe’s own code was still arriving).
- **Chewie** (0.74 MB) is fetched as the crawl starts, not at the welcome.

## What’s left

Images are 4.26 MB: main now draws every planet with its standard maps from
the start and swaps finer sets in near (`nearMaps.js`); starting the far
fandom planets on their `-sm` maps would take about 1.4 MB more off (this
branch did that before main’s near maps came in, and dropped it at the
merge rather than fight them). JavaScript is 3.28 MB: three.js, the
universe scene and the `planets` chunk, which carries the built fandom
fleets (`fleetStarwars`, `fleetRickmorty*`, `fleetBreakingbad`,
`galaxy/fleetRebels`, built at start for the shader warm-up and shared with
the galaxy); the planet cards and the Hangar that `UniversePanel.jsx` and
`UniverseMap.jsx` import statically; the war front, live now, which
scene.js imports statically.
