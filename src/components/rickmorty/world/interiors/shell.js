// The rooms' common kit (for ../interiors.js): a room's parts gathered and
// merged by role, so a room is a dozen draw calls however much is in it.
// Solid colours go in one vertex-coloured toon mesh (the furniture, which
// casts shadows) and another (the walls and fixtures, which don't); glows in
// one vertex-coloured unlit mesh; every painted picture (posters, windows,
// the calendar, the map) is packed into one canvas and drawn as decals. Plus
// walls with openings, the floors from rules.js's PLAN, people from the Meshy
// cast with code-drawn stand-ins, and the cutaway that sinks a wall standing
// between the camera and Morty.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hot } from '../../../../lib/stage3d';
import { toon } from '../../portal/toon';
import { at, batch, mergeParts, paint } from '../kit';
import { AREAS, PLAN } from '../rules';

export const WALL_H = 2.6;
export const DOOR_H = 2.1;
export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
export const CYL8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
export const BALL = new THREE.SphereGeometry(0.5, 16, 12);
export const BALL8 = new THREE.SphereGeometry(0.5, 8, 6);
export const PLANE = new THREE.PlaneGeometry(1, 1);
export const TAU = Math.PI * 2;

// A lathe from a profile of [radius, y] pairs (bottom to top), for flasks,
// lampshades and the like
export const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
// a tube along points [[x, y, z], …], `r` thick
export const tube = (pts, r, seg = 24) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, 6, false);

// ── a room ──

