// Shaders made before they're drawn. three.js makes a material's program the
// first time it draws it and then waits for the graphics chip to finish
// compiling it, which stops the whole page: on a Mac (Metal) a second or more
// for a model with a dozen materials, every time something new comes into
// view. Here they compile in parallel instead (KHR_parallel_shader_compile),
// off the page's thread:
//
//   all(scene, camera, target)   everything the scene holds now; resolves once
//                                it can all be drawn without waiting (or after
//                                `wait` ms, with whatever is left still going)
//   gate(scene, camera, target)  before a draw: anything in view whose shaders
//                                aren't ready yet (a model just loaded, a ship
//                                just arrived) sits the frame out while they
//                                compile, a frame or a few, instead of the
//                                page stopping for them
//   open()                       after the draw: puts back what the gate held
//   draw(scene, camera, target)  after all(): draws it all once out of sight,
//                                so the first real frames don't stop to set
//                                up what drawing each thing takes
//
// `target` is where the scene is about to be drawn (a post pass's render
// target, or null for the canvas): the programs differ between the two (the
// colour space they write), so they're made for the right one. Without the
// extension nothing is held back and three compiles as it always has.

import { Object3D } from 'three';

const drawable = (o) => o.isMesh || o.isPoints || o.isLine || o.isSprite;
const materials = (o) => (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []);

export function createWarmup(renderer) {
  const parallel = renderer.extensions.has('KHR_parallel_shader_compile');
  const ready = new WeakSet(); // materials whose programs are made
  const making = new Set(); // and those still compiling
  const held = []; // what this frame's draw goes without
  // renderer.compile() walks what it's given with traverse(): this hands it
  // just the new things, not the whole scene again
  let lot = [];
  const batch = new Object3D();
  batch.traverse = (fn) => lot.forEach(fn);
  batch.traverseVisible = () => {}; // (the scene's lights are the ones that count)

  const made = (m) => {
    const program = renderer.properties.get(m).currentProgram;
    return !program || program.isReady();
  };
  const settle = () => {
    for (const m of making) {
      if (!made(m)) continue;
      making.delete(m);
      ready.add(m);
    }
  };
  // start the programs for `objects` (or the whole scene), as `scene` will
  // draw them into `target`
  const compile = (objects, scene, camera, target) => {
    const was = renderer.getRenderTarget();
    renderer.setRenderTarget(target ?? null);
    let mats;
    try {
      if (objects === scene) mats = renderer.compile(scene, camera);
      else {
        lot = objects;
        mats = renderer.compile(batch, camera, scene);
      }
    } finally {
      lot = [];
      renderer.setRenderTarget(was);
    }
    for (const m of mats) {
      if (ready.has(m)) continue;
      if (parallel && !made(m)) making.add(m);
      else ready.add(m);
    }
  };
  const waiting = (o) => materials(o).some((m) => !ready.has(m));
  const unknown = (o) => materials(o).some((m) => !ready.has(m) && !making.has(m));

  return {
    all(scene, camera, target, wait = 5000) {
      compile(scene, scene, camera, target);
      const until = performance.now() + wait;
      return new Promise((resolve) => {
        const check = () => {
          settle();
          if (!making.size || performance.now() > until) resolve();
          else setTimeout(check, 16);
        };
        check();
      });
    },
    gate(scene, camera, target) {
      if (!parallel) return;
      settle();
      const from = held.length;
      scene.traverseVisible((o) => {
        if (drawable(o) && waiting(o)) held.push(o);
      });
      if (held.length === from) return;
      const fresh = held.slice(from).filter(unknown);
      if (fresh.length) compile(fresh, scene, camera, target);
      // (a copy of something drawn before is made at once, and draws now)
      let n = from;
      for (let i = from; i < held.length; i++) {
        const o = held[i];
        if (!waiting(o)) continue;
        o.visible = false;
        held[n++] = o;
      }
      held.length = n;
    },
    open() {
      for (const o of held) o.visible = true;
      held.length = 0;
    },
    // Everything drawn once, out of sight, into a scrap of a target made like
    // `target` (lights as they are: a change in their number would mean other
    // shaders): the graphics chip builds what it needs to draw each thing
    // (on a Mac a pipeline for each, which compiling the shader alone
    // doesn't) and the textures go up, now rather than in a stutter the
    // first time each comes into view. Nothing to do for the canvas itself.
    draw(scene, camera, target) {
      if (!target) return;
      const scrap = target.clone();
      scrap.setSize(8, 8);
      const was = renderer.getRenderTarget();
      const kept = [];
      scene.traverse((o) => {
        if (o.isLight) return;
        kept.push(o, o.visible, o.frustumCulled);
        o.visible = true;
        o.frustumCulled = false;
      });
      try {
        renderer.setRenderTarget(scrap);
        renderer.render(scene, camera);
      } finally {
        renderer.setRenderTarget(was);
        for (let i = 0; i < kept.length; i += 3) {
          kept[i].visible = kept[i + 1];
          kept[i].frustumCulled = kept[i + 2];
        }
        scrap.dispose();
      }
    },
    // materials still compiling (for checking from a browser)
    get pending() {
      return making.size;
    },
  };
}
