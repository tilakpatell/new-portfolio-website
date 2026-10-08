// The surface models for Mustafar, Scarif and Bespin, from Sketchfab: what
// scripts/sketchfab-surface.mjs brings in (`node scripts/sketchfab-surface.mjs edge`),
// each written to public/models/galaxy/surface/<kind>.glb standing on y = 0,
// facing +z, in metres. (The script's header has what each field means;
// `anim`, for a model kept rigged, names its clips: { idle, walk, run }.)
export const MODELS = {
  // the twin-pod cloud cars that fly Bespin's Cloud City (orange, like in the film)
  cloudcar: { uid: '0ee339ff87a043a88a1a5d45bb229c49', machine: true, as: 'the cloud cars', metres: 7, along: 'max', yaw: Math.PI, up: 'y', gain: 2, tris: 16000, tex: 1024 },
  // a palm of the tropical worlds
  // (a light copy beside it for the far ones: six hundred palms are most of Scarif's triangles)
  palm: { uid: '8c5d6b661b2f4c37834d87cd187eb907', lod: true, as: 'the palms', metres: 12, yaw: 0, up: 'y', tris: 3000, tex: 512 },
};
