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
// keepWorld({ store, registry, id, data }): the save written, the row touched.

import { hashSeed } from './rules/noise.js';
import { SAVE, restore } from './rules/save.js';

export const KIND = 'minecraft';
export const FIRST_NAME = 'My first world';
const MOVED = 'tp-mc:moved'; // the store's mark that tp-mc was copied in
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
  const save = restore(got.value);
  await registry.add({ kind: KIND, seed, name: `World ${seed}` });
  await registry.touch(id);
  return { id, seed, save };
}

export async function keepWorld({ store, registry, id, data }) {
  await store.set('saves', id, data);
  await registry.touch(id, { size: JSON.stringify(data).length });
}
