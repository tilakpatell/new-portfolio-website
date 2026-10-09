// Bolts in flight, drawn: one pool of rods, each turned along its way (the
// shared world steps them, ./turretRules.js's stepBolt, and says which are
// in the air). Yours and the other pilots' are the engines' red, a
// turret's the sun's gold, so you can tell what's shooting at you.
//
//   createBolts(parent, palette) → { draw(bolts, at), dispose() }
//   bolts: [{ id, p, v, turret }]

import * as THREE from 'three';
import { createPool } from './pools';
import { boltGeometry } from './models';

const MAX = 160;

export function createBolts(parent, palette) {
  const pool = createPool(parent, boltGeometry(), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }), MAX);
  const ours = new THREE.Color(palette[6]);
  const theirs = new THREE.Color(palette[5]);
  const seen = new Set();
  return {
    draw(bolts, at) {
      seen.clear();
      for (const b of bolts) {
        const fresh = !pool.has(b.id);
        if (pool.add(b.id) < 0) continue;
        if (fresh) pool.tint(b.id, b.turret ? theirs : ours);
        seen.add(b.id);
        const [vx, vy, vz] = b.v;
        pool.place(b.id, b.p[0], b.p[1], b.p[2], Math.atan2(-vx, -vz), Math.atan2(vy, Math.hypot(vx, vz)), 0);
      }
      for (const id of [...pool.ids()]) if (!seen.has(id)) pool.free(id);
      pool.draw(at);
    },
    dispose: () => pool.dispose(),
  };
}
