# Supabase: the durable world

The schema in `migrations/` is the one source of truth for what players build on the planets (the design: `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md`, Pillar 2; why a server at all: `docs/decisions/2026-10-09-supabase-for-durable-shared-state.md`). The client is `src/lib/durable/`.

## Applying it

1. Make a project at supabase.com (the free tier is enough to start). In Authentication, Providers, enable **Anonymous sign-ins**.
2. `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`. Or paste each file under `migrations/` into the SQL editor, oldest first, then `seed.sql`.
3. Put the project's URL and anon key where the build reads them: locally in `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (never committed; `.env.example` lists the names), and on GitHub as the repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` (`deploy.yml` passes them to the build). The anon key is public by design: row-level security is what guards the tables, which is why every table here has it on.

## Checking it

`node scripts/supabase-check.mjs` with the project in `.env.local`: signs in anonymously, places three entities on `hoth`, asks the envelope round them (and is refused one 9 km wide), is refused inside Echo Base, damages one to nothing and sees it gone, and checks a second anonymous visitor cannot remove the other two before their owner does. Six lines, each `ok`; exit 1 on a failure, 2 with no project set. It runs by hand (it needs a project; each run makes two anonymous users); CI tests the client against a fake.

## The seed

`seed.sql` is written by `node scripts/supabase-seed.mjs`, never by hand: the 50 planets a thing may be built on, in the roster's order (`docs/research/2026-10-09-planet-geographies.md`), and the places on them where nothing may be (each POI's `r` in the table is its `r + edge`, the whole eased band; Echo Base on `hoth` alone until lane A lands). It reads lane A's `src/lib/land/flight/planetSpec.js` when that is in the tree, else `scripts/fixtures/planets.json` (the same ids; `--fixture` rebuilds it from the Expanse's `makeSector`). It upserts, so applying it again after the list changes is safe. After lane A merges (`planetSpec.js` on main), the owner runs `node scripts/supabase-seed.mjs` and applies the new `seed.sql` in the SQL editor: the named planets' placeholder types and seeds are replaced by lane A's, and each world's POIs are added.

## The asset bucket

The site's one public bucket is `site-assets`: read-only, no key needed to read it, Storage's CORS allowing `GET` from any origin. It holds two sets, both at `<hash12>/<path>` with a year's cache, so one `ASSET_BASE` serves both:

- **the heavy-asset mirror** (`docs/decisions/2026-10-09-heavy-assets-mirrored-on-supabase-storage.md`): copies of committed models and textures, `scripts/assets-upload.mjs`, manifest `src/data/assets-manifest.json`;
- **the game-derived files** (`docs/decisions/2026-10-10-battlefront-2017-assets.md`, the exception): what the 2017 pipeline made, not committed (git ignores them), `scripts/assets-publish.mjs`, manifest `src/data/galaxyAssets.json`.

**How it was made** (2026-10-10, once): `POST $SUPABASE_URL/storage/v1/bucket` with `{ "id": "site-assets", "name": "site-assets", "public": true }` and the project's secret key as `apikey` and `Authorization: Bearer`. `scripts/assets-publish.mjs` does the same when the bucket is not there (`ensureBucket`), and refuses a bucket of that name that is not public. No RLS policy is needed on storage for it: a public bucket's objects are read through `/object/public/` with no key, and only the secret key writes.

**Publishing the game-derived files**, from a shell or a cloud session that holds `SUPABASE_URL` and `SUPA_KEY` (the secret key; `BF2017_KEY` is the same), never CI:

1. `node scripts/assets-publish.mjs --dry`: what would go, by hash, and how many megabytes.
2. `node scripts/assets-publish.mjs`: sends each new hash once (one already there is not sent again), writes `src/data/galaxyAssets.json` last, then `.gitignore`'s marked block. Commit both.
3. `node scripts/assets-check.mjs`: every manifest entry asked for one byte (a HEAD there always says `no-cache`), its status, size and cache header held to the manifest.

**The mirror**: `export SUPABASE_SERVICE_ROLE_KEY=…` in the shell only, then `node scripts/assets-upload.mjs --dry`, then without; it prints the base URL. Commit the manifest. Once a deploy with the new manifest is live, `git fetch origin main && node scripts/assets-upload.mjs --prune` removes what neither the files on disk nor main's manifest names (it refuses in a run that uploads, with no files on disk, or when main's manifest can't be read). Prune never touches what `galaxyAssets.json` names: run it only with that manifest committed.

**The base**: set the repository variable `ASSET_BASE` (Settings, Secrets and variables, Actions, Variables) to `https://jzabcqboyemokwifmjmp.supabase.co/storage/v1/object/public/site-assets`; `deploy.yml` hands it to the build as `VITE_ASSET_BASE`. Locally, the same in `.env.local`. Unset, the site is exactly as it was: every file from its own origin.

Supabase stores only the `max-age` of the cache header it is sent and serves `public, max-age=31536000` on a GET. Before `ASSET_BASE` is set for everyone the project wants Pro: the free tier's egress (about 5 GB a month) is a few hundred visits; Pro includes 250 GB, about ten thousand visits to Hoth at high (25 MB each). If egress bills, the same files on Cloudflare R2 (free egress) and `ASSET_BASE` pointed there is the whole change.

## The ground's version

`20261009000300_terrain_version.sql` adds `terrain_version` to `planets` and `world_entities` (default 1). The flight's ground is code: when `src/lib/land/flight/planetSpec.js`'s `TERRAIN_VERSION` is bumped (its test fails when the ground changes without it), the client draws anything built on an older ground on the ground there is now, and the seed writes each planet's version. Apply the migration, then `seed.sql` again.

## Rules

- A change to the schema is a new migration file, never an edit of an applied one.
- No secret key anywhere in this repository or its workflows. The client holds the anon key only; the public bucket needs none.
- A write that is not the owner's own row goes through a `security definer` function that clamps and rate-limits (`damage_entity` is the pattern).
