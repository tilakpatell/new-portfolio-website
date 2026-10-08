// What Minecraft fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/dot-matrix/minecraft',
  pages: ['src/pages/Minecraft.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/minecraft', 'src/pages/Minecraft.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  urls: [], // single files
  globs: ['/mc/**'], // folders: `*` within a folder, `**` any depth
};
