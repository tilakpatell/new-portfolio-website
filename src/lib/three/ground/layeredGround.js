// A level's ground in the game's own layers (lane Q2: docs/superpowers/
// specs/2026-10-10-bf2017-surfaces-design.md, "The ground"), as a node
// material for lane L's heightmap ground on a node renderer. Per paint
// layer (ground.json, written by scripts/bf2017-ground.mjs) a tiling detail
// normal over the ground's own, triplanar on the steep layer's slopes; the
// layers blended by the masks (one RGBA texture, a layer a channel), by
// height where the layer maps carry one; the snow's sparkle as a glint of
// the sun; and past FADE the detail gone to the macro colour, so the far
// ground is one even shade with no seam where the detail ends. The classic
// worlds keep groundLook.js.
//
// Tiers (Review Focus 5): ultra and high four layers (4 detail samples, 2
// more for the steep layer's triplanar, 1 sparkle, 1 mask); mid the two
// layers with the most ground, no triplanar, no sparkle; low the macro
// colour alone. A layer whose map has not landed in the bucket draws its
// colour and roughness without detail.
//
//   createLayeredGround({ ground, maps, tier, three, entry }) → {
//     material, samples, uniforms, setSun(dir, color?), update(camera), dispose }
//   (maps: { layers: { [id]: Texture }, sparkle: Texture | null, masks: Texture };
//    three: loadThree()'s { THREE, tsl })
//
//   attachLayeredGround({ mesh, renderer, pack, tier, entry, fetchBytes, urlOf }) → { ready, dispose }
//     (a level pack's ground.json and maps fetched, the material built and
//     put on the ground's mesh; its own material back on dispose. fetchBytes
//     reads a pack file, urlOf names a pack file's URL at the tier's size.)
//
// Pure, for the tests: triplanarWeights(n), planarShare(slopeDeg),
// heightBlend(masks, heights, k), macroFade(d, fade), layersFor(ground, tier), meanTint(ground)

import { readEntry } from '../light/entry.js';
import { loadThree } from '../light/three.js';

export const TIER_LAYERS = { ultra: 4, high: 4, mid: 2, low: 0 };
// degrees: planar under the first, triplanar over the second (35° ± 5°)
export const TRIPLANAR = [30, 40];
// how much the detail normal bends the ground's (UDN: n + d × strength)
export const DETAIL_STRENGTH = 0.6;
// the triplanar weights' sharpness: |n|^4, normalised
const TRI_SHARPNESS = 4;
// each layer's shade of the macro colour, until the colour map is decoded:
// rock shows through the rocky snow, the packed snow is the brightest
export const TINT = { rocky: 0.8, chunky: 0.96, rough: 0.98, packed: 1.03, snow: 1 };
// the sparkle: its glint's sharpness against the sun, and its strength
// against the sun's colour (judged on the shot)
export const SPARKLE = { power: 64, gain: 2 };

const kindOf = (l) => Object.keys(TINT).find((k) => l.id === k || l.name?.toLowerCase().includes(k)) ?? 'snow';
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function triplanarWeights([x, y, z], k = TRI_SHARPNESS) {
  const w = [Math.abs(x) ** k, Math.abs(y) ** k, Math.abs(z) ** k];
  const s = w[0] + w[1] + w[2] || 1;
  return w.map((v) => v / s);
}

export const planarShare = (slopeDeg) => 1 - smooth(TRIPLANAR[0], TRIPLANAR[1], slopeDeg);

export function heightBlend(masks, heights, k) {
  const w = masks.map((m, i) => (m * (heights[i] ?? 1)) ** k);
  const s = w.reduce((a, b) => a + b, 0);
  return s > 1e-8 ? w.map((v) => v / s) : masks.slice();
}

export const macroFade = (d, fade) => smooth(fade.start, fade.end, d);

// the layers a tier draws, in ground.json's order: the n with the most ground
export function layersFor(ground, tier) {
  const n = TIER_LAYERS[tier] ?? TIER_LAYERS.high;
  const share = ground.masks?.share ?? {};
  const keep = new Set(
    [...ground.layers]
      .sort((a, b) => (share[b.id] ?? 0) - (share[a.id] ?? 0))
      .slice(0, n)
      .map((l) => l.id),
  );
  return ground.layers.filter((l) => keep.has(l.id));
}

