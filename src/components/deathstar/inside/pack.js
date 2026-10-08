// What the inside of the Death Star fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/deathstar/inside',
  pages: ['src/pages/DeathStarInside.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/deathstar/inside', 'src/pages/DeathStarInside.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  urls: [
    '/models/universe/falcon.glb',
    '/models/galaxy/crew/luke.glb',
    '/models/galaxy/crew/han.glb',
    '/models/galaxy/crew/leia.glb',
    '/models/galaxy/crew/obiwan.glb',
    '/models/galaxy/troops/stormtrooper.glb',
  ], // single files
  globs: ['/games/meshy/clips-*.glb', '/models/galaxy/troops/clip-*.glb'], // folders: `*` within a folder, `**` any depth
};
