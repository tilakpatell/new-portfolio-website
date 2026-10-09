// Crowds skinned from a baked texture: a rigged model's clips baked, once and
// offline (scripts/vat-bake.mjs), into a vertex-animation texture (VAT), and a
// thousand copies of it drawn as one instanced mesh whose vertex shader reads
// its bones from that texture. No skeleton, no mixer, no SkinnedMesh a rider:
// one draw and one clock, each instance its own clip, phase and speed.
//
// The texture: three RGBA half-float texels a bone a frame (24 fps), a row a
// frame (frame-major), bone j's three texels at row f starting at j × 3. Each
// holds one of the top three rows of the bone's matrix (the fourth is always
// 0 0 0 1). Clips are runs of rows, `clips[name] = [start, length]` in frames.
//
// The matrix stored for bone j in a frame maps the bind-pose geometry, as the
// GLB has it (mesh-local), to the model root's frame in that frame:
//
//   M_j = rootInverse × boneWorld_j × boneInverse_j × bindMatrix
//
// three's own skinning with its bindMatrixInverse folded into the root's
// frame. Joint indices are the GLB skin's joint order. The shader skins with
//
//   transformed = (Σ w_k · lerp(M_jk(f0), M_jk(f1), t)) · vec4(transformed, 1)
//
// normals by mat3 of the same matrix, and the instance matrix applies after
// (three's USE_INSTANCING, in project_vertex and defaultnormal_vertex). An
// instance's `aAnim` is [start, length, phase, speed]: start and length in
// frames, phase in seconds, speed a multiplier of the one clock.
//
// Pure (no WebGL; three only for its types, toHalf and fromHalf none at all):
//   vatLayout(bones, frames) → { width: bones × 3, height: frames, texels }
//   vatTexel(layout, bone, frame) → the first of the bone's three texels
//   packSkinMatrix(m: Float32Array(16), out, texel)   its rows 0–2 into out at texel × 4
//   vatSample(data, layout, bone, frame) → Float32Array(16)   packSkinMatrix's inverse
//   vatFrame([start, length, phase, speed], time, fps, round?) → { f0, f1, t }
//     (round: Math.fround to work it in the shader's float32)
//   skinVertex(pos, joints, weights, matricesByBone) → [x, y, z]   (CPU skinning)
//   toHalf(f) → uint16, fromHalf(h) → number          IEEE half floats, rounded to even,
//     held to ±65504 past the range (no infinity in a matrix)
//   vatShader(shader, { bones, frames }) → { vertexShader, fragmentShader, swapped: { vat } }
//     (the layout is the caller's to say and goes unread here: it travels in
//     uVatSize, so one program serves every crowd under the one key `|vat`)
//
// Three:
//   vatSkin(material, { texture, bones, frames, fps, time = 0, uniforms? }) → material
//     its onBeforeCompile (after any earlier one) and cache key `|vat`; its
//     uniforms in material.userData.vat, to share
//   vatDepthMaterial(uniforms) → MeshDepthMaterial skinned on those uniforms (the shadow's)
//   createVatCrowd({ geometry, material, vat: { texture, bones, frames, fps, clips }, count })
//     → { mesh, count, set(i, { x, y, z, yaw, scale = 1 }, { clip, phase = Math.random(), speed = 1 }),
//         setClip(i, { clip, phase?, speed? }), free(i), update(dt), dispose() }
//     the material becomes the crowd's (skinned in place: a material keeps no
//     copy of its hooks when cloned); the geometry is copied, the copy owned
//   loadVat(jsonUrl, { load }) → Promise<{ texture, bones, frames, fps, clips, names }>
//     `<name>.vat.json` is { bones, frames, fps, clips, bin }, its bin beside
//     it the texture's Uint16 half floats; `load(url)` an ArrayBuffer for a
//     .bin, the parsed object otherwise (fetch by default)

import * as THREE from 'three';

export function vatLayout(bones, frames) {
  const width = bones * 3;
  return { width, height: frames, texels: width * frames };
}

export function vatTexel(layout, bone, frame) {
  return frame * layout.width + bone * 3;
}

export function packSkinMatrix(m, out, texel) {
  const o = texel * 4;
  for (let r = 0; r < 3; r++) {
    out[o + r * 4] = m[r];
    out[o + r * 4 + 1] = m[4 + r];
    out[o + r * 4 + 2] = m[8 + r];
    out[o + r * 4 + 3] = m[12 + r];
  }
}

export function vatSample(data, layout, bone, frame) {
  const o = vatTexel(layout, bone, frame) * 4;
  const m = new Float32Array(16);
  for (let r = 0; r < 3; r++) {
    m[r] = data[o + r * 4];
    m[4 + r] = data[o + r * 4 + 1];
    m[8 + r] = data[o + r * 4 + 2];
    m[12 + r] = data[o + r * 4 + 3];
  }
  m[15] = 1;
  return m;
}

