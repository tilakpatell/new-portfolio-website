import { describe, expect, it } from 'vitest';
import { STALE_MS, createEntityLoader } from './entityLoader';
import { bboxOf } from './entities';
import { fakeClient, settle } from './fixtures/fakeClient';

// a row as the table sends it
let n = 0;
const row = (x, z, extra = {}) => ({
  id: `e${++n}`, planet_id: 'hoth', entity_type: 'turret', owner: 'o', x, y: 0, z,
  rot_x: 0, rot_y: 0, rot_z: 0, scale: 1, hp: 100, metadata: {}, version: 1, updated_at: `t${n}`, ...extra,
});
const cellOfCall = (call) => `${call.args.min_x / 2048},${call.args.min_z / 2048}`;

function setup(opts = {}) {
  const client = 'client' in opts ? opts.client : fakeClient();
  const clock = { t: 0 };
  const loader = createEntityLoader({ client, planetId: 'hoth', now: () => clock.t, ...opts });
  const events = [];
  loader.on((e) => events.push(e));
  return { client, clock, loader, events };
}
const rpcs = (client) => client.calls.filter((c) => c.name === 'get_entities_in_bounding_box');

describe('the entity loader', () => {
  it('asks for the ship’s own cell first, one envelope a cell, four at once', () => {
    const { client, loader } = setup();
    loader.update(100, 100);
    expect(client.pending).toHaveLength(4);
    const [first] = client.pending;
    const { minX, maxX, minZ, maxZ } = bboxOf(0, 0);
    expect(first.args).toEqual({ planet_id: 'hoth', min_x: minX, max_x: maxX, min_z: minZ, max_z: maxZ, since: null });
    expect(STALE_MS).toBe(20000);
  });

  it('adds each row once, and asks the next cells on the next update', async () => {
    const { client, loader, events } = setup();
    loader.update(0, 0);
    const a = row(10, 10);
    const b = row(20, 20);
    await client.answer(0, { data: [a, b], error: null });
    await client.answerAll();
    expect(events.map((e) => [e.type, e.entity.id])).toEqual([['add', a.id], ['add', b.id]]);
    loader.update(0, 0);
    expect(client.pending).toHaveLength(4);
    const asked = rpcs(client).map(cellOfCall);
    expect(new Set(asked).size).toBe(8); // no cell asked twice
    await client.answerAll();
    loader.update(0, 0);
    expect(new Set(rpcs(client).map(cellOfCall)).size).toBe(9);
    expect(loader.all().map((e) => e.id)).toEqual([a.id, b.id]);
    expect(loader.get(a.id).x).toBe(10);
  });

  it('asks a held cell again after STALE_MS, for what changed since its newest row', async () => {
    const { client, clock, loader } = setup();
    loader.update(0, 0);
    const last = row(5, 5);
    await client.answer(0, { data: [row(1, 1), last], error: null });
    await client.answerAll();
    loader.update(0, 0);
    await client.answerAll();
    loader.update(0, 0);
    await client.answerAll();
    const before = rpcs(client).length;
    clock.t = STALE_MS - 1;
    loader.update(0, 0);
    expect(rpcs(client).length).toBe(before);
    clock.t = STALE_MS + 1;
    loader.update(0, 0);
    expect(client.pending[0].args).toMatchObject({ min_x: 0, min_z: 0, since: last.updated_at });
  });

  it('asks a full page again on the next update, not after STALE_MS', async () => {
    const { client, loader } = setup({ radius: 0 });
    loader.update(0, 0);
    const page = Array.from({ length: 2000 }, (_, i) => row(i % 2000, 1));
    await client.answer(0, { data: page, error: null });
    loader.update(0, 0);
    expect(client.pending[0].args.since).toBe(page[1999].updated_at);
  });

  it('lets go of the cells left behind and asks for the new ones afresh', async () => {
    const { client, loader, events } = setup({ radius: 0 });
    loader.update(0, 0);
    const a = row(100, 100);
    await client.answer(0, { data: [a], error: null });
    loader.update(2 * 2048 + 1, 0);
    expect(events.at(-1)).toEqual({ type: 'remove', id: a.id });
    expect(cellOfCall(client.pending[0])).toBe('2,0');
    await client.answerAll();
    loader.update(0, 0); // back: asked from nothing, not from a remembered map
    expect(client.pending[0].args).toMatchObject({ min_x: 0, min_z: 0, since: null });
    await client.answer(0, { data: [a], error: null });
    expect(events.at(-1)).toMatchObject({ type: 'add', entity: { id: a.id } });
  });

  it('drops an answer for a cell left while it was asked', async () => {
    const { client, loader, events } = setup({ radius: 0 });
    loader.update(0, 0);
    loader.update(5 * 2048, 0);
    await client.answer(0, { data: [row(1, 1)], error: null });
    expect(events).toEqual([]);
  });

  it('on a failed ask, says so once and asks again on the next update', async () => {
    const { client, loader, events } = setup({ radius: 0 });
    loader.update(0, 0);
    await client.answer(0, { data: null, error: { message: 'offline' } });
    expect(events).toEqual([{ type: 'error', where: 'fetch', error: { message: 'offline' } }]);
    loader.update(0, 0);
    expect(client.pending).toHaveLength(1);
    await client.answer(0, new Error('network down')); // a rejected call frees its slot too
    expect(events.filter((e) => e.type === 'error')).toHaveLength(2);
    loader.update(0, 0);
    expect(client.pending).toHaveLength(1);
  });

  it('folds realtime changes into the cells it holds and ignores the rest', async () => {
    const { client, loader, events } = setup({ radius: 0 });
    loader.update(0, 0);
    await client.answerAll();
    expect(client.channels[0].filter).toMatchObject({ type: 'postgres_changes', table: 'world_entities', filter: 'planet_id=eq.hoth' });
    const a = row(50, 50);
    client.realtime({ eventType: 'INSERT', new: a });
    expect(events.at(-1)).toMatchObject({ type: 'add', entity: { id: a.id } });
    client.realtime({ eventType: 'UPDATE', new: { ...a, hp: 40, version: 2 } });
    expect(events.at(-1)).toMatchObject({ type: 'change', entity: { id: a.id, hp: 40 } });
    client.realtime({ eventType: 'UPDATE', new: { ...a, hp: 90, version: 1 } }); // older than held: ignored
    expect(loader.get(a.id).hp).toBe(40);
    const count = events.length;
    client.realtime({ eventType: 'UPDATE', new: row(9000, 9000) }); // a cell not held
    client.realtime({ eventType: 'INSERT', new: row(-10, 0) });
    expect(events.length).toBe(count);
    client.realtime({ eventType: 'DELETE', old: { id: a.id } });
    expect(events.at(-1)).toEqual({ type: 'remove', id: a.id });
    expect(loader.get(a.id)).toBeNull();
  });

  it('moves an entity between cells without drawing it twice', async () => {
    const { client, loader, events } = setup({ radius: 1 });
    loader.update(0, 0);
    await client.answerAll();
    loader.update(0, 0);
    await client.answerAll();
    loader.update(0, 0);
    await client.answerAll();
    const a = row(10, 10);
    client.realtime({ eventType: 'INSERT', new: a });
    client.realtime({ eventType: 'UPDATE', new: { ...a, x: 2100, version: 2 } }); // into the held cell 1,0
    expect(loader.all().filter((e) => e.id === a.id)).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: 'change', entity: { id: a.id, x: 2100 } });
    client.realtime({ eventType: 'UPDATE', new: { ...a, x: 99999, version: 3 } }); // out of every held cell
    expect(events.at(-1)).toEqual({ type: 'remove', id: a.id });
    expect(loader.get(a.id)).toBeNull();
  });

  it('refetches a held cell when told, from its newest row', async () => {
    const { client, loader } = setup({ radius: 0 });
    loader.update(0, 0);
    const a = row(1, 1);
    await client.answer(0, { data: [a], error: null });
    loader.refetch('0,0');
    expect(client.pending[0].args.since).toBe(a.updated_at);
    loader.refetch('7,7'); // not held: nothing to refresh
    expect(client.pending).toHaveLength(1);
  });

  it('places through the table and draws the row the database kept', async () => {
    const { client, loader, events } = setup({ radius: 0 });
    loader.update(0, 0);
    await client.answerAll();
    const placed = await loader.place({ type: 'turret', x: 30, y: 2, z: 40, rot: [0, 1, 0] });
    const insert = client.calls.find((c) => c.name === 'world_entities.insert');
    expect(insert.args).toEqual({ planet_id: 'hoth', entity_type: 'turret', x: 30, y: 2, z: 40, rot_x: 0, rot_y: 1, rot_z: 0 });
    expect(placed).toMatchObject({ id: 'new-1', owner: 'me', planetId: 'hoth', x: 30 });
    expect(events.at(-1)).toMatchObject({ type: 'add', entity: { id: 'new-1' } });
  });

  it('draws nothing when the database refuses a place', async () => {
    const { client, loader, events } = setup({ radius: 0 });
    loader.update(0, 0);
    await client.answerAll();
    const refused = { message: 'inside a point of interest', code: '23514' };
    client.insert = () => ({ data: null, error: refused });
    expect(await loader.place({ type: 'turret', x: 1200, y: 0, z: -800 })).toBeNull();
    expect(events).toEqual([{ type: 'error', where: 'place', error: refused }]);
    expect(loader.all()).toEqual([]);
  });

  it('removes its own, and says so when the row was not removable', async () => {
    const { client, loader, events } = setup({ radius: 0 });
    loader.update(0, 0);
    const a = row(1, 1);
    const b = row(2, 2);
    await client.answer(0, { data: [a, b], error: null });
    expect(await loader.remove(a.id)).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'remove', id: a.id });
    client.remove = () => ({ data: [], error: null }); // RLS: someone else's row deletes nothing
    expect(await loader.remove(b.id)).toBe(false);
    expect(events.at(-1)).toMatchObject({ type: 'error', where: 'remove' });
    expect(loader.get(b.id)).not.toBeNull();
  });

  it('removes what damage brings to nothing, and keeps what it does not', async () => {
    const { client, loader, events } = setup({ radius: 0 });
    loader.update(0, 0);
    const a = row(1, 1);
    const b = row(2, 2);
    await client.answer(0, { data: [a, b], error: null });
    const hit = loader.damage(a.id, 30);
    expect(client.pending[0].args).toEqual({ entity_id: a.id, amount: 30 });
    await client.answer(0, { data: 0, error: null });
    expect(await hit).toBe(0);
    expect(events.at(-1)).toEqual({ type: 'remove', id: a.id });
    const graze = loader.damage(b.id, 5);
    await client.answer(0, { data: 95, error: null });
    expect(await graze).toBe(95);
    expect(loader.get(b.id)).not.toBeNull();
    const refused = loader.damage(b.id, 5);
    await client.answer(0, { data: null, error: { message: 'too many hits' } });
    expect(await refused).toBeNull();
    expect(events.at(-1)).toMatchObject({ type: 'error', where: 'damage' });
  });

  it('without a client, answers everything with nothing and says nothing', async () => {
    const { loader, events } = setup({ client: null });
    loader.update(0, 0);
    loader.refetch('0,0');
    expect(await loader.place({ type: 'turret', x: 0, y: 0, z: 0 })).toBeNull();
    expect(await loader.remove('x')).toBe(false);
    expect(await loader.damage('x', 5)).toBeNull();
    expect(loader.get('x')).toBeNull();
    expect(loader.all()).toEqual([]);
    loader.dispose();
    await settle();
    expect(events).toEqual([]);
  });

  it('without realtime, opens no channel', () => {
    const { client, loader } = setup({ realtime: false });
    loader.update(0, 0);
    expect(client.channels).toEqual([]);
  });

  it('on dispose, leaves the channel and hears no late answer', async () => {
    const { client, loader, events } = setup({ radius: 0 });
    loader.update(0, 0);
    expect(client.channels).toHaveLength(1);
    loader.update(0, 0);
    expect(client.channels).toHaveLength(1); // one channel a loader
    loader.dispose();
    expect(client.channels[0].unsubscribed).toBe(true);
    await client.answer(0, { data: [row(1, 1)], error: null });
    client.realtime({ eventType: 'INSERT', new: row(2, 2) });
    expect(events).toEqual([]);
    expect(loader.all()).toEqual([]);
  });
});
