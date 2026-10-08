// What Invincible fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/invincible',
  pages: ['src/pages/Invincible.jsx'], // page modules: the build adds their JS/CSS chunks
  src: [
    'src/components/invincible',
    'src/pages/Invincible.jsx',
    'src/components/avengers/hq/engine.js',
    'src/components/avengers/hq/feel.js',
    'src/components/avengers/hq/vfx.js',
    'src/components/avengers/hq/HQFrame.jsx',
    'src/components/avengers/hq/useStage.js',
    'src/components/avengers/hq/kit/shapes.js',
    'src/components/avengers/hq/kit/humanoid.js',
  ], // where its source is (files or folders, repo-relative): pack-check scans these
  urls: ['/models/invincible/card.webp'], // single files
  globs: ['/models/invincible/*.glb', '/textures/earth/*', '/hq/sky/noon/*', '/hq/sky/dusk/*', '/hq/sky/night/*'], // folders: `*` within a folder, `**` any depth
};
