// Beacons: a glowing dot over each of the fandoms' planets, in the planet's
// own colour (its swatch), the same size on screen however far off, so from
// anywhere on the map the far worlds read as places to go (from across deep
// space the planets themselves are a few dim pixels). One draw: a Points with
// its own shader, drawn over whatever is in front of it (a beacon marks
// where a world is, it isn't a thing in the way). A beacon fades out as the
// camera comes in to within FADE reaches of its planet, where the planet
// itself has taken over, and is gone by half that.
//
// createBeacons() → { points, update(cam), dispose() }; cam is the camera's
// position in the map's space (the points' parent's).

import * as THREE from 'three';
import { ORDER, POSITIONS, REACH } from './layout';
import { byId } from './universes';

const FADE = 5; // reaches from the planet at which its beacon starts to fade
const SIZE = 11; // px across, before the device's pixel ratio

const VERT = `
attribute vec3 aColor;
attribute float aFade;
uniform vec3 uCam;
uniform float uDpr;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = distance(position, uCam);
  // full from the fade distance out, gone by half of it
  vAlpha = smoothstep(aFade * 0.5, aFade, d);
  vColor = aColor;
  gl_PointSize = ${SIZE.toFixed(1)} * uDpr;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
// a soft disc with a hot core: the core goes past white, so the bloom catches it a little
const FRAG = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c) * 4.0; // 0 in the middle, 1 at the edge
  float glow = exp(-r2 * 5.0) * (1.0 - smoothstep(0.8, 1.0, r2));
  float core = exp(-r2 * 22.0);
  vec3 col = vColor * (glow * 1.4 + core * 1.6) + vec3(core * 0.6);
  gl_FragColor = vec4(col * vAlpha, 1.0);
  #include <colorspace_fragment>
}`;

export function createBeacons() {
  const worlds = ORDER.filter((id) => byId(id).kind !== 'core');
  const pos = new Float32Array(worlds.length * 3);
  const col = new Float32Array(worlds.length * 3);
  const fade = new Float32Array(worlds.length);
  const c = new THREE.Color();
  worlds.forEach((id, i) => {
    pos.set(POSITIONS[id], i * 3);
    c.set(byId(id).swatch);
    col.set([c.r, c.g, c.b], i * 3);
    fade[i] = REACH[id] * FADE;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aFade', new THREE.BufferAttribute(fade, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uCam: { value: new THREE.Vector3() }, uDpr: { value: 1 } },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'beacons';
  points.frustumCulled = false;
  points.renderOrder = 6; // over the planets (and the sun, when one is behind it)
  // a point's size is in the frame's own pixels, whatever the pixel ratio is
  // this frame (the watchdog lowers it when frames run long)
  points.onBeforeRender = (renderer) => {
    mat.uniforms.uDpr.value = renderer.getPixelRatio();
  };
  return {
    points,
    update(cam) {
      mat.uniforms.uCam.value.copy(cam);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
