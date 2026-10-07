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
  // Geonosis: the forward command center, the long armoured hull in red and
  // off-white with its sensor mast (its holotable is built, in front)
  commandpost: { made: 'meshy', as: 'the forward command center', metres: 17, along: 'x', detail: 'metal' },
  // Bespin: a tower of Cloud City, stepped white drums with rims and slot
  // windows (the plaza's and the skyline's)
  cloudcity: { made: 'meshy', as: 'Cloud City’s towers', metres: 60, along: 'y', detail: 'paint' },
  // Nevarro: the domes of Nevarro City, a pale stone drum and dome with a cap
  nevarrodome: { made: 'meshy', as: 'the domes of Nevarro City', metres: 11, along: 'x', detail: 'stone' },
  // Lothal: the old Imperial tower Sabine Wren lives in, the stone shaft,
  // the saucer cabin and its antenna arms (a kind of its own: Yavin keeps
  // its lattice lookout)
  lothtower: { made: 'meshy', as: 'the old Imperial tower', metres: 40, along: 'y', hero: true, detail: 'stone' },
  // Sorgan: the krill farmers' round huts, plank and reed under a slatted
  // roof that rises to a spire
  stilthut: { made: 'meshy', as: 'the krill farmers’ huts', metres: 9, along: 'y', detail: 'wood' },
  // Tatooine: Ben Kenobi's hut, the long low battered block with its dome
  benhut: { made: 'meshy', as: 'Ben Kenobi’s hut', metres: 9, along: 'x', detail: 'adobe' },
  // Tatooine: a market stall, the canvas roof on its poles, the dried goods
  // hung under it, the baskets and pots of produce (Nevarro's town has two)
  stall: { made: 'meshy', as: 'the market stalls', metres: 3.6, along: 'x' },
  // Kashyyyk: a Wookiee house, the round timber house on its post, the
  // gallery round it and the ribbed roof (from the production painting)
  wookieehouse: { made: 'meshy', as: 'the Wookiee houses', metres: 12, along: 'x', detail: 'wood' },
  // Mustafar: the panning droids, the disc they ride, the head with its two
  // lenses, the arms and the bucket of molten metal
  droidplatform: { made: 'meshy', as: 'the panning droids', metres: 6.6, along: 'y', detail: 'metal' },
  // Tatooine: the Tuskens' domed huts of hide and mud over bent poles (style
  // 'tusken': the other worlds' camps keep the built tent)
  tent: { made: 'meshy', as: 'the Tusken huts', metres: 5.5, along: 'x', styles: ['tusken'] },
  // Tatooine: the spires of Mos Eisley, the buttressed shaft under its two
  // mushroom caps
  mosspire: { made: 'meshy', as: 'the spires of Mos Eisley', metres: 20, along: 'y', detail: 'adobe' },
};
