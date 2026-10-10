// What a shot looks like round the gun and where it lands: the muzzle flash
// (a star of fire seen from the front, two crossed petals of it seen from
// the side, a hot core, and for a powder gun a puff of smoke after it),
// a brass casing thrown out of a pistol's port, bouncing and rolling to a
// stop, and where a shot hits, a spray of sparks that fall and bounce, a
// scorch on the ground and an ember in it that cools. All pooled: nothing
// is made after the first shot, so nothing compiles mid-fight.
//
// createGunFx({ parent, unit, ground, light }) → { flash(at, dir, spec),
//   smoke(at, dir, n), casing(at, out, up), sparks(at, normal, color, n),
//   scorch(at, normal), toss(object, v) (something dropped: thrown from
//   where it is in the world, to land and lie; the caller still owns it),
//   update(dt), clear(), dispose() }
// Positions and directions are in `parent`'s space; `unit` is its units to
// the metre (METRE on the universe map, 1 on the galaxy's worlds);
// ground(p) → { h (how high p is over the ground, parent units), n (the
// up there, unit) }; light: an optional PointLight to flare with each flash
// (made by the caller where it never changes the scene's count of lights:
// { obj, place(p) }, its `userData.peak` the intensity at full).

import * as THREE from 'three';
import { sharpen } from '../../lib/three/textures';

const V = THREE.Vector3;
const G = 9.8; // m/s²

// One step of something small falling under gravity onto the ground and
// bouncing off it (`rest` of its speed back off the ground, `grip` of its
// speed along it kept). In place; true if it touched the ground this step.
export function bounce(p, v, dt, unit, ground, rest = 0.35, grip = 0.55) {
  const g = ground(p);
  v.addScaledVector(g.n, -G * unit * dt);
  p.addScaledVector(v, dt);
  const below = ground(p);
  if (below.h >= 0) return false;
  p.addScaledVector(below.n, -below.h); // back up onto it
  const into = v.dot(below.n);
  if (into < 0) {
    v.addScaledVector(below.n, -into); // what's left is along the ground
    v.multiplyScalar(grip);
    v.addScaledVector(below.n, -into * rest);
  }
  return true;
}

// ── Textures, drawn once ──
const canvasTex = (w, h, draw) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
let TEX = null;
const textures = () => {
  if (TEX) return TEX;
  TEX = {
    // the flash from the front: a hot middle and uneven spikes
    star: canvasTex(128, 128, (x, w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      const spikes = 7;
      x.translate(cx, cy);
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2 + (i % 2) * 0.2;
        const r = (0.62 + ((i * 37) % 11) / 30) * cx;
        const gr = x.createLinearGradient(0, 0, Math.cos(a) * r, Math.sin(a) * r);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(0.35, 'rgba(255,230,170,0.85)');
        gr.addColorStop(1, 'rgba(255,140,40,0)');
        x.fillStyle = gr;
        x.beginPath();
        x.moveTo(Math.cos(a - 0.22) * cx * 0.16, Math.sin(a - 0.22) * cx * 0.16);
        x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        x.lineTo(Math.cos(a + 0.22) * cx * 0.16, Math.sin(a + 0.22) * cx * 0.16);
        x.fill();
      }
      const core = x.createRadialGradient(0, 0, 0, 0, 0, cx * 0.42);
      core.addColorStop(0, 'rgba(255,255,255,1)');
      core.addColorStop(0.5, 'rgba(255,240,200,0.8)');
      core.addColorStop(1, 'rgba(255,180,80,0)');
      x.fillStyle = core;
      x.fillRect(-cx, -cy, w, h);
    }),
    // the flash from the side: a petal of fire, widest a little out from the muzzle (v = 0 at the muzzle)
    petal: canvasTex(64, 128, (x, w, h) => {
      const img = x.createImageData(w, h);
      for (let j = 0; j < h; j++) {
        const along = j / (h - 1); // 0 at the muzzle (the bottom row after the flip below)
        const width = (0.35 + 0.65 * Math.sin(Math.min(1, along * 1.6) * Math.PI * 0.5)) * (1 - along) ** 0.6;
        for (let i = 0; i < w; i++) {
          const across = Math.abs(i / (w - 1) - 0.5) * 2;
          const k = Math.max(0, 1 - across / Math.max(0.02, width)) ** 1.4 * (1 - along) ** 0.5;
          const o = ((h - 1 - j) * w + i) * 4;
          img.data[o] = 255;
          img.data[o + 1] = 200 + 55 * k;
          img.data[o + 2] = 120 + 135 * k * k;
          img.data[o + 3] = Math.round(255 * Math.min(1, k * 1.3));
        }
      }
      x.putImageData(img, 0, 0);
    }),
    // soft round things: smoke, a glow
    soft: canvasTex(64, 64, (x, w) => {
      const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, w, w);
    }),
    // a scorch: dark, ragged at the edge
    scorch: canvasTex(128, 128, (x, w) => {
      const c = w / 2;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        const r = c * (0.45 + ((i * 53) % 17) / 40);
        const g = x.createRadialGradient(c, c, 0, c + Math.cos(a) * r * 0.3, c + Math.sin(a) * r * 0.3, r);
        g.addColorStop(0, 'rgba(10,8,6,0.16)');
        g.addColorStop(1, 'rgba(10,8,6,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, w, w);
      }
      const g = x.createRadialGradient(c, c, 0, c, c, c * 0.5);
      g.addColorStop(0, 'rgba(6,5,4,0.85)');
      g.addColorStop(1, 'rgba(6,5,4,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, w, w);
    }),
  };
  return TEX;
};

