import { describe, expect, it } from 'vitest';
import { furnish } from '../../../rules/furnish';
import { buildLayout } from '../../../rules/layout';
import { DS2 } from '../../../rules/stations/ds2';
import { LAMBDA, alcovesOf, cutSpan, fitModel, rackOf, rampFor, ranksOf, screensOf, wellOver } from './plan';

const layout = buildLayout(DS2);
const room = (id) => layout.rooms.get(id);
const made = (id) => furnish(room(id), layout.station);
const spotsIn = (id) => Object.entries(DS2.spots).filter(([, s]) => s.room === id).map(([name, s]) => ({ ...s, name }));
const doorsOf = (id) => room(id).doors.map((d) => layout.doors.get(d));
const lambdas = (id) => made(id).props.filter((p) => p.kind === 'lambda');
const fwd = (yaw) => ({ x: Math.sin(yaw), z: -Math.cos(yaw) });

// a model’s box as it loads: nose to +z, its wheels a little under its origin
const BOX = { min: { x: -6.24, y: -0.1, z: -8.79 }, max: { x: 6.24, y: 19.9, z: 8.79 } };
// a point of the model taken through a fit: in the holder’s frame, then turned and set down
function place(fit, p) {
  const [x, y, z] = [(p.x + fit.offset.x) * fit.scale, (p.y + fit.offset.y) * fit.scale, (p.z + fit.offset.z) * fit.scale];
  const [c, s] = [Math.cos(fit.turn), Math.sin(fit.turn)];
  return { x: fit.at.x + x * c + z * s, y: fit.at.y + y, z: fit.at.z - x * s + z * c };
}

describe('a model fitted to the prop furnish puts down', () => {
  it('scales her to the prop’s length and puts her nose ahead along its yaw', () => {
    for (const prop of [...lambdas('dock'), ...lambdas('hangar272')]) {
      const fit = fitModel(prop, BOX);
      expect(fit.scale * (BOX.max.z - BOX.min.z)).toBeCloseTo(prop.d, 6);
      const nose = place(fit, { x: 0, y: 0, z: BOX.max.z });
      const f = fwd(prop.yaw);
      expect(nose.x).toBeCloseTo(prop.x + (f.x * prop.d) / 2, 6);
      expect(nose.z).toBeCloseTo(prop.z + (f.z * prop.d) / 2, 6);
    }
  });

  it('stands her wheels on the prop’s floor', () => {
    const [prop] = lambdas('hangar272');
    const fit = fitModel(prop, BOX);
    expect(place(fit, { x: 0, y: BOX.min.y, z: 0 }).y).toBeCloseTo(prop.y, 6);
    expect(place(fit, { x: 0, y: BOX.max.y, z: 0 }).y).toBeCloseTo(prop.y + LAMBDA.tall * prop.d, 1);
  });
});

describe('a shuttle’s ramp', () => {
  it('comes down to the station’s ramp spot ahead of her, not her neighbour’s', () => {
    const [st321, escape] = lambdas('dock');
    const spots = spotsIn('dock');
    expect(rampFor(st321, spots).foot).toMatchObject({ x: DS2.spots['dock-ramp'].x, z: DS2.spots['dock-ramp'].z });
    expect(rampFor(escape, spots).foot).toMatchObject({ x: DS2.spots['shuttle-ramp'].x, z: DS2.spots['shuttle-ramp'].z });
  });

  it('runs back from its foot towards her, rising to the hatch', () => {
    const [ship] = lambdas('hangar272');
    const ramp = rampFor(ship, spotsIn('hangar272'));
    expect(Math.hypot(ramp.top.x - ramp.foot.x, ramp.top.z - ramp.foot.z)).toBeCloseTo(LAMBDA.ramp.run, 6);
    expect(Math.hypot(ramp.top.x - ship.x, ramp.top.z - ship.z)).toBeLessThan(Math.hypot(ramp.foot.x - ship.x, ramp.foot.z - ship.z));
    expect(ramp.rise).toBe(LAMBDA.ramp.rise);
  });

  it('is not there when no ramp spot stands ahead of her', () => {
    const [ship] = lambdas('dock');
    expect(rampFor(ship, [{ name: 'dock-ramp', x: ship.x, z: ship.z + 7 }])).toBeNull();
  });
});

describe('the well in the ceiling over a shuttle taller than her bay', () => {
  it('opens over each of the dock’s shuttles, wider than her and up past her fin', () => {
    for (const ship of lambdas('dock')) {
      const well = wellOver(ship, room('dock'));
      expect(well).not.toBeNull();
      expect(well.y0).toBe(room('dock').y + room('dock').h);
      expect(well.y1).toBeGreaterThan(ship.y + LAMBDA.tall * ship.d);
      expect(well.x0).toBeLessThan(ship.x - (LAMBDA.wide * ship.d) / 2);
      expect(well.x1).toBeGreaterThan(ship.x + (LAMBDA.wide * ship.d) / 2);
      expect(well.z1 - well.z0).toBeGreaterThan(ship.d);
    }
  });

  it('stays inside the dock’s ceiling, and the two wells keep apart', () => {
    const [a, b] = lambdas('dock').map((s) => wellOver(s, room('dock')));
    const box = room('dock').box;
    for (const w of [a, b]) expect(w.x0 >= box.x0 && w.x1 <= box.x1 && w.z0 >= box.z0 && w.z1 <= box.z1).toBe(true);
    expect(a.x1 < b.x0 || b.x1 < a.x0).toBe(true);
  });

  it('is not needed in Hangar 272, thirty metres high', () => {
    expect(wellOver(lambdas('hangar272')[0], room('hangar272'))).toBeNull();
  });
});

