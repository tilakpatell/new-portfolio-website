// The surface models that fill the galaxy's worlds in (the overhaul's
// "filled worlds" checkpoint: what stands about near every landing, and the
// landmarks and people the first sets left out), from Sketchfab: what
// scripts/sketchfab-surface.mjs brings in (`node scripts/sketchfab-surface.mjs fill`),
// each written to public/models/galaxy/surface/<kind>.glb standing on y = 0,
// facing +z, in metres. A group of its own, so no earlier lane's lines are
// touched. (The script's header has what each field means; `anim`, for a
// model kept rigged, names its clips: { idle, walk, run }.)
export const MODELS = {
  // ── Tatooine ──
  // a Jawa sandcrawler, the whole hull (its treads and the ramp)
  sandcrawler: { uid: 'b0d602dd705240638d09500054d67d66', lod: true, as: 'the sandcrawler', metres: 36, along: 'max', yaw: 0, tris: 40000, tex: 512, maps: 256 },
  eopie: { uid: '029de9e7d0264119bbc4cbff45b8ed04', as: 'the eopies', metres: 2.5, yaw: 0, tris: 8000, tex: 512 },
  ronto: { uid: 'abf77799b3334497a320cda4380c9741', as: 'the rontos', metres: 4.2, yaw: 0, tris: 10000, tex: 512 },
  // a Sullustan, for the cantina's crowd
  sullustan: { uid: '0fae75387d2c4396858d568b9fbb19ab', as: 'the Sullustans', metres: 1.6, yaw: 0, tris: 8000, tex: 512 },
  // an A-A5 speeder truck, the farms' haulier
  speedertruck: { uid: 'a04c9541663044eb97ce648a385e612c', as: 'the speeder trucks', metres: 7, along: 'z', yaw: 0, tris: 8000, tex: 1024 },
  // ── Hoth ──
  // the Rebels' crates on Hoth
  hothcrate: { uid: 'a45e657ce3094078b708ea180da8daba', as: 'the Rebel crates', metres: 1.4, along: 'max', yaw: 0, tris: 3000, tex: 512 },
  // a GR-75 medium transport, waiting to lift off
  gr75: { uid: '071b158d02c044ee9b431aeb28b85b6a', lod: true, as: 'the GR-75 transports', metres: 90, along: 'z', yaw: 0, tris: 30000, tex: 1024, maps: 512 },
  // ── Endor ──
  // an Ithorian in Rebel fatigues, rigged
  ithorian: { uid: 'ca01590e107a45aa9dd9c4386ccfe094', as: 'the Ithorian Rebel', metres: 2.2, yaw: 0, tris: 8000, tex: 512, rig: true },
  // ── Yavin 4 ──
  // a Rebel technician in the hangar, rigged
  rebeltech: { uid: 'a0d4d80dad1e43d6b4ab1d78e79b2898', as: 'the Rebel technicians', metres: 1.8, yaw: 0, tris: 8000, tex: 512, rig: true },
  // an X-wing pilot in an orange flight suit, rigged
  rebelpilot: { uid: 'efa36772d0984634ac6ed8a0e95f8d14', as: 'the Rebel pilots', metres: 1.8, yaw: 0, tris: 8000, tex: 512, rig: true },
  // a service ramp up to a fighter's cockpit
  yavinramp: { uid: '5e0619a6b994442983dd26db2c8448dc', as: 'the hangar service ramps', metres: 6, along: 'max', yaw: 0, tris: 12000, tex: 1024 },
  // a Y-wing, landed
  ywing: { uid: 'b8bb6476b1b14ba48987c7efc7b7087a', lod: true, as: 'the Y-wings', metres: 23.4, along: 'z', yaw: 0, tris: 24000, tex: 1024 },
  // ── Scarif ──
  k2so: { uid: '2761149238284abe8ce1bd8795c3d6b8', as: 'K-2SO', metres: 2.16, yaw: 0, tris: 10000, tex: 512 },
  jyn: { uid: '9547a563e09e4b26bc09a3453891e086', as: 'Jyn Erso', metres: 1.6, yaw: 0, tris: 6000, tex: 512 },
  baze: { uid: 'e30ad72b8ef74ead9739dad571bed50f', as: 'Baze Malbus', metres: 1.8, yaw: 0, tris: 6000, tex: 512 },
  // ── Kashyyyk, Geonosis ──
  // a BARC speeder, the clones' bike
  barc: { uid: '56ff0b8c18744664aa121db5d2039eb3', as: 'the BARC speeders', metres: 4.6, along: 'z', yaw: 0, tris: 12000, tex: 1024 },
  dwarfspider: { uid: '4f5d54b98b744c439a14fd897b946a4e', as: 'the dwarf spider droids', metres: 2, yaw: 0, tris: 10000, tex: 512 },
  homingspider: { uid: '5b714fe3a31f42e197ec0ed0e4d27c56', as: 'the homing spider droids', metres: 7.3, yaw: 0, tris: 10000, tex: 512 },
  // a Phase I clone trooper, as on Kamino and Geonosis
  clonephase1: { uid: 'c64ea97f5e854920b092d1d29763c935', as: 'the Phase I clone troopers', metres: 1.83, yaw: 0, tris: 8000, tex: 512 },
  // ── Mandalore ──
  armorer: { uid: 'e3e74228d7fc41b58f36ae110f58b690', as: 'the Armorer', metres: 1.75, yaw: 0, tris: 8000, tex: 512 },
  // ── every world: droids and cargo ──
  // an MSE-6 mouse droid
  mousedroid: { uid: 'bc78bbf16cf74d2580980e3123458348', as: 'the mouse droids', metres: 0.5, along: 'z', yaw: Math.PI / 2, tris: 1000, tex: 256 },
  // an R-series astromech, not Artoo
  astromech: { uid: '4d478a8e98f34c6193ee5d57817b3d9f', as: 'the astromech droids', metres: 1.1, yaw: 0, tris: 4000, tex: 512 },
  // an R5 unit in Imperial grey
  r5: { uid: '2d1bf74e06a347449a20c8f2181aac78', as: 'the R5 astromechs', metres: 1.1, yaw: 0, tris: 6000, tex: 512 },
  // the Empire's cargo: a long crate and a cube
  empirecrate: { uid: 'c004b40467914c28936fce2629d140cc', as: 'the Imperial cargo crates', metres: 1.6, along: 'max', yaw: 0, tris: 3000, tex: 512 },
  cratecube: { uid: 'd66fe8b5014b45b0ac313293a171b272', as: 'the Imperial cargo cubes', metres: 1.2, along: 'max', yaw: 0, tris: 3000, tex: 512 },
  // a barrel, a cooler and a bevelled crate: anyone's cargo
  barrel: { uid: '8646c0930a6c43bea75cbdf34812e3d2', as: 'the barrels', metres: 1.1, yaw: 0, tris: 3000, tex: 512 },
  cooler: { uid: '3444fba1f62a45abb905fd71da1a4331', as: 'the cargo coolers', metres: 0.9, yaw: 0, tris: 3000, tex: 512 },
  bevelcrate: { uid: '4bd794e931414a79bdacc83e439da6d4', as: 'the bevelled crates', metres: 0.7, yaw: 0, tris: 2500, tex: 512 },
};
