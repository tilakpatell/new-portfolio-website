# Battlefront 2017 pipeline, lane S: streaming, both ways. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The pipeline pulls from the private bucket without ever leaving a half file or failing on a transient error, and the site loads its game-derived files from a public bucket through a device-aware pool that never hangs, shows a figure's small cut first, stops downloading the moment a world is left, and works offline for an installed world.

**Architecture:** Four small, pure, tested modules carry the behaviour: `scripts/lib/pool.mjs` (a concurrency pool with retry, backoff and timeout, shared by the fetch script and the publish script), `src/lib/net/assetUrl.js` (a site path to its hashed bucket URL, with the same-origin fallback), `src/lib/net/assetFetch.js` (the browser pool: priority, per-world abort, retries, progress, the fallback ladder) and `src/lib/net/progressive.js` (which cut to fetch first and when to swap). `scripts/assets-publish.mjs` writes the manifest `src/data/galaxyAssets.json` and uploads by content hash; `lib/three/gltf.js` and `textures.js` route their fetches through the pool; `public/sw.js` admits the asset origin. Everything degrades to today's behaviour when `VITE_ASSET_BASE` is unset.

**Tech Stack:** Node 22 `fetch`; `@supabase/supabase-js` is **not** used for storage (plain `fetch` to `storage/v1`, so the client bundle gains nothing); Vitest with fake `fetch`; Playwright (`scripts/stream-check.mjs`) with CDP network throttling.

**Spec:** `docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md`, section 10. Phase 0's fetch (`docs/superpowers/plans/2026-10-10-bf2017-phase0-tools.md`, task 3) is the starting point for task 2.


> **Read first (added 2026-10-10, 04:30):** PR #798, "Lane I: the heavy assets mirrored on Supabase Storage by content hash", merged into main at 02:02 from another account's session. It already provides: the public bucket `assets`, paths `<hash12>/<path>`, `scripts/assets-upload.mjs` (REMOTE folders, a 64 KB threshold, `freshManifest`, refuses CI, the service key from the shell), `scripts/assets-manifest.mjs` (the Vite plugin), `src/data/assets-manifest.json`, `src/lib/assetBase.js` (`assetUrl`, `withFallback`, `markDown`), `src/lib/assetPath.js` (`remotePath`), `public/sw.js` admitting the bucket's origin, `src/runtime/install.js` cross-origin with fallback, `gltf.js` fetching through `withFallback`, `VITE_ASSET_BASE` in `.env.example` and the workflows, and the decision entry `docs/decisions/2026-10-09-heavy-assets-mirrored-on-supabase-storage.md`. **This lane builds on it and makes no second mechanism**: task 3 extends lane I's REMOTE list and manifest with a remote-only mode (an entry whose file is not in `public/`, since the game-derived files are not committed); task 4's pool runs under `withFallback` and resolves through `assetUrl`; task 5 only verifies; the bucket is `assets`, not `site-assets`; the decision entry gets a dated paragraph, not a sibling. Where the text below says otherwise, lane I's names win.

## Global Constraints

