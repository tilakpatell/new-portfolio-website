// What the flight fetches (scripts/packs.mjs, src/runtime/install.js): its pages, the galaxy's ground scans its planets wear, and Coruscant's film-made models.
export const PACK = {
  id: '/fly',
  pages: ['src/pages/Fly.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/expanse/flight', 'src/pages/Fly.jsx'], // where its source is: pack-check scans these
  urls: [
    '/models/galaxy/surface/corutower.glb',
    '/models/galaxy/surface/senate.lod1.glb',
    '/models/galaxy/surface/senate.ultra.glb',
    '/models/galaxy/surface/jeditemple.lod1.glb',
    '/models/galaxy/surface/jeditemple.glb',
  ],
  globs: ['/cc0/galaxy/**'],
};
