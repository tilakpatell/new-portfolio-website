// Who the crew are: each figure kind's model file and height, which crew.js
// loads and walks. Plain data, apart from the scene, so a page can name the
// files (the surface page's model credits) without loading three.js.
// a figure's file: its own `url`, or its name's in the crew's folder
export const fileOf = (c) => c.url ?? `/models/galaxy/crew/${c.name}.glb`;
// the i-th of a kind: a kind with other `faces` takes them in turn, itself first
export const faceOf = (c, i = 0) =>
  c.faces ? [c, ...c.faces][i % (c.faces.length + 1)] : c;
// every file a kind may load
export const filesOf = (c) => [c, ...(c.faces ?? [])].map(fileOf);
// how crew.js loads a row: a 2017 figure on the game's skeleton
// (`rig: 'walrus'`, lib/three/walrus.js, with its `pack` of the game's clips
// over the humanoid one), a 2017 droid or beast on its own skeleton (`rig:
// 'own'`, lib/three/ownRig.js, with its `ownRig`'s pack), one of the
// wardrobe's people dressed as kept
// (`party`), or a copy of its file's one figure (`shared`)
export const figureLoaderFor = (row, dressed = false) =>
  row?.rig === "walrus"
    ? "walrus"
    : row?.rig === "own"
      ? "own"
      : dressed
        ? "party"
        : "shared";
// a full-fidelity 2017 kind's cuts (scripts/bf2017-import.mjs --full: `full`,
// with `lod`, `far`, the full cut's GPU textures `fullMB` and its download `fullDL`), for the
// walrus loader to draw by distance; null for any other row
export const cutsOf = (row) =>
  row?.full
    ? {
        full: true,
        lod: Boolean(row.lod),
        far: Boolean(row.far),
        fullMB: row.fullMB ?? 0,
        fullDL: row.fullDL ?? 0,
      }
    : null;
