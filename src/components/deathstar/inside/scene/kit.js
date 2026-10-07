// The Imperial kit: every room aboard the Death Star is built from it, so
// the station reads as one place. Its materials by role (glossy black
// decks that mirror the room, mid-grey plating in deep-ribbed bays, the
// white light grids, light strips, consoles and their Aurebesh screens),
// each made once and shared; the panel maths that lays a wall out in rib
// bays round its doors and windows; the door frames and light grids; a
// room’s plain shell straight from the layout; and the merge that turns a
// room’s hundreds of parts into one mesh a material. Plating is painted at
// start by ../../plating.js at the device’s detail (lib/detail), so there is
// nothing to download.
//
// Pure (Node-tested, kit.test.js):
//   GRID: { w, h, y }   a wall light grid’s width, height and the height of its foot
//   panelLayout(w, h, { bay, rib, lights, every, holes, … }) → { bays, ribs, panels, lights }
//   solidRects(w, h, holes) → the rects of a w × h wall left round its holes
//   gridCells(w, h, cell) → { cols, rows }   a light grid’s whole squares
//   roomWalls(layout, roomId, openings) → [run]   a room’s walls side by side, holed by its doors
//     (and by `openings`, world rects such as windowsOf’s, framed as windows unless `frame: 'door'`);
//     run: { x0, z0, x1, z1, len, y0, y1,
//     angle, n, off, holes: [{ x0, x1, y0, y1, door? }] } in the run’s own metres from its start
//   windowsOf(room, layout) → [{ x0, z0, x1, z1, y0, y1 }]   a control room’s windows onto its bay
//   flights(room) → [[floor]]   a room’s raised floors, joined into flights of steps
//   groupByMaterial(parts) → Map<material, [part]>;  mergeParts(parts, resolve) → Group
//
// createKit(renderer, { tier, small }) → kit
//   kit.mat(role)   'floor' 'wall' 'trim' 'grid' 'strip' 'ceiling' 'console' 'screen' 'glass'
//                   'red' 'rail' 'grate' 'black' (shared: never change one, ask for another)
//   kit.panelWall(w, h, opts) → parts   a wall along +x from 0 to w, facing +z, its foot at y 0
//   kit.lightGrid(w, h) → parts          centred on the origin, facing +z
//   kit.doorFrame(w, h, { kind }) → parts   the opening centred on x 0, standing on y 0
//   kit.shell(room, layout, opts) → parts   floor, ceiling, walls and door frames, in world space
//   kit.box(w, h, d, x, y, z, role), kit.plate(w, h, x, y, z, role, face), kit.beam(a, b, w, h, role),
//   kit.post(r, x, y0, y1, z, role), kit.place(parts, matrix), kit.at(x, y, z, turn) → Matrix4
//   kit.merge(parts) → Group (one mesh a material);  kit.free(group) (its geometry)
//   kit.update(t) (the screens);  kit.dispose()
// A part is { geo, mat }: a BufferGeometry and a role or a material.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { detailLevel, texScale } from '../../../../lib/detail';
import { seeded } from '../../../../lib/seeded';
import { detailCanvas, sharpen } from '../../../../lib/three/textures';
import { paintPlating } from '../../plating';

const EPS = 1e-6;
// a wall light grid: its width, height and the height of its foot
export const GRID = { w: 1.1, h: 1.5, y: 0.7 };

// ── the panel maths ──

const nonEmpty = (r) => r.x1 - r.x0 > EPS && r.y1 - r.y0 > EPS;
const hits = (a, b) => a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;

// A rect less the holes in it, as rects (kept with the rect’s other fields),
// cut into columns at the holes' edges and joined again where neighbours
// span the same heights.
function subtract(rect, holes) {
  const hs = holes.map((h) => ({ x0: Math.max(h.x0, rect.x0), x1: Math.min(h.x1, rect.x1), y0: Math.max(h.y0, rect.y0), y1: Math.min(h.y1, rect.y1) })).filter(nonEmpty);
  if (!hs.length) return [{ ...rect }];
  const xs = [...new Set([rect.x0, rect.x1, ...hs.flatMap((h) => [h.x0, h.x1])])].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const [a, b] = [xs[i], xs[i + 1]];
    if (b - a < EPS) continue;
    const cover = hs.filter((h) => h.x0 <= a + EPS && h.x1 >= b - EPS).sort((p, q) => p.y0 - q.y0);
    let y = rect.y0;
    for (const c of cover) {
      if (c.y0 > y + EPS) out.push({ ...rect, x0: a, x1: b, y0: y, y1: c.y0 });
      y = Math.max(y, c.y1);
    }
    if (rect.y1 > y + EPS) out.push({ ...rect, x0: a, x1: b, y0: y, y1: rect.y1 });
  }
  const joined = [];
  for (const r of out) {
    const last = joined.find((j) => Math.abs(j.y0 - r.y0) < EPS && Math.abs(j.y1 - r.y1) < EPS && Math.abs(j.x1 - r.x0) < EPS);
    if (last) last.x1 = r.x1;
    else joined.push(r);
  }
  return joined;
}

