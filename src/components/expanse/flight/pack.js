// What the flight fetches: nothing past its code (drawn in code, painted: look.js), so the install's list is its pages alone (scripts/packs.mjs, src/runtime/install.js).
export const PACK = {
  id: '/fly',
  pages: ['src/pages/Fly.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/expanse/flight', 'src/pages/Fly.jsx'], // where its source is: pack-check scans these
  urls: [],
  globs: [],
};
