// The sky out past everything: the Milky Way all the way round, sharp
// however close the camera's narrow view brings it.
//
// The Milky Way is a photo, and the camera's 34° view magnifies it three to
// eight times over: drawn as it was, its JPEG blocks and its baked-in stars
// showed as soft squares, the one thing on screen that looked low-res next
// to the planets. So the photo gives only the light and colour of the band
// (planets.js's 'sky-glow': the stars taken out and the blocks blurred away,
// scripts/bake-universe-sky.mjs), looked up by direction (no seam where the
// longitude wraps, no pinch at the poles; `soften`, mip levels it can be
// blurred further, if wanted); everything fine is drawn here, at the
// screen's own resolution:
// - star clouds and dust lanes: the band's light broken up much finer than
//   the photo has it, the way a long exposure shows it (a tiling cloud
//   texture, read on three sides of the sphere at three scales), only where
//   the band is;
// - stars: `layers` layers of them (three on a desktop), each a grid on the
//   sphere with a star in some of its cells, drawn as a soft point a pixel
//   or so across at any zoom: faint ones crowding in along the band, more
//   scattered everywhere, and a few bright ones, each its own temperature.
//
// createSky(map, { layers, soften }) → a THREE.Mesh, a sphere SKY_RADIUS
// round, seen from inside (the scene keeps it on the camera and turns it
// with the map, as it did the plain textured one).

import * as THREE from 'three';
import { tileFbm } from '../../lib/texture';

export const SKY_RADIUS = 27000;
const CLOUD_SIZE = 256;

const VERT = `
varying vec3 vDir;
void main() {
  vDir = position; // (the sphere's own frame: the photo's, turning with the map)
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = `
uniform sampler2D uMap;
uniform sampler2D uCloud;
uniform float uSoften;
uniform float uDetail;
varying vec3 vDir;

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

// the photo at direction d, as three.js's sphere maps it (at least uSoften
// mip levels down), never seamed
vec3 photo(vec3 d) {
  vec2 uv = vec2(fract(atan(d.z, -d.x) * 0.15915494), 1.0 - acos(clamp(d.y, -1.0, 1.0)) * 0.31830989);
  vec2 gx = dFdx(uv);
  vec2 gy = dFdy(uv);
  gx.x -= floor(gx.x + 0.5);
  gy.x -= floor(gy.x + 0.5);
  vec2 size = vec2(textureSize(uMap, 0));
  float lod = log2(max(max(length(gx * size), length(gy * size)), 1e-6));
  return textureLod(uMap, uv, max(lod, uSoften)).rgb;
}

// the cloud texture on three sides of the sphere at frequency f (a tile a
// 1/f of a radian across), blended by which way d faces: r, soft clouds;
// g, creased (dust lanes)
vec2 cloud(vec3 d, float f) {
  vec3 w = pow(abs(d), vec3(4.0));
  w /= w.x + w.y + w.z;
  return texture2D(uCloud, d.yz * f).rg * w.x + texture2D(uCloud, d.zx * f).rg * w.y + texture2D(uCloud, d.xy * f).rg * w.z;
}

// one layer of stars: n cells to the radian, a star in a cell (odds) of the
// time, as bright as (bright) at most, each a soft point about a pixel (px,
// in radians) across. Each cell's star is at a random spot in it, so the
// nearest eight cells hold any that could touch this pixel
vec3 stars(vec3 d, float n, float odds, float bright, float px) {
  vec3 p = d * n;
  vec3 b = floor(p - 0.5);
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    vec3 c = b + vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
    vec3 h = hash33(c);
    if (h.x > odds) continue;
    vec3 s = normalize(c + hash33(c + 17.31));
    vec3 e = d - s;
    // brightness: mostly faint, a few bright (and those a little wider)
    float m = bright * (0.03 + 0.97 * pow(h.y, 8.0));
    float sigma = px * (0.55 + 0.45 * h.y * h.y);
    float g = exp(-dot(e, e) / (2.0 * sigma * sigma));
    // temperature: orange through white to blue-white
    vec3 tint = h.z < 0.5 ? mix(vec3(1.0, 0.72, 0.5), vec3(1.0, 0.96, 0.9), h.z * 2.0) : mix(vec3(1.0, 0.96, 0.9), vec3(0.72, 0.82, 1.0), h.z * 2.0 - 1.0);
    sum += tint * m * g;
  }
  return sum;
}

void main() {
  vec3 d = normalize(vDir);
  vec3 base = photo(d);
  float lum = dot(base, vec3(0.2126, 0.7152, 0.0722));
  float band = smoothstep(0.004, 0.09, lum);
  // the band broken up: brighter knots of stars, darker lanes of dust
  vec2 fine = cloud(d, 6.0) * 0.45 + cloud(d, 19.0) * 0.35 + cloud(d, 61.0) * 0.2;
  float knots = 0.45 + 1.25 * fine.r;
  float lanes = 1.0 - 0.55 * smoothstep(0.62, 0.92, fine.g);
  vec3 col = base * mix(1.0, knots * lanes, band * uDetail);
  // the stars, sized to a pixel here, however far the view's zoomed
  float px = max(length(dFdx(d)), length(dFdy(d)));
  col += stars(d, 520.0, 0.004 + 0.3 * band * band, 0.32, px);
  #if LAYERS > 1
  col += stars(d, 170.0, 0.05 + 0.12 * band, 0.8, px);
  #endif
  #if LAYERS > 2
  col += stars(d, 58.0, 0.16, 1.5, px * 1.25);
  #endif
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// the tiling cloud texture: r soft fbm, g the same creased (ridged)
function cloudTexture() {
  const soft = tileFbm(11, { base: 4, octaves: 5, gain: 0.55 });
  const creased = tileFbm(23, { base: 3, octaves: 5, gain: 0.5, ridged: true });
  const data = new Uint8Array(CLOUD_SIZE * CLOUD_SIZE * 4);
  for (let y = 0; y < CLOUD_SIZE; y++) {
    for (let x = 0; x < CLOUD_SIZE; x++) {
      const i = (y * CLOUD_SIZE + x) * 4;
      const u = x / CLOUD_SIZE;
      const v = y / CLOUD_SIZE;
      data[i] = Math.round(soft(u, v) * 255);
      data[i + 1] = Math.round(creased(u, v) * 255);
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, CLOUD_SIZE, CLOUD_SIZE, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export function createSky(map, { layers = 3, soften = 0 } = {}) {
  const cloud = cloudTexture();
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: { LAYERS: Math.max(1, Math.min(3, layers)) },
    uniforms: { uMap: { value: map }, uCloud: { value: cloud }, uSoften: { value: soften }, uDetail: { value: 1 } },
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 64, 32), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}