// the far ground's shade: the near layers' tints weighed by how much ground each has
export function meanTint(ground) {
  const share = ground.masks?.share ?? {};
  let s = 0;
  let w = 0;
  for (const l of ground.layers) {
    const a = share[l.id] ?? 1 / ground.layers.length;
    s += a * TINT[kindOf(l)];
    w += a;
  }
  return w ? s / w : 1;
}

function meanRoughness(ground) {
  const share = ground.masks?.share ?? {};
  let s = 0;
  let w = 0;
  for (const l of ground.layers) {
    const a = share[l.id] ?? 1 / ground.layers.length;
    s += a * l.roughness.value;
    w += a;
  }
  return w ? s / w : 0.6;
}

// the steep layer: the one whose rule starts at a slope (the rock of the ridges)
const steepOf = (ground) => ground.rules?.find((r) => r.slope?.[0] != null && r.slope[0] >= TRIPLANAR[0] - 5)?.layer ?? null;

export function createLayeredGround({ ground, maps = {}, tier = 'high', three, entry = null }) {
  const { THREE, tsl } = three;
  const { uniform, texture, vec2, vec3, vec4, float, positionWorld, normalWorldGeometry, cameraPosition, cameraViewMatrix, mix, smoothstep, pow, max, abs, normalize, dot, reflect, acos } = tsl;
  const light = readEntry(entry ?? {});
  const macro = ground.macro?.color ?? [0.6, 0.6, 0.6];
  const tintFar = meanTint(ground);
  const roughFar = meanRoughness(ground);
  const u = {
    sun: uniform(new THREE.Vector3(...light.sun.dir).normalize()),
    sunColor: uniform(new THREE.Color(...light.sun.color)),
    macro: uniform(new THREE.Color(...macro)),
    fadeStart: uniform(ground.fade.start),
    fadeEnd: uniform(ground.fade.end),
  };
  const samples = { detail: 0, triplanar: 0, sparkle: 0, mask: 0 };
  const material = new THREE.MeshStandardNodeMaterial({ metalness: 0 });
  material.name = `layered-ground:${ground.world}`;
  const layers = layersFor(ground, tier);

  if (!layers.length || !maps.masks) {
    // (low, or no masks: the macro colour alone, as the far ground is)
    material.colorNode = vec3(u.macro).mul(tintFar);
    material.roughnessNode = float(roughFar);
    return finish();
  }

  const xz = positionWorld.xz;
  const nGeo = normalize(normalWorldGeometry);
  const fade = smoothstep(u.fadeStart, u.fadeEnd, positionWorld.sub(cameraPosition).length());
  const mf = ground.masks;
  const maskUv = xz.sub(vec2(mf.minX, mf.minZ)).div(mf.metresPerPixel).add(0.5).div(vec2(mf.w, mf.h));
  const mask = texture(maps.masks, maskUv);
  samples.mask = 1;
  const channel = (c) => [mask.r, mask.g, mask.b, mask.a][c];

  // per layer: its weight, and its bend of the normal (world space)
  const steep = steepOf(ground);
  const height = ground.blend?.mode === 'height';
  const k = ground.blend?.sharpness ?? 4;
  const parts = layers.map((l) => {
    const map = maps.layers?.[l.id] ?? null;
    let w = channel(l.channel);
    let bend = null;
    if (map) {
      const s = texture(map, xz.div(l.tile));
      samples.detail++;
      const d = s.xy.mul(2).sub(1);
      // (tangent x along world x, tangent y along world z: the ground faces up)
      bend = vec3(d.x, 0, d.y);
      if (height) w = pow(w.mul(s.b), k);
      if (l.id === steep && (tier === 'ultra' || tier === 'high')) {
        // the ridge's faces: projected along x and z as well, the three
        // weighed by the normal, planar under 30° and triplanar over 40°
        const p = positionWorld.div(l.tile);
        const dx = texture(map, p.zy).xy.mul(2).sub(1);
        const dz = texture(map, p.xy).xy.mul(2).sub(1);
        samples.triplanar += 2;
        const a = pow(abs(nGeo), vec3(TRI_SHARPNESS));
        const tw = a.div(a.x.add(a.y).add(a.z));
        const tri = vec3(0, dx.y, dx.x).mul(tw.x).add(bend.mul(tw.y)).add(vec3(dz.x, dz.y, 0).mul(tw.z));
        const slope = acos(nGeo.y.clamp(-1, 1)).mul(180 / Math.PI);
        bend = mix(tri, bend, float(1).sub(smoothstep(TRIPLANAR[0], TRIPLANAR[1], slope)));
      }
    }
    return { l, w, bend };
  });
  const total = parts.reduce((a, p) => a.add(p.w), float(0)).max(1e-4);
  const weight = (p) => p.w.div(total);

  let bend = null;
  for (const p of parts) if (p.bend) bend = bend ? bend.add(p.bend.mul(weight(p))) : p.bend.mul(weight(p));
  const near = (fn) => parts.reduce((a, p) => a.add(weight(p).mul(fn(p.l))), float(0));
  const tint = near((l) => TINT[kindOf(l)]);
  material.colorNode = vec3(u.macro).mul(mix(tint, float(tintFar), fade));
  material.roughnessNode = mix(near((l) => l.roughness.value), float(roughFar), fade);
  const n = bend ? normalize(nGeo.add(bend.mul(DETAIL_STRENGTH).mul(float(1).sub(fade)))) : nGeo;
  if (bend) material.normalNode = normalize(cameraViewMatrix.mul(vec4(n, 0)).xyz);

  // the sparkle: a fine glint where the sun's reflection meets a crystal
  if (maps.sparkle && ground.sparkle && (tier === 'ultra' || tier === 'high')) {
    const crystal = texture(maps.sparkle, xz.div(ground.sparkle.tile)).r;
    samples.sparkle = 1;
    const view = normalize(cameraPosition.sub(positionWorld));
    const glint = pow(max(dot(reflect(view.negate(), n), u.sun), 0), SPARKLE.power);
    const rock = parts.find((p) => p.l.id === steep);
    const snow = rock ? float(1).sub(weight(rock)) : float(1);
    material.emissiveNode = vec3(u.sunColor).mul(glint.mul(crystal).mul(snow).mul(float(1).sub(fade)).mul(SPARKLE.gain));
  }
  return finish();

  function finish() {
    return {
      material,
      samples,
      uniforms: u,
      setSun(dir, color = null) {
        u.sun.value.set(...dir).normalize();
        if (color) u.sunColor.value.setRGB(...color);
      },
      // (the fade and the glint read the camera through the node renderer's
      // own uniforms: nothing a frame yet; the hook stays for the far map)
      update() {},
      dispose() {
        material.dispose();
      },
    };
  }
}

