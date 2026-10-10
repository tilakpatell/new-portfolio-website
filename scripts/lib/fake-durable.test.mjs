import { describe, expect, it } from 'vitest';
import { durableStore } from './fake-durable.mjs';

const row = (extra = {}) => ({ planet_id: 'hoth', entity_type: 'turret', x: 10, y: 0, z: 10, hp: 100, metadata: {}, ...extra });
const box = (since = null) => ({ planet_id: 'hoth', min_x: 0, max_x: 2048, min_z: 0, max_z: 2048, since });

describe('the fake durable store', () => {
  it('keeps what one visitor puts down, for another to ask by envelope, oldest first', () => {
    const changes = [];
    const db = durableStore({ onChange: (c) => changes.push(c) });
    const a = db.insert('alice', row()).data;
    expect(a).toMatchObject({ owner: 'alice', version: 1, terrain_version: 1 });
    db.insert('alice', row({ x: 3000 }));
    expect(db.rpc('bob', 'get_entities_in_bounding_box', box()).data.map((r) => r.id)).toEqual([a.id]);
    expect(db.rpc('bob', 'get_entities_in_bounding_box', box(a.updated_at)).data).toEqual([]);
    expect(changes.map((c) => c.eventType)).toEqual(['INSERT', 'INSERT']);
  });

  it('lets only the owner remove, answering the ids removed', () => {
    const db = durableStore();
    const a = db.insert('alice', row()).data;
    expect(db.remove('bob', a.id).data).toEqual([]);
    expect(db.remove('alice', a.id).data).toEqual([{ id: a.id }]);
  });

  it('wears hp down by at most 30 a hit, and at nothing the row is gone for everyone', () => {
    const changes = [];
    const db = durableStore({ onChange: (c) => changes.push(c) });
    const a = db.insert('alice', row({ hp: 40 })).data;
    expect(db.rpc('bob', 'damage_entity', { entity_id: a.id, amount: 99 }).data).toBe(10);
    expect(db.rpc('bob', 'damage_entity', { entity_id: a.id, amount: 20 }).data).toBe(0);
    expect(db.rpc('bob', 'get_entities_in_bounding_box', box()).data).toEqual([]);
    expect(changes.map((c) => c.eventType)).toEqual(['INSERT', 'UPDATE', 'DELETE']);
    expect(changes.at(-1).old).toEqual({ id: a.id });
  });

  it('refuses a build inside Echo Base', () => {
    const db = durableStore();
    expect(db.insert('alice', row({ x: 1200, z: -800 })).error.message).toMatch(/point of interest/);
  });
});
