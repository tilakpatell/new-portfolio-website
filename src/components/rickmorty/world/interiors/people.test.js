import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createMeshyCast } from '../../portal/meshyCast';
import { meshyRig, swingClip } from '../../../../lib/three/meshyRig.fixture';
import { holding, person, seat } from './people';

// A cast on Meshy's skeleton (the animator's fixture), each load a fresh
// copy as a file's parse is: the figures' own idle, walk and run, Jerry's
// with no sat clip of his own and Rick's with one (the legs folded up and
// the hips 40 cm down), and the library's sitting clips (the UAL's: in, and
// the idle, the hips 45 cm down) and a talk.
function loader() {
  const rig = () => {
    const r = meshyRig();
    r.model.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.3).translate(0, 0.9, 0), new THREE.MeshStandardMaterial()));
    return r;
  };
  const folded = (n) => (/UpLeg$/.test(n) ? -1.5 : /Leg$/.test(n) ? 1.5 : 0);
  const made = {
    idle: (r) => r.clips.idle,
    walk: (r) => r.clips.walk,
    run: (r) => r.clips.run,
    sit: (r) => swingClip(r, 'sit', 2, folded, { hips: () => -40 }),
    'sit.enter': (r) => swingClip(r, 'sit.enter', 1, (n, t) => folded(n) * t, { hips: (t) => -45 * t }),
    'sit.idle': (r) => swingClip(r, 'sit.idle', 2, folded, { hips: () => -45 }),
    talk: (r) => swingClip(r, 'talk', 2, (n, t) => (n === 'RightArm' ? 0.4 * Math.sin(t * 3) : 0)),
  };
  return {
    async loadAsync(url) {
      const r = rig();
      const name = url.match(/-([\w.]+)\.glb$/)?.[1];
      if (!name) return { scene: r.model, animations: [] };
      if (/jerry-sit/.test(url) || !made[name]) throw new Error('404');
      return { scene: r.model, animations: [made[name](r)] };
    },
  };
}
const KINDS = { rick: { a: 'rick', h: 1.8 }, jerry: { a: 'jerry', h: 1.8 }, blob: { a: 'cronenberg', h: 0.75 } };
async function castOf() {
  const cast = createMeshyCast({ kinds: KINDS, rigged: new Set(['rick', 'jerry']), loader: loader() });
  await cast.load(null, ['rick'], { clips: ['idle', 'walk', 'run', 'sit'] });
  await cast.load(null, ['jerry', 'cronenberg'], { clips: ['idle', 'walk'] });
  return cast;
}
// a room, as far as its people need one
function room() {
  const ticks = [];
  const mats = { glass: new THREE.MeshBasicMaterial(), metal: new THREE.MeshBasicMaterial(), toon: () => new THREE.MeshBasicMaterial() };
  const R = { group: new THREE.Group(), ticks, tick: (fn) => ticks.push(fn), own: (x) => x, kit: { mats } };
  R.run = (s, state = null, t0 = 0) => {
    let t = t0;
    for (let i = 0; i < Math.round(s / 0.05); i++) {
      t += 0.05;
      for (const fn of ticks) fn(t, 0.05, state);
    }
    return t;
  };
  return R;
}
const hipsOf = (c) => c.group.getObjectByName('Hips').getWorldPosition(new THREE.Vector3());
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('sitting down', () => {
  it('sits one with a sat clip of its own straight onto its seat, its hips where the seat says', async () => {
    const cast = await castOf();
    const R = room();
    const c = cast.make('rick');
    const sat = await seat(R, c, { x: 3, z: -2, face: 0, id: 'rick' }, { h: 1.8, seatY: 0.52 });
    expect(sat).toEqual({ group: c.group, cast: c });
    expect(c.group.parent).toBe(R.group);
    R.run(0.5);
    const hips = hipsOf(c);
    expect(hips.x).toBeCloseTo(3, 1);
    expect(hips.y).toBeCloseTo(0.52, 1);
    expect(hips.z).toBeCloseTo(-2, 1);
    expect(c.anim.actions.seat.getEffectiveWeight()).toBeCloseTo(1, 6);
    cast.dispose();
  });

  it('sits one without on the library’s sitting idle, gone into out of sight', async () => {
    const cast = await castOf();
    const R = room();
    const c = cast.make('jerry');
    const sat = await seat(R, c, { x: -1, z: 4, face: Math.PI / 2, id: 'jerry' }, { h: 1.9, seatY: 0.5 });
    expect(sat?.cast).toBe(c);
    expect(c.anim.actions['sit.idle'].getEffectiveWeight()).toBeCloseTo(1, 6);
    expect(c.anim.actions['sit.enter']?.getEffectiveWeight() ?? 0).toBeCloseTo(0, 6);
    const hips = hipsOf(c);
    expect(hips.y).toBeCloseTo(0.5, 1);
    expect(Math.hypot(hips.x + 1, hips.z - 4)).toBeLessThan(0.05);
    cast.dispose();
  });

  it('stays sat when it talks with its hands to Morty, its head on him', async () => {
    const cast = await castOf();
    const R = room();
    const c = cast.make('jerry');
    await seat(R, c, { x: 0, z: 0, face: 0, id: 'jerry' }, { h: 1.8, seatY: 0.5 });
    const state = { morty: { x: 1.5, z: 0.5 }, talk: { id: 'jerry', n: 1, hold: 2 } };
    R.run(0.1, state);
    await flush(); // (its talk's clip fetched)
    R.run(0.6, state, 0.1);
    expect(c.anim.playing('upper')).toBe('talk');
    expect(c.anim.playing('full')).toBe(null);
    expect(c.anim.actions['sit.idle'].getEffectiveWeight()).toBeCloseTo(1, 6);
    cast.dispose();
  });

  it('sits two out of step', async () => {
    const cast = await castOf();
    const R = room();
    const a = cast.make('jerry');
    const b = cast.make('jerry');
    await seat(R, a, { x: 0, z: 0, face: 0 }, { h: 1.8, seatY: 0.5 });
    await seat(R, b, { x: 2, z: 0, face: 0 }, { h: 1.8, seatY: 0.5 });
    expect(Math.abs(a.anim.actions['sit.idle'].time - b.anim.actions['sit.idle'].time)).toBeGreaterThan(0.05);
    cast.dispose();
  });

  it('can’t sit one without a skeleton, and says so', async () => {
    const cast = await castOf();
    const R = room();
    expect(await seat(R, cast.make('blob'), { x: 0, z: 0, face: 0 }, { h: 1, seatY: 0.4 })).toBe(null);
    expect(await seat(R, null, { x: 0, z: 0, face: 0 }, { h: 1, seatY: 0.4 })).toBe(null);
    expect(R.group.children.length).toBe(0);
    cast.dispose();
  });
});

