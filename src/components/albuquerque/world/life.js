// What moves and glows in Albuquerque: the Balloon Fiesta's balloons over
// the valley, tumbleweeds crossing the roads, the Blue Sky crystals left out
// in the desert, the lights that come on at night, the cook's smoke over the
// RV, and the pizza on Walt's roof. Each maker returns { object, update,
// dispose } and draws in one or two calls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CRYSTALS } from './rules';
import { sharpen } from '../../../lib/three/textures';

const seeded = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// A soft round glow, for halos, pools of light and sparks.
export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── the Balloon Fiesta ──
const BALLOON_COLORS = [0xd92b2b, 0xf3c623, 0x1f6fd1, 0xf27a1a, 0xf4efe2, 0x2f9e58, 0x7b3fb2, 0xe85d9a, 0x18a6a6, 0x1c1c22];

export function createBalloons({ count = 34, seed = 9 } = {}) {
  const rand = seeded(seed);
  const profile = [
    [0.16, 0],
    [0.2, 0.05],
    [0.42, 0.45],
    [0.72, 0.9],
    [0.93, 1.3],
    [1, 1.62],
    [0.94, 1.92],
    [0.74, 2.2],
    [0.42, 2.4],
    [0.001, 2.47],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const envelope = new THREE.LatheGeometry(profile, 24);
  const basket = new THREE.BoxGeometry(0.2, 0.17, 0.2).translate(0, -0.34, 0);
  // the basket is marked by a v below zero, so the shader leaves it wicker
  const buv = basket.attributes.uv;
  for (let i = 0; i < buv.count; i++) buv.setXY(i, 0, -1);
  const geometry = mergeGeometries([envelope, basket]);
  envelope.dispose();
  basket.dispose();

  const a = new Float32Array(count * 3);
  const b = new Float32Array(count * 3);
  const style = new Float32Array(count);
  const col = new THREE.Color();
  const list = [];
  for (let i = 0; i < count; i++) {
    const ia = Math.floor(rand() * BALLOON_COLORS.length);
    let ib = Math.floor(rand() * BALLOON_COLORS.length);
    if (ib === ia) ib = (ib + 3) % BALLOON_COLORS.length;
    col.set(BALLOON_COLORS[ia]).toArray(a, i * 3);
    col.set(BALLOON_COLORS[ib]).toArray(b, i * 3);
    style[i] = Math.floor(rand() * 5);
    // more of them towards the Sandias, where the dawn box wind takes them
    const ang = rand() < 0.6 ? (rand() - 0.5) * 2.2 : rand() * Math.PI * 2;
    list.push({ a: ang, r: 130 + rand() ** 0.8 * 420, y: 38 + rand() * 170, s: 6.5 + rand() * 4.5, w: (0.004 + rand() * 0.006) * (rand() < 0.5 ? 1 : -1), ph: rand() * 20 });
  }
  geometry.setAttribute('aA', new THREE.InstancedBufferAttribute(a, 3));
  geometry.setAttribute('aB', new THREE.InstancedBufferAttribute(b, 3));
  geometry.setAttribute('aStyle', new THREE.InstancedBufferAttribute(style, 1));

  const uniforms = { uGlow: { value: 0 }, uTime: { value: 0 } };
  const material = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 });
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aA;\nattribute vec3 aB;\nattribute float aStyle;\nvarying vec3 vA;\nvarying vec3 vB;\nvarying float vStyle;\nvarying vec2 vBUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvA = aA; vB = aB; vStyle = aStyle; vBUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vA;\nvarying vec3 vB;\nvarying float vStyle;\nvarying vec2 vBUv;\nuniform float uGlow;\nuniform float uTime;')
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        {
          float m;
          if (vStyle < 0.5) m = step(0.5, fract(vBUv.x * 8.0));
          else if (vStyle < 1.5) m = step(0.5, fract(vBUv.y * 5.0));
          else if (vStyle < 2.5) m = step(0.5, fract(vBUv.x * 6.0 + vBUv.y * 2.5));
          else if (vStyle < 3.5) m = step(0.5, fract(vBUv.y * 5.0 + abs(fract(vBUv.x * 12.0) - 0.5) * 1.2));
          else m = mod(floor(vBUv.x * 12.0) + floor(vBUv.y * 7.0), 2.0);
          vec3 bc = mix(vA, vB, m);
          bc = mix(bc, vB, step(0.93, vBUv.y));
          if (vBUv.y < -0.5) bc = vec3(0.13, 0.08, 0.045);
          diffuseColor.rgb = bc;
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        // the burner lights the envelope from inside, brightest at the mouth
        totalEmissiveRadiance += diffuseColor.rgb * uGlow * (0.5 + 0.5 * sin(uTime * 2.6 + vStyle * 2.1 + vA.r * 31.0)) * smoothstep(1.0, 0.05, vBUv.y) * step(-0.5, vBUv.y) * 1.6;`,
      );
  };
  material.customProgramCacheKey = () => 'abq-balloon';

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  const o = new THREE.Object3D();
  const update = (clock, glow) => {
    uniforms.uGlow.value = glow;
    uniforms.uTime.value = clock;
    for (let i = 0; i < count; i++) {
      const q = list[i];
      const ang = q.a + clock * q.w;
      o.position.set(Math.cos(ang) * q.r, q.y + Math.sin(clock * 0.31 + q.ph) * 3.5, Math.sin(ang) * q.r);
      o.rotation.set(Math.sin(clock * 0.4 + q.ph) * 0.035, q.ph + clock * 0.04, Math.cos(clock * 0.33 + q.ph) * 0.035);
      o.scale.setScalar(q.s);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0, 0);
  return {
    object: mesh,
    update,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

// ── tumbleweeds, bowling east on the wind, out in the desert north and south of town ──
// (`bands`: the stretches of z they roll along, clear of the city)
export function createTumbleweeds({ count = 7, seed = 4, radius = 235, model = null, bands = [[-380, -225], [205, 360]], height = () => 0 } = {}) {
  const rand = seeded(seed);
  const outer = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.62, 2));
  const inner = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.4, 1));
  const material = new THREE.LineBasicMaterial({ color: 0x8a6b3f });
  const group = new THREE.Group();
  const weeds = [];
  for (let i = 0; i < count; i++) {
    const w = new THREE.Group();
    if (model) {
      // the real thing (a model about 1.3 m across, centred here so it rolls about its middle)
      const m = model.clone();
      m.position.y = -0.62;
      w.add(m);
    } else {
      w.add(new THREE.LineSegments(outer, material), new THREE.LineSegments(inner, material));
      w.children[1].rotation.set(1, 2, 0.5);
    }
    const s = 0.8 + rand() * 0.9;
    w.scale.setScalar(s);
    group.add(w);
    const band = bands[i % bands.length];
    weeds.push({ w, s, band, x: (rand() * 2 - 1) * radius, z: band[0] + rand() * (band[1] - band[0]), v: 3 + rand() * 3.5, ph: rand() * 9, drift: (rand() - 0.5) * 1.2 });
  }
  return {
    object: group,
    // each one where it is ({ x, z, s, w }: w its group, s its size), for the blob under it
    weeds,
    update(dt, clock) {
      for (const t of weeds) {
        t.x += t.v * dt;
        t.z = Math.max(t.band[0], Math.min(t.band[1], t.z + t.drift * dt));
        if (t.x > radius) {
          t.x = -radius;
          t.z = t.band[0] + rand() * (t.band[1] - t.band[0]);
        }
        const hop = Math.abs(Math.sin(clock * 2.1 + t.ph));
        t.w.position.set(t.x, height(t.x, t.z) + 0.62 * t.s + hop * hop * 0.7, t.z);
        t.w.rotation.z = -(t.x / (0.62 * t.s));
        t.w.rotation.y = t.ph;
      }
    },
    dispose() {
      outer.dispose();
      inner.dispose();
      material.dispose();
    },
  };
}

// ── Blue Sky ──
export function createCrystals({ glow }) {
  const shards = [];
  const rand = seeded(17);
  for (let i = 0; i < 6; i++) {
    const h = 0.7 + rand() * 0.9;
    const s = new THREE.OctahedronGeometry(0.34, 0).scale(1, h * 2.3, 1);
    s.rotateZ((rand() - 0.5) * 0.9);
    s.rotateX((rand() - 0.5) * 0.9);
    s.translate((rand() - 0.5) * 0.7, h * 0.55, (rand() - 0.5) * 0.7);
    shards.push(s);
  }
  const geometry = mergeGeometries(shards);
  geometry.computeVertexNormals();
  for (const s of shards) s.dispose();
  const material = new THREE.MeshStandardMaterial({ color: 0x6fd6ff, emissive: 0x1e9cff, emissiveIntensity: 2.6, roughness: 0.12, metalness: 0, flatShading: true, transparent: true, opacity: 0.94 });
  const mesh = new THREE.InstancedMesh(geometry, material, CRYSTALS.length);
  mesh.frustumCulled = false;
  // a thin column of light over each, to find them by
  const beamGeo = new THREE.CylinderGeometry(0.12, 0.5, 30, 10, 1, true).translate(0, 15, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x2aa8ff).multiplyScalar(1.6), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const beams = new THREE.InstancedMesh(beamGeo, beamMat, CRYSTALS.length);
  beams.frustumCulled = false;
  // sparks, for when one's taken
  const sparkMat = new THREE.PointsMaterial({ map: glow, color: new THREE.Color(0x6fd6ff).multiplyScalar(3), size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const N = 28;
  const sparkPos = new Float32Array(N * 3);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  const vel = Array.from({ length: N }, () => new THREE.Vector3());
  let burst = 1;

  const group = new THREE.Group();
  group.add(mesh, beams, sparks);
  const o = new THREE.Object3D();
  let got = new Set();
  return {
    object: group,
    setGot(ids) {
      got = new Set(ids);
    },
    burst(id) {
      const c = CRYSTALS.find((x) => x.id === id);
      if (!c) return;
      burst = 0;
      for (let i = 0; i < N; i++) {
        sparkPos.set([c.x, 1.2, c.z], i * 3);
        vel[i].set(Math.random() - 0.5, Math.random() * 1.1 + 0.3, Math.random() - 0.5).multiplyScalar(9);
      }
    },
    update(dt, clock, night) {
      CRYSTALS.forEach((c, i) => {
        const here = !got.has(c.id);
        o.position.set(c.x, here ? 0.35 + Math.sin(clock * 1.7 + i) * 0.18 : -50, c.z);
        o.rotation.set(0, clock * 0.6 + i, 0);
        o.scale.setScalar(here ? 1.25 : 0.001);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
        o.rotation.set(0, 0, 0);
        o.position.y = here ? 0 : -80;
        o.scale.setScalar(1);
        o.updateMatrix();
        beams.setMatrixAt(i, o.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      beams.instanceMatrix.needsUpdate = true;
      beamMat.opacity = 0.07 + 0.22 * night + 0.03 * Math.sin(clock * 2);
      material.emissiveIntensity = 2.2 + night * 0.5 + Math.sin(clock * 3) * 0.3;
      if (burst < 1) {
        burst = Math.min(1, burst + dt / 0.9);
        for (let i = 0; i < N; i++) {
          vel[i].y -= 14 * dt;
          sparkPos[i * 3] += vel[i].x * dt;
          sparkPos[i * 3 + 1] = Math.max(0.1, sparkPos[i * 3 + 1] + vel[i].y * dt);
          sparkPos[i * 3 + 2] += vel[i].z * dt;
        }
        sparkGeo.attributes.position.needsUpdate = true;
        sparkMat.opacity = 1 - burst;
      } else sparkMat.opacity = 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
    },
  };
}

// ── the lights that come on at night ──
// lamps: [{ x, y, z }] bulbs with a halo. pools: [{ x, z, r, color }] light
// lying on the ground. Nothing here is a real light: bulbs bright enough to
// bloom, and soft discs added onto the road.
export function createNightLights({ lamps, pools, glow }) {
  const group = new THREE.Group();
  const sodium = new THREE.Color(0xffb35a);
  const bulbGeo = new THREE.SphereGeometry(0.2, 8, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lamps.length);
  const o = new THREE.Object3D();
  const pos = new Float32Array(lamps.length * 3);
  lamps.forEach((l, i) => {
    o.position.set(l.x, l.y, l.z);
    o.updateMatrix();
    bulbs.setMatrixAt(i, o.matrix);
    pos.set([l.x, l.y, l.z], i * 3);
  });
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const haloMat = new THREE.PointsMaterial({ map: glow, color: sodium.clone(), size: 4, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  const halos = new THREE.Points(haloGeo, haloMat);
  const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({ map: glow, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
  const poolMesh = new THREE.InstancedMesh(poolGeo, poolMat, pools.length);
  const c = new THREE.Color();
  pools.forEach((p, i) => {
    o.position.set(p.x, 0.19, p.z);
    o.scale.set(p.r * 2, 1, p.r * 2);
    o.updateMatrix();
    poolMesh.setMatrixAt(i, o.matrix);
    poolMesh.setColorAt(i, c.set(p.color ?? 0xffb35a));
  });
  for (const m of [bulbs, halos, poolMesh]) m.frustumCulled = false;
  group.add(bulbs, halos, poolMesh);
  group.visible = false;
  return {
    object: group,
    update(night) {
      group.visible = night > 0.02;
      if (!group.visible) return;
      // (a lamp's glow, not a flare: the bloom does the rest for the near
      // ones, and the far ones fade into the haze, as they would)
      bulbMat.color.copy(sodium).multiplyScalar(night * 3);
      haloMat.opacity = night * 0.4;
      poolMat.opacity = night * 0.32;
    },
    dispose() {
      bulbGeo.dispose();
      bulbMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      poolGeo.dispose();
      poolMat.dispose();
    },
  };
}

// ── the cook's smoke, out of the RV's roof vent ──
export function createSmoke({ x, y, z, map, count = 12, color = 0xd9cf8a }) {
  const group = new THREE.Group();
  const puffs = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.SpriteMaterial({ map, color, transparent: true, opacity: 0, depthWrite: false });
    const s = new THREE.Sprite(m);
    group.add(s);
    puffs.push({ s, m, t: i / count, sway: Math.sin(i * 12.9) * 0.6 });
  }
  return {
    object: group,
    update(dt, day) {
      for (const p of puffs) {
        p.t = (p.t + dt / 7) % 1;
        const k = p.t;
        p.s.position.set(x + k * k * 9 + p.sway * k * 3, y + k * 13, z + p.sway * k * 2);
        p.s.scale.setScalar(0.9 + k * 6);
        p.m.opacity = Math.sin(Math.min(1, k * 4) * Math.PI * 0.5) * (1 - k) * (0.2 + 0.4 * day);
      }
    },
    dispose() {
      for (const p of puffs) p.m.dispose();
    },
  };
}

// ── the pizza on the roof ──
export function createPizza() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const rand = seeded(33);
  g.fillStyle = '#c98f45';
  g.beginPath();
  g.arc(128, 128, 126, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e8b64a';
  g.beginPath();
  g.arc(128, 128, 110, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(190, 70, 30, ${0.25 + rand() * 0.3})`;
    g.beginPath();
    g.arc(128 + (rand() - 0.5) * 190, 128 + (rand() - 0.5) * 190, 6 + rand() * 12, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 92;
    g.fillStyle = '#a3261c';
    g.beginPath();
    g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(60, 10, 5, 0.35)';
    g.beginPath();
    g.arc(128 + Math.cos(a) * r + 2, 128 + Math.sin(a) * r + 2, 8, 0, Math.PI * 2);
    g.fill();
  }
  const map = new THREE.CanvasTexture(c);
  sharpen(map);
  map.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.CylinderGeometry(1.25, 1.25, 0.07, 28);
  const top = new THREE.MeshStandardMaterial({ map, roughness: 0.8 });
  const side = new THREE.MeshStandardMaterial({ color: 0xb98240, roughness: 0.9 });
  const mesh = new THREE.Mesh(geometry, [side, top, side]);
  return {
    object: mesh,
    dispose() {
      geometry.dispose();
      top.dispose();
      side.dispose();
      map.dispose();
    },
  };
}
