// Minecraft, the one block material, in three passes: opaque, cutout (a
// texel is there or it isn't: leaves, glass, plants) and water (seen
// through). It reads the mesher's vertex (rules/mesher.js: six 16-bit
// numbers) and lights a texel the game's way, no PBR, no tone mapping:
//
//   colour = texel × tint × face shade × corner AO × brightness(light)
//
// The shade is the game's per face (top 1.0, bottom 0.5, north and south
// 0.8, east and west 0.6; a plant's cross 1.0), the AO its four levels
// (0.4, 0.6, 0.8, 1.0), the brightness its curve over the sixteen light
// levels, b / (4 − 3b), from max(sky × daylight, block). Fog takes the
// sky's colour at the horizon from 0.8 of the render distance to all of it.
// The arithmetic is on the sRGB bytes as painted, as the game's is.

import * as THREE from 'three';

// the game's colours for plains: grass, foliage, water, and birch's and spruce's fixed leaves
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
uniform float daylight;
uniform vec3 tints[6];
out vec3 vUv;
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
  vUv = vec3(mod(uv, 32.0) / 16.0, floor(uv / 32.0) / 16.0, data.x);

  float shade = face < 0.5 ? 1.0 : face < 1.5 ? 0.5 : face < 3.5 ? 0.8 : face < 5.5 ? 0.6 : 1.0;
  float b = max(sky * daylight, block) / 15.0;
  float bright = b / (4.0 - 3.0 * b) * 0.96 + 0.03;
  vColour = tints[tint] * shade * (0.4 + 0.2 * ao) * bright;

  vec4 world = modelMatrix * vec4(position, 1.0);
  vDist = length(world.xz - cameraPosition.xz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragment = /* glsl */ `
precision highp sampler2DArray;
uniform sampler2DArray atlas;
uniform vec3 fogColour;
uniform float fogNear;
uniform float fogFar;
in vec3 vUv;
in vec3 vColour;
in float vDist;

void main() {
  vec4 t = texture(atlas, vUv);
#ifdef CUTOUT
  if (t.a < 0.5) discard;
#endif
  vec3 c = t.rgb * vColour;
  float fog = smoothstep(fogNear, fogFar, vDist);
#ifdef WATER
  gl_FragColor = vec4(mix(c, fogColour, fog), t.a);
#else
  gl_FragColor = vec4(mix(c, fogColour, fog), 1.0);
#endif
}
`;

export function blockMaterial({ array, pass }) {
  const tints = [[255, 255, 255], TINT_COLOURS.grass, TINT_COLOURS.foliage, TINT_COLOURS.water, TINT_COLOURS.birch, TINT_COLOURS.spruce].map(v3);
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: vertex,
    fragmentShader: fragment,
    defines: pass === 'cutout' ? { CUTOUT: 1 } : pass === 'water' ? { WATER: 1 } : {},
    uniforms: {
      atlas: { value: array },
      daylight: { value: 1 },
      tints: { value: tints },
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
