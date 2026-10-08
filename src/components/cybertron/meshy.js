// Cybertron's Meshy figures (scripts/meshy.mjs's rollout set: Optimus,
// Bumblebee, the Vehicons, Megatron, Shockwave, the jets), fetched once for
// the page whoever asks for them: Roll out's cast and the transformation
// showcase used to load the same files each their own way. Each model comes
// through lib/three/gltfCache (one fetch and parse, copies with materials
// of their own), and a rigged one's own idle, walk and run beside it; the
// clips every Meshy figure shares (a shot, a hit, a fall, a taunt, a cheer)
// come from lib/three/clipLibrary through each figure's animator.
//
//   ROLLOUT: the folder they're in
//   castModel(name) → Promise<GLTF | null>
//   castCopy(gltf) → a copy to place (bones and materials its own)
//   ownClips(name) → Promise<{ idle, walk, run }> (each a clip, or null)
//   rigOf(gltf) → { hipsY, up }: the hips' height in the rig's units, and the
//     hips' parent's up, for clips borrowed from the library

import * as THREE from 'three';
import { cloneScene, loadGLTF } from '../../lib/three/gltfCache';

export const ROLLOUT = '/games/meshy/rollout';
const url = (file) => `${import.meta.env?.BASE_URL ?? '/'}${ROLLOUT.slice(1)}/${file}`;

export const castModel = (name) => loadGLTF(url(`${name}.glb`));

export const castCopy = (gltf) => cloneScene(gltf);

const OWN = ['idle', 'walk', 'run'];
export async function ownClips(name) {
  const got = await Promise.all(OWN.map((c) => loadGLTF(url(`${name}-${c}.glb`))));
  return Object.fromEntries(OWN.map((c, i) => [c, got[i]?.animations?.[0] ?? null]));
}

export function rigOf(gltf) {
  const hips = gltf?.scene?.getObjectByName('Hips') ?? null;
  if (!hips) return { hipsY: null, up: null };
  gltf.scene.updateMatrixWorld(true);
  const up = hips.parent ? new THREE.Vector3(0, 1, 0).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert()) : null;
  return { hipsY: hips.position.y, up };
}
