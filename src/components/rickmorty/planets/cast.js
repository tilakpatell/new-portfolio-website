// The planets' people as the surface's people: a rigged kind of the
// catalogue (./catalog.js) made by the Meshy cast (portal/meshyCast.js's
// createMeshyCast, the one the scene makes for its crew and its peers) and
// wrapped in the shape galaxy/surface/crew.js's crewFigure gives the
// actors, on the cast's own animator: so a Gazorpian walks on his feet,
// waves, is hit, falls and is scared with the clips the cast already has,
// where the catalogue's model alone would only sway.
//
// createRmFigures(cast, { models, modelFigure }) → { figure(kind, spec, i), dispose() }
//   figure → Promise<{ model (in metres), tall, anim, update(dt, move,
//   motion?), play, stop, base, look, react, dispose } | null>: null for a
//   kind the cast hasn't (or won't load), which the actors then make as any
//   other kind (galaxy/surface/actors.js's figure hook falls through)
//   A life entry's `dye` (0xrrggbb, a list of them, one a figure in turn,
//   or a name in RM_DYES) dyes the figure (lib/three/dye.js: the hue at the
//   texel's luminance), so the purgers are Arthricia's model in five
//   colours. A set piece of a person that isn't rigged (the gearpeople) is
//   dyed from its plain model, when its entry asks; undyed it's the actors'.

import * as THREE from 'three';
import { NO_CALLS } from '../../../lib/three/figureCalls';
import { dyed } from '../../../lib/three/dye';
import { MESHY } from '../portal/meshyCast';
import { RM_MODELS } from './catalog';

// the planets' dyes by name: the Purge Planet's purgers, five of them a
// colour each; the gear police in blue; Bird World's folk, three plumages
export const RM_DYES = {
  purger: [0xc8402a, 0x2a7ac8, 0x8a3ac8, 0xd8b030, 0x3a9a4a],
  gearpolice: 0x3a6ad8,
  birdfolk: [0x2a8a9a, 0xc87a2a, 0x8a4a9a],
};

// the colour a life entry's i-th figure is dyed, or null
export function dyeOf(spec, i = 0) {
  const d = typeof spec?.dye === 'string' ? RM_DYES[spec.dye] : spec?.dye;
  if (d == null) return null;
  return Array.isArray(d) ? (d.length ? d[i % d.length] : null) : d;
}

// each mesh's material swapped for a dyed copy, the copies the figure's
// own to free (a cast's figures share their materials)
function dye(root, color) {
  const mine = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map((m) => dyed(m, { color })) : dyed(o.material, { color });
    mine.push(...[o.material].flat());
  });
  return () => mine.forEach((m) => m.dispose());
}

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
// (the surface's own model figures, fetched when the first dyed set piece is: the actors are the scene's)
const lazyModelFigure = (...a) => import('../../galaxy/surface/actors').then((m) => m.modelFigure(...a));

export function createRmFigures(cast, { models = RM_MODELS, modelFigure = lazyModelFigure } = {}) {
  const made = new Set();

  // a cast figure in metres: c.group stands c.height tall in the cast's units
  function wrap(c, tall, undye) {
    const k = tall / (c.height || tall);
    c.group.scale.setScalar(k);
    const model = new THREE.Group();
    model.add(c.group);
    const forward = new THREE.Vector3();
    const fig = {
      model,
      tall,
      anim: c.anim ?? null,
      update(dt, move, motion = null) {
        // (its motion in metres a second, read in the cast's units: over
        // this figure's scale, the life entry's included)
        const s = k * (model.scale.x || 1);
        const m = motion ? { ...motion, speed: (motion.speed ?? 0) / s, side: (motion.side ?? 0) / s } : null;
        c.update(0, move, 0, { dt, motion: m, after: false });
        model.getWorldQuaternion(_q);
        forward.set(0, 0, 1).applyQuaternion(_q);
        c.after?.(dt, m, { forward, up: UP });
      },
      play: c.play ?? NO_CALLS.play,
      stop: c.stop ?? NO_CALLS.stop,
      base: c.base ?? NO_CALLS.base,
      look: c.look ?? NO_CALLS.look,
      react: c.react ?? NO_CALLS.react,
      dispose() {
        made.delete(fig);
        undye?.();
        c.release?.();
        model.removeFromParent();
      },
    };
    made.add(fig);
    return fig;
  }

  async function figure(kind, spec = {}, i = 0) {
    const row = models[kind];
    if (!row) return null;
    const color = dyeOf(spec, i);
    if (!row.rigged) {
      if (color == null) return null;
      const fig = await modelFigure(kind, models).catch(() => null);
      if (!fig) return null;
      const undye = dye(fig.model, color);
      const own = fig.dispose;
      return { ...fig, dispose: () => (undye(), own?.call(fig)) };
    }
    await cast.load?.(null, [MESHY[kind]?.a ?? kind]).catch(() => {});
    const c = cast.make(kind, i, { tall: row.tall });
    if (!c) return null;
    return wrap(c, row.tall, color == null ? null : dye(c.group, color));
  }

  return {
    figure,
    dispose() {
      for (const f of [...made]) f.dispose();
    },
  };
}
