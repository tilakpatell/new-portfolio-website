// Froopyland ("The ABC's of Beth"): the world Rick made for Beth, soft and
// candy-coloured. Pink ground with a sheen, hills like mattresses, lollipop
// trees, a river of honey, and the sign a child wrote and a grown man went
// over. Tommy and the Froopylanders are models placed from
// ./destinations.js (the creatures hunt whoever comes close).

import * as THREE from 'three';
import { BALL, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xfff0e0, 1.1], hemi: [0xffc8e8, 0xd88ab8, 1.5], fog: [0xffc8e0, 60, 280] };

export async function buildFroopyland(kit) {
  const S = stage(kit, 'froopyland', { ground: specks('#f28ac8', ['#e87ab8', '#fa9ad4', '#ffb0e0'], 23, 1200, 3), groundTile: 7 });
  const { R, P } = S;

  // the hills: soft domes in candy colours, a stripe round each
  for (const [dx, dz, r, c] of [
    [24, 6, 5, 0xff9ad8],
    [-26, 14, 4.5, 0xa8e8ff],
    [10, -20, 4, 0xfff09a],
    [-30, -18, 6, 0xb8ffb0],
    [30, -16, 5.5, 0xffc090],
  ]) {
    const f = R.frame(...P(dx, dz), 0);
    f.ball(c, 0, -r * 0.35, 0, r, 1);
    f.ball(0xffffff, 0, r * 0.1, 0, r * 0.99, 0.12);
  }
  // lollipop trees
  for (const [dx, dz, c] of [
    [-10, -10, 0xff6ab0],
    [14, 6, 0x6ad8ff],
    [-4, 12, 0xffd84a],
    [22, -8, 0xa86aff],
    [-22, 2, 0x6aff9a],
  ]) R.frame(...P(dx, dz), 0).cyl(0xffffff, 0, 0, 0, 0.18, 3.2).ball(c, 0, 4.2, 0, 1.4).ball(0xffffff, 0, 4.2, 0, 1.45, 0.12);
  // the honey river, slow and gold, with a glow along it
  const honey = R.own(new THREE.MeshBasicMaterial({ color: 0xffb830, transparent: true, opacity: 0.9 }));
  const river = new THREE.Mesh(R.own(new THREE.PlaneGeometry(70, 5)), honey);
  river.rotation.x = -Math.PI / 2;
  river.rotation.z = 0.25;
  river.position.set(...[P(-8, -19)[0], 0.03, P(-8, -19)[1]]);
  R.add(river, { ink: false });
  for (let i = -5; i <= 5; i++) R.frame(...P(-8 + i * 6, -19 - i * 1.5), 0, { list: 'fixed' }).glow(BALL, 0xffd880, 1.3, 0, 0.1, 0, 0, 1.2, 0.1, 1.2);
  // the sign
  R.cell('froopysign', 192, 96, (g, w, h) => {
    g.fillStyle = '#f6e6b0';
    g.fillRect(0, 0, w, h);
    fitText(g, 'FROOPYLAND', w / 2, h * 0.3, w - 16, 26, { color: '#d8306a', font: 'Comic Sans MS, Marker Felt, cursive' });
    fitText(g, 'pop. 1 + froopylanders', w / 2, h * 0.62, w - 20, 13, { color: '#3a2a2a', font: 'Comic Sans MS, Marker Felt, cursive', weight: '400' });
    fitText(g, 'NO RICKS', w / 2, h * 0.85, w - 20, 13, { color: '#3a2a2a', font: 'Comic Sans MS, Marker Felt, cursive', weight: '400' });
  });
  R.frame(...P(-6, 15.6), Math.PI).box(0x8a5a3a, 0, 0, 0, 0.14, 1.9, 0.14).box(0xf6e6b0, 0, 1.6, 0, 1.8, 0.9, 0.08).decal('froopysign', 0, 2.05, 0.05, 1.7, 0.85);

  S.people();
  return S.done(LIGHT, (t) => {
    honey.color.setHSL(0.1, 1, 0.58 + Math.sin(t * 0.8) * 0.03);
  });
}
