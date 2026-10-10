// The Battlefront II (2017) data dump: every gameplay record the game ships,
// one Frostbite EBX asset per file, written as JSON by the exporter as
// `data/<Name>.json` (or `.json.gz` in the bucket), with `data.tsv` its index
// (`name type file bytes`, tab-separated, no header).
//
// An asset is `{ name, type, guid, root, objects }`: `objects` is the flat list
// of the partition's data objects, each with its `$type` (and `$guid` when it
// has one), and `root` the index of the asset's own object. Objects point at
// each other two ways:
//
//   { "$ref": 12 }                          an object in the same asset, by index
//   { "$asset": "Gameplay/…/W_…",           an object in another asset: the asset
//     "$assetType": "…", "$class": "<guid>" }  by name, the object by its `$guid`
//
// Numbers are read by dotted path (`FireLogic.RateOfFire`, `Shot.InitialSpeed.z`)
// because the tuning a rulebook wants sits at different depths in different
// types; walking every number with its path is how a rulebook names the
// source of each value it keeps (`<asset>#<Type>.<path>`).
//
// Transforms are 3×4 (`right`, `up`, `forward`, `trans`); the export's frame is
// glTF's: metres, +Y up, +Z forward, so a yaw is atan2(forward.x, forward.z).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

export { isSequel } from './bf2017-manifest.mjs';

// Keys whose numbers are identity or packing, never tuning.
export const SKIP_KEYS = ['Identifier', 'TypeNameHash', 'Flags', 'TypeHash', 'OutHash', 'LightmapResolutionScale', 'HologramProjectorIndex'];

// Frostbite's "unset" float (FLT_MAX) in a transform's Translate/Rotation/Scale.
const UNSET = 3.4e38;

