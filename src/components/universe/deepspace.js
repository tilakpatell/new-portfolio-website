// Deep space, drawn: the wonders deep.js puts out past the home system, each
// where deep.js says and at its radius, and what's between them.
//
// - Aurelia, the ringed gas giant: bands that flow and curl (the noise pushes
//   each latitude's colour about), a great storm the bands wind round, a
//   darker, redder edge and a terminator that fades softly into night, air
//   glowing on its rim, and a wide ring of a hundred ringlets with gaps, lit,
//   thinner where it's backlit, the planet's shadow across it and its shadow
//   on the planet. Glacia, the ice giant, is the same made pale: softer
//   bands under haze, a dark spot with bright clouds by it, a faint ring.
// - Ember and Halcyon, two more suns: a boiling surface in their own colour,
//   bright enough to bloom, a corona with streamers round it and a wide glow
//   that grows stronger the further off you are, so from across the map each
//   still reads as a star. Their planets are lit by them: rock (craters
//   pressed into a height map, lit with relief), ocean (seas, coasts, ice
//   caps, clouds, the sun's glint on the water) and gas.
// - The Maw, the black hole: a shadow of pure black, a thin hard ring of
//   light at its edge, and the far side of its accretion disk bent up over
//   the top and under the bottom (a ring that always faces you, shaped by
//   how the disk is tipped toward you). The disk itself swirls, inner parts
//   faster, white-blue hot inside to red outside, one side brighter where it
//   comes toward you; faint jets run out of the poles. lens() is where it is,
//   for the post's bending of the light round it.
// - The Veil and the Cradle, nebulae: soft clouds of many puffs that always
//   face you (noise painted once into a small texture, so a pixel is a couple
//   of lookups), glowing in their colours with dark lanes of dust across
//   them and young stars inside. A puff fades out as you come close to it,
//   so flying through is a drift through haze, not a wall.
// - The Citadel of Ricks, as the show draws it: a great glass dome with a
//   city of pale green towers under it on a bronze saucer, four arms out to
//   smaller domed cities (one riding higher than the rest), a cluster of
//   tall blades hanging under it with cyan light down them and a crystal
//   hanging lowest, beacons round the rim, a portal swirling beside it and
//   council ships circling.
// - Names: each wonder's in spaced capitals over a thin line, with what it is
//   under it, at the same size on screen however far off. They show only out
//   of the home system and well clear of the wonder, and fade in and out.
// - Further off still: a few galaxies and a cluster, riding with the camera
//   like the Milky Way (so they never come any closer), and two thin streams
//   of tumbling rocks in the open space between the wonders.
//
// Lit things are lit in world space from where their light is (the home sun
// at the map's middle, or their own star), so the map can turn under them.
//
// buildDeepSpace({ small }) → { group, update(t, camera, cam), lens(), dispose() }
// cam is the camera's position in the map's space (the group's own).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SWIRL_GLSL } from '../rickmorty/swirl';
import { DEEP, WONDERS, planetAt, reachOf } from './deep';
import { TILT } from './maw';
import { rng } from './kit';
import { NOISE_GLSL } from './sun';
import { buildTraffic } from './trafficModels';

const { PI, sin, cos, hypot, max, min } = Math;
const TAU = PI * 2;

const SKY_FAR = 2200; // how far off the background galaxies ride (inside the camera's far plane)
const LABEL_H = 0.15; // a name's height on screen, in clip units (about a thirteenth of the screen)
const LABEL_W = 1024; // a name's row in the atlas, in px
const LABEL_RH = 128;
const HOME_LIGHT = new THREE.Color(1.0, 0.96, 0.9).multiplyScalar(1.55); // the home sun, far out here

const SUBTITLE = {
  aurelia: 'ringed gas giant',
  glacia: 'ice giant',
  ember: 'orange star · two worlds',
  halcyon: 'blue star · two worlds',
  maw: 'black hole',
  veil: 'nebula',
  cradle: 'stellar nursery',
  citadel: 'citadel of ricks',
};

// ── GLSL shared by the shaders ──

const COMMON = `
float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 nrm(vec3 v) { float l = length(v); return l > 1e-6 ? v / l : vec3(0.0, 1.0, 0.0); }
float hash12(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
// relief from a height, by how it changes across the screen (no tangents needed)
vec3 bumped(vec3 n, vec3 pos, float h) {
  vec3 sx = dFdx(pos);
  vec3 sy = dFdy(pos);
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  vec3 b = abs(det) * n - grad;
  float l = length(b);
  return l > 1e-20 ? b / l : n;
}
// an equirectangular lookup that doesn't seam where the longitude wraps
vec4 globe(sampler2D map, vec3 p) {
  vec2 uv = vec2(atan(p.z, p.x + 1e-7) * 0.15915494 + 0.5, asin(clamp(p.y, -1.0, 1.0)) * 0.31830989 + 0.5);
  vec2 gx = dFdx(uv);
  vec2 gy = dFdy(uv);
  gx.x -= floor(gx.x + 0.5);
  gy.x -= floor(gy.x + 0.5);
  return textureGrad(map, uv, gx, gy);
}`;

// a quad that always faces the camera, `position` its offset in world units
// (the mesh's turn is ignored); vC is that offset in its radii, vSil how much
// wider than its radius a sphere of that radius looks on the quad's plane
// (from close in you see less than half of it), vDist how far off it is
const BILLBOARD_VERT = `
uniform float uR;
varying vec2 vC;
varying float vSil;
varying float vDist;
void main() {
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float d = length(mv.xyz);
  vDist = d;
  vSil = d > uR * 1.02 ? d / sqrt(d * d - uR * uR) : 5.0;
  vC = position.xy / uR;
  mv.xy += position.xy;
  gl_Position = projectionMatrix * mv;
}`;

// ── Planets: one shader, a look per kind ──

const WORLD_VERT = `
varying vec3 vObj;
varying vec3 vW;
varying vec3 vNW;
varying vec3 vCentre;
varying vec3 vAxis;
void main() {
  vObj = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vNW = mat3(modelMatrix) * normal;
  vCentre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vAxis = mat3(modelMatrix) * vec3(0.0, 1.0, 0.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const WORLD_FRAG = `
