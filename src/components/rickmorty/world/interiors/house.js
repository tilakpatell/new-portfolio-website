// The Smith house's ground floor, for ../interiors.js, as the show draws it:
// the olive kitchen (tan and brown cupboards, the sink under its window, the
// range and its hood, the white fridge, the breakfast nook under yellow
// curtains) with Beth at the stove and the door to Rick's garage; the cream
// living room under its beams (the mint couch with Jerry on it in front of
// the TV playing interdimensional cable, ./tv.js; the teal armchair, the
// olive rug, the bookcase, Snuffles' bed, the sliding door to the yard); the
// dining room's checked table, blue chairs and salmon curtains, the butter
// robot on the table; the pink entry with its red rug, white stairs,
// grandfather clock and Beth's horses; the den, the hall and the back room.
// Arched doorways between, each side of a wall in its own room's paint.
// Drawn from rules.js's PLAN, INNER_WALLS, FURNITURE, RUGS and PEOPLE, every
// piece on its collider (./smiths.js, ./furniture.js). Upstairs is
// ./upstairs.js.

import * as THREE from 'three';
import { faceForward, heading } from '../../portal/meshyCast';
import { AREAS, FURNITURE, INNER_WALLS, PEOPLE, RUGS } from '../rules';
import { at } from '../kit';
import { ceilingLights, DOOR_H, doorAt, doorway, floors, framed, grainOf, innerWalls, makeRoom, roomAt, TAU, tiledPaint, tintedCeilings, wallLine, win, windowIn, windowView } from './shell';
import { needCast, person, sitting } from './people';
import { BROWN, CREAM, HEIGHTS, HOUSE_LIGHT, INNER, LOOKS, TRIM, WOOD_FLOOR, butterRobot, carpet, computer, desk, deskLamp, dresser, shelf, tvStand, bed, woodFloor } from './furniture';
import { armchair, bookcase, chair, clock, coffeeTable, couch, counter, curtains, diningTable, dogBed, fridge, nookTable, onCounter, P, pendant, plant, sconce, sink, stove } from './smiths';
import { houseCells } from './smithpaint';
import { cableTV } from './tv';

// ── the stairs ──

// steps rising north from the foot of the stairs (by the 'stairs-up' link),
// with a banister up their open side (the rules' low wall)
function stairs(R, it) {
  const f = R.frame(0, 0, 0, { list: 'fixed' });
  // on the rules' stair-run: its front (+z) is the foot, its height the top step's
  const x0 = it.x - it.w / 2;
  const x1 = it.x + it.w / 2;
  const foot = it.z + it.d / 2;
  const top = it.z - it.d / 2;
  const n = 7;
  const run = (foot - top) / n;
  const rise = it.h / n;
  const cx = (x0 + x1) / 2;
  for (let i = 0; i < n; i++) {
    const z1 = foot - i * run;
    const y = (i + 1) * rise;
    f.box(P.riser, cx, 0, z1 - run / 2 - 0.01, x1 - x0, y - 0.03, run);
    f.box(P.tread, cx, y - 0.035, z1 - run / 2 - 0.02, x1 - x0, 0.04, run + 0.035);
    f.box(TRIM, cx, y - rise, z1 - 0.005, x1 - x0 - 0.02, rise - 0.03, 0.01);
  }
  // the banister, all white: newel posts, a rail up the slope, balusters
  const rail = 0.95;
  const post = (z, y) => f.box(P.rail, x0 + 0.05, 0, z, 0.1, y + rail + 0.08, 0.1).box(P.rail, x0 + 0.05, y + rail + 0.08, z, 0.14, 0.06, 0.14).ball(P.rail, x0 + 0.05, y + rail + 0.17, z, 0.05);
  post(foot - 0.06, 0);
  post(top + 0.05, n * rise - rise);
  const len = Math.hypot(foot - top, (n - 1) * rise);
  const slope = Math.atan2((n - 1) * rise, foot - top);
  f.cbox(P.rail, x0 + 0.05, rail + ((n - 1) * rise) / 2 + 0.12, (foot + top) / 2, 0.08, 0.07, len, 0, slope);
  // a white stringer down the open side
  f.cbox(P.rail, x0 + 0.02, ((n - 1) * rise) / 2 + 0.1, (foot + top) / 2, 0.04, 0.24, len + 0.1, 0, slope);
  for (let i = 0; i < n * 2; i++) {
    const z = foot - (i + 0.5) * (run / 2);
    const step = Math.floor(i / 2) + 1;
    const y = step * rise;
    const yr = rail + ((foot - z) / (foot - top)) * (n - 1) * rise + 0.1;
    f.box(P.rail, x0 + 0.05, y, z, 0.035, Math.max(0.1, yr - y), 0.035);
  }
}

