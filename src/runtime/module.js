// The module contract, checked, and the wrap that makes a scene module
// written for lib/three/useScene (create(canvas, ctx) → { render(ms, now)
// → bool, ... }) into a world module without changing it.
//
// A world module: { id, shading: 'glsl' | 'nodes', mb, create(rt, props) }.
// A world: { ready?, resize(w, h), step?(dt, input, now), draw(frame),
//   wants?(), update?(props), setVisible?(on), setColors?(colors),
//   lowerQuality?(level), warmUp?(timeLeft), handoff?(), dispose() }.

import { STEPS } from '../lib/three/pace';

export const SHADINGS = ['glsl', 'nodes'];

export function validateModule(mod) {
  const missing = [];
  if (!mod || typeof mod.id !== 'string' || !mod.id) missing.push('id');
  if (!mod || typeof mod.create !== 'function') missing.push('create');
  if (missing.length) throw new Error(`world module needs ${missing.join(', ')}`);
  const shading = mod.shading ?? 'glsl';
  if (!SHADINGS.includes(shading)) throw new Error(`world module ${mod.id}: shading must be glsl or nodes`);
  return { ...mod, shading, mb: mod.mb ?? 0 };
}

export function validateWorld(world) {
  if (!world || typeof world !== 'object') throw new Error('a world module must return a world');
  const missing = ['draw', 'resize', 'dispose'].filter((k) => typeof world[k] !== 'function');
  if (missing.length) throw new Error(`a world needs ${missing.join(', ')}`);
  return world;
}

// fromScene(id, create, { shading, mb }): the scene's render(ms, now) is
// the world's draw, its answer is wants(); ctx gets the canvas's box as
// `el`, the runtime's invalidate and lost, and the quality floor as onSlow.
export function fromScene(id, create, { shading = 'glsl', mb = 0 } = {}) {
  return {
    id,
    shading,
    mb,
    async create(rt, props = {}) {
      let scene = null;
      const ctx = {
        ...props,
        el: rt.host,
        colors: props.colors,
        reduced: Boolean(props.reduced),
        invalidate: () => rt.invalidate(),
        onLost: () => rt.lost(),
        onSlow: () => scene?.lowerQuality?.(STEPS.length),
      };
      scene = await create(rt.gfx.canvas, ctx);
      let more = true;
      const world = {
        resize: (w, h) => scene.resize(w, h),
        draw: (frame) => {
          more = scene.render(frame.dt * 1000, frame.now) !== false;
        },
        wants: () => more,
        update: (p) => scene.update?.(p),
        setVisible: (on) => scene.setVisible?.(on),
        setColors: (c) => scene.setColors?.(c),
        lowerQuality: (level) => scene.lowerQuality?.(level),
        warmUp: (timeLeft) => (scene.warmUp ? scene.warmUp(timeLeft) : true),
        handoff: () => (scene.handoff ? scene.handoff() : null),
        dispose: () => scene.dispose(),
      };
      if (scene.ready) world.ready = scene.ready;
      return world;
    },
  };
}
