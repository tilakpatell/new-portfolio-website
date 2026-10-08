// A kraken's arm bent along its chain (./arm.js) in the vertex shader: the
// tentacle's mesh (Meshy's, unrigged, standing up its y) is cut into the
// chain's lengths by height, each laid along its joint's angle, the cross
// section turned with it, its normals too, and its shadow the same shape.
// The bend is in the plane of the group that leans it (its +x where the arm
// strikes), whichever way the model's turned inside it.
//
//   bendArm(model, frame) → { set({ a, b }), dispose() }: every mesh in
//     `model` bent; set takes the chain's joint angles each frame

import * as THREE from 'three';
import { ARM_JOINTS } from './arm';

const N = ARM_JOINTS;
const HEAD = /* glsl */ `
uniform float uArmA[${N + 1}];
uniform float uArmB[${N + 1}];
uniform vec4 uArmAxis; // the geometry's: the base's y, the length, the middle's x and z
uniform vec2 uArmDir; // where it strikes, along the geometry's x and z
// the turn of the cross section at a height
float armAngle(float y) {
  float fs = clamp((y - uArmAxis.x) / uArmAxis.y, 0.0, 1.0) * ${N}.0;
  int i = int(min(floor(fs), ${N - 1}.0));
  float k = fs - float(i);
  float a = uArmA[0];
  for (int j = 0; j < ${N}; j++) if (j == i) a = mix(uArmA[j], uArmA[j + 1], k);
  return a;
}
// a point of the geometry, laid along the chain up to its height
vec3 armBend(vec3 p) {
  float fs = clamp((p.y - uArmAxis.x) / uArmAxis.y, 0.0, 1.0) * ${N}.0;
  float len = uArmAxis.y / ${N}.0;
  vec3 c = vec3(0.0); // along the strike, up, across
  float A = 0.0;
  for (int j = 0; j < ${N}; j++) {
    float k = clamp(fs - float(j), 0.0, 1.0);
    if (k > 0.0) {
      float a = mix(uArmA[j], uArmA[j + 1], 0.5 * k);
      float b = mix(uArmB[j], uArmB[j + 1], 0.5 * k);
      c += k * len * vec3(sin(a) * cos(b), cos(a) * cos(b), sin(b));
      A = mix(uArmA[j], uArmA[j + 1], k);
    }
  }
  vec2 w = vec2(-uArmDir.y, uArmDir.x);
  vec2 o = p.xz - uArmAxis.zw;
  float od = dot(o, uArmDir);
  vec3 q = c + vec3(od * cos(A), -od * sin(A), dot(o, w));
  return vec3(uArmAxis.z, uArmAxis.x, uArmAxis.w) + q.x * vec3(uArmDir.x, 0.0, uArmDir.y) + vec3(0.0, q.y, 0.0) + q.z * vec3(w.x, 0.0, w.y);
}
// a normal (or a tangent) turned as the cross section is
vec3 armNormal(vec3 n, float A) {
  vec2 w = vec2(-uArmDir.y, uArmDir.x);
  float nd = dot(n.xz, uArmDir);
  float d2 = nd * cos(A) + n.y * sin(A);
  float u2 = -nd * sin(A) + n.y * cos(A);
  return d2 * vec3(uArmDir.x, 0.0, uArmDir.y) + vec3(0.0, u2, 0.0) + dot(n.xz, w) * vec3(w.x, 0.0, w.y);
}
`;
const NORMAL = `#include <beginnormal_vertex>
objectNormal = armNormal(objectNormal, armAngle(position.y));
#ifdef USE_TANGENT
objectTangent = armNormal(objectTangent, armAngle(position.y));
#endif`;
const VERTEX = `#include <begin_vertex>
transformed = armBend(transformed);`;

function patch(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${HEAD}`).replace('#include <beginnormal_vertex>', NORMAL).replace('#include <begin_vertex>', VERTEX);
  };
  material.customProgramCacheKey = () => 'kraken-arm';
  material.needsUpdate = true;
}

export function bendArm(model, frame) {
  const a = { value: new Float32Array(N + 1) };
  const b = { value: new Float32Array(N + 1) };
  const depth = [];
  frame.updateWorldMatrix(true, true);
  const toFrame = new THREE.Matrix4().copy(frame.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const m3 = new THREE.Matrix3();
  model.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    // the frame's +x, in the geometry's own space
    m.multiplyMatrices(toFrame, o.matrixWorld);
    const dir = new THREE.Vector3(1, 0, 0).applyMatrix3(m3.setFromMatrix4(m).invert());
    dir.y = 0;
    if (dir.lengthSq() < 1e-12) dir.set(1, 0, 0);
    dir.normalize();
    const uniforms = {
      uArmA: a,
      uArmB: b,
      uArmAxis: { value: new THREE.Vector4(bb.min.y, Math.max(1e-6, bb.max.y - bb.min.y), (bb.min.x + bb.max.x) / 2, (bb.min.z + bb.max.z) / 2) },
      uArmDir: { value: new THREE.Vector2(dir.x, dir.z) },
    };
    for (const mat of Array.isArray(o.material) ? o.material : [o.material]) patch(mat, uniforms);
    const shade = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    patch(shade, uniforms);
    o.customDepthMaterial = shade;
    o.frustumCulled = false; // (bent, it reaches past the bounds it was measured in straight)
    depth.push(shade);
  });
  return {
    set(pose) {
      a.value.set(pose.a);
      b.value.set(pose.b);
    },
    dispose() {
      for (const d of depth) d.dispose();
    },
  };
}
