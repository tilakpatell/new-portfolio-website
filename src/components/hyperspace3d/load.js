// Fetches the 3D jump (three.js and its scene) ahead of time, so a jump never
// waits on the network: either the 3D version is here when the jump starts,
// or the 2D one plays. No three.js import here, so this costs nothing until
// it's asked for.

import { gpu, mode3D, resolve3D } from '../../lib/gpu';
import { prefersReducedMotion } from '../../lib/hooks';

let mod = null;
let pending = null;
let broken = false;

// the scene module, if it has arrived (and WebGL hasn't failed it this visit)
export const jumpScene = () => (broken ? null : mod);
export const jumpFailed = () => {
  broken = true;
};

export function preloadJump() {
  if (mod || pending) return pending;
  if (typeof window === 'undefined' || prefersReducedMotion() || !resolve3D(mode3D(), gpu())) return null;
  pending = import('./scene')
    .then((m) => (mod = m))
    .catch(() => {
      pending = null; // a dropped connection: try again next time
      return null;
    });
  return pending;
}

if (typeof window !== 'undefined') {
  // The first visit opens on the crawl, ~36 s before the jump: plenty of time,
  // once the crawl itself has had a moment to load.
  if (document.documentElement.dataset.intro === '1') setTimeout(preloadJump, 1200);

  // Later jumps (the Konami code, the terminal, the palette): once something
  // else on the page has loaded three.js (the globe, the mist, a diagram), the
  // scene is a small fetch, so take it then.
  const poll = setInterval(() => {
    if (mod || mode3D() === 'off') return clearInterval(poll);
    if (window.__THREE__ && !document.hidden) preloadJump();
  }, 4000);
}
