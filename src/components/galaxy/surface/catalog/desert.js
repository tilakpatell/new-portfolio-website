// The surface models for Tatooine, from Sketchfab: what
// scripts/sketchfab-surface.mjs brings in (`node scripts/sketchfab-surface.mjs desert`),
// each written to public/models/galaxy/surface/<kind>.glb standing on y = 0,
// facing +z, in metres. (The script's header has what each field means;
// `anim`, for a model kept rigged, names its clips: { idle, walk, run }.)
export const MODELS = {
  // a moisture vaporator, the tall pole of a Tatooine farm
  // (ultra: four times the cut, from a 34,981-triangle download; its maps are 1024s)
  vaporator: { uid: 'acf6211d84eb4a46bb38c9a321771826', as: 'the moisture vaporators', metres: 5, along: 'y', yaw: 0, up: 'y', tris: 3000, tex: 512, recolor: [{ material: 'vaporator', to: '#b2aba0', amount: 1 }], ultra: { tris: 12000, tex: 1024 } },
  // Luke's X-34 landspeeder
  landspeeder: { uid: '3adfdc41c67f4731910800404ba97b4e', as: "Luke's landspeeder", metres: 3.4, along: 'z', yaw: 0, up: 'y', tris: 16000, tex: 1024 },
  jawa: { uid: '08124df6beef4ca18b2d24a25f5fd6bf', as: 'the Jawas', metres: 1, along: 'y', yaw: 0, up: 'y', tris: 8000, tex: 512 },
  bantha: { uid: '3581f3a312dc426d87af3031f5198edf', turn: -0.572, as: 'the banthas', metres: 2.8, along: 'y', yaw: 0, up: 'y', tris: 10000, tex: 512, gain: 1.3, rig: true, anim: { walk: 'Bantha_Walk' } },
  // a domed adobe house of Mos Eisley
  adobe: { uid: '66893ef6ad5f434e9db954b1f5496dfc', as: 'the adobe houses', metres: 10, along: 'max', yaw: Math.PI, up: 'y', tris: 35000, tex: 1024, recolor: [{ material: '*', to: '#c3b59f', amount: 1, band: [0.15, 0.52] }] },
  dewback: { uid: 'b84145ed48d143ff8746eda2623b3bd8', as: 'the dewbacks', metres: 4, along: 'max', yaw: 0, up: 'y', tris: 10000, tex: 512 },
  // Anakin's podracer
  podracer: { uid: 'dac6d14dcf914e88af8625b59f4020bc', as: 'the podracers', metres: 10, along: 'max', yaw: 0, up: 'y', tris: 16000, tex: 512, maps: 128 },
  // the rancor, rigged (its one clip a breathing idle)
  rancor: { uid: '983d578002d74691a3da6a5aad700a6c', as: 'the rancor', metres: 5, yaw: 0, tris: 20000, tex: 1024, maps: 512, rig: true, anim: { idle: 'Unreal Take' } },
  // Jabba's sail barge, the Khetanna (a diecast toy's shape)
  sailbarge: { uid: '47acb5ba43f74bba9c904c9c3bd5d83b', lod: true, as: "Jabba's sail barge", metres: 30, along: 'z', yaw: -Math.PI / 2, tris: 40000, tex: 1024 },
  jabba: { uid: '524e1fcf8c774573b5b15496efc4f572', as: 'Jabba the Hutt', metres: 3.9, along: 'max', yaw: 0, tris: 20000, tex: 1024, maps: 512 },
  // a GNK power droid
  gonk: { uid: '99e5fe9631d74b0aaa3ff0b8223c72d3', as: 'the gonk droids', metres: 1.1, yaw: 0, tris: 12000, tex: 512 },
  // Salacious B. Crumb (a scan of a collectible figure)
  salacious: { uid: '60b4c93af8644d21992a5ee6bd60af31', as: 'Salacious B. Crumb', metres: 0.7, yaw: 0, tris: 12000, tex: 1024 },
  // a dejarik holochess table, its monsters on the board
  dejarik: { uid: '49790bf56ec74e5c82b8ef462ae7ab68', as: 'the dejarik tables', metres: 1.6, along: 'max', yaw: 0, tris: 20000, tex: 1024 },
  // C-3PO's and R2-D2's escape pod, come down in the Dune Sea
  escapepod: { uid: '744b53ababd640c089b9db03b02c968d', as: 'the escape pod', metres: 2.8, along: 'y', yaw: 0, tris: 6100, tex: 1024 },
  // the krayt dragon's bones, half in the sand (a museum's blue whale
  // skeleton: the long spine, the ribs, the great jaw)
  krayt: { uid: '018b2c21e4534f34aa9deb55141407b3', as: 'the krayt dragon’s bones', metres: 30, along: 'max', yaw: 0, tris: 6200, tex: 1024 },
  // a Jawa sandcrawler (flat-coloured as it comes: the metal scan laid over it)
  sandcrawler: { uid: 'af4b4facdc504e5fac8a96abf4bb770d', lod: true, as: 'the Jawa sandcrawler', metres: 36, along: 'max', yaw: -Math.PI / 2, tris: 30000, tex: 1024, detail: 'metal' },
  // the pieces of a Tatooine town (chuckcg's kitbash, each on its own): the
  // great buttressed tower, the arch, two houses (its spire and its stall
  // are the audit lane's now, catalog/audit.js)
  mostower: { uid: 'b5a2140fa2264bac8a4b6de3693272b6', pick: /^SW tower /, as: 'the towers of Mos Eisley', metres: 30, along: 'y', yaw: 0, tris: 20000, tex: 1024, detail: 'adobe' },
  mosarch: { uid: 'b5a2140fa2264bac8a4b6de3693272b6', pick: /^swarch/, as: 'the arches of Mos Eisley', metres: 10, along: 'x', yaw: 0, tris: 8000, tex: 1024, detail: 'adobe', recolor: [{ material: '^SWarch_mat$', to: '#8e8170', amount: 1 }] },
  moshouse: { uid: 'b5a2140fa2264bac8a4b6de3693272b6', pick: /^(SW house 1|door1_door_mat_0)/, as: 'the houses of Mos Eisley', metres: 8, along: 'max', yaw: 0, tris: 8000, tex: 1024, detail: 'adobe', recolor: [{ material: '^SWhouse1_mat$', to: '#bbb09e', amount: 1 }] },
  moshut: { uid: 'b5a2140fa2264bac8a4b6de3693272b6', pick: /^(SW house 2|door1\.001_door)/, as: 'the huts of Mos Eisley', metres: 6.5, along: 'max', yaw: 0, tris: 6000, tex: 1024, detail: 'adobe', recolor: [{ material: '^SWhouse2_mat$', to: '#ada18e', amount: 1 }] },
  // a block of Mos Eisley: a sloped-walled house, its domed rooftop, the
  // vaporators beside it
  mosblock: { uid: 'e5c41d421d284ffea6fa82516a0a35e5', as: 'the blocks of Mos Eisley', metres: 11, along: 'max', yaw: 0, tris: 10500, tex: 1024, detail: 'adobe', recolor: [{ material: '^M_(wall_Bat|pillard_Cracked)$', to: '#c9bfad', amount: 1 }, { material: '^M_container_Cylindrique$', to: '#b9ae99', amount: 1 }], look: { metalness: 0, roughness: 0.95, roughnessMap: null } },
  // a docking bay: the round pit, its walls and ramps (bare as it comes:
  // the plaster scan and sand colour laid over it)
  dockingbay: { uid: '20863d782fb34a02871cef941ecb0aca', as: 'the docking bays', metres: 31, along: 'max', yaw: 0, tris: 14600, tex: 512, detail: 'adobe', tint: '#c4ad8a', solids: 'built' },
};
