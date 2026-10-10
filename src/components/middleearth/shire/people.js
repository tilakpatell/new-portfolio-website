// The hobbits (and a wizard) of the Shire world, from the map's toy figures
// (../mapFigures.js), dressed for the party, and packed so each costs a
// dozen draws rather than fifty: the parts that move together and share a
// colour are merged into one mesh. Each goes on the cast once its model's
// here (../cast3d.js: Frodo as Frodo, a guest as the Shire's hobbit or
// Rosie in her colours, what the toy holds in the cast's hands), the toy
// until then and if it never comes; sit, dance and calm tell the cast as
// they pose the toy.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeToyFigure } from '../mapFigures';
import { castFigure, upgrade } from '../cast3d';

export const LOOKS = {
  frodo: { hair: 0x3a2214, coat: 0x7a4a2a, shirt: 0xf2ead8, ring: true, seed: 1 },
  sam: { hair: 0x8a5a2b, coat: 0xb8873a, shirt: 0xe8dcc0, seed: 2 },
  bilbo: { hair: 0xc9c2b8, coat: 0xb5432e, shirt: 0xf4ecd8, seed: 3 },
  gandalf: { tall: 1.55, robe: 0x7c7f88, hat: 'wizard', hairStyle: 'long', hair: 0xd8d4cc, beard: { color: 0xe4e0d8, len: 0.42 }, item: 'staff', feet: 'boots', seed: 5 },
  merry: { hair: 0x9a6a3a, coat: 0x3d5a7a, shirt: 0xeee4cc, seed: 21 },
  pippin: { hair: 0x6a4020, coat: 0x5a6e2e, shirt: 0xf0e6d0, seed: 23 },
  rosie: { robe: 0xc0705e, hairStyle: 'long', hair: 0xa0602a, shirt: 0xf4ead8, seed: 25 },
  maggot: { tall: 1.12, wide: 1.3, hair: 0x6a5a4a, beard: { color: 0x7a6a5a, len: 0.22 }, coat: 0x5a4a2a, shirt: 0xc8b890, feet: 'boots', seed: 27 },
  gaffer: { hair: 0xd8d2c8, coat: 0x6a5a3a, shirt: 0xd8ccb0, seed: 29 },
  // Lobelia Sackville-Baggins, in her best plum, with her umbrella
  lobelia: { robe: 0x5e2a52, hairStyle: 'long', hair: 0x6e6258, shirt: 0xe8dcc8, umbrella: true, seed: 31 },
};
const CROWD = [0x8a3a5a, 0x3a6a5a, 0xc08a3a, 0x5a3a8a, 0xa05a2a, 0x2a5a8a, 0x7a7a2a, 0x9a3a3a];
const HAIR = [0x3a2214, 0x8a5a2b, 0x5a3a1a, 0xa0703a, 0x2a1a10];

// A key for a material, so look-alike materials made separately merge.
const keyOf = (m) => [m.type, m.color?.getHexString(), m.emissive?.getHexString(), m.roughness, m.metalness, m.side, m.transparent, m.opacity].join('|');

// Merge each group's leaf meshes that look the same into one mesh. The
// groups themselves (body, head, legs, arms) stay, so the figure still poses.
export function compact(root) {
  const groups = [];
  root.traverse((o) => {
    if (!o.isMesh) groups.push(o);
  });
  for (const g of groups) {
    const leaves = g.children.filter((c) => c.isMesh && c.children.length === 0 && !c.isInstancedMesh);
    if (leaves.length < 2) continue;
    const buckets = new Map();
    for (const m of leaves) {
      const k = keyOf(m.material) + (m.geometry.index ? 'i' : 'n') + Object.keys(m.geometry.attributes).sort().join();
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(m);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const geos = list.map((m) => {
        m.updateMatrix();
        return m.geometry.clone().applyMatrix4(m.matrix);
      });
      const merged = mergeGeometries(geos, false);
      geos.forEach((x) => x.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, list[0].material);
      mesh.castShadow = list.some((m) => m.castShadow);
      mesh.receiveShadow = list.some((m) => m.receiveShadow);
      g.add(mesh);
      for (const m of list) {
        g.remove(m);
        m.geometry.dispose();
        if (m.material !== list[0].material) m.material.dispose();
      }
    }
  }
  return root;
}

