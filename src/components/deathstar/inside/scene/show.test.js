import { describe, expect, it } from 'vitest';
import { buildLayout } from '../rules/layout';
import { STATIONS } from '../rules/stations';
import { bladeColour, bladeDir, effectsOf, viewsOf, wallYaw } from './show';

const ds1 = buildLayout(STATIONS.ds1);
const ds2 = buildLayout(STATIONS.ds2);

describe('the windows’ views', () => {
  it('turns a view so its −z looks out through the wall it is on', () => {
    // −z turned by the yaw: (−sin, −cos)
    const out = (wall) => [-Math.sin(wallYaw(wall)), -Math.cos(wallYaw(wall))].map((v) => Math.round(v) + 0);
    expect(out('north')).toEqual([0, -1]);
    expect(out('south')).toEqual([0, 1]);
    expect(out('east')).toEqual([1, 0]);
    expect(out('west')).toEqual([-1, 0]);
  });

  it('shows Alderaan through the first station’s overbridge window, on its north wall', () => {
    const [v] = viewsOf(ds1);
    const room = ds1.rooms.get('overbridge');
    expect(v).toMatchObject({ room: 'overbridge', kind: 'alderaan', yaw: 0 });
    expect(v.z).toBeCloseTo(room.box.z0);
    expect(v.y).toBeGreaterThan(room.y);
    expect(v.y).toBeLessThan(room.y + room.h);
  });

  it('shows Endor from the command centre and the battle from the throne room’s round window', () => {
    const views = Object.fromEntries(viewsOf(ds2).map((v) => [v.room, v]));
    expect(views.command.kind).toBe('endor');
    expect(views.throne.kind).toBe('endor-battle');
    const w = ds2.rooms.get('throne').window;
    expect([views.throne.x, views.throne.y, views.throne.z]).toEqual([w.x, w.y, ds2.rooms.get('throne').box.z0]);
  });
});

describe('a blade', () => {
  it('takes its colour from the rules’ name or the cast’s number', () => {
    expect(bladeColour('green')).toBe('green');
    expect(bladeColour(0xff2a1f)).toBe(0xff2a1f);
    expect(bladeColour(null)).toBeNull();
  });

  it('stands up and forward at rest and sweeps across in front through a swing', () => {
    const rest = bladeDir(0, null);
    expect(rest.y).toBeGreaterThan(0.5);
    expect(rest.z).toBeLessThan(0);
    // a swing begins to the right and high, passes through the front, and ends low on the left
    const [a, mid, b] = [0, 0.5, 1].map((k) => bladeDir(0, k));
    expect(a.x).toBeGreaterThan(0.3);
    expect(b.x).toBeLessThan(-0.3);
    expect(mid.z).toBeLessThan(-0.8);
    expect(b.y).toBeLessThan(a.y);
    for (const d of [rest, a, mid, b]) expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1);
  });

  it('turns with whoever holds it', () => {
    const d = bladeDir(Math.PI / 2, 0.5);
    expect(d.x).toBeGreaterThan(0.8);
  });
});

describe('what the game’s events look like', () => {
  it('sparks and scorches where a bolt strikes a wall', () => {
    const fx = effectsOf({ type: 'impact', x: 1, y: 2, z: 3, normal: { x: 0, y: 0, z: 1 } });
    expect(fx.map((f) => f.kind)).toEqual(['spark', 'scorch']);
    expect(fx[1]).toMatchObject({ at: { x: 1, y: 2, z: 3 }, normal: { x: 0, y: 0, z: 1 } });
  });

  it('flashes a muzzle on a shot, throws sparks off a hit and bursts what is blown up', () => {
    expect(effectsOf({ type: 'shot', by: 'you', at: { x: 0, y: 1, z: 0 } })).toEqual([{ kind: 'flare', at: { x: 0, y: 1, z: 0 }, by: 'you' }]);
    expect(effectsOf({ type: 'hit', x: 0, y: 1, z: 0, by: 'blade' }).map((f) => f.kind)).toEqual(['clash']);
    expect(effectsOf({ type: 'hit', x: 0, y: 1, z: 0, by: 'tk-1' }).map((f) => f.kind)).toEqual(['spark']);
    expect(effectsOf({ type: 'deflect', x: 0, y: 1, z: 0 })).toEqual([{ kind: 'clash', at: { x: 0, y: 1, z: 0 }, how: 'deflect' }]);
    expect(effectsOf({ type: 'broke', x: 0, y: 2, z: 0 }).map((f) => f.kind)).toEqual(['explode', 'smoke']);
    // (the station coming apart: a panel bursting where it says, and nothing where it doesn't)
    expect(effectsOf({ type: 'quake', size: 1, at: { x: 0, y: 2, z: 0 } }).map((f) => f.kind)).toEqual(['explode', 'spark', 'smoke']);
    expect(effectsOf({ type: 'quake', size: 0.5, at: null })).toEqual([]);
    expect(effectsOf({ type: 'say', text: 'hello' })).toEqual([]);
  });
});
