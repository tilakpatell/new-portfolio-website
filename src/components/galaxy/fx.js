// What the galaxy's battles are made of, each a pool drawn in one go:
// laser bolts (turbolasers between capital ships, a fighter's cannons, the
// ion cannon's bolts at Hoth), each its side's colour and hot enough to
// bloom, flying from where it's fired to where it's aimed and calling back
// when it gets there; and flashes, where a bolt lands, a fighter goes up or
// a ship jumps away (a bright core that swells and cools from white through
// orange to nothing).
//
// createBolts(parent, { count }) → { mesh, fire(from, to, { color, speed, width, length, onHit }), update(dt), busy, dispose() }
// createFlashes(parent, { count, look }) → { at(point, { size, color, life }), update(dt, camera), setLook({ burst, ramp }), busy, dispose() }
//
// A flash takes the 2017 game's look where the bucket had it (lib/three/fx/
// gameLook: the impact sheet's burst rays through its body, and the fire
// cooling along the game's black-body ramp instead of to a dull red); where
// not, or with `look: null`, it is drawn as it always was.

import * as THREE from 'three';
import { loadLook } from '../../lib/three/fx/gameLook';

export const LASER = {
  empire: [0.5, 5.5, 0.9], // green
  rebel: [5.8, 0.75, 0.55], // red
  republic: [0.7, 2.4, 6.5], // blue
  separatist: [6.2, 0.7, 0.4], // red
  remnant: [0.5, 5.5, 0.9], // green, as the Empire's were
  mandalorian: [5.6, 1.2, 0.5], // red-orange
  naboo: [5.4, 1.4, 0.5],
  ion: [7.5, 3.2, 1.2], // the ion cannon's, orange-white
};

const Z = new THREE.Vector3(0, 0, 1);

export function createBolts(parent, { count = 160 } = {}) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1).rotateX(Math.PI / 2); // along z, 1 long
  const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // (the instance colours made now, not at the first shot: the shader is built with them or without, and a first shot would build it again)
  mesh.setColorAt(0, new THREE.Color(1, 1, 1));
  mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.count = 0;
  parent.add(mesh);
  const live = [];
  const free = Array.from({ length: count }, () => ({ from: new THREE.Vector3(), dir: new THREE.Vector3(), at: 0, len: 0, speed: 0, width: 0, size: 0, color: new THREE.Color(), onHit: null }));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  return {
    mesh,
    // from and to: Vector3s (copied); onHit(point) when it gets there
    fire(from, to, { color = LASER.empire, speed = 60, width = 0.05, length = 2.4, onHit = null } = {}) {
      const b = free.pop();
      if (!b) return false;
      b.from.copy(from);
      b.dir.copy(to).sub(from);
      b.len = b.dir.length();
      if (b.len < 1e-3) {
        free.push(b);
        return false;
      }
      b.dir.divideScalar(b.len);
      b.at = 0;
      b.speed = speed;
      b.width = width;
      b.size = length;
      b.color.setRGB(...color);
      b.onHit = onHit;
      live.push(b);
      return true;
    },
    get busy() {
      return live.length > 0;
    },
    update(dt) {
      let n = 0;
      for (let i = live.length - 1; i >= 0; i--) {
        const b = live[i];
        b.at += b.speed * dt;
        if (b.at >= b.len) {
          live.splice(i, 1);
          free.push(b);
          b.onHit?.(p.copy(b.from).addScaledVector(b.dir, b.len));
          continue;
        }
      }
      for (const b of live) {
        const len = Math.min(b.size, b.at, b.len - b.at + b.size);
        p.copy(b.from).addScaledVector(b.dir, b.at - len / 2);
        q.setFromUnitVectors(Z, b.dir);
        m.compose(p, q, s.set(b.width, b.width, Math.max(0.01, len)));
        mesh.setMatrixAt(n, m);
        mesh.setColorAt(n, b.color);
        n += 1;
      }
      mesh.count = n;
      // (nothing to draw, nothing to send up)
      if (n) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
      }
    },
    dispose() {
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
      mesh.dispose();
    },
  };
}

