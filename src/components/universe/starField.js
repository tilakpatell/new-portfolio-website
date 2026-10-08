// The real sky's stars, over the Milky Way's photo: the Hipparcos catalogue
// to tenth magnitude, about 108,000 stars (starCatalog.js), each where the
// photo has it, its own brightness and colour, all in one draw.
//
// Each star is drawn as a camera would see it, its size in pixels whatever
// the zoom: a sharp core a pixel or so across (the faint ones only that, so a
// pixel's worth of light, never a blob); the brighter, a wider core, a glare
// round it and, for the brightest few dozen, four faint diffraction spikes,
// their cores bright enough for the bloom (post.js) to catch. No twinkle:
// there's no air out here.
//
// loadStarCatalog() → the catalogue, or null if it can't be had (the sky
// then draws its own stars, skyShader.js's layers);
// createStarField(catalogue) → a THREE.Points, the stars STAR_RADIUS out
// (the scene keeps it on the camera and turns it with the map, as the sky).

import * as THREE from 'three';
import { bvToRgb, decodeStars } from './starCatalog';

export const STARS_URL = '/textures/universe/stars.bin';
export const STAR_RADIUS = 23000; // inside the sky (SKY_RADIUS), behind everything else
const SATURATION = 0.6; // of a black body's colour: as the eye sees stars, paler
const SPIKES = 2.4; // the brightness the spikes start from (about magnitude 2.7: some seventy stars)

// a star's brightness from its V magnitude: a sixth-magnitude star (the
// naked eye's faintest) 0.25, each magnitude brighter 10^0.3 more (three
// quarters of the true step, as a camera's curve has it: the catalogue's
// tenth-magnitude stars a dust behind the naked eye's, not a crowd), and
// past 3 the brightest held back on a log (Sirius 11, not 43)
export function starBrightness(v) {
  const b = 0.25 * 10 ** (-0.3 * (v - 6));
  return b <= 3 ? b : 3 + 3 * Math.log(b / 3);
}

export async function loadStarCatalog() {
  try {
    const res = await fetch(STARS_URL);
    if (!res.ok) return null;
    return decodeStars(await res.arrayBuffer());
  } catch {
    return null;
  }
}

const VERT = `
attribute vec3 aColor;
attribute float aBright;
uniform float uDpr;
varying vec3 vColor;
varying float vBright;
varying float vReach;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float spread = sqrt(max(aBright, 1.0));
  // how far out (pixels) the star's light goes: its core and glare, and
  // its spikes if it has them
  vReach = 2.2 + 1.6 * spread + step(${SPIKES.toFixed(1)}, aBright) * 7.0 * spread;
  gl_PointSize = 2.0 * vReach * uDpr;
  vColor = aColor;
  vBright = aBright;
}`;

const FRAG = `
varying vec3 vColor;
varying float vBright;
varying float vReach;
void main() {
  vec2 p = (gl_PointCoord - 0.5) * 2.0 * vReach; // pixels from the star
  float r2 = dot(p, p);
  float b = vBright;
  float spread = sqrt(max(b, 1.0));
  float sigma = 0.75 * sqrt(spread);
  float core = min(b, 2.6) * exp(-r2 / (2.0 * sigma * sigma));
  float glare = 0.06 * b * exp(-sqrt(r2) / (1.2 * spread));
  float len = 2.8 * spread;
  float spikes = smoothstep(${SPIKES.toFixed(1)}, 6.0, b) * 0.2 * b * (exp(-abs(p.y) / 0.55 - abs(p.x) / len) + exp(-abs(p.x) / 0.55 - abs(p.y) / len));
  // to nothing at the sprite's edge, so no square shows
  float edge = 1.0 - smoothstep(0.7 * vReach, vReach, max(abs(p.x), abs(p.y)));
  gl_FragColor = vec4(vColor * (core + glare + spikes) * edge, 1.0);
  #include <colorspace_fragment>
}`;

export function createStarField(catalogue) {
  const n = catalogue?.count ?? 0;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const bright = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = catalogue.dir[i * 3 + k] * STAR_RADIUS;
    // the colour, paler, at a luminance of 1 (the brightness is aBright's)
    const c = bvToRgb(catalogue.bv[i]).map((x) => 1 + (x - 1) * SATURATION);
    const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    col.set(c.map((x) => x / lum), i * 3);
    bright[i] = starBrightness(catalogue.mag[i]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uDpr: { value: 1 } },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const points = new THREE.Points(g, material);
  points.frustumCulled = false;
  return points;
}
