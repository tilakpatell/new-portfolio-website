import { describe, expect, it } from 'vitest';
import { QUIET_MS, createTravellers, readStep, writeStep } from './travellers';

// a room in memory: what one sends, the rest get
function fakeRelay() {
  const members = new Set();
  let n = 0;
  const joinRoom = () => {
    const id = `t${++n}`;
    const acts = {};
    const m = {
      selfId: id,
      ready: Promise.resolve(),
      makeAction(ns) {
        const a = { onMessage: null, send: (data) => members.forEach((o) => o !== m && o.deliver(ns, JSON.parse(JSON.stringify(data)), id)) };
        acts[ns] = a;
        return a;
      },
      deliver: (ns, data, from) => acts[ns]?.onMessage?.(data, { peerId: from }),
      leave() {
        members.delete(m);
        members.forEach((o) => o.onPeerLeave?.(id));
      },
    };
    members.add(m);
    return m;
  };
  return () => Promise.resolve(joinRoom);
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('steps', () => {
  it('go and come back, kept in bounds', () => {
    expect(readStep(writeStep({ x: 3.456, z: -2, face: 1, speed: 3 }, { ring: true }))).toEqual({ x: 3.46, z: -2, face: 1, moving: true, inside: false, ring: true });
    expect(readStep([1e9, 0, 0], 50).x).toBe(50);
    expect(readStep(['a', 0, 0])).toBe(null);
  });
});

describe('travellers', () => {
  it('in a bigger town, are seen out as far as it goes (Albuquerque’s, out to its fence)', async () => {
    const load = fakeRelay();
    const now = () => 1000;
    const a = createTravellers({ town: 'abq', name: 'Heisenberg', load, now, bound: 440 });
    const b = createTravellers({ town: 'abq', name: 'Cap’n Cook', load, now, bound: 440 });
    await settle();
    await settle();
    a.pose({ x: 405.5, z: -390, face: -3, speed: 20 });
    expect(b.list()[0]).toMatchObject({ name: 'Heisenberg', x: 405.5, z: -390, moving: true });
  });

  it('see each other, by name, and lose those who go quiet or leave', async () => {
    const load = fakeRelay();
    let t = 1000;
    const now = () => t;
    const a = createTravellers({ town: 'bree', name: 'Rosie', load, now });
    const b = createTravellers({ town: 'bree', name: 'Fatty', load, now });
    await settle();
    await settle();
    a.pose({ x: 1, z: 2, face: 0, speed: 3 });
    b.pose({ x: -4, z: 5, face: 1, speed: 0 }, { inside: true });
    expect(b.list().map((p) => [p.name, p.x, p.z, p.moving])).toEqual([['Rosie', 1, 2, true]]);
    expect(a.list()[0]).toMatchObject({ name: 'Fatty', inside: true });
    // walking: a new pose a fifth of a second later
    t += 100;
    a.pose({ x: 1.5, z: 2, face: 0, speed: 3 });
    expect(b.list()[0].x).toBe(1);
    t += 150;
    a.pose({ x: 1.5, z: 2, face: 0, speed: 3 });
    expect(b.list()[0].x).toBe(1.5);
    // quiet: gone
    t += QUIET_MS + 10;
    expect(b.list()).toEqual([]);
    a.pose({ x: 2, z: 2, face: 0, speed: 0 });
    expect(b.list()).toHaveLength(1);
    a.leave();
    expect(b.list()).toEqual([]);
    b.leave();
  });
});
