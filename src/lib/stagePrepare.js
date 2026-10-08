// A world on lib/stage3d made ready behind its loading veil before its first
// frame is shown (lib/three/gpuWork's prepareScene): its models and lazily
// built places in, its floor light baked, its pictures sent and its shaders
// compiled a slice at a time, and everything drawn once into a pixel.
//
// The world's own frame loop runs while it prepares, so the camera, the sun
// and whoever's about are put where the first frame will have them (the
// floor's bake reads the sun). The world's render does all of that and then,
// in place of stage.render, asks held(): true while it's preparing, and the
// frame isn't drawn. A world's page passes its loop no time meanwhile, so
// nothing moves behind the veil.
//
// stagePrepare(stage, { soft, roots, grounds, busy, late, wait, bakeWait })
//   → { held(), preparing, prepare(onProgress, alive) }
//
// `soft` as the stage was made (it then draws straight to the canvas, so its
// shaders are made for that); `roots()` what to prepare (by default what's
// shown in the scene: a place built but hidden has lights of its own, and is
// prepared when it's first shown, as before); `grounds()` the world's
// groundWorld handles, whose bake under way is waited for; `busy()` true
// while something it loads is still on its way (an area, a figure);
// `late()` promises for loads that come after the world's made. Every wait
// is bounded (`wait` ms, `bakeWait` for the bake), so it never hangs, and it
// never throws: what isn't ready by then the first frames do as before.

import { nextFrame, prepareScene } from './three/gpuWork';
import { settle } from './settle';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function stagePrepare(stage, { soft = false, roots = null, grounds = () => [], busy = () => false, late = () => [], wait = 5000, bakeWait = 10000, frame = nextFrame } = {}) {
  let holding = false;
  let placed = false;
  let living = () => true;

  const prepare = async (onProgress, alive = () => true) => {
    const going = () => {
      try {
        return Boolean(alive()) && !stage.lost && !stage.disposed;
      } catch {
        return false;
      }
    };
    const say = (f, step) => {
      try {
        onProgress?.(f, step);
      } catch {
        // (a page's bar isn't the work's business)
      }
    };
    holding = true;
    placed = false;
    living = going;
    try {
      say(0, null);
      // laid out once by the world's own frame, and what it's still loading in
      const began = now();
      while (going() && now() - began < wait && (!placed || busy())) await frame();
      if (!going()) return;
      let waits = [];
      try {
        waits = [].concat(late() ?? []).filter(Boolean);
      } catch {
        waits = [];
      }
      if (waits.length) await settle(Promise.allSettled(waits), wait);
      if (!going()) return;
      // a floor bake under way (one not started yet waits for its floor to be shown)
      let baking = [];
      try {
        baking = [].concat(grounds() ?? []).filter((g) => g?.stats?.started && !g.stats.baked);
      } catch {
        baking = [];
      }
      if (baking.length) {
        say(0.08, 'bake');
        await settle(Promise.allSettled(baking.map((g) => g.bake())), bakeWait);
      }
      if (!going()) return;
      // the passes' own shaders, in the background
      await settle(stage.precompile(null), wait);
      if (!going()) return;
      const { renderer, scene, camera } = stage;
      let list;
      try {
        list = roots ? roots() : scene.children.filter((o) => o.visible);
      } catch {
        list = [scene];
      }
      // the frames draw into the passes' buffer, and a shader is made for where it draws
      try {
        renderer.setRenderTarget(soft ? null : stage.composer.readBuffer);
        await prepareScene({
          renderer,
          roots: list,
          scene,
          camera,
          alive: going,
          frame,
          onProgress: (f, step) => say(0.15 + 0.85 * f, step),
          render: () => stage.render(0),
        });
      } catch (err) {
        if (import.meta.env?.DEV) console.warn('prepare failed', err);
      } finally {
        try {
          renderer.setRenderTarget(null);
        } catch {
          // (gone with its renderer)
        }
      }
      if (going()) say(1, 'first draw');
    } finally {
      holding = false;
      living = () => true;
    }
  };

  return {
    // in the world's render, in place of drawing: true while it's preparing
    // (the frame's laid out, and not drawn)
    held() {
      if (!holding) return false;
      if (!living()) return false; // (given up on: draw)
      placed = true;
      return true;
    },
    get preparing() {
      return holding;
    },
    prepare,
  };
}
