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
  // Tatooine: Mos Eisley's cantina, the dome behind its front wall and the
  // arched door (a kind of its own: Nevarro's town keeps the old cantina);
  // the built one's floor and its walls, set to the model's, under it
  moscantina: { made: 'meshy', as: 'the cantina', metres: 22, along: 'x', lod: true, solids: 'built', detail: 'adobe' },
  // Tatooine: Jabba's palace, the rust-brown keep, the watchtower, the domed
  // annex and the rocks at its foot (from a still of it; the salmon
  // retexture of the owner's model is gone); its gate is built
  palace: { made: 'meshy', as: 'Jabba’s palace', metres: 75, along: 'x', hero: true, lod: true, solids: 'built', detail: 'adobe' },
  // Kamino: Tipoca City's towers, a tall tower on its saucer and pylons
  tipoca: { made: 'meshy', as: "Tipoca City's towers", metres: 64, along: 'y', hero: true, lod: true, styles: ['tower'] },
  // Coruscant: the Processional Way's Jedi of old, robed and hooded, on
  // their pedestals (the Senate plaza's statues stay built)
  statue: { made: 'meshy', as: 'the Jedi statues', metres: 28, along: 'y', styles: ['jedi'] },
  // Mustafar: Vader's castle, the two black prongs on their buttressed base
  fortress: { made: 'meshy', as: "Vader's castle", metres: 120, along: 'y', hero: true, lod: true, detail: 'metal' },
};
