// The undergrowth round you, wherever you walk (a jungle's shrubs, ferns
// and broad leaves; a forest's ferns): the grass's way (grass.js) with
// whole plants. A plant scattered once round the landing is gone when you
// walk a few hundred metres off; this goes with you. Each kind is one
// instanced mesh of slots on a grid round you, each slot standing in its own
// cell of the land (so a plant stays where it grew, and is the same plant
// whenever you come back) until you've left it behind, then it comes round
// to the far side; the slots near the patch's edge shrink to nothing, so
// nothing pops in. A cell grows its plant only where the land lets it (not
// on steep ground, under water, on a place's built ground or the pad), in
// drifts by a noise, each its own size, turn and nudge from its cell.
//
// site.patches: [{ kind (a scatter builder's), opts, spacing (metres a
// cell), radius (metres round you), scale: [lo, hi], cover (0…1, how many
// cells grow one), slope (the steepest ground, as the normal's y), above
// (metres over the water) }]
//
// createPatches({ parent, kit, world, site, small }) → { group, update(x, z), dispose }
// cellPlant(x, z, spec, seed) → { grow, yaw, scale, dx, dz } (pure: the plant a cell grows)

import * as THREE from 'three';
import { SCATTER } from './props';
import { fbm, smoothstep } from './noise';

// a cell's own random numbers, 0…1 (the same for the same cell, every time)
const hash = (x, z, k) => {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1) ^ Math.imul(k | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// The plant cell (cx, cz) grows, from its own numbers and the drifts' noise
// (the land's say, slope and water and places, is the caller's)
export function cellPlant(cx, cz, spec, seed = 1) {
  const c = spec.spacing;
  const cover = spec.cover ?? 0.7;
  // (in drifts: the noise at 40 m, the cells over it grow, the rest don't)
  const drift = fbm((cx * c) / 40, (cz * c) / 40, { octaves: 2, seed }) * 0.5 + 0.5;
  const grow = hash(cx, cz, seed) < cover * smoothstep(0.25, 0.65, drift) * 1.4;
  const [lo, hi] = spec.scale ?? [0.8, 1.4];
  return { grow, yaw: hash(cx, cz, seed + 1) * Math.PI * 2, scale: lo + (hi - lo) * hash(cx, cz, seed + 2) ** 1.4, dx: (hash(cx, cz, seed + 3) - 0.5) * 0.8 * c, dz: (hash(cx, cz, seed + 4) - 0.5) * 0.8 * c };
}

export function createPatches({ parent, kit, world, site, small = false }) {
  const group = new THREE.Group();
  group.name = 'patches';
  // (moving with you: the floor's light bake mustn't draw them)
  group.userData.noBake = true;
  parent.add(group);
  const bare = [...(site.places ?? []).filter((p) => p.flat).map((p) => ({ at: p.at, r: p.flat.r + 2 })), { at: site.land?.at ?? [0, 0], r: 24 }];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const kinds = (site.patches ?? [])
    .map((spec, k) => {
      const build = SCATTER[spec.kind];
      if (!build) return null;
      const made = build(kit, spec.opts ?? {});
      const R = spec.radius * (small ? 0.7 : 1);
      const n = 2 * Math.ceil(R / spec.spacing);
      const period = n * spec.spacing;
      const meshes = made.parts.map((part) => {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, n * n);
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.userData.noBake = true;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        group.add(mesh);
        return { mesh, local: part.local ?? null };
      });
      // each slot: the cell it stands in now, and that cell's plant there
      // (y, yaw, scale, or none)
      const slots = Array.from({ length: n * n }, () => ({ cx: NaN, cz: NaN, x: 0, z: 0, y: 0, yaw: 0, s: 0 }));
      return { spec, R, n, period, meshes, slots, seed: (site.ground?.seed ?? 1) * 31 + k * 7 + 5 };
    })
    .filter(Boolean);

  // the land's say over a cell: not steep, not under water, not built on
  const lets = (spec, x, z) => {
    if (world.normalAt(x, z)[1] < (spec.slope ?? 0.82)) return false;
    if (world.water != null && world.heightAt(x, z) < world.water + (spec.above ?? 0.3)) return false;
    for (const b of bare) if (Math.hypot(x - b.at[0], z - b.at[1]) < b.r) return false;
    return true;
  };

  let last = null;
  return {
    group,
    // round you at (x, z): the slots whose cell is now another found again,
    // every slot's fade at the edge set, and the meshes told
    update(x, z) {
      if (last && Math.hypot(x - last[0], z - last[1]) < 0.4) return;
      last = [x, z];
      for (const K of kinds) {
        const c = K.spec.spacing;
        let i = 0;
        for (let a = 0; a < K.n; a++) {
          for (let b = 0; b < K.n; b++, i++) {
            const S = K.slots[i];
            // (the slot's cell: its place in the grid, brought round to the
            // nearest copy of it to you)
            const bx = (a + 0.5) * c - K.period / 2;
            const bz = (b + 0.5) * c - K.period / 2;
            const wx = bx + K.period * Math.floor((x - bx) / K.period + 0.5);
            const wz = bz + K.period * Math.floor((z - bz) / K.period + 0.5);
            const cx = Math.floor(wx / c);
            const cz = Math.floor(wz / c);
            if (cx !== S.cx || cz !== S.cz) {
              S.cx = cx;
              S.cz = cz;
              const plant = cellPlant(cx, cz, K.spec, K.seed);
              S.x = (cx + 0.5) * c + plant.dx;
              S.z = (cz + 0.5) * c + plant.dz;
              S.s = plant.grow && lets(K.spec, S.x, S.z) ? plant.scale : 0;
              S.yaw = plant.yaw;
              S.y = S.s ? world.heightAt(S.x, S.z) - (K.spec.sink ?? 0.05) : 0;
            }
            const fade = 1 - smoothstep(0.72, 1, Math.hypot(S.x - x, S.z - z) / K.R);
            const s = S.s * fade;
            q.setFromAxisAngle(up, S.yaw);
            m.compose(p.set(S.x, S.y, S.z), q, sv.setScalar(Math.max(s, 1e-4)));
            if (s <= 0) m.makeScale(0, 0, 0);
            for (const M of K.meshes) M.mesh.setMatrixAt(i, M.local ? m.clone().multiply(M.local) : m);
          }
        }
        for (const M of K.meshes) M.mesh.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      parent.remove(group);
      // (the geometries are the kit's, freed with it; the materials too)
    },
  };
}
