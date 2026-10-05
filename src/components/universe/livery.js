// A paint job (paint.js) on a ship: its lit materials taught to wear one.
// The ships' models are one texture each, so the paint can't go on a part at
// a time: it reads each texel instead. The ship's plain panels take the
// hull's colour and its markings the trim's (each ship says how its own
// markings stand out: by their colour, like the X-wing's red stripes, or by
// being darker, like the Falcon's plating), keeping their own light and
// shade; the darkest bits (glass, vents, the engines' insides) stay as they
// were. The factory paint leaves the texture alone.
//
// Every material is changed once and the paint is in its uniforms, shared
// by the whole ship, so a new paint is only new numbers: nothing is
// recompiled. Materials that already have their own changes (the cruiser's
// glass dome) keep them; a mesh marked userData.noPaint (its crew) is left
// alone, and so is anything unlit (the engines' glow, the ink).
//
// createLivery() → { apply(root, fit, { clone }), set(paint), dispose() }
// fit: { mid, marks: [from, to], dark: [from, to, how much], keep } (linear
//   luminance and saturation): the luminance of a plain panel, where the
//   saturation becomes a marking, where darkness does (and how strongly),
//   and below which the texel is left as it is.
// clone: copy each material before changing it (it's shared with others).

import * as THREE from 'three';

const DECLARE = `
uniform vec3 paintHull;
uniform vec3 paintTrim;
uniform float paintOn;
uniform vec4 paintFit;
uniform vec4 paintDark;`;

// after the texture's been read into diffuseColor (linear)
const PAINT = `
if (paintOn > 0.0) {
  vec3 bare = diffuseColor.rgb;
  float lum = dot(bare, vec3(0.2126, 0.7152, 0.0722));
  float top = max(bare.r, max(bare.g, bare.b));
  float sat = top > 0.0001 ? 1.0 - min(bare.r, min(bare.g, bare.b)) / top : 0.0;
  float marked = max(smoothstep(paintFit.y, paintFit.z, sat), paintDark.z * (1.0 - smoothstep(paintDark.x, paintDark.y, lum)));
  float shade = clamp(pow(lum / paintFit.x, 0.7), 0.3, 1.5);
  vec3 coat = min(mix(paintHull, paintTrim, marked) * shade, vec3(1.0));
  diffuseColor.rgb = mix(bare, coat, paintOn * smoothstep(paintFit.w * 0.5, paintFit.w, lum));
}`;

const lit = (m) => Boolean(m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial));

// A material taught the paint, on top of whatever it's already taught.
function teach(m, uniforms) {
  const before = m.onBeforeCompile;
  const key = m.customProgramCacheKey;
  m.onBeforeCompile = function (shader, renderer) {
    before.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>${DECLARE}`).replace('#include <map_fragment>', `#include <map_fragment>${PAINT}`);
  };
  // (its own changes still tell its programs apart)
  m.customProgramCacheKey = function () {
    return `${key.call(this)}|paint`;
  };
  m.needsUpdate = true;
  m.userData.painted = true;
}

export function createLivery() {
  const shared = {
    paintHull: { value: new THREE.Color() },
    paintTrim: { value: new THREE.Color() },
    paintOn: { value: 0 },
  };
  const copies = [];
  return {
    apply(root, fit, { clone = false } = {}) {
      const uniforms = {
        ...shared,
        paintFit: { value: new THREE.Vector4(fit.mid, fit.marks[0], fit.marks[1], fit.keep) },
        paintDark: { value: new THREE.Vector4(...(fit.dark ?? [0, 0.001, 0]), 0) },
      };
      const one = (m) => {
        if (!lit(m) || m.userData.painted) return m;
        const p = clone ? m.clone() : m;
        if (clone) copies.push(p);
        teach(p, uniforms);
        return p;
      };
      root.traverse((o) => {
        if (!o.isMesh || o.userData.noPaint || o.userData.ink) return;
        o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
      });
      return root;
    },
    // a paint from paint.js (the factory's has no hull: the texture as it is)
    set(paint) {
      shared.paintOn.value = paint?.hull ? 1 : 0;
      if (!paint?.hull) return;
      shared.paintHull.value.set(paint.hull);
      shared.paintTrim.value.set(paint.trim);
    },
    dispose() {
      for (const m of copies) m.dispose();
      copies.length = 0;
    },
  };
}
