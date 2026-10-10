// The first Death Star’s core shaft chasm and its TIE launch bay (see
// ../index.js for the contract).
//
// The chasm: a ledge either side of a gap over the central core shaft,
// bottomless (its walls go on storey under storey into the dark: ./depths.js),
// the bridge telescoping out of the near ledge while the story has it out
// (the flag 'bridge'), its controls on a pedestal by the door, and high
// overhead the outcrop the grapple’s line catches on. Lit only by the lips
// of the ledges and a few lamps, as the station has it (`dark`).
//
// The TIE bay: TIE fighters hung in rows from overhead racks, noses to the
// launch field, on a glossy deck under white light grids; each a ball
// cockpit with its round window, two pylons out to hexagonal wings ribbed
// with solar panels, drawn here in parts as big as rules/furnish.js gives.
//
//   BAY_PROPS: { tie, pedestal, anchor }   (prop) → local parts
//   buildChasm, buildTiebay   (kit, room, layout, { renderer }) → { group, lamps, update(t, dt, ctx), dispose() }

import * as THREE from 'three';
import { furnish } from '../../../rules/furnish';
import { box, cyl, drawWith, finish, onProp, plate } from '../deep/parts';
import { deepWalls, hazeOf, lips, slab } from './depths';
import { approach, bridgePlan, bridgeSpans, flagOn, hazeLayers, openEdges, rackSlots } from './plan';

const COOL = 0xdfe8ff;
const DOWN = { high: 60, small: 30 }; // metres the chasm’s walls go on under its ledges
const UP = 18; // and over its ceiling
const SPANS = 4; // the bridge’s telescoping lengths
const RUN = 0.9; // the share of the bridge a second runs out (or in)

// ── the things in them ──

// A TIE fighter about its foot, nose to +z: the hexagonal wings stand a vertex up, 2R tall and R√3
// along; the ball between them on its pylons.
function tie({ w, d, h }) {
  const R = Math.min(h / 2 - 0.1, d / Math.sqrt(3) - 0.05);
  const y = h / 2;
  const x = w / 2 - 0.16; // (the wing’s frame and spokes stand a little out from it)
  const hex = (sx) => [
    { geo: new THREE.CylinderGeometry(R, R, 0.12, 6).rotateY(Math.PI / 6).rotateZ(Math.PI / 2).translate(sx * x, y, 0), mat: 'black' },
    // the wing’s frame and its spokes from the hub
    { geo: new THREE.TorusGeometry(R - 0.06, 0.07, 4, 6).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(sx * (x + 0.07), y, 0), mat: 'trim' },
    ...Array.from({ length: 3 }, (_, k) => ({ geo: new THREE.BoxGeometry(0.06, 2 * R - 0.2, 0.08).rotateX((k * Math.PI) / 3).translate(sx * (x + 0.08), y, 0), mat: 'trim' })),
    cyl(0.45, 0.45, 0.16, sx * (x + 0.02), y, 0, 'trim', { axis: 'x', sides: 16 }),
  ];
  const ball = 0.95;
  return [
    ...hex(-1),
    ...hex(1),
    // the pylons, thicker at the ball
    cyl(0.32, 0.2, x - 0.5, -(x + 0.5) / 2, y, 0, 'trim', { axis: 'x', sides: 10 }),
    cyl(0.2, 0.32, x - 0.5, (x + 0.5) / 2, y, 0, 'trim', { axis: 'x', sides: 10 }),
    { geo: new THREE.SphereGeometry(ball, 24, 16).translate(0, y, 0), mat: 'trim' },
    // the round window, its frame in spokes, and the hatch on top
    cyl(0.62, 0.62, 0.12, 0, y, ball - 0.08, 'black', { axis: 'z', sides: 24 }),
    cyl(0.5, 0.5, 0.02, 0, y, ball + 0.0, 'glass', { axis: 'z', sides: 8 }),
    cyl(0.38, 0.38, 0.1, 0, y + ball - 0.04, 0, 'black', { sides: 16 }),
    // the guns under the window
    box(0.08, 0.08, 0.3, -0.22, y - 0.55, ball - 0.18, 'black'),
    box(0.08, 0.08, 0.3, 0.22, y - 0.55, ball - 0.18, 'black'),
  ];
}