uniform float uTime;
uniform vec3 uLight;
uniform vec3 uLightColor;
uniform vec3 uRim;
uniform float uRimStrength;
uniform vec3 uDusk;
uniform vec3 uBase;
uniform vec3 uAccent;
uniform sampler2D uBands;
uniform sampler2D uTex;
uniform vec4 uStorm;
uniform float uTurb;
uniform float uOval;
uniform float uSeed;
uniform float uRadius;
uniform vec2 uRingSpan;
uniform sampler2D uRingTex;
varying vec3 vObj;
varying vec3 vW;
varying vec3 vNW;
varying vec3 vCentre;
varying vec3 vAxis;
${COMMON}
${NOISE_GLSL}
void main() {
  vec3 p = nrm(vObj);
  vec3 N = nrm(vNW);
  vec3 V = nrm(cameraPosition - vW);
  vec3 L = nrm(uLight - vW);
  vec3 albedo = uBase;
  float limb = 0.0;
  float gloss = 0.0;
#if defined(GAS)
  float tt = uTime * 0.004;
  // the storm: the bands round it are turned, more toward its middle, so
  // they curl round it (only the turn is added, so outside it nothing moves)
  vec3 S = uStorm.xyz;
  vec3 east = nrm(cross(vec3(0.0, 1.0, 0.0), S));
  vec3 north = cross(S, east);
  vec3 d = p - S;
  vec2 st0 = vec2(dot(d, east), dot(d, north));
  vec2 st = st0 / uStorm.w * vec2(1.0, 1.9);
  float sd = length(st);
  float inStorm = (1.0 - smoothstep(0.55, 1.3, sd)) * step(0.0, dot(p, S));
  float twist = inStorm * inStorm * 3.2;
  float cs = cos(twist);
  float sn = sin(twist);
  vec2 sr = vec2(cs * st.x - sn * st.y, sn * st.x + cs * st.y) * uStorm.w / vec2(1.0, 1.9);
  vec3 q = p + east * (sr.x - st0.x) + north * (sr.y - st0.y);
  // each latitude's colour, pushed up and down by turbulence drawn out along the bands
  float n1 = snoise(vec3(q.x * 2.0, q.y * 8.0, q.z * 2.0) + vec3(uSeed, 0.0, tt));
  float n2 = snoise(vec3(q.x * 4.5, q.y * 30.0, q.z * 4.5) + vec3(tt * 2.0, uSeed, 0.0) + n1 * 0.5);
  float n3 = snoise(vec3(q.x * 11.0, q.y * 80.0, q.z * 11.0) - vec3(uSeed) + n2 * 0.3);
  float y = q.y + n1 * uTurb * 0.7 + n2 * uTurb * 0.45 + n3 * uTurb * 0.22;
  albedo = texture2D(uBands, vec2(0.5, sat(y * 0.5 + 0.5))).rgb;
  float grain = uTurb * 25.0;
  albedo *= 1.0 + (0.08 * n2 + 0.09 * n3) * grain;
  // a chain of small white ovals along one band, carried round with it
  float lon = atan(q.z, q.x + 1e-6) * 1.9099;
  float cellX = fract(lon) - 0.5;
  float oy = (q.y - uOval) / 0.024;
  float oval = (1.0 - smoothstep(0.5, 1.0, length(vec2(cellX * 5.5, oy * 1.15)))) * step(0.45, hash12(vec2(floor(lon), uSeed)));
  albedo = mix(albedo, vec3(0.93, 0.9, 0.84), oval * step(0.001, abs(uOval)) * 0.6);
  // the storm's own colour, an oval with a paler collar
  float core = inStorm * (1.0 - smoothstep(0.2, 0.85, sd));
  float collar = inStorm * smoothstep(0.6, 0.9, sd) * (1.0 - smoothstep(0.9, 1.25, sd));
  albedo = mix(albedo, uAccent * (0.8 + 0.35 * n2), core * 0.9);
  albedo = mix(albedo, mix(albedo, vec3(0.96, 0.9, 0.8), 0.6), collar * 0.75);
  limb = 0.45;
#ifdef ICE
  // haze over it all, thicker toward the edge, and high bright clouds
  albedo = mix(albedo, uBase, 0.28 + 0.4 * (1.0 - sat(dot(N, V))));
  float cloud = smoothstep(0.5, 0.85, n2 * 0.7 + n1 * 0.45) * (1.0 - smoothstep(0.08, 0.3, abs(q.y - S.y * 0.94)));
  albedo += vec3(0.55, 0.6, 0.64) * cloud * 0.55;
  limb = 0.3;
#endif
#elif defined(ROCK)
  vec4 tx = globe(uTex, p);
  float n1 = snoise(p * 2.6 + uSeed);
  float n2 = snoise(p * 9.0 - uSeed);
  albedo = uBase * (0.8 + 0.2 * n1 + 0.08 * n2) * mix(1.0, 0.62, tx.g) * (0.7 + 0.55 * tx.r);
  albedo = mix(albedo, uAccent, smoothstep(0.3, 0.8, n1) * 0.35);
  N = bumped(N, vW, tx.r * uRadius * 0.07);
  limb = 0.12;
#elif defined(OCEAN)
  float c1 = snoise(p * 1.6 + uSeed);
  float c2 = snoise(p * 4.4 - uSeed + c1 * 0.3);
  float c3 = snoise(p * 13.0 + uSeed * 2.0);
  float landN = c1 * 0.66 + c2 * 0.26 + c3 * 0.08;
  float land = smoothstep(0.12, 0.145, landN);
  float shallow = smoothstep(-0.04, 0.12, landN) * (1.0 - land);
  float ice = smoothstep(0.8, 0.9, abs(p.y) + c2 * 0.05);
  vec3 sea = mix(uBase * 0.3, uBase * 0.8, shallow);
  vec3 ground = mix(uAccent, uAccent * vec3(0.55, 0.75, 0.5), smoothstep(-0.4, 0.4, c2 + c3 * 0.4));
  ground *= 0.85 + 0.3 * smoothstep(0.15, 0.5, landN);
  albedo = mix(sea, ground, land);
  albedo = mix(albedo, vec3(0.88, 0.92, 0.96), ice);
  float cl = snoise(vec3(p.x * 3.2, p.y * 9.0, p.z * 3.2) + vec3(uTime * 0.008, uSeed, c2 * 0.4));
  float cloud = smoothstep(0.25, 0.85, cl * 0.62 + c3 * 0.25 + c1 * 0.2);
  albedo = mix(albedo, vec3(0.9), cloud * 0.8);
  gloss = (1.0 - land) * (1.0 - cloud) * (1.0 - ice) * 0.35;
  limb = 0.2;
#endif
  float ndl = dot(N, L);
  float mu = sat(dot(N, V));
  // a soft terminator, reddened as the light grazes it
  float wrap = smoothstep(-0.22, 0.32, ndl);
  float light = wrap * (0.16 + 0.84 * max(ndl, 0.0));
  vec3 tint = mix(uDusk, vec3(1.0), smoothstep(-0.05, 0.45, ndl));
  vec3 col = albedo * uLightColor * light * tint;
  col *= 1.0 - limb + limb * sqrt(mu);
  col += albedo * 0.0035;
  if (gloss > 0.0) {
    vec3 H = nrm(L + V);
    float sp = sat(dot(N, H));
    sp *= sp;
    sp *= sp;
    sp *= sp;
    sp *= sp;
    sp *= sp;
    col += uLightColor * sp * gloss * smoothstep(0.0, 0.2, ndl);
  }
#ifdef RING_SHADOW
  // the ring's shadow: where the way to the light crosses the ring's plane
  vec3 axis = nrm(vAxis);
  float facing = dot(L, axis);
  if (abs(facing) > 1e-3) {
    float tHit = -dot(vW - vCentre, axis) / facing;
    if (tHit > 0.0) {
      float rr = length(vW + L * tHit - vCentre) / uRadius;
      float u = (rr - uRingSpan.x) / (uRingSpan.y - uRingSpan.x);
      if (u > 0.0 && u < 1.0) col *= 1.0 - textureLod(uRingTex, vec2(u, 0.5), 0.0).a * 0.8;
    }
  }
#endif
  float rim = 1.0 - mu;
  rim = rim * rim * rim;
  col += uRim * rim * uRimStrength * smoothstep(-0.35, 0.55, ndl);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// the air round a planet: the back of a slightly bigger sphere, glowing by
// how close to the planet's edge each ray passes, on its lit side
const HALO_VERT = `
varying vec3 vW;
varying vec3 vCentre;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vCentre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const HALO_FRAG = `
uniform vec3 uColor;
uniform vec3 uLight;
uniform float uReach;
uniform float uRadius;
uniform float uStrength;
varying vec3 vW;
varying vec3 vCentre;
${COMMON}
void main() {
  vec3 ray = nrm(vW - cameraPosition);
  vec3 oc = vCentre - cameraPosition;
  float along = dot(oc, ray);
  float closest = along > 0.0 ? sqrt(max(dot(oc, oc) - along * along, 0.0)) : length(oc);
  float x = sat((closest / uRadius - 1.0) / (uReach - 1.0));
  vec3 at = along > 0.0 ? cameraPosition + ray * along : cameraPosition;
  float lit = 0.08 + 0.92 * smoothstep(-0.4, 0.5, dot(nrm(at - vCentre), nrm(uLight - vCentre)));
  float k = 1.0 - x;
  gl_FragColor = vec4(uColor * k * k * k * uStrength * lit, 1.0);
  #include <colorspace_fragment>
}`;

// a planet's ring, flat in its plane: ringlets from a profile, lit on its
// sunward face and glowing through its thin parts from behind, with the
// planet's shadow across it
const RING_VERT = `
varying vec3 vLocal;
varying vec3 vW;
varying vec3 vCentre;
varying vec3 vN;
void main() {
  vLocal = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vCentre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vN = mat3(modelMatrix) * vec3(0.0, 1.0, 0.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const RING_FRAG = `
uniform sampler2D uRing;
uniform vec3 uLight;
uniform vec3 uLightColor;
uniform float uInner;
uniform float uOuter;
uniform float uRadius;
uniform float uOpacity;
varying vec3 vLocal;
varying vec3 vW;
varying vec3 vCentre;
varying vec3 vN;
${COMMON}
void main() {
  float rho = length(vLocal.xz);
  float u = (rho - uInner) / (uOuter - uInner);
  if (u < 0.0 || u > 1.0) discard;
  vec4 band = texture2D(uRing, vec2(u, 0.5));
  vec3 P = vW - vCentre;
  vec3 L = nrm(uLight - vW);
  vec3 V = nrm(cameraPosition - vW);
  vec3 n = nrm(vN);
  // the planet's shadow: does the way to the light pass through it?
  float b = dot(P, L);
  float dc = sqrt(max(dot(P, P) - b * b, 0.0));
  float shadow = b < 0.0 ? smoothstep(uRadius * 0.98, uRadius * 1.04, dc) : 1.0;
  float sl = dot(n, L);
  float sv = dot(n, V);
  float sun = 0.3 + 0.7 * sqrt(abs(sl));
  // seen from its dark face, light comes through where it's thin
  float lit = sl * sv >= 0.0 ? 1.0 : 0.25 + 0.75 * (1.0 - band.a);
  vec3 col = band.rgb * uLightColor * sun * lit * (0.05 + 0.95 * shadow);
  gl_FragColor = vec4(col, band.a * uOpacity);
  #include <colorspace_fragment>
}`;

// ── Stars ──

const STAR_FRAG = `
uniform float uTime;
uniform vec3 uColor;
uniform float uSeed;
varying vec3 vObj;
varying vec3 vW;
varying vec3 vNW;
varying vec3 vCentre;
varying vec3 vAxis;
${COMMON}
${NOISE_GLSL}
void main() {
  vec3 p = nrm(vObj) * 2.4;
  float t = uTime * 0.05;
  float w = snoise(p * 0.9 + vec3(uSeed, t, 0.0));
  vec3 q = p + vec3(w, -w, w * 0.5) * 0.22;
  float cells = snoise(q * 3.0 + t * 1.3);
  // the granules, fine as rice: gone where they'd be smaller than a pixel
  float gran = snoise(q * 17.0 - t * 4.0) * (1.0 - smoothstep(0.35, 0.9, length(fwidth(q)) * 17.0));
  // granules: bright cells in its own colour with dark lanes between them,
  // kept near 1 so the colour survives the tone map close up, and hot spots
  // where it boils over (they bloom); darker and redder toward the edge
  float mu = sat(dot(nrm(vNW), nrm(cameraPosition - vW)));
  float heat = sat(0.2 + 0.4 * (0.5 + 0.5 * cells) + 0.45 * smoothstep(-0.45, 0.55, gran));
  vec3 lanes = uColor * vec3(0.8, 0.55, 0.5) * 0.4;
  // (a warm star's granules run toward yellow, a blue one's toward white)
  vec3 toward = mix(vec3(1.0, 0.97, 0.95), vec3(1.0, 0.75, 0.4), step(uColor.b, uColor.r));
  vec3 granules = mix(uColor, toward, 0.3) * 1.15;
  vec3 hot = mix(uColor, vec3(1.0, 0.95, 0.85), 0.6) * 2.6;
  vec3 col = mix(lanes, granules, heat);
  col = mix(col, hot, smoothstep(0.6, 1.05, cells + gran * 0.3) * 0.55);
  col *= 0.82 + 0.3 * (w * 0.5 + 0.5);
  col *= 0.45 + 0.55 * sqrt(mu);
  col *= mix(vec3(1.0, 0.62, 0.45), vec3(1.0), smoothstep(0.0, 0.55, mu));
  // from far off it burns brighter, so the whole disc blooms
  float far = smoothstep(120.0, 700.0, length(cameraPosition - vW));
  col *= 1.0 + 1.3 * far;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// the corona close in (streamers that slowly turn and change) and a wide
// glow, stronger from further off
const GLOW_FRAG = `
uniform float uTime;
uniform vec3 uColor;
uniform float uSeed;
uniform float uReach;
varying vec2 vC;
varying float vSil;
varying float vDist;
${COMMON}
${NOISE_GLSL}
void main() {
  float l = length(vC);
  float r = l / vSil;
  float d = max(r - 1.0, 0.0);
  float corona = 0.0;
  if (r > 0.9 && d < 3.0) {
    vec2 ring = vC / max(l, 1e-4);
    float rays = snoise(vec3(ring * 1.3, uTime * 0.04 + uSeed)) * 0.65 + snoise(vec3(ring * 3.2, uTime * 0.07 + uSeed + 3.0)) * 0.35;
    float inner = exp(-d * 7.0);
    float outer = exp(-d * (2.8 - 1.0 * sat(rays)));
    corona = inner * 1.15 + outer * (0.2 + 0.45 * smoothstep(-0.1, 0.8, rays));
    corona *= 1.0 - smoothstep(2.2, 3.0, d);
  }
  float far = smoothstep(150.0, 900.0, vDist);
  float halo = (0.05 + 0.16 * far) / (1.0 + d * d * (0.9 - 0.6 * far)) + exp(-d * 0.9) * 0.12;
  halo *= 1.0 - smoothstep(uReach * 0.55, uReach, r);
  vec3 white = mix(uColor, vec3(1.0, 0.94, 0.86), 0.5);
  vec3 col = mix(uColor, white, exp(-d * 6.0)) * corona * 1.9 + uColor * halo;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// ── The black hole ──

// the thin ring of light at the shadow's edge, and the far side of the disk
// bent round the shadow: over the top where the disk tips away, a fainter
// arc under the bottom, a whole ring when you look down on the disk; the
// side of the disk coming toward you brighter
const PHOTON_VERT = `
uniform float uR;
uniform vec3 uDiskN;
varying vec2 vC;
varying float vSil;
varying vec2 vUp;
varying vec2 vSide;
varying float vIncl;
vec3 nrm(vec3 v) { float l = length(v); return l > 1e-6 ? v / l : vec3(0.0, 1.0, 0.0); }
void main() {
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float d = length(mv.xyz);
  vSil = d > uR * 1.02 ? d / sqrt(d * d - uR * uR) : 5.0;
  vec3 n = nrm(mat3(modelViewMatrix) * uDiskN);
  vIncl = abs(n.z);
  float ln = length(n.xy);
  vUp = (ln > 1e-4 ? n.xy / ln : vec2(0.0, 1.0)) * (n.z >= 0.0 ? 1.0 : -1.0);
  vec3 m = cross(n, vec3(0.0, 0.0, 1.0));
  float lm = length(m);
  vec2 side = lm > 1e-4 ? m.xy / lm : vec2(1.0, 0.0);
  vSide = side * (cross(n, m).z > 0.0 ? 1.0 : -1.0);
  vC = position.xy / uR;
  mv.xy += position.xy;
  gl_Position = projectionMatrix * mv;
}`;
const PHOTON_FRAG = `
uniform float uTime;
uniform float uReach;
varying vec2 vC;
varying float vSil;
varying vec2 vUp;
varying vec2 vSide;
varying float vIncl;
${COMMON}
${NOISE_GLSL}
void main() {
  float l = length(vC);
  float r = l / vSil;
  if (r < 0.98) discard;
  vec2 dir = vC / max(l, 1e-4);
  float edgeOn = 1.0 - vIncl;
  float beam = 1.0 + 0.6 * dot(dir, vSide) * edgeOn;
  // the photon ring
  float pr = exp(-abs(r - 1.022) * 90.0) * 1.35 + exp(-max(r - 1.0, 0.0) * 18.0) * 0.12;
  // the bent image of the disk's far side
  float s = dot(dir, vUp);
  float top = mix(0.55, smoothstep(-0.3, 0.95, s), edgeOn);
  float bottom = mix(0.55, smoothstep(-0.3, 0.95, -s) * 0.5, edgeOn);
  float spread = 0.1 + 0.42 * edgeOn * max(s, 0.0) * max(s, 0.0) + 0.12 * vIncl;
  float arcT = smoothstep(1.04, 1.09, r) * (1.0 - smoothstep(1.08 + spread * 0.55, 1.1 + spread, r)) * top;
  float arcB = smoothstep(1.04, 1.08, r) * (1.0 - smoothstep(1.09, 1.16, r)) * bottom;
  // streaks round it, as the disk has
  float n = snoise(vec3(dir * 1.6, r * 16.0 - uTime * 0.3)) * 0.5 + 0.5;
  float arcs = (arcT + arcB) * (0.5 + 0.75 * n);
  vec3 hot = vec3(1.0, 0.86, 0.66);
  vec3 warm = vec3(1.0, 0.42, 0.13);
  vec3 col = mix(hot, warm, smoothstep(1.06, 1.5, r)) * arcs * 0.95 * beam * beam;
  col += vec3(1.0, 0.9, 0.76) * pr * (0.75 + 0.35 * beam);
  col *= 1.0 - smoothstep(uReach * 0.7, uReach, r);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const DISK_VERT = RING_VERT;
const DISK_FRAG = `
uniform float uTime;
uniform float uInner;
uniform float uOuter;
varying vec3 vLocal;
varying vec3 vW;
varying vec3 vCentre;
varying vec3 vN;
${COMMON}
${NOISE_GLSL}
vec2 turn(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}
float streaks(vec2 dir, float rho, float seed) {
  return snoise(vec3(dir * 1.7, rho * 0.11 + seed)) * 0.6 + snoise(vec3(dir * 4.5, rho * 0.42 + seed)) * 0.4;
}
void main() {
  vec2 p = vLocal.xz;
  float rho = length(p);
  float u = (rho - uInner) / (uOuter - uInner);
  if (u < 0.0 || u > 1.0) discard;
  vec2 dir = p / rho;
  // the inner parts go round faster (as the planets do round a sun); two
  // layers, each starting over before it winds up too tight, the one
  // fading in as the other fades out
  float omega = 0.22 * pow(uInner / rho, 1.5);
  float ph = uTime / 18.0;
  float fa = fract(ph);
  float fb = fract(ph + 0.5);
  float wa = 1.0 - abs(2.0 * fa - 1.0);
  float n = mix(streaks(turn(dir, omega * fb * 18.0), rho, 7.3), streaks(turn(dir, omega * fa * 18.0), rho, 0.0), wa);
  float heat = 1.0 - u;
  float h2 = heat * heat;
  vec3 col = mix(vec3(0.85, 0.16, 0.05), vec3(1.0, 0.5, 0.16), smoothstep(0.0, 0.45, heat));
  col = mix(col, vec3(1.0, 0.86, 0.66), smoothstep(0.5, 0.85, heat));
  col = mix(col, vec3(0.82, 0.9, 1.0), smoothstep(0.86, 1.0, heat));
  float bright = 0.05 + 0.3 * h2 + 0.65 * h2 * h2 * h2;
  float dens = 0.3 + 0.9 * smoothstep(-0.6, 0.7, n);
  // brighter, and bluer, where it comes toward you
  vec3 nd = nrm(vN);
  vec3 V = nrm(cameraPosition - vW);
  vec3 vel = nrm(cross(nd, vW - vCentre));
  float g = 1.0 + 0.45 * dot(vel, V);
  float beam = g * g;
  col = mix(col * vec3(1.15, 0.78, 0.6), col * vec3(0.82, 0.95, 1.2), smoothstep(0.6, 1.4, g));
  // thin, so brighter seen edge-on (more of it along the line of sight)
  float graze = min(1.0 / max(abs(dot(nd, V)), 0.15), 3.0);
  float edge = smoothstep(0.0, 0.035, u) * (1.0 - smoothstep(0.5, 1.0, u));
  gl_FragColor = vec4(col * bright * dens * beam * edge * mix(1.0, graze, 0.3), 1.0);
  #include <colorspace_fragment>
}`;

const JET_VERT = `
uniform float uBase;
uniform float uLen;
varying float vAlong;
varying vec3 vW;
varying vec3 vNW;
varying vec2 vXZ;
varying vec3 vCentre;
void main() {
  vAlong = (abs(position.y) - uBase) / uLen;
  vXZ = position.xz * sign(position.y);
  vCentre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vNW = mat3(modelMatrix) * normal;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const JET_FRAG = `
uniform float uTime;
uniform float uShadow;
varying float vAlong;
varying vec3 vW;
varying vec3 vNW;
varying vec2 vXZ;
varying vec3 vCentre;
${COMMON}
${NOISE_GLSL}
void main() {
  // kept off the shadow, wherever it lies across it (the shadow stays black)
  vec3 ray = nrm(vW - cameraPosition);
  vec3 oc = vCentre - cameraPosition;
  float along = dot(oc, ray);
  float miss = sqrt(max(dot(oc, oc) - along * along, 0.0));
  float clear = smoothstep(uShadow * 1.05, uShadow * 1.8, miss);
  float facing = abs(dot(nrm(vNW), nrm(cameraPosition - vW)));
  float core = facing * facing;
  float n = snoise(vec3(vXZ * 0.18, vAlong * 7.0 - uTime * 0.9)) * 0.5 + 0.5;
  float fade = (1.0 - smoothstep(0.05, 1.0, vAlong)) * smoothstep(0.0, 0.06, vAlong);
  vec3 col = mix(vec3(0.7, 0.85, 1.9), vec3(0.35, 0.3, 1.1), sat(vAlong * 1.4));
  gl_FragColor = vec4(col * core * fade * clear * (0.45 + 0.8 * n) * 0.04, 1.0);
  #include <colorspace_fragment>
}`;

// ── Nebulae ──

const PUFF_VERT = `
attribute vec3 aCentre;
attribute vec3 aTangent;
attribute vec4 aShape;
attribute vec4 aTint;
attribute vec4 aMask;
uniform float uTime;
varying vec2 vUv;
varying vec4 vTint;
varying vec4 vMask;
varying float vFade;
varying vec2 vShift;
void main() {
  vec4 c = modelMatrix * vec4(aCentre, 1.0);
  float size = aShape.x;
  float dist = length(c.xyz - cameraPosition);
  // gone as you come close to it, so flying through is never a wall
  float fade = smoothstep(size * 0.5, size * 1.6, dist);
  vFade = fade;
  vTint = aTint;
  vMask = aMask;
  vUv = uv;
  vShift = vec2(aShape.w, aShape.w * 1.37);
  if (fade < 0.003) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec4 mv = viewMatrix * c;
  // drawn out along its tangent as it lies on the screen
  vec3 tv = mat3(viewMatrix) * mat3(modelMatrix) * aTangent;
  float tl = length(tv.xy);
  float ang = (tl > 1e-4 ? atan(tv.y, tv.x) : 0.0) + aShape.w * 6.2832 + uTime * aShape.z;
  float stretch = mix(1.0, aShape.y, clamp(tl, 0.0, 1.0));
  vec2 q = position.xy * vec2(stretch, 1.0 / sqrt(stretch)) * size * 2.0;
  float cs = cos(ang);
  float sn = sin(ang);
  mv.xy += vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y);
  gl_Position = projectionMatrix * mv;
}`;
const PUFF_FRAG = `
uniform sampler2D uPuff;
varying vec2 vUv;
varying vec4 vTint;
varying vec4 vMask;
varying float vFade;
varying vec2 vShift;
void main() {
  float d = dot(texture2D(uPuff, vUv), vMask);
  float fine = texture2D(uPuff, vUv * 1.8 + vShift).a;
  d *= (0.5 + 0.95 * fine) * vFade;
  // glowing gas adds its light; dust (alpha) dims what's behind it
  gl_FragColor = vec4(vTint.rgb * d, vTint.a * d);
  #include <colorspace_fragment>
}`;

const SPARK_VERT = `
attribute vec3 aColor;
attribute float aSize;
uniform float uScale;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float px = aSize * uScale / max(-mv.z, 0.1);
  gl_PointSize = clamp(px, 2.0, 30.0);
  vColor = aColor;
  gl_Position = projectionMatrix * mv;
}`;
const SPARK_FRAG = `
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  float a = exp(-r2 * 30.0) * 1.6 + exp(-r2 * 5.0) * 0.35;
  a *= 1.0 - smoothstep(0.6, 1.0, r2);
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <colorspace_fragment>
}`;

// ── The Death Star ──

const CITADEL_VERT = `
attribute float aPart;
varying vec3 vObj;
varying vec3 vW;
varying vec3 vNW;
varying float vPart;
void main() {
  vObj = position;
  vPart = aPart;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vNW = mat3(modelMatrix) * normal;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
// The Citadel as the show draws it: bronze hulls, olive ribs, a city in
// pale greens under the glass, cyan light strips, purple running lights and
// blinking beacons. Parts (aPart): 0 hull, 1 ribs and trim, 2 beacons,
// 3 cyan strips, 4 the city's towers, 5 purple lights, 6 the crystal.
const CITADEL_FRAG = `
uniform vec3 uLight;
uniform vec3 uLightColor;
uniform float uTime;
varying vec3 vObj;
varying vec3 vW;
varying vec3 vNW;
varying float vPart;
${COMMON}
void main() {
  vec3 N = nrm(vNW);
  vec3 V = nrm(cameraPosition - vW);
  vec3 L = nrm(uLight - vW);
  vec3 p = vObj;
  float part = floor(vPart + 0.5);
  float ndl = dot(N, L);
  // the show's flat light: two steps and a dark side that isn't black
  float light = mix(0.32, 1.0, smoothstep(0.0, 0.25, ndl)) * mix(0.82, 1.0, smoothstep(0.45, 0.6, ndl));
  if (part > 5.5) {
    // the crystal under it all: cyan, brightest at its edges
    float f = pow(1.0 - abs(dot(N, V)), 2.0);
    gl_FragColor = vec4(vec3(0.25, 0.95, 1.0) * (0.9 + f * 1.8 + 0.25 * sin(p.y * 1.4 - uTime * 2.0)), 1.0);
    #include <colorspace_fragment>
    return;
  }
  if (part > 4.5) {
    gl_FragColor = vec4(vec3(0.85, 0.45, 1.6) * (0.8 + 0.4 * sin(uTime * 3.0 + p.x)), 1.0);
    #include <colorspace_fragment>
    return;
  }
  if (part > 2.5 && part < 3.5) {
    float run = 0.75 + 0.25 * sin(p.y * 2.2 + p.x * 0.7 - uTime * 2.4);
    gl_FragColor = vec4(vec3(0.3, 1.0, 0.95) * 1.7 * run, 1.0);
    #include <colorspace_fragment>
    return;
  }
  if (part > 1.5 && part < 2.5) {
    // the beacons, blinking each on its own beat
    float beat = hash12(floor(p.xz * 3.0) + 0.5);
    float on = step(0.72, fract(uTime * 0.7 + beat));
    gl_FragColor = vec4(mix(vec3(0.5, 0.06, 0.04), vec3(4.0, 0.55, 0.35), on), 1.0);
    #include <colorspace_fragment>
    return;
  }
  vec3 albedo;
  vec3 glow = vec3(0.0);
  if (part > 3.5) {
    // a tower of the city: pale green, yellow-green or teal, rows of windows
    float id = hash12(floor(p.xz * 1.3) + 7.0);
    albedo = mix(vec3(0.68, 0.82, 0.55), vec3(0.5, 0.74, 0.7), step(0.55, id));
    albedo = mix(albedo, vec3(0.86, 0.84, 0.5), step(0.85, id));
    vec2 wc = vec2((p.x + p.z) * 5.0, p.y * 6.0);
    vec2 wf = fract(wc);
    float tiny = smoothstep(0.3, 0.8, max(fwidth(wc).x, fwidth(wc).y));
    float win = mix(step(0.25, wf.x) * step(wf.x, 0.75) * step(0.3, wf.y) * step(wf.y, 0.7) * step(0.45, hash12(floor(wc) + 3.0)), 0.25, tiny);
    glow = mix(vec3(1.0, 0.85, 0.5), vec3(0.5, 1.0, 0.9), step(0.6, hash12(floor(wc)))) * win * 0.9 * (1.0 - step(0.6, abs(N.y)));
  } else if (part > 0.5) {
    albedo = vec3(0.46, 0.4, 0.2);
  } else {
    // bronze plating, a tone a panel, dark seams between
    vec3 q = p * vec3(0.9, 1.6, 0.9);
    vec3 cell = floor(q);
    vec3 f = fract(q);
    vec3 w = fwidth(q);
    float seam = 1.0 - smoothstep(0.0, 1.5, min(min(min(f.x, 1.0 - f.x) / max(w.x, 1e-4), min(f.y, 1.0 - f.y) / max(w.y, 1e-4)), min(f.z, 1.0 - f.z) / max(w.z, 1e-4)));
    seam *= 1.0 - smoothstep(0.3, 0.6, max(w.x, max(w.y, w.z)));
    float tone = 0.86 + 0.18 * hash12(cell.xz + cell.y * 3.1);
    albedo = mix(vec3(0.66, 0.5, 0.28), vec3(0.55, 0.47, 0.3), step(0.6, hash12(cell.yz + 1.3))) * tone * (1.0 - 0.35 * seam);
    // small windows, lit
    vec2 wc = vec2(atan(p.z, p.x + 1e-6) * length(p.xz) / 0.4, p.y / 0.5);
    vec2 wf = fract(wc);
    float tiny = smoothstep(0.25, 0.65, max(fwidth(wc).x, fwidth(wc).y));
    float win = mix(step(0.3, wf.x) * step(wf.x, 0.7) * step(0.35, wf.y) * step(wf.y, 0.65) * step(0.62, hash12(floor(wc) + 11.0)), 0.12, tiny) * (1.0 - step(0.7, abs(N.y)));
    glow = mix(vec3(1.0, 0.82, 0.5), vec3(0.45, 1.0, 0.95), step(0.6, hash12(floor(wc) + 4.0))) * win * 1.2;
  }
  vec3 col = albedo * uLightColor * light * 0.62 + albedo * vec3(0.05, 0.045, 0.035) + glow;
  // a warm rim where it turns from the light
  col += vec3(1.0, 0.7, 0.35) * pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.18 * step(0.0, ndl);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
// the domes' glass: yellow-green, clear face on, bright at the edges, with
// the home sun's glint
const CITADEL_GLASS_FRAG = `
uniform vec3 uLight;
uniform vec3 uLightColor;
uniform float uTime;
varying vec3 vObj;
varying vec3 vW;
varying vec3 vNW;
varying float vPart;
${COMMON}
void main() {
  vec3 N = nrm(vNW);
  vec3 V = nrm(cameraPosition - vW);
  vec3 L = nrm(uLight - vW);
  float f = pow(1.0 - abs(dot(N, V)), 2.2);
  vec3 H = nrm(L + V);
  float sp = pow(sat(dot(N, H)), 60.0);
  // the dome's panes: a faint diamond lattice
  vec2 g = vec2(atan(vObj.z, vObj.x) * 9.0, vObj.y * 2.2);
  vec2 gf = abs(fract(g) - 0.5);
  float lattice = (1.0 - smoothstep(0.0, 0.06, min(gf.x, gf.y))) * (1.0 - smoothstep(0.3, 0.8, max(fwidth(g).x, fwidth(g).y)));
  // lit like the rest: the side to the sun glows yellow-green, the far side
  // stays dim, so the city reads through it
  float lit = mix(0.25, 1.0, smoothstep(-0.1, 0.4, dot(N, L)));
  vec3 tint = vec3(0.8, 0.92, 0.4);
  float a = 0.3 + f * 0.5 + lattice * 0.2;
  vec3 col = tint * (0.3 + f * 0.9) * lit * a + uLightColor * sp * 0.6;
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

const PORTAL_FRAG = `
uniform float uTime;
varying vec2 vUv;
${SWIRL_GLSL}
void main() {
  vec2 o = (vUv * 2.0 - 1.0) * 1.35 + vec2(1.3e-5, 0.7e-5);
  vec4 c = portal(o, uTime, 1.0, 3.7);
  gl_FragColor = vec4(c.rgb * 1.7, c.a);
  #include <colorspace_fragment>
}`;

// ── The names ──

const LABEL_VERT = `
attribute vec3 aAt;
attribute float aRow;
attribute float aAlpha;
uniform float uSize;
uniform float uRatio;
uniform float uRows;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  vUv = vec2(uv.x, 1.0 - (aRow + 1.0 - uv.y) / uRows);
  if (aAlpha < 0.003) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(aAt, 1.0);
  float aspect = projectionMatrix[0][0] / projectionMatrix[1][1];
  clip.xy += vec2(position.x * uSize * uRatio * aspect, position.y * uSize) * clip.w;
  gl_Position = clip;
}`;
const LABEL_FRAG = `
uniform sampler2D uMap;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec4 c = texture2D(uMap, vUv);
  gl_FragColor = vec4(c.rgb, c.a * vAlpha);
  #include <colorspace_fragment>
}`;

// ── Background galaxies ──

const SKY_VERT = `
attribute vec3 color;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  vUv = uv;
  vColor = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAG = `
uniform sampler2D uMap;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  vec4 c = texture2D(uMap, vUv);
  gl_FragColor = vec4(c.rgb * c.a * vColor, 1.0);
  #include <colorspace_fragment>
}`;

// ── Small painted textures ──

// value noise on a lattice that wraps every `p` cells (p a power of two ≤
// 256), so a texture made of it can tile
function valueNoise(seed) {
  const rand = rng(`noise-${seed}`);
  const G = new Float32Array(256 * 256);
  for (let i = 0; i < G.length; i++) G[i] = rand();
  return (x, y, p = 256) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % p) + p) % p;
    const y0 = ((yi % p) + p) % p;
    const x1 = (x0 + 1) % p;
    const y1 = (y0 + 1) % p;
    const a = G[y0 * 256 + x0];
    const b = G[y0 * 256 + x1];
    const c = G[y1 * 256 + x0];
    const d = G[y1 * 256 + x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbm(n, x, y, octaves, p = 256) {
  let s = 0;
  let amp = 0.5;
  let f = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    s += amp * n(x * f, y * f, min(256, p * f));
    total += amp;
    amp *= 0.5;
    f *= 2;
  }
  return s / total;
}
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function dataTexture(data, w, h, { colour = false, repeat = false, mips = true } = {}) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.generateMipmaps = mips;
  t.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// A gas giant's colour by latitude (south pole at the bottom): belts and
// zones of random widths from its palette, finer bands within them, greyer
// and darker toward the poles.
function bandTexture(colors, seed, { n = 512, soft = 0 } = {}) {
  const rand = rng(`bands-${seed}`);
  const pal = colors.map((c) => new THREE.Color(c).convertLinearToSRGB());
  const rows = [];
  let y = 0;
  let k = 0;
  while (y < n) {
    const w = Math.max(3, Math.round(n * (0.006 + rand() ** 1.6 * 0.045)));
    const a = pal[k % pal.length];
    const b = pal[Math.floor(rand() * pal.length)];
    const c = a.clone().lerp(b, rand() * 0.35).multiplyScalar(0.92 + rand() * 0.16);
    for (let i = 0; i < w && y < n; i++, y++) rows.push(c);
    k += 1 + Math.floor(rand() * 2);
  }
  // smooth the edges between bands (more for a soft, hazy world), and fine streaks
  const blur = 5 + soft;
  const out = new Uint8Array(n * 4);
  const noise = valueNoise(seed.length * 31);
  const polar = pal[pal.length - 1].clone().lerp(new THREE.Color(0.45, 0.47, 0.5), 0.5);
  for (let i = 0; i < n; i++) {
    const acc = new THREE.Color(0, 0, 0);
    let wsum = 0;
    for (let j = -blur; j <= blur; j++) {
      const r = rows[Math.min(n - 1, Math.max(0, i + j))];
      const wt = 1 - Math.abs(j) / (blur + 1);
      acc.r += r.r * wt;
      acc.g += r.g * wt;
      acc.b += r.b * wt;
      wsum += wt;
    }
    acc.multiplyScalar(1 / wsum);
    const lat = (i / (n - 1)) * 2 - 1;
    acc.multiplyScalar(0.93 + 0.14 * fbm(noise, i * 0.09, 3.7, 3) * (soft ? 0.5 : 1));
    acc.lerp(polar, smooth(0.72, 0.97, Math.abs(lat)) * 0.6);
    out.set([Math.min(255, acc.r * 255), Math.min(255, acc.g * 255), Math.min(255, acc.b * 255), 255], i * 4);
  }
  return dataTexture(out, 1, n, { colour: true });
}

// A ring's ringlets, inside to out: colour, and how thick it is (alpha):
// dozens of narrow ringlets, a faint inner ring, a wide dark gap and a thin
// one, faded at both edges.
function ringTexture(colors, seed, { n = 512, faint = false } = {}) {
  const rand = rng(`ring-${seed}`);
  const pal = colors.map((c) => new THREE.Color(c).convertLinearToSRGB());
  const dens = new Float32Array(n).fill(faint ? 0.04 : 0.62);
  const bump = (c, w, a) => {
    for (let i = 0; i < n; i++) {
      const d = (i / (n - 1) - c) / w;
      dens[i] += a * Math.exp(-d * d);
    }
  };
  if (faint) {
    bump(0.28, 0.025, 0.4);
    bump(0.78, 0.012, 0.55);
    bump(0.5, 0.15, 0.06);
  } else {
    for (let i = 0; i < 70; i++) bump(rand(), 0.002 + rand() ** 2 * 0.03, (rand() - 0.45) * 0.5);
  }
  const out = new Uint8Array(n * 4);
  const noise = valueNoise(seed.length * 7 + 3);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    let d = dens[i];
    if (!faint) {
      d *= 0.35 + 0.65 * smooth(0.12, 0.24, u); // the faint inner ring
      d *= 1 - 0.93 * (smooth(0.6, 0.615, u) - smooth(0.66, 0.675, u)); // the wide gap
      d *= 1 - 0.85 * (smooth(0.86, 0.865, u) - smooth(0.873, 0.878, u)); // the thin one
      d *= 0.85 + 0.3 * fbm(noise, u * 90, 1.3, 2);
    }
    d *= smooth(0, 0.03, u) * (1 - smooth(0.95, 1, u));
    const t = fbm(noise, u * 6, 7.1, 3);
    const c = pal[0].clone().lerp(pal[1 % pal.length], smooth(0.3, 0.7, t)).lerp(pal[2 % pal.length], smooth(0.55, 0.9, d) * 0.5);
    c.multiplyScalar(0.75 + 0.35 * min(1, d));
    out.set([min(255, c.r * 255), min(255, c.g * 255), min(255, c.b * 255), min(255, max(0, d) * 255)], i * 4);
  }
  return dataTexture(out, n, 1, { colour: true });
}

// A rocky world's height (r: craters pressed in, rims raised round them)
// and its darker plains (g), equirectangular.
function craterTexture(w, h, seed) {
  const rand = rng(`craters-${seed}`);
  const noise = valueNoise(seed.length * 13);
  const H = new Float32Array(w * h);
  const M = new Float32Array(w * h);
  const cosLat = new Float32Array(h);
  const sinLat = new Float32Array(h);
  const cosLon = new Float32Array(w);
  const sinLon = new Float32Array(w);
  for (let j = 0; j < h; j++) {
    const lat = ((j + 0.5) / h - 0.5) * PI;
    cosLat[j] = cos(lat);
    sinLat[j] = sin(lat);
  }
  for (let i = 0; i < w; i++) {
    const lon = ((i + 0.5) / w - 0.5) * TAU;
    cosLon[i] = cos(lon);
    sinLon[i] = sin(lon);
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = (i / w) * 8;
      const y = (j / h) * 4;
      H[j * w + i] = 0.5 + (fbm(noise, x, y, 5, 8) - 0.5) * 0.35;
      M[j * w + i] = smooth(0.52, 0.66, fbm(noise, x * 0.5 + 40, y * 0.5 + 40, 4, 4));
    }
  }
  const count = Math.round((w * h) / 520);
  for (let k = 0; k < count; k++) {
    const rho = 0.012 + 0.13 * rand() ** 5;
    const latC = Math.asin(rand() * 2 - 1);
    const lonC = (rand() - 0.5) * TAU;
    const cl = cos(latC);
    const sl = sin(latC);
    const co = cos(lonC);
    const so = sin(lonC);
    const depth = 0.22 * (rho / 0.13) ** 0.3;
    const j0 = Math.max(0, Math.floor(((latC - rho * 1.7) / PI + 0.5) * h));
    const j1 = Math.min(h - 1, Math.ceil(((latC + rho * 1.7) / PI + 0.5) * h));
    for (let j = j0; j <= j1; j++) {
      const span = Math.min(w / 2, Math.ceil(((rho * 1.7) / Math.max(cosLat[j], 0.05) / TAU) * w) + 1);
      const ic = Math.round(((lonC / TAU + 0.5) * w) - 0.5);
      for (let di = -span; di <= span; di++) {
        const i = (((ic + di) % w) + w) % w;
        const cd = cosLat[j] * cl * (cosLon[i] * co + sinLon[i] * so) + sinLat[j] * sl;
        const d = Math.acos(Math.min(1, Math.max(-1, cd))) / rho;
        if (d > 1.7) continue;
        const bowl = d < 1 ? -(1 - d * d) * depth : 0;
        const rim = Math.exp(-(((d - 1) / 0.2) ** 2)) * depth * 0.55;
        H[j * w + i] += bowl + rim;
      }
    }
  }
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) out.set([Math.min(255, Math.max(0, H[i] * 255)), M[i] * 255, 0, 255], i * 4);
  return dataTexture(out, w, h, { repeat: true });
}

