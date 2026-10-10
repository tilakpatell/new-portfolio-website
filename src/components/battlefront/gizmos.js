// The gizmo overlay (the galaxy-on-the-game design's decision 8, lane G6):
// what the sim reads from the level's layer, drawn in the world so it can
// be held against the game's: the mode's spawns (a post and a tick toward
// its yaw, in its team's colour), spawn areas (outlines on the ground),
// volumes (prisms and boxes), capture points (rings), out-of-bounds volumes
// (red), the walker and AI paths, the cameras (frusta), each labelled with
// its id through the HUD's marker projection. On with ?gizmos=1 or
// world.do('gizmos', true).
//
// Lines only, one LineSegments a kind on a LineBasicMaterial: the node
// renderer takes it as its node material; nothing here is GLSL
// (src/runtime/shading.test.js reads this folder).
//
//   gizmoRows(map, mode) → { spawns, areas, volumes, captures, oob, paths, cameras }
//   createGizmos(scene, map, mode, { on, heightAt })
//     → { group, counts, legend(), labels(camera, size, { max }), set(on), dispose() }

import * as THREE from 'three';
import { markerProjection } from './hud/widgets.js';

// the layers a mode reads (the spec's decision 5; the same table as
// scripts/lib/bf2017-parity.mjs, whose test holds the two together)
const LAYER_MODES = [
  [/^FantasyBattle/, 'galacticAssault'],
  [/^(HeroArena|HeroesVsVillains)/, 'hvv'],
  [/^TeamDeathmatch_Skirmish/, 'arcade'],
  [/^(TeamDeathmatch|Blast)/, 'blast'],
  [/^(PlanetaryMissions|Domination)/, 'strike'],
  [/^(Mode9|ModeDefend)/, 'coop'],
  [/^Mode6/, 'showdown'],
  [/^Mode1(_|$)/, 'supremacy'],
  [/^(Extraction|Mode5|Mode2)/, 'extraction'],
  [/^Mode3/, 'ewokHunt'],
  [/^ModeC/, 'jetpackCargo'],
  [/^SpaceBattle/, 'starfighter'],
];
export const modeOfLayer = (layer, tagged = null) => LAYER_MODES.find(([re]) => re.test(layer ?? ''))?.[1] ?? tagged;

export const KINDS = ['spawns', 'areas', 'volumes', 'captures', 'oob', 'paths', 'cameras'];
export const COLOURS = {
  'spawns-1': 0x3d8bff, // the light side's blue (the HUD's friend)
  'spawns-2': 0xff8a2a, // the dark side's orange
  'spawns-0': 0xdddddd,
  areas: 0x6fe38a,
  volumes: 0xf2e14c,
  captures: 0x4ce8f2,
  oob: 0xff2a2a,
  paths: 0xd77bff,
  cameras: 0xffffff,
};
const POST = 2.5; // m: a spawn's post
const TICK = 1.6; // m: its tick toward the yaw
const RING = 32; // segments a capture ring
const FRUSTUM = 8; // m: a camera's frustum drawn this deep
const LIFT = 0.3; // m over the ground an outline is drawn
const LABELS = 40; // labels at most

export function gizmoRows(map, mode) {
  const mine = (rows) => (rows ?? []).filter((r) => modeOfLayer(r.layer, r.mode) === mode);
  const oobIds = new Set(Object.values(map.oob ?? {}).flat());
  const vols = [...mine(map.volumes), ...mine(map.boxes).map((b) => ({ ...b, kind: 'box' }))];
  return {
    spawns: mine(map.spawns),
    areas: mine(map.polygons),
    volumes: vols.filter((v) => !oobIds.has(v.id)),
    captures: mine(map.spheres),
    oob: vols.filter((v) => oobIds.has(v.id)),
    paths: mine(map.waypoints),
    cameras: mine(map.cameras),
  };
}

const dir = (yaw, pitch = 0) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];

// a loop of [x, z] points at y (closed or not) as segments
function loop(out, pts, y, closed = true) {
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    out.push(a[0], y, a[1], b[0], y, b[1]);
  }
}

