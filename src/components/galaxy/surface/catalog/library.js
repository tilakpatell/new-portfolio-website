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
  // (ultra: the whole download, 32,101 triangles; its maps are 1024s)
  n1fighter: { uid: '3cf69f6c85234aac8844e845e74ac75b', as: 'the parked N-1 starfighters', metres: 11, along: 'max', yaw: 0, tris: 12000, tex: 1024, ultra: { tris: 32101, tex: 1024 } },
  // the Queen's ship on its pad
  royalship: { uid: 'f631077977754b5591298ecfa201380b', as: 'the Naboo royal starship', metres: 76, along: 'max', yaw: 0, tris: 20000, tex: 1024 },
  // the films' faces who stand where the worlds put them (their arms-down
  // poses didn't take Meshy's rig: scripts/meshy-galaxy.mjs)
  anakin: { uid: 'afde81fe035b4e0aa8d1b3b96c9fd7ff', legs: { crotch: 0.32 }, as: 'Anakin Skywalker', metres: 1.85, yaw: 0, tris: 20000, tex: 1024 },
  krennic: { uid: '59c66eb5d470436f9d29d5720c9b402a', legs: { crotch: 0.47 }, as: 'Director Krennic', metres: 1.79, yaw: Math.PI / 2, tris: 8000, tex: 1024 },
  cassian: { uid: '1ef27f2978d442e39eac1e62cf28e226', legs: { crotch: 0.46 }, as: 'Cassian Andor', metres: 1.78, yaw: 0, tris: 8000, tex: 1024 },
  chirrut: { uid: '9340db8a8aab4091886d25a187b956fa', as: 'Chirrut Îmwe', metres: 1.75, yaw: 0.35, tris: 6000, tex: 1024 },
  mace: { uid: 'ba2eaba7ff6b45c89c1b2c4919e46880', legs: { crotch: 0.3 }, as: 'Mace Windu', metres: 1.88, yaw: 0.6, tris: 8000, tex: 1024 },
  // ── for the worlds to come ──
  juggernaut: { uid: '4e331a37fe614fc783f0dcbcb77310cb', as: 'the clone turbo tanks', metres: 49, along: 'max', yaw: 0, tris: 16000, tex: 1024 },
  padme: { uid: '35e48eeb21f54d7e8a20e72f86753311', as: 'Padmé Amidala', metres: 1.65, yaw: 0, tris: 12000, tex: 1024 },
  mosespa: { uid: '3ca4aa22148f4435b7c763f0039c1449', as: 'the Mos Espa houses', metres: 16, along: 'max', yaw: 0, tris: 20000, tex: 1024, lod: true },
  tathouse: { uid: '66893ef6ad5f434e9db954b1f5496dfc', as: 'the Tatooine domed houses', metres: 9, along: 'max', yaw: 0, tris: 6000, tex: 1024 },
  tathouse2: { uid: '9cf63b1dfb234bab823879f78f367128', as: 'the Tatooine domed houses', metres: 9, along: 'max', yaw: 0, tris: 8000, tex: 1024 },
  // ── made with Meshy from Wookieepedia's picture of each (scripts/meshy-galaxy-library.mjs) ──
  // the creatures the worlds built in code: Hoth's tauntauns, the Geonosis
  // arena's acklay, Naboo's kaadu, Beggar's Canyon's womp rats, Dagobah's
  // bogwings, Kamino's aiwhas, Mustafar's lava fleas
  tauntaun: { made: 'meshy', as: 'the tauntauns', metres: 2.5, along: 'y' },
  acklay: { made: 'meshy', as: 'the acklay', metres: 6, along: 'max' },
  kaadu: { made: 'meshy', as: 'the kaadu', metres: 2.4, along: 'y' },
  womprat: { made: 'meshy', as: 'the womp rats', metres: 0.85, along: 'max' },
  bogwing: { made: 'meshy', as: 'the bogwings', metres: 2.2, along: 'max' },
  aiwha: { made: 'meshy', as: 'the aiwhas', metres: 14, along: 'max' },
  lavaflea: { made: 'meshy', as: 'the lava fleas', metres: 5, along: 'y' },
  // and the ones to come: the arena's nexu and reek, Utapau's varactyls,
  // Lothal's loth-cats and loth-wolves
  nexu: { made: 'meshy', as: 'the nexu', metres: 4, along: 'max' },
  reek: { made: 'meshy', as: 'the reek', metres: 5, along: 'max' },
  varactyl: { made: 'meshy', as: 'the varactyls', metres: 10, along: 'max' },
  lothcat: { made: 'meshy', as: 'the loth-cats', metres: 0.6, along: 'y' },
  lothwolf: { made: 'meshy', turn: -0.181, as: 'the loth-wolves', metres: 2.4, along: 'y' },
  // the worlds' landmarks still built in code, made with Meshy over the built
  // one's walls and decks (solids: 'built'), so its doors and floors still
  // work: the Mos Eisley cantina (and Nevarro's), Varykino, Endor's shield
  // generator; and Mustafar's collector rig for later (its deck stands
  // higher than the duel's built one). (The Gungans' stone heads are the
  // audit lane's now, catalog/audit.js.)
  cantina: { made: 'meshy', as: 'the cantina', metres: 18.5, along: 'max', solids: 'built', detail: 'adobe' },
  // (Nevarro's: a copy of it in the grey of the city's concrete, Greef Karga's)
  nevcantina: { made: 'meshy', as: 'Greef Karga’s cantina', metres: 18.5, along: 'max', solids: 'built', detail: 'concrete', tint: '#9c9a94' },
  varykino: { made: 'meshy', as: 'the lake retreat at Varykino', metres: 28, along: 'y', solids: 'built', hero: true, lod: true, detail: 'adobe', tint: '#f2d3a0' },
  shieldgen: { made: 'meshy', as: 'the shield generator', metres: 70, along: 'y' },
  lavacollector: { made: 'meshy', as: 'the lava collector', metres: 16, along: 'max', solids: 'built' },
  // the vehicles the worlds built in code: Naboo's MTT and Gungan bongo
  // (the AAT is Sketchfab's, above); and for the worlds to come: Jabba's
  // skiff, a swoop, a STAP, the AT-DP, Naboo's flash speeder, the Imperial
  // troop transport, and the Outer Rim's blurrgs, happabores and fambaas
  mtt: { made: 'meshy', as: 'the MTT troop carriers', metres: 31, along: 'max' },
  bongo: { made: 'meshy', as: 'the Gungan bongos', metres: 15, along: 'max' },
  skiff: { made: 'meshy', as: 'the desert skiffs', metres: 9, along: 'max' },
  swoop: { made: 'meshy', as: 'the swoop bikes', metres: 4, along: 'max' },
  stap: { made: 'meshy', as: 'the STAPs', metres: 4, along: 'y' },
  atdp: { made: 'meshy', as: 'the AT-DP walkers', metres: 8.5, along: 'y' },
  flash: { made: 'meshy', as: 'the flash speeders', metres: 6, along: 'max' },
  itt: { made: 'meshy', as: 'the Imperial troop transports', metres: 13, along: 'max' },
  blurrg: { made: 'meshy', turn: -0.14, as: 'the blurrgs', metres: 2.6, along: 'y' },
  happabore: { made: 'meshy', as: 'the happabores', metres: 5, along: 'max' },
  fambaa: { made: 'meshy', as: 'the fambaas', metres: 11, along: 'max' },
};