export const solidRects = (w, h, holes = []) => subtract({ x0: 0, x1: w, y0: 0, y1: h }, holes);

export const gridCells = (w, h, cell = 0.16) => ({ cols: Math.max(1, Math.round(w / cell)), rows: Math.max(1, Math.round(h / cell)) });

// A wall’s bays, the ribs between them and the panels in each: a kick
// plate at the foot, a band at the head, and between them panels stacked no
// taller than `tall`. A lit wall has a light grid every `every` metres,
// centred on the wall so that facing walls light alike, each in a bay of its
// own with plain bays either side where there is room. Whatever a hole (a
// doorway, a window) covers is left out: a rib across a door stands on
// above it, and a light grid in its way is dropped.
export function panelLayout(w, h, { bay = 2, rib = 0.28, gap = 0.05, kick = 0.32, band = 0.45, tall = 2.6, lights = false, every = 4, grid = GRID, holes = [] } = {}) {
  const short = w < bay * 0.75;
  const lightW = grid.w + rib + gap * 2;
  const lit = lights && !short && w >= lightW && h >= grid.y + grid.h + band;
  const bays = [];
  const plain = (a, b) => {
    if (b - a < EPS) return;
    const n = Math.max(1, Math.round((b - a) / bay));
    for (let i = 0; i < n; i++) bays.push({ x0: a + ((b - a) * i) / n, x1: i === n - 1 ? b : a + ((b - a) * (i + 1)) / n, light: false });
  };
  const centres = [];
  if (short) bays.push({ x0: 0, x1: w, light: false });
  else if (!lit) plain(0, w);
  else {
    const m = Math.max(1, Math.floor(w / every + EPS));
    let at = 0;
    for (let j = 0; j < m; j++) {
      const c = w / 2 + (j - (m - 1) / 2) * every;
      centres.push(c);
      // an end too short for a bay of its own joins the period beside it
      let p0 = Math.max(0, c - every / 2);
      let p1 = Math.min(w, c + every / 2);
      if (j === 0 && p0 < bay * 0.5) p0 = 0;
      if (j === m - 1 && w - p1 < bay * 0.5) p1 = w;
      plain(at, p0);
      const l0 = c - lightW / 2 - p0 >= bay * 0.5 ? c - lightW / 2 : p0;
      const l1 = p1 - (c + lightW / 2) >= bay * 0.5 ? c + lightW / 2 : p1;
      plain(p0, l0);
      bays.push({ x0: l0, x1: l1, light: true });
      plain(l1, p1);
      at = p1;
    }
    plain(at, w);
  }
  // ribs on every bay edge, the end ones kept inside the wall
  const edges = short ? [] : [...new Set([bays[0].x0, ...bays.map((b) => b.x1)])];
  const ribAt = (x) => {
    const x0 = Math.max(0, Math.min(x - rib / 2, w - rib));
    return { x0, x1: Math.min(w, x0 + rib) };
  };
  const ribs = edges.flatMap((x) => subtract({ ...ribAt(x), y0: 0, y1: h }, holes)).filter((r) => r.y1 - r.y0 > 0.05);
  const panels = [];
  const lightsOut = [];
  const top = h >= kick + band + 0.6 ? h - band : h;
  const stack = (x0, x1, y0, y1) => {
    const H = y1 - y0;
    if (H < 0.12 || x1 - x0 < 0.12) return;
    const n = Math.ceil((H + gap) / (tall + gap) - EPS);
    const ph = (H - (n - 1) * gap) / n;
    for (let i = 0; i < n; i++) panels.push({ x0, x1, y0: y0 + i * (ph + gap), y1: y0 + i * (ph + gap) + ph, kind: 'panel' });
  };
  bays.forEach((b, i) => {
    const in0 = short ? 0 : ribAt(b.x0).x1;
    const in1 = short ? w : ribAt(b.x1).x0;
    if (in1 - in0 < 0.1) return;
    panels.push({ x0: in0, x1: in1, y0: 0, y1: Math.min(kick, h), kind: 'kick' });
    if (top < h) panels.push({ x0: in0, x1: in1, y0: top, y1: h, kind: 'band' });
    const [x0, x1] = [in0 + gap, in1 - gap];
    const c = b.light ? centres.find((cc) => cc >= b.x0 - EPS && cc <= b.x1 + EPS) : undefined;
    if (c === undefined) return stack(x0, x1, kick + gap, top - gap);
    const lw = Math.min(grid.w, 2 * Math.min(c - x0, x1 - c) - 2 * gap);
    lightsOut.push({ x: c, y: grid.y, w: lw, h: grid.h, bay: i });
    stack(x0, x1, kick + gap, grid.y - gap);
    stack(x0, x1, grid.y + grid.h + gap, top - gap);
  });
  return {
    bays: bays.map((b) => ({ x0: b.x0, x1: b.x1, light: b.light })),
    ribs,
    panels: panels.filter(nonEmpty).flatMap((p) => subtract(p, holes)).filter((p) => p.x1 - p.x0 > 0.05 && p.y1 - p.y0 > 0.05),
    lights: lightsOut.filter((l) => !holes.some((hh) => hits({ x0: l.x - l.w / 2, x1: l.x + l.w / 2, y0: l.y, y1: l.y + l.h }, hh))),
  };
}