// The masks PNG as a texture: 8 bits a channel, linear, no flip (row 0 is
// the frame's minZ, as the heightmap's)
async function maskTexture(THREE, bytes) {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }), { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const t = new THREE.Texture(bitmap);
  t.flipY = false;
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

export function attachLayeredGround({ mesh, renderer, pack, tier, entry = null, fetchBytes, urlOf }) {
  const own = mesh.material;
  const owned = [];
  let built = null;
  let gone = false;
  const ready = (async () => {
    const three = await loadThree();
    const ground = JSON.parse(new TextDecoder().decode(await fetchBytes(pack.ground)));
    // (a map that cannot be had leaves its layer without detail)
    const masks = await fetchBytes(ground.masks.png)
      .then((b) => maskTexture(three.THREE, b))
      .catch(() => null);
    const want = layersFor(ground, tier);
    const ktx = want.some((l) => l.map) || ground.sparkle?.map ? await import('../gltf.js').then((m) => m.ktx2Loader({ renderer })) : null;
    const load = (path, repeat) =>
      ktx
        .loadAsync(urlOf(path, tier))
        .then((t) => {
          if (repeat) t.wrapS = t.wrapT = three.THREE.RepeatWrapping;
          t.anisotropy = renderer?.getMaxAnisotropy?.() ?? 1;
          return t;
        })
        .catch(() => null);
    const layers = {};
    await Promise.all(want.filter((l) => l.map).map(async (l) => (layers[l.id] = await load(l.map, true))));
    const sparkle = ground.sparkle?.map ? await load(ground.sparkle.map, true) : null;
    owned.push(masks, sparkle, ...Object.values(layers));
    if (gone) return null;
    built = createLayeredGround({ ground, maps: { layers, sparkle, masks }, tier, three, entry });
    mesh.material = built.material;
    return built;
  })().catch((e) => {
    if (import.meta.env?.DEV) console.warn('layered ground failed', e);
    return null;
  });
  return {
    ready,
    get ground() {
      return built;
    },
    dispose() {
      gone = true;
      if (built) {
        mesh.material = own;
        built.dispose();
      }
      for (const t of owned) t?.dispose();
    },
  };
}
