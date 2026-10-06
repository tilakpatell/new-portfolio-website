// The surface models made for this site with Meshy (meshy.ai, the site
// owner's account) where nothing on Sketchfab was right: each from a real
// picture of the thing (a film still or a production painting, lifted onto
// a plain background), or one of the owner's own models retextured. Made
// by scripts/meshy-galaxy-buildings.mjs, written to
// public/models/galaxy/surface/<kind>.glb like the Sketchfab ones (standing
// on y = 0, facing +z, in metres) and listed in public/cc0/README.md (not
// in the Sketchfab credits). Fields as in the other groups, and:
//   made    'meshy'
//   hero    a landmark: allowed a bigger file (4 MB) for its 2K maps
//   lod     a <kind>.lod1.glb sits beside it, for far away
//   solids  'built': walls and floors from the built one (props/*.js), so
//           its decks and doors still work under the model
export const MODELS = {};