// The nebulae's puffs: r and g two billowy clouds, b a wisp (streaky along
// x, for the filaments), a a tiling fine texture to break them up.
function puffTexture(n) {
  const noise = valueNoise(1977);
  const out = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * 2 - 1;
      const y = ((j + 0.5) / n) * 2 - 1;
      const r = hypot(x, y);
      const wx = fbm(noise, x * 1.5 + 11.3, y * 1.5 + 2.1, 3) - 0.5;
      const wy = fbm(noise, x * 1.5 + 5.7, y * 1.5 + 8.4, 3) - 0.5;
      // nothing reaches the quad's edge: everything is gone by the inscribed circle
      const rim = 1 - smooth(0.62, 0.97, r);
      const cloud = (off) => {
        const v = fbm(noise, (x + wx * 0.7) * 2.3 + off, (y + wy * 0.7) * 2.3 + off * 0.7, 5);
        const edge = 1 - smooth(0.15, 0.95, r + (v - 0.5) * 0.9);
        const d = Math.max(0, (v - 0.3) * 2.6) * edge * rim;
        return Math.min(1, d ** 1.2);
      };
      // a few thin filaments, curving, along x
      const ridge = 1 - Math.abs(2 * fbm(noise, x * 0.9 + 31, (y + wx * 0.9) * 2.1 + 17, 4) - 1);
      const along = 1 - smooth(0.3, 0.95, Math.abs(x) + wy * 0.3);
      const wisp = Math.min(1, (ridge ** 6 * 1.3 + 0.22 * cloud(61)) * along * (1 - smooth(0.45, 0.9, Math.abs(y))) * rim);
      const fine = fbm(noise, (i / n) * 16, (j / n) * 16, 4, 16);
      out.set([cloud(0) * 255, cloud(23.7) * 255, wisp * 255, Math.max(0, Math.min(255, fine * 1.4 * 255 - 50))], (j * n + i) * 4);
    }
  }
  return dataTexture(out, n, n, { repeat: true });
}

