// A planet's land as the GPU sees it: the cells round the eye (lib/land's
// makeCell), each in a layer of three texture arrays (its mask, its water
// levels, its heights), and one GLSL include that reads them anywhere, after
// Bruno Simon's one terrain map that every layer of his world reads
// (folio-2025's Terrain.js; docs/research/2026-10-08-folio-2025-physics-
// terrain-streaming.md Part 2 §1). The ground's material (land.js), the
// grass (grass.js takes `ground`), the water and the leaves all read the
// same function, so they agree.
//
// A cell's layer is its place on a torus, (cx mod n, cz mod n) with n =
// 2 × radius + 1, so moving the window (centre) re-keys nothing: the cells
// still in range keep their layers and only the ones that left are dropped.
// A layer is uploaded alone (three's addLayerUpdate), once, when its cell
// arrives.
//
//   createLandMap({ radius, palette, sea = 0 }) → { slots, masks, waters,
//     heights, uniforms, glsl: LAND_GLSL, ground: { glsl, uniforms } (what
//     createGrass takes), set(cx, cz, cell) → slot, drop(cx, cz), centre(cx,
//     cz), slotOf(cx, cz) → slot | −1, offset(x, z) (the world metres at the
//     scene's origin, after a floating-origin shift), dispose() }
//   LAND_GLSL: vec4 landMask(vec2 xz) (R paving, G grass, B depth, A flow;
//     0 outside the window), float landWater(vec2 xz) (−1e9 where none),
//     float landHeight(vec2 xz), vec3 landColour(vec4 mask, float slope,
//     float h) (his depth gradient dirt → shallow → deep by B, grass by G,
//     sand on the beach, rock on the steep), and groundHeight /
//     groundColour / groundGrass for the grass
//
// xz in the GLSL is the scene's (after the origin shift): uLandOffset adds
// the world's back.

import * as THREE from 'three';

const CELL = 64;
const MASK = 128;
const N = 65;
const NONE = -1e4; // a water level that is none (half floats reach 65504)

export const LAND_GLSL = /* glsl */ `
uniform highp sampler2DArray uLandMasks;
uniform highp sampler2DArray uLandWaters;
uniform highp sampler2DArray uLandHeights;
uniform vec2 uLandCentre;
uniform vec2 uLandOffset;
uniform float uLandRadius;
uniform float uLandSea;
uniform vec3 uLandDirt;
uniform vec3 uLandGrass;
uniform vec3 uLandSand;
uniform vec3 uLandRock;
uniform vec3 uLandShallow;
uniform vec3 uLandDeep;
// the layer a point's cell is in, and how far across the cell (0…1); the
// layer is −1 outside the window
float landLayer(vec2 xz, out vec2 f) {
  vec2 w = (xz + uLandOffset) / ${CELL.toFixed(1)};
  vec2 c = floor(w);
  f = w - c;
  if (any(greaterThan(abs(c - uLandCentre), vec2(uLandRadius)))) return -1.0;
  float n = 2.0 * uLandRadius + 1.0;
  vec2 s = mod(c, n);
  return s.y * n + s.x;
}
vec4 landMask(vec2 xz) {
  vec2 f;
  float l = landLayer(xz, f);
  if (l < 0.0) return vec4(0.0);
  return texture(uLandMasks, vec3(f, l));
}
// (the 65 levels a side are at the vertices: texel centres at 0 and 64 m)
vec2 landVertexUv(vec2 f) { return (f * ${(N - 1).toFixed(1)} + 0.5) / ${N.toFixed(1)}; }
float landWater(vec2 xz) {
  vec2 f;
  float l = landLayer(xz, f);
  if (l < 0.0) return -1e9;
  float w = texture(uLandWaters, vec3(landVertexUv(f), l)).r;
  return w < -1000.0 ? -1e9 : w;
}
float landHeight(vec2 xz) {
  vec2 f;
  float l = landLayer(xz, f);
  if (l < 0.0) return 0.0;
  return texture(uLandHeights, vec3(landVertexUv(f), l)).r;
}
vec3 landColour(vec4 mask, float slope, float h) {
  // his floor gradient by depth (dirt to 0.1, the shallows' turquoise at
  // 0.3, deep blue by 0.9), then his grass over it by G
  float b = mask.b;
  vec3 c = mix(uLandDirt, uLandShallow, smoothstep(0.1, 0.3, b));
  c = mix(c, uLandDeep, smoothstep(0.3, 0.9, b));
  c = mix(c, uLandGrass, mask.g);
  // a beach just above the sea, rock on the steep (neither under water)
  float dry = 1.0 - step(0.001, b);
  c = mix(c, uLandSand, dry * (1.0 - mask.g) * (1.0 - smoothstep(uLandSea + 1.0, uLandSea + 1.5, h)) * step(uLandSea - 0.5, h));
  c = mix(c, uLandRock, dry * smoothstep(0.45, 0.7, slope));
  return c;
}
float groundHeight(vec2 xz) { return landHeight(xz); }
vec3 groundColour(vec2 xz) { return landColour(landMask(xz), 0.0, landHeight(xz)); }
float groundGrass(vec2 xz) { return landMask(xz).g; }
`;

