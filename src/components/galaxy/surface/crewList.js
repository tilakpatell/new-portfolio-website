// Who the crew are: each figure kind's model file and height, which crew.js
// loads and walks. Plain data, apart from the scene, so a page can name the
// files (the surface page's model credits) without loading three.js.
// a figure's file: its own `url`, or its name's in the crew's folder
export const fileOf = (c) => c.url ?? `/models/galaxy/crew/${c.name}.glb`;
// the i-th of a kind: a kind with other `faces` takes them in turn, itself first
export const faceOf = (c, i = 0) => (c.faces ? [c, ...c.faces][i % (c.faces.length + 1)] : c);
// every file a kind may load
export const filesOf = (c) => [c, ...(c.faces ?? [])].map(fileOf);
// kind → { model's name or file, how tall, still (not rigged) }
export const CREW = {
  han: { name: 'han', tall: 1.85 },
  // (Luke and Leia are Sketchfab figures, rigged with Meshy onto the same skeleton)
  luke: { url: '/models/galaxy/crew/luke.glb', tall: 1.72 },
  leia: { url: '/models/galaxy/crew/leia.glb', tall: 1.5 },
  chewie: { url: '/models/cockpit/chewie.glb', tall: 2.28 }, // (the cockpits' own, whom the Falcon's party walks)
  greedo: { name: 'greedo', tall: 1.73 },
  gamorrean: { name: 'gamorrean', tall: 1.8 },
  bobafett: { name: 'bobafett', tall: 1.83 },
  bith: { name: 'bith', tall: 1.8 },
  ahsoka: { name: 'ahsoka', tall: 1.85 },
  hutt: { name: 'jabba', tall: 1.8, still: true },
  // the worlds' named people, from Sketchfab, rigged with Meshy onto the
  // same skeleton (scripts/meshy-galaxy.mjs): Obi-Wan on Mustafar, Jango on
  // Kamino, Shaak Ti, the Mandalorian; the Wookiees are Chewie's model.
  // (Anakin, Krennic, Cassian, Chirrut and Mace stand still instead,
  // catalog/library.js: their arms-down poses didn't rig)
  obiwan: { url: '/models/galaxy/crew/obiwan.glb', tall: 1.82 },
  jango: { url: '/models/galaxy/crew/jango.glb', tall: 1.83 },
  // (not `shaak`: that kind is Naboo's grazing beasts)
  shaakti: { url: '/models/galaxy/crew/shaakti.glb', tall: 1.88 },
  mando: { url: '/models/galaxy/crew/dindjarin.glb', tall: 1.85 },
  wookiee: { url: '/models/cockpit/chewie.glb', tall: 2.28 },
  // the worlds' people made with Meshy from words (scripts/meshy-galaxy.mjs),
  // in place of the built ones: Tatooine's Tuskens, Twi'leks, Bib Fortuna,
  // the Aqualish and Wuher; Bespin's Lando, Lobot and Ugnaughts; the Rebel
  // troops; Coruscant's Senate guards and Jedi; the Neimoidians; Mustafar's
  // miners
  tusken: { url: '/models/galaxy/crew/tusken.glb', tall: 1.9 },
  lando: { url: '/models/galaxy/crew/lando.glb', tall: 1.78 },
  twilek: { url: '/models/galaxy/crew/twilek.glb', tall: 1.7 },
  ugnaught: { url: '/models/galaxy/crew/ugnaught.glb', tall: 1.05 },
  rebel: { url: '/models/galaxy/crew/rebel.glb', tall: 1.78 },
  senateguard: { url: '/models/galaxy/crew/senateguard.glb', tall: 1.85 },
  lobot: { url: '/models/galaxy/crew/lobot.glb', tall: 1.75 },
  // (the three worlds': a Wing Guard who walks, and Dex still behind the counter that came with him)
  wingguard: { url: '/models/galaxy/crew/wingguard.glb', tall: 1.8 },
  dex: { url: '/models/galaxy/crew/dex.glb', tall: 1.9, still: true },
  neimoidian: { url: '/models/galaxy/crew/neimoidian.glb', tall: 1.9 },
  bibfortuna: { url: '/models/galaxy/crew/bibfortuna.glb', tall: 1.8 },
  aqualish: { url: '/models/galaxy/crew/aqualish.glb', tall: 1.8 },
  wuher: { url: '/models/galaxy/crew/wuher.glb', tall: 1.78 },
  mustafarian: { url: '/models/galaxy/crew/mustafarian.glb', tall: 2.0 },
  // (the temple's knights take three faces in turn)
  jedi: {
    url: '/models/galaxy/crew/jedi.glb',
    tall: 1.75,
    faces: [
      { url: '/models/galaxy/crew/jedi2.glb', tall: 1.8 },
      { url: '/models/galaxy/crew/jedi3.glb', tall: 1.78 },
    ],
  },
  // and the galaxy's who's who, for the worlds and heroes to come
  maul: { url: '/models/galaxy/crew/maul.glb', tall: 1.75 },
  palpatine: { url: '/models/galaxy/crew/palpatine.glb', tall: 1.73 },
  rex: { url: '/models/galaxy/crew/rex.glb', tall: 1.83 },
  bokatan: { url: '/models/galaxy/crew/bokatan.glb', tall: 1.7 },
  vader: { url: '/models/galaxy/crew/vader.glb', tall: 2.02 },
  fennec: { url: '/models/galaxy/crew/fennec.glb', tall: 1.7 },
  caradune: { url: '/models/galaxy/crew/caradune.glb', tall: 1.78 },
  greef: { url: '/models/galaxy/crew/greef.glb', tall: 1.85 },
  rodian: { url: '/models/galaxy/crew/rodian.glb', tall: 1.7 },
  // the Hutts' men where the galaxy's war gives a world to the Hutts: Jabba's
  // court's faces in turn (they were built in code, figures.js's `mercenary`)
  mercenary: {
    url: '/models/galaxy/crew/rodian.glb',
    tall: 1.7,
    faces: [
      { url: '/models/galaxy/crew/aqualish.glb', tall: 1.8 },
      { url: '/models/galaxy/crew/greedo.glb', tall: 1.73 },
      { url: '/models/galaxy/crew/bith.glb', tall: 1.8 },
      { url: '/models/galaxy/crew/gamorrean.glb', tall: 1.8 },
    ],
  },
  inquisitor: { url: '/models/galaxy/crew/inquisitor.glb', tall: 1.85 },
  tiepilot: { url: '/models/galaxy/crew/tiepilot.glb', tall: 1.8 },
  hondo: { url: '/models/galaxy/crew/hondo.glb', tall: 1.78 },
  ackbar: { url: '/models/galaxy/crew/ackbar.glb', tall: 1.8 },
  officer: { url: '/models/galaxy/crew/officer.glb', tall: 1.8 },
  dooku: { url: '/models/galaxy/crew/dooku.glb', tall: 1.93 },
  quigon: { url: '/models/galaxy/crew/quigon.glb', tall: 1.93 },
  // the Battlefront's soldiers (the remaster's models, catalog/battlefront.js),
  // rigged with Meshy onto the same skeleton (scripts/meshy-troopers.mjs), so
  // they walk, aim, fire and fall on clips wherever a world, a quest or a
  // battle has them; the statues they were made from stand in when one of
  // these won't load. Heights as the catalogue has them.
  clone: { url: '/models/galaxy/troops/clone.glb', tall: 1.83 },
  battledroid: { url: '/models/galaxy/troops/battledroid.glb', tall: 1.91 },
  superdroid: { url: '/models/galaxy/troops/superdroid.glb', tall: 1.93 },
  stormtrooper: { url: '/models/galaxy/troops/stormtrooper.glb', tall: 1.83 },
  snowtrooper: { url: '/models/galaxy/troops/snowtrooper.glb', tall: 1.83 },
  hothtrooper: { url: '/models/galaxy/troops/hothtrooper.glb', tall: 1.78 },
  sandtrooper: { url: '/models/galaxy/troops/sandtrooper.glb', tall: 1.83 },
  scouttrooper: { url: '/models/galaxy/troops/scouttrooper.glb', tall: 1.83 },
  shoretrooper: { url: '/models/galaxy/troops/shoretrooper.glb', tall: 1.83 },
  deathtrooper: { url: '/models/galaxy/troops/deathtrooper.glb', tall: 1.83 },
};
