import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SHAKE, byFrame, createShake } from './feel';

const camera = () => new THREE.PerspectiveCamera(50, 1, 0.1, 100);
// the camera put back where the scene puts it, then the shake on top, a frame
const frame = (shake, cam, dt, k) => {
  cam.position.set(0, 0, 0);
  shake.update(dt, cam, k);
  return Math.hypot(cam.position.x, cam.position.y);
};

describe('byFrame', () => {
  it('moves as min(1, dt × k) did at 60 Hz', () => {
    for (const k of [0.5, 2.4, 7, 8]) expect(byFrame(k, 1 / 60)).toBeCloseTo(Math.min(1, k / 60), 9);
  });

  it('gets as far in a second at 30, 60 or 144 Hz', () => {
    const after = (hz) => {
      let x = 0;
      for (let i = 0; i < hz; i++) x += (1 - x) * byFrame(8, 1 / hz);
      return x;
    };
    expect(after(30)).toBeCloseTo(after(60), 9);
    expect(after(144)).toBeCloseTo(after(60), 9);
  });

  it('is at once for a rate a frame can’t hold, and still for no time', () => {
    expect(byFrame(60, 1 / 60)).toBe(1);
    expect(byFrame(90, 1 / 120)).toBe(1);
    expect(byFrame(8, 0)).toBe(0);
  });
});

describe('createShake', () => {
  it('keeps the old decay and puts the old shake’s k in as trauma', () => {
    const shake = createShake({ calm: false });
    expect(shake.feel.values().decay).toBe(SHAKE.decay);
    shake.update(0, camera(), 0.3);
    expect(shake.feel.state().trauma).toBeCloseTo(0.3, 9);
  });

  it('holds a level asked every frame, rather than piling it up', () => {
    const shake = createShake({ calm: false });
    const cam = camera();
    for (let i = 0; i < 120; i++) frame(shake, cam, 1 / 60, 0.08);
    expect(shake.feel.state().trauma).toBeLessThanOrEqual(0.08);
    expect(shake.feel.state().trauma).toBeGreaterThan(0.06);
  });

  it('shakes on a hit and has settled once it has decayed', () => {
    const shake = createShake({ calm: false });
    const cam = camera();
    let most = frame(shake, cam, 1 / 60, 0.35);
    for (let i = 0; i < 20; i++) most = Math.max(most, frame(shake, cam, 1 / 60));
    expect(most).toBeGreaterThan(0.02);
    for (let t = 0; t < 0.35 / SHAKE.decay + 0.1; t += 1 / 60) frame(shake, cam, 1 / 60);
    expect(frame(shake, cam, 1 / 60)).toBe(0);
  });

  it('holds the camera still under reduced motion, and leaves its lens be', () => {
    const shake = createShake({ calm: true });
    const cam = camera();
    cam.fov = 63;
    for (let i = 0; i < 30; i++) expect(frame(shake, cam, 1 / 60, 0.5)).toBe(0);
    expect(cam.fov).toBe(63);
  });

  it('follows the scene’s own lens rather than setting one', () => {
    const shake = createShake({ calm: false });
    const cam = camera();
    cam.fov = 38;
    frame(shake, cam, 1 / 60, 0.2);
    expect(cam.fov).toBe(38);
  });

  it('takes a scene’s own numbers', () => {
    const shake = createShake({ calm: true, offset: 0.7, decay: 1.8 });
    expect(shake.feel.values()).toMatchObject({ offset: 0.7, decay: 1.8 });
  });

  it('makes hitstop real through step()', () => {
    const shake = createShake({ calm: true });
    expect(shake.step(1 / 60)).toBe(1 / 60);
    shake.hitstop(80);
    expect(shake.step(1 / 60)).toBeLessThan(1 / 60);
  });

  it('puts its numbers on the panel', () => {
    const shake = createShake({ calm: true });
    expect(shake.groups().map((g) => g.name)).toEqual(['feel']);
  });
});