// makeRoom(kit, id) gathers a room's parts; build() merges them into its
// group and returns the area's { group, update, noInk, light, dispose }.
export function makeRoom(kit, id) {
  const group = new THREE.Group();
  group.name = `c137-${id}`;
  const lists = { solid: [], fixed: [], glow: [] };
  const cells = new Map(); // atlas: name → { w, h, draw }
  const decals = { lit: [], bright: [] };
  const tiled = batch(); // floors and boards with world-space uvs
  const owned = []; // geometries, materials and textures this room made
  const noInk = [];
  const ticks = [];
  const cuts = [];

  // A frame to draw in: (u across, y up, v out of its front) about (x, z),
  // turned by `turn` (rules.js's furniture turn: 0 faces south). `list` is
  // where its solids go: 'solid' casts shadows, 'fixed' doesn't.
  const frame = (x, z, turn = 0, { y = 0, list = 'solid' } = {}) => {
    const base = at(x, y, z, turn);
    const put = (m) => base.clone().multiply(m);
    const into = Array.isArray(list) ? list : lists[list];
    const f = {
      base,
      // a box standing on y0, centred on (u, v)
      box(color, u, y0, v, w, h, d, ry = 0, rx = 0, rz = 0) {
        into.push({ geo: BOX, color, matrix: put(at(u, y0 + h / 2, v, ry, w, h, d, rx, rz)) });
        return f;
      },
      // a box centred on (u, y, v)
      cbox(color, u, y, v, w, h, d, ry = 0, rx = 0, rz = 0) {
        into.push({ geo: BOX, color, matrix: put(at(u, y, v, ry, w, h, d, rx, rz)) });
        return f;
      },
      // an upright cylinder standing on y0
      cyl(color, u, y0, v, r, h, rx = 0, rz = 0, geo = CYL) {
        into.push({ geo, color, matrix: put(at(u, y0 + (rx || rz ? 0 : h / 2), v, 0, r * 2, h, r * 2, rx, rz)) });
        return f;
      },
      ball(color, u, y, v, r, sy = 1, geo = BALL) {
        into.push({ geo, color, matrix: put(at(u, y, v, 0, r * 2, r * 2 * sy, r * 2)) });
        return f;
      },
      // any geometry, centred on (u, y, v)
      part(geo, color, u, y, v, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
        into.push({ geo, color, matrix: put(at(u, y, v, ry, sx, sy, sz, rx, rz)) });
        return f;
      },
      // a glow (unlit, bright enough to bloom at k > ~1.2)
      glow(geo, color, k, u, y, v, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
        lists.glow.push({ geo, color: hot(color, k), matrix: put(at(u, y, v, ry, sx, sy, sz, rx, rz)) });
        return f;
      },
      // a painted picture from the atlas, facing out of the frame's front,
      // w × h, centred on (u, y, v); `bright` ones are unlit (windows, screens)
      decal(name, u, y, v, w, h, { ry = 0, rx = 0, bright = false, geo = PLANE, sz = 1 } = {}) {
        decals[bright ? 'bright' : 'lit'].push({ name, geo, matrix: put(at(u, y, v, ry, w, h, sz, rx)) });
        return f;
      },
      // a frame inside this one
      sub(u, v, turn2 = 0, y2 = 0) {
        const s = frame(0, 0, 0, { list: into });
        s.base.copy(base).multiply(at(u, y2, v, turn2));
        return s;
      },
      mat: (u, y, v, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => put(at(u, y, v, ry, sx, sy, sz, rx, rz)),
    };
    return f;
  };

  const R = {
    kit,
    id,
    group,
    noInk,
    owned,
    tiled,
    frame,
    // a picture for the atlas: w × h px, draw(ctx, w, h)
    cell(name, w, h, draw) {
      if (!cells.has(name)) cells.set(name, { w, h, draw });
      return name;
    },
    tick(fn) {
      ticks.push(fn);
    },
    add(obj, { ink = true } = {}) {
      group.add(obj);
      if (!ink) noInk.push(obj);
      return obj;
    },
    own(...things) {
      owned.push(...things);
      return things[0];
    },
    // frames for the walls and fixtures (no shadows): fixed(x, z, turn)
    fixed: (x, z, turn = 0) => frame(x, z, turn, { list: 'fixed' }),
    // A wall that sinks to a stub while it stands between the camera and
    // Morty: (x0, z0)–(x1, z1) is its line. Returns a frame maker like
    // fixed's, for what goes on it.
    cutaway(x0, z0, x1, z1) {
      const parts = [];
      cuts.push({ line: [x0, z0, x1, z1], parts, k: 1, mesh: null });
      return (x, z, turn = 0) => frame(x, z, turn, { list: parts });
    },
    // What's over a doorway: hidden while the camera is under it (it can
    // go through a doorway, as high as 2.35 m)
    overhead(x0, z0, x1, z1) {
      const parts = [];
      cuts.push({ line: [x0, z0, x1, z1], parts, k: 1, mesh: null, near: 0.55 });
      return (x, z, turn = 0) => frame(x, z, turn, { list: parts });
    },
    build({ light, update } = {}) {
      const vc = kit.mats.toon(0xffffff, { vertexColors: true });
      for (const [name, cast] of [
        ['solid', true],
        ['fixed', false],
      ]) {
        if (!lists[name].length) continue;
        const mesh = new THREE.Mesh(own(mergeParts(lists[name])), vc);
        mesh.castShadow = cast;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      for (const cut of cuts) {
        if (!cut.parts.length) continue;
        cut.mesh = new THREE.Mesh(own(mergeParts(cut.parts)), vc);
        cut.mesh.receiveShadow = true;
        group.add(cut.mesh);
      }
      if (lists.glow.length) {
        const mesh = new THREE.Mesh(own(mergeParts(lists.glow)), own(new THREE.MeshBasicMaterial({ vertexColors: true })));
        R.add(mesh, { ink: false });
      }
      buildAtlas();
      tiled.build(group, { cast: false, receive: true });
      return {
        group,
        noInk,
        light,
        update(t, dt, state, camera) {
          if (cuts.length) sink(dt, state, camera);
          for (const fn of ticks) fn(t, dt, state, camera);
          update?.(t, dt, state, camera);
        },
        dispose() {
          for (const o of owned) o.dispose?.();
          owned.length = 0;
        },
      };
    },
  };
  const own = (x) => {
    owned.push(x);
    return x;
  };

  // pack every cell into one canvas (shelves, 1024 wide), then the decals
  // with their uvs moved into their cells
  function buildAtlas() {
    if (!cells.size) return;
    const W = 1024;
    const pad = 3;
    const list = [...cells.entries()].sort((a, b) => b[1].h - a[1].h);
    let x = 0;
    let y = 0;
    let row = 0;
    const rect = new Map();
    for (const [name, c] of list) {
      if (x + c.w + pad * 2 > W) {
        x = 0;
        y += row;
        row = 0;
      }
      rect.set(name, { x: x + pad, y: y + pad, w: c.w, h: c.h });
      x += c.w + pad * 2;
      row = Math.max(row, c.h + pad * 2);
    }
    const H = Math.ceil((y + row) / 64) * 64;
    const tex = own(
      paint(
        kit.renderer,
        W,
        H,
        (g) => {
          for (const [name, c] of cells) {
            const r = rect.get(name);
            g.save();
            g.translate(r.x, r.y);
            g.beginPath();
            g.rect(-pad, -pad, r.w + pad * 2, r.h + pad * 2);
            g.clip();
            c.draw(g, r.w, r.h);
            g.restore();
          }
        },
        { wrap: false },
      ),
    );
    const make = (list2, mat, ink) => {
      if (!list2.length) return;
      const geos = list2.map(({ name, geo, matrix }) => {
        const r = rect.get(name);
        if (!r) throw new Error(`no cell ${name}`);
        const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(matrix);
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        const uv = g.attributes.uv;
        const u0 = (r.x + 0.5) / W;
        const u1 = (r.x + r.w - 0.5) / W;
        const v1 = 1 - (r.y + 0.5) / H;
        const v0 = 1 - (r.y + r.h - 0.5) / H;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
        return g;
      });
      const merged = own(mergeGeometries(geos, false));
      for (const g of geos) g.dispose();
      const mesh = new THREE.Mesh(merged, own(mat));
      mesh.receiveShadow = true;
      R.add(mesh, { ink });
    };
    // (cut out where a picture leaves its canvas clear: a round rug, a lampshade's edge)
    make(decals.lit, toon(0xffffff, { map: tex, alphaTest: 0.5 }), true);
    make(decals.bright, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 }), true);
  }

  // the cutaway walls: down to a stub while the line from the camera to
  // Morty crosses theirs, back up once it doesn't
  const crosses = (ax, az, bx, bz, [x0, z0, x1, z1]) => {
    // the wall's line, a little longer at each end
    const L = Math.hypot(x1 - x0, z1 - z0) || 1;
    const ex = ((x1 - x0) / L) * 0.35;
    const ez = ((z1 - z0) / L) * 0.35;
    const cx0 = x0 - ex;
    const cz0 = z0 - ez;
    const cx1 = x1 + ex;
    const cz1 = z1 + ez;
    const d1 = (bx - ax) * (cz0 - az) - (bz - az) * (cx0 - ax);
    const d2 = (bx - ax) * (cz1 - az) - (bz - az) * (cx1 - ax);
    const d3 = (cx1 - cx0) * (az - cz0) - (cz1 - cz0) * (ax - cx0);
    const d4 = (cx1 - cx0) * (bz - cz0) - (cz1 - cz0) * (bx - cx0);
    return d1 * d2 < 0 && d3 * d4 < 0;
  };
  const segDist = (px, pz, [x0, z0, x1, z1]) => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(px - (x0 + t * dx), pz - (z0 + t * dz));
  };
  function sink(dt, state, camera) {
    const m = state.morty;
    if (!m) return;
    const c = camera.position;
    for (const cut of cuts) {
      if (!cut.mesh) continue;
      if (cut.near) {
        cut.mesh.visible = segDist(c.x, c.z, cut.line) > cut.near;
        continue;
      }
      const want = crosses(c.x, c.z, m.x, m.z, cut.line) ? 0.06 : 1;
      cut.k += (want - cut.k) * Math.min(1, dt * 9);
      if (Math.abs(cut.k - want) < 0.002) cut.k = want;
      cut.mesh.scale.y = cut.k;
      cut.mesh.visible = cut.k > 0.01;
    }
  }

  return R;
}

