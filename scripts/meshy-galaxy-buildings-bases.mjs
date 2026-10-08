// The galaxy's bases (Phase 2: docs/superpowers/plans/2026-10-07-galaxy-phase2-bases.md),
// made by scripts/meshy-galaxy-buildings.mjs like its own and in its format
// (that script's header has the fields), where code can't match the film.
// Their tasks go in scripts/meshy-galaxy-buildings-bases-tasks.json.
//
//   MESHY_TASKS=scripts/meshy-galaxy-buildings-bases-tasks.json node scripts/meshy-galaxy-buildings.mjs <step> <kind …>
export const BUILDINGS = {
  // Hoth: the v-150 Planet Defender, the ion cannon by Echo Base (a still
  // of it firing: a great weathered sphere sunk in the snow, the emitter
  // open in its top). The built one keeps its shot (props/ice.js).
  v150: {
    ref: 'File:Planet_Defender.png',
    crop: [0.17, 0.33, 0.5, 0.56],
    lift: 'the huge weathered armoured metal sphere (a round ball of curved pale off-white plates, their seams and scuffs and scorch marks, a split across its top with an angular emitter assembly of struts sticking up out of it), shown whole as a complete sphere',
    metres: 26,
    along: 'w',
    tris: 16000,
    tex: 1024,
    // (the first model came out mid grey: its plates pulled to the film's pale
    // cream, applied to the shipped file by hand as the raw one is gone)
    recolor: [{ material: '*', to: '#aea99e', amount: 1 }],
  },
};
