// What the flight fetches (scripts/packs.mjs, src/runtime/install.js): its pages, the galaxy's ground scans its planets wear, and the film-made models its planets' places are built of.
export const PACK = {
  id: '/fly',
  pages: ['src/pages/Fly.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/expanse/flight', 'src/pages/Fly.jsx'], // where its source is: pack-check scans these
  // (the planets' landmarks and Coruscant's tower: lib/land/flight/planetTables.js's parts and hero)
  urls: [
    '/models/galaxy/surface/cloudcity.glb',
    '/models/galaxy/surface/cloudplaza.glb',
    '/models/galaxy/surface/cloudtower.glb',
    '/models/galaxy/surface/corutower.glb',
    '/models/galaxy/surface/ewokhut.glb',
    '/models/galaxy/surface/jeditemple.glb',
    '/models/galaxy/surface/jeditemple.lod1.glb',
    '/models/galaxy/surface/lothdome.glb',
    '/models/galaxy/surface/lothtower.glb',
    '/models/galaxy/surface/mosarch.glb',
    '/models/galaxy/surface/mosblock.glb',
    '/models/galaxy/surface/moscantina.lod1.glb',
    '/models/galaxy/surface/moshut.glb',
    '/models/galaxy/surface/mosspire.glb',
    '/models/galaxy/surface/mostower.glb',
    '/models/galaxy/surface/nevarrocantina.glb',
    '/models/galaxy/surface/nevarrodome.glb',
    '/models/galaxy/surface/nevarrodomehouse.lod1.glb',
    '/models/galaxy/surface/senate.lod1.glb',
    '/models/galaxy/surface/senate.ultra.glb',
    '/models/galaxy/surface/sundaridome.lod1.glb',
    '/models/galaxy/surface/sundaridome.ultra.glb',
    '/models/galaxy/surface/tipocadome.lod1.glb',
    '/models/galaxy/surface/tipocadome.ultra.glb',
    '/models/galaxy/surface/yodahut.lod1.glb',
  ],
  globs: ['/cc0/galaxy/**'],
};