// (GLSL's mod: x − y × floor(x / y), never negative for a positive y; `r` rounds each step,
// Math.fround to work it as the shader does, in float32)
const mod = (x, y, r) => r(x - r(y * Math.floor(r(x / y))));
const exact = (x) => x;

// (the frame within the clip is worked from m alone, before start is added: start + m in
// float32 can round up to start + length, a row past the clip)
export function vatFrame([start, length, phase, speed], time, fps, r = exact) {
  let m = mod(r(r(r(time * speed) + phase) * fps), length, r);
  // (a hair under nought rounds up to the length itself: that is the clip's start again)
  if (m >= length) m = 0;
  const i = Math.min(Math.floor(m), length - 1);
  return { f0: r(start + i), f1: r(start + mod(r(i + 1), length, r)), t: r(m - Math.floor(m)) };
}

export function skinVertex(pos, joints, weights, matricesByBone) {
  const out = [0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const w = weights[k];
    if (!w) continue;
    const e = matricesByBone[joints[k]];
    for (let c = 0; c < 3; c++) out[c] += w * (e[c] * pos[0] + e[4 + c] * pos[1] + e[8 + c] * pos[2] + e[12 + c]);
  }
  return out;
}

const F32 = new Float32Array(1);
const U32 = new Uint32Array(F32.buffer);

export function toHalf(f) {
  F32[0] = f;
  const x = U32[0];
  const sign = (x >>> 16) & 0x8000;
  const e = ((x >>> 23) & 0xff) - 127 + 15;
  let m = x & 0x7fffff;
  if (e === 128 + 15 && m) return sign | 0x7e00;
  // (past the largest half, infinity too, held to it as three's toHalfFloat holds it)
  if (e >= 0x1f) return sign | 0x7bff;
  if (e <= 0) {
    if (e < -10) return sign;
    // (a subnormal half: the implied one shifted down into the mantissa)
    m |= 0x800000;
    const shift = 14 - e;
    const half = 1 << (shift - 1);
    const rest = m & ((1 << shift) - 1);
    let h = m >>> shift;
    if (rest > half || (rest === half && h & 1)) h++;
    return sign | h;
  }
  // (rounding up may carry into the exponent: right, but not past the largest half)
  let h = (e << 10) | (m >>> 13);
  const rest = m & 0x1fff;
  if (rest > 0x1000 || (rest === 0x1000 && h & 1)) h++;
  return sign | Math.min(h, 0x7bff);
}

export function fromHalf(h) {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >>> 10) & 0x1f;
  const m = h & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 0x1f) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}

const PARS_VS = /* glsl */ `
attribute vec4 aAnim;
#ifndef USE_SKINNING
attribute vec4 skinIndex;
attribute vec4 skinWeight;
#endif
uniform sampler2D uVat;
uniform float uVatTime;
uniform float uVatFps;
uniform vec2 uVatSize;
// (bone j's matrix in a frame: its three rows from three texels, the fourth 0 0 0 1)
mat4 vatBone(float bone, float frame) {
  float v = (frame + 0.5) / uVatSize.y;
  float u = (bone * 3.0 + 0.5) / uVatSize.x;
  float du = 1.0 / uVatSize.x;
  vec4 r0 = texture2D(uVat, vec2(u, v));
  vec4 r1 = texture2D(uVat, vec2(u + du, v));
  vec4 r2 = texture2D(uVat, vec2(u + 2.0 * du, v));
  return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
}
mat4 vatBlend(float bone, float f0, float f1, float t) {
  mat4 a = vatBone(bone, f0);
  return a + (vatBone(bone, f1) - a) * t;
}
`;

// (vatFrame's maths, the same mod and the same wrap of a hair under nought)
const SKINBASE_VS = /* glsl */ `
float vatM = mod((uVatTime * aAnim.w + aAnim.z) * uVatFps, aAnim.y);
vatM = vatM >= aAnim.y ? 0.0 : vatM;
float vatI = min(floor(vatM), aAnim.y - 1.0);
float vatF0 = aAnim.x + vatI;
float vatF1 = aAnim.x + mod(vatI + 1.0, aAnim.y);
float vatT = vatM - floor(vatM);
mat4 vatSkinMatrix = skinWeight.x * vatBlend(skinIndex.x, vatF0, vatF1, vatT)
  + skinWeight.y * vatBlend(skinIndex.y, vatF0, vatF1, vatT)
  + skinWeight.z * vatBlend(skinIndex.z, vatF0, vatF1, vatT)
  + skinWeight.w * vatBlend(skinIndex.w, vatF0, vatF1, vatT);
`;

