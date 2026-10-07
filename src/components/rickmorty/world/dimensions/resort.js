// The Immortality Field Resort ("The Whirly Dirly Conspiracy"): lawns and
// a pool under the field's shimmer, the field generator's rings, the pool
// bar, palms, the Whirly Dirly's track climbing out of the field with a car
// on it (a model), and the guests about (models, ./destinations.js).
// Risotto Groupon runs the place.

import * as THREE from 'three';
import { BALL, BOX } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xfff8e8, 1.2], hemi: [0xbfe4ff, 0x6a8a5a, 1.4], fog: [0xbfe0f8, 70, 300] };

export async function buildResort(kit) {
  const S = stage(kit, 'resort', { ground: specks('#6ab84a', ['#5aa83e', '#7ac856', '#8ad060'], 29, 1800, 1.8), groundTile: 5 });
  const { R, P } = S;

  // the field: a faint blue dome, and the generator's rings at its post
  const dome = new THREE.Mesh(R.own(new THREE.SphereGeometry(34, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)), R.own(new THREE.MeshBasicMaterial({ color: 0x6ad8ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })));
  dome.position.set(...[P(0, 0)[0], 0, P(0, 0)[1]]);
  R.add(dome, { ink: false });
  const G = R.frame(...P(-16, -18.4), 0);
  G.cyl(0x4a5a6a, 0, 0, 0, 1.6, 0.6).cyl(0x9aa8b8, 0, 0.6, 0, 0.5, 5);
  const rings = [];
  for (let k = 0; k < 4; k++) {
    const r = new THREE.Mesh(R.own(new THREE.TorusGeometry(1.2 - k * 0.15, 0.06, 8, 32)), R.own(new THREE.MeshBasicMaterial({ color: 0x6ad8ff })));
    r.position.set(P(-16, -18.4)[0], 1.6 + k * 1.1, P(-16, -18.4)[1]);
    r.rotation.x = Math.PI / 2;
    R.add(r, { ink: false });
    rings.push(r);
  }
  // the pool and the bar
  const [px, pz] = P(-6, 16);
  R.frame(px, pz, 0).box(0xf6f2e8, 0, 0, 0, 12.6, 0.3, 6.6);
  const water = new THREE.Mesh(R.own(new THREE.PlaneGeometry(12, 6)), R.own(new THREE.MeshBasicMaterial({ color: 0x4ad8ff, transparent: true, opacity: 0.85 })));
  water.rotation.x = -Math.PI / 2;
  water.position.set(px, 0.32, pz);
  R.add(water, { ink: false });
  const B = R.frame(...P(-6, 10.4), 0);
  B.box(0x8a5a3a, 0, 0, 0, 5, 1.1, 1.2).box(0xd8a24a, 0, 1.1, 0, 5.2, 0.08, 1.3).box(0xc8a24a, 0, 2.6, 0, 5.6, 0.3, 2.4).cyl(0x8a5a3a, -2.3, 1.2, 0, 0.08, 1.4).cyl(0x8a5a3a, 2.3, 1.2, 0, 0.08, 1.4);
  for (let k = 0; k < 4; k++) B.glow(BALL, [0xff6a6a, 0xffe24a, 0x6aff9a, 0x6ad8ff][k], 1.5, -1.5 + k, 1.2, 0, 0, 0.12);
  // palms
  for (const [dx, dz] of [
    [22, 8],
    [-26, 2],
  ]) {
    const f = R.frame(...P(dx, dz), 0);
    f.cyl(0x8a6a4a, 0, 0, 0, 0.3, 6, 0, 0.1);
    for (let k = 0; k < 6; k++) f.box(0x3aa85a, Math.cos((k / 6) * Math.PI * 2) * 1.6, 5.8, Math.sin((k / 6) * Math.PI * 2) * 1.6, 3.2, 0.1, 0.8, (k / 6) * Math.PI * 2 + Math.PI / 2, 0, 0.5);
  }
  // the Whirly Dirly's track: a blue rail climbing from the car's platform up and out of the dome
  const [cx, cz] = P(14, -16);
  R.frame(cx, cz, 0).box(0x4a5a6a, 0, 0, 0, 4, 0.3, 2.6);
  const pts = [
    [cx, 0.3, cz],
    [cx + 6, 2, cz - 4],
    [cx + 10, 8, cz - 10],
    [cx + 6, 16, cz - 18],
    [cx - 4, 24, cz - 24],
    [cx - 14, 20, cz - 30],
  ];
  const rail = new THREE.Mesh(R.own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 40, 0.12, 6, false)), R.own(new THREE.MeshStandardMaterial({ color: 0x3a7ad8, roughness: 0.6 })));
  R.add(rail);
  for (const [x, y, z] of pts.slice(1, 5)) R.frame(x, z, 0, { list: 'fixed' }).box(0x6a7a8a, 0, 0, 0, 0.3, y, 0.3);
  R.frame(...P(20, -20), 0).cyl(0x6a7a8a, 0, 0, 0, 0.6, 1).glow(BOX, 0xffe24a, 1.4, 0, 1.1, 0, 0, 0.8, 0.2, 0.8);
  R.frame(...P(8, -22), 0).cyl(0x6a7a8a, 0, 0, 0, 0.6, 1);

  S.people();
  return S.done(LIGHT, (t) => {
    for (const [k, r] of rings.entries()) r.rotation.z = t * (0.6 + k * 0.2);
    water.material.opacity = 0.8 + Math.sin(t * 1.3) * 0.05;
  });
}
