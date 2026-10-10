/* global window */
// The durable world (Supabase), faked, for the flight's browser check
// (online-check.mjs --fly): one store in Node that every browser context
// reaches through a binding, so two visitors build and see each other's
// turrets with no project and no network, as CI runs it. It answers the
// calls lib/durable's loader makes and nothing else, as the migrations
// would: an envelope ask (oldest first, `since`), an insert stamped with its
// owner and version, a delete only the owner's, damage_entity clamped to 30
// and the row gone at nothing, Echo Base refused; each change goes to every
// page listening, as Realtime's postgres_changes.
//
// durableStore({ onChange }) → { insert(uid, row), remove(uid, id), rpc(uid, name, args), rows }
// fakeDurable() → { attach(context, uid) (before the context's first page), store }

import { randomUUID } from 'node:crypto';

const POIS = [{ planet_id: 'hoth', x: 1200, z: -800, r: 380 }];
const DAMAGE_MAX = 30;

export function durableStore({ onChange = () => {} } = {}) {
  const rows = new Map();
  let tick = 0;
  // (times that sort and differ, however fast the calls come)
  const stamp = () => new Date(Date.UTC(2026, 9, 9) + ++tick).toISOString();
  const ok = (data) => ({ data, error: null, status: 200 });
  const refused = (message) => ({ data: null, error: { message }, status: 400 });
  return {
    rows,
    insert(uid, row) {
      if (POIS.some((p) => p.planet_id === row.planet_id && Math.hypot(row.x - p.x, row.z - p.z) <= p.r)) return refused('inside a point of interest');
      const t = stamp();
      const r = { rot_x: 0, rot_y: 0, rot_z: 0, scale: 1, hp: 100, metadata: {}, terrain_version: 1, ...row, id: randomUUID(), owner: uid, version: 1, created_at: t, updated_at: t };
      rows.set(r.id, r);
      onChange({ eventType: 'INSERT', new: r });
      return ok(r);
    },
    remove(uid, id) {
      const r = rows.get(id);
      if (!r || r.owner !== uid) return ok([]);
      rows.delete(id);
      onChange({ eventType: 'DELETE', old: { id } });
      return ok([{ id }]);
    },
    rpc(uid, name, a) {
      if (name === 'get_entities_in_bounding_box') {
        const out = [...rows.values()].filter((r) => r.planet_id === a.planet_id && r.x >= a.min_x && r.x <= a.max_x && r.z >= a.min_z && r.z <= a.max_z && (!a.since || r.updated_at > a.since));
        return ok(out.sort((p, q) => (p.updated_at < q.updated_at ? -1 : 1)));
      }
      if (name === 'damage_entity') {
        const r = rows.get(a.entity_id);
        if (!r) return ok(null);
        const hp = Math.max(0, r.hp - Math.max(0, Math.min(DAMAGE_MAX, a.amount)));
        if (hp === 0) {
          rows.delete(r.id);
          onChange({ eventType: 'DELETE', old: { id: r.id } });
        } else {
          Object.assign(r, { hp, version: r.version + 1, updated_at: stamp() });
          onChange({ eventType: 'UPDATE', new: { ...r } });
        }
        return ok(hp);
      }
      return refused(`no function ${name}`);
    },
  };
}

// the client a page holds: lib/durable/supabase.js's shape, each call through the binding
const pageClient = () => {
  const call = (op, args) => window.__durable(op, args);
  const handlers = [];
  window.__durableRealtime = (payload) => handlers.forEach((fn) => fn(payload));
  const user = async () => ({ id: await call('uid') });
  window.__FLIGHT_DURABLE__ = {
    auth: {
      getSession: async () => ({ data: { session: { user: await user() } } }),
      signInAnonymously: async () => ({ data: { user: await user() }, error: null }),
    },
    rpc: (name, args) => call('rpc', { name, args }),
    from: () => ({
      insert: (row) => ({ select: () => ({ single: () => call('insert', row) }) }),
      delete: () => ({ eq: (_, id) => ({ select: () => call('remove', id) }) }),
    }),
    channel: () => {
      const api = {
        on: (_type, _filter, fn) => (handlers.push(fn), api),
        subscribe: (cb) => {
          call('listen');
          setTimeout(() => cb?.('SUBSCRIBED'), 0);
          return api;
        },
        unsubscribe: () => {},
      };
      return api;
    },
  };
};

export function fakeDurable() {
  const listening = new Set(); // pages
  const store = durableStore({
    onChange: (payload) => {
      for (const page of [...listening]) page.evaluate((p) => window.__durableRealtime?.(p), payload).catch(() => listening.delete(page));
    },
  });
  return {
    store,
    async attach(context, uid) {
      await context.exposeBinding('__durable', ({ page }, op, args) => {
        if (op === 'uid') return uid;
        if (op === 'listen') return void listening.add(page);
        if (op === 'insert') return store.insert(uid, args);
        if (op === 'remove') return store.remove(uid, args);
        if (op === 'rpc') return store.rpc(uid, args.name, args.args);
        return { data: null, error: { message: `no ${op}` } };
      });
      await context.addInitScript(pageClient);
    },
  };
}
