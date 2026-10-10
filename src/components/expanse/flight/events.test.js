import { describe, expect, it } from 'vitest';
import { createOccurrences } from './events';
import { createFlightDirector, EVENT_FIRST } from '../../../lib/land/flight/director';
import { planetSpecOf } from './planets';
import { eventNow } from './eventNews';

const T0 = 1_790_000_000_000;
const flat = { heightAt: () => 10, biomeAt: () => 0 };
const ship = (x, z, y = 60) => ({ x, y, z, pitch: 0, yaw: 0, roll: 0, speed: 200 });

// a scene that only writes down what it was asked to draw
function fakeDraw() {
  const d = { placed: [], fired: [], begun: [], ended: [], steps: 0, cleared: 0 };
  return Object.assign(d, {
    occurrences: (list) => (d.placed = list),
    fire: (h) => d.fired.push(h),
    begin: (ev) => d.begun.push(ev.id),
    end: (ev) => d.ended.push(ev.id),
    step: () => d.steps++,
    clear: () => d.cleared++,
  });
}

// a room two layers share: what one says, the other hears
function fakeRoom() {
  const members = [];
  return {
    join() {
      const me = {
        ears: new Set(),
        sent: [],
        event(ev) {
          me.sent.push(ev);
          for (const m of members) if (m !== me) for (const fn of m.ears) fn({ type: 'event', event: structuredClone(ev) });
        },
        on(fn) {
          me.ears.add(fn);
          return () => me.ears.delete(fn);
        },
        hello() {
          for (const m of members) if (m !== me) for (const fn of m.ears) fn({ type: 'joined', id: 'new' });
        },
      };
      members.push(me);
      return me;
    },
  };
}

function rig(id = 'tatooine', more = {}) {
  const spec = planetSpecOf(id);
  const clock = { t: T0 };
  const draw = fakeDraw();
  const said = [];
  const layer = createOccurrences({ spec, field: flat, draw, director: createFlightDirector({ spec, now: () => clock.t }), say: (s) => said.push(s), ...more });
  const fly = (secs, s = ship(1024, 1024)) => {
    for (let i = 0; i < secs; i++) {
      clock.t += 1000;
      layer.step(s, [0, 0, 0], 1);
    }
  };
  return { spec, clock, draw, said, layer, fly };
}

describe('occurrences round the ship', () => {
  it('places the cells round the ship, the same each visit, and lets go behind', () => {
    const a = rig();
    a.fly(1);
    const b = rig();
    b.fly(1);
    expect(a.draw.placed.length).toBeGreaterThan(0);
    expect(a.draw.placed).toEqual(b.draw.placed);
    expect(a.layer.stats().cells).toBe(9);
    a.fly(1, ship(40000, 40000));
    expect(a.layer.stats().cells).toBe(9);
    expect(a.draw.placed.some((o) => Math.abs(o.at[0] - 1024) < 4096 && Math.abs(o.at[2] - 1024) < 4096)).toBe(false);
  });

  it('runs a camp’s rule: it fires on a ship near and low', () => {
    const { layer, draw, said, fly } = rig();
    fly(1);
    const camp = layer.placed().find((o) => o.rule === 'hostile');
    expect(camp).toBeTruthy();
    fly(3, ship(camp.at[0] + 100, camp.at[2], camp.at[1] + 50));
    expect(draw.fired.length).toBeGreaterThan(0);
    expect(said.some((s) => /incoming fire/.test(s))).toBe(true);
  });

  it('starts an event, says it, and tells the room it is on', () => {
    const room = fakeRoom();
    const { layer, draw, said, fly } = rig('hoth');
    const me = layer.link(room.join());
    fly(1);
    const ev = layer.force('blizzard');
    expect(draw.begun).toEqual([ev.id]);
    expect(said.at(-1)).toMatch(/blizzard/);
    expect(eventNow()?.line).toBe(ev.line);
    expect(me.sent.map((e) => e.id)).toEqual([ev.id]);
    // (it ends on its own time, and the HUD's line with it)
    fly(ev.ttl + 1);
    expect(draw.ended).toContain(ev.id);
    expect(layer.active()).toBe(null);
  });

  it('two pilots who rolled differently end with the earlier, both of them', () => {
    const room = fakeRoom();
    const a = rig('hoth');
    const b = rig('hoth');
    a.layer.link(room.join());
    a.fly(EVENT_FIRST);
    b.fly(EVENT_FIRST);
    // (each rolls before hearing the other: b's is later)
    const ea = a.layer.force('blizzard');
    b.layer.link(room.join());
    b.clock.t += 3000;
    b.layer.force('hunt');
    expect(a.layer.active().id).toBe(ea.id);
    expect(b.layer.active().id).toBe(ea.id);
    expect(b.draw.ended).toHaveLength(1);
    a.fly(5);
    b.fly(5);
    expect(a.layer.active().id).toBe(b.layer.active().id);
  });

  it('tells a pilot new to the room what is on', () => {
    const room = fakeRoom();
    const a = rig('hoth');
    const me = a.layer.link(room.join());
    a.fly(1);
    a.layer.force('blizzard');
    const late = room.join();
    late.hello();
    expect(me.sent).toHaveLength(2);
    expect(me.sent[1].t).toBeGreaterThanOrEqual(0);
  });

  it('leaving clears everything: the event, the drawing, the room, the line', () => {
    const room = fakeRoom();
    const { layer, draw, fly } = rig('hoth');
    const me = layer.link(room.join());
    fly(1);
    const ev = layer.force('blizzard');
    layer.dispose();
    expect(draw.ended).toContain(ev.id);
    expect(draw.cleared).toBe(1);
    expect(me.ears.size).toBe(0);
    expect(eventNow()).toBe(null);
    expect(layer.markers()).toEqual([]);
    // (and nothing more is done after)
    const steps = draw.steps;
    fly(5);
    expect(draw.steps).toBe(steps);
  });

  it('a dead world places nothing and has only its weather', () => {
    const { layer, draw, fly } = rig('e:1,0:0:0');
    fly(1);
    expect(draw.placed).toEqual([]);
    expect(layer.force('raid')).toBe(null);
    expect(layer.force('storm')).toBeTruthy();
  });

  it('marks the map with what is placed and what is on', () => {
    const { layer, fly } = rig('hoth');
    fly(1);
    layer.force('blizzard');
    const m = layer.markers();
    expect(m.length).toBe(layer.placed().length + 1);
    for (const k of m) expect(k.at).toHaveLength(2);
    expect(m.at(-1).name).toMatch(/blizzard/);
  });
});
