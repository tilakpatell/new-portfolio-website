// What Dot Matrix fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/dot-matrix',
  pages: ['src/pages/DotMatrix.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/dotmatrix', 'src/pages/DotMatrix.jsx', 'src/stages/GameBoyStage.jsx', 'src/stages/gb'], // where its source is (files or folders, repo-relative): pack-check scans these
  urls: [], // single files
  globs: [], // folders: `*` within a folder, `**` any depth
};
