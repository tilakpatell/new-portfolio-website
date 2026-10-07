import { describe, expect, it } from 'vitest';
import { WORLD_MB } from '../worlds/worlds';
import mc, { KEYS, distanceFor, ticksFor } from './module';

describe('Minecraft, the world module', () => {
  it('the module has id minecraft, glsl, mb 2 matching WORLD_MB', () => {
    expect(mc).toMatchObject({ id: 'minecraft', shading: 'glsl', mb: 2 });
    expect(WORLD_MB['/dot-matrix/minecraft']).toBe(2);
    expect(typeof mc.create).toBe('function');
    expect(mc.label).toMatch(/Minecraft/);
  });

  it('binds the game’s keys', () => {
    expect(KEYS.forward).toEqual(['KeyW', 'ArrowUp']);
    expect(KEYS.jump).toEqual(['Space']);
    expect(KEYS.sneak).toEqual(['ShiftLeft', 'ShiftRight']);
    expect(KEYS.sprint).toEqual(['ControlLeft', 'ControlRight']);
    expect(KEYS.slot1).toEqual(['Digit1']);
    expect(KEYS.slot9).toEqual(['Digit9']);
    expect(KEYS.pause).toEqual(['Escape']);
  });

  it('the tick accumulator runs at most 4 ticks for a 1 s frame', () => {
    expect(ticksFor(1)).toEqual({ ticks: 4, left: 0 });
    expect(ticksFor(0.04)).toEqual({ ticks: 0, left: 0.04 });
    const r = ticksFor(0.12);
    expect(r.ticks).toBe(2);
    expect(r.left).toBeCloseTo(0.02, 10);
  });

  it('the render distance follows the tier and steps down with the quality', () => {
    expect([distanceFor('high', 0), distanceFor('mid', 0), distanceFor('low', 0)]).toEqual([10, 6, 4]);
    expect([1, 2, 3, 4].map((l) => distanceFor('high', l))).toEqual([8, 6, 4, 4]);
    expect(distanceFor('mid', 1)).toBe(6);
  });
});
