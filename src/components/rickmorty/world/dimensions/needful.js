// Needful Things ("Something Ricked This Way Comes"): the curiosity shop
// inside, dark wood and deep red walls in lamplight; shelves of cursed
// things down both sides (the typewriter, the aftershave, the beauty cream
// among them), a glass counter at the back with Mr. Needful behind it, and on
// the counter a little model of the shop itself (Meshy), which is for sale.

import { BALL, CYL } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xffd8a0, 0.45], hemi: [0xffe0b8, 0x4a2a1a, 1.55], fog: null, background: 0x120a06 };

export async function buildNeedful(kit) {
  const S = stage(kit, 'needful', { floor: specks('#5a3a24', ['#4e321e', '#664430', '#553620'], 3), wall: 0x7a2a2a, ceiling: 0x3a2418, skirt: 0x2a1a10, dado: [1.0, 0x4a2a1a] });
  const { R, P } = S;

  // the shelves: dark wood, three boards each, crowded with odd things
  const things = [0x8a6a2a, 0x3a6a8a, 0xc8b28a, 0x6a2a4a, 0x2a2a2a, 0xb84a2a, 0x4a8a5a];
  for (const side of [-1, 1]) {
    const [x, z] = P(side * 5.9, -0.5);
    const f = R.frame(x, z, side > 0 ? Math.PI / 2 : -Math.PI / 2);
    f.box(0x3a2416, 0, 0, 0, 7, 2.6, 0.7);
    for (const y of [0.7, 1.4, 2.1]) {
      f.box(0x5a3a22, 0, y, 0.1, 6.9, 0.05, 0.6);
      for (let i = 0; i < 9; i++) {
        const u = -3.1 + i * 0.78;
        const c = things[(i * 3 + Math.round(y * 10)) % things.length];
        if (i % 3 === 0) f.cyl(c, u, y + 0.05, 0.15, 0.12, 0.32);
        else if (i % 3 === 1) f.box(c, u, y + 0.05, 0.15, 0.3, 0.24, 0.3);
        else f.ball(c, u, y + 0.2, 0.15, 0.14);
      }
    }
  }
  // the three things on their own: the typewriter, the aftershave, the cream
  R.frame(...P(-5.3, -2), Math.PI / 2).box(0x2a2a2a, 0, 0.92, 0, 0.5, 0.18, 0.4).box(0x1a1a1a, 0, 1.1, -0.1, 0.4, 0.14, 0.12);
  R.frame(...P(5.3, -2), -Math.PI / 2).cyl(0x3a6a8a, 0, 0.92, 0, 0.07, 0.24).cyl(0xd8b25a, 0, 1.16, 0, 0.03, 0.06);
  R.frame(...P(5.3, 1.5), -Math.PI / 2).cyl(0xf2d8e8, 0, 0.92, 0, 0.09, 0.1).cyl(0xd8b25a, 0, 1.02, 0, 0.095, 0.03);

  // the counter, glass on dark wood, a brass bell and a ledger on it
  const [cx, cz] = P(0, -2.8);
  R.frame(cx, cz, 0).box(0x3a2416, 0, 0, 0, 4, 0.9, 0.7).glow(CYL, 0xfff2d8, 0.5, 0, 0.95, 0, 0, 3.9, 0.02, 0.65).cyl(0xd8b25a, 1.4, 0.98, 0, 0.08, 0.06).box(0x6a2a1a, -1.2, 0.98, 0, 0.5, 0.04, 0.35);
  // the back wall: a clock, a mirror, a mounted head of something
  R.frame(...P(0, -5.3), 0, { list: 'fixed' }).box(0x3a2416, -2.5, 1.5, 0, 0.6, 0.8, 0.06).box(0xbfd8e8, 2.4, 1.3, 0, 1, 1.4, 0.04).ball(0x6a5a3a, 0, 2.3, 0.2, 0.35);
  // lamps: warm globes hanging from the ceiling
  for (const dx of [-3, 0, 3]) R.frame(...P(dx, -0.5), 0, { list: 'fixed' }).cyl(0x2a1a10, 0, S.d.ceiling - 0.6, 0, 0.01, 0.6).glow(BALL, 0xffc070, 1.5, 0, S.d.ceiling - 0.7, 0, 0, 0.3);

  // on the counter, a model of the shop itself, a lamp lit in its window
  S.figure('needful-shop', { x: cx + 0.5, z: cz, face: -Math.PI / 2, h: 0.5, y: 0.95 });

  S.people();
  return S.done(LIGHT);
}
