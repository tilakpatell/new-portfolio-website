// The back lane's buildings (docs/superpowers/plans/2026-10-06-planets-back-lane.md:
// the Outer Rim, Scarif, then the core and forest worlds), made by
// scripts/meshy-galaxy-buildings.mjs like its own and in its format (that
// script's header has the fields). Kept in a file of their own so the two
// lanes never edit the same lines; their tasks go in
// scripts/meshy-galaxy-buildings-back-tasks.json (MESHY_TASKS).
//
//   MESHY_TASKS=scripts/meshy-galaxy-buildings-back-tasks.json node scripts/meshy-galaxy-buildings.mjs <step> <kind …>
export const BUILDINGS = {
  // Nevarro: the stone gate into Nevarro City, two carved pillars and a
  // lintel (a still from the third chapter of the second season)
  nevarroarch: {
    ref: 'File:NevarroCity-TMCh12.png',
    crop: [0.395, 0.22, 0.18, 0.44],
    lift: 'the tall stone archway gate (two square pillars carved with recessed panels, joined by a flat stone lintel across the top)',
    metres: 11,
    along: 'h',
    tris: 12000,
    tex: 1024,
  },
  // Nevarro: one of the city's round stepped domes (the miniature the
  // show's artists built of the city)
  nevarrodome: {
    ref: 'File:NevarroModel.jpg',
    crop: [0.29, 0.71, 0.12, 0.25],
    lift: 'the round stepped stone dome building (a low round drum with two stepped tiers and a shallow dome on top), in dark grey weathered volcanic stone',
    metres: 11,
    along: 'w',
    tris: 12000,
    tex: 1024,
  },
  // Lothal: the Jedi temple, a great banded cone of rock on the plains
  // (Rebels' own render of it)
  lothtemple: {
    ref: 'File:Jedi Temple on Lothal.png',
    crop: [0.35, 0.03, 0.31, 0.8],
    lift: 'the great cone-shaped rock spire (smooth grey stone banded in horizontal strata, rising to a rounded point)',
    metres: 70,
    along: 'h',
    tris: 16000,
    tex: 2048,
    hero: true,
  },
  // Lothal: a domed farmhouse of the plains (Morad Sumar's farm, in Rebels)
  lothdome: {
    ref: 'File:MoradSumarsFarm-FighterFlight.png',
    crop: [0.23, 0.12, 0.53, 0.58],
    lift: 'the large weathered domed farmhouse (a wide pale dome with a boxy entrance porch and a door at the front, antennas on top)',
    metres: 16,
    along: 'w',
    tris: 16000,
    tex: 1024,
  },
  // Mandalore: Sundari, the domed capital (a production painting of it)
  sundaridome: {
    ref: 'File:Sundari HoM1.png',
    lift: 'the great grey domed city (one huge ribbed dome on a round stepped base ring, small windows and platforms around its rim)',
    metres: 130,
    along: 'w',
    tris: 40000,
    tex: 2048,
    hero: true,
  },
};
