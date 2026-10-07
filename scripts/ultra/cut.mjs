// The ultra cut, as the importers make it (scripts/meshy-galaxy-buildings.mjs,
// scripts/meshy-import.mjs, scripts/sketchfab-surface.mjs, each with
// --ultra): from the same source as the plain file, up to four times its
// triangles with maps up to 8192, written beside it as <name>.ultra.glb,
// never over 24 MB. The numbers are the surface catalogue's own
// (src/components/galaxy/surface/catalog/ultra.js), which the placer and
// the catalogue's test read.

import { ULTRA, ultraCut } from '../../src/components/galaxy/surface/catalog/ultra.js';

export { ULTRA };

// Meshy's image to 3D tops out at this many (target_polycount)
export const MESHY_MAX_POLYCOUNT = 300000;

// --ultra taken off a command line
export const takeUltra = (argv) => ({ ultra: argv.includes('--ultra'), args: argv.filter((a) => a !== '--ultra') });

// a plain cut's spec ({ tris, tex, maps, … }) as its ultra cut's
export function ultraSpec(spec) {
  const { tris, tex } = ultraCut(spec);
  return { ...spec, tris, tex, maps: tex / 2 };
}

export const ultraName = (name) => `${name}.ultra.glb`;

// the problems with an ultra cut, as sentences; none means it may ship
export function checkUltra({ tris, after, bytes }) {
  const problems = [];
  if (after > tris * 1.05) problems.push(`${Math.round(after)} triangles, over the budget of ${tris}`);
  if (bytes > ULTRA.bytes) problems.push(`${(bytes / 1024 / 1024).toFixed(1)} MB, over 24 MB`);
  return problems;
}