const FLASH_LIFE = 0.06;
const SMOKE_LIFE = 0.9;
const CASING_LIFE = 5;
const SPARK_LIFE = [0.18, 0.5];
const SCORCH_LIFE = 9;
const EMBER_LIFE = 1.1;

export function createGunFx({ parent, unit = 1, ground, light = null }) {
  const T = textures();
  const group = new THREE.Group();
  group.name = 'gunfx';
  parent.add(group);
  const owned = [];
  const own = (o) => {
    owned.push(o);
    return o;
  };
  const glowMat = (map) => own(new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));

  // ── muzzle flashes: a star facing down the barrel, two crossed petals along it, a core ──
  const starGeo = own(new THREE.PlaneGeometry(1, 1));
  const petalGeo = own(new THREE.PlaneGeometry(0.42, 1).translate(0, 0.5, 0).rotateX(Math.PI / 2)); // from the muzzle out along +z
  const flashes = Array.from({ length: 6 }, () => {
    const g = new THREE.Group();
    const star = new THREE.Mesh(starGeo, glowMat(T.star));
    const a = new THREE.Mesh(petalGeo, glowMat(T.petal));
    const b = new THREE.Mesh(petalGeo, a.material);
    b.rotation.z = Math.PI / 2;
    const core = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: T.soft, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true })));
    g.add(star, a, b, core);
    for (const o of [star, a, b, core]) o.frustumCulled = false;
    g.visible = false;
    group.add(g);
    return { g, star, petals: [a, b], core, age: 1, life: FLASH_LIFE, size: 1 };
  });
  let nf = 0;

  // ── smoke ──
  const puffs = Array.from({ length: 20 }, () => {
    const s = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: T.soft, color: '#b9b4ab', transparent: true, depthWrite: false, opacity: 0 })));
    s.visible = false;
    group.add(s);
    return { s, v: new V(), age: 1, spin: 0 };
  });
  let np = 0;

  // ── casings: brass, a few millimetres, in the light ──
  const brass = own(new THREE.MeshStandardMaterial({ color: '#c9a14a', metalness: 0.9, roughness: 0.32 }));
  const caseGeo = own(new THREE.CylinderGeometry(0.0049, 0.0049, 0.019, 8).scale(unit, unit, unit));
  const casings = Array.from({ length: 10 }, () => {
    const m = new THREE.Mesh(caseGeo, brass);
    m.visible = false;
    m.castShadow = true;
    group.add(m);
    return { m, p: new V(), v: new V(), axis: new V(1, 0, 0), spin: 0, age: CASING_LIFE, bounces: 0 };
  });
  let nc = 0;

  // ── sparks: short streaks, white hot to the colour of the shot, falling ──
  const N_SPARK = 96;
  const sparkPos = new Float32Array(N_SPARK * 6);
  const sparkCol = new Float32Array(N_SPARK * 6);
  const sparkGeo = own(new THREE.BufferGeometry());
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3).setUsage(THREE.DynamicDrawUsage));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3).setUsage(THREE.DynamicDrawUsage));
  const sparkLines = new THREE.LineSegments(sparkGeo, own(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  sparkLines.frustumCulled = false;
  group.add(sparkLines);
  const sparks = Array.from({ length: N_SPARK }, () => ({ p: new V(), v: new V(), age: 1, life: 1, c: new THREE.Color() }));
  let ns = 0;
  let sparksLive = 0;

  // ── scorches, and the ember in each ──
  const decalGeo = own(new THREE.PlaneGeometry(1, 1));
  const scorches = Array.from({ length: 14 }, () => {
    const mark = new THREE.Mesh(decalGeo, own(new THREE.MeshBasicMaterial({ map: T.scorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, opacity: 0 })));
    const ember = new THREE.Mesh(decalGeo, own(new THREE.MeshBasicMaterial({ map: T.soft, color: '#ff7a2a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, opacity: 0 })));
    mark.renderOrder = 1;
    ember.renderOrder = 2;
    mark.visible = ember.visible = false;
    group.add(mark, ember);
    return { mark, ember, age: SCORCH_LIFE };
  });
  let nd = 0;

  // things dropped (a gun out of a falling trooper's hand)
  let tossed = [];

  const tmp = new V();
  const tq = new THREE.Quaternion();
  const zAxis = new V(0, 0, 1);
  const lit = { k: 0, color: new THREE.Color() };

  const api = {
    // a shot leaving the gun at `at`, along `dir`; spec: GUNS[kind].flash ({ color, size (m) })
    flash(at, dir, spec = { color: '#ffd36b', size: 0.2 }) {
      const f = flashes[nf++ % flashes.length];
      const c = new THREE.Color(spec.color);
      f.size = spec.size * unit * (0.85 + Math.random() * 0.3);
      f.age = 0;
      f.life = FLASH_LIFE * (0.8 + Math.random() * 0.4);
      f.g.position.copy(at);
      f.g.quaternion.setFromUnitVectors(zAxis, tmp.copy(dir).normalize());
      f.g.rotateZ(Math.random() * Math.PI * 2);
      f.star.material.color.copy(c).lerp(new THREE.Color('#ffffff'), 0.35).multiplyScalar(3);
      f.petals[0].material.color.copy(c).multiplyScalar(3.2);
      f.core.material.color.copy(c).lerp(new THREE.Color('#ffffff'), 0.6).multiplyScalar(4);
      f.g.visible = true;
      if (light) {
        lit.k = 1;
        lit.color.copy(c).lerp(new THREE.Color('#ffffff'), 0.4);
        light.obj.color.copy(lit.color);
        light.place(at);
      }
    },
    // a puff of powder smoke after it, drifting out along the barrel and rising
    smoke(at, dir, n = 3) {
      const up = ground(at).n;
      for (let i = 0; i < n; i++) {
        const o = puffs[np++ % puffs.length];
        o.s.position.copy(at).addScaledVector(dir, (0.02 + i * 0.03) * unit);
        o.v.copy(dir).multiplyScalar((0.9 - i * 0.2) * unit).addScaledVector(up, 0.18 * unit);
        o.v.x += (Math.random() - 0.5) * 0.2 * unit;
        o.v.z += (Math.random() - 0.5) * 0.2 * unit;
        o.age = -i * 0.03;
        o.spin = (Math.random() - 0.5) * 2;
        o.s.material.rotation = Math.random() * Math.PI * 2;
        o.s.visible = true;
      }
    },
    // a spent case out of the port at `at`, thrown `out` (unit, the gun's right) and up
    casing(at, out, up) {
      const o = casings[nc++ % casings.length];
      o.p.copy(at);
      o.v.copy(out).multiplyScalar((1.4 + Math.random() * 0.6) * unit).addScaledVector(up, (1.1 + Math.random() * 0.5) * unit);
      o.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      o.spin = 20 + Math.random() * 15;
      o.age = 0;
      o.bounces = 0;
      o.m.position.copy(at);
      o.m.visible = true;
    },
    // a shot landing on something at `at`, its face turned to `normal`: sparks off it
    sparks(at, normal, color = '#ffd0a0', n = 12) {
      const c = new THREE.Color(color);
      for (let i = 0; i < n; i++) {
        const s = sparks[ns++ % N_SPARK];
        s.p.copy(at).addScaledVector(normal, 0.01 * unit);
        // a cone off the face, some skidding along it
        s.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().addScaledVector(normal, 1.1).normalize();
        s.v.multiplyScalar((1.5 + Math.random() * 4.5) * unit);
        s.life = SPARK_LIFE[0] + Math.random() * (SPARK_LIFE[1] - SPARK_LIFE[0]);
        s.age = 0;
        s.c.copy(c).lerp(new THREE.Color('#ffffff'), 0.5 + Math.random() * 0.5);
      }
      sparksLive = N_SPARK;
    },
    // a burn where it hit the ground (or a wall): dark, with an ember that cools
    scorch(at, normal) {
      const d = scorches[nd++ % scorches.length];
      const size = (0.26 + Math.random() * 0.14) * unit;
      for (const m of [d.mark, d.ember]) {
        m.position.copy(at).addScaledVector(normal, 0.004 * unit);
        m.quaternion.setFromUnitVectors(zAxis, normal);
        m.rotateZ(Math.random() * Math.PI * 2);
        m.visible = true;
      }
      d.mark.scale.setScalar(size);
      d.ember.scale.setScalar(size * 0.55);
      d.age = 0;
    },
    toss(obj, v) {
      group.attach(obj); // (where it is, now in our space)
      tossed.push({ obj, v: v.clone(), axis: new V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), spin: 6 + Math.random() * 6, rest: false });
    },
    update(dt) {
      dt = Math.min(dt, 0.1);
      if (tossed.length) {
        tossed = tossed.filter((o) => o.obj.parent === group);
        for (const o of tossed) {
          if (o.rest) continue;
          if (bounce(o.obj.position, o.v, dt, unit, ground, 0.25, 0.45)) o.spin *= 0.4;
          o.obj.quaternion.premultiply(tq.setFromAxisAngle(o.axis, o.spin * dt));
          if (o.v.lengthSq() < (0.04 * unit) ** 2 && ground(o.obj.position).h < 0.01 * unit) o.rest = true;
        }
      }
      for (const f of flashes) {
        if (!f.g.visible) continue;
        f.age += dt / f.life;
        if (f.age >= 1) {
          f.g.visible = false;
          continue;
        }
        // out fast, then gone: a frame or two at full
        const k = f.age < 0.25 ? 1 : 1 - (f.age - 0.25) / 0.75;
        const grow = 0.7 + f.age * 0.6;
        f.star.scale.setScalar(f.size * 0.9 * grow);
        // (each petal's plane is across x, along z: wide by the flash, long by its age)
        for (const p of f.petals) p.scale.set(f.size * 0.75, f.size * 0.75, f.size * (1.2 + f.age * 0.8));
        f.core.scale.setScalar(f.size * 0.75);
        for (const m of [f.star.material, f.petals[0].material, f.core.material]) m.opacity = k;
      }
      if (light) {
        lit.k = Math.max(0, lit.k - dt / 0.07);
        light.obj.intensity = (light.obj.userData.peak ?? 1) * lit.k * lit.k;
      }
      for (const o of puffs) {
        if (!o.s.visible) continue;
        o.age += dt;
        if (o.age < 0) {
          o.s.material.opacity = 0;
          continue;
        }
        const k = o.age / SMOKE_LIFE;
        if (k >= 1) {
          o.s.visible = false;
          continue;
        }
        o.s.position.addScaledVector(o.v, dt);
        o.v.multiplyScalar(Math.exp(-dt * 2.4)); // the air slows it
        o.v.addScaledVector(ground(o.s.position).n, 0.12 * unit * dt); // and it rises
        o.s.scale.setScalar((0.05 + Math.sqrt(k) * 0.32) * unit);
        o.s.material.rotation += o.spin * dt;
        o.s.material.opacity = 0.32 * (1 - k) * Math.min(1, k * 8);
      }
      for (const o of casings) {
        if (!o.m.visible) continue;
        o.age += dt;
        if (o.age > CASING_LIFE) {
          o.m.visible = false;
          continue;
        }
        if (o.bounces < 4) {
          if (bounce(o.p, o.v, dt, unit, ground, 0.32, 0.5)) {
            o.bounces += 1;
            o.spin *= 0.45;
          }
          if (o.v.lengthSq() < (0.05 * unit) ** 2 && o.bounces) o.bounces = 4; // at rest
        }
        o.m.position.copy(o.p).addScaledVector(ground(o.p).n, 0.0049 * unit);
        if (o.bounces < 4) o.m.quaternion.premultiply(tq.setFromAxisAngle(o.axis, o.spin * dt));
      }
      if (sparksLive) {
        let live = 0;
        sparks.forEach((s, i) => {
          const o = i * 6;
          if (s.age >= 1) {
            sparkPos.fill(0, o, o + 6);
            sparkCol.fill(0, o, o + 6);
            return;
          }
          live++;
          s.age += dt / s.life;
          bounce(s.p, s.v, dt, unit, ground, 0.4, 0.6);
          s.v.multiplyScalar(Math.exp(-dt * 1.5));
          const fade = Math.max(0, 1 - s.age) ** 1.5;
          const tail = tmp.copy(s.p).addScaledVector(s.v, -0.022);
          sparkPos[o] = s.p.x;
          sparkPos[o + 1] = s.p.y;
          sparkPos[o + 2] = s.p.z;
          sparkPos[o + 3] = tail.x;
          sparkPos[o + 4] = tail.y;
          sparkPos[o + 5] = tail.z;
          const k = fade * 3;
          sparkCol[o] = s.c.r * k;
          sparkCol[o + 1] = s.c.g * k;
          sparkCol[o + 2] = s.c.b * k;
          sparkCol[o + 3] = s.c.r * k * 0.25;
          sparkCol[o + 4] = s.c.g * k * 0.18;
          sparkCol[o + 5] = s.c.b * k * 0.1;
        });
        sparkGeo.attributes.position.needsUpdate = true;
        sparkGeo.attributes.color.needsUpdate = true;
        sparksLive = live;
      }
      for (const d of scorches) {
        if (!d.mark.visible) continue;
        d.age += dt;
        if (d.age >= SCORCH_LIFE) {
          d.mark.visible = d.ember.visible = false;
          continue;
        }
        d.mark.material.opacity = 0.85 * Math.min(1, d.age * 12) * Math.min(1, (SCORCH_LIFE - d.age) / 2.5);
        const e = Math.max(0, 1 - d.age / EMBER_LIFE);
        d.ember.visible = e > 0;
        d.ember.material.opacity = e * e;
        d.ember.material.color.setRGB(1, 0.45 * e + 0.12, 0.12 * e).multiplyScalar(2.5);
      }
    },
    // all gone at once (leaving a planet)
    clear() {
      for (const f of flashes) f.g.visible = false;
      for (const o of puffs) o.s.visible = false;
      for (const o of casings) o.m.visible = false;
      for (const s of sparks) s.age = 1;
      sparkPos.fill(0);
      sparkCol.fill(0);
      sparkGeo.attributes.position.needsUpdate = true;
      sparkGeo.attributes.color.needsUpdate = true;
      for (const d of scorches) d.mark.visible = d.ember.visible = false;
      if (light) light.obj.intensity = 0;
      for (const o of tossed) o.obj.removeFromParent();
      tossed = [];
    },
    dispose() {
      group.removeFromParent();
      for (const o of owned) o.dispose?.();
      owned.length = 0;
    },
  };
  return api;
}
