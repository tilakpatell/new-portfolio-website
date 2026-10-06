// Gear World ("Auto Erotic Assimilation"'s neighbour, Gearhead's home in
// "Mortynight Run"): a brass and copper city on the face of a vast cog under
// an amber sky; towers of stacked gears turning slowly, Gearhead's shop at
// the west with him at its door, a great wheel turning beside the square,
// cog-shaped lamps, and gear people about.

import * as THREE from 'three';
import { BALL } from '../interiors/shell';
import { stage } from './stage';

const LIGHT = { sun: [0xffe2b0, 1.7], hemi: [0xffd8a0, 0x5a3a1a, 1.25], fog: [0xc98a4a, 60, 300] };

// the cog painted on the ground: rings of brass plate and rivets
const COG = (g, w, h) => {
  g.fillStyle = '#9a7a4a';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#7a5a32';
  g.lineWidth = 3;
  for (let y = 0; y < h; y += 32) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  g.fillStyle = '#c8a26a';
  for (let y = 16; y < h; y += 32) for (let x = 8; x < w; x += 24) g.fillRect(x, y - 2, 4, 4);
};

// a gear: a toothed wheel as one geometry, lying flat (y up), radius r, `teeth` of them
function gearGeo(r, teeth, thick) {
  const s = new THREE.Shape();
  const inner = r * 0.86;
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const rr = i % 4 < 2 ? r : inner;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.25, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2);
}

export async function buildGearworld(kit) {
  const S = stage(kit, 'gearworld', { ground: COG, groundTile: 8 });
  const { R, P } = S;

  // the towers: stacks of gears, each layer turning its own way
  const turning = [];
  const brass = [0xc8a24a, 0xb87a3a, 0xd8b86a, 0x9a6a3a];
  const tower = (dx, dz, r, layers) => {
    const [x, z] = P(dx, dz);
    for (let i = 0; i < layers; i++) {
      const rr = r * (1 - i * 0.12);
      const geo = R.own(gearGeo(rr, 10 + Math.round(rr * 2), 1.4));
      const m = new THREE.Mesh(geo, kit.mats.toon(brass[i % brass.length]));
      m.position.set(x, i * 1.6, z);
      R.add(m);
      turning.push([m, (i % 2 ? 1 : -1) * (0.15 + 0.4 / rr)]);
      R.frame(x, z, 0).cyl(0x5a3a1a, 0, i * 1.6, 0, rr * 0.3, 1.6);
    }
  };
  tower(-22, -12, 5, 6);
  tower(22, -14, 6, 8);
  tower(23, 7, 4, 5);
  tower(-23, 8, 4, 4);
  // the great wheel by the square, upright, turning
  const [wx, wz] = P(9, -12);
  const wheel = new THREE.Mesh(R.own(gearGeo(3.2, 14, 0.6).rotateX(Math.PI / 2)), kit.mats.toon(0xd8b86a));
  wheel.position.set(wx, 3.4, wz);
  R.add(wheel);
  R.frame(wx, wz, 0).box(0x5a3a1a, -0.6, 0, 0, 0.3, 3.4, 0.3).box(0x5a3a1a, 0.6, 0, 0, 0.3, 3.4, 0.3);

  // Gearhead's shop: a copper front, a big gear over the door, a window of cogs
  const [sx, sz] = P(-7, -11.5);
  const shop = R.frame(sx, sz, 0);
  shop.box(0xb87a3a, 0, 0, 0, 8, 4.2, 5).box(0x7a4a22, 0, 4.2, 0, 8.4, 0.4, 5.4).box(0x3a2a1a, -1.8, 0, 2.52, 1.3, 2.4, 0.08).box(0xffd98a, 1.6, 1.2, 2.52, 2.6, 1.6, 0.06);
  const sign = new THREE.Mesh(R.own(gearGeo(1.1, 10, 0.25).rotateX(Math.PI / 2)), kit.mats.toon(0xe8c84a));
  sign.position.set(sx, 4.9, sz + 2.6);
  R.add(sign);
  turning.push([sign, 0.6]);

  // lamps: posts with a little gear for a shade, lit
  for (const [dx, dz] of [
    [-4, 4],
    [6, 4],
    [-14, -3],
    [14, -4],
  ])
    R.frame(...P(dx, dz), 0).cyl(0x5a3a1a, 0, 0, 0, 0.08, 3).cyl(0xc8a24a, 0, 3, 0, 0.45, 0.12).glow(BALL, 0xffd890, 1.5, 0, 2.8, 0, 0, 0.3);

  S.people();
  return S.done(LIGHT, (t, dt) => {
    for (const [m, w] of turning) m.rotation.y += w * dt;
    wheel.rotation.z += 0.3 * dt;
  });
}
