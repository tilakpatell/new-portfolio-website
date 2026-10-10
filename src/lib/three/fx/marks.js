// The game's sheets drawn as the galaxy's effects: one instanced draw a
// kind, pooled, nothing made after the first. A kind is a sheet (./gameLook)
// and how it is drawn:
//   decal  flat on what was hit, normal blending, fading after `life`: the
//          game's scorch (a mask channel, tinted) or its metal marks (colour)
//   glow   flat, additive: the hot marks a blast leaves, the ring that runs out
//   sprite facing the camera, additive: a burst's rays
// An additive kind's colour is the fire's: hot to cold along the game's
// black-body ramp (`ramp.blackbody`), times the instance's tint, so a bolt's
// colour shows in its embers. Their peak is set once against the galaxy's
// bloom (threshold 1.4, knee 0.5, strength 0.5: scripts/galaxy-bloom-check.mjs):
// a burst's core goes over it for its first tenth, a ring never does.
//
// createSheetFx(parent, { texture, ramp, mode, channel, count, life, fog })
//   → { mesh, add(at, normal, { size, frame, tint, bright, life, grow }), update(dt), clear(), dispose() }
// `texture` a sheet loadLook made (its grid on userData.look); `mode`
// 'decal' | 'decal-colour' | 'glow' | 'sprite'; `channel` 'r' | 'g' | 'b'.

import * as THREE from 'three';

const VERT = /* glsl */ `
attribute vec4 aInfo; // age 0…1, frame, unused, brightness
attribute vec3 aTint;
uniform vec2 uGrid;
varying vec2 vUv;
varying vec4 vInfo;
varying vec3 vTint;
#include <fog_pars_vertex>
void main() {
  vInfo = aInfo;
  vTint = aTint;
  float col = mod(aInfo.y, uGrid.x);
  float row = floor(aInfo.y / uGrid.x);
  vUv = (uv + vec2(col, uGrid.y - 1.0 - row)) / uGrid;
#ifdef SPRITE
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mvPosition.xy += position.xy * length(instanceMatrix[0].xyz);
#else
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
#endif
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform sampler2D uRamp;
uniform float uHasRamp;
uniform float uRampV;
uniform vec4 uChan;
varying vec2 vUv;
varying vec4 vInfo;
varying vec3 vTint;
#include <fog_pars_fragment>
vec3 fire(float k) {
  // the game's ramp, or the site's own cooling where it has none
  return uHasRamp > 0.5 ? texture2D(uRamp, vec2(0.02 + 0.96 * k, uRampV)).rgb : mix(vec3(0.5, 0.08, 0.02), vec3(1.0, 0.95, 0.85), k * k);
}
void main() {
  vec4 t = texture2D(uMap, vUv);
  float age = vInfo.x;
#if defined(DECAL)
  float a = dot(t, uChan) * (1.0 - smoothstep(0.7, 1.0, age));
  gl_FragColor = vec4(vTint, a * vInfo.w);
#elif defined(DECAL_COLOUR)
  float l = dot(t.rgb, vec3(0.333));
  float a = clamp(l * 4.0, 0.0, 1.0) * (1.0 - smoothstep(0.7, 1.0, age));
  gl_FragColor = vec4(t.rgb * vTint, a * vInfo.w);
#else
  float m = dot(t, uChan);
  float heat = 1.0 - age;
  vec3 c = fire(heat) * vTint * m * vInfo.w * heat;
  gl_FragColor = vec4(c, 1.0);
#endif
  #include <fog_fragment>
}`;

const CHAN = { r: [1, 0, 0, 0], g: [0, 1, 0, 0], b: [0, 0, 1, 0] };

export function createSheetFx(parent, { texture, ramp = null, mode = 'glow', channel = 'r', count = 32, life = 1, fog = true } = {}) {
  const grid = texture.userData.look?.grid ?? [1, 1];
  const geo = new THREE.PlaneGeometry(1, 1);
  const info = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
  const tint = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  info.setUsage(THREE.DynamicDrawUsage);
  tint.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aInfo', info);
  geo.setAttribute('aTint', tint);
  const additive = mode === 'glow' || mode === 'sprite';
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: mode === 'sprite' ? { SPRITE: '' } : mode === 'decal' ? { DECAL: '' } : mode === 'decal-colour' ? { DECAL_COLOUR: '' } : {},
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uGrid: { value: new THREE.Vector2(...grid) }, uChan: { value: new THREE.Vector4(...CHAN[channel]) }, uHasRamp: { value: ramp ? 1 : 0 }, uRampV: { value: ramp?.userData.look?.rampV ?? 0.5 } }]),
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
    fog,
    // (a mark sits on what it marks, not in it)
    polygonOffset: !additive,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });
  // (set after the merge: a texture is not cloned)
  mat.uniforms.uMap = { value: texture };
  mat.uniforms.uRamp = { value: ramp };
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.renderOrder = additive ? 7 : 2;
  mesh.name = `fx-${texture.userData.look?.name ?? 'sheet'}-${mode}`;
  parent.add(mesh);

  const live = [];
  const free = Array.from({ length: count }, () => ({ at: new THREE.Vector3(), q: new THREE.Quaternion(), age: 0, life, size: 1, grow: 0, frame: 0, bright: 1, tint: [1, 1, 1] }));
  const m4 = new THREE.Matrix4();
  const s = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);
  const n = new THREE.Vector3();

  return {
    mesh,
    // `at`, `normal` Vector3s (copied); grow: how much bigger by the end
    add(at, normal, { size = 1, frame = 0, tint: c = [1, 1, 1], bright = 1, life: l = life, grow = 0, spin = Math.random() * Math.PI * 2 } = {}) {
      const f = free.pop() ?? live.shift();
      if (!f) return null;
      f.at.copy(at);
      n.copy(normal ?? Z).normalize();
      f.q.setFromUnitVectors(Z, n);
      // a turn about its own normal, so no two marks lie alike
      f.q.multiply(new THREE.Quaternion().setFromAxisAngle(Z, spin));
      Object.assign(f, { age: 0, life: l, size, grow, frame, bright });
      f.tint = c;
      live.push(f);
      return f;
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
        mesh.setMatrixAt(i, m4.compose(f.at, f.q, s.setScalar(f.size * (1 + f.grow * Math.sqrt(f.age)))));
        info.setXYZW(i, f.age, f.frame, 0, f.bright);
        tint.setXYZ(i, f.tint[0], f.tint[1], f.tint[2]);
      }
      mesh.count = live.length;
      if (live.length) {
        mesh.instanceMatrix.needsUpdate = true;
        info.needsUpdate = true;
        tint.needsUpdate = true;
      }
    },
    get busy() {
      return live.length;
    },
    clear() {
      free.push(...live.splice(0));
      mesh.count = 0;
    },
    dispose() {
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
      mesh.dispose();
    },
  };
}
