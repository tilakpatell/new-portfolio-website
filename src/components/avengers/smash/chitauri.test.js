import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildHumanoid } from '../hq/kit/humanoid';
import { RANGE, createChitauri, flail } from './chitauri';

const mats = { armour: new THREE.MeshBasicMaterial(), skin: new THREE.MeshBasicMaterial(), glow: new THREE.MeshBasicMaterial() };
const soldier = () => buildHumanoid({ style: 'chitauri', materials: mats });
const WALK = 2.2;

describe('the Chitauri on foot', () => {
  it('step by the ground they cover, the same at any frame rate', () => {
    const legAfter = (fps) => {
      const ch = createChitauri();
      const h = soldier();
      const o = { id: 7, passed: false };
      for (let i = 0; i < fps; i++) ch.pose(h, o, { dt: 1 / fps, ahead: 60, firing: false, walk: WALK });
      return h.bones.thighL.rotation.x;
    };
    expect(legAfter(30)).toBeCloseTo(legAfter(144), 2);
  });

  it("stand when they've passed him, rather than march on the spot", () => {
    const ch = createChitauri();
    const h = soldier();
    const o = { id: 3, passed: false };
    for (let i = 0; i < 30; i++) ch.pose(h, o, { dt: 1 / 30, ahead: 40, firing: false, walk: WALK });
    o.passed = true;
    const seen = new Set();
    for (let i = 0; i < 60; i++) {
      ch.pose(h, o, { dt: 1 / 30, ahead: -3, firing: false, walk: WALK });
      if (i > 20) seen.add(h.bones.thighL.rotation.x.toFixed(4));
    }
    expect([...seen]).toEqual(['0.0000']);
  });

  it('let only a couple shoot at once, the nearest first, and none out of range', () => {
    const ch = createChitauri({ shooters: 2 });
    const line = [9, 14, 20, 26, 29].map((ahead, i) => ({ o: { id: i + 1 }, ahead }));
    let firing = [];
    for (let f = 0; f < 10; f++) firing = line.filter(({ o, ahead }) => ch.claim(o, ahead, true)).map(({ o }) => o.id);
    expect(firing).toEqual([1, 2]);
    // the nearest passes him: the next takes its place
    expect(ch.claim(line[0].o, RANGE[0] - 1, true)).toBe(false);
    firing = line.slice(1).filter(({ o, ahead }) => ch.claim(o, ahead, true)).map(({ o }) => o.id);
    expect(firing).toEqual([2, 3]);
    // and nobody shoots once the run's over
    expect(line.some(({ o, ahead }) => ch.claim(o, ahead, false))).toBe(false);
  });

  it('fire in bursts with a kick, and raise the rifle first', () => {
    const ch = createChitauri();
    const h = soldier();
    const o = { id: 11, passed: false };
    const at = [];
    for (let i = 0; i < 300; i++) {
      if (ch.pose(h, o, { dt: 1 / 60, ahead: 15, firing: true, walk: WALK })) at.push(i / 60);
      if (at.length === 1 && at[0] === i / 60) expect(h.chit.kick).toBe(1);
    }
    expect(at.length).toBeGreaterThanOrEqual(2);
    expect(at[0]).toBeGreaterThan(0.1); // (the rifle comes up before the first)
    for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBeGreaterThan(0.75);
    // reduced motion: aimed, no bolts
    const calm = createChitauri();
    const h2 = soldier();
    let shots = 0;
    for (let i = 0; i < 300; i++) shots += calm.pose(h2, { id: 11 }, { dt: 1 / 60, ahead: 15, firing: true, walk: WALK, calm: true }) ? 1 : 0;
    expect(shots).toBe(0);
  });

  it('a smashed one flails in the air and sprawls once it lands', () => {
    const h = soldier();
    flail(h, 0.2);
    const up = h.bones.shoulderL.rotation.x;
    flail(h, 0.5);
    expect(h.bones.shoulderL.rotation.x).not.toBeCloseTo(up, 3);
    expect(up).toBeLessThan(-1.5); // (arms flung over its head)
    flail(h, 0.6, true);
    const a = h.bones.shoulderL.rotation.z;
    flail(h, 0.9, true);
    expect(h.bones.shoulderL.rotation.z).toBe(a);
  });
});
