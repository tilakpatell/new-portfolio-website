// The visitor's worlds: one row each in the store's `worlds` table, its save
// in `saves` under the same id. A world is its seed (the terrain, the
// systems, the ground are made again from it); the save is only what the
// visitor changed.
//
// World = { id: `${kind}:${seed}`, kind: 'minecraft' | 'pocket' | 'planet',
//   seed, name, route, created, played, size (the save's bytes), thumb }
// createRegistry(store, { now }) → { list() (last played first), get(id),
//   add({ kind, seed, name }) (the row it has, if it has one), touch(id,
//   { size }), rename(id, name), remove(id) (and its save),
//   exportWorld(id) → { world, save }, importWorld({ world, save }) }
// worldUrl(world) → the address that opens it

export const KINDS = ['minecraft', 'pocket', 'planet'];
export const KIND_NAMES = { minecraft: 'Minecraft', pocket: 'Pocket universe', planet: 'Planet' };
const NAME_MAX = 40;

export const worldId = (kind, seed) => `${kind}:${seed}`;

export function worldUrl({ kind, seed }) {
  const s = encodeURIComponent(String(seed));
  if (kind === 'pocket') return `/universe?seed=${s}`;
  if (kind === 'planet') return `/universe/expanse/${s}`;
  return `/dot-matrix/minecraft?world=${s}`;
}

const cleanName = (name, seed) => {
  const n = String(name ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX);
  return n || `World ${seed}`;
};
const sizeOf = (save) => (save == null ? 0 : JSON.stringify(save).length);

export function createRegistry(store, { now = Date.now } = {}) {
  const get = async (id) => (await store.get('worlds', id)) ?? null;
  const put = async (w) => {
    await store.set('worlds', w.id, w);
    return w;
  };
  const make = ({ kind, seed, name, size = 0 }) => {
    const t = now();
    return { id: worldId(kind, seed), kind, seed, name: cleanName(name, seed), route: worldUrl({ kind, seed }), created: t, played: t, size, thumb: null };
  };

  return {
    get,
    async list() {
      const rows = await store.list('worlds');
      return rows.map(([, w]) => w).sort((a, b) => b.played - a.played);
    },
    async add({ kind, seed, name }) {
      if (!KINDS.includes(kind) || seed == null || seed === '') throw new Error('not a world');
      return (await get(worldId(kind, seed))) ?? put(make({ kind, seed, name }));
    },
    async touch(id, { size } = {}) {
      const w = await get(id);
      if (!w) return null;
      return put({ ...w, played: now(), ...(size != null ? { size } : {}) });
    },
    async rename(id, name) {
      const w = await get(id);
      if (!w) return null;
      if (!String(name ?? '').trim()) return w;
      return put({ ...w, name: cleanName(name, w.seed) });
    },
    async remove(id) {
      await store.remove('saves', id);
      await store.remove('blobs', `thumb:${id}`);
      await store.remove('worlds', id);
    },
    async exportWorld(id) {
      const w = await get(id);
      if (!w) return null;
      return { world: { ...w, thumb: null }, save: await store.get('saves', id) };
    },
    async importWorld(file) {
      const w = file?.world;
      if (!w || !KINDS.includes(w.kind) || w.seed == null || w.seed === '' || !['string', 'number'].includes(typeof w.seed)) throw new Error('not a world file');
      const save = file.save ?? null;
      const row = make({ kind: w.kind, seed: w.seed, name: w.name, size: sizeOf(save) });
      if (save != null) await store.set('saves', row.id, save);
      return put(row);
    },
  };
}
