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
  it('lays one layer a press, however fast the presses come', () => {
    const line = newLine();
    stepLine(line, 0.01);
    expect(types(dropLayer(line))).toContain('layer');
    expect(dropLayer(line)).toEqual([]);
    expect(line.layer).toBe(1);
  });
});
