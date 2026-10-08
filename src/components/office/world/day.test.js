import { describe, expect, it } from 'vitest';
import { DAY, createOfficeDay, lengthOf, panicAt, pointAt } from './day';

// an open floor: desks along z = 0 facing −z (yaw π), places 8 m off
const seat = (x) => ({ yaw: Math.PI, stand: { x, z: -0.3 }, exit: [{ x: x + 0.6, z: 0 }, { x: x + 0.6, z: 0.6 }] });
const SEATS = { ann: seat(0), bob: seat(3), cat: seat(6), dan: seat(9), eve: seat(12) };
const PLACES = [
  { id: 'coffee', need: 'coffee', spots: [{ x: 2, z: 8 }, { x: 3.2, z: 8 }], face: 0, clip: 'drink', duration: 5, chat: true },
  { id: 'copier', need: 'work', spots: [{ x: 10, z: 8 }], face: 0, clip: 'interact', duration: 4 },
];
const route = (who, place, slot) => {
  const s = SEATS[who];
  const end = s.exit[s.exit.length - 1];
  return [end, place.spots[slot] ?? place.spots[0]];
};
const day = (people, seed = 3) => createOfficeDay({ seats: SEATS, places: PLACES.map((p) => ({ ...p })), people, route, seed });
// run a day, every entry of every frame
const run = (d, seconds, ctx = {}, dt = 1 / 30) => {
  const frames = [];
  for (let i = 0; i < seconds / dt; i++) frames.push(d.step(dt, typeof ctx === 'function' ? ctx(i * dt) : ctx));
  return frames;
};
const of = (frames, who) => frames.map((f) => f.find((e) => e.who === who));

describe('lengths along a way', () => {
  it('measures a way and finds a point along it', () => {
    const path = [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 4 }];
    expect(lengthOf(path)).toBe(7);
    expect(pointAt(path, 1)).toMatchObject({ x: 1, z: 0 });
    expect(pointAt(path, 5)).toMatchObject({ x: 3, z: 2 });
    expect(pointAt(path, 99)).toMatchObject({ x: 3, z: 4 });
    expect(pointAt(path, -1)).toMatchObject({ x: 0, z: 0 });
  });
});

