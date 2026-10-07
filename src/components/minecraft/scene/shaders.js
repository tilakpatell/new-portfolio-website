// Minecraft, the one block material, in three passes: opaque, cutout (a
// texel is there or it isn't: leaves, glass, plants) and water (seen
// through). It reads the mesher's vertex (rules/mesher.js: six 16-bit
// numbers) and lights a texel the game's way, no PBR, no tone mapping:
//
//   colour = texel × tint × face shade × corner AO × brightness(light)
//
// The shade is the game's per face (top 1.0, bottom 0.5, north and south
// 0.8, east and west 0.6; a plant's cross 1.0), the AO its four levels
// (0.4, 0.6, 0.8, 1.0), and the light the game's lightmap colour: each
// light's curve over its sixteen levels, b / (4 − 3b), the sky's dimmed and
// blued by the hour, the block's warm, added. Fog takes the
// sky's colour at the horizon from 0.8 of the render distance to all of it.
// Water and lava turn over their frames by the game's tick (the pack's
// .mcmeta timing, pack/atlas.js frameAt): `anim[i]` is a strip's own layer,
// the frame showing, the next, and how far between, set each tick.
// The arithmetic is on the sRGB bytes as painted, as the game's is.

import * as THREE from 'three';
import { frameAt } from '../pack/atlas.js';

// the game's colours for plains (grass and foliage from its own colormap,
// stand-ins until the pack's is read), water, and birch's and spruce's fixed leaves
export const TINT_COLOURS = {
  grass: [0x91, 0xbd, 0x59],
  foliage: [0x77, 0xab, 0x2f],
  water: [0x3f, 0x76, 0xe4],
  birch: [0x80, 0xa7, 0x55],
  spruce: [0x61, 0x99, 0x61],
};
const v3 = ([r, g, b]) => new THREE.Vector3(r / 255, g / 255, b / 255);

const vertex = /* glsl */ `
in vec3 data; // layer, face | ao << 3 | tint << 5 | light << 8, u | v << 5
uniform float sun; // the sun's brightness for the light, 0.2 at night to 1 (rules/time.js)
uniform vec3 tints[6];
uniform vec4 anim[4]; // the strip's layer, the frame's layer, the next's, the blend
out vec3 vUv;
flat out float vNext;
flat out float vBlend;
out vec3 vColour;
out float vDist;

void main() {
  float word = data.y;
  float face = mod(word, 8.0);
  float ao = mod(floor(word / 8.0), 4.0);
  int tint = int(mod(floor(word / 32.0), 8.0));
  float light = floor(word / 256.0);
  float sky = floor(light / 16.0);
  float block = mod(light, 16.0);
  float uv = data.z;
  float layer = data.x;
  vNext = layer;
  vBlend = 0.0;
  for (int i = 0; i < 4; i++)
    if (anim[i].x == layer) {
      layer = anim[i].y;
      vNext = anim[i].z;
      vBlend = anim[i].w;
    }
  vUv = vec3(mod(uv, 32.0) / 16.0, floor(uv / 32.0) / 16.0, layer);

  float shade = face < 0.5 ? 1.0 : face < 1.5 ? 0.5 : face < 3.5 ? 0.8 : face < 5.5 ? 0.6 : 1.0;
  // the game's lightmap (rules/time.js's lightmap): the sky's light blue-grey with the
  // sun's going, the block's warm, added, clamped, lifted off black
  float f = sun * 0.95 + 0.05;
  float bs = sky / 15.0;
  float bb = block / 15.0;
  float s = bs / (4.0 - 3.0 * bs) * f;
  float t = bb / (4.0 - 3.0 * bb) * 1.5;
  vec3 lm = vec3(s * (f * 0.65 + 0.35) + t, s * (f * 0.65 + 0.35) + t * ((t * 0.6 + 0.4) * 0.6 + 0.4), s + t * (t * t * 0.6 + 0.4));
  lm = min(lm, vec3(1.0)) * 0.96 + 0.03;
  vColour = tints[tint] * shade * (0.4 + 0.2 * ao) * lm;

  vec4 world = modelMatrix * vec4(position, 1.0);
  vDist = length(world.xz - cameraPosition.xz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragment = /* glsl */ `
layout(location = 0) out highp vec4 outColour;
precision highp sampler2DArray;
uniform sampler2DArray atlas;
uniform vec3 fogColour;
uniform float fogNear;
uniform float fogFar;
in vec3 vUv;
in vec3 vColour;
in float vDist;
flat in float vNext;
flat in float vBlend;

void main() {
  vec4 t = texture(atlas, vUv);
  if (vBlend > 0.0) t = mix(t, texture(atlas, vec3(vUv.xy, vNext)), vBlend);
#ifdef CUTOUT
  if (t.a < 0.5) discard;
#endif
  vec3 c = t.rgb * vColour;
  float fog = smoothstep(fogNear, fogFar, vDist);
#ifdef WATER
  outColour = vec4(mix(c, fogColour, fog), t.a);
#else
  outColour = vec4(mix(c, fogColour, fog), 1.0);
#endif
}
`;

// the frames showing at a tick, into a material's `anim` (a strip's layer -1 when unused)
export function setFrames(material, anims, ticks) {
  const slots = material.uniforms.anim.value;
  anims.slice(0, 4).forEach((an, i) => {
    const { a, b, blend } = frameAt(an, ticks);
    slots[i].set(an.layer, a, b, blend);
  });
}

// `colours` overrides the grass and foliage (the pack's colormap, read for the biome)
export function blockMaterial({ array, pass, colours = {} }) {
  const c = { ...TINT_COLOURS, ...colours };
  const tints = [[255, 255, 255], c.grass, c.foliage, c.water, c.birch, c.spruce].map(v3);
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: vertex,
    fragmentShader: fragment,
    defines: pass === 'cutout' ? { CUTOUT: 1 } : pass === 'water' ? { WATER: 1 } : {},
    uniforms: {
      atlas: { value: array },
      sun: { value: 1 },
      tints: { value: tints },
      anim: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(-1, 0, 0, 0)) },
      fogColour: { value: new THREE.Vector3(0.75, 0.85, 1) },
      fogNear: { value: 100 },
      fogFar: { value: 160 },
    },
    side: pass === 'opaque' ? THREE.FrontSide : THREE.DoubleSide,
    transparent: pass === 'water',
    depthWrite: pass !== 'water',
  });
  return m;
}
