// A level's placed decals (lane E0: a pack's decals.json, scripts/lib/
// bf2017-level-decals.mjs): the burns, scorches, stains and signage the game
// lays over its pieces. A fixed pool by tier, filled each update with the
// nearest, so nothing is made or freed as the visitor walks. Each is a quad
// over its box's floor (the box's local x and z, facing its local +y), its
// colour map at the box's alpha, drawn after the ground and lifted by a
// polygon offset: a box projection against 13,984 decals' worth of cell
// meshes is too heavy for the GLSL path, and the quad is the same on the
// node renderer (a standard material either way).
//
//   DECAL_POOL: { low: 0, mid: 24, high: 64, ultra: 128 }
//   pickDecals(list, [x, z], max) → the nearest `max`, nearest first (pure)
//   createDecals(scene, { loadTexture(path) → Promise<Texture>, tier })
//     → { set(list), update([x, z]), count(), dispose() }

import * as THREE from 'three';

export const DECAL_POOL = { low: 0, mid: 24, high: 64, ultra: 128 };

export function pickDecals(list, [x, z], max) {
  if (max <= 0 || !list.length) return [];
  return list
    .map((d) => ({ d, k: (d.position[0] - x) ** 2 + (d.position[2] - z) ** 2 }))
    .sort((a, b) => a.k - b.k)
    .slice(0, max)
    .map((e) => e.d);
}

export function createDecals(scene, { loadTexture, tier = 'high' } = {}) {
  const max = DECAL_POOL[tier] ?? DECAL_POOL.high;
  // (the unit square in the box's floor, facing up its local y)
  const quad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const pool = Array.from({ length: max }, () => {
    const m = new THREE.Mesh(quad, new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: 0.9 }));
    m.visible = false;
    m.renderOrder = 2;
    m.matrixAutoUpdate = false;
    m.name = 'decal';
    scene.add(m);
    return m;
  });
  const textures = new Map(); // path → Promise<Texture | null>
  const texOf = (path) => {
    if (!textures.has(path)) textures.set(path, Promise.resolve(loadTexture?.(path)).catch(() => null));
    return textures.get(path);
  };
  let list = [];
  let shown = 0;
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  return {
    set(next) {
      list = next ?? [];
    },
    update(at) {
      const near = pickDecals(list, at, max);
      shown = near.length;
      pool.forEach((m, i) => {
        const d = near[i];
        if (!d) {
          m.visible = false;
          return;
        }
        if (m.userData.decal === d) return;
        m.userData.decal = d;
        m.visible = false;
        // (the box's floor: its centre less half its height along its own y)
        q.set(...d.quaternion);
        s.set(d.scale[0], 1, d.scale[2]);
        p.set(0, -d.scale[1] / 2, 0).applyQuaternion(q).add(new THREE.Vector3(...d.position));
        m.matrix.compose(p, q, s);
        m.material.opacity = d.alpha ?? 1;
        texOf(d.tex).then((t) => {
          if (m.userData.decal !== d || !t) return;
          m.material.map = t;
          m.material.needsUpdate = true;
          m.visible = true;
        });
      });
    },
    count: () => shown,
    dispose() {
      for (const m of pool) {
        scene.remove(m);
        m.material.dispose();
      }
      quad.dispose();
      for (const t of textures.values()) t.then((x) => x?.dispose?.());
    },
  };
}
