// FNV-1a 64 over the parts joined by '\0': the Expanse generator's own hash
// (expanse/gen/seed.js), here so the planets' tables seed a named world the
// way they always have without reaching up into a world for it.
// expanse/flight/planets.test.js holds the two equal.
//
//   hash64(...parts) → bigint

const MASK = 0xffffffffffffffffn;
const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const utf8 = new TextEncoder();

export function hash64(...parts) {
  let h = OFFSET;
  for (const b of utf8.encode(parts.map(String).join('\0'))) h = ((h ^ BigInt(b)) * PRIME) & MASK;
  return h;
}
