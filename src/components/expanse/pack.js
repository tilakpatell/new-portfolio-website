// What a planet of the Expanse fetches: the nature kit's manifest and the family files its lands' flora draws from (lib/land/flora.js's tables, every land type's, drawn through lib/three/kit.js's pools); the land is made from its seed, the car drawn in code. The install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses, but the kit builds its paths (`${base}/${pack}/${file}`), so these are listed by hand and pack.test.js holds them to the flora's tables.
export const PACK = {
  id: '/universe/expanse',
  pages: ['src/pages/Expanse.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/expanse/surface', 'src/pages/Expanse.jsx', 'src/lib/land'], // where its source is (files or folders, repo-relative): pack-check scans these
  urls: ['/kit/naturemega/index.json'], // single files
  // the families the flora names (no TallThick, CherryBlossom or petals)
  globs: [
    '/kit/naturemega/birch.glb',
    '/kit/naturemega/bush.glb',
    '/kit/naturemega/clover.glb',
    '/kit/naturemega/commontree.glb',
    '/kit/naturemega/deadtree.glb',
    '/kit/naturemega/fern.glb',
    '/kit/naturemega/flower.glb',
    '/kit/naturemega/giantpine.glb',
    '/kit/naturemega/grass.glb',
    '/kit/naturemega/mushroom.glb',
    '/kit/naturemega/pebble.glb',
    '/kit/naturemega/pine.glb',
    '/kit/naturemega/plant.glb',
    '/kit/naturemega/rock.glb',
    '/kit/naturemega/rockpath.glb',
    '/kit/naturemega/twistedtree.glb',
  ], // folders: `*` within a folder, `**` any depth
};
