// The surface models for Mustafar, Scarif, Exegol, Ahch-To and Bespin, from Sketchfab: what
// scripts/sketchfab-surface.mjs brings in (`node scripts/sketchfab-surface.mjs edge`),
// each written to public/models/galaxy/surface/<kind>.glb standing on y = 0,
// facing +z, in metres. (The script's header has what each field means;
// `anim`, for a model kept rigged, names its clips: { idle, walk, run }.)
export const MODELS = {
  // a beehive hut of the old Jedi village on Ahch-To (a scan of the one on Skellig Michael, where it was filmed)
  jedihut: { uid: '3babf7e7bd1d4835aac1e118f1f2506b', as: 'the Jedi village huts', metres: 4, along: 'max', yaw: 0, up: 'y', tris: 5000, tex: 1024 },
  porg: { uid: 'df73eb95169b4f3882bcde58dec58ae7', as: 'the porgs', metres: 0.3, yaw: 0, up: 'y', tris: 6000, tex: 512 },
};
