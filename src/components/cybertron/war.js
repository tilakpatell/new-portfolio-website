// Cybertron at war, from orbit: fireballs bursting out of the plating where
// the fighting is, and now and then a bigger one boiling up off the edge of
// the world. Shared by the Cybertron page's globe (planet3d.js) and the
// universe map's (universe/planets.js).
//
// Each fireball is one billboard, all of them in a single draw: a few
// cards, turned to face you in the vertex shader, painted in the fragment
// shader with drifting noise (a white-hot heart, orange and red billows, a
// ring of flash as it goes off and dark smoke as it cools). They sit just
// off the surface in the planet's own frame, so they turn with it, and are
// tested against its depth, so the planet hides the ones round the back.
// Where they burst comes from the fires in the glow map (warZones), with a
// fixed list of the fronts to fall back on.
//
// Every burst runs on a clock of its own, worked out from `t`, so the same
// moment always looks the same and a planet that's been out of view picks up
// where it should be. Nothing is made after it's built.
//
// createWar({ radius, zones, count, flares, small, light })
//   → { group, update(t, camera, level), setZones(zones), dispose }
// `level` (0…1) is how fierce the war is: at 1 every burst goes off, lower
// and some sit a turn out and the rest burn smaller. `light` hangs a warm
// point light on whichever burst is brightest, to light the plating round it.
// `setZones` moves the fronts (warZones of a glow map that came later: the
// universe map's planet has a stand-in for its glow until it's near), each
// burst taking them up on its next round.

import * as THREE from 'three';

// a sphere's direction for a latitude and longitude in degrees, the way
// three's SphereGeometry (and so the maps) lay them out
function dir(lat, lon, out = new THREE.Vector3()) {
  const a = (lat * Math.PI) / 180;
  const o = (lon * Math.PI) / 180;
  return out.set(-Math.cos(o) * Math.cos(a), Math.sin(a), Math.sin(o) * Math.cos(a));
}

// the fronts, for when there's no glow map to read them from (these are the
// ones scripts/planets/transformers.mjs burned in when this was written)
const FRONTS = [
  [-5, 60, 0.32],
  [-12, 160, 0.26],
  [24, 210, 0.22],
  [-40, 270, 0.25],
  [30, 330, 0.2],
];

// Where the war is burning, read off the glow map's fire channel (green):
// each burning texel's direction, and a running total of how much it burns
// (bigger toward the equator, where a texel covers more ground), for picking
// one at random in proportion. Read once, small.
export function warZones(glow) {
  const img = glow?.image;
  const W = 256;
  const H = 128;
  try {
    if (!img || typeof document === 'undefined') throw new Error('no map');
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data;
    let max = 0;
    for (let i = 1; i < px.length; i += 4) max = Math.max(max, px[i]);
    if (max < 8) throw new Error('nothing burning');
    const cut = max * 0.18;
    const dirs = [];
    const sum = [];
    let total = 0;
    const d = new THREE.Vector3();
    for (let y = 0; y < H; y++) {
      const lat = 90 - ((y + 0.5) / H) * 180;
      const area = Math.cos((lat * Math.PI) / 180);
      for (let x = 0; x < W; x++) {
        const f = px[(y * W + x) * 4 + 1];
        if (f < cut) continue;
        dir(lat, ((x + 0.5) / W) * 360, d);
        dirs.push(d.x, d.y, d.z);
        total += (f / 255) * area;
        sum.push(total);
      }
    }
    return { dirs: new Float32Array(dirs), sum: new Float32Array(sum), spread: Math.PI / H };
  } catch {
    // the fronts themselves, each a cloud of points round its centre
    const dirs = [];
    const sum = [];
    const c = new THREE.Vector3();
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const p = new THREE.Vector3();
    let seed = 41;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (const [lat, lon, r] of FRONTS) {
      dir(lat, lon, c);
      e1.set(0, 1, 0).cross(c).normalize();
      e2.crossVectors(c, e1);
      for (let k = 0; k < 40; k++) {
        const a = rand() * Math.PI * 2;
        const s = Math.sqrt(rand()) * r;
        p.copy(c).multiplyScalar(Math.cos(s)).addScaledVector(e1, Math.cos(a) * Math.sin(s)).addScaledVector(e2, Math.sin(a) * Math.sin(s));
        dirs.push(p.x, p.y, p.z);
        sum.push(sum.length + 1);
      }
    }
    return { dirs: new Float32Array(dirs), sum: new Float32Array(sum), spread: 0.04 };
  }
}

