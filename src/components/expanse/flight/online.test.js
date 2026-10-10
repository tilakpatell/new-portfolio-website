import { describe, expect, it } from 'vitest';
import { createFlightOnline, POSE_MS } from './online';
import { STALE_MS } from '../../universe/online/protocol';

// a room as nostr.js's joinRoom gives it, with what was said kept to look at
function fakeJoin() {
  const made = { rooms: [] };
  made.join = (opts, roomId) => {
    let resolveReady;
    const room = {
      opts,
      roomId,
      cell: null,
      asked: [],
      sent: [],
      actions: {},
      ready: new Promise((r) => (resolveReady = r)),
      open: () => resolveReady(),
      onPeerLeave: null,
      onStatus: null,
      makeAction(ns) {
        const a = { onMessage: null, send: (data, o) => room.sent.push([ns, data, o?.target ?? null]) };
        room.actions[ns] = a;
        return a;
      },
      setCell(tag) {
        room.cell = tag;
      },
      setCells(tags) {
        room.asked.push([...tags]);
      },
      left: false,
      leave() {
        room.left = true;
      },
      // a word in from a pilot, as the room hands it on
      hear(ns, data, peerId, tag) {
        room.actions[ns]?.onMessage?.(data, { peerId, tag });
      },
    };
    made.rooms.push(room);
    return room;
  };
  return made;
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const ship = (x, z, extra = {}) => ({ x, y: 300, z, pitch: 0, yaw: 0, roll: 0, speed: 200, ...extra });

async function online({ t = { now: 0 }, ...opts } = {}) {
  const fake = fakeJoin();
  const link = createFlightOnline({ planetId: 'hoth', name: 'Alpha', load: () => Promise.resolve(fake.join), now: () => t.now, ...opts });
  await flush();
  const room = fake.rooms[0];
  room.open();
  await flush();
  return { link, room, t };
}

describe('the flight’s room, heard by cell', () => {
  it('joins the planet’s room with cells, and says who you are once it’s open', async () => {
    const { link, room } = await online();
    expect(room.roomId).toBe('fly-v1:hoth');
    expect(typeof room.opts.cells).toBe('function');
    expect(link.status).toBe('online');
    expect(room.sent.find(([ns]) => ns === 'hi')?.[1]).toEqual({ n: 'Alpha', k: 'wedge' });
  });

  it('tags its own cell and listens for the 3 × 3 round it, asked again on a cell change only', async () => {
    const { link, room, t } = await online();
    link.update(ship(10, 10));
    expect(room.cell).toBe('hoth/0,0');
    expect(room.asked.at(-1)).toHaveLength(9);
    expect(room.asked.at(-1)[0]).toBe('hoth/0,0');
    expect(room.asked.at(-1)).toContain('hoth/-1,-1');
    const asks = room.asked.length;
    t.now += 1000;
    link.update(ship(500, 10));
    expect(room.asked).toHaveLength(asks);
    t.now += 1000;
    link.update(ship(2100, 0));
    expect(room.cell).toBe('hoth/1,0');
    expect(room.asked).toHaveLength(asks + 1);
    expect(room.asked.at(-1)[0]).toBe('hoth/1,0');
    expect(room.asked.at(-1)).toContain('hoth/2,1');
  });

  it('sends a pose POSE_MS apart at most', async () => {
    const { link, room, t } = await online();
    const poses = () => room.sent.filter(([ns]) => ns === 'pose').length;
    for (let i = 0; i < 20; i++) {
      link.update(ship(i, 0));
      t.now += POSE_MS / 4;
    }
    // 20 frames over five poses’ time: five poses, the first at once
    expect(poses()).toBe(5);
  });

  it('gives a peer’s pose back, eased, and drops a peer gone quiet', async () => {
    const { link, room, t } = await online();
    room.hear('hi', { n: 'Bravo', k: 'wedge' }, 'b', 'hoth/0,0');
    room.hear('pose', [100, 300, 100, 0, 1, 0, 200, 0], 'b', 'hoth/0,0');
    t.now += 100;
    room.hear('pose', [120, 300, 100, 0, 1, 0, 200, 0], 'b', 'hoth/0,0');
    t.now += 140;
    const [p] = link.peers();
    expect(p).toMatchObject({ id: 'b', name: 'Bravo' });
    expect(p.pose.x).toBeGreaterThanOrEqual(100);
    expect(p.pose.x).toBeLessThanOrEqual(120);
    expect(p.pose.yaw).toBeCloseTo(1);
    t.now += STALE_MS + 1;
    expect(link.peers()).toEqual([]);
  });

  it('believes no pose whose tag lies about its cell, and no one blocked', async () => {
    const { link, room } = await online({ hidden: (id) => id === 'x' });
    room.hear('pose', [100, 300, 100, 0, 0, 0, 200, 0], 'a', 'hoth/5,5');
    room.hear('pose', [100, 300, 100, 0, 0, 0, 200, 0], 'x', 'hoth/0,0');
    room.hear('pose', [100, 300, 100, 0, 0, 0, 200, 0], 'c', 'endor/0,0');
    expect(link.peers()).toEqual([]);
  });

  it('passes on shots, and built and gone hints, and sends its own', async () => {
    const { link, room } = await online();
    const heard = [];
    link.on((e) => heard.push(e));
    room.hear('pose', [100, 300, 100, 0, 0, 0, 200, 0], 'b', 'hoth/0,0');
    room.hear('shot', [100, 300, 99, 0, 0, -900], 'b', 'hoth/0,0');
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    room.hear('built', { id, cell: 'hoth/0,0' }, 'b', 'hoth/0,0');
    room.hear('gone', { id }, 'b', 'hoth/0,0');
    room.hear('built', { id: 'nope', cell: 'hoth/0,0' }, 'b', 'hoth/0,0');
    expect(heard.map((e) => e.type)).toEqual(['shot', 'built', 'gone']);
    expect(heard[1]).toMatchObject({ id, cell: 'hoth/0,0', key: '0,0' });
    link.shot({ x: 1, y: 2, z: 3 }, [0, 0, -900]);
    link.built(id, 'hoth/0,0');
    link.gone(id);
    expect(room.sent.filter(([ns]) => ['shot', 'built', 'gone'].includes(ns)).map(([ns]) => ns)).toEqual(['shot', 'built', 'gone']);
  });

  it('leaves the room, and a room that loads after leaving is left at once', async () => {
    const { link, room } = await online();
    link.leave();
    expect(room.left).toBe(true);
    expect(link.status).toBe('off');
    const fake = fakeJoin();
    const late = createFlightOnline({ planetId: 'hoth', name: 'A', load: () => Promise.resolve(fake.join) });
    late.leave();
    await flush();
    expect(fake.rooms).toHaveLength(0);
  });
});
