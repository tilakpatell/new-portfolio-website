# Hand-off: the Battlefront II (2017) pipeline

The design is `docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md`; the bucket’s numbers, `docs/superpowers/evidence/bf2017-assets/inventory.md`; the drop and its credit, `docs/assets/battlefront-2017.md`.

## Done

- **The design, the inventory and the plans** (PR #802, carried by the phase 0 PR).
- **Phase 0, the tools** (PR #805): the decision entry and the assets page; `scripts/bf2017-fetch.mjs` and `scripts/bf2017-import.mjs` over five tested modules under `scripts/lib/` (`bf2017-manifest`, `bf2017-paths`, `bf2017-textures`, `rig-parts`, `catalog-write`); the committed fixture (`scripts/fixtures/bf2017/`, 39.6 KB); the empty `catalog/bf2017.js`, last in `GROUPS`. Nothing on the site changed. Tried on two real models and nothing kept: Luke’s hilt (920 triangles, 212 KB, the shot in `docs/superpowers/evidence/bf2017-phase0/`) and Luke’s rotj body with `--rig` (the whole rig kept, 254 joints with fingers, face and physics; LOD2 706 KB, LOD4 236 KB; drawn in its bind pose).

## Left

In order:

1. **Phase 1, the heroes with their hilts**: the owner chose, on 2026-10-10, to keep the 2017 rig in full: no pruning, no renaming to Meshy’s names; the site learns the game’s skeleton. Phase 0’s rig prune (plan task 4) was written, tried on Luke (254 joints to 63, and his fingers and face went with it) and then taken out; the import keeps all 254 and puts `grip` under `Wep_Root`. A revised phase 1 plan is due on `claude/nice-mayer-jqow5k`; the one in the repo still assumes a pruned, renamed rig of about 70 bones (its spine rename and its 160 KB bake cap). Then: `docs/superpowers/plans/2026-10-10-bf2017-phase1-heroes.md`. Its task 2 adds parts by full manifest name (Luke’s head and hair are under `characters/heads/`, not his body’s folder: the body alone is 1.596 m and headless) and the spine rename; both go into `partsOf`, so the fetch’s `--parts` takes names too.
2. Phases 2 to 10 as the spec’s table orders them, each with its own plan when it starts.
3. Textures: every map the hilt and Luke’s body name was in the bucket as KTX2 on 2026-10-10, none as PNG. A map not there yet prints `missing:` in the import and the material goes without it; re-fetch and re-import when the upload has it.
4. Normals as KTX2 (UASTC) where `scripts/ktx2.mjs report` says it pays: phase 9’s, with the ultra cuts.

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

The tests need no keys and no network: `npx vitest run scripts/lib/bf2017-* scripts/lib/rig-parts.test.mjs scripts/lib/catalog-write.test.mjs scripts/bf2017-import.test.mjs src/components/galaxy/surface/catalog`.
