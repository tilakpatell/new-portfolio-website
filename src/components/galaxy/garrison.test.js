import { describe, expect, it, vi } from 'vitest';
import { seeded } from '../../lib/seeded';
import { TURBO } from './battles';
import { createGarrisonDefence, safeNow } from './garrison';
import { postOf } from './garrisonRules';

const DT = 1 / 30;
const SYS = { id: 'mustafar' };
const TAG = 'garrison:mustafar';
// one Star Destroyer of the Empire's, held, parked at the origin
const P = postOf({ id: 'fleet-0-destroyer-0', kind: 'destroyer', side: 'empire', size: 30, at: { x: 0, y: 0, z: 0 }, yaw: 0 });
const WORLD = { posts: () => [P] };
const EFFECTS = { owner: 'empire', fleet: 'empire', garrison: 'empire', stance: 'enemy', tier: 'held' };
// the planet, well off to one side
const SOLIDS = [{ id: 'planet', at: [0, 0, -600], r: 120, planet: true }];
// your ship, as the scene hands it over
const ship = (x, y = 0, z = 0) => ({ x, y, z, heading: 0, pitch: 0, speed: 0 });

function rig({ targets = [], damage = null, escort = ['tie'] } = {}) {
  const hunters = { pack: vi.fn(() => []), leave: vi.fn(), damage: vi.fn(damage ?? (() => null)), targets };
  const wingmen = { join: vi.fn() };
  const bolts = { fire: vi.fn(() => true) };
  const emit = vi.fn();
  const hurt = vi.fn();
  const pop = vi.fn();
  const shake = vi.fn();
  const g = createGarrisonDefence({ hunters, wingmen, bolts, emit, hurt, pop, shake, escort: () => escort, rand: seeded(1) });
  g.enter(SYS);
  return { g, hunters, wingmen, bolts, emit, hurt, pop, shake };
}
// `seconds` of frames, with you where `at` says (a ship, or a function of the time)
function fly(g, seconds, at, over = {}) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) g.update(DT, typeof at === 'function' ? at(i * DT) : at, { world: WORLD, effects: EFFECTS, sys: SYS, battle: false, safe: false, solids: SOLIDS, ...over });
}
const said = (emit) => emit.mock.calls.map(([e]) => e).filter((e) => e.type === 'event' && e.id === 'garrison');

