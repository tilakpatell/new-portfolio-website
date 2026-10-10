// A level pack from the game's map (lane L: docs/superpowers/specs/2026-10-10-
// bf2017-levels-lighting-sabers-design.md, "How a level draws"). The map
// (`web/maps/<level>/<level>.json` + `.bin`) says where every model of the
// level sits; this picks the arena's sub-levels, rebases them on the site's
// landing spot, cuts them into cells, holds each tier to its budget row and
// writes the pack's `level.json` and bins. Pure: the CLI
// (scripts/bf2017-level.mjs) fetches, reads files and writes them.
//
//   readMap(json, bin) → { instances, meshOf, groups, meshes, subworlds, terrain, sky, vehicleSpawns }
//   mainSubs(map), arenaOf(map, { subs }) → instance indices
//   subset(instances, indices), rebase(instances, origin, yaw) → instances in the site's frame
//   packCell(cell, instances) → { bin, draws }
//   terrainFrame(record), heightsLayer(record, png) → the record's frame; an image layer
//   cropHeights(src, frame, { minX, minZ, size, metresPerPixel }) → Uint16Array
//   buildPack({ world, mapName, map, spot, groundY, meshes, … }) → { json, files, table }
//   meshCuts(entry, { ultra }) → { far, lod1, plain, ultra } LOD entries
//   rewriteImageUris(glb, fn) → the GLB with its images' URIs mapped

import { BUDGET_ROWS } from '../../src/lib/budgets.js';
import { imageLayerFrom } from '../../src/lib/land/layers.js';
import { bandsFor, cutFor } from '../../src/lib/level/bands.js';
import { fitTo } from '../../src/lib/level/fit.js';
import { CELL, INSTANCE_BYTES, cellKey, cellOf } from '../../src/lib/level/instances.js';
import { decodePng16 } from '../../src/lib/level/png16.js';
import { cutsFor } from './bf2017-manifest.mjs';
import { glbJson } from './bf2017-paths.mjs';
import { cellsOf, weightOf } from './level-cells.mjs';

export const TIERS = ['low', 'mid', 'high', 'ultra'];
const Q = 32767;
const last = (path) => String(path).split('/').pop().toLowerCase();

// The map's records are the pack's own (src/lib/level/instances.js): the
// quaternions stay Int16 here so a rebased bin is written without a second
// rounding.
export function readMap(json, bin) {
  const stride = json.stride ?? INSTANCE_BYTES;
  const count = json.instances ?? json.count ?? Math.floor(bin.byteLength / stride);
  if (bin.byteLength < count * stride) throw new Error(`map bin: ${bin.byteLength} bytes for ${count} instances of ${stride}`);
  const v = new DataView(bin.buffer ?? bin, bin.byteOffset ?? 0, bin.byteLength);
  const position = new Float32Array(count * 3);
  const quaternion = new Int16Array(count * 4);
  const scale = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const o = i * stride;
    for (let k = 0; k < 3; k++) position[i * 3 + k] = v.getFloat32(o + k * 4, true);
    for (let k = 0; k < 4; k++) quaternion[i * 4 + k] = v.getInt16(o + 12 + k * 2, true);
    for (let k = 0; k < 3; k++) scale[i * 3 + k] = v.getFloat32(o + 20 + k * 4, true);
  }
  const meshes = (json.meshes ?? []).map((m) => (typeof m === 'string' ? { name: m } : m));
  const subworlds = (json.subworlds ?? []).map((s) => (typeof s === 'string' ? s : s.name));
  const index = (list, v) => (typeof v === 'number' ? v : list.findIndex((x) => (x.name ?? x) === v));
  const groups = (json.groups ?? []).map((g) => ({ mesh: index(meshes, g.mesh), sub: index(subworlds, g.subworld ?? g.sub), first: g.first ?? g.offset ?? g.start, count: g.count }));
  const meshOf = new Int32Array(count).fill(-1);
  for (const g of groups) meshOf.fill(g.mesh, g.first, g.first + g.count);
  return { name: json.name, instances: { count, position, quaternion, scale }, meshOf, groups, meshes, subworlds, terrain: json.terrain ?? null, sky: json.sky ?? [], vehicleSpawns: json.vehicleSpawns ?? [] };
}

// The playable map: the level's own sub-level (its name's last part) and
// `Content`. Lobby, EOR, Cinematics, Outro_*, HeroArena and the rest are
// other sets in the same file, drawn somewhere else in the game.
export const mainSubs = (map) => [last(map.name), 'content'];

export function arenaOf(map, { subs = null } = {}) {
  const want = new Set((subs ?? mainSubs(map)).map(last));
  const out = [];
  for (const g of map.groups) {
    if (!want.has(last(map.subworlds[g.sub]))) continue;
    for (let i = 0; i < g.count; i++) out.push(g.first + i);
  }
  return out.sort((a, b) => a - b);
}