// ── walls and floors ──

// A run of wall from a to b ([x, z]); `into` is the side the room is on
// ([nx, nz]); it is `thick` thick, out from the line on the far side
// (`centred` for a wall between two rooms), WALL_H high (or `h`), in `color`
// (or a tiled material, `mat`), with
// `holes`: { at: metres along from a to its middle, w, y0, y1 }. `skirt`
// colours the skirting on the room side (both sides if centred). Returns a
// frame on the wall's room face (v out into the room; u along it, from a or
// from b: u(s) says where s metres from a is).
export function wallRun(R, f0, a, b, { into, thick = 0.2, centred = false, h = WALL_H, color = 0xf1e6c8, mat = null, dado = null, skirt = 0xf6f2e8, skirtH = 0.11, holes = [] }) {
  let [x0, z0] = a;
  let [x1, z1] = b;
  let len = Math.hypot(x1 - x0, z1 - z0);
  let dx = (x1 - x0) / len;
  let dz = (z1 - z0) / len;
  let list = holes.map((o) => ({ ...o }));
  // run it so that the frame's front (v) faces into the room
  const flip = !!into && into[0] * -dz + into[1] * dx < 0;
  if (flip) {
    [x0, z0, x1, z1] = [x1, z1, x0, z0];
    dx = -dx;
    dz = -dz;
    list = list.map((o) => ({ ...o, at: len - o.at }));
  }
  const turn = Math.atan2(-dz, dx);
  const f = f0(x0, z0, turn);
  const v0 = centred ? -thick / 2 : -thick;
  const v1 = centred ? thick / 2 : 0;
  const mid = (v0 + v1) / 2;
  const t = v1 - v0;
  list.sort((p, q) => p.at - q.at);
  // pieces between the holes, full height; under and over each hole
  const spans = [];
  let u = 0;
  for (const o of list) {
    const s = o.at - o.w / 2;
    if (s > u) spans.push([u, s]);
    u = o.at + o.w / 2;
  }
  if (u < len) spans.push([u, len]);
  const piece = (ua, ub, ya, yb) => {
    if (ub - ua < 1e-3 || yb - ya < 1e-3) return;
    if (mat) R.tiled.add(BOX, mat, f.mat((ua + ub) / 2, (ya + yb) / 2, mid, 0, ub - ua, yb - ya, t));
    else if (dado) {
      const [dh, dc] = dado;
      if (ya < dh) f.box(dc, (ua + ub) / 2, ya, mid, ub - ua, Math.min(yb, dh) - ya, t);
      if (yb > dh) f.box(color, (ua + ub) / 2, Math.max(ya, dh), mid, ub - ua, yb - Math.max(ya, dh), t);
    } else f.box(color, (ua + ub) / 2, ya, mid, ub - ua, yb - ya, t);
  };
  for (const [ua, ub] of spans) {
    piece(ua, ub, 0, h);
    if (skirt != null) {
      f.box(skirt, (ua + ub) / 2, 0, v1 + 0.008, ub - ua, skirtH, 0.016);
      if (centred) f.box(skirt, (ua + ub) / 2, 0, v0 - 0.008, ub - ua, skirtH, 0.016);
    }
  }
  for (const o of list) {
    piece(o.at - o.w / 2, o.at + o.w / 2, 0, o.y0 ?? 0);
    piece(o.at - o.w / 2, o.at + o.w / 2, o.y1 ?? DOOR_H, h);
  }
  // u(s): where s metres from a is along the frame
  return { f, len, thick: t, v0, v1, turn, u: (s) => (flip ? len - s : s) };
}

