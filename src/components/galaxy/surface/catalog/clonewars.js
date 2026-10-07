// The surface models for the Clone Wars' worlds (Coruscant, Kamino,
// Geonosis), from Sketchfab: what scripts/sketchfab-surface.mjs brings in
// (`node scripts/sketchfab-surface.mjs clonewars`), each written to
// public/models/galaxy/surface/<kind>.glb standing on y = 0, facing +z, in
// metres. A group of its own (the back lane's, apart from core.js's Naboo),
// so the two lanes of the planets overhaul never edit the same lines.
export const MODELS = {
  // Count Dooku's solar sailer, at his hangar on Geonosis
  solarsailer: { uid: 'd572f763ba5c4a70a88aa9c680bd549b', lod: true, as: 'Dooku’s solar sailer', metres: 16.8, along: 'max', yaw: 0, tris: 25000, tex: 1024 },
  // Made with Meshy from the production painting of Geonosis (the back
  // lane's scripts/meshy-galaxy-buildings-back.mjs; listed in
  // public/cc0/README.md): a hive, an eroded mesa with its tall spires
  geohive: { made: 'meshy', as: 'the hives of Geonosis', metres: 150, hero: true, lod: true, detail: 'redrock', detailLook: { strength: 0.55, normal: 0.9 }, ultra: { tris: 119999, tex: 8192 } },
};