describe('a person standing about', () => {
  it('turns its head to Morty as he comes up, and back as he goes', async () => {
    const cast = await castOf();
    const R = room();
    R.kit.cast = cast;
    const fig = person(R, 'rick', { x: 0, z: 0, face: 0, h: 1.8, id: 'rick' });
    const head = fig.group.getObjectByName('Head');
    R.run(0.5, { morty: { x: 10, z: 0 } });
    const ahead = head.getWorldQuaternion(new THREE.Quaternion());
    // (Morty off to its left: it faces +x, so its left is −z)
    R.run(1.5, { morty: { x: 0.5, z: -2 } }, 0.5);
    const turned = head.getWorldQuaternion(new THREE.Quaternion());
    expect(turned.angleTo(ahead)).toBeGreaterThan(0.4);
    R.run(1.5, { morty: { x: 10, z: 0 } }, 2);
    expect(head.getWorldQuaternion(new THREE.Quaternion()).angleTo(ahead)).toBeLessThan(0.1);
    cast.dispose();
  });
});

describe('something in a hand', () => {
  it('goes in the right hand once the figure’s stood, upright, and moves with the hand', async () => {
    const cast = await castOf();
    const R = room();
    const c = cast.make('rick');
    R.group.add(c.group);
    R.tick((t, dt) => c.update(t, 0, 0, { dt }));
    const glass = new THREE.Group();
    holding(R, c, glass);
    expect(glass.visible).toBe(false);
    R.run(0.1);
    expect(glass.parent).toBe(c.hand);
    expect(glass.visible).toBe(true);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(glass.getWorldQuaternion(new THREE.Quaternion()));
    expect(up.y).toBeGreaterThan(0.99);
    const hand = c.hand.getWorldPosition(new THREE.Vector3());
    expect(glass.getWorldPosition(new THREE.Vector3()).distanceTo(hand)).toBeLessThan(0.15);
    // (shown only while it should be: a flask while he drinks)
    const flask = new THREE.Group();
    holding(R, c, flask, { show: () => false });
    R.run(0.1, null, 0.1);
    expect(flask.parent).toBe(c.hand);
    expect(flask.visible).toBe(false);
    expect(holding(R, { hand: null }, new THREE.Group())).toBe(null);
    cast.dispose();
  });
});