// ── the ground floor ──

// each room's paint: walls, skirting, the moulding at the ceiling, the trim round its doorways, the ceiling
const LOOK = {
  kitchen: { color: P.olive, skirt: P.oliveDark, skirtH: 0.07, crown: null, trim: P.archCream, ceiling: P.ceilKitchen },
  living: { color: P.cream, skirt: P.trim, skirtH: 0.1, crown: null, trim: P.trim, ceiling: P.ceilLiving },
  dining: { color: P.creamDining, skirt: P.trim, skirtH: 0.1, crown: null, trim: P.trim, ceiling: P.ceilLiving },
  entry: { color: P.pink, skirt: P.trim, skirtH: 0.14, crown: null, trim: P.trim, ceiling: P.ceilEntry },
  rest: { color: CREAM, skirt: TRIM, skirtH: 0.11, crown: TRIM, trim: TRIM, ceiling: 0xe9e0cc },
};
LOOK.stairs = LOOK.entry;
const look = (room) => LOOK[room?.id] ?? LOOK.rest;

export async function buildHouse(kit) {
  const R = makeRoom(kit, 'house');
  const m = kit.mats;
  const grain = grainOf(kit);
  const [, clip] = await Promise.all([needCast(kit, ['beth', 'jerry']), sitting()]);

  // floors: wood planks, the back room's carpet
  const wood = tiledPaint(m, 'c137-in-wood', 256, 2.6, woodFloor());
  floors(R, 'house', (r) => (r.floor === WOOD_FLOOR ? wood : tiledPaint(m, `c137-in-carpet-${r.floor}`, 128, 1.6, carpet, { color: r.floor })), { den: 0.001 });

  // pictures: window views, the rugs, the fridge's notes, the frames
  for (let i = 1; i <= 4; i++) R.cell(`view${i}`, 128, 128, windowView(i));
  houseCells(R);
  pictures(R);

  // ── ceilings: each room's colour; the kitchen's slopes down to its west wall; beams across the living room ──
  const ceil = tintedCeilings(R, [...ROOMS.map(([id, ...r]) => [...r, look({ id }).ceiling]), [AREAS.house.x0, -294.5, 3.4, AREAS.house.z1, 0xe9e0cc]], { grain });
  ceil.add(P.ceilSlope, at(-311.45, 2.47, -2.3, 0, 1.18, 0.08, 11.4, 0, 0.266));
  const beams = R.fixed(0, 0, 0);
  for (const z of [-7.3, -6.1, -4.9, -3.7, -2.5]) beams.box(P.beam, -301.8, 2.43, z, 9.8, 0.17, 0.15);
  ceilingLights(R, ROOMS.filter(([id]) => ['den', 'hall', 'rickroom'].includes(id)).map(([, ...r]) => r));
  const lamps = R.fixed(0, 0, 0);
  pendant(lamps, -309.3, -3.0, 2.6, { drop: 0.38 });
  pendant(lamps, -309, 2.55, 2.6, { drop: 0.42 });
  pendant(lamps, -303.1, 0.8, 2.6, { drop: 0.38, wide: true, color: 0xf6eed2 });

  // ── walls ──
  const F = R.fixed;
  const kitchen = { color: P.olive, skirt: P.oliveDark, skirtH: 0.07 };
  const of = (id) => {
    const L = look({ id });
    return { color: L.color, skirt: L.skirt, skirtH: L.skirtH, crown: L.crown };
  };
  const view = (i) => `view${i}`;
  // the outer walls on the area's edges (never between the camera and Morty), split where the rooms are
  wallLine(R, F, [-312.2, -8], [-306.7, -8], { ...kitchen, into: [0, 1] }, [win(-309.6, 1.1, 1.12, 0.9, view(1), { bars: [2, 2], frame: P.trim })]);
  wallLine(R, F, [-306.7, -8], [-296.9, -8], { ...of('living'), into: [0, 1] }, [slidingDoor(-301.8, 3.0)]);
  wallLine(R, F, [-296.9, -8], [-287.8, -8], { ...of('den'), into: [0, 1] }, [win(-292.5, 1.5, 1.05, 1.0, view(3), { bars: [2, 1] })]);
  wallLine(R, F, [-288, -8.2], [-288, 8.7], { ...of('den'), into: [-1, 0] }, [win(-7.2, 0.9, 1.0, 1.0, view(4)), win(-0.55, 0.8, 1.0, 1.0, view(1)), win(5.6, 1.4, 0.95, 1.05, view(2), { bars: [2, 2] })]);
  wallLine(R, F, [-294.7, 8.5], [-287.8, 8.5], { ...of('rickroom'), into: [0, -1] }, [win(-291.2, 1.2, 1.25, 0.8, view(3))]);
  // the kitchen's west wall and its door to the garage, framed so it reads as one
  wallLine(R, F, [-312, -8.2], [-312, 3.6], { ...kitchen, into: [1, 0] }, [doorAt(1.1, { color: 0x8a5a34, trim: P.archCream, knob: P.brass })]);
  garageDoor(R.fixed(-312, 1.1, Math.PI / 2));
  // the outer walls with the yard outside them, south-west: they sink when
  // they come between the camera and Morty
  wallLine(R, R.cutaway(-312.2, 3.4, -306.7, 3.4), [-312.2, 3.4], [-306.7, 3.4], { ...kitchen, into: [0, -1] }, [curtained(-309, 1.1, 1.05, 0.95, view(4), P.curtainYellow, { bars: [2, 2], panel: 0.36, y1: 2.25, y0: 0.95 })]);
  wallLine(R, R.cutaway(-306.7, 3.4, -299.5, 3.4), [-306.7, 3.4], [-299.5, 3.4], { ...of('dining'), into: [0, -1] }, [curtained(-303.1, 1.5, 0.8, 1.4, view(2), P.salmon, { bars: [2, 3], panel: 0.55, y1: 2.4, y0: 0.42, rod: 0xc8ccd0 })]);
  wallLine(R, R.cutaway(-299.5, 3.4, -294.5, 3.4), [-299.5, 3.4], [-294.5, 3.4], { ...of('entry'), into: [0, -1] }, [doorAt(-297.6, { w: 1.0, color: BROWN, trim: TRIM, knob: P.brass })]);
  wallLine(R, R.cutaway(-294.5, 3.4, -294.5, 8.7), [-294.5, 3.4], [-294.5, 8.7], { ...of('rickroom'), into: [1, 0] }, [win(6.0, 1.2, 1.0, 1.0, view(1))]);
  // between the rooms, each side its own room's; the doorways, arched where the show has them
  innerWalls(R, F, 'house', INNER_WALLS.house, (r) => {
    const L = look(r);
    return { color: L.color, skirt: L.skirt, skirtH: L.skirtH, crown: L.crown };
  });
  for (const [a, b, arch] of HOUSE_DOORWAYS) {
    const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
    const n = Math.hypot(dx, dz);
    const [mx, mz] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const front = look(roomAt('house', mx - (dz / n) * 0.3, mz + (dx / n) * 0.3));
    const back = look(roomAt('house', mx + (dz / n) * 0.3, mz - (dx / n) * 0.3));
    doorway(R, a, b, { thick: INNER, color: front.color, trim: front.trim, crown: front.crown, back: { color: back.color, trim: back.trim, crown: back.crown }, arch, h: arch ? 2.34 : DOOR_H, width: arch ? 0.11 : 0.09 });
  }

  // ── on the floors and the walls ──
  const fl = R.fixed(0, 0, 0);
  const rug = RUGS.find((r) => r.id === 'entry');
  const lrug = RUGS.find((r) => r.id === 'living');
  fl.decal('rug', rug.x, 0.006, rug.z, rug.w, rug.d, { rx: -Math.PI / 2 });
  fl.decal('livingrug', lrug.x, 0.006, lrug.z, lrug.w, lrug.d, { rx: -Math.PI / 2 });
  walls(R);

  // ── furniture ──
  for (const it of FURNITURE.filter((f) => f.area === 'house')) {
    const k = it.kind;
    if (k === 'counter') onCounter(counter(R, it), it);
    else if (k === 'sink') sink(R, it);
    else if (k === 'stove') stove(R, it);
    else if (k === 'fridge') fridge(R, it);
    else if (k === 'nook-table') nookTable(R, it);
    else if (k === 'chair') chair(R, it, roomAt('house', it.x, it.z)?.id === 'dining' ? 'dining' : 'nook');
    else if (k === 'tv') cableTV(R, tvStand(R, it), 0, 1.12, -0.084 + 0.001, 1.5, 0.82);
    else if (k === 'couch') couch(R, it);
    else if (k === 'armchair') armchair(R, it);
    else if (k === 'coffee-table') coffeeTable(R, it);
    else if (k === 'bookcase') plant(bookcase(R, it), 0.45, it.h, 0, { s: 1.1 });
    else if (k === 'dog-bed') dogBed(R, it);
    else if (k === 'dining-table') diningTable(R, it);
    else if (k === 'clock') R.tick(clock(R, it));
    else if (k === 'desk') {
      const f = desk(R, it);
      computer(f, -0.3, it.h, -0.05);
      deskLamp(f, 0.75, it.h, -0.25);
      f.box(0xf4f0e6, 0.25, it.h, 0.1, 0.3, 0.01, 0.22, 0.2).cyl(0xc8362e, 0.6, it.h, 0.15, 0.04, 0.1);
    } else if (k === 'shelf') shelf(R, it);
    else if (k === 'bed') bed(R, it, { blanket: 0x7a7f8f, frame: 0x5a4a3a });
    else if (k === 'stairs') stairs(R, it);
    else if (k === 'dresser') {
      const f = dresser(R, it, { wood: 0x6b5a48 });
      f.box(0x9aa3ab, 0.5, it.h, 0, 0.12, 0.2, 0.12).decal('photo', -0.3, it.h + 0.14, 0, 0.3, 0.24, { rx: -0.2 });
    }
  }

  // ── people ──
  const P0 = (id) => PEOPLE.find((p) => p.id === id);
  const beth = P0('beth');
  person(R, 'beth', { ...beth, h: HEIGHTS.beth, look: LOOKS.beth });
  // Jerry on the couch, facing the TV: Rick's sat clip on his skeleton, or,
  // without it, sat in shapes
  const jerry = P0('jerry');
  const j = person(R, 'jerry', { ...jerry, h: HEIGHTS.jerry, look: { ...LOOKS.jerry, sit: true }, meshy: !!clip });
  if (j.cast?.mixer) {
    const c = j.cast;
    const sit = c.mixer.clipAction(facingAhead(c, clip));
    sit.play();
    for (const a of Object.values(c.act)) a.setEffectiveWeight(0);
    sit.setEffectiveWeight(1);
    j.group.position.x -= JERRY_SIT.back;
    j.group.position.y = JERRY_SIT.y;
    let last = null;
    R.tick((t) => {
      c.mixer.update(last == null ? 0 : Math.min(0.1, t - last));
      last = t;
    });
    // (the tick person() added plays the idle; its weights stay at nought)
    c.update = () => {};
  } else j.group.position.x -= 0.15;

  // the butter robot on the table by its hotspot
  butterRobot(R, -302.6, 0.765, 0.8, -Math.PI / 2 + 0.3);

  return R.build({ light: HOUSE_LIGHT, grain });
}

