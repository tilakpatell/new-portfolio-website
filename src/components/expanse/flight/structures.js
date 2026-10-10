// What's built on the planet, drawn: a pool for each kind of entity
// (lib/durable's entity_type), a slot an entity by its id, so a cell's worth
// of turrets is a couple of draws. A turret is two pools, its foot and its
// head (the head turns to aim: aim(id, yaw, pitch)); its health tints it,
// darker and redder as hp falls, which is the bar a turret wears. The
// shared world (./shared.js) says what's here from the loader's events.
//
//   createStructures(parent, palette) → { set(entity), remove(id), has(id),
//     aim(id, yaw, pitch), draw(at), count(), dispose() }

import * as THREE from 'three';
import { createPool } from './pools';
import { beaconGeometry, domeGeometry, turretFoot, turretHead, wedgeGeometry } from './models';
import { TURRET } from './turretRules';

const MAX = 256; // of each kind round the ship: nine cells' worth, with room
const HURT = new THREE.Color('#5a1a12');
const FULL_HP = 100;

export function createStructures(parent, palette) {
  const mat = (hex, extra = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.75, metalness: 0.15, flatShading: true, ...extra });
  const pools = {
    turret: createPool(parent, turretFoot(), mat(palette[2]), MAX),
    head: createPool(parent, turretHead(), mat(palette[4]), MAX),
    structure: createPool(parent, domeGeometry(), mat(palette[1]), MAX),
    beacon: createPool(parent, beaconGeometry(), mat(palette[5], { emissive: new THREE.Color(palette[5]).multiplyScalar(0.4) }), MAX),
    wreck: createPool(parent, wedgeGeometry(), mat(palette[2]), MAX),
  };
  const held = new Map(); // id → entity (as drawn)
  const tint = new THREE.Color();

  const set = (e) => {
    const pool = pools[e.type];
    if (!pool) return;
    const was = held.get(e.id);
    if (was && was.type !== e.type) remove(e.id);
    if (pool.add(e.id) < 0) return;
    held.set(e.id, e);
    const [rx, ry, rz] = e.rot ?? [0, 0, 0];
    // (a wreck lies on its side)
    pool.place(e.id, e.x, e.y, e.z, ry, rx, e.type === 'wreck' ? rz + 0.6 : rz, e.scale ?? 1);
    if (e.type !== 'turret') return;
    pools.head.add(e.id);
    if (!was) pools.head.place(e.id, e.x, e.y + TURRET.height * (e.scale ?? 1), e.z, ry, 0, 0, e.scale ?? 1);
    // white at full health, to a dark red at none (the colour multiplies the material's)
    tint.setRGB(1, 1, 1).lerp(HURT, 1 - Math.max(0, Math.min(1, (e.hp ?? FULL_HP) / FULL_HP)));
    pools.turret.tint(e.id, tint);
    pools.head.tint(e.id, tint);
  };
  const remove = (id) => {
    const e = held.get(id);
    if (!e) return;
    held.delete(id);
    pools[e.type]?.free(id);
    pools.head.free(id);
  };

  return {
    set,
    remove,
    has: (id) => held.has(id),
    aim(id, yaw, pitch) {
      const e = held.get(id);
      if (e) pools.head.place(id, e.x, e.y + TURRET.height * (e.scale ?? 1), e.z, yaw, pitch, 0, e.scale ?? 1);
    },
    draw(at) {
      for (const pool of Object.values(pools)) pool.draw(at);
    },
    count: () => held.size,
    dispose() {
      for (const pool of Object.values(pools)) pool.dispose();
      held.clear();
    },
  };
}
