import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createFeel } from './feel';

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
