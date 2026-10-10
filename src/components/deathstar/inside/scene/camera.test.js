import { describe, expect, it } from 'vitest';
import { buildLayout } from '../rules/layout';
import { cameraPose, wallHits } from './camera';

// a body standing at the origin on a floor at y 0, facing north (yaw 0 faces −z)
const body = (o = {}) => ({ x: 0, y: 0, z: 0, yaw: 0, crouch: false, ...o });
const nothing = () => Infinity;

// a wall across the whole world at z = `at`: how far along from → to it is, if the line reaches it
const wallAtZ = (at) => (from, to) => {
  const dz = to.z - from.z;
  if (Math.abs(dz) < 1e-9) return Infinity;
  const t = (at - from.z) / dz;
  return t >= 0 && t <= 1 ? t * Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) : Infinity;
};
const wallAtX = (at) => (from, to) => wallAtZ(at)({ x: from.z, y: from.y, z: from.x }, { x: to.z, y: to.y, z: to.x });

describe('the camera, over the shoulder', () => {
  it('stands 2.6 m behind, 0.55 m to the right and 1.7 m up when nothing is in the way', () => {
    const { pos } = cameraPose(body(), { view: 'third' }, nothing);
    expect(pos.x).toBeCloseTo(0.55);
    expect(pos.y).toBeCloseTo(1.7);
    expect(pos.z).toBeCloseTo(2.6);
  });

  it('turns with the body: facing east, behind is west and the right shoulder is south', () => {
    const { pos } = cameraPose(body({ yaw: Math.PI / 2 }), { view: 'third' }, nothing);
    expect(pos.x).toBeCloseTo(-2.6);
    expect(pos.z).toBeCloseTo(0.55);
  });

  it('pulls in to 0.2 m short of a wall 1 m behind', () => {
    const { pos } = cameraPose(body(), { view: 'third' }, wallAtZ(1));
    expect(pos.z).toBeCloseTo(0.8);
    expect(pos.x).toBeCloseTo(0.55);
    expect(pos.y).toBeCloseTo(1.7);
  });

  it('never goes behind the shoulder, however close the wall', () => {
    const { pos } = cameraPose(body(), { view: 'third' }, wallAtZ(0.1));
    expect(pos.z).toBeCloseTo(0);
  });

  it('keeps the shoulder 0.2 m off a wall close on the right', () => {
    const { pos } = cameraPose(body(), { view: 'third' }, wallAtX(0.3));
    expect(pos.x).toBeCloseTo(0.1);
    expect(pos.z).toBeCloseTo(2.6);
  });

  it('comes in to 1.4 m behind while aiming', () => {
    const { pos } = cameraPose(body(), { view: 'third', aim: true }, nothing);
    expect(pos.z).toBeCloseTo(1.4);
    expect(pos.x).toBeCloseTo(0.55);
  });

  it('drops behind and below to look up, and looks the way the yaw and pitch say', () => {
    const pitch = 0.4;
    const { pos, look } = cameraPose(body(), { view: 'third', pitch }, nothing);
    expect(pos.y).toBeCloseTo(1.7 - 2.6 * Math.sin(pitch));
    expect(pos.z).toBeCloseTo(2.6 * Math.cos(pitch));
    const d = { x: look.x - pos.x, y: look.y - pos.y, z: look.z - pos.z };
    const n = Math.hypot(d.x, d.y, d.z);
    expect(d.x / n).toBeCloseTo(0);
    expect(d.y / n).toBeCloseTo(Math.sin(pitch));
    expect(d.z / n).toBeCloseTo(-Math.cos(pitch));
  });

  it('follows a turn of the head that the body hasn’t made yet', () => {
    const { pos } = cameraPose(body(), { view: 'third', yaw: Math.PI }, nothing);
    expect(pos.x).toBeCloseTo(-0.55);
    expect(pos.z).toBeCloseTo(-2.6);
  });

  it('comes no further out than `reach`, so the scene can ease it back out after a wall', () => {
    const { pos, dist } = cameraPose(body(), { view: 'third', reach: 1.5 }, nothing);
    expect(pos.z).toBeCloseTo(1.5);
    expect(dist).toBeCloseTo(1.5);
  });
});

