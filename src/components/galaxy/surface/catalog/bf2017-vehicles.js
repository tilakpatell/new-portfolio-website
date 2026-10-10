// The vehicles brought in from Star Wars Battlefront II (2017): EA DICE's,
// used with permission on this non-commercial fan project
// (docs/decisions/2026-10-10-battlefront-2017-assets.md). Lane V's own
// group (docs/superpowers/plans/2026-10-10-bf2017-phaseV-vehicles.md), apart
// from bf2017.js so the people's lanes and this one never write one file.
// Each line is written by scripts/bf2017-import.mjs --catalog <this file>,
// never by hand: the file is public/models/galaxy/surface/<kind>.glb
// (standing on y = 0, facing +z, in metres), with `lod` a .lod1.glb, `far` a
// .far.glb (the chain's last cut under 1,000 triangles, unskinned, 256 maps:
// the fleets and the horizon), `ultra` an .ultra.glb, `rig` the game's own
// skeleton kept whole (its clips are public/models/galaxy/bf2017/
// clips-<rig>.glb: src/lib/three/rigSets.js), `hull` the model a cockpit is
// modelled in the frame of; the credit is `surface-<kind>` in
// src/data/modelCredits.json and `from` the model's name in the manifest.
// A kind here takes over from the same kind in every other group.
//
// Fields as in desert.js; `made: 'bf2017'` marks where it came from.
export const MODELS = {
  atst: {
    made: 'bf2017',
    as: 'the AT-ST',
    metres: 7.301,
    along: 'y',
    yaw: 0,
    tris: 13680,
    tex: 1024,
    rig: true,
    far: true,
    hero: true,
    lod: true,
    from: 'gameplay/vehicles/ground/atst/atst_static_donotuse_mesh',
  },
  atat: {
    made: 'bf2017',
    as: 'the AT-AT',
    metres: 21.933,
    along: 'y',
    yaw: 0,
    tris: 20863,
    tex: 1024,
    rig: true,
    far: true,
    hero: true,
    lod: true,
    ultra: { tris: 61900, tex: 2048 },
    from: 'gameplay/vehicles/ground/at-at/old/atat_mesh',
  },
  atte: {
    made: 'bf2017',
    as: 'the AT-TE',
    metres: 8.672,
    along: 'y',
    yaw: 0,
    tris: 15642,
    tex: 1024,
    rig: true,
    far: true,
    hero: true,
    lod: true,
    from: 'gameplay/vehicles/ground/at_te/at_te_mesh',
  },
  atrt: {
    made: 'bf2017',
    as: 'the AT-RT',
    metres: 3.658,
    along: 'y',
    yaw: 0,
    tris: 20445,
    tex: 1024,
    rig: true,
    far: true,
    hero: true,
    lod: true,
    from: 'gameplay/vehicles/ground/atrt/atrt_mesh',
  },
  droideka: {
    made: 'bf2017',
    as: 'a droideka',
    metres: 2.016,
    along: 'y',
    yaw: 0,
    tris: 16321,
    tex: 1024,
    rig: true,
    far: true,
    hero: true,
    lod: true,
    from: 'gameplay/vehicles/ground/droideka_01/droideka_01_mesh',
  },
};