// the bridge’s controls: a stem and a sloped top with its two keys
const pedestal = ({ w, h }) => [
  cyl(w / 2 - 0.02, w / 2, 0.06, 0, 0.03, 0, 'black', { sides: 16 }),
  cyl(0.07, 0.1, h - 0.2, 0, (h - 0.2) / 2 + 0.05, 0, 'trim', { sides: 12 }),
  box(w - 0.06, 0.14, w * 0.6, 0, h - 0.07, 0, 'trim'),
  plate(w * 0.6, w * 0.4, 0, h + 0.002, 0, 'console', 'up'),
  box(0.07, 0.03, 0.07, -0.08, h + 0.01, 0.06, 'red'),
  box(0.07, 0.03, 0.07, 0.08, h + 0.01, 0.06, 'strip'),
];

// the outcrop overhead the grapple’s line catches on: a block out of the shaft’s wall and a hoop under it
const anchor = ({ w, d, h }) => [box(w, h * 0.6, d, 0, h * 0.7, 0, 'trim'), { geo: new THREE.TorusGeometry(0.16, 0.035, 6, 16).translate(0, 0.2, 0), mat: 'rail' }, box(0.06, 0.25, 0.06, 0, 0.34, 0, 'rail')];

export const BAY_PROPS = { tie, pedestal, anchor };

// ── the chasm ──

export function buildChasm(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const down = kit.small ? DOWN.small : DOWN.high;
  const parts = kit.shell(room, layout, { floor: false, ceiling: false, bay: 2.4, rib: 0.34, ribDepth: 0.22, kick: 0.3, band: 0.5, tall: 1.9, lights: false, seed: 9 });
  parts.push(...deepWalls(kit, layout, room, { below: down, above: UP, storey: 4, every: 3, seed: 9 }));
  for (const f of room.floors.filter((g) => g.tag !== 'bridge')) parts.push(...slab(kit, f, { thick: 0.4 }));
  parts.push(...lips(kit, openEdges(room), { thick: 0.4 }));
  for (const p of props) parts.push(...drawWith(BAY_PROPS, p));
  // the anchor hangs from its own beam out of the nearer wall
  for (const a of props.filter((p) => p.kind === 'anchor')) {
    const wallZ = Math.abs(a.z - room.box.z0) < Math.abs(a.z - room.box.z1) ? room.box.z0 : room.box.z1;
    parts.push(box(0.4, 0.4, Math.abs(wallZ - a.z) + 0.3, a.x, a.y + a.h * 0.7, (wallZ + a.z) / 2, 'trim'));
  }

  // the bridge: its lengths as unit boxes scaled each frame to where they have run
  const plan = bridgePlan(room, props);
  const lengths = new THREE.Group();
  lengths.name = 'chasm-bridge';
  const spans = plan
    ? Array.from({ length: SPANS }, () => {
        const deck = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 1), kit.mat('floor'));
        const under = new THREE.Mesh(new THREE.BoxGeometry(1, 0.22, 1), kit.mat('trim'));
        lengths.add(deck, under);
        return { deck, under };
      })
    : [];
  const narrow = (k) => (plan ? plan.width - k * 0.04 : 0);
  function placeBridge(out) {
    for (const [k, { a, b }] of bridgeSpans(plan, out, { n: SPANS }).entries()) {
      const { deck, under } = spans[k];
      const len = Math.max(0.01, b - a);
      const mid = (a + b) / 2;
      const w = narrow(k);
      const [x, z] = plan.axis === 'x' ? [mid, plan.mid] : [plan.mid, mid];
      const [sx, sz] = plan.axis === 'x' ? [len, w] : [w, len];
      deck.position.set(x, plan.y - 0.06, z);
      deck.scale.set(sx, 1, sz);
      under.position.set(x, plan.y - 0.23 - k * 0.02, z);
      under.scale.set(sx, 1, sz);
    }
  }
  let out = null;

  const haze = hazeOf(room.box, hazeLayers({ near: room.y - 2, far: room.y - down + 1, n: kit.small ? 7 : 14, keep: 0.02 }));
  const hazeUp = hazeOf(room.box, hazeLayers({ near: room.y + room.h - 1, far: room.y + room.h + UP - 1, n: kit.small ? 3 : 6, keep: 0.06 }));
  const top = room.y + room.h;
  const lamps = [
    { x: room.box.x0 + 2, y: room.y + 2.6, z: room.z, color: COOL, intensity: 24, distance: 11 },
    { x: room.box.x1 - 2, y: room.y + 2.6, z: room.z, color: COOL, intensity: 24, distance: 11 },
    { x: room.x, y: top - 1, z: room.z, color: 0x9fb8e8, intensity: 40, distance: 18 },
  ];
  return finish(kit, room, parts, {
    lamps,
    renderer,
    extra: [lengths, haze, hazeUp],
    probeAt: { x: room.box.x0 + 2, y: room.y + 1.5, z: room.z },
    update(t, dt, ctx) {
      if (!plan) return;
      const want = flagOn(ctx, 'bridge') ? 1 : 0;
      const was = out;
      out = out === null ? want : approach(out, want, dt, RUN);
      if (out !== was) placeBridge(out);
      lengths.visible = out > 0.001;
    },
    dispose() {
      for (const { deck, under } of spans) {
        deck.geometry.dispose();
        under.geometry.dispose();
      }
      for (const m of [haze, hazeUp]) {
        m.geometry.dispose();
        m.material.dispose();
      }
    },
  });
}

