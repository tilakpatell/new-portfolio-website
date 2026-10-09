// A kit material in a colour its map wasn't painted in: the map's light and
// shade kept, its hue the world's. A tint that multiplies (the kit's plain
// `tint`, lib/three/kit) can only darken a map toward a colour, and the
// kit's maps are painted: its twisted trees' leaves are autumn red, its
// grass a green strip, so no multiplier makes a jungle's crown green or a
// prairie's grass straw. Recoloured, the map is read for its brightness
// alone, over the map's own mean (so the colour asked for is the colour
// seen, on average), and that is the colour's.
//
//   meanLuma(image, { cut }) → the mean linear luminance of an ImageData-
//     shaped image's pixels whose alpha is over the cut (a leaf's cut-out
//     background isn't its colour), null for none (pure)
//   recolourShader(shader) → { vertexShader, fragmentShader, swapped }:
//     the colour put in after the map is read (pure, on the shader's text)
//   recolour(material, colour, { ref }) → the material, the rewrite chained
//     onto what it already does (the house's look, the wind), once;
//     material.userData.recolour holds its uniforms (uRecolourRef: the
//     map's mean, set once the map is in: measureMap)
//   measureMap(texture) → the map's meanLuma, read off a small canvas, or
//     null where there's no canvas (Node) or the pixels can't be read

import * as THREE from 'three';

export const REF = 0.25; // (a map's mean until it's measured: a mid leaf green's)
const LUMA = [0.2126, 0.7152, 0.0722];
const SIDE = 32; // (the canvas a map is measured on: its mean needs no more)

const linear = (byte) => {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function meanLuma({ width, height, data }, { cut = 0.3 } = {}) {
  if (!(width > 0 && height > 0) || !data) return null;
  const edge = cut * 255;
  let sum = 0;
  let n = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] <= edge) continue;
    sum += LUMA[0] * linear(data[i]) + LUMA[1] * linear(data[i + 1]) + LUMA[2] * linear(data[i + 2]);
    n++;
  }
  return n ? sum / n : null;
}

const MAP = '#include <map_fragment>';

export function recolourShader({ vertexShader, fragmentShader }) {
  if (!fragmentShader.includes(MAP) || !fragmentShader.includes('#include <common>')) return { vertexShader, fragmentShader, swapped: false };
  const fs = fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRecolour;\nuniform float uRecolourRef;').replace(
    MAP,
    `${MAP}
#ifdef USE_MAP
	diffuseColor.rgb = uRecolour * clamp( dot( sampledDiffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) / uRecolourRef, 0.0, 2.0 );
#endif`,
  );
  return { vertexShader, fragmentShader: fs, swapped: true };
}

export function recolour(material, colour, { ref = REF } = {}) {
  if (!material || material.userData.recolour) return material;
  const uniforms = { uRecolour: { value: new THREE.Color(colour) }, uRecolourRef: { value: ref } };
  // (with no map to read, the material's own colour does the same)
  material.color?.set(colour);
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    before?.call(material, sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.fragmentShader = recolourShader(sh).fragmentShader;
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|recolour`;
  material.userData.recolour = uniforms;
  material.needsUpdate = true;
  return material;
}

export function measureMap(texture, { cut = 0.3 } = {}) {
  if (!texture?.isTexture || typeof document === 'undefined') return null;
  const img = texture.source?.data ?? texture.image;
  if (!(img?.width > 0 && img?.height > 0)) return null;
  try {
    const c = document.createElement('canvas');
    c.width = SIDE;
    c.height = SIDE;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, SIDE, SIDE);
    return meanLuma(ctx.getImageData(0, 0, SIDE, SIDE), { cut });
  } catch {
    // (a tainted canvas, a bitmap it couldn't draw: the default mean stands)
    return null;
  }
}