export function subset(inst, indices) {
  const n = indices.length;
  const out = { count: n, position: new Float32Array(n * 3), quaternion: new inst.quaternion.constructor(n * 4), scale: new Float32Array(n * 3) };
  indices.forEach((i, j) => {
    out.position.set(inst.position.subarray(i * 3, i * 3 + 3), j * 3);
    out.quaternion.set(inst.quaternion.subarray(i * 4, i * 4 + 4), j * 4);
    out.scale.set(inst.scale.subarray(i * 3, i * 3 + 3), j * 3);
  });
  return out;
}

// The site's frame: the spot (origin) at 0, 0, 0 and the whole level turned
// `yaw` about y (positions and orientations alike: the turn's quaternion
// before each instance's own).
export function rebase(inst, origin, yaw = 0) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const hy = Math.sin(yaw / 2);
  const hw = Math.cos(yaw / 2);
  const out = { count: inst.count, position: new Float32Array(inst.count * 3), quaternion: new Int16Array(inst.count * 4), scale: Float32Array.from(inst.scale) };
  const scaleQ = inst.quaternion instanceof Int16Array ? 1 / Q : 1;
  for (let i = 0; i < inst.count; i++) {
    const x = inst.position[i * 3] - origin[0];
    const z = inst.position[i * 3 + 2] - origin[2];
    out.position[i * 3] = x * c + z * s;
    out.position[i * 3 + 1] = inst.position[i * 3 + 1] - origin[1];
    out.position[i * 3 + 2] = -x * s + z * c;
    const [qx, qy, qz, qw] = [0, 1, 2, 3].map((k) => inst.quaternion[i * 4 + k] * scaleQ);
    // (0, hy, 0, hw) × (qx, qy, qz, qw)
    const r = [hw * qx + hy * qz, hw * qy + hy * qw, hw * qz - hy * qx, hw * qw - hy * qy];
    for (let k = 0; k < 4; k++) out.quaternion[i * 4 + k] = Math.max(-Q, Math.min(Q, Math.round(r[k] * Q)));
  }
  return out;
}

// A cell's bin: its draws one after another, each a contiguous range
export function packCell(cell, inst) {
  const n = cell.draws.reduce((a, d) => a + d.indices.length, 0);
  const bin = new ArrayBuffer(n * INSTANCE_BYTES);
  const v = new DataView(bin);
  const draws = [];
  let at = 0;
  for (const d of cell.draws) {
    draws.push({ mesh: d.mesh, offset: at, count: d.indices.length, mirrored: d.mirrored });
    for (const i of d.indices) writeOne(v, at++, inst, i);
  }
  return { bin, draws };
}

function writeOne(v, j, inst, i) {
  const o = j * INSTANCE_BYTES;
  const q = inst.quaternion instanceof Int16Array ? (k) => inst.quaternion[i * 4 + k] : (k) => Math.round(inst.quaternion[i * 4 + k] * Q);
  for (let k = 0; k < 3; k++) v.setFloat32(o + k * 4, inst.position[i * 3 + k], true);
  for (let k = 0; k < 4; k++) v.setInt16(o + 12 + k * 2, q(k), true);
  for (let k = 0; k < 3; k++) v.setFloat32(o + 20 + k * 4, inst.scale[i * 3 + k], true);
}

// ── The ground ──

// A terrain record's world map: where its first pixel is, its size and step,
// and how a 16-bit value becomes metres (web/terrain.jsonl)
export function terrainFrame(record, which = 'world') {
  const m = record[which];
  return {
    minX: m.min[0],
    minZ: m.min[1],
    w: m.width,
    h: m.height,
    metresPerPixel: m.metresPerPixel,
    scale: record.heightScale,
    offset: record.heightOffset ?? 0,
    hole: record.holePixels > 0 ? 0 : null,
  };
}

export async function heightsLayer(record, png, which = 'world') {
  const f = terrainFrame(record, which);
  const { data, w, h } = await decodePng16(png);
  return imageLayerFrom(record, { data, w, h, minX: f.minX, minZ: f.minZ, metresPerPixel: f.metresPerPixel }, null);
}

