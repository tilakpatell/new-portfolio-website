import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DISK_N, MAW, TILT, captured, fallAt, parkNear, plungeAt, pullAt, startFall } from './maw';
import { SHIP, forward } from './ship';

const [cx, cy, cz] = MAW.at;
const away = (p) => Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz);
const speed = (v) => Math.hypot(...v);

describe('the Maw', () => {
  it('tips its disk the way deepspace.js draws it', () => {
    const n = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...TILT));
    expect(DISK_N[0]).toBeCloseTo(n.x, 6);
    expect(DISK_N[1]).toBeCloseTo(n.y, 6);
    expect(DISK_N[2]).toBeCloseTo(n.z, 6);
  });

  it('pulls only within its reach, harder the closer you are', () => {
    expect(pullAt(cx + MAW.reach + 1, cy, cz)).toBeNull();
    const far = pullAt(cx + MAW.reach * 0.8, cy, cz);
    const near = pullAt(cx + MAW.capture * 1.1, cy, cz);
    expect(far.k).toBeGreaterThan(0);
    expect(near.k).toBeGreaterThan(far.k);
    expect(speed(near.v)).toBeGreaterThan(speed(far.v));
    expect(pullAt(cx + MAW.capture, cy, cz).k).toBeCloseTo(1, 6);
  });

  it('draws you in and carries you round with its disk', () => {
    for (const [x, y, z] of [
      [cx + 70, cy, cz],
      [cx, cy + 10, cz - 80],
      [cx - 50, cy - 30, cz + 40],
    ]) {
      const { v } = pullAt(x, y, z);
      const rel = [x - cx, y - cy, z - cz];
      expect(v[0] * rel[0] + v[1] * rel[1] + v[2] * rel[2], 'inward').toBeLessThan(0);
      // the same way round as the disk: right-handed about its normal
      const turn = new THREE.Vector3(...rel).cross(new THREE.Vector3(...v)).dot(new THREE.Vector3(...DISK_N));
      expect(turn, 'round').toBeGreaterThan(0);
    }
  });

  it('can be flown out of at its edge, takes the boost nearer in, and never outpulls the boost', () => {
    expect(speed(pullAt(cx + MAW.reach * 0.83, cy, cz).v)).toBeLessThan(SHIP.cruise * 0.6);
    expect(speed(pullAt(cx + MAW.capture + 4, cy, cz).v)).toBeGreaterThan(SHIP.cruise);
    expect(speed(pullAt(cx + MAW.capture + 1, cy, cz).v)).toBeLessThan(SHIP.boost);
  });

  it('has you past the point of no return', () => {
    expect(captured(cx + MAW.capture - 0.5, cy, cz)).toBe(true);
    expect(captured(cx + MAW.capture + 0.5, cy, cz)).toBe(false);
  });

  it('parks the autopilot just inside its pull, facing it, on the side you came from', () => {
    const p = parkNear([cx + 400, cz - 300]);
    const d = Math.hypot(p.x - cx, p.y - cy, p.z - cz);
    expect(d).toBeLessThan(MAW.reach);
    expect(d).toBeGreaterThan(MAW.capture * 1.6);
    expect(pullAt(p.x, p.y, p.z).k).toBeLessThan(0.1);
    expect((p.x - cx) * 400 + (p.z - cz) * -300).toBeGreaterThan(0);
    const [fx, fz] = forward(p.heading);
    expect(fx * (cx - p.x) + fz * (cz - p.z)).toBeCloseTo(d, 4);
  });

  it('starts the fall where it had the ship, and spirals it down to the edge of the shadow', () => {
    const from = [cx + 40, cy + 18, cz - 25];
    const f = startFall(from);
    const start = fallAt(f, 0).at;
    from.forEach((v, i) => expect(start[i]).toBeCloseTo(v, 6));
    let last = Infinity;
    for (let t = 0; t <= MAW.horizon + 0.5; t += 0.05) {
      const s = fallAt(f, t);
      const d = away(s.at);
      expect(d, `t ${t.toFixed(2)}`).toBeLessThanOrEqual(last + 1e-6);
      expect(d).toBeGreaterThan(MAW.shadow);
      last = d;
    }
    expect(away(fallAt(f, MAW.spiral).at)).toBeCloseTo(MAW.shadow * MAW.edge, 4);
  });

  it('goes round in a plane facing the camera, faster as it closes in, with the disk nearly edge-on to it', () => {
    const from = [cx - 30, cy + 9, cz + 35];
    const cam = [cx - 60, cy + 30, cz + 80];
    const f = startFall(from, cam);
    const view = new THREE.Vector3(...f.view);
    const n = new THREE.Vector3(...DISK_N);
    // nearly level with the disk, and on the camera's side of things
    expect(Math.abs(view.dot(n))).toBeCloseTo(Math.sin(MAW.above), 6);
    expect(view.dot(new THREE.Vector3(cam[0] - cx, cam[1] - cy, cam[2] - cz))).toBeGreaterThan(0);
    // every point of the fall in the plane it faces (as near as its tilt allows)
    const m = view.clone().addScaledVector(n, -view.dot(n)).normalize();
    for (let t = 0; t < MAW.horizon; t += 0.1) {
      const p = new THREE.Vector3(...fallAt(f, t).at).sub(new THREE.Vector3(...MAW.at));
      expect(Math.abs(p.dot(m)), `t ${t.toFixed(1)}`).toBeLessThan(1e-6);
    }
    const step = (t) => new THREE.Vector3(...fallAt(f, t).at).sub(new THREE.Vector3(...MAW.at)).angleTo(new THREE.Vector3(...fallAt(f, t + 0.05).at).sub(new THREE.Vector3(...MAW.at)));
    expect(step(2.4)).toBeGreaterThan(step(0.4) * 3);
  });

  it('holds it at the horizon, reddening and fading, and then the camera goes in', () => {
    const f = startFall([cx + 50, cy, cz]);
    expect(fallAt(f, 0.1).glow).toBe(1);
    expect(fallAt(f, MAW.spiral + 0.1).held).toBe(true);
    expect(fallAt(f, MAW.horizon - 0.2).glow).toBeLessThan(0.3);
    expect(fallAt(f, MAW.horizon - 0.2).red).toBeGreaterThan(fallAt(f, 1).red);
    expect(fallAt(f, MAW.horizon).gone).toBe(true);
    expect(plungeAt(MAW.plunge - 0.1)).toBe(0);
    expect(plungeAt(MAW.through)).toBe(1);
    expect(MAW.plunge).toBeGreaterThan(MAW.spiral);
    expect(MAW.through).toBeGreaterThan(MAW.horizon);
  });

  it('falls the same way from straight above a pole', () => {
    const f = startFall([cx + DISK_N[0] * 40, cy + DISK_N[1] * 40, cz + DISK_N[2] * 40]);
    const s = fallAt(f, MAW.spiral);
    expect(s.at.every(Number.isFinite)).toBe(true);
    expect(away(s.at)).toBeCloseTo(MAW.shadow * MAW.edge, 4);
  });
});