// ── the layout, side by side ──

// A room’s wall pieces joined into runs, one a straight stretch of wall,
// with each doorway (and every opening given) as a hole in its run.
export function roomWalls(layout, id, openings = []) {
  const runs = [];
  for (const p of layout.walls) {
    if (p.room !== id) continue;
    const len = Math.hypot(p.x1 - p.x0, p.z1 - p.z0);
    if (len < EPS) continue;
    const d = { x: (p.x1 - p.x0) / len, z: (p.z1 - p.z0) / len };
    const n = { x: -d.z || 0, z: d.x || 0 };
    const off = n.x * p.x0 + n.z * p.z0;
    let run = runs.find((r) => Math.abs(r.d.x - d.x) < EPS && Math.abs(r.d.z - d.z) < EPS && Math.abs(r.off - off) < 1e-4);
    if (!run) runs.push((run = { d, n, off, o: { x: p.x0, z: p.z0 }, pieces: [] }));
    const t0 = (p.x0 - run.o.x) * d.x + (p.z0 - run.o.z) * d.z;
    run.pieces.push({ ...p, t0, t1: t0 + len });
  }
  const out = [];
  for (const run of runs) {
    // a line may hold stretches that don’t meet: each is a run of its own
    const pieces = run.pieces.sort((a, b) => a.t0 - b.t0);
    const groups = [];
    for (const p of pieces) {
      const g = groups.at(-1);
      if (g && p.t0 <= g.t1 + 1e-4) {
        g.list.push(p);
        g.t1 = Math.max(g.t1, p.t1);
      } else groups.push({ t0: p.t0, t1: p.t1, list: [p] });
    }
    for (const g of groups) {
      const y0 = Math.min(...g.list.map((p) => p.y0));
      const y1 = Math.max(...g.list.map((p) => p.y1));
      const at = (t) => ({ x: run.o.x + run.d.x * t, z: run.o.z + run.d.z * t });
      const [a, b] = [at(g.t0), at(g.t1)];
      const holes = g.list.filter((p) => p.door).map((p) => ({ x0: p.t0 - g.t0, x1: p.t1 - g.t0, y0: p.y0 - y0, y1: p.y1 - y0, door: p.door }));
      const len = g.t1 - g.t0;
      for (const o of openings) {
        const on = (x, z) => Math.abs(run.n.x * x + run.n.z * z - run.off) < 0.05;
        if (!on(o.x0, o.z0) || !on(o.x1, o.z1)) continue;
        const ta = (o.x0 - a.x) * run.d.x + (o.z0 - a.z) * run.d.z;
        const tb = (o.x1 - a.x) * run.d.x + (o.z1 - a.z) * run.d.z;
        const hole = { x0: Math.max(0, Math.min(ta, tb)), x1: Math.min(len, Math.max(ta, tb)), y0: o.y0 - y0, y1: o.y1 - y0, ...(o.frame ? { frame: o.frame } : {}) };
        if (hole.x1 - hole.x0 > EPS) holes.push(hole);
      }
      out.push({ x0: a.x, z0: a.z, x1: b.x, z1: b.z, len, y0, y1, angle: Math.atan2(-run.d.z, run.d.x), n: run.n, off: run.off, holes });
    }
  }
  return out;
}

