// Kaon's architecture: Decepticon megastructures in dark plated iron, tier
// on tapering tier with fins and collars and a spike on top, lit by thin
// slits of furnace light rather than stripes; and angular gates over the road.
// The plating is a scanned CC0 metal mapped from world position, so a tower
// of any size shares one texture without stretching.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const flat = (g) => {
  const n = g.index ? g.toNonIndexed() : g;
  n.deleteAttribute('uv');
  n.computeVertexNormals();
  return n;
};

// A megastructure about 1 unit across at the foot (scaled per instance).
export function megaGeometry(seed) {
  const r = rng(seed);
  const parts = [];
  let y = 0;
  let w = 1;
  const sides = r() < 0.5 ? 8 : 6;
  const tiers = 3 + Math.floor(r() * 3);
  for (let t = 0; t < tiers; t++) {
    const h = (t === 0 ? 1.1 : 0.55) + r() * (t === 0 ? 0.8 : 0.9);
    const top = w * (0.62 + r() * 0.25);
    const body = new THREE.CylinderGeometry(top * 0.5, w * 0.5, h, sides, 1);
    body.rotateY(Math.PI / sides);
    body.translate(0, y + h / 2, 0);
    parts.push(body);
    // fins up the faces of some tiers
    if (r() < 0.65) {
      const n = sides / 2;
      for (let f = 0; f < n; f++) {
        const a = (f / n) * Math.PI * 2 + r() * 0.2;
        const fin = new THREE.BoxGeometry(w * 0.05, h * (0.75 + r() * 0.35), w * 0.18);
        const rad = (w * 0.5 + top * 0.5) * 0.5;
        fin.rotateY(-a);
        fin.translate(Math.cos(a) * rad, y + h * 0.5, Math.sin(a) * rad);
        parts.push(fin);
      }
    }
    // a collar where the tier meets the next
    const collar = new THREE.CylinderGeometry(top * 0.6, top * 0.56, h * 0.06 + 0.03, sides, 1);
    collar.rotateY(Math.PI / sides);
    collar.translate(0, y + h, 0);
    parts.push(collar);
    y += h;
    w = top;
  }
  // a spike, or a pair of horns
  if (r() < 0.6) {
    const s = new THREE.ConeGeometry(w * 0.22, 0.8 + r() * 1.4, 4);
    s.translate(0, y + 0.4, 0);
    parts.push(s);
  } else {
    for (const side of [-1, 1]) {
      const s = new THREE.ConeGeometry(w * 0.1, 0.9 + r() * 0.6, 4);
      s.rotateZ(side * -0.35);
      s.translate(side * w * 0.3, y + 0.35, 0);
      parts.push(s);
    }
  }
  const geo = mergeGeometries(parts.map(flat));
  geo.computeBoundingSphere();
  return geo;
}

// A gate over the road: two buttressed pillars and a pointed head, 26 m
// across and 19 m to the point.
export function gateGeometry() {
  const parts = [];
  for (const side of [-1, 1]) {
    const pillar = new THREE.BoxGeometry(1.8, 14, 2.2);
    pillar.translate(side * 11, 7, 0);
    const buttress = new THREE.CylinderGeometry(0.6, 1.9, 6, 4, 1);
    buttress.rotateY(Math.PI / 4);
    buttress.translate(side * 11.6, 3, 0);
    // the head: a beam rising to the point
    const beam = new THREE.BoxGeometry(13.6, 1.5, 2);
    beam.rotateZ(side * -0.36);
    beam.translate(side * 5.6, 16.2, 0);
    const fin = new THREE.BoxGeometry(0.3, 4.5, 2.6);
    fin.translate(side * 11, 15, 0);
    parts.push(pillar, buttress, beam, fin);
  }
  const crown = new THREE.ConeGeometry(0.9, 3.2, 4);
  crown.translate(0, 20.2, 0);
  parts.push(crown);
  return mergeGeometries(parts.map(flat));
}

// The light along the gate's inner edge: thin strips, dim until bloom finds them.
export function gateTrimGeometry() {
  const parts = [];
  for (const side of [-1, 1]) {
    const up = new THREE.BoxGeometry(0.12, 12.6, 0.3);
    up.translate(side * 10.05, 7.1, 1.05);
    const head = new THREE.BoxGeometry(12.2, 0.12, 0.3);
    head.rotateZ(side * -0.36);
    head.translate(side * 5.3, 15.35, 1.05);
    parts.push(up, head);
  }
  return mergeGeometries(parts.map(flat));
}

// Plated metal, mapped from world position, with furnace light in narrow
// window slits: a slit every few metres up, and only some of them lit.
export function kaonMetal(material, { tile = 10, slit = 4.2, key = 'kaon' } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vKW;\nvarying vec3 vKN;').replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
      {
        #ifdef USE_INSTANCING
          mat4 km = modelMatrix * instanceMatrix;
        #else
          mat4 km = modelMatrix;
        #endif
        vKW = (km * vec4(position, 1.0)).xyz;
        vKN = normalize(mat3(km) * normal);
        vec2 wuv = vec2((abs(vKN.x) > abs(vKN.z) ? vKW.z : vKW.x) / ${tile.toFixed(1)}, (abs(vKN.y) > 0.7 ? vKW.z : vKW.y) / ${tile.toFixed(1)});
        #ifdef USE_MAP
          vMapUv = wuv;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = wuv;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = wuv;
        #endif
        #ifdef USE_METALNESSMAP
          vMetalnessMapUv = wuv;
        #endif
        #ifdef USE_AOMAP
          vAoMapUv = wuv;
        #endif
      }`,
    );
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vKW;\nvarying vec3 vKN;').replace(
      '#include <emissivemap_fragment>',
      `{
        float row = floor(vKW.y / ${slit.toFixed(2)});
        float fy = fract(vKW.y / ${slit.toFixed(2)});
        float band = smoothstep(0.44, 0.47, fy) * (1.0 - smoothstep(0.53, 0.56, fy));
        float along = abs(vKN.x) > abs(vKN.z) ? vKW.z : vKW.x;
        float cell = floor(along / 2.4);
        float lit = step(0.78, fract(sin(dot(vec2(cell, row), vec2(12.9898, 78.233))) * 43758.5453));
        float upright = 1.0 - smoothstep(0.5, 0.8, abs(vKN.y));
        totalEmissiveRadiance *= band * lit * upright * step(2.0, vKW.y);
      }`,
    );
  };
  material.customProgramCacheKey = () => `kaonmetal-${key}`;
  return material;
}