// A straight wall on a line of x or z from a to b, with openings placed by
// where they are in the world along it: { c, w, y0, y1, draw(f, u, wall) }
// (see win(), doorAt(), opening()). `frames` makes its frames (R.fixed or a
// cutaway's).
export function wallLine(R, frames, a, b, opts = {}, openings = []) {
  const alongX = Math.abs(b[1] - a[1]) < 1e-6;
  const s = (c) => Math.abs(alongX ? c - a[0] : c - a[1]);
  const w = wallRun(R, frames, a, b, { ...opts, holes: openings.map((o) => ({ at: s(o.c), w: o.w, y0: o.y0, y1: o.y1 })) });
  for (const o of openings) o.draw?.(w.f, w.u(s(o.c)), w);
  return w;
}
export const win = (c, w, y0, h, view, opts = {}) => ({ c, w, y0, y1: y0 + h, draw: (f, u, wl) => windowIn(f, u, y0, w, h, { view, v1: wl.v1, thick: wl.thick, ...opts }) });
export const doorAt = (c, opts = {}) => ({ c, w: opts.w ?? 0.92, y0: 0, y1: opts.h ?? DOOR_H, draw: (f, u, wl) => door(f, u, { v1: wl.v1, thick: wl.thick, ...opts }) });
// a hole with something of your own in it: draw(f, u, wall)
export const opening = (c, w, y0, y1, draw) => ({ c, w, y0, y1, draw });

