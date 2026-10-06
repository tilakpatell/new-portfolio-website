// A world's grass, as Bruno Simon grows his (folio-2025's Grass.js; the
// compound's lawn, avengers/world/grass.js, the same way): blades, not a
// picture of them, one small triangle drawn tens of thousands of times in
// one go, in a patch that goes with you (each blade keeps its place on the
// land until it's left behind, then comes round to the far side). Each one
// stands on the ground as it's drawn (the height grid's own triangles, read
// in the shader), dark at the root and lighter and warmer at the tip, in the
// world's own colours, leaning in the one wind the plants move in, gusts
// running across it in bands; pushed aside where you walk. Where it grows is
// a picture of the land from above (coverMap: none on steep ground, under
// water, on the places' built ground or the landing pad; thicker in drifts
// by a noise), its green channel how tall, its blue how dry.
//
// A site's `grass`: { h: [lo, hi] metres, w: blade width, root, mid, tip,
// dry (colours), cover: 0…1 how much of the land it covers, scale: the
// drifts' size in metres, slope: [steep, flat] (the ground's normal y it
// fades in over), above: metres over the water it starts, flower: { color,
// share }, wind: how hard it blows here }
//
// createGrass(scene, { grid, site, small, time }) → { mesh, update(x, z, px, pz), shade(bake), dispose }

import * as THREE from 'three';
import { HALF } from './terrain';
import { fbm, smoothstep } from './noise';

// the cover picture's size (texels a side) over the walkable square
const COVER = 256;

// Where grass grows, how tall and how dry, over the walkable square
// (±HALF): RGBA bytes, row by row from -z, column by column from -x. Pure,
// so a test can read it.
export function coverMap(grid, site, { size = COVER } = {}) {
  const g = site.grass ?? {};
  const out = new Uint8Array(size * size * 4);
  const seed = (site.ground?.seed ?? 1) + 101;
  const [steep, flat] = g.slope ?? [0.84, 0.94];
  const water = site.water?.level ?? null;
  const above = g.above ?? 0.4;
  const cover = g.cover ?? 0.7;
  const scale = g.scale ?? 90;
  // (none on the places' built ground or round the landing pad)
  const bare = [...(site.places ?? []).filter((p) => p.flat).map((p) => ({ at: p.at, r: p.flat.r })), { at: site.land?.at ?? [0, 0], r: 26 }];
  const step = (2 * HALF) / size;
  for (let j = 0; j < size; j++) {
    const z = -HALF + (j + 0.5) * step;
    for (let i = 0; i < size; i++) {
      const x = -HALF + (i + 0.5) * step;
      let k = smoothstep(steep, flat, grid.normalAt(x, z, step * 0.5)[1]);
      if (k > 0 && water != null) k *= smoothstep(water + above, water + above + 0.6, grid.heightAt(x, z));
      for (const b of bare) {
        if (k <= 0) break;
        k *= smoothstep(b.r, b.r + 6, Math.hypot(x - b.at[0], z - b.at[1]));
      }
      // (in drifts, not everywhere alike)
      const n = fbm(x / scale, z / scale, { octaves: 3, seed }) * 0.5 + 0.5;
      k *= smoothstep(1 - cover - 0.2, 1 - cover + 0.2, n);
      const tall = 0.55 + 0.45 * (fbm(x / (scale * 0.4), z / (scale * 0.4), { octaves: 2, seed: seed + 7 }) * 0.5 + 0.5);
      const dry = smoothstep(-0.15, 0.45, fbm(x / (scale * 1.7), z / (scale * 1.7), { octaves: 2, seed: seed + 13 }));
      const o = (j * size + i) * 4;
      out[o] = Math.round(k * 255);
      out[o + 1] = Math.round(tall * 255);
      out[o + 2] = Math.round(dry * 255);
      out[o + 3] = 255;
    }
  }
  return out;
}

