// The surface models for Mustafar, Scarif and Bespin, from Sketchfab: what
// scripts/sketchfab-surface.mjs brings in (`node scripts/sketchfab-surface.mjs edge`),
// each written to public/models/galaxy/surface/<kind>.glb standing on y = 0,
// facing +z, in metres. (The script's header has what each field means;
// `anim`, for a model kept rigged, names its clips: { idle, walk, run }.)
export const MODELS = {
  // the twin-pod cloud cars that fly Bespin's Cloud City (orange, like in the film)
  cloudcar: { uid: '0ee339ff87a043a88a1a5d45bb229c49', as: 'the cloud cars', metres: 7, along: 'max', yaw: Math.PI, up: 'y', gain: 2, tris: 16000, tex: 1024 },
  // Vader's castle on Mustafar (flat-shaded, but the silhouette is right)
  fortress: { uid: 'dccd24bde1c0475eab1f1674c108d42a', as: "Vader's castle", metres: 120, yaw: 0, up: 'y', tris: 35000, tex: 1024 },
  // a palm of the tropical worlds
  palm: { uid: '8c5d6b661b2f4c37834d87cd187eb907', as: 'the palms', metres: 12, yaw: 0, up: 'y', tris: 3000, tex: 512 },
};