// An open doorway in a wall between rooms, from a to b on the wall's line:
// the wall over it and a casing round it.
export function doorway(R, a, b, { thick = 0.24, color = 0xf1e6c8, trim = 0xf6f2e8, h = DOOR_H, top = WALL_H } = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  // the jambs stay; the wall over the door and the casing's head go with the camera under them
  const over = R.overhead(a[0], a[1], b[0], b[1]);
  const w = wallRun(R, over, a, b, { centred: true, thick, color, skirt: null, h: top, holes: [{ at: len / 2, w: len, y0: 0, y1: h }] });
  const jf = R.fixed(a[0], a[1], w.turn);
  const t = w.v1 - w.v0;
  const width = 0.08;
  for (const s of [-1, 1]) jf.box(trim, len / 2 + s * (len / 2 + width / 2 - 0.01), 0, 0, width, h + width - 0.01, t + 0.04);
  w.f.box(trim, len / 2, h, 0, len + width * 2 - 0.02, width, t + 0.04);
}

// A door's casing round a hole (in a wall run's frame): jambs and a head,
// proud of both faces (or just the room's), `w` wide, `h` high, at `u`.
export function casing(f, u, w, h, v0, v1, color = 0xf6f2e8, { both = true, width = 0.08 } = {}) {
  const t = v1 - v0;
  for (const s of [-1, 1]) f.box(color, u + s * (w / 2 + width / 2 - 0.01), 0, (v0 + v1) / 2 + (both ? 0 : 0.01), width, h + width - 0.01, t + (both ? 0.04 : 0.02));
  f.box(color, u, h, (v0 + v1) / 2, w + width * 2 - 0.02, width, t + (both ? 0.04 : 0.02));
}

// A closed door in a hole: the slab a little in from the room face, panels,
// a knob, casing on the room side.
export function door(f, u, { w = 0.92, h = DOOR_H, v1 = 0, thick = 0.2, color = 0x7a4a2a, trim = 0xf6f2e8, panels = true, knob = 0xd8b25a, glass = null } = {}) {
  f.box(color, u, 0, v1 - thick / 2, w, h, 0.05);
  if (panels) {
    const shade = new THREE.Color(color).multiplyScalar(0.82);
    for (const [py, ph] of [
      [0.18, 0.75],
      [1.1, 0.8],
    ])
      for (const s of [-1, 1]) f.box(shade, u + s * w * 0.22, py, v1 - thick / 2 + 0.03, w * 0.32, ph, 0.012);
  }
  if (glass) f.decal(glass, u, h * 0.72, v1 - thick / 2 + 0.04, w * 0.36, h * 0.32, { bright: true });
  f.ball(knob, u - w * 0.38, 0.98, v1 - thick / 2 + 0.06, 0.035);
  f.ball(knob, u - w * 0.38, 0.98, v1 - thick / 2 - 0.06, 0.035);
  casing(f, u, w, h, v1 - thick, v1, trim, { both: false });
}

// A window in a hole: frame, glazing bars, sill and a painted view
// (`view`, a bright atlas cell) set into the wall.
export function windowIn(f, u, y0, w, h, { view, v1 = 0, thick = 0.2, frame = 0xf6f2e8, bars = [1, 1], sill = true } = {}) {
  const y1 = y0 + h;
  const vm = v1 - thick / 2;
  f.decal(view, u, (y0 + y1) / 2, vm, w, h, { bright: true });
  const fw = 0.07;
  // the frame, flush with the wall face on the room side
  f.box(frame, u, y1 - 0.01, v1 - thick / 2, w + fw * 2, fw, thick + 0.03);
  f.box(frame, u, y0 - fw + 0.01, v1 - thick / 2, w + fw * 2, fw, thick + 0.03);
  for (const s of [-1, 1]) f.box(frame, u + s * (w / 2 + fw / 2), y0, v1 - thick / 2, fw, h, thick + 0.03);
  // bars: columns and rows
  const [cx, cy] = bars;
  for (let i = 1; i < cx; i++) f.box(frame, u - w / 2 + (w * i) / cx, y0, vm + 0.02, 0.035, h, 0.035);
  for (let i = 1; i < cy; i++) f.box(frame, u, y0 + (h * i) / cy - 0.0175, vm + 0.02, w, 0.035, 0.035);
  if (sill) f.box(frame, u, y0 - 0.05, v1 + 0.04, w + 0.24, 0.05, 0.1);
}