// Each blade's place in the patch (x, z) and two random numbers, as
// [x, z, r1, r2]: the R2 sequence, a little jittered (any first part of it
// covers the whole patch evenly)
export function bladeLayout(count, patch) {
  const offs = new Float32Array(count * 4);
  let s = 7;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const g = 1.324717957244746;
  const a1 = 1 / g;
  const a2 = 1 / (g * g);
  const jitter = 0.7 / Math.sqrt(count);
  const frac = (v) => v - Math.floor(v);
  for (let i = 0; i < count; i++) {
    offs[i * 4] = (frac(0.5 + a1 * i + (rand() - 0.5) * jitter) - 0.5) * patch;
    offs[i * 4 + 1] = (frac(0.5 + a2 * i + (rand() - 0.5) * jitter) - 0.5) * patch;
    offs[i * 4 + 2] = rand();
    offs[i * 4 + 3] = rand();
  }
  return offs;
}

// one blade: a single triangle, a metre tall (scaled per blade), its uv.y
// how far up it is
function bladeGeometry() {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, 1, 0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  return g;
}

// the ground's height in the shader: the grid's own triangles, as
// terrain.js heightGrid reads them (cells split from (i, j + 1) to (i + 1, j))
export const GROUND_Y = /* glsl */ `
uniform sampler2D uHeights;
uniform vec3 uGrid; // HALF, the cell, cells a side
float groundY(vec2 p) {
  vec2 g = clamp((p + uGrid.x) / uGrid.y, vec2(0.0), vec2(uGrid.z - 0.001));
  ivec2 c = ivec2(floor(g));
  vec2 f = g - vec2(c);
  float h00 = texelFetch(uHeights, c, 0).r;
  float h10 = texelFetch(uHeights, c + ivec2(1, 0), 0).r;
  float h01 = texelFetch(uHeights, c + ivec2(0, 1), 0).r;
  if (f.x + f.y <= 1.0) return h00 + (h10 - h00) * f.x + (h01 - h00) * f.y;
  float h11 = texelFetch(uHeights, c + ivec2(1, 1), 0).r;
  return h11 + (h01 - h11) * (1.0 - f.x) + (h10 - h11) * (1.0 - f.y);
}
`;

// the walkable square's heights as a float picture, (n + 1) texels a side
export function heightTexture(grid) {
  const n = Math.round((2 * HALF) / grid.cell);
  const first = grid.lines.indexOf(-HALF);
  const data = new Float32Array((n + 1) * (n + 1));
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) data[j * (n + 1) + i] = grid.heights[(first + j) * grid.size + first + i];
  const t = new THREE.DataTexture(data, n + 1, n + 1, THREE.RedFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return { texture: t, n };
}

