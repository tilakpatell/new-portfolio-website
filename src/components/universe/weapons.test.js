import { describe, expect, it } from 'vitest';
import { ARSENAL, ORDER, WEAPONS, byCode, createArmory, fan, steer } from './weapons';

describe('weapons', () => {
  it('every ship names all three', () => {
    for (const a of Object.values(ARSENAL)) expect(a.names).toHaveLength(ORDER.length);
    for (const id of ORDER) expect(byCode(WEAPONS[id].code)).toBe(id);
    expect(byCode(99)).toBe('blaster');
  });

  it('cycles and selects, and fires each at its own pace', () => {
    const a = createArmory('xwing');
    expect(a.name).toBe('Laser cannons');
    expect(a.ready(0, 0.12)).toBe(true);
    a.fired(0);
    expect(a.ready(100, 0.12)).toBe(false);
    expect(a.ready(120, 0.12)).toBe(true);
    a.cycle();
    expect(a.id).toBe('spread');
    a.cycle(-1);
    a.cycle(-1);
    expect(a.id).toBe('heavy');
    expect(a.select(9)).toBe(false);
    expect(a.select(0)).toBe(true);
  });

  it('heavy rounds run out and come back one at a time', () => {
    const a = createArmory('falcon');
    a.select(2);
    let t = 0;
    for (let i = 0; i < a.ammoMax; i++) {
      expect(a.ready(t, 0.16)).toBe(true);
      a.fired(t);
      t += 10000;
    }
    expect(a.ammo).toBe(0);
    expect(a.ready(t, 0.16)).toBe(false);
    a.update(WEAPONS.heavy.reload);
    expect(a.ammo).toBe(1);
    a.reload();
    expect(a.ammo).toBe(a.ammoMax);
  });

  it('a fan stays unit length and around the aim', () => {
    const shots = fan([0, 0, -1], 5, 0.08);
    expect(shots).toHaveLength(5);
    for (const d of shots) {
      expect(Math.hypot(...d)).toBeCloseTo(1);
      expect(d[2]).toBeLessThan(-0.95);
    }
    expect(fan([0, 0, -1], 1, 0.08)).toEqual([[0, 0, -1]]);
  });

  it('a homing round turns no faster than its rate, keeping its speed', () => {
    const v = [0, 0, -10];
    steer(v, [1, 0, 0], 1, 0.5);
    expect(Math.hypot(...v)).toBeCloseTo(10);
    expect(Math.atan2(v[0], -v[2])).toBeCloseTo(0.5, 1);
    for (let i = 0; i < 20; i++) steer(v, [1, 0, 0], 1, 0.5);
    expect(v[0]).toBeCloseTo(10);
  });
});
