# Hand-off: the Battlefront II (2017) pipeline

The design is `docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md`; the bucket’s numbers, `docs/superpowers/evidence/bf2017-assets/inventory.md`; the drop and its credit, `docs/assets/battlefront-2017.md`.

## Done

- **The design, the inventory and the plans** (PR #802, carried by the phase 0 PR).
- **Phase 0, the tools** (PR #805): the decision entry and the assets page; `scripts/bf2017-fetch.mjs` and `scripts/bf2017-import.mjs` over five tested modules under `scripts/lib/` (`bf2017-manifest`, `bf2017-paths`, `bf2017-textures`, `rig-parts`, `catalog-write`); the committed fixture (`scripts/fixtures/bf2017/`, 39.6 KB); the empty `catalog/bf2017.js`, last in `GROUPS`. Nothing on the site changed. Tried on two real models and nothing kept: Luke’s hilt (920 triangles, 212 KB, the shot in `docs/superpowers/evidence/bf2017-phase0/`) and Luke’s rotj body with `--rig` (the whole rig kept, 254 joints with fingers, face and physics; LOD2 706 KB, LOD4 236 KB; drawn in its bind pose).
- **Phase 1, the heroes on the game's skeleton, with their hilts** (this PR, `claude/bf2017-phase1`):
  - `public/models/galaxy/bf2017/walrus.glb`: `Walrus_HumanMale` whole, 254 nodes (`scripts/bf2017-skeleton.mjs`); `src/lib/three/walrusRig.js` names its body, fingers and sockets, `WEAPON_FRAME` (the identity: the game models weapons in the `Wep_Root` frame).
  - The game's clips as packs (`scripts/bf2017-clips.mjs`, names mapped by `src/lib/three/walrusClips.js`): `clips-humanoid.glb` 843 KB (27 clips), and one a hero: Luke 1,323 KB (45), Vader 1,269 (42), Obi-Wan 1,069 (39), Anakin 1,187 (38), Maul 1,179 (41), Dooku 1,153 (38), Palpatine 459 (15), Han, Leia, Lando, Chewbacca, Boba Fett, Bossk 92-141 KB (their defeat and abilities). 24 fps, root motion off `AITrajectory` into `extras.root`, `contact` timed on a blade a metre up `Wep_Root`, rest-holding channels left out and put back by the loader. Luke's blocks come from the cinematic skeleton (`Walrus_NIS_S0800_Skeleton`, the same rig at the same rest).
  - `src/lib/three/walrus.js` loads a 2017 body with its packs; footScene's `walrusFigure` wraps it in the same `rigged()` every figure gets, the animator told `library: false`. Both figure paths (`crew.js`, `loadPartyFigure`) take `rig: 'walrus'`.
  - Thirteen heroes, each in three cuts (review fixes, 2026-10-10): `<kind>.ultra.glb` at the game's full fidelity, at the owner's ask ("highest fidelity": LOD0 meshes, 31,807-61,764 triangles, every map at 2048, WebP 90, 4.7-13.6 MB, 111-384 MB of GPU textures a hero), loaded only at ultra; `<kind>.glb`, the same mesh at 1024 colour and 512 maps (1.4-3.0 MB, 23-49 MB of GPU textures), at high; `<kind>.lod1.glb` (the cut under 8,000 body triangles at 512 and 256: 0.5-1.1 MB, 6-13 MB) at low and mid. The full-map files had been the plain cut: Luke alone was 272 MB of GPU textures against the 256 MB a world may have. `crew.budget.test.js` holds each cut to its cap on disk and on the GPU. Sheets in `docs/superpowers/evidence/bf2017-phase1/` (of the full-map files). They are `public/models/galaxy/bf2017/crew/<kind>.glb`, credited `bf2017-<kind>`; the skeleton and the clip packs by one pack credit, `bf2017/walrus` in `public/games/credits.json`. Of the Meshy and Sketchfab files at `galaxy/crew/`, Luke's, Han's, Leia's, Vader's and Palpatine's stay (the universe's foot party, the Death Star's people, `scripts/motion/bake.mjs`, `ual-bake.mjs` and `meshy-actions.mjs` load them as Meshy figures); Boba Fett's, Obi-Wan's, Maul's, Lando's and Dooku's, which only the galaxy used, are gone with their credits.
  - Ten hilts and three hero blasters, `--keep-origin`, at the game's own maps; `HILTS` wear them; the saber and gunplay put the weapon in `Wep_Root` on a 2017 figure, the clip's arms and fingers holding it, the aim on the chest.

## Left

In order:

1. **Phase 2, everyone the game has**: `docs/superpowers/plans/2026-10-10-bf2017-phase2-everyone.md` (troopers, droids, blasters on the same loader; the humanoid pack plus the `AI_Rifleman`, `AI_Officer`, `Cover` and `Awareness` sets).
2. **Yoda and Grievous**: their own rigs (`Yoda_01_Ske`, `GeneralGrievous_01_Ske`) and clips (101 and 161); not imported this phase, they stay as they were until their own-rig packs (phase 10's).
3. **Site clip names the game has nothing for**, which fall back (`CLIP_FALLBACK`, else the humanoid pack's): Vader `sword.dash`, `sword.pound`, `force.push`; Anakin's staggers (the humanoid flinches stand in); Dooku `sword.aerial.a`, `sword.uppercut`; Palpatine every stroke (he fights with lightning in the game); the blaster heroes' dodges.
4. **Textures not in the bucket yet**: Leia's braids (`t_lodcaps_braids_01_brown_cm`, `…_n`), and the game's generic eye map (`T_Eye_MP_DA`): the human heroes wear Luke's eye map, its white lifted. Re-import when the upload has them.
5. **A dual stance on a 2017 figure** holds one hilt: the game's heroes don't dual-wield; `Wep2_Root` is there for it if the site wants one.
6. **Repository weight**: the full-fidelity heroes are 111 MB of GLBs (their light cuts 25 MB more). Lane S (`site-assets` bucket, `scripts/assets-publish.mjs`) is where they should move.
7. Phases 3 to 10 as the spec's table orders them.
8. `WEAPON_FRAME` re-measured if a weapon sits wrong; the hilt sheet and the duel shots say it doesn't.

## Checking it

The keys: `SUPABASE_URL` and `BF2017_KEY` (a key that can read the private `bf2017-assets` bucket) in `.env.local`, never committed; the owner holds them. In a cloud session they are already environment variables (the key as `SUPA_KEY`; the fetch takes either), so drop `--env-file`.

```
node --env-file=.env.local scripts/bf2017-fetch.mjs manifest
node --env-file=.env.local scripts/bf2017-fetch.mjs --list 'gameplay/equipment/heroes/*'
node --env-file=.env.local scripts/bf2017-fetch.mjs gameplay/equipment/heroes/lightsaberlukeskywalker/lightsaberlukeskywalker_meshp_mesh
node scripts/bf2017-import.mjs gameplay/equipment/heroes/lightsaberlukeskywalker/lightsaberlukeskywalker_meshp_mesh --kind hiltluke --as 'Luke’s lightsaber hilt' --asis --tex 512 --maps 256
npx vite --port 5188 --strictPort --host 127.0.0.1 &
node scripts/glb-shot.mjs public/models/galaxy/surface/hiltluke.glb /tmp/hiltluke.png three
```

Phase 1's, with the dev server up:

```
node scripts/bf2017-fetch.mjs anims
node scripts/bf2017-clips.mjs luke
node scripts/bf2017-import.mjs characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh --kind luke --as 'Luke Skywalker' --rig --crew --hero --metres 1.72 --parts '<head>,<hair>' --tex 1024 --maps 512 --ultra --ultra-tex 2048 --ultra-maps 2048 --quality 90 --cuts plain=0,lod1=2,ultra=0 --eyes characters/heads/_shared/eyes/t_eyes_luke_c.ktx2
node scripts/bf2017-skeleton.mjs public/models/galaxy/bf2017/crew/luke.glb
```

The duel: open `#/galaxy/hoth/surface` as Luke, then `__surfaceDo('duel', 'maul', { stance: 'double' })` in the console; F strikes, C blocks.

The tests need no keys and no network: `npx vitest run scripts/lib/bf2017-* scripts/lib/rig-parts.test.mjs scripts/lib/catalog-write.test.mjs scripts/bf2017-import.test.mjs scripts/bf2017-clips.test.mjs scripts/bf2017-skeleton.test.mjs src/lib/three/walrus src/lib/combat/hiltFit.test.js src/components/galaxy/surface/catalog`.

## Lane S: streaming, both ways

### Done

- **PR (this one, from `claude/bf2017-streaming`)**, built on lane I's mirror (PR #798), not beside it:
  - **The bucket to the pipeline**: `scripts/lib/pool.mjs` (six at once, 30 s plus a second a megabyte, three retries at 1, 2, 4 s, `Retry-After` honoured, a short body retried, a `.part` renamed when whole); `bf2017-fetch.mjs --all '<glob>' [--verify] [--pool n]` with one summary line and `lab/assets/bf2017/.index.json`. Luke’s eleven models: fetched 79 · kept 10 · missing 24 · failed 0 · 63.6 MB · 4.5 s, then kept 89 in 1.3 s.
  - **The site to the bucket**: the public bucket `site-assets` (made; `supabase/README.md`); `scripts/assets-publish.mjs` finds the game-derived files by their credit to the game, sends each new hash once to `<hash12>/<path>`, writes `src/data/galaxyAssets.json` last, then `.gitignore`’s block (`scripts/assets-ignore.mjs`). The build merges those entries into the one bundled manifest; lane I’s upload goes to the same bucket and its prune spares them; packs list them (`remoteOnly`) and the installer keeps asking the bucket for them.
  - **The site’s loader**: `src/lib/net/assetFetch.js` through `src/lib/assetLoad.js` at the shared `GLTFLoader`’s `load` and `textures.js`: 2 at once on a saver connection, 4 on a weak device or a phone, 6 on a desktop, 8 at ultra (the connection sets it, not the chip), the nearest first, one request per URL, a stall timeout, short bodies retried, a 404 sending that file alone to the site; every surface world’s loads aborted at its dispose. `src/lib/net/progressive.js` (which cut first, and when the plain is worth it); a figure on a saver connection fetches its `.lod1` only, and a plain that won’t come falls to the `.lod1`.
  - **Fidelity at ultra** (the owner’s direction mid-lane: a laptop on wifi, the best first): a walker and a figure now load the level’s own cut (the AT-AT came as plain and ultra both on main, 1.9 MB wasted, drawn from the plain); the dust shader compiles at ultra (`lib/three/dust.js`, outside the lane: one console error on every Hoth visit at ultra on main).
  - **The 404 rule**: a 404 on one hashed URL sends that file alone to the site’s path; only a real failure (network, timeout, retries spent) marks the bucket down for the visit.
  - **The abort rule**: an abort (the world left) rejects with an `AbortError`, is never a fallback and never marks the bucket down, and a late answer is dropped.
  - **Checks**: `scripts/assets-check.mjs` (walks both `galaxyAssets.json` and `assets-manifest.json`) (in `deploy.yml` when `ASSET_BASE` is set) and `scripts/stream-check.mjs`. The numbers: `docs/superpowers/evidence/bf2017-streaming/README.md`.

### Left

- **Lane W's folders**: `textures/galaxy/bf2017/<role>/` and `textures/galaxy/sky/` are in the mirror's `REMOTE` list (`scripts/assets-upload.mjs`, with `.hdr` and `.exr` as kinds), so a committed map or sky there is mirrored once it lands. If lane W keeps them out of git (they are game-derived), add those two folders to `assets-publish.mjs`'s list beside `models/galaxy/bf2017` instead.
- **Nothing is published yet**: `galaxyAssets.json` is `{}` until phase 1’s heroes are imported. Then: `node scripts/assets-publish.mjs --dry`, without, `node scripts/assets-check.mjs`, commit the manifest and `.gitignore`.
- **The progressive swap** (a figure drawn from its `.lod1`, the plain swapped in when it lands): `progressive.js` holds the rule, but a figure hands its animator and bones to sabers and combat, so swapping its mesh needs a figure-level facade in `actors.js`, which phase 1 is rewriting for the walrus loader. Until then the small cut first applies on a saver connection only, and at ultra (the laptop’s level) the full cut is always fetched first, as fidelity wants.
- **The HUD’s bytes line** (“Loading Hoth, 12 of 27 MB”): the world’s scope counts bytes (`debug().net`), but the loading veil reads the runtime’s prepare steps; wiring it is a runtime change.
- **A published hero with clips**: `catalog.test.js`’s clip check reads the file; a row with `anim` whose file is only published will fail it in CI. Phase 1 decides: its clips in a pack, or the check reading the published manifest of clip names.
- **Egress**: the free tier’s 5 GB a month is a few hundred visits. Pro (250 GB) before `ASSET_BASE` is set for everyone; if egress bills, the same `<hash12>/<path>` files on Cloudflare R2 and `ASSET_BASE` pointed there is the whole change.
- **The bucket’s name**: the parent session asked (after the lane was built) for lane I’s `assets` bucket and one JSON file; the owner’s brief named `site-assets` and `galaxyAssets.json`, so that stands until the owner says otherwise. Folding is mechanical: `BUCKET` in two scripts, and the merge in `scripts/assets-manifest.mjs`.

### Checking it

- The variable: the repository variable `ASSET_BASE` = `https://jzabcqboyemokwifmjmp.supabase.co/storage/v1/object/public/site-assets` (Settings, Secrets and variables, Actions, Variables). Unset, the site is exactly as before.
- The bucket: `node scripts/assets-check.mjs` (no key: the bucket is public).
- The stream: `NODE_ENV=development npx vite build --mode development --outDir /tmp/stream-dist && npx vite preview --outDir /tmp/stream-dist --port 4173 --strictPort --host 127.0.0.1`, then `node scripts/stream-check.mjs` (a laptop on wifi at ultra) or `--phone` (3G at mid). With `VITE_ASSET_BASE` in the build’s environment, the bucket is in the path.
- The fetch: `node scripts/bf2017-fetch.mjs --all 'characters/hero/luke/*'` twice; the second is all `kept`.
- The tests need no network: `npx vitest run scripts/lib/pool.test.mjs scripts/lib/asset-manifest.test.mjs scripts/assets-*.test.mjs scripts/stream-check.test.mjs src/lib/net src/lib/assetLoad.test.js src/lib/assetBase.test.js`.

