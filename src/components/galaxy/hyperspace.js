// The jump to lightspeed, from the cockpit or behind the ship, in the scene
// itself (the site's own full-screen jump, components/Hyperspace.jsx, is for
// leaving a page): the stars ahead stretch into lines as the ship spools up
// (`stretch`), a flash, and then the tunnel (`tunnel`): a pale blue shaft of
// light with white streaks pouring past and twisting a little, the ship held
// in the middle of it; then the lines snap back to stars as it drops out.
// It all rides with the camera, looking along its line of sight.
//
// createJump({ small }) → { group (the camera's child), set({ stretch, tunnel, flash, speed }), update(dt, t), dispose() }

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

// the tunnel: a long shaft round the line of sight, seen from inside
const TUBE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const TUBE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uAmount;
uniform float uSpeed;
varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  // round the shaft (x) and along it (y: 0 at the far end, 1 at the camera)
  float a = vUv.x + vUv.y * 0.12 + uTime * 0.02;
  float along = vUv.y * 14.0 + uTime * uSpeed;
  float streaks = pow(n(vec2(a * 140.0, along * 0.6)), 9.0) * 3.2 + pow(n(vec2(a * 60.0 + 7.0, along * 0.35)), 5.0) * 0.9;
  float mist = n(vec2(a * 18.0, along * 0.12)) * 0.5 + n(vec2(a * 40.0, along * 0.25)) * 0.25;
  vec3 col = vec3(0.18, 0.36, 0.95) * (0.35 + mist * 0.8) + vec3(0.85, 0.93, 1.0) * streaks;
  // dark down the far end, so it reads as a shaft
  float far = smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
  gl_FragColor = vec4(col * far * uAmount * 1.4, 1.0);
}`;

export function createJump({ small = false } = {}) {
  const group = new THREE.Group();
  const made = [];

  // the stars stretching
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
  made.push(lineGeo, lineMat);

  // the tunnel
  const tubeGeo = new THREE.CylinderGeometry(5, 5, 600, 48, 1, true).rotateX(Math.PI / 2).translate(0, 0, -260);
  // (its uv's y runs along it: 0 at the far end)
  const uv = tubeGeo.attributes.uv;
  const pos = tubeGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setY(i, (pos.getZ(i) + 560) / 600);
  const tubeMat = new THREE.ShaderMaterial({
    vertexShader: TUBE_VERT,
    fragmentShader: TUBE_FRAG,
    uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uSpeed: { value: 6 } },
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  tube.frustumCulled = false;
  tube.renderOrder = -5;
  tube.visible = false;
  group.add(tube);
  made.push(tubeGeo, tubeMat);

  // the flash going in and coming out
  const flashMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3.3, 4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), flashMat);
  flash.position.z = -0.3;
  flash.renderOrder = 60;
  flash.visible = false;
  flash.frustumCulled = false;
  group.add(flash);
  made.push(flash.geometry, flashMat);

  const now = { stretch: 0, tunnel: 0, flash: 0, speed: 0 };
  let travel = 0;
  return {
    group,
    // stretch 0…1: the stars drawn out into lines; tunnel 0…1: the shaft;
    // flash 0…1; speed: how fast the stars rush past
    set(o) {
      Object.assign(now, o);
    },
    get busy() {
      return now.stretch > 0.001 || now.tunnel > 0.001 || now.flash > 0.001;
    },
    update(dt, t) {
      travel += dt * (40 + now.speed);
      const u = lineMat.uniforms;
      lines.visible = now.stretch > 0.001;
      u.uStretch.value = Math.min(1, now.stretch * 1.4);
      u.uLen.value = 0.4 + now.stretch ** 2 * 260;
      u.uTravel.value = travel;
      tube.visible = now.tunnel > 0.001;
      tubeMat.uniforms.uAmount.value = now.tunnel;
      tubeMat.uniforms.uTime.value = t % 1000;
      flash.visible = now.flash > 0.001;
      flashMat.opacity = now.flash;
    },
    dispose() {
      for (const x of made) x.dispose();
    },
  };
}
