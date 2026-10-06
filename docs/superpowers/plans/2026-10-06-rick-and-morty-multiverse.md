# The Rick and Morty multiverse — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/c-137` the door to the show's multiverse: the garage portal dials to the show's planets, stations and dimensions, each walked in 3D with its people as rigged figures that look like the show (found on Sketchfab where one is good enough, generated with Meshy where not), in six phases that each merge on their own.

**Architecture:** New places are areas of the existing C-137 world (`rules.js` data, a builder, people, hotspots, tasks), declared as pure data in `world/dimensions/destinations.js` and built lazily behind the portal's swirl; the Citadel gets a district on its own kit; the universe map gets a Federation capital-ship event and four landable planets. Every asset is looked for on Sketchfab first (`scripts/model-scout.mjs`) and generated with `scripts/meshy.mjs` only when nothing found passes the accuracy gate in the spec.

**Tech Stack:** React 19, Vite 8, three 0.186, Vitest, the Sketchfab Data API (`scripts/model-scout.mjs`, `SKETCHFAB_API_TOKEN`), Meshy API (`scripts/meshy.mjs`, `scripts/crowd.mjs`), the Fandom MediaWiki API for reference sheets, Playwright on `/opt/pw-browsers/chromium` for shots.

**Spec:** `docs/superpowers/specs/2026-10-06-rick-and-morty-multiverse-design.md` (the catalogue it picks from: `docs/research/2026-10-06-rick-and-morty-wiki.md`).

## Global Constraints

