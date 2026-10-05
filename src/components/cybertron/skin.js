// Cybertron's skin, for any MeshStandardMaterial wrapped round a sphere: the
// universe map's planet and the Cybertron page's. The big shapes come from
// the maps (scripts/build-cybertron-planet.mjs): the colour, the relief, and
// what glows, packed one thing to a channel (red the energon, green the
// fires, blue the cities' lights) so the energon can take each side's colour
// and the cities light only the night side. Up close, where the maps run out
// of pixels, the plating carries on in the shader: rectangles on the cube's
// faces, cut and cut again, their seams grooved in the light, fading in only
// once they're big enough on the screen not to shimmer.
//
// cybertronSkin(mat, { glow, sun }) → its uniforms (set uEnergon, uLevels,
// uTime as you like). Chains any onBeforeCompile already on the material.

import * as THREE from 'three';

// the energon's colour, and how much of the planet burns, for each side
export const SIDES = {
  autobot: { energon: new THREE.Color(0x3fd2ff), war: 0.6 },
  decepticon: { energon: new THREE.Color(0xb06bff), war: 1 },
};

const PARS = /* glsl */ `
uniform sampler2D uCyGlow;
uniform vec3 uEnergon;
uniform vec3 uFire;
uniform vec3 uCity;
uniform vec4 uLevels; // energon, fire, city lights, close-up detail
uniform float uTime;
uniform vec3 uCySun;
varying vec3 vCyObj;

float cyHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
// a direction's place on its cube face, equal-angle (0…1 each way), and which face
vec3 cyFace(vec3 p) {
  vec3 a = abs(p);
  vec2 ab;
  float m;
  float face;
  if (a.x >= a.y && a.x >= a.z) { face = p.x > 0.0 ? 0.0 : 1.0; ab = p.zy; m = a.x; }
  else if (a.y >= a.z) { face = p.y > 0.0 ? 2.0 : 3.0; ab = p.xz; m = a.y; }
  else { face = p.z > 0.0 ? 4.0 : 5.0; ab = p.xy; m = a.z; }
  return vec3(atan(ab / m) * 0.63661977 * 0.5 + 0.5, face);
}
// plating: a grid cut again and again, the longer side first. x: the plate's
// id, y: how far in from its edge (in grid cells); f: where on the plate
vec2 cyPlates(vec2 g, float face, out vec2 f) {
  vec2 lo = floor(g);
  vec2 hi = lo + 1.0;
  float id = cyHash(lo + face * 131.7);
  for (int d = 0; d < 4; d++) {
    vec2 size = hi - lo;
    float cut = 0.25 + floor(cyHash(vec2(id * 97.0, float(d))) * 4.999) * 0.125;
    if (size.x >= size.y) {
      float s = lo.x + size.x * cut;
      float right = step(s, g.x);
      lo.x = mix(lo.x, s, right);
      hi.x = mix(s, hi.x, right);
      id = cyHash(vec2(id * 53.0 + right, float(d) + 3.0));
    } else {
      float s = lo.y + size.y * cut;
      float up = step(s, g.y);
      lo.y = mix(lo.y, s, up);
      hi.y = mix(s, hi.y, up);
      id = cyHash(vec2(id * 71.0 + up, float(d) + 7.0));
    }
  }
  vec2 e = min(g - lo, hi - g);
  f = (g - lo) / (hi - lo);
  return vec2(id, min(e.x, e.y));
}
// the close-up relief and how worn it is: one scale of plating, faded by its
// size on the screen
vec2 cyDetail(vec3 dir, float grid) {
  vec3 fc = cyFace(dir);
  vec2 g = fc.xy * grid;
  float px = length(fwidth(g)); // grid cells per pixel
  float show = smoothstep(0.45, 0.12, px);
  if (show <= 0.0) return vec2(0.0);
  vec2 f;
  vec2 pl = cyPlates(g, fc.z, f);
  float w = max(px * 1.2, 0.025);
  float groove = 1.0 - smoothstep(0.0, w, pl.y);
  float lift = (pl.x - 0.5) * 0.35;
  // a hatch or a vent on some plates
  float hatch = step(0.82, pl.x) * (1.0 - smoothstep(0.0, w, min(min(f.x - 0.3, 0.7 - f.x), min(f.y - 0.3, 0.7 - f.y)) * 3.0)) * step(0.0, min(min(f.x - 0.25, 0.75 - f.x), min(f.y - 0.25, 0.75 - f.y)));
  return vec2((lift - groove - hatch * 0.5) * show, (groove + hatch * 0.6) * show);
}
// bump from a height's screen derivatives (as three's own bump map does)
vec3 cyBump(vec3 surfPos, vec3 n, vec2 dHdxy) {
  vec3 sx = dFdx(surfPos);
  vec3 sy = dFdy(surfPos);
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * n - grad);
}
`;

export function cybertronSkin(mat, { glow = null, sun = new THREE.Vector3(1, 0.5, 0.5).normalize(), city = 0xffc98a, fire = 0xff7614 } = {}) {
  const u = {
    uCyGlow: { value: glow },
    uEnergon: { value: SIDES.autobot.energon.clone() },
    uFire: { value: new THREE.Color(fire) },
    uCity: { value: new THREE.Color(city) },
    uLevels: { value: new THREE.Vector4(1.8, 2.2, 1.6, 1) },
    uTime: { value: 0 },
    uCySun: { value: sun },
  };
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCyObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCyObj = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      // the close-up plating: worn paler at the edges, dark in the seams
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 cyDir = normalize(vCyObj);
        vec2 cyA = cyDetail(cyDir, 64.0) * uLevels.w;
        vec2 cyB = cyDetail(cyDir, 512.0) * uLevels.w;
        diffuseColor.rgb *= (1.0 - 0.45 * cyA.y) * (1.0 - 0.3 * cyB.y) * (1.0 + 0.18 * cyA.x);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float cyH = cyA.x * 0.0035 + cyB.x * 0.0006;
          normal = cyBump(-vViewPosition, normal, vec2(dFdx(cyH), dFdy(cyH)));
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 cyG = texture2D(uCyGlow, vMapUv).rgb;
          vec3 cySunV = normalize((viewMatrix * vec4(uCySun, 0.0)).xyz);
          float cyNight = smoothstep(0.12, -0.28, dot(normalize(vNormal), cySunV));
          vec3 o = vCyObj * 12.0;
          // energon runs: a slow pulse along it, and it brightens where it pools
          float run = 0.72 + 0.28 * sin(uTime * 1.6 - (o.x + o.y * 1.3 + o.z * 0.7));
          totalEmissiveRadiance += uEnergon * (cyG.r * cyG.r * 1.6 + cyG.r * 0.4) * run * uLevels.x * (0.75 + 0.25 * cyNight);
          // fires flicker
          float flick = 0.65 + 0.35 * sin(uTime * 6.3 + o.y * 7.0) * sin(uTime * 2.7 + o.z * 5.0 + o.x * 3.0);
          totalEmissiveRadiance += (uFire * cyG.g + vec3(1.0, 0.78, 0.35) * cyG.g * cyG.g * cyG.g * 0.9) * flick * uLevels.y;
          // the cities, on the night side (a little even by day), their
          // windows sharpening up close where the plating is drawn
          totalEmissiveRadiance += uCity * cyG.b * cyNight * uLevels.z * (1.0 - 0.6 * cyA.y);
        }`,
      );
  };
  mat.customProgramCacheKey = () => `cybertron-${prevKey ? prevKey.call(mat) : ''}`;
  mat.userData.cybertron = u;
  return u;
}
