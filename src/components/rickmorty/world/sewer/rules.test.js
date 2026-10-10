import { describe, expect, it } from 'vitest';
import { createCooldownPress } from '../../../../lib/press';
import { TUNING, laneX, newRun, progress, stepRun } from './rules';

const DT = 1 / 60;
const run = (seed, play, max = 60 * 90) => {
  let r = newRun(seed);
  for (let i = 0; i < max && r.phase === 'run'; i++) r = stepRun(r, play(r), DT);
  return r;
};
// a player who hops anything in his lane as it comes, and shoots rats once he can
const careful = (r) => {
  const next = r.items.filter((o) => !o.hit && o.lane === r.lane && o.at > r.x).sort((a, b) => a.at - b.at)[0];
  const input = {};
  if (next && next.kind !== 'screw' && next.at - r.x < (next.kind === 'rat' ? 4.5 : 3.2) && r.hop <= 0) input.hop = true;
  if (next && next.kind === 'rat' && r.laser && next.at - r.x < TUNING.range) input.fire = true;
  return input;
};
const sleeper = () => ({});

describe('the sewer run', () => {
  it('starts rolling in the middle lane with three points and no laser', () => {
    const r = newRun(5);
    expect(r).toMatchObject({ lane: 1, hp: 3, screws: 0, laser: false, phase: 'run', x: 0 });
    expect(laneX(1)).toBe(0);
    expect(laneX(0)).toBeLessThan(0);
  });
  it('shifts a lane a press, and no further than the drain', () => {
    let r = newRun(1);
    r = stepRun(r, { right: true }, DT);
    expect(r.lane).toBe(2);
    r = stepRun(r, { right: true }, DT);
    expect(r.lane).toBe(2);
    r = stepRun(r, { left: true }, DT);
    r = stepRun(r, { left: true }, DT);
    r = stepRun(r, { left: true }, DT);
    expect(r.lane).toBe(0);
  });
  it('makes the same drain from the same seed, and a different one from another', () => {
    const a = run(3, sleeper, 60);
    const b = run(3, sleeper, 60);
    const c = run(4, sleeper, 60);
    expect(a.items.map((o) => [o.kind, o.lane, +o.at.toFixed(2)])).toEqual(b.items.map((o) => [o.kind, o.lane, +o.at.toFixed(2)]));
    expect(a.items.map((o) => o.kind).join()).not.toBe(c.items.map((o) => o.kind).join());
  });
  it('loses a point to a rat or a grate taken flat, and is out at none', () => {
    const r = run(7, sleeper);
    expect(r.phase).toBe('lost');
    expect(r.hp).toBe(0);
    expect(r.x).toBeLessThan(TUNING.goal);
  });
  it('gets a careful player to the agency, with kills and screws on the way', () => {
    let won = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const r = run(seed, careful);
      if (r.phase === 'won') won++;
      expect(r.phase).not.toBe('run');
    }
    expect(won).toBeGreaterThanOrEqual(4);
    const r = run(2, careful);
    expect(r.kills + r.screws).toBeGreaterThan(0);
    expect(progress(r)).toBeLessThanOrEqual(1);
  });
  it('gives the laser after enough screws, and the laser takes the rat ahead', () => {
    let r = { ...newRun(1), screws: TUNING.screws - 1, items: [{ id: 1, kind: 'screw', lane: 1, at: 0.4, hit: false }], next: 1e9 };
    r = stepRun(r, {}, DT);
    expect(r.laser).toBe(true);
    expect(r.events.map((e) => e.type)).toContain('laser');
    r = { ...r, items: [{ id: 2, kind: 'rat', lane: 1, at: r.x + 6, hit: false }], next: 1e9 };
    r = stepRun(r, { fire: true }, DT);
    expect(r.kills).toBe(1);
    expect(r.events.map((e) => e.type)).toContain('zap');
    // (and not again till the cooldown's over)
    r = { ...r, items: [{ id: 3, kind: 'rat', lane: 1, at: r.x + 6, hit: false }] };
    r = stepRun(r, { fire: true }, DT);
    expect(r.kills).toBe(1);
  });
  it('does nothing more once it is won or lost', () => {
    const r = run(7, sleeper);
    const again = stepRun(r, { hop: true }, DT);
    expect(again.x).toBe(r.x);
    expect(again.events).toEqual([]);
  });

  it('hops on landing when the hop was pressed a moment before (a buffer), and not from long before', () => {
    const press = createCooldownPress();
    let r = stepRun(newRun(1), { hop: true }, DT, { press });
    expect(r.hop).toBeGreaterThan(0);
    // pressed again with 0.08 s of the hop to go: it waits, and hops as the wheels come down
    while (r.hop > 0.08) r = stepRun(r, {}, DT, { press });
    r = stepRun(r, { hop: true }, DT, { press });
    let hops = 0;
    for (let i = 0; i < 12; i++) {
      r = stepRun(r, {}, DT, { press });
      hops += r.events.filter((e) => e.type === 'hop').length;
    }
    expect(hops).toBe(1);
    // pressed with 0.3 s to go: dropped, as before
    while (r.hop > 0.3) r = stepRun(r, {}, DT, { press });
    r = stepRun(r, { hop: true }, DT, { press });
    hops = 0;
    for (let i = 0; i < 40; i++) {
      r = stepRun(r, {}, DT, { press });
      hops += r.events.filter((e) => e.type === 'hop').length;
    }
    expect(hops).toBe(0);
  });
});
