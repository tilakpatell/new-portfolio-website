// The surface models for the Outer Rim of The Mandalorian and Ahsoka
// (Nevarro, Mandalore, Lothal, Sorgan), from Sketchfab: what
// scripts/sketchfab-surface.mjs brings in (`node scripts/sketchfab-surface.mjs outer`),
// each written to public/models/galaxy/surface/<kind>.glb standing on y = 0,
// facing +z, in metres. (The script's header has what each field means;
// `anim`, for a model kept rigged, names its clips: { idle, walk, run }.)
export const MODELS = {
  // Grogu, in his robe
  grogu: { uid: '485192995fea4845a92b3fd92b8b188e', as: 'Grogu', metres: 0.4, yaw: 0, tris: 10000, tex: 512 },
  // an IG-series assassin droid (IG-88's frame, as IG-11 is built)
  ig11: { uid: 'a692ce1902b44511992b47b8f4672e61', as: 'IG-11', metres: 2, yaw: -Math.PI / 4, tris: 3000, tex: 512, rig: true, anim: { idle: 'Take 001' } },
  kuiil: { uid: 'd9baac7f1b744086854b3cfd201497d1', as: 'Kuiil', metres: 1.2, yaw: 0, tris: 6000, tex: 512 },
  mudhorn: { uid: '4898a1f161a94bee9b73e86cfa088444', lod: true, as: 'the mudhorn', metres: 3, yaw: Math.PI / 2, tris: 20000, tex: 1024, maps: 512 },
  // the Razor Crest, landed
  razorcrest: { uid: '172cb62cc1e141cfae4c48440c348de0', lod: true, as: 'the Razor Crest', metres: 23, along: 'z', yaw: 0, tris: 30000, tex: 1024, maps: 512 },
  // Ahsoka Tano, grown (as on Corvus)
  ahsokafig: { uid: '6979913cf90342ffa37b1151641babd2', as: 'Ahsoka Tano', metres: 1.85, yaw: 0, tris: 6000, tex: 512 },
  // the Mandalorian, Din Djarin
  dindjarin: { uid: 'e70db49d54f04cdfbdbbd2e36f84f0a6', legs: { crotch: 0.45 }, as: 'the Mandalorian', metres: 1.85, yaw: 0, tris: 16000, tex: 1024, maps: 512 },
  // Sorgan's woods: birches and firs, and ferns under them (the krill
  // farmers' huts are the audit lane's, catalog/audit.js)
  sorganbirch: { uid: 'aa842dffd9654d33b8b91170ce83c172', as: 'the birches of Sorgan', metres: 15, yaw: 0, tris: 3000, tex: 1024 },
  sorganfir: { uid: '3f39aa5485e94477a36b435f7a1a8b54', as: 'the firs of Sorgan', metres: 19, yaw: 0, tris: 2500, tex: 1024 },
  sorganfern: { uid: 'b99bb3d69eb84965ad70a6b2b6a1f2dd', as: 'the ferns of Sorgan', metres: 1.1, yaw: 0, tris: 900, tex: 512 },
  // Nevarro's black lava rock, scanned
  lavarock: { uid: '7a8f0459c26d4a45875b58df38f9e6d9', as: 'the lava rocks of Nevarro', metres: 3, along: 'max', yaw: 0, tris: 3000, tex: 1024, maps: 512 },
  // the glass the Purge left on Mandalore
  glassshard: { uid: '565313347d6e4dc28c00cb095774995f', as: 'the glass of Mandalore', metres: 2.4, yaw: 0, tris: 1500, tex: 512 },
  // Made with Meshy, each from a real picture of the place (the back lane's
  // scripts/meshy-galaxy-buildings-back.mjs; listed in public/cc0/README.md):
  // Nevarro City's stone gate (its domes are the audit lane's), Lothal's Jedi
  // temple (a banded cone of rock) and a domed farmhouse of its plains, and
  // Sundari, Mandalore's domed capital
  nevarroarch: { made: 'meshy', as: 'the gate of Nevarro City', metres: 11, tint: '#b6b2aa', detail: 'concrete' },
  lothtemple: { made: 'meshy', as: 'the Jedi temple of Lothal', metres: 70, hero: true, tint: '#a4a99c', detail: 'rock' },
  lothdome: { made: 'meshy', as: 'the domed farmhouses of Lothal', metres: 11, tint: '#e2d3b2', detail: 'concrete' },
  sundaridome: { made: 'meshy', as: 'Sundari', metres: 51, hero: true, lod: true, tint: '#9d9890', detail: 'concrete', ultra: { tris: 159995, tex: 8192 } },
  // Nevarro rebuilt (scripts/meshy-galaxy-buildings-nevarro.mjs: lifted out
  // of the show's stills, or from words where none shows it whole): the
  // city's grey plaster houses, dome houses and street fronts, its round-
  // arched gate, a third-season tower, its own cantina, the Imperial base on
  // its cliff, the Charon River's tunnel mouth and the keelboat. The town's
  // houses repeat dozens of times, so each has a light copy for far off
  // though they're under scripts/galaxy-surface-lod.mjs's line (made with
  // its makeLod, `over: 5000`)
  nevarrohouse: { made: 'meshy', lod: true, as: 'the houses of Nevarro City', metres: 12, detail: 'adobe' },
  nevarrodomehouse: { made: 'meshy', lod: true, as: 'the dome houses of Nevarro City', metres: 10, detail: 'adobe' },
  nevarrorow: { made: 'meshy', lod: true, as: 'the streets of Nevarro City', metres: 20, detail: 'adobe' },
  nevarrogate: { made: 'meshy', as: 'the gate of Nevarro City', metres: 14 },
  nevarrotower: { made: 'meshy', lod: true, as: 'the towers of the new Nevarro City', metres: 16 },
  nevarrocantina: { made: 'meshy', as: 'Greef Karga’s cantina', metres: 18.5, detail: 'adobe' },
  nevarrobase: { made: 'meshy', as: 'the Imperial base on Nevarro', metres: 52, hero: true, lod: true, detail: 'metal' },
  charonportal: { made: 'meshy', as: 'the Charon River’s tunnel', metres: 16 },
  keelboat: { made: 'meshy', as: 'the keelboat on the Charon', metres: 9 },
};
