// The calls a figure on an animator answers (animator.js), the same on
// every adapter: Portal panic's cast (rickmorty/portal/meshyCast.js, which
// re-exports these, as they were its own), the universe's people on foot
// (universe/footScene.js) and the galaxy's catalogue models
// (galaxy/surface/actors.js). They live with the animator so a world needn't
// reach into another's folder for them.
//
// animatorCalls(anim, { model, seed, loader, own, sit, act, library }) → {
//   play, stop, base, look, react, tick, seated }
//   model: the figure's (its head, for a look without a height); own: the
//   names of its own clips; sit: whether it has a sat clip of its own (as
//   the animator's SEAT); act: the figure's actions by name, a whole-body
//   one-shot added once it's played; library: whether the clip library's
//   clips fit it (the Meshy skeleton's), else it plays only its own; loader:
//   the one the library's files are fetched through (a cast's, a test's)
//   play(name, { layer = 'full' (or 'upper', 'lower', 'arm.r', 'arm.l'),
//     loop = false, hold = 0, fade, speed, at, lasts }) → Promise<boolean>: true once it's playing (or a later play
//     has taken its place), false when the figure can't have it. loop
//     stays off unless asked, whatever the library says, and hold is the
//     seconds it's kept on its last frame before it goes, as the cast's
//     one-shots always had them (Infinity, or 1e9, for good); lasts: the
//     seconds it plays before it's stopped, looped or not
//   stop(fade = 0.2, layer = 'full')
//   base(name | null, opts) → Promise<'done' | 'cut'>: the animator's base
//     states; 'sit' is the figure's own sat clip (or Rick's, borrowed),
//     faded straight in and out, since the UAL's ways in and out are made
//     for its own seat; without one, the UAL's 'sit.idle' through them
//   look(target | null, opts): the head toward a point in the world (a
//     Vector3, { x, y?, z } level with its eyes when there's no y, or a
//     belief's `at`)
//   react(event, ctx) → the reaction played (react.js's, from the site's
//     table, the figure's own seeded chances and cooldowns), or null: on
//     the upper layer while it's in a base state (a sitter hit stays sat),
//     its head on ctx.target for a while
//   tick(dt, moving): the holds' and the looks' clocks, each frame before
//     the animator's update
//   seated: whether a base state's been asked for
// NO_CALLS: the same on a figure with no animator, each doing nothing
// seedOf(name, n) → a figure's seed from its name and which of them it is
// SEAT: a figure's own sat clip's name to the animator

import * as THREE from 'three';
import { CLIPS, loadClip } from './clipLibrary';
import { REACTIONS, createReactions } from '../ai/react';
import { seeded } from '../seeded';

export const SEAT = 'seat'; // a figure's own sat clip, to the animator (no `seat.enter`, so no way in or out)
const LAYERS = ['full', 'upper', 'lower', 'arm.r', 'arm.l'];
const FADE = 0.2;
const LOOK_AFTER = 1; // seconds a reaction's look stays on after its clip
const BEGIN = 16; // turns of the microtask queue a fetched clip takes to begin (a handful)
const groupOf = (n) => n.split('.')[0];

// a seed from a figure's identity, its name and which of them it is, so
// copies of one figure don't breathe, step or fidget together
export function seedOf(name, n = 0) {
  let h = 2166136261;
  for (const ch of String(name)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h + Math.imul(n + 1, 0x9e3779b1)) | 0;
}

export const NO_CALLS = Object.freeze({
  play: () => Promise.resolve(false),
  stop() {},
  base: () => Promise.resolve('cut'),
  look() {},
  react: () => null,
  tick() {},
  seated: false,
});

