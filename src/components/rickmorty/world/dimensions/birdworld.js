// Bird World ("Rickdependence Spray"'s and "Auto Erotic Assimilation"'s
// Birdperson): a planet of tall tan clay towers grown round trees, each
// under a flat umbrella canopy like an acacia's, in long golden-green grass
// with teal crystals coming up through it and glowing pods hanging from the
// branches; Birdperson's tower-house (Meshy) at the end of a path of flat
// stones, Birdperson at his door until the wedding (Phoenixperson after it,
// as the show has it), and Unity on a visit.

import * as THREE from 'three';
import { BALL } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xfff8d8, 1.7], hemi: [0xd8f2c8, 0x4a5a2a, 1.3], fog: [0xd2ecc8, 60, 320] };
const CLAY = 0xd8b88a;
const CLAY_DARK = 0xb8946a;
const LEAF = 0xb8d88a;

export async function buildBirdworld(kit) {
  const S = stage(kit, 'birdworld', { ground: specks('#8aa83a', ['#7a9a32', '#9ab84a', '#a8c45a', '#6a8a2a'], 53), groundTile: 6 });
  const { R, P } = S;

  // Birdperson's house, at the end of the path
  S.figure('birdperson-house', { x: P(0, -16)[0], z: P(0, -16)[1], face: -Math.PI / 2, h: 14 });
  for (let i = 0; i < 9; i++) R.frame(...P(Math.sin(i * 0.9) * 0.8, 14 - i * 2.8), i * 0.7, { list: 'fixed' }).cyl(i % 2 ? 0xc8b48a : 0xb8a47a, 0, 0, 0, 0.7, 0.05);

  // a clay tower round a tree, `h` tall, under its canopy
  const tower = (dx, dz, h, r, list = 'solid') => {
    const f = R.frame(...P(dx, dz), dx * 0.2, { list });
    for (let k = 0, y = 0; k < 4; k++) {
      const seg = h / 4;
      f.cyl(k % 2 ? CLAY : CLAY_DARK, Math.sin(k) * 0.3, y, Math.cos(k) * 0.3, r * (1 - k * 0.12), seg);
      // round windows, dark, on the side facing the path
      for (const a of [0.3, -0.5]) f.cyl(0x3a2a1a, Math.sin(a) * r * (1 - k * 0.12), y + seg * 0.5, Math.cos(a) * r * (1 - k * 0.12), 0.35, 0.12, Math.PI / 2);
      y += seg;
    }
    f.cyl(0x7a5a3a, 0, h, 0, 0.5, 3).ball(LEAF, 0, h + 3.2, 0, r * 2.4, 0.12).ball(0xa8c87a, 0, h + 3.4, 0, r * 2, 0.1);
  };
  tower(-22, -15, 12, 3);
  tower(20, -17, 15, 3.4);
  // and the city's beyond the box, hazy
  for (const [dx, dz, h, r] of [
    [-55, -95, 30, 6],
    [-18, -120, 40, 7],
    [26, -110, 34, 6],
    [70, -80, 26, 5],
    [95, -20, 22, 5],
    [-95, -10, 24, 5],
  ])
    tower(dx, dz, h, r, 'fixed');

  // umbrella trees round the clearing
  const tree = (dx, dz, h, list = 'solid') => {
    const f = R.frame(...P(dx, dz), dx, { list });
    f.cyl(0x6a4a2a, 0, 0, 0, 0.45, h).cyl(0x6a4a2a, 0.8, h * 0.7, 0, 0.18, h * 0.3, 0, -0.5).ball(LEAF, 0, h + 0.4, 0, 4.2, 0.18).ball(0x9ac86a, 0.6, h + 0.7, 0.4, 3.2, 0.16);
    // pods hanging from it, glowing orange
    for (const [u, v] of [
      [1.8, 0.6],
      [-1.4, 1.2],
      [0.4, -1.8],
    ])
      f.cyl(0x5a7a2a, u, h - 1.1, v, 0.02, 1.1).glow(BALL, 0xffb84a, 1.6, u, h - 1.3, v, 0, 0.32, 0.5, 0.32);
  };
  tree(-16, 10, 6.5);
  tree(18, 6, 7);
  for (const [dx, dz, h] of [
    [-30, -2, 8],
    [30, -4, 7.5],
    [-28, 18, 6],
    [28, 20, 7],
    [8, 26, 6],
  ])
    tree(dx, dz, h, 'fixed');

  // teal crystals, a cluster by the path and more about
  const shard = R.own(new THREE.ConeGeometry(0.5, 1, 5));
  const crystals = (dx, dz, n, s) => {
    const f = R.frame(...P(dx, dz), dx + dz, { list: 'fixed' });
    for (let i = 0; i < n; i++) {
      const a = i * 2.4;
      f.glow(shard, i % 2 ? 0x7af2e8 : 0x4ad8d0, 1.2, Math.cos(a) * 0.5 * s, 0.4 * s * (1 + (i % 3) * 0.4), Math.sin(a) * 0.5 * s, a, 0.32 * s, 0.8 * s * (1 + (i % 3) * 0.5), 0.32 * s, Math.cos(a) * 0.2, Math.sin(a) * 0.2);
    }
  };
  crystals(-12, 6, 7, 1.4);
  for (const [dx, dz, n] of [
    [6, 9, 4],
    [-6, -4, 3],
    [14, -8, 5],
    [-24, 8, 4],
    [24, 14, 4],
    [-4, 20, 3],
  ])
    crystals(dx, dz, n, 1);
  // long grass in tufts, thin blades leaning out
  const blade = R.own(new THREE.ConeGeometry(0.07, 1, 3));
  for (let i = 0; i < 110; i++) {
    const dx = ((i * 47) % 64) - 32;
    const dz = ((i * 31) % 46) - 23;
    if (Math.abs(dx) < 3 && dz > -12) continue;
    const f = R.frame(...P(dx, dz), i, { list: 'fixed' });
    for (let k = 0; k < 5; k++) f.part(blade, [0xa8c45a, 0x7a9a32, 0xc8d46a][(i + k) % 3], Math.cos(k * 1.3) * 0.16, 0.35 + (k % 2) * 0.1, Math.sin(k * 1.3) * 0.16, 0, 1, 0.7 + (k % 3) * 0.25, 1, Math.cos(k * 1.3) * 0.3, Math.sin(k * 1.3) * 0.3);
  }

  S.people();
  return S.done(LIGHT);
}
