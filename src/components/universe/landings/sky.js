// The sky over a landing (landings.js's `sky`): a dome round the camera,
// its zenith and horizon colours, the sun's disc and its glow toward the
// key light, drawn over space by day and gone by night, when the stars
// come back; and the air thick along the horizon, in the planet's colour,
// as the old haze was. A planet can leave space showing through overhead
// by day (`space`, 0…1: Cybertron's thin air).
//
// With the planet's air (universes.js's `air`, the shell seen from orbit),
// the sky moves with the sun as that air does (lib/three/atmosphere's
// skyColoursFor): at noon it's the colours set for the landing, and as the
// sun goes down each colour takes the air's own change, so the horizon
// warms and the sun reddens, as the limb does from orbit.
//
// createSky(sky, haze, { air }) → { mesh, mat, set({ up, sun, day }), seenTo, dispose }
//   (haze: the colour along the horizon; up, sun: unit directions in the
//   map's space; day 0…1; seenTo: seenTo() as it is now)
// skyAt(sky, air, sunElevation) → { zenith, horizon, sun } (linear [r, g, b])
// seenTo(day, space) → how far from the camera there's anything to see
//   (the map's units), or null: as far as the camera sees. In full day
//   with no space showing through, the dome (SKY_R round the camera) hides
//   everything beyond it, so nothing there need be drawn; it's a little
//   past the dome, for its own edge.

import * as THREE from 'three';
import { skyColoursFor } from '../../../lib/three/atmosphere';

// the air's colours at noon, worked out once an air
const NOON = new WeakMap();
const linear = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

export function skyAt({ zenith = '#3c7fd6', horizon = '#d6e6f2', sun = '#fff6e2' } = {}, air = null, sunElevation = 1) {
  const set = { zenith: linear(zenith), horizon: linear(horizon), sun: linear(sun) };
  if (!air?.colour) return set;
  if (!NOON.has(air)) NOON.set(air, skyColoursFor(air, 1));
  const noon = NOON.get(air);
  const now = skyColoursFor(air, sunElevation);
  // (each colour moved as the air's moves from noon; never more than twice as bright)
  const shift = (k) => set[k].map((v, i) => v * Math.min(2, now[k][i] / Math.max(noon[k][i], 1e-6)));
  return { zenith: shift('zenith'), horizon: shift('horizon'), sun: shift('sun') };
}

const VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = `
uniform vec3 uUp;
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSun;
uniform vec3 uAir;
uniform float uDay;
uniform float uSpace;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float e = dot(d, uUp);
  float up = clamp(e, 0.0, 1.0);
  vec3 col = mix(uZenith, uHorizon, pow(1.0 - up, 5.0));
  // the sun: its disc and the glow round it, and a warmer horizon under it
  float s = max(dot(d, uSunDir), 0.0);
  col += uSun * (smoothstep(0.9994, 0.9997, s) * 6.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.08);
  // the air along the horizon (by night too, a little)
  float horizon = exp(-max(e, 0.0) * 7.0);
  vec3 air = uAir * (horizon * 0.8 + 0.06 * (1.0 - smoothstep(0.0, 0.6, e)));
  // over space by day; by night just the air, added
  float a = uDay * mix(1.0, 1.0 - uSpace, smoothstep(0.05, 0.7, up));
  // (premultiplied: the air's added over whatever shows through, less of it by day)
  gl_FragColor = vec4(col * a + air * (1.0 - 0.7 * a), a);
  #include <colorspace_fragment>
}`;

export const SKY_R = 30;
export const seenTo = (day, space = 0) => (day > 0.99 && !(space > 0) ? SKY_R * 1.05 : null);

export function createSky(sky = {}, haze = '#8ab4ff', { air = null } = {}) {
  const { zenith = '#3c7fd6', horizon = '#d6e6f2', sun = '#fff6e2', space = 0 } = sky;
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uUp: { value: new THREE.Vector3(0, 1, 0) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uZenith: { value: new THREE.Color(zenith) },
      uHorizon: { value: new THREE.Color(horizon) },
      uSun: { value: new THREE.Color(sun) },
      uAir: { value: new THREE.Color(haze).multiplyScalar(0.2) },
      uDay: { value: 1 },
      uSpace: { value: space },
    },
    side: THREE.BackSide,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 48, 24), mat);
  mesh.frustumCulled = false;
  // first of the see-through things: over whatever's beyond it (the other
  // planets, by day), under anything nearer that's drawn after it (bolts,
  // flashes, glass)
  mesh.renderOrder = -10;
  mesh.name = 'landing-sky';
  let lastE = 2;
  return {
    mesh,
    mat,
    set({ up, sun, day }) {
      if (up) mat.uniforms.uUp.value.copy(up);
      if (sun) mat.uniforms.uSunDir.value.copy(sun);
      if (day !== undefined) mat.uniforms.uDay.value = day;
      // (in full day, with no space showing through, it hides what's beyond
      // it: else the stars and the Milky Way's glow, drawn after it, show
      // through a dark sky like Mordor's)
      mat.depthWrite = seenTo(mat.uniforms.uDay.value, space) !== null;
      // the colours for how high the sun is (worked out again only as it moves)
      if (air && sun) {
        const e = Math.max(-0.3, mat.uniforms.uUp.value.dot(mat.uniforms.uSunDir.value));
        if (Math.abs(e - lastE) > 0.01) {
          lastE = e;
          const c = skyAt(sky, air, Math.max(0.02, e));
          mat.uniforms.uZenith.value.setRGB(...c.zenith);
          mat.uniforms.uHorizon.value.setRGB(...c.horizon);
          mat.uniforms.uSun.value.setRGB(...c.sun);
        }
      }
    },
    // how much of the day sky shows (the scene's flare on the sun goes with it)
    get day() {
      return mat.uniforms.uDay.value;
    },
    get sunDir() {
      return mat.uniforms.uSunDir.value;
    },
    get seenTo() {
      return seenTo(mat.uniforms.uDay.value, space);
    },
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}