const SKINNORMAL_VS = /* glsl */ `
objectNormal = mat3(vatSkinMatrix) * objectNormal;
#ifdef USE_TANGENT
objectTangent = mat3(vatSkinMatrix) * objectTangent;
#endif
`;

const SKINNING_VS = /* glsl */ `
transformed = (vatSkinMatrix * vec4(transformed, 1.0)).xyz;
`;

export function vatShader({ vertexShader, fragmentShader }) {
  const ok = vertexShader.includes('#include <common>') && vertexShader.includes('#include <skinbase_vertex>') && vertexShader.includes('#include <skinning_vertex>');
  if (!ok) return { vertexShader, fragmentShader, swapped: { vat: false } };
  const vs = vertexShader
    .replace('#include <common>', `#include <common>\n${PARS_VS}`)
    .replace('#include <skinbase_vertex>', SKINBASE_VS)
    .replace('#include <skinnormal_vertex>', SKINNORMAL_VS)
    .replace('#include <skinning_vertex>', SKINNING_VS);
  return { vertexShader: vs, fragmentShader, swapped: { vat: true } };
}

export function vatSkin(material, { texture, bones, frames, fps, time = 0, uniforms = null } = {}) {
  const u = uniforms ?? {
    uVat: { value: texture },
    uVatTime: { value: time },
    uVatFps: { value: fps },
    uVatSize: { value: new THREE.Vector2(bones * 3, frames) },
  };
  const before = material.onBeforeCompile;
  material.onBeforeCompile = function (shader, renderer) {
    before?.call(this, shader, renderer);
    Object.assign(shader.uniforms, u);
    const out = vatShader(shader);
    shader.vertexShader = out.vertexShader;
    shader.fragmentShader = out.fragmentShader;
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = function () {
    return `${key ? key.call(this) : ''}|vat`;
  };
  material.userData.vat = u;
  material.needsUpdate = true;
  return material;
}

export function vatDepthMaterial(uniforms) {
  return vatSkin(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), { uniforms });
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export function createVatCrowd({ geometry, material, vat, count }) {
  const g = geometry.clone();
  const anim = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
  anim.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aAnim', anim);
  vatSkin(material, vat);
  const uniforms = material.userData.vat;
  const mesh = new THREE.InstancedMesh(g, material, count);
  mesh.name = 'vat-crowd';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.customDepthMaterial = vatDepthMaterial(uniforms);
  // (nothing placed yet: every instance at nought scale until set)
  _m.makeScale(0, 0, 0);
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, _m);

  const clipOf = (clip) => {
    const c = vat.clips?.[clip];
    if (!c) throw new Error(`createVatCrowd: no clip ${clip} in the texture`);
    return c;
  };
  const writeAnim = (i, [start, length], phase, speed) => {
    anim.array.set([start, length, phase, speed], i * 4);
    anim.needsUpdate = true;
  };
  const writeMatrix = (i) => {
    mesh.setMatrixAt(i, _m);
    mesh.instanceMatrix.needsUpdate = true;
    // (the bounds follow the instances: three works them out again when next culling)
    mesh.boundingSphere = null;
    mesh.boundingBox = null;
  };

  return {
    mesh,
    count,
    set(i, { x, y, z, yaw = 0, scale = 1 }, { clip, phase = Math.random(), speed = 1 }) {
      const c = clipOf(clip);
      _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(UP, yaw), _s.setScalar(scale));
      writeMatrix(i);
      writeAnim(i, c, phase, speed);
    },
    setClip(i, { clip, phase = anim.array[i * 4 + 2], speed = anim.array[i * 4 + 3] }) {
      writeAnim(i, clipOf(clip), phase, speed);
    },
    free(i) {
      _m.makeScale(0, 0, 0);
      writeMatrix(i);
    },
    update(dt) {
      uniforms.uVatTime.value += dt;
    },
    dispose() {
      g.dispose();
      mesh.customDepthMaterial.dispose();
      mesh.dispose();
    },
  };
}

const fetchVat = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`loadVat: ${url} ${res.status}`);
  return url.endsWith('.bin') ? res.arrayBuffer() : res.json();
};

export async function loadVat(jsonUrl, { load = fetchVat } = {}) {
  const { bones, frames, fps, clips, names, bin } = await load(jsonUrl);
  const binUrl = jsonUrl.slice(0, jsonUrl.lastIndexOf('/') + 1) + bin;
  const buffer = await load(binUrl);
  const layout = vatLayout(bones, frames);
  if (buffer.byteLength !== layout.texels * 4 * 2) throw new Error(`loadVat: ${binUrl} is ${buffer.byteLength} bytes, ${bones} bones × ${frames} frames want ${layout.texels * 8}`);
  const texture = new THREE.DataTexture(new Uint16Array(buffer), layout.width, layout.height, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  texture.name = bin;
  return { texture, bones, frames, fps, clips, names };
}
