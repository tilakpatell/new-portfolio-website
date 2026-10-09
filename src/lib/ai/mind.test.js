import { describe, expect, it, vi } from 'vitest';
import { IDLE, createMind, mindStep } from './mind';
import { STATES } from './states';

const STEP = 1 / 60;
const still = (mode) => ({ ...IDLE, mode });
// a tiny table: enough to see the machine turn
const TABLE = () => ({
  patrol: { tick: vi.fn(() => still('patrol')), exit: vi.fn() },
  chase: { enter: vi.fn(), tick: vi.fn(() => still('chase')) },
  search: { tick: vi.fn(() => still('search')) },
  attack: { tick: vi.fn(() => still('attack')) },
  stunned: { enter: vi.fn((bb) => (bb.until = bb.clock + bb.stun)), tick: (bb) => (bb.clock >= bb.until ? { to: bb.after ?? 'chase' } : still('stunned')) },
  flee: { tick: () => still('flee') },
  dead: { tick: () => still('dead') },
});
const run = (m, seconds, w = {}) => {
  let out;
  for (let i = 0; i < Math.round(seconds / STEP); i++) out = mindStep(m, w, STEP);
  return out;
};

describe('createMind', () => {
  it('ticks at its rate and holds the intent between', () => {
    const t = TABLE();
    const m = createMind(t, { rate: 10, phase: 0 });
    const a = mindStep(m, {}, STEP);
    const b = mindStep(m, {}, STEP);
    expect(b).toBe(a);
    run(m, 1 - 2 * STEP);
    expect(t.patrol.tick).toHaveBeenCalledTimes(10);
    expect(m.state).toBe('patrol');
    expect(m.intent.mode).toBe('patrol');
  });

  it('the phase spreads two minds’ ticks apart', () => {
    const a = createMind(TABLE(), { rate: 10, seed: 1 });
    const b = createMind(TABLE(), { rate: 10, seed: 2 });
    expect(a.timer).not.toBe(b.timer);
    expect(a.timer).toBeGreaterThanOrEqual(0);
    expect(a.timer).toBeLessThan(0.1);
  });

  it('struck interrupts every state but dead', () => {
    for (const start of ['patrol', 'chase', 'search', 'attack', 'flee']) {
      const m = createMind(TABLE(), { start, phase: 0 });
      m.on('struck', { stun: 0.5 });
      mindStep(m, {}, STEP);
      expect(m.state).toBe('stunned');
      expect(m.bb.stun).toBe(0.5);
      expect(m.intent.mode).toBe('stunned');
    }
    const d = createMind(TABLE(), { start: 'dead', phase: 0 });
    d.on('struck', { stun: 0.5 });
    mindStep(d, {}, STEP);
    expect(d.state).toBe('dead');
  });

  it('exit runs before enter on a transition, with the world', () => {
    const t = TABLE();
    const order = [];
    t.patrol.exit.mockImplementation(() => order.push('exit'));
    t.chase.enter.mockImplementation((bb, w) => order.push(`enter:${w.name}`));
    const m = createMind(t, { phase: 0 });
    m.on('found');
    mindStep(m, { name: 'w' }, STEP);
    expect(order).toEqual(['exit', 'enter:w']);
    expect(t.chase.tick).toHaveBeenCalledTimes(1); // (the new state ticks at once)
  });

  it('found moves patrol and search to chase; lost moves chase and attack to search', () => {
    const go = (start, event) => {
      const m = createMind(TABLE(), { start, phase: 0 });
      m.on(event);
      mindStep(m, {}, STEP);
      return m.state;
    };
    expect(go('patrol', 'found')).toBe('chase');
    expect(go('search', 'found')).toBe('chase');
    expect(go('chase', 'lost')).toBe('search');
    expect(go('attack', 'lost')).toBe('search');
    expect(go('patrol', 'lost')).toBe('patrol');
    expect(go('chase', 'found')).toBe('chase');
  });

  it('a state’s own `on` wins over the default', () => {
    const t = TABLE();
    t.patrol.on = { struck: () => 'flee' };
    const m = createMind(t, { phase: 0 });
    m.on('struck', { stun: 1 });
    mindStep(m, {}, STEP);
    expect(m.state).toBe('flee');
  });

  it('stunned leaves on its timer to bb.after', () => {
    const m = createMind(TABLE(), { start: 'attack', phase: 0, rate: 60 });
    m.bb.after = 'search';
    m.on('struck', { stun: 0.5 });
    run(m, 0.4);
    expect(m.state).toBe('stunned');
    run(m, 0.2);
    expect(m.state).toBe('search');
  });

  it('dead never leaves', () => {
    const m = createMind(TABLE(), { start: 'chase', phase: 0 });
    m.on('dead');
    mindStep(m, {}, STEP);
    expect(m.state).toBe('dead');
    for (const e of ['found', 'lost', 'struck']) m.on(e, { stun: 1 });
    run(m, 1);
    expect(m.state).toBe('dead');
  });

  it('a tick that returns { to } ticks the new state at once, and a transition loop is cut', () => {
    const t = TABLE();
    t.patrol.tick = () => ({ to: 'chase' });
    t.chase.tick = () => ({ to: 'patrol' });
    const m = createMind(t, { phase: 0 });
    expect(() => mindStep(m, {}, STEP)).not.toThrow();
    expect(['patrol', 'chase']).toContain(m.state);
  });

  it('the same seed gives the same transitions over 10 s of a scripted world', () => {
    const table = () => ({
      patrol: { tick: (bb) => (bb.rand() < 0.3 ? { to: 'chase' } : still('patrol')) },
      chase: { tick: (bb) => (bb.rand() < 0.3 ? { to: 'patrol' } : still('chase')) },
      stunned: { tick: () => still('stunned') },
      dead: { tick: () => still('dead') },
    });
    const trace = (seed) => {
      const m = createMind(table(), { seed, rate: 10 });
      const out = [];
      for (let i = 0; i < 600; i++) {
        mindStep(m, {}, STEP);
        out.push(m.state[0]);
      }
      return out.join('');
    };
    expect(trace(7)).toBe(trace(7));
    expect(trace(7)).not.toBe(trace(8));
  });
});