describe('the camera, first person', () => {
  it('sits at the eyes, 1.62 m up, and looks ahead', () => {
    const { pos, look } = cameraPose(body({ x: 3, y: 2, z: -4 }), { view: 'first' }, wallAtZ(-3.5));
    expect(pos.x).toBe(3);
    expect(pos.y).toBeCloseTo(3.62);
    expect(pos.z).toBe(-4);
    expect(look.x).toBeCloseTo(3);
    expect(look.y).toBeCloseTo(3.62);
    expect(look.z).toBeLessThan(-4);
  });

  it('sits at the crouched eyes, 1.05 m up, when crouching', () => {
    const { pos } = cameraPose(body({ crouch: true }), { view: 'first' }, nothing);
    expect(pos.y).toBeCloseTo(1.05);
  });
});

// a 10 m hall (walls at x ±5, z ±5, 3 m high) with a corridor north of it through a 1.2 m door
const room = (id, x, z, w, d) => ({ id, kind: 'corridor', name: id, section: 's', x, z, w, d, y: 0, h: 3 });
const start = { room: 'hall', x: 0, z: 0, yaw: 0 };
const LAYOUT = buildLayout({
  id: 't',
  name: 'Test',
  era: 'anh',
  sections: { s: 'Test' },
  rooms: [room('hall', 0, 0, 10, 10), room('north', 0, -9, 3, 8)],
  doors: [{ id: 'gap', a: 'hall', b: 'north', x: 0, z: -5, axis: 'x', w: 1.2, h: 2.2, kind: 'slide' }],
  lifts: [],
  starts: { rebel: start, imperial: start },
  spots: {},
});

describe('the camera’s walls, from the layout', () => {
  it('finds the wall a line runs into, and how far along it is', () => {
    const hits = wallHits(LAYOUT, () => false);
    expect(hits({ x: 0, y: 1.5, z: 0 }, { x: 8, y: 1.5, z: 0 })).toBeCloseTo(5);
    expect(hits({ x: 0, y: 1.5, z: 0 }, { x: 4, y: 1.5, z: 0 })).toBe(Infinity);
  });

  it('sees through an open door and stops at a shut one', () => {
    const line = [{ x: 0, y: 1.5, z: 0 }, { x: 0, y: 1.5, z: -7 }];
    expect(wallHits(LAYOUT, (id) => id === 'gap')(...line)).toBe(Infinity);
    expect(wallHits(LAYOUT, () => false)(...line)).toBeCloseTo(5);
  });

  it('stops at the wall over a door, open or not', () => {
    expect(wallHits(LAYOUT, () => true)({ x: 0, y: 2.6, z: 0 }, { x: 0, y: 2.6, z: -7 })).toBeCloseTo(5);
  });

  it('stops at the ceiling and the floor of the room it starts in', () => {
    const hits = wallHits(LAYOUT, () => false);
    expect(hits({ x: 0, y: 2, z: 0 }, { x: 0, y: 4, z: 0 })).toBeCloseTo(1);
    expect(hits({ x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 })).toBeCloseTo(1);
  });

  // a ship on the deck, a console, a pillar: what stands in the room stops the eye as a wall does
  it('stops at what stands in the room it starts in, a box at its height and a pillar, and passes over a low one', () => {
    const solids = (id) => (id === 'hall' ? [{ box: { x0: 2, x1: 3, z0: -1, z1: 1, y0: 0, y1: 2 } }, { circle: { x: 0, z: 3, r: 0.5 } }] : []);
    const hits = wallHits(LAYOUT, () => false, solids);
    expect(hits({ x: 0, y: 1.5, z: 0 }, { x: 4, y: 1.5, z: 0 })).toBeCloseTo(2);
    expect(hits({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 1.5, z: 4 })).toBeCloseTo(2.5);
    // (over the top of the box: a crate is looked over)
    expect(hits({ x: 0, y: 2.5, z: 0 }, { x: 4, y: 2.5, z: 0 })).toBe(Infinity);
    // (and the camera behind you, a crate at your back, is pulled in short of it)
    const pose = cameraPose(body({ yaw: -Math.PI / 2 }), { view: 'third' }, hits);
    expect(pose.pos.x).toBeLessThan(2 - 0.15);
  });
});