// the plan's rooms on this floor, [id, x0, x1, z0, z1]
const ROOMS = [
  ['kitchen', -312, -306.7, -8, 3.4],
  ['living', -306.7, -296.9, -8, -1.9],
  ['den', -296.9, -288, -8, -1.6],
  ['dining', -306.7, -299.5, -1.9, 3.4],
  ['entry', -299.5, -295.7, -1.9, 3.4],
  ['hall', -295.7, -288, -1.6, 0.5],
  ['stairs', -295.7, -294.5, 0.5, 3.4],
  ['rickroom', -294.5, -288, 0.5, 8.5],
];

// A window with curtains either side of it, on a wall line (an opening for wallLine)
function curtained(c, w, y0, h, view, colour, { bars = [2, 2], panel = 0.5, y1 = y0 + h + 0.25, rod, frame = P.trim, ...rest } = {}) {
  return {
    c,
    w,
    y0,
    y1: y0 + h,
    draw: (f, u, wl) => {
      windowIn(f, u, y0, w, h, { view, v1: wl.v1, thick: wl.thick, bars, frame });
      curtains(f, u, w, rest.y0 ?? y0 - 0.1, y1, wl.v1, colour, { panel, rod });
    },
  };
}

// The living room's sliding glass door to the back yard: a dark frame, two
// panes (one slid behind the other), the yard beyond
function slidingDoor(c, w) {
  const h = 2.15;
  return {
    c,
    w,
    y0: 0,
    y1: h,
    draw: (f, u, wl) => {
      const vm = wl.v1 - wl.thick / 2;
      f.decal('backyard', u, h / 2, vm, w, h, { bright: true });
      const fw = 0.07;
      const fr = P.slider;
      f.box(fr, u, h - fw, vm + 0.02, w + 0.02, fw, wl.thick + 0.04).box(0x9aa3ab, u, 0, vm + 0.02, w + 0.02, 0.045, wl.thick + 0.06);
      for (const s of [-1, 1]) f.box(fr, u + s * (w / 2 - fw / 2), 0, vm + 0.02, fw, h, wl.thick + 0.04);
      // the two panes' frames: the meeting stiles, a handle
      f.box(fr, u - 0.03, 0.04, vm + 0.05, 0.06, h - 0.1, 0.05).box(fr, u + 0.04, 0.04, vm - 0.02, 0.06, h - 0.1, 0.05);
      f.box(0x2a2a2e, u - 0.1, 0.95, vm + 0.085, 0.025, 0.22, 0.02);
    },
  };
}