// The Death Star's plating, equirectangular: storeys of city blocks (r: how
// light each is), their lit windows (g), how high each stands (b).
function galaxyAtlas(size) {
  const rand = rng('galaxies');
  return canvasTexture(size, size, (g, W) => {
    const S = W / 2;
    g.globalCompositeOperation = 'lighter';
    const dot = (x, y, r, style) => {
      g.fillStyle = style;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    };
    const glow = (cx, cy, R, stops, sx = 1, sy = 1) => {
      g.save();
      g.translate(cx, cy);
      g.scale(sx, sy);
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, R);
      for (const [at, c] of stops) grd.addColorStop(at, c);
      g.fillStyle = grd;
      g.fillRect(-R, -R, 2 * R, 2 * R);
      g.restore();
    };
    const spiral = (cx, cy, R, arms, twist, scatter, n) => {
      glow(cx, cy, R, [
        [0, 'rgba(255,236,205,0.95)'],
        [0.1, 'rgba(255,214,170,0.5)'],
        [0.35, 'rgba(150,170,255,0.12)'],
        [1, 'rgba(110,130,255,0)'],
      ]);
      for (let i = 0; i < n; i++) {
        const k = i % arms;
        const t = rand() ** 0.75;
        const a = (k / arms) * TAU + t * twist;
        const rr = R * (0.06 + 0.88 * t);
        const sc = R * scatter * (0.3 + t);
        const x = cx + cos(a) * rr + (rand() + rand() - 1) * sc;
        const y = cy + sin(a) * rr + (rand() + rand() - 1) * sc;
        const pink = rand() < 0.05;
        const b = 0.08 + rand() * 0.28;
        dot(x, y, (0.6 + rand() * 1.6) * (S / 256), pink ? `rgba(255,130,180,${b + 0.15})` : `rgba(${170 + rand() * 60},${195 + rand() * 40},255,${b})`);
      }
    };
    // a grand two-armed spiral
    spiral(S * 0.5, S * 0.5, S * 0.44, 2, 7.5, 0.07, 2600);
    // a ragged, many-armed one
    spiral(S * 1.5, S * 0.5, S * 0.42, 4, 4.5, 0.13, 2400);
    // edge-on: a bright bulge, a thin disc, dust across the middle
    glow(S * 0.5, S * 1.5, S * 0.44, [[0, 'rgba(255,232,200,0.9)'], [0.2, 'rgba(240,215,190,0.35)'], [1, 'rgba(200,190,255,0)']], 1, 0.16);
    glow(S * 0.5, S * 1.5, S * 0.14, [[0, 'rgba(255,230,190,0.9)'], [1, 'rgba(255,220,180,0)']], 1, 0.6);
    g.globalCompositeOperation = 'destination-out';
    glow(S * 0.5, S * 1.5, S * 0.4, [[0, 'rgba(0,0,0,0.75)'], [0.8, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']], 1, 0.02);
    g.globalCompositeOperation = 'lighter';
    // a globular cluster
    glow(S * 1.5, S * 1.5, S * 0.3, [[0, 'rgba(255,240,215,0.7)'], [0.3, 'rgba(255,225,190,0.18)'], [1, 'rgba(255,220,180,0)']]);
    for (let i = 0; i < 1600; i++) {
      const rr = S * 0.4 * (rand() * rand()) ** 0.9;
      const a = rand() * TAU;
      dot(S * 1.5 + cos(a) * rr, S * 1.5 + sin(a) * rr, (0.5 + rand() * 1.1) * (S / 256), `rgba(255,${225 + rand() * 30},${190 + rand() * 50},${0.15 + rand() * 0.4})`);
    }
  });
}

// The names, one row each: the name in spaced capitals, a thin line, and
// what it is.
function labelAtlas(list) {
  const font = '"Archivo Variable", "Archivo", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  return canvasTexture(LABEL_W, LABEL_RH * list.length, (g, w) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    list.forEach(({ name, sub, color }, k) => {
      const y = k * LABEL_RH;
      const cx = w / 2;
      g.shadowColor = 'rgba(0, 0, 0, 0.85)';
      g.shadowBlur = 10;
      g.fillStyle = '#f4f7ff';
      g.font = `600 50px ${font}`;
      if ('letterSpacing' in g) g.letterSpacing = '16px';
      const title = name.toUpperCase();
      g.fillText(title, cx + 8, y + 40);
      const tw = g.measureText(title).width;
      g.shadowBlur = 4;
      const half = Math.min(w * 0.45, tw / 2 + 30);
      const line = g.createLinearGradient(cx - half, 0, cx + half, 0);
      line.addColorStop(0, 'rgba(255,255,255,0)');
      line.addColorStop(0.2, color);
      line.addColorStop(0.8, color);
      line.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = line;
      g.fillRect(cx - half, y + 74, half * 2, 2);
      g.fillStyle = 'rgba(214, 224, 245, 0.82)';
      g.font = `500 21px ${font}`;
      if ('letterSpacing' in g) g.letterSpacing = '7px';
      g.fillText(sub.toUpperCase(), cx + 3.5, y + 101);
    });
  });
}

