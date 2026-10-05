// The ground Albuquerque stands on: the desert floor, the road surfaces and
// the mountains round the valley.
//
// The desert floor has no texture laid over it: its colour and its relief are
// worked out per pixel from where the point is in the world, reading one
// small tiling noise image at four scales (a quarter of a mile down to a
// hand's width), so it never repeats and stays sharp under the wheels. Sand,
// red washes, pale caliche, cracked mud, wind ripples, and gravel thrown off
// along the roads. The roads' asphalt and the dirt track are painted once
// (lib/texture) with their own normal and roughness maps.

import * as THREE from 'three';
import { bufferCanvas, surfaceMaps, tileCells, tileFbm, tileNoise } from '../../../lib/texture';

const lin = (hex) => new THREE.Color(hex);

export function groundMaterial({ noise, roads, bump = true }) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.97, metalness: 0 });
  const uniforms = {
    uNoise: { value: noise },
    uRoadSeg: { value: roads.map((r) => new THREE.Vector4(r.a.x, r.a.z, r.b.x, r.b.z)) },
    uRoadW: { value: roads.map((r) => r.w / 2) },
    uSandA: { value: lin(0xc9a273) },
    uSandB: { value: lin(0xe0c092) },
    uWash: { value: lin(0x9a5f3c) },
    uCaliche: { value: lin(0xe9dcc0) },
    uGravel: { value: lin(0x6f6558) },
  };
  mat.defines = { ABQ_ROADS: roads.length, ...(bump ? { ABQ_BUMP: 1 } : {}) };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAbqWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAbqWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        varying vec3 vAbqWorld;
        uniform sampler2D uNoise;
        uniform vec4 uRoadSeg[ABQ_ROADS];
        uniform float uRoadW[ABQ_ROADS];
        uniform vec3 uSandA, uSandB, uWash, uCaliche, uGravel;
        // metres past the nearest road's edge (negative under the road)
        float abqRoad(vec2 p) {
          float d = 1e4;
          for (int i = 0; i < ABQ_ROADS; i++) {
            vec2 a = uRoadSeg[i].xy;
            vec2 ab = uRoadSeg[i].zw - a;
            float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
            d = min(d, length(p - (a + ab * t)) - uRoadW[i]);
          }
          return d;
        }
        float abqRipple(vec2 p, float warp) {
          return sin((p.x * 0.9 + p.y * 0.35) * 2.4 + warp * 14.0) * 0.5 + 0.5;
        }
        // the relief, 0 to 1: swells, lumps, grit, ripples, and cracks cut in
        float abqHeight(vec2 p) {
          vec4 a = texture2D(uNoise, p * 0.021);
          vec4 b = texture2D(uNoise, p * 0.17);
          vec4 g = texture2D(uNoise, p * 1.3);
          float crack = smoothstep(0.86, 0.98, b.b) * smoothstep(0.62, 0.8, a.g);
          float pebble = smoothstep(0.55, 0.2, texture2D(uNoise, p * 0.9).b) * step(0.62, g.r);
          return a.r * 0.4 + b.r * 0.3 + g.a * 0.14 + pebble * 0.25 + abqRipple(p, a.r) * 0.08 - crack * 0.4;
        }
        vec3 abqPerturb(vec3 pos, vec3 nrm, vec2 dH, float face) {
          vec3 sx = normalize(dFdx(pos));
          vec3 sy = normalize(dFdy(pos));
          vec3 r1 = cross(sy, nrm);
          vec3 r2 = cross(nrm, sx);
          float det = dot(sx, r1) * face;
          vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
          return normalize(abs(det) * nrm - grad);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        vec2 abqP = vAbqWorld.xz;
        vec4 abqM = texture2D(uNoise, abqP * 0.0031);
        vec4 abqA = texture2D(uNoise, abqP * 0.021 + abqM.rg * 0.35);
        vec4 abqB = texture2D(uNoise, abqP * 0.17);
        vec4 abqG = texture2D(uNoise, abqP * 1.3);
        vec3 abqCol = mix(uSandA, uSandB, smoothstep(0.3, 0.7, abqM.r));
        abqCol = mix(abqCol, uWash, smoothstep(0.52, 0.76, abqA.g) * 0.5);
        abqCol = mix(abqCol, uCaliche, smoothstep(0.6, 0.9, abqA.r * abqM.g + 0.2 * abqB.r) * 0.4);
        float abqCrack = smoothstep(0.86, 0.98, abqB.b) * smoothstep(0.62, 0.8, abqA.g);
        abqCol *= 1.0 - abqCrack * 0.4;
        abqCol *= 0.8 + 0.36 * abqG.a * (0.5 + 0.5 * abqB.r);
        float abqPebble = smoothstep(0.55, 0.2, texture2D(uNoise, abqP * 0.9).b) * step(0.62, abqG.r);
        abqCol = mix(abqCol, uGravel * (0.9 + 0.8 * abqG.a), abqPebble * 0.55);
        abqCol *= 1.0 - 0.07 * abqRipple(abqP, abqA.r) * smoothstep(0.4, 0.7, abqM.r);
        float abqEdge = abqRoad(abqP);
        float abqShoulder = 1.0 - smoothstep(0.0, 2.6 + 3.2 * abqA.r, abqEdge);
        abqCol = mix(abqCol, uGravel * (0.72 + 0.5 * abqG.a), abqShoulder * 0.7);
        diffuseColor.rgb *= abqCol;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        #ifdef ABQ_BUMP
        {
          float fade = 1.0 - smoothstep(50.0, 240.0, length(vViewPosition));
          float h0 = abqHeight(abqP);
          vec2 dH = vec2(abqHeight(abqP + dFdx(abqP)) - h0, abqHeight(abqP + dFdy(abqP)) - h0) * 0.7 * fade;
          normal = abqPerturb(-vViewPosition, normal, dH, faceDirection);
        }
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => `abq-ground-${roads.length}-${bump}`;
  return mat;
}

