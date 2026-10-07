// The Citadel's figures, for the tests: a loader that hands out a Meshy
// figure for every model (lib/three/meshyRig.fixture.js's, its idle, walk,
// run and sat clip beside it) and a clip for every one of the library's,
// each a little swing of the chest. `fails`: models that won't load. Each
// load a fresh copy, as a file's parse is.

import { meshyRig, swingClip } from '../../../lib/three/meshyRig.fixture';

export function figuresLoader({ fails = [] } = {}) {
  const sat = (n) => (/UpLeg$/.test(n) ? -1.5 : /Leg$/.test(n) ? 1.5 : 0);
  const urls = [];
  return {
    urls,
    async loadAsync(url) {
      urls.push(url);
      const r = meshyRig();
      const own = url.match(/\/games\/meshy\/([\w-]+?)-(idle|walk|run|sit)\.glb$/);
      if (own) {
        const clip = own[2] === 'sit' ? swingClip(r, 'sit', 2, sat) : r.clips[own[2]];
        return { scene: r.model, animations: [clip] };
      }
      const lib = url.match(/\/(?:clips|ual|clip)-([\w.]+)\.glb$/);
      if (lib) return { scene: r.model, animations: [swingClip(r, lib[1], 1.2, (n, t) => (n === 'Spine01' ? 0.4 * Math.sin((Math.PI * t) / 1.2) : 0))] };
      const model = url.match(/\/([\w-]+)\.glb$/)?.[1];
      if (fails.includes(model)) throw new Error('404');
      return { scene: r.model, animations: [] };
    },
  };
}

export const flush = () => new Promise((r) => setTimeout(r, 0));
