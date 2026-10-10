// What the Earth fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/earth',
  pages: ['src/pages/Earth.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/earth', 'src/pages/Earth.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  urls: ['/models/sketchfab/earth-plane.glb', '/textures/universe/sky.webp', '/textures/universe/sky-sm.webp'], // single files
  globs: ['/textures/earth/*'], // folders: `*` within a folder, `**` any depth
  computed: ['/textures/universe'], // folders the source only builds paths in: the files it takes are listed above
};
