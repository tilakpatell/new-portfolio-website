# Stack Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A page per library, engine and framework under `docs/stack/`, a decision record under `docs/decisions/` whose first entry is “three.js over Babylon.js”, a map at `docs/README.md`, and two numbers in the measure (`stack-pages`, `glsl-sites`) that keep the pages complete and the WebGPU port counted.

**Architecture:** Documentation with a measure behind it. `scripts/stack-census.mjs` (pure over the health context’s file list) counts which files import which package and writes the index table; `scripts/health/stack-pages.mjs` fails CI when a package has no row in that index; `scripts/health/glsl-sites.mjs` counts the GLSL sites a WebGPU port removes; `docs/stack/stack.test.js` fails when a page names a file that no longer exists. Nothing under `src/` changes.

**Tech Stack:** Node 20+ (`node:fs/promises`), Vitest 5, the health runner (`scripts/health.mjs`, `scripts/health/context.mjs`), Markdown.

**Spec:** `docs/superpowers/specs/2026-10-08-render-stack-and-stack-docs-design.md`

## Global Constraints

- Nothing under `src/` changes. Nothing the WebGPU lane owns changes: `src/runtime/*`, `scripts/gpu-parity*`, `scripts/perf-probe.mjs`, `docs/superpowers/HANDOFF-webgpu-acceleration.md`, `src/runtime/shading.test.js`.
- `docs/architecture.md`: one sentence added at the top, nothing moved out. `README.md`: one line added under “Tech stack”. `docs/PICKUP-PROMPT.md`: one line added to “What you have”. `docs/health/RULES.md`: one rule added.
- A page records no number that `package.json` or the census does not give. Every path a page names in backticks under `src/` or `scripts/` exists (the test checks).
- Each stack page has the template’s seven `##` headings, in order, and stays under 150 lines; `three.md` and `webgpu-tsl.md` may run to 200.
- A decision entry stays under 80 lines, with the four headings **Context**, **Decision**, **Consequences**, **Revisit when**.
- `CLAUDE.md` at the root is under 25 lines and restates no rule.
- British spelling, curly quotes, plain sentences; comments say why, in the repo’s voice (read `scripts/health/big-files.mjs` and `todo-notes.mjs` first). No model identifiers in commit messages, code or docs. Commits end with the attribution lines the harness gives.
- Before each pull request: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, all green. Merge with a merge commit (`merge_method: merge`), never a rebase or a force-push. Don’t edit files an open pull request changes (`git fetch --all --prune`, then look at the open PRs’ file lists first).
- The exempt list for `glsl-sites` is exactly the WebGPU design’s: `src/lib/three/frameGuard.js`, `src/lib/three/renderer.js`, `src/lib/three/gpuWork.js`, and everything under `src/runtime/`.

## Review Focus

1. **A new dependency with no page.** `npm install foo` and a commit must turn `node scripts/health.mjs --check` red naming `foo`. Task 3’s fixture test, and a by-hand check in Task 3 Step 6.
2. **A page that names a moved file.** Renaming `src/lib/three/house.js` must fail `docs/stack/stack.test.js` with the page and the path. Task 5’s test on a temp page.
3. **A GLSL site in a comment or a test.** `// a ShaderMaterial would be wrong here` and `foo.test.js` must not count. Task 4’s fixture.
4. **A subpath import.** `three/examples/jsm/postprocessing/EffectComposer.js` and `@gltf-transform/core` must count toward `three` and `@gltf-transform/core`, once per file. Task 2’s fixture.
5. **The index block rewritten by hand.** `--check` must say stale and exit 1 when a row was edited; `--write` must leave everything outside the markers byte-for-byte. Task 2’s test.

---

## Pull request 1: the map, the measure, the deep pages, the decision

Branch `claude/stack-docs-p1` from `origin/claude/tender-hopper-y738gr` (it carries the spec and this plan), then `git merge origin/main`.

### Task 1: The map and the template

**Files:**
- Create: `docs/README.md`, `docs/stack/_template.md`, `docs/decisions/README.md`, `CLAUDE.md`
- Modify: `docs/PICKUP-PROMPT.md` (the “What you have” list: one line, `- the map of the docs: docs/README.md`), `docs/architecture.md` (line 3, after the first paragraph: one sentence pointing at `docs/stack/` for the libraries and `docs/decisions/` for the whys), `README.md` (“Tech stack”: one bullet, `- Every library, with how the site uses it: [docs/stack/](docs/stack/)`)

