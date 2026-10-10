// The hit law, Bruno Simon’s (folio-2025; research note Part 3): what a hit
// of a given force sounds, puffs and shakes like, the same for every world.
// Under the threshold a hit is nothing (a thing at rest on the ground pushes
// on it all the time); from there it grows with the square of how far over
// it is, so a tap is quiet and a crash is loud, and it is full at `full`.
// One key is told once within `gap` seconds (his 100 ms throttle), so a
// barrel rattling on the ground isn’t a drum roll. Pure: lib/three/impacts.js
// turns the answer into a thud, a puff and a shake.
//
//   createImpacts({ threshold = 15, full = 120, gap = 0.1, now, random })
//     → { hit(force, at, key = at) → { gain, pitch, dust, shake, at } | null,
//         set({ threshold, full, gap }), values() }
//   impactGroups(rules) → the ?debug panel’s groups (lib/debugPanel)

const PITCH = [0.85, 0.3]; // the lowest pitch, and how much higher it may be
const DUST = 6; // puffs at full
const SHAKE = 0.15; // trauma at full
const KEEP = 64; // keys remembered before the old ones are let go

export function createImpacts({ threshold = 15, full = 120, gap = 0.1, now = () => performance.now() / 1000, random = Math.random } = {}) {
  const rules = { threshold, full, gap };
  const told = new Map(); // key → when it was last told
  return {
    hit(force, at, key = at) {
      // (NaN or Infinity: a body gone bad, which world.js puts right, not a hit)
      if (!Number.isFinite(force)) return null;
      const k = Math.min(1, Math.max(0, (force - rules.threshold) / Math.max(1e-6, rules.full - rules.threshold)));
      const gain = k * k;
      if (gain <= 0) return null;
      const t = now();
      if (t - (told.get(key) ?? -Infinity) < rules.gap) return null;
      if (told.size >= KEEP) for (const [old, when] of told) if (t - when >= rules.gap) told.delete(old);
      told.set(key, t);
      return { gain, pitch: PITCH[0] + PITCH[1] * random(), dust: Math.max(1, Math.round(DUST * gain)), shake: SHAKE * gain, at };
    },
    set(values) {
      for (const k of Object.keys(rules)) if (Number.isFinite(values?.[k])) rules[k] = values[k];
    },
    values: () => ({ ...rules }),
  };
}

export function impactGroups(rules) {
  const item = (key, label, min, max, step) => ({ key, label, type: 'range', min, max, step, get: () => rules.values()[key], set: (v) => rules.set({ [key]: v }) });
  return [{ name: 'hits', items: [item('threshold', 'quiet under', 0, 60, 0.5), item('full', 'full at', 20, 400, 1), item('gap', 'gap (s)', 0, 0.5, 0.01)] }];
}
