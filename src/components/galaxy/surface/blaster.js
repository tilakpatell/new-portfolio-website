// Blaster fire on the ground: your bolts (from your hand, along where the
// camera's looking, onto whatever's in the way first: a target, the
// ground, a wall) and theirs (at you, a little off), each a streak of light
// that flies and a flash where it lands.
//
// createBlaster({ parent, world }) → { fire(from, dir, color) → what it'll
// hit ({ target, at } or null), enemy(from, to, spread), update(dt) →
// hits on you (damage), dispose() }

import * as THREE from 'three';
import { groundAt } from './walker';

const SPEED = 140; // m/s
const RANGE = 90;
const POOL = 32;

export function createBlaster({ parent, world }) {
  const group = new THREE.Group();
  group.name = 'bolts';
  parent.add(group);
  const geo = new THREE.CylinderGeometry(0.035, 0.035, 1.6, 6).rotateX(Math.PI / 2);
  const mats = new Map();
  const mat = (color) => {
    if (!mats.has(color)) mats.set(color, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    return mats.get(color);
  };
  const bolts = Array.from({ length: POOL }, () => {
    const m = new THREE.Mesh(geo, mat('#ff3b30'));
    m.visible = false;
    group.add(m);
    return { m, v: new THREE.Vector3(), life: 0, theirs: false, end: null };
  });
  // flashes where they land
  const flashGeo = new THREE.SphereGeometry(0.35, 10, 8);
  const flashes = Array.from({ length: 12 }, () => {
    const m = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd0a0').multiplyScalar(3), toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.visible = false;
    group.add(m);
    return { m, age: 9 };
  });
  let nb = 0;
  let nf = 0;
  const flash = (at) => {
    const f = flashes[nf++ % flashes.length];
    f.m.position.copy(at);
    f.age = 0;
    f.m.visible = true;
  };
  const shoot = (from, dir, color, theirs, end) => {
    const b = bolts[nb++ % POOL];
    b.m.material = mat(color);
    b.m.position.copy(from);
    b.v.copy(dir).normalize().multiplyScalar(SPEED);
    b.m.lookAt(from.clone().add(dir));
    b.m.visible = true;
    b.life = Math.min(RANGE, end ? from.distanceTo(end) : RANGE) / SPEED;
    b.theirs = theirs;
    b.end = end;
    return b;
  };

  // the first thing along a ray: a target (a sphere round its middle) or the ground
  const along = (from, dir, targets) => {
    const d = dir.clone().normalize();
    let best = null;
    let bestT = RANGE;
    const c = new THREE.Vector3();
    for (const t of targets) {
      const tall = (t.fig?.tall ?? 1.6) * (t.spec?.scale ?? 1);
      c.copy(t.holder.position).add(new THREE.Vector3(0, tall * 0.55, 0));
      const rad = Math.max(0.45, tall * 0.35);
      const oc = c.clone().sub(from);
      const tc = oc.dot(d);
      if (tc < 0 || tc > bestT) continue;
      const miss = oc.lengthSq() - tc * tc;
      if (miss > rad * rad) continue;
      best = t;
      bestT = tc;
    }
    // the ground, in steps
    for (let s = 1; s < bestT; s += 1.5) {
      const p = from.clone().addScaledVector(d, s);
      if (p.y < groundAt(world, p.x, p.z, p.y)) {
        return { target: null, at: p };
      }
    }
    return best ? { target: best, at: from.clone().addScaledVector(d, bestT) } : { target: null, at: from.clone().addScaledVector(d, RANGE) };
  };

  return {
    // yours: what it hits is decided now, and it flies there
    fire(from, dir, targets, color = '#ff3b30') {
      const hit = along(from, dir, targets);
      shoot(from, dir, color, false, hit.at);
      return hit;
    },
    // theirs, at `to` (a point on you), off by `spread`
    enemy(from, to, spread = 0.06, color = '#ff3b30', damage = 8) {
      const f = new THREE.Vector3(...from);
      const dir = to.clone().sub(f).normalize();
      dir.x += (Math.random() - 0.5) * spread * 2;
      dir.y += (Math.random() - 0.5) * spread;
      dir.z += (Math.random() - 0.5) * spread * 2;
      const b = shoot(f, dir.normalize(), color, true, null);
      b.damage = damage;
      b.target = to.clone();
    },
    // on with them; returns how hard you were hit this frame
    update(dt, you) {
      let hurt = 0;
      for (const b of bolts) {
        if (!b.m.visible) continue;
        b.m.position.addScaledVector(b.v, dt);
        b.life -= dt;
        // theirs: close enough to you as it goes by, it's a hit
        if (b.theirs && you) {
          const dx = b.m.position.x - you.x;
          const dz = b.m.position.z - you.z;
          const dy = b.m.position.y - (you.y + 1);
          if (dx * dx + dz * dz < 0.3 && Math.abs(dy) < 1) {
            hurt += b.damage ?? 8;
            b.life = 0;
          }
        }
        if (b.life <= 0) {
          b.m.visible = false;
          if (!b.theirs || hurt) flash(b.m.position);
        }
      }
      for (const f of flashes) {
        if (!f.m.visible) continue;
        f.age += dt;
        f.m.scale.setScalar(1 + f.age * 6);
        f.m.material.opacity = Math.max(0, 1 - f.age * 5);
        if (f.age > 0.2) f.m.visible = false;
      }
      return hurt;
    },
    dispose() {
      geo.dispose();
      flashGeo.dispose();
      for (const m of mats.values()) m.dispose();
      for (const f of flashes) f.m.material.dispose();
      group.removeFromParent();
    },
  };
}