const segments = {
  spawns(out, s) {
    const [x, y, z] = s.at;
    const d = dir(s.yaw ?? 0);
    out.push(x, y, z, x, y + POST, z, x, y + POST, z, x + d[0] * TICK, y + POST, z + d[2] * TICK);
  },
  areas(out, a, ground) {
    const c = centroid(a.points);
    loop(out, a.points, (ground?.(c[0], c[1]) ?? a.y ?? 0) + LIFT);
  },
  volumes(out, v) {
    if (v.kind === 'box') return box(out, v);
    const closed = v.closed !== false;
    const y0 = v.y ?? 0;
    const y1 = y0 + (v.height ?? 0);
    loop(out, v.points, y0, closed);
    loop(out, v.points, y1, closed);
    for (const p of v.points) out.push(p[0], y0, p[1], p[0], y1, p[1]);
  },
  captures(out, c) {
    for (let i = 0; i < RING; i++) {
      const a = (i / RING) * Math.PI * 2;
      const b = ((i + 1) / RING) * Math.PI * 2;
      out.push(c.at[0] + Math.cos(a) * c.r, c.at[1], c.at[2] + Math.sin(a) * c.r, c.at[0] + Math.cos(b) * c.r, c.at[1], c.at[2] + Math.sin(b) * c.r);
    }
  },
  paths(out, p) {
    for (let i = 0; i + 1 < p.points.length; i++) out.push(...p.points[i], ...p.points[i + 1]);
  },
  cameras(out, c) {
    // four rays from the eye to the corners FRUSTUM ahead, and their rectangle
    const half = Math.atan(18 / 35); // the overview's lens (camera.js's OVERVIEW_FOV), the record's focal length 35
    const f = dir(c.yaw, c.pitch);
    const right = [Math.cos(c.yaw), 0, -Math.sin(c.yaw)];
    const up = [-Math.sin(c.yaw) * Math.sin(c.pitch), Math.cos(c.pitch), -Math.cos(c.yaw) * Math.sin(c.pitch)];
    const h = Math.tan(half) * FRUSTUM;
    const w = h * (16 / 9);
    const corner = (sx, sy) => [0, 1, 2].map((k) => c.at[k] + f[k] * FRUSTUM + right[k] * w * sx + up[k] * h * sy);
    const cs = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
    for (const k of cs) out.push(...c.at, ...k);
    for (let i = 0; i < 4; i++) out.push(...cs[i], ...cs[(i + 1) % 4]);
  },
};
segments.oob = segments.volumes;

function box(out, b) {
  const c = Math.cos(b.yaw ?? 0);
  const s = Math.sin(b.yaw ?? 0);
  const [hx, hy, hz] = b.half;
  const p = (sx, sy, sz) => [b.at[0] + sx * hx * c + sz * hz * s, b.at[1] + sy * hy, b.at[2] - sx * hx * s + sz * hz * c];
  const corners = [-1, 1].flatMap((sy) => [p(-1, sy, -1), p(1, sy, -1), p(1, sy, 1), p(-1, sy, 1)]);
  for (let i = 0; i < 4; i++) {
    out.push(...corners[i], ...corners[(i + 1) % 4]);
    out.push(...corners[4 + i], ...corners[4 + ((i + 1) % 4)]);
    out.push(...corners[i], ...corners[4 + i]);
  }
}

function centroid(pts) {
  const n = pts.length || 1;
  return [pts.reduce((a, p) => a + p[0], 0) / n, pts.reduce((a, p) => a + p[1], 0) / n];
}

// where a row's label hangs
function anchor(kind, r, ground) {
  if (r.at) return kind === 'spawns' ? [r.at[0], r.at[1] + POST, r.at[2]] : r.at;
  if (kind === 'paths') return r.points[0];
  const [x, z] = centroid(r.points);
  return [x, kind === 'areas' ? (ground?.(x, z) ?? r.y ?? 0) + LIFT : (r.y ?? 0) + (r.height ?? 0), z];
}

export function createGizmos(scene, map, mode, { on = false, heightAt = null } = {}) {
  const rows = gizmoRows(map ?? {}, mode);
  const group = new THREE.Group();
  group.name = 'gizmos';
  group.visible = on;
  group.renderOrder = 10;
  const sets = {};
  for (const kind of KINDS) {
    const list = rows[kind];
    const byTeam = {};
    for (const r of list) (byTeam[kind === 'spawns' ? `spawns-${r.team ?? 0}` : kind] ??= []).push(r);
    for (const [name, part] of Object.entries(byTeam)) {
      if (!part?.length) continue;
      const out = [];
      for (const r of part) segments[kind](out, r, heightAt);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
      const mat = new THREE.LineBasicMaterial({ color: COLOURS[name], depthTest: false, transparent: true, opacity: 0.9, toneMapped: false });
      const lines = new THREE.LineSegments(geo, mat);
      lines.name = name;
      lines.frustumCulled = false;
      group.add(lines);
      sets[name] = lines;
    }
  }
  scene.add(group);
  const counts = Object.fromEntries(KINDS.map((k) => [k, rows[k].length]));
  const anchors = KINDS.flatMap((kind) => rows[kind].map((r) => ({ id: r.id, kind, at: anchor(kind, r, heightAt) })));

  return {
    group,
    counts,
    legend: () => KINDS.filter((k) => counts[k]).map((kind) => ({ kind, count: counts[kind], colour: `#${(COLOURS[kind] ?? COLOURS['spawns-2']).toString(16).padStart(6, '0')}` })),
    // the nearest things on screen with their ids, through the HUD's projection
    labels(camera, size, { max = LABELS } = {}) {
      if (!group.visible) return [];
      const p = camera.position;
      return anchors
        .map((a) => ({ a, d: Math.hypot(a.at[0] - p.x, a.at[1] - p.y, a.at[2] - p.z) }))
        .sort((x, y) => x.d - y.d)
        .map(({ a, d }) => ({ id: `gizmo:${a.id}`, label: a.id, kind: a.kind, dist: d, ...markerProjection(a.at, camera, size) }))
        .filter((l) => l.onScreen)
        .slice(0, max);
    },
    set(v) {
      group.visible = Boolean(v);
    },
    dispose() {
      scene.remove(group);
      for (const l of Object.values(sets)) {
        l.geometry.dispose();
        l.material.dispose();
      }
    },
  };
}
