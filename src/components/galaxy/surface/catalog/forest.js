// The surface models for Endor, Kashyyyk, Dagobah and Yavin 4, from Sketchfab: what
// scripts/sketchfab-surface.mjs brings in (`node scripts/sketchfab-surface.mjs forest`),
// each written to public/models/galaxy/surface/<kind>.glb standing on y = 0,
// facing +z, in metres. (The script's header has what each field means;
// `anim`, for a model kept rigged, names its clips: { idle, walk, run }.)
export const MODELS = {
  // the Imperial scout walker
  atst: { uid: '18164d3b3eb64ea1b8d3dc2ad5f4f9cf', as: 'the AT-ST walkers', metres: 8.6, yaw: 0, tris: 15000, tex: 1024, rig: true, anim: { idle: 'ATST Armature|Stationary pose', walk: 'ATST Armature|Walking action' } },
  // the 74-Z speeder bike, nose to +z
  speederbike: { uid: 'efbdcedb6f0a483b9046daa716d1ff6a', as: 'the speeder bikes', metres: 3.2, along: 'z', yaw: 0, tris: 14000, tex: 512 },
  ewok: { uid: '77fb4fc353c64b8098bc2f71667f1062', as: 'the Ewoks', metres: 1.0, yaw: 0, tris: 8000, tex: 512 },
};
