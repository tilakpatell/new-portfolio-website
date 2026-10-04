// The CC0 PBR materials the 3D games use (Poly Haven, fetched by
// scripts/cc0.mjs into /games/tex): colour, normal, and AO/roughness/
// metalness packed in one map. A set loads once per game; a material made
// from it can repeat its textures without uploading them again.

import * as THREE from 'three';

export function createLibrary(renderer) {
  const sets = new Map();
  const made = [];
  const loader = new THREE.TextureLoader();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const one = (name, file, srgb) =>
    new Promise((resolve, reject) => {
      loader.load(
        `/games/tex/${name}/${file}.webp`,
        (t) => {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.anisotropy = aniso;
          if (srgb) t.colorSpace = THREE.SRGBColorSpace;
          made.push(t);
          resolve(t);
        },
        undefined,
        reject,
      );
    });

  // Resolves to { color, normal, arm, emission? }, or null if any part can't
  // load (the game then paints its own). `emission` for sets that glow (the
  // facades' lit windows).
  const load = (name, { emission = false } = {}) => {
    if (!sets.has(name)) {
      const parts = [one(name, 'color', true), one(name, 'normal', false), one(name, 'arm', false)];
      if (emission) parts.push(one(name, 'emission', true));
      sets.set(
        name,
        Promise.all(parts)
          .then(([color, normal, arm, glow]) => ({ color, normal, arm, emission: glow ?? null }))
          .catch(() => null),
      );
    }
    return sets.get(name);
  };

  // A material from a set, its textures repeated `repeat` times. Clones share
  // the image (and the upload); only the UV transform differs.
  const material = (set, { repeat = [1, 1], metal = false, ...extra } = {}) => {
    const rep = (t) => {
      const c = t.clone();
      c.repeat.set(repeat[0], repeat[1]);
      c.needsUpdate = true;
      made.push(c);
      return c;
    };
    const arm = rep(set.arm);
    return new THREE.MeshStandardMaterial({
      map: rep(set.color),
      normalMap: rep(set.normal),
      aoMap: arm,
      aoMapIntensity: 0.9,
      roughnessMap: arm,
      metalnessMap: metal ? arm : null,
      roughness: 1,
      metalness: metal ? 1 : 0,
      emissiveMap: set.emission ? rep(set.emission) : null,
      emissive: set.emission ? new THREE.Color(1, 1, 1) : new THREE.Color(0, 0, 0),
      ...extra,
    });
  };

  // Just the relief and the shine of a set, for surfaces whose colour comes
  // from elsewhere (painted armour).
  const detail = (set, { repeat = [1, 1] } = {}) => {
    const rep = (t) => {
      const c = t.clone();
      c.repeat.set(repeat[0], repeat[1]);
      c.needsUpdate = true;
      made.push(c);
      return c;
    };
    return { normal: rep(set.normal), rough: rep(set.arm) };
  };

  const dispose = () => {
    made.forEach((t) => t.dispose());
    made.length = 0;
    sets.clear();
  };

  return { load, material, detail, dispose };
}