// A control room’s windows: along each of its walls that a bay’s wall
// backs onto, either side of the doors there, sill to head. Both rooms cut
// them (roomWalls' openings), so the office glows over the bay.
export function windowsOf(room, layout, { sill = 1, head = 0.45, clear = 0.45, min = 1.2 } = {}) {
  if (room?.kind !== 'control') return [];
  const out = [];
  const bays = [...layout.rooms.values()].filter((r) => r.kind === 'hangar');
  for (const run of roomWalls(layout, room.id)) {
    const alongX = Math.abs(run.n.x) < EPS;
    const at = alongX ? run.z0 : run.x0;
    const span = alongX ? [Math.min(run.x0, run.x1), Math.max(run.x0, run.x1)] : [Math.min(run.z0, run.z1), Math.max(run.z0, run.z1)];
    const bay = bays.find((b) => {
      const edge = alongX ? [b.box.z0, b.box.z1] : [b.box.x0, b.box.x1];
      const [s0, s1] = alongX ? [b.box.x0, b.box.x1] : [b.box.z0, b.box.z1];
      return edge.some((e) => Math.abs(e - at) < 0.01) && s0 < span[1] && s1 > span[0];
    });
    if (!bay) continue;
    // the free stretches: clear of the corners and of every doorway
    const blocked = run.holes.map((h) => [h.x0 - clear, h.x1 + clear]).sort((p, q) => p[0] - q[0]);
    let t = clear;
    const free = [];
    for (const [b0, b1] of blocked) {
      if (b0 > t) free.push([t, b0]);
      t = Math.max(t, b1);
    }
    if (run.len - clear > t) free.push([t, run.len - clear]);
    const point = (s) => ({ x: run.x0 + ((run.x1 - run.x0) * s) / run.len, z: run.z0 + ((run.z1 - run.z0) * s) / run.len });
    for (const [f0, f1] of free) {
      if (f1 - f0 < min) continue;
      const [p, q] = [point(f0), point(f1)];
      out.push({ x0: p.x, z0: p.z, x1: q.x, z1: q.z, y0: room.y + sill, y1: room.y + room.h - head });
    }
  }
  return out;
}

const areaOf = (f) => (f.x1 - f.x0) * (f.z1 - f.z0);
const touch = (a, b) => {
  const xs = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const zs = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
  return (Math.abs(xs) < 1e-3 && zs > 1e-3) || (Math.abs(zs) < 1e-3 && xs > 1e-3);
};

// The floors raised off a room’s deck (its biggest floor), joined where one
// touches the next within a step: each group a flight (a stair with its
// landing, a ramp), in the room’s own order.
export function flights(room, { step = 0.41 } = {}) {
  if (!room?.floors?.length) return [];
  const deck = room.floors.reduce((a, f) => (areaOf(f) > areaOf(a) ? f : a));
  const rest = room.floors.filter((f) => f !== deck);
  const root = rest.map((_, i) => i);
  const find = (i) => (root[i] === i ? i : (root[i] = find(root[i])));
  for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) if (Math.abs(rest[i].y - rest[j].y) <= step && touch(rest[i], rest[j])) root[find(i)] = find(j);
  const groups = new Map();
  rest.forEach((f, i) => {
    const k = find(i);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  });
  return [...groups.values()];
}

// ── merging ──

const drawable = (g) => g?.attributes?.position?.count > 0;

export function groupByMaterial(parts) {
  const groups = new Map();
  for (const p of parts) {
    if (!p || !drawable(p.geo) || !p.mat) continue;
    if (!groups.has(p.mat)) groups.set(p.mat, []);
    groups.get(p.mat).push(p);
  }
  return groups;
}

const KEEP = ['position', 'normal', 'uv'];

// uvs from where each vertex is, `tile` metres to a repeat, projected along
// the way its face faces, so plating keeps its size on any wall or deck
function worldUV(g, tile) {
  const p = g.attributes.position.array;
  const n = g.attributes.normal.array;
  const uv = g.attributes.uv.array;
  for (let i = 0, j = 0; i < p.length; i += 3, j += 2) {
    const [ax, ay, az] = [Math.abs(n[i]), Math.abs(n[i + 1]), Math.abs(n[i + 2])];
    if (ay >= ax && ay >= az) [uv[j], uv[j + 1]] = [p[i] / tile, p[i + 2] / tile];
    else if (ax >= az) [uv[j], uv[j + 1]] = [p[i + 2] / tile, p[i + 1] / tile];
    else [uv[j], uv[j + 1]] = [p[i] / tile, p[i + 1] / tile];
  }
  g.attributes.uv.needsUpdate = true;
}

