// A level pack drawn (lane L, "How a level draws"): every instance of the
// arena and the horizon is in one table; each is drawn at the LOD its size
// and distance give it, out to the pack's reach for the tier (src/lib/level/
// lod.js, fitted by the builder so the row holds), and every mesh, LOD and
// side in view is one InstancedMesh. The table is sorted again only after a
// few metres walked; a mesh's LOD file is fetched the first time it is
// wanted, so the detail comes in round you as you go.
//
//   createLevelScene({ scene, pack, loadGltf, tier }) → {
//     setTable(bin), setHorizon(bin), update([x, z]), stats() → { tris, calls, instances },
//     rebuilds(), dispose() }
//
// A mirrored instance (an odd number of negative scales) turns its triangles
// inside out; its draw takes a copy of the geometry wound the other way, so
// its faces face out and its normals, mirrored by the instance matrix, light
// it as the game does. (A back-side material would draw the right faces but
// flip the normals again.)

import * as THREE from 'three';
import { readInstances } from '../../../../lib/level/instances.js';
import { MIN_RADIUS, lodAt, seenAt } from '../../../../lib/level/lod.js';

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
// metres walked before the table is sorted again
const STEP = 8;

function flipped(geometry) {
  const g = geometry.clone();
  if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
  const a = g.index.array;
  for (let i = 0; i + 2 < a.length; i += 3) [a[i + 1], a[i + 2]] = [a[i + 2], a[i + 1]];
  g.index.needsUpdate = true;
  return g;
}

// the instances of some draws as rows: where, how big, which mesh, its matrix
function rowsOf(pack, draws, bin) {
  const inst = readInstances(bin);
  const rows = [];
  for (const d of draws) {
    const mesh = pack.meshes[d.mesh];
    for (let i = d.offset; i < d.offset + d.count; i++) {
      _p.fromArray(inst.position, i * 3);
      _q.fromArray(inst.quaternion, i * 4).normalize();
      _s.fromArray(inst.scale, i * 3);
      const big = Math.max(Math.abs(_s.x), Math.abs(_s.y), Math.abs(_s.z));
      rows.push({ x: _p.x, z: _p.z, r: Math.max(MIN_RADIUS, (mesh.radius ?? 1) * big), mesh: d.mesh, mirrored: d.mirrored, matrix: _m.compose(_p, _q, _s).clone() });
    }
  }
  return rows;
}

export function createLevelScene({ scene, pack, loadGltf, tier }) {
  const root = new THREE.Group();
  root.name = 'level';
  scene.add(root);
  // (a pack built without --ultra has no ultra row: ultra draws as high)
  const cull = pack.cull?.[tier] ?? pack.cull?.high ?? { K: Infinity, dropped: [] };
  const dropped = new Set(cull.dropped);
  const pools = new Map(); // `${glb}|${mirrored}` → { glb, mirrored, rows, parts, loading }
  let rows = [];
  let last = null;
  let sorts = 0;
  let disposed = false;

  // the first shipped LOD at or past n (a pack built without --ultra holds
  // no files under the high tier's cap)
  const fileOf = (mesh, n) => {
    for (let k = n; k < mesh.glb.length; k++) if (mesh.glb[k]) return mesh.glb[k];
    return null;
  };

  function build(p) {
    if (disposed) return;
    if (!p.parts) {
      if (!p.rows.length || p.loading) return;
      p.loading = true;
      Promise.resolve(loadGltf(p.glb)).then((gltf) => {
        if (disposed || !gltf) return;
        gltf.scene.updateMatrixWorld(true);
        p.parts = [];
        gltf.scene.traverse((o) => {
          if (o.isMesh) p.parts.push({ geometry: p.mirrored ? flipped(o.geometry) : o.geometry, material: o.material, local: o.matrixWorld.clone(), mesh: null, owned: p.mirrored });
        });
        build(p);
      });
      return;
    }
    for (const part of p.parts) {
      if (!part.mesh || part.mesh.instanceMatrix.count < p.rows.length) {
        if (part.mesh) {
          root.remove(part.mesh);
          part.mesh.dispose();
        }
        const cap = Math.max(8, 2 ** Math.ceil(Math.log2(Math.max(1, p.rows.length))));
        part.mesh = new THREE.InstancedMesh(part.geometry, part.material, cap);
        part.mesh.userData = { glb: p.glb, mirrored: p.mirrored };
        part.mesh.castShadow = true;
        part.mesh.receiveShadow = true;
        root.add(part.mesh);
      }
      p.rows.forEach((row, i) => part.mesh.setMatrixAt(i, _m.multiplyMatrices(row.matrix, part.local)));
      part.mesh.count = p.rows.length;
      part.mesh.instanceMatrix.needsUpdate = true;
      part.mesh.computeBoundingSphere();
    }
  }

  function sort([x, z]) {
    sorts++;
    const next = new Map();
    for (const row of rows) {
      if (dropped.has(row.mesh)) continue;
      const d = Math.hypot(row.x - x, row.z - z);
      if (!seenAt(d, row.r, cull.K)) continue;
      const mesh = pack.meshes[row.mesh];
      const glb = fileOf(mesh, lodAt(mesh.lods, d, row.r, tier));
      if (!glb) continue;
      const key = `${glb}|${row.mirrored ? 1 : 0}`;
      if (!next.has(key)) next.set(key, []);
      next.get(key).push(row);
    }
    for (const [key, p] of pools) if (!next.has(key) && p.rows.length) (p.rows = []), build(p);
    for (const [key, list] of next) {
      let p = pools.get(key);
      if (!p) pools.set(key, (p = { glb: key.slice(0, key.lastIndexOf('|')), mirrored: list[0].mirrored, rows: [], parts: null, loading: false }));
      p.rows = list;
      build(p);
    }
  }

  return {
    root,
    setTable(bin) {
      rows = [...rowsOf(pack, pack.far.draws, bin), ...rows.filter((r) => r.horizon)];
      if (last) sort(last);
    },
    setHorizon(bin) {
      if (!pack.horizon?.draws?.length) return;
      rows = [...rows.filter((r) => !r.horizon), ...rowsOf(pack, pack.horizon.draws, bin).map((r) => ({ ...r, horizon: true }))];
      if (last) sort(last);
    },
    update(at) {
      if (disposed || (last && Math.hypot(at[0] - last[0], at[1] - last[1]) < STEP)) return;
      last = [at[0], at[1]];
      sort(last);
    },
    rebuilds: () => sorts,
    stats() {
      let tris = 0;
      let calls = 0;
      let instances = 0;
      for (const p of pools.values()) {
        for (const part of p.parts ?? []) {
          if (!part.mesh?.count) continue;
          const g = part.geometry;
          tris += part.mesh.count * ((g.index ? g.index.count : g.attributes.position.count) / 3);
          calls += Array.isArray(part.material) ? part.material.length : 1;
        }
        if (p.parts) instances += p.rows.length;
      }
      return { tris, calls, instances };
    },
    dispose() {
      disposed = true;
      for (const p of pools.values()) {
        for (const part of p.parts ?? []) {
          part.mesh?.dispose();
          if (part.owned) part.geometry.dispose();
        }
      }
      pools.clear();
      scene.remove(root);
      root.clear();
    },
  };
}
