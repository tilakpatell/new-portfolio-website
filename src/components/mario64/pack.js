// What Super Mario 64 fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/dot-matrix/64',
  pages: ['src/pages/Mario64.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/mario64', 'src/components/n64', 'src/pages/Mario64.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  urls: ['/n64/play.html'], // single files
  globs: ['/models/mario64/*', '/hq/sky/noon/*', '/hq/sky/hall/*', '/hq/tex/**'], // folders: `*` within a folder, `**` any depth
};
