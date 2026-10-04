// Effects for the HQ games, all pooled so a busy moment allocates nothing:
// sparks and embers (additive points), fire and smoke (soft billboards), debris
// (instanced chunks that tumble, bounce and settle), shockwave rings, beams,
// and brief point-light flashes. Each kind is one draw call however many are
// alive. `calm` (reduced motion) skips the flashes and halves the counts.

import * as THREE from 'three';

// soft round sprites painted once
function spriteTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  if (kind === 'smoke') {
    // a lumpy puff: several soft blobs
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 18; i++) {
      const px = 64 + (r() - 0.5) * 50;
      const py = 64 + (r() - 0.5) * 50;
      const rad = 18 + r() * 26;
      const g = x.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.32)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
    }
  } else {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(kind === 'spark' ? 0.18 : 0.35, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const POINT_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec4 aColor;
  attribute float aSpin;
  varying vec4 vColor;
  varying float vSpin;
  uniform float uScale;
  void main() {
    vColor = aColor;
    vSpin = aSpin;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  }
`;
const POINT_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying vec4 vColor;
  varying float vSpin;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vSpin), s = sin(vSpin);
    p = mat2(c, -s, s, c) * p + 0.5;
    vec4 t = texture2D(uMap, p);
    gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
    if (gl_FragColor.a < 0.003) discard;
  }
`;

// A pool of point sprites: position, velocity, life, size and colour over life.
function pointPool(max, { texture, blending, depthWrite = false }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const size = new Float32Array(max);
  const color = new Float32Array(max * 4);
  const spin = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSpin', new THREE.BufferAttribute(spin, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: texture }, uScale: { value: 400 } },
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    transparent: true,
    depthWrite,
    blending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const p = Array.from({ length: max }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, age: 0, s0: 1, s1: 1, c0: new THREE.Color(), c1: new THREE.Color(), a0: 1, drag: 0, g: 0, rot: 0, vr: 0, ground: -Infinity }));
  let next = 0;
  const spawn = (o) => {
    const q = p[next];
    next = (next + 1) % max;
    q.alive = true;
    q.age = 0;
    Object.assign(q, o);
    return q;
  };
  const tmp = new THREE.Color();
  const update = (dt) => {
    for (let i = 0; i < max; i++) {
      const q = p[i];
      if (!q.alive) {
        color[i * 4 + 3] = 0;
        size[i] = 0;
        continue;
      }
      q.age += dt;
      if (q.age >= q.life) {
        q.alive = false;
        color[i * 4 + 3] = 0;
        size[i] = 0;
        continue;
      }
      const k = q.age / q.life;
      const drag = Math.exp(-q.drag * dt);
      q.vx *= drag;
      q.vy = q.vy * drag - q.g * dt;
      q.vz *= drag;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      if (q.y < q.ground) {
        q.y = q.ground;
        q.vy *= -0.3;
        q.vx *= 0.6;
        q.vz *= 0.6;
      }
      q.rot += q.vr * dt;
      pos[i * 3] = q.x;
      pos[i * 3 + 1] = q.y;
      pos[i * 3 + 2] = q.z;
      size[i] = q.s0 + (q.s1 - q.s0) * k;
      tmp.copy(q.c0).lerp(q.c1, k);
      color[i * 4] = tmp.r;
      color[i * 4 + 1] = tmp.g;
      color[i * 4 + 2] = tmp.b;
      // fade in quickly, out over the last part of life
      color[i * 4 + 3] = q.a0 * Math.min(1, k * 8) * (1 - Math.max(0, (k - 0.5) / 0.5) ** 1.5);
      spin[i] = q.rot;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
    geo.attributes.aSpin.needsUpdate = true;
  };
  return { points, spawn, update, mat, kill: () => p.forEach((q) => (q.alive = false)) };
}

export function createVfx(scene, { calm = false, maxSparks = 900, maxPuffs = 260, maxDebris = 160, debrisMaterial, ground = 0 } = {}) {
  const sparkTex = spriteTexture('spark');
  const glowTex = spriteTexture('glow');
  const smokeTex = spriteTexture('smoke');
  const sparks = pointPool(maxSparks, { texture: sparkTex, blending: THREE.AdditiveBlending });
  const fire = pointPool(Math.round(maxPuffs / 2), { texture: glowTex, blending: THREE.AdditiveBlending });
  const smoke = pointPool(maxPuffs, { texture: smokeTex, blending: THREE.NormalBlending });
  // smoke first, then fire and sparks over it
  smoke.points.renderOrder = 5;
  fire.points.renderOrder = 6;
  sparks.points.renderOrder = 7;
  scene.add(smoke.points, fire.points, sparks.points);

  // debris: tumbling chunks
  const chunk = new THREE.DodecahedronGeometry(0.5, 0);
  const debrisMat = debrisMaterial ?? new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.8, roughness: 0.45 });
  const debris = new THREE.InstancedMesh(chunk, debrisMat, maxDebris);
  debris.castShadow = true;
  debris.frustumCulled = false;
  debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(debris);
  const bits = Array.from({ length: maxDebris }, () => ({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), s: 1, life: 0, age: 0, ground }));
  let nextBit = 0;
  const m4 = new THREE.Matrix4();
  const qd = new THREE.Quaternion();
  const sv = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);

  // rings and beams: a few meshes reused
  const ringGeo = new THREE.RingGeometry(0.9, 1, 64);
  const rings = Array.from({ length: 8 }, () => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
    m.visible = false;
    m.userData = { age: 0, life: 1, r0: 1, r1: 5 };
    scene.add(m);
    return m;
  });
  let nextRing = 0;
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
  const beams = Array.from({ length: 12 }, () => {
    const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    m.visible = false;
    m.userData = { age: 0, life: 0.1, w: 0.05 };
    m.renderOrder = 8;
    scene.add(m);
    return m;
  });
  let nextBeam = 0;
  const lights = Array.from({ length: calm ? 0 : 3 }, () => {
    const l = new THREE.PointLight(0xffaa66, 0, 12, 2);
    l.userData = { age: 0, life: 0.3, peak: 0 };
    scene.add(l);
    return l;
  });
  let nextLight = 0;

  const n = (count) => Math.max(1, Math.round(calm ? count / 2 : count));
  const rand = Math.random;
  const dirScatter = (out, spread, dir) => {
    out.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
    if (dir) out.multiplyScalar(spread).add(dir).normalize();
    return out;
  };
  const v = new THREE.Vector3();

  const api = {
    sparks(at, { count = 24, speed = 9, color = 0xffc070, to = 0xff5a20, life = 0.5, size = 0.12, dir = null, spread = 1, gravity = 9 } = {}) {
      for (let i = 0; i < n(count); i++) {
        dirScatter(v, spread, dir);
        const sp = speed * (0.35 + rand() * 0.65);
        sparks.spawn({ x: at.x, y: at.y, z: at.z, vx: v.x * sp, vy: v.y * sp, vz: v.z * sp, life: life * (0.5 + rand() * 0.6), s0: size * (0.6 + rand() * 0.8), s1: 0, a0: 1, drag: 1.2, g: gravity, rot: 0, vr: 0, ground, c0: new THREE.Color(color).multiplyScalar(3), c1: new THREE.Color(to).multiplyScalar(1.5) });
      }
    },
    fire(at, { size = 2.2, count = 10, life = 0.7, color = 0xffd08a, to = 0xc2410c, rise = 2 } = {}) {
      for (let i = 0; i < n(count); i++) {
        dirScatter(v, 1, null);
        fire.spawn({ x: at.x + v.x * size * 0.25, y: at.y + v.y * size * 0.25, z: at.z + v.z * size * 0.25, vx: v.x * size * 1.2, vy: v.y * size + rise, vz: v.z * size * 1.2, life: life * (0.6 + rand() * 0.6), s0: size * (0.6 + rand() * 0.5), s1: size * 1.6, a0: 0.9, drag: 3, g: -1, rot: rand() * 6, vr: (rand() - 0.5) * 2, ground: -Infinity, c0: new THREE.Color(color).multiplyScalar(4), c1: new THREE.Color(to).multiplyScalar(0.6) });
      }
    },
    smoke(at, { size = 2, count = 8, life = 2.4, color = 0x3a3a3c, to = 0x6b6b70, rise = 1.4, opacity = 0.7, spread = 1 } = {}) {
      for (let i = 0; i < n(count); i++) {
        dirScatter(v, 1, null);
        smoke.spawn({ x: at.x + v.x * spread * 0.5, y: at.y + Math.abs(v.y) * spread * 0.3, z: at.z + v.z * spread * 0.5, vx: v.x * spread, vy: rise * (0.6 + rand() * 0.6), vz: v.z * spread, life: life * (0.6 + rand() * 0.6), s0: size * 0.6, s1: size * (1.8 + rand()), a0: opacity, drag: 1.5, g: -0.2, rot: rand() * 6, vr: (rand() - 0.5) * 0.8, ground: -Infinity, c0: new THREE.Color(color), c1: new THREE.Color(to) });
      }
    },
    // a trail puff (exhausts): one small soft glow
    trail(at, { size = 0.5, life = 0.35, color = 0xffb070, to = 0x552200, a = 0.8 } = {}) {
      fire.spawn({ x: at.x, y: at.y, z: at.z, vx: 0, vy: 0.3, vz: 0, life, s0: size, s1: size * 0.2, a0: a, drag: 0, g: 0, rot: 0, vr: 0, ground: -Infinity, c0: new THREE.Color(color).multiplyScalar(3), c1: new THREE.Color(to) });
    },
    debris(at, { count = 10, speed = 7, size = 0.12, life = 3.5, dir = null, spread = 1 } = {}) {
      for (let i = 0; i < n(count); i++) {
        const b = bits[nextBit];
        nextBit = (nextBit + 1) % maxDebris;
        dirScatter(v, spread, dir);
        b.alive = true;
        b.age = 0;
        b.life = life * (0.7 + rand() * 0.6);
        b.p.copy(at);
        b.v.copy(v).multiplyScalar(speed * (0.4 + rand() * 0.6));
        b.v.y += speed * 0.4;
        b.w.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(14);
        b.q.random();
        b.s = size * (0.5 + rand());
      }
    },
    ring(at, { color = 0xbff4ff, from = 0.5, to = 6, life = 0.5, normal = new THREE.Vector3(0, 1, 0), opacity = 0.9 } = {}) {
      if (calm) return;
      const r = rings[nextRing];
      nextRing = (nextRing + 1) % rings.length;
      r.position.copy(at);
      r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
      r.material.color.set(color).multiplyScalar(2);
      r.userData = { age: 0, life, r0: from, r1: to, o: opacity };
      r.visible = true;
    },
    beam(a, b, { color = 0xaef3ff, width = 0.06, life = 0.12 } = {}) {
      const m = beams[nextBeam];
      nextBeam = (nextBeam + 1) % beams.length;
      m.position.copy(a);
      const d = v.copy(b).sub(a);
      const len = d.length();
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
      m.scale.set(width, width, len);
      m.material.color.set(color).multiplyScalar(3);
      m.material.opacity = 1;
      m.userData = { age: 0, life, w: width };
      m.visible = true;
      return m;
    },
    flash(at, { color = 0xffa860, intensity = 40, distance = 14, life = 0.25 } = {}) {
      if (!lights.length) return;
      const l = lights[nextLight];
      nextLight = (nextLight + 1) % lights.length;
      l.position.copy(at);
      l.color.set(color);
      l.distance = distance;
      l.userData = { age: 0, life, peak: intensity };
      l.intensity = intensity;
    },
    // a full explosion: flash, fireball, smoke, sparks, debris, shockwave
    explode(at, { scale = 1, color = 0xffd08a } = {}) {
      api.flash(at, { intensity: 60 * scale, distance: 18 * scale });
      api.fire(at, { size: 1.6 * scale, count: 9, color });
      api.smoke(at, { size: 2.2 * scale, count: 7, spread: 1.4 * scale });
      api.sparks(at, { count: 40, speed: 14 * scale, life: 0.8 });
      api.debris(at, { count: 12, speed: 9 * scale, size: 0.14 * scale });
      api.ring(at, { from: 0.5, to: 7 * scale, life: 0.45, color: 0xffd8a8, normal: new THREE.Vector3(0, 1, 0) });
    },
    update(dt, camera, viewportHeight = 800) {
      const scale = viewportHeight / (2 * Math.tan(((camera.fov ?? 60) * Math.PI) / 360));
      sparks.mat.uniforms.uScale.value = scale;
      fire.mat.uniforms.uScale.value = scale;
      smoke.mat.uniforms.uScale.value = scale;
      sparks.update(dt);
      fire.update(dt);
      smoke.update(dt);
      for (let i = 0; i < maxDebris; i++) {
        const b = bits[i];
        if (!b.alive) {
          debris.setMatrixAt(i, zero);
          continue;
        }
        b.age += dt;
        if (b.age > b.life) {
          b.alive = false;
          debris.setMatrixAt(i, zero);
          continue;
        }
        b.v.y -= 18 * dt;
        b.p.addScaledVector(b.v, dt);
        if (b.p.y < b.ground + b.s * 0.4) {
          b.p.y = b.ground + b.s * 0.4;
          b.v.y *= -0.35;
          b.v.x *= 0.55;
          b.v.z *= 0.55;
          b.w.multiplyScalar(0.6);
        }
        qd.setFromEuler(new THREE.Euler(b.w.x * dt, b.w.y * dt, b.w.z * dt));
        b.q.multiply(qd);
        const fade = Math.min(1, (b.life - b.age) / 0.6);
        sv.setScalar(b.s * fade);
        debris.setMatrixAt(i, m4.compose(b.p, b.q, sv));
      }
      debris.instanceMatrix.needsUpdate = true;
      for (const r of rings) {
        if (!r.visible) continue;
        const u = r.userData;
        u.age += dt;
        const k = u.age / u.life;
        if (k >= 1) {
          r.visible = false;
          continue;
        }
        const e = 1 - (1 - k) ** 3;
        r.scale.setScalar(u.r0 + (u.r1 - u.r0) * e);
        r.material.opacity = u.o * (1 - k);
      }
      for (const m of beams) {
        if (!m.visible) continue;
        const u = m.userData;
        u.age += dt;
        const k = u.age / u.life;
        if (k >= 1) {
          m.visible = false;
          continue;
        }
        m.material.opacity = 1 - k;
        const w = u.w * (1 - k * 0.6);
        m.scale.x = m.scale.y = w;
      }
      for (const l of lights) {
        const u = l.userData;
        if (!u.peak) continue;
        u.age += dt;
        const k = u.age / u.life;
        l.intensity = k >= 1 ? 0 : u.peak * (1 - k) ** 2;
        if (k >= 1) u.peak = 0;
      }
    },
    clear() {
      sparks.kill();
      fire.kill();
      smoke.kill();
      bits.forEach((b) => (b.alive = false));
      rings.forEach((r) => (r.visible = false));
      beams.forEach((m) => (m.visible = false));
      lights.forEach((l) => {
        l.intensity = 0;
        l.userData.peak = 0;
      });
    },
    dispose() {
      for (const t of [sparkTex, glowTex, smokeTex]) t.dispose();
      chunk.dispose();
      ringGeo.dispose();
      beamGeo.dispose();
    },
  };
  return api;
}
