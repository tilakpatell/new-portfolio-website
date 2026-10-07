import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { faceStep, meIn } from './face';

// a thing stood 2 m along +x of the world, facing +z, in metres
const stood = () => {
  const object = new THREE.Group();
  object.position.set(2, 0, 0);
  const turn = new THREE.Group();
  object.add(turn);
  object.updateMatrixWorld(true);
  return { object, turn };
};
const steps = (st, o, ctx, n) => {
  let r;
  for (let i = 0; i < n; i++) r = faceStep(st, o.object, o.turn, ctx, 1 / 60);
  return r;
};

describe('something stood at a landing, facing you', () => {
  it('reads where you are in its own frame', () => {
    const o = stood();
    const p = meIn(o.object, { me: new THREE.Vector3(5, 1.6, 4) });
    expect(p.x).toBeCloseTo(3);
    expect(p.z).toBeCloseTo(4);
    expect(meIn(o.object, null)).toBeNull();
  });
  it('turns round to face you within reach, eased, and back once you have gone', () => {
    const o = stood();
    const st = {};
    // off to its left, 3 m away: a quarter turn, most of the way there in a second
    let r = steps(st, o, { me: new THREE.Vector3(5, 1.6, 0) }, 60);
    expect(r.d).toBeCloseTo(3);
    expect(r.seen).toBe(true);
    expect(o.turn.rotation.y).toBeGreaterThan(Math.PI / 2 - 0.1);
    expect(o.turn.rotation.y).toBeLessThanOrEqual(Math.PI / 2);
    // out of reach: not seen, and it eases back to where it stood
    r = steps(st, o, { me: new THREE.Vector3(5, 1.6, 20) }, 120);
    expect(r.seen).toBe(false);
    expect(Math.abs(o.turn.rotation.y)).toBeLessThan(0.1);
    // nobody about at all
    r = steps(st, o, null, 1);
    expect(r.d).toBe(Infinity);
  });
  it('takes the short way round to someone behind it', () => {
    const o = stood();
    const st = {};
    faceStep(st, o.object, o.turn, { me: new THREE.Vector3(2.5, 1.6, -4) }, 1 / 60);
    expect(o.turn.rotation.y).toBeGreaterThan(0); // (behind and a little to its left: round to the left)
    const o2 = stood();
    faceStep({}, o2.object, o2.turn, { me: new THREE.Vector3(1.5, 1.6, -4) }, 1 / 60);
    expect(o2.turn.rotation.y).toBeLessThan(0);
  });
});
