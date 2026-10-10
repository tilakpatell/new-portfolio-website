import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GUNS, buildGun, handFrame, stance } from './gunplay';
import * as held from '../../lib/three/held';

describe('the guns', () => {
  it('every kind builds at real size, muzzle ahead of the grip, with the points the hands and the shot need', () => {
    for (const [kind, g] of Object.entries(GUNS)) {
      expect(g.hands === 1 || g.hands === 2, kind).toBe(true);
      const owned = [];
      const gun = buildGun(kind, owned);
      expect(gun.isGroup, kind).toBe(true);
      let meshes = 0;
      gun.traverse((o) => o.isMesh && meshes++);
      expect(meshes, kind).toBeGreaterThan(3);
      expect(owned.length, kind).toBeGreaterThan(0);
      const box = new THREE.Box3().setFromObject(gun);
      const size = box.getSize(new THREE.Vector3());
      const muzzleOf = gun.getObjectByName('muzzle');
      if (g.blade) {
        // a lightsaber: the hilt and blade stand along +y, the tip at the top
        expect(size.y, kind).toBeGreaterThan(1);
        expect(size.y, kind).toBeLessThan(1.6);
        expect(size.z, kind).toBeLessThan(0.2);
        expect(muzzleOf, kind).toBeTruthy();
        expect(muzzleOf.position.y, kind).toBeGreaterThan(box.max.y - 0.05);
        expect(gun.getObjectByName('blade'), kind).toBeTruthy();
        expect(gun.getObjectByName('grip'), kind).toBeTruthy();
        expect(g.flash, kind).toBeNull();
        continue;
      }
      expect(size.z, kind).toBeGreaterThan(0.12); // longer than a hand
      expect(size.z, kind).toBeLessThan(1.3);
      expect(size.y, kind).toBeLessThan(0.5);
      const muzzle = gun.getObjectByName('muzzle');
      expect(muzzle, kind).toBeTruthy();
      expect(muzzle.position.z, kind).toBeGreaterThan(0.08);
      expect(muzzle.position.z, kind).toBeGreaterThan(box.max.z - 0.05); // at the front
      if (g.hands === 2) {
        const fore = gun.getObjectByName('foregrip');
        expect(fore, kind).toBeTruthy();
        expect(fore.position.z, kind).toBeGreaterThan(0.1);
        expect(fore.position.z, kind).toBeLessThan(muzzle.position.z);
      }
      expect(g.kick.back, kind).toBeGreaterThan(0);
      expect(g.kick.up, kind).toBeGreaterThan(0);
      expect(g.flash.color, kind).toMatch(/^#/);
    }
  });

  it('gives the soldiers their own: the E-11 short with its pack out to the left, the DC-15A long, the E-5 between, each held in both hands', () => {
    const sized = (kind) => {
      const gun = buildGun(kind, []);
      const box = new THREE.Box3().setFromObject(gun);
      return { box, z: box.max.z - box.min.z };
    };
    const e11 = sized('e11');
    const dc15 = sized('dc15');
    const e5 = sized('e5');
    expect(e11.z).toBeGreaterThan(0.38);
    expect(e11.z).toBeLessThan(0.5); // (its stock folded)
    expect(e11.box.max.x).toBeGreaterThan(0.09); // the power pack, out to the left (+x)
    expect(e11.box.min.x).toBeGreaterThan(-0.03); // and nothing out to the right
    expect(dc15.z).toBeGreaterThan(0.95);
    expect(e5.z).toBeGreaterThan(0.75);
    expect(e5.z).toBeLessThan(dc15.z);
    for (const kind of ['e11', 'dc15', 'e5']) {
      expect(GUNS[kind].hands, kind).toBe(2);
      expect(GUNS[kind].stock, kind).toBe(true);
    }
    // (a clone's bolt is blue, the Empire's and the droids' red)
    expect(GUNS.dc15.flash.color).toBe('#62c8ff');
    expect(GUNS.e11.flash.color).toBe('#ff4a3d');
    expect(GUNS.e5.flash.color).toBe('#ff4a3d');
  });
});

describe('a hand’s grip frame', () => {
  // a right hand at rest, in its bone's space: fingers along +y, the palm
  // thin along +x, a bit of thumb toward +z
  const slab = () => {
    const pts = [];
    for (let i = 0; i < 300; i++) pts.push([Math.random() * 1.6 - 0.8, Math.random() * 12, Math.random() * 7 - 3.5]);
    return pts;
  };
  it('its hand frame is the held layer’s, re-exported', () => {
    expect(handFrame).toBe(held.handFrame);
  });
  it('runs the barrel along the fingers and the sights toward the thumb, whichever way the palm faces', () => {
    // the hand's axes in the world (an A-pose, the arm hanging a little out): x out from the body, y down the arm, z forward
    const axes = { x: new THREE.Vector3(-1, 0, 0), y: new THREE.Vector3(0, -1, 0), z: new THREE.Vector3(0, 0, 1) };
    const body = { forward: new THREE.Vector3(0, 0, 1), inward: new THREE.Vector3(1, 0, 0) };
    const f = handFrame(slab(), axes, body);
    expect(f.along.y).toBeCloseTo(1, 5); // the fingers
    expect(f.thumb.z).toBeCloseTo(1, 5); // the thumb's side, forward at rest
    expect(Math.abs(f.normal.x)).toBeCloseTo(1, 5); // the palm faces in or out
    expect(f.normal.x).toBeLessThan(0); // out of the palm, toward the body: the bone's +x is out from it
    // a palm that faces backward instead: thin along z, the thumb toward the body
    const back = [];
    for (let i = 0; i < 300; i++) back.push([Math.random() * 7 - 3.5, Math.random() * 12, Math.random() * 1.6 - 0.8]);
    const g = handFrame(back, axes, body);
    expect(Math.abs(g.normal.z)).toBeCloseTo(1, 5);
    expect(g.thumb.x).toBeLessThan(0); // inward (the bone's −x)
  });
});

describe('a stance', () => {
  it('puts a pistol out along the line and a long gun’s trigger hand in by the chest', () => {
    const S = new THREE.Vector3(-0.18, 1.4, 0); // the right shoulder
    const dir = new THREE.Vector3(0, 0, 1);
    const up = new THREE.Vector3(0, 1, 0);
    const pistol = stance(GUNS.blaster, S, dir, up, 0.6);
    const rifle = stance(GUNS.rifle, S, dir, up, 0.6);
    expect(pistol.hand.z - S.z).toBeGreaterThan(0.4);
    expect(pistol.hand.z - S.z).toBeLessThan(0.6); // the elbow keeps a bend
    expect(pistol.hand.y).toBeGreaterThan(S.y); // up toward the eye line
    expect(rifle.hand.z - S.z).toBeLessThan(pistol.hand.z - S.z);
    expect(rifle.hand.y).toBeLessThan(pistol.hand.y);
    // aimed up: the hand goes up with the line
    const high = stance(GUNS.blaster, S, new THREE.Vector3(0, 0.6, 0.8).normalize(), up, 0.6);
    expect(high.hand.y).toBeGreaterThan(pistol.hand.y + 0.1);
  });
});
