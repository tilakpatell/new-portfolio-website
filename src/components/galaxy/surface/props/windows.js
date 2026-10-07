// The towers' windows, lit: a grid of them in the shader over a tower's
// body, each cell lit or dark by a hash (and a seed per tower, from where it
// stands), in two whites (a warm 2700 K and a cool 6500 K), denser lower
// down where the city lives, going dark as the day comes up (the house's
// full light, uLookRef, says how bright the day is). Emissive, so bloom
// catches the far city as the film's. Works instanced (the scattered
// towers) and not (the ones placed one by one).
//
//   windowShader(shader, { seed }) → { vertexShader, fragmentShader, swapped } (pure)
//   litWindows(material, { seed, density, cell: [w, h], warm }) → the material, dressed once

import * as THREE from 'three';

const PARS = /* glsl */ `
uniform vec2 uWindowGrid;
uniform float uWindowDensity;
uniform float uWindowSeed;
uniform vec3 uWindowWarm;
uniform vec3 uWindowCool;
#ifndef LOOK_REF
#define LOOK_REF
uniform vec3 uLookRef;
#endif
varying vec3 vWindowPos;
varying float vWindowTower;
float windowHash(vec2 p) { p = fract(p * vec2(123.34, 456.21) + uWindowSeed); p += dot(p, p + 45.32); return fract(p.x * p.y); }
`;

const VERT = /* glsl */ `
{
  vec4 wp = vec4(position, 1.0);
  float tower = 0.0;
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
    tower = dot(instanceMatrix[3].xyz, vec3(0.37, 0.11, 0.73));
  #endif
  vWindowPos = wp.xyz;
  vWindowTower = tower;
}`;

// (after the emissive map: the windows' light added to what the material glows)
const FRAG = /* glsl */ `
{
  vec3 wn = normalize(vWindowPos - vec3(0.0, vWindowPos.y, 0.0) + 1e-5);
  float wu = abs(wn.x) > abs(wn.z) ? vWindowPos.z : vWindowPos.x;
  vec2 wc = vec2(wu, vWindowPos.y) / uWindowGrid;
  vec2 wf = fract(wc);
  vec2 wi = floor(wc) + vWindowTower;
  float lit = step(windowHash(wi), uWindowDensity * (1.2 - 0.5 * clamp(vWindowPos.y / 300.0, 0.0, 1.0)));
  float pane = step(0.18, wf.x) * step(wf.x, 0.82) * step(0.25, wf.y) * step(wf.y, 0.75);
  float flicker = 0.85 + 0.15 * windowHash(wi + 7.0);
  vec3 tint = windowHash(wi + 3.0) < 0.7 ? uWindowWarm : uWindowCool;
  float day = clamp(dot(uLookRef, vec3(0.2126, 0.7152, 0.0722)) / 0.9, 0.0, 1.0);
  totalEmissiveRadiance += tint * lit * pane * flicker * (1.0 - day * 0.85);
}`;

export function windowShader({ vertexShader, fragmentShader }) {
  if (!vertexShader.includes('#include <begin_vertex>') || !fragmentShader.includes('#include <emissivemap_fragment>')) return { vertexShader, fragmentShader, swapped: false };
  const vs = vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 vWindowPos;\nvarying float vWindowTower;`).replace('#include <begin_vertex>', `#include <begin_vertex>${VERT}`);
  const fs = fragmentShader.replace('#include <common>', `#include <common>${PARS}`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${FRAG}`);
  return { vertexShader: vs, fragmentShader: fs, swapped: true };
}

export function litWindows(material, { seed = 1, density = 0.55, cell = [3, 4], warm = '#ffd49a', cool = '#9ad4ff' } = {}) {
  if (!material || material.userData.windows) return material;
  const uniforms = {
    uWindowGrid: { value: new THREE.Vector2(cell[0], cell[1]) },
    uWindowDensity: { value: density },
    uWindowSeed: { value: seed },
    uWindowWarm: { value: new THREE.Color(warm).multiplyScalar(1.6) },
    uWindowCool: { value: new THREE.Color(cool).multiplyScalar(1.4) },
  };
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    before?.call(material, sh, r);
    Object.assign(sh.uniforms, uniforms);
    const out = windowShader(sh);
    sh.vertexShader = out.vertexShader;
    sh.fragmentShader = out.fragmentShader;
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|windows`;
  material.userData.windows = uniforms;
  material.needsUpdate = true;
  return material;
}
