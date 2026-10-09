// The flight's ground in three.js: the sink ./groundCore.js drives. A leaf's
// transferred buffers are wrapped as a BufferGeometry (no normals worked out
// here: the worker's are already right at the edges), its bounds set from
// its square and its heights, under one root group the floating origin moves.
// One material for the whole planet, painted: the planet's low colour on
// the flats, its high one up the slopes of the hills, its rock on the steep,
// as flat colours on the house look. The clutter is three pools, one draw a
// kind (lib/three/pool.js), its slots taken as a leaf shows and freed as it
// hides.
//
//   createGround(scene, { rt, spec, tier }) → { update(ship), heightUnder(x, z),
//     stats(), setTier(tier), materials, dispose() }

import * as THREE from 'three';
import { pool } from '../../../lib/three/pool';
import { SKIRT, CLUTTER_KINDS } from '../../../lib/land/flight/leafMesh';
import { WORKER, createGroundCore } from './groundCore';

export const CAP = { rock: 4000, spire: 600, debris: 2000 };

// heights the colours change over, from the planet's biomes: its lowest base to its highest
function bandOf(spec) {
  const bases = spec.biomes.map((b) => b.base ?? 0);
  const lo = Math.min(...bases), hi = Math.max(...bases);
  return [lo + 10, hi + 90];
}

function groundMaterial(spec) {
  const c = (hex) => new THREE.Color(hex);
  const uniforms = {
    uFlyLow: { value: c(spec.palette.low) },
    uFlyHigh: { value: c(spec.palette.high) },
    uFlyRock: { value: c(spec.palette.rock) },
    uFlyBand: { value: new THREE.Vector2(...bandOf(spec)) },
  };
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.name = 'flight-ground';
  const before = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    before?.call(m, sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vFlyY;\nvarying float vFlyUp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlyY = position.y;\nvFlyUp = normal.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uFlyLow;\nuniform vec3 uFlyHigh;\nuniform vec3 uFlyRock;\nuniform vec2 uFlyBand;\nvarying float vFlyY;\nvarying float vFlyUp;')
      .replace(
        '#include <color_fragment>',
        // (by height, then by slope: the steep goes to rock whatever its height)
        '#include <color_fragment>\nvec3 flyC = mix(uFlyLow, uFlyHigh, smoothstep(uFlyBand.x, uFlyBand.y, vFlyY));\nflyC = mix(flyC, uFlyRock, smoothstep(0.82, 0.62, vFlyUp));\ndiffuseColor.rgb *= flyC;',
      );
  };
  m.customProgramCacheKey = () => 'flight-ground';
  return m;
}

// the clutter's shapes, code-built, a few metres each (a row's scale is 0.7…1.3 of it)
function clutterGeometry(kind) {
  if (kind === 'rock') {
    const g = new THREE.IcosahedronGeometry(3, 0);
    g.scale(1.2, 0.6, 1);
    g.translate(0, 0.6, 0);
    return g;
  }
  if (kind === 'spire') {
    const g = new THREE.ConeGeometry(3, 26, 5);
    g.translate(0, 12, 0);
    return g;
  }
  const g = new THREE.BoxGeometry(4, 1.4, 2.6);
  g.rotateZ(0.25);
  g.translate(0, 0.4, 0);
  return g;
}

function three(scene, spec, tier, palette) {
  const root = new THREE.Group();
  root.name = 'flight-ground';
  scene.add(root);
  const material = groundMaterial(spec);
  const colours = { rock: spec.palette.rock, spire: spec.palette.accent, debris: palette[4] };
  const pools = CLUTTER_KINDS.map((kind) => {
    const cap = tier === 'low' ? CAP[kind] / 2 : CAP[kind];
    const p = pool(clutterGeometry(kind), new THREE.MeshLambertMaterial({ color: colours[kind], flatShading: true }), cap, `flight-${kind}`);
    p.mesh.castShadow = p.mesh.receiveShadow = false;
    root.add(p.mesh);
    return p;
  });
  // (the pool reads plain arrays)
  const pos = [0, 0, 0];
  const q = [0, 0, 0, 1];

  return {
    root,
    materials: [material, ...pools.map((p) => p.mesh.material)],
    add(leaf, a) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(a.positions, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(a.normals, 3));
      g.setIndex(new THREE.BufferAttribute(a.indices, 1));
      let lo = Infinity, hi = -Infinity;
      for (const h of a.heights) {
        if (h < lo) lo = h;
        if (h > hi) hi = h;
      }
      lo -= SKIRT;
      const half = leaf.size / 2, mid = (hi - lo) / 2;
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(half, lo + mid, half), Math.hypot(half, half, mid));
      g.boundingBox = new THREE.Box3(new THREE.Vector3(0, lo, 0), new THREE.Vector3(leaf.size, hi, leaf.size));
      const mesh = new THREE.Mesh(g, material);
      mesh.name = leaf.key;
      mesh.position.set(leaf.x0, 0, leaf.z0);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.visible = false;
      root.add(mesh);
      return mesh;
    },
    show(mesh, on) {
      mesh.visible = on;
    },
    remove(mesh) {
      root.remove(mesh);
      mesh.geometry.dispose();
    },
    clutterAdd(rows) {
      const slots = [];
      for (let r = 0; r < rows.length; r += 6) {
        const kind = rows[r + 5];
        const p = pools[kind];
        const i = p?.take() ?? -1;
        // (a pool full: that one isn't drawn, nothing else gives)
        if (i < 0) continue;
        pos[0] = rows[r];
        pos[1] = rows[r + 1];
        pos[2] = rows[r + 2];
        // a turn about the vertical, as a quaternion
        q[1] = Math.sin(rows[r + 3] / 2);
        q[3] = Math.cos(rows[r + 3] / 2);
        p.place(i, pos, q, rows[r + 4]);
        slots.push(kind, i);
      }
      return slots;
    },
    clutterFree(slots) {
      for (let s = 0; s < slots.length; s += 2) pools[slots[s]].free(slots[s + 1]);
    },
    moveTo(at) {
      root.position.set(-at[0], -at[1], -at[2]);
    },
    dispose() {
      scene.remove(root);
      for (const p of pools) p.dispose();
      material.dispose();
    },
  };
}

export function createGround(scene, { rt, spec, tier = 'mid', palette }) {
  rt.workers.define(WORKER, () => new Worker(new URL('./terrain.worker.js', import.meta.url), { type: 'module' }));
  const sink = three(scene, spec, tier, palette);
  const core = createGroundCore({ workers: rt.workers, sink, spec, tier });
  core.origin(rt.origin?.at ?? [0, 0, 0]);
  return {
    root: sink.root,
    materials: sink.materials,
    update: (ship) => core.update(ship),
    heightUnder: (x, z) => core.heightUnder(x, z),
    origin: (at) => core.origin(at),
    setTier: (t) => core.setTier(t),
    stats: () => core.stats(),
    dispose() {
      core.dispose();
      sink.dispose();
    },
  };
}
