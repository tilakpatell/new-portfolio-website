// Kamino's props, built in code (props/index.js has what a builder
// returns): Tipoca City on its stilts over the storm, its pads and masts,
// the lightning, Slave I and Jango, and the aiwha; the buoys scattered
// off it. Each is what the world places when there's no model of it (yet,
// catalog/core.js), and what there's no model of at all.
// (props/core/index.js has the other core worlds'.)
//
//   PROPS     tipoca, kpad, kmast, kdischarge, slave1, jango, aiwha
//             (kit, opts) → { object, solids?, floors?, update? }
//   SCATTER   buoy: (kit, opts) → { parts, radius }

import * as THREE from 'three';
import { box, cyl, dome, part, ring, rod, upright } from '../../kit';
import { boltPath, strikeAt } from '../../storm';
import { lit } from './shared';

const { PI, cos, sin } = Math;

// Kamino's white, lit from within the storm: the painted parts of a built
// thing, given a glow of their own (one material, shared)
function whiten(k, object) {
  k.mats.kaminoWhite ??= k.own(Object.assign(k.mats.paint.clone(), { emissive: new THREE.Color('#5c6670'), emissiveIntensity: 0.7 }));
  object.traverse((o) => {
    if (o.isMesh && o.material === k.mats.paint) o.material = k.mats.kaminoWhite;
  });
  return object;
}