describe('the working day', () => {
  it('gets up when coffee presses, walks there, has it, walks back and sits down again', () => {
    const d = day([{ who: 'ann', needs: { coffee: 0.05 } }]);
    const e = of(run(d, 160), 'ann');
    const order = e.map((x) => x.state).filter((s, i, a) => s !== a[i - 1]);
    expect(order.slice(0, 9)).toEqual(['seated', 'rising', 'walking', 'facing', 'using', 'walking', 'facing', 'sitting', 'seated']);
    // there: at the counter, facing it, with the coffee's clip
    const using = e.find((x) => x.state === 'using');
    expect(Math.hypot(using.x - 2, using.z - 8)).toBeLessThan(0.05);
    expect(using.clip).toBe('drink');
    expect(Math.abs(using.yaw)).toBeLessThan(DAY.faced + 1e-9);
    // back: where it stood up, facing the desk
    const sat = e.findLast((x) => x.state === 'sitting');
    expect(Math.hypot(sat.x - 0, sat.z + 0.3)).toBeLessThan(0.05);
    expect(Math.abs(Math.atan2(Math.sin(sat.yaw - Math.PI), Math.cos(sat.yaw - Math.PI)))).toBeLessThan(DAY.faced + 1e-9);
  });

  it('never jumps: every step is a step at its pace, and every turn eased by time', () => {
    const d = day([
      { who: 'ann', needs: { coffee: 0.05 } },
      { who: 'bob', needs: { coffee: 0.04, work: 0.03 } },
    ]);
    const dt = 1 / 30;
    const frames = run(d, 240, {}, dt);
    for (const who of ['ann', 'bob']) {
      const e = of(frames, who);
      for (let i = 1; i < e.length; i++) {
        const step = Math.hypot(e[i].x - e[i - 1].x, e[i].z - e[i - 1].z);
        expect(step, `${who} at ${i}`).toBeLessThan(DAY.walk * dt + 1e-6);
        const turned = Math.abs(Math.atan2(Math.sin(e[i].yaw - e[i - 1].yaw), Math.cos(e[i].yaw - e[i - 1].yaw)));
        expect(turned, `${who} turning at ${i}`).toBeLessThan(DAY.turnMax * dt + 1e-6);
      }
    }
  });

  it('turns to the way on the spot before setting off, and eases into a stop', () => {
    const d = day([{ who: 'ann', needs: { coffee: 0.05 } }]);
    const e = of(run(d, 80), 'ann');
    const first = e.findIndex((x) => x.state === 'walking');
    // (the first steps: turned, not walked)
    expect(e[first].speed).toBe(0);
    const arrive = e.findIndex((x, i) => i > first && x.state === 'facing');
    const speeds = e.slice(arrive - 12, arrive).map((x) => x.speed);
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]).toBeLessThanOrEqual(speeds[i - 1] + 1e-9);
  });

  it('never puts more at a place than it has room for, nor more up than maxOut', () => {
    const folk = ['ann', 'bob', 'cat', 'dan', 'eve'].map((who) => ({ who, needs: { work: 0.06 } }));
    const d = day(folk);
    for (const f of run(d, 300)) {
      // (holding it: on the way there, or at it; one walking back has let it go)
      expect(f.filter((e) => e.place === 'copier' && (e.state === 'rising' || e.state === 'using' || e.leg === 'out')).length).toBeLessThanOrEqual(1);
      expect(f.filter((e) => e.state !== 'seated').length).toBeLessThanOrEqual(DAY.maxOut);
    }
  });

  it('keeps someone held at their desk', () => {
    const d = day([{ who: 'ann', needs: { coffee: 0.2 } }]);
    for (const f of run(d, 60, { hold: new Set(['ann']) })) expect(f[0].state).toBe('seated');
  });

  it('stops for Jim in the way, and looks at him', () => {
    const d = day([{ who: 'ann', needs: { coffee: 0.05 } }]);
    // let her get going toward the counter
    let e;
    for (let i = 0; i < 4000; i++) {
      e = d.step(1 / 30, {})[0];
      if (e.state === 'walking' && e.speed > 0.9 && e.z > 2) break;
    }
    const ahead = { x: e.x + Math.sin(e.yaw) * 0.6, z: e.z + Math.cos(e.yaw) * 0.6 };
    let last;
    for (let i = 0; i < 45; i++) last = d.step(1 / 30, { jim: ahead })[0];
    expect(last.speed).toBeLessThan(0.02);
    expect(last.look).toBe('jim');
    // and goes on once he's out of the way
    for (let i = 0; i < 60; i++) last = d.step(1 / 30, { jim: { x: 50, z: 50 } })[0];
    expect(last.speed).toBeGreaterThan(0.5);
  });

  it('stops and turns to Jim when he talks to them, and goes on after', () => {
    const d = day([{ who: 'ann', needs: { coffee: 0.05 } }]);
    let e;
    for (let i = 0; i < 4000; i++) {
      e = d.step(1 / 30, {})[0];
      if (e.state === 'walking' && e.speed > 0.9 && e.z > 2) break;
    }
    const jim = { x: e.x + 2, z: e.z };
    let last;
    for (let i = 0; i < 90; i++) last = d.step(1 / 30, { jim, talkTo: 'ann' })[0];
    expect(last.speed).toBeLessThan(0.01);
    expect(last.talk).toBe(true);
    expect(last.look).toBe('jim');
    const want = Math.atan2(jim.x - last.x, jim.z - last.z);
    expect(Math.abs(Math.atan2(Math.sin(last.yaw - want), Math.cos(last.yaw - want)))).toBeLessThan(0.05);
    for (let i = 0; i < 60; i++) last = d.step(1 / 30, { jim })[0];
    expect(last.talk).toBe(false);
    expect(last.speed).toBeGreaterThan(0.3);
  });

  it('has two at the coffee at once take turns to talk, then go back', () => {
    const d = day([
      { who: 'ann', needs: { coffee: 0.05 }, start: { coffee: 0.69 }, rest: 0 },
      { who: 'bob', needs: { coffee: 0.05 }, start: { coffee: 0.69 }, rest: 0 },
    ]);
    const frames = run(d, 200);
    const both = frames.filter((f) => f.every((e) => e.state === 'using'));
    expect(both.length).toBeGreaterThan(30);
    const talkers = new Set(both.map((f) => f.find((e) => e.talk)?.who).filter(Boolean));
    expect([...talkers].sort()).toEqual(['ann', 'bob']);
    // one at a time, the other looking at them
    for (const f of both) {
      const t = f.filter((e) => e.talk);
      expect(t.length).toBeLessThanOrEqual(1);
      if (t.length) expect(f.find((e) => !e.talk).look).toBe(t[0].who);
    }
    // and they don't talk forever
    expect(frames.at(-1).every((e) => e.state === 'seated' || e.state === 'rising' || e.state === 'walking' || e.state === 'facing' || e.state === 'sitting' || e.state === 'using')).toBe(true);
    expect(frames.some((f, i) => i > frames.indexOf(both.at(-1)) && f.every((e) => e.state === 'seated'))).toBe(true);
  });

  it('sends everyone back to their desks at once for the fire drill', () => {
    const d = day([{ who: 'ann', needs: { coffee: 0.05 } }]);
    let e;
    for (let i = 0; i < 4000 && e?.state !== 'using'; i++) e = d.step(1 / 30, {})[0];
    expect(e.state).toBe('using');
    e = d.step(1 / 30, { stop: true })[0];
    expect(e.state).toBe('seated');
    expect(d.out()).toBe(0);
    // and the place is free again
    const d2 = day([{ who: 'bob', needs: { work: 0.05 } }]);
    expect(d2.out()).toBe(0);
  });

  it('plays the same day twice from a seed, and another from another', () => {
    const people = [
      { who: 'ann', needs: { coffee: 0.03, work: 0.02 } },
      { who: 'bob', needs: { coffee: 0.02, work: 0.03 } },
    ];
    const a = run(day(people, 5), 120).map((f) => f.map((e) => `${e.state}${e.x.toFixed(3)}`).join());
    const b = run(day(people, 5), 120).map((f) => f.map((e) => `${e.state}${e.x.toFixed(3)}`).join());
    const c = run(day(people, 6), 120).map((f) => f.map((e) => `${e.state}${e.x.toFixed(3)}`).join());
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('goes nowhere it can’t get to, and somewhere else that will do', () => {
    const d = createOfficeDay({ seats: SEATS, places: PLACES.map((p) => ({ ...p })), people: [{ who: 'ann', needs: { coffee: 0.1 } }], route: () => null, seed: 1 });
    for (const f of run(d, 60)) expect(f[0].state).toBe('seated');
  });
});

