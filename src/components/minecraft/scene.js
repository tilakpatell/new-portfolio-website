// Minecraft, the scene: the terrain's sections (scene/chunks.js) in the one
// block material's three passes (scene/shaders.js) over the pack's texture
// array (scene/atlasTexture.js), under the sky (scene/sky.js), seen from
// the player's eyes at 70° as the game's default. sync(g, alpha) puts the
// camera between the last two ticks, so it's smooth at any frame rate;
// under water the fog closes in blue, as the game's does.
//
// createScene(renderer, rt, { manifest }) → { ready, camera, chunks, sync,
//   render, resize, setRenderDistance, dispose }

import * as THREE from 'three';
import { byName } from './rules/blocks.js';
import { EYE } from './rules/player.js';
import { loadBlockArray, loadSprite } from './scene/atlasTexture.js';
import { createChunks } from './scene/chunks.js';
import { blockMaterial } from './scene/shaders.js';
import { createSky } from './scene/sky.js';

const WATER = byName.get('water').id;
const UNDERWATER = new THREE.Vector3(0.02, 0.06, 0.24);

export function createScene(renderer, rt, { manifest }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 1000);
  camera.rotation.order = 'YXZ';
  let distance = 10;
  let materials = null;
  let chunks = null;
  let sky = null;

  const ready = (async () => {
    const [array, sun, clouds] = await Promise.all([loadBlockArray(manifest), loadSprite('sun').catch(() => null), loadSprite('clouds').catch(() => null)]);
    materials = { opaque: blockMaterial({ array, pass: 'opaque' }), cutout: blockMaterial({ array, pass: 'cutout' }), water: blockMaterial({ array, pass: 'water' }) };
    chunks = createChunks(scene, { materials });
    sky = createSky(scene, { sun, clouds });
    api.chunks = chunks;
    setRenderDistance(distance);
  })();

  function setRenderDistance(n) {
    distance = n;
    camera.far = Math.max(600, (n + 2) * 16 * 1.5);
    camera.updateProjectionMatrix();
    if (!materials) return;
    sky.setFog(n);
    for (const m of Object.values(materials)) {
      m.uniforms.fogNear.value = n * 16 * 0.8;
      m.uniforms.fogFar.value = n * 16;
      m.uniforms.fogColour.value.copy(sky.fog);
    }
  }

  function sync(g, alpha) {
    const p = g.player;
    const prev = g.prev ?? p;
    const eye = p.sneak ? EYE.sneak : EYE.stand;
    camera.position.set(prev.x + (p.x - prev.x) * alpha, prev.y + (p.y - prev.y) * alpha + eye, prev.z + (p.z - prev.z) * alpha);
    camera.rotation.set(p.pitch, p.yaw, 0);
    if (!materials) return;
    sky.update(g.time, camera, distance * 16, g.ticks + alpha);
    // the eye under water: a close blue fog
    const wet = g.world.get(camera.position.x, camera.position.y, camera.position.z) === WATER;
    for (const m of Object.values(materials)) {
      m.uniforms.fogColour.value.copy(wet ? UNDERWATER : sky.fog);
      m.uniforms.fogNear.value = wet ? 0 : distance * 16 * 0.8;
      m.uniforms.fogFar.value = wet ? 14 : distance * 16;
    }
  }

  const api = {
    scene,
    camera,
    ready,
    chunks: null,
    sync,
    setRenderDistance,
    render() {
      renderer.render(scene, camera);
    },
    resize(w, h) {
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    dispose() {
      chunks?.dispose();
      sky?.dispose();
      for (const m of Object.values(materials ?? {})) {
        m.uniforms.atlas.value?.dispose();
        m.dispose();
      }
    },
  };
  return api;
}