**Interfaces:**
- Produces: `docs/stack/_template.md`, the headings every page must carry, in this order: `## What it is, and why it is here`, `## Where it is used`, `## How the site uses it`, `## What the site does not use, and why`, `## Rules`, `## Upgrading`, `## Gotchas`; and the first line of a page after its `# <name>` title: `**Version** … · **Page owner** … · **Decision** …`.

- [ ] **Step 1:** Write `docs/README.md`: a table, one row per folder under `docs/` (`architecture.md`, `stack/`, `decisions/`, `health/`, `superpowers/specs`, `superpowers/plans`, `superpowers/HANDOFF-*.md`, `research/`, `autopilot/`, `assets/`, `gen3d/`, `readme/` (“pictures for the README, nothing to read”), `PICKUP-PROMPT.md`), what it holds and when to open it; then “Where to start” as five one-line questions with their answers (a library → `stack/`; why → `decisions/`; a feature → its spec, plan, handoff; what may import what → `health/RULES.md`; the pieces → `architecture.md`). Under 60 lines.
- [ ] **Step 2:** Write `docs/stack/_template.md` from the spec’s block, with a one-line note under each heading saying what goes there and what does not (“Where it is used: the entry points the census shows, not every file”).
- [ ] **Step 3:** Write `docs/decisions/README.md`: the file name shape, the four headings, under 80 lines, never edited after a week (a change of mind is a new entry linking the old), and a table of entries that Task 6 fills.
- [ ] **Step 4:** Write `CLAUDE.md` (root): what the site is in one line; “Start at `docs/README.md`”; the rules are `docs/health/RULES.md` and the autopilot skill’s standing rules (named, not copied); the four commands that check a change (`npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`); “every library has a page under `docs/stack/`; a new one gets a page before it is imported”. Under 25 lines.
- [ ] **Step 5:** The three one-line edits (PICKUP-PROMPT, architecture, README). `git diff --stat` shows three files with one line each added.
- [ ] **Step 6:** Commit: `git commit -m "The docs have a map, and a page shape for every library"`.

### Task 2: The census

**Files:**
- Create: `scripts/stack-census.mjs`, `scripts/stack-census.test.mjs`, `docs/stack/README.md` (the index, with the block)
- Create (fixture): `scripts/health/fixtures/tree/package.json`, `scripts/health/fixtures/tree/src/world/deps.js`, `scripts/health/fixtures/tree/docs/stack/README.md`

**Interfaces:**
- Produces, from `scripts/stack-census.mjs`:
  - `packageOf(specifier) → string | null`: `'three/examples/jsm/x.js'` → `'three'`; `'@gltf-transform/core'` → `'@gltf-transform/core'`; `'./x'`, `'/x'`, `'node:fs'`, `'virtual:…'` → `null`.
  - `census(ctx) → Map<string, { files: number, where: string[] }>`: per package, the number of files (under `src/` and `scripts/`, tests left out) importing it by any form (`import … from`, `export … from`, bare `import '…'`, `import('…')`), each file once; `where` is the five most-importing folders (`src/lib/three`, `scripts`, …) by count.
  - `table(census, pkg, pages) → string`: the Markdown rows `| package | version | page | files |`, sorted by files then name, `version` from `pkg.dependencies ?? pkg.devDependencies`, `page` from `pages` (a map package → page file, exported as `PAGES` from the same file, the spec’s grouping) or `—`.
  - `splice(markdown, block) → string`: the text between `<!-- census:start -->` and `<!-- census:end -->` replaced, the rest untouched; throws when a marker is missing.
  - CLI: `node scripts/stack-census.mjs` prints the table; `--write` splices it into `docs/stack/README.md`; `--check` exits 1 with “stale” when the file’s block differs from the fresh table.

