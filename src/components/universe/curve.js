// The Central Finite Curve, drawn: the Rick and Morty sector's edge
// (layout.js's SECTORS.rickmorty), where the ship's turned back (ship.js),
// as a faint luminous wall round the whole sector. A tall open cylinder at
// the edge, seen from inside: a soft curtain of green-white light, brighter
// at the disc and fading up and down, its threads (the Curve's walled-off
// dimensions) drifting slowly along it, and a band of light round its
// middle. Far off it's a ring on the horizon; close, it shimmers. Space
// scenery, so shaders only. It sits 48,000 out from the main map, past the
// camera's far plane from there: only seen from inside the sector.
//
// createCurve(parent) → { update(t), dispose() }

import * as THREE from 'three';
import { SECTORS } from './layout';
import { DEEP } from './deep';

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FRAG = `
uniform float uTime;
varying vec2 vUv;
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  // round the wall (u, 0…1) and up it (v, 0 at the floor, 1 at the ceiling)
  float u = vUv.x;
  float v = vUv.y;
  float mid = 1.0 - abs(v * 2.0 - 1.0);
  // the curtain: brightest at the disc's height
  float curtain = pow(mid, 2.2) * 0.22;
  // the band round its middle
  float band = exp(-pow((v - 0.5) * 22.0, 2.0)) * 0.5;
  // the threads: thin vertical lines, each drifting along at its own pace, flickering
  float threads = 0.0;
  for (int i = 0; i < 3; i++) {
    float f = float(i);
    float n = 180.0 + f * 97.0;
    float x = fract(u * n + uTime * (0.004 + f * 0.003));
    float id = floor(u * n + uTime * (0.004 + f * 0.003));
    float on = step(0.72, hash(id + f * 31.0)) * (0.6 + 0.4 * sin(uTime * (0.7 + hash(id) * 1.4) + id));
    threads += smoothstep(0.08, 0.0, abs(x - 0.5)) * on * pow(mid, 1.4) * 0.35;
  }
  float a = curtain + band + threads;
  vec3 col = mix(vec3(0.35, 1.0, 0.55), vec3(0.85, 1.0, 0.9), band * 1.5 + threads);
  gl_FragColor = vec4(col * a, a);
}`;

export function createCurve(parent) {
  const sec = SECTORS.rickmorty;
  const height = DEEP.ceiling * 2.6;
  const geo = new THREE.CylinderGeometry(sec.edge, sec.edge, height, 256, 1, true);
  const uTime = { value: 0 };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uTime },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const wall = new THREE.Mesh(geo, mat);
  wall.name = 'central-finite-curve';
  wall.position.set(...sec.origin);
  wall.renderOrder = -1;
  parent.add(wall);
  return {
    update(t) {
      uTime.value = t;
    },
    dispose() {
      parent.remove(wall);
      geo.dispose();
      mat.dispose();
    },
  };
}
