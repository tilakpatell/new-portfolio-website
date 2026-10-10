// Minecraft's materials as node materials (TSL), so the world draws on the
// node renderer: WebGPU where the browser has it, WebGL 2 everywhere else
// (src/runtime/backend.js). Each is the GLSL it replaced, line for line:
// the one block material in its three passes (shaders.js's), the sky's
// dome, stars, sun and moon and clouds (sky.js's), a drop (drops.js's) and
// the crack (cursor.js's). The uniforms are under the names the scene
// always wrote, now on `material.u` (m.u.sun.value, as m.uniforms.sun.value).
//
//   blockMaterial({ array, pass, colours }) → material (.u: atlas, sun, tints, anim, fogColour, fogNear, fogFar)
//   setFrames(material, anims, ticks)
//   domeMaterial({ fog }) → { material, u: { sky, fog, glow, sunDir } }
//   starsMaterial() → { material, u: { strength } }  (for a Sprite drawn once a star: sky.js)
//   spriteMaterial(map) → { material, u: { map, frame, strength } }
//   cloudMaterial({ map, fog }) → { material, u: { map, offset, fog, tint, far } }
//   dropMaterial(atlas) → material (.u: atlas)
//   crackMaterial({ array, layer }) → { material, u: { atlas, layer } }
//
// The game's light is arithmetic on the sRGB bytes as painted, written to
// the canvas as it is: no tone mapping, no colour-space conversion, as the
// GLSL wrote outColour. So the textures keep NoColorSpace (sampled as the
// bytes are) and the module turns the renderer's own output off
// (NoToneMapping, linear output): nothing is converted on the way out, and
// the canvas keeps its multisampling.

import * as THREE from 'three';
import { MeshBasicNodeMaterial, PointsNodeMaterial } from 'three/webgpu';
import { Discard, Fn, If, abs, attribute, cameraPosition, dot, float, floor, fract, int, length, min, mix, mod, normalize, positionLocal, positionWorld, round, screenDPR, select, smoothstep, texture, uniform, uniformArray, uv, varying, vec2, vec3, vec4 } from 'three/tsl';
import { frameAt } from '../pack/atlas.js';

// The one block material, in three passes: opaque, cutout (a texel is there
// or it isn't: leaves, glass, plants) and water (seen through). It reads
// the mesher's vertex (rules/mesher.js: six 16-bit numbers) and lights a
// texel the game's way, no PBR, no tone mapping:
//
//   colour = texel × tint × face shade × corner AO × brightness(light)
//
// The shade is the game's per face (top 1.0, bottom 0.5, north and south
// 0.8, east and west 0.6; a plant's cross 1.0), the AO its four levels
// (0.4, 0.6, 0.8, 1.0), and the light the game's lightmap colour: each
// light's curve over its sixteen levels, b / (4 − 3b), the sky's dimmed and
// blued by the hour, the block's warm, added. Fog takes the sky's colour at
// the horizon from 0.8 of the render distance to all of it. Water and lava
// turn over their frames by the game's tick (the pack's .mcmeta timing,
// pack/atlas.js frameAt): `anim[i]` is a strip's own layer, the frame
// showing, the next, and how far between, set each tick.

// the game's colours for plains (grass and foliage from its own colormap,
// stand-ins until the pack's is read), water, and birch's and spruce's fixed leaves
export const TINT_COLOURS = {
  grass: [0x91, 0xbd, 0x59],
  foliage: [0x77, 0xab, 0x2f],
  water: [0x3f, 0x76, 0xe4],
  birch: [0x80, 0xa7, 0x55],
  spruce: [0x61, 0x99, 0x61],
};

const CELL = 12; // the clouds' cell, in blocks (sky.js's)
const v4 = ([r, g, b]) => new THREE.Vector4(r / 255, g / 255, b / 255, 1);

// A texture array's layer, rounded as GLSL's texture(sampler2DArray, …)
// rounds it: the node renderer makes it an integer by cutting it off, and
// a layer carried through a varying arrives as 6.9999 as often as 7, so
// whole tiles came from the one before.
const layerOf = (z) => round(z);

const made = (Kind, opts, colorNode) => {
  const material = new Kind(opts);
  material.colorNode = colorNode;
  return material;
};

// ── the blocks ──

