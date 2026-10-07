import { describe, expect, it } from 'vitest';
import { REACTIONS, createReactions } from '../../lib/ai/react';
import { troopFall, troopHitWhere } from './footScene';
import { TROOPS, vec } from './foot';

// a trooper standing on top of a planet of radius R, facing +z
const R = 100;
const trooper = (extra = {}) => ({ id: 1, kind: 'stormtrooper', n: [0, 1, 0], f: [0, 0, 1], h: 0, alive: false, dead: 0, ...extra });
const down = (ctx) => createReactions(REACTIONS).on('down', { t: 0, ...ctx })?.clip;

describe('a troop going down', () => {
  it('falls back when shot from the front, forward when shot from behind, and over its back with no shot', () => {
    expect(down(troopFall(trooper({ knock: [0, 0, -1] })))).toBe('die.back');
    expect(down(troopFall(trooper({ knock: [0, 0, 1] })))).toBe('die.fwd');
    expect(down(troopFall(trooper()))).toBe('die.back'); // (your going down: their job's done)
  });

  it('is in its own frame, whichever way it faces: +z ahead, +x its left', () => {
    // facing +x, shot from its right going toward its left (−z is its left: f × n is its right)
    const t = trooper({ f: [1, 0, 0], knock: vec.unit([0.2, 0, -1]) });
    const { dir } = troopFall(t);
    expect(dir.z).toBeCloseTo(0.2 / Math.hypot(0.2, 1), 6);
    expect(dir.x).toBeCloseTo(1 / Math.hypot(0.2, 1), 6);
  });

  it('is thrown back off its feet by a bowcaster’s bolt, dropped by a blaster’s', () => {
    expect(down(troopFall(trooper({ knock: [0, 0, -1] }), 2))).toBe('die.blown');
    expect(down(troopFall(trooper({ knock: [0, 0, -1] }), 1))).toBe('die.back');
    expect(troopFall(trooper(), 99).force).toBe(1);
    expect(troopFall(trooper(), -1).force).toBe(0);
  });
});

describe('a troop hit', () => {
  it('in the head by a bolt in the top fifth of it, else in the chest', () => {
    const t = trooper({ alive: true });
    const tall = TROOPS.stormtrooper.tall;
    expect(troopHitWhere(t, [0, R + tall * 0.92, 0], R)).toBe('head');
    expect(troopHitWhere(t, [0, R + tall * 0.55, 0.1], R)).toBe('chest');
  });
});