// A square of a heightmap, resampled bilinearly to its own step, in the
// source's 16-bit units; a hole stays a hole (any hole under a sample makes
// the sample one), and so does anywhere outside the source
export function cropHeights(src, frame, { minX, minZ, size, metresPerPixel }) {
  const n = Math.round(size / metresPerPixel) + 1;
  const out = new Uint16Array(n * n);
  const hole = frame.hole ?? 0;
  const at = (i, j) => src[j * frame.w + i];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const gx = (minX + i * metresPerPixel - frame.minX) / frame.metresPerPixel;
      const gz = (minZ + j * metresPerPixel - frame.minZ) / frame.metresPerPixel;
      if (gx < 0 || gz < 0 || gx > frame.w - 1 || gz > frame.h - 1) {
        out[j * n + i] = hole;
        continue;
      }
      const x0 = Math.min(Math.floor(gx), frame.w - 2);
      const z0 = Math.min(Math.floor(gz), frame.h - 2);
      const fx = gx - x0;
      const fz = gz - z0;
      const v = [at(x0, z0), at(x0 + 1, z0), at(x0, z0 + 1), at(x0 + 1, z0 + 1)];
      const w = [(1 - fx) * (1 - fz), fx * (1 - fz), (1 - fx) * fz, fx * fz];
      if (frame.hole !== null && v.some((x, k) => x === frame.hole && w[k] > 0)) {
        out[j * n + i] = hole;
        continue;
      }
      out[j * n + i] = Math.max(frame.hole === 0 ? 1 : 0, Math.round(v[0] * w[0] + v[1] * w[1] + v[2] * w[2] + v[3] * w[3]));
    }
  }
  return { data: out, w: n, h: n };
}

// ── The pack ──

const slug = (name) => last(name).replace(/[^a-z0-9_]+/g, '_');
const radius = (m) => Math.hypot(m.bounds[3] - m.bounds[0], m.bounds[4] - m.bounds[1], m.bounds[5] - m.bounds[2]) / 2;

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

// One far draw per mesh and side for a set of instances, sorted by cell
// within it, so the scene can hide the cells it draws closer up
function farList(inst, meshOf, cell) {
  const order = Array.from({ length: inst.count }, (_, i) => i);
  const keyOf = (i) => cellOf(inst.position[i * 3], inst.position[i * 3 + 2], cell);
  const mir = (i) => (inst.scale[i * 3] * inst.scale[i * 3 + 1] * inst.scale[i * 3 + 2] < 0 ? 1 : 0);
  order.sort((a, b) => meshOf[a] - meshOf[b] || mir(a) - mir(b) || keyOf(a)[0] - keyOf(b)[0] || keyOf(a)[1] - keyOf(b)[1] || a - b);
  const bin = new ArrayBuffer(inst.count * INSTANCE_BYTES);
  const v = new DataView(bin);
  const draws = [];
  let d = null;
  order.forEach((i, j) => {
    writeOne(v, j, inst, i);
    if (!d || d.mesh !== meshOf[i] || d.mirrored !== Boolean(mir(i))) draws.push((d = { mesh: meshOf[i], mirrored: Boolean(mir(i)), offset: j, count: 0, cells: {} }));
    const k = cellKey(...keyOf(i));
    d.cells[k] ??= [d.count, 0];
    d.cells[k][1]++;
    d.count++;
  });
  return { bin, draws };
}