// One of the cast, by name, or a party guest (`guest: n`).
export function makePerson(id, { guest = null } = {}) {
  let look = LOOKS[id];
  if (guest != null) {
    look = { hair: HAIR[guest % HAIR.length], coat: CROWD[guest % CROWD.length], shirt: 0xf0e6d0, seed: 40 + guest };
    if (guest % 3 === 1) look = { ...look, robe: CROWD[(guest + 3) % CROWD.length], hairStyle: 'long' };
  }
  const f = makeToyFigure(look);
  compact(f.group);
  f.group.name = id;
  // the Ring on Frodo's waistcoat: shown once he has it
  if (look.ring) {
    f.group.traverse((o) => {
      if (o.isMesh && o.geometry.type === 'TorusGeometry') f.ringMesh = o;
    });
  }
  if (look.umbrella) f.umbrella = umbrella(f.arms[1]);
  f.top = f.baseY + 0.5 * (look.tall ?? 1) + 0.3 + 0.32 + (look.hat === 'wizard' ? 0.9 : 0);
  if (guest != null) upgrade(f, guest % 3 === 1 ? 'rosie' : 'hobbit', { look, role: 'folk' });
  else castFigure(f, id, look, { town: 'shire' });
  return f;
}

// A furled umbrella in the right hand, used as a walking stick: crook on
// top, plum silk wrapped tight, a ferrule at the tip.
function umbrella(arm) {
  const g = new THREE.Group();
  g.position.set(0.05, -0.32, 0);
  // (an umbrella in a hand, gripped under its crook: lib/three/held.js's kinds)
  g.userData.held = { kind: 'umbrella' };
  const grip = new THREE.Object3D();
  grip.name = 'grip';
  grip.position.y = 0.1;
  g.add(grip);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.6 });
  const silk = new THREE.MeshStandardMaterial({ color: 0x3e1838, roughness: 0.75 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.66, 6), new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.5 }));
  shaft.position.y = -0.2;
  const furl = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.38, 8), silk);
  furl.rotation.x = Math.PI;
  furl.position.y = -0.3;
  const crook = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI), wood);
  crook.position.set(0.05, 0.13, 0);
  g.add(shaft, furl, crook);
  arm.add(g);
  return g;
}

// Sitting on a bench: legs out in front, a little lower. `how`: 'floor'
// for sitting on the ground (the cast sits cross-legged there, on a seat
// otherwise; its hips where the toy's are, as the town put them).
export function sit(f, on = true, how = null) {
  f.sitting = on;
  f.cast?.sit(on, how);
  for (const leg of f.legs) {
    leg.rotation.z = on ? 1.45 : 0;
  }
}

// A merrymaker's dance: hop and turn.
export function dance(f, t, phase) {
  f.cast?.dance(true);
  const hop = Math.max(0, Math.sin(t * 7 + phase));
  f.body.position.y = f.baseY + hop * 0.12;
  f.legs[0].rotation.z = Math.sin(t * 7 + phase) * 0.5;
  f.legs[1].rotation.z = -Math.sin(t * 7 + phase) * 0.5;
  f.arms[0].rotation.x = 2.4 + Math.sin(t * 3.5 + phase) * 0.4;
  f.arms[1].rotation.x = -2.4 - Math.sin(t * 3.5 + phase) * 0.4;
}

// Back to standing, after a dance.
export function calm(f) {
  f.cast?.dance(false);
  f.arms[0].rotation.x = 0;
  f.arms[1].rotation.x = 0;
}
