// Pocket universes: the universe map with a seed of its own, reached by
// /universe?seed=<word>. The authored map at the middle is the same; the
// Expanse past its rim is made from the word's seed instead of the shared
// one (gen/seed.js's UNIVERSE), so every word is a universe of its own, the
// same one on every visit and every device. One is kept on /worlds as a
// world of kind 'pocket' (worlds/registry.js): its seed is all there is.
//
// pocketOf(search) → { pocket, word, universe, name }; pocketName(word);
// registerPocket(registry, pocket) → the world row, or null for the shared one

import { UNIVERSE, UNIVERSE_SEED, hash64 } from './gen/seed';

const WORD_MAX = 32;

export const pocketName = (word) => word.replace(/\b\w/g, (c) => c.toUpperCase());

export function pocketOf(search = '') {
  let raw = '';
  try {
    raw = new URLSearchParams(search).get('seed') ?? '';
  } catch {
    raw = '';
  }
  const word = raw.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, WORD_MAX);
  if (!word || word === UNIVERSE_SEED) return { pocket: false, word: UNIVERSE_SEED, universe: UNIVERSE, name: 'The universe' };
  return { pocket: true, word, universe: hash64(word), name: pocketName(word) };
}

export async function registerPocket(registry, pocket) {
  if (!pocket?.pocket) return null;
  const w = await registry.add({ kind: 'pocket', seed: pocket.word, name: pocket.name });
  return (await registry.touch(w.id)) ?? w;
}
