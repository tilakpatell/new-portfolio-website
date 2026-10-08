import { describe, expect, it } from 'vitest';
import { buildLayout } from '../rules/layout';
import { DS1 } from '../rules/stations/ds1';
import { blueprint } from './blueprint';

const ds1 = buildLayout(DS1);
const ids = (plan) => plan.rooms.map((r) => r.id);
const close = (v) => expect.closeTo(v, 6);

describe('the station’s blueprint, as the map draws it', () => {
  it('draws only the rooms seen, on the deck you’re on', () => {
    const plan = blueprint(ds1, { seen: ['bay327', 'ctl327', 'corr327', 'lift1-l5'], here: 'corr327' });
    expect(ids(plan).sort()).toEqual(['bay327', 'corr327', 'ctl327']);
  });

  it('always draws the room you’re in, and marks it', () => {
    const plan = blueprint(ds1, { seen: [], here: 'lift1-l5' });
    expect(plan.rooms).toEqual([expect.objectContaining({ id: 'lift1-l5', here: true, x0: 38.5, x1: 41.5, z0: -91.5, z1: -88.5 })]);
  });

  it('draws a room nested in another after it, so it shows on top', () => {
    const plan = blueprint(ds1, { seen: ['hold', 'bay327'], here: 'hold' });
    expect(ids(plan)).toEqual(['bay327', 'hold']);
    expect(plan.rooms.find((r) => r.id === 'bay327').here).toBe(false);
  });

  it('draws a doorway across its wall wherever a room drawn has one', () => {
    const plan = blueprint(ds1, { seen: ['bay327'], here: 'bay327' });
    const door = plan.doors.find((d) => d.id === 'bay327-corr');
    expect(door).toMatchObject({ kind: 'blast', x0: close(8.8), x1: close(11.2), z0: -24, z1: -24 });
    expect(plan.doors.find((d) => d.id === 'lobby1-lift')).toBeUndefined();
    const side = blueprint(ds1, { seen: ['lobby1'], here: 'lobby1' }).doors.find((d) => d.id === 'lobby1-ring2');
    expect(side).toMatchObject({ x0: 5, x1: 5, z0: close(-45.2), z1: close(-42.8) });
  });

  it('frames what it draws with a margin, and nothing when there is nothing to draw', () => {
    const plan = blueprint(ds1, { seen: ['corr327'], here: 'corr327' });
    expect(plan.bounds).toEqual({ x0: close(4.4), x1: close(15.6), z0: close(-44), z1: close(-20) });
    expect(blueprint(ds1, { seen: [], here: null })).toEqual({ rooms: [], doors: [], bounds: null });
  });
});
