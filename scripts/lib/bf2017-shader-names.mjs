// The shader depots' parameter names, hashed and resolved. Frostbite's
// compiled materials (maps_work/shaderdepots.jsonl on the desktop, from
// `bf2export sbdprobe`) carry each live parameter block under a hashed name:
// the hash is djb2-xor of the lower-cased name (h = ((h << 5) + h) ^ c from
// 5381, 32 bits). A dictionary of the names the readable records use (the
// materials dump's texture, vector and bool keys, the ObjectVariation
// records' ParameterNames, the SurfaceShaderPreset records' parameters)
// names a depot's blocks again, so a vehicle's or a kit's live tints and
// switches can be read by name instead of a hand table (the colour lane:
// docs/superpowers/plans/2026-10-10-bf2017-accuracy-lane-colour.md, task 1).
//
//   hashName(name) → 'xxxxxxxx'         (lower-cased, the depots' rule)
//   hashExact(name) → 'xxxxxxxx'        (as written: the type names `Vec` and `Boolean` hash this way)
//   namesFrom({ materials, variations, presets }) → Set of names
//   dictionary(names) → { byHash: Map(hash → name), names: { name: hash } }
//   resolveDepot(row, dict) → { params: [{ name | hash, type, value }], resolved, unresolved: { hash: count } }
//   vecOf(hex) → [x, y, z, w]           (16 bytes of little-endian floats)

const hash32 = (s) => {
  let h = 5381;
  for (const c of Buffer.from(String(s), 'utf8')) h = ((((h << 5) + h) >>> 0) ^ c) >>> 0;
  return h.toString(16).padStart(8, '0');
};
export const hashExact = (name) => hash32(name);
export const hashName = (name) => hash32(String(name).toLowerCase());

// the type hashes the depot probe writes on each block
export const TYPES = { [hashExact('Vec')]: 'Vec', [hashName('vec')]: 'Vec', [hashExact('Boolean')]: 'Boolean', [hashName('boolean')]: 'Boolean', [hashExact('Texture')]: 'Texture', [hashName('texture')]: 'Texture', [hashExact('Float')]: 'Float', [hashName('float')]: 'Float' };

// every name the readable records use: the materials dump's slots and
// parameters (one JSON a line, or parsed rows), the ObjectVariation
// records' ParameterName fields (walked wherever they sit), the presets'
// parameter lists
export function namesFrom({ materials = [], variations = [], presets = [] } = {}) {
  const names = new Set();
  const add = (n) => {
    if (typeof n === 'string' && n.trim()) names.add(n.trim());
  };
  const rows = (x) => (typeof x === 'string' ? x.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : x);
  for (const m of rows(materials)) for (const mat of m.materials ?? [m]) for (const key of ['textures', 'vectors', 'bools', 'conditionals']) for (const n of Object.keys(mat[key] ?? {})) add(n);
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (/^(ParameterName|Name)$/.test(k) && typeof x === 'string') add(x);
      else walk(x);
    }
  };
  for (const v of rows(variations)) walk(v);
  for (const p of rows(presets)) walk(p);
  return names;
}

export function dictionary(names) {
  const byHash = new Map();
  const out = {};
  for (const n of names) {
    const h = hashName(n);
    if (!byHash.has(h)) byHash.set(h, n);
    out[n] = h;
  }
  return { byHash, names: out };
}

// four little-endian floats from a block's 16-byte hex
export function vecOf(hex) {
  const b = Buffer.from(String(hex).replace(/^0x/, ''), 'hex');
  if (b.length < 16) return null;
  return [0, 4, 8, 12].map((i) => +b.readFloatLE(i).toPrecision(7));
}

const hashOf = (v) => String(v ?? '').toLowerCase().replace(/^0x/, '').padStart(8, '0');

// A depot row's blocks named: each `{ name: <hash>, type: <hash>, value }`
// becomes `{ name | hash, type, value }` (a Vec's value as four floats); a
// hash the dictionary lacks is left as it is and counted, never guessed
export function resolveDepot(row, dict) {
  const params = [];
  const unresolved = {};
  let resolved = 0;
  for (const block of row.blocks ?? row.params ?? []) {
    const h = hashOf(block.name ?? block.hash);
    const type = TYPES[hashOf(block.type)] ?? block.type ?? null;
    const name = dict.byHash.get(h) ?? null;
    const value = type === 'Vec' && typeof block.value === 'string' ? (vecOf(block.value) ?? block.value) : block.value;
    if (name) {
      resolved++;
      params.push({ name, type, value });
    } else {
      unresolved[h] = (unresolved[h] ?? 0) + 1;
      params.push({ hash: h, type, value });
    }
  }
  return { params, resolved, unresolved };
}