export function buildPack({ world, mapName, map, spot, groundY, yaw = 0, meshes, arena = 1024, cell = CELL, rows = BUDGET_ROWS, subs = null, terrain = null, physics = {} }) {
  const idx = arenaOf(map, { subs });
  const all = rebase(subset(map.instances, idx), [spot[0], groundY, spot[1]], yaw);
  const meshOfAll = Int32Array.from(idx.map((i) => map.meshOf[i]));
  const inside = [];
  const outside = [];
  for (let i = 0; i < all.count; i++) (Math.abs(all.position[i * 3]) < arena && Math.abs(all.position[i * 3 + 2]) < arena ? inside : outside).push(i);
  const arenaInst = subset(all, inside);
  const arenaMesh = Int32Array.from(inside.map((i) => meshOfAll[i]));
  const horizonInst = subset(all, outside);
  const horizonMesh = Int32Array.from(outside.map((i) => meshOfAll[i]));
  const cells = cellsOf(arenaInst, arenaMesh, { cell, reach: (m, i) => radius(meshes[m]) * Math.max(...arenaInst.scale.subarray(i * 3, i * 3 + 3).map(Math.abs)) });
  const far = farList(arenaInst, arenaMesh, cell);
  const horizon = farList(horizonInst, horizonMesh, cell);

  // per tier: what the near window keeps, and what the far list keeps
  const tiers = Object.keys(rows);
  const keptNear = {};
  const keptFar = {};
  const table = {};
  const forFit = new Map([...cells].map(([k, c]) => [k, { draws: c.draws.map((d) => ({ mesh: d.mesh, count: d.indices.length, mirrored: d.mirrored, weight: weightOf(d, meshes[d.mesh]), tris: meshes[d.mesh].tris })) }]));
  const farFit = new Map([['0,0', { draws: [...far.draws, ...horizon.draws].map((d) => ({ mesh: d.mesh, count: d.count, mirrored: d.mirrored, weight: d.count * weightOf({ indices: [0] }, meshes[d.mesh]), tris: meshes[d.mesh].tris })) }]]);
  for (const tier of tiers) {
    const row = rows[tier];
    const b = bandsFor(row, cell);
    const near = cutFor('near', tier);
    const cost = (d, ring) => (ring <= b.nearRing ? { tris: d.tris[near], cut: near } : ring <= b.midRing ? { tris: d.tris.lod1, cut: 'lod1' } : null);
    const n = fitTo(forFit, row, { share: 0.7, radius: b.midRing, cost });
    const f = fitTo(farFit, row, { share: 0.2, radius: 0, cost: (d) => ({ tris: d.tris.far, cut: 'far' }) });
    keptNear[tier] = new Set([...n.kept.values()].flat().map((d) => d.mesh));
    keptFar[tier] = new Set(f.kept.get('0,0').map((d) => d.mesh));
    const named = (list) => list.map((d) => ({ name: meshes[d.mesh].name, count: d.count, tris: d.tris }));
    table[tier] = { dropped: named(n.dropped), farDropped: named(f.dropped) };
  }
  const lodNear = (mesh) => Object.fromEntries(tiers.map((t) => [t, keptNear[t].has(mesh) ? cutFor('near', t) : null]));
  const lodFar = (mesh) => Object.fromEntries(tiers.map((t) => [t, keptFar[t].has(mesh) ? 'far' : null]));

  const files = new Map();
  const jsonCells = {};
  for (const [key, c] of cells) {
    const { bin, draws } = packCell(c, arenaInst);
    const path = `cells/${key.replace(',', '_')}.bin`;
    files.set(path, bin);
    jsonCells[key] = { bin: path, bytes: bin.byteLength, bounds: c.bounds.map((v) => Math.round(v * 100) / 100), count: bin.byteLength / INSTANCE_BYTES, draws: draws.map((d) => ({ ...d, lod: lodNear(d.mesh) })) };
  }
  files.set('far.bin', far.bin);
  files.set('horizon.bin', horizon.bin);
  const json = sortKeys({
    world,
    map: mapName,
    origin: [spot[0], groundY, spot[1]],
    yaw,
    cell,
    arena,
    cells: jsonCells,
    far: { bin: 'far.bin', bytes: far.bin.byteLength, draws: far.draws.map((d) => ({ ...d, lod: lodFar(d.mesh) })) },
    horizon: { bin: 'horizon.bin', bytes: horizon.bin.byteLength, draws: horizon.draws.map(({ mesh, mirrored, offset, count }) => ({ mesh, mirrored, offset, count, lod: lodFar(mesh) })) },
    meshes: meshes.map((m) => ({ name: m.name, glb: m.glb ?? Object.fromEntries(['far', 'lod1', 'plain', 'ultra'].map((c) => [c, `meshes/${slug(m.name)}.${c}.glb`])), tris: m.tris, bounds: m.bounds, mats: m.mats ?? 1 })),
    terrain,
    shadowCache: null,
    physics,
  });
  return { json, files, table, counts: { arena: arenaInst.count, horizon: horizonInst.count, cells: cells.size } };
}

// ── The meshes ──

// A mesh's four cuts from its chain (phase 0's cutsFor for lod1 and plain):
// far the chain's last (its lightest: the game's own distant LOD), and where
// a chain is short, the nearest cut there is stands in
export function meshCuts(entry, { ultra = false } = {}) {
  const lods = [...entry.lods].sort((a, b) => a.lod - b.lod);
  const c = cutsFor(entry, { ultra });
  const far = lods[lods.length - 1];
  return { far, lod1: c.lod1 ?? (far.lod > c.plain.lod ? far : c.plain), plain: c.plain, ultra: c.ultra ?? c.plain };
}

// A GLB with its JSON chunk's image URIs mapped (the pack's meshes name its
// shared textures, not the bucket's paths); the binary chunk is untouched
export function rewriteImageUris(glb, fn) {
  const json = glbJson(glb);
  for (const img of json.images ?? []) if (img.uri && !img.uri.startsWith('data:')) img.uri = fn(img.uri);
  let text = Buffer.from(JSON.stringify(json), 'utf8');
  const pad = (4 - (text.length % 4)) % 4;
  if (pad) text = Buffer.concat([text, Buffer.alloc(pad, 0x20)]);
  const rest = glb.subarray(20 + glb.readUInt32LE(12));
  const head = Buffer.alloc(20);
  head.write('glTF', 0, 'ascii');
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + text.length + rest.length, 8);
  head.writeUInt32LE(text.length, 12);
  head.write('JSON', 16, 'ascii');
  return Buffer.concat([head, text, rest]);
}