export function createGrass(scene, { grid, site, small = false, time = { value: 0 } }) {
  const g = site.grass;
  const patch = (small ? 28 : 56) * (g.patch ?? 1);
  const count = Math.round((small ? 16000 : 80000) * (g.density ?? 1));
  const geo = bladeGeometry();
  geo.setAttribute('aBlade', new THREE.InstancedBufferAttribute(bladeLayout(count, patch), 4));
  geo.instanceCount = count;
  const cover = new THREE.DataTexture(coverMap(grid, site), COVER, COVER, THREE.RGBAFormat);
  cover.minFilter = cover.magFilter = THREE.LinearFilter;
  cover.generateMipmaps = false;
  cover.needsUpdate = true;
  const heights = heightTexture(grid);
  const wind = site.ground?.wind ?? 0.3;
  const col = (c, d) => new THREE.Color(c ?? d);
  const U = {
    uCenter: { value: new THREE.Vector2() },
    uPlayer: { value: new THREE.Vector2(1e5, 1e5) },
    uPatch: { value: patch },
    uTime: time,
    uCover: { value: cover },
    uHeights: { value: heights.texture },
    uGrid: { value: new THREE.Vector3(HALF, grid.cell, heights.n) },
    uH: { value: new THREE.Vector2(...(g.h ?? [0.3, 0.6])) },
    uW: { value: g.w ?? 0.08 },
    uWindDir: { value: new THREE.Vector2(Math.cos(wind), Math.sin(wind)) },
    uWindK: { value: g.wind ?? 0.5 },
    uRoot: { value: col(g.root, '#405138') },
    uMid: { value: col(g.mid, '#718332') },
    uTip: { value: col(g.tip, '#8ea33d') },
    uDry: { value: col(g.dry, g.tip ?? '#a8a060') },
    uFlower: { value: col(g.flower?.color, '#f4e27a') },
    uFlowers: { value: g.flower?.share ?? 0 },
  };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        ${GROUND_Y}
        attribute vec4 aBlade;
        uniform vec2 uCenter, uPlayer, uH, uWindDir;
        uniform float uPatch, uTime, uW, uWindK, uFlowers;
        uniform sampler2D uCover;
        varying float vUp;
        varying float vTone;
        varying float vDry;
        varying float vFlower;`,
      )
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n        objectNormal = vec3(0.0, 1.0, 0.0); // (lit as the ground is)')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          // its place on the land: fixed, until it's left behind and comes round ahead
          vec2 wp = aBlade.xy + uPatch * floor((uCenter - aBlade.xy) / uPatch + 0.5);
          vec2 cuv = (wp + uGrid.x) / (2.0 * uGrid.x);
          vec4 cv = texture2D(uCover, clamp(cuv, 0.0, 1.0));
          float inside = step(0.0, cuv.x) * step(0.0, cuv.y) * step(cuv.x, 1.0) * step(cuv.y, 1.0);
          // (each blade grows where the cover's over its own number: thin
          // cover is fewer blades, not shorter ones; the patch's round edge
          // fades them out)
          float keep = smoothstep(aBlade.w - 0.08, aBlade.w + 0.08, cv.r) * inside;
          float fade = 1.0 - smoothstep(0.32, 0.5, length(wp - uCenter) / uPatch);
          float k = keep * fade;
          float h = mix(uH.x, uH.y, aBlade.z) * mix(0.55, 1.0, cv.g) * mix(0.35, 1.0, k);
          float wide = uW * smoothstep(0.0, 0.25, k);
          float a = aBlade.w * 40.0 + aBlade.z * 6.2832;
          vec3 p = vec3(position.x * cos(a) * wide, position.y * h, position.x * sin(a) * wide);
          // the wind: gusts running across it in bands, and each blade's own sway
          float band = smoothstep(0.35, 1.0, 0.5 + 0.5 * sin(dot(wp, uWindDir) * 0.45 - uTime * 1.6));
          float sway = 0.18 + 0.12 * sin(uTime * 2.3 + aBlade.z * 6.2832) + band * 0.55;
          float bend = position.y * position.y * h * uWindK;
          p.xz += uWindDir * sway * bend + vec2(aBlade.z - 0.5, aBlade.w - 0.5) * 0.25 * position.y * h;
          // pushed aside round you
          vec2 off = wp - uPlayer;
          float near = 1.0 - smoothstep(0.3, 1.4, length(off));
          p.xz += normalize(off + 1e-4) * near * 0.6 * position.y * h;
          p.y -= near * 0.3 * position.y * h;
          transformed = vec3(wp.x, groundY(wp) - 0.03, wp.y) + p;
          vUp = position.y;
          vTone = aBlade.z;
          vDry = cv.b;
          vFlower = step(1.0 - uFlowers, fract(aBlade.w * 7.31 + aBlade.z * 3.7)) * step(0.6, cv.g);
        }`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uRoot, uMid, uTip, uDry, uFlower;
        varying float vUp;
        varying float vTone;
        varying float vDry;
        varying float vFlower;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          // dark at the root, the world's green up the blade, lighter and warmer at the tip
          vec3 c = mix(uRoot, uMid, smoothstep(0.0, 0.5, vUp));
          c = mix(c, uTip, smoothstep(0.45, 1.0, vUp));
          c = mix(c, uDry * mix(0.75, 1.0, vUp), vDry * 0.75);
          c *= mix(0.86, 1.08, vTone);
          c = mix(c, uFlower, vFlower * smoothstep(0.82, 0.95, vUp));
          diffuseColor.rgb = c;
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'galaxy-grass';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'grass';
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  // (its blades are where the shader puts them: the floor's light bake mustn't draw it)
  mesh.userData.noBake = true;
  scene.add(mesh);
  return {
    mesh,
    // the patch round (x, z); pushed aside at (px, pz)
    update(x, z, px = x, pz = z) {
      U.uCenter.value.set(x, z);
      U.uPlayer.value.set(px, pz);
    },
    dispose() {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
      cover.dispose();
      heights.texture.dispose();
    },
  };
}
