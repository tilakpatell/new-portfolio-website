// Minecraft's worlds: one per seed, each in the store (`saves`, id
// `minecraft:<seed>`) and in the visitor's registry (/worlds). The old
// single save, `tp-mc` in localStorage, is copied in once as "My first
// world" and never written or deleted after.
//
// openWorld({ saves, store, registry, want, random }) → { id, seed, save }:
//   the world `want` names (?world=), else the one played last, else a new
//   one; registered either way. `save` is what newGame takes back, or null.
//   When the store could not read the world's save, `id` is null: the world
//   plays but is not written, so a failed read never overwrites a real save.
// keepWorld({ store, registry, id, data, now }) → false when the world is
//   gone from the registry (deleted on /worlds: not written back); else the
//   save written, stamped `at`, and the row touched.
// holdWorld({ saves, id, data, now }): the save in localStorage at once
//   (`tp-mc:held`), as the page goes: the store's write is asynchronous and
//   may not land before the tab is gone. openWorld takes it back when it is
//   newer than the store's and the world is still on the list.

import { hashSeed } from './rules/noise.js';
import { SAVE, restore } from './rules/save.js';

export const KIND = 'minecraft';
export const FIRST_NAME = 'My first world';
const MOVED = 'tp-mc:moved'; // the store's mark that tp-mc was copied in
export const HELD = 'tp-mc:held'; // one world's save, written as the page went
export const idOf = (seed) => `${KIND}:${hashSeed(seed)}`;
export const randomSeed = () => Math.floor(Math.random() * 2 ** 31) - 2 ** 30;

async function moveOld({ saves, store, registry }) {
  const moved = await store.read('saves', MOVED);
  if (!moved.ok || moved.value) return;
  const old = saves?.get(SAVE, null);
  const r = restore(old);
  if (r) {
    const seed = hashSeed(r.seed);
    const id = idOf(seed);
    const have = await store.read('saves', id);
    if (!have.ok) return;
    if (!have.value && !(await store.set('saves', id, old))) return; // not copied: tried again next time
    await registry.add({ kind: KIND, seed, name: FIRST_NAME });
  }
  await store.set('saves', MOVED, true);
}

export async function openWorld({ saves, store, registry, want = null, random = randomSeed }) {
  try {
    await moveOld({ saves, store, registry });
  } catch {
    /* the old save stays where it is for the next try */
  }
  let seed;
  if (want != null && String(want).trim() !== '') seed = hashSeed(want);
  else {
    const last = (await registry.list()).find((w) => w.kind === KIND);
    seed = last ? hashSeed(last.seed) : hashSeed(random());
  }
  const id = idOf(seed);
  const got = await store.read('saves', id);
  if (!got.ok) return { id: null, seed, save: null };
  let data = got.value;
  const held = saves?.get(HELD, null);
  if (held?.id === id) {
    const listed = await registry.get(id);
    if (listed && held.data && (held.data.at ?? 0) > (data?.at ?? 0) && (await store.set('saves', id, held.data))) data = held.data;
    saves.remove?.(HELD);
  }
  const save = restore(data);
  await registry.add({ kind: KIND, seed, name: `World ${seed}` });
  await registry.touch(id);
  return { id, seed, save };
}

export async function keepWorld({ store, registry, id, data, now = Date.now }) {
  if (!(await registry.get(id))) return false;
  const stamped = { ...data, at: now() };
  await store.set('saves', id, stamped);
  await registry.touch(id, { size: JSON.stringify(stamped).length });
  return true;
}

export function holdWorld({ saves, id, data, now = Date.now }) {
  saves?.set(HELD, { id, data: { ...data, at: now() } });
}