// One mesh a material: every part’s geometry brought to position, normal
// and uv (all indexed, or none where any isn’t), world uvs where the
// material tiles, then merged. The parts' geometries are used up.
export function mergeParts(parts, resolve = (m) => m) {
  const group = new THREE.Group();
  for (const [key, list] of groupByMaterial(parts)) {
    const mat = resolve(key);
    const flat = list.some((p) => !p.geo.index);
    const geos = list.map(({ geo }) => {
      let g = flat && geo.index ? geo.toNonIndexed() : geo;
      if (g !== geo) geo.dispose();
      for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.morphAttributes = {};
      return g;
    });
    if (mat?.userData?.tile) for (const g of geos) worldUV(g, mat.userData.tile);
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = mat?.name ?? '';
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  return group;
}

// ── painted maps ──

// One square of a wall light grid, tiled across the grid by its uvs: a lit
// cell in a dark border, so a grid reads as rows of lamps and mips to a glow.
function paintCell(level) {
  const { canvas, ctx } = detailCanvas(64, 64, { level });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 64, 64);
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.7, '#e6eefa');
  g.addColorStop(1, '#93a1b6');
  ctx.fillStyle = g;
  ctx.fillRect(11, 11, 42, 42);
  return canvas;
}

// A console’s face: rows of small buttons, some lit red, green, amber, white or blue.
function paintButtons(level, max) {
  const { canvas, ctx } = detailCanvas(256, 128, { level, max });
  const rand = seeded(31);
  const lit = ['#ff3b2e', '#3cff7a', '#ffb43c', '#e8f0ff', '#4ab4ff'];
  ctx.fillStyle = '#08090b';
  ctx.fillRect(0, 0, 256, 128);
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 14; col++) {
      ctx.fillStyle = rand() < 0.55 ? lit[Math.floor(rand() * lit.length)] : '#1a1d23';
      ctx.fillRect(10 + col * 17, 10 + row * 16, 11, 8);
    }
  }
  return canvas;
}

// A walkway grating’s see-through squares, as an alpha map.
function paintGrate(level) {
  const { canvas, ctx } = detailCanvas(64, 64, { level });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(i * 16, 0, 5, 64);
    ctx.fillRect(0, i * 16, 64, 5);
  }
  return canvas;
}

// Letters in the manner of Aurebesh, made up here: each a few straight
// strokes between the points of a 3 × 3 grid, so screens read as Imperial
// text without borrowing a typeface.
const POINTS = [[0, 0], [1, 0], [2, 0], [0, 1.5], [1, 1.5], [2, 1.5], [0, 3], [1, 3], [2, 3]];
function makeGlyphs(rand, n = 26) {
  return Array.from({ length: n }, () =>
    Array.from({ length: 2 + Math.floor(rand() * 3) }, () => {
      const a = Math.floor(rand() * 9);
      const b = (a + 1 + Math.floor(rand() * 8)) % 9;
      return [POINTS[a], POINTS[b]];
    }),
  );
}

// A screen at time t: a log scrolling up a line every third of a second, a
// red line now and then, and a wireframe with a sweeping arm.
function drawScreen(ctx, w, h, t, glyphs) {
  ctx.fillStyle = '#020806';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(80,255,170,0.16)';
  ctx.fillRect(0, 0, w, 16);
  const scroll = Math.floor(t / 0.35);
  ctx.lineWidth = 1.5;
  for (let r = 0; r < 11; r++) {
    const rand = seeded((r + scroll) * 7919 + 13);
    ctx.strokeStyle = rand() < 0.08 ? '#ff5a48' : r === 10 ? '#d8fff0' : '#5dffb0';
    ctx.beginPath();
    const y = 26 + r * 20;
    let x = 10;
    while (x < w * 0.6) {
      const word = 2 + Math.floor(rand() * 5);
      for (let k = 0; k < word && x < w * 0.6; k++, x += 10) {
        for (const [[ax, ay], [bx, by]] of glyphs[Math.floor(rand() * glyphs.length)]) {
          ctx.moveTo(x + ax * 3, y + ay * 3.4);
          ctx.lineTo(x + bx * 3, y + by * 3.4);
        }
      }
      x += 9;
    }
    ctx.stroke();
  }
  const [cx, cy, rr] = [w * 0.8, h * 0.56, h * 0.3];
  ctx.strokeStyle = 'rgba(93,255,176,0.85)';
  ctx.beginPath();
  ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  ctx.moveTo(cx - rr, cy);
  ctx.lineTo(cx + rr, cy);
  ctx.moveTo(cx - rr * 0.08, cy - rr * 0.42);
  ctx.arc(cx - rr * 0.36, cy - rr * 0.42, rr * 0.28, 0, Math.PI * 2);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(t * 1.3) * rr, cy + Math.sin(t * 1.3) * rr);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
}

