// The expanse's seeds: one word makes the universe, and every sector,
// system and planet in it gets its own seed from its parent's and where it
// sits, so any of them can be rebuilt alone, the same every time. Pure (no
// three.js), so it runs in Node.
//
// UNIVERSE_SEED, UNIVERSE (the bigint from it)
// hash64(...parts) → bigint: FNV-1a 64 over the parts joined by '\0'
// universeOf(word = UNIVERSE_SEED) → bigint
// sectorSeed(universe, sx, sz), systemSeed(sectorSeed, i), planetSeed(systemSeed, j) → bigint
// rngOf(seed) → () => number in [0, 1) (splitmix64)
// range(rng, a, b) → [a, b); int(rng, a, b) → a..b inclusive; pick(rng, list)

export const UNIVERSE_SEED = "tilakverse";

const MASK = 0xffffffffffffffffn;
const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const utf8 = new TextEncoder();

export function hash64(...parts) {
  let h = OFFSET;
  for (const b of utf8.encode(parts.map(String).join("\0")))
    h = ((h ^ BigInt(b)) * PRIME) & MASK;
  return h;
}

export const universeOf = (word = UNIVERSE_SEED) => hash64(word);
export const UNIVERSE = universeOf();

export const sectorSeed = (universe, sx, sz) =>
  hash64(universe, "sector", sx, sz);
export const systemSeed = (sector, i) => hash64(sector, "system", i);
export const planetSeed = (system, j) => hash64(system, "planet", j);

export function rngOf(seed) {
  let state = BigInt(seed) & MASK;
  return () => {
    state = (state + 0x9e3779b97f4a7c15n) & MASK;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
    z ^= z >> 31n;
    return Number(z >> 11n) / 2 ** 53;
  };
}

export const range = (rng, a, b) => a + rng() * (b - a);
export const int = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
export const pick = (rng, list) => list[Math.floor(rng() * list.length)];