export function readIndex(root) {
  const index = new Map();
  for (const line of readFileSync(join(root, 'data.tsv'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const [name, type, file, bytes] = line.split('\t');
    index.set(name, { type, file, bytes: Number(bytes) });
  }
  return index;
}

// An asset's text as the export wrote it (a 64-bit integer, like a firing
// pattern's mask, survives only here: JSON.parse rounds it to a double).
export function loadText(root, name) {
  const plain = join(root, 'data', `${name}.json`);
  if (existsSync(plain)) return readFileSync(plain, 'utf8');
  const gz = `${plain}.gz`;
  if (existsSync(gz)) return gunzipSync(readFileSync(gz)).toString('utf8');
  return null;
}

export function loadAsset(root, name) {
  const text = loadText(root, name);
  return text === null ? null : JSON.parse(text);
}

export const rootOf = (asset) => asset.objects[asset.root];
export const objectsOf = (asset, type) => asset.objects.filter((o) => o?.$type === type);
export const byGuid = (asset, guid) => asset.objects.find((o) => o?.$guid === guid) ?? null;
export const shortName = (name) => name.slice(name.lastIndexOf('/') + 1);

export function deref(asset, v) {
  if (!v || typeof v.$ref !== 'number') return null;
  return asset.objects[v.$ref] ?? null;
}

// One cache per root: a rulebook run follows the same shared assets (channels,
// projectiles, prefabs) thousands of times.
const caches = new Map();

export function follow(root, v) {
  const name = typeof v === 'string' ? v : v?.$asset;
  if (!name) return null;
  let cache = caches.get(root);
  if (!cache) caches.set(root, (cache = new Map()));
  if (!cache.has(name)) cache.set(name, loadAsset(root, name));
  return cache.get(name);
}

// The object an `$asset` pointer names: the one whose `$guid` is its `$class`,
// else the asset's root. `{ asset, obj }`, or null when the asset is missing.
export function pointee(root, v) {
  const asset = follow(root, v);
  if (!asset) return null;
  return { asset, obj: (v?.$class && byGuid(asset, v.$class)) || rootOf(asset) };
}

// Every `$asset` pointer an object holds, at any depth: `[{ key, name }]`.
export function assetRefs(obj, depth = 8) {
  const out = [];
  const walk = (v, key, d) => {
    if (!v || typeof v !== 'object' || d < 0) return;
    if (typeof v.$asset === 'string') {
      out.push({ key, name: v.$asset });
      return;
    }
    if (Array.isArray(v)) v.forEach((x) => walk(x, key, d - 1));
    else for (const [k, x] of Object.entries(v)) walk(x, k, d - 1);
  };
  walk(obj, '', depth);
  return out;
}

export function numbersOf(obj, { skip = SKIP_KEYS, depth = 8 } = {}) {
  const out = [];
  const walk = (v, path, d) => {
    if (typeof v === 'number') {
      if (Number.isFinite(v) && Math.abs(v) < UNSET) out.push([path, v]);
      return;
    }
    if (!v || typeof v !== 'object' || d < 0 || '$ref' in v || '$asset' in v) return;
    for (const [k, x] of Object.entries(v)) {
      if (k.startsWith('$') || skip.includes(k)) continue;
      walk(x, path ? `${path}.${k}` : k, d - 1);
    }
  };
  walk(obj, '', depth);
  return out;
}

// A value by dotted path (`Shot.InitialSpeed.z`, `Dispersion.0.MaxAngle`).
export function pick(obj, path) {
  let v = obj;
  for (const k of path.split('.')) {
    if (v == null) return undefined;
    v = v[k];
  }
  return v;
}

export const yawOf = (forward) => Math.atan2(forward.x, forward.z);
const vec = (p) => [p.x, p.y, p.z];

export function transformOf(obj) {
  const t = obj?.Transform ?? obj?.BlueprintTransform;
  if (!t?.trans || !t.forward) return null;
  return { at: vec(t.trans), yaw: yawOf(t.forward) };
}

// A shape's footprint: a polygon on XZ with its height, a sphere, or a box.
export function pointsOf(shape) {
  if (shape.$type === 'SphereData') return { at: vec(shape.Position), r: shape.Radius };
  if (shape.$type === 'OBBData') {
    const t = transformOf(shape);
    return { at: t.at, half: vec(shape.HalfExtents), yaw: t.yaw };
  }
  const points = (shape.Points ?? []).map((p) => [p.x, p.z]);
  return { points, y: shape.Points?.[0]?.y ?? 0, height: shape.Height ?? 0, closed: Boolean(shape.IsClosed) };
}

// The localisation's id: a hash of the string key (English.json says how:
// h = 0xFFFFFFFF; h = (c + 33·h) mod 2³², eight upper-case hex digits).
export function stringHash(key) {
  let h = 0xffffffff;
  for (const c of key) h = (c.charCodeAt(0) + Math.imul(33, h)) >>> 0;
  return h.toString(16).toUpperCase().padStart(8, '0');
}

export function resolveStrings(ids, strings) {
  const table = strings.strings ?? strings;
  const out = {};
  for (const id of ids) {
    const text = table[stringHash(id)];
    if (text !== undefined) out[id] = text;
  }
  return out;
}

// An asset cut for a fixture: the root and the objects `keep` selects, with
// every object they reach by `$ref` (not through the root), re-indexed; the
// root's pointers to dropped objects are left out of its arrays (or nulled).
export function cutAsset(asset, keep = () => true) {
  const reach = new Set([asset.root]);
  const visit = (v) => {
    if (!v || typeof v !== 'object') return;
    if (typeof v.$ref === 'number') {
      if (!reach.has(v.$ref)) {
        reach.add(v.$ref);
        visit(asset.objects[v.$ref]);
      }
      return;
    }
    Object.values(v).forEach(visit);
  };
  asset.objects.forEach((o, i) => {
    if (i !== asset.root && keep(o, i) && !reach.has(i)) {
      reach.add(i);
      visit(o);
    }
  });
  const order = [...reach].sort((a, b) => a - b);
  const index = new Map(order.map((old, i) => [old, i]));
  const remap = (v) => {
    if (Array.isArray(v)) return v.filter((x) => !(x && typeof x.$ref === 'number' && !index.has(x.$ref))).map(remap);
    if (!v || typeof v !== 'object') return v;
    if (typeof v.$ref === 'number') return index.has(v.$ref) ? { $ref: index.get(v.$ref) } : null;
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remap(x)]));
  };
  return { ...asset, root: index.get(asset.root), objects: order.map((i) => remap(asset.objects[i])) };
}

// A file of the web build: under `<root>/web/` in the bucket's layout (the
// cloud), else `<root>/../web_opt/` beside the masters (the owner's machine).
export function webFile(root, rel) {
  for (const p of [join(root, 'web', rel), join(root, '..', 'web_opt', rel)]) if (existsSync(p)) return p;
  return null;
}

export function readWebJson(root, rel) {
  const p = webFile(root, rel);
  return p ? JSON.parse(readFileSync(p, 'utf8')) : null;
}
