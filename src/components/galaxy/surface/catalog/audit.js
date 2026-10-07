// The audit lane (docs/research/2026-10-07-star-wars-buildings-audit.md):
// the worlds' buildings the audit found poor or off-model, remade with
// Meshy (meshy.ai, the site owner's account) by
// scripts/meshy-galaxy-buildings.mjs from scripts/meshy-galaxy-audit.mjs,
// each lifted out of a Wookieepedia picture of the place as it is on
// screen. Each takes over from the Sketchfab model or the Meshy one the
// kind had before (the built one stays the fallback where there is one).
// Fields as in made.js.
export const MODELS = {
  // Dagobah: Yoda's hut, the dark mud mound under the gnarltree's roots
  // (from a still of it; the white egg from the painting is gone)
  yodahut: { made: 'meshy', as: "Yoda's hut", metres: 10, along: 'x', hero: true, lod: true, detail: 'adobe' },
  // Coruscant: the Jedi Temple, the stepped ziggurat and its five towers
  jeditemple: { made: 'meshy', as: 'the Jedi Temple', metres: 200, along: 'x', hero: true, lod: true, detail: 'stone' },
  // Naboo: the Gungans' stone heads (from the production maquette)
  stonehead: { made: 'meshy', as: 'the Gungans’ stone heads', metres: 7.5, along: 'y', hero: true, detail: 'stone' },
  // Geonosis: the droid foundry, the sandstone keep and its needle spires
  foundry: { made: 'meshy', as: 'the droid foundry', metres: 100, along: 'y', hero: true, lod: true, detail: 'redrock', detailLook: { strength: 0.55, normal: 0.9 } },
};
