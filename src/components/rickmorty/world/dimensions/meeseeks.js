// The Meeseeks' golf course ("Meeseeks and Destroy"): a green fairway under
// a kind sky, a tee with Jerry on it, bunkers, a flag on the ninth, a golf
// cart, trees, and the Meeseeks box on a post. The Meeseeks (the cast's own,
// rigged) stand about Jerry and wander the course (./destinations.js);
// pressing the box ('swarm') sets every one of them on Morty, and the way
// home inside the clock is the thing done.

import { BALL, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xfff8e8, 1.25], hemi: [0xbfe4ff, 0x4a7a3a, 1.4], fog: [0xbfe0f8, 70, 300] };

export async function buildMeeseeks(kit) {
  const S = stage(kit, 'meeseeksgolf', { ground: specks('#4a9a3a', ['#429232', '#52a242', '#5aaa4a'], 47, 2000, 1.8), groundTile: 5 });
  const { R, P } = S;

  // the tee: a raised square of finer grass with markers
  R.frame(...P(0, -4), 0).box(0x5aaa4a, 0, 0, 0, 5, 0.2, 4);
  for (const u of [-2, 2]) R.frame(...P(u, -4), 0, { list: 'fixed' }).ball(0xffffff, 0, 0.3, 0, 0.12);
  // bunkers, the ninth's green and flag, the cart, trees, the box on its post
  R.frame(...P(10, -16), 0).cyl(0xe8d8a8, 0, 0.01, 0, 3, 0.04).cyl(0xe8d8a8, 1.4, 0.01, 1, 1.6, 0.04);
  R.frame(...P(-20, -16), 0).cyl(0x6ab85a, 0, 0.01, 0, 4, 0.04).cyl(0x111111, 0, 0.02, 0, 0.12, 0.02).cyl(0xf6f6f6, 0, 0, 0, 0.03, 2.4).box(0xc83a3a, 0.3, 2, 0, 0.6, 0.4, 0.02);
  const Cz = R.frame(...P(18, 10), 0.4);
  Cz.box(0xf6f6f6, 0, 0.4, 0, 3, 0.6, 1.8).box(0xf6f6f6, 0, 1, 0, 2.8, 0.1, 1.6).box(0xf6f6f6, 0, 1.8, 0, 3, 0.1, 1.8).cyl(0xf6f6f6, -1.3, 1.1, -0.8, 0.04, 0.7).cyl(0xf6f6f6, 1.3, 1.1, -0.8, 0.04, 0.7).cyl(0xf6f6f6, -1.3, 1.1, 0.8, 0.04, 0.7).cyl(0xf6f6f6, 1.3, 1.1, 0.8, 0.04, 0.7);
  for (const u of [-1, 1]) for (const v of [-0.7, 0.7]) Cz.cyl(0x1a1a1a, u, 0, v, 0.3, 0.25, Math.PI / 2);
  for (const [dx, dz] of [
    [-24, 6],
    [26, -8],
    [-28, -8],
    [28, 12],
  ]) R.frame(...P(dx, dz), 0).cyl(0x6a4a2a, 0, 0, 0, 0.4, 3).ball(0x3a8a3a, 0, 4.4, 0, 2.6).ball(0x4a9a4a, 0.8, 5.4, 0.4, 1.6);
  const [bx, bz] = P(14, -13.6);
  R.frame(bx, bz, 0).cyl(0x5a4a3a, 0, 0, 0, 0.1, 1.1).box(0x3a6ad8, 0, 1.1, 0, 0.6, 0.5, 0.6).box(0xc8d8f0, 0, 1.6, 0, 0.44, 0.03, 0.44).cyl(0xff3a3a, 0, 1.6, 0, 0.1, 0.08);
  R.cell('meeseekssign', 128, 48, (g, w, h) => {
    g.fillStyle = '#f6f2e0';
    g.fillRect(0, 0, w, h);
    fitText(g, 'PRESS ONCE', w / 2, h / 2, w - 10, 14, { color: '#3a6ad8' });
  });
  R.frame(bx, bz, 0).box(0x5a4a3a, 0.6, 0, 0, 0.06, 1.4, 0.06).decal('meeseekssign', 0.6, 1.3, 0.04, 0.8, 0.3);
  // a few balls lying about
  for (let k = 0; k < 7; k++) R.frame(...P(-18 + (k * 11) % 36, -10 + ((k * 7) % 22)), 0, { list: 'fixed' }).ball(0xffffff, 0, 0.04, 0, 0.05);
  R.frame(...P(0, -40), 0, { list: 'fixed' }).glow(BALL, 0xfff8e8, 0.0, 0, 0, 0, 0, 0.01);

  S.people();
  const area = S.done(LIGHT, () => {});
  area.actions = {
    ...area.actions,
    swarm: () => S.hunt(true),
  };
  return area;
}
