// The game's chunks, thrown: what a blast or a hit throws up (its metal,
// rock, snow and sand chunks, an AT-ST's wreck, a Y-wing's shards, from the
// 2017 drop's effect meshes: ./gameLook's `debris.*`), falling, bouncing and
// lying a while before they sink away. One instanced draw for each piece's
// shape, made when its set first loads; the counts are capped by tier
// (./fxPlan's countFor), so a busy fight never adds a draw per chunk.
// A set the bucket hadn't, or one still loading, throws nothing: the
// effect's own sparks stand.
//
// createDebris(parent, { level, groundAt, lit }) → {
//   throw(at, { set, n, speed, size, up }) → how many went,
//   preload(sets) → Promise, has(set), update(dt), clear(), dispose() }
// `groundAt(x, z)` → the ground's height there; `lit` false draws them
// unlit (a scene with no lights).

import * as THREE from 'three';
import { countFor, stepChunk } from './fxPlan';
import { loadLook, loadLookMesh } from './gameLook';

const CAP = 48; // chunks of one shape in the air at once, at high
const LIE = 4; // s on the ground before they sink
const SINK = 1; // s to sink away
// a set with no map of its own: its colour
const COLOUR = { 'debris.rock': '#6d655c', 'debris.snow': '#e8eef4', 'debris.sand': '#c9ad7f', 'debris.walker': '#8a8d90', 'debris.fighter': '#b9bcc0', 'debris.metal': '#9a9a9a', 'debris.wood': '#6b4a2e' };
const MAPS = { 'debris.metal': 'debris.metal', 'debris.wood': 'debris.wood' };

// a mesh's geometry in plain floats, in its node's place: the game's are
// quantised (int16, normalised, interleaved, the node's scale undoing it), and
// a transform written back into those would clamp every vertex to ±1
export function floatGeometry(geometry, matrix) {
  const g = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(geometry.attributes)) {
    const out = new Float32Array(a.count * a.itemSize);
    const get = [a.getX, a.getY, a.getZ, a.getW].slice(0, a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = get[k].call(a, i);
    g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  if (geometry.index) g.setIndex(geometry.index.clone());
  if (matrix) g.applyMatrix4(matrix);
  return g;
}

export function createDebris(parent, { level = 'high', groundAt = () => 0, lit = true } = {}) {
  const sets = new Map(); // name → { ready, shapes: [{ mesh, live }], mat }
  const cap = countFor(CAP, level);
  const group = new THREE.Group();
  group.name = 'fx-debris';
  parent.add(group);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let gone = false;

  async function build(name, set) {
    const [gltf, map] = await Promise.all([loadLookMesh(name), MAPS[name] ? loadLook(MAPS[name], { level }) : null]);
    if (!gltf || gone) return;
    const Mat = lit ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial;
    set.mat = new Mat({ color: map ? '#ffffff' : (COLOUR[name] ?? '#888888'), map: map ?? null, ...(lit ? { roughness: 0.85, metalness: name === 'debris.metal' ? 0.5 : 0 } : {}) });
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      // in metres, about its own middle, so it tumbles about itself
      const g = floatGeometry(o.geometry, o.matrixWorld);
      g.center();
      g.computeBoundingSphere();
      const mesh = new THREE.InstancedMesh(g, set.mat, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.name = `${name}-${o.name}`;
      mesh.userData.radius = g.boundingSphere.radius || 0.5;
      group.add(mesh);
      set.shapes.push({ mesh, live: [] });
    });
    set.ready = set.shapes.length > 0;
  }

  function load(name) {
    if (!sets.has(name)) {
      const set = { ready: false, shapes: [], mat: null };
      set.loading = build(name, set).catch(() => {});
      sets.set(name, set);
    }
    return sets.get(name).loading;
  }

  return {
    group,
    preload(names) {
      return Promise.all(names.map(load));
    },
    has(name) {
      return Boolean(sets.get(name)?.ready);
    },
    // `at` a Vector3 or [x, y, z]; `size` a chunk's size across (m)
    throw(at, { set: name, n = 4, speed = 4, size = 0.4, up = 0.7 } = {}) {
      const set = sets.get(name);
      if (!set) load(name);
      if (!set?.ready) return 0;
      const where = Array.isArray(at) ? at : [at.x, at.y, at.z];
      for (let i = 0; i < n; i++) {
        const shape = set.shapes[(Math.random() * set.shapes.length) | 0];
        if (shape.live.length >= cap) shape.live.shift();
        const a = Math.random() * Math.PI * 2;
        const out = speed * (0.4 + Math.random() * 0.6);
        shape.live.push({
          p: [where[0], where[1] + 0.05, where[2]],
          v: [Math.cos(a) * out * (1 - up), speed * up * (0.6 + Math.random() * 0.6), Math.sin(a) * out * (1 - up)],
          spin: [(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12],
          r: [Math.random() * 6, Math.random() * 6, Math.random() * 6],
          k: (size / (2 * shape.mesh.userData.radius)) * (0.6 + Math.random() * 0.8),
          rest: false,
          lie: 0,
        });
      }
      return n;
    },
    update(dt) {
      for (const set of sets.values()) {
        if (!set.ready) continue;
        for (const shape of set.shapes) {
          for (let i = shape.live.length - 1; i >= 0; i--) {
            const ch = shape.live[i];
            stepChunk(ch, dt, groundAt);
            if (ch.rest) ch.lie += dt;
            if (ch.lie > LIE + SINK) shape.live.splice(i, 1);
          }
          let c = 0;
          for (const ch of shape.live) {
            const sink = Math.max(0, ch.lie - LIE) / SINK;
            p.set(ch.p[0], ch.p[1] - sink * ch.k * shape.mesh.userData.radius * 2, ch.p[2]);
            q.setFromEuler(e.set(ch.r[0], ch.r[1], ch.r[2]));
            shape.mesh.setMatrixAt(c++, m4.compose(p, q, s.setScalar(ch.k)));
          }
          shape.mesh.count = c;
          if (c) shape.mesh.instanceMatrix.needsUpdate = true;
        }
      }
    },
    get busy() {
      let n = 0;
      for (const set of sets.values()) for (const sh of set.shapes) n += sh.live.length;
      return n;
    },
    clear() {
      for (const set of sets.values())
        for (const sh of set.shapes) {
          sh.live.length = 0;
          sh.mesh.count = 0;
        }
    },
    dispose() {
      gone = true;
      group.removeFromParent();
      for (const set of sets.values()) {
        for (const sh of set.shapes) {
          sh.mesh.geometry.dispose();
          sh.mesh.dispose();
        }
        set.mat?.dispose();
      }
      sets.clear();
    },
  };
}
