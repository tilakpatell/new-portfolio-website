// A 2017 cut's caps on disk: for the import that makes it, and for the test
// that holds the committed and the published ones to them.
//
//   overCaps(cuts: [[cut, bytes]], { hero, native }) → [what is over]

// The caps a cut is held to (the pipeline design's section 6): 2.5 MB, 4 MB
// for a hero, 2.5 MB for a light cut, 24 MB for an ultra one. A native file,
// a hero's or a hero's blaster's (--native: the game's own KTX2 maps,
// untouched), carries four times the bytes for none of WebP's loss and a
// quarter of the GPU's memory, and is fetched light cut first (lib/three/walrus.js's cutsToLoad), from the
// bucket and not from git: 16 MB, 5 MB and 64 MB (Obi-Wan, in six cloth
// parts, the most). Each cut over its cap, said.
const MB = 1048576;
export const CAPS = { plain: 2.5 * MB, hero: 4 * MB, lod1: 2.5 * MB, ultra: 24 * MB };
export const NATIVE_CAPS = { plain: 16 * MB, lod1: 5 * MB, ultra: 64 * MB };
export function overCaps(cuts, { hero = false, native = false } = {}) {
  const cap = native ? NATIVE_CAPS : { plain: hero ? CAPS.hero : CAPS.plain, lod1: CAPS.lod1, ultra: CAPS.ultra };
  return cuts.filter(([cut, bytes]) => bytes > cap[cut]).map(([cut, bytes]) => `${cut}: ${(bytes / MB).toFixed(1)} MB over ${(cap[cut] / MB).toFixed(1)} MB`);
}
