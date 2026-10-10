// Dimension 35-C (the pilot): the forest of Mega Trees, trunks as wide as
// houses going up out of sight, roots like walls, a blue-green dusk with two
// moons, glowing patches on the bark where the seeds grow, the seeds
// themselves pink and warm. Rick waits by the biggest tree and the
// Federation's patrols walk the forest (./destinations.js).

import { BALL } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xd8f0ff, 0.9], hemi: [0x8ac8e8, 0x2a4a3a, 1.5], fog: [0x6a9ab8, 50, 240] };

export async function buildDim35c(kit) {
  const S = stage(kit, 'dim35c', { ground: specks('#3a6a4a', ['#32603e', '#427452', '#2a5a3a'], 53, 2000, 2), groundTile: 6 });
  const { R, P } = S;

  // the Mega Trees: a wide trunk each, flaring at the foot into roots, bark glowing in patches
  const trees = [
    [0, -24, 3.2],
    [-14, -16, 2.6],
    [16, -18, 2.8],
    [-22, 12, 2.4],
    [24, 14, 2.6],
    [26, -6, 2.2],
    [-30, -4, 2.0],
    [8, 26, 2.4],
  ];
  for (const [i, [dx, dz, r]] of trees.entries()) {
    const f = R.frame(...P(dx, dz), i);
    f.cyl(0x5a4a3a, 0, 0, 0, r, 60).cyl(0x4a3a2a, 0, 0, 0, r * 1.5, 1.2);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + i;
      f.box(0x4a3a2a, Math.cos(a) * r * 1.8, 0, Math.sin(a) * r * 1.8, r * 1.6, 0.9, 0.8, -a);
    }
    for (let k = 0; k < 6; k++) f.glow(BALL, 0x6affb0, 1.3, Math.cos(k * 1.3 + i) * r, 3 + k * 2.4, Math.sin(k * 1.3 + i) * r, 0, 0.5, 0.3, 0.5);
  }
  // the seeds, pink and warm, where the data's spots are
  for (const [dx, dz, y] of [
    [-12, -14.4, 1.0],
    [14, -16.4, 0.4],
    [-20, 10, 0.3],
  ]) R.frame(...P(dx, dz), 0).glow(BALL, 0xff9ad8, 1.4, 0, y, 0, 0, 0.42, 0.5, 0.42).ball(0xd86ab8, 0, y, 0, 0.36, 1.2);
  // more seeds high up, out of reach, and ferns about the roots
  for (const [i, [dx, dz]] of trees.entries()) for (let k = 0; k < 3; k++) R.frame(...P(dx, dz), 0, { list: 'fixed' }).glow(BALL, 0xff9ad8, 1.2, Math.cos(k * 2 + i) * 2.4, 8 + k * 5, Math.sin(k * 2 + i) * 2.4, 0, 0.5);
  for (let k = 0; k < 30; k++) {
    const f = R.frame(...P(-32 + (k * 17) % 64, -20 + ((k * 13) % 40)), k, { list: 'fixed' });
    for (let j = 0; j < 4; j++) f.box(0x3a8a4a, 0, 0.1, 0, 0.1, 1.2, 0.5, j * 1.6, 0, 0.5);
  }
  // the two moons
  R.frame(...P(-40, -120), 0, { list: 'fixed' }).glow(BALL, 0xe8f0ff, 1.1, 0, 50, 0, 0, 14);
  R.frame(...P(50, -110), 0, { list: 'fixed' }).glow(BALL, 0xffd8c8, 1.0, 0, 70, 0, 0, 7);

  S.people();
  return S.done(LIGHT, () => {});
}
