# Parity with the game

Lane G6 of the galaxy-on-the-game design (`docs/superpowers/specs/2026-10-10-bf2017-galaxy-on-the-game-design.md`, decision 8). Three things live here:

- **`ledger.md`, `ledger.json`**: one row per level × mode, scored 0–8 by what of it is the game's. Written by `node scripts/bf2017-parity.mjs`. CI runs `npm run parity:bf2017` (`--check`), which fails when a row's score falls or a done sim goes missing; a lane that raises a score writes a new ledger and commits it. `node scripts/bf2017-parity.mjs --status` prints the hand-off's table. The rows are keyed by the game's level key (`hoth_01`), so they join the accuracy design's per-map ledger (#877's maps lane, `evidence/bf2017-maps/`) by level when that lands.
- **`index.html`**: the compare page. Each row is one of the level's own cameras: the site's shot from it beside the real game's shot from the same camera, with the mean absolute difference at 256 pixels wide and a note. Open it from this folder in a browser (it is static).
- **`gizmos-*.png`**: the game world with `?gizmos=1` (or `do('gizmos', true)`), shot by `node scripts/bf2017-compare.mjs hoth --gizmos`: what the sim reads from the level's layer (spawns by team, spawn areas, volumes, capture rings, out of bounds, paths, camera frusta), drawn in place with a legend and the nearest ids.

## Taking the site's shots

```
node scripts/bf2017-compare.mjs hoth --list          # the cameras and the file names
node scripts/bf2017-compare.mjs hoth --tier high     # shoot every camera, rebuild the page
node scripts/bf2017-compare.mjs --page               # rebuild the page from the shots on disk
```

It opens `/battlefront/<level>/galacticAssault` in headless Chromium, hides the HUD, and for each camera of the level's map rulebook (`maps/<level>.json`'s `cameras`, the layer's `CameraEntityData`; `--locators` adds the EOR and outro locators) holds the camera there through `window.__battlefront.do('camera', row)`, waits for the cells round it to stream in, and shoots. Full shots (`site/<level>/<camera>.jpg`) stay local; the 480-wide `.thumb.jpg` beside each is committed.

**The cloud's leg is software GL** (SwiftShader on the CPU): a Hoth landing takes 1 to 4 minutes and each camera about another minute. **The WebGPU leg is the owner's laptop**: run the same command there (it uses the real GPU when a display is present) and the shots replace these.

The field of view: the rulebook's cameras carry `focalLength: 35` and `fov: 0`; lane 5's `overviewPose` turns a 35 mm lens into its vertical angle on a 36 mm frame (`OVERVIEW_FOV`, about 54°). If the game's deploy view reads wider or narrower than the site's at the same camera, that conversion is the first suspect (the game may measure its lens on the horizontal or on a 24 mm frame); say so in `notes.md`.

## Taking the game's shots (the owner)

The game's deploy screen shows the level from exactly these cameras: each objective's view in Galactic Assault is one of the layer's `CameraEntityData`.

1. Run `node scripts/bf2017-compare.mjs hoth --list` and keep the list beside you: the file name, the mode, the camera's place and heading.
2. In the game, start the mode on the level (Arcade or a private match is enough), stay on the deploy screen, and step through its views. Take a screenshot of each with the HUD hidden if you can (the game's photo mode, or the screen as it is).
3. Save each as `game/<level>/<file>.jpg` here (for Hoth: `game/hoth_01/FantasyBattle_Logic-328.jpg`), 16:9, any size. Match a view to its camera by where it stands and which way it looks (`--list` prints both).
4. Run `node scripts/bf2017-compare.mjs --page` and open `index.html`.

The full pictures are git-ignored (they are EA's): only a `<file>.thumb.jpg` under 60 KB may be committed beside them, if you want the pair to show on the page for others (`npx sharp-cli` or any editor at 480 wide).

## Notes

`notes.md` holds a line a camera, `- <file>: what differs and why`, shown under its row on the page.
