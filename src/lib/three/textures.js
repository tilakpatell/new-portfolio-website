// Textures set up the same way everywhere: as sharp at a slant as the device
// can afford, in the right colour space, decoded off the main thread where
// the browser can, and uploaded to the graphics chip before they're first
// drawn. Every loader and every painted canvas goes through `sharpen`, so a
// floor seen from a cockpit, a model's deck plates and a planet's map all get
// the tier's anisotropy (lib/device: 16 on a desktop, 4 on a phone, 1 on a
// weak one) instead of whatever number the file that made them happened to
// pick.
//
//   sharpen(texture, { renderer, color, repeat, wrap, mipmaps, aniso })
//   sharpenMaterial(material, opts), sharpenTree(root, opts)
//   loadTexture(url, { renderer, color, ...sharpen's }) → Promise<Texture>
//   variant(url, suffix, use) → the -sm / -512 file for a smaller tier
//   warm(renderer, root | [textures]) → uploads now, not on the first frame
//
// Only lazily loaded scene modules import this, so a page that never draws
// in 3D never downloads three.js.

import * as THREE from 'three';
import { budget } from '../device';

// The anisotropy to ask for: the tier's, no more than the graphics chip has
// (16 on most; 1 where the extension is missing, which three reports as 1).
export function anisotropyFor(max, want = budget().aniso) {
  const cap = Number.isFinite(max) && max >= 1 ? max : 16;
  const w = Number.isFinite(want) && want >= 1 ? want : 1;
  return Math.max(1, Math.min(w, cap));
}

export const MAP_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'bumpMap', 'displacementMap', 'alphaMap', 'specularMap', 'specularColorMap', 'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'sheenColorMap', 'transmissionMap', 'thicknessMap'];

// Settings a texture gets once: anisotropy from the budget (under the
// renderer's maximum when one is given), colour space (`color: true` for
// sRGB, false for a data map, undefined leaves it), wrapping and repeat.
// Mipmaps stay on unless `mipmaps: false` (a sky always seen magnified).
export function sharpen(texture, { renderer = null, color, repeat = null, wrap = null, mipmaps = true, aniso = null } = {}) {
  if (!texture?.isTexture) return texture;
  const max = renderer?.capabilities?.getMaxAnisotropy?.() ?? 16;
  texture.anisotropy = anisotropyFor(max, aniso ?? undefined);
  if (color === true) texture.colorSpace = THREE.SRGBColorSpace;
  else if (color === false) texture.colorSpace = THREE.NoColorSpace;
  if (wrap === true) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  else if (wrap === false) texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  if (repeat) {
    if (wrap == null) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  if (!mipmaps) {
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
  }
  texture.needsUpdate = true;
  return texture;
}

// Every map a material holds. Colour maps and data maps keep their own
// colour spaces (a loaded model's are already right; this only sharpens).
export function sharpenMaterial(material, opts = {}) {
  if (!material) return material;
  for (const slot of MAP_SLOTS) {
    const t = material[slot];
    if (t?.isTexture) sharpen(t, { ...opts, color: undefined });
  }
  return material;
}

// Every map under a root (a loaded model), once.
export function sharpenTree(root, opts = {}) {
  if (!root?.traverse) return root;
  const seen = new Set();
  root.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (seen.has(m)) continue;
      seen.add(m);
      sharpenMaterial(m, opts);
    }
  });
  return root;
}

// The smaller file for a smaller tier: variant('/t/day.webp', '-sm', true)
// is '/t/day-sm.webp'; with `use` false the URL comes back as it is.
export function variant(url, suffix = '-sm', use = true) {
  if (!use || !suffix) return url;
  const q = url.search(/[?#]/);
  const path = q < 0 ? url : url.slice(0, q);
  const tail = q < 0 ? '' : url.slice(q);
  const dot = path.lastIndexOf('.');
  const slash = path.lastIndexOf('/');
  if (dot <= slash) return `${path}${suffix}${tail}`;
  return `${path.slice(0, dot)}${suffix}${path.slice(dot)}${tail}`;
}

// Whether this browser decodes images off the main thread well enough to use
// (three's own GLTFLoader draws the same line: not Safari before 17, not
// Firefox before 98, and only where createImageBitmap exists).
export function imageBitmapOk(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '', has = typeof createImageBitmap !== 'undefined') {
  if (!has) return false;
  const safari = /^((?!chrome|android).)*safari/i.test(ua);
  if (safari) {
    const v = ua.match(/Version\/(\d+)/);
    if (!v || parseInt(v[1], 10) < 17) return false;
  }
  const ff = ua.match(/Firefox\/(\d+)\./);
  if (ff && parseInt(ff[1], 10) < 98) return false;
  return true;
}

let bitmapLoader = null;
let plainLoader = null;
const loaders = () => {
  if (!plainLoader) {
    plainLoader = new THREE.TextureLoader();
    if (imageBitmapOk()) {
      bitmapLoader = new THREE.ImageBitmapLoader();
      // decoded the way a TextureLoader image is drawn: flipped for GL's
      // bottom-up rows (an ImageBitmap can't be flipped at upload), alpha
      // kept straight
      bitmapLoader.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });
    }
  }
  return { bitmap: bitmapLoader, plain: plainLoader };
};

// A texture from a URL, decoded off the main thread where the browser can
// (ImageBitmapLoader; a TextureLoader otherwise), then sharpened. Shared
// by URL for the page's life: two scenes asking for the same file get one
// download, one decode and one texture, set up the way the first asked
// (clone it where two need it to differ). Rejects if the file can't be had
// (and forgets it, so a later try asks again).
const cache = new Map(); // url → Promise<Texture>
export function loadTexture(url, { renderer = null, color = true, ...rest } = {}) {
  if (!cache.has(url)) {
    const { bitmap, plain } = loaders();
    const p = bitmap
      ? bitmap.loadAsync(url).then((img) => {
          const t = new THREE.Texture(img);
          t.flipY = false; // (the bitmap was flipped as it was decoded)
          return t;
        })
      : plain.loadAsync(url);
    cache.set(
      url,
      p.then((t) => sharpen(t, { renderer, color, ...rest })).catch((e) => {
        cache.delete(url);
        throw e;
      }),
    );
  }
  return cache.get(url);
}

// Forget a cached texture (the caller disposes it).
export function forgetTexture(url) {
  cache.delete(url);
}

// Upload every texture under `root` (or in a list) now, in a quiet moment,
// so the first frame that shows them doesn't pay for it.
export function warm(renderer, what) {
  if (!renderer?.initTexture) return 0;
  const textures = new Set();
  const add = (t) => t?.isTexture && textures.add(t);
  if (Array.isArray(what)) what.forEach(add);
  else if (what?.isTexture) add(what);
  else if (what?.traverse) {
    what.traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const slot of MAP_SLOTS) add(m[slot]);
        if (m.uniforms) for (const u of Object.values(m.uniforms)) add(u?.value);
      }
    });
  }
  let n = 0;
  for (const t of textures) {
    try {
      if (t.image || t.isCompressedTexture || t.isDataTexture) {
        renderer.initTexture(t);
        n += 1;
      }
    } catch {
      // a texture that isn't ready yet uploads on its first frame instead
    }
  }
  return n;
}