// ── Building ──

export function buildDeepSpace({ small = false } = {}) {
  const group = new THREE.Group();
  group.name = 'deep-space';
  const owned = []; // geometries, materials and textures to free
  const own = (x) => {
    owned.push(x);
    return x;
  };
  const ticks = []; // per-frame work: (t, dt, cam) => void
  const uTime = { value: 0 };
  const homeW = { value: new THREE.Vector3() }; // the home sun, in world space
  const lightOf = new Map(); // a wonder's id → its star's world position, for its planets
  const mesh = (geo, mat, parent, order = 0) => {
    const m = new THREE.Mesh(own(geo), own(mat));
    m.renderOrder = order;
    parent.add(m);
    return m;
  };
  const shader = (vert, frag, uniforms, opts = {}) => new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: { uTime, ...uniforms }, ...opts });
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
  const premultiplied = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation };
  const seg = (big, low) => (small ? low : big);
  // a storm: where it is on the planet (a direction) and how big (radians, about)
  const storm = (x, y, z, size) => {
    const d = new THREE.Vector3(x, y, z).normalize();
    return new THREE.Vector4(d.x, d.y, d.z, size);
  };

  // the planets' material: GAS/ICE/ROCK/OCEAN, lit from `light`
  const world = (kind, { light, lightColor = HOME_LIGHT, radius, ...u }) =>
    shader(
      WORLD_VERT,
      WORLD_FRAG,
      {
        uLight: light,
        uLightColor: { value: lightColor },
        uRim: { value: new THREE.Color(u.rim ?? '#9fc4ff') },
        uRimStrength: { value: u.rimStrength ?? 0.6 },
        uDusk: { value: new THREE.Color(u.dusk ?? '#ff9a6a') },
        uBase: { value: new THREE.Color(u.base ?? '#888888') },
        uAccent: { value: new THREE.Color(u.accent ?? '#aa6644') },
        uBands: { value: u.bands ?? null },
        uTex: { value: u.tex ?? null },
        uStorm: { value: u.storm ?? new THREE.Vector4(0, 0, 1, 0.01) },
        uTurb: { value: u.turb ?? 0.05 },
        uOval: { value: u.oval ?? 0 },
        uSeed: { value: u.seed ?? 0 },
        uRadius: { value: radius },
        uRingSpan: { value: new THREE.Vector2(...(u.ringSpan ?? [2, 3])) },
        uRingTex: { value: u.ringTex ?? null },
      },
      { defines: { [kind]: '', ...(kind === 'ICE' ? { GAS: '' } : {}), ...(u.ringTex ? { RING_SHADOW: '' } : {}) } },
    );
  const halo = (parent, radius, color, light, { reach = 1.1, strength = 0.9 } = {}) => {
    const mat = shader(HALO_VERT, HALO_FRAG, { uColor: { value: new THREE.Color(color) }, uLight: light, uReach: { value: reach }, uRadius: { value: radius }, uStrength: { value: strength } }, { ...additive, side: THREE.BackSide });
    return mesh(new THREE.SphereGeometry(radius * reach, seg(80, 48), seg(48, 28)), mat, parent, 2);
  };
  const ring = (parent, radius, [inner, outer], tex, light, opacity = 1) => {
    const geo = new THREE.RingGeometry(radius * inner, radius * outer, seg(192, 112), 1).rotateX(-PI / 2);
    const mat = shader(RING_VERT, RING_FRAG, { uRing: { value: tex }, uLight: light, uLightColor: { value: HOME_LIGHT }, uInner: { value: radius * inner }, uOuter: { value: radius * outer }, uRadius: { value: radius }, uOpacity: { value: opacity } }, { transparent: true, depthWrite: false, side: THREE.DoubleSide });
    return mesh(geo, mat, parent, 3);
  };
  const facingQuad = (size, frag, uniforms, parent, opts = additive, order = 1) => {
    const m = mesh(new THREE.PlaneGeometry(size * 2, size * 2), shader(BILLBOARD_VERT, frag, uniforms, opts), parent, order);
    return m;
  };

  const wonderGroups = {};
  const place = (w) => {
    const g = new THREE.Group();
    g.name = `deep-${w.id}`;
    g.userData.wonder = w.id;
    g.position.set(...w.at);
    group.add(g);
    wonderGroups[w.id] = g;
    return g;
  };

  // ── the giants ──
  const giant = (w) => {
    const g = place(w);
    const ice = w.kind === 'ice-giant';
    const tilt = new THREE.Group();
    tilt.rotation.set(ice ? -0.32 : 0.36, 0, ice ? 0.2 : -0.24);
    g.add(tilt);
    const ringSpan = ice ? [1.55, 1.92] : [1.3, 2.25];
    const ringTex = own(ringTexture(ice ? ['#c8e6f5', '#8fb8d6', '#ffffff'] : [w.colors[2], w.colors[0], w.colors[1]], w.id, { faint: ice }));
    const bands = own(bandTexture(w.colors, w.id, { soft: ice ? 6 : 0 }));
    const mat = world(ice ? 'ICE' : 'GAS', {
      light: homeW,
      radius: w.r,
      bands,
      base: ice ? '#b6e2f6' : w.colors[0],
      accent: ice ? '#1d4f8c' : '#d2583a',
      rim: ice ? '#9fe3ff' : '#ffe2b8',
      rimStrength: ice ? 0.6 : 0.3,
      dusk: ice ? '#9ab8ff' : '#ff8a55',
      storm: ice ? storm(0.62, -0.42, 0.66, 0.13) : storm(0.55, 0.34, 0.75, 0.15),
      turb: ice ? 0.016 : 0.04,
      oval: ice ? 0 : 0.56,
      seed: ice ? 3.1 : 7.7,
      ringTex: ice ? null : ringTex,
      ringSpan,
    });
    const body = mesh(new THREE.SphereGeometry(w.r, seg(128, 72), seg(96, 48)), mat, tilt);
    halo(tilt, w.r, ice ? '#7fd8ff' : '#ffd3a0', homeW, { reach: ice ? 1.07 : 1.045, strength: ice ? 0.75 : 0.42 });
    ring(tilt, w.r, ringSpan, ringTex, homeW, ice ? 0.6 : 0.95);
    // turned so the storm starts on the side toward home, just round the morning edge
    const home = new THREE.Vector3(...w.at).negate().applyQuaternion(new THREE.Quaternion().setFromEuler(tilt.rotation).invert());
    const s = mat.uniforms.uStorm.value;
    const phase = Math.atan2(home.x, home.z) - Math.atan2(s.x, s.z) - 0.5;
    const spin = ice ? 0.01 : 0.007;
    ticks.push((t) => (body.rotation.y = phase + t * spin));
  };

  // ── the suns and their worlds ──
  const rockTex = own(craterTexture(seg(512, 256), seg(256, 128), 'rock'));
  const sun = (w) => {
    const g = place(w);
    const color = new THREE.Color(w.color);
    const light = { value: new THREE.Vector3() };
    lightOf.set(w.id, light);
    const surface = mesh(new THREE.SphereGeometry(w.r, seg(96, 56), seg(64, 36)), shader(WORLD_VERT, STAR_FRAG, { uColor: { value: color }, uSeed: { value: w.r * 0.37 } }), g);
    const reach = 13;
    facingQuad(w.r * reach, GLOW_FRAG, { uR: { value: w.r }, uColor: { value: color }, uSeed: { value: w.r }, uReach: { value: reach } }, g);
    // the light it gives its planets: its colour, toward white
    const lightColor = color.clone().lerp(new THREE.Color(1, 1, 1), 0.55).multiplyScalar(1.6);
    w.planets.forEach((pl, i) => {
      const at = planetAt(w, pl);
      const holder = new THREE.Group();
      holder.position.set(at[0] - w.at[0], at[1] - w.at[1], at[2] - w.at[2]);
      holder.rotation.set(0.25 * (i ? -1 : 1), 0, 0.15);
      g.add(holder);
      const base = new THREE.Color(pl.color);
      const kind = pl.kind === 'rock' ? 'ROCK' : pl.kind === 'ocean' ? 'OCEAN' : 'GAS';
      const look = {
        ROCK: { base: pl.color, accent: `#${base.clone().multiplyScalar(0.7).getHexString()}`, tex: rockTex, rim: '#d8c8b8', rimStrength: 0.12 },
        OCEAN: { base: pl.color, accent: '#9a8458', rim: '#8cc8ff', rimStrength: 0.85 },
        GAS: { bands: own(bandTexture([pl.color, `#${base.clone().multiplyScalar(0.62).getHexString()}`, `#${base.clone().lerp(new THREE.Color(1, 1, 1), 0.45).getHexString()}`], `${w.id}-${i}`)), accent: `#${base.clone().lerp(new THREE.Color(1, 1, 1), 0.6).getHexString()}`, rim: pl.color, rimStrength: 0.7, storm: storm(0.7, 0.3, 0.65, 0.12), turb: 0.06 },
      }[kind];
      const body = mesh(new THREE.SphereGeometry(pl.r, seg(72, 44), seg(48, 28)), world(kind, { light, lightColor, radius: pl.r, seed: i * 5.3 + w.r, dusk: '#ff8f66', ...look }), holder);
      const spin = 0.02 + i * 0.012;
      ticks.push((t) => (body.rotation.y = t * spin + i));
    });
    ticks.push((t) => (surface.rotation.y = t * 0.025));
  };

  // ── the black hole ──
  const maw = WONDERS.find((w) => w.kind === 'black-hole');
  const lensAt = { at: new THREE.Vector3(...(maw?.at ?? [0, 0, 0])), r: maw?.r ?? 0 };
  const blackHole = (w) => {
    const g = place(w);
    const tilt = new THREE.Group();
    tilt.rotation.set(...TILT); // (maw.js: its pull goes round the way the disk does)
    g.add(tilt);
    mesh(new THREE.SphereGeometry(w.r, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }), g);
    const reach = 2.6;
    const diskN = new THREE.Vector3(0, 1, 0).applyEuler(tilt.rotation);
    mesh(new THREE.PlaneGeometry(w.r * reach * 2, w.r * reach * 2), shader(PHOTON_VERT, PHOTON_FRAG, { uR: { value: w.r }, uDiskN: { value: diskN }, uReach: { value: reach } }, additive), g, 2);
    const inner = w.r * 1.6;
    mesh(new THREE.RingGeometry(inner, w.disk, seg(192, 112), 1).rotateX(-PI / 2), shader(DISK_VERT, DISK_FRAG, { uInner: { value: inner }, uOuter: { value: w.disk } }, { ...additive, side: THREE.DoubleSide }), tilt, 1);
    const len = w.r * 13;
    const base = w.r * 0.9;
    const jet = new THREE.CylinderGeometry(w.r * 1.5, w.r * 0.2, len, 20, 1, true).translate(0, base + len / 2, 0);
    const jets = mergeGeometries([jet, jet.clone().rotateX(PI)]);
    jet.dispose();
    mesh(jets, shader(JET_VERT, JET_FRAG, { uBase: { value: base }, uLen: { value: len }, uShadow: { value: w.r } }, { ...additive, side: THREE.DoubleSide }), tilt, 1);
  };

  // ── the nebulae ──
  const puffTex = own(puffTexture(seg(256, 128)));
  const sparks = []; // young stars, map space: [x, y, z, r, g, b, size]
  const nebulae = [];
  const MASKS = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ];
  const nebula = (w) => {
    const g = place(w);
    const rand = rng(w.id);
    const R = w.r;
    // its colours at full strength (the hue is the palette's; how bright is the puff's)
    const pal = w.colors.map((c) => {
      const k = new THREE.Color(c);
      return k.multiplyScalar(1 / Math.max(k.r, k.g, k.b, 1e-3));
    });
    const puffs = [];
    const n = small ? 0.55 : 1;
    const many = (k) => Math.max(1, Math.round(k * n));
    // size is a puff's half-width; strength how bright its gas, or (dust) how much it dims
    const add = (at, size, color, { strength = 0.3, tangent = [0, 0, 0], stretch = 1, mask = Math.floor(rand() * 2), spin = (rand() - 0.5) * 0.004, dust = 0 } = {}) => {
      const c = color.clone().multiplyScalar(strength);
      puffs.push({ at, tangent, shape: [size, stretch, spin, rand()], tint: dust ? [c.r * dust, c.g * dust, c.b * dust, dust] : [c.r, c.g, c.b, 0], mask: MASKS[mask] });
    };
    const mixed = (a, b, k) => a.clone().lerp(b, k);
    const dustTint = new THREE.Color(0.08, 0.04, 0.05);
    if (w.id === 'veil') {
      // what's left of a star that blew up: a broken shell of glowing gas,
      // cyan on one side and red-violet on the other, wisps lying along it
      // (seen from outside it's a ring, brightest at its rim)
      const shell = R * 0.7;
      const axis = new THREE.Vector3(0.25, 1, 0.15).normalize();
      const side = new THREE.Vector3(1, 0, 0).cross(axis).normalize();
      const p = new THREE.Vector3();
      const tg = new THREE.Vector3();
      const count = many(24);
      for (let i = 0; i < count; i++) {
        // round the shell, mostly near its equator (a ring more than a ball), with gaps
        const a = (i / count) * TAU + (rand() - 0.5) * 0.35;
        const lat = (rand() - 0.5) * 0.9;
        p.set(cos(a) * cos(lat), sin(lat) * 0.8, sin(a) * cos(lat)).applyAxisAngle(side, 0.35).multiplyScalar(shell * (0.9 + rand() * 0.2));
        tg.set(-sin(a), 0, cos(a)).applyAxisAngle(side, 0.35);
        const k = (sin(a) + 1) / 2;
        const c = k < 0.5 ? mixed(pal[2], pal[0], k * 2) : mixed(pal[0], pal[1], (k - 0.5) * 2);
        const wispy = i % 3 === 0;
        add(p.toArray(), R * (wispy ? 0.25 : 0.18 + rand() * 0.1), c, {
          strength: wispy ? 0.24 : 0.13 + rand() * 0.07,
          tangent: tg.toArray(),
          stretch: wispy ? 1.6 : 1.1 + rand() * 0.35,
          mask: wispy ? 2 : Math.floor(rand() * 2),
          spin: 0,
        });
      }
      // a faint glow inside it, and dust across it
      add([0, 0, 0], R * 0.5, mixed(pal[0], pal[1], 0.5), { strength: 0.06, mask: 0 });
      for (let i = 0; i < many(3); i++) {
        const a = rand() * TAU;
        p.set(cos(a), (rand() - 0.5) * 0.4, sin(a)).multiplyScalar(shell * 0.95);
        tg.set(-sin(a), 0, cos(a));
        add(p.toArray(), R * 0.15, dustTint, { tangent: tg.toArray(), stretch: 1.6, mask: Math.floor(rand() * 2), dust: 0.55, strength: 1 });
      }
    } else {
      // a stellar nursery: a bright core where the young stars are, clouds
      // billowing round it (yellow-green within, green, blue without), dark
      // pillars of dust standing in front of it
      const hot = mixed(pal[1], new THREE.Color(1, 1, 0.92), 0.5);
      add([0, 0, 0], R * 0.26, hot, { strength: 0.36, mask: 0 });
      add([R * 0.06, R * 0.03, -R * 0.04], R * 0.15, new THREE.Color(1, 0.98, 0.88), { strength: 0.36, mask: 1 });
      const ring = (count, r0, r1, size0, size1, color, strength, wisps = 0) => {
        for (let i = 0; i < many(count); i++) {
          const a = rand() * TAU;
          const f = rand();
          const rr = R * (r0 + f * (r1 - r0));
          const p = [cos(a) * rr, (rand() - 0.5) * R * 0.4 * (1.2 - f * 0.6), sin(a) * rr];
          const wispy = rand() < wisps;
          const tg = [-sin(a), (rand() - 0.5) * 0.5, cos(a)];
          add(p, R * (size0 + rand() * (size1 - size0)), color(f), {
            strength: strength * (0.75 + rand() * 0.5),
            tangent: tg,
            stretch: wispy ? 1.6 + rand() * 0.3 : 1 + rand() * 0.5,
            mask: wispy ? 2 : Math.floor(rand() * 2),
          });
        }
      };
      ring(6, 0.12, 0.32, 0.12, 0.19, (f) => mixed(pal[1], pal[0], f * 0.6), 0.22);
      ring(10, 0.28, 0.62, 0.15, 0.25, (f) => mixed(pal[0], pal[2], f * 0.4), 0.17, 0.2);
      ring(7, 0.55, 0.92, 0.18, 0.3, (f) => mixed(pal[2], pal[0], 0.2 - f * 0.2), 0.14, 0.45);
      for (let i = 0; i < many(5); i++) {
        const a = rand() * TAU;
        const rr = R * (0.1 + rand() * 0.32);
        const p = [cos(a) * rr, -R * 0.1 + rand() * R * 0.12, sin(a) * rr];
        add(p, R * (0.08 + rand() * 0.04), dustTint, { tangent: [0.12, 1, 0.05], stretch: 1.7 + rand() * 0.4, mask: Math.floor(rand() * 2), dust: 0.7, strength: 1 });
      }
    }
    // young stars, crowded toward the middle
    const starCount = Math.round(70 * n);
    for (let i = 0; i < starCount; i++) {
      const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
      const spread = w.id === 'veil' ? 0.6 : 0.35;
      const p = [w.at[0] + gauss() * R * spread, w.at[1] + gauss() * R * spread * 0.45, w.at[2] + gauss() * R * spread];
      const b = 0.5 + rand() ** 6 * 5;
      const c = new THREE.Color(0.75 + rand() * 0.2, 0.85 + rand() * 0.1, 1).lerp(pal[Math.floor(rand() * 3)], 0.2).multiplyScalar(b);
      sparks.push([...p, c.r, c.g, c.b, 0.8 + rand() ** 3 * 2.5]);
    }
    // all its puffs in one draw, sorted far to near each frame (dust dims
    // only what's behind it)
    const N = puffs.length;
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    const attr = (name, size) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(N * size), size);
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, a);
      return a;
    };
    const A = { aCentre: attr('aCentre', 3), aTangent: attr('aTangent', 3), aShape: attr('aShape', 4), aTint: attr('aTint', 4), aMask: attr('aMask', 4) };
    geo.instanceCount = N;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.6);
    const mat = shader(PUFF_VERT, PUFF_FRAG, { uPuff: { value: puffTex } }, { ...premultiplied, side: THREE.DoubleSide });
    mesh(geo, mat, g, 1);
    const order = puffs.map((_, i) => i);
    const written = order.slice();
    const dist = new Float32Array(N);
    const byDistance = (a, b) => dist[b] - dist[a];
    const write = () => {
      order.forEach((src, i) => {
        const p = puffs[src];
        A.aCentre.array.set(p.at, i * 3);
        A.aTangent.array.set(p.tangent, i * 3);
        A.aShape.array.set(p.shape, i * 4);
        A.aTint.array.set(p.tint, i * 4);
        A.aMask.array.set(p.mask, i * 4);
      });
      for (const a of Object.values(A)) a.needsUpdate = true;
    };
    write();
    nebulae.push((cam) => {
      if (!cam) return;
      for (let i = 0; i < N; i++) {
        const p = puffs[i].at;
        dist[i] = hypot(cam.x - w.at[0] - p[0], cam.y - w.at[1] - p[1], cam.z - w.at[2] - p[2]);
      }
      order.sort(byDistance);
      // only sent again when the order has changed
      let same = true;
      for (let i = 0; i < N && same; i++) same = order[i] === written[i];
      if (same) return;
      for (let i = 0; i < N; i++) written[i] = order[i];
      write();
    });
  };

  // ── the Death Star ──
  // a traffic model, many times in one draw a part: the model's meshes
  // instanced, each placed by its own matrix under the instance's
  function instancedFleet(kind, count, parent) {
    const model = buildTraffic(kind);
    model.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(model.group.matrixWorld).invert();
    const parts = [];
    model.group.traverse((o) => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry, o.material, count);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      parent.add(im);
      parts.push({ im, rel: inv.clone().multiply(o.matrixWorld) });
    });
    const tmp = new THREE.Matrix4();
    return {
      model,
      set(i, matrix) {
        for (const p of parts) p.im.setMatrixAt(i, tmp.multiplyMatrices(matrix, p.rel));
      },
      commit(t) {
        model.update(t);
        for (const p of parts) {
          p.im.instanceMatrix.needsUpdate = true;
          p.im.computeBoundingSphere();
        }
      },
      dispose() {
        model.dispose();
      },
    };
  }
  const fleets = [];

  const citadel = (w) => {
    const g = place(w);
    const k = w.r / 18; // drawn for a radius of 18
    const pieces = [];
    const add = (geo, part) => {
      const n = geo.attributes.position.count;
      const flat = geo.index ? geo : geo;
      flat.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(n).fill(part), 1));
      for (const name of Object.keys(flat.attributes)) if (!['position', 'normal', 'aPart'].includes(name)) flat.deleteAttribute(name);
      pieces.push(flat.index ? flat.toNonIndexed() : flat);
    };
    const glass = [];
    const r = rng('citadel');
    // A domed disc: a bronze saucer, a glass dome on it with ribs, a ring
    // of light round its rim, and a city under the glass. at: its middle
    // (in units of k), R its radius, H the dome's height.
    const station = (at, R, H, { ribs = 8, towers = 60 } = {}) => {
      const [cx, cy, cz] = at;
      const base = [
        [0, -R * 0.36],
        [R * 0.3, -R * 0.34],
        [R * 0.62, -R * 0.24],
        [R * 0.9, -R * 0.1],
        [R * 1.04, -R * 0.02],
        [R * 1.05, R * 0.03],
        [R * 0.98, R * 0.04],
      ].map(([x, y]) => new THREE.Vector2(x * k, y * k));
      add(new THREE.LatheGeometry(base, seg(48, 28)).translate(cx * k, cy * k, cz * k), 0);
      add(new THREE.TorusGeometry(R * 1.05 * k, 0.09 * k * Math.max(1, R / 8), 6, seg(64, 32)).rotateX(PI / 2).translate(cx * k, (cy + R * 0.005) * k, cz * k), 3);
      // the dome, its ribs and its crown ring
      const dome = new THREE.SphereGeometry(1, seg(48, 28), seg(16, 10), 0, TAU, 0, PI / 2).scale(R * k, H * k, R * k).translate(cx * k, (cy + R * 0.04) * k, cz * k);
      dome.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(dome.attributes.position.count).fill(7), 1));
      glass.push(dome);
      const crown = 0.27;
      for (let i = 0; i < ribs; i++) {
        const a = (i / ribs) * TAU + 0.2;
        const pts = [];
        for (let j = 0; j <= 10; j++) {
          const rr = R * (1 - (1 - crown) * (j / 10));
          const y = H * Math.sqrt(Math.max(0, 1 - (rr / R) ** 2));
          pts.push(new THREE.Vector3((cx + Math.cos(a) * rr) * k, (cy + R * 0.04 + y) * k, (cz + Math.sin(a) * rr) * k));
        }
        add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.11 * k * Math.max(1, R / 8), 5, false), 1);
      }
      for (const lat of [0.62, crown]) {
        const rr = R * lat;
        const y = H * Math.sqrt(1 - lat * lat);
        add(new THREE.TorusGeometry(rr * k, 0.1 * k * Math.max(1, R / 8), 5, seg(48, 24)).rotateX(PI / 2).translate(cx * k, (cy + R * 0.04 + y) * k, cz * k), 1);
      }
      // the city under the glass: towers of pale green, kept inside the dome
      for (let i = 0; i < towers; i++) {
        const rr = Math.sqrt(r()) * R * 0.86;
        const a = r() * TAU;
        const top = H * Math.sqrt(Math.max(0, 1 - (rr / R) ** 2)) * (0.35 + r() * 0.55);
        const w2 = (0.35 + r() * 0.5) * Math.max(0.6, R / 10);
        const geo = r() < 0.35 ? new THREE.CylinderGeometry(w2 * 0.5 * k, w2 * 0.55 * k, top * k, 8) : new THREE.BoxGeometry(w2 * k, top * k, w2 * (0.6 + r() * 0.6) * k);
        add(geo.translate((cx + Math.cos(a) * rr) * k, (cy + R * 0.04 + top / 2) * k, (cz + Math.sin(a) * rr) * k), 4);
      }
    };
    // the great dome in the middle
    station([0, 0, 0], 12.5, 5.4, { ribs: 10, towers: small ? 70 : 140 });
    // under it, a deep bronze hull stepping down to the towers
    const under = [
      [0, -7.6],
      [2.6, -7.4],
      [4.4, -6.6],
      [6.2, -5.4],
      [7.4, -4.5],
    ].map(([x, y]) => new THREE.Vector2(x * k, y * k));
    add(new THREE.LatheGeometry(under, seg(40, 24)), 0);
    // the arms, out to four smaller domes: one higher than the rest, as the show has it
    const ARMS = [
      { a: 0.25, len: 22, R: 5.6, H: 2.6, rise: -1.6 },
      { a: 0.25 + PI / 2 + 0.15, len: 19, R: 4.4, H: 2.1, rise: 6.5 },
      { a: 0.25 + PI + 0.05, len: 23, R: 6, H: 2.8, rise: -2.4 },
      { a: 0.25 + PI * 1.5 - 0.1, len: 18, R: 4.2, H: 2, rise: 1.2 },
    ];
    for (const arm of ARMS) {
      const dir = new THREE.Vector3(Math.cos(arm.a), 0, Math.sin(arm.a));
      const from = dir.clone().multiplyScalar(11.4).setY(-0.6);
      const to = dir.clone().multiplyScalar(arm.len).setY(arm.rise - arm.R * 0.2);
      const mid = from.clone().lerp(to, 0.5);
      const len = from.distanceTo(to);
      const look = new THREE.Matrix4().lookAt(from, to, new THREE.Vector3(0, 1, 0));
      const q = new THREE.Quaternion().setFromRotationMatrix(look);
      const beam = (w2, h2, part, off = [0, 0]) => {
        const geo = new THREE.BoxGeometry(w2 * k, h2 * k, len * k);
        // tapered toward the station
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const t = pos.getZ(i) / (len * k) + 0.5; // 0 at the far end (lookAt faces -z)
          pos.setX(i, pos.getX(i) * (0.65 + 0.35 * t));
        }
        geo.computeVertexNormals();
        geo.translate(off[0] * k, off[1] * k, 0);
        geo.applyQuaternion(q);
        geo.translate(mid.x * k, mid.y * k, mid.z * k);
        add(geo, part);
      };
      beam(2.2, 1.3, 0);
      beam(0.9, 0.5, 1, [0, -1.2]);
      beam(0.14, 0.14, 3, [0.7, 0.68]);
      beam(0.14, 0.14, 3, [-0.7, 0.68]);
      // running lights near the root
      for (let i = 0; i < 3; i++) {
        const at2 = from.clone().lerp(to, 0.12 + i * 0.07);
        add(new THREE.SphereGeometry(0.22 * k, 6, 4).translate(at2.x * k, (at2.y + 0.8) * k, at2.z * k), 5);
      }
      station([to.x, to.y, to.z], arm.R, arm.H, { ribs: 6, towers: small ? 16 : 34 });
    }
    // the towers hanging under it, a cluster of tall tapered blades with cyan
    // strips down them, and the crystal hanging lowest
    const BLADES = [
      [0, 0, 15, 1.5],
      [2.6, 0.4, 12, 1.2],
      [-2.2, 1.6, 13.5, 1.15],
      [0.6, -2.6, 11, 1.1],
      [-1.6, -1.9, 9.5, 1],
      [1.9, 2.3, 10, 0.95],
    ];
    for (const [bx, bz, h, wd] of BLADES) {
      const geo = new THREE.CylinderGeometry(wd * k, wd * 0.35 * k, h * k, 5);
      add(geo.translate(bx * k, (-6 - h / 2) * k, bz * k), 0);
      // a strip down the face toward the outside
      const a = Math.atan2(bz, bx || 0.01);
      const sx = bx + Math.cos(a) * wd * 0.72;
      const sz = bz + Math.sin(a) * wd * 0.72;
      add(new THREE.BoxGeometry(0.16 * k, h * 0.82 * k, 0.16 * k).translate(sx * k, (-6 - h * 0.45) * k, sz * k), 3);
    }
    add(new THREE.ConeGeometry(0.75 * k, 13 * k, 6).rotateX(PI).translate(0.3 * k, -27.5 * k, 0.2 * k), 6);
    // masts with beacons round the great dome's rim
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.6;
      const x = Math.cos(a) * 12.8;
      const z = Math.sin(a) * 12.8;
      const len = 1.6 + (i % 3) * 0.7;
      add(new THREE.CylinderGeometry(0.05 * k, 0.1 * k, len * k, 5).translate(x * k, (0.4 + len / 2) * k, z * k), 1);
      add(new THREE.SphereGeometry(0.2 * k, 6, 4).translate(x * k, (0.4 + len) * k, z * k), 2);
    }
    const geo = mergeGeometries(pieces);
    for (const p of pieces) p.dispose();
    mesh(geo, shader(CITADEL_VERT, CITADEL_FRAG, { uLight: homeW, uLightColor: { value: HOME_LIGHT } }), g);
    const glassGeo = mergeGeometries(glass.map((d) => d.toNonIndexed()));
    for (const d of glass) d.dispose();
    mesh(glassGeo, shader(CITADEL_VERT, CITADEL_GLASS_FRAG, { uLight: homeW, uLightColor: { value: HOME_LIGHT } }, { transparent: true, depthWrite: false, side: THREE.DoubleSide }), g, 1);
    // the warm haze it hangs in, as the show paints its sky: a soft glow
    // that always faces you, behind and round it
    const haze = mesh(
      new THREE.PlaneGeometry(1, 1).scale(150 * k, 150 * k, 1),
      shader(
        BILLBOARD_VERT,
        `uniform float uR;
        varying vec2 vC;
        void main() {
          float r = length(vC);
          float a = exp(-r * r * 3.2) * 0.42 + exp(-r * r * 12.0) * 0.18;
          gl_FragColor = vec4(vec3(0.62, 0.32, 0.1) * a, a);
        }`,
        { uR: { value: 75 * k } },
        { ...premultiplied },
      ),
      g,
      -1,
    );
    haze.frustumCulled = false;
    // a portal beside it, the council's ships coming and going
    const portalAt = new THREE.Vector3(30 * k, 6 * k, 22 * k);
    const portal = mesh(new THREE.PlaneGeometry(9 * k, 9 * k), shader('varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', PORTAL_FRAG, {}, { ...premultiplied, side: THREE.DoubleSide }), g, 2);
    portal.position.copy(portalAt);
    portal.lookAt(portalAt.clone().add(new THREE.Vector3(-portalAt.z, 0, portalAt.x)).add(g.position));
    // council ships circling, clear of the arms
    const count = small ? 3 : 5;
    const fleet = instancedFleet('councilship', count, g);
    fleets.push(fleet);
    const orbits = Array.from({ length: count }, (_, i) => ({ r: (36 + i * 2.6) * k, tilt: (i % 2 ? -1 : 1) * (0.12 + i * 0.05), speed: 0.09 - i * 0.007, phase: i * 1.37, size: 0.55 + (i % 3) * 0.1 }));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const at = new THREE.Vector3();
    const s = new THREE.Vector3();
    const qt = new THREE.Quaternion();
    ticks.push((t) => {
      orbits.forEach((o, i) => {
        const a = o.phase + t * o.speed;
        qt.setFromEuler(e.set(o.tilt, 0, 0));
        at.set(cos(a) * o.r, sin(t * 0.3 + i) * 0.6 * k, -sin(a) * o.r).applyQuaternion(qt);
        // nose along the way it's going (anticlockwise seen from above)
        q.setFromEuler(e.set(0, a + PI, 0));
        q.premultiply(qt);
        m.compose(at, q, s.setScalar(o.size));
        fleet.set(i, m);
      });
      fleet.commit(t);
    });
  };

  for (const w of WONDERS) {
    if (w.kind === 'gas-giant' || w.kind === 'ice-giant') giant(w);
    else if (w.kind === 'star') sun(w);
    else if (w.kind === 'black-hole') blackHole(w);
    else if (w.kind === 'nebula') nebula(w);
    else if (w.kind === 'citadel') citadel(w);
  }

  // the nebulae's young stars, all in one draw
  if (sparks.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(sparks.flatMap((s) => s.slice(0, 3)), 3));
    geo.setAttribute('aColor', new THREE.Float32BufferAttribute(sparks.flatMap((s) => s.slice(3, 6)), 3));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sparks.map((s) => s[6]), 1));
    const mat = own(shader(SPARK_VERT, SPARK_FRAG, { uScale: { value: 500 } }, additive));
    const points = new THREE.Points(own(geo), mat);
    points.name = 'deep-young-stars';
    points.renderOrder = 2;
    // a point's size is in pixels: how many a unit is at a distance of one
    const size = new THREE.Vector2();
    points.onBeforeRender = (renderer, scene, camera) => {
      const target = renderer.getRenderTarget();
      const h = target ? target.height : renderer.getDrawingBufferSize(size).y;
      mat.uniforms.uScale.value = (h / 2) * (camera.projectionMatrix.elements[5] || 1);
    };
    group.add(points);
  }
  // ── names ──
  const named = WONDERS.map((w) => ({ w, name: w.name, sub: SUBTITLE[w.id] ?? w.kind.replace('-', ' '), color: w.color ?? w.colors?.[0] ?? '#9fb0d0' }));
  const labelTex = own(labelAtlas(named));
  const labelGeo = new THREE.InstancedBufferGeometry();
  {
    const quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    labelGeo.index = quad.index;
    labelGeo.setAttribute('position', quad.attributes.position);
    labelGeo.setAttribute('uv', quad.attributes.uv);
  }
  const lift = (w) => {
    if (w.kind === 'nebula') return w.r * 0.55;
    if (w.kind === 'black-hole') return w.r * 3.0;
    if (w.kind === 'star') return w.r * 1.7;
    if (w.ring) return w.r * 1.45;
    return w.r * 1.4 + 2;
  };
  labelGeo.setAttribute('aAt', new THREE.InstancedBufferAttribute(new Float32Array(named.flatMap(({ w }) => [w.at[0], w.at[1] + lift(w), w.at[2]])), 3));
  labelGeo.setAttribute('aRow', new THREE.InstancedBufferAttribute(new Float32Array(named.map((_, i) => i)), 1));
  const alphaAttr = new THREE.InstancedBufferAttribute(new Float32Array(named.length), 1);
  alphaAttr.setUsage(THREE.DynamicDrawUsage);
  labelGeo.setAttribute('aAlpha', alphaAttr);
  labelGeo.instanceCount = named.length;
  const labelMesh = mesh(labelGeo, shader(LABEL_VERT, LABEL_FRAG, { uMap: { value: labelTex }, uSize: { value: LABEL_H }, uRatio: { value: LABEL_W / LABEL_RH }, uRows: { value: named.length } }, { transparent: true, depthWrite: false }), group, 10);
  labelMesh.name = 'deep-labels';
  labelMesh.frustumCulled = false;
  const shown = named.map(() => 0);

  // ── the far galaxies, riding with the camera ──
  const sky = new THREE.Group();
  sky.name = 'deep-galaxies';
  group.add(sky);
  {
    const rand = rng('far-galaxies');
    const list = [
      // [azimuth, elevation (degrees), size (units at SKY_FAR), squash, cell, tint, brightness]
      [35, 22, 190, 0.42, 0, [1, 0.95, 0.9], 0.55],
      [140, -18, 120, 0.85, 1, [0.85, 0.9, 1], 0.45],
      [205, 34, 150, 1, 2, [1, 0.92, 0.85], 0.5],
      [262, 8, 210, 0.3, 0, [0.9, 0.92, 1], 0.4],
      [318, -30, 90, 1, 3, [1, 0.95, 0.85], 0.55],
      [95, 48, 80, 0.6, 1, [1, 0.85, 0.9], 0.4],
      [175, -42, 70, 1, 3, [0.95, 0.95, 1], 0.45],
      [10, -12, 60, 0.25, 0, [1, 0.9, 0.8], 0.35],
    ];
    const pos = [];
    const uv = [];
    const col = [];
    const idx = [];
    const d = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    list.forEach(([az, el, size, squash, cell, tint, b], i) => {
      const A = THREE.MathUtils.degToRad(az);
      const E = THREE.MathUtils.degToRad(el);
      d.set(cos(E) * cos(A), sin(E), cos(E) * sin(A));
      right.crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
      up.crossVectors(right, d).normalize();
      const roll = rand() * TAU;
      const r2 = right.clone().multiplyScalar(cos(roll)).addScaledVector(up, sin(roll));
      const u2 = up.clone().multiplyScalar(cos(roll)).addScaledVector(right, -sin(roll));
      const hw = size / 2;
      const hh = (size / 2) * squash;
      const cu = (cell % 2) * 0.5;
      const cv = cell < 2 ? 0.5 : 0;
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].forEach(([sx, sy]) => {
        const p = d.clone().multiplyScalar(SKY_FAR).addScaledVector(r2, sx * hw).addScaledVector(u2, sy * hh);
        pos.push(p.x, p.y, p.z);
        uv.push(cu + (sx > 0 ? 0.5 : 0), cv + (sy > 0 ? 0.5 : 0));
        col.push(tint[0] * b, tint[1] * b, tint[2] * b);
      });
      const o = i * 4;
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    const m = mesh(geo, shader(SKY_VERT, SKY_FRAG, { uMap: { value: own(galaxyAtlas(seg(1024, 512))) } }, { ...additive, side: THREE.DoubleSide }), sky, -5);
    m.frustumCulled = false;
  }

  // ── drifting streams of rock between the wonders ──
  const debris = new THREE.Group();
  debris.name = 'deep-debris';
  group.add(debris);
  {
    const rand = rng('deep-debris');
    const fields = [
      { at: [360, 12, -300], dir: [0.62, 0.05, 0.78], len: 230, wide: 34, thick: 7 },
      { at: [-215, -18, 330], dir: [0.9, 0.08, -0.42], len: 210, wide: 30, thick: 6 },
    ];
    const per = small ? 70 : 170;
    const rock = new THREE.IcosahedronGeometry(1, 1);
    {
      const p = rock.attributes.position;
      const vv = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        vv.fromBufferAttribute(p, i);
        const kk = 1 + 0.16 * sin(vv.x * 3.1 + 1.3) * cos(vv.y * 2.7) + 0.12 * sin(vv.z * 4.3 + vv.x * 2);
        vv.multiplyScalar(kk).multiply(new THREE.Vector3(1, 0.72, 0.86));
        p.setXYZ(i, vv.x, vv.y, vv.z);
      }
      rock.computeVertexNormals();
    }
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0.02, flatShading: true, envMapIntensity: 0.25 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = sh.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uTime;
float dh(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
mat3 tumble(float id) {
  vec3 ax = normalize(vec3(dh(id) - 0.5, dh(id + 1.7) - 0.5, dh(id + 3.1) - 0.5) + vec3(0.0, 0.001, 0.0));
  float a = uTime * (0.04 + 0.25 * dh(id + 5.3)) + dh(id + 7.9) * 6.2832;
  float c = cos(a);
  float s = sin(a);
  float k = 1.0 - c;
  return mat3(c + ax.x * ax.x * k, ax.y * ax.x * k + ax.z * s, ax.z * ax.x * k - ax.y * s,
              ax.x * ax.y * k - ax.z * s, c + ax.y * ax.y * k, ax.z * ax.y * k + ax.x * s,
              ax.x * ax.z * k + ax.y * s, ax.y * ax.z * k - ax.x * s, c + ax.z * ax.z * k);
}`,
        )
        .replace('#include <beginnormal_vertex>', 'mat3 tumbleM = tumble(float(gl_InstanceID));\nvec3 objectNormal = tumbleM * vec3(normal);')
        .replace('#include <begin_vertex>', 'vec3 transformed = tumbleM * vec3(position);');
    };
    mat.customProgramCacheKey = () => 'deep-debris';
    const im = new THREE.InstancedMesh(own(rock), own(mat), per * fields.length);
    const mm = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const c = new THREE.Color();
    const TONES = ['#5d5953', '#4a4743', '#67605a', '#544a40', '#3f3b38', '#6b5a48'];
    let i = 0;
    for (const f of fields) {
      const dir = new THREE.Vector3(...f.dir).normalize();
      const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const upv = new THREE.Vector3().crossVectors(side, dir).normalize();
      for (let n = 0; n < per; n++, i++) {
        const along = (rand() - 0.5) * f.len;
        const thin = 1 - Math.abs(along / (f.len / 2)) * 0.6;
        const across = (rand() + rand() + rand() - 1.5) / 1.5;
        // a gentle S along its length, so it's a stream, not a bar
        const bend = sin((along / f.len) * PI * 2) * f.wide * 0.6;
        p.set(...f.at)
          .addScaledVector(dir, along)
          .addScaledVector(side, across * f.wide * thin + bend)
          .addScaledVector(upv, (rand() - 0.5) * f.thick * thin);
        const size = 0.18 + rand() ** 5 * 3.6;
        sc.set(size, size * (0.7 + rand() * 0.5), size * (0.8 + rand() * 0.4));
        q.setFromEuler(e.set(rand() * 6.3, rand() * 6.3, rand() * 6.3));
        im.setMatrixAt(i, mm.compose(p, q, sc));
        im.setColorAt(i, c.set(TONES[Math.floor(rand() * TONES.length)]).multiplyScalar(0.85 + rand() * 0.3));
      }
    }
    im.computeBoundingSphere();
    debris.add(im);
    ticks.push((t) => debris.position.set(sin(t * 0.004) * 6, sin(t * 0.003 + 1) * 1.5, cos(t * 0.0035) * 5));
  }

  // ── each frame ──
  const tmp = new THREE.Vector3();
  let lastT = null;
  return {
    group,
    update(t, camera, cam) {
      const dt = lastT === null ? 1 : Math.min(0.1, Math.max(0, t - lastT));
      lastT = t;
      uTime.value = t;
      group.updateWorldMatrix(true, false);
      homeW.value.setFromMatrixPosition(group.matrixWorld);
      for (const [id, light] of lightOf) light.value.copy(wonderGroups[id].position).applyMatrix4(group.matrixWorld);
      for (const tick of ticks) tick(t, dt, cam);
      for (const sort of nebulae) sort(cam);
      if (cam) {
        sky.position.copy(cam);
        // names: out of the home system, and well clear of the wonder
        const out = hypot(cam.x, cam.z) > DEEP.system;
        named.forEach(({ w }, i) => {
          const want = out && tmp.set(...w.at).distanceTo(cam) > reachOf(w) * 1.5 ? 1 : 0;
          shown[i] += (want - shown[i]) * Math.min(1, dt * 2.5);
          if (Math.abs(shown[i] - want) < 0.002) shown[i] = want;
          alphaAttr.array[i] = shown[i];
        });
        alphaAttr.needsUpdate = true;
      }
    },
    // where the black hole is (map space) and its shadow's radius, for the
    // post's bending of the light round it
    lens() {
      return lensAt;
    },
    dispose() {
      for (const f of fleets) f.dispose();
      group.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
      });
      for (const x of owned) x.dispose();
      owned.length = 0;
      group.clear();
    },
  };
}
