# Evidence: lane S, streaming both ways (2026-10-10)

The plan: `docs/superpowers/plans/2026-10-10-bf2017-phaseS-streaming.md`. The owner’s direction mid-lane: a laptop on wifi at the highest fidelity first, so the stream check’s default profile is that, and the phone on 3G is a flag.

## The bucket to the pipeline (`scripts/bf2017-fetch.mjs --all`)

On Luke’s eleven models (`characters/hero/luke/*`): every LOD, collision mesh and map, through the pool.

| run | fetched | kept | missing | failed | MB | s |
|---|---|---|---|---|---|---|
| first (10 already on disk) | 79 | 10 | 24 | 0 | 63.6 | 4.5 |
| second | 0 | 89 | 24 | 0 | 0.0 | 1.3 |
| `--verify` | 0 | 89 | 24 | 0 | 0.0 | 5.1 |

A file cut to 1,000 bytes was fetched again whole; no `.part` was left. `missing` is maps the upload has not reached (none of the 24 is a model). The first try, holding bodies to the drop manifest’s `bytes`, failed 60 of 94 as short: the uploader re-encoded the GLBs after writing them down (Luke’s lod4: 162,996 there, 79,980 in the bucket), so those bytes only size the timeout now. `fetch-luke-first.txt` and `fetch-luke-second.txt`.

## The site to the bucket

The public bucket `site-assets` was made with `POST /storage/v1/bucket` (`supabase/README.md`). A GET of a published file answers 200, `model/gltf-binary`, its size, `cache-control: public, max-age=31536000`, `access-control-allow-origin: *`; a HEAD there always says `no-cache`, so `assets-check.mjs` asks for one byte. On a check’s manifest of Hoth’s 25 models and one more: `assets-check: 26 of 26 right · 0 retried · 1.1 s`. The check’s objects were removed after; the committed manifest is `{}` until phase 1’s heroes are published.

## Hoth at ultra, a laptop on wifi (`scripts/stream-check.mjs`)

1440 × 900 at 2×, 50 Mbit/s, 20 ms, `?quality=ultra&calibrate=off`, a bundled development build under `vite preview`, software GL.

| build | up after | MB | requests | from the bucket | most downloads of one URL | below its best cut | console errors |
|---|---|---|---|---|---|---|---|
| `origin/main` | 33.3 s | 25.46 | 547 | 0 | 1 | `atat.glb` (beside `atat.ultra.glb`) | 1 (dust shader) |
| this branch | 32.9 s | 23.52 | 537 | 0 | 1 | none | 0 |
| this branch, `VITE_ASSET_BASE` set | 36.9 s | 23.54 | 537 | 25 | 1 | none | 0 |

Every person was drawn as a model by the time the scene mounted (51 with figures). `laptop-ultra*.json` list every model and texture asked. The times are software GL’s, the slow end; the bytes, the asks and the cuts are exact.

## Leaving a world mid-load (`leave-mid-load.json`)

Hoth through the bucket on a 2 Mbit/s line, left (`#/galaxy`) as its models came: 29 model downloads cancelled, the first 522 ms after the hash changed; one finished as it left; no page errors.
