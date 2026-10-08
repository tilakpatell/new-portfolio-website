// The surface models for Naboo, Coruscant, Kamino and Geonosis, from Sketchfab: what
// scripts/sketchfab-surface.mjs brings in (`node scripts/sketchfab-surface.mjs core`),
// each written to public/models/galaxy/surface/<kind>.glb standing on y = 0,
// facing +z, in metres. (The script's header has what each field means;
// `anim`, for a model kept rigged, names its clips: { idle, walk, run }.)
export const MODELS = {
  // Jar Jar Binks
  gungan: { uid: '85aef3e496d44e9b95c7386035c0ef10', legs: { crotch: 0.46 }, as: 'the Gungans', metres: 1.96, yaw: 0, tris: 8000, tex: 384 },
  // the Republic gunship
  laat: { uid: 'cf7f6043210a418abdd818d5e8dd0fd8', as: 'the Republic gunships', metres: 17.4, along: 'z', yaw: -Math.PI / 2, up: 'y', tris: 20000, tex: 2048, maps: 1024 },
  // (R3negadeAidan's, rigged with its walk: the AT-TEs on the plain walk it)
  atte: { uid: '81ef81cf6c554055b741b43a1a08d69f', hero: true, as: 'the AT-TE walkers', metres: 22, along: 'max', yaw: 0, up: 'y', tris: 36000, tex: 2048, maps: 1024, rig: true, anim: { walk: 'Action' } },
  // the Petranaki arena on Geonosis
  // (its own map is 256 px over 150 m: the red rock scan carries it up close)
  arena: { uid: '797d475ee192467399c0ee6ee15b41ed', lod: true, hero: true, as: 'the Geonosian arena', metres: 150, along: 'max', yaw: 0, up: 'y', tris: 60000, tex: 2048, maps: 1024, drop: /chariot|Visor|Meathook|setka|WorldGrid|lambert1/, detail: 'redrock', detailLook: { strength: 0.5, normal: 0.9 }, solids: 'built' },
  // a Coruscant airspeeder, nose to +z
  airspeeder: { uid: '7766ca8e7bd047f5ad4bdb86d11ec6d4', as: 'the airspeeders', metres: 6, along: 'z', yaw: 0, up: 'y', tris: 16000, tex: 1024 },
  droideka: { uid: 'f3688d384b2042b6a8fc3360f64b9a48', machine: true, as: 'the droidekas', metres: 1.8, yaw: Math.PI, up: 'y', tris: 8000, tex: 512 },
  kaminoan: { uid: '5d758c4455b24ac383b94d7a4e30bbce', legs: { crotch: 0.44 }, as: 'the Kaminoans', metres: 2.6, yaw: 0, up: 'y', tris: 8000, tex: 512 },
  geonosian: { uid: '021a5902e34c4742a828335c86bfe4cd', legs: { crotch: 0.48 }, as: 'the Geonosians', metres: 1.7, yaw: Math.PI, up: 'y', tris: 8000, tex: 512 },
};