describe('STATES', () => {
  const pos = { x: 0, z: 0 };
  const bb = (more) => ({ pos, pace: { walk: 1.4, run: 4 }, ...more });
  const mind = (start, more) => {
    const m = createMind(STATES, { start, phase: 0, rate: 60 });
    Object.assign(m.bb, bb(more));
    return m;
  };

  it('patrol walks its route and turns at each waypoint', () => {
    const m = mind('patrol', { route: [{ x: 10, z: 0 }, { x: 10, z: 10 }], at: 0 });
    const i = mindStep(m, {}, STEP);
    expect(i.vel).toEqual({ x: 1.4, z: 0 });
    expect(i.face).toBeCloseTo(Math.atan2(10, 0), 5);
    expect(i.mode).toBe('patrol');
    m.bb.pos = { x: 9.9, z: 0 };
    mindStep(m, {}, STEP);
    expect(m.bb.at).toBe(1);
    const j = mindStep(m, {}, STEP);
    expect(j.vel.z).toBeCloseTo(1.4, 3);
  });

  it('patrol with no route holds still', () => {
    expect(mindStep(mind('patrol'), {}, STEP)).toMatchObject({ vel: { x: 0, z: 0 }, mode: 'hold' });
  });

  it('chase runs at the belief and goes to attack in reach', () => {
    const m = mind('chase', { target: { at: { x: 3, z: 4 } }, inReach: () => false });
    const i = mindStep(m, {}, STEP);
    expect(i.vel.x).toBeCloseTo(2.4, 5);
    expect(i.vel.z).toBeCloseTo(3.2, 5);
    expect(i.mode).toBe('chase');
    m.bb.inReach = () => true;
    mindStep(m, {}, STEP);
    expect(m.state).toBe('attack');
  });

  it('chase with no target goes to search', () => {
    const m = mind('chase', { lastSeen: { x: 5, z: 0 } });
    mindStep(m, {}, STEP);
    expect(m.state).toBe('search');
  });

  it('attack asks the world’s own attack and goes back to chase out of reach', () => {
    const attack = vi.fn(() => ({ ...IDLE, act: 'strike', mode: 'attack' }));
    const m = mind('attack', { target: { at: { x: 1, z: 0 } }, inReach: () => true, attack });
    expect(mindStep(m, {}, STEP).act).toBe('strike');
    expect(attack).toHaveBeenCalled();
    m.bb.inReach = () => false;
    mindStep(m, {}, STEP);
    expect(m.state).toBe('chase');
  });

  it('search walks to where it last saw you, then back to patrol after searchFor', () => {
    const m = mind('search', { lastSeen: { x: 5, z: 0 }, searchFor: 1, route: [{ x: 0, z: 0 }], at: 0 });
    const i = mindStep(m, {}, STEP);
    expect(i.vel.x).toBeCloseTo(1.4, 5);
    expect(i.mode).toBe('search');
    run(m, 1.1);
    expect(m.state).toBe('patrol');
  });

  it('flee runs away and returns to chase once hp is back over fleeUntil', () => {
    const m = mind('flee', { target: { at: { x: 5, z: 0 } }, hp: 1, fleeUntil: 3 });
    const i = mindStep(m, {}, STEP);
    expect(i.vel.x).toBeCloseTo(-4, 5);
    expect(i.mode).toBe('flee');
    m.bb.hp = 4;
    mindStep(m, {}, STEP);
    expect(m.state).toBe('chase');
  });

  it('stunned holds still, then goes to bb.after or chase', () => {
    const m = mind('chase', { target: { at: { x: 5, z: 0 } }, inReach: () => false });
    m.on('struck', { stun: 0.2 });
    expect(mindStep(m, {}, STEP)).toMatchObject({ vel: { x: 0, z: 0 }, mode: 'stunned' });
    run(m, 0.25);
    expect(m.state).toBe('chase');
  });

  it('dead is final and still', () => {
    const m = mind('chase', { target: { at: { x: 5, z: 0 } } });
    m.on('dead');
    expect(mindStep(m, {}, STEP)).toMatchObject({ vel: { x: 0, z: 0 }, mode: 'dead' });
    expect(m.bb.dead).toBe(true);
  });
});
