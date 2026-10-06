import { describe, expect, it } from 'vitest';
import { createKit } from '../courses/shapes';
import { ZOOMS, camYaw, newCam, stepCam } from './camera';
import { makeWorld } from './collide';
import { angleDiff } from './vec';

const open = () => makeWorld(new Float32Array(0), []);
const hero = (o = {}) => ({ pos: { x: 0, y: 0, z: 0 }, yaw: 0, fwd: 0, airborne: false, action: 'idle', ...o });
const none = { turn: 0, drag: 0, stick: 0, zoomPress: false };

describe('the Lakitu camera', () => {
  it('turns its aim a quarter of a half turn on a press', () => {
    const m = hero();
    const c = newCam(m);
    const before = c.yawTo;
    stepCam(c, m, { ...none, turn: 1 }, open());
    expect(c.yawTo - before).toBeCloseTo(Math.PI / 4);
  });

  it('eases its yaw to its aim', () => {
    const m = hero();
    const c = newCam(m);
    stepCam(c, m, { ...none, turn: -1 }, open());
    for (let i = 0; i < 40; i++) stepCam(c, m, none, open());
    expect(Math.abs(angleDiff(c.yaw, c.yawTo))).toBeLessThan(0.01);
    expect(camYaw(c)).toBe(c.yaw);
  });

  it('swings behind Mario when he runs sideways and the camera is left alone', () => {
    const m = hero({ yaw: Math.PI / 2, fwd: 32, action: 'walk' });
    const c = newCam(hero());
    for (let i = 0; i < 40; i++) stepCam(c, m, none, open());
    expect(Math.abs(angleDiff(c.yaw, 0))).toBeLessThan(0.05);
    for (let i = 0; i < 300; i++) stepCam(c, m, none, open());
    expect(Math.abs(angleDiff(c.yaw, Math.PI / 2))).toBeLessThan(0.3);
  });

  it('keeps its height through a jump, and rises when he lands higher', () => {
    const m = hero();
    const c = newCam(m);
    for (let i = 0; i < 30; i++) stepCam(c, m, none, open());
    const y0 = c.focus.y;
    Object.assign(m, { airborne: true, action: 'jump' });
    m.pos.y = 250;
    for (let i = 0; i < 10; i++) stepCam(c, m, none, open());
    expect(c.focus.y).toBeCloseTo(y0, 0);
    Object.assign(m, { airborne: false, action: 'land' });
    m.pos.y = 300;
    for (let i = 0; i < 40; i++) stepCam(c, m, none, open());
    expect(c.focus.y).toBeCloseTo(y0 + 300, 0);
  });

  it('comes in front of a wall between it and Mario', () => {
    const k = createKit();
    // a wall 400 behind Mario (the camera looks along +z, so it sits at -z)
    k.box({ x: 0, y: -1000, z: -500, w: 4000, h: 4000, d: 200, mat: 'g' });
    const o = k.done();
    const w = makeWorld(o.tris, o.kinds);
    const m = hero();
    const c = newCam(m);
    for (let i = 0; i < 40; i++) stepCam(c, m, none, w);
    expect(c.pos.z).toBeGreaterThan(-400);
    expect(c.pos.z).toBeLessThan(0);
  });

  it('cycles its distance through the zooms', () => {
    const m = hero();
    const c = newCam(m);
    const seen = [];
    for (let i = 0; i < ZOOMS.length; i++) {
      stepCam(c, m, { ...none, zoomPress: true }, open());
      for (let j = 0; j < 60; j++) stepCam(c, m, none, open());
      seen.push(Math.round(c.dist));
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([...ZOOMS].sort((a, b) => a - b));
  });
});
