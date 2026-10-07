// Speed lines: at speed, the stars ahead drawn out into faint lines
// streaming past, riding with the camera along its line of sight. The
// caller adds the group to its camera and says each frame how drawn out
// they are and how fast they rush by; nothing here knows what’s flying.
// (The galaxy uses it on the sublight drive, the universe map on a
// hyperlane.) One LineSegments, a line a star, worked out in the vertex
// shader; additive, no depth, no textures.
//
// createSpeedLines({ small }) → { group (the camera’s child), set({ stretch, speed }), busy, update(dt), dispose() }

import * as THREE from 'three';

const LINES = 520;
const LINES_SMALL = 260;
const DEPTH = 420; // how deep the field of stars is
const NEAR = 3;

const LINE_VERT = /* glsl */ `
attribute vec4 aStar; // angle round the line of sight, distance out from it, depth phase, brightness
attribute float aEnd; // 0 the head (nearer), 1 the tail
uniform float uTravel;
uniform float uLen;
uniform float uStretch;
varying float vFade;
const float DEPTH = ${DEPTH.toFixed(1)};
const float NEAR = ${NEAR.toFixed(1)};
void main() {
  float head = NEAR + mod(aStar.z * DEPTH - uTravel, DEPTH);
  float z = head + aEnd * uLen * (0.4 + 0.6 * aStar.w);
  float r = aStar.y;
  vec3 p = vec3(cos(aStar.x) * r, sin(aStar.x) * r, -z);
  // brightest at the head, gone down the tail; faint far off, and gone before it reaches you
  vFade = (1.0 - aEnd * 0.92) * aStar.w * smoothstep(DEPTH, DEPTH * 0.55, head) * smoothstep(NEAR, NEAR + 8.0, head) * uStretch;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const LINE_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vFade;
void main() {
  gl_FragColor = vec4(uColor * vFade, 1.0);
}`;

export function createSpeedLines({ small = false } = {}) {
  const group = new THREE.Group();
  const n = small ? LINES_SMALL : LINES;
  const star = new Float32Array(n * 2 * 4);
  const end = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.2 + Math.random() ** 0.7 * 26;
    const z = Math.random();
    const b = 0.35 + Math.random() * 0.65;
    for (let k = 0; k < 2; k++) {
      star.set([a, r, z, b], (i * 2 + k) * 4);
      end[i * 2 + k] = k;
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
  lineGeo.setAttribute('aStar', new THREE.BufferAttribute(star, 4));
  lineGeo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const lineMat = new THREE.ShaderMaterial({
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    uniforms: { uTravel: { value: 0 }, uLen: { value: 0 }, uStretch: { value: 0 }, uColor: { value: new THREE.Color(1.6, 1.8, 2.4) } },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  lines.renderOrder = 50;
  lines.visible = false;
  group.add(lines);

  const now = { stretch: 0, speed: 0 };
  let travel = 0;
  return {
    group,
    // stretch 0…1: the stars drawn out into lines; speed: how fast they rush past
    set(o) {
      Object.assign(now, o);
    },
    get busy() {
      return now.stretch > 0.001;
    },
    update(dt) {
      // (kept to one depth of the field, which the shader’s mod can’t tell
      // from the whole of it, so a long run never wears the float down)
      travel = (travel + dt * (40 + now.speed)) % DEPTH;
      const u = lineMat.uniforms;
      lines.visible = now.stretch > 0.001;
      u.uStretch.value = Math.min(1, now.stretch * 1.4);
      u.uLen.value = 0.4 + now.stretch ** 2 * 260;
      u.uTravel.value = travel;
    },
    dispose() {
      lineGeo.dispose();
      lineMat.dispose();
    },
  };
}
