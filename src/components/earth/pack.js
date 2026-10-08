// What the Earth fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/earth',
  pages: ['src/pages/Earth.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/earth', 'src/pages/Earth.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  // single files (the Earth's maps one by one, not the folder: its sky's -hq lives there too, and nothing here wears it)
  urls: ['/models/sketchfab/earth-plane.glb', ...['day', 'night', 'clouds', 'relief', 'water', 'sky'].flatMap((n) => [`/textures/earth/${n}.webp`, `/textures/earth/${n}-sm.webp`])],
  computed: ['/textures/earth'], // folders the source only builds paths in: the files it takes are listed above
};