// A room's floors from PLAN: each a slab under y = 0, by material
// (floorMat(room) → a material); `lift` raises one (by id) a hair.
export function floors(R, area, floorMat, lift = {}) {
  for (const r of PLAN.filter((p) => p.area === area)) {
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    R.tiled.add(BOX, floorMat(r), at((r.x0 + r.x1) / 2, -0.05 + (lift[r.id] ?? 0), (r.z0 + r.z1) / 2, 0, w, 0.1, d));
  }
}

// Ceilings over rects ([x0, x1, z0, z1]) at y: flat and unlit (lit from
// below they'd be the colour of the floor), casting no shadow.
export function ceilings(R, rects, y = WALL_H, color = 0xe9e0cc, map = null, tile = 1) {
  const mat = R.own(new THREE.MeshBasicMaterial({ color, map }));
  if (map) mat.userData.tile = tile;
  for (const [x0, x1, z0, z1] of rects) R.tiled.add(BOX, mat, at((x0 + x1) / 2, y + 0.04, (z0 + z1) / 2, 0, x1 - x0 + 0.02, 0.08, z1 - z0 + 0.02));
  return mat;
}

// a floor slab for an area that is one room
export function floorSlab(R, area, mat) {
  const a = AREAS[area];
  R.tiled.add(BOX, mat, at((a.x0 + a.x1) / 2, -0.05, (a.z0 + a.z1) / 2, 0, a.x1 - a.x0 + 0.4, 0.1, a.z1 - a.z0 + 0.4));
}

// a material with world-space uvs, `tile` metres to a repeat, painted once
export function tiledPaint(mats, name, px, tile, draw, opts) {
  const m = mats.painted(name, px, px, draw, opts);
  m.userData.tile = tile;
  return m;
}

// ── people ──

// The cast (Rick and the Smiths), loaded once for every room that asks;
// whoever doesn't load is drawn in shapes.
export async function needCast(kit, names) {
  const need = kit.need ?? ((n, o) => kit.cast.load(null, n, o));
  try {
    await need(names, { clips: ['idle', 'walk', 'run'] });
  } catch {
    /* stand-ins */
  }
}

// A person standing at (x, z), facing `face` (rules.js's heading), `h` tall:
// the Meshy figure for `kind`, or a code-drawn one to `look`. Its tick plays
// the idle.
export function person(R, kind, { x, z, face, h, look, y = 0 }) {
  const c = R.kit.cast.make(kind);
  let fig;
  if (c) {
    c.group.scale.setScalar(h / c.height);
    fig = { group: c.group, cast: c, hand: c.hand, tick: (t) => c.update(t, 0, 0) };
  } else fig = toonPerson(R, look, h);
  fig.group.position.set(x, y, z);
  fig.group.rotation.y = face + Math.PI / 2;
  R.group.add(fig.group);
  if (fig.tick) R.tick(fig.tick);
  return fig;
}

// Rick's sat clip, for the Smiths who haven't one of their own (the same
// skeleton): turns only, so it keeps the sitter's own proportions.
let sitClip = null;
export async function sitting() {
  if (sitClip) return sitClip;
  try {
    const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/games/meshy/rick-sit.glb');
    const clip = g.animations[0];
    clip.tracks = clip.tracks.filter((t) => t.name.endsWith('.quaternion'));
    sitClip = clip;
  } catch {
    sitClip = null;
  }
  return sitClip;
}

