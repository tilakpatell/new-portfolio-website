// Minecraft, the chunk sections on screen: one mesh per pass per section
// that has faces, its vertices the worker's typed array as it came (six
// 16-bit numbers a vertex, in sixteenths of a block: the mesh is scaled by
// 1/16 and stood at the section's corner), sharing one index buffer that
// draws every quad as two triangles. three culls each against the frustum
// from a bounding sphere set once, never computed from the vertices.
//
// workerClient wraps the worker in rules/jobs.js's client.

import * as THREE from 'three';
import { STRIDE } from '../rules/mesher.js';
import { makeClient } from '../rules/jobs.js';

const PASSES = ['opaque', 'cutout', 'water'];
const SPHERE = new THREE.Sphere(new THREE.Vector3(128, 128, 128), 222);

export function workerClient(worker) {
  const client = makeClient((msg, transfer) => worker.postMessage(msg, transfer ?? []));
  worker.onmessage = (e) => client.receive(e.data);
  return client;
}

export function createChunks(scene, { materials }) {
  const group = new THREE.Group();
  group.name = 'chunks';
  scene.add(group);
  const sections = new Map(); // `${cx},${cz},${sy}` → { opaque, cutout, water } meshes
  let index = null;
  let quads = 0;

  // the index for n quads: (0 1 2) (0 2 3) for each, grown as needed and shared
  function indexFor(n) {
    if (n <= quads) return index;
    quads = Math.max(n, quads * 2, 16384);
    const a = new Uint32Array(quads * 6);
    for (let q = 0; q < quads; q++) {
      const v = q * 4;
      a.set([v, v + 1, v + 2, v, v + 2, v + 3], q * 6);
    }
    index = new THREE.BufferAttribute(a, 1);
    return index;
  }

  function makeMesh(m, pass, cx, cz, sy) {
    const g = new THREE.BufferGeometry();
    const buf = new THREE.InterleavedBuffer(m.data, STRIDE);
    g.setAttribute('position', new THREE.InterleavedBufferAttribute(buf, 3, 0));
    g.setAttribute('data', new THREE.InterleavedBufferAttribute(buf, 3, 3));
    g.setIndex(indexFor(m.count / 4));
    g.setDrawRange(0, (m.count / 4) * 6);
    g.boundingSphere = SPHERE.clone();
    const mesh = new THREE.Mesh(g, materials[pass]);
    mesh.position.set(cx * 16, sy * 16, cz * 16);
    mesh.scale.setScalar(1 / 16);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    // water after everything solid, so what's under it shows through
    mesh.renderOrder = pass === 'water' ? 2 : pass === 'cutout' ? 1 : 0;
    return mesh;
  }

  function clear(k) {
    const old = sections.get(k);
    if (!old) return;
    for (const m of Object.values(old)) {
      group.remove(m);
      m.geometry.dispose();
    }
    sections.delete(k);
  }

  return {
    group,
    setMesh(cx, cz, sy, meshes) {
      const k = `${cx},${cz},${sy}`;
      clear(k);
      const made = {};
      for (const pass of PASSES) {
        const m = meshes?.[pass];
        if (!m?.count) continue;
        made[pass] = makeMesh(m, pass, cx, cz, sy);
        group.add(made[pass]);
      }
      if (Object.keys(made).length) sections.set(k, made);
    },
    drop(cx, cz) {
      for (let sy = 0; sy < 16; sy++) clear(`${cx},${cz},${sy}`);
    },
    stats() {
      let meshes = 0;
      let vertices = 0;
      for (const s of sections.values())
        for (const m of Object.values(s)) {
          meshes++;
          vertices += m.geometry.drawRange.count / 1.5;
        }
      return { sections: sections.size, meshes, vertices };
    },
    dispose() {
      for (const k of [...sections.keys()]) clear(k);
      scene.remove(group);
    },
  };
}
