// What Cybertron fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/cybertron',
  pages: ['src/pages/Cybertron.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/cybertron', 'src/pages/Cybertron.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  urls: [
    '/models/sketchfab/optimus-transform.glb',
    '/audio/clips/transform.mp3',
    '/audio/clips/autobots-roll-out.mp3',
    '/audio/clips/my-name-is-optimus-prime.mp3',
    '/audio/clips/i-am-optimus-prime.mp3',
    '/audio/clips/freedom.mp3',
    '/audio/clips/one-shall-stand.mp3',
    '/audio/clips/megatron-prime.mp3',
    '/audio/clips/its-you-and-me-megatron.mp3',
    '/audio/clips/autobots-relieve-them-of-their-weapons.mp3',
    '/audio/clips/bumblebee-brave-soldier.mp3',
    '/audio/clips/more-than-meets-the-eye.mp3',
    '/audio/clips/we-are-here-we-are-waiting.mp3',
    '/audio/clips/soundwave-superior.mp3',
    '/audio/clips/so-unwise.mp3',
    '/audio/clips/die.mp3',
    '/textures/universe/transformers.webp',
    '/textures/universe/transformers-sm.webp',
    '/textures/universe/transformers-normal.webp',
    '/textures/universe/transformers-glow.webp',
    '/models/meshy/optimus-prime.glb',
    '/models/meshy/megatron.glb',
    '/games/hdri/jasper.hdr',
    '/games/hdri/kaon.hdr',
    '/games/hdri/mission.hdr',
  ], // single files
  globs: [
    '/models/cybertron/*.glb',
    '/games/meshy/rollout**',
    '/games/sky/*',
    '/games/models/*',
    '/games/tex/armour/*',
    '/games/tex/asphalt-city/*',
    '/games/tex/asphalt-desert/*',
    '/games/tex/concrete/*',
    '/games/tex/desert-ground/*',
    '/games/tex/desert-sand/*',
    '/games/tex/facade-brick/*',
    '/games/tex/facade-glass/*',
    '/games/tex/facade-office/*',
    '/games/tex/facade-tower/*',
    '/games/tex/mesa-rock/*',
    '/games/tex/plate-deck/*',
    '/games/tex/plate-road/*',
    '/games/tex/sidewalk/*',
  ], // folders: `*` within a folder, `**` any depth
  computed: ['/textures/universe', '/models/meshy', '/games/hdri'], // folders the source only builds paths in: the files it takes are listed above
};
