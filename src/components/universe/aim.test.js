import { describe, expect, it } from 'vitest';
import { JUMP, aimFrom, aimTargets, jumpPhase } from './aim';
import { HYPER, hyperState } from './nav';
import { POSITIONS, SUN } from './layout';
import { isGoal } from './ship';

const unit = (v) => {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
};
const toward = (from, to) => unit([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
// turned `a` radians about y
const turned = ([x, y, z], a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];

describe('the aim', () => {
  const from = [0, 20, 600]; // (just out of the home system)
  const main = aimTargets('main', null);

  it('aims at the place nearest the nose within the cone', () => {
    const nose = toward(from, POSITIONS.middleearth);
    expect(aimFrom(from, nose, main)?.id).toBe('middleearth');
    expect(aimFrom(from, turned(nose, 0.02), main)?.id).toBe('middleearth');
  });

  it('aims at nothing with nothing in the cone', () => {
    // (straight up out of the disc: nothing there)
    expect(aimFrom(from, [0, 1, 0], main)).toBe(null);
  });

  it('sticks to the one it had', () => {
    const targets = [
      { id: 'a', at: [0, 0, -10000] },
      { id: 'b', at: [Math.tan(0.005) * 10000, 0, -10000] },
    ];
    const nose = [0, 0, -1];
    expect(aimFrom([0, 0, 0], nose, targets)?.id).toBe('a');
    expect(aimFrom([0, 0, 0], nose, targets, 'b')?.id).toBe('b');
  });

  it('never aims at where you are, nor the other sector', () => {
    expect(aimTargets('main', 'middleearth').some((t) => t.id === 'middleearth')).toBe(false);
    expect(aimTargets('main', null).some((t) => t.id === 'gazorpazorp')).toBe(false);
    expect(aimTargets('rickmorty', null).some((t) => t.id === 'gazorpazorp')).toBe(true);
    expect(aimTargets('rickmorty', null).some((t) => t.id === 'middleearth')).toBe(false);
  });

  it('aims only at somewhere the ship can go: the home sun is home, the Twins once, no station', () => {
    for (const t of main) expect(isGoal(t.id), t.id).toBe(true);
    expect(main.find((t) => t.id === 'home')?.at).toEqual(SUN.at);
    expect(main.filter((t) => t.id === 'twins')).toHaveLength(1);
    expect(main.some((t) => t.id === 'projects')).toBe(false);
    expect(main.some((t) => t.id === 'sun')).toBe(false);
  });
});

describe('the jump', () => {
  it('aligns, then spools, and the stick cancels it', () => {
    expect(JUMP).toEqual({ align: 4.5, aligned: 0.996 });
    expect(jumpPhase({ phase: 'align' }, { aligned: 0.9, age: 1, input: false })).toBe('align');
    expect(jumpPhase({ phase: 'align' }, { aligned: 0.997, age: 1, input: false })).toBe('spool');
    expect(jumpPhase({ phase: 'align' }, { aligned: 0.5, age: 4.6, input: false })).toBe('spool');
    expect(jumpPhase({ phase: 'align' }, { aligned: 0.9, age: 1, input: true })).toBe('cancel');
    // (past the align, it's the jump's own)
    expect(jumpPhase({ phase: 'spool' }, { aligned: 0.2, age: 9, input: true })).toBe('spool');
  });

  it('recharges in five seconds', () => {
    expect(HYPER.recharge).toBe(5);
    expect(hyperState({ last: 0, now: 4 }).ready).toBe(false);
    expect(hyperState({ last: 0, now: 5 }).ready).toBe(true);
  });
});
