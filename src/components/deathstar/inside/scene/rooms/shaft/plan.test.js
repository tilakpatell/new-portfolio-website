import { describe, expect, it } from 'vitest';
import { furnish } from '../../../rules/furnish';
import { buildLayout } from '../../../rules/layout';
import { DS1 } from '../../../rules/stations/ds1';
import { approach, bridgePlan, bridgeSpans, flagOn, hazeLayers, openEdges, rackSlots, vaderOf } from './plan';

const layout = buildLayout(DS1);
const room = (id) => layout.rooms.get(id);
const propsOf = (id) => furnish(room(id), layout.station).props;
const near = (a, b) => Math.abs(a - b) < 1e-6;

describe('reading the story’s flags from a frame', () => {
  it('finds a flag in the game the scene hands every room', () => {
    expect(flagOn({ g: { flags: new Set(['tractor-off']) } }, 'tractor-off')).toBe(true);
    expect(flagOn({ g: { flags: new Set(['ramp']) } }, 'tractor-off')).toBe(false);
  });

  it('takes flags given straight on the frame, as a set or a list', () => {
    expect(flagOn({ flags: new Set(['bridge']) }, 'bridge')).toBe(true);
    expect(flagOn({ flags: ['bridge'] }, 'bridge')).toBe(true);
  });

  it('says no for a frame with no flags at all', () => {
    expect(flagOn(undefined, 'bridge')).toBe(false);
    expect(flagOn({}, 'bridge')).toBe(false);
  });
});

describe('easing a moving part to where it should be', () => {
  it('moves at its rate and stops on the mark', () => {
    expect(approach(0, 1, 0.5, 0.5)).toBeCloseTo(0.25, 9);
    expect(approach(0.9, 1, 0.5, 0.5)).toBe(1);
    expect(approach(0.5, 0, 0.25, 1)).toBeCloseTo(0.25, 9);
    expect(approach(0.1, 0, 1, 1)).toBe(0);
  });

  it('stands still in a frame with no time', () => {
    expect(approach(0.4, 1, 0, 2)).toBe(0.4);
  });
});

describe('the haze that darkens a shaft with depth', () => {
  it('lays its layers between the near end and the far one, from the near end on', () => {
    const { ys } = hazeLayers({ near: -50, far: -110, n: 12, keep: 0.03 });
    expect(ys).toHaveLength(12);
    for (const y of ys) {
      expect(y).toBeLessThan(-50);
      expect(y).toBeGreaterThan(-110);
    }
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThan(ys[i - 1]);
  });

  it('runs upwards as well, for the dark over a ledge', () => {
    const { ys } = hazeLayers({ near: -42, far: -12, n: 5, keep: 0.1 });
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
    expect(ys[0]).toBeGreaterThan(-42);
    expect(ys.at(-1)).toBeLessThan(-12);
  });

  it('lets through only `keep` of what lies past every layer', () => {
    for (const n of [4, 6, 12]) {
      const { opacity } = hazeLayers({ near: 0, far: -60, n, keep: 0.03 });
      expect((1 - opacity) ** n).toBeCloseTo(0.03, 6);
    }
  });

  it('crowds its layers towards the near end, so the dark starts soon under the ledge', () => {
    const { ys } = hazeLayers({ near: 0, far: -60, n: 8, keep: 0.05 });
    expect(ys[0] - ys[1]).toBeLessThan(ys[6] - ys[7]);
  });
});

describe('the edges of a ledge that drop into the shaft', () => {
  it('finds both sides of the tractor beam’s ledge and three sides of its platform, open over the void', () => {
    const edges = openEdges(room('tractor'));
    const ledge = edges.filter((e) => e.floor === 0);
    expect(ledge.map((e) => e.side).sort()).toEqual(['east', 'west']);
    for (const e of ledge) {
      expect(Math.min(e.a.z, e.b.z)).toBeCloseTo(-118.6, 6);
      expect(Math.max(e.a.z, e.b.z)).toBeCloseTo(-111.6, 6);
    }
    const platform = edges.filter((e) => e.floor === 1);
    expect(platform.filter((e) => e.side === 'north')).toHaveLength(1);
    expect(platform.filter((e) => e.side === 'west')).toHaveLength(1);
    expect(platform.filter((e) => e.side === 'east')).toHaveLength(1);
    // the platform’s south edge is open either side of where the ledge meets it
    const south = platform.filter((e) => e.side === 'south').map((e) => [Math.min(e.a.x, e.b.x), Math.max(e.a.x, e.b.x)]).sort((p, q) => p[0] - q[0]);
    expect(south).toHaveLength(2);
    expect(south[0][0]).toBeCloseTo(-25.5, 6);
    expect(south[0][1]).toBeCloseTo(-24.6, 6);
    expect(south[1][0]).toBeCloseTo(-23.4, 6);
    expect(south[1][1]).toBeCloseTo(-22.5, 6);
  });

  it('leaves a ledge’s lip whole where only the bridge, which comes and goes, meets it', () => {
    const edges = openEdges(room('chasm'));
    const west = edges.filter((e) => e.floor === 0);
    expect(west).toHaveLength(1);
    expect(west[0].side).toBe('east');
    expect(Math.abs(west[0].b.z - west[0].a.z)).toBeCloseTo(8, 6);
    // and the bridge has no edges of its own: it is drawn as it moves
    expect(edges.some((e) => e.floor === 1)).toBe(false);
  });

  it('keeps a lip off the wall a ledge stands against', () => {
    const upper = openEdges(room('chasm')).filter((e) => e.floor === 3);
    expect(upper.map((e) => e.side).sort()).toEqual(['east', 'south', 'west']);
  });
});

