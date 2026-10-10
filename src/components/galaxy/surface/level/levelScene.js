// A level pack drawn (lane L, "How a level draws"): every mesh, cut and side
// in view is one InstancedMesh, pooled across the cells that hold it, so the
// draw calls are the meshes in view, not the meshes times the cells. Cells
// come and go (levelStream.js decides which); the far list stands in for any
// cell not drawn closer, its instances in a drawn cell hidden.
//
//   createLevelScene({ scene, pack, loadGltf, tier }) → {
//     addCell(key, bin, band), removeCell(key), setFar(bin), setHorizon(bin),
//     update(camera), stats() → { tris, calls, cells }, dispose() }
//
// A mirrored instance (an odd number of negative scales) turns its triangles
// inside out; its draw takes a copy of the geometry wound the other way, so
// its faces face out and its normals, mirrored by the instance matrix, light
// it as the game does. (A back-side material would draw the right faces but
// flip the normals again.)

import * as THREE from 'three';
import { readInstances } from '../../../../lib/level/instances.js';
import { bandsFor, drawsFor } from './levelPack.js';
import { budget } from '../../../../lib/budgets.js';

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

// (the horizon's reach: the backdrop pieces within this of the spot, halved
// on the small tiers)
const HORIZON = 6000;

function matrices(inst, first, count, keep = () => true) {
  const out = [];
  for (let i = first; i < first + count; i++) {
    if (!keep(i)) continue;
    _p.fromArray(inst.position, i * 3);
    _q.fromArray(inst.quaternion, i * 4).normalize();
    _s.fromArray(inst.scale, i * 3);
    out.push(_m.compose(_p, _q, _s).clone());
  }
  return out;
}

function flipped(geometry) {
  const g = geometry.clone();
  if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
  const a = g.index.array;
  for (let i = 0; i + 2 < a.length; i += 3) [a[i + 1], a[i + 2]] = [a[i + 2], a[i + 1]];
  g.index.needsUpdate = true;
  return g;
}

export function createLevelScene({ scene, pack, loadGltf, tier }) {
  const root = new THREE.Group();
  root.name = 'level';
  scene.add(root);
  const pools = new Map(); // `${glb}|${mirrored}` → { cut, mirrored, glb, sources: Map, parts, loading }
  const cells = new Map(); // key → band
  let far = null; // [{ raw, d, all }]: each far draw kept on this tier, its matrices made once
  let disposed = false;
  const shadows = (cut) => cut !== 'far';

  function pool(d) {
    const key = `${d.glb}|${d.mirrored ? 1 : 0}`;
    let p = pools.get(key);
    if (!p) pools.set(key, (p = { cut: d.cut, mirrored: d.mirrored, glb: d.glb, sources: new Map(), parts: null, loading: false }));
    return p;
  }

  function build(p) {
    if (disposed) return;
    const all = [...p.sources.values()].flat();
    if (!p.parts) {
      if (!all.length || p.loading) return;
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
      if (!part.mesh || part.mesh.instanceMatrix.count < all.length) {
        if (part.mesh) {
          root.remove(part.mesh);
          part.mesh.dispose();
        }
        const cap = Math.max(8, 2 ** Math.ceil(Math.log2(Math.max(1, all.length))));
        part.mesh = new THREE.InstancedMesh(part.geometry, part.material, cap);
        part.mesh.userData = { cut: p.cut, mirrored: p.mirrored, glb: p.glb };
        part.mesh.castShadow = shadows(p.cut);
        part.mesh.receiveShadow = true;
        part.mesh.frustumCulled = true;
        root.add(part.mesh);
      }
      all.forEach((m, i) => part.mesh.setMatrixAt(i, _m.multiplyMatrices(m, part.local)));
      part.mesh.count = all.length;
      part.mesh.instanceMatrix.needsUpdate = true;
      part.mesh.computeBoundingSphere();
    }
  }

  function dirty(touched) {
    for (const p of touched) build(p);
  }

  // the far list, its instances in a drawn cell left out
  function placeFar() {
    if (!far) return;
    const touched = new Set();
    for (const { raw, d, all } of far) {
      const hidden = [];
      for (const [key, [at, n]] of Object.entries(raw.cells ?? {})) if (cells.has(key)) hidden.push([at, at + n]);
      const p = pool(d);
      p.sources.set('far', hidden.length ? all.filter((_, i) => !hidden.some(([a, b]) => i >= a && i < b)) : all);
      touched.add(p);
    }
    dirty(touched);
  }

  function removeCell(key) {
    if (!cells.has(key)) return;
    cells.delete(key);
    const touched = new Set();
    for (const p of pools.values()) if (p.sources.delete(`cell:${key}`)) touched.add(p);
    dirty(touched);
    placeFar();
  }

  return {
    root,
    addCell(key, bin, band = 'near') {
      const c = pack.cells[key];
      if (!c || disposed) return;
      if (cells.has(key)) removeCell(key);
      cells.set(key, band);
      const inst = readInstances(bin);
      const touched = new Set();
      for (const d of drawsFor(pack, c.draws, band, tier)) {
        const p = pool(d);
        p.sources.set(`cell:${key}`, matrices(inst, d.offset, d.count));
        touched.add(p);
      }
      dirty(touched);
      placeFar();
    },
    removeCell,
    setFar(bin) {
      const inst = readInstances(bin);
      far = [];
      for (const raw of pack.far.draws) {
        const [d] = drawsFor(pack, [raw], 'far', tier);
        if (d) far.push({ raw, d, all: matrices(inst, d.offset, d.count) });
      }
      placeFar();
    },
    setHorizon(bin) {
      if (!pack.horizon?.draws?.length) return;
      const inst = readInstances(bin);
      const reach = HORIZON * bandsFor(budget(tier)).horizon;
      const touched = new Set();
      for (const d of drawsFor(pack, pack.horizon.draws, 'far', tier)) {
        const p = pool(d);
        p.sources.set('horizon', matrices(inst, d.offset, d.count, (i) => Math.hypot(inst.position[i * 3], inst.position[i * 3 + 2]) < reach));
        touched.add(p);
      }
      dirty(touched);
    },
    // (the pooled meshes cull themselves by their bounds; nothing to do a frame yet)
    update() {},
    stats() {
      let tris = 0;
      let calls = 0;
      for (const p of pools.values()) {
        for (const part of p.parts ?? []) {
          if (!part.mesh?.count) continue;
          const g = part.geometry;
          tris += part.mesh.count * ((g.index ? g.index.count : g.attributes.position.count) / 3);
          calls += Array.isArray(part.material) ? part.material.length : 1;
        }
      }
      return { tris, calls, cells: cells.size };
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