// ── the kit ──

// how far each kind of door’s frame stands out from its wall: [width, depth]
const FRAME = { slide: [0.22, 0.14], blast: [0.42, 0.28], hatch: [0.18, 0.12], arch: [1.2, 1.4] };

export function createKit(renderer, { tier = 'high', small = false } = {}) {
  // (the device’s own detail on a high tier, which may be ultra; the tier’s otherwise)
  const level = tier === 'high' ? detailLevel() : tier;
  const max = small ? 512 : Infinity;
  const size = (design) => Math.round(design * texScale(design, { level, max }));
  const textures = [];
  const tex = (canvas, color) => {
    const t = sharpen(new THREE.CanvasTexture(canvas), { renderer, color, wrap: true });
    textures.push(t);
    return t;
  };
  // the walls' plating (big plates, no pipes); the ceiling’s (pipe runs, as conduits overhead)
  const wallP = paintPlating({ seed: 11, size: size(1024), kind: 'surface' });
  const ceilP = paintPlating({ seed: 29, size: size(512), kind: 'wall' });
  const plating = { map: tex(wallP.color, true), normal: tex(wallP.normal, false), rough: tex(wallP.rough, false) };
  const ceiling = { map: tex(ceilP.color, true), normal: tex(ceilP.normal, false) };
  const screen = detailCanvas(512, 256, { level, max: small ? 256 : 512 });
  const screenTex = tex(screen.canvas, true);
  const glyphs = makeGlyphs(seeded(7));
  drawScreen(screen.ctx, 512, 256, 0, glyphs);

  const made = new Map();
  // `tile`: metres to a repeat of its map, laid by where it is (merge);
  // `reflect`: takes its room’s reflection probe (probe.js)
  const std = (role, opts, data = {}) => {
    const m = new THREE.MeshStandardMaterial(opts);
    m.name = `ds-${role}`;
    m.userData = { role, tile: 0, reflect: false, ...data };
    made.set(role, m);
  };
  // the deck: near black and glossy, its seams only in the normal and the roughness
  std('floor', { color: 0x07080a, roughness: 0.2, roughnessMap: plating.rough, metalness: 0.3, normalMap: plating.normal, normalScale: new THREE.Vector2(0.3, 0.3) }, { tile: 8, reflect: true });
  // a colour over one, since the painted plating is dark and the walls are
  // mid-grey; a 6 m repeat, since any finer and the plating’s own seams
  // fight the wall’s panels
  std('wall', { color: new THREE.Color(1.5, 1.5, 1.5), map: plating.map, normalMap: plating.normal, roughnessMap: plating.rough, roughness: 0.8, metalness: 0.35, envMapIntensity: 0.6 }, { tile: 6, reflect: true });
  std('trim', { color: 0x2b2f35, roughness: 0.36, metalness: 0.6, envMapIntensity: 0.6 }, { reflect: true });
  std('grid', { color: 0x0b0c0f, roughness: 0.3, metalness: 0, emissive: 0xe2ecff, emissiveIntensity: 2.6, emissiveMap: tex(paintCell(level), true) });
  std('strip', { color: 0x101114, roughness: 0.3, metalness: 0, emissive: 0xe8f1ff, emissiveIntensity: 3.4 });
  std('ceiling', { color: 0x8a9098, map: ceiling.map, normalMap: ceiling.normal, roughness: 0.82, metalness: 0.3, envMapIntensity: 0.4 }, { tile: 4, reflect: true });
  std('console', { color: 0x1f232a, roughness: 0.4, metalness: 0.45, emissive: 0xffffff, emissiveIntensity: 1.4, emissiveMap: tex(paintButtons(level, max), true), envMapIntensity: 0.6 }, { reflect: true });
  std('screen', { color: 0x000000, roughness: 0.22, metalness: 0, emissive: 0xffffff, emissiveIntensity: 1.6, emissiveMap: screenTex });
  // faintly lit from within, so an office window glows over a dark bay
  std('glass', { color: 0x1c2a33, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide, emissive: 0x6d8fb4, emissiveIntensity: 0.22 }, { reflect: true });
  std('red', { color: 0x140404, roughness: 0.4, metalness: 0, emissive: 0xff2a18, emissiveIntensity: 2.6 });
  std('rail', { color: 0x7d838b, roughness: 0.26, metalness: 0.85, envMapIntensity: 0.8 }, { reflect: true });
  std('grate', { color: 0x3b4047, roughness: 0.5, metalness: 0.7, alphaMap: tex(paintGrate(level), false), alphaTest: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.6 }, { tile: 0.6, reflect: true });
  std('black', { color: 0x050506, roughness: 0.65, metalness: 0.2, envMapIntensity: 0.3 }, { reflect: true });

  const mat = (role) => {
    if (role?.isMaterial) return role;
    const m = made.get(role);
    if (!m) throw new Error(`the Imperial kit has no ${role}`);
    return m;
  };

  const box = (w, h, d, x, y, z, role) => ({ geo: new THREE.BoxGeometry(w, h, d).translate(x, y, z), mat: role });
  // a flat face, w × h, centred on x, y, z: facing +z ('front'), up or down
  // (for 'up' and 'down', w runs along x and h along z)
  const plate = (w, h, x, y, z, role, face = 'front') => {
    const g = new THREE.PlaneGeometry(w, h);
    if (face === 'up') g.rotateX(-Math.PI / 2);
    else if (face === 'down') g.rotateX(Math.PI / 2);
    return { geo: g.translate(x, y, z), mat: role };
  };
  const rect = (r, z0, depth, role) => box(r.x1 - r.x0, r.y1 - r.y0, depth, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, z0 + depth / 2, role);
  const place = (parts, m) => {
    for (const p of parts) p.geo.applyMatrix4(m);
    return parts;
  };
  const at = (x, y, z, turn = 0) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(turn));
  // a bar from a to b ({ x, y, z }), w across and h deep, kept as upright as
  // it can be: stringers, rails, braces, a ramp
  const beam = (a, b, w, h, role) => {
    const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
    const len = dir.length();
    dir.divideScalar(len || 1);
    const up = Math.abs(dir.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const y = up.sub(dir.clone().multiplyScalar(up.dot(dir))).normalize();
    const m = new THREE.Matrix4().makeBasis(dir, y, new THREE.Vector3().crossVectors(dir, y)).setPosition((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return { geo: new THREE.BoxGeometry(len, h, w).applyMatrix4(m), mat: role };
  };
  // an upright round post, r across, from y0 to y1
  const post = (r, x, y0, y1, z, role, sides = 12) => ({ geo: new THREE.CylinderGeometry(r, r, y1 - y0, sides).translate(x, (y0 + y1) / 2, z), mat: role });

  // the squares in their recessed frame, standing just proud of the wall
  const lightGrid = (w, h) => {
    const f = 0.07;
    const { cols, rows } = gridCells(w, h);
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * cols, uv.getY(i) * rows);
    return [
      { geo: g.translate(0, 0, 0.012), mat: 'grid' },
      box(w + f * 2, f, 0.06, 0, h / 2 + f / 2, 0.03, 'trim'),
      box(w + f * 2, f, 0.06, 0, -h / 2 - f / 2, 0.03, 'trim'),
      box(f, h, 0.06, -(w / 2 + f / 2), 0, 0.03, 'trim'),
      box(f, h, 0.06, w / 2 + f / 2, 0, 0.03, 'trim'),
    ];
  };

  // The wall’s seams and recesses are its black back; the ribs stand
  // `ribDepth` proud with a groove down each, the panels a little, a few
  // sunk for variety, the kick plate and head band more.
  const panelWall = (w, h, { seed = 1, ribDepth = 0.14, ...opts } = {}) => {
    const lay = panelLayout(w, h, opts);
    const rand = seeded(seed);
    const parts = solidRects(w, h, opts.holes ?? []).map((r) => plate(r.x1 - r.x0, r.y1 - r.y0, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 0, 'black'));
    for (const r of lay.ribs) {
      parts.push(rect(r, 0, ribDepth, 'wall'));
      const [c, g] = [(r.x0 + r.x1) / 2, (r.x1 - r.x0) * 0.14];
      parts.push(rect({ x0: c - g, x1: c + g, y0: r.y0, y1: r.y1 }, ribDepth, 0.012, 'trim'));
    }
    for (const p of lay.panels) {
      if (p.kind === 'kick') parts.push(rect(p, 0, 0.07, 'trim'));
      else if (p.kind === 'band') parts.push(rect(p, 0, 0.09, 'trim'));
      else if (rand() < 0.12) parts.push(rect(p, 0, 0.015, 'trim'));
      else parts.push(rect(p, 0, 0.035, 'wall'));
    }
    for (const l of lay.lights) parts.push(...place(lightGrid(l.w, l.h), at(l.x, l.y + l.h / 2, 0)));
    return parts;
  };

  // jambs, lintel and sill on this side of the doorway; a blast door’s
  // warning light over it; the bay’s mouth lit down its edges
  const doorFrame = (w, h, { kind = 'slide' } = {}) => {
    const [fw, fd] = FRAME[kind] ?? FRAME.slide;
    const parts = [
      box(fw, h + fw, fd, -(w / 2 + fw / 2), (h + fw) / 2, fd / 2, 'trim'),
      box(fw, h + fw, fd, w / 2 + fw / 2, (h + fw) / 2, fd / 2, 'trim'),
      box(w, fw, fd, 0, h + fw / 2, fd / 2, 'trim'),
      box(w, 0.02, fd, 0, 0.01, fd / 2, 'black'),
    ];
    if (kind === 'blast') parts.push(box(w * 0.5, 0.08, 0.04, 0, h + fw + 0.08, 0.02, 'red'));
    if (kind === 'arch') for (const s of [-1, 1]) parts.push(box(0.14, h, 0.06, s * (w / 2 + 0.12), h / 2, fd + 0.03, 'strip'));
    return parts;
  };

  const windowFrame = (w, h) => {
    const [f, d] = [0.1, 0.1];
    return [
      box(w + f * 2, f, d, 0, -f / 2, d / 2, 'trim'),
      box(w + f * 2, f, d, 0, h + f / 2, d / 2, 'trim'),
      box(f, h, d, -(w / 2 + f / 2), h / 2, d / 2, 'trim'),
      box(f, h, d, w / 2 + f / 2, h / 2, d / 2, 'trim'),
      box(w + f * 2, 0.05, 0.24, 0, -f - 0.025, 0.12, 'trim'),
    ];
  };

  // A room’s plain shell from the layout: its floors, its ceiling, every
  // wall laid out in bays round its doorways (framed) and openings (framed
  // as windows, or as doors where they say so). The rest is its builder’s.
  const shell = (room, layout, { floor = true, ceiling: lid = true, openings = [], seed = 1, ...wall } = {}) => {
    const parts = [];
    if (floor) for (const f of room.floors) parts.push(plate(f.x1 - f.x0, f.z1 - f.z0, (f.x0 + f.x1) / 2, f.y, (f.z0 + f.z1) / 2, 'floor', 'up'));
    if (lid) parts.push(plate(room.box.x1 - room.box.x0, room.box.z1 - room.box.z0, room.x, room.y + room.h, room.z, 'ceiling', 'down'));
    roomWalls(layout, room.id, openings).forEach((run, i) => {
      // the bays keep clear of each frame, not just of its opening
      const clear = run.holes.map((h) => {
        const kind = h.door ? layout.doors.get(h.door)?.kind : h.frame === 'door' ? 'slide' : null;
        const f = kind ? (FRAME[kind] ?? FRAME.slide)[0] : 0.1;
        return { ...h, x0: h.x0 - f, x1: h.x1 + f, y0: kind ? h.y0 : h.y0 - f, y1: h.y1 + f };
      });
      const local = panelWall(run.len, run.y1 - run.y0, { ...wall, holes: clear, seed: seed * 31 + i });
      for (const h of run.holes) {
        const door = h.door ? layout.doors.get(h.door) : null;
        const kind = door?.kind ?? (h.frame === 'door' ? 'slide' : null);
        const frame = kind ? doorFrame(h.x1 - h.x0, h.y1 - h.y0, { kind }) : windowFrame(h.x1 - h.x0, h.y1 - h.y0);
        local.push(...place(frame, at((h.x0 + h.x1) / 2, h.y0, 0)));
      }
      parts.push(...place(local, at(run.x0, run.y0, run.z0, run.angle)));
    });
    return parts;
  };

  let drawn = 0;
  return {
    tier,
    level,
    small,
    mat,
    box,
    plate,
    place,
    at,
    beam,
    post,
    lightGrid,
    panelWall,
    doorFrame,
    windowFrame,
    shell,
    merge: (parts) => mergeParts(parts.map((p) => (p ? { geo: p.geo, mat: mat(p.mat) } : p))),
    // a merged room’s geometry freed (the kit’s materials stay, shared)
    free: (root) => root?.traverse((o) => o.geometry?.dispose()),
    // the screens' log moves on a line at a time, however many rooms ask
    update(t) {
      if (t - drawn < 0.3 && t >= drawn) return;
      drawn = t;
      drawScreen(screen.ctx, 512, 256, t, glyphs);
      screenTex.needsUpdate = true;
    },
    dispose() {
      for (const m of made.values()) m.dispose();
      for (const t of textures) t.dispose();
      made.clear();
    },
  };
}
