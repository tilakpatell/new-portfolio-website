// The surface models brought in from Star Wars Battlefront II (2017): EA
// DICE's, used with permission on this non-commercial fan project
// (docs/decisions/2026-10-10-battlefront-2017-assets.md). Each line is
// written by scripts/bf2017-import.mjs, never by hand, as it brings a model
// in: the file is public/models/galaxy/surface/<kind>.glb (standing on
// y = 0, facing +z, in metres, grounded in the file), the credit
// `surface-<kind>` in src/data/modelCredits.json, and `from` the model's
// name in the drop's manifest, so the import can be run again. A kind here
// takes over from the same kind in every other group, battlefront.js's
// 2005 troopers included.
//
// Fields as in desert.js; `made: 'bf2017'` marks where it came from.
export const MODELS = {};
