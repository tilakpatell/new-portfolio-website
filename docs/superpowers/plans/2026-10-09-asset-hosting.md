# Asset Hosting Implementation Plan (lane I)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The heavy assets (the HQ models, the photo scans, the gen3d film-made models, the big textures) are served from a Supabase Storage bucket behind its CDN with immutable cache headers, by content hash, while the site stays static on GitHub Pages and plays unchanged when the bucket is unreachable or unset.

**Architecture:** One resolver, `src/lib/assetBase.js`: `assetUrl(path)` maps a `public/` path to `${VITE_ASSET_BASE}/<hash>/<path>` when the path is in the build-time manifest (`public/assets-manifest.json`, written by `scripts/assets-upload.mjs` after it uploads what changed), else to the local path. Every loader goes through it (`lib/three/gltf.js`, `textures.js`, `hdri.js`, `runtime/assets.js`, the kit's `loadKit`, `landings/models.js`), the packs plugin writes the resolved URLs into each world's pack, and the service worker caches cross-origin responses from the asset base the same as local ones. Nothing about what is drawn changes.

**Tech Stack:** Supabase Storage (public bucket, `cacheControl` on upload, the project's CDN), `@supabase/supabase-js` (upload from the script with a service-role key that lives only in the owner's shell, never in the repo or a workflow), `scripts/packs.mjs`, `public/sw.js`, `src/runtime/install.js`.

**Spec:** `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md` (Pillar 2 and the decision entry); `docs/stack/supabase.md`; `docs/superpowers/specs/2026-10-07-infinite-worlds-design.md` (answer 2: packs and the passive service worker).

## Global Constraints

- Starts from `main` after lane B merges. Touches the loaders named above, `scripts/assets-upload.mjs`, `scripts/packs.mjs`, `public/sw.js`, `src/lib/sw.js`, `src/runtime/install.js`, `.env.example`, `deploy.yml` (`VITE_ASSET_BASE` from a repository variable, not a secret: it is a public URL), `docs/stack/supabase.md`.
- The service-role key is read by the upload script from `SUPABASE_SERVICE_ROLE_KEY` in the owner's shell only; the script refuses to run inside CI (`process.env.CI`), and a test asserts the repo and workflows contain neither the secret key's prefix nor the service role's claim name (`scripts/assets-upload.test.mjs` spells both).
- Paths are content-addressed: `<hash12>/<path>`; `Cache-Control: public, max-age=31536000, immutable` on every upload; a changed file is a new path, never an overwrite; old paths are pruned by the script's `--prune` after a deploy is confirmed, never automatically.
- What goes remote is a list in `scripts/assets-upload.mjs` (`REMOTE = ['public/hq/models', 'public/hq/tex', 'public/cc0/galaxy', 'public/models/gen3d', 'public/kit']` to start); everything under 64 KB stays local whatever the list says; the total remote set and the local remainder are printed and written in the PR.
- Without `VITE_ASSET_BASE`, or when a remote fetch fails, the loader falls back to the local path once and remembers the failure for the visit (`assetBase.js`'s `markDown()`), so a visitor with the bucket blocked sees the site as before; a test covers both.
- CORS: the bucket is public; the script sets nothing else, and `README` says the project's Storage CORS allows `GET` from the site's origin.
- No model names in code, docs, commits. Commits end with the harness's attribution lines.
- Before the PR: lint, tests, build (with and without the env), health, `node scripts/sw-check.mjs` against `vite preview`, smoke on `/galaxy/hoth/surface,/fly/hoth,/avengers`.

## Review Focus

1. **A file changes on disk between two deploys**: the new hash path is uploaded, the manifest points at it, the old path still serves for visitors on the old build until pruned. Task 1 and 3.
2. **The bucket is down or blocked** (a corporate network, an ad blocker): first failure falls back to local, no second remote try that visit, no console flood. Task 2.
3. **The service worker and a cross-origin asset**: the install caches the remote URL under the pack's version; a reload serves it from the cache; `sw-check.mjs` passes. Task 4.
4. **A pack's hash for a remote file**: the pack's `v` changes when the remote hash changes, so an installed world updates. Task 4.
5. **Egress**: the free tier is 1 GB storage and about 5 GB egress a month; `public/` is 767 MB today. The PR says the remote set's size and the plan says Pro is needed before the site's traffic uses it; `WORLD_MB` figures stay the download sizes, wherever they come from. Task 5.

---

### Task 1: The upload script and the manifest

**Files:**
- Create: `scripts/assets-upload.mjs`, `scripts/assets-upload.test.mjs` (a fake storage client), `public/assets-manifest.json` (committed; `{}` until the first upload)

**Interfaces:**
- Produces: `hashOf(buffer) → hash12`; `planUpload(files, manifest) → { upload: [], keep: [], prune: [] }` (pure); the script: `node scripts/assets-upload.mjs [--dry] [--prune]` reads `REMOTE`, hashes, uploads what the bucket lacks with `cacheControl: '31536000'` and `upsert: false`, writes the manifest `{ "<path>": { "hash": "...", "bytes": n } }`, prints totals; refuses under `CI`.

- [ ] Tests: `planUpload` uploads only new hashes and prunes only unreferenced ones; the script refuses under `CI`; the manifest round-trips; neither the secret key's prefix nor the service role's claim name in the repo (a grep test over tracked files and `.github`; the plan says this in words, or it would fail its own test).
- [ ] Write; PASS; **Commit** `An upload script for the heavy assets, by content hash`.

### Task 2: The resolver and the loaders

**Files:**
- Create: `src/lib/assetBase.js`, `assetBase.test.js`; Modify: `src/lib/three/gltf.js`, `textures.js`, `hdri.js`, `src/runtime/assets.js`, `src/lib/three/kit.js`, `src/components/universe/landings/models.js` (each: the URL through `assetUrl` at the one place it fetches)

**Interfaces:**
- Produces: `assetUrl(path, { base = import.meta.env.VITE_ASSET_BASE, manifest } = {}) → string`; `markDown()`, `isDown()`; `withFallback(fetchLike) → (url) => Promise` (remote first, local on failure, once).

- [ ] Tests: a manifest path with a base gives the remote URL; a path not in the manifest, or no base, gives the local; after `markDown()` every path is local; `withFallback` retries local once and marks down.
- [ ] Each loader's test gains one case: a remote URL is asked when the base is set. **Commit** `Every loader asks the asset base first`.

### Task 3: The build

**Files:**
- Modify: `.github/workflows/deploy.yml` (`VITE_ASSET_BASE: ${{ vars.ASSET_BASE }}`), `.env.example`, `docs/stack/supabase.md` (Storage: the bucket, the script, the rules), `supabase/README.md`

- [ ] `npm run build` with and without the variable; the manifest is read at build time by `scripts/packs.mjs` (Task 4). **Commit** `The deploy knows where the heavy assets live`.

### Task 4: Packs and the service worker

**Files:**
- Modify: `scripts/packs.mjs`, `scripts/packs.test.mjs`, `public/sw.js`, `src/runtime/install.js`, `install.test.js`, `scripts/sw-check.mjs`

- [ ] A pack lists the resolved URL and the manifest's hash for a remote file; `install.js` fetches cross-origin with `mode: 'cors'` and caches; `sw.js` matches requests whose URL starts with the asset base as it matches local ones; `sw-check.mjs` serves one remote file from the cache after a reload (a local static server standing in for the bucket in the check). **Commit** `Installed packs hold the remote files too`.

### Task 5: Upload, measure, docs, PR

- [ ] If the owner's shell has the key: `node scripts/assets-upload.mjs --dry` then without; the totals in the PR. If not: the PR says so and the owner runs it after merge.
- [ ] A paragraph in `docs/architecture.md`; the handoff's lane I row (what is remote, what is local, the tier needed). Merge `origin/main`, the checks, push, PR, CI, no merge.