function layers(width, depth, data, format, type, filter) {
  const t = new THREE.DataArrayTexture(data, width, width, depth);
  t.format = format;
  t.type = type;
  t.minFilter = t.magFilter = filter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

const colour = (c) => new THREE.Color(c[0], c[1], c[2]);

export function createLandMap({ radius = 4, palette, sea = 0 } = {}) {
  const n = 2 * radius + 1;
  const slots = n * n;
  const masks = layers(MASK, slots, new Uint8Array(MASK * MASK * 4 * slots), THREE.RGBAFormat, THREE.UnsignedByteType, THREE.LinearFilter);
  const none = THREE.DataUtils.toHalfFloat(NONE);
  const waters = layers(N, slots, new Uint16Array(N * N * slots).fill(none), THREE.RedFormat, THREE.HalfFloatType, THREE.LinearFilter);
  const heights = layers(N, slots, new Uint16Array(N * N * slots), THREE.RedFormat, THREE.HalfFloatType, THREE.LinearFilter);
  const uniforms = {
    uLandMasks: { value: masks },
    uLandWaters: { value: waters },
    uLandHeights: { value: heights },
    uLandCentre: { value: new THREE.Vector2() },
    uLandOffset: { value: new THREE.Vector2() },
    uLandRadius: { value: radius },
    uLandSea: { value: Number.isFinite(sea) ? sea : -1e4 },
    uLandDirt: { value: colour(palette.dirt) },
    uLandGrass: { value: colour(palette.grass) },
    uLandSand: { value: colour(palette.sand) },
    uLandRock: { value: colour(palette.rock) },
    uLandShallow: { value: colour(palette.shallow) },
    uLandDeep: { value: colour(palette.deep) },
  };
  const held = new Map(); // slot → 'cx,cz'
  const mod = (v) => ((v % n) + n) % n;
  const slotFor = (cx, cz) => mod(cz) * n + mod(cx);
  const centre = { x: 0, z: 0 };

  const upload = (t, slot) => {
    t.addLayerUpdate(slot);
    t.needsUpdate = true;
  };
  function clear(slot) {
    masks.image.data.fill(0, slot * MASK * MASK * 4, (slot + 1) * MASK * MASK * 4);
    waters.image.data.fill(none, slot * N * N, (slot + 1) * N * N);
    heights.image.data.fill(0, slot * N * N, (slot + 1) * N * N);
    upload(masks, slot);
    upload(waters, slot);
    upload(heights, slot);
  }

  return {
    slots,
    masks,
    waters,
    heights,
    uniforms,
    glsl: LAND_GLSL,
    ground: { glsl: LAND_GLSL, uniforms },
    set(cx, cz, cell) {
      const slot = slotFor(cx, cz);
      masks.image.data.set(cell.mask, slot * MASK * MASK * 4);
      const w = waters.image.data;
      const h = heights.image.data;
      const o = slot * N * N;
      for (let k = 0; k < N * N; k++) {
        const v = cell.water[k];
        w[o + k] = Number.isNaN(v) ? none : THREE.DataUtils.toHalfFloat(v);
        h[o + k] = THREE.DataUtils.toHalfFloat(cell.heights[k]);
      }
      upload(masks, slot);
      upload(waters, slot);
      upload(heights, slot);
      held.set(slot, `${cx},${cz}`);
      return slot;
    },
    drop(cx, cz) {
      const slot = slotFor(cx, cz);
      if (held.get(slot) !== `${cx},${cz}`) return;
      held.delete(slot);
      clear(slot);
    },
    slotOf(cx, cz) {
      const slot = slotFor(cx, cz);
      return held.get(slot) === `${cx},${cz}` ? slot : -1;
    },
    // the window's middle cell: cells now out of it are dropped
    centre(cx, cz) {
      centre.x = cx;
      centre.z = cz;
      uniforms.uLandCentre.value.set(cx, cz);
      for (const [slot, key] of [...held]) {
        const [x, z] = key.split(',').map(Number);
        if (Math.abs(x - cx) > radius || Math.abs(z - cz) > radius) {
          held.delete(slot);
          clear(slot);
        }
      }
    },
    offset(x, z) {
      uniforms.uLandOffset.value.set(x, z);
    },
    dispose() {
      masks.dispose();
      waters.dispose();
      heights.dispose();
      held.clear();
    },
  };
}
