import { describe, expect, it } from 'vitest';
import { FOLK, createFolk, eveChoice, stepFolk } from './townsfolk';

describe('Atom Eve’s choice', () => {
  it('goes to his side in a fight above all, cheers after it, stops for him, else patrols', () => {
    expect(eveChoice({ fight: true, cheer: 2, wait: true })).toBe('assist');
    expect(eveChoice({ fight: false, cheer: 2, wait: true })).toBe('cheer');
    expect(eveChoice({ fight: false, cheer: 0, wait: true })).toBe('meet');
    expect(eveChoice({ fight: false, cheer: 0, wait: false })).toBe('patrol');
  });
});

const DT = 1 / 30;
const run = (s, secs, ctx = {}) => {
  let out = null;
  for (let i = 0, n = Math.round(secs / DT); i < n; i++) out = stepFolk(s, DT, typeof ctx === 'function' ? ctx(i) : ctx);
  return out;
};
const far = { x: 500, y: 0, z: 500, air: false };

describe('a townsperson', () => {
  it('stands as they stand when nobody is about', () => {
    const s = createFolk({ id: 'a', x: 0, z: 0, face: 0.5, base: 'talk' });
    const out = run(s, 2, { hero: far });
    expect(out.mode).toBe('talk');
    expect(out.look).toBe(null);
    expect(out.yaw).toBeCloseTo(0.5, 5);
  });

  it('looks at him with the head while he is ahead, and turns only once he is well round', () => {
    const s = createFolk({ id: 'a', x: 0, z: 0, face: 0 });
    // ahead and a little to one side: the head, not the body
    let out = run(s, 1, { hero: { x: 4, y: 0, z: 10, air: false } });
    expect(out.look).toEqual({ x: 4, y: FOLK.eyes, z: 10 });
    expect(out.yaw).toBeCloseTo(0, 5);
    // behind them: they step round to him, and stop short of square on
    out = run(s, 0.1, { hero: { x: 0, y: 0, z: -10, air: false } });
    expect(out.mode).toBe('walk');
    run(s, 3, { hero: { x: 0, y: 0, z: -10, air: false } });
    expect(Math.abs(Math.abs(s.yaw) - Math.PI)).toBeLessThanOrEqual(FOLK.turnTo + 1e-6);
    expect(s.turning).toBe(false);
  });

  it('waves when he goes over in the air, and talks only while he talks to them', () => {
    const s = createFolk({ id: 'a', role: 'fan', x: 0, z: 0, face: 0, r: 9 });
    expect(run(s, 0.2, { hero: { x: 0, y: 12, z: 10, air: true } }).mode).toBe('wave');
    expect(run(s, 0.2, { hero: { x: 0, y: 0, z: 5, air: false }, talking: false }).mode).toBe('idle');
    expect(run(s, 0.2, { hero: { x: 0, y: 0, z: 5, air: false }, talking: true }).mode).toBe('talk');
  });

  it('runs from a crater, then walks back to where they stood', () => {
    const s = createFolk({ id: 'a', x: 0, z: 0, face: 0 });
    const out = stepFolk(s, DT, { hero: far, scares: [{ x: 5, z: 0, r: 20 }] });
    expect(out.react).toBe('gunfire');
    expect(out.mode).toBe('run');
    run(s, 2, { hero: far });
    expect(s.x).toBeLessThan(-5); // (away from it)
    run(s, FOLK.flee.time, { hero: far });
    expect(s.task).toBe('back');
    run(s, 20, { hero: far });
    expect(s.task).toBe('home');
    expect(Math.hypot(s.x, s.z)).toBeLessThan(1e-6);
  });

  it('goes round a building rather than into it', () => {
    const s = createFolk({ id: 'a', x: 0, z: 0, face: 0 });
    const wall = (x) => x < -3; // everything west of x = −3
    stepFolk(s, DT, { hero: far, scares: [{ x: 5, z: 0, r: 20 }], blocked: wall });
    run(s, FOLK.flee.time, { hero: far, blocked: wall });
    expect(s.x).toBeGreaterThanOrEqual(-3);
    expect(Math.abs(s.z)).toBeGreaterThan(3);
  });

  it('stays on the porch when scared, and Cecil only looks', () => {
    const debbie = createFolk({ id: 'd', role: 'debbie', x: 0, z: 0, stays: true });
    const cecil = createFolk({ id: 'c', role: 'cecil', x: 0, z: 0, base: 'arms', stays: true, calm: true });
    const scare = { scares: [{ x: 5, z: 0, r: 20 }], hero: far };
    expect(stepFolk(debbie, DT, scare).react).toBe('gunfire');
    const c = stepFolk(cecil, DT, scare);
    expect(c.react).toBe(null);
    expect(c.look).toEqual({ x: 5, y: 1, z: 0 });
    run(debbie, 2, { hero: far });
    run(cecil, 2, { hero: far });
    expect([debbie.x, debbie.z, cecil.x, cecil.z]).toEqual([0, 0, 0, 0]);
  });

  it('cheers when the Flaxans are beaten, all but Cecil', () => {
    const fan = createFolk({ id: 'a', x: 0, z: 0 });
    const cecil = createFolk({ id: 'c', role: 'cecil', x: 0, z: 0, base: 'arms', calm: true });
    expect(stepFolk(fan, DT, { hero: far, won: true }).mode).toBe('cheer');
    expect(stepFolk(cecil, DT, { hero: far, won: true }).mode).toBe('arms');
    expect(run(fan, FOLK.cheer + 1, { hero: far }).mode).not.toBe('cheer');
  });

  it('finds other things to do standing about, the same each visit', () => {
    const modes = (seed) => {
      const s = createFolk({ id: 'a', x: 0, z: 0, seed });
      const seen = [];
      run(s, 120, () => ({ hero: far }));
      for (let i = 0; i < 3600; i++) seen.push(stepFolk(s, DT, { hero: far }).mode);
      return seen;
    };
    const a = modes(4);
    expect(new Set(a).size).toBeGreaterThan(1);
    expect(modes(4)).toEqual(a);
  });
});