// a number 0…1 from two whole numbers, the same every time
function hash(a, b) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const VERT = /* glsl */ `
  attribute vec4 aAt;   // where it is (the planet's frame), and how big
  attribute vec4 aLife; // how far through its life (0…1), its seed, 1 for a flare off the edge, how hot
  varying vec2 vQ;
  varying vec4 vLife;
  varying float vSeen;
  void main() {
    vec4 c = modelViewMatrix * vec4(aAt.xyz, 1.0);
    vec3 up = normalize(normalMatrix * aAt.xyz);
    float face = dot(up, normalize(-c.xyz)); // 1 facing you, 0 on the edge, below round the back
    float age = aLife.x;
    float flare = aLife.z;
    // it swells fast and then slowly
    float grow = 0.3 + 0.7 * (1.0 - pow(1.0 - min(age * 1.5, 1.0), 3.0));
    float size = aAt.w * grow;
    // the card's up is away from the planet, on the screen
    vec2 ax = normalize(up.xy + vec2(0.0, 0.015));
    vec2 sd = vec2(ax.y, -ax.x);
    vec2 q = position.xy * 2.0;
    // a flare stands up off the edge, taller than wide, its foot on the ground
    float tall = 1.0 + 0.45 * flare;
    float lift = (1.0 - face) * 0.35 + flare * (0.55 + age * 0.5);
    c.xy += (sd * q.x + ax * (q.y * tall + lift)) * size;
    // drawn a little nearer than it is, so the ground it's bursting out of
    // doesn't cut it, but still behind the planet once it's round the back
    c.z += aAt.w * 0.75;
    vQ = q;
    vLife = aLife;
    vSeen = smoothstep(-0.35, 0.05, face) * step(age, 0.999);
    gl_Position = projectionMatrix * c;
  }`;

const FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vQ;
  varying vec4 vLife;
  varying float vSeen;
  float wHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float wNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float wFbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < OCTAVES; i++) {
      s += a * wNoise(p);
      p = p * 2.07 + vec2(17.1, 9.3);
      a *= 0.5;
    }
    return s / (1.0 - 2.0 * a); // 0…1
  }
  // fire by its heat: soot, deep red, orange, yellow, white
  vec3 wRamp(float k) {
    vec3 c = mix(vec3(0.05, 0.01, 0.0), vec3(1.1, 0.12, 0.02), smoothstep(0.08, 0.3, k));
    c = mix(c, vec3(3.6, 1.0, 0.14), smoothstep(0.3, 0.55, k));
    c = mix(c, vec3(4.8, 2.1, 0.35), smoothstep(0.55, 0.8, k));
    return mix(c, vec3(6.5, 3.9, 1.3), smoothstep(0.84, 1.0, k));
  }
  void main() {
    if (vSeen <= 0.0) discard;
    float age = vLife.x;
    float seed = vLife.y * 97.0;
    float flare = vLife.z;
    vec2 q = vQ;
    // a flare is narrow at its foot and billows out above
    q.x *= mix(1.0, mix(1.7, 0.95, smoothstep(-1.0, 0.5, q.y)), flare);
    // the billows roll outward as it swells, and drift up away from the ground
    vec2 p = q * (1.0 - 0.3 * age);
    float t = uTime * 0.45;
    float n = wFbm(p * 2.4 + vec2(seed, seed * 0.7 - t));
    float m = wFbm(p * 5.2 + vec2(t * 0.8 + seed * 0.3, seed));
    // round, a little flattened below, lumpy at the edge
    float d = length(vec2(q.x, q.y * (q.y < 0.0 ? 1.2 : 0.9))) + (n - 0.5) * 0.8 + (m - 0.5) * 0.3;
    float body = smoothstep(0.98, 0.62, d);
    // hottest in its heart and at the start; it cools from the edge in
    float heat = (1.0 - smoothstep(-0.1, 0.95, d)) * (1.45 - age * 1.15) * vLife.w + (m - 0.5) * 0.35;
    heat = clamp(heat, 0.0, 1.0);
    vec3 fire = wRamp(heat) * body;
    // the flash as it goes off: a ring running out and a blink of white
    float r = length(vQ);
    float flash = 1.0 - smoothstep(0.0, 0.22, age);
    fire += vec3(4.0, 1.9, 0.6) * exp(-pow((r - 0.25 - age * 3.0) * 7.0, 2.0)) * flash * (1.0 - flare);
    fire += vec3(5.0, 2.8, 0.9) * smoothstep(0.7, 0.0, r) * flash * flash;
    // and smoke, where it has cooled, more of it as it goes
    float smoke = body * (1.0 - smoothstep(0.08, 0.32, heat)) * (0.2 + 0.6 * smoothstep(0.1, 0.8, age));
    float fade = smoothstep(0.0, 0.04, age) * (1.0 - smoothstep(0.6, 1.0, age)) * vSeen;
    // premultiplied: the fire adds its light, the smoke takes some away
    gl_FragColor = vec4((fire + vec3(0.02, 0.018, 0.02) * smoke) * fade, smoke * fade * 0.85);
  }`;

export function createWar({ radius = 1, zones = null, count = 8, flares = 1, small = false, light = false } = {}) {
  let Z = zones ?? warZones(null);
  const n = count + flares;
  const group = new THREE.Group();

  // the cards: one quad, drawn once a burst
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  const at = new Float32Array(n * 4);
  const life = new Float32Array(n * 4);
  const aAt = new THREE.InstancedBufferAttribute(at, 4).setUsage(THREE.DynamicDrawUsage);
  const aLife = new THREE.InstancedBufferAttribute(life, 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aAt', aAt);
  geo.setAttribute('aLife', aLife);
  geo.instanceCount = n;
  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    defines: { OCTAVES: small ? 3 : 4 },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; // (they're placed in the shader)
  mesh.raycast = () => {};
  mesh.renderOrder = 4;
  group.add(mesh);

  // each burst's own clock: how long it burns, how long it waits, where in
  // its round it starts; a flare burns longer and comes round less often
  const B = [];
  for (let i = 0; i < n; i++) {
    const flare = i >= count;
    const lifeS = flare ? 3.2 + hash(i, 101) * 1.4 : 1.6 + hash(i, 102) * 1.4;
    const wait = flare ? 2.5 + hash(i, 103) * 4 : 0.4 + hash(i, 104) * 2.4;
    B.push({ flare, life: lifeS, period: lifeS + wait, offset: hash(i, 105) * 40 + (flare ? ((i - count) / Math.max(1, flares)) * (lifeS + wait) : 0), k: NaN, x: 0, y: 0, z: 0, size: 0, heat: 0, seed: 0, on: false });
  }

  const eye = new THREE.Vector3();
  const d = new THREE.Vector3();
  const best = new THREE.Vector3();
  const side = new THREE.Vector3();
  let eyeDist = 0;

  // a burning spot, picked in proportion to how much it burns
  const pickZone = (u, out) => {
    const { sum, dirs } = Z;
    const goal = u * sum[sum.length - 1];
    let lo = 0;
    let hi = sum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sum[mid] < goal) lo = mid + 1;
      else hi = mid;
    }
    return out.set(dirs[lo * 3], dirs[lo * 3 + 1], dirs[lo * 3 + 2]);
  };
  // nudged off its texel a little, so no two bursts land on the same spot
  const jitter = (out, a, b) => {
    side.set(Math.abs(out.y) < 0.9 ? 0 : 1, Math.abs(out.y) < 0.9 ? 1 : 0, 0).cross(out).normalize();
    out.addScaledVector(side, (a - 0.5) * Z.spread * 2);
    side.cross(out).normalize();
    return out.addScaledVector(side, (b - 0.5) * Z.spread * 2).normalize();
  };
  // how squarely a spot faces you (0 on the edge, below round the back)
  const facing = (v) => {
    if (!eyeDist) return 1;
    const ex = eye.x * eyeDist - v.x * radius;
    const ey = eye.y * eyeDist - v.y * radius;
    const ez = eye.z * eyeDist - v.z * radius;
    return (v.x * ex + v.y * ey + v.z * ez) / Math.hypot(ex, ey, ez);
  };

  // a new round for burst i: where, how big, how hot, or whether it sits
  // this one out. Bursts go off where you can see them when they can; a
  // flare goes on the edge, wherever along it is burning
  const spawn = (b, i, k, level) => {
    const h = (j) => hash(i * 64 + j, k);
    b.on = h(0) < 0.55 + 0.45 * level || b.flare;
    let score = -Infinity;
    const tries = b.flare ? 10 : 6;
    for (let j = 0; j < tries; j++) {
      jitter(pickZone(h(1 + j * 3), d), h(2 + j * 3), h(3 + j * 3));
      const f = facing(d);
      const s = b.flare ? -Math.abs(f - 0.07) : f > 0.3 ? 2 : f;
      if (s > score) {
        score = s;
        best.copy(d);
        if (!b.flare && s === 2) break;
      }
    }
    // a flare whose front isn't on the edge just now goes to the edge
    // straight in front of it
    if (b.flare && eyeDist && score < -0.08) {
      const c = Math.min(0.95, radius / eyeDist + 0.06);
      best.addScaledVector(eye, -best.dot(eye));
      if (best.lengthSq() < 1e-6) best.set(eye.y, -eye.x, 0);
      best.normalize().multiplyScalar(Math.sqrt(1 - c * c)).addScaledVector(eye, c);
    }
    const lift = radius * (b.flare ? 1.012 : 1.006);
    b.x = best.x * lift;
    b.y = best.y * lift;
    b.z = best.z * lift;
    b.size = radius * (b.flare ? 0.18 + h(40) * 0.07 : 0.07 + h(41) ** 2 * 0.1) * (0.8 + 0.2 * level);
    b.heat = 0.85 + 0.3 * h(42);
    b.seed = h(43);
  };

  const glow = light ? new THREE.PointLight(0xff7a2e, 0, radius * 0.9, 2) : null;
  if (glow) group.add(glow);

  return {
    group,
    update(t, camera = null, level = 1) {
      uniforms.uTime.value = t;
      group.updateWorldMatrix(true, false);
      eyeDist = 0;
      if (camera) {
        group.worldToLocal(eye.copy(camera.position));
        eyeDist = eye.length();
        eye.divideScalar(eyeDist || 1);
      }
      let hot = 0;
      let hi = -1;
      for (let i = 0; i < n; i++) {
        const b = B[i];
        const ph = (t + b.offset) / b.period;
        const k = Math.floor(ph);
        if (k !== b.k) {
          b.k = k;
          spawn(b, i, k, level);
        }
        const age = ((ph - k) * b.period) / b.life;
        const live = b.on && age < 1;
        at[i * 4] = b.x;
        at[i * 4 + 1] = b.y;
        at[i * 4 + 2] = b.z;
        at[i * 4 + 3] = live ? b.size : 0;
        life[i * 4] = live ? age : 1;
        life[i * 4 + 1] = b.seed;
        life[i * 4 + 2] = b.flare ? 1 : 0;
        life[i * 4 + 3] = b.heat;
        if (glow && live) {
          const s = (b.size / radius) * b.heat * Math.max(0, 1 - age) * Math.min(1, age * 12) * Math.max(0, facing(d.set(b.x, b.y, b.z).normalize()));
          if (s > hot) {
            hot = s;
            hi = i;
          }
        }
      }
      aAt.needsUpdate = true;
      aLife.needsUpdate = true;
      if (glow) {
        // a little way up off the burst, so it pools on the plating round it
        if (hi >= 0) glow.position.set(B[hi].x, B[hi].y, B[hi].z).multiplyScalar(1.2);
        // and flickering, as fire does
        glow.intensity = hot * 1.8 * radius * radius * (0.85 + 0.15 * Math.sin(t * 23) * Math.sin(t * 7.3));
      }
    },
    setZones(zones) {
      Z = zones ?? warZones(null);
    },
    dispose() {
      quad.dispose();
      geo.dispose();
      mat.dispose();
    },
  };
}