describe('the garrison in the scene', () => {
  it('an enemy flying in is scrambled at and fired on', () => {
    const r = rig();
    const you = ship(30);
    fly(r.g, 30, you);
    expect(r.hunters.pack).toHaveBeenCalled();
    const [faction, sent, opts] = r.hunters.pack.mock.calls[0];
    expect(faction).toBe('navy');
    expect(sent).toBe(you);
    expect(opts).toMatchObject({ tag: TAG, from: { x: P.hangar.x, y: P.hangar.y, z: P.hangar.z }, home: { x: P.hangar.x, y: P.hangar.y, z: P.hangar.z } });
    expect(opts.size).toBeGreaterThan(0);
    // its turbolasers, in the Empire's colour, and the sound of them
    expect(r.bolts.fire).toHaveBeenCalled();
    expect(r.bolts.fire.mock.calls[0][2]).toMatchObject({ color: TURBO.empire, width: 0.12, length: 3.2 });
    expect(r.emit).toHaveBeenCalledWith({ type: 'shot' });
    expect(r.hurt).toHaveBeenCalled();
    expect(r.hurt.mock.calls[0][0]).toBeGreaterThan(0);
    expect(r.shake).toHaveBeenCalled();
    expect(r.g.busy).toBe(true);
  });

  it('the recall goes to the garrison’s pack alone', () => {
    const r = rig();
    fly(r.g, 12, ship(30));
    expect(r.hunters.pack).toHaveBeenCalled();
    expect(r.hunters.leave).not.toHaveBeenCalled();
    // away, far past its leash, and stood down
    fly(r.g, 30, ship(3000));
    expect(r.hunters.leave).toHaveBeenCalledWith('navy', TAG);
    for (const call of r.hunters.leave.mock.calls) expect(call[1]).toBe(TAG);
    expect(r.g.busy).toBe(false);
  });

  it('shooting a garrison fighter or hull provokes it', () => {
    const r = rig();
    fly(r.g, 1, ship(1000));
    expect(r.g.info.alarm).toBe(0);
    // another pack's fighter, or none of theirs, is nothing to it
    r.g.onHit({ tag: null, down: true });
    r.g.onHit({ tag: 'garrison:hoth', down: true });
    expect(r.g.info.alarm).toBe(0);
    r.g.onHit({ tag: TAG, down: true });
    expect(r.g.info.alarm).toBeGreaterThan(0);

    const q = rig();
    fly(q.g, 1, ship(1000));
    const c = P.spheres[0].c;
    // a shot past the hull misses it
    expect(q.g.hull({ x: c.x - 5, y: c.y + 200, z: c.z }, { x: c.x + 5, y: c.y + 200, z: c.z })).toBeNull();
    expect(q.g.info.alarm).toBe(0);
    // one through it lands, where it meets the hull
    const hit = q.g.hull({ x: c.x - 40, y: c.y, z: c.z }, { x: c.x + 40, y: c.y, z: c.z });
    expect(hit).not.toBeNull();
    expect(hit.at.x).toBeCloseTo(c.x - P.spheres[0].r);
    expect(q.g.info.alarm).toBeGreaterThan(0);
  });

  it('nothing under safe', () => {
    const r = rig();
    fly(r.g, 30, ship(30), { safe: true });
    expect(r.hunters.pack).not.toHaveBeenCalled();
    expect(r.bolts.fire).not.toHaveBeenCalled();
    expect(r.hurt).not.toHaveBeenCalled();
    expect(r.emit).not.toHaveBeenCalled();
    // and its grace still to come when it's over: held, not run down
    fly(r.g, 5, ship(30));
    expect(r.hunters.pack).not.toHaveBeenCalled();
    expect(r.bolts.fire).not.toHaveBeenCalled();
    fly(r.g, 15, ship(30));
    expect(r.hunters.pack).toHaveBeenCalled();
    expect(r.bolts.fire).toHaveBeenCalled();
  });

  it('the scene’s safe time holds it, and so do a jump’s tunnel and its way out', () => {
    const flying = { clock: 10, safeUntil: -1e9, flown: true, jump: null };
    expect(safeNow(flying)).toBe(false);
    // back from a crash or out of a jump a moment, or not flown yet
    expect(safeNow({ ...flying, safeUntil: 12 })).toBe(true);
    expect(safeNow({ ...flying, flown: false })).toBe(true);
    // in the tunnel and coming out of it: the next system's, and you not there yet
    expect(safeNow({ ...flying, jump: { phase: 'tunnel' } })).toBe(true);
    expect(safeNow({ ...flying, jump: { phase: 'exit' } })).toBe(true);
    // but turning onto the course and spooling up are still flown in the system you're leaving
    expect(safeNow({ ...flying, jump: { phase: 'align' } })).toBe(false);
    expect(safeNow({ ...flying, jump: { phase: 'spool' } })).toBe(false);
  });

  it('the arrival grace is kept for when you come out of the jump, however long it was', () => {
    // a jump as the scene plays it: the mind reset as the tunnel opens, the
    // system entered 0.12 s in, the tunnel, its way out (1.1 s) and then the
    // scene's safe time (3 s), with you an enemy sitting 80 units off the post
    // the moment you're out; the seconds from the jump's end to the first
    // thing it does (a hail, a wave or a shot)
    const jumpIn = (tunnel) => {
      const r = rig();
      const scene = { clock: 0, safeUntil: -1e9, flown: true, jump: { phase: 'tunnel' } };
      const frame = (live) => {
        scene.clock += DT;
        r.g.update(DT, live, { world: WORLD, effects: EFFECTS, sys: SYS, battle: false, safe: safeNow(scene), solids: SOLIDS });
      };
      r.g.reset('jump');
      for (let t = 0, entered = false; t < tunnel; t += DT) {
        if (!entered && t > 0.12) {
          entered = true;
          r.g.enter(SYS);
        }
        frame(null);
      }
      scene.jump = { phase: 'exit' };
      for (let t = 0; t < 1.1; t += DT) frame(null);
      scene.jump = null;
      scene.safeUntil = scene.clock + 3;
      const out = scene.clock;
      const you = ship(80);
      while (scene.clock - out < 30) {
        frame(you);
        if (said(r.emit).length || r.hunters.pack.mock.calls.length || r.bolts.fire.mock.calls.length) return scene.clock - out;
      }
      return Infinity;
    };
    // the routes' jumps run from a couple of seconds to 12
    for (const tunnel of [2.4, 6.1, 12]) {
      const first = jumpIn(tunnel);
      // the scene's safe time, and the whole 8 s grace on top of it (as after a respawn)
      expect(first).toBeGreaterThanOrEqual(3 + 8 - 2 * DT);
      // and then it does challenge you
      expect(first).toBeLessThan(3 + 8 + 2);
    }
  });

  it('say goes out as a garrison event', () => {
    const r = rig();
    fly(r.g, 10, ship(80));
    const lines = said(r.emit);
    expect(lines.map((e) => e.sub)).toEqual(['challenge', 'scramble']);
    for (const e of lines) expect(e).toMatchObject({ side: 'empire', sys: 'mustafar' });
    // an unsworn pilot is warned, with the seconds they have
    const w = rig();
    fly(w.g, 10, ship(80), { effects: { ...EFFECTS, stance: 'wary' } });
    expect(said(w.emit)[0]).toMatchObject({ sub: 'warn', side: 'empire', sys: 'mustafar', secs: 8 });
  });

  it('the planet hides you from it, and nothing else does', () => {
    const behind = { id: 'planet', at: [0, 0, 90], r: 40, planet: true };
    const r = rig();
    fly(r.g, 20, ship(0, 0, 150), { solids: [behind] });
    expect(said(r.emit)).toEqual([]);
    // a hull there instead hides nothing
    const q = rig();
    fly(q.g, 20, ship(0, 0, 150), { solids: [{ id: 'fleet-x-0', at: [0, 0, 90], r: 40, hull: 'fleet-x' }] });
    expect(said(q.emit).map((e) => e.sub)).toContain('challenge');
  });

  it('a pack of the holder’s beaten near it calls it out', () => {
    const r = rig();
    // an unsworn pilot, warned and still in the countdown
    fly(r.g, 9.5, ship(80), { effects: { ...EFFECTS, stance: 'wary' } });
    expect(r.hunters.pack).not.toHaveBeenCalled();
    // its own wave, or another side's pack, calls nobody
    r.g.onHunters({ type: 'cleared', faction: 'navy', tag: TAG });
    r.g.onHunters({ type: 'escaped', faction: 'rebellion', why: 'broke', tag: null });
    // nor does a pack that only lost you
    r.g.onHunters({ type: 'escaped', faction: 'empire', why: 'lost', tag: null });
    fly(r.g, 0.5, ship(80), { effects: { ...EFFECTS, stance: 'wary' } });
    expect(said(r.emit).map((e) => e.sub)).toEqual(['warn']);
    // the director's Imperial pack cut down: out they come
    r.g.onHunters({ type: 'cleared', faction: 'empire', tag: null });
    fly(r.g, 0.5, ship(80), { effects: { ...EFFECTS, stance: 'wary' } });
    expect(said(r.emit).map((e) => e.sub)).toEqual(['warn', 'reinforce']);
    expect(r.hunters.pack).toHaveBeenCalled();
  });

  it('a pack of its side goes home to the nearest hangar of theirs', () => {
    const r = rig();
    fly(r.g, 0.1, ship(1000));
    expect(r.g.homeFor('navy')).toEqual({ x: P.hangar.x, y: P.hangar.y, z: P.hangar.z });
    // the director's hunters for the side that holds it
    expect(r.g.homeFor('empire')).toEqual({ x: P.hangar.x, y: P.hangar.y, z: P.hangar.z });
    expect(r.g.homeFor('rebellion')).toBeNull();
    expect(r.g.homeFor('weequay')).toBeNull();
  });

  it('your own side’s fleet shoots what chases you, and sends a flight to meet you', () => {
    const at = { x: 30, y: 0, z: 0 };
    const chasers = [
      { id: 7, at, vel: { x: 0, y: 0, z: 0 }, size: 0.3, tag: null, prey: false },
      { id: 8, at: { x: 32, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, size: 0.3, tag: null, prey: false },
    ];
    const r = rig({ targets: chasers, damage: (id) => ({ id, down: true, at, size: 0.3 }) });
    const you = ship(36);
    fly(r.g, 20, you, { effects: { ...EFFECTS, stance: 'friend' } });
    expect(r.hunters.damage).toHaveBeenCalled();
    expect(r.hunters.damage.mock.calls[0][1]).toBe(2);
    expect(r.pop).toHaveBeenCalled();
    expect(r.wingmen.join).toHaveBeenCalledWith('tie', you, 2);
    // its guns aren't fired at you: nothing heard, nothing hurt
    expect(r.emit).not.toHaveBeenCalledWith({ type: 'shot' });
    expect(r.hurt).not.toHaveBeenCalled();
    expect(said(r.emit).map((e) => e.sub)).toEqual(expect.arrayContaining(['cover', 'escort']));
  });
});
