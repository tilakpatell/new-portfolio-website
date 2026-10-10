// wind.js on the node renderer: one wind for a world, its gusts read from
// one noise picture, now a TSL function (windFns: windOffset(xz), what
// WIND_GLSL declared) over uniform nodes under the GLSL's names, and its
// sway a node hook (./hookNodes.js). windNoise is wind.js's, copied:
// importing it would bring its GLSL into a 'nodes' world's closure.
//
//   createWind({ strength, angle }) → { uniforms, windOffset(xz), update(dt),
//     set({ strength, angle }), sway(material, { strength, height }) → the node material, dispose() }
//   windFns(uniforms) → { windOffset }
//   windNoise(size)

import * as THREE from 'three';
import { fbm, makeNoise } from '../paint';
import { clamp, modelWorldMatrix, positionGeometry, texture, uniform, vec3, vec4 } from 'three/tsl';
import { asNode, instanceMatrixOf, onPosition } from './hookNodes';

// A tiling picture of soft noise, stretched to its full range.
export function windNoise(size = 128, seed = 11) {
  const n = makeNoise(seed);
  const raw = new Float32Array(size * size);
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const v = fbm(n, (i / size) * 8, (j / size) * 8, { period: 8, octaves: 3 });
      raw[j * size + i] = v;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  const px = new Uint8Array(size * size);
  for (let k = 0; k < px.length; k++) px[k] = Math.round(((raw[k] - lo) / (hi - lo || 1)) * 255);
  const t = new THREE.DataTexture(px, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// WIND_GLSL's windOffset over a wind's uniform nodes: two lookups in the
// noise, a quick one and a slow broad gust, scrolling the wind's way,
// centred on nought, along the wind by its strength. Read at level 0, the
// one the noise has, so it reads the same in a vertex shader.
export function windFns(u) {
  return {
    windOffset: (xz) => {
      const a = u.uWindNoise.sample(xz.mul(0.1).add(u.uWindDir.mul(u.uWindTime))).level(0).r;
      const b = u.uWindNoise.sample(xz.mul(0.05).add(u.uWindDir.mul(u.uWindTime).mul(0.2))).level(0).r;
      return u.uWindDir.mul(a.add(b).sub(1)).mul(u.uWindStrength);
    },
  };
}

export function createWind({ strength = 0.45, angle = 0.6 * Math.PI } = {}) {
  const noise = windNoise();
  const uniforms = {
    uWindNoise: texture(noise),
    uWindTime: uniform(0),
    uWindStrength: uniform(strength),
    uWindDir: uniform(new THREE.Vector2(Math.cos(angle), Math.sin(angle))),
  };
  const fns = windFns(uniforms);
  const set = ({ strength: s = null, angle: a = null } = {}) => {
    if (s != null) uniforms.uWindStrength.value = s;
    if (a != null) uniforms.uWindDir.value.set(Math.cos(a), Math.sin(a));
  };
  return {
    uniforms,
    ...fns,
    set,
    // the gusts move on, faster the harder it blows (never quite still)
    update(dt) {
      uniforms.uWindTime.value += dt * 0.1 * Math.max(0.2, uniforms.uWindStrength.value);
    },
    // a material swaying in this wind, `strength` metres at `height` up:
    // swayShader's lines on the vertex before three instances it: the top
    // pushed by the wind where the thing stands (its instance's origin, or
    // the mesh's) by the square of how far up it is over `height`
    sway(material, { strength: k = 0.2, height = 1 } = {}) {
      if (!material || material.userData.sway) return material;
      const m = asNode(material);
      onPosition(
        m,
        (p, builder) => {
          const im = instanceMatrixOf(builder);
          const root = modelWorldMatrix.mul(vec4(im ? im.mul(vec4(0, 0, 0, 1)).xyz : vec3(0, 0, 0), 1)).xyz;
          const up = clamp(positionGeometry.y.div(height), 0, 2);
          const xz = p.xz.add(fns.windOffset(root.xz).mul(up.mul(up)).mul(k));
          return vec3(xz.x, p.y, xz.y);
        },
        `sway:${k}:${height}`,
        uniforms,
      );
      m.userData.sway = uniforms;
      return m;
    },
    dispose() {
      noise.dispose();
    },
  };
}
