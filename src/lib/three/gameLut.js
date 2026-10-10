// A game's grading LUT for the post's final pass (universe/post.js grading):
// the strip scripts/bf2017-light.mjs writes (n slices of n × n side by side,
// blue the slice, green the row, red the column) unpacked into the cube a
// Data3DTexture holds (red along x, green along y, blue along z).

import * as THREE from 'three';

// strip: RGBA bytes, n² wide and n high → RGBA bytes of the n³ cube
export function cubeFromStrip(strip, n) {
  const out = new Uint8Array(n * n * n * 4);
  for (let b = 0; b < n; b++) {
    for (let g = 0; g < n; g++) {
      for (let r = 0; r < n; r++) {
        const src = (g * n * n + b * n + r) * 4;
        const dst = ((b * n + g) * n + r) * 4;
        out[dst] = strip[src];
        out[dst + 1] = strip[src + 1];
        out[dst + 2] = strip[src + 2];
        out[dst + 3] = 255;
      }
    }
  }
  return out;
}

// The LUT at url as a texture, read through a canvas (the browser decodes
// the PNG). Linear filtering between the cube's points, clamped at its ends.
export async function loadLut(url, n) {
  const img = await createImageBitmap(await (await fetch(url)).blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const canvas = new OffscreenCanvas(img.width, img.height);
  const g = canvas.getContext('2d');
  g.drawImage(img, 0, 0);
  img.close?.();
  const tex = new THREE.Data3DTexture(cubeFromStrip(g.getImageData(0, 0, n * n, n).data, n), n, n, n);
  tex.format = THREE.RGBAFormat;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}
