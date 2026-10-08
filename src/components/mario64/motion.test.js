import { describe, expect, it } from 'vitest';
import { JOINTS, SLEEP_AFTER, poseFor } from './pose';
import { MAX_SWING, blendPose, createMarioBody, easeFace, faceFor, lookFor, lookRound, strideAt, swingFor } from './motion';

const LEG = 0.56;
const TAU = Math.PI * 2;
const mario = (o = {}) => ({ action: 'idle', t: 0, arg: 0, fwd: 0, yaw: 0, pitch: 0, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, ...o });
// the most any joint angle moved between two poses
const jump = (a, b) => Math.max(...JOINTS.flatMap((j) => a.joints[j].map((v, i) => Math.abs(v - b.joints[j][i]))));

describe('his stride', () => {
  it('lengthens with his speed, up to as far as his legs can reach', () => {
    let last = 0;
    for (const v of [0.5, 1, 2, 4, 6, 9.6]) {
      const s = strideAt(v, LEG);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
    expect(strideAt(20, LEG)).toBeCloseTo(4 * LEG * Math.sin(MAX_SWING));
  });

  it('swings each leg just far enough that the stride covers the ground', () => {
    for (const v of [1, 3, 6, 9.6]) {
      const s = strideAt(v, LEG);
      expect(4 * LEG * Math.sin(swingFor(s, LEG))).toBeCloseTo(s, 6);
    }
  });

  it('keeps a planted foot where it is, at a walk and flat out (under 0.15 m/s)', () => {
    for (const fwd of [6, 16, 32]) {
      const body = createMarioBody({ leg: LEG, seed: 2 });
      const speed = fwd * 0.3; // units a frame to metres a second
      const dt = 0.5; // frames, at 60 a second
      let hip = 0;
      let prev = null;
      let worst = 0;
      for (let i = 0; i < 360; i++) {
        const p = body.pose(mario({ action: 'walk', t: i, fwd }), { dt, alpha: 1, live: true });
        hip += speed * (dt / 30);
        // the left foot, a straight leg ahead of the hip, while it's down
        const foot = hip + LEG * Math.sin(-p.joints.legL[0]);
        const down = Math.cos(body.phase) < -0.15;
        if (prev && down && prev.down && i > 60) worst = Math.max(worst, Math.abs(foot - prev.foot) / (dt / 30));
        prev = { foot, down };
      }
      expect(worst, `at ${fwd}`).toBeLessThan(0.15);
    }
  });
});

describe('from one action to the next', () => {
  it('blends: none of the way is where it was, all the way is where it goes', () => {
    const a = poseFor('walk', 3, { fwd: 30, phase: 1 });
    const b = poseFor('idle', 0);
    expect(jump(blendPose(a, b, 0), a)).toBeCloseTo(0);
    expect(jump(blendPose(a, b, 1), b)).toBeCloseTo(0);
    const half = blendPose(a, b, 0.5);
    expect(half.joints.legL[0]).toBeCloseTo((a.joints.legL[0] + b.joints.legL[0]) / 2);
  });

  it('turns a flip the short way back to upright, and never blends where he hangs', () => {
    const flipped = poseFor('triple', 40); // a whole turn: upright again
    const stand = poseFor('land', 0);
    for (const k of [0.25, 0.5, 0.75]) expect(Math.abs(Math.sin(blendPose(flipped, stand, k).spin[0]))).toBeLessThan(0.05);
    // a ledge's offset is where the rules put him: taken at once
    const hang = poseFor('ledge', 0);
    expect(blendPose(stand, hang, 0.1).offset).toEqual(hang.offset);
  });

  it('eases out of a run into standing instead of popping', () => {
    const body = createMarioBody({ leg: LEG });
    let last = null;
    for (let i = 0; i < 40; i++) last = body.pose(mario({ action: 'walk', t: i, fwd: 32 }), { dt: 0.5 });
    // the rules stop him: the first frame of standing is where the run left him
    const first = body.pose(mario({ action: 'idle', t: 0 }), { dt: 0.5 });
    expect(jump(first, last)).toBeLessThan(0.2);
    let prev = first;
    for (let i = 1; i < 12; i++) {
      const p = body.pose(mario({ action: 'idle', t: i }), { dt: 0.5 });
      expect(jump(p, prev)).toBeLessThan(0.45);
      prev = p;
    }
    // and settles where standing is
    const settled = body.pose(mario({ action: 'idle', t: 30 }), { dt: 0.5 });
    expect(Math.abs(settled.joints.legL[0])).toBeLessThan(0.05);
  });

  it('plays a death through even while the rules wait (the rules stop stepping him)', () => {
    const body = createMarioBody({ leg: LEG });
    body.pose(mario({ action: 'walk', t: 5, fwd: 10 }), { dt: 1 });
    let p = null;
    for (let i = 0; i < 40; i++) p = body.pose(mario({ action: 'dead', t: 1 }), { dt: 1, live: false });
    expect(p.spin[0]).toBeLessThan(-1.2);
  });

  it('runs an action between the rules\' steps while they step him, and holds it while they wait', () => {
    const body = createMarioBody({ leg: LEG });
    body.pose(mario({ action: 'triple', t: 1 }), { dt: 1 });
    const a = body.pose(mario({ action: 'triple', t: 10 }), { dt: 1, alpha: 0.25, live: true });
    const b = body.pose(mario({ action: 'triple', t: 10 }), { dt: 1, alpha: 0.75, live: true });
    expect(b.spin[0]).toBeGreaterThan(a.spin[0]);
    const c = body.pose(mario({ action: 'triple', t: 10 }), { dt: 1, alpha: 0.25, live: false });
    const d = body.pose(mario({ action: 'triple', t: 10 }), { dt: 1, alpha: 0.75, live: false });
    expect(d.spin[0]).toBeCloseTo(c.spin[0]);
  });
});

describe('his head', () => {
  it('looks round, left then right, after a few seconds stood still, and not before', () => {
    expect(lookRound(30)).toBe(0);
    const turns = Array.from({ length: 240 }, (_, i) => lookRound(90 + i));
    expect(Math.max(...turns)).toBeGreaterThan(0.5);
    expect(Math.min(...turns)).toBeLessThan(-0.5);
    // asleep, he's done looking
    expect(lookRound(SLEEP_AFTER + 50)).toBe(0);
  });

  it('turns to the nearest thing worth a look, in front of him and near', () => {
    const m = mario({ yaw: 0 });
    const goomba = { type: 'goomba', alive: true, state: 'wander', pos: { x: 300, y: 0, z: 300 } };
    const far = { type: 'star', alive: true, pos: { x: -5000, y: 0, z: 100 } };
    const behind = { type: 'goomba', alive: true, state: 'wander', pos: { x: 0, y: 0, z: -200 } };
    const coin = { type: 'coin', alive: true, pos: { x: 10, y: 0, z: 100 } };
    expect(lookFor(m, [far, behind, coin, goomba])).toBeCloseTo(Math.PI / 4);
    expect(lookFor(m, [far, behind, coin])).toBeNull();
    // squashed, it's not worth one
    expect(lookFor(m, [{ ...goomba, state: 'flat' }])).toBeNull();
  });

  it('eases the turn on: the head never snaps to what it sees', () => {
    const body = createMarioBody({ leg: LEG });
    body.pose(mario({ action: 'idle', t: 0 }), { dt: 1 });
    const p = body.pose(mario({ action: 'idle', t: 1 }), { dt: 1, look: 1 });
    expect(p.joints.head[1]).toBeGreaterThan(0);
    expect(p.joints.head[1]).toBeLessThan(0.4);
    let q = p;
    for (let i = 2; i < 60; i++) q = body.pose(mario({ action: 'idle', t: i }), { dt: 1, look: 1 });
    expect(q.joints.head[1]).toBeCloseTo(1, 1);
  });

  it('starts every Mario somewhere of his own in his stride', () => {
    const a = createMarioBody({ seed: 1 });
    const b = createMarioBody({ seed: 2 });
    a.pose(mario(), { dt: 0 });
    b.pose(mario(), { dt: 0 });
    expect(Math.abs(Math.sin((a.phase - b.phase) / 2))).toBeGreaterThan(0.01);
    expect(a.phase).toBeGreaterThanOrEqual(0);
    expect(a.phase).toBeLessThan(TAU);
  });
});

describe('the cast, turning', () => {
  it('comes round to where the rules point it over a few frames, not in one', () => {
    const goomba = { type: 'goomba', state: 'wander', pos: { x: 0, y: 0, z: 0 } };
    // the rules turned it about at a wall
    let yaw = easeFace(0, goomba, Math.PI, 1);
    expect(yaw).toBeGreaterThan(0.2);
    expect(yaw).toBeLessThan(Math.PI - 0.5);
    for (let i = 0; i < 30; i++) yaw = easeFace(yaw, goomba, Math.PI, 1);
    expect(Math.abs(Math.sin(yaw))).toBeLessThan(0.02);
    // and the same at 144 frames a second as at 30
    let fast = 0;
    for (let i = 0; i < 24; i++) fast = easeFace(fast, goomba, 1, 30 / 144);
    let slow = 0;
    for (let i = 0; i < 5; i++) slow = easeFace(slow, goomba, 1, 1);
    expect(fast).toBeCloseTo(slow, 1);
  });

  it('turns Toad more slowly than a Goomba, and faces a held Bob-omb where it is held', () => {
    const toad = easeFace(0, { type: 'toad', state: 'idle' }, 1, 1);
    const goomba = easeFace(0, { type: 'goomba', state: 'wander' }, 1, 1);
    expect(toad).toBeLessThan(goomba);
    expect(easeFace(0, { type: 'bobomb', state: 'held' }, 2, 1)).toBe(2);
    // the first frame drawn is where it is
    expect(easeFace(null, { type: 'goomba', state: 'wander' }, 2, 1)).toBe(2);
  });

  it('has the Chain Chomp watch Mario while it waits, and face where it bites', () => {
    const m = { pos: { x: 100, y: 0, z: 0 } };
    const chomp = { type: 'chomp', state: 'idle', pos: { x: 0, y: 0, z: 0 } };
    expect(faceFor(chomp, m, 3)).toBeCloseTo(Math.PI / 2);
    expect(faceFor({ ...chomp, state: 'lunge' }, m, 3)).toBe(3);
    expect(faceFor({ type: 'goomba', state: 'wander' }, m, 1)).toBe(1);
  });
});