- [ ] **Step 1: Fixture.** `scripts/health/fixtures/tree/package.json` with `dependencies: { three: '1.0.0', '@gltf-transform/core': '2.0.0', lonely: '3.0.0' }`, `devDependencies: { vitest: '4.0.0' }`; `src/world/deps.js` importing `three`, `three/examples/jsm/x.js` (two forms, one file), `@gltf-transform/core` dynamically, `./small`, `node:fs`; a line `export * from 'three/addons/y.js'`. `scripts/tool.mjs` already exists; leave it. `docs/stack/README.md` in the fixture with a block holding a stale row.
- [ ] **Step 2: Write the failing tests** in `scripts/stack-census.test.mjs` (Vitest picks up `scripts/*.test.mjs`; see `scripts/health.test.mjs`): `packageOf` on the five shapes above; `census(ctx)` over `makeContext(TREE)` gives `three` 1 file (not 2), `@gltf-transform/core` 1, no `node:fs`, no `./small`; `table` sorts and shows `—` for `lonely`; `splice` keeps the text outside the markers and throws without them; the check against the fixture index says stale.
- [ ] **Step 3:** Run `npx vitest run scripts/stack-census.test.mjs` → FAIL (module missing).
- [ ] **Step 4: Implement** `scripts/stack-census.mjs`: header comment (why: a page records no number a person counted), `makeContext` from `./health/context.mjs`, `uncomment` from `./health/graph.mjs` before the import regex (a commented import is not an import), the regex for the four forms, `PAGES` as the spec’s table, the CLI under `if (process.argv[1] === fileURLToPath(import.meta.url))`.
- [ ] **Step 5:** Run → PASS. `npm run lint` clean.
- [ ] **Step 6:** Write `docs/stack/README.md`: two sentences (what the folder is, how to add a page), the block with markers, then `node scripts/stack-census.mjs --write`; read the table; the `three` row is the top one (532 files on 2026-10-08: tests are left out, where the spec’s 677 counted them) and `vitest` shows 0 for the same reason. `node scripts/stack-census.mjs --check` exits 0.
- [ ] **Step 7:** Commit: `git commit -m "stack-census: which files import which package, written into the stack index"`.

### Task 3: `stack-pages` in the measure

**Files:**
- Create: `scripts/health/stack-pages.mjs`
- Modify: `scripts/health.mjs` (`METRICS` gains `'stack-pages'` at the end), `scripts/health.test.mjs`, `docs/health/budgets.json` (`"stack-pages": 0`), `docs/health/RULES.md` (a section “A dependency has a page”, three sentences, after “Tests go beside the file”)

**Interfaces:**
- Produces: `stackPages(ctx) → metric` with `id: 'stack-pages'`, `unit: 'packages'`, `value` the number of packages in `package.json` (both sections) with no row `| \`<name>\` |` in `docs/stack/README.md`’s block, `detail: [{ file: 'docs/stack/README.md', n: 1, note: '<name>' }]` per missing package (one row each; `n` 1 so the shared sort holds).

- [ ] **Step 1: Write the failing test** in `scripts/health.test.mjs`: on the fixture tree, after Task 2’s fixture index is given rows for `three` and `vitest` but not `@gltf-transform/core` or `lonely`, `value` is 2 and the detail names both.
- [ ] **Step 2:** Run `npx vitest run scripts/health.test.mjs` → FAIL.
- [ ] **Step 3: Implement.** Read `package.json` and `docs/stack/README.md` from `ctx.root` (`readFile`, not `ctx.read`: neither is in `ctx.src`); a missing index counts every package. Header comment says why.
- [ ] **Step 4:** PASS. `node scripts/health.mjs --only stack-pages` on the repo → 0 (Task 2 wrote every row). Add the budget and the rule.
- [ ] **Step 5:** `node scripts/health.mjs --check --skip build` → green.
- [ ] **Step 6 (Review Focus 1, by hand):** add `"left-pad": "1.3.0"` to `devDependencies` in a scratch edit, run `--check`, see `stack-pages: 1 packages over budget 0` naming it, revert the edit (`git checkout package.json`).
- [ ] **Step 7:** Commit: `git commit -m "stack-pages: a dependency without a page in docs/stack is a red check"`.

### Task 4: `glsl-sites` in the measure

**Files:**
- Create: `scripts/health/glsl-sites.mjs`
- Modify: `scripts/health.mjs` (`METRICS` gains `'glsl-sites'`), `scripts/health.test.mjs`, `scripts/health/fixtures/tree/src/world/glsl.js`, `scripts/health/fixtures/tree/src/world/glsl.test.js`, `scripts/health/fixtures/tree/src/runtime/exempt.js`

