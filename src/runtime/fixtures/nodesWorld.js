// A world module that keeps the 'nodes' promise (shading.test.js reads
// this folder): standard materials only, no GLSL, no composer. It's also
// the smallest module there is, as a reference: a lit cube that turns.

import * as THREE from 'three';

export default {
  id: 'fixture-nodes',
  shading: 'nodes',
  mb: 0,
  create(rt) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 4;
    const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0x4488ff }));
    scene.add(cube, new THREE.DirectionalLight(0xffffff, 2), new THREE.AmbientLight(0xffffff, 0.3));
    return {
      ready: rt.gfx.compile(scene, camera),
      resize(w, h) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      },
      step(dt) {
        cube.rotation.y += dt;
      },
      draw({ renderer }) {
        renderer.render(scene, camera);
      },
      wants: () => true,
      dispose() {
        cube.geometry.dispose();
        cube.material.dispose();
      },
    };
  },
};