// kind → { model's name or file, how tall, still (not rigged) }
export const CREW = {
  han: {
    url: "/models/galaxy/bf2017/crew/han.glb",
    tall: 1.85,
    rig: "walrus",
    pack: "han",
  },
  // the heroes from Star Wars Battlefront II (2017), on the game's whole
  // skeleton with the game's own clips (scripts/bf2017-import.mjs --rig
  // --crew; their `pack`, scripts/bf2017-clips.mjs, over the humanoid one)
  luke: {
    url: "/models/galaxy/bf2017/crew/luke.glb",
    tall: 1.72,
    rig: "walrus",
    pack: "luke",
  },
  leia: {
    url: "/models/galaxy/bf2017/crew/leia.glb",
    tall: 1.5,
    rig: "walrus",
    pack: "leia",
  },
  chewie: {
    url: "/models/galaxy/bf2017/crew/chewie.glb",
    tall: 2.28,
    rig: "walrus",
    pack: "chewie",
  },
  greedo: { name: "greedo", tall: 1.73 },
  gamorrean: { name: "gamorrean", tall: 1.8 },
  bobafett: {
    url: "/models/galaxy/bf2017/crew/bobafett.glb",
    tall: 1.83,
    rig: "walrus",
    pack: "bobafett",
  },
  bith: { name: "bith", tall: 1.8 },
  ahsoka: { name: "ahsoka", tall: 1.85 },
  hutt: { name: "jabba", tall: 1.8, still: true },
  // the worlds' named people, from Sketchfab, rigged with Meshy onto the
  // same skeleton (scripts/meshy-galaxy.mjs): Obi-Wan on Mustafar, Jango on
  // Kamino, Shaak Ti, the Mandalorian.
  // (Anakin, Krennic, Cassian, Chirrut and Mace stand still instead,
  // catalog/library.js: their arms-down poses didn't rig)
  obiwan: {
    url: "/models/galaxy/bf2017/crew/obiwan.glb",
    tall: 1.82,
    rig: "walrus",
    pack: "obiwan",
  },
  jango: { url: "/models/galaxy/crew/jango.glb", tall: 1.83 },
  // (not `shaak`: that kind is Naboo's grazing beasts)
  shaakti: { url: "/models/galaxy/crew/shaakti.glb", tall: 1.88 },
  mando: { url: "/models/galaxy/crew/dindjarin.glb", tall: 1.85 },
  // the worlds' people made with Meshy from words (scripts/meshy-galaxy.mjs),
  // in place of the built ones: Tatooine's Tuskens, Twi'leks, Bib Fortuna,
  // the Aqualish and Wuher; Bespin's Lando, Lobot and Ugnaughts; the Rebel
  // troops; Coruscant's Senate guards and Jedi; the Neimoidians; Mustafar's
  // miners
  tusken: { url: "/models/galaxy/crew/tusken.glb", tall: 1.9 },
  lando: {
    url: "/models/galaxy/bf2017/crew/lando.glb",
    tall: 1.78,
    rig: "walrus",
    pack: "lando",
  },
  twilek: { url: "/models/galaxy/crew/twilek.glb", tall: 1.7 },
  ugnaught: { url: "/models/galaxy/crew/ugnaught.glb", tall: 1.05 },
  senateguard: { url: "/models/galaxy/crew/senateguard.glb", tall: 1.85 },
  lobot: { url: "/models/galaxy/crew/lobot.glb", tall: 1.75 },
  // (the three worlds': a Wing Guard who walks, and Dex still behind the counter that came with him)
  wingguard: { url: "/models/galaxy/crew/wingguard.glb", tall: 1.8 },
  dex: { url: "/models/galaxy/crew/dex.glb", tall: 1.9, still: true },
  neimoidian: { url: "/models/galaxy/crew/neimoidian.glb", tall: 1.9 },
  bibfortuna: { url: "/models/galaxy/crew/bibfortuna.glb", tall: 1.8 },
  aqualish: { url: "/models/galaxy/crew/aqualish.glb", tall: 1.8 },
  wuher: { url: "/models/galaxy/crew/wuher.glb", tall: 1.78 },
  mustafarian: { url: "/models/galaxy/crew/mustafarian.glb", tall: 2.0 },
  // (the temple's knights take three faces in turn)
  jedi: {
    url: "/models/galaxy/crew/jedi.glb",
    tall: 1.75,
    faces: [
      { url: "/models/galaxy/crew/jedi2.glb", tall: 1.8 },
      { url: "/models/galaxy/crew/jedi3.glb", tall: 1.78 },
    ],
  },
  // and the galaxy's who's who, for the worlds and heroes to come
  maul: {
    url: "/models/galaxy/bf2017/crew/maul.glb",
    tall: 1.75,
    rig: "walrus",
    pack: "maul",
  },
  palpatine: {
    url: "/models/galaxy/bf2017/crew/palpatine.glb",
    tall: 1.73,
    rig: "walrus",
    pack: "palpatine",
  },
  rex: { url: "/models/galaxy/crew/rex.glb", tall: 1.83 },
  bokatan: { url: "/models/galaxy/crew/bokatan.glb", tall: 1.7 },
  vader: {
    url: "/models/galaxy/bf2017/crew/vader.glb",
    tall: 2.02,
    rig: "walrus",
    pack: "vader",
  },
  anakin: {
    url: "/models/galaxy/bf2017/crew/anakin.glb",
    tall: 1.85,
    rig: "walrus",
    pack: "anakin",
  },
  bossk: {
    url: "/models/galaxy/bf2017/crew/bossk.glb",
    tall: 1.9,
    rig: "walrus",
    pack: "bossk",
  },
  fennec: { url: "/models/galaxy/crew/fennec.glb", tall: 1.7 },
  caradune: { url: "/models/galaxy/crew/caradune.glb", tall: 1.78 },
  greef: { url: "/models/galaxy/crew/greef.glb", tall: 1.85 },
  rodian: { url: "/models/galaxy/crew/rodian.glb", tall: 1.7 },
  // the Hutts' men where the galaxy's war gives a world to the Hutts: Jabba's
  // court's faces in turn (they were built in code, figures.js's `mercenary`)
  mercenary: {
    url: "/models/galaxy/crew/rodian.glb",
    tall: 1.7,
    faces: [
      { url: "/models/galaxy/crew/aqualish.glb", tall: 1.8 },
      { url: "/models/galaxy/crew/greedo.glb", tall: 1.73 },
      { url: "/models/galaxy/crew/bith.glb", tall: 1.8 },
      { url: "/models/galaxy/crew/gamorrean.glb", tall: 1.8 },
    ],
  },
  inquisitor: { url: "/models/galaxy/crew/inquisitor.glb", tall: 1.85 },
  tiepilot: { url: "/models/galaxy/crew/tiepilot.glb", tall: 1.8 },
  hondo: { url: "/models/galaxy/crew/hondo.glb", tall: 1.78 },
  ackbar: { url: "/models/galaxy/crew/ackbar.glb", tall: 1.8 },
  dooku: {
    url: "/models/galaxy/bf2017/crew/dooku.glb",
    tall: 1.93,
    rig: "walrus",
    pack: "dooku",
  },
  quigon: { url: "/models/galaxy/crew/quigon.glb", tall: 1.93 },
  // the Battlefront's B1 (the remaster's model, catalog/battlefront.js),
  // rigged with Meshy (scripts/meshy-troopers.mjs): the 2017 game's B1 is
  // coloured by a markings map the bucket hasn't yet, and stays this until
  // it has (the other soldiers are the 2017 game's, below)
  battledroid: { url: "/models/galaxy/troops/battledroid.glb", tall: 1.91 },
  // phase 2, everyone the game has (docs/superpowers/evidence/bf2017-phase2/
  // cast.md): the Battlefront II (2017) cast at full fidelity
  // (scripts/bf2017-import.mjs --rig --crew --full --join, --far for the
  // kinds the assaults field). Each draws its light cut first and the cut
  // its distance wants after (lib/three/walrusCuts.js); `fullMB` and
  // `fullDL` are its full cut's GPU textures and download, for the page's
  // ledger. On the game's humanoid skeleton (`walrus`, the humanoid pack)
  // or on a rig of its own (`own`, lib/three/ownRig.js, its rig's pack).
  // A kind named here takes over the one the worlds already place.
  c3po: {
    url: "/models/galaxy/bf2017/crew/c3po.glb",
    tall: 1.71,
    rig: "walrus",
    lod: true,
    full: true,
    fullMB: 44,
    fullDL: 25,
  },
  clone: {
    url: "/models/galaxy/bf2017/crew/clone.glb",
    tall: 1.83,
    rig: "walrus",
    lod: true,
    far: true,
    full: true,
    fullMB: 33,
    fullDL: 20,
  },
  clonephase1: {
    url: "/models/galaxy/bf2017/crew/clonephase1.glb",
    tall: 1.83,
    rig: "walrus",
    lod: true,
    far: true,
    full: true,
    fullMB: 39,
    fullDL: 23,
  },
  deathtrooper: {
    url: "/models/galaxy/bf2017/crew/deathtrooper.glb",
    tall: 1.88,
    rig: "walrus",
    lod: true,
    far: true,
    full: true,
    fullMB: 21,
    fullDL: 13,
  },
  hothtrooper: {
    url: "/models/galaxy/bf2017/crew/hothtrooper.glb",
    tall: 1.78,
    rig: "walrus",
    lod: true,
    far: true,
    full: true,
    fullMB: 50,
    fullDL: 27,
  },
  rebel: {
    url: "/models/galaxy/bf2017/crew/rebel.glb",
    tall: 1.78,
    rig: "walrus",
    lod: true,
    far: true,
    full: true,
    fullMB: 38,
    fullDL: 16,
  },
  rebelpilot: {
    url: "/models/galaxy/bf2017/crew/rebelpilot.glb",
    tall: 1.78,
    rig: "walrus",
    lod: true,
    full: true,
    fullMB: 37,
    fullDL: 24,
  },
  rebeltech: {
    url: "/models/galaxy/bf2017/crew/rebeltech.glb",
    tall: 1.75,
    rig: "walrus",
    lod: true,
    full: true,
    fullMB: 19,
    fullDL: 13,
  },
  sandtrooper: {
    url: "/models/galaxy/bf2017/crew/sandtrooper.glb",
    tall: 1.83,
    rig: "walrus",
    lod: true,
    far: true,
    full: true,
    fullMB: 29,
    fullDL: 17,
  },
  scouttrooper: {
    url: "/models/galaxy/bf2017/crew/scouttrooper.glb",
    tall: 1.83,
    rig: "walrus",
    lod: true,
    far: true,
    full: true,
    fullMB: 48,
    fullDL: 26,
  },
  shoretrooper: {
    url: "/models/galaxy/bf2017/crew/shoretrooper.glb",
    tall: 1.83,
    rig: "walrus",
    lod: true,
    far: true,
    full: true,
    fullMB: 21,
    fullDL: 13,
  },
  snowtrooper: {
    url: "/models/galaxy/bf2017/crew/snowtrooper.glb",
    tall: 1.83,
    rig: "walrus",
    lod: true,
    far: true,
    full: true,
    fullMB: 26,
    fullDL: 18,
  },
  stormtrooper: {
    url: "/models/galaxy/bf2017/crew/stormtrooper.glb",
    tall: 1.83,
    rig: "walrus",
    lod: true,
    far: true,
    full: true,
    fullMB: 48,
    fullDL: 25,
  },
  wookiee: {
    url: "/models/galaxy/bf2017/crew/wookiee.glb",
    tall: 2.28,
    rig: "walrus",
    lod: true,
    full: true,
    fullMB: 34,
    fullDL: 19,
  },
  officer: {
    url: "/models/galaxy/bf2017/crew/officer.glb",
    tall: 1.8,
    rig: "walrus",
    lod: true,
    full: true,
    fullMB: 56,
    fullDL: 27,
  },
  civcity1: {
    url: "/models/galaxy/bf2017/crew/civcity1.glb",
    tall: 1.75,
    rig: "walrus",
    lod: true,
    full: true,
    fullMB: 81,
    fullDL: 42,
  },
  civcity2: {
    url: "/models/galaxy/bf2017/crew/civcity2.glb",
    tall: 1.65,
    rig: "walrus",
    lod: true,
    full: true,
    fullMB: 34,
    fullDL: 21,
  },
  civcity3: {
    url: "/models/galaxy/bf2017/crew/civcity3.glb",
    tall: 1.78,
    rig: "walrus",
    lod: true,
    full: true,
    fullMB: 80,
    fullDL: 45,
  },
  astromech: {
    url: "/models/galaxy/bf2017/crew/astromech.glb",
    tall: 0.977,
    rig: "own",
    ownRig: "astromech",
    lod: true,
    full: true,
    fullMB: 32,
    fullDL: 18,
  },
  droid: {
    url: "/models/galaxy/bf2017/crew/droid.glb",
    tall: 1.046,
    rig: "own",
    ownRig: "astromech",
    lod: true,
    full: true,
    fullMB: 2,
    fullDL: 2,
  },
  ewok: {
    url: "/models/galaxy/bf2017/crew/ewok.glb",
    tall: 0.999,
    rig: "own",
    ownRig: "ewok",
    lod: true,
    full: true,
    fullMB: 11,
    fullDL: 9,
  },
  probe: {
    url: "/models/galaxy/bf2017/crew/probe.glb",
    tall: 1.624,
    rig: "own",
    ownRig: "probe",
    lod: true,
    far: true,
    full: true,
    fullMB: 4,
    fullDL: 4,
  },
  r5: {
    url: "/models/galaxy/bf2017/crew/r5.glb",
    tall: 1.165,
    rig: "own",
    ownRig: "astromech",
    lod: true,
    full: true,
    fullMB: 2,
    fullDL: 2,
  },
  superdroid: {
    url: "/models/galaxy/bf2017/crew/superdroid.glb",
    tall: 1.93,
    rig: "own",
    ownRig: "b2",
    lod: true,
    far: true,
    full: true,
    fullMB: 36,
    fullDL: 19,
  },
  tauntaun: {
    url: "/models/galaxy/bf2017/crew/tauntaun.glb",
    tall: 2.67,
    rig: "own",
    ownRig: "tauntaun",
    lod: true,
    full: true,
    fullMB: 27,
    fullDL: 12,
  },
  droideka: {
    url: "/models/galaxy/bf2017/crew/droideka.glb",
    tall: 2.016,
    rig: "own",
    ownRig: "droideka",
    lod: true,
    far: true,
    full: true,
    fullMB: 16,
    fullDL: 9,
  },
};
