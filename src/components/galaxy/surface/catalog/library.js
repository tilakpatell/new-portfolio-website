// The library: what the worlds still built in code, or went without, once
// somebody's model of it turned up (from Sketchfab, brought in by
// scripts/sketchfab-surface.mjs: `node scripts/sketchfab-surface.mjs library <kind …>`)
// or once Meshy made it from Wookieepedia's picture of it
// (scripts/meshy-galaxy-library.mjs, made: 'meshy'). Each is written to
// public/models/galaxy/surface/<kind>.glb standing on y = 0, facing +z, in
// metres. A world that asks for one of these kinds gets the model in place
// of the built one; the rest wait here for a world to ask. (The other
// groups' headers have what each field means.)
export const MODELS = {
  // ── parked and standing: Naboo's hangar, Hoth's, the plains ──
  // the Trade Federation's AAT, on Naboo's plains
  aat: { uid: '9ed126f4616a482fabee52b0e0d46e52', as: 'the AAT battle tanks', metres: 9.75, along: 'max', yaw: 0, tris: 12000, tex: 1024 },
  // the E-Web on Hoth's trench line
  eweb: { uid: '05e7a18aeeb94478b45454eaa609346f', as: 'the E-Web heavy blasters', metres: 2.4, along: 'max', yaw: 0, tris: 6000, tex: 512, tint: '#7c8086', detail: 'metal' },
  // an X-wing parked in Echo Base's hangar
  parkedxwing: { uid: 'e6b85951f85940c1b26505eda7d73ef9', as: 'the parked X-wings', metres: 12.5, along: 'max', yaw: 0, tris: 20000, tex: 1024 },
  // Naboo's N-1s in Theed's hangar (the same model the galaxy flies)
  n1fighter: { uid: '3cf69f6c85234aac8844e845e74ac75b', as: 'the parked N-1 starfighters', metres: 11, along: 'max', yaw: 0, tris: 12000, tex: 1024 },
  // the Queen's ship on its pad
  royalship: { uid: 'f631077977754b5591298ecfa201380b', as: 'the Naboo royal starship', metres: 76, along: 'max', yaw: 0, tris: 20000, tex: 1024 },
  // the films' faces who stand where the worlds put them (their arms-down
  // poses didn't take Meshy's rig: scripts/meshy-galaxy.mjs)
  anakin: { uid: 'afde81fe035b4e0aa8d1b3b96c9fd7ff', as: 'Anakin Skywalker', metres: 1.85, yaw: 0, tris: 20000, tex: 1024 },
  krennic: { uid: '59c66eb5d470436f9d29d5720c9b402a', as: 'Director Krennic', metres: 1.79, yaw: Math.PI / 2, tris: 8000, tex: 1024 },
  cassian: { uid: '1ef27f2978d442e39eac1e62cf28e226', as: 'Cassian Andor', metres: 1.78, yaw: 0, tris: 8000, tex: 1024 },
  chirrut: { uid: '9340db8a8aab4091886d25a187b956fa', as: 'Chirrut Îmwe', metres: 1.75, yaw: 0.35, tris: 6000, tex: 1024 },
  mace: { uid: 'ba2eaba7ff6b45c89c1b2c4919e46880', as: 'Mace Windu', metres: 1.88, yaw: 0.6, tris: 8000, tex: 1024 },
  // ── for the worlds to come ──
  juggernaut: { uid: '4e331a37fe614fc783f0dcbcb77310cb', as: 'the clone turbo tanks', metres: 49, along: 'max', yaw: 0, tris: 16000, tex: 1024 },
  padme: { uid: '35e48eeb21f54d7e8a20e72f86753311', as: 'Padmé Amidala', metres: 1.65, yaw: 0, tris: 12000, tex: 1024 },
  mosespa: { uid: '3ca4aa22148f4435b7c763f0039c1449', as: 'the Mos Espa houses', metres: 16, along: 'max', yaw: 0, tris: 20000, tex: 1024, lod: true },
  tathouse: { uid: '66893ef6ad5f434e9db954b1f5496dfc', as: 'the Tatooine domed houses', metres: 9, along: 'max', yaw: 0, tris: 6000, tex: 1024 },
  tathouse2: { uid: '9cf63b1dfb234bab823879f78f367128', as: 'the Tatooine domed houses', metres: 9, along: 'max', yaw: 0, tris: 8000, tex: 1024 },
};
