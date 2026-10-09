import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STAR_DESTROYER, createSetPieces, destroyerSpot } from './setpieces';
import { CAPITAL, JUMP } from './capitalRules';
import { GOALS, SOLIDS, parkAt } from './ship';
import { ORDER } from './layout';

const clear = (spot) => SOLIDS.every((o) => Math.hypot(spot[0] - o.at[0], spot[1] - o.at[1], spot[2] - o.at[2]) > o.r + STAR_DESTROYER * 0.6);

describe('where the Star Destroyer drops in', () => {
  it('ahead of the ship and off to the side asked, in open space', () => {
    const ship = { x: 0, y: 0, z: 1000, heading: 0 }; // facing −z, nothing near
    const [x, , z] = destroyerSpot(ship, 1, []);
    expect(z).toBeCloseTo(1000 - 28, 6);
    expect(x).toBeCloseTo(10, 6);
  });

  it('never inside a station, planet or the sun, parked at any of them, either side', () => {
    for (const id of ORDER) {
      if (!GOALS[id]) continue;
      const p = parkAt(id);
      for (const side of [-1, 1]) expect(clear(destroyerSpot({ ...p, y: p.y }, side)), `${id} ${side}`).toBe(true);
    }
  });

  it('keeps clear of whatever solids it is given, not the universe map\'s', () => {
    // a galaxy system: its planet at the middle, the ship just off it
    const planet = { id: 'planet', at: [0, 0, 0], r: 40 };
    const ship = { x: 0, y: 14, z: 90, heading: 0 }; // facing −z: 28 ahead is 62 out, inside the planet's half-length margin
    for (const side of [-1, 1]) {
      const p = destroyerSpot(ship, side, [planet]);
      expect(Math.hypot(p[0], p[1], p[2])).toBeGreaterThan(planet.r + STAR_DESTROYER * 0.6);
    }
  });
});

describe('the capital ship, drawn', () => {
  afterEach(() => vi.unstubAllGlobals());
  // (the glow is painted on a canvas: one that takes every call and draws nothing;
  // and a fleet that hands out an empty group for the ship)
  const make = () => {
    const gradient = { addColorStop() {} };
    const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
    vi.stubGlobal('document', { createElement: () => canvas });
    const ships = [];
    const fleet = { want() {}, loaded: () => false, make: () => (ships.push({ group: new THREE.Group(), model: null, update() {}, dispose() {} }), ships.at(-1)) };
    const parent = new THREE.Group();
    const pieces = createSetPieces(parent, { small: true, fleet, solids: () => [] });
    const camera = new THREE.PerspectiveCamera();
    let t = 0;
    const run = (seconds) => {
      const got = [];
      for (let s = 0; s < seconds; s += 1 / 60) {
        t += 1 / 60;
        pieces.update(1 / 60, t, camera, null);
        got.push(...pieces.drain());
      }
      return got;
    };
    return { pieces, parent, ships, run };
  };
  const shoot = (pieces, at, punch) => pieces.hit(new THREE.Vector3(at[0], at[1] + 30, at[2]), new THREE.Vector3(at[0], at[1] - 30, at[2]), punch);
  const drawn = (parent) => parent.children.filter((o) => o.visible);

  it('going up when you jump from it, is gone at once: nothing more of it drawn, no blasts and no dead', () => {
    const { pieces, parent, ships, run } = make();
    expect(pieces.destroyer({ x: 0, y: 0, z: 0, heading: 0 })).toBeTruthy();
    run(JUMP + 0.1);
    for (const id of ['dome0', 'dome1', 'bridge']) shoot(pieces, pieces.capital.parts.find((p) => p.id === id).at, CAPITAL.bridgeHp);
    expect(pieces.capital.state).toBe('dying');
    const going = run(1);
    expect(going.map((e) => e.type)).toContain('blast');
    expect(drawn(parent).length).toBeGreaterThan(1); // (the ship, and its blasts)
    pieces.leave();
    expect(pieces.destroyerHere).toBe(false);
    expect(ships[0].group.visible).toBe(false);
    expect(drawn(parent)).toEqual([]);
    const after = run(CAPITAL.die + 3);
    expect(after.map((e) => e.type)).toEqual(['gone']);
    expect(drawn(parent)).toEqual([]);
  });

  it('here when you jump from it, streaks away as ever', () => {
    const { pieces, parent, ships, run } = make();
    pieces.destroyer({ x: 0, y: 0, z: 0, heading: 0 });
    run(JUMP + 0.1);
    pieces.leave();
    expect(pieces.capital.state).toBe('out');
    expect(ships[0].group.visible).toBe(true);
    const after = run(JUMP + 1.5);
    expect(after.map((e) => e.type)).toEqual(['leaving', 'gone']);
    expect(drawn(parent)).toEqual([]);
  });
});