// the kitchen's side of the door to the garage: a mat, a strip of green light under it
function garageDoor(f) {
  f.box(0x7a4a2a, 0, 0, 0.42, 0.95, 0.012, 0.55).box(0x5a3420, 0, 0.012, 0.42, 0.85, 0.004, 0.45);
  f.glow(BOX_GEO, 0x9dff5a, 1.6, 0, 0.008, 0.012, 0, 0.84, 0.014, 0.012);
}
const BOX_GEO = new THREE.BoxGeometry(1, 1, 1);

// what hangs on the walls, room by room (each frame on a wall's face, v out into the room)
function walls(R) {
  const E = Math.PI / 2;
  const W = -Math.PI / 2;
  const N = Math.PI;
  const hang = (name, x, z, turn, y, w, h, { back = 0x6a4a32 } = {}) => R.fixed(x, z, turn).box(back, 0, y - h / 2 - 0.02, 0.012, w + 0.04, h + 0.04, 0.024).decal(name, 0, y, 0.026, w, h);
  // the kitchen: plates on a shelf, a little picture, the phone by the arch
  const k = R.fixed(-312, -0.45, E);
  k.box(0x8a5a34, 0, 1.5, 0.08, 0.62, 0.025, 0.14).box(0x6a4026, -0.22, 1.42, 0.04, 0.02, 0.08, 0.06).box(0x6a4026, 0.22, 1.42, 0.04, 0.02, 0.08, 0.06);
  for (const [u, r] of [
    [-0.19, 0.075],
    [0.0, 0.09],
    [0.19, 0.075],
  ])
    k.cyl(0x6a8ab0, u, 1.525 + r, 0.08, r, 0.012, E - 0.18).cyl(0xf6f4ec, u, 1.525 + r, 0.087, r * 0.8, 0.012, E - 0.18);
  hang('photo', -312, 0.12, E, 1.25, 0.26, 0.2);
  const ph = R.fixed(-306.82, -0.32, W);
  ph.box(0xe8dcc0, 0, 1.36, 0.03, 0.12, 0.2, 0.05).box(0xd8ccb0, 0.065, 1.38, 0.05, 0.05, 0.2, 0.05);
  for (let i = 0; i < 4; i++) ph.box(0x9a8a70, -0.02 + (i % 2) * 0.03, 1.5 - Math.floor(i / 2) * 0.04, 0.056, 0.02, 0.015, 0.004);
  ph.part(PHONE_CORD, 0xe8dcc0, 0.065, 0, 0.05);
  // the living room: a tall mirror, a landscape, a little photo, a plug
  R.fixed(-306.58, -2.95, E).box(0xd8c49a, 0, 0.72, 0.012, 0.56, 1.0, 0.024).decal('mirror', 0, 1.22, 0.026, 0.48, 0.92);
  hang('landscape', -299.8, -2.02, N, 1.6, 1.0, 0.7, { back: 0xc9a24a });
  hang('photo', -305.6, -8, 0, 1.6, 0.36, 0.28);
  // the dining room: the sunflowers, the boat, a landscape
  hang('sunflowers', -299.62, 2.75, W, 1.55, 0.45, 0.55, { back: 0x8a5a34 });
  hang('seascape', -299.62, -0.85, W, 1.55, 0.62, 0.48, { back: 0xc9a24a });
  hang('landscape', -306.0, -1.78, 0, 1.6, 0.7, 0.5, { back: 0xc9a24a });
  // the entry: Beth's horses, the sconce, the hall's family pictures
  hang('horses', -296.85, -1.78, 0, 1.55, 0.78, 0.55, { back: 0x7a5a42 });
  sconce(R.fixed(-299.38, -0.85, E), 0, 1.72, 0);
  R.fixed(-294.9, -1.46, 0).decal('family', 0, 1.6, 0, 0.6, 0.46).decal('photo', 0.95, 1.55, 0, 0.42, 0.32);
  R.fixed(-296.76, -4.1, E).decal('photo', 0, 1.7, 0, 0.36, 0.28);
  R.fixed(-288, 1.6, W).decal('family', 0, 1.6, 0.012, 0.5, 0.4);
  // plugs low on the walls, as the show draws them
  for (const [x, z, t] of [
    [-299.62, 0.0, W],
    [-301.0, -1.78, 0],
    [-306.58, -2.4, E],
    [-298.9, -1.78, 0],
  ])
    R.fixed(x, z, t).box(0xf6f4ec, 0, 0.26, 0.008, 0.07, 0.11, 0.016).box(0x3a3a3e, -0.012, 0.31, 0.017, 0.006, 0.02, 0.002).box(0x3a3a3e, 0.012, 0.31, 0.017, 0.006, 0.02, 0.002);
}
const PHONE_CORD = new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3(Array.from({ length: 28 }, (_, i) => new THREE.Vector3(Math.cos(i * 1.4) * 0.018, 1.36 - i * 0.02, 0.02 + Math.sin(i * 1.4) * 0.018))),
  80,
  0.005,
  4,
  false,
);