**Interfaces:**
- Produces: `glslSites(ctx) → metric`, `id: 'glsl-sites'`, `unit: 'sites'`, `value` the total count of the eight names (`RawShaderMaterial`, `ShaderMaterial`, `onBeforeCompile`, `EffectComposer`, `ShaderPass`, `UnrealBloomPass`, `RenderPass`, `OutputPass`, as whole words) under `src/`, after `uncomment`, tests left out, the exempt list left out; `detail` per file with its count. Exports `NAMES` and `EXEMPT` (the Global Constraints list) so `webgpu-tsl.md` can cite them.

- [ ] **Step 1: Fixture.** `glsl.js`: `new ShaderMaterial()`, `m.onBeforeCompile = f`, and a comment `// an EffectComposer here would count`; `glsl.test.js`: `new ShaderMaterial()`; `src/runtime/exempt.js`: `new ShaderMaterial()`.
- [ ] **Step 2: Write the failing test**: `value` 2, `detail` `[{ file: 'src/world/glsl.js', n: 2 }]`.
- [ ] **Step 3:** FAIL; implement (the regex `\b(RawShaderMaterial|…)\b` over `uncomment(text)`; `RawShaderMaterial` and `ShaderMaterial` both match `RawShaderMaterial` only once: match the alternation, don’t count twice); PASS.
- [ ] **Step 4:** `node scripts/health.mjs --only glsl-sites` on the repo: expect fewer than the spec’s 711, which counted before exemptions and uncommenting (616 on 2026-10-08). Leave it unbudgeted: `scripts/health/ratchet.mjs` says a new metric lands measured first and budgeted a merge later, so the open pull requests that add a world’s shaders aren’t turned red by a number they never saw; the steward’s next `--ratchet` budgets it. Check `hud-kit`’s test still passes (the fixture tree gained files under `src/runtime/`, which `hud-kit` ignores, and `big-files`, `todo-notes`, `lint-disables` counts are unchanged: the new fixture files have none of what they count).
- [ ] **Step 5:** `node scripts/health.mjs --check --skip build` green. Commit: `git commit -m "glsl-sites: the GLSL a WebGPU port removes, counted and ratcheted"`.

### Task 5: The pages’ own test

**Files:**
- Create: `docs/stack/stack.test.js`

**Interfaces:**
- Produces: a Vitest suite that, for every `docs/stack/*.md` except `README.md` and `_template.md`: the seven headings from `_template.md` appear in order; the first line after the title starts with `**Version**`; every backticked path starting `src/` or `scripts/` (a path: contains a `/` and ends in `.js`, `.jsx`, `.mjs`, `.css`, `.json`, `.md`, or is a folder ending `/`) exists at the repo root; and the index names every `package.json` package (the same check as `stack-pages`, so the suite is red where CI is). Exports `pathsIn(markdown) → string[]` and `headingsOk(markdown, template) → { ok, missing }` for a test on a temp page.

- [ ] **Step 1: Write the test** with a temp page (`fs.mkdtempSync`) that names `src/lib/three/nowhere.js` and expects the failure to name the page and the path; a page with the headings out of order fails naming the first missing one.
- [ ] **Step 2:** Run `npx vitest run docs/stack` → FAIL (no helpers). Implement the helpers in the test file itself (a docs test has no module to import from). PASS, with `_template.md` passing its own headings check and the index check green.
- [ ] **Step 3:** Confirm `vite.config.js`’s `test.exclude` does not exclude `docs/**` (it does not today). Commit: `git commit -m "The stack pages are tested: the shape, and every path they name"`.

### Task 6: The decision record’s first entry

**Files:**
- Create: `docs/decisions/2026-10-08-three-over-babylon.md`
- Modify: `docs/decisions/README.md` (the table: one row)