// ── the TIE bay ──

export function buildTiebay(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const parts = kit.shell(room, layout, { bay: 2.6, rib: 0.4, ribDepth: 0.24, kick: 0.4, band: 0.6, tall: 2.6, lights: true, every: 5, seed: 4 });
  const ties = props.filter((p) => p.kind === 'tie');
  for (const p of ties) parts.push(...drawWith(BAY_PROPS, p));
  // each rack a gantry across the bay, its cradles down to the fighters it holds, its ends into the walls
  for (const rack of props.filter((p) => p.kind === 'tie-rack')) {
    const local = [box(rack.w, rack.h * 0.5, rack.d * 0.5, 0, rack.h * 0.75, 0, 'trim'), box(rack.w, 0.08, rack.d, 0, rack.h * 0.5, 0, 'rail'), box(rack.w - 0.4, 0.03, 0.04, 0, rack.h * 0.47, rack.d / 2 - 0.05, 'strip')];
    parts.push(...onProp(rack, local));
    for (const slot of rackSlots(rack, ties)) {
      const t = slot.tie === null ? null : ties[slot.tie];
      const foot = t ? t.y + t.h / 2 + 0.95 : rack.y - 1.2;
      parts.push(cyl(0.12, 0.12, rack.y - foot, slot.x, (rack.y + foot) / 2, slot.z, 'rail', { sides: 8 }));
      parts.push(box(0.6, 0.18, 0.6, slot.x, foot + 0.09, slot.z, 'trim'));
    }
  }
  // the deck’s launch lanes, lit, out to the field
  const top = room.y + room.h;
  for (const x of [-6, 6]) parts.push(plate(0.2, (room.d ?? room.w) - 2, room.x + x, room.y + 0.003, room.z, 'strip', 'up'));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) parts.push(box(3.2, 0.12, 3.2, room.x + (i - 1) * 11, top - 0.06, room.z + (j - 1) * 11, 'trim'), plate(3, 3, room.x + (i - 1) * 11, top - 0.125, room.z + (j - 1) * 11, 'strip', 'down'));
  const lamps = [
    { x: room.x, y: top - 1, z: room.z, color: COOL, intensity: 320, distance: 40 },
    { x: room.x - 10, y: top - 1, z: room.z - 10, color: COOL, intensity: 60, distance: 20 },
    { x: room.x + 10, y: top - 1, z: room.z + 8, color: COOL, intensity: 60, distance: 20 },
  ];
  return finish(kit, room, parts, { lamps, renderer, probeAt: { x: room.x, y: room.y + 2, z: room.z + 6 } });
}
