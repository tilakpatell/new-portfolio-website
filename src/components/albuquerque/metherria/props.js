// Walt's drums and hammer: models made for the site with Meshy AI by
// scripts/meshy-albuquerque.mjs, already in the scene's frame and size (a drum
// stands on y = 0 with its spout toward +x; the hammer's head is at the
// origin with the handle down +z). The scene keeps its own drums and hammer
// for any model that doesn't load.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// size: the longest side, metres; spout: the tap's mouth; band: the label
// band's height and the body's radius there (all in the model's frame)
export const PROPS = {
  drumBase: { url: '/models/metherria/drum-base.glb', size: 0.46, spout: [0.192, 0.344, 0], band: [0.23, 0.143], roughness: 0.42 },
  drumBlue: { url: '/models/metherria/drum-blue.glb', size: 0.46, spout: [0.183, 0.352, 0], band: [0.23, 0.139], roughness: 0.42 },
  hammer: { url: '/models/metherria/hammer.glb', size: 0.44, roughness: 0.6 },
};

// Resolves to { [name]: THREE.Object3D | null }; a model that fails is null.
export async function loadProps(renderer) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const aniso = renderer?.capabilities.getMaxAnisotropy() ?? 1;
  const loaded = await Promise.all(
    Object.entries(PROPS).map(([name, p]) =>
      loader.loadAsync(p.url).then(
        (gltf) => {
          gltf.scene.traverse((o) => {
            if (!o.isMesh) return;
            o.castShadow = true;
            o.receiveShadow = true;
            o.material.roughness = p.roughness;
            o.material.metalness = 0;
            if (o.material.map) o.material.map.anisotropy = Math.min(8, aniso);
          });
          return [name, gltf.scene];
        },
        () => [name, null],
      ),
    ),
  );
  return Object.fromEntries(loaded);
}

// a drum's spout as a vector, mirrored for a drum turned to pour the other way
export const spoutOf = (name, side = 1, out = new THREE.Vector3()) => {
  const [x, y, z] = PROPS[name].spout;
  return out.set(x * side, y, z * side);
};
