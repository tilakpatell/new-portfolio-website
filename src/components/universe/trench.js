// The Death Star's trench run, out in deep space: the trench run model the
// site owner sent (public/models/universe/trench.glb, the trench itself,
// without its little ships), laid in the Death Star's trench all the way
// round, straight sections each square to the one before, its floor deep
// enough to fly down (ship.js lets the ship into the trench, as far as the
// floor). The sections are instances of the one mesh, a few to a chunk, and
// only the chunks near the camera, on its side of the Death Star, are drawn
// (a section is some 26,000 triangles; from further off the Death Star's
// own trench, drawn on it, does).
//
// createTrench(wonder, { small }) → { group, wake(), near(cam), dispose() }:
// the model loads the first time it's woken (the scene does as you come out
// toward it); until it's here there's only the Death Star's own trench to
// see. near(cam), each frame: which chunks show, for the camera at `cam`
// (the map's space)

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { TRENCH_MODEL, trenchOf } from './deep';

const URL = '/models/universe/trench.glb';
const CHUNK = 3; // sections to a chunk
const SHOW = { far: 110, small: 75 }; // how near the camera a chunk's middle must be to be drawn

// a copy of a geometry with every attribute in plain floats (the model's are
// packed into small integers, which can't take a transform: they'd clip)
function unpacked(geometry) {
  const geo = geometry.clone();
  const get = ['getX', 'getY', 'getZ', 'getW'];
  for (const [name, a] of Object.entries(geo.attributes)) {
    const f = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) f[i * a.itemSize + k] = a[get[k]](i);
    geo.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
  }
  return geo;
}

export function createTrench(wonder, { small = false } = {}) {
  const group = new THREE.Group();
  group.position.set(...wonder.at);
  const made = [];
  const chunks = []; // { meshes, at (its middle, from the Death Star's), out (the way its rim faces) }
  let dead = false;
  let woken = false;
  const out = { group, ready: false, wake, near, dispose };

  const { segments, stretch, scale, home } = trenchOf(wonder);
  // where a section's middle is in the model: halfway along it, in the
  // middle of the trench, level with its rim
  const mid = new THREE.Vector3((TRENCH_MODEL.x[0] + TRENCH_MODEL.x[1]) / 2, TRENCH_MODEL.rim + TRENCH_MODEL.sink, (TRENCH_MODEL.z[0] + TRENCH_MODEL.z[1]) / 2);
  const toMid = new THREE.Matrix4().makeTranslation(-mid.x, -mid.y, -mid.z);
  const scaled = new THREE.Matrix4().makeScale(scale, scale, scale);
  const basis = new THREE.Matrix4();
  const place = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  const along = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0);

  // (the middle of what's laid is square to the way home: trenchOf's `home`)
  const angleOf = (i) => home + ((i - (stretch - 1) / 2) / segments) * Math.PI * 2;
  for (let c = 0; c * CHUNK < stretch; c++) {
    const first = c * CHUNK;
    const count = Math.min(CHUNK, stretch - first);
    const a = angleOf(first + (count - 1) / 2);
    const o = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    chunks.push({ first, count, meshes: [], out: o, at: o.clone().multiplyScalar(wonder.r) });
  }
  const far = small ? SHOW.small : SHOW.far;
  const rel = new THREE.Vector3();
  const to = new THREE.Vector3();
  function near(cam) {
    if (!out.ready) return;
    rel.copy(cam).sub(group.position);
    for (const ch of chunks) {
      const d = to.copy(rel).sub(ch.at).length();
      // near enough, and not round the far side of the Death Star from you
      const show = d < far && to.dot(ch.out) > -0.35 * d;
      for (const m of ch.meshes) m.visible = show;
    }
  }
  function wake() {
    if (woken) return;
    woken = true;
    load();
  }
  function load() {
    new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .loadAsync(URL)
      .then((gltf) => {
        if (dead) return;
        gltf.scene.updateMatrixWorld(true);
        // the trench itself (not the X-wings and TIEs racing down it)
        const parts = [];
        gltf.scene.traverse((o) => {
          if (o.isMesh && /DeathStarTrench/i.test(`${o.name} ${o.parent?.name ?? ''}`)) parts.push(o);
        });
        for (const part of parts) {
          const geo = unpacked(part.geometry).applyMatrix4(part.matrixWorld);
          const mat = part.material;
          if ('roughness' in mat) mat.roughness = Math.max(mat.roughness ?? 1, 0.8);
          if ('metalness' in mat) mat.metalness = 0.15;
          for (const ch of chunks) {
            const inst = new THREE.InstancedMesh(geo, mat, ch.count);
            for (let j = 0; j < ch.count; j++) {
              // each section's trench runs round the Death Star (the model's x
              // along the ring), its rim facing out (y outward), its width
              // across the equator (z along the Death Star's axis)
              const a = angleOf(ch.first + j);
              outward.set(Math.cos(a), 0, Math.sin(a));
              along.set(-Math.sin(a), 0, Math.cos(a));
              basis.makeBasis(along, outward, axis);
              place.makeTranslation(outward.x * wonder.r, 0, outward.z * wonder.r);
              m.copy(place).multiply(basis).multiply(scaled).multiply(toMid);
              inst.setMatrixAt(j, m);
            }
            inst.instanceMatrix.needsUpdate = true;
            inst.computeBoundingSphere();
            inst.visible = false; // (till near() says)
            ch.meshes.push(inst);
            group.add(inst);
          }
          made.push(geo, mat);
        }
        out.ready = parts.length > 0;
      })
      .catch(() => {});
  }

  function dispose() {
    dead = true;
    for (const x of made) {
      for (const v of Object.values(x)) if (v?.isTexture) v.dispose();
      x.dispose();
    }
  }
  return out;
}