// A person in shapes, the show's way (a big round head, dot eyes), merged
// into one mesh: { h, skin, shirt, pants, shoes, hair, style, moustache,
// coat, sleeves, belt }. Faces +z; stands on y = 0.
export function toonPerson(R, look, h = 1.8) {
  const {
    skin = 0xf2c9a0,
    shirt = 0xf2d23c,
    pants = 0x3b4a6b,
    shoes = 0x2a221e,
    hair = 0x3a2a1e,
    style = 'short',
    moustache = null,
    coat = null,
    sleeves = 'long',
    belt = null,
    tie = null,
    glasses = false,
  } = look ?? {};
  const parts = [];
  const f = R.frame(0, 0, 0, { list: parts });
  // legs and shoes
  for (const s of [-1, 1]) {
    f.cyl(pants, s * 0.1, 0.07, 0, 0.075, 0.76);
    f.box(shoes, s * 0.1, 0, 0.04, 0.13, 0.08, 0.27);
  }
  // body
  f.part(new THREE.CapsuleGeometry(0.2, 0.42, 4, 12), shirt, 0, 1.06, 0, 0, 1, 1, 0.72);
  if (belt != null) f.cyl(belt, 0, 0.8, 0, 0.205, 0.06, 0, 0, CYL).cyl(0xc9a64a, 0, 0.8, 0.15, 0.03, 0.06, Math.PI / 2);
  if (coat != null) {
    f.part(new THREE.CapsuleGeometry(0.215, 0.5, 4, 12), coat, 0, 0.98, -0.01, 0, 1, 1, 0.74);
    f.box(coat, 0, 0.42, -0.02, 0.4, 0.42, 0.3);
    f.box(shirt, 0, 1.0, 0.145, 0.14, 0.42, 0.02);
  }
  if (tie != null) f.box(tie, 0, 0.92, 0.152, 0.06, 0.42, 0.015);
  f.cyl(skin, 0, 1.36, 0, 0.06, 0.12);
  // arms: sleeves and hands
  for (const s of [-1, 1]) {
    const sl = coat ?? shirt;
    if (sleeves === 'short' && coat == null) {
      f.part(new THREE.CapsuleGeometry(0.068, 0.12, 4, 8), sl, s * 0.27, 1.26, 0, 0, 1, 1, 1, 0, s * 0.18);
      f.part(new THREE.CapsuleGeometry(0.052, 0.36, 4, 8), skin, s * 0.31, 0.98, 0.02, 0, 1, 1, 1, 0, s * 0.12);
    } else f.part(new THREE.CapsuleGeometry(0.062, 0.48, 4, 8), sl, s * 0.29, 1.06, 0.01, 0, 1, 1, 1, 0, s * 0.15);
    f.ball(skin, s * 0.34, 0.77, 0.03, 0.06);
  }
  // the head: round, big, with dot eyes and a nose
  const hy = 1.6;
  f.ball(skin, 0, hy, 0, 0.18, 1.08);
  f.ball(skin, 0, hy - 0.03, 0.17, 0.035);
  for (const s of [-1, 1]) {
    f.ball(0xffffff, s * 0.065, hy + 0.035, 0.15, 0.048);
    f.ball(0x111111, s * 0.065, hy + 0.035, 0.193, 0.014);
    f.ball(skin, s * 0.18, hy, 0, 0.035);
    if (glasses) f.part(new THREE.TorusGeometry(0.05, 0.008, 6, 16), 0x222222, s * 0.065, hy + 0.035, 0.19);
  }
  f.box(0x6b3a2e, 0, hy - 0.1, 0.162, 0.07, 0.012, 0.01);
  if (moustache != null) f.part(new THREE.CapsuleGeometry(0.022, 0.09, 4, 8), moustache, 0, hy - 0.066, 0.175, 0, 1, 1, 0.8, 0, Math.PI / 2);
  // hair
  if (style === 'short' || style === 'side') {
    f.ball(hair, 0, hy + 0.06, -0.02, 0.19, 0.78);
    f.box(hair, 0, hy + 0.08, 0.1, 0.3, 0.09, 0.1, 0, -0.35);
    for (const s of [-1, 1]) f.box(hair, s * 0.165, hy - 0.04, -0.03, 0.05, 0.16, 0.22);
  } else if (style === 'spiky') {
    f.ball(hair, 0, hy + 0.04, -0.03, 0.185, 0.7);
    for (let i = 0; i < 9; i++) {
      const a = -1.2 + (i / 8) * 2.4;
      f.part(new THREE.ConeGeometry(0.06, 0.24, 6), hair, Math.sin(a) * 0.17, hy + 0.1 + Math.cos(a) * 0.05, -0.08 - Math.cos(a) * 0.06, 0, 1, 1, 1, -0.9, -a * 0.9);
    }
  } else if (style === 'pony' || style === 'bob') {
    f.ball(hair, 0, hy + 0.05, -0.02, 0.195, 0.85);
    f.box(hair, 0, hy + 0.1, 0.11, 0.3, 0.08, 0.08, 0, -0.4);
    if (style === 'pony') f.part(new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), hair, 0, hy + 0.06, -0.24, 0, 1, 1, 1, 0.9);
    else for (const s of [-1, 1]) f.box(hair, s * 0.17, hy - 0.1, -0.02, 0.06, 0.3, 0.26);
  }
  const geo = R.own(mergeParts(parts));
  const group = new THREE.Group();
  const body = new THREE.Mesh(geo, R.kit.mats.toon(0xffffff, { vertexColors: true }));
  body.castShadow = true;
  body.receiveShadow = true;
  body.scale.setScalar(h / 1.8);
  group.add(body);
  const seed = Math.random() * 10;
  return {
    group,
    body,
    tick(t) {
      body.scale.y = (h / 1.8) * (1 + Math.sin(t * 2.1 + seed) * 0.008);
      body.rotation.z = Math.sin(t * 0.7 + seed) * 0.015;
    },
  };
}