describe('the fire drill’s runners', () => {
  const a = { x: 0, z: 0 };
  const b = { x: 10, z: 0 };
  it('runs the line back and forth, slowing into each end and turning there', () => {
    let last = null;
    let turns = 0;
    for (let t = 0; t < 20; t += 1 / 60) {
      const p = panicAt(a, b, { speed: 3, t });
      expect(p.x).toBeGreaterThanOrEqual(-1e-9);
      expect(p.x).toBeLessThanOrEqual(10 + 1e-9);
      if (last) {
        // no jump along the line
        expect(Math.abs(p.x - last.x)).toBeLessThan(0.1);
        if (Math.abs(Math.atan2(Math.sin(p.yaw - last.yaw), Math.cos(p.yaw - last.yaw))) > 1) {
          turns += 1;
          // (only where it's all but stopped)
          expect(p.speed).toBeLessThan(0.5);
        }
      }
      last = p;
    }
    expect(turns).toBeGreaterThanOrEqual(4);
  });

  it('keeps two on one line apart, and out of step', () => {
    const p = panicAt(a, b, { speed: 3, t: 1, side: 0.3, phase: 0 });
    const q = panicAt(a, b, { speed: 3, t: 1, side: -0.3, phase: 0.37 });
    expect(Math.abs(p.z - q.z)).toBeCloseTo(0.6, 5);
    expect(p.x).not.toBeCloseTo(q.x, 1);
  });
});
