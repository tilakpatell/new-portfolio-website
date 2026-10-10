// What the inside of the Death Star fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/deathstar/inside',
  pages: ['src/pages/DeathStarInside.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/deathstar/inside', 'src/pages/DeathStarInside.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  urls: [
    '/models/universe/falcon.glb',
    '/models/galaxy/surface/lambda.glb',
    '/models/galaxy/crew/luke.glb',
    '/models/galaxy/crew/han.glb',
    '/models/galaxy/crew/leia.glb',
    '/models/deathstar/obiwan.glb', // old Ben: Meshy's model, rigged from jedi3 (scripts/rig-transfer.mjs)
    '/models/galaxy/troops/stormtrooper.glb',
    '/models/galaxy/crew/officer.glb',
    '/models/galaxy/crew/palpatine.glb',
    '/models/galaxy/crew/senateguard.glb',
    '/models/galaxy/crew/tiepilot.glb',
    '/models/galaxy/crew/vader.glb',
    '/models/cockpit/chewie.glb', // Chewbacca: the cockpit's Meshy model, rigged as the crew are
    '/models/deathstar/c3po.glb', // C-3PO, rigged again on the crew's skeleton
    '/models/galaxy/surface/gonk.glb',
    '/models/galaxy/surface/mousedroid.glb',
    '/models/galaxy/surface/r2d2.glb',
    '/models/galaxy/surface/r5.glb',
    // what the windows show (scene/views.js): the fleet at Endor, the stations from outside
    '/models/galaxy/lod/moncal.glb',
    '/models/galaxy/lod/destroyer.glb',
    '/models/galaxy/lod/executor.glb',
    '/models/galaxy/lod/xwing.glb',
    '/models/galaxy/lod/tie.glb',
    '/models/universe/death-star.glb',
    '/models/universe/death-star.hq.glb',
    '/models/galaxy/deathstar2.glb',
    '/models/galaxy/deathstar2.hq.glb',
  ], // single files
  globs: ['/games/meshy/clips-*.glb', '/models/galaxy/troops/clip-*.glb'], // folders: `*` within a folder, `**` any depth
};
