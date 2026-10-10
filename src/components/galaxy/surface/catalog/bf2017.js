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
export const MODELS = {
  hiltluke: { made: 'bf2017', as: 'Luke’s lightsaber hilt (Return of the Jedi)', metres: 0.286, along: 'y', yaw: 0, tris: 920, tex: 2048, native: true, from: 'gameplay/equipment/heroes/lightsaberlukeskywalker/lightsaberlukeskywalker_meshp_mesh' },
  hiltlukehoth: { made: 'bf2017', as: 'Luke’s first lightsaber hilt, Anakin’s (Hoth)', metres: 0.284, along: 'y', yaw: 0, tris: 1070, tex: 2048, native: true, from: 'gameplay/equipment/heroes/lightsaberlukehoth/lightsaberlukehoth_meshp_mesh' },
  hiltvader: { made: 'bf2017', as: 'Darth Vader’s lightsaber hilt', metres: 0.268, along: 'y', yaw: 0, tris: 248, tex: 2048, native: true, from: 'gameplay/equipment/heroes/lightsaberdarthvader/lightsaberdarthvader_meshp_mesh' },
  hiltobiwan: { made: 'bf2017', as: 'Obi-Wan Kenobi’s lightsaber hilt', metres: 0.27, along: 'y', yaw: 0, tris: 6248, tex: 2048, native: true, from: 'gameplay/equipment/heroes/lightsaberobiwan/lightsaberobiwan_meshp_mesh' },
  hiltanakin: { made: 'bf2017', as: 'Anakin Skywalker’s lightsaber hilt', metres: 0.274, along: 'y', yaw: 0, tris: 719, tex: 2048, native: true, from: 'gameplay/equipment/heroes/lightsaberanakin/lightsaberanakin_meshp_mesh' },
  hiltmaul: { made: 'bf2017', as: 'Darth Maul’s saber staff', metres: 0.567, along: 'y', yaw: 0, tris: 1376, tex: 2048, native: true, from: 'gameplay/equipment/heroes/lightsabermaul/lightsabermaul_meshp_mesh' },
  hiltmaulcrimson: { made: 'bf2017', as: 'Maul’s crimson saber staff', metres: 0.575, along: 'y', yaw: 0, tris: 2432, tex: 2048, native: true, from: 'gameplay/equipment/heroes/lightsabermaulcrimson/lightsabermaulcrimson_meshp_mesh' },
  hiltdooku: { made: 'bf2017', as: 'Count Dooku’s curved lightsaber hilt', metres: 0.324, along: 'y', yaw: 0, tris: 560, tex: 2048, native: true, from: 'gameplay/equipment/heroes/lightsaberdooku/lightsaberdooku_gameplay_meshp_mesh' },
  hiltyoda: { made: 'bf2017', as: 'Yoda’s lightsaber hilt', metres: 0.158, along: 'y', yaw: 0, tris: 1060, tex: 2048, native: true, from: 'gameplay/equipment/heroes/lightsaberyoda/lightsaberyoda_meshp_mesh' },
  hiltgrievous: { made: 'bf2017', as: 'General Grievous’s lightsaber hilt', metres: 0.26, along: 'y', yaw: 0, tris: 4636, tex: 2048, native: true, from: 'gameplay/equipment/heroes/lightsabergrievous/lightsabergrievous_meshp_mesh' },
  dl44: { made: 'bf2017', as: 'Han Solo’s DL-44 blaster pistol', metres: 0.191, along: 'y', yaw: 0, tris: 3497, tex: 2048, native: true, from: 'gameplay/equipment/heroes/dl44/dl44_mesh3p_mesh' },
  ee3: { made: 'bf2017', as: 'Boba Fett’s EE-3 blaster carbine', metres: 0.222, along: 'y', yaw: 0, tris: 3937, tex: 2048, lod: true, native: true, from: 'gameplay/equipment/heroes/ee3/ee3_mesh3p_mesh' },
  bowcaster: { made: 'bf2017', as: 'Chewbacca’s bowcaster', metres: 0.235, along: 'y', yaw: 0, tris: 8827, tex: 2048, native: true, from: 'gameplay/equipment/heroes/bowcaster/bowcaster_mesh3p_mesh' },
};