// `colours` overrides the grass and foliage (the pack's colormap, read for the biome)
export function blockMaterial({ array, pass, colours = {} }) {
  const c = { ...TINT_COLOURS, ...colours };
  const u = {
    atlas: texture(array),
    sun: uniform(1), // the sun's brightness for the light, 0.2 at night to 1 (rules/time.js)
    tints: uniformArray([[255, 255, 255], c.grass, c.foliage, c.water, c.birch, c.spruce].map(v4), 'vec4'),
    anim: uniformArray([0, 1, 2, 3].map(() => new THREE.Vector4(-1, 0, 0, 0)), 'vec4'), // the strip's layer, the frame's, the next's, the blend
    fogColour: uniform(new THREE.Vector3(0.75, 0.85, 1)),
    fogNear: uniform(100),
    fogFar: uniform(160),
  };

  // the mesher's vertex (rules/mesher.js): layer, face | ao << 3 | tint << 5 | light << 8, u | v << 5
  const data = attribute('data', 'vec3');
  const word = data.y;
  const face = mod(word, 8);
  const ao = mod(floor(word.div(8)), 4);
  const tint = int(mod(floor(word.div(32)), 8));
  const light = floor(word.div(256));
  const sky = floor(light.div(16));
  const block = mod(light, 16);
  const uvw = data.z;

  // water and lava turn over their frames: a strip's own layer swapped for
  // the frame showing, with the next and how far between (in order, as the
  // GLSL's loop did, each slot looking at the layer the last one left)
  let layer = data.x;
  let next = data.x;
  let blend = float(0);
  for (let i = 0; i < 4; i++) {
    const a = u.anim.element(i);
    const hit = a.x.equal(layer);
    next = select(hit, a.z, next);
    blend = select(hit, a.w, blend);
    layer = select(hit, a.y, layer);
  }
  const vUv = varying(vec3(mod(uvw, 32).div(16), floor(uvw.div(32)).div(16), layer), 'vUv');
  const vNext = varying(next, 'vNext').setInterpolation('flat');
  const vBlend = varying(blend, 'vBlend').setInterpolation('flat');

  // the game's face shade, corner shade and lightmap (rules/time.js's lightmap):
  // the sky's light blue-grey with the sun's going, the block's warm, added,
  // clamped, lifted off black
  const shade = select(face.lessThan(0.5), 1, select(face.lessThan(1.5), 0.5, select(face.lessThan(3.5), 0.8, select(face.lessThan(5.5), 0.6, 1))));
  const f = u.sun.mul(0.95).add(0.05);
  const bs = sky.div(15);
  const bb = block.div(15);
  const s = bs.div(bs.mul(-3).add(4)).mul(f);
  const t = bb.div(bb.mul(-3).add(4)).mul(1.5);
  const sk = s.mul(f.mul(0.65).add(0.35));
  const lm = min(vec3(sk.add(t), sk.add(t.mul(t.mul(0.6).add(0.4).mul(0.6).add(0.4))), s.add(t.mul(t.mul(t).mul(0.6).add(0.4)))), vec3(1)).mul(0.96).add(0.03);
  const vColour = varying(u.tints.element(tint).xyz.mul(shade).mul(ao.mul(0.2).add(0.4)).mul(lm), 'vColour');
  const vDist = varying(length(positionWorld.xz.sub(cameraPosition.xz)), 'vDist');

  const colour = Fn(() => {
    const here = u.atlas.sample(vUv.xy).depth(layerOf(vUv.z));
    const tex = select(vBlend.greaterThan(0), mix(here, u.atlas.sample(vUv.xy).depth(layerOf(vNext)), vBlend), here).toVar();
    if (pass === 'cutout') {
      If(tex.a.lessThan(0.5), () => {
        Discard();
      });
    }
    const lit = mix(tex.rgb.mul(vColour), u.fogColour, smoothstep(u.fogNear, u.fogFar, vDist));
    return vec4(lit, pass === 'water' ? tex.a : float(1));
  });

  const material = made(MeshBasicNodeMaterial, { side: pass === 'opaque' ? THREE.FrontSide : THREE.DoubleSide, transparent: pass === 'water', depthWrite: pass !== 'water' }, colour());
  material.u = u;
  return material;
}

// the frames showing at a tick, into a material's `anim` (a strip's layer -1 when unused)
export function setFrames(material, anims, ticks) {
  const slots = material.u.anim.array;
  anims.slice(0, 4).forEach((an, i) => {
    const { a, b, blend } = frameAt(an, ticks);
    slots[i].set(an.layer, a, b, blend);
  });
}

// ── the sky ──

