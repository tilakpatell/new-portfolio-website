// A material dyed a colour: it keeps its light and shade, the luminance of
// its texture (folds, seams, wear), and takes the dye's hue in place of its
// own. The Death Star's troops wear the officer's uniform dyed charcoal,
// and the Royal Guard the senate guard's robes dyed crimson; a tint (a
// multiply) took the olive and the blue down to black. The Rick and Morty
// planets dye their people with it too (rickmorty/planets/cast.js).
//
//   dyeShader(fragmentShader) → fragmentShader   the dye laid in after the map is read
//   dyed(material, { color, gain = 2, keep = 0, skin = true, roughness?, metalness? }) → a copy
//     color: the dye (0xrrggbb); gain: how bright a mid-grey texel comes out (the dye at
//     luminance × gain, up to 1.6 of it); keep: how much of the material's own colour stays
//     (0…1); skin: faces and hands keep theirs; roughness, metalness: the cloth's finish, where it
//     isn't the material's

import * as THREE from 'three';

const PARS = 'uniform vec3 uDye;\nuniform float uDyeGain;\nuniform float uDyeKeep;\nuniform float uDyeSkin;\n';
const AFTER = '#include <map_fragment>';
// (skin: a warm texel, red over green over blue, is a face or a hand and keeps its colour; an olive
// or a blue cloth has its green or its blue over its red)
const DYE = `
{
  vec3 dyeOwn = diffuseColor.rgb;
  float dyeLum = dot(dyeOwn, vec3(0.299, 0.587, 0.114));
  float dyeSkin = uDyeSkin * smoothstep(0.04, 0.12, dyeOwn.r - dyeOwn.b) * smoothstep(0.0, 0.03, dyeOwn.r - dyeOwn.g);
  diffuseColor.rgb = mix(uDye * clamp(dyeLum * uDyeGain, 0.0, 1.6), dyeOwn, max(uDyeKeep, dyeSkin));
}`;

export function dyeShader(frag) {
  if (!frag.includes(AFTER)) return frag;
  return PARS + frag.replace(AFTER, `${AFTER}${DYE}`);
}

export function dyed(material, { color, gain = 2, keep = 0, skin = true, roughness, metalness } = {}) {
  const m = material.clone();
  // (the dye is the colour: a texture's own colour would be multiplied in under it; a material
  // with no texture is its colour alone, and that is the luminance to dye)
  if (m.color && m.map) m.color.set(0xffffff);
  if (roughness !== undefined) m.roughness = roughness;
  if (metalness !== undefined) m.metalness = metalness;
  const uniforms = {
    uDye: { value: new THREE.Color(color) },
    uDyeGain: { value: gain },
    uDyeKeep: { value: keep },
    uDyeSkin: { value: skin ? 1 : 0 },
  };
  const before = material.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    before?.call(m, sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.fragmentShader = dyeShader(sh.fragmentShader);
  };
  const key = material.customProgramCacheKey;
  m.customProgramCacheKey = () => `${key && key !== THREE.Material.prototype.customProgramCacheKey ? key.call(m) : ''}|dye`;
  return m;
}