// ── painting ──

// text in a box, fitted to its width
export function fitText(g, text, x, y, w, size, { font = 'Arial Black, Arial, sans-serif', weight = '900', color = '#111', align = 'center', base = 'middle' } = {}) {
  let s = size;
  g.font = `${weight} ${s}px ${font}`;
  while (g.measureText(text).width > w && s > 6) {
    s -= 1;
    g.font = `${weight} ${s}px ${font}`;
  }
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = base;
  g.fillText(text, x, y);
}

// A bright outdoor view for a window: sky over a lawn, a fence, trees.
export function windowView(seed = 1, { lawn = '#7cc35a', sky = ['#9edcf5', '#d9f3fb'], trees = true, house = true } = {}) {
  return (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, sky[0]);
    gr.addColorStop(0.62, sky[1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    // a cloud
    g.fillStyle = 'rgba(255,255,255,0.95)';
    const cx = w * (0.25 + ((seed * 37) % 50) / 100);
    for (const [dx, dy, r] of [
      [0, 0, 0.09],
      [0.08, -0.03, 0.11],
      [0.17, 0, 0.08],
    ]) {
      g.beginPath();
      g.arc(cx + dx * w, h * 0.22 + dy * h, r * w, 0, TAU);
      g.fill();
    }
    if (house) {
      g.fillStyle = seed % 2 ? '#f0c9a8' : '#c9dbe6';
      g.fillRect(w * 0.55, h * 0.48, w * 0.35, h * 0.2);
      g.fillStyle = '#7a4a38';
      g.beginPath();
      g.moveTo(w * 0.52, h * 0.49);
      g.lineTo(w * 0.725, h * 0.38);
      g.lineTo(w * 0.93, h * 0.49);
      g.fill();
    }
    if (trees)
      for (const [tx, r] of [
        [0.12, 0.13],
        [0.38, 0.1],
      ]) {
        g.fillStyle = '#6b4a2a';
        g.fillRect(w * tx - 3, h * 0.5, 6, h * 0.16);
        g.fillStyle = '#3f8f3a';
        g.beginPath();
        g.arc(w * tx, h * 0.47, r * w, 0, TAU);
        g.fill();
        g.fillStyle = '#56a84a';
        g.beginPath();
        g.arc(w * tx - r * w * 0.3, h * 0.44, r * w * 0.55, 0, TAU);
        g.fill();
      }
    g.fillStyle = lawn;
    g.fillRect(0, h * 0.64, w, h * 0.36);
    // a picket fence
    g.fillStyle = '#f7f4ec';
    g.fillRect(0, h * 0.69, w, 3);
    for (let px = 2; px < w; px += 9) g.fillRect(px, h * 0.64, 5, h * 0.11);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.moveTo(w * 0.1, h);
    g.lineTo(w * 0.32, h);
    g.lineTo(w * 0.62, 0);
    g.lineTo(w * 0.4, 0);
    g.fill();
  };
}

// A framed picture: an inked border round draw()
export function framed(draw, { border = '#5c3a22', inner = 5 } = {}) {
  return (g, w, h) => {
    g.fillStyle = border;
    g.fillRect(0, 0, w, h);
    g.save();
    g.translate(inner, inner);
    draw(g, w - inner * 2, h - inner * 2);
    g.restore();
    g.strokeStyle = '#1a1210';
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
  };
}

// handwriting-ish scribbles for notes
export function scribble(g, x, y, w, lines, { color = '#334', gap = 7, seed = 1 } = {}) {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  g.strokeStyle = color;
  g.lineWidth = 1.2;
  for (let i = 0; i < lines; i++) {
    g.beginPath();
    let px = x;
    const end = x + w * (0.55 + r() * 0.45);
    g.moveTo(px, y + i * gap);
    while (px < end) {
      px += 3 + r() * 4;
      g.lineTo(px, y + i * gap + (r() - 0.5) * 2.5);
    }
    g.stroke();
  }
}
