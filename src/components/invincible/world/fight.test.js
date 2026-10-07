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

describe('fast, or in big steps', () => {
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const finite = (f) => {
    for (const e of f.foes) for (const c of [...e.p, ...e.v]) expect(Number.isFinite(c)).toBe(true);
    for (const b of f.bolts) for (const c of b.p) expect(Number.isFinite(c)).toBe(true);
    expect(Number.isFinite(f.t) && Number.isFinite(f.hp) && Number.isFinite(f.cool)).toBe(true);
  };
  // a dozen out and about, round him and firing
  const busy = () => {
    let { f } = run(startInvasion(newFight()), far, 8);
    ({ f } = run(f, hero([PORTAL.p[0], PORTAL.p[1] - 20, PORTAL.p[2] + 60]), 2));
    return f;
  };
  it('a tab hidden for a minute comes back as one short step: no Flaxan jumps, nothing NaNs', () => {
    const f = busy();
    expect(f.foes.some((e) => e.state === 'fight')).toBe(true);
    const { fight: after } = stepFight(f, hero([PORTAL.p[0], PORTAL.p[1] - 20, PORTAL.p[2] + 60]), idle, 60);
    expect(after.t - f.t).toBeLessThanOrEqual(0.05 + 1e-9);
    after.foes.forEach((e, i) => {
      if (f.foes[i].state === 'fight' && e.state === 'fight') expect(dist(e.p, f.foes[i].p)).toBeLessThanOrEqual(FIGHT.speed * 0.05 + 1e-9);
    });
    finite(after);
  });
  it('a step of nothing, or of NaN, moves nothing and leaves everything a number', () => {
    const f = busy();
    for (const dt of [NaN, -1, 0, undefined]) {
      const { fight: after } = stepFight(f, hero([PORTAL.p[0], PORTAL.p[1] - 20, PORTAL.p[2] + 60]), idle, dt);
      expect(after.t).toBe(f.t);
      after.foes.forEach((e, i) => expect(e.p).toEqual(f.foes[i].p));
      finite(after);
    }
  });
  it('flying into one fast knocks it out, even when a frame carries him right past it', () => {
    // 260 m/s at 20 frames a second: 13 m a frame, never within reach of it on a frame
    const f = startInvasion(newFight());
    const e = { ...f.foes[0], state: 'fight', p: [0, 100, -3], v: [0, 0, 0], cool: 99 };
    const one = { ...f, foes: [e, ...f.foes.slice(1).map((q) => ({ ...q, state: 'down' }))], spawned: FIGHT.count };
    const { ev } = stepFight(one, hero([0, 99, -9.5], [0, 0, -260]), idle, 0.05);
    expect(ev.some((x) => x.type === 'ko' && x.rammed)).toBe(true);
  });
});