- No key in the client. The public bucket `site-assets` is read with no header at all; the private bucket's key stays in `.env.local` or the cloud session's environment and is used by scripts only. `VITE_ASSET_BASE` (the public bucket's base, `https://<ref>.supabase.co/storage/v1/object/public/site-assets`) is the only new client variable, in `.env.example` and the deploy workflow's `env`, optional: unset means same-origin, exactly today's behaviour, and CI builds without it.
- A published file is named by content hash: `<dir>/<stem>.<first 8 hex of sha256>.<ext>`, uploaded once with `Cache-Control: public, max-age=31536000, immutable`; a hash already in the bucket is never re-uploaded. Only files the pipeline made from the game are published (the manifest's `from` names a manifest path); Meshy, Sketchfab and Quaternius files stay committed.
- The manifest `src/data/galaxyAssets.json` is the one source of truth for what is in the bucket: `{ "<site path>": { "hash": "<8 hex>", "bytes": n, "from": "<game manifest name>", "tier": "crew" | "surface" | "pack" | "ultra" } }`, keys sorted, written only by the publish script.
- Pool sizes by `lib/device` tier: `low` or `saveData` 2, `mid` 3, `high` 6, `ultra` 8. Timeouts: scripts 30 s + 1 s/MB; browser 20 s + 1 s/MB. Retries: three, with waits of 1, 2, 4 s (scripts) and 0.5, 1, 2 s (browser); `Retry-After` honoured when present; a 404 is final (missing), never retried.
- Numbers the stream check holds on a phone profile at 3G (1.6 Mbit/s down, 150 ms): first figure drawn within 8 s of the world's scene mounting; the world walkable (the HUD's gate lifts) under 4 MB fetched; zero console errors; no URL fetched more than three times.
- Files under 800 lines, pure logic tested beside it, no network in tests; the gates: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## Review Focus

1. A fetch that returns 200 with a short body (a proxy cut it, or the CDN served a truncated object): the pool must compare `content-length` (or the manifest's bytes) to what arrived and treat a mismatch as a failure to retry, not a success (task 1 and task 4 tests feed a short body).
2. A world left mid-load: every request the world started must be aborted, and a response arriving after the abort must not touch the disposed scene (task 4's test: resolve a fetch after `abort()` and assert nothing is added).
3. The manifest and the bucket out of step (a publish that uploaded but crashed before writing the manifest, or the reverse): `assets-check.mjs` catches it before deploy; the site's fallback ladder catches it at run time (a 404 on the hashed URL falls to the same-origin path, then to the small cut). Task 3's publish writes the manifest last and task 6 checks.
4. The service worker and the other origin: an installed world whose pack lists bucket URLs must be served from the cache offline, and a bucket URL not in any installed pack must pass straight to the network (task 5's tests on the pure matcher).
5. `saveData` or a 2G connection: the pool shrinks to two and only the small cuts are fetched until the visitor asks for more (`WorldGate` already asks before 3 MB); the progressive swap to the plain cut does not happen on such a connection (task 4's `progressive.js` test with `lowData: true`).

---

### Task 1: The pool (shared by the scripts)

**Files:**
- Create: `scripts/lib/pool.mjs`, `scripts/lib/pool.test.mjs`

**Interfaces:**
- Produces: `createPool({ size = 6, retries = 3, waits = [1000, 2000, 4000], timeout = (bytes) => 30000 + 1000 * (bytes / 1e6), fetch = globalThis.fetch, sleep = setTimeout-based, now = Date.now }) → { run(job) → Promise<result>, stats() → { done, failed, retried, bytes, seconds } }` where a `job` is `{ url, headers, bytes?: number, to: string }` and `run` fetches with a timeout, retries on a thrown error, a 429, a 5xx or a body shorter than `bytes` (or than `content-length`), honours `Retry-After` seconds over the schedule, treats 404 as `{ status: 'missing' }` at once, writes the body to `to + '.part'` and renames to `to` on success, and resolves `{ status: 'fetched' | 'missing' | 'failed', bytes, tries, error? }`, never throwing. `backoff(try, waits, retryAfter) → ms` and `shortBody(got, want) → boolean` exported pure.

- [ ] **Step 1: Failing tests** with a fake `fetch` and a fake `sleep` that records waits: three failures then success → `fetched`, `tries 4`, waits `[1000, 2000, 4000]`; a 429 with `Retry-After: 7` → the wait is `7000`; a 404 → `missing` after one try, no wait; a 200 whose body is 10 bytes against `bytes: 100` → retried, then `failed` after the schedule; a timeout (the fake `fetch` never resolves; the fake clock advances) → retried; only `size` jobs in flight at once (count the fake fetch's concurrent calls); `to + '.part'` exists during the write and only `to` after; `stats()` adds up.
- [ ] **Step 2: Run** `npx vitest run scripts/lib/pool.test.mjs` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `A fetch pool for the scripts: concurrency, retries with backoff, timeouts, no half files`.

### Task 2: The bucket fetch, robust

**Files:**
- Modify: `scripts/bf2017-fetch.mjs` (phase 0's; uses the pool), `scripts/lib/bf2017-paths.mjs` (an index: `readIndex`, `writeIndex`, `isCurrent(index, path, bytes)`), tests beside

**Interfaces:**
- Produces: `bf2017-fetch.mjs … --all '<glob over manifest names>' [--verify] [--pool 6]` fetching every model (all LODs, textures, collision) whose name matches, through the pool, printing one line per file as today and one summary line `fetched N · kept N · missing N · failed N · <MB> MB · <s> s`, exit 1 only when `failed > 0`. The index `lab/assets/bf2017/.index.json` records `{ [bucketPath]: { bytes, at } }`; a path whose bytes match the manifest's (or the GLB's `images` reference) is `kept` without a request; `--verify` ignores the index and `stat`s every file.

- [ ] **Step 1: Failing tests** for the index functions (write, read back, `isCurrent` true on matching bytes and false on a mismatch or a missing file) and for the glob-to-jobs expansion (`jobsFor(manifest, glob) → job[]` includes LODs, collision, and the texture candidates in PNG-then-KTX2 order).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**, wiring the pool in place of the single-file loop; the single-name form stays. **Step 4: Run** → PASS.
- [ ] **Step 5: Try it** (keys in the environment): `node scripts/bf2017-fetch.mjs --all 'characters/hero/luke/*'` twice; the second run is all `kept` in under 5 s. Put both summary lines in the PR.
- [ ] **Step 6: Commit** `The bucket fetch takes a whole set at once, resumes, and never leaves a half file`.

### Task 3: Publish to the public bucket, and the manifest

**Files:**
- Create: `scripts/assets-publish.mjs`, `scripts/lib/asset-manifest.mjs`, `scripts/lib/asset-manifest.test.mjs`, `src/data/galaxyAssets.json` (`{}` at first), `scripts/assets-ignore.mjs`
- Modify: `.gitignore` (a marked block the ignore script rewrites), `.env.example` (`VITE_ASSET_BASE=`), `.github/workflows/deploy.yml` (`VITE_ASSET_BASE: ${{ vars.ASSET_BASE }}`, a repository variable, not a secret), `supabase/README.md` (the `site-assets` bucket: public, no RLS needed on storage, how it was made), `src/components/galaxy/surface/catalog/catalog.test.js` (`bytesOf(kind)` reads the file when present else the manifest), `docs/decisions/2026-10-10-battlefront-2017-assets.md` (the exception and its reason, section 10's words)

**Interfaces:**
- Produces: `asset-manifest.mjs`: `hashOf(buffer) → 8 hex`, `publishedPath(sitePath, hash) → '<dir>/<stem>.<hash>.<ext>'`, `readManifest(file)`, `writeManifest(file, entries)` (sorted keys), `diff(manifest, files: { path, hash, bytes }[]) → { add, change, same, gone }`. The CLI `node scripts/assets-publish.mjs [--dry] [--only '<glob>'] [--bucket site-assets]`: finds the game-derived files (every `public/models/galaxy/{crew,surface,bf2017}/*` whose catalogue or crew row says `made: 'bf2017'` or `rig: 'walrus' | 'own'`, and every `.far`, `.ultra` and pack beside them), hashes each, uploads the new and changed ones through the pool to `<bucket>/<publishedPath>` with `x-upsert: true`, `cache-control: 31536000` and the content type (`model/gltf-binary`, `image/webp`, `image/ktx2`), then writes the manifest last, then runs `assets-ignore.mjs`. Reads `SUPABASE_URL` and `SUPA_KEY` (or `BF2017_KEY`) for the upload only.
- `assets-ignore.mjs` rewrites the block between `# galaxy assets (published; scripts/assets-publish.mjs)` and `# end galaxy assets` in `.gitignore` with one line per manifest path.
- `catalog.test.js`'s size checks use `bytesOf(kind)`: `statSync` when the file exists, else `galaxyAssets[path].bytes`, else fail naming the path.

- [ ] **Step 1: Failing tests** for `asset-manifest.mjs`: `hashOf` of a known buffer; `publishedPath('/models/galaxy/crew/luke.glb', 'abcdef12')` → `'models/galaxy/crew/luke.abcdef12.glb'`; `diff` on a manifest with `a` (hash 1) and files `a` (hash 2), `b` → `change: [a], add: [b], gone: []`; `writeManifest` sorts keys; the `.gitignore` block rewrite keeps everything outside the markers byte for byte.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the module and the two scripts (a `--dry` run prints the plan and uploads nothing). **Step 4: Run** → PASS; `npm test` green with an empty manifest.
- [ ] **Step 5: Make the bucket** (keys in the environment): `POST /storage/v1/bucket` with `{ "name": "site-assets", "public": true }`; record how in `supabase/README.md`. Publish `--dry` on main's current game-derived files (phase 0 has none; phase 1's heroes when merged), then for real; `curl -sI <base>/<a published path>` shows `200`, the `cache-control` and `content-type`. Put the lines in the PR.
- [ ] **Step 6: Commit** in two: `A manifest of the site's published assets, by content hash, and the publish that writes it` and `The deploy reads the asset base; the public bucket is made`.

### Task 4: The site's loader: a pool, aborts, progress, the ladder, the small cut first

**Files:**
- Create: `src/lib/net/assetUrl.js`, `assetUrl.test.js`, `src/lib/net/assetFetch.js`, `assetFetch.test.js`, `src/lib/net/progressive.js`, `progressive.test.js`
- Modify: `src/lib/three/gltf.js:130` (`fetchGltf` through `assetFetch`), `src/lib/three/textures.js` (its fetches likewise), `src/components/galaxy/surface/scene.js` (one `AbortController` per world, passed to the loads, aborted in dispose; the HUD's loading line from `progress()`), `src/components/galaxy/surface/actors.js:268` (the small cut first through `progressive.js`), `src/lib/detail.js` or `device.js` (`poolSize(tier, lowData)`)

**Interfaces:**
- Produces:
  - `assetUrl(path, { base = import.meta.env.VITE_ASSET_BASE ?? '', manifest = galaxyAssets } = {}) → string`: `${base}/${publishedPath(path, manifest[path].hash)}` when `base` and the entry exist, else `path`.
  - `createAssetFetch({ fetch, size, retries = 3, waits = [500, 1000, 2000], timeout, now, sleep }) → { fetch(url, { priority = 0, signal, bytes } = {}) → Promise<ArrayBuffer>, progress() → { bytes, total, inFlight }, abortAll() }`: a priority queue (higher first, then first in), one in-flight per URL (callers share the promise), retries as the Global Constraints say, a short body a failure, a 404 final, `signal` aborting the queued or in-flight request (rejecting with `AbortError`), and `progress` summing bytes received against the `bytes` callers declared. `poolSize(tier, lowData) → 2 | 3 | 6 | 8`.
  - `progressive.js`: `firstCut(distance, level, { hasLod, hasFar, lowData }) → 'far' | 'lod1' | 'plain'` and `wantsUpgrade(distance, level, { lowData }) → boolean` (true within `near` on a normal connection only), used by `actors.js` to fetch the small cut, draw it, then fetch the plain and swap when `wantsUpgrade` holds at that moment.
  - The ladder in `actors.js`'s `modelFigure`: plain fails → `.lod1` → the kind's previous resolver (`crew` on Meshy, then `built`) → `null` with one `warnOnce`.

- [ ] **Step 1: Failing tests**: `assetUrl('/models/galaxy/crew/luke.glb', { base: 'https://b', manifest: { '/models/galaxy/crew/luke.glb': { hash: 'abcdef12' } } })` → `'https://b/models/galaxy/crew/luke.abcdef12.glb'`; with no base → the path; with a base but no entry → the path. `createAssetFetch` with a fake fetch: `size 2` holds the third request until one resolves; priority 5 goes before priority 0 queued earlier; two calls for one URL make one fetch; a short body retries then rejects; abort before start rejects with `AbortError` and never fetches; abort in flight rejects and a late resolution of the fake is ignored (`progress().inFlight` is 0); `progress()` counts; `poolSize('low', false) === 2`, `poolSize('high', true) === 2`, `poolSize('ultra', false) === 8`. `firstCut(20, lvl, { hasLod: true, hasFar: true, lowData: false })` → `'lod1'`; `firstCut(300, …)` → `'far'`; `wantsUpgrade(20, lvl, { lowData: true })` → `false`; `wantsUpgrade(20, lvl, { lowData: false })` → `true`; `wantsUpgrade(100, lvl, …)` → `false`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the three modules and wire `gltf.js`, `textures.js`, `scene.js` and `actors.js` (the loader's URL cache keys stay the site path, so a world asks for `/models/galaxy/crew/luke.glb` and the pool fetches the hashed URL). **Step 4: Run** → PASS; `npm test` green.
- [ ] **Step 5: See it**: dev server with `VITE_ASSET_BASE` set in `.env.local` after task 3's publish; open Hoth; the network panel shows the bucket's hashed URLs, `lod1` before plain for the figures, and leaving the world cancels the pending ones (status `(canceled)`). Screenshot the panel into the evidence.
- [ ] **Step 6: Commit** `The site fetches its game-derived files from the public bucket through a device-aware pool, small cut first, and stops when a world is left`.

### Task 5: Installed worlds from the bucket, offline

**Files:**
- Modify: `public/sw.js` (the origin rule), `scripts/packs.mjs` (a pack's file URLs go through `assetUrl` at build, and `index.json` carries `origin: <base>`), `src/runtime/install.js` (cross-origin fetches with `mode: 'cors'`, the pack's hashes already there), `scripts/sw-check.mjs`
- Create: `public/sw.matcher.js`? No: the matcher stays inside `sw.js` as a pure function at the top, tested by importing the file's text and evaluating the function in `scripts/sw.test.mjs` the way `sw-check.mjs` does today, or, if that is not how it is tested, a `src/lib/swRules.js` the worker inlines at build.

**Interfaces:**
- Produces: `servedFrom(url, { origin, assetOrigin, installed: Set<string> }) → 'cache' | 'network'`: `cache` when the URL's origin is the page's or `assetOrigin` and its path (without the origin) is in an installed pack's file list; `network` otherwise. The installer fetches bucket URLs with `{ mode: 'cors', cache: 'no-store' }` as it does same-origin ones.

- [ ] **Step 1: Failing tests** for `servedFrom`: a same-origin pack file → `cache`; the same path on `assetOrigin` → `cache`; a bucket URL not in any pack → `network`; a third origin → `network`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** and update `packs.mjs` and `install.js`. **Step 4: Run** → PASS; `node scripts/sw-check.mjs` against `vite preview` green.
- [ ] **Step 5: Commit** `An installed world's bucket files are served offline by the service worker`.

### Task 6: The checks, and the numbers

**Files:**
- Create: `scripts/assets-check.mjs`, `scripts/stream-check.mjs`, `docs/superpowers/evidence/bf2017-streaming/README.md` and the numbers
- Modify: `.github/workflows/deploy.yml` (`node scripts/assets-check.mjs` before the build when `ASSET_BASE` is set), `docs/stack/testing.md` (one line each for the two checks)

- [ ] **Step 1: `assets-check.mjs`**: for every manifest entry, `HEAD <base>/<published path>`: status 200, `content-length === bytes`, `cache-control` containing `max-age=31536000`; through the pool; one line per failure, a summary, exit 1 on any failure. Run it; put the summary in the PR.
- [ ] **Step 2: `stream-check.mjs`**: Playwright, a phone profile (`--phone` the way `anim-check.mjs` does it), CDP `Network.emulateNetworkConditions` at 3G (1.6 Mbit/s, 150 ms), opens `#/galaxy/hoth/surface`, and records: ms to the first figure drawn (the dev hook `window.__surface.debug().people` non-empty), bytes fetched when the gate lifts, the count of requests per URL, console errors. Fails on the Global Constraints' numbers. Run it at `QUALITY=low` and `QUALITY=mid`; put the numbers in the evidence and the PR.
- [ ] **Step 3: Gates**, the regenerated files restored, hand-off section in `docs/superpowers/HANDOFF-bf2017.md` (Done: the lane; Left: pointing the base at R2 if egress bills; Checking it: the two checks and the env variable).
- [ ] **Step 4: Commit, merge `origin/main`, push, PR** titled `The galaxy streams its game-derived files from the public bucket, robustly, on every device`, with the two checks' numbers and the network panel shots. MERGE per the session's slot.
