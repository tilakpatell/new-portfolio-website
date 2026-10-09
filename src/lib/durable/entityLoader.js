// The world's durable things round the ship, cell by cell: which cells the
// ship is in and about (entities.js's grid, CELL = 2048 m), asked for from
// Supabase as an envelope each (get_entities_in_bounding_box), remembered,
// refreshed with `since` after STALE_MS, and let go of past the radius; a
// change that arrives by realtime, or by a neighbour's `built` hint
// (refetch(cell)), is folded in the same way. Pure of three.js: the scene
// draws from on(fn)'s events. Without a client (supabase.js's null) it is
// a loader of nothing that still answers.
// Design: docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md (Pillar 2).
//
// createEntityLoader({ client, planetId, radius = 1, inFlight = 4, staleMs, now, realtime = true })
//   → { update(x, z), on(fn) → off, get(id), all(), place(entity) → Promise<entity | null>,
//       remove(id) → Promise<boolean>, damage(id, amount) → Promise<hp | null>, refetch(cellKey), dispose() }
// events: { type: 'add', entity }, { type: 'change', entity }, { type: 'remove', id }, { type: 'error', where, error }

import { bboxOf, cellOf, cellsAround, diffCells, entityToRow, rowToEntity } from './entities.js';

export const STALE_MS = 20000;
// the RPC's own limit: a page this full has more behind it
const PAGE = 2000;

export function createEntityLoader({ client, planetId, radius = 1, inFlight = 4, staleMs = STALE_MS, now = Date.now, realtime = true }) {
  const cells = new Map(); // key → { entities: Map<id, entity>, fetchedAt, since }
  const flying = new Set();
  const listeners = new Set();
  let wanted = [];
  let gen = 0;
  let channel = null;
  let disposed = false;
  const emit = (e) => listeners.forEach((fn) => fn(e));

  const find = (id) => {
    for (const [key, cell] of cells) if (cell.entities.has(id)) return [key, cell.entities.get(id)];
    return [null, null];
  };

  const fold = (row) => {
    const entity = rowToEntity(row);
    const key = cellOf(entity.x, entity.z).join(',');
    const [heldIn, had] = find(entity.id);
    // the trigger bumps version on every update, so a version no newer than
    // the one held is an echo (our own insert, then its realtime INSERT) or
    // a change that arrived out of order
    if (had && entity.version <= had.version) return;
    // moved across a cell line: held once, in the cell it is in now
    if (heldIn && heldIn !== key) cells.get(heldIn).entities.delete(entity.id);
    const cell = cells.get(key);
    if (!cell) {
      // not a cell we hold: nothing to draw it in (and gone from where it was)
      if (had) emit({ type: 'remove', id: entity.id });
      return;
    }
    cell.entities.set(entity.id, entity);
    emit({ type: had ? 'change' : 'add', entity });
  };
  const forget = (id) => {
    for (const cell of cells.values()) if (cell.entities.delete(id)) { emit({ type: 'remove', id }); return; }
  };

  async function fetchCell(key, since = null) {
    if (!client || flying.has(key) || flying.size >= inFlight) return;
    const myGen = gen;
    flying.add(key);
    const [cx, cz] = key.split(',').map(Number);
    const { minX, maxX, minZ, maxZ } = bboxOf(cx, cz);
    let answer;
    try {
      answer = await client.rpc('get_entities_in_bounding_box', { planet_id: planetId, min_x: minX, max_x: maxX, min_z: minZ, max_z: maxZ, since });
    } catch (error) {
      // a thrown fetch must free its slot too, or the cell is never asked again
      answer = { data: null, error };
    }
    flying.delete(key);
    if (myGen !== gen || !wanted.includes(key)) return; // dropped meanwhile
    const { data, error } = answer;
    if (error) { emit({ type: 'error', where: 'fetch', error }); return; }
    const cell = cells.get(key) ?? { entities: new Map(), fetchedAt: 0, since: null };
    cells.set(key, cell);
    for (const row of data ?? []) fold(row);
    // rows come oldest first, so the last is where the next ask starts; a
    // full page is asked again on the next update rather than after staleMs
    cell.since = data?.length ? data[data.length - 1].updated_at : cell.since;
    cell.fetchedAt = data?.length >= PAGE ? -Infinity : now();
  }

  function subscribe() {
    if (!client || !realtime || channel) return;
    channel = client.channel(`entities:${planetId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'world_entities', filter: `planet_id=eq.${planetId}` }, (payload) => {
      // a DELETE carries the primary key only (no full replica identity)
      if (payload.eventType === 'DELETE') forget(payload.old.id);
      else fold(payload.new);
    });
    channel.subscribe();
  }

  return {
    update(x, z) {
      if (disposed) return;
      const [cx, cz] = cellOf(x, z);
      const next = cellsAround(cx, cz, radius);
      const { gone } = diffCells(wanted, next);
      wanted = next;
      for (const key of gone) {
        const cell = cells.get(key);
        if (!cell) continue;
        for (const id of cell.entities.keys()) emit({ type: 'remove', id });
        cells.delete(key);
      }
      for (const key of wanted) {
        const cell = cells.get(key);
        if (!cell) fetchCell(key);
        else if (now() - cell.fetchedAt > staleMs) fetchCell(key, cell.since);
      }
      subscribe();
    },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get(id) { return find(id)[1]; },
    all() { return [...cells.values()].flatMap((c) => [...c.entities.values()]); },
    refetch(key) { const cell = cells.get(key); if (cell) fetchCell(key, cell.since); },
    async place(entity) {
      if (!client) return null;
      const { data, error } = await client.from('world_entities').insert(entityToRow({ ...entity, planetId })).select().single();
      if (error) { emit({ type: 'error', where: 'place', error }); return null; }
      fold(data);
      return rowToEntity(data);
    },
    async remove(id) {
      if (!client) return false;
      // RLS turns a delete of someone else's row into a delete of nothing, not
      // an error: asking for the deleted ids is how the loader can tell
      const { data, error } = await client.from('world_entities').delete().eq('id', id).select('id');
      if (error || !data?.length) {
        emit({ type: 'error', where: 'remove', error: error ?? { message: 'nothing removed: not yours, or already gone' } });
        return false;
      }
      forget(id);
      return true;
    },
    async damage(id, amount) {
      if (!client) return null;
      const { data, error } = await client.rpc('damage_entity', { entity_id: id, amount });
      if (error) { emit({ type: 'error', where: 'damage', error }); return null; }
      if (data === 0) forget(id);
      return data;
    },
    dispose() { disposed = true; gen++; channel?.unsubscribe(); channel = null; cells.clear(); listeners.clear(); wanted = []; },
  };
}