describe('the chasm’s bridge', () => {
  it('runs out from the ledge with its control, across the whole gap', () => {
    const plan = bridgePlan(room('chasm'), propsOf('chasm'));
    expect(plan.axis).toBe('x');
    expect(plan.face).toBeCloseTo(27.7, 6);
    expect(plan.dir).toBe(1);
    expect(plan.span).toBeCloseTo(12, 6);
    expect(plan.mid).toBeCloseTo(-99.6, 6);
    expect(plan.width).toBeCloseTo(2, 6);
    expect(plan.y).toBe(-48);
  });

  it('runs out from the far ledge when its control stands there', () => {
    const props = propsOf('chasm').map((p) => (p.tag === 'bridge-control' ? { ...p, x: 41.5 } : p));
    const plan = bridgePlan(room('chasm'), props);
    expect(plan.face).toBeCloseTo(39.7, 6);
    expect(plan.dir).toBe(-1);
  });

  it('has no bridge to plan in a room without one', () => {
    expect(bridgePlan(room('tractor'), propsOf('tractor'))).toBeNull();
  });

  it('spans the gap end to end once it is out, each length overlapping the last', () => {
    const plan = bridgePlan(room('chasm'), propsOf('chasm'));
    const spans = bridgeSpans(plan, 1, { n: 4, overlap: 0.05 });
    expect(spans).toHaveLength(4);
    expect(Math.min(...spans.map((s) => Math.min(s.a, s.b)))).toBeLessThanOrEqual(27.7);
    expect(Math.max(...spans.map((s) => Math.max(s.a, s.b)))).toBeCloseTo(39.7, 6);
    for (let i = 1; i < spans.length; i++) expect(spans[i].a).toBeLessThan(spans[i - 1].b);
  });

  it('draws every length back inside its ledge when it is in', () => {
    const plan = bridgePlan(room('chasm'), propsOf('chasm'));
    for (const s of bridgeSpans(plan, 0, { n: 4, overlap: 0.05 })) {
      expect(Math.min(s.a, s.b)).toBeGreaterThanOrEqual(24.7 - 1e-6);
      expect(Math.max(s.a, s.b)).toBeLessThanOrEqual(27.7 + 0.06);
    }
  });

  it('is half out half way', () => {
    const plan = bridgePlan(room('chasm'), propsOf('chasm'));
    const tip = Math.max(...bridgeSpans(plan, 0.5, { n: 4, overlap: 0.05 }).map((s) => s.b));
    expect(tip).toBeGreaterThan(27.7 + 5);
    expect(tip).toBeLessThan(27.7 + 7);
  });
});

describe('the TIE bay’s racks', () => {
  const props = propsOf('tiebay');
  const racks = props.filter((p) => p.kind === 'tie-rack');
  const ties = props.filter((p) => p.kind === 'tie');

  it('finds a cradle on its rack for every fighter, and an empty one where a fighter is missing', () => {
    for (const rack of racks) {
      const slots = rackSlots(rack, ties);
      const mine = ties.filter((t) => near(t.z, rack.z));
      expect(slots.filter((s) => s.tie !== null)).toHaveLength(mine.length);
      for (const s of slots) if (s.tie !== null) expect(near(ties[s.tie].x, s.x) && near(ties[s.tie].z, s.z)).toBe(true);
      // evenly along the rack: every gap between neighbours the same
      const xs = slots.map((s) => s.x).sort((a, b) => a - b);
      for (let i = 2; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(xs[1] - xs[0], 6);
    }
    const front = racks.find((r) => near(r.z, -14));
    expect(rackSlots(front, ties).filter((s) => s.tie === null).map((s) => s.x)).toEqual([-49]);
  });

  it('gives Vader the fighter nearest the launch doors, in the front row', () => {
    const doors = layout.doors.get('tiebay-field');
    const k = vaderOf(ties, doors);
    expect(ties[k].z).toBe(-14);
    const d = (t) => Math.hypot(t.x - doors.x, t.z - doors.z);
    for (const t of ties) expect(d(ties[k])).toBeLessThanOrEqual(d(t));
  });

  it('has no Vader’s fighter in a bay with none', () => {
    expect(vaderOf([], layout.doors.get('tiebay-field'))).toBe(-1);
  });
});