// the biome's sky over the fog's colour at the horizon, the sunrise's glow
// low on the sun's side
export function domeMaterial({ fog }) {
  const u = { sky: uniform(new THREE.Vector3()), fog: uniform(fog), glow: uniform(new THREE.Vector4()), sunDir: uniform(new THREE.Vector3(0, 1, 0)) };
  // (normalised where the vertex is, and used as it comes, as the GLSL did)
  const vDir = varying(normalize(positionLocal), 'vDir');
  const colour = Fn(() => {
    const c = mix(u.fog, u.sky, smoothstep(-0.02, 0.32, vDir.y)).toVar();
    const h = normalize(vDir.xz.add(1e-5));
    const s = normalize(u.sunDir.xz.add(1e-5));
    const side = smoothstep(0.2, 1, dot(h, s));
    const low = smoothstep(-0.1, 0.45, abs(vDir.y.sub(0.05))).oneMinus();
    return vec4(mix(c, u.glow.rgb, u.glow.a.mul(side).mul(low)), 1);
  });
  return { material: made(MeshBasicNodeMaterial, { side: THREE.BackSide, depthWrite: false, depthTest: false }, colour()), u };
}

// The stars, two pixels across as the GLSL's gl_PointSize = 2.0 made them.
// The node renderer draws a Points object a pixel across, so they're a
// Sprite drawn once a star (sky.js sets its positions and count), each a
// square two device pixels wide whatever the screen's pixel ratio, as a
// point's size was.
export function starsMaterial() {
  const u = { strength: uniform(0) };
  const material = made(PointsNodeMaterial, { blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, sizeAttenuation: false }, vec4(vec3(u.strength), 1));
  material.sizeNode = float(2).div(screenDPR);
  return { material, u };
}

// the sun or the moon: the part of the picture `frame` (u, v, width, height) says
export function spriteMaterial(map) {
  const u = { map: texture(map ?? null), frame: uniform(new THREE.Vector4(0, 0, 1, 1)), strength: uniform(1) };
  const at = u.frame.xy.add(vec2(uv().x, uv().y.oneMinus()).mul(u.frame.zw));
  const material = made(MeshBasicNodeMaterial, { blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }, vec4(u.map.sample(at).rgb.mul(u.strength), 1));
  return { material, u };
}

// the cloud layer: a texel to a 12-block cell, fading into the fog far off
export function cloudMaterial({ map, fog }) {
  const u = { map: texture(map ?? null), offset: uniform(new THREE.Vector2()), fog: uniform(fog), tint: uniform(new THREE.Vector3(1, 1, 1)), far: uniform(300) };
  const vCell = varying(positionWorld.xz.add(u.offset).div(CELL), 'vCell');
  const vDist = varying(length(positionWorld.xz.sub(cameraPosition.xz)), 'vDist');
  const colour = Fn(() => {
    const tex = u.map.sample(fract(vCell.div(256))).toVar();
    If(tex.a.lessThan(0.5), () => {
      Discard();
    });
    const fade = smoothstep(u.far.mul(0.6), u.far, vDist).oneMinus().toVar();
    return vec4(mix(u.fog, u.tint, fade), fade.mul(0.8));
  });
  return { material: made(MeshBasicNodeMaterial, { transparent: true, depthWrite: false, side: THREE.DoubleSide }, colour()), u };
}

// ── the drops and the crack ──

// a drop: its tile from the array, by the vertex's layer, times its shaded tint
export function dropMaterial(atlas) {
  const u = { atlas: texture(atlas) };
  const vUv = varying(vec3(uv().x, uv().y.oneMinus(), attribute('layer', 'float')), 'vUv');
  const vTint = varying(attribute('tint', 'vec3'), 'vTint');
  const colour = Fn(() => {
    const tex = u.atlas.sample(vUv.xy).depth(layerOf(vUv.z)).toVar();
    If(tex.a.lessThan(0.5), () => {
      Discard();
    });
    return vec4(tex.rgb.mul(vTint), 1);
  });
  const material = made(MeshBasicNodeMaterial, { side: THREE.DoubleSide }, colour());
  material.u = u;
  return material;
}

// the crack: a destroy stage over every face, multiplied into what's under
// it as the game blends it (source × destination + destination × source)
export function crackMaterial({ array, layer = 0 }) {
  const u = { atlas: texture(array), layer: uniform(layer) };
  const colour = Fn(() => {
    const tex = u.atlas.sample(vec2(uv().x, uv().y.oneMinus())).depth(layerOf(u.layer)).toVar();
    If(tex.a.lessThan(0.1), () => {
      Discard();
    });
    return vec4(tex.rgb, 1);
  });
  const material = made(
    MeshBasicNodeMaterial,
    {
      blending: THREE.CustomBlending,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.SrcColorFactor,
      blendEquation: THREE.AddEquation,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    },
    colour(),
  );
  return { material, u };
}
