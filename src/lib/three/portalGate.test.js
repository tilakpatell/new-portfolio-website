import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GATE, createGateFx, gateAhead, gateOpenAt, intoAt, outAt, throughAt } from './portalGate';
import { STAGED } from '../../components/jumps/timing';
import { T } from '../../components/hyperspace3d/timeline';

describe('the portal jump’s choreography', () => {
  it('flies the ship into the gate: off from a standstill, its nose at the gate on time, through before the screen fills', () => {
    expect(intoAt(0)).toBe(0);
    expect(intoAt(GATE.start)).toBe(0);
    let last = 0;
    for (let t = 0; t <= 1.2; t += 0.02) {
      const p = intoAt(t);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
    expect(intoAt(GATE.reach) + 0.5).toBeCloseTo(gateAhead(), 6);
    // (all of it through the gate's plane before the page's goo starts in)
    expect(intoAt(throughAt()) - 0.5).toBeCloseTo(gateAhead(), 6);
    expect(throughAt()).toBeLessThan(STAGED.clear);
    // and into the flash, gone
    expect(intoAt(T.jump / 1000)).toBeGreaterThan(gateAhead() + 0.5);
  });

  it('brings it out of the exit gate nose first, onto its parked spot', () => {
    // (all of it behind the gate's plane at first)
    expect(outAt(0) + 0.5).toBeLessThan(-GATE.back);
    let last = -Infinity;
    for (let e = 0; e <= 1.2; e += 0.02) {
      const p = outAt(e);
      expect(p).toBeGreaterThanOrEqual(last - 1e-9);
      expect(p).toBeLessThanOrEqual(0);
      last = p;
    }
    expect(outAt(GATE.outFrom + GATE.outFor)).toBeCloseTo(0, 6);
    expect(outAt(5)).toBe(0);
  });

  it('opens a gate settling a little past open, and pinches it shut with a flash', () => {
    expect(gateOpenAt(0).open).toBe(0);
    const peak = Math.max(...Array.from({ length: 60 }, (_, i) => gateOpenAt((i / 60) * GATE.opening).open));
    expect(peak).toBeGreaterThan(1);
    expect(gateOpenAt(GATE.opening).open).toBeCloseTo(1, 5);
    const shut = 1;
    const mid = gateOpenAt(shut + GATE.shutFor / 2, shut);
    expect(mid.open).toBeLessThan(0.5);
    expect(mid.flash).toBeGreaterThan(0.5);
    const end = gateOpenAt(shut + GATE.shutFor, shut);
    expect(end.open).toBe(0);
    expect(end.done).toBe(true);
  });
});

describe('the gates, drawn', () => {
  it('opens, clips what flies through on the side it comes from, puts it back, and shuts', () => {
    const parent = new THREE.Group();
    parent.rotation.y = 0.7; // (the universe map turns)
    const fx = createGateFx({ parent });
    const gate = fx.open({ at: new THREE.Vector3(0, 0, 5), dir: new THREE.Vector3(0, 0, 1), radius: 1 });
    expect(parent.children).toContain(gate.mesh);
    const ship = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    const own = ship.material;
    parent.add(ship);
    const c = fx.clip(ship, gate, 'near');
    expect(ship.material).not.toBe(own);
    expect(ship.material.clippingPlanes[0]).toBe(c.plane);
    // a point short of the gate is kept, one past it is cut (in the world, the parent turned)
    const short = parent.localToWorld(new THREE.Vector3(0, 0, 4));
    const past = parent.localToWorld(new THREE.Vector3(0, 0, 6));
    expect(c.plane.distanceToPoint(short)).toBeGreaterThan(0);
    expect(c.plane.distanceToPoint(past)).toBeLessThan(0);
    c.release();
    expect(ship.material).toBe(own);
    // the way out: the far side's kept
    const out = fx.clip(ship, gate, 'far');
    expect(out.plane.distanceToPoint(past)).toBeGreaterThan(0);
    out.release();
    fx.update(GATE.opening);
    expect(gate.mesh.material.uniforms.open.value).toBeCloseTo(1, 3);
    gate.shut();
    for (let i = 0; i < 30; i++) fx.update(0.02);
    expect(gate.done).toBe(true);
    expect(parent.children).not.toContain(gate.mesh);
    expect(fx.busy).toBe(false);
    fx.dispose();
  });
});
