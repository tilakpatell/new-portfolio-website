import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { NO_CALLS, SEAT, animatorCalls, seedOf } from './figureCalls';
import * as fromCast from '../../components/rickmorty/portal/meshyCast';

// An animator as far as the calls see one: what's playing on each layer
// (a play is on at once), and every call it's had
function fakeAnim() {
  const on = { full: null, upper: null, lower: null, 'arm.r': null, 'arm.l': null };
  const calls = [];
  const anim = {
    actions: {},
    calls,
    play: vi.fn((name, opts) => {
      calls.push(['play', name, opts]);
      on[opts.layer] = name;
      anim.actions[name] ??= { name };
      return new Promise(() => {}); // (never over, in these)
    }),
    playing: (layer = 'full') => on[layer],
    stop: vi.fn((layer) => (on[layer] = null)),
    base: vi.fn(() => Promise.resolve('done')),
    look: vi.fn(),
  };
  return anim;
}
// the library's files, through the figure's own loader
const loader = { loadAsync: vi.fn(async () => ({ scene: null, animations: [new THREE.AnimationClip('x', 1, [])] })) };

describe('the calls a figure on an animator answers', () => {
  it('are the cast’s as they were: the same functions from either place', () => {
    expect(fromCast.animatorCalls).toBe(animatorCalls);
    expect(fromCast.NO_CALLS).toBe(NO_CALLS);
    expect(fromCast.seedOf).toBe(seedOf);
    expect(fromCast.SEAT).toBe(SEAT);
  });

  it('play: its own clips and the library’s, on a layer; anything else is false and plays nothing', async () => {
    const anim = fakeAnim();
    const act = {};
    const c = animatorCalls(anim, { own: ['idle', 'walk', 'run', 'sit'], act, loader });
    expect(await c.play('wave')).toBe(true);
    expect(anim.play).toHaveBeenLastCalledWith('wave', expect.objectContaining({ layer: 'full', loop: false, hold: false }));
    expect(act.wave).toBe(anim.actions.wave); // (a whole-body one-shot handed to the caller's actions)
    expect(await c.play('talk', { layer: 'upper', loop: true })).toBe(true);
    expect(anim.playing('upper')).toBe('talk');
    expect(await c.play('no.such.clip')).toBe(false);
    expect(await c.play('wave', { layer: 'sideways' })).toBe(false);
    expect(anim.play).toHaveBeenCalledTimes(2);
    // a figure the library doesn't fit plays only its own
    const odd = animatorCalls(fakeAnim(), { own: ['idle'], library: false, loader });
    expect(await odd.play('wave')).toBe(false);
  });

  it('lasts stops a clip after its seconds; stop cuts it at once', async () => {
    const anim = fakeAnim();
    const c = animatorCalls(anim, { loader });
    await c.play('talk', { layer: 'upper', loop: true, lasts: 1 });
    c.tick(0.6);
    expect(anim.stop).not.toHaveBeenCalled();
    c.tick(0.6);
    expect(anim.stop).toHaveBeenCalledWith('upper', 0.2);
    c.stop(0.4, 'full');
    expect(anim.stop).toHaveBeenLastCalledWith('full', 0.4);
  });

  it('play and lasts on an arm’s layer, each arm its own', async () => {
    const anim = fakeAnim();
    const c = animatorCalls(anim, { own: ['idle', 'walk', 'run'], loader });
    expect(await c.play('idle', { layer: 'arm.r', loop: true, lasts: 1 })).toBe(true);
    expect(await c.play('walk', { layer: 'arm.l', loop: true })).toBe(true);
    expect(anim.playing('arm.r')).toBe('idle');
    expect(anim.playing('arm.l')).toBe('walk');
    c.tick(1.2);
    expect(anim.stop).toHaveBeenCalledWith('arm.r', 0.2);
    expect(anim.stop).not.toHaveBeenCalledWith('arm.l', expect.anything());
    c.stop(0.3, 'arm.l');
    expect(anim.stop).toHaveBeenLastCalledWith('arm.l', 0.3);
  });

  it('base: sat on its own sat clip, else the library’s through its way in; seated while it is', async () => {
    const anim = fakeAnim();
    const own = animatorCalls(anim, { own: ['idle', 'sit'], sit: true, loader });
    own.base('sit');
    expect(anim.base).toHaveBeenLastCalledWith(SEAT, {});
    expect(own.seated).toBe(true);
    own.base(null);
    expect(anim.base).toHaveBeenLastCalledWith(null, {});
    expect(own.seated).toBe(false);
    const borrowed = animatorCalls(anim, { own: ['idle'], loader });
    borrowed.base('sit');
    expect(anim.base).toHaveBeenLastCalledWith('sit.idle', {});
    expect(await borrowed.base('perch.idle')).toBe('cut');
  });

  it('react: a hit on the upper half while it sits, its look on whom it says it to', () => {
    const anim = fakeAnim();
    const c = animatorCalls(anim, { seed: 3, loader });
    c.base('sit');
    expect(c.react('hit', { t: 1, where: 'head' })).toMatchObject({ clip: 'hit.head', layer: 'upper' });
    const r = c.react('say', { target: new THREE.Vector3(1, 2, 3), hold: 1.5 });
    expect(r).toMatchObject({ clip: 'talk', hold: 1.5 });
    expect(anim.look).toHaveBeenLastCalledWith(new THREE.Vector3(1, 2, 3));
    expect(c.react('nothing that happens')).toBe(null);
  });

  it('seedOf: the same for the same figure, apart for the next of its name or another name', () => {
    expect(seedOf('rick', 0)).toBe(seedOf('rick', 0));
    expect(seedOf('rick', 1)).not.toBe(seedOf('rick', 0));
    expect(seedOf('morty', 0)).not.toBe(seedOf('rick', 0));
    expect(Number.isInteger(seedOf('rick'))).toBe(true);
  });

  it('NO_CALLS do nothing, and say so', async () => {
    expect(await NO_CALLS.play('wave')).toBe(false);
    expect(await NO_CALLS.base('sit')).toBe('cut');
    expect(NO_CALLS.react('hit')).toBe(null);
    expect(NO_CALLS.seated).toBe(false);
    expect(Object.isFrozen(NO_CALLS)).toBe(true);
  });
});
