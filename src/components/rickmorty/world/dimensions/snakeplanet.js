// Snake Planet ("Rattlestar Ricklactica"): dusty purple ground under a big
// moon, rocks, the snakes' launch pad with their rocket on it (a model), a
// sign in snake, and a hole with eyes in it. The snakes themselves are
// models placed from ./destinations.js, slithering their rounds (stage.js's
// NPC behaviour) and striking at anyone who comes close.

import { BALL, BOX, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xffd8b0, 1.05], hemi: [0xb89ad8, 0x4a3a4a, 1.3], fog: [0x9a7a9a, 60, 280] };

export async function buildSnakeplanet(kit) {
  const S = stage(kit, 'snakeplanet', { ground: specks('#7a5a7a', ['#6a4a6a', '#8a6a8a', '#9a7a6a'], 13, 1600, 2), groundTile: 6 });
  const { R, P } = S;

  // rocks
  for (const [dx, dz, r, c] of [
    [-24, -12, 3, 0x5a3a5a],
    [26, 10, 2.6, 0x6a4a5a],
    [-6, -16, 2.2, 0x5a3a5a],
    [-30, 10, 1.8, 0x6a4a6a],
    [30, -6, 2, 0x5a3a5a],
  ]) R.frame(...P(dx, dz), 0.3).ball(c, 0, 0, 0, r, 0.75).ball(c, r * 0.5, 0.1, r * 0.3, r * 0.5, 0.6);
  // the launch pad: a concrete slab, scaffold poles and a gantry light
  const [px, pz] = P(18, -18);
  const G = R.frame(px, pz, 0);
  G.box(0x8a8a8a, 0, 0, 0, 6, 0.4, 4).box(0xc8c8c8, 0, 0.4, 0, 6.1, 0.04, 4.1);
  for (const [u, v] of [
    [-2.6, -1.6],
    [2.6, -1.6],
    [-2.6, 1.6],
  ]) G.cyl(0x6a6a70, u, 0.4, v, 0.08, 5);
  G.box(0x6a6a70, 0, 5.3, -1.6, 5.4, 0.1, 0.1).glow(BALL, 0xff5a3a, 1.6, 0, 5.5, -1.6, 0, 0.2);
  // the sign, in snake
  R.cell('snakesign', 160, 80, (g, w, h) => {
    g.fillStyle = '#d8c8a8';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3a2a3a';
    g.lineWidth = 5;
    g.beginPath();
    for (let x = 12; x < w - 12; x += 4) g.lineTo(x, h / 2 + Math.sin(x * 0.18) * 14);
    g.stroke();
    g.fillStyle = '#3a2a3a';
    g.beginPath();
    g.arc(w - 18, h / 2, 5, 0, Math.PI * 2);
    g.fill();
    fitText(g, 'ssss', w / 2, h - 12, 60, 10, { color: '#3a2a3a', weight: '400' });
  });
  R.frame(...P(-6, 15.6), Math.PI).box(0x5a4a3a, 0, 0, 0, 0.14, 1.9, 0.14).box(0xd8c8a8, 0, 1.6, 0, 1.8, 0.9, 0.08).decal('snakesign', 0, 2.05, 0.05, 1.7, 0.85);
  // the hole, with eyes in it
  const [hx, hz] = P(-20, 12);
  R.frame(hx, hz, 0).cyl(0x1a0a1a, 0, 0.01, 0, 1.4, 0.04);
  for (let k = 0; k < 7; k++) R.frame(hx, hz, 0, { list: 'fixed' }).glow(BALL, 0xffe24a, 1.5, Math.cos(k * 2.1) * 0.8, 0.06, Math.sin(k * 2.1) * 0.8, 0, 0.07);
  // the moon, big and low in the north
  R.frame(...P(0, -120), 0, { list: 'fixed' }).glow(BALL, 0xf6e8d8, 1.1, 0, 60, 0, 0, 34);
  R.frame(...P(0, -119.5), 0, { list: 'fixed' }).glow(BOX, 0xd8c8b8, 1.0, -10, 68, 0, 0.3, 8, 6, 2);

  S.people();
  return S.done(LIGHT, () => {});
}
