// The surface models for Naboo, Coruscant, Kamino and Geonosis, from Sketchfab: what
// scripts/sketchfab-surface.mjs brings in (`node scripts/sketchfab-surface.mjs core`),
// each written to public/models/galaxy/surface/<kind>.glb standing on y = 0,
// facing +z, in metres. (The script's header has what each field means;
// `anim`, for a model kept rigged, names its clips: { idle, walk, run }.)
export const MODELS = {
  // Jar Jar Binks
  gungan: { uid: '85aef3e496d44e9b95c7386035c0ef10', as: 'the Gungans', metres: 1.96, yaw: 0, tris: 8000, tex: 384 },
};
