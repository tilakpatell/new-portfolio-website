// The Death Star's trench, out in deep space: the trench run model the site
// owner sent (public/models/universe/trench.glb, the trench itself, without
// its little ships), laid round the Death Star's middle again and again, a
// ring of straight sections each square to the one before, its floor deep
// enough to fly down (ship.js lets the ship into it, as far as the floor).
// One draw for the lot: the sections are instances of the one mesh.
//
// createTrench(wonder) → { group, ready, dispose() } (the model loads in the
// background; until it's here there's no trench to see)

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { TRENCH_MODEL, trenchOf } from './deep';

const URL = '/models/universe/trench.glb';

export function createTrench(wonder) {
  const group = new THREE.Group();
  group.position.set(...wonder.at);
  const made = [];
  let dead = false;
  const out = { group, ready: false, dispose };

  const { segments, scale } = trenchOf(wonder);
  // where a section's middle is in the model: halfway along it, in the
  // middle of the trench, level with its rim
  const mid = new THREE.Vector3((TRENCH_MODEL.x[0] + TRENCH_MODEL.x[1]) / 2, TRENCH_MODEL.rim, (TRENCH_MODEL.z[0] + TRENCH_MODEL.z[1]) / 2);
  const toMid = new THREE.Matrix4().makeTranslation(-mid.x, -mid.y, -mid.z);
  const scaled = new THREE.Matrix4().makeScale(scale, scale, scale);
  const basis = new THREE.Matrix4();
  const place = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  const along = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0);

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
        const geo = part.geometry.clone().applyMatrix4(part.matrixWorld);
        const mat = part.material;
        if ('roughness' in mat) mat.roughness = Math.max(mat.roughness ?? 1, 0.8);
        if ('metalness' in mat) mat.metalness = 0.15;
        const inst = new THREE.InstancedMesh(geo, mat, segments);
        for (let i = 0; i < segments; i++) {
          // each section's trench runs round the Death Star (the model's x
          // along the ring), its rim facing out (y outward), its width
          // across the equator (z along the Death Star's axis)
          const a = (i / segments) * Math.PI * 2;
          outward.set(Math.cos(a), 0, Math.sin(a));
          along.set(-Math.sin(a), 0, Math.cos(a));
          basis.makeBasis(along, outward, axis);
          place.makeTranslation(outward.x * wonder.r, 0, outward.z * wonder.r);
          m.copy(place).multiply(basis).multiply(scaled).multiply(toMid);
          inst.setMatrixAt(i, m);
        }
        inst.instanceMatrix.needsUpdate = true;
        inst.computeBoundingSphere();
        group.add(inst);
        made.push(geo, mat);
      }
      out.ready = parts.length > 0;
    })
    .catch(() => {});

  function dispose() {
    dead = true;
    for (const x of made) {
      for (const v of Object.values(x)) if (v?.isTexture) v.dispose();
      x.dispose();
    }
  }
  return out;
}
