# Battlefront 2017: the game’s colours, correct, on every Star Wars world. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 1 to 4 landed in the first PR (`claude/bf2017-colours-everywhere`); tasks 5 to 8 need the bucket and run in a session whose environment holds `SUPABASE_URL` and `SUPA_KEY` (or `BF2017_KEY`).

**Goal:** Every colour map from the drop reaches the site in the colour space the game stored it in, said by the file and held by an audit; every Star Wars world wears the game’s maps, roles included; the game’s tints follow through the variation chain.

**Architecture:** One pure module (`scripts/lib/ktx2-colour.mjs`) that reads and stamps a KTX2’s transfer function and knows DICE’s suffixes; every writer stamps as it writes; the loaders force sRGB on colour keys as a belt; one audit CLI as the gate; one default in `siteOf` for the roles; the colour lane’s plan (`2026-10-10-bf2017-accuracy-lane-colour.md`) for the variation chain, its task 1 done here.

**Tech Stack:** Node 22, `scripts/lib/ktx2-mips.mjs` (the header reader), `scripts/bf2017-fetch.mjs` (`--raw`, `data`), Vitest, Playwright through `scripts/galaxy-check.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-colours-everywhere-design.md`.

## Global Constraints

- Nothing re-encoded: a stamp changes one byte; `ktx2Info` of the file before and after is equal (the test pins it).
- A loader never guesses: a map the suffix rule calls unknown is left as the file says, and `--formats` decides it from the game’s own word.
- Every landable site wears `scanned: 'bf2017'` unless it says `scanned: 'cc0'` itself; nothing outside the galaxy’s sites changes (`siteFrom` serves the Rick and Morty planets too and is untouched).
- Files under 800 lines; a test beside each file, no network; British spelling and curly quotes.

## Review Focus

1. **A colour map tagged linear**: stamped sRGB by every writer and by `--fix`; the audit names it; the loader reads it right either way.
2. **A data map**: never stamped sRGB; `__normal` and `__orm_` are data whatever their source map’s name.
3. **The breakup overlay**: stays as the file says (its neutral grey is 0.5 read linear).
4. **A site that opts out**: `look: { scanned: 'cc0' }` is kept by `siteOf`.

---

### Task 1: The KTX2 colour-space module and the audit (done)

- [x] `scripts/lib/ktx2-colour.mjs` (`transferOf`, `withTransfer`, `mapKind`, `wantedTransfer`, `slotTransfer`, `auditKtx2`, `summarise`) with `ktx2-colour.test.mjs` on two fixtures under `scripts/fixtures/bf2017/ktx2/` (a colour map the encode tagged linear, a normal).
- [x] `scripts/bf2017-colour-check.mjs` (`--check`, `--fix`, `--formats`, folders): per folder counts, each wrong file, the roles’ maps and credits.
- [x] Run `--fix` over `public/models/galaxy/bf2017`: 180 colour maps stamped sRGB; `--check` then green.

### Task 2: Every writer stamps (done)

- [x] `scripts/bf2017-level.mjs`’s `writeTextures`, `scripts/bf2017-recipes.mjs`’s `writeSizes`, `scripts/bf2017-import.mjs`’s `nativeMaps` (by the glTF slot).

### Task 3: The loaders’ belt (done)

- [x] `families.js`’s `COLOUR_MAP_KEYS`; `levelGltf.js`’s `asColour` in `recipeMaps` (the level loader and `crewSurface.js` both go through it); tests in `levelGltf.test.js`.

### Task 4: The game’s roles on every world (done)

- [x] `sites/index.js`’s `siteOf` defaults `look.scanned` to `'bf2017'`; `sites.test.js` pins every landable world; `galaxy-check.mjs` counts scan fetches (`scans cc0 n game n`, `SCANS=game` fails a cc0 fetch).
- [x] Before and after shots of tatooine, endor and naboo at high in `docs/superpowers/evidence/bf2017-colour/`.

### Task 5: The game’s word on every map (the bucket)

- [ ] `node --env-file=.env.local scripts/bf2017-fetch.mjs --raw textures.jsonl`, then `node scripts/bf2017-colour-check.mjs --check --formats lab/assets/bf2017/web/textures.jsonl`: the seven unknowns decided, any map where the suffix rule and the game disagree listed; fix the rule (`COLOUR`/`DATA` in `ktx2-colour.mjs`, with a test row each) rather than the file where they differ.
- [ ] Commit `The audit reads the game’s own format for every map`.

### Task 6: The crew’s published maps carry the stamp (the bucket)

- [ ] `node --env-file=.env.local scripts/bf2017-recipes.mjs --crew all` (the writer now stamps), `node scripts/assets-publish.mjs --dry` then without, `node scripts/assets-check.mjs`; commit `src/data/galaxyAssets.json`.
- [ ] The audit over the re-made `crew/tex/` before publishing: zero wrong.

### Task 7: The dictionary filled (the bucket)

- [ ] `node --env-file=.env.local scripts/bf2017-fetch.mjs --raw materials.jsonl` and `data 'Objects/**/*Variation*' 'Shaders/**/*Preset*'`, then `node scripts/bf2017-shader-names.mjs` (and `--depots <shaderdepots.jsonl>` on the desktop): `src/data/bf2017/shaderParams.json`, the resolved share in the hand-off (the gate: ≥ 90 % of the depot parameters by count).
- [ ] Commit `The shader depots’ parameter names, resolved`.

### Task 8: The variation chain (the colour lane’s tasks 2 to 6)

- [ ] As `2026-10-10-bf2017-accuracy-lane-colour.md` says: the writer, the reader into the game material, the fixture shot, the material audit, the vehicles’ hand table retired. The tints multiply in linear light (`gameMaterial.js` already does; the reader passes the record’s floats untouched).
- [ ] The hand-off row filled with the audit’s shares per world.
