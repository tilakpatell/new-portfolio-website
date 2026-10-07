import { describe, expect, it } from 'vitest';
import { CHARGE, CREW_POWERS, KEPT_KEY, POWERS, POWER_KEYS, beamOf, blastPunch, cancel, createPowers, crossesShell, finish, firstAlong, gain, isObjective, jinkStep, mods, pickTargets, portalExit, powersOf, press, pullStep, readKept, step, turretPick, view, writeKept } from './shipPowers';
import { CREWS } from './crews';

// the state a few seconds on, a tenth of a second at a time; the events it said
const run = (st, seconds, opts) => {
  const out = [];
  for (let t = 0; t < seconds - 1e-9; t += 0.1) out.push(...step(st, 0.1, opts));
  return out;
};
const ship = { x: 0, y: 0, z: 0, heading: 0, pitch: 0 }; // (the nose along −z)
const T = (id, x, z, threat = 0, more = {}) => ({ id, at: { x, y: 0, z }, vel: { x: 0, y: 0, z: 0 }, size: 0.5, threat, ...more });

describe('the crews’ ship powers', () => {
  it('gives every crew a power on G with a cooldown and a big one on X, and nobody else anything', () => {
    expect(POWER_KEYS).toEqual({ primary: 'g', ultimate: 'x' });
    for (const c of CREWS) {
      const own = powersOf(c.id);
      expect(own, c.id).toBeTruthy();
      expect(POWERS[own.primary].slot, c.id).toBe('primary');
      expect(POWERS[own.primary].crew, c.id).toBe(c.id);
      expect(POWERS[own.primary].cool, c.id).toBeGreaterThan(0);
      expect(POWERS[own.ultimate].slot, c.id).toBe('ultimate');
      expect(POWERS[own.ultimate].crew, c.id).toBe(c.id);
      for (const id of [own.primary, own.ultimate]) {
        expect(POWERS[id].name.length, id).toBeGreaterThan(3);
        expect(POWERS[id].about.length, id).toBeGreaterThan(10);
        expect(POWERS[id].dur, id).toBeGreaterThan(0);
      }
    }
    expect(Object.keys(CREW_POWERS)).toEqual(['xwing', 'falcon', 'cruiser', 'rv']);
    expect(powersOf('nope')).toBeNull();
    expect(createPowers('nope')).toBeNull();
    expect(createPowers(null)).toBeNull();
  });

  it('names the big ones apart from the universe map’s heavy rounds', () => {
    expect(POWERS.salvo.name).toBe('Torpedo salvo');
    expect(POWERS.heisenberg.name).toBe('Say my name');
    expect(POWERS.quad.name).toBe('Chewie on the quad guns');
    expect(POWERS.wubba.name).toBe('Wubba lubba dub dub');
  });

  it('refuses a press while it charges, while it is on and while it cools, and says why', () => {
    const st = createPowers('xwing');
    expect(press(st, 'ultimate')).toEqual({ ok: false, why: 'charging' });
    expect(press(st, 'primary')).toEqual({ ok: true, id: 'focus' });
    expect(press(st, 'primary')).toEqual({ ok: false, why: 'active' });
    run(st, 5.05);
    expect(press(st, 'primary')).toEqual({ ok: false, why: 'cooling' });
    expect(press(null, 'primary')).toEqual({ ok: false, why: 'none' });
    expect(press(st, 'third')).toEqual({ ok: false, why: 'none' });
  });

  it('has Force Focus on for 5 s, then cooling 22 s, then ready, saying so as it goes', () => {
    const st = createPowers('xwing');
    press(st, 'primary');
    const on = run(st, 4.9, { flying: false });
    expect(st.primary.phase).toBe('active');
    expect(on).toEqual([]);
    const ended = run(st, 0.2, { flying: false });
    expect(st.primary.phase).toBe('cooling');
    expect(ended).toContainEqual({ type: 'end', slot: 'primary', id: 'focus' });
    run(st, 21.7, { flying: false });
    expect(st.primary.phase).toBe('cooling');
    const back = run(st, 0.4, { flying: false });
    expect(st.primary.phase).toBe('ready');
    expect(back).toContainEqual({ type: 'ready', slot: 'primary', id: 'focus' });
  });

  it('fills the big one with five kills: four don’t, the fifth does', () => {
    const st = createPowers('falcon');
    for (let i = 0; i < 4; i++) expect(gain(st, 'kill')).toBe(false);
    expect(st.ultimate.phase).toBe('charging');
    expect(gain(st, 'kill')).toBe(true);
    expect(st.ultimate.phase).toBe('ready');
    expect(st.ultimate.charge).toBe(1);
    // (an ace is worth more, and a hit a little)
    expect(CHARGE.ace).toBeGreaterThan(CHARGE.kill);
    expect(CHARGE.hit).toBeGreaterThan(0);
    expect(CHARGE.hit).toBeLessThan(CHARGE.kill);
  });

  it('never charges the big one from its own kills, and a cancel ends it into charging again', () => {
    const st = createPowers('cruiser', { charge: 1 });
    expect(st.ultimate.phase).toBe('ready');
    expect(press(st, 'ultimate')).toEqual({ ok: true, id: 'wubba' });
    expect(st.ultimate.charge).toBe(0);
    expect(gain(st, 'kill', 3)).toBe(false);
    expect(st.ultimate.charge).toBe(0);
    expect(cancel(st)).toContainEqual({ type: 'end', slot: 'ultimate', id: 'wubba' });
    expect(st.ultimate.phase).toBe('charging');
    expect(cancel(st)).toEqual([]);
  });

  it('ends one power early when its work is done (the last torpedo home), and only that one', () => {
    const st = createPowers('xwing', { charge: 1 });
    press(st, 'primary');
    press(st, 'ultimate');
    expect(finish(st, 'ultimate')).toEqual([{ type: 'end', slot: 'ultimate', id: 'salvo' }]);
    expect(st.ultimate.phase).toBe('charging');
    expect(st.primary.phase).toBe('active');
    expect(finish(st, 'ultimate')).toEqual([]);
  });

  it('fills the big one by flying 150 s, but not standing still', () => {
    const idle = createPowers('rv');
    run(idle, 150, { flying: false });
    expect(idle.ultimate.charge).toBe(0);
    const flown = createPowers('rv');
    const said = run(flown, 151, { flying: true });
    expect(flown.ultimate.phase).toBe('ready');
    expect(said.filter((e) => e.slot === 'ultimate' && e.type === 'ready')).toHaveLength(1);
  });

  it('tells the scene what to change: time slowed and the guns helped only while Focus is on, a ghost while Han jinks or Rick portals, a heavy hand on the death ray', () => {
    const none = { slow: 1, assist: 0, track: 0, cadence: 1, ghost: false, turn: 1, agility: 1 };
    expect(mods(null)).toEqual(none);
    const x = createPowers('xwing');
    expect(mods(x)).toEqual(none);
    press(x, 'primary');
    expect(mods(x)).toMatchObject({ slow: 0.35, assist: 2.5, track: 2, cadence: 0.7, ghost: false });
    run(x, 5.1);
    expect(mods(x).slow).toBe(1);
    const f = createPowers('falcon');
    press(f, 'primary');
    expect(mods(f)).toMatchObject({ ghost: true, agility: 1.3, slow: 1 });
    const c = createPowers('cruiser', { charge: 1 });
    press(c, 'primary');
    expect(mods(c).ghost).toBe(true);
    run(c, 0.4);
    expect(mods(c).ghost).toBe(false);
    press(c, 'ultimate');
    expect(mods(c).turn).toBe(0.6);
  });

  it('gives the HUD its keys, names and how far round each ring is', () => {
    const st = createPowers('xwing');
    const v = view(st);
    expect(v.primary).toMatchObject({ id: 'focus', name: 'Force Focus', key: 'G', phase: 'ready', k: 0 });
    expect(v.ultimate).toMatchObject({ id: 'salvo', key: 'X', phase: 'charging', k: 1, charge: 0 });
    press(st, 'primary');
    expect(view(st).primary.k).toBe(0);
    run(st, 2.5, { flying: false });
    expect(view(st).primary.k).toBeCloseTo(0.5, 2); // (on: the ring runs down with the time left)
    expect(view(st).primary.left).toBe(3);
    run(st, 2.6, { flying: false });
    const ks = [];
    for (let i = 0; i < 22; i++) {
      ks.push(view(st).primary.k);
      run(st, 1, { flying: false });
    }
    expect(ks[0]).toBeGreaterThan(0.95);
    for (let i = 1; i < ks.length; i++) expect(ks[i]).toBeLessThan(ks[i - 1]);
    expect(view(st).primary.k).toBe(0);
    gain(st, 'kill', 2);
    expect(view(st).ultimate.k).toBeCloseTo(0.6, 5);
    expect(view(null)).toBeNull();
  });

  it('picks the torpedoes’ targets: the ones coming at you in the cone first, then nearest the nose, never one behind; none ahead, the nearest', () => {
    const picked = pickTargets(ship, [T(1, 0, -20), T(2, 3, -30, 1), T(3, 0, 20), T(4, 1, -50), T(5, 0, -70)], { count: 4 });
    expect(picked.map((t) => t.id)).toEqual([2, 1, 4]);
    expect(pickTargets(ship, [T(3, 0, 20), T(6, 0, 10)]).map((t) => t.id)).toEqual([6, 3]);
    expect(pickTargets(ship, [T(1, 0, -20), T(4, 1, -50)], { count: 1 }).map((t) => t.id)).toEqual([1]);
    expect(pickTargets(ship, [])).toEqual([]);
  });

  it('lets the portal out behind a moving target, facing the way it goes; past a still one, away from you', () => {
    const fleeing = { id: 9, at: { x: 0, y: 0, z: -30 }, vel: { x: 10, y: 0, z: 0 } };
    const out = portalExit(ship, fleeing, POWERS.portal);
    expect(out.x).toBeCloseTo(-5, 6);
    expect(out.z).toBeCloseTo(-30, 6);
    expect(out.heading).toBeCloseTo(-Math.PI / 2, 6); // (facing +x)
    const still = portalExit(ship, { id: 1, at: { x: 0, y: 0, z: -30 }, vel: { x: 0, y: 0, z: 0 } }, POWERS.portal);
    expect(still.z).toBeCloseTo(-25, 6);
    expect(still.heading).toBeCloseTo(0, 6);
  });

  it('hops 40 along the nose with no target, never into a planet, never past the edge', () => {
    const hop = portalExit(ship, null, POWERS.portal);
    expect(hop.z).toBeCloseTo(-40, 6);
    const planet = [{ at: [0, 0, -40], r: 15 }];
    const clear = portalExit(ship, null, POWERS.portal, planet);
    expect(Math.hypot(clear.x, clear.y, clear.z + 40)).toBeGreaterThanOrEqual(16 - 1e-6);
    const edged = portalExit(ship, null, POWERS.portal, [], { edge: 30 });
    expect(Math.hypot(edged.x, edged.z)).toBeLessThanOrEqual(25 + 1e-6);
  });

  it('knows when a hop crosses a shield round the middle (Scarif’s)', () => {
    expect(crossesShell({ x: 0, y: 0, z: 50 }, { x: 0, y: 0, z: 10 }, 30)).toBe(true);
    expect(crossesShell({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: 50 }, 30)).toBe(true);
    expect(crossesShell({ x: 0, y: 0, z: 50 }, { x: 0, y: 0, z: 40 }, 30)).toBe(false);
  });

  it('runs the death ray from the nose, its length on', () => {
    const b = beamOf({ ...ship, heading: Math.PI / 2 }, 45); // (the nose along −x)
    expect(b.from.x).toBeCloseTo(-0.2, 6);
    expect(b.to.x).toBeCloseTo(-45, 6);
    expect(b.to.z).toBeCloseTo(0, 6);
  });

  it('hits hardest in a blast’s middle, less at its rim, nothing past it', () => {
    expect(blastPunch(0)).toBe(10);
    expect(blastPunch(5)).toBeCloseTo(6.5, 6);
    expect(blastPunch(10)).toBe(3);
    expect(blastPunch(10.1)).toBe(0);
  });

  it('pulls one toward the magnet no faster than it may, and never past it', () => {
    expect(pullStep({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 16, 1)).toEqual({ x: 0, y: 0, z: 0 });
    const p = pullStep({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 4, 1);
    expect(p.x).toBeCloseTo(6, 6);
    expect(pullStep({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 4, 1)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('corkscrews 3 units sideways and twice round over the whole of it, either way', () => {
    for (const side of [1, -1]) {
      let moved = 0;
      let roll = 0;
      for (let t = 0; t < POWERS.odds.dur - 1e-9; t += 0.01) {
        const j = jinkStep(t, 0.01, POWERS.odds, side);
        moved += j.step;
        roll = j.roll;
      }
      expect(moved).toBeCloseTo(3 * side, 6);
      expect(roll).toBeCloseTo(4 * Math.PI * side, 6);
    }
    // (quickest in the middle)
    expect(Math.abs(jinkStep(1.1, 0.01).step)).toBeGreaterThan(Math.abs(jinkStep(0.05, 0.01).step));
  });

  it('has Chewie shoot at the nearest coming at you, and stay on the one he’s on while it’s in range', () => {
    expect(turretPick(ship, [T(1, 0, -10), T(2, 0, -20, 1)]).id).toBe(2);
    expect(turretPick(ship, [T(1, 0, -10), T(2, 0, -20, 1)], 35, 1).id).toBe(1);
    expect(turretPick(ship, [T(1, 0, 40)], 35)).toBeNull();
    expect(turretPick(ship, [T(1, 0, 30)], 35).id).toBe(1); // (all the way round: behind too)
  });

  it('tells a battle’s objectives from its fighters, and what a shot meets first along its way', () => {
    expect(isObjective({ kind: 'turret' })).toBe(true);
    expect(isObjective({ kind: 'subsystem', sub: 'shield' })).toBe(true);
    expect(isObjective({ kind: 'tie' })).toBe(false);
    const near = T(1, 0, -10);
    const far = T(2, 0, -20, 0, { kind: 'subsystem' });
    expect(firstAlong({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -30 }, [far, near], 1 / 60)).toBe(near);
    expect(firstAlong({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -30 }, [T(3, 5, -10)], 1 / 60)).toBeNull();
    // (one crossing the way in the frame is met where it was on the way: still, where it is now, it would be missed)
    const crossing = T(4, 1.5, -10, 0, { vel: { x: 120, y: 0, z: 0 } });
    expect(firstAlong({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -30 }, [crossing], 1 / 60)).toBe(crossing);
    expect(firstAlong({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -30 }, [{ ...crossing, vel: { x: 0, y: 0, z: 0 } }], 1 / 60)).toBeNull();
  });

  it('keeps the big one’s charge across a landing for the same crew, and starts again for another', () => {
    expect(KEPT_KEY).toBe('tp:ship-powers');
    const st = createPowers('xwing');
    gain(st, 'kill', 3);
    const raw = writeKept(st);
    expect(readKept(raw, 'xwing')).toBeCloseTo(0.6, 6);
    expect(readKept(raw, 'falcon')).toBe(0);
    expect(createPowers('xwing', { charge: readKept(raw, 'xwing') }).ultimate.charge).toBeCloseTo(0.6, 6);
    for (const bad of [null, '', '{bad', '[]', '3', JSON.stringify({ crew: 'xwing', charge: 'lots' }), JSON.stringify({ crew: 'nope', charge: 1 })]) expect(readKept(bad, bad?.includes('nope') ? 'nope' : 'xwing'), String(bad)).toBe(0);
    expect(readKept(JSON.stringify({ crew: 'rv', charge: 7 }), 'rv')).toBe(1);
    expect(writeKept(null)).toBeNull();
  });
});
