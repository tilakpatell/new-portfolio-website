// Image-based lighting from a real HDRI (CC0, from Poly Haven by way of
// @pmndrs/assets; see public/cc0). Scenes start lit by Three's built-in
// RoomEnvironment and swap to the HDRI once it has loaded, so nothing waits
// on the download, and a failed one just keeps the room.
import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

export const cc0 = (file) => `${import.meta.env.BASE_URL}cc0/${file}`;

export function loadEnvironment(renderer, file) {
  return new Promise((resolve, reject) => {
    new EXRLoader().load(
      cc0(file),
      (hdr) => {
        try {
          hdr.mapping = THREE.EquirectangularReflectionMapping;
          const pmrem = new THREE.PMREMGenerator(renderer);
          const env = pmrem.fromEquirectangular(hdr).texture;
          pmrem.dispose();
          hdr.dispose();
          resolve(env);
        } catch (e) {
          reject(e);
        }
      },
      undefined,
      reject,
    );
  });
}

export function loadTexture(file, { srgb = true } = {}) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      cc0(file),
      (t) => {
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        resolve(t);
      },
      undefined,
      reject,
    );
  });
}

// A CC0 PBR material set from public/cc0/materials/<name>: colour, an OpenGL
// normal map, and ARM (ambient occlusion, roughness, metalness in R, G, B,
// the way Three reads them). From Poly Haven and ambientCG, at 1K.
export function loadPbr(name) {
  const at = (f, srgb) => loadTexture(`materials/${name}/${f}.webp`, { srgb });
  return Promise.all([at('color', true), at('normal', false), at('arm', false)]).then(([color, normal, arm]) => ({ color, normal, arm }));
}
