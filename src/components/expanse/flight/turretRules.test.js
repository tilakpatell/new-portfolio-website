import { describe, expect, it } from 'vitest';
import { BOLT, TURRET, aimTurret, boltHits, muzzleOf, newTurret, stepBolt } from './turretRules';

const turret = (extra = {}) => ({ ...newTurret({ id: 't', owner: 'u1', x: 0, y: 0, z: 0, rot: [0, 0, 0], metadata: { by: 'n1' } }), ...extra });
// a ship straight ahead of yaw 0 (−z), at the barrel’s height
const at = (id, z, extra = {}) => ({ id, x: 0, y: TURRET.height, z, ...extra });

describe('a turret’s aim', () => {
  it('picks the nearest target in range', () => {
    const t = turret();
    const { fireAt } = aimTurret(t, [at('far', -500), at('near', -200), at('out', -TURRET.range - 1)], 0.016);
    expect(fireAt?.id).toBe('near');
    expect(aimTurret(t, [at('out', -TURRET.range - 1)], 0.016).fireAt).toBeNull();
  });

  it('never fires at its owner’s ship, by either name', () => {
    const t = turret();
    expect(aimTurret(t, [at('u1', -100), at('n1', -100)], 0.016).fireAt).toBeNull();
  });

  it('fires at its rate, no faster', () => {
    let t = turret();
    let shots = 0;
    for (let i = 0; i < 600; i++) {
      t = aimTurret(t, [at('s', -300)], 1 / 60);
      if (t.fireAt) shots++;
    }
    // ten seconds’ frames: one at once, then one each 1 / rate s (the one due at 10 s is the next frame’s)
    expect(shots).toBe(Math.ceil(TURRET.rate * 10));
  });

  it('turns no faster than its turn a second, and fires only once it’s on target', () => {
    // a target behind it: half a turn away
    let t = turret();
    t = aimTurret(t, [at('s', 300)], 0.1);
    expect(Math.abs(t.yaw)).toBeCloseTo(TURRET.turn * 0.1, 6);
    expect(t.fireAt).toBeNull();
    for (let i = 0; i < 30; i++) t = aimTurret(t, [at('s', 300)], 0.1);
    expect(Math.abs(Math.abs(t.yaw) - Math.PI)).toBeLessThan(0.01);
  });

  it('leads a moving target', () => {
    const t = turret();
    const still = aimTurret(t, [at('s', -400)], 0.016, { turnless: true });
    const moving = aimTurret(t, [at('s', -400, { vx: 100, vy: 0, vz: 0 })], 0.016, { turnless: true });
    expect(still.yaw).toBeCloseTo(0, 6);
    // (to the right, +x, is a yaw below 0: forwardOf’s)
    expect(moving.yaw).toBeLessThan(-0.05);
  });
});

describe('a bolt', () => {
  it('flies from the muzzle along the barrel, and is spent past its range', () => {
    const t = turret();
    const b = muzzleOf(t);
    expect(Math.hypot(b.v[0], b.v[1], b.v[2])).toBeCloseTo(BOLT.speed, 6);
    let bolt = b;
    let alive = 0;
    while ((bolt = stepBolt(bolt, 0.05))) alive++;
    expect(alive * 0.05).toBeLessThanOrEqual(BOLT.life + 0.05);
  });

  it('hits what it passes within a ship’s reach in a frame, even at speed', () => {
    const bolt = { p: [0, 0, 0], v: [0, 0, -BOLT.speed], life: 1 };
    expect(boltHits(bolt, 0.05, { x: 0, y: 1, z: -20 })).toBe(true);
    expect(boltHits(bolt, 0.05, { x: 30, y: 0, z: -20 })).toBe(false);
    expect(boltHits(bolt, 0.05, { x: 0, y: 0, z: 20 })).toBe(false);
  });
});
