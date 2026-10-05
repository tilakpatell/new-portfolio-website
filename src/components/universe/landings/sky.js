// The sky over a landing (landings.js's `sky`): a dome round the camera,
// its zenith and horizon colours, the sun's disc and its glow toward the
// key light, drawn over space by day and gone by night, when the stars
// come back; and the air thick along the horizon, in the planet's colour,
// as the old haze was. A planet can leave space showing through overhead
// by day (`space`, 0…1: Cybertron's thin air).
//
// createSky(sky, air) → { mesh, mat, set({ up, sun, day }), dispose }
//   (up, sun: unit directions in the map's space; day 0…1)

import * as THREE from 'three';

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

export function createSky({ zenith = '#3c7fd6', horizon = '#d6e6f2', sun = '#fff6e2', space = 0 } = {}, air = '#8ab4ff') {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uUp: { value: new THREE.Vector3(0, 1, 0) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uZenith: { value: new THREE.Color(zenith) },
      uHorizon: { value: new THREE.Color(horizon) },
      uSun: { value: new THREE.Color(sun) },
      uAir: { value: new THREE.Color(air).multiplyScalar(0.2) },
      uDay: { value: 1 },
      uSpace: { value: space },
    },
    side: THREE.BackSide,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 24), mat);
  mesh.frustumCulled = false;
  // first of the see-through things: over whatever's beyond it (the other
  // planets, by day), under anything nearer that's drawn after it (bolts,
  // flashes, glass)
  mesh.renderOrder = -10;
  mesh.name = 'landing-sky';
  return {
    mesh,
    mat,
    set({ up, sun, day }) {
      if (up) mat.uniforms.uUp.value.copy(up);
      if (sun) mat.uniforms.uSunDir.value.copy(sun);
      if (day !== undefined) mat.uniforms.uDay.value = day;
    },
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}