describe('cutting a span round holes', () => {
  it('leaves the stretches either side of each hole', () => {
    expect(cutSpan(0, 10, [[2, 3], [6, 8]])).toEqual([[0, 2], [3, 6], [8, 10]]);
  });

  it('drops a hole wholly outside the span and joins overlapping ones', () => {
    expect(cutSpan(0, 10, [[12, 14], [4, 6], [5, 7]])).toEqual([[0, 4], [7, 10]]);
  });
});

describe('the ranks in Hangar 272', () => {
  const hangar = room('hangar272');
  const { solids } = made('hangar272');
  const ranks = ranksOf(hangar, { spots: spotsIn('hangar272'), solids, doors: doorsOf('hangar272') });
  const places = ranks.blocks.flatMap((b) => b.places.map((p) => ({ ...p, yaw: b.yaw })));

  it('run up the aisle from the foot of the Emperor’s ramp, the shuttle’s heading', () => {
    expect(ranks.aisle.x).toBe(DS2.spots['emperor-ramp'].x);
    expect(ranks.aisle.z1).toBeLessThanOrEqual(DS2.spots['emperor-ramp'].z);
    expect(ranks.aisle.z0).toBeLessThan(DS2.spots.ranks272.z);
  });

  it('give the trooper’s spot in the ranks a place of its own, facing the aisle', () => {
    const s = DS2.spots.ranks272;
    const mine = places.find((p) => Math.hypot(p.x - s.x, p.z - s.z) < 1e-6);
    expect(mine).toBeDefined();
    expect(mine.yaw).toBeCloseTo(s.yaw, 6);
  });

  it('stand in blocks either side, each the mirror of the other across the aisle', () => {
    const west = places.filter((p) => p.x < ranks.aisle.x);
    const east = places.filter((p) => p.x > ranks.aisle.x);
    expect(west.length).toBeGreaterThan(60);
    expect(east).toHaveLength(west.length);
    for (const p of west) expect(east.some((q) => Math.abs(q.x - (2 * ranks.aisle.x - p.x)) < 1e-6 && Math.abs(q.z - p.z) < 1e-6)).toBe(true);
    expect(places.every((p) => Math.abs(p.x - ranks.aisle.x) >= ranks.aisle.half - 1e-6)).toBe(true);
  });

  it('keep every place on the deck, a body’s width clear of the shuttle, the crates and the doorways', () => {
    const b = hangar.box;
    const clear = (s, p) => {
      const q = s.box ?? { x0: s.circle.x - s.circle.r, x1: s.circle.x + s.circle.r, z0: s.circle.z - s.circle.r, z1: s.circle.z + s.circle.r };
      return Math.hypot(Math.max(q.x0 - p.x, 0, p.x - q.x1), Math.max(q.z0 - p.z, 0, p.z - q.z1)) >= 0.35;
    };
    for (const p of places) {
      expect(p.x > b.x0 + 1 && p.x < b.x1 - 1 && p.z > b.z0 + 1 && p.z < b.z1 - 1).toBe(true);
      expect(solids.every((s) => clear(s, p))).toBe(true);
      for (const d of doorsOf('hangar272')) expect(Math.abs(p.x - d.x) > d.w / 2 + 0.35 || Math.abs(p.z - d.z) > 1.35).toBe(true);
    }
  });

  it('are not drawn in a hangar without a spot in the ranks', () => {
    expect(ranksOf(hangar, { spots: spotsIn('hangar272').filter((s) => !/^ranks/.test(s.name)), solids, doors: [] }).blocks).toEqual([]);
  });
});

describe('the antechamber’s bench alcoves', () => {
  const alcoves = alcovesOf(room('holding'), layout);

  it('are set into the two walls without a door, one in the middle of each', () => {
    const b = room('holding').box;
    expect(alcoves).toHaveLength(2);
    expect(alcoves.map((a) => a.x0).sort((p, q) => p - q)).toEqual([b.x0, b.x1]);
    for (const a of alcoves) {
      expect(a.x1).toBe(a.x0);
      expect((a.z0 + a.z1) / 2).toBeCloseTo(room('holding').z, 6);
      expect(Math.abs(a.z1 - a.z0)).toBeGreaterThanOrEqual(3);
    }
  });

  it('open outwards, away from the room, with a bench’s height under their head', () => {
    for (const a of alcoves) {
      expect(Math.sign(a.n.x)).toBe(Math.sign(a.x0 - room('holding').x));
      expect(a.y1 - a.y0).toBeGreaterThan(2);
    }
  });
});

describe('the command centre’s fittings', () => {
  const props = made('command').props;

  it('make the screen Jerjerrod faces from his desk the big targeting screen', () => {
    const screens = screensOf(props);
    expect(screens).toHaveLength(2);
    const desk = props.find((p) => p.kind === 'desk');
    const big = screens.find((s) => s.size === 'big');
    const f = fwd(desk.yaw);
    expect((big.x - desk.x) * f.x + (big.z - desk.z) * f.z).toBeGreaterThan(0);
    expect(screens.filter((s) => s.size === 'small')).toHaveLength(1);
  });

  it('hang the rifle rack on the door’s wall, clear of the doorway, on the far side from the desk', () => {
    const rack = rackOf(room('command'), layout, props);
    const door = layout.doors.get('command-corr');
    const desk = props.find((p) => p.kind === 'desk');
    expect(rack.z).toBeCloseTo(door.z, 6);
    expect(Math.abs(rack.x - door.x)).toBeGreaterThan(door.w / 2 + 1.5);
    expect(Math.sign(rack.x - door.x)).toBe(-Math.sign(desk.x - door.x));
    expect(fwd(rack.yaw).z).toBeCloseTo(-1, 6);
  });
});
