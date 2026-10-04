// Smoke, fire, spray and splinters; foam, rings and warnings lying on the
// water; and the cannonballs. Three pools, three draw calls, nothing made or
// thrown away while the game runs.

import * as THREE from 'three';
import { WAVES_GLSL } from './sea';

const QUAD = () => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
};

// ── particles: camera-facing puffs. Colour is premultiplied, so one pool
// holds both the things that glow (alpha 0: fire, flashes, sparks) and the
// things that cover (smoke, spray, splinters). ──
export function createParticles(scene, ripples, max = 1500) {
  const geo = QUAD();
  const at = new Float32Array(max * 4); // x y z size
  const tint = new Float32Array(max * 4); // r g b a, premultiplied
  const misc = new Float32Array(max * 2); // spin, seed
  const aAt = new THREE.InstancedBufferAttribute(at, 4).setUsage(THREE.DynamicDrawUsage);
  const aTint = new THREE.InstancedBufferAttribute(tint, 4).setUsage(THREE.DynamicDrawUsage);
  const aMisc = new THREE.InstancedBufferAttribute(misc, 2).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aAt', aAt);
  geo.setAttribute('aTint', aTint);
  geo.setAttribute('aMisc', aMisc);
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uRipples: { value: ripples } },
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    fog: false,
    vertexShader: `
      attribute vec4 aAt;
      attribute vec4 aTint;
      attribute vec2 aMisc;
      varying vec2 vUv;
      varying vec4 vTint;
      varying float vSeed;
      void main() {
        vUv = position.xy;
        vTint = aTint;
        vSeed = aMisc.y;
        float c = cos(aMisc.x), s = sin(aMisc.x);
        vec2 corner = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * aAt.w;
        vec4 mv = viewMatrix * vec4(aAt.xyz, 1.0);
        mv.xy += corner;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uRipples;
      varying vec2 vUv;
      varying vec4 vTint;
      varying float vSeed;
      void main() {
        float r = length(vUv);
        if (r > 1.0) discard;
        vec4 n = texture2D(uRipples, vUv * 0.21 + vSeed);
        vec4 n2 = texture2D(uRipples, vUv * 0.09 - vSeed * 3.1);
        float soft = smoothstep(1.0, 0.15, r + (n.b - 0.5) * 0.9) * smoothstep(0.18, 0.75, n2.b * 0.55 + n.a * 0.45 + (1.0 - r) * 0.45);
        gl_FragColor = vTint * soft * (0.75 + 0.5 * n.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  scene.add(mesh);

  // the live ones, packed at the front of these arrays
  const P = { x: new Float32Array(max), y: new Float32Array(max), z: new Float32Array(max), vx: new Float32Array(max), vy: new Float32Array(max), vz: new Float32Array(max), age: new Float32Array(max), life: new Float32Array(max), s0: new Float32Array(max), s1: new Float32Array(max), r: new Float32Array(max), g: new Float32Array(max), b: new Float32Array(max), a: new Float32Array(max), glow: new Float32Array(max), grav: new Float32Array(max), drag: new Float32Array(max), spin: new Float32Array(max), rot: new Float32Array(max), seed: new Float32Array(max), fade: new Float32Array(max) };
  let n = 0;

  // one puff. glow 1 is light (added to what's behind), 0 is stuff (covers it)
  const add = (x, y, z, vx, vy, vz, { life = 1, size = 1, grow = 2, color = [1, 1, 1], alpha = 1, glow = 0, gravity = 0, drag = 0.6, spin = 0, fade = 0.15 } = {}) => {
    if (n >= max) return;
    const i = n++;
    P.x[i] = x;
    P.y[i] = y;
    P.z[i] = z;
    P.vx[i] = vx;
    P.vy[i] = vy;
    P.vz[i] = vz;
    P.age[i] = 0;
    P.life[i] = life;
    P.s0[i] = size;
    P.s1[i] = size * grow;
    P.r[i] = color[0];
    P.g[i] = color[1];
    P.b[i] = color[2];
    P.a[i] = alpha;
    P.glow[i] = glow;
    P.grav[i] = gravity;
    P.drag[i] = drag;
    P.spin[i] = spin;
    P.rot[i] = Math.random() * 6.28;
    P.seed[i] = Math.random();
    P.fade[i] = fade;
  };

  const KEYS = Object.keys(P);
  const update = (dt, wind) => {
    for (let i = 0; i < n; i++) {
      P.age[i] += dt;
      if (P.age[i] >= P.life[i]) {
        n -= 1;
        for (const k of KEYS) P[k][i] = P[k][n];
        i -= 1;
        continue;
      }
      const d = Math.exp(-P.drag[i] * dt);
      // smoke drifts off downwind; heavy things don't
      const blow = P.grav[i] === 0 ? dt * 0.8 : 0;
      P.vx[i] = P.vx[i] * d + wind.x * blow;
      P.vz[i] = P.vz[i] * d + wind.z * blow;
      P.vy[i] = P.vy[i] * d - P.grav[i] * dt;
      P.x[i] += P.vx[i] * dt;
      P.y[i] += P.vy[i] * dt;
      P.z[i] += P.vz[i] * dt;
      P.rot[i] += P.spin[i] * dt;
      const k = P.age[i] / P.life[i];
      const o = i * 4;
      at[o] = P.x[i];
      at[o + 1] = P.y[i];
      at[o + 2] = P.z[i];
      at[o + 3] = P.s0[i] + (P.s1[i] - P.s0[i]) * (1 - (1 - k) * (1 - k));
      const a = P.a[i] * Math.min(1, k / P.fade[i]) * (1 - k) * (1 - k * k);
      tint[o] = P.r[i] * a;
      tint[o + 1] = P.g[i] * a;
      tint[o + 2] = P.b[i] * a;
      tint[o + 3] = a * (1 - P.glow[i]);
      misc[i * 2] = P.rot[i];
      misc[i * 2 + 1] = P.seed[i];
    }
    geo.instanceCount = n;
    aAt.needsUpdate = true;
    aTint.needsUpdate = true;
    aMisc.needsUpdate = true;
  };

  return {
    add,
    update,
    clear() {
      n = 0;
      geo.instanceCount = 0;
    },
    get count() {
      return n;
    },
  };
}

// ── things that lie on the water and ride its waves: foam, rings, the red
// marks where something is about to land, the arcs your guns cover. Filled
// in afresh every frame: begin(), put(…) for each, end(). ──
export const DECAL = { foam: 0, ring: 1, mark: 2, strip: 3, arc: 4, shade: 5 };

export function createDecals(scene, sea, max = 520) {
  const geo = QUAD();
  const at = new Float32Array(max * 4); // x z rot kind
  const size = new Float32Array(max * 3); // half-width, half-length, progress
  const tint = new Float32Array(max * 4);
  const aAt = new THREE.InstancedBufferAttribute(at, 4).setUsage(THREE.DynamicDrawUsage);
  const aSize = new THREE.InstancedBufferAttribute(size, 3).setUsage(THREE.DynamicDrawUsage);
  const aTint = new THREE.InstancedBufferAttribute(tint, 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aAt', aAt);
  geo.setAttribute('aSize', aSize);
  geo.setAttribute('aTint', aTint);
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: sea.shared.uTime, uSea: sea.shared.uSea, uRipples: { value: sea.ripples } },
    transparent: true,
    depthWrite: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    vertexShader: `
      attribute vec4 aAt;
      attribute vec3 aSize;
      attribute vec4 aTint;
      varying vec2 vUv;
      varying vec4 vTint;
      varying float vKind;
      varying float vK;
      varying vec2 vWorld;
      ${WAVES_GLSL}
      void main() {
        vUv = position.xy;
        vTint = aTint;
        vKind = aAt.w;
        vK = aSize.z;
        float c = cos(aAt.z), s = sin(aAt.z);
        vec2 local = position.xy * aSize.xy;
        vec2 p = aAt.xy + vec2(local.x * c - local.y * s, local.x * s + local.y * c);
        vec3 n; float pinch;
        vec3 d = gerstner(p, distance(p, cameraPosition.xz), n, pinch);
        vWorld = p;
        gl_Position = projectionMatrix * viewMatrix * vec4(p.x + d.x, d.y + 0.12, p.y + d.z, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uRipples;
      uniform float uTime;
      varying vec2 vUv;
      varying vec4 vTint;
      varying float vKind;
      varying float vK;
      varying vec2 vWorld;
      void main() {
        float r = length(vUv);
        vec4 n = texture2D(uRipples, vWorld * 0.06 + uTime * 0.01);
        vec4 n2 = texture2D(uRipples, vWorld * 0.19 - uTime * 0.017);
        float lumpy = n.b * 0.55 + n2.a * 0.45;
        float a = 0.0;
        if (vKind < 0.5) {
          // foam: a ragged patch
          a = smoothstep(1.0, 0.2, r + (lumpy - 0.5) * 0.9) * smoothstep(0.25, 0.6, lumpy + (1.0 - r) * 0.35);
        } else if (vKind < 1.5) {
          // a ring spreading out, thinner as it goes
          float w = mix(0.3, 0.07, vK);
          a = smoothstep(w, 0.0, abs(r - (1.0 - w))) * smoothstep(0.2, 0.55, lumpy + 0.25);
        } else if (vKind < 2.5) {
          // a mark where something will land: the rim, and the middle filling as it comes
          float rim = smoothstep(0.06, 0.0, abs(r - 0.93));
          float fill = (1.0 - smoothstep(vK - 0.04, vK, r)) * 0.38;
          float pulse = 0.75 + 0.25 * sin(uTime * 14.0);
          a = max(rim * pulse, fill) * step(r, 1.0);
        } else if (vKind < 3.5) {
          // a strip, from its near end: where an arm comes down
          vec2 q = abs(vUv);
          float edge = max(smoothstep(0.82, 0.96, q.x), smoothstep(0.94, 0.99, q.y));
          float along = vUv.y * 0.5 + 0.5;
          float chev = step(0.5, fract(along * 5.0 - abs(vUv.x) * 0.6 - uTime * 2.2));
          float fill = step(along, vK) * (0.22 + 0.2 * chev);
          a = max(edge * 0.9, fill) * step(q.x, 1.0) * step(q.y, 1.0);
        } else if (vKind < 4.5) {
          // the arc a broadside covers: a fan from the ship's side
          float ang = atan(vUv.x, vUv.y + 1.0);
          float d = length(vec2(vUv.x, vUv.y + 1.0)) * 0.5;
          float inside = step(abs(ang), 0.5) * step(d, 1.0) * step(0.1, d);
          float rim = smoothstep(0.035, 0.0, abs(abs(ang) - 0.49)) + smoothstep(0.03, 0.0, abs(d - 0.985));
          float sweep = 0.1 + 0.1 * step(0.5, fract(d * 6.0 - uTime * 0.5));
          a = inside * max(rim * 0.8, sweep * (1.0 - d * 0.6)) * (0.35 + 0.65 * vK);
        } else {
          // a soft dark patch under a hull
          a = smoothstep(1.0, 0.1, r);
        }
        gl_FragColor = vec4(vTint.rgb, vTint.a * a);
        if (gl_FragColor.a < 0.004) discard;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  scene.add(mesh);
  let n = 0;
  return {
    begin() {
      n = 0;
    },
    // (x, z) the middle; w, l half-sizes; rot turns +l toward that heading
    put(kind, x, z, w, l, rot, r, g, b, a, k = 0) {
      if (n >= max || a <= 0.003) return;
      const o = n * 4;
      at[o] = x;
      at[o + 1] = z;
      at[o + 2] = rot;
      at[o + 3] = kind;
      size[n * 3] = w;
      size[n * 3 + 1] = l;
      size[n * 3 + 2] = k;
      tint[o] = r;
      tint[o + 1] = g;
      tint[o + 2] = b;
      tint[o + 3] = a;
      n += 1;
    },
    end() {
      geo.instanceCount = n;
      aAt.needsUpdate = true;
      aSize.needsUpdate = true;
      aTint.needsUpdate = true;
    },
  };
}

// ── foam that stays behind: wakes, splashes, the froth where something went
// down. Each patch spreads and fades; they're drawn as decals. ──
export function createFoam(max = 300) {
  const F = { x: new Float32Array(max), z: new Float32Array(max), r0: new Float32Array(max), r1: new Float32Array(max), age: new Float32Array(max), life: new Float32Array(max), a: new Float32Array(max), kind: new Uint8Array(max) };
  const KEYS = Object.keys(F);
  let n = 0;
  return {
    add(x, z, r0, r1, life, alpha = 0.7, kind = DECAL.foam) {
      if (n >= max) {
        // out of room: the oldest gives way
        let old = 0;
        for (let i = 1; i < n; i++) if (F.age[i] / F.life[i] > F.age[old] / F.life[old]) old = i;
        n -= 1;
        for (const k of KEYS) F[k][old] = F[k][n];
      }
      const i = n++;
      F.x[i] = x;
      F.z[i] = z;
      F.r0[i] = r0;
      F.r1[i] = r1;
      F.age[i] = 0;
      F.life[i] = life;
      F.a[i] = alpha;
      F.kind[i] = kind;
    },
    draw(dt, decals) {
      for (let i = 0; i < n; i++) {
        F.age[i] += dt;
        if (F.age[i] >= F.life[i]) {
          n -= 1;
          for (const k of KEYS) F[k][i] = F[k][n];
          i -= 1;
          continue;
        }
        const k = F.age[i] / F.life[i];
        const r = F.r0[i] + (F.r1[i] - F.r0[i]) * (1 - (1 - k) * (1 - k));
        decals.put(F.kind[i], F.x[i], F.z[i], r, r, i * 1.7, 0.86, 0.92, 0.94, F.a[i] * (1 - k) * Math.min(1, k * 8), k);
      }
    },
    clear() {
      n = 0;
    },
  };
}

// ── cannonballs (and the kraken's ink) ──
export function createBalls(scene, max = 220) {
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.7 }), max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.castShadow = false;
  scene.add(mesh);
  const m = new THREE.Matrix4();
  const iron = new THREE.Color(0x15171a);
  const cursed = new THREE.Color(0.6, 3.2, 1.2); // over 1: it glows
  const ink = new THREE.Color(0x120a1c);
  let n = 0;
  return {
    begin() {
      n = 0;
    },
    put(x, y, z, kind) {
      if (n >= max) return;
      const r = kind === 'ink' ? 2.6 : 0.5;
      m.makeScale(r, r, r).setPosition(x, y, z);
      mesh.setMatrixAt(n, m);
      mesh.setColorAt(n, kind === 'ink' ? ink : kind === 'hot' ? cursed : iron);
      n += 1;
    },
    end() {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
