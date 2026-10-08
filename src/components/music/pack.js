// What the music planet fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/music',
  pages: ['src/pages/Music.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/music', 'src/pages/Music.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  urls: [
    '/games/hdri/music-dusk.hdr',
    '/audio/tanpura-pluck.mp3',
    '/audio/harmonium.mp3',
    '/audio/sitar-listen.mp3',
    '/audio/tabla.mp3',
  ], // single files
  globs: [
    '/models/music/**',
    '/textures/music/*',
    '/games/tex/*/arm.webp',
    '/games/tex/*/color.webp',
    '/games/tex/*/normal.webp',
    '/audio/sitar/*',
  ], // folders: `*` within a folder, `**` any depth
};
