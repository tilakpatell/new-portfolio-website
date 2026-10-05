// The compound's people from Sketchfab (CC BY: their credits are in
// src/data/modelCredits.json and shown on the Avengers page), made by
// scripts/sketchfab-avengers.mjs: each stands on y = 0, centred, facing +z,
// in metres at its real height. manifest.json says, for each, its height,
// whether it has a skeleton, its clips (idle, walk, run, and Cap's jump) and
// the names of the bones to pose it by hand (hips, spine, chest, neck, head,
// shoulderL … footR). Load them with GLTFLoader and its MeshoptDecoder.

const DIR = '/models/sketchfab/avengers';

export const AVENGERS_MANIFEST = `${DIR}/manifest.json`;

export const AVENGERS_MODELS = {
  cap: '/models/sketchfab/avengers/cap.glb',
  thor: '/models/sketchfab/avengers/thor.glb',
  hulk: '/models/sketchfab/avengers/hulk.glb',
  widow: '/models/sketchfab/avengers/widow.glb',
  ironman: '/models/sketchfab/avengers/ironman.glb',
};
