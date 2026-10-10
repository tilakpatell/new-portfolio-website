// Gazorpazorp ("Raising Gazorpazorp"): a red-orange desert under a dusk sky
// with two suns, one big and orange, one small and white; the women's city
// cut into a wall of red rock across the north, its balconies and windows
// lit, smooth pink domes rising beyond it, and its gate with Mar-Sha's dais
// before it; boulders and dunes, two Gazorpians squaring up over a rock, and
// Morty Jr. by the portal with the book he wrote about his father.

import { BALL } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xffc890, 1.5], hemi: [0xffb08a, 0x5a2a1a, 1.2], fog: [0xc8704a, 60, 300] };
const ROCK = 0xa84a32;
const ROCK_DARK = 0x8a3a28;

export async function buildGazorpazorp(kit) {
  const S = stage(kit, 'gazorpazorp', { ground: specks('#c85a32', ['#b84a2a', '#d86a3a', '#e07a4a', '#a8442a'], 41), groundTile: 6 });
  const { R, P } = S;

  // the two suns
  R.frame(...P(-80, -260), 0, { list: 'fixed' }).glow(BALL, 0xff9a4a, 1.5, 0, 60, 0, 0, 44);
  R.frame(...P(70, -240), 0, { list: 'fixed' }).glow(BALL, 0xfff2d8, 1.8, 0, 95, 0, 0, 12);

  // the wall of the women's city: two great runs of red rock, the gate between
  for (const side of [-1, 1]) {
    const f = R.frame(...P(side * 19, -21), 0);
    f.box(ROCK, 0, 0, 0, 30, 12, 6).box(ROCK_DARK, 0, 12, -0.6, 28, 2.4, 4.6);
    // balconies with railings, and lit windows, in rows up the face
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 4; i++) {
        const u = -10.5 + i * 7 + (row % 2) * 2;
        const y = 2.6 + row * 3.2;
        f.box(0x2a1410, u, y, 3.02, 1.4, 1.8, 0.05).box(0xffc070, u, y + 0.3, 3.04, 0.9, 1, 0.04);
        f.box(0xc8a24a, u, y - 0.15, 3.5, 2.4, 0.15, 1).box(0xe8c46a, u, y, 3.95, 2.4, 0.5, 0.06);
      }
  }
  // the gate: a tall pointed doorway, its doors shut, gold over it
  const g = R.frame(...P(0, -21.4), 0);
  g.box(ROCK_DARK, -4.6, 0, 0, 1.2, 13, 6).box(ROCK_DARK, 4.6, 0, 0, 1.2, 13, 6).box(ROCK, 0, 9, 0, 8, 4, 6);
  g.box(0x5a2a1a, -1.9, 0, 2.6, 3.6, 8.4, 0.3).box(0x5a2a1a, 1.9, 0, 2.6, 3.6, 8.4, 0.3).box(0x2a1410, 0, 0, 2.8, 0.1, 8.4, 0.12);
  g.box(0xe8c46a, 0, 8.6, 3.05, 7, 0.5, 0.1).box(0xd84a3a, 0, 8.75, 3.12, 1.2, 0.3, 0.06);
  // Mar-Sha's dais before it, gold-edged steps
  R.frame(...P(0, -16.6), 0).box(0xc8a24a, 0, 0, 0, 4, 0.3, 2.4).box(0xe8c46a, 0, 0.3, 0, 3.4, 0.08, 1.8);
  // banners either side of the gate
  for (const dx of [-7, 7]) R.frame(...P(dx, -17.94), 0, { list: 'fixed' }).box(0x2a6ab8, 0, 3, 0, 1.4, 5, 0.06).box(0xe8c46a, 0, 3, 0.04, 1.4, 0.3, 0.05).box(0xe8c46a, 0, 7.7, 0.04, 1.4, 0.3, 0.05);

  // the city's domes beyond the wall
  for (const [dx, dz, r] of [
    [-14, -34, 9],
    [6, -38, 12],
    [22, -32, 7],
    [-30, -40, 10],
  ])
    R.frame(...P(dx, dz), 0, { list: 'fixed' }).ball(0xe89a8a, 0, 12, 0, r, 0.8).cyl(0xe8c46a, 0, 12 + r * 0.75, 0, 0.3, 3);

  // boulders where the solids are, and dunes round the box
  for (const [dx, dz, r] of [
    [15, -12, 2.4],
    [-18, 2, 3],
    [24, 10, 2.2],
  ])
    R.frame(...P(dx, dz), dx * 0.3).ball(ROCK, 0, r * 0.55, 0, r, 0.8).ball(ROCK_DARK, r * 0.4, r * 0.2, r * 0.3, r * 0.6, 0.7);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 62 + (i % 3) * 8;
    R.frame(...P(Math.cos(a) * r, Math.sin(a) * r * 0.7), a, { list: 'fixed' }).ball(i % 2 ? 0xd86a3a : 0xc85a32, 0, -2, 0, 12 + (i % 4) * 3, 0.35);
  }
  // the rock the two Gazorpians are fighting over
  R.frame(...P(15, -1), 0.6).ball(ROCK_DARK, 0, 0.4, 0, 0.55, 0.8);
  // Morty Jr.'s book, in a stack by him
  R.frame(...P(-10.4, 9.6), 0.3, { list: 'fixed' }).box(0x8a2a2a, 0, 0, 0, 0.32, 0.06, 0.24).box(0x2a4a8a, 0, 0.06, 0, 0.3, 0.06, 0.22).box(0x8a2a2a, 0, 0.12, 0, 0.32, 0.06, 0.24);

  S.people();
  return S.done(LIGHT);
}
