// Minecraft, a mob's model in three.js from its part table (rules/mobs/shapes.js):
// a group per part at its pivot, turned as the game turns it, and a mesh of
// its boxes with the skin's texels on ModelBox's net. Model space is the
// game's (y down, ground at 24, pixels); the group's is metres with y up and
// the front toward −z, which is the game's model space turned half round z
// (x and y both flip), so faces keep their winding and the game's turns
// carry over with x and y negated.
//
// Lit as the game lights entities (RenderHelper's standard item lighting:
// two fixed lights from above, 0.4 ambient, 0.6 of each), times the light
// of the cell the mob stands in through the world's lightmap (`tone`), and
// washed red while it's hurt, as the game overlays it.
//
// buildModel(model, skin) → { group, parts: { [name]: Object3D }, material }

import * as THREE from 'three';
import { boxFaces } from '../rules/mobs/shapes.js';

const vertex = /* glsl */ `
out vec2 vUv;
out float vShade;
void main() {
  vUv = uv;
  vec3 n = normalize(mat3(modelMatrix) * normal);
  // RenderHelper.enableStandardItemLighting: two lights, 0.6 each, 0.4 ambient
  vec3 l0 = normalize(vec3(0.2, 1.0, -0.7));
  vec3 l1 = normalize(vec3(-0.2, 1.0, 0.7));
  vShade = min(1.0, 0.4 + 0.6 * (max(dot(n, l0), 0.0) + max(dot(n, l1), 0.0)));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const fragment = /* glsl */ `
layout(location = 0) out highp vec4 outColour;
uniform sampler2D skin;
uniform vec3 tone;
uniform float hurt;
uniform float flash;
in vec2 vUv;
in float vShade;
void main() {
  vec4 t = texture(skin, vUv);
  if (t.a < 0.1) discard;
  vec3 c = t.rgb * vShade * tone;
  // the hurt overlay (1, 0, 0, 0.3) and a creeper's white swell
  c = mix(c, vec3(1.0, 0.0, 0.0), hurt * 0.3);
  c = mix(c, vec3(1.0), flash * 0.5);
  outColour = vec4(c, 1.0);
}
`;

export function modelMaterial(skin) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: { skin: { value: skin }, tone: { value: new THREE.Vector3(1, 1, 1) }, hurt: { value: 0 }, flash: { value: 0 } },
  });
}

const PX = 1 / 16;

// a part's boxes as one geometry, in the part's own frame (metres, y up)
function partGeometry(boxes, [tw, th]) {
  const pos = [];
  const uv = [];
  const nor = [];
  const index = [];
  const v = (q) => new THREE.Vector3(-q[0] * PX, -q[1] * PX, q[2] * PX);
  for (const b of boxes) {
    const centre = v(b.at.map((c, i) => c + b.size[i] / 2));
    for (const face of boxFaces(b)) {
      const base = pos.length / 3;
      const p = face.map(({ p: q }) => v(q));
      for (let k = 0; k < 4; k++) {
        pos.push(p[k].x, p[k].y, p[k].z);
        uv.push(face[k].uv[0] / tw, face[k].uv[1] / th);
      }
      // outward: from the box's middle through the face's
      const mid = p[0].clone().add(p[2]).multiplyScalar(0.5);
      const n = mid.clone().sub(centre);
      const ax = Math.abs(n.x) / b.size[0];
      const ay = Math.abs(n.y) / b.size[1];
      const az = Math.abs(n.z) / b.size[2];
      const out = ax >= ay && ax >= az ? new THREE.Vector3(Math.sign(n.x), 0, 0) : ay >= az ? new THREE.Vector3(0, Math.sign(n.y), 0) : new THREE.Vector3(0, 0, Math.sign(n.z));
      for (let k = 0; k < 4; k++) nor.push(out.x, out.y, out.z);
      // wound counter-clockwise seen from outside, whichever way the corners came
      const ccw = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).dot(out) > 0;
      index.push(...(ccw ? [base, base + 1, base + 2, base, base + 2, base + 3] : [base, base + 2, base + 1, base, base + 3, base + 2]));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(index);
  return g;
}

// the game's turn (z, then y, then x; model space) as the group's
export const turnOf = ([rx, ry, rz]) => new THREE.Euler(-rx, -ry, rz, 'ZYX');

export function buildModel(model, skin, material = modelMaterial(skin)) {
  const group = new THREE.Group();
  const parts = {};
  for (const p of model.parts) {
    const pivot = new THREE.Group();
    pivot.position.set(-p.pivot[0] * PX, (24 - p.pivot[1]) * PX, p.pivot[2] * PX);
    // the part's resting turn, kept to add the animation's to
    pivot.userData.rest = p.rot ? [...p.rot] : [0, 0, 0];
    pivot.rotation.copy(turnOf(pivot.userData.rest));
    pivot.add(new THREE.Mesh(partGeometry(p.boxes, model.texture), material));
    group.add(pivot);
    parts[p.name] = pivot;
  }
  return { group, parts, material };
}

// a part turned from its rest by the game's angles (model space, radians)
export function pose(part, rx = 0, ry = 0, rz = 0) {
  const [ax, ay, az] = part.userData.rest;
  part.rotation.copy(turnOf([ax + rx, ay + ry, az + rz]));
}