// One painted surface as three textures.
function maps(size, surface, { repeat = [1, 1], strength = 3, aniso = 8 } = {}) {
  const m = surfaceMaps(size, surface, { strength });
  const tex = (data, srgb) => {
    const t = new THREE.CanvasTexture(bufferCanvas(data, size));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: tex(m.color, true), normalMap: tex(m.normal, false), roughnessMap: tex(m.rough, false) };
}

// Asphalt: sun-greyed binder, stone showing through, cracks sealed with tar,
// and the darker lanes the tyres polish.
export function asphaltMaps(size = 512, aniso = 8) {
  const tone = tileFbm(3, { base: 3, octaves: 5 });
  const fine = tileFbm(8, { base: 48, octaves: 2 });
  const stone = tileCells(5, 120);
  const cracks = tileCells(21, 4);
  const warp = tileFbm(13, { base: 6, octaves: 3 });
  const worn = tileFbm(17, { base: 2, octaves: 3 });
  return maps(
    size,
    (u, v) => {
      const w = warp(u, v) * 0.06;
      const c = cracks(u + w, v - w);
      // only the worn stretches crack, and the cracks are sealed with tar
      const old = Math.max(0, Math.min(1, (worn(u, v) - 0.5) * 6));
      const crack = Math.max(0, 1 - c.edge * 70) * old;
      const tar = Math.max(0, 1 - c.edge * 26) * 0.5 * old;
      const s = stone(u, v);
      const chip = s.near < 0.3 ? 1 : 0;
      const t = tone(u, v);
      let g = 62 + t * 30 + fine(u, v) * 14 + chip * (6 + s.edge * 14);
      g *= 1 - tar * 0.4 - crack * 0.5;
      return { r: g * 1.02, g, b: g * 0.97, h: 0.55 + chip * 0.12 + fine(u, v) * 0.1 - crack * 0.5 - tar * 0.06, rough: 0.92 - tar * 0.4 - chip * 0.05 + t * 0.05 };
    },
    { strength: 1.8, aniso },
  );
}

// The dirt track out to the RV: packed earth, two ruts, stones.
export function dirtMaps(size = 512, aniso = 8) {
  const tone = tileFbm(31, { base: 3, octaves: 5 });
  const fine = tileFbm(37, { base: 40, octaves: 2 });
  const stone = tileCells(41, 26);
  const wob = tileNoise(43, 6);
  return maps(
    size,
    (u, v) => {
      const sway = (wob(v * 6, 0.5) - 0.5) * 0.05;
      const rut = Math.max(Math.exp(-(((u + sway - 0.27) / 0.075) ** 2)), Math.exp(-(((u + sway - 0.73) / 0.075) ** 2)));
      const s = stone(u, v);
      const pebble = s.near < 0.13 && s.edge > 0.25 ? 1 - s.near / 0.13 : 0;
      const t = tone(u, v);
      const k = 0.78 + t * 0.34 + fine(u, v) * 0.14 - rut * 0.2 + pebble * 0.16;
      return { r: 176 * k, g: 136 * k, b: 96 * k, h: 0.5 + t * 0.2 + fine(u, v) * 0.1 - rut * 0.34 + pebble * 0.3, rough: 0.96 - rut * 0.12 };
    },
    { strength: 3.4, aniso },
  );
}

