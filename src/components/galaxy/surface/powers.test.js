import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ABILITIES, CHOKE, LIGHTNING, RUSH, newJet } from './abilityRules';
import { createPowers } from './powers';

// a world of one hero and a few bodies, the systems that own them recorded
function world(bodies) {
  const scene = new THREE.Scene();
  const state = { t: 0, shake: 0, hitstop: 0, aim: 0, saberAt: 0, jet: newJet(), rage: null };
  const hero = { st: { x: 0, y: 0, z: 0, yaw: 0, vy: 0 }, spec: { bolt: '#fff' }, fig: null };
  const log = [];
  const targets = bodies.map(([x, z, extra = {}]) => ({ holder: new THREE.Object3D(), hp: 10, down: false, spec: {}, ...extra, at: [x, z] }));
  for (const t of targets) t.holder.position.set(t.at[0], 0, t.at[1]);
  const sys = {
    hit: (t, n) => (log.push(['hit', t, n]), (t.hp -= n)),
    knock: (t, v) => (log.push(['knock', t, v]), (t.knock = { vx: v.vx, vz: v.vz, vy: v.vy ?? 0, y: 0 })),
    stagger: (t, s) => log.push(['stagger', t, s]),
  };
  const fx = { sparks() {}, flash() {} };
  const powers = createPowers({ scene, fx, sounds: {}, state, me: () => hero, targets: () => targets, on: () => sys, isHero: (t) => Boolean(t.hero), dealt: (n) => n, emit() {}, ground: () => 0, reach: 500 });
  return { scene, state, hero, targets, log, powers };
}
const ahead = new THREE.Vector3(0, 0, 1);
const hits = (log, t) => log.filter(([k, x]) => k === 'hit' && x === t).reduce((s, [, , n]) => s + n, 0);

describe('the Force powers, played', () => {
  it('a repulse throws everyone in its range back, all round, and hurts them by who they are', () => {
    const { targets, log, powers } = world([[0, 5], [0, -5, { hero: true }], [0, 30]]);
    expect(powers.cast('lukeRepulse', ABILITIES.lukeRepulse, ahead)).toBe(true);
    expect(hits(log, targets[0])).toBe(ABILITIES.lukeRepulse.hit.trooper);
    expect(hits(log, targets[1])).toBe(ABILITIES.lukeRepulse.hit.hero);
    expect(hits(log, targets[2])).toBe(0);
    const back = log.find(([k, t]) => k === 'knock' && t === targets[1])[2];
    expect(back.vz).toBeLessThan(0);
  });

  it('a choke lifts the nearest in front and hurts it by the second until the grip’s time is out', () => {
    const { state, targets, log, powers } = world([[0, 6], [0, -3]]);
    const card = ABILITIES.vaderChoke;
    expect(powers.cast('vaderChoke', card, ahead)).toBe(true);
    expect(powers.busy()).toBe(true);
    const frames = Math.floor((card.grip - 0.05) * 60);
    for (let i = 0; i < frames; i++) {
      state.t += 1 / 60;
      powers.step(1 / 60);
      // (activity.js's knock step)
      const k = targets[0].knock;
      if (k) {
        k.vy -= 14 / 60;
        k.y = Math.max(0, k.y + k.vy / 60);
      }
    }
    expect(targets[0].knock.y).toBeGreaterThan(CHOKE.lift * 0.9);
    expect(hits(log, targets[0])).toBe(Math.floor(card.perSecond * (frames / 60) + 1e-9));
    expect(hits(log, targets[1])).toBe(0);
    state.t += card.grip;
    powers.step(1 / 60);
    expect(powers.busy()).toBe(false);
  });

  it('chain lightning leaps from the first in front to the next', () => {
    const { targets, log, powers } = world([[0, 6], [3, 10], [0, -8]]);
    powers.cast('palpatineChain', ABILITIES.palpatineChain, ahead);
    expect(hits(log, targets[0])).toBe(ABILITIES.palpatineChain.hit.trooper);
    expect(hits(log, targets[1])).toBe(ABILITIES.palpatineChain.hit.trooper);
    expect(hits(log, targets[2])).toBe(0);
  });

  it('the held lightning drains its tank, lands its small hits whole, and stops when let go', () => {
    const { state, targets, log, powers } = world([[0, 5]]);
    const card = ABILITIES.palpatineLightning;
    state.jet.fuel = LIGHTNING.tank; // (a full tank)
    let streamed = 0;
    for (let i = 0; i < 120; i++) {
      state.t += 1 / 60;
      if (powers.held(card, true, 1 / 60, ahead)) streamed++;
    }
    // (two seconds of a 2.5 s tank: it streamed all the way)
    expect(streamed).toBe(120);
    expect(state.jet.fuel).toBeCloseTo(LIGHTNING.tank - 2, 1);
    const ticks = Math.floor(2 / LIGHTNING.every);
    expect(hits(log, targets[0])).toBe(Math.floor(ticks * card.tick + 1e-9));
    expect(powers.held(card, false, 1 / 60, ahead)).toBe(false);
  });

  it('a rush runs the hero forward and cuts through who’s on the line', () => {
    const { state, hero, targets, log, powers } = world([[0.4, 3], [4, 3]]);
    powers.cast('obiwanRush', ABILITIES.obiwanRush, ahead);
    for (let i = 0; i < 60; i++) {
      state.t += 1 / 60;
      powers.step(1 / 60);
    }
    expect(hero.st.z).toBeCloseTo(RUSH.dist);
    expect(hits(log, targets[0])).toBe(ABILITIES.obiwanRush.hit.trooper);
    expect(hits(log, targets[1])).toBe(0);
  });

  it('a rage soaks your hits in its shield, then cuts them, till it’s over', () => {
    const { state, powers } = world([]);
    powers.cast('vaderRage', ABILITIES.vaderRage, ahead);
    expect(state.rage).toMatchObject({ taken: 0.92, shield: 25 });
    expect(powers.soaked(20)).toBe(0);
    expect(powers.soaked(20)).toBeCloseTo(20 * 0.92 - (25 - 20 * 0.92));
    state.t += 11;
    powers.step(1 / 60);
    expect(state.rage).toBeNull();
  });

  it('exposes a weakness on those in front, and plays nothing it isn’t', () => {
    const { state, targets, powers } = world([[0, 5], [0, -5]]);
    powers.cast('dookuWeaken', ABILITIES.dookuWeaken, ahead);
    expect(targets[0].weak).toBe(1.2);
    expect(targets[0].weakUntil).toBe(state.t + ABILITIES.dookuWeaken.dur);
    expect(targets[1].weak).toBeUndefined();
    expect(powers.cast('detonator', ABILITIES.detonator, ahead)).toBe(false);
  });

  it('cleans up after itself', () => {
    const { scene, powers } = world([]);
    const before = scene.children.length;
    expect(before).toBeGreaterThan(0);
    powers.dispose();
    expect(scene.children.length).toBe(0);
  });
});
