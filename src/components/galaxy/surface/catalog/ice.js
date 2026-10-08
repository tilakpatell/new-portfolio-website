// The surface models for Hoth, from Sketchfab: what
// scripts/sketchfab-surface.mjs brings in (`node scripts/sketchfab-surface.mjs ice`),
// each written to public/models/galaxy/surface/<kind>.glb standing on y = 0,
// facing +z, in metres. (The script's header has what each field means;
// `anim`, for a model kept rigged, names its clips: { idle, walk, run }.)
export const MODELS = {
  // (kept rigged, so the walkers on Hoth and Scarif walk the model's own
  // walk; its maps at 2K, as it's the biggest thing on the plain)
  // (ultra: the whole download, 74,295 triangles; its maps are 1024s)
  atat: { uid: '7eab3f41da9143d8975b9034e91f8920', hero: true, as: 'the AT-AT walkers', metres: 22.5, yaw: 0, tris: 40000, tex: 2048, maps: 1024, rig: true, anim: { walk: 'Walk' }, ultra: { tris: 74295, tex: 1024 } },
  // a T-47 airspeeder
  snowspeeder: { uid: '983d113a8414457d9a797b9fa7425507', as: 'the snowspeeders', metres: 5.3, along: 'z', yaw: 0, tris: 11000, tex: 512, maps: 128 },
  wampa: { uid: 'fbd7530481db420ab6b6ac29f63019c9', as: 'the wampas', metres: 3, yaw: 0, tris: 12000, tex: 1024 },
  // the Imperial probe droid (a Viper)
  probe: { uid: 'd2de16581b574e2584ef75d87e358356', machine: true, as: 'the probe droids', metres: 2.4, yaw: 0, tris: 8000, tex: 512 },
  // a DF.9 anti-infantry battery
  turret: { uid: 'e15d4f794ed24f8fb385695ce5255bbd', as: 'the DF.9 turrets', metres: 4, yaw: Math.PI / 2, tris: 16000, tex: 1024, detail: 'paint', detailLook: { strength: 0.5, metres: 1.5 } },
  // a GR-75 medium transport set down on the ice (the long clamshell hull,
  // the command pod on its back: the metal scan over its plating)
  gr75: { uid: '071b158d02c044ee9b431aeb28b85b6a', lod: true, as: 'the GR-75 transports', metres: 90, along: 'z', yaw: 0, tris: 30000, tex: 1024, detail: 'metal' },
  // Echo Base's DSS-02 shield generator: the row of great discs on their
  // axle the walkers came for (bare as it comes: painted plates over it)
  hothgenerator: { uid: '802f9af203c340af9f2674db95735dbd', lod: true, as: 'the shield generator', metres: 48, along: 'max', yaw: 0, tris: 23000, tex: 512, tint: '#b9bec5', detail: 'metal', detailLook: { strength: 0.6, normal: 0.8, metres: 2 } },
};