// the pictures the walls and the den use
function pictures(R) {
  R.cell('landscape', 160, 112, framed((g, w, h) => {
    g.fillStyle = '#9edcf5';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#6a8fb0';
    g.beginPath();
    g.moveTo(0, h * 0.7);
    g.lineTo(w * 0.3, h * 0.3);
    g.lineTo(w * 0.55, h * 0.62);
    g.lineTo(w * 0.75, h * 0.38);
    g.lineTo(w, h * 0.7);
    g.fill();
    g.fillStyle = '#5aa84a';
    g.fillRect(0, h * 0.7, w, h * 0.3);
    g.fillStyle = '#3f8f3a';
    for (const x of [0.15, 0.22, 0.8]) {
      g.beginPath();
      g.arc(w * x, h * 0.66, h * 0.1, 0, TAU);
      g.fill();
    }
  }, { border: '#c9a24a' }));
  R.cell('family', 112, 88, framed((g, w, h) => {
    g.fillStyle = '#e8dcc0';
    g.fillRect(0, 0, w, h);
    const heads = [
      ['#e8762e', '#f0559a'],
      ['#f0d27a', '#c8362e'],
      ['#6b4126', '#7d8a3c'],
      ['#6b3a1e', '#f2d23c'],
    ];
    heads.forEach(([hair, shirt], i) => {
      const x = 16 + (i * (w - 32)) / 3;
      g.fillStyle = shirt;
      g.fillRect(x - 9, h * 0.55, 18, h * 0.45);
      g.fillStyle = '#f2c9a0';
      g.beginPath();
      g.arc(x, h * 0.42, 9, 0, TAU);
      g.fill();
      g.fillStyle = hair;
      g.fillRect(x - 9, h * 0.42 - 11, 18, 6);
    });
  }));
  R.cell('monitor', 64, 48, (g, w, h) => {
    g.fillStyle = '#2f6fb0';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8e3d6';
    g.fillRect(4, 4, 26, 18);
    g.fillRect(34, 4, 26, 30);
    g.fillStyle = '#7ac74f';
    g.fillRect(0, h - 6, w, 6);
  });
  R.cell('photo', 72, 56, framed((g, w, h) => {
    g.fillStyle = '#8fd0e8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7e27a';
    g.beginPath();
    g.arc(w * 0.7, h * 0.3, 7, 0, TAU);
    g.fill();
    g.fillStyle = '#d8b48a';
    g.fillRect(0, h * 0.65, w, h * 0.35);
  }, { border: '#2b2b30', inner: 4 }));
}

