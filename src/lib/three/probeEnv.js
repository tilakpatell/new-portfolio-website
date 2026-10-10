// A level's reflection probe as the scene's environment. One alive at a time:
// a world's probe is disposed when the next arrives, and a load that is
// overtaken by a newer one is thrown away on arrival, so a quick zone change
// never leaves two prefiltered cubes on the GPU.

import * as THREE from 'three';
import { HDRCubeTextureLoader } from 'three/examples/jsm/loaders/HDRCubeTextureLoader.js';

// load(urls) → Promise<CubeTexture>; pmrem: a PMREMGenerator. Both are
// injected so the bookkeeping is tested without a GPU.
export function createProbeEnv({ renderer, load, pmrem } = {}) {
  const loader = load ?? ((urls) => new HDRCubeTextureLoader().setDataType(THREE.HalfFloatType).loadAsync(urls));
  const gen = pmrem ?? new THREE.PMREMGenerator(renderer);
  let env = null;
  let key = null;
  let ticket = 0;

  async function loadProbe(urls) {
    const want = urls.join('|');
    if (env && key === want) return env;
    const mine = ++ticket;
    const cube = await loader(urls);
    const next = gen.fromCubemap(cube).texture;
    cube.dispose();
    if (mine !== ticket) {
      next.dispose();
      return null;
    }
    env?.dispose();
    env = next;
    key = want;
    return env;
  }

  return {
    load: loadProbe,
    current: () => env,
    dispose() {
      ticket++;
      env?.dispose();
      env = null;
      key = null;
      gen.dispose();
    },
  };
}
