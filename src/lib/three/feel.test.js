import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createFeel, feelGroups } from './feel';

const camera = () => new THREE.PerspectiveCamera(60, 1, 0.1, 100);
// the camera put back where the game puts it, then the feel on top, a frame
const frame = (feel, cam, dt) => {
  cam.position.set(0, 0, 0);
  cam.rotation.set(0, 0, 0);
  feel.update(dt, cam);
  return Math.hypot(cam.position.x, cam.position.y);
};

describe('createFeel', () => {
  it('shakes on trauma, and has settled three seconds on', () => {
    const feel = createFeel({ seed: 3 });
    const cam = camera();
    feel.trauma(1);
    let most = 0;
    for (let i = 0; i < 12; i++) most = Math.max(most, frame(feel, cam, 1 / 60));
    expect(most).toBeGreaterThan(0.01);
    for (let t = 0; t < 3; t += 1 / 60) frame(feel, cam, 1 / 60);
    expect(frame(feel, cam, 1 / 60)).toBeLessThan(0.01);
    expect(feel.state().trauma).toBe(0);
  });

  it('never moves the camera when calm', () => {
    const feel = createFeel({ calm: true });
    const cam = camera();
    feel.trauma(1);
    feel.punch(10);
    for (let i = 0; i < 30; i++) expect(frame(feel, cam, 1 / 60)).toBe(0);
    expect(cam.rotation.z).toBe(0);
    expect(cam.fov).toBe(60);
  });

  it('slows the game in a hitstop, not the camera', () => {
    const feel = createFeel();
    const cam = camera();
    feel.trauma(0.5);
    feel.hitstop(100);
    expect(feel.scale(1 / 60)).toBeLessThan(0.1);
    // (the camera’s shake still runs at the frame’s own time)
    const before = feel.state().trauma;
    feel.update(1 / 60, cam);
    expect(feel.state().trauma).toBeCloseTo(before - 1.5 / 60, 9);
    for (let i = 0; i < 10; i++) feel.scale(1 / 60);
    expect(feel.scale(1 / 60)).toBe(1);
  });
});

describe('the feel’s defaults, its groups and the loop rule', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is calm when the visitor asks for reduced motion, without being told', () => {
    vi.stubGlobal('window', { matchMedia: (q) => ({ matches: q.includes('reduced-motion') }) });
    const feel = createFeel();
    const cam = camera();
    feel.trauma(1);
    for (let i = 0; i < 10; i++) expect(frame(feel, cam, 1 / 60)).toBe(0);
  });

  it('moves the camera when not calm', () => {
    const feel = createFeel({ calm: false });
    const cam = camera();
    feel.trauma(1);
    let most = 0;
    for (let i = 0; i < 10; i++) most = Math.max(most, frame(feel, cam, 1 / 60));
    expect(most).toBeGreaterThan(0.01);
  });

  it('runs hitstop when calm, though the camera holds still', () => {
    const feel = createFeel({ calm: true });
    const cam = camera();
    feel.trauma(1);
    feel.hitstop(100);
    expect(feel.step(1 / 60)).toBeLessThan(1 / 60);
    expect(frame(feel, cam, 1 / 60)).toBe(0);
  });

  it('steps a frame whole without a hitstop, and timeScale is scale', () => {
    const feel = createFeel({ calm: false });
    expect(feel.step(1 / 60)).toBe(1 / 60);
    feel.hitstop(50);
    expect(feel.timeScale(1 / 60)).toBeLessThan(0.1);
  });

  it('makes hitstop real in a loop that steps by it: fewer fixed steps run', () => {
    // the HQ games’ loop: a fixed 1/120 s step fed by the frame’s scaled dt
    const run = (hit) => {
      const feel = createFeel({ calm: true });
      if (hit) feel.hitstop(160);
      let acc = 0;
      let steps = 0;
      for (let f = 0; f < 12; f++) {
        acc += feel.step(1 / 60);
        while (acc >= 1 / 120) {
          acc -= 1 / 120;
          steps++;
        }
      }
      return steps;
    };
    expect(run(false)).toBe(24);
    expect(run(true)).toBeLessThan(10);
  });

  it('puts its numbers on the panel, read and written live', () => {
    const feel = createFeel({ calm: false });
    const [group, ...rest] = feelGroups(feel);
    expect(rest).toHaveLength(0);
    expect(group.name).toBe('feel');
    expect(group.items.map((it) => [it.key, it.min, it.max])).toEqual([
      ['decay', 0, 4],
      ['offset', 0, 1],
      ['roll', 0, 0.2],
      ['punchTau', 0.05, 0.6],
      ['stopScale', 0, 0.5],
    ]);
    const decay = group.items[0];
    expect(decay.get()).toBe(1.5);
    decay.set(3);
    expect(feel.values().decay).toBe(3);
    feel.trauma(1);
    feel.update(0.1, camera());
    expect(feel.state().trauma).toBeCloseTo(0.7, 9);
    // a game’s own offset is the panel’s starting value
    expect(feelGroups(createFeel({ calm: true, offset: 0.4 }))[0].items[1].get()).toBe(0.4);
  });
});
