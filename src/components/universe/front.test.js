import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ZONE, createFront, zoneOf } from './front';
import { SIDES } from './sides';
import { WARS } from './wars';
import { contested } from './war';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

describe('zoneOf', () => {
  it('is in the fight close up, near within sight of it, out beyond', () => {
    expect(zoneOf(100, 'out')).toBe('in');
    expect(zoneOf(ZONE.in + 1, 'out')).toBe('near');
    expect(zoneOf(ZONE.near + 1, 'out')).toBe('out');
  });
  it('lets go of the fight only well out of it', () => {
    expect(zoneOf(ZONE.in + 50, 'in')).toBe('in');
    expect(zoneOf(ZONE.out + 1, 'in')).toBe('near');
  });
});

// a front with stand-ins for the battle and its drawing
const stubbed = () => {
  const made = [];
  const emitted = [];
  const makeBattle = (opts) => {
    const b = { opts, over: null, you: null, setYou: (t) => (b.you = t), update: () => [], hit: () => null, targets: [], info: {}, end: (w) => (b.over = { winner: w, why: 'forced' }) };
    made.push(b);
    return b;
  };
  const draws = [];
  const makeScene = () => {
    const d = { shown: 0, hidden: 0, show: () => (d.shown += 1), hide: () => (d.hidden += 1), update: () => true, dispose() {} };
    draws.push(d);
    return d;
  };
  // (the Star Wars war, as a war here: it's fought in the galaxy, so it isn't one ready on the map)
  const front = createFront(new THREE.Group(), { side: SIDES.starwars, war: { ...WARS.starwars, ready: true }, models: { want() {} }, storage: memory(), emit: (e) => emitted.push(e), makeBattle, makeScene, tier: 'low' });
  return { front, made, draws, emitted };
};
const at = (front, d) => {
  const [x, y, z] = front.where().at;
  return { x: x + d, y, z };
};

describe('createFront', () => {
  it('only fights a war that’s ready (the Star Wars crews’ is in the galaxy)', () => {
    for (const side of [SIDES.rickmorty, SIDES.breakingbad]) {
      const f = createFront(new THREE.Group(), { side, models: { want() {} }, storage: memory(), emit() {}, makeScene: () => ({ show() {}, hide() {}, update: () => true, dispose() {} }) });
      expect(f, side.id).not.toBeNull();
      f.dispose();
    }
    expect(createFront(new THREE.Group(), { side: SIDES.starwars, models: {}, storage: memory(), emit() {} })).toBeNull();
    expect(createFront(new THREE.Group(), { side: null, models: {}, storage: memory(), emit() {} })).toBeNull();
  });

  it('is at the war’s contested sector, and puts you in on your crew’s side as you arrive (no side to pick)', () => {
    const { front, made, emitted } = stubbed();
    const war = WARS.starwars;
    expect(front.where().at).toEqual(war.sectors[contested({ front: 3, attacker: 0 })].at);
    front.update(0.1, 0, null, new THREE.Vector3(), at(front, 50));
    expect(made).toHaveLength(1);
    expect(emitted.some((e) => e.type === 'battle' && e.what === 'ask')).toBe(false);
    expect(emitted.some((e) => e.type === 'event' && e.id === 'battle' && e.sub === 'front')).toBe(true);
    expect(front.inZone).toBe(true);
    expect(made[0].you).toBe(0);
    expect(front.joined).toBe(0);
  });

  it('leaving pauses and coming back resumes the same battle', () => {
    const { front, made, draws } = stubbed();
    front.update(0.1, 0, null, new THREE.Vector3(), at(front, 50));
    front.update(0.1, 0, null, new THREE.Vector3(), at(front, ZONE.near + 400));
    expect(front.inZone).toBe(false);
    expect(draws[0].hidden).toBeGreaterThan(0);
    front.update(0.1, 0, null, new THREE.Vector3(), at(front, 50));
    expect(made).toHaveLength(1);
    expect(draws[0].shown).toBe(2);
  });

  it('moves the front when a battle’s won, and saves it', () => {
    const { front, made, emitted } = stubbed();
    front.update(0.1, 0, null, new THREE.Vector3(), at(front, 50));
    front.join(0);
    made[0].update = () => [{ type: 'over', winner: 0, why: 'flagship' }];
    made[0].over = { winner: 0, why: 'flagship' };
    front.update(0.1, 0, null, new THREE.Vector3(), at(front, 50));
    expect(front.info.state.front).toBe(4);
    const card = emitted.find((e) => e.type === 'battle' && e.what === 'over');
    expect(card.over.winner).toBe(0);
    expect(card.over.sectors).toHaveLength(7);
    expect(emitted.some((e) => e.type === 'event' && e.sub === 'won')).toBe(true);
  });
});
