// Minecraft's worlds: one per seed, each in the store (`saves`, id
// `minecraft:<seed>`) and in the visitor's registry (/worlds). The old
// single save, `tp-mc` in localStorage, is copied in once as "My first
// world" and never written or deleted after.
//
// openWorld({ saves, store, registry, want, random }) → { id, seed, save }:
//   the world `want` names (?world=), else the one played last, else a new
//   one; registered either way. `save` is what newGame takes back, or null.
// keepWorld({ store, registry, id, data }): the save written, the row touched.

import { hashSeed } from './rules/noise.js';
import { SAVE, restore } from './rules/save.js';

export const KIND = 'minecraft';
export const FIRST_NAME = 'My first world';
const MOVED = 'tp-mc:moved'; // the store's mark that tp-mc was copied in
export const idOf = (seed) => `${KIND}:${hashSeed(seed)}`;
export const randomSeed = () => Math.floor(Math.random() * 2 ** 31) - 2 ** 30;

async function moveOld({ saves, store, registry }) {
  if (await store.get('saves', MOVED)) return;
  const old = saves?.get(SAVE, null);
  const r = restore(old);
  if (r) {
    const seed = hashSeed(r.seed);
    const id = idOf(seed);
    if (!(await store.get('saves', id))) await store.set('saves', id, old);
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
  const save = restore(await store.get('saves', id));
  await registry.add({ kind: KIND, seed, name: `World ${seed}` });
  await registry.touch(id);
  return { id, seed, save };
}

export async function keepWorld({ store, registry, id, data }) {
  await store.set('saves', id, data);
  await registry.touch(id, { size: JSON.stringify(data).length });
}
