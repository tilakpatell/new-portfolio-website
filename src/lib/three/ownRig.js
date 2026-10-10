// A figure from Star Wars Battlefront II (2017) on a skeleton of its own:
// the droids and beasts the game did not build on the shared humanoid
// (Walrus_HumanMale), each moved by the game's clips for its own rig. The
// B1 battle droid (D_Assault_Preq_01_Ske), the B2, the droideka, the Ewok,
// the astromech, the viper probe and the tauntaun take a pack each
// (scripts/bf2017-clips.mjs <rig>: clips-<rig>.glb, its names walrusClips.js's
// OWN_RIGS); lane V's walkers (the AT-ST, AT-AT, AT-TE, AT-RT) take theirs
// through the same loader. The clips bind by bone name, as they were made,
// with nothing retargeted; the walrus loader's own filtering applies (a
// track naming a bone this body hasn't is left out, rest put back where a
// clip leaves a moved bone alone, a missing name falls back).
//
// The contract, small on purpose so lane V can lean on it:
//
//   ownPackUrl(rig) → '/models/galaxy/bf2017/clips-<rig>.glb'
//   loadOwnRigBody(url, { rig, packs?, bones?, loader? })
//     → Promise<{ model, clips: { name: AnimationClip }, bones: { hips, head,
//        … rig.js's roles }, rig }>
//     model: a copy of the file's scene (its own bones); clips: the pack's,
//     filtered to this body; bones: rig.js's findBones, the row's `bones`
//     ({ role: boneName }) over its guesses. Refuses, naming them, a body
//     without a bone the row names, or without any bone at all; refuses a
//     rig with no pack. A body on the game's humanoid skeleton is the walrus
//     loader's (lib/three/walrus.js), never this one's: crewList.js's
//     figureLoaderFor sends a row by its `rig` ('walrus' or 'own').

import { cloneScene, loadGLTF } from './gltfCache';
import { findBones } from './rig';
import { PACK_DIR, clipsFor, loadWalrusPacks } from './walrus';
import { OWN_RIGS } from './walrusClips';

export const ownPackUrl = (rig) => `${PACK_DIR}/clips-${rig}.glb`;

export async function loadOwnRigBody(url, { rig, packs: given, bones: named = {}, loader } = {}) {
  // (a rig of lane V's may hand its packs in; one of OWN_RIGS has its own)
  const packs = given ?? (OWN_RIGS[rig] ? [ownPackUrl(rig)] : []);
  if (!packs.length) throw new Error(`${url}: no pack for the rig ${rig} (walrusClips.js's OWN_RIGS)`);
  const [gltf, clips] = await Promise.all([loadGLTF(url, { loader }), loadWalrusPacks(packs, { loader })]);
  if (!gltf) throw new Error(`${url}: no model`);
  const model = cloneScene(gltf);
  const names = new Set();
  let boneCount = 0;
  model.traverse((o) => {
    if (o.name) names.add(o.name);
    if (o.isBone) boneCount++;
  });
  const lacks = Object.values(named).filter((n) => !names.has(n));
  if (lacks.length) throw new Error(`${url} lacks the bones its row names: ${lacks.join(', ')}`);
  if (!boneCount) throw new Error(`${url} has no skeleton: a statue is the catalogue's, not this loader's`);
  return { model, clips: clipsFor(model, clips), bones: findBones(model, named).bones, rig };
}