export const PROPS = {
  // a building of Tipoca City, 40 m: a broad white dome over a ring of
  // lit windows, on its stilts out of the sea; its door at 22 m, facing +z
  tipoca(k, { style = 'dome', s: S = 1 } = {}) {
    const WHITE = '#f2f5f8';
    const GREY = '#c4cad0';
    const parts = [];
    if (style === 'tower') {
      parts.push(part(cyl(5, 4, 44, 20), { color: GREY, to: 'paint' }));
      parts.push(part(cyl(4, 9, 6, 24), { at: [0, 44, 0], color: WHITE, to: 'paint' }));
      parts.push(part(cyl(9, 9, 4, 24), { at: [0, 50, 0], color: WHITE, to: 'paint' }));
      parts.push(part(cyl(9.15, 9.15, 1.4, 24), { at: [0, 51.2, 0], color: lit('#e8f6ff', 1.6), to: 'glow' }));
      parts.push(part(dome(9, 5, 24), { at: [0, 54, 0], color: WHITE, to: 'paint' }));
      parts.push(part(cyl(0.3, 0.1, 10, 6), { at: [0, 59, 0], color: GREY, to: 'metal' }));
      parts.push(part(new THREE.SphereGeometry(0.5, 8, 6), { at: [0, 69, 0], color: lit('#ff4a3a', 3), to: 'glow' }));
      for (let y = 6; y < 42; y += 6) parts.push(part(cyl(4.6 - y * 0.02, 4.6 - y * 0.02, 0.8, 20), { at: [0, y, 0], color: lit('#dff2ff', 1.2), to: 'glow' }));
      return { object: whiten(k, k.build(parts, { name: 'tipoca' })), solids: [{ circle: [0, 0, 5] }] };
    }
    // the stilts, and the column up the middle
    parts.push(part(cyl(4.5, 3.5, 19, 16), { at: [0, -6, 0], color: GREY, to: 'paint' }));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2 + 0.3;
      parts.push(rod([sin(a) * 13, -6, cos(a) * 13], [sin(a) * 10, 19, cos(a) * 10], 1.2, 0.9, { color: GREY, to: 'paint' }));
    }
    parts.push(part(cyl(13, 17, 4, 32), { at: [0, 18, 0], color: GREY, to: 'paint' }));
    parts.push(part(upright([[18, 0], [20, 1.5], [20.6, 5], [19.6, 9], [16.6, 13.5], [11, 17.4], [4, 19.4], [0, 19.7]], 40), { at: [0, 22, 0], color: WHITE, to: 'paint' }));
    parts.push(part(cyl(20.35, 20.35, 1.5, 40), { at: [0, 24.2, 0], color: lit('#e2f2ff', 1.5), to: 'glow' }));
    parts.push(part(cyl(19.75, 19.75, 0.9, 40), { at: [0, 30.4, 0], color: lit('#e2f2ff', 1.1), to: 'glow' }));
    parts.push(part(cyl(2.2, 2.2, 2, 14), { at: [0, 41.4, 0], color: GREY, to: 'paint' }));
    parts.push(part(dome(2.4, 1.6, 14), { at: [0, 43.4, 0], color: WHITE, to: 'paint' }));
    // the door, at the walkways' level
    parts.push(part(box(4, 3.6, 1), { at: [0, 22, 19.9], color: '#2a3038', to: 'dark' }));
    parts.push(part(box(5.2, 0.4, 1.4), { at: [0, 25.6, 20], color: GREY, to: 'paint' }));
    const object = k.build(parts, { name: 'tipoca' });
    whiten(k, object);
    object.scale.set(S, 1, S);
    const holder = new THREE.Group();
    holder.add(object);
    return { object: holder, solids: [{ circle: [0, 0, 20 * S] }] };
  },

  // a Kamino landing platform: a white disc on its column and struts
  // over the sea, its landing lights round the rim
  kpad(k, { r: R = 28, depth = 28 } = {}) {
    const parts = [
      // (its deck a grey tread plate, the wet catching the light)
      part(cyl(R, R, 0.7, 48), { at: [0, -0.4, 0], color: '#7c858c', to: 'deck' }),
      part(new THREE.RingGeometry(R * 0.68, R * 0.72, 48).rotateX(-PI / 2), { at: [0, 0.31, 0], color: '#3e464c', to: 'paint' }),
      // (under it, a cone flaring up to the deck, on a column wider at its foot)
      part(cyl(R * 0.36, R * 0.98, 8, 32), { at: [0, -8.4, 0], color: '#6a737a', to: 'paint' }),
      part(cyl(R * 0.42, R * 0.32, depth, 20), { at: [0, -depth, 0], color: '#5e676e', to: 'paint' }),
    ];
    for (const a of [0.4, 0.4 + PI / 2]) parts.push(part(new THREE.BoxGeometry(R * 1.2, 0.04, 1), { at: [0, 0.32, 0], rot: [0, a, 0], color: '#f0f2f4', to: 'paint' }));
    // amber strips round its rim (no curb: the skybridges join it there)
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * PI * 2;
      parts.push(part(box(1.8, 0.1, 0.3), { at: [sin(a) * R * 0.96, 0.3, cos(a) * R * 0.96], rot: [0, a + PI / 2, 0], color: lit('#ffd28a', 3), to: 'glow' }));
    }
    return { object: k.build(parts, { name: 'kpad' }), floors: [{ x: 0, z: 0, r: R, y: 0.3 }] };
  },

  // a weather mast at the city's edge: a lattice, a dish, a beacon
  kmast(k) {
    const parts = [];
    for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) parts.push(rod([x * 1.6, 0, z * 1.6], [x * 0.3, 26, z * 0.3], 0.18, 0.12, { color: '#9aa4ae', to: 'metal' }));
    for (let y = 4; y < 26; y += 4) parts.push(part(box(3.6 - y * 0.1, 0.3, 3.6 - y * 0.1), { at: [0, y, 0], color: '#8a949e', to: 'metal' }));
    parts.push(part(new THREE.SphereGeometry(2.6, 16, 8, 0, PI * 2, 0, PI * 0.35), { at: [0, 20, 1.6], rot: [-1.2, 0, 0], color: '#dfe4e8', to: 'paint' }));
    parts.push(part(new THREE.SphereGeometry(0.6, 10, 8), { at: [0, 26.6, 0], color: lit('#ff3a2a', 3.5), to: 'glow' }));
    return { object: k.build(parts, { name: 'kmast' }), solids: [{ circle: [0, 0, 2.4] }] };
  },

  // a static discharge tower (Wookieepedia: Tipoca City has "several static
  // discharge towers to secure the city during electrical storms"): a
  // slender white mast in rings, a collector ball at its tip, a red beacon;
  // now and then the storm's lightning comes down onto it (storm.js says
  // when, and the bolt's path)
  kdischarge(k, { h = 16, seed = 1, every = 11 } = {}) {
    const parts = [
      part(cyl(1.6, 1.9, 1.2, 16), { color: '#c8ced4', to: 'paint' }),
      part(cyl(0.55, 0.9, h - 1.2, 14), { at: [0, 1.2, 0], color: '#e4e8ec', to: 'paint' }),
      part(new THREE.SphereGeometry(1.1, 16, 12), { at: [0, h + 0.6, 0], color: '#9aa4ae', to: 'metal' }),
      part(cyl(0.12, 0.05, 2.4, 6), { at: [0, h + 1.6, 0], color: '#5a6066', to: 'metal' }),
      part(new THREE.SphereGeometry(0.3, 8, 6), { at: [0, h - 1.4, 0.75], color: lit('#ff3a2a', 3.5), to: 'glow' }),
    ];
    for (let y = 3; y < h - 1; y += Math.max(3, h / 6)) parts.push(part(ring(0.95 - (y / h) * 0.3, 0.12, 16), { at: [0, y, 0], color: '#9aa4ae', to: 'metal' }));
    const object = k.build(parts, { name: 'kdischarge' });
    // the bolt, from the cloud to the tip, and the flare round the ball
    const tip = [0, h + 3.8, 0];
    const path = boltPath([0, h + 150, 0], tip, seed);
    const boltParts = [];
    for (let i = 1; i < path.length; i++) boltParts.push(rod(path[i - 1], path[i], 0.35, 0.35, { color: lit('#d8e8ff', 4), to: 'glow' }, 5));
    boltParts.push(part(new THREE.SphereGeometry(2.4, 12, 8), { at: [0, h + 0.8, 0], color: lit('#cfe0ff', 3), to: 'glow' }));
    const bolt = k.build(boltParts, { name: 'kdischarge-bolt', shadows: false });
    bolt.visible = false;
    object.add(bolt);
    return {
      object,
      solids: [{ circle: [0, 0, 1.9] }],
      update(t) {
        const v = strikeAt(t, { seed, every });
        bolt.visible = v > 0.3;
        // (a different way down each time)
        if (bolt.visible) bolt.rotation.y = Math.floor(t / every) * 2.39;
      },
    };
  },

  // Slave I, Jango Fett's Firespray, standing on its tail as it lands:
  // the broad green-grey hull, the cockpit up top, the wings at its foot
  slave1(k) {
    const HULL = '#6f7b62';
    const RED = '#8c3a2a';
    const parts = [
      part(upright([[0.2, 0], [5, 0.6], [7, 3], [7.4, 7], [6.4, 12], [4.4, 17], [2.4, 20], [0.3, 21.5]], 28), { at: [0, 0.8, 0], scale: [1, 1, 0.5], color: HULL, to: 'paint' }),
      part(ring(7.3, 0.35, 28), { at: [0, 8, 0], scale: [1, 1, 0.5], color: RED, to: 'paint' }),
      part(new THREE.SphereGeometry(1.6, 14, 10), { at: [0, 17.6, 2.3], scale: [1.2, 1, 0.6], color: '#1a2026', to: 'glass' }),
      part(ring(1.9, 0.18, 16).rotateX(PI / 2), { at: [0, 17.6, 2.5], scale: [1.2, 1, 1], color: RED, to: 'paint' }),
      part(cyl(4.4, 4.8, 1.2, 24), { at: [0, 0, 0], scale: [1, 1, 0.55], color: '#4a5244', to: 'metal' }),
    ];
    for (const s of [-1, 1]) {
      parts.push(part(box(1.2, 10, 5), { at: [s * 8.6, 0.4, 0], rot: [0, 0, s * -0.22], color: HULL, to: 'paint' }));
      parts.push(part(box(1.3, 2, 5.2), { at: [s * 9.6, 7.6, 0], rot: [0, 0, s * -0.22], color: RED, to: 'paint' }));
      parts.push(part(new THREE.CylinderGeometry(0.22, 0.22, 2.6, 8), { at: [s * 2.2, 15, 3.4], rot: [PI / 2 - 0.3, 0, 0], color: '#2a2e2a', to: 'metal' }));
    }
    for (let i = 0; i < 3; i++) parts.push(part(cyl(1.0, 1.0, 0.3, 14), { at: [-2.5 + i * 2.5, 1.2, -3.5], rot: [PI / 2, 0, 0], color: lit('#ff9a5a', 1.4), to: 'glow' }));
    return { object: k.build(parts, { name: 'slave1' }), solids: [{ box: [0, 0, 9, 3.6, 0] }] };
  },

  // Jango Fett: silver-blue Mandalorian armour, the T-visored helmet, the
  // jetpack, a blaster on each hip
  jango(k) {
    const ARMOR = '#9aa4ae';
    const BLUE = '#4a5e7a';
    const parts = [
      part(new THREE.CapsuleGeometry(0.07, 0.62, 4, 8), { at: [-0.1, 0.42, 0], color: BLUE, to: 'cloth' }),
      part(new THREE.CapsuleGeometry(0.07, 0.62, 4, 8), { at: [0.1, 0.42, 0], color: BLUE, to: 'cloth' }),
      part(new THREE.CapsuleGeometry(0.18, 0.36, 4, 10), { at: [0, 1.2, 0], scale: [1.05, 1, 0.7], color: BLUE, to: 'cloth' }),
      part(box(0.36, 0.3, 0.12), { at: [0, 1.22, 0.1], color: ARMOR, to: 'metal' }),
      part(new THREE.SphereGeometry(0.135, 14, 12), { at: [0, 1.6, 0], scale: [1, 1.1, 1.05], color: ARMOR, to: 'metal' }),
      part(box(0.16, 0.035, 0.05), { at: [0, 1.62, 0.13], color: '#0a0c10', to: 'dark' }),
      part(box(0.035, 0.11, 0.05), { at: [0, 1.56, 0.135], color: '#0a0c10', to: 'dark' }),
      part(box(0.28, 0.42, 0.16), { at: [0, 1.0, -0.2], color: ARMOR, to: 'metal' }),
      part(new THREE.ConeGeometry(0.06, 0.4, 8), { at: [0, 1.62, -0.22], color: ARMOR, to: 'metal' }),
    ];
    for (const s of [-1, 1]) {
      parts.push(rod([s * 0.24, 1.4, 0], [s * 0.28, 0.95, 0.05], 0.055, 0.05, { color: BLUE, to: 'cloth' }));
      parts.push(part(box(0.06, 0.16, 0.2), { at: [s * 0.2, 0.72, 0.05], color: '#3a2a20', to: 'cloth' }));
    }
    const body = k.build(parts, { name: 'jango' });
    const object = new THREE.Group();
    object.add(body);
    return {
      object,
      update(t, dt, move = 0) {
        body.rotation.z = sin(t * 7) * 0.025 * move;
      },
    };
  },

  // an aiwha: Kamino's winged whale, gliding over the waves, its great
  // wings beating slowly
  aiwha(k) {
    const SKIN = '#6c7c8c';
    const BELLY = '#c8d0d6';
    const body = k.build(
      [
        part(new THREE.CapsuleGeometry(1.6, 7, 6, 14).rotateX(PI / 2), { at: [0, 0, 0], scale: [1, 0.8, 1], color: SKIN, to: 'leaf' }),
        part(new THREE.CapsuleGeometry(1.3, 6, 6, 12).rotateX(PI / 2), { at: [0, -0.5, 0.4], scale: [1, 0.6, 1], color: BELLY, to: 'leaf' }),
        part(new THREE.SphereGeometry(1, 12, 8), { at: [0, -0.1, -6.4], scale: [2.6, 0.25, 1.2], color: SKIN, to: 'leaf' }),
      ],
      { name: 'aiwha' },
    );
    const wings = [];
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(s * 1.2, 0.3, 0.8);
      g.add(k.build([part(new THREE.SphereGeometry(1, 14, 8), { at: [s * 5, 0, -0.6], scale: [5.4, 0.16, 2.2], rot: [0, s * 0.2, 0], color: SKIN, to: 'leaf' })], { name: 'aiwha-wing' }));
      body.add(g);
      wings.push([g, s]);
    }
    const object = new THREE.Group();
    object.add(body);
    return {
      object,
      update(t) {
        for (const [g, s] of wings) g.rotation.z = s * sin(t * 1.3) * 0.45;
        body.position.y = -sin(t * 1.3) * 0.4;
      },
    };
  },
};

// Things scattered by the dozen (drawn instanced)
export const SCATTER = {
  // a storm buoy off Tipoca City: a float, a mast, its light
  buoy(k) {
    const list = [part(cyl(0.9, 0.6, 1.6, 10), { at: [0, -0.8, 0], color: '#d8dde2', to: 'paint' }), part(cyl(0.12, 0.08, 3, 6), { at: [0, 0.8, 0], color: '#8a949e', to: 'paint' })];
    const glow = [part(new THREE.SphereGeometry(0.3, 8, 6), { at: [0, 3.9, 0], color: lit('#ff4a3a', 3), to: 'glow' })];
    return { parts: [{ geometry: k.geometry(list), material: k.mats.paint }, { geometry: k.geometry(glow), material: k.mats.glow, shadow: false }], radius: null };
  },
};