- [ ] **Step 1:** Write the entry from the spec’s Part 1: **Context** (the question, the measured table, the “Babylon has / the site has” table), **Decision** (three.js stays; WebGPU through `three/webgpu` and TSL per the WebGPU design, linked), **Consequences** (no second engine; the port is per world; `glsl-sites` is the progress bar), **Revisit when** (the two conditions). Under 80 lines. The numbers are the spec’s, dated.
- [ ] **Step 2:** `docs/stack/stack.test.js` does not cover `docs/decisions/`; check by hand that every path in the entry exists (`grep -o '`[^`]*`' … | …`).
- [ ] **Step 3:** Commit: `git commit -m "The first decision on record: three.js over Babylon.js, with the numbers"`.

### Task 7: `three.md`

**Files:**
- Create: `docs/stack/three.md`
- Read first: `src/lib/three/renderer.js`, `textures.js`, `gltf.js`, `frameGuard.js`, `gpuWork.js`, `house.js`, `pace.js`, `useScene.js` headers (the first comment block of each); `docs/architecture.md`’s “Graphics” section; `docs/health/RULES.md`’s layers.

- [ ] **Step 1:** Write the page on the template, under 200 lines. **Version** `three@0.186.1` (read `package.json`); **Page owner** `src/lib/three/`; **Decision** the entry from Task 6. *Where it is used*: the census rows (`three`: its files and the five folders) and the entry points: `src/lib/three/renderer.js` (every page scene), `src/runtime/webgl.js` (every world), `src/lib/three/useScene.js`. *How the site uses it*: the shared pieces and what each is for, one line each with its path (renderer and `fitRatio`, `precompile`, the frame guard, the GPU work queue, `textures.js`’s `sharpen` and `loadTexture`, `gltf.js` with meshopt and KTX2, the house look, `pace`, `budgets`, `device` tiers); the import rule (`three/examples/jsm/*` only, never `three/addons` for the classic renderer: the census shows 185 files on `examples/jsm`, 2 on `addons`; say which the site standardises on and why, from the files). *What the site does not use*: `OrbitControls` for play (own controls), `Clock` (the loop’s `dt`), the built-in `WebGPURenderer` from `three` (it is `three/webgpu`’s, on `webgpu-tsl.md`), physics add-ons (Rapier). *Rules*: the layer (`src/lib/three` knows no world), every scene starts from the tier and lowers under pace and disposes on leave (from the autopilot’s standing rules, cited), textures through `sharpen`, models through `gltf.js`, a `'glsl'` world keeps GLSL. *Upgrading*: `npm install three@<v>`; then `npm test`, `npm run build`, `node scripts/autopilot-check.mjs --only smoke`, `node scripts/health.mjs --check --skip build`; the files to re-read on a major (the frame guard wraps `renderBufferDirect`, the GPU work queue reads the renderer’s `properties`); “last upgrade: not recorded; record the next one here”. *Gotchas*: three or four, each from a file header (the drawing-buffer side limit in `renderer.js`’s `fitRatio`; a synchronous shader question waits on the chip, from `gpuWork.js`; `colorSpace` on a data texture, from `textures.js`).
- [ ] **Step 2:** `npx vitest run docs/stack` → PASS (every path exists). Commit: `git commit -m "docs/stack/three.md: what the site is built on, and how it holds it"`.

### Task 8: `webgpu-tsl.md`

**Files:**
- Create: `docs/stack/webgpu-tsl.md`
- Read first: `src/runtime/backend.js`, `webgpu.js`, `gfx.js`, `module.js`, `shading.test.js`, `fixtures/nodesWorld.js`; `docs/superpowers/specs/2026-10-08-webgpu-acceleration-design.md` and its plan; `git fetch --all --prune` and the open pull requests, to see whether the lane’s first pull request has landed (then the page describes three kinds; if not, two, and names the design for the third).

- [ ] **Step 1:** Write the page, under 200 lines. **Version** `three@0.186.1` (`three/webgpu`, `three/tsl`, `three/addons/tsl/display/BloomNode.js`); **Page owner** `src/runtime/`; **Decision** Task 6’s entry. *What it is*: the node renderer and its shading language, why the site wants it (draw submission, `BundleGroup`), and what it refuses (`ShaderMaterial`, `onBeforeCompile`, `EffectComposer`). *Where it is used*: `src/runtime/webgpu.js` only, and the fixture. *How the site uses it*: `pickBackend` as it is on `main` today; the module’s `shading` promise; `rt.gfx.post(passes)` as data on both backends; the port recipe from the design (a `nodes.js` of factories returning `{ material, u }` under the GLSL uniform names, the parity thresholds PSNR ≥ 32 dB and under 2 % of pixels off by more than 16/255, the perf probe per backend), each sentence saying whether it is on `main` or in the design. *What the site does not use*: WebGPU compute for land and chunks (the design’s reason), `three/addons` for the classic path. *Rules*: every module is `'glsl'` until its closure is clean (`shading.test.js` today; the closure guard when it lands); `readOverride` takes only `webgl` and `webgpu`; a port changes a world’s materials and nothing it does. *Upgrading*: with `three`; what to re-check (`buildPostProcessing`’s imports, `renderer.backend.device`). *Gotchas*: colour space on a port (the design’s Review Focus 4), a sun that moves with the clock (Focus 5). End with “The number”: `glsl-sites` from the measure, today’s value, and the design’s per-world table, labelled as the design’s count on its date.
- [ ] **Step 2:** `npx vitest run docs/stack` PASS. Commit: `git commit -m "docs/stack/webgpu-tsl.md: the node renderer, the nodes promise, and how a world is ported"`.

### Task 9: Ship pull request 1

- [ ] **Step 1:** `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build && node scripts/stack-census.mjs --check`.
- [ ] **Step 2:** Push `claude/stack-docs-p1`; open the pull request (title “The stack has pages: a map of the docs, a page per library, the first decision on record, and two numbers that keep them true”; body: what each file is for, the health table from `node scripts/health.mjs`, the census’s top ten rows, and the one line each of `README.md`, `architecture.md` and `PICKUP-PROMPT.md` that changed). Wait for the `CI` check; merge with a merge commit; `git fetch origin main`.

---

## Pull request 2: the seven shorter pages

Branch `claude/stack-docs-p2` from `main` after pull request 1 merges.

### Task 10: The pages

**Files:**
- Create: `docs/stack/physics-rapier.md`, `react.md`, `multiplayer-nostr.md`, `fonts.md`, `build.md`, `testing.md`, `assets-pipeline.md`
- Read first, per page: `src/lib/physics/world.js` (Rapier is imported dynamically there and nowhere else; `docs/superpowers/specs/2026-10-08-natural-worlds-design.md` has why); `src/App.jsx`, `src/main.jsx`, `src/pages/` (React and the hash router: `README.md`’s “Tech stack” says why hash routes); `src/components/universe/online/client.js` and `nostr.js` (`@noble/secp256k1`; `fflate` is the asset scripts’, not the multiplayer’s: the census shows `scripts/mc-atlas.mjs` and its kin); `src/index.css` and `src/theme/` (fonts); `vite.config.js`, `tailwind.config.js`, `eslint.config.js`, `.github/workflows/ci.yml` and `deploy.yml` (build); `vite.config.js`’s `test`, `vitest.ai.config.js`, `vitest.render.config.js`, `scripts/ai-e2e/`, `scripts/autopilot-check.mjs` (testing); `scripts/ktx2.mjs`, `scripts/hq-assets.mjs`, `scripts/build-globe.mjs`, `scripts/photos.mjs`, `scripts/gen3d/` (assets).

- [ ] **Step 1:** One page at a time, each under 150 lines, committed on its own (`docs/stack/<page>.md: …`). *Where it is used* is the census’s rows for the page’s packages. *Rules* cite the file that enforces each (a test, the health measure, the lint config). *Upgrading* names the command and the checks. A section with nothing true to say holds one sentence saying so (“Nothing is refused; the site uses the library as published.”), never a guess.
- [ ] **Step 2:** After each: `npx vitest run docs/stack` PASS; `node scripts/health.mjs --only stack-pages` stays 0 (the index did not change; the pages fill rows that already exist).
- [ ] **Step 3:** Ship as Task 9 (title “The stack’s other seven pages”). Merge when CI is green.

---

## After (not this lane)

- The steward moves `docs/architecture.md`’s three.js paragraphs onto `three.md` one at a time, a link left behind each, as a health repair (`docs/health/backlog.md` gets the line).
- A later decision entry when a session next touches a library choice (Rapier, Nostr); none is written retroactively here.
- When the WebGPU lane’s first pull request merges, `webgpu-tsl.md`’s “on `main` today” sentences are updated by that lane, in the same pull request as the code, since the page’s test fails on any path it renames.

## Self-review (done when this plan was written)

Spec coverage: the map and `CLAUDE.md` (Task 1), the index and census (Task 2), `stack-pages` (Task 3), `glsl-sites` (Task 4), the pages’ test (Task 5), the decision (Task 6), the two deep pages (Tasks 7–8), the seven short ones (Task 10). Names used across tasks: `packageOf`, `census`, `table`, `splice`, `PAGES`, `<!-- census:start -->`/`<!-- census:end -->`, `NAMES`, `EXEMPT`, the seven headings, the `**Version** · **Page owner** · **Decision**` line. Review Focus items each name their task.
