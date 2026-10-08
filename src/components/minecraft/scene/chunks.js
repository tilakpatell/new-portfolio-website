// Minecraft, the chunks on screen: one mesh per pass per chunk column, its
// vertices the worker's typed arrays as they came (six 16-bit numbers a
// vertex, in sixteenths of a block within the column: the mesh is scaled by
// 1/16 and stood at the chunk's corner). A column's sixteen sections are
// kept apart and laid end to end into its mesh when one changes, so an edit
// re-meshes one section but the column is still one draw a pass: about
// 400 draws for a 10-chunk view of hills, where a draw a section was 600.
// They share one index buffer that draws every quad as two triangles, and
// three culls each column against the frustum by a sphere round the
// heights it has, never computed from the vertices.

import * as THREE from 'three';
import { STRIDE } from '../rules/mesher.js';

const PASSES = ['opaque', 'cutout', 'water'];

export function createChunks(scene, { materials }) {
  const group = new THREE.Group();
  group.name = 'chunks';
  scene.add(group);
  const columns = new Map(); // `${cx},${cz}` → { cx, cz, sections: Array(16), meshes: { pass: Mesh } }
  const dirty = new Set();
  let index = null;
  let quads = 0;

  // the index for n quads: (0 1 2) (0 2 3) for each, grown as needed and shared
  function indexFor(n) {
    if (n <= quads) return index;
    quads = Math.max(n, quads * 2, 65536);
    const a = new Uint32Array(quads * 6);
    for (let q = 0; q < quads; q++) {
      const v = q * 4;
      a[q * 6] = v;
      a[q * 6 + 1] = v + 1;
      a[q * 6 + 2] = v + 2;
      a[q * 6 + 3] = v;
      a[q * 6 + 4] = v + 2;
      a[q * 6 + 5] = v + 3;
    }
    index = new THREE.BufferAttribute(a, 1);
    return index;
  }

  function clearMeshes(col) {
    for (const m of Object.values(col.meshes)) {
      group.remove(m);
      // (three deletes a geometry's index buffer with it, and this one is every column's)
      m.geometry.setIndex(null);
      m.geometry.dispose();
    }
    col.meshes = {};
  }

  // the column's sections laid end to end, a mesh per pass
  function build(col) {
    clearMeshes(col);
    let lo = 16;
    let hi = -1;
    for (let s = 0; s < 16; s++)
      if (col.sections[s] && PASSES.some((p) => col.sections[s][p])) {
        lo = Math.min(lo, s);
        hi = Math.max(hi, s);
      }
    if (hi < 0) return;
    // a sphere round the sections that have faces, in the mesh's sixteenths
    const sphere = new THREE.Sphere(new THREE.Vector3(128, ((lo + hi + 1) / 2) * 256, 128), Math.hypot(128, 128, ((hi + 1 - lo) / 2) * 256));
    for (const pass of PASSES) {
      let count = 0;
      for (const s of col.sections) count += s?.[pass]?.count ?? 0;
      if (!count) continue;
      const data = new Uint16Array(count * STRIDE);
      let at = 0;
      for (const s of col.sections) {
        const m = s?.[pass];
        if (!m) continue;
        data.set(m.data, at);
        at += m.data.length;
      }
      const g = new THREE.BufferGeometry();
      const buf = new THREE.InterleavedBuffer(data, STRIDE);
      g.setAttribute('position', new THREE.InterleavedBufferAttribute(buf, 3, 0));
      g.setAttribute('data', new THREE.InterleavedBufferAttribute(buf, 3, 3));
      g.setIndex(indexFor(count / 4));
      g.setDrawRange(0, (count / 4) * 6);
      g.boundingSphere = sphere;
      const mesh = new THREE.Mesh(g, materials[pass]);
      mesh.position.set(col.cx * 16, 0, col.cz * 16);
      mesh.scale.setScalar(1 / 16);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      // water after everything solid, so what's under it shows through
      mesh.renderOrder = pass === 'water' ? 2 : pass === 'cutout' ? 1 : 0;
      col.meshes[pass] = mesh;
      group.add(mesh);
    }
  }

  const columnOf = (cx, cz) => {
    const k = `${cx},${cz}`;
    let col = columns.get(k);
    if (!col) columns.set(k, (col = { cx, cz, sections: new Array(16).fill(null), meshes: {} }));
    return col;
  };

  return {
    group,
    // one section's meshes; the column is rebuilt at the next flush
    setMesh(cx, cz, sy, meshes) {
      const col = columnOf(cx, cz);
      col.sections[sy] = meshes && PASSES.some((p) => meshes[p]) ? meshes : null;
      dirty.add(`${cx},${cz}`);
    },
    drop(cx, cz) {
      const k = `${cx},${cz}`;
      const col = columns.get(k);
      if (!col) return;
      clearMeshes(col);
      columns.delete(k);
      dirty.delete(k);
    },
    // rebuild what changed, once a frame
    flush() {
      for (const k of dirty) {
        const col = columns.get(k);
        if (col) build(col);
      }
      dirty.clear();
    },
    stats() {
      let meshes = 0;
      let vertices = 0;
      let sections = 0;
      for (const col of columns.values()) {
        sections += col.sections.filter(Boolean).length;
        for (const m of Object.values(col.meshes)) {
          meshes++;
          vertices += m.geometry.drawRange.count / 1.5;
        }
      }
      return { columns: columns.size, sections, meshes, vertices };
    },
    dispose() {
      for (const col of columns.values()) clearMeshes(col);
      columns.clear();
      scene.remove(group);
    },
  };
}
