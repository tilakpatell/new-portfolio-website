import { describe, expect, it } from 'vitest';
import { FIGHT, PORTAL, newFight, startInvasion, stepFight } from './fight';

const hero = (p, v = [0, 0, 0]) => ({ p: [...p], v: [...v], mode: 'air' });
const idle = { punch: false, look: [0, 0, -1] };
function run(f, h, t, input = idle, dt = 1 / 30) {
  const ev = [];
  let push = null;
  for (let s = 0; s < t; s += dt) {
    const r = stepFight(f, typeof h === 'function' ? h(s, f) : h, typeof input === 'function' ? input(s, f) : input, dt);
    f = r.fight;
    ev.push(...r.ev);
    push = r.push ?? push;
  }
  return { f, ev, push };
}
const far = hero([-2000, 30, 0]);

describe('the invasion', () => {
  it('waits until something starts it', () => {
    const { f, ev } = run(newFight(), far, 5);
    expect(f.on).toBe(false);
    expect(ev).toEqual([]);
  });
  it('opens the portal, and the Flaxans come through it a few at a time', () => {
    let f = startInvasion(newFight());
    expect(f.on).toBe(true);
    ({ f } = run(f, far, 4));
    const out = f.foes.filter((e) => e.state !== 'waiting');
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThan(FIGHT.count);
    for (const e of out) expect(Math.hypot(e.p[0] - PORTAL.p[0], e.p[2] - PORTAL.p[2])).toBeLessThan(400);
  });
  it('sends them at him, and their bolts hurt', () => {
    let f = startInvasion(newFight());
    ({ f } = run(f, far, 8));
    // hang about in the middle of them
    const near = hero([PORTAL.p[0], PORTAL.p[1] - 20, PORTAL.p[2] + 60]);
    const { ev } = run(f, near, 12);
    expect(ev.some((e) => e.type === 'bolt')).toBe(true);
    expect(ev.some((e) => e.type === 'hurt')).toBe(true);
  });
});

describe('fighting back', () => {
  // one Flaxan right in front of him
  const oneUp = () => {
    const f = startInvasion(newFight());
    const e = { ...f.foes[0], state: 'fight', p: [0, 100, -3], v: [0, 0, 0], hp: FIGHT.hp, cool: 99 };
    return { ...f, foes: [e, ...f.foes.slice(1).map((q) => ({ ...q, state: 'down' }))], spawned: FIGHT.count };
  };
  it('a punch knocks one out of the sky', () => {
    const { f, ev } = run(oneUp(), hero([0, 99, 0]), 1, (s) => ({ punch: s < 0.04, look: [0, 0, -1] }));
    expect(ev.some((e) => e.type === 'punch')).toBe(true);
    expect(ev.some((e) => e.type === 'ko')).toBe(true);
    expect(f.foes[0].state).toBe('ko');
  });
  it('a punch thrown from a little way off lunges him at it', () => {
    const f = oneUp();
    f.foes[0].p = [0, 100, -14];
    const { push } = run(f, hero([0, 99, 0]), 0.05, { punch: true, look: [0, 0, -1] });
    expect(push).toBeTruthy();
    expect(push[2]).toBeLessThan(-20);
  });
  it('flying into one fast knocks it out too', () => {
    const { ev } = run(oneUp(), hero([0, 99, -2.5], [0, 0, -90]), 0.2);
    expect(ev.some((e) => e.type === 'ko' && e.rammed)).toBe(true);
  });
  it('closes the portal when they’re all down', () => {
    let f = oneUp();
    const { ev, f: after } = run(f, hero([0, 99, 0]), 3, (s) => ({ punch: s < 0.04, look: [0, 0, -1] }));
    f = after;
    expect(ev.some((e) => e.type === 'won')).toBe(true);
    expect(f.on).toBe(false);
  });
});
