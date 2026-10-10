// The scene under a level's area's light while you're inside it (levelArea.js:
// Kamino's storm, its light the game's record, `look`): the galaxy's key
// light turned to the storm's sun, its second key to a lightning strike's
// flash from where it struck, its ambient to the storm's sky, the level's
// reflection probe as what shiny things reflect, and the world's grading
// LUT in the post's last pass. Nothing is added to the scene (a new light
// would recompile every material in it): the galaxy's own lights are set,
// and set back as they were when you leave.
//
//   createAreaLook({ scene, renderer, post, keys, ambient, url, probes, lut })
//     → { apply(area | null, camera), dispose() }
//   (`area`: levelArea.js's, with its `look`, `flash`, `strikeAt` and
//   `group`; `url`: the asset base's (lib/assetBase.js's assetUrl);
//   `probes`, `lut`: injected for the tests)

import * as THREE from 'three';
import { createProbeEnv } from '../../lib/three/probeEnv';
import { loadLut } from '../../lib/three/gameLut';

// the storm's light in the galaxy's units (its key light is 2.2 in space):
// a dim sun through the cloud, a strong cool fill from the whole sky, the
// probe's shine, a strike's flash
// (env: a share of the probe at the site's level, the record's probeScale)
export const STORM = { sun: 0.6, ambient: 0.55, env: 0.6, flash: 9, grey: 0.45 };
const FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

export function createAreaLook({ scene, renderer = null, post = null, keys, ambient, url = (p) => p, probes = null, lut = loadLut }) {
  let held = null; // what the galaxy had, while the area's light is on
  let on = null; // the area whose light is on
  let env = null;
  let grade = null;
  let ticket = 0;
  const holder = probes ?? (renderer ? createProbeEnv({ renderer }) : null);
  const strike = new THREE.Vector3();

  const enter = (area) => {
    const look = area.look;
    held = {
      key0: { color: keys[0].color.clone(), pos: keys[0].position.clone(), i: keys[0].intensity },
      key1: { color: keys[1].color.clone(), pos: keys[1].position.clone(), i: keys[1].intensity },
      ambient: { color: ambient.color.clone(), i: ambient.intensity },
      env: scene.environment,
      envI: scene.environmentIntensity ?? 1,
    };
    on = area;
    keys[0].color.set(look.sun.color);
    keys[0].position.fromArray(look.sun.dir).multiplyScalar(100);
    keys[1].color.set('#cfe0ff');
    // (the sky's colour, greyed toward the storm's: the record's horizon is its brightest, bluest band)
    ambient.color.set(look.sky).lerp(new THREE.Color('#6d747c'), STORM.grey);
    const mine = ++ticket;
    if (look.probe && holder)
      holder
        .load(FACES.map((f) => url(`/${look.probe}.${f}.hdr`)))
        .then((tex) => {
          if (!tex || mine !== ticket || on !== area) return;
          env = tex;
          scene.environment = tex;
          scene.environmentIntensity = STORM.env * (look.probeScale ?? 0);
        })
        .catch(() => {});
    if (look.lut && post?.grading)
      lut(url(`/${look.lut.url}`), look.lut.size)
        .then((tex) => {
          if (!tex || mine !== ticket || on !== area) return;
          grade = tex;
          post.grading({ lut: tex, size: look.lut.size });
        })
        .catch(() => {});
  };

  const leave = () => {
    ticket += 1;
    keys[0].color.copy(held.key0.color);
    keys[0].position.copy(held.key0.pos);
    keys[0].intensity = held.key0.i;
    keys[1].color.copy(held.key1.color);
    keys[1].position.copy(held.key1.pos);
    keys[1].intensity = held.key1.i;
    ambient.color.copy(held.ambient.color);
    ambient.intensity = held.ambient.i;
    if (env) {
      scene.environment = held.env;
      scene.environmentIntensity = held.envI;
    }
    if (grade) post?.grading?.(null);
    env = null;
    grade = null;
    held = null;
    on = null;
  };

  return {
    // each frame, after the galaxy's own light is set: the area's over it while you're inside
    apply(area, camera) {
      const want = area?.look ? area : null;
      if (on && on !== want) leave();
      if (!want) return;
      if (!on) enter(want);
      const f = want.flash ?? 0;
      keys[0].intensity = STORM.sun;
      ambient.intensity = STORM.ambient * (1 + f * 0.8);
      // (the flash from where it struck, as seen from here)
      keys[1].intensity = f * STORM.flash;
      if (f > 0 && want.strikeAt && camera) {
        strike.fromArray(want.strikeAt).add(want.group.position).sub(camera.position);
        if (strike.lengthSq() > 1e-6) keys[1].position.copy(strike.normalize().multiplyScalar(100));
      }
    },
    get on() {
      return Boolean(on);
    },
    dispose() {
      if (on) leave();
    },
  };
}
