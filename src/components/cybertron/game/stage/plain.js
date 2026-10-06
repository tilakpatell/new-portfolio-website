// A place drawn plainly from its data alone: the ground, every solid as
// plated metal (or rock, out in the desert), the bridges' portals and a sky.
// What an area without a stage of its own is drawn with.

import * as THREE from 'three';
import { drum, makeSky, merged, platedMaterial, slab } from './common';

export async function buildStage(area) {
  const group = new THREE.Group();
  const look = area.look ?? {};
  const desert = look.sky === 'desert';
  const sky = makeSky(look.sky ?? 'iacon', { sun: look.sun?.dir });
  if (sky) group.add(sky);
  const hemi = new THREE.HemisphereLight(desert ? '#cfe0ff' : '#6a8a84', desert ? '#8a6a48' : '#202826', desert ? 1.2 : 1.0);
  const sun = new THREE.DirectionalLight(look.sun?.color ?? '#ffffff', look.sun?.intensity ?? 1.5);
  sun.position.set(...(look.sun?.dir ?? [0.4, 1, 0.3]).map((v) => v * 400));
  group.add(hemi, sun);
  const B = area.bounds;
  const groundMat = platedMaterial(desert ? { base: '#8a5a38', alt: '#9a6a44', trim: '#7a4e30', windows: 0, panel: [40, 40], metalness: 0, roughness: 0.95 } : { base: '#2a302e', alt: '#323a38', trim: '#454e4c', windows: 0, panel: [6, 6], metalness: 0.4, roughness: 0.7 });
  const ground = new THREE.Mesh(slab(0, 0, B.maxX + (desert ? 800 : 10), B.maxZ + (desert ? 800 : 10), -1, 0, 0, 0.3), groundMat);
  group.add(ground);
  const parts = area.solids.map((s, i) => (s.kind === 'circle' ? drum(s.x, s.z, s.r, s.r * (s.tag === 'mesa' ? 0.8 : 1), s.base ?? 0, s.top, s.tag === 'mesa' ? 9 : 20, (i % 7) / 7) : slab(s.x, s.z, s.hw, s.hd, s.base ?? 0, s.top, s.yaw ?? 0, (i % 7) / 7)));
  const solidMat = platedMaterial(desert ? { base: '#9a5a36', alt: '#b06a40', trim: '#7a4228', windows: 0, panel: [12, 6], metalness: 0, roughness: 0.95 } : { windows: 0.2, base: '#39423f', alt: '#46514d' });
  const solids = new THREE.Mesh(merged(parts), solidMat);
  group.add(solids);
  if (area.ceiling < Infinity) {
    const roof = new THREE.Mesh(slab(0, 0, B.maxX, B.maxZ, area.ceiling, area.ceiling + 1, 0, 0.2), groundMat);
    group.add(roof);
    // the walls round the room
    const walls = new THREE.Mesh(
      merged([slab(0, B.minZ - 1, B.maxX, 1, 0, area.ceiling, 0, 0.4), slab(0, B.maxZ + 1, B.maxX, 1, 0, area.ceiling, 0, 0.4), slab(B.minX - 1, 0, 1, B.maxZ, 0, area.ceiling, 0, 0.4), slab(B.maxX + 1, 0, 1, B.maxZ, 0, area.ceiling, 0, 0.4)]),
      solidMat,
    );
    group.add(walls);
  }
  // the bridges: a green swirl standing where each one is
  const swirl = new THREE.MeshBasicMaterial({ color: new THREE.Color('#5dff9a').multiplyScalar(1.6), transparent: true, opacity: 0.7, toneMapped: false, side: THREE.DoubleSide });
  for (const x of area.exits) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(x.r, 0.8, 8, 40), swirl);
    ring.position.set(x.x, x.r + 1, x.z);
    ring.rotation.y = Math.atan2(-x.x, -x.z);
    group.add(ring);
  }
  return {
    group,
    floor: [ground], // what the area's light is baked on (lib/three/groundwork)
    update(t) {
      if (sky) sky.userData.uniforms.uTime.value = t;
    },
    dispose() {
      group.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        o.material.dispose?.();
      });
    },
  };
}
