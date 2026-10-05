// The one thing in the walkable Shire that isn't made in code: the leaf of
// Bag End's door, which is MattMaksymowicz's model, from Sketchfab (its
// planks, studs and brass knob, and the mark Gandalf scratched on it;
// scripts/sketchfab-batch.mjs, credited in data/modelCredits.json). The hole
// keeps its own stone arch and oak frame. The built leaf (props.js) stands
// until the model's come, and stays on a device that's on the low tier or
// saving data.

import * as THREE from 'three';

// (the site's shared loader, fetched only when the door is wanted, so the
// map page's own chunk stays without it)
const loaders = () => Promise.all([import('../../../lib/three/gltf'), import('../../../lib/three/textures')]);

// The leaf, `radius` from its middle to its rim, its middle at the origin,
// facing +z with its back at z = 0 (so it's put where the built leaf's back
// was). Resolves to a group, or null if it doesn't come.
export function loadDoorLeaf(radius) {
  return loaders()
    .then(([{ gltfLoader }, { sharpenMaterial }]) => gltfLoader().loadAsync('/models/sketchfab/bag-end-door.glb').then((gltf) => ({ gltf, sharpenMaterial })))
    .then(({ gltf, sharpenMaterial }) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      model.position.set(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -box.min.z);
      const leaf = new THREE.Group();
      leaf.name = 'door-leaf';
      leaf.add(model);
      leaf.scale.setScalar((radius * 2) / Math.max(size.x, size.y));
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        sharpenMaterial(o.material);
        // painted for a studio's lights: here it's wood under an open sky, so
        // nothing of it is metal to the light, and its paint is brought up to
        // the other doors' on the Row
        o.material.metalness = 0;
        o.material.metalnessMap = null;
        o.material.roughness = 0.8;
        o.material.color.setScalar(2.4);
      });
      return leaf;
    })
    .catch(() => null);
}
