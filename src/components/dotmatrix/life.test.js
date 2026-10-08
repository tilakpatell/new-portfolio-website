import { describe, expect, it } from 'vitest';
import { EMOTES } from '../../lib/emote';
import { WALKERS, walkerAt } from './rules';
import { BOX_EMOTES, LEG, boxEmote, createNotice, createStride, legAngle, stepAt, strideAt, walkerStride } from './life';

const TAU = Math.PI * 2;

describe('a box figure’s stride', () => {
  it('lengthens with speed, as far as a box leg can reach', () => {
    expect(strideAt(1, LEG)).toBeLessThan(strideAt(3, LEG));
    expect(strideAt(30, LEG)).toBeCloseTo(strideAt(60, LEG));
  });

  it('keeps a planted foot where it is (under 0.15 m/s), walking or running', () => {
    for (const speed of [0.9, 2.5, 4.6]) {
      const s = createStride({ leg: LEG, seed: 1 });
      const dt = 1 / 60;
      let hip = 0;
      let prev = null;
      let worst = 0;
      for (let i = 0; i < 300; i++) {
        const st = s.step(dt, speed);
        hip += speed * dt;
        // a box leg turned back by its angle: its foot sin(angle) of a leg behind the hip
        const foot = hip - LEG * Math.sin(legAngle(st.phase, st.swing * st.amount));
        const down = Math.cos(st.phase) < -0.15;
        if (prev?.down && down && i > 30) worst = Math.max(worst, Math.abs(foot - prev.foot) / dt);
        prev = { foot, down };
      }
      expect(worst, `at ${speed}`).toBeLessThan(0.15);
    }
  });

  it('stands still with its legs hanging, and starts each figure somewhere of its own', () => {
    const s = createStride({ leg: LEG, seed: 4 });
    let st = null;
    for (let i = 0; i < 60; i++) st = s.step(1 / 60, 0);
    expect(st.amount).toBe(0);
    expect(legAngle(st.phase, st.swing * st.amount)).toBeCloseTo(0);
    const a = createStride({ seed: 1 }).step(0, 0).phase;
    const b = createStride({ seed: 2 }).step(0, 0).phase;
    expect(Math.abs(a - b)).toBeGreaterThan(0.01);
  });

  it('carries a foot back at an even pace while it is down', () => {
    const n = 10;
    for (let i = 1; i <= n; i++) expect(stepAt(Math.PI / 2 + (i / n) * Math.PI) - stepAt(Math.PI / 2 + ((i - 1) / n) * Math.PI)).toBeCloseTo(-2 / n, 9);
    expect(stepAt(Math.PI / 2)).toBeCloseTo(1);
    expect(stepAt(TAU + Math.PI / 2)).toBeCloseTo(1);
  });
});

describe('a villager noticing the hero', () => {
  it('turns its head to him as he comes near, clamped, eased, and back once he’s gone', () => {
    const n = createNotice();
    let s = n.step(1 / 60, 20, 0.8);
    expect(s.look).toBe(0);
    for (let i = 0; i < 60; i++) s = n.step(1 / 60, 4, 0.8);
    expect(s.look).toBeCloseTo(0.8, 1);
    for (let i = 0; i < 60; i++) s = n.step(1 / 60, 4, 3);
    expect(s.look).toBeLessThanOrEqual(1.1);
    for (let i = 0; i < 120; i++) s = n.step(1 / 60, 20, 3);
    expect(Math.abs(s.look)).toBeLessThan(0.05);
  });

  it('waves the first time he comes up, not again until he’s been away', () => {
    const n = createNotice();
    const waves = (dist, secs) => {
      let most = 0;
      for (let i = 0; i < secs * 60; i++) most = Math.max(most, n.step(1 / 60, dist, 0).wave);
      return most;
    };
    expect(waves(10, 1)).toBe(0);
    expect(waves(2.5, 2.5)).toBeGreaterThan(0.9);
    // still close, or a step back and in again: once is enough
    expect(waves(2.5, 2)).toBe(0);
    expect(waves(4, 1) + waves(2.5, 1)).toBe(0);
    // gone off and come back: hello again
    waves(12, 1);
    expect(waves(2.5, 1)).toBeGreaterThan(0.9);
  });
});

describe('a walker on its beat', () => {
  it('goes the way the rules move it, and turns round at each end instead of flipping', () => {
    const w = WALKERS[0];
    // (from a moment in: the rules' walkerAt runs on backward before 0)
    let last = walkerStride(w, 0.5).face;
    let biggest = 0;
    for (let t = 0.5; t < 30; t += 1 / 60) {
      const { face } = walkerStride(w, t);
      const d = Math.atan2(Math.sin(face - last), Math.cos(face - last));
      biggest = Math.max(biggest, Math.abs(d));
      last = face;
      // away from the ends it faces exactly the way it's going
      const p = walkerAt(w, t);
      const q = walkerAt(w, t + 0.4);
      const r = walkerAt(w, t - 0.4);
      if (Math.hypot(q.x - r.x, q.z - r.z) > 0.79 * w.speed) expect(Math.cos(face - p.face)).toBeGreaterThan(0.999);
    }
    // never more than a frame's share of a quick turn (half a second for the half turn)
    expect(biggest).toBeLessThan(0.2);
  });

  it('steps its feet by the ground it covers', () => {
    const w = WALKERS[1];
    const a = walkerStride(w, 0);
    const b = walkerStride(w, 1);
    // a second of ground (its speed) is that many strides of phase
    const turned = (b.phase - a.phase + TAU * 10) % TAU;
    expect(turned).toBeCloseTo(((w.speed / b.stride) * TAU) % TAU, 5);
  });
});

describe('the online ghosts’ emotes, on a box figure', () => {
  it('has a body for every emote, and none for an unknown one', () => {
    expect(BOX_EMOTES).toEqual(expect.arrayContaining(EMOTES));
    for (const id of BOX_EMOTES) {
      const b = boxEmote(id, 0.6);
      expect(b, id).not.toBeNull();
      for (const v of [b.armL[0], b.armL[1], b.armR[0], b.armR[1], b.legL, b.legR, b.lift, b.head]) expect(Number.isFinite(v)).toBe(true);
    }
    expect(boxEmote('backflip', 1)).toBeNull();
  });

  it('raises the right hand for a wave, both for a cheer, and sits for a sit', () => {
    expect(boxEmote('wave', 1).armR[0]).toBeLessThan(-2);
    expect(boxEmote('cheer', 0.4).armL[0]).toBeLessThan(-2);
    expect(boxEmote('sit', 2).lift).toBeLessThan(-0.15);
  });
});
