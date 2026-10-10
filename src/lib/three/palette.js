// A painted world’s colours as one strip of texture, after Bruno Simon’s
// folio-2025 palette: what the site builds in code takes its colour from a
// cell of the strip rather than a material of its own, so every prop of a
// world shares one Lambert and, where it stands still, one draw. A
// modelled thing keeps its own maps; this is for boxes and the like.
//
//   createPalette(hexes) → { texture, size, uv(i) → [u, v], colour(i) → Color,
//     material(opts) → MeshLambertMaterial, paint(geometry, i) → geometry,
//     dispose() }
//
// Six to sixteen colours (a look with fewer is not a palette, more is a
// scan by another name). The strip is sampled nearest and has no mips, so a
// cell never bleeds into its neighbour however small the prop is drawn.

import * as THREE from 'three';

export function createPalette(hexes) {
  const size = hexes?.length ?? 0;
  if (size < 6 || size > 16) throw new Error(`a palette holds six to sixteen colours, not ${size}`);
  const colours = hexes.map((h) => new THREE.Color(h));
  const data = new Uint8Array(size * 4);
  colours.forEach((c, i) => {
    // (getHex is the colour back in sRGB, the strip’s own space)
    const hex = c.getHex();
    data.set([(hex >> 16) & 255, (hex >> 8) & 255, hex & 255, 255], i * 4);
  });
  const texture = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const cell = (i) => {
    if (!(i >= 0 && i < size)) throw new Error(`no colour ${i} in a palette of ${size}`);
    return i;
  };
  const uv = (i) => [(cell(i) + 0.5) / size, 0.5];

  return {
    texture,
    size,
    uv,
    colour: (i) => colours[cell(i)].clone(),
    // one Lambert on the strip; with `house` (a createHouse result) it is
    // made in the look, so a world that adopts its scene before the props
    // arrive still has them shaded its way
    material({ house, ...opts } = {}) {
      return house ? house.material({ ...opts, map: texture }) : new THREE.MeshLambertMaterial({ ...opts, map: texture });
    },
    // every corner of the geometry onto one cell: flat colour, no seams
    paint(geometry, i) {
      const [u, v] = uv(i);
      const count = geometry.attributes.position.count;
      const attr = geometry.attributes.uv?.count === count ? geometry.attributes.uv : new THREE.BufferAttribute(new Float32Array(count * 2), 2);
      for (let k = 0; k < count; k++) attr.setXY(k, u, v);
      attr.needsUpdate = true;
      geometry.setAttribute('uv', attr);
      return geometry;
    },
    dispose() {
      texture.dispose();
    },
  };
}