// Rick's sat clip for someone else of the cast, turned (as meshyCast turns
// every clip it loads) so its hips face the way the sitter's walk does: ahead
function facingAhead(c, clip) {
  const own = clip.clone();
  const hips = c.group.getObjectByName('Hips');
  const ref = c.act.walk?.getClip();
  if (!hips?.parent || !ref) return own;
  c.group.updateMatrixWorld(true);
  // up, in the hips' parent's frame within the model
  const rel = c.body.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hips.parent.getWorldQuaternion(new THREE.Quaternion()));
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rel.invert());
  const ahead = heading(ref, up);
  if (ahead != null) faceForward(own, up, ahead);
  return own;
}

// how far Jerry sits back from where he stands, and how low (the sat clip turns his bones only)
const JERRY_SIT = { back: 0.12, y: -0.45 };
// the open doorways between the rooms (each a little in from the walls' ends), and the rise of each one's arch
const HOUSE_DOORWAYS = [
  [[-306.7, -5.88], [-306.7, -4.32], 0.5],
  [[-306.7, 0.12], [-306.7, 1.68], 0.5],
  [[-305.08, -1.9], [-302.32, -1.9], 0.42],
  [[-296.9, -7.9], [-296.9, -6.32], 0.5],
  [[-299.5, 0.42], [-299.5, 1.98], 0.5],
  [[-293.28, -1.6], [-291.72, -1.6], 0],
  [[-291.78, 0.5], [-290.22, 0.5], 0],
  [[-295.7, -1.18], [-295.7, 0.38], 0.5],
];
