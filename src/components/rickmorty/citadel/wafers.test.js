import { describe, expect, it } from 'vitest';
import { LINE, dropLayer, newLine, stepLine } from './wafers';

// drop with the dispenser held at x
const dropAt = (line, x) => {
  stepLine(line, 0);
  line.x = x;
  return dropLayer(line);
};
const wafer = (line, xs) => xs.flatMap((x) => dropAt(line, x));
const types = (ev) => ev.map((e) => e.type);

describe('Simple Rick’s line', () => {
  it('makes a good wafer from five layers dropped dead centre', () => {
    const line = newLine();
    const ev = wafer(line, [0, 0, 0, 0, 0]);
    expect(types(ev).filter((t) => t === 'layer')).toHaveLength(5);
    expect(types(ev)).toContain('good');
    expect(line.good).toBe(1);
    expect(line.made).toBe(1);
    expect(line.layer).toBe(0);
    expect(line.w).toBe(1);
  });
  it('cuts off what overhangs the layer below', () => {
    const line = newLine();
    const ev = dropAt(line, 0.2);
    expect(types(ev)).toContain('cut');
    expect(line.below.w).toBeCloseTo(0.8);
    expect(line.below.x).toBeCloseTo(0.1);
    expect(line.w).toBeCloseTo(0.8);
  });
  it('spoils a wafer when a layer misses', () => {
    const line = newLine();
    dropAt(line, 0);
    const ev = dropAt(line, 1.1);
    expect(types(ev)).toContain('spoilt');
    expect(line.made).toBe(1);
    expect(line.good).toBe(0);
    expect(line.layer).toBe(0);
    expect(line.w).toBe(1);
  });
  it('counts a narrow wafer as made but not good', () => {
    const line = newLine();
    const ev = wafer(line, [0.2, 0.3, 0.4, 0.45, 0.5]);
    expect(types(ev)).toContain('wafer');
    expect(types(ev)).not.toContain('good');
    expect(line.made).toBe(1);
    expect(line.good).toBe(0);
  });
  it('wins on the third good wafer, once', () => {
    const line = newLine();
    const ev = [0, 1, 2].flatMap(() => wafer(line, [0, 0, 0, 0, 0]));
    expect(types(ev).filter((t) => t === 'won')).toHaveLength(1);
    expect(line.state).toBe('won');
    expect(dropAt(line, 0)).toEqual([]);
  });
  it('is out after six with fewer than three good', () => {
    const line = newLine();
    const ev = [];
    for (let i = 0; i < LINE.wafers; i++) ev.push(...(i < 2 ? wafer(line, [0, 0, 0, 0, 0]) : [...dropAt(line, 0), ...dropAt(line, 1.2)]));
    expect(types(ev).filter((t) => t === 'out')).toHaveLength(1);
    expect(line.state).toBe('out');
  });
  it('speeds the dispenser up with each layer', () => {
    const a = newLine();
    stepLine(a, 0.1);
    const b = newLine();
    for (let i = 0; i < 4; i++) dropAt(b, 0);
    const before = b.phase;
    stepLine(b, 0.1);
    expect(b.phase - before).toBeGreaterThan(a.phase);
  });
  it('swings the dispenser no further than its travel', () => {
    const line = newLine();
    for (let i = 0; i < 400; i++) {
      stepLine(line, 1 / 60);
      expect(Math.abs(line.x)).toBeLessThanOrEqual(LINE.travel + 1e-9);
    }
  });
  it('lays a drop that’s all but over the stack square on it', () => {
    const line = newLine();
    const ev = dropAt(line, 0.05);
    expect(types(ev)).not.toContain('cut');
    expect(line.w).toBe(1);
    expect(line.below.x).toBe(0);
    // but not one that's plainly off
    expect(types(dropAt(line, 0.12))).toContain('cut');
  });
  it('judges a drop where the dispenser is at the press, not where it was last frame', () => {
    const line = newLine();
    stepLine(line, 0);
    // the dispenser was well off to one side at the last frame, and over
    // the stack 40 ms later, when the key went down
    const rate = LINE.speed * Math.PI * 2;
    line.phase = -0.04 * rate;
    line.x = Math.sin(line.phase) * LINE.travel;
    expect(Math.abs(line.x)).toBeGreaterThan(0.06);
    const ev = dropLayer(line, 0.04);
    expect(types(ev)).not.toContain('cut');
    expect(line.w).toBe(1);
  });
  it('can be won by a player whose timing is a little off, and not by pressing at random', () => {
    expect(shiftsWon(0.035, 30)).toBeGreaterThan(0.85);
    expect(shiftsWon(0.035, 60)).toBeGreaterThan(0.85);
    // sloppy timing wins now and then; mashing, never
    expect(shiftsWon(0.05, 60)).toBeLessThan(0.7);
    expect(shiftsWon(null, 60)).toBeLessThan(0.05);
  });
  it('lays one layer a press, however fast the presses come', () => {
    const line = newLine();
    stepLine(line, 0.01);
    expect(types(dropLayer(line))).toContain('layer');
    expect(dropLayer(line)).toEqual([]);
    expect(line.layer).toBe(1);
  });
});

// A player on the line: each press aimed at the moment the dispenser's next
// over the stack (a third of a second on, at least), give or take a Gaussian
// `spread` of seconds (or, with no spread, at a random moment); the game
// steps at `fps` and takes each press before its next step. The share of
// 200 shifts won.
function shiftsWon(spread, fps) {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  let won = 0;
  for (let n = 0; n < 200; n++) {
    const line = newLine();
    const dt = 1 / fps;
    let t = 0;
    let press = null;
    while (line.state === 'ready' && t < 900) {
      if (press == null) {
        const rate = (LINE.speed + line.layer * LINE.speedUp) * Math.PI * 2;
        if (spread == null) press = t + 0.35 + rnd() / (rate / (Math.PI * 2));
        else {
          const b = Math.asin(Math.max(-1, Math.min(1, line.below.x / LINE.travel)));
          const from = line.phase + rate * 0.35;
          const k0 = Math.floor(from / (Math.PI * 2));
          let at = Infinity;
          for (let k = k0 - 1; k <= k0 + 2; k++) for (const p of [b + Math.PI * 2 * k, Math.PI - b + Math.PI * 2 * k]) if (p > from && p < at) at = p;
          press = t + (at - line.phase) / rate + gauss() * spread;
        }
      }
      if (press < t + dt) {
        dropLayer(line, Math.max(0, press - t));
        press = null;
      }
      stepLine(line, dt);
      t += dt;
    }
    if (line.state === 'won') won += 1;
  }
  return won / 200;
}
