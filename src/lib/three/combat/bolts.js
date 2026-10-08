// The bolts drawn: one instanced mesh of thin additive streaks placed from
// lib/combat/bolt.js's pool each frame, and the flashes where they land.
// It draws what the pool says and decides nothing, so every world's bolts
// look the same and fly the same.
//
// createBoltMeshes(parent, { pool = 48, flashes = 12 }) → { sync(live),
// flash(at), update(dt), dispose() }; `live`: the pool's live() (each
// { pos, dir, flown, colour }); `at`: an [x, y, z] or anything with x, y, z.

import * as THREE from 'three';

const LONG = 1.6; // m, a streak's length at full stretch
const GLOW = 4; // over 1: the bloom catches it

export function createBoltMeshes(parent, { pool = 48, flashes: nFlashes = 12 } = {}) {
  const group = new THREE.Group();
  group.name = 'bolts';
  parent.add(group);
  const geo = new THREE.CylinderGeometry(0.035, 0.035, LONG, 6).rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, pool);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false; // (its bounds would be the first frame's)
  group.add(mesh);
  const colours = new Map();
  const colourOf = (c) => {
    if (!colours.has(c)) colours.set(c, new THREE.Color(c).multiplyScalar(GLOW));
    return colours.get(c);
  };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const d = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);

  const flashGeo = new THREE.SphereGeometry(0.35, 10, 8);
  const flashes = Array.from({ length: nFlashes }, () => {
    const m = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd0a0').multiplyScalar(3), toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.visible = false;
    group.add(m);
    return { m, age: 9 };
  });
  let nf = 0;

  return {
    group,
    mesh,
    // each live bolt a streak behind its head, as long as it has flown (so
    // a fresh one doesn't poke back through the gun)
    sync(live) {
      let n = 0;
      for (const b of live) {
        if (n >= pool) break;
        const len = Math.max(0.05, Math.min(LONG, b.flown ?? LONG));
        d.set(b.dir[0], b.dir[1], b.dir[2]);
        p.set(b.pos[0], b.pos[1], b.pos[2]).addScaledVector(d, -len / 2);
        q.setFromUnitVectors(Z, d);
        s.set(1, 1, len / LONG);
        mesh.setMatrixAt(n, m4.compose(p, q, s));
        mesh.setColorAt(n, colourOf(b.colour ?? '#ff3b30'));
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    flash(at) {
      const f = flashes[nf++ % flashes.length];
      if (Array.isArray(at)) f.m.position.set(at[0], at[1], at[2]);
      else f.m.position.set(at.x, at.y, at.z);
      f.age = 0;
      f.m.visible = true;
    },
    update(dt) {
      for (const f of flashes) {
        if (!f.m.visible) continue;
        f.age += dt;
        f.m.scale.setScalar(0.6 + f.age * 3);
        f.m.material.opacity = Math.max(0, 0.6 - f.age * 3);
        if (f.age > 0.2) f.m.visible = false;
      }
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      mesh.dispose();
      flashGeo.dispose();
      for (const f of flashes) f.m.material.dispose();
      group.removeFromParent();
    },
  };
}
