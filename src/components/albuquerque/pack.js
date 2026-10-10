// What Albuquerque fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/albuquerque',
  pages: ['src/pages/Albuquerque.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/albuquerque', 'src/pages/Albuquerque.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  urls: [
    '/cc0/cloud.webp',
    '/cc0/lab.exr',
    '/cc0/workshop.exr',
    '/audio/clips/say-my-name.mp3',
    '/audio/clips/better-call-saul.mp3',
    '/audio/clips/gus-hello.mp3',
    '/audio/clips/hector-bell.mp3',
    '/audio/clips/yeah-science.mp3',
    '/audio/clips/hank-ringtone.mp3',
    '/audio/clips/face-off.mp3',
    '/audio/clips/breaking-bad-intro.mp3',
    '/audio/clips/jesse-ringtone.mp3',
    '/audio/clips/hi-im-saul.mp3',
    '/audio/clips/tuco-tight.mp3',
    '/audio/clips/one-who-knocks.mp3',
    '/audio/clips/i-am-the-danger.mp3',
    '/audio/clips/killed-gus-fring.mp3',
    '/audio/clips/walter-hartwell-white.mp3',
    '/audio/clips/private-domicile.mp3',
    '/audio/clips/cant-keep-getting-away.mp3',
    '/audio/clips/dont-drink-and-drive.mp3',
    '/models/sketchfab/rv.glb',
    '/models/sketchfab/esteem.glb',
    '/models/sketchfab/watertower.glb',
    '/models/sketchfab/tank.glb',
    '/models/sketchfab/cactus.glb',
    '/models/sketchfab/tumbleweed.glb',
    '/models/sketchfab/bucket.glb',
  ], // single files
  globs: [
    '/models/albuquerque/*.glb',
    '/models/albuquerque/world/*',
    '/models/metherria/*',
    '/cc0/materials/**',
    '/albuquerque/shadow/*',
    '/cc0/galaxy/adobe/*',
  ], // folders: `*` within a folder, `**` any depth
  computed: ['/models/sketchfab'], // folders the source only builds paths in: the files it takes (world/scene.js's SKETCHFAB) are listed above
};