// ── the mountains ──

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// A wall of rock all the way round, built as a ring of rows: `shape(a, t)`
// gives the height at heading `a` and `t` of the way back, and `paint` its
// colour.
function ring({ inner, depth, around, rows, shape, paint, floor = -10 }) {
  const pos = new Float32Array((around + 1) * (rows + 1) * 3);
  const col = new Float32Array((around + 1) * (rows + 1) * 3);
  const c = new THREE.Color();
  let k = 0;
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= around; i++) {
      const a = (i / around) * Math.PI * 2;
      const t = j / rows;
      const r = inner + t * depth;
      const y = j === 0 ? floor : shape(a, t);
      pos[k] = Math.cos(a) * r;
      pos[k + 1] = y;
      pos[k + 2] = Math.sin(a) * r;
      paint(c, a, t, y);
      col[k] = c.r;
      col[k + 1] = c.g;
      col[k + 2] = c.b;
      k += 3;
    }
  const idx = [];
  const w = around + 1;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < around; i++) {
      const p = j * w + i;
      idx.push(p, p + 1, p + w, p + 1, p + w + 1, p + w); // facing the valley
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// The Sandias in the east, granite that goes pink in a low sun, lower hills
// the rest of the way round, and in front of them the mesas: flat-topped,
// banded red and cream, with skirts of fallen rock.
export function createMountains() {
  const big = tileNoise(61, 24);
  const mid = tileNoise(67, 96);
  const gully = tileNoise(71, 512);
  const turn = (a) => a / (Math.PI * 2);
  const east = (a) => Math.max(0, Math.cos(a));

  const crest = (a) => {
    const e = east(a);
    const n = big(turn(a) * 24, 0.5) * 0.6 + mid(turn(a) * 96, 0.5) * 0.4;
    return 22 + e ** 1.6 * 104 * (0.62 + n * 0.7) + (1 - e) * (10 + n * 30);
  };
  const granite = new THREE.Color(0x8f6f66);
  const forest = new THREE.Color(0x66705a);
  const pale = new THREE.Color(0xc9ab9b);
  const foot = new THREE.Color(0xb5906c);
  const far = ring({
    inner: 700,
    depth: 260,
    around: 420,
    rows: 9,
    shape: (a, t) => {
      const up = smooth(0, 0.62, t) ** 0.85 * (1 - 0.3 * smooth(0.62, 1, t));
      const cut = 1 - 0.24 * gully(turn(a) * 512, t * 3) * smooth(0.05, 0.5, t);
      return crest(a) * up * cut - 6;
    },
    paint: (c, a, t, y) => {
      const hgt = y / 120;
      c.copy(foot).lerp(granite, smooth(0.05, 0.3, hgt));
      c.lerp(forest, smooth(0.25, 0.5, hgt) * (1 - smooth(0.6, 0.8, hgt)) * 0.55 * east(a));
      c.lerp(pale, smooth(0.55, 0.95, hgt));
      c.multiplyScalar(0.86 + 0.28 * gully(turn(a) * 512, t * 5));
    },
  });

  // mesas: where a slow noise is high there's one, with a flat top
  const where = tileNoise(83, 18);
  const tall = tileNoise(89, 18);
  const lip = tileNoise(97, 160);
  const mesaAt = (a) => smooth(0.56, 0.66, where(turn(a) * 18, 0.5)) * (1 - east(a) * 0.85);
  const top = (a) => mesaAt(a) * (30 + tall(turn(a) * 18 + 0.37, 0.5) * 46);
  const bands = [0x9b5a3a, 0xc79a6b, 0x7d4a33, 0xb9764c, 0xd9bf98, 0x8a5238].map((h) => new THREE.Color(h));
  const talus = new THREE.Color(0xb98f66);
  const near = ring({
    inner: 500,
    depth: 150,
    around: 360,
    rows: 10,
    floor: -4,
    shape: (a, t) => {
      const h = top(a);
      const wob = (lip(turn(a) * 160, t * 2) - 0.5) * 0.06;
      const skirt = smooth(0, 0.2, t) * 0.26;
      const cliff = smooth(0.2 + wob, 0.3 + wob, t) * 0.74;
      const back = 1 - smooth(0.72, 1, t);
      return h * (skirt + cliff) * back - 2 + smooth(0, 0.3, t) * 3;
    },
    paint: (c, a, t, y) => {
      const h = Math.max(1, top(a));
      const k = y / h;
      if (k < 0.3) c.copy(talus).multiplyScalar(0.9 + 0.2 * lip(turn(a) * 160, t * 4));
      else {
        const band = Math.floor(y / 6.5 + lip(turn(a) * 160, 0.3) * 1.4);
        c.copy(bands[((band % bands.length) + bands.length) % bands.length]);
        c.multiplyScalar(0.88 + 0.24 * lip(turn(a) * 160, t * 6));
      }
    },
  });

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(far, material), new THREE.Mesh(near, material));
  return {
    group,
    dispose() {
      far.dispose();
      near.dispose();
      material.dispose();
    },
  };
}