- Coordinates as `rules.js` has them: metres, +x east, +z south; a Meshy figure faces +z, so `rotation.y = face + π/2`.
- Destinations stand in their own column, `x −470…−330`, one per 100 m of `z` from `z = 900`; nothing that exists today moves.
- Sourcing order, for every asset (the user's rule: “Save credits by using Sketchfab and community models from Meshy first, and if those are bad and not accurate then use Meshy.”): (1) a Sketchfab model found by `scripts/model-scout.mjs` that passes the gate (judged against the wiki sheet: silhouette, colours, outfit, face; rigged or riggable; under 80,000 faces; CC0, CC BY, CC BY-SA, CC BY-NC or CC BY-NC-SA, never ND, never one that isn't downloadable), imported and credited in `src/data/modelCredits.json`; (2) a Meshy community model, only if the user has downloaded it by hand into `lab/meshy/community/<name>.glb` (Meshy has no API for them and this environment has no login to meshy.ai); (3) Meshy generation. A found model is judged by the same checklist and rejected the same way as a generated one. Every credit figure in this plan is a ceiling (the asset generated); each hit takes its class's credits off.
- Every person is a rigged figure, found or generated, in `STYLE` (the show's cel look); a figure that fails the gate is left out, never replaced with a code-built stand-in. Crowd-only figures are modelled `AT_EASE` and baked by `scripts/crowd.mjs`.
- Meshy settings: concept `nano-banana-pro` (crowd `nano-banana`), `pose_mode: 'a-pose'` for anything rigged; model on `latest`, `texture_resolution: '2k'`, `target_polycount` 30,000 (heroes 40,000 with `geometry_resolution: '2k'`; crowd 9,000); fetched textures 2048 px (crowd and small props 1024).
- The accuracy gate (spec, "The model standard") runs for every asset, found or generated: reference sheet, the scout's candidates judged, then (for what isn't found) judged concept and judged model, judged rig, in-world shot. Rerolls: at most two concepts and one model per asset before the prompt is rewritten.
- Credits are the user's Meshy account; every step's task id goes in `scripts/meshy-tasks.json`; every shipped Meshy model gets its `public/games/credits.json` entry (the fetch step writes it); every Sketchfab model its `src/data/modelCredits.json` entry (the scout's `fetch` writes it); a Meshy community model a `meshy/community/<name>` entry in `public/games/credits.json` with its page, its maker and the terms the page gives.
- Copy in the site's voice: plain sentences, curly quotes (’ “ ”), British spelling (colour, centre), no quoted dialogue beyond a line a person is known for.
- localStorage keys exactly: `tp-rm-dial` (the dial), `tp-c137-done` as today for tasks. Dev hook `window.__C137__` (DEV only) gains `goto(area, x, z, face)` and `dial(id)`.
- `npm run lint`, `npx vitest run` and `npm run build` clean at every commit. Commits end with the session's attribution lines. Each phase merges to main before the next starts.
- The first download of `/c-137` does not grow: destinations and their figures load when dialled.

## Review Focus

1. **Dialling a destination that is not loaded, then leaving before it is** — walking away from the portal, or `G` into the cruiser, while a builder is still importing must not land Morty in an unbuilt area or leave the swirl stuck. (Test in Task 0.4: `portalTarget` is pure; the loading state is checked in Task 0.6's browser run.)
2. **A destination whose model fails to load** — a 404 on a figure or building must leave that thing out and the place walkable, its hotspot still there. (Task 1.2's builder test with a `models` map missing a name; checked in the browser by renaming a file.)
3. **A saved spot inside a destination** — reloading the page after leaving it in a destination must come back there (built lazily first) or at the garage if the dial no longer has it. (Task 0.4 `validArrive` test.)
4. **Shooting the wrong person in Total Rickall** — a real Smith, or Mr. Poopybutthole, ends the game with the right ending and never counts as a parasite; shooting twice in one frame counts once. (Task 2.2 tests.)
5. **The NX-5 over a planet someone is landed on** — the planet removed for a minute must not drop a pilot on foot into space: foot mode is left alone and the planet's removal is visual (the shared timer in `siege.js`'s way). (Task 3.5 tests on the rules; checked in the browser.)

---

## Phase 0: tooling, the lazy world and the dial (0 credits)

### Task 0.0: The model scout

**Files:**
- Create: `scripts/model-scout.mjs`, `scripts/model-scout.test.mjs`
- Modify: `README.md` (Scripts table: one line)

**Interfaces** (as built, commit 4bef442):
- Produces: `node scripts/model-scout.mjs <name> "<query>" ["<another query>" …] [--rigged] [--max 12]` searches Sketchfab's Data API (`https://api.sketchfab.com/v3/search?type=models&downloadable=true&q=…`, up to four pages of 24, most liked first, with the site owner's `SKETCHFAB_API_TOKEN` sent to api.sketchfab.com only and never printed; a request refused with it is asked again without). Each query is searched twice, the second time with `rigged=true`, which is how a model is known to be rigged; several queries are merged, since Sketchfab matches every word of one. It keeps downloadable, not age-restricted models whose licence `licenseOk` takes (the slug comes from Sketchfab's `/v3/licenses`), ranks them, and writes `lab/meshy/scout/<name>/candidates.json` (uid, name, author, licence label, slug and URL, faces, isRigged, animationCount, likes, viewerUrl, thumbnail), each candidate's largest thumbnail as `<n>-<uid>.jpg`, and `candidates.md`, a contact sheet with the gate's checklist, the wiki sheet (or the `wiki-refs.mjs` command to make it), a ready `fetch` command per candidate and a pointer to meshy.ai/discover to look over by hand. Faces are shown, not filtered: the 80,000-face limit is judged with the rest of the gate. `node scripts/model-scout.mjs fetch <name> <uid> <out.glb> [--where c-137] [--as "<what it is>"]` checks the licence again, downloads the model's `.glb` (`/v3/models/<uid>/download`) into the scout folder, brings it to web size with `scripts/sketchfab-import.mjs` (`--tex 2048 --tris 40000`, and `--keep` when it has a skin), writes `<out.glb>`, and adds its `src/data/modelCredits.json` entry as `<where>-<slug>` (default `c-137-<slug>`: title, author, authorUrl, license, licenseUrl, source, where, as, file), sorted by key. Exports:
  - `licenseOk(slug) → boolean`: true for Sketchfab's `cc0`, `by`, `by-sa`, `by-nc`, `by-nc-sa`; false for `by-nd`, `by-nc-nd`, the Standard and Editorial licences, anything else and nothing.
  - `rank(models, { wantFaces = 30000, rigged = false, named = null } = {}) → models`: a sorted copy; models whose title contains `named` first, then (with `rigged`) rigged ones, then by likes, then by the face count nearest `wantFaces` (none counted, last). The scout passes `named` as the asset's name. Filtering is the scout's, not `rank`'s.
  - `slugOf(name) → string`, as `wiki-refs.mjs`'s (`'Mr. Poopybutthole' → 'mr-poopybutthole'`).
  - Also `options(argv)`, `largest(model)`, `hasSkin(glb)` and `creditOf(model, { where, as, file })`.

- [x] **Step 1: Failing tests** in `scripts/model-scout.test.mjs` (15): the licences taken and refused; the ranking (likes, the face-count tie-break, `wantFaces`, no face count last, rigged first only when asked, named first however it is spaced, the input left alone); `slugOf`; the arguments; the widest thumbnail; a skinned GLB told from a static one; a credit as `modelCredits.json` keeps it.
- [x] **Step 2:** `npx vitest run scripts/model-scout.test.mjs` → FAIL (no module).
- [x] **Step 3:** Write `scripts/model-scout.mjs` as above; `main()` runs only when `process.argv[1]` is this file. Run → PASS (15); `npm run lint` clean.
- [x] **Step 4:** Example searches: `node scripts/model-scout.mjs birdperson "birdperson rick and morty" --rigged` found none usable, and `node scripts/model-scout.mjs squanchy "squanchy rick and morty"` found one, a semi-realistic Squanchy unlikely to pass the gate. Nothing was fetched.
- [x] **Step 5: Commit** “The model scout: Sketchfab first, Meshy second”.

### Task 0.1: Reference sheets from the wiki

**Files:**
- Create: `scripts/wiki-refs.mjs`, `scripts/wiki-refs.test.mjs`
- Modify: `.gitignore` (nothing: `lab/` is already ignored), `README.md` (Scripts table: one line)

**Interfaces:**
- Produces: `node scripts/wiki-refs.mjs <wiki title …>` writes `lab/meshy/refs/<slug>/ref.png` (the infobox image, original size) and `lab/meshy/refs/<slug>/ref.md` (the page's `== Appearance ==` section, else its intro, as plain text, with the page URL). Exports `slugOf(title) → string` (`'Mr. Poopybutthole' → 'mr-poopybutthole'`, `'Revolio Clockberg, Jr.' → 'revolio-clockberg-jr'`) and `appearanceOf(wikitext) → string` (the section's text with `[[links|shown]]` reduced to `shown`, `{{templates}}` and `[[File:…]]` removed, else the intro).

- [ ] **Step 1: Failing tests** in `scripts/wiki-refs.test.mjs`:

```js
import { appearanceOf, slugOf } from './wiki-refs.mjs';
it('slugs a title', () => { expect(slugOf('Mr. Poopybutthole')).toBe('mr-poopybutthole'); expect(slugOf('Revolio Clockberg, Jr.')).toBe('revolio-clockberg-jr'); });
it('takes the Appearance section', () => {
  expect(appearanceOf('intro {{box|x}}\n== History ==\nh\n== Appearance ==\nA [[tall|very tall]] bird.\n[[File:x.png|right]]\n== Trivia ==\nt')).toBe('A very tall bird.');
});
it('falls back to the intro', () => { expect(appearanceOf('{{infobox}}\nJust a guy.\n== History ==\nh')).toBe('Just a guy.'); });
```

- [ ] **Step 2:** `npx vitest run scripts/wiki-refs.test.mjs` → FAIL (no module).
- [ ] **Step 3:** Write `scripts/wiki-refs.mjs`: `fetch` against `https://rickandmorty.fandom.com/api.php` with `action=query&prop=revisions|pageimages&rvprop=content&rvslots=main&piprop=original&redirects=1&titles=…` (25 titles a call), a `User-Agent` of `tilakverse/1.0`, writing the two files per title; `main()` runs only when `process.argv[1]` is this file (so the test can import it).
- [ ] **Step 4:** Run → PASS. Then `node scripts/wiki-refs.mjs Birdperson Squanchy` writes two folders; open `lab/meshy/refs/birdperson/ref.png` and read `ref.md`.
- [ ] **Step 5: Commit** “Reference sheets from the wiki, for judging the Meshy figures”.

### Task 0.2: The `rm` set in the Meshy script

**Files:**
- Modify: `scripts/meshy.mjs:107-110` (after the `HD` block), `:330-345` (the models step), `:418` (output dirs), `:447` (credits keys), `:468` (sets)

**Interfaces:**
- Produces: a `RM` object of assets (filled in by the phases below), merged into `ASSETS` with `set: 'rm'`, defaults `poly: 30000, tex: 2048`, and three new per-asset flags: `hero: true` (40,000 faces and `geometry_resolution: '2k'` in the image-to-3D request, +5 credits), `sit: true` (the seated clip), `crowd: true` (`image: 'nano-banana'`, `rig: false`, `poly: 9000`, `tex: 1024`). Rigged `rm` figures go to `public/games/meshy/` as today; unrigged ones to `public/models/c137/rm/` with credits keys `meshy/rm/<name>`; crowd-only ones to `public/games/meshy/` for `scripts/crowd.mjs` to bake. `node scripts/meshy.mjs <step> rm` runs a step for the set; `node scripts/meshy.mjs balance` prints the balance.

- [ ] **Step 1:** Add `const RM = {}` with the comment block describing the set and its flags; merge: `for (const [n, a] of Object.entries(RM)) ASSETS[n] = { set: 'rm', poly: a.crowd ? 9000 : a.hero ? 40000 : 30000, tex: a.crowd ? 1024 : 2048, rig: !a.crowd, ...(a.crowd ? { image: 'nano-banana' } : {}), ...a };`
- [ ] **Step 2:** In the models step add `...(a.hero ? { geometry_resolution: '2k' } : {})` to the request body. Add `RM_OUT = join(ROOT, 'public', 'models', 'c137', 'rm')` to the output map for `set === 'rm' && !a.rig`; the credits key `meshy/rm/<as>` for those. Add `rm: Object.keys(RM)` to `sets`.
- [ ] **Step 3:** `node scripts/meshy.mjs balance` prints `balance  N credits left`; `npm run lint` clean.
- [ ] **Step 4: Commit** “Meshy: the `rm` set, with hero and crowd flags”.

### Task 0.3: Lazy areas, the alien street first

**Files:**
- Modify: `src/components/rickmorty/world/scene.js:59,132-147` (`AREA_BUILDERS`, `build`), `src/components/rickmorty/world/RmWorld.jsx` (the portal transition)

**Interfaces:**
- Produces: `scene.js` exports `LAZY = { annex: () => import('./annex').then((m) => m.buildAnnex) }` and the scene api gains `ensureArea(id) → Promise<void>` (builds a lazy area once; a second call returns the same promise; a builder that throws falls back to `plainGround`/`plainRoom` as `build` does today) and `hasArea(id) → boolean`. `RmWorld.jsx`'s portal transition awaits `ensureArea(to)` while the swirl holds, showing the HUD line “Opening a portal to <name>…” (`NAMES[to]`), and only then moves Morty.

- [ ] **Step 1:** Remove `annex` from `AREA_BUILDERS`; add `LAZY` and `ensureArea`; `build` is reused for the lazy ones (same fallback, same `scene.add`).
- [ ] **Step 2:** In `RmWorld.jsx`, where a `portal` link is taken: `if (!api.hasArea(to)) { setLoading(NAMES[to]); await api.ensureArea(to); setLoading(null); }` before the arrive; leaving the page mid-await disposes the stage and ignores the result (a `cancelled` flag in the effect's cleanup).
- [ ] **Step 3:** Dev server up (`npx vite --port 5173`), open `/c-137`, walk into the garage portal: the swirl holds a beat, the line shows, the alien street appears; walk back. `npx vitest run src/components/rickmorty` → PASS.
- [ ] **Step 4: Commit** “C-137: areas can load when they’re entered; the alien street does”.

### Task 0.4: Destinations as data, and the dial (pure)

**Files:**
- Create: `src/components/rickmorty/world/dimensions/destinations.js`, `destinations.test.js`
- Modify: `src/components/rickmorty/world/rules.js:25-45` (`AREAS`, `OUTDOOR`), `:160-197` (`LINKS`), `:546` (`PEOPLE`), `:639` (`HOTSPOTS`), `:874` (`TASKS`); `src/components/rickmorty/world/rules.test.js` (the `C-137: doors, exits and portals` block)
- Modify: `src/components/rickmorty/dimensions.js` (derive `DIMENSIONS` from the dial)

**Interfaces:**
- Produces (from `destinations.js`):
  - `DEST_COL = { x0: -470, x1: -330 }`, `destArea(i, deep = 50) → { x0, x1, z0: 900 + 100 * i - deep / 2, z1: 900 + 100 * i + deep / 2 }`
  - `DESTINATIONS: [{ id, name, note, kind: 'outdoor' | 'room', area, sky, ground, arrive: { x, z, face }, back: { x, z }, people: [], hotspots: [], tasks: [], lines: {} , kinds: [] }]` (`kinds`: the Meshy kinds the place needs); empty until Phase 1.
  - `DIAL: [{ id: 'annex', name: 'Blips and Chitz', note: 'An arcade. Roy: A Life Well Lived is in the back.' }, ...DESTINATIONS.map(({ id, name, note }) => ({ id, name, note }))]`
  - `DIAL_KEY = 'tp-rm-dial'`, `readDial() → id` (default `'annex'`; an unknown id reads as `'annex'`), `writeDial(id)`, `portalTarget(dial) → id` (`'annex'` for anything not on the dial)
  - `destinationById(id)`, `GARAGE_BACK = { x: -301.2, z: 101.4, face: 0 }` (where every portal home arrives: the annex's today)
  - `validArrive(saved, dial) → { area, x, z, face }`: the saved spot if its area is a built-in or a dialable destination and the spot is inside it, else the garage's `START`.
- `rules.js`: `AREAS = { …today, …destination areas }`, `OUTDOOR = ['street', 'annex', …outdoor destinations]`, `LINKS` gains one `{ id: `${d.id}-portal`, area: d.id, x: d.back.x, z: d.back.z, r: 1.4, kind: 'portal', to: 'garage', label: 'Back to the garage', arrive: GARAGE_BACK }` per destination, and the garage portal's `to` is resolved by `linkTarget(link, dial) → area` (`portalTarget(dial)` for `garage-portal`, `link.to` otherwise); `PEOPLE`, `HOTSPOTS`, `TASKS` spread each destination's with `area: d.id`; a new garage hotspot `{ id: 'dial', area: 'garage', x: -302.6, z: 103.2, r: 0.9, kind: 'dial', label: 'The portal gun: pick a dimension' }`.
- `dimensions.js`: `export const DIMENSIONS = DIAL` (the hero keeps its captions).

- [ ] **Step 1: Failing tests** in `destinations.test.js` (they run over whatever `DESTINATIONS` holds, so every later phase is covered by adding its entry):
  - `destArea(0)` is `{ x0: -470, x1: -330, z0: 875, z1: 925 }`; `destArea(3, 40)` has `z0: 1180`.
  - every destination's `area` is inside `DEST_COL` and overlaps no other `AREAS` box (import `AREAS` from `../rules`); ids are unique and none is a `ROOM_IDS` or `'annex'`/`'street'`.
  - `arrive` and `back` are inside the area, at least 1.5 m from its edges, and 3 m apart; every `people` and `hotspots` entry is inside the area.
  - `portalTarget('nope') === 'annex'`; `portalTarget(DESTINATIONS[0]?.id ?? 'annex')` is that id.
  - `validArrive({ area: 'nowhere', x: 0, z: 0 }, 'annex')` is the garage `START`; `validArrive({ area: 'garage', x: -300, z: 100, face: 0 })` keeps it.
- [ ] **Step 2:** Run → FAIL. Write `destinations.js`. Add to `rules.test.js`: `linkTarget(garagePortal, 'annex') === 'annex'`; `linkTarget(garagePortal, 'x') === 'annex'`; `HOTSPOTS` has `dial` in the garage, clear of `FURNITURE` (the existing `clear` helper). Run → PASS, and the whole `rules.test.js` still passes (127 tests).
- [ ] **Step 3: Commit** “C-137: the portal dials, and destinations are data”.

### Task 0.5: The dial on screen, and the hero’s button

**Files:**
- Create: `src/components/rickmorty/world/DimensionDial.jsx`, `dial.css` (or in `world.css`)
- Modify: `src/components/rickmorty/world/RmWorld.jsx:150-191` (`NAMES`, `TO`, `OUT`, the hotspot handling), `src/pages/RickMorty.jsx:69-80` (`fire`)

**Interfaces:**
- Produces: `<DimensionDial open items={DIAL} value onPick onClose />`: a list overlay (arrow keys, Enter, Esc; touch), each row the name and the note, the chosen one marked; `onPick(id)` calls `writeDial(id)` and closes. In `RmWorld.jsx`: `NAMES` gains each destination's `name`; `TO` and `OUT` are built from `DESTINATIONS` (`TO[area][d.id] = portal link id of that area's way to the garage, then the garage portal`; `OUT[d.id] = `${d.id}-portal``); the `dial` hotspot opens the dial; the page's `fire()` picks a random dial entry, `writeDial(id)`, and scrolls to the world with the HUD line “Dialled to <name>. The portal’s in Rick’s garage.”
- [ ] **Step 1:** Build it. `npm run lint`.
- [ ] **Step 2:** Browser: press E at the gun stand, pick Blips and Chitz, walk into the portal, arrive on the alien street; the hero's button dials and scrolls.
- [ ] **Step 3: Commit** “C-137: the dial, in the garage and on the page”.

### Task 0.6: Shots script and the dev hook

**Files:**
- Create: `scripts/c137-shots.mjs` (modelled on `scripts/office-shots.mjs`)
- Modify: `src/components/rickmorty/world/RmWorld.jsx:598` (the hook)

**Interfaces:**
- Produces: `OUT=<dir> node scripts/c137-shots.mjs [name…]` with `VIEWS = { <name>: { area, at: [x, z, face], look? } }` (Phase 1 fills it), driving `window.__C137__.goto(area, x, z, face)` (builds a lazy area first) and `window.__C137__.dial(id)`; each shot waits for `__C137__.ready()` (every pending load done) and a few frames.
- [ ] **Step 1:** Add `goto`, `dial`, `ready` to the hook; write the script with one view, `garage`.
- [ ] **Step 2:** `OUT=/tmp/shots node scripts/c137-shots.mjs garage` writes `garage.webp`; look at it.
- [ ] **Step 3: Commit** “C-137: a shots script, driven by the dev hook”.

### Task 0.7: Credits

- [ ] **Step 1:** The user buys Meshy credits for the phases that will run this month (spec, “Buying”), once those phases' scouts have run (each model task's scout step, which costs nothing), for what the scouts did not find: the phase headings below are ceilings. At the ceilings, Ultra (8,000) covers everything and Premium (3,000) Phases 1–3. `node scripts/meshy.mjs balance` shows it.

---

## Phase 1: the door and four places (a ceiling of 546 credits, ≈ 655 with rerolls)

### Task 1.1: Phase 1’s figures and buildings

**Files:**
- Modify: `scripts/meshy.mjs` (`RM`), `scripts/crowd.mjs` (`CROWD`)
- Create (generated): `public/games/meshy/{birdperson,phoenixperson,squanchy,poopybutthole,unity,marsha,mortyjr,krombopulos}{,-idle,-walk,-run}.glb`, `poopybutthole-sit.glb`, `public/games/meshy/crowd/{zigerion,gearperson}.glb`, `public/models/c137/rm/{gwendolyn,squanchy-house,birdperson-house}.glb`
- Modify (generated): `scripts/meshy-tasks.json`, `public/games/credits.json`, `src/data/modelCredits.json` (for what the scout finds)

**Interfaces:**
- Produces: GLBs in the layout `createMeshyCast` loads (`/games/meshy/<name>.glb` + `-idle/-walk/-run`), and unrigged models under `/models/c137/rm/`.

The assets, with class and credits (ceilings, the asset generated: H 55, R 47, P 39, PH 44, C 33), heights in metres. The prompts are for what the scout doesn't find:

```js
const BIRD = 'Birdperson from Rick and Morty';
const RM = {
  birdperson: { hero: true, height: 2.0, prompt: `${BIRD}: a tall thin humanoid bird-man with pale skin and a bare chest, a dark grey and white feathered hood framing a long stern face with a hooked nose, heavy dark brows and a tuft of feathers on top of the head, two huge cream and grey eagle wings folded down his back like a cape to his ankles, a brown feathered loincloth skirt with a wide belt and a round silver buckle, yellow feathered gloves, bare legs, yellow and brown feathered boots. ${BODY}` },
  phoenixperson: { height: 2.05, prompt: `Phoenixperson from Rick and Morty: Birdperson rebuilt as a cyborg, his pale face with a hooked nose and heavy brows under a dark grey feathered hood, one glowing red mechanical eye, his wings, legs and torso replaced with dark gunmetal and steel machinery with small red lights, the metal wings folded down his back, a brown feathered loincloth over the metal hips. ${BODY}` },
  squanchy: { hero: true, height: 1.15, prompt: `Squanchy from Rick and Morty: a short scruffy orange cat-person with messy fur, pale cream fur on his muzzle and chest, a tiny blue nose, half-closed tired eyes, whiskers, a dark brown goatee, two little fangs, pointed ears, a bare tail with a brown tuft at its tip, standing upright on two legs, wearing nothing but a small black bow tie. ${BODY}` },
  poopybutthole: { hero: true, sit: true, height: 1.3, prompt: `Mr. Poopybutthole from Rick and Morty: a thin creature with a long narrow pale yellow head like a stretched bean, two big round eyes with small pupils, a small smiling mouth, a tiny black top hat on top of his head, a pale cyan short-sleeved T-shirt, dark grey-green shorts, long thin yellow arms and legs, brown shoes. ${BODY}` },
  unity: { height: 1.75, prompt: `Unity from Rick and Morty, in her main host body: a slim woman with light blue skin, dark purple hair swept back and up with four thin yellow-tipped antenna stalks standing up from the top of her head, a small round gem on her forehead, yellow-tinted cat-eye glasses, red lipstick, a pearl necklace, a dark magenta blazer open over a cream V-neck top, a black pencil skirt, dark magenta high heels. ${BODY}` },
  marsha: { height: 2.3, prompt: `Ma-Sha, queen of the Gazorpian women from Rick and Morty: a tall stately woman with tan skin, a unibrow, long straight dark blue hair, a gold and blue striped Egyptian-style headdress with a red jewel, four arms (two long thin arms rising from the sides of her head, and two normal arms), a long white robe with wide sleeves and a wide collar striped gold, yellow and green, bare feet. ${BODY}` },
  mortyjr: { height: 2.0, prompt: `Morty Jr. grown up, from Rick and Morty: a huge heavy-set half-Gazorpian man with bright red skin, a unibrow, small angry eyes, a wide mouth with two big lower fangs, two thick muscular red arms growing from the top of his head beside his normal arms, a grey flat cap, a dark charcoal overcoat over a dark suit with a blue tie, dark trousers, white and brown shoes. ${BODY}` },
  krombopulos: { height: 1.9, prompt: `Krombopulos Michael, the Gromflomite assassin from Rick and Morty: a thin insect man with an olive-yellow head, two big orange compound eyes with a dark grid on them, three short antenna stalks on top of his head and two drooping mandible flaps for a mouth, in a snug dark teal armoured bodysuit with thin cyan light strips, an orange collar, round orange ear discs like headphones, dark gloves and boots. ${BODY}` },
  zigerion: { crowd: true, prompt: `A Zigerion from Rick and Morty: a tall alien with pink-purple skin, a long head stretching up and back with a few small spiky protrusions, two long antenna-like ears, four arms, in a snug dark blue spacefleet uniform with a gold insignia on the chest, black boots. ${AT_EASE}` },
  gearperson: { crowd: true, prompt: `A Gear Person from Gear World in Rick and Morty: a stocky robot-like person with a transparent pink torso showing brass gears turning inside, a bald grey head with gears for ears, grey metal arms and legs, in a blue work jacket. ${AT_EASE}` },
  gwendolyn: { rig: false, prompt: `Gwendolyn, the Gazorpian robot from Rick and Morty: a slim feminine android of glossy pink-magenta metal, a smooth helmet head with a dark visor and red lips, black ball joints at the shoulders, elbows, hips and knees, pink metal legs, standing straight. ${PROP}` },
  'squanchy-house': { rig: false, hero: true, prompt: `Squanchy's house on Planet Squanch from Rick and Morty: a house built like a giant cat tree, three round carpeted platforms in beige and brown stacked on thick sisal-wrapped posts, little ladders between them, a round den with a round door at the top, toy mice and balls hanging on strings, on red grass. ${BUILDING}` },
  'birdperson-house': { rig: false, hero: true, prompt: `Birdperson's home on Bird World from Rick and Morty: a tall nest-like house of woven brown branches and cream feathers built on a rocky ridge, a round doorway, a ring of tall white feathers round the roof, small square windows, no people. ${BUILDING}` },
};
```

Heights of unrigged things are set where they stand (`gwendolyn` 1.75 m, the houses by their footprint).

- [ ] **Step 1: Sheets.** `node scripts/wiki-refs.mjs Birdperson Phoenixperson Squanchy "Mr. Poopybutthole" Unity Mar-Sha "Morty Jr." "Krombopulos Michael" Zigerions "Gear People" Gwendolyn "Planet Squanch" "Bird World"`. Read each `ref.md` and `ref.png`; fix any prompt above that the sheet contradicts (the prompts were written from these sheets on 2026-10-06; the wiki moves).
- [ ] **Step 2: Scout.** For each asset run the scout with a query of its wiki name plus “rick and morty” (`--rigged` for a person); judge the top candidates against the sheet by their thumbnails (`lab/meshy/scout/<name>/`) with the gate's checklist; for a hit, `fetch` it to the asset's output path, record it in `lab/meshy/scout/<name>/chosen.json` and skip that asset's Meshy steps. An asset's Meshy prompt above is used only when no candidate passes. For example `NODE_USE_ENV_PROXY=1 node scripts/model-scout.mjs squanchy "Squanchy rick and morty" --rigged`, then `node scripts/model-scout.mjs fetch squanchy <uid> public/games/meshy/squanchy.glb`. The output paths are the ones under **Files** (a person's `public/games/meshy/<name>.glb`, a crowd figure's the same for `scripts/crowd.mjs` to bake, a prop's or building's `public/models/c137/rm/<name>.glb`). A rigged figure must keep a skeleton and have idle, walk and run in the layout `createMeshyCast` loads (`<name>.glb` with `-idle`, `-walk`, `-run`): its own clips, renamed; else clips retargeted onto its skeleton from an animated download, as Avengers HQ's Sketchfab people get theirs (README, “Rigged characters from Sketchfab”; `scripts/sketchfab-avengers.mjs`); else, for a figure with no skeleton but a clean A- or T-pose, Meshy's rigger (5 credits, walk and run with it, idle 3), as `scripts/meshy-galaxy.mjs`'s `bake` and `rigurl` steps do for a Sketchfab model. A figure that sits needs a seated clip as well. Fill in the credit's `where` (`c-137`) and `as`; a CC0 model is the first of its licence in the credits, so widen `src/data/modelCredits.test.js`'s licence and licence-URL patterns to take CC0 in the same commit. Then judge any Meshy community model the user has left in `lab/meshy/community/<name>.glb` the same way.
- [ ] **Step 3: Add `RM`** to `scripts/meshy.mjs`, without the assets the scout found; add `zigerion`, `gearperson` to `CROWD` in `scripts/crowd.mjs` (the “modelled standing at ease” group) unless found.
- [ ] **Step 4: Concepts.** `NODE_USE_ENV_PROXY=1 node --no-warnings scripts/meshy.mjs images rm`. Judge each `lab/meshy/rm/<name>.png` against its sheet with the gate's checklist; on a miss delete the name's `image` in `scripts/meshy-tasks.json` and rerun for that name (`… images birdperson`), twice at most, then rewrite the prompt.
- [ ] **Step 5: Models.** `… models rm`; judge the four thumbnails per name; one reroll at most (delete `model`).
- [ ] **Step 6: Rig and clips.** `… rig rm`, `… anim rm`, `… sit poopybutthole`, `… fetch rm`; open `scripts/preview/crew.html` on each rigged name; a twisted rig is rerolled (delete `rig`, `idle`, rerun). Then `node scripts/crowd.mjs zigerion gearperson`.
- [ ] **Step 7:** `npm run lint`; `npx vitest run src/data` (the credits test, for anything the scout brought in); `git add` the script changes, `scripts/meshy-tasks.json`, `public/games/credits.json`, `src/data/modelCredits.json` and the GLBs. **Commit** “Rick and Morty: Phase 1’s figures (Birdperson, Squanchy, Mr. Poopybutthole, Unity, Ma-Sha, Morty Jr., Krombopulos Michael) and their houses”.

### Task 1.2: Interdimensional Customs

**Files:**
- Create: `src/components/rickmorty/world/dimensions/customs.js`
- Modify: `src/components/rickmorty/world/dimensions/destinations.js` (the entry), `src/components/rickmorty/world/scene.js` (`LAZY.customs`), `src/components/rickmorty/portal/meshyCast.js:41-74` (`MESHY` kinds `krombopulos { a: 'krombopulos', h: 2.45 }`, `gromflomite` exists; `RIGGED` + `krombopulos`), `src/components/Achievements.jsx` (`customs`), `scripts/c137-shots.mjs` (`VIEWS.customs`)

**Interfaces:**
- Consumes: `destArea`, the kit (`kit.models` now also holds `/models/c137/rm/*` by name; `kit.cast` makes figures; `kit.need(kinds)`), `toon`, the annex's helpers in `world/kit.js` (`at`, `batch`, `coloured`, `fitModel`, `glowMaterial`, `logoText`, `neonCopy`, `paint`, `rng`).
- Produces: the entry below and `buildCustoms(kit) → { group, update(t, dt, state), noInk, light }`.

```js
{ id: 'customs', name: 'Interdimensional Customs', note: 'The Pilot’s customs hall. Don’t let them scan the seeds.', kind: 'room', area: destArea(0, 36),
  sky: null, ground: 'tiles-grey',
  arrive: { x: -400, z: 915, face: FACE_N }, back: { x: -400, z: 920 },
  kinds: ['gromflomite', 'krombopulos', 'zigerion', 'gearperson'],
  people: [
    { id: 'customs-agent1', who: 'gromflomite', x: -404, z: 893, face: S }, { id: 'customs-agent2', who: 'gromflomite', x: -396, z: 893, face: S },
    { id: 'krombopulos', x: -392, z: 905, face: Math.PI },
  ],
  hotspots: [{ id: 'scanner', x: -400, z: 896, r: 1.2, label: 'The scanner', kind: 'card' }, { id: 'seeds', x: -408, z: 910, r: 0.9, label: 'Mega Seeds', kind: 'pickup' }],
  tasks: [{ id: 'customs', name: 'Get through customs', hint: 'Dial Interdimensional Customs, pick up the Mega Seeds, and get past the scanner.' }],
  lines: { 'customs-agent1': ['Next.', 'Anything to declare?'], krombopulos: ['Oh, hey, Morty. Krombopulos Michael. I’m here if you need me.', 'I’m a lot more comfortable with you now that I know you’re not a cop.'] } }
```

The hall: a long grey-tiled room under a high ceiling of ribbed green panels, the scanner arch of pale green metal with a red light (lit when Morty has the seeds and walks under it: the `scanner` hotspot then says “It found them. Run.” and sets `customs` done once he reaches the portal), two customs desks with the agents behind, a rope queue with the two crowd aliens standing in it (instanced, their crowd copies), signs in the alien script (`logoText`), a window onto a purple sky with ships (the annex's hover cars).

- [ ] **Step 1:** Add the entry; `npx vitest run src/components/rickmorty/world` → PASS (the generic tests cover it).
- [ ] **Step 2:** Write `customs.js`; register in `LAZY`; register the kinds. A builder test: `buildCustoms` with a `kit` whose `models.get()` returns `null` for everything and whose `cast.make` throws for `krombopulos` still returns a group (Node-side, with the same stand-in kit the arcade's tests use, or a new `dimensions/testKit.js`).
- [ ] **Step 3:** Browser: dial it, walk it, take the seeds, pass the scanner, talk to Krombopulos, portal home; `OUT=docs/superpowers/shots node scripts/c137-shots.mjs customs` → `docs/superpowers/shots/2026-10-06-rm-customs.webp`.
- [ ] **Step 4: Commit** “C-137: Interdimensional Customs, through the dial”.

### Task 1.3: Planet Squanch

**Files:** as Task 1.2 with `dimensions/squanch.js`, kinds `squanchy { a: 'squanchy', h: 1.5 }`, `birdperson { a: 'birdperson', h: 2.6 }`, `tammy` (exists in `C137_PEOPLE`: move it to the shared table), `gromflomite`; achievement `squanch`.

Entry (index 1, outdoor): `arrive` on the red grass below the house, `back` by a suckulent patch; `people`: `squanchy` by his house's ladder, `birdperson` and `tammy` under the wedding arch (`until: 'squanch'`: the raid mood hides them), three `gromflomite`s `needs: 'squanch'`-style reverse (present only after; use `until`/a second list `after`), `unity` is in Bird World not here; `hotspots`: `altar` (“The wedding. Squanchy’s giving a toast.”), `drink` at the bar (the toast: sets `squanch` done and starts the raid: the Gromflomites portal in, the three guests run; Morty has to reach the portal home); `tasks`: `squanch` “Go to Birdperson’s wedding”; `lines`: Squanchy “I squanch my family.” / “You squanch what you squanch.”, Birdperson “Morty. It is good you are here.”, Tammy “Birdperson and I are getting married! Isn’t that squanchy?”.

The place: red grass (`ground: 'grass'` recoloured `#b83a3a`/`#d85a4a`), a teal sky with a big ringed planet, the cat-tree house (model, 9 m tall) and two smaller ones, suckulents (fat teal succulents, instanced; bumping one bites: a hit flash and a line), the wedding: a white arch of flowers, rows of white chairs, a long table, lanterns; the raid: six Federation portals (the swirl material) and the agents stepping out, the arch knocked over.

- [ ] Steps as Task 1.2 (entry → tests; builder → builder test; browser; shot `squanch`; commit “C-137: Planet Squanch, and the wedding”).

### Task 1.4: Gazorpazorp

**Files:** `dimensions/gazorpazorp.js`; kinds `gazorpian` (exists), `marsha { a: 'marsha', h: 3.0 }`, `mortyjr { a: 'mortyjr', h: 2.6 }`; achievement `gazorp`. Reuse: Portal panic's Gazorpazorp arena dressing (`portal/Portal3D.js`: read its arena builder and lift the dune, rock and dome helpers into `world/kit.js` or import them).

Entry (index 2, outdoor): red dunes under two suns (one orange, one small white), the women's city as a cluster of smooth pink domes with slit doors beyond the walkable box; `people`: `marsha` at the city gate on a dais, two `gazorpian` males fighting in the dunes (the Portal panic idle/run clips, circling), `mortyjr` by the portal; `gwendolyn` as a model by a rock (the pawn-shop robot, a `card` hotspot “Gwendolyn. Don’t ask.”); `hotspots`: `gate` (“Men are not allowed. Ma-Sha makes an exception for a Morty.”: sets `gazorp`), `tasks`: `gazorp` “Visit the women of Gazorpazorp”; `lines`: Ma-Sha “Welcome, Morty. The men stay outside.”, Morty Jr. “I’m going to be a writer. Of books.”, a Gazorpian “Gazorpazorpfield!”.

- [ ] Steps as Task 1.2 (shot `gazorpazorp`; commit “C-137: Gazorpazorp, the dunes and the city of women”).

### Task 1.5: Bird World

**Files:** `dimensions/birdworld.js`; kinds `birdperson`, `phoenixperson { a: 'phoenixperson', h: 2.7 }`, `unity { a: 'unity', h: 2.3 }`; achievement `birdworld`. Also: `src/components/universe/wingmen.js` and `hunters.js` (or wherever the code-built Birdperson and Phoenixperson figures are made: `grep -n "birdperson\|phoenix" src/components/universe/*.js`) take the Meshy models when they load, the code-built ones standing in as the ships do (`universe/hulls.js`'s pattern).

Entry (index 3, outdoor): a rocky ridge at dusk under a pale orange sky with two moons, the nest-house (model) at the end of the ridge, a cliff edge (a wall in the colliders), dry grass and bare trees; `people`: `birdperson` at his door, `unity` on the ridge (her visit from “Auto Erotic Assimilation”), `phoenixperson` present `until: 'birdworld'` reversed (he appears after the task, standing where Birdperson stood: the two moods); `hotspots`: `door` (“Birdperson’s house. He doesn’t lock it.”: sets `birdworld`), `tasks`: `birdworld` “Visit Birdperson”; `lines`: Birdperson “Morty. In my culture this would be a greeting.”, Unity “Rick isn’t here. Good.”, Phoenixperson “…”.

- [ ] Steps as Task 1.2 (shot `birdworld`; commit “C-137: Bird World, Birdperson at home, and the map’s Birdperson gets his model”).

### Task 1.6: Phase 1 wrap

**Files:** `README.md` (the C-137 row of the worlds table: the dial and the four places; the Scripts table), `docs/architecture.md:20` (the world's line), `src/components/worlds/worlds.js:18` (the `about` comment: “a destination is 1–3 MB more, when dialled”), `src/components/rickmorty/wardrobe/looks.js` (nothing new this phase), `public/games/credits.json` (done by fetch), `src/data/modelCredits.json` (done by the scout's `fetch`).

- [ ] **Step 1:** Docs. `npm run lint && npx vitest run && npm run build` clean.
- [ ] **Step 2:** Shots of all four places and the dial in `docs/superpowers/shots/`.
- [ ] **Step 3: Commit** “C-137: the multiverse, Phase 1”; open the PR, merge, restart the branch from `origin/main`.

---

## Phase 2: the house, the rest of the family, Total Rickall (a ceiling of 900 credits, ≈ 1,080)

### Task 2.1: Phase 2’s figures

**Files:** as Task 1.1. Assets, with their ceilings if generated (H 55 ×2, R 47 ×11, Q 39 ×4, P 39 ×3 = 900):

```js
  spacebeth: { hero: true, sit: true, height: 1.68, prompt: `Space Beth from Rick and Morty: Beth Smith as a space fighter, a woman in her thirties with long blonde hair past her shoulders, the right side of her head shaved with a blue streak in the hair, a scar over her right eye and a ring piercing in her right eyebrow, a long dark brown leather coat over a fitted dark grey-green combat suit with a grey chest plate, a heavy bronze gauntlet with small lights on her right forearm, fingerless gloves, a utility belt, black boots. ${BODY}` },
  rickprime: { hero: true, height: 1.85, prompt: `Rick Prime from Rick and Morty: a version of Rick Sanchez with greyer skin, dull pale blue hair in a plain short spiky cut, a unibrow and narrow cold eyes, a dark purple-grey zip-up sci-fi jacket with a high collar, a grey pad on one shoulder and a red stripe low on the front, over a dark red shirt, dark grey-black trousers and dark shoes. ${BODY}` },
  snuffles: { rig: false, prompt: `Snuffles from Rick and Morty: a small fluffy white dog standing on all fours, small black beady eyes, a little black nose, floppy ears and a blue collar with a round silver tag. ${PROP}` },
  drwong: { sit: true, height: 1.72, prompt: `Dr. Wong from Rick and Morty: a tall slim Chinese-American woman with a fair complexion, black hair in a neat bob, thick grey-rimmed glasses, in a beige wool jacket over a yellow long-sleeved shirt, a white necklace, black trousers, a black belt and black shoes. ${BODY}` },
  nancy: { height: 1.6, prompt: `Nancy from Rick and Morty, Summer's friend: a teenage girl with a long face and a long droopy nose, dark brown hair to her shoulders, square glasses, red lipstick, a white shirt under a thick dark magenta jacket, dark trousers and flat shoes. ${BODY}` },
  tricia: { height: 1.62, prompt: `Tricia Lange from Rick and Morty: a teenage girl with long straight brown hair and a narrow nose, a white crop top, a burgundy skirt, a small cross necklace, white tights with light grey knee socks and black flat shoes. ${BODY}` },
  diane: { height: 1.68, prompt: `Diane Sanchez from Rick and Morty: a slim fair-skinned woman with medium-length light blonde hair, plump cheeks, an upturned nose and pink lips, a few freckles, a light turquoise blouse, white jeans, grey heels, a silver pendant necklace, a violet bangle on her right wrist. ${BODY}` },
  // Total Rickall's parasites
  pencilvester: { height: 1.6, prompt: `Pencilvester from Rick and Morty: a living yellow wooden pencil standing upright, the pink eraser with its silver metal band at the top for a head and the sharpened grey-tipped point at the bottom, two thin yellow arms and two thin legs in red sneakers, mismatched round eyes, pink lips and buck teeth. ${BODY}` },
  sleepygary: { height: 1.78, prompt: `Sleepy Gary from Rick and Morty: a sleepy man with short brown hair and a calm smile, in a long blue nightgown with a blue pyjama robe over it, a long droopy blue and white striped nightcap with a white cotton ball at its end, slippers. ${BODY}` },
  hamurai: { height: 1.8, prompt: `Hamurai from Rick and Morty: a samurai in full armour made entirely of meat: plates of pink steamed ham, slabs of steak, sausages and bacon strips for the lacings, a meat helmet with bacon crests, a stern face with narrow eyes, dark trousers, sandals, empty hands. ${BODY}` },
  amishcyborg: { height: 1.78, prompt: `Amish Cyborg from Rick and Morty: an old Amish man with a big black beard and sideburns and no moustache, a black wide-brimmed hat, a white shirt and brown trousers held up by suspenders, black shoes; the left half of his face is grey metal with two round red lights for the eye and a metal grille with green lights over his mouth, his right arm is a robot arm ending in the blade of a shovel, and his left leg is a steel robot leg. ${BODY}` },
  mrbeauregard: { height: 1.85, prompt: `Mr. Beauregard from Rick and Morty: a heavyset butler with swept-back grey-black hair, thick dark brows and heavy-lidded eyes, in a black tailcoat and waistcoat, a white dress shirt and a black bow tie, black trousers, black shoes, white gloves. ${BODY}` },
  cousinnicky: { height: 1.8, prompt: `Cousin Nicky from Rick and Morty: a muscular man from Brooklyn with slicked-back black hair, stubble and a smug half-smile, in a pale blue sleeveless shirt open at the chest showing chest hair, grey trousers with a big gold belt buckle, black shoes. ${BODY}` },
  frankenstein: { height: 2.1, prompt: `Frankenstein's monster as drawn in Rick and Morty: a tall heavy green-skinned monster with a flat-topped square head, black hair, a scar across his forehead, two metal bolts in his neck, heavy-lidded eyes, in a black jacket too small for him, a grey shirt, black trousers and big black boots. ${BODY}` },
  reversegiraffe: { rig: false, prompt: `Reverse Giraffe from Rick and Morty: a giraffe with a very long patterned tan and brown body and a very short neck, a small giraffe head with two little horns, standing on its four legs. ${PROP}` },
  ghostinajar: { rig: false, prompt: `Ghost in a Jar from Rick and Morty: a clear glass jar with a shiny gold screw lid, and inside it a small glowing green translucent ghost with a round domed head, dots for eyes, a simple line mouth, two stubby arms and a wavy lower edge. ${PROP}` },
  photographyraptor: { rig: false, prompt: `Photography Raptor from Rick and Morty: a velociraptor standing on its two hind legs, green scaly skin with darker stripes, a long tail, small clawed arms, a toothy snout, a camera on a strap round its neck and a tan photographer's vest with pockets. ${PROP}` },
  tinkles: { rig: false, prompt: `Tinkles from Rick and Morty: a little white lamb standing on four legs with a rainbow-striped unicorn horn, light pink ears, hooves, tail and a tuft of hair on top of her head, big blue eyes, a lavender tutu over a pink garment, a tiara with a red gem, rainbow knee socks. ${PROP}` },
  babywizard: { rig: false, prompt: `Baby Wizard from Rick and Morty: a chubby baby floating upright in a long pale blue wizard's robe covered in yellow stars, a tall pointed blue wizard's hat, a white beard, holding a small wooden staff. ${PROP}` },
  mrsrefrigerator: { rig: false, prompt: `Mrs. Refrigerator from Rick and Morty: a tall cream-white household refrigerator standing upright with a cartoon face on its door, a pink flowered apron tied round its middle, two short arms and two little legs. ${PROP}` },
```

- [ ] **Sheets** (Task 1.1, Step 1): `node scripts/wiki-refs.mjs "Space Beth" "Rick Prime" Snuffles "Helen Wong" Nancy "Tricia Lange" "Diane Sanchez" Pencilvester "Sleepy Gary" Hamurai "Amish Cyborg" "Mr. Beauregard" "Cousin Nicky" "Frankenstein's Monster (Total Rickall)" "Reverse Giraffe" "Ghost in a Jar" "Photography Raptor" Tinkles "Baby Wizard" "Mrs. Refrigerator"`.
- [ ] **Scout** (Task 1.1, Step 2), before any concept: for each asset run the scout with a query of its wiki name plus “rick and morty” (`--rigged` for a person); judge the top candidates against the sheet by their thumbnails (`lab/meshy/scout/<name>/`) with the gate's checklist; for a hit, `fetch` it to the asset's output path, record it in `lab/meshy/scout/<name>/chosen.json` and skip that asset's Meshy steps. The prompts above are used only when no candidate passes.
- [ ] The rest as Task 1.1 (Steps 3–7) for what the scout didn't find (`sit` for `spacebeth`, `drwong`). Commit “Rick and Morty: Phase 2’s figures (the family’s friends, and Total Rickall’s parasites)”.

### Task 2.2: Total Rickall’s rules (pure)

**Files:**
- Create: `src/components/rickmorty/world/interiors/rickall.js`, `rickall.test.js`

**Interfaces:**
- Produces: `PARASITES` (the thirteen, `{ id, kind, name, memories: [{ good: true, text }] }`), `FAMILY` (`rick`, `morty`, `beth`, `jerry`, `summer`, `poopybutthole`, each with at least one `good: false` memory), `RICKALL = { count: 8, time: 120 }`; `newRickall(seed = 1) → { people: [{ id, kind, x, z, face, parasite }], told: {}, shot: [], state: 'on' | 'won' | 'family' | 'poopybutthole' | 'out', t }` (eight parasites chosen by seed plus the family, placed on the living room's clear floor from `interiors/house.js`'s `HOUSE_SPOTS`); `tell(game, id) → { memory, remaining }` (the next unseen memory of that person; a parasite's are all good); `shoot(game, id) → 'parasite' | 'family' | 'poopybutthole' | 'won' | null` (null once the game is over or the id is already shot; `'won'` when the last parasite falls); `stepRickall(game, dt) → 'out' | null`.

- [ ] **Step 1: Failing tests:** `newRickall(1)` equals `newRickall(1)`, has 8 parasites and the 6 family, all on distinct spots; every parasite's memories are good, every family member has a bad one; `shoot` on a parasite returns `'parasite'` and adds to `shot`; the 8th returns `'won'` and `state === 'won'`; `shoot(game, 'beth')` → `'family'`, state `'family'`, and a `shoot` after returns null; `shoot(game, 'poopybutthole')` → `'poopybutthole'`; two `shoot` calls of one id count once; `stepRickall` past `RICKALL.time` → `'out'` once.
- [ ] **Step 2:** Run → FAIL; write `rickall.js`; run → PASS. **Commit** “C-137: Total Rickall’s rules”.

### Task 2.3: Total Rickall in the living room

**Files:**
- Modify: `src/components/rickmorty/world/interiors/house.js` (the egg on the shelf; the `rickall` mood: the figures placed from the game, a memory card over the one looked at, a crosshair), `src/components/rickmorty/world/rules.js` (`HOTSPOTS`: `{ id: 'egg', area: 'house', …, kind: 'rickall' }`; `TASKS`: `rickall` “Survive Total Rickall”; a `mode: 'rickall'` in `newMorty`'s state that `stepMorty` keeps him in the living room for), `RmWorld.jsx` (the mode: click or `F` shoots the figure under the crosshair, `E` tells; the endings as cards: won (“Ooh wee. You spared Mr. Poopybutthole.”), family (“That was Beth.”), poopybutthole (“He was real. He always was.”), out), `src/components/Achievements.jsx` (`rickall`), `meshyCast.js` (the kinds, `poopybutthole { a: 'poopybutthole', h: 1.75 }` with the sit clip for the sofa).

- [ ] **Step 1:** Rules additions with tests (the egg hotspot is clear of furniture; `rickall` in `TASKS`).
- [ ] **Step 2:** The scene and the mode. Browser: start it, look at three people, shoot a parasite, shoot Beth (ending), restart, win; shot `rickall`.
- [ ] **Step 3: Commit** “C-137: Total Rickall, in the living room”.

### Task 2.4: The rest of the family, in their places

**Files:** `rules.js` (`PEOPLE`: `poopybutthole` on the sofa (`sits`), `snuffles` by the front door as a `FURNITURE`-style model with a `card` hotspot (“Snuffles. Don’t give him the helmet.”), `spacebeth` in the garage by the bench (`sits` on the stool; `until: 'rickall'` reversed: she is there after Phase 2's first task, or always: always), `nancy` and `tricia` in Summer's room (`sits` on the bed), `diane` in the clone lab as a hologram (`who: 'diane'`, drawn tinted cyan and half transparent by `interiors/basement.js`)), a new room `wong` (`AREAS.wong` in the room column at `z 894…906`, door on the street next to Shoney's: `DOORS.wong`; `interiors/wong.js`: her office, two chairs, the couch, the plant, Dr. Wong `sits`; `HOTSPOTS`: `therapy` “Family therapy. Rick says it’s for Jerry.”; `TASKS`: `wong`); lines for each; `meshyCast.js` kinds; `Achievements.jsx` (`wong`); `RmWorld.jsx` `NAMES`, `TO`/`OUT` (`wong-door`, `wong-exit`).

- [ ] **Step 1:** Rules and tests (the room's box, door and exit, people clear, as the diner's tests do).
- [ ] **Step 2:** The room and the people; browser; shots `wong`, `sofa`, `garage-spacebeth`, `sleepover`, `diane`.
- [ ] **Step 3:** README, architecture. **Commit** “C-137: Mr. Poopybutthole, Snuffles, Space Beth, Dr. Wong’s office, the sleepover and Diane”; PR; merge.

---

## Phase 3: the Citadel’s districts and the map’s set pieces (a ceiling of 623 credits, ≈ 750)

### Task 3.1: Phase 3’s figures and models

Assets, with their ceilings if generated (R 47 ×6, C 33 ×5, PH 44 ×4 = 623):

```js
  bigmorty: { sit: true, height: 1.5, prompt: `Big Morty from Rick and Morty: ${MORTY}, wearing a green knitted beanie, yellow-tinted aviator sunglasses, a thin moustache, an open dark pink shirt over a red T-shirt, two gold chain necklaces, blue jeans and white sneakers. ${BODY}` },
  slickmorty: { height: 1.5, prompt: `Slick Morty from Rick and Morty: ${MORTY} with a slightly greenish-yellow tint to his skin, a curl of hair sticking up and a shaved line on the right of his scalp, a sleeveless yellow shirt, two metal dog tags on a chain round his neck, blue jeans and white sneakers. ${BODY}` },
  campaignmorty: { height: 1.5, prompt: `Candidate Morty's campaign manager from Rick and Morty: ${MORTY} in a neat dark suit with a white shirt and a tie, a round campaign badge on the lapel, black shoes, a pleased smile. ${BODY}` }, // (colours from the sheet: "Campaign Manager Morty")
  rickd3: { height: 1.85, prompt: `Rick D. Sanchez III from Rick and Morty: ${RICK}, in a purple suit jacket and purple trousers, a green shirt with a green tie, a purple top hat, white gloves, empty hands. ${BODY}` },
  simplerick: { height: 1.85, prompt: `Simple Rick from Rick and Morty: ${RICK} with a gentle contented smile, in a plain light blue collared shirt tucked into dark blue trousers, no lab coat, brown shoes. ${BODY}` },
  evilrick: { height: 1.85, prompt: `Evil Rick from Rick and Morty: ${RICK} with dark circles under his eyes, a scar across his lips and a cold stare, in a white lab coat over a black shirt, brown trousers and black shoes. ${BODY}` },
  'loco-a': { crowd: true, prompt: `A Mortytown Loco from Rick and Morty: ${MORTY} with a thin moustache, a purple bandana tied over his hair, a white tank top, baggy blue jeans and white sneakers. ${AT_EASE}` },
  'loco-b': { crowd: true, prompt: `A Mortytown Loco from Rick and Morty: ${MORTY} in a purple hoodie with the hood down, a gold chain, black jeans and sneakers. ${AT_EASE}` },
  'loco-c': { crowd: true, prompt: `A Mortytown Loco from Rick and Morty: ${MORTY} in a purple beanie and a purple sleeveless vest over a yellow T-shirt, blue jeans, sneakers. ${AT_EASE}` },
  supremeguard: { crowd: true, prompt: `A Supreme Guard Rick of the Citadel from Rick and Morty: ${RICK} in white and gold armour plates over a dark blue bodysuit, a white helmet with a gold visor pushed up, white boots. ${AT_EASE}` }, // (confirm against the sheet "Supreme Guard Ricks")
  garmentrick: { crowd: true, prompt: `Garment District Rick from Rick and Morty: ${RICK} in a long tan coat with a fur collar, a wide-brimmed tan hat, a gold chain, dark trousers and shiny shoes. ${AT_EASE}` }, // (confirm against the sheet)
  mortymart: { rig: false, hero: true, prompt: `Morty Mart from Rick and Morty: a small boxy convenience store on a Citadel street corner, cream walls with a blue band under a flat roof, a wide glass shopfront with posters in the windows, a blank yellow and blue sign board over the door, a newspaper box and a bin outside, no people, no text. ${BUILDING}` },
  creepymorty: { rig: false, hero: true, prompt: `The Creepy Morty club from Rick and Morty: a two-storey dark purple nightclub on a Citadel street, blank glowing pink neon sign boards, a lit doorway with a velvet rope, a yellow awning, no text, no people. ${BUILDING}` },
  'citadel-exterior': { rig: false, hero: true, prompt: `The Citadel of Ricks from Rick and Morty, seen from space: a huge space station, a great round central dome of pale green and teal metal with lit windows in rings, four long arms reaching out from it each ending in a smaller dome, towers and spires rising from the central dome, cyan running lights along every edge. ${PROP}` },
  nx5: { rig: false, hero: true, prompt: `The NX-5 Planet Remover from Rick and Morty, a Galactic Federation capital ship: a huge long dark green armoured warship with a flat wide hull, a ring of five enormous laser cannon barrels at the front, rows of green lights along its sides, a raised command tower near the stern, big engine blocks at the back glowing green. ${PROP}` }, // (confirm the cannon layout against the sheet "NX-5 Planet Remover")
```

- [ ] **Sheets and scout** (Task 1.1, Steps 1–2), before any concept: for each asset run the scout with a query of its wiki name plus “rick and morty” (`--rigged` for a person); judge the top candidates against the sheet by their thumbnails (`lab/meshy/scout/<name>/`) with the gate's checklist; for a hit, `fetch` it to the asset's output path, record it in `lab/meshy/scout/<name>/chosen.json` and skip that asset's Meshy steps. The prompts above are used only when no candidate passes. The Citadel from space and the NX-5 are credited `where: 'universe'` (the map shows them).
- [ ] The rest as Task 1.1 (Steps 3–7) for what the scout didn't find; `scripts/crowd.mjs` gains the five crowd names and, posed on their idles, `bigmorty`, `slickmorty`, `rickd3`, `simplerick`, `evilrick` (so the Citadel's crowd has them too). Commit “Rick and Morty: Phase 3’s figures (Mortytown’s Mortys, Rick D. Sanchez III, Simple Rick, Evil Rick), the Citadel from space and the NX-5”.

### Task 3.2: Mortytown’s layout (pure)

**Files:**
- Create: `src/components/rickmorty/citadel/mortytown.js`, `mortytown.test.js`
- Modify: `src/components/rickmorty/citadel/layout.js` (`DOORS.mortytown = { x: -27.6, z: 27.6, w: 7 }`, a `SPOTS` entry `mortytown`)

**Interfaces:**
- Produces: `MORTYTOWN = { x0: -60, x1: 60, z0: -30, z1: 30 }` (a district of its own, entered through the door: a second `world` for `CitadelWorld.jsx`'s walker, `at` kept as `tp-citadel-at` with `district: 'mortytown'`), `BLOCKS` (low buildings as boxes), `COLLIDERS`, `WALLS`, `HIDES: [{ id: 'loco-a' | 'loco-b' | 'loco-c', x, z, face }]` (three hiding spots, each behind cover from the street's centre: `sightClear` false from `(0, 0)`), `COP = { x: 40, z: 0 }` (Cop Morty's spot by Morty Mart), `CAST` (`bigmorty` at the club door, `slickmorty` on a corner, `rickd3` and `simplerick` by the factory's back door, `evilrick` walking a loop, `campaignmorty` by a poster), `START = { x: -50, z: 0, face: 0 }`, `inMortytown(x, z)`.

- [ ] **Step 1:** Tests mirroring `layout.test.js`'s `clear`/`reachable`: `START`, every `CAST` member, every `HIDES` spot and `COP` are clear and reachable from `START`; each hide is not in sight of `(0, 0)` but is in sight from within 6 m; the door `mortytown` is on the concourse and clear.
- [ ] **Step 2:** Run → FAIL; write; → PASS. **Commit** “Citadel: Mortytown’s layout”.

### Task 3.3: The Locos quest (pure) and the district drawn

**Files:**
- Modify: `src/components/rickmorty/citadel/story.js` (`QUESTS` + `{ id: 'locos', name: 'The Mortytown Locos', where: 'Mortytown', needs: 'daycare', go: 'Morty Mart’s been robbed. The Locos are hiding somewhere in Mortytown. Find all three and walk each one to Cop Morty.' }`, `SEAL.locos`), `story.test.js` (the order: `locos` opens after `daycare`; `citadelProgress` counts it; `mood` unchanged by it)
- Create: `src/components/rickmorty/citadel/locos.js`, `locos.test.js` (`newHunt(seed)`, `stepHunt(hunt, rick, dt, { push })`: a found Loco (Rick within 2.5 m and in sight) follows him at walking pace; delivered when within 3 m of `COP`; events `found`, `delivered`, `won`), `src/components/rickmorty/citadel/district.js` (the builder: the Kenney `station-*` props recoloured, the two Meshy buildings fitted to their `BLOCKS`, the Morty Mart's broken window, posters, the crowd on `CROWD_LOOPS` of the district, the sky the city's under the dome), `CitadelWorld.jsx` (the door takes you down; the HUD's objective; the walker's world swapped: `makeWalker({ radius: null, box: MORTYTOWN, colliders, walls })` or the box as walls), `people.js` (the new kinds), `Achievements.jsx` (`locos`).

- [ ] **Step 1:** Story and hunt tests → FAIL → write → PASS.
- [ ] **Step 2:** The district and the door; browser: go down, find the three, deliver, come back up; `lab`-style shot script for the Citadel (`scripts/citadel-shots.mjs` on `window.__CITADEL__`, as Task 0.6) → `docs/superpowers/shots/2026-10-06-rm-mortytown.webp`.
- [ ] **Step 3: Commit** “Citadel: Mortytown, and the Locos”.

### Task 3.4: The Citadel from space, as a model

**Files:** `src/components/universe/deep.js:138-156` (nothing: `CITADEL_PARTS` stay), the Citadel's drawing in `src/components/universe/scene.js` (`grep -n citadel src/components/universe/scene.js`) takes `/models/c137/rm/citadel-exterior.glb` through `glbFleet.js`'s loader, fitted to `r * 1.9` across its arms, the code-built one standing in until it loads; the siege's wreckage keeps using the parts.

- [ ] **Step 1:** Load and fit; the siege (`universe/siege.js`, `citadelSiege.js`) still works: the generators sit where `CITADEL_PARTS` put them, marked on the model. Browser: fly to it, siege it; shot `citadel-space`.
- [ ] **Step 2: Commit** “Universe: the Citadel of Ricks from space, as a model”.

### Task 3.5: The NX-5 Planet Remover (pure rules, then the event)

**Files:**
- Create: `src/components/universe/remover.js`, `remover.test.js`
- Modify: `src/components/universe/director.js:35` (`EVENTS.remover` for `family === 'rickmorty'`, with the destroyer's weighting), `director.test.js`, `src/components/universe/setpieces.js` or `skirmishes.js` (where the Star Destroyer event is drawn: `grep -n destroyer src/components/universe/*.js`), `fleetRickmorty.js` (`FLEET.nx5` from the model), `src/components/Achievements.jsx` (`remover`)

**Interfaces:**
- Produces: `REMOVER = { arrive: 6, charge: 40, hp: 12, shares: true }`; `newRemover(planet, at, seed) → { phase: 'arriving' | 'charging' | 'fired' | 'destroyed', t, hp, planet }`; `hitRemover(r, damage) → 'hit' | 'destroyed' | null`; `stepRemover(r, dt) → 'fired' | 'left' | null`; `removedUntil(planet) → time` (shared through `siege.js`'s share table so every browser agrees; a planet “removed” is drawn dark and cracked for 60 s and its landing is refused with a card, foot mode untouched).

- [ ] **Step 1:** Tests: the phases in order with the times; damage from two pilots' shares adds up; `fired` once; hitting after `destroyed` returns null; `removedUntil` is 60 s after `fired`; a pilot already landed stays landed (`refuseLanding(planet)` only).
- [ ] **Step 2:** Rules → PASS; the event drawn (the model drops out of warp as the Star Destroyer does, the array glows up over `charge`, the beam, the crack); the crews' lines (Rick: “That’s a planet remover, Morty. It removes planets.”); browser; shot `nx5`.
- [ ] **Step 3:** README, architecture. **Commit** “Universe: the Federation’s NX-5 Planet Remover”; PR; merge.

---

## Phase 4: eight more destinations (a ceiling of 1,315 credits, ≈ 1,580)

Each task below is one destination: its assets (scouted first, as Task 1.1's Step 2, then made as Task 1.1 for what the scout didn't find, judged the same; the credits given are ceilings), its entry (index as given), its builder (a paragraph), kinds, a task and an achievement, shots, a commit. Steps are Task 1.2's. Lines are two per named person, in the site's voice.

### Task 4.1: Fantasy World (index 4, outdoor; 169 credits at most)

Assets: `stairgoblin` P39 (`A Stair Goblin from Rick and Morty: a living flight of three steps, a blocky pink body shaped like a small staircase with a grumpy face on the top step, two stubby arms and two short legs. ${PROP}`; drawn in three tints), `kingjellybean` R47 h 2.2 (`King Jellybean from Rick and Morty: a tall pale blue jellybean-shaped creature with a droopy tired face, half-closed eyes and a frown, a small gold crown on top, a magenta royal robe with white fur trim over his shoulders, a gold medallion on a chain, thin bare bluish arms and legs, bare feet. ${BODY}`), `thirstystep` PH44 (`The Thirsty Step tavern from Rick and Morty: a medieval fantasy tavern of dark timber and cream plaster with a steep brown shingled roof, a big round wooden door, small leaded windows glowing warm, a hanging wooden sign with a tankard on it, a stone chimney, no text. ${BUILDING}`), `giant` P39 scaled ×4 (`A giant from the giants' village in Rick and Morty: a huge bearded man in a simple brown peasant tunic with a rope belt, brown trousers and big leather boots, bushy brown hair and beard, a kindly face. ${PROP}`).

- [ ] **Sheets and scout** (Task 1.1, Steps 1–2), before any concept: for each asset run the scout with a query of its wiki name plus “rick and morty” (`--rigged` for a person); judge the top candidates against the sheet by their thumbnails (`lab/meshy/scout/<name>/`) with the gate's checklist; for a hit, `fetch` it to the asset's output path, record it in `lab/meshy/scout/<name>/chosen.json` and skip that asset's Meshy steps. The prompts above are used only when no candidate passes.

The place: a medieval village square of cobbles, the tavern (model) with its door a `card` hotspot, timber cottages, the beanstalk rising out of sight, the giant standing beyond the square (a `card`: “Dale. He fell on his sword. It’s complicated.”), three Stair Goblins hopping about (instanced, a bob), `kingjellybean` by the tavern's privy (`until: 'fantasy'`: the task “Get the village’s help” is done by talking to the Meeseeks (`meeseeks`, exists) at the well; the king is gone after). Kinds: `meeseeks`, `kingjellybean`. Achievement `fantasy`.

### Task 4.2: The Microverse (index 5, room; 102 credits at most)

Assets: `zeep` H55 h 1.8 (`Zeep Xanflorp from Rick and Morty: a thin alien scientist with a green head that is tall and wide at the top and tapers to the chin, three blue stripes across his big forehead, a single blue unibrow, yellow eyes with blue pupils and dark circles under them, blue lips and blue fingertips, in a green lab coat with gold trim at the collar and cuffs over a grey shirt, grey trousers and dark shoes. ${BODY}`), `kyle` R47 h 1.7 (`Kyle, the scientist of the Miniverse from Rick and Morty: a slim alien with pale blue-grey skin, a tall oval head with a high brow, big sad dark eyes, two small antennae, in a white lab coat over a teal tunic, grey trousers, boots. ${BODY}`, confirm against the sheet "Kyle").

- [ ] **Sheets and scout** (Task 1.1, Steps 1–2), before any concept: for each asset run the scout with a query of its wiki name plus “rick and morty” (`--rigged` for a person); judge the top candidates against the sheet by their thumbnails (`lab/meshy/scout/<name>/`) with the gate's checklist; for a hit, `fetch` it to the asset's output path, record it in `lab/meshy/scout/<name>/chosen.json` and skip that asset's Meshy steps. The prompts above are used only when no candidate passes.

The place: Zeep's lab inside the battery: a round hall of white and green panels with the Miniverse battery (a glowing green cylinder) in the middle, a window on the Microverse city's towers (the annex's skyline helper, in white and green), the gooble boxes (the people's foot-powered generators, a `card`: “They stomp on them. The stomping makes the power. Slavery with extra steps.”), `zeep` at the console, `kyle` at the battery (`until: 'microverse'`). Task `microverse` “Meet the man inside the battery” (talk to Zeep). Achievement `microverse`.

### Task 4.3: Anatomy Park (index 6, room; 336 credits at most)

Assets: `xenonbloom` R47 h 1.9 (`Dr. Xenon Bloom from Rick and Morty: a translucent pale teal-green amoeba in the shape of a tall thin man, with lighter blobs floating inside his body, a drawn-on face with round black glasses, a grey moustache and a wide mouth of square teeth, no clothes, empty hands. ${BODY}`), `poncho` R47 h 1.75 (`Poncho from Rick and Morty: a stocky middle-aged man with grey hair and a grey moustache and an angry face, in a brown sleeveless vest over a bare chest, dark green trousers, boots, and a clear round bubble helmet with a blue collar ring over his head, empty hands. ${BODY}`), `annie` R47 h 1.62 (`Annie from Rick and Morty: a teenage girl with long blonde hair in a high ponytail with a teal bow, big eyes with long lashes, a few freckles, a white short-sleeved blouse under a dark green theme-park apron with a name tag, a dark green skirt, white sneakers. ${BODY}`), five diseases Q39 (`hepatitis`: `Hepatitis A as a monster in Rick and Morty: a huge hulking green-brown blob creature with a lumpy wet body, a wide mouth of jagged teeth, small yellow eyes and two thick arms. ${PROP}`; `gonorrhoea`: `… a towering pale yellow-green creature of lumpy jelly with many thin tentacles, a cluster of red eyes and a round sucker mouth. ${PROP}`; `tuberculosis`: `… a tall gaunt pale grey creature with long thin arms, a hunched back, a skull-like face with sunken eyes and a wide coughing mouth. ${PROP}`; `plague`: `Bubonic plague as a monster in Rick and Morty: a swollen black and purple creature covered in bulging boils, short legs, a huge toothy mouth and small glowing eyes. ${PROP}`; `ecoli`: `E. coli as a monster in Rick and Morty: a long dark brown rod-shaped creature covered in wriggling hairs, a mouth of needle teeth at one end, many small legs. ${PROP}`), all confirmed against the sheets (`Hepatitis A`, `Gonorrhea`, `Tuberculosis`, `Bubonic Plague`, `E. coli`).

- [ ] **Sheets and scout** (Task 1.1, Steps 1–2), before any concept: for each asset run the scout with a query of its wiki name plus “rick and morty” (`--rigged` for a person); judge the top candidates against the sheet by their thumbnails (`lab/meshy/scout/<name>/`) with the gate's checklist; for a hit, `fetch` it to the asset's output path, record it in `lab/meshy/scout/<name>/chosen.json` and skip that asset's Meshy steps. The prompts above are used only when no candidate passes.

The place: inside Ruben: a red fleshy cavern with ribs overhead and a pulsing glow (`fx.js`'s pulse), the park's walkway of white rails, the Spleen Mountain sign, a kiosk, the monorail car; the diseases in their enclosures (a `card` each: its name and one line), `xenonbloom` at the entrance, `poncho` and `annie` on the walkway. Task `anatomy` “Ride Anatomy Park” (walk the loop to the exit, the `Pirates of the Pancreas` gate). Achievement `anatomy`.

### Task 4.4: Needful Things (index 7, room; 91 credits at most)

Assets: `needful` R47 h 1.85 (`Mr. Needful from Rick and Morty: a thin man of Rick's height with very angular features, a long nose, a pointed chin and bags under his eyes, red hair pointed up at the sides like horns, a thin pencil moustache and a matching goatee, thick eyebrows, in a three-piece suit of a drab purple-and-green blazer over a green waistcoat, dark purple trousers, a string tie, white gloves, red dress shoes and a large black top hat, empty hands. ${BODY}`), `needful-shop` PH44 (`Needful Things, the curiosity shop from Rick and Morty: a small old-fashioned shop of dark red brick with a black-painted wooden shopfront, a big bay window full of odd antiques, a glass door with a bell, a hanging blank sign, a lamp either side of the door, no text. ${BUILDING}`).

- [ ] **Sheets and scout** (Task 1.1, Steps 1–2), before any concept: for each asset run the scout with a query of its wiki name plus “rick and morty” (`--rigged` for a person); judge the top candidates against the sheet by their thumbnails (`lab/meshy/scout/<name>/`) with the gate's checklist; for a hit, `fetch` it to the asset's output path, record it in `lab/meshy/scout/<name>/chosen.json` and skip that asset's Meshy steps. The prompts above are used only when no candidate passes.

The place: the shop inside (shelves of cursed things: the typewriter, the aftershave, the beauty cream, each a `card` with its curse), `needful` behind the counter (lines: “Free. Everything here is free.”), the shop's front as the model seen through the window onto the street. Task `needful` “Take something free from Mr. Needful” (three cards read). Achievement `needful`.

### Task 4.5: Jerryboree (index 8, room; 198 credits at most)

Assets: six crowd Jerrys C33: `jerry-robe` (`A Jerry Smith from another dimension at the Jerryboree in Rick and Morty: Jerry Smith, a man in his late thirties with short swept brown hair and a sulky look, in a brown bathrobe over pyjamas and slippers. ${AT_EASE}`), `jerry-golf` (… `in a green polo shirt, khaki shorts, a white sun visor and white trainers`), `jerry-tux` (… `in a black tuxedo with a bow tie`), `jerry-track` (… `in a red tracksuit with white stripes and a sweatband`), `jerry-gown` (… `in a pale blue hospital gown and socks`), `jerry-cardigan` (… `in a beige cardigan over a checked shirt, with a flat cap`).

- [ ] **Sheets and scout** (Task 1.1, Steps 1–2), before any concept: for each asset run the scout with a query of its wiki name plus “rick and morty” (`--rigged` for a person); judge the top candidates against the sheet by their thumbnails (`lab/meshy/scout/<name>/`) with the gate's checklist; for a hit, `fetch` it to the asset's output path, record it in `lab/meshy/scout/<name>/chosen.json` and skip that asset's Meshy steps. The prompts above are used only when no candidate passes.

The place: the daycare: a bright room of soft colours, a ball pit, a TV playing (the cable toy's static), cots, a reception desk with the receptionist Rick (`rick` kind, a crowd copy) and a ticket machine (`card`: “Take a ticket. Rick forgot his.”), ten Jerrys about the room from the six copies (instanced, a few sitting on the floor: the crowd baker's pose is standing; keep them standing), `jerry` (the real one, rigged, exists) by the door asking to go home. Task `jerryboree` “Pick up the right Jerry” (talk to three Jerrys; the real one is the one whose line mentions Beth). Achievement `jerryboree`.

### Task 4.6: Purge Planet (index 9, outdoor; 146 credits at most)

Assets: `arthricia` R47 h 1.6 (`Arthricia from Rick and Morty: a teenage cat-girl with light brown fur, a cat's face with a small pink nose and pointed ears, long flowing darker brown hair worn down, in a light blue peasant dress with a white apron and long black boots. ${BODY}`), three `magdalian-*` C33 (`A Magdalian villager from the Purge Planet in Rick and Morty: a cat-person with orange fur, a cat's face with a small nose and pointed ears, in a brown peasant tunic with a rope belt, bare furry feet. ${AT_EASE}`; `grey fur … a blue dress with an apron`; `cream fur … a green jerkin over a white shirt`).

- [ ] **Sheets and scout** (Task 1.1, Steps 1–2), before any concept: for each asset run the scout with a query of its wiki name plus “rick and morty” (`--rigged` for a person); judge the top candidates against the sheet by their thumbnails (`lab/meshy/scout/<name>/`) with the gate's checklist; for a hit, `fetch` it to the asset's output path, record it in `lab/meshy/scout/<name>/chosen.json` and skip that asset's Meshy steps. The prompts above are used only when no candidate passes.

The place: a medieval village of thatched cottages at dusk, lanterns, a well, the villagers about (the crowd copies), `arthricia` by the well; the purge siren hotspot (`card` then the mood `purge`: the sky goes red, the villagers run, a line from Arthricia). Task `purge` “Get out before the purge” (the siren, then the portal within 60 s; Morty's jump helps over the fences). Achievement `purge`.

### Task 4.7: Pluto (index 10, outdoor; 160 credits at most)

Assets: `flippynips` R47 h 1.5 (`King Flippy Nips of Pluto from Rick and Morty: a round plump Plutonian with orange skin and a pale yellow belly, three tall yellow-green antenna stalks standing up from the top of his head like a crown, red frilled fins at the sides of his head, big round glasses with X-shaped eyes behind them, a wide grin of white teeth, a dark red cape fastened with a round blue gem, gold bracelets on his wrists, three-fingered hands and three-toed bird-like orange feet. ${BODY}`), `scroopy` R47 h 1.4 (`Scroopy Noopers, a Plutonian from Rick and Morty: a round plump alien with orange skin and a pale yellow belly, three short red antennae on his head, red frilled fins at the sides of his head, round glasses with X-shaped eyes, a wide mouth of white teeth, in a white short-sleeved collared shirt with a pocket of pens, three-toed orange feet. ${BODY}`), two `plutonian-*` C33 (`A Plutonian from Rick and Morty: a round plump alien with orange skin and a pale yellow belly, three short antennae on the head, frilled fins at the sides of the head, round eyes with X-shaped pupils, a wide mouth of white teeth, in a blue tunic, three-toed orange feet. ${AT_EASE}`; `… in grey overalls`).

- [ ] **Sheets and scout** (Task 1.1, Steps 1–2), before any concept: for each asset run the scout with a query of its wiki name plus “rick and morty” (`--rigged` for a person); judge the top candidates against the sheet by their thumbnails (`lab/meshy/scout/<name>/`) with the gate's checklist; for a hit, `fetch` it to the asset's output path, record it in `lab/meshy/scout/<name>/chosen.json` and skip that asset's Meshy steps. The prompts above are used only when no candidate passes.

The place: a flat blue-green plain with mushrooms (instanced, three sizes), mushroom-shaped houses and the pyramid palace beyond the box, a ring of rocks across the sky and two close moons, `flippynips` on the palace steps with a podium (“Pluto is a planet. Say it.”), `scroopy` at a protest sign, Plutonians about. Task `pluto` “Tell Pluto it’s a planet” (the podium). Achievement `pluto`.

### Task 4.8: Gear World (index 11, outdoor; 113 credits at most)

Assets: `gearhead` R47 h 1.8 (`Gearhead (Revolio Clockberg Jr.) from Rick and Morty: a thick-set gear-person, bald, with forehead wrinkles above a large purple unibrow, yellow-tinted eyes with heavy bags under them, a round nose, yellow and orange gears where his ears and mouth would be, a transparent pink torso with brass gears turning inside it and pink windows on his shoulders, grey metal arms and legs, in a brown waistcoat and dark trousers. ${BODY}`), one more `gearperson-b` C33 (`… in a grey suit`).

- [ ] **Sheets and scout** (Task 1.1, Steps 1–2), before any concept: for each asset run the scout with a query of its wiki name plus “rick and morty” (`--rigged` for a person); judge the top candidates against the sheet by their thumbnails (`lab/meshy/scout/<name>/`) with the gate's checklist; for a hit, `fetch` it to the asset's output path, record it in `lab/meshy/scout/<name>/chosen.json` and skip that asset's Meshy steps. The prompts above are used only when no candidate passes.

The place: a brass and copper city of gears: the ground a vast cog's face, buildings as stacked gears turning slowly (the gearship's idea from `fleetRickmorty.js`), cog-shaped lamps, `gearhead` at his gear-shop door (“Rick’s my best friend. Rick’s everyone’s best friend.”), gear people about, the gearship (`FLEET.gearship`'s builder) parked. Task `gearworld` “Visit Gearhead” . Achievement `gearworld`.

### Task 4.9: Phase 4 wrap

- [ ] README, architecture, shots of all eight, lint/tests/build; **Commit** “C-137: eight more dimensions on the dial”; PR; merge.

---

## Phase 5: the Vindicators (a ceiling of 342 credits, ≈ 410)

### Task 5.1: The Vindicators’ figures and ship

Assets, with their ceilings if generated (H 55 ×2, R 47 ×4, PH 44):

```js
  vance: { hero: true, height: 1.85, prompt: `Vance Maximus, Renegade Starsoldier of the Vindicators from Rick and Morty: a man with short spiky auburn-red hair and red stubble, a long chin and a wide grin, in a blue and white armoured battlesuit with red and grey panels, a white chest plate with a red Vindicators emblem (a stylised V in a circle), armoured gauntlets and boots, a jetpack on his back. ${BODY}` },
  supernova: { hero: true, height: 1.85, prompt: `Supernova of the Vindicators from Rick and Morty: a tall slim cosmic woman with purple skin, long flowing dark purple hair, glowing white eyes with no pupils, a silver crescent-moon headpiece with a small orb, a skin-tight dark purple bodysuit patterned like a galaxy with tiny stars, bare arms. ${BODY}` },
  alanrails: { height: 2.0, prompt: `Alan Rails of the Vindicators from Rick and Morty: a large muscular Black man in an old-fashioned grey train conductor's cap, a dirty dark sleeveless greatcoat open over a bare chest, grey overalls with straps, work gloves, and a glowing green chain with a train whistle hanging round his neck. ${BODY}` },
  millionants: { height: 1.9, prompt: `Million Ants of the Vindicators from Rick and Morty: a humanoid figure made entirely of a swarm of red ants packed together into the shape of a muscular man, a rough grainy dark red surface with a few ants crawling off it, two dark hollow eyes and a hollow mouth, no clothes. ${BODY}` },
  crocubot: { height: 1.9, prompt: `Crocubot of the Vindicators from Rick and Morty: a cyborg crocodile standing upright, a brown-green scaly crocodile head and tail with a long toothy snout, the left eye a cluster of small camera lenses, a boxy pale blue and white robot chest with a blue screen panel, dark grey robot arms and legs with pistons, one organic clawed arm. ${BODY}` },
  noobnoob: { height: 1.1, prompt: `Noob-Noob of the Vindicators from Rick and Morty: a small man with a tall narrow bullet-shaped pale head, a pink superhero mask over his eyes, an open mouth with a few teeth, in a pale pink top with purple shoulders, pink briefs with a small white letter n on them, a purple cape, dark blue boots, pale skinny arms and legs. ${BODY}` },
  'vindicators-ship': { rig: false, hero: true, prompt: `The Vindicators' ship from Rick and Morty: a sleek superhero team's spaceship, a long white and dark blue hull with red trim, swept-back wings, a domed cockpit at the front, a big circular Vindicators emblem on the side, twin blue-glowing engines at the back. ${PROP}` }, // (confirm against the sheet "The Vindicators")
```

- [ ] **Sheets and scout** (Task 1.1, Steps 1–2), before any concept: for each asset run the scout with a query of its wiki name plus “rick and morty” (`--rigged` for a person); judge the top candidates against the sheet by their thumbnails (`lab/meshy/scout/<name>/`) with the gate's checklist; for a hit, `fetch` it to the asset's output path, record it in `lab/meshy/scout/<name>/chosen.json` and skip that asset's Meshy steps. The prompts above are used only when no candidate passes.
- [ ] The rest as Task 1.1 (Steps 3–7) for what the scout didn't find. Commit “Rick and Morty: the Vindicators”.

### Task 5.2: Rick’s rooms (pure)

**Files:** `src/components/rickmorty/world/dimensions/vindicatorsRules.js`, `.test.js`

**Interfaces:** `ROOMS: [{ id: 'levers', prompt, choices: [{ id, text, right }] }, { id: 'riddle', … (every choice wrong but 'israel') }, { id: 'button', … (the right one is 'noobnoob') }]`; `newTrial() → { room: 0, state: 'on' | 'won' | 'lost', picks: [] }`; `pick(trial, choiceId) → 'next' | 'won' | 'lost' | null`; a lost trial restarts from room 0 with `retry(trial)`.

- [ ] Tests: three rooms in order; a wrong pick loses; the right three win; `pick` after `won` is null; `retry` resets. Commit “C-137: the Vindicators’ trial rules”.

### Task 5.3: The Vindicators’ ship (index 12, room)

The place: the ship's hall (white and blue panels, the holo-table with Rick's mess as a stain, the beacon on a plinth, the team's portraits), the six standing about (`vance` at the table, `supernova`, `alanrails`, `millionants`, `crocubot`, `noobnoob` with a mop), the ship model seen through the hall's window on its pad; the trial: a door hotspot `saw` opens the three rooms as cards over the world (`DimensionDial`'s overlay style), each pick drawn in the hall (the levers, the riddle on a screen, the button). Lines for each; Noob-Noob laughs at Rick's. Task `vindicators` “Get through Rick’s rooms”. Achievement `vindicators`. Steps as Task 1.2; shot `vindicators`; README; commit “C-137: the Vindicators, and Rick’s rooms”; PR; merge.

---

## Phase 6: vehicles, the Story Train, the fortress, the Rick and Morty system (a ceiling of 474 credits, ≈ 570)

### Task 6.1: Phase 6’s models

Assets, with their ceilings if generated (PH 44 ×5, P 39, R 47 ×2, C 33 ×2, H 55 = 474):

```js
  'spacebeth-ship': { rig: false, hero: true, prompt: `Space Beth's spaceship from Rick and Morty: a compact battered single-seat starfighter in dark grey and olive-green with orange and bronze panels, a tinted cockpit canopy, stubby swept wings with guns under them, mismatched welded-on armour plates, twin engines at the back. ${PROP}` }, // (confirm against the sheet)
  'jerry-ship': { rig: false, prompt: `Jerry's car turned into a spaceship by Rick, from Rick and Morty: an ordinary pale green four-door family sedan with grey rocket thrusters bolted to the back, a small fin on the roof and metal plates welded over the wheel arches. ${CAR}` },
  'gotron-ferret': { rig: false, hero: true, prompt: `A Gotron ferret robot from Rick and Morty: a giant mecha shaped like a long sleek ferret, red armour plates with white and gold trim, a ferret's head with glowing yellow eyes, four clawed legs, a long tail, a cockpit canopy on the back of its head. ${PROP}` },
  gotron: { rig: false, hero: true, prompt: `The combined Gotron mecha from Rick and Morty: a towering humanoid super robot assembled from five ferret robots in red, blue, yellow, green and black, each limb a ferret with its head at the end, a chest plate with a glowing emblem, a horned helmet with a visor face, standing straight. ${PROP}` },
  'zigerion-ship': { rig: false, hero: true, prompt: `The Zigerion mothership from Rick and Morty: a huge sleek purple and silver spaceship, a long flat hull widening into a broad flat stern, a raised bridge dome, blue running lights, purple glowing engines. ${PROP}` }, // (confirm against the sheet "Zigerions")
  nebulon: { height: 1.9, prompt: `Prince Nebulon, leader of the Zigerions from Rick and Morty: a tall alien with pink-purple skin, a long head that stretches up and back with a few spiky protrusions, two long antenna-like appendages where his ears would be, a unibrow, four arms, in a tight dark red and black spacefleet uniform with a gold insignia on the chest, black boots. ${BODY}` },
  'zigerion-b': { crowd: true, prompt: `A Zigerion from Rick and Morty: … in a snug dark red spacefleet uniform … ${AT_EASE}` }, 'zigerion-c': { crowd: true, prompt: `… in a snug grey spacefleet uniform … ${AT_EASE}` },
  storytrain: { rig: false, hero: true, prompt: `The Story Train from Rick and Morty: a long dark red and black steam locomotive hauling three passenger carriages, with a big round headlamp, a cowcatcher, a brass bell, green and gold trim, lit windows, no text. ${PROP}` },
  storylord: { hero: true, height: 1.9, prompt: `Story Lord from Rick and Morty: a tall heavily muscled man with long grey hair and a chinstrap beard, a stern face, in a white tunic trimmed with yellow, a dark orange cape, yellow jodhpurs, dark brown gloves and boots, an emerald ring and a ruby ring on each hand. ${BODY}` },
  ticketsguy: { height: 1.75, prompt: `The Tickets Please Guy from Rick and Morty: a balding man with thick eyebrows, a curled moustache and a grey beard, small round glasses, a red conductor's jacket over a white shirt and tie, black trousers, black boots, white gloves, a black conductor's cap. ${BODY}` },
```

- [ ] **Sheets and scout** (Task 1.1, Steps 1–2), before any concept: for each asset run the scout with a query of its wiki name plus “rick and morty” (`--rigged` for a person); judge the top candidates against the sheet by their thumbnails (`lab/meshy/scout/<name>/`) with the gate's checklist; for a hit, `fetch` it to the asset's output path, record it in `lab/meshy/scout/<name>/chosen.json` and skip that asset's Meshy steps. The prompts above are used only when no candidate passes.
- [ ] The rest as Task 1.1 (Steps 3–7) for what the scout didn't find. Commit “Rick and Morty: Phase 6’s ships, the Gotron, the Story Train, Prince Nebulon and Story Lord”.

### Task 6.2: The street’s new vehicles

**Files:** `rules.js` (`BUILDINGS`/`FURNITURE`-style solids: Space Beth's ship parked on the Smiths' lawn's far side (`spacebeth` moves beside it), Jerry's car-ship in the driveway's other half (today's `car1` replaced), the combined Gotron standing in the park across the street, 24 m tall, with a ferret at its feet), `street.js` (fitting the models), tests (solids clear of the road, the cruiser's landing spots and every person).
- [ ] Commit “C-137: Space Beth’s ship, Jerry’s car with rockets, and the Gotron over the street”.

### Task 6.3: The simulation (index 13, room) and the Story Train (index 14, room)

The Zigerions' simulation: a plaza of the Smiths' street built badly (flat colours, the annex's `noInk`, two identical pedestrians, a sun that is a disc), `nebulon` watching from a raised walkway behind glass, two Zigerions at consoles; the `card` hotspots are the simulation's slips (“The pop-tart. Living in a toaster.”); task `simulation` “Spot the simulation” (three slips). The Story Train: inside a carriage, `storylord` at the far end, `ticketsguy` in the aisle (“Tickets, please.”: the task `storytrain` is a ticket card found under a seat), the windows showing the anthology's scenes as moving paintings (`paint.js`). Achievements `simulation`, `storytrain`. Steps as Task 1.2.

### Task 6.4: Rick Prime’s fortress (index 15, room)

The fortress: a cold grey hangar of Rick Prime's, the Omega Device on a plinth (`card`: “The Omega Device. Rick built it to erase Diane from every dimension. Rick Prime built this one.”), `rickprime` at the far console (`until: 'fortress'`; the task is to reach the console: he portals out as you arrive, the swirl), his clones' tanks along the wall (the clone lab's tanks from `interiors/basement.js`). Achievement `fortress`. Steps as Task 1.2.

### Task 6.5: The Rick and Morty system on the map

**Files:** `src/components/universe/deep.js:41` (four small planets round the Citadel as wonders of kind `'planet'` with `crew: 'rickmorty'`, `world: 'rickmorty'`, landings: `gazorpazorp`, `squanch`, `birdworld`, `gearworld`, at 300–600 units from the Citadel), `src/components/universe/landings/landings.js` (an entry each, ground and sky as the destinations' presets, `models` the `rm` GLBs, `things` the destination's house and two people with their `say` lines), `src/components/universe/landings/{gazorpazorp,squanch,birdworld,gearworld}.js` (PROPS lifted from the destination builders: the dune, the suckulent, the nest-house's rocks, the cog ground), `deep.test.js` (the four are solid, dockable, clear of each other and the Citadel's parts), `scripts/landing-check.mjs` (the four added).

- [ ] Rules and tests; the landings; `node scripts/landing-check.mjs` passes for the four; shots; README (the map's section); **Commit** “Universe: the Rick and Morty system round the Citadel”; PR; merge.

---

## Phase 7 (optional): the long tail

Not planned in detail; each entry is a Task 1.2-shaped destination or a Task 2.4-shaped addition, scouted first like the rest and priced per asset as a ceiling: ten Interdimensional Cable crowd figures on the alien street (C 33 each), Jaguar (R 47) and a Pickle Rick sewer run as a new game under `world/`, Mr. Nimbus (H 55) and the beach (outdoor), Heist-Con (Miles Knightly R 47, Heistotron PH 44), Water-T (P 39) at the Get Schwifty show, Krombopulos Michael's Gromflomite base (the figure exists from Phase 1; the base is a room), Mr. Frundles (Q 39), Snake Planet (code-drawn snakes), Froopyland (code-drawn), the Immortality Field Resort, Nuptia 4 (Glexo Slim Slom R 47), St. Gloopy Noops (Dr. Glip-Glop R 47, Shrimply Pibbles R 47). About 560 credits, 670 with rerolls.

---

## Self-review notes

- Spec coverage: the dial (Tasks 0.4–0.5), lazy loading (0.3), the four Tier 1 places (1.2–1.5), the house and Total Rickall (2.2–2.4), Mortytown and the Locos (3.2–3.3), the Citadel model and the NX-5 (3.4–3.5), the eight destinations (4.1–4.8), the Vindicators (5.1–5.3), vehicles, the simulation, the train, the fortress and the system (6.2–6.5), cross-benefits (crowd in 3.1, the map's Birdperson in 1.5, wardrobe bodies: add `evilrick`, `simplerick`, `rickprime`, `rickd3`, `bigmorty`, `slickmorty` to `wardrobe/looks.js`'s `BODIES` in Task 3.3's commit; Portal panic's kinds get `krombopulos` and `zigerion` in Task 1.2).
- Names used across tasks: `destArea`, `DESTINATIONS`, `DIAL`, `portalTarget`, `linkTarget`, `validArrive`, `GARAGE_BACK`, `ensureArea`, `hasArea`, `LAZY`, `build<Id>(kit)`, `newRickall`/`tell`/`shoot`/`stepRickall`, `MORTYTOWN`/`HIDES`/`COP`, `newHunt`/`stepHunt`, `newRemover`/`hitRemover`/`stepRemover`/`removedUntil`, `newTrial`/`pick`/`retry`.
- Sourcing (the user's rule, added after the first draft): Task 0.0 builds the scout; every model task (1.1, 2.1, 3.1, 4.1–4.8, 5.1, 6.1) scouts before its first concept and uses its Meshy prompts only for what no candidate passes; a Meshy community model is used only if the user downloads it by hand.
- Credits (ceilings, every asset generated): Phase 1 546, 2 900, 3 623, 4 1,315, 5 342, 6 474 = 4,200; with 20% ≈ 5,045 (≈ $101 at the Pro rate, ≈ $63 at Ultra's).