export function animatorCalls(anim, { model = null, seed = 0, loader = null, own = [], sit = false, act = null, library = true } = {}) {
  const mine = new Set(own);
  const fromLibrary = (name) => library && !mine.has(name) && Object.hasOwn(CLIPS, name);
  const can = (name) => typeof name === 'string' && (mine.has(name) || fromLibrary(name));
  // a library clip's file asked for through this figure's loader before
  // the animator asks for it (the library keeps one copy of a file, whoever
  // fetched it)
  const warm = (name) => {
    if (fromLibrary(name)) loadClip(name, { loader });
  };
  const tokens = Object.fromEntries(LAYERS.map((l) => [l, 0]));
  const holds = Object.fromEntries(LAYERS.map((l) => [l, null])); // a clip to stop: { left (s), fade }
  const st = { clock: 0, moving: false, at: null };
  const reactions = createReactions(REACTIONS, { rand: seeded(seed ^ 0x5bd1e995), has: can });
  const head = model?.getObjectByName('Head') ?? null;
  const spot = new THREE.Vector3();
  // a point in the world: a Vector3 as it is, { x, z } at its eyes' height
  const pointOf = (p) => {
    const q = p?.at ?? p;
    if (!q || !Number.isFinite(q.x) || !Number.isFinite(q.z)) return null;
    if (q.isVector3) return q;
    const y = Number.isFinite(q.y) ? q.y : head ? head.getWorldPosition(spot).y : model ? model.getWorldPosition(spot).y : 0;
    return spot.set(q.x, y, q.z);
  };
  const theirs = { on: false, at: new THREE.Vector3(), opts: undefined }; // the caller's own look, put back after a reaction's
  const glance = { target: null, left: 0 }; // a reaction's look, for a while

  function start(name, { layer = 'full', loop = false, hold = 0, fade = FADE, speed = 1, at = 0, lasts = null } = {}) {
    warm(name);
    const token = ++tokens[layer];
    holds[layer] = lasts != null ? { left: lasts, fade } : null;
    const done = anim.play(name, { layer, loop, hold: hold > 0, fade, speed, at });
    if (hold > 0)
      done.then((r) => {
        if (r === 'done' && tokens[layer] === token) holds[layer] = { left: hold, fade };
      });
    return { token, done };
  }
  // once it's playing: its file first, then the turn or two the animator takes
  async function begun(name, layer) {
    if (anim.playing(layer) !== name && fromLibrary(name) && !(await loadClip(name, { loader }))) return false;
    for (let i = 0; i < BEGIN && anim.playing(layer) !== name; i++) await null;
    if (layer === 'full' && act && anim.actions[name]) act[name] ??= anim.actions[name];
    return true;
  }
  const play = (name, opts = {}) => {
    const layer = opts.layer ?? 'full';
    if (!can(name) || !LAYERS.includes(layer)) return Promise.resolve(false);
    start(name, { ...opts, layer });
    return begun(name, layer);
  };
  const stop = (fade = FADE, layer = 'full') => {
    if (!LAYERS.includes(layer)) return;
    tokens[layer]++;
    holds[layer] = null;
    anim.stop(layer, fade);
  };
  const base = (name = null, opts = {}) => {
    const want = name === 'sit' ? (sit ? SEAT : 'sit.idle') : name;
    if (want != null && want !== SEAT && !can(want)) return Promise.resolve('cut');
    if (want != null) {
      warm(want);
      warm(`${groupOf(want)}.enter`);
    }
    if (st.at != null) warm(`${groupOf(st.at)}.exit`);
    st.at = want;
    return anim.base(want, opts);
  };
  const look = (target, opts) => {
    glance.left = 0;
    const p = target ? pointOf(target) : null;
    theirs.on = Boolean(p);
    if (p) theirs.at.copy(p);
    theirs.opts = opts;
    anim.look(p, opts);
  };
  const react = (event, ctx = {}) => {
    const r = reactions.on(event, { t: st.clock, moving: st.moving, ...ctx });
    if (!r || !can(r.clip)) return null;
    const layer = st.at != null ? 'upper' : r.layer;
    const loop = typeof r.hold === 'number';
    const { token, done } = start(r.clip, { layer, loop, hold: r.hold === true ? Infinity : 0, lasts: loop ? r.hold : (r.cut ?? null) });
    if (r.then && can(r.then))
      done.then((res) => {
        if (res === 'done' && tokens[layer] === token) start(r.then, { layer, hold: Infinity });
      });
    const p = r.look ? pointOf(r.look) : null;
    if (p) {
      glance.target = r.look;
      glance.left = (loop ? r.hold : 2) + LOOK_AFTER;
      anim.look(p);
    }
    return { ...r, layer };
  };
  const tick = (dt, moving = false) => {
    st.clock += dt;
    st.moving = moving;
    for (const layer of LAYERS) {
      const h = holds[layer];
      if (h && (h.left -= dt) <= 0) stop(h.fade, layer);
    }
    if (glance.left > 0) {
      glance.left -= dt;
      if (glance.left > 0) anim.look(pointOf(glance.target));
      else anim.look(theirs.on ? theirs.at : null, theirs.opts);
    }
  };
  return {
    play,
    stop,
    base,
    look,
    react,
    tick,
    get seated() {
      return st.at != null;
    },
  };
}