const FLASH_VERT = /* glsl */ `
attribute vec4 aFlash; // age 0…1, size, brightness, unused
attribute vec3 aTint;
varying vec2 vUv;
varying float vAge;
varying float vBright;
varying vec3 vTint;
void main() {
  vUv = uv * 2.0 - 1.0;
  vAge = aFlash.x;
  vBright = aFlash.z;
  vTint = aTint;
  // a sprite: facing the camera, swelling as it goes
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float size = aFlash.y * (0.35 + 0.9 * sqrt(aFlash.x));
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
}`;
const FLASH_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform sampler2D uRamp;
uniform float uHasMap;
uniform float uHasRamp;
uniform float uRampV;
uniform vec4 uChan;
varying vec2 vUv;
varying float vAge;
varying float vBright;
varying vec3 vTint;
void main() {
  float r = length(vUv);
  float k = 1.0 - vAge;
  float core = exp(-r * r * 9.0) * k * k;
  // (cooling as k², so the dull tail doesn't hang as a brown disc)
  float body = exp(-r * r * 3.0) * k * k;
  // white hot, cooling through the tint to a dull red; out to nothing at
  // the sprite's rim, not cut off there (a hard edge read as a solid disc)
  // (the game's burst: its rays through the body, kept to the same brightness overall)
  if (uHasMap > 0.5) body *= 0.35 + 1.3 * dot(texture2D(uMap, vUv * 0.5 + 0.5), uChan);
  vec3 cold = uHasRamp > 0.5 ? texture2D(uRamp, vec2(0.02 + 0.5 * k, uRampV)).rgb * 1.4 : vec3(1.4, 0.25, 0.05);
  vec3 col = vec3(4.0, 3.6, 3.1) * core + mix(cold, vTint, k) * body * 1.8;
  col *= 1.0 - smoothstep(0.65, 1.0, r);
  gl_FragColor = vec4(col * vBright, 1.0);
}`;

export function createFlashes(parent, { count = 48, look = 'game' } = {}) {
  const geo = new THREE.PlaneGeometry(2, 2);
  const flash = new Float32Array(count * 4);
  const tint = new Float32Array(count * 3);
  geo.setAttribute('aFlash', new THREE.InstancedBufferAttribute(flash, 4));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
  const uniforms = { uMap: { value: null }, uRamp: { value: null }, uHasMap: { value: 0 }, uHasRamp: { value: 0 }, uRampV: { value: 0.5 }, uChan: { value: new THREE.Vector4(0, 1, 0, 0) } };
  const mat = new THREE.ShaderMaterial({ vertexShader: FLASH_VERT, fragmentShader: FLASH_FRAG, uniforms, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const setLook = ({ burst = null, ramp = null } = {}) => {
    uniforms.uMap.value = burst;
    uniforms.uHasMap.value = burst ? 1 : 0;
    const ch = burst?.userData.look?.channels?.burst ?? 'g';
    uniforms.uChan.value.set(ch === 'r' ? 1 : 0, ch === 'g' ? 1 : 0, ch === 'b' ? 1 : 0, 0);
    uniforms.uRamp.value = ramp;
    uniforms.uHasRamp.value = ramp ? 1 : 0;
    uniforms.uRampV.value = ramp?.userData.look?.rampV ?? 0.5;
  };
  let gone = false;
  if (look === 'game') Promise.all([loadLook('impact'), loadLook('ramp.blackbody')]).then(([burst, ramp]) => !gone && setLook({ burst, ramp }));
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.count = 0;
  parent.add(mesh);
  const live = [];
  const free = Array.from({ length: count }, () => ({ at: new THREE.Vector3(), age: 0, life: 1, size: 1, bright: 1, tint: new THREE.Color() }));
  const m = new THREE.Matrix4();
  return {
    setLook,
    at(point, { size = 1, color = [2.6, 1.3, 0.4], life = 0.8, bright = 1 } = {}) {
      const f = free.pop() ?? live.shift();
      if (!f) return;
      f.at.copy(point);
      f.age = 0;
      f.life = life;
      f.size = size;
      f.bright = bright;
      f.tint.setRGB(...color);
      live.push(f);
    },
    get busy() {
      return live.length > 0;
    },
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const f = live[i];
        f.age += dt / f.life;
        if (f.age >= 1) {
          live.splice(i, 1);
          free.push(f);
        }
      }
      for (let i = 0; i < live.length; i++) {
        const f = live[i];
        m.makeTranslation(f.at.x, f.at.y, f.at.z);
        mesh.setMatrixAt(i, m);
        flash[i * 4] = f.age;
        flash[i * 4 + 1] = f.size;
        flash[i * 4 + 2] = f.bright;
        flash[i * 4 + 3] = 0;
        tint[i * 3] = f.tint.r;
        tint[i * 3 + 1] = f.tint.g;
        tint[i * 3 + 2] = f.tint.b;
      }
      mesh.count = live.length;
      // (nothing to draw, nothing to send up)
      if (live.length) {
        mesh.instanceMatrix.needsUpdate = true;
        geo.attributes.aFlash.needsUpdate = true;
        geo.attributes.aTint.needsUpdate = true;
      }
    },
    dispose() {
      gone = true;
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
      mesh.dispose();
    },
  };
}
