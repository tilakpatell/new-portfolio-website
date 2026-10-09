// Geonosis's props, built in code (props/index.js has what a builder
// returns): the arena, its hive spires, the foundry, the gunships, the
// walkers and the acklay, the command post, and the ring across its sky;
// the spires scattered across its plains. Each is what the world places
// when there's no model of it (yet, catalog/core.js), and what there's no
// model of at all. (props/core/index.js has the other core worlds'.)
//
//   PROPS     arena, pillars, acklay, atte, laat, hive, foundry,
//             solarsailer, geohangar, coresphere, commandpost, holotable,
//             skyring: (kit, opts) → { object, solids?, floors?, update? }
//   SCATTER   spire: (kit, opts) → { parts, radius }

import * as THREE from 'three';
import { box, cyl, part, ring, rod } from '../../kit';
import { rng } from '../../noise';
import { canvasTexture, lit, loft, lump, rail, trap8, vary } from './shared';

const { PI, cos, sin, abs } = Math;

export const PROPS = {
  // the Petranaki arena, 150 m: a great oval of red stone, its tiers of
  // seats round a sandy floor, spires along its rim, the gate at +z
  arena(k) {
    const R = 60;
    const SX = 1.0;
    const ROCK = '#b07650';
    const gap = 0.22;
    const lathe = (pts, color, to = 'stone') => part(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 64, gap, PI * 2 - gap * 2), { scale: [SX, 1, 1], color, to });
    const parts = [
      lathe([[R + 2, 0], [R + 1, 26], [R - 1, 30], [R - 4, 30.5]], ROCK),
      lathe([[R - 4, 30.5], [R - 6, 27], [R - 22, 6], [R - 24, 5.4], [R - 24, 0]], '#9a6444'),
      part(new THREE.CircleGeometry(R - 24, 48).rotateX(-PI / 2), { at: [0, 0.06, 0], scale: [SX, 1, 1], color: '#d8b080', to: 'adobe' }),
    ];
    // the terraces' rings of seats
    for (let i = 1; i < 6; i++) {
      const rr = R - 22 + i * 3.1;
      parts.push(part(new THREE.TorusGeometry(rr, 0.35, 4, 64, PI * 2 - gap * 2).rotateX(PI / 2).rotateY(PI / 2 - gap), { at: [0, 6 + i * 3.6, 0], scale: [SX, 1, 1], color: '#7a4a32', to: 'stone' }));
    }
    // the spires and buttresses round the rim
    for (let i = 0; i < 30; i++) {
      const a = gap + 0.1 + (i / 29) * (PI * 2 - gap * 2 - 0.2);
      const [x, z] = [sin(a) * (R + 1.5) * SX, cos(a) * (R + 1.5)];
      parts.push(part(new THREE.ConeGeometry(1.8, 14 + (i % 3) * 5, 7).translate(0, 7 + (i % 3) * 2.5, 0), { at: [x, 28, z], color: '#a06a46', to: 'stone' }));
      parts.push(part(box(3, 26, 3), { at: [x, 0, z], rot: [0, a, 0], color: '#8e5a3c', to: 'stone' }));
    }
    // the gate's towers and its arch
    for (const s of [-1, 1]) parts.push(part(cyl(5, 3.5, 40, 10), { at: [s * 15, 0, R + 1], color: '#9a6444', to: 'stone' }), part(new THREE.ConeGeometry(3.6, 12, 10).translate(0, 6, 0), { at: [s * 15, 40, R + 1], color: '#a06a46', to: 'stone' }));
    parts.push(part(new THREE.TorusGeometry(11, 2.4, 8, 16, PI), { at: [0, 18, R + 1], color: '#8e5a3c', to: 'stone' }));
    // the royal box over the floor, opposite the gate
    parts.push(part(box(16, 4, 6), { at: [0, 14, -(R - 18)], color: '#7a4a32', to: 'stone' }), part(box(14, 0.6, 5), { at: [0, 18, -(R - 18)], color: '#c8a070', to: 'cloth' }));
    // walls you can't go through, fitted to the model (+/-75 x +/-73): the
    // floor's edge at r 22 (where it ends on its -x side) and the outer wall
    // at r 74, but for the gate
    const IN = 22;
    const OUT = 74;
    const solids = [];
    const oval = (rr, step = 1.5) => {
      const n = Math.ceil((2 * PI * rr * 1.13) / step);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * PI * 2;
        if (abs(Math.atan2(sin(a), cos(a))) < gap + 0.04) continue;
        solids.push({ circle: [sin(a) * rr * SX, cos(a) * rr, 0.85] });
      }
    };
    oval(IN);
    oval(OUT);
    for (const s of [-1, 1]) solids.push({ circle: [s * (OUT * sin(gap) + 4), OUT + 1, 5] }, ...rail([s * IN * sin(gap) * SX, IN * cos(gap)], [s * OUT * sin(gap) * SX, OUT * cos(gap)], 1.2));
    return { object: k.build(parts, { name: 'arena' }), solids };
  },

  // the execution posts in the arena: slim tapered stone, a knob on top,
  // chains hanging from under it on the three in the middle
  pillars(k) {
    const parts = [];
    const xs = [-14, -7, 0, 7, 14];
    for (const x of xs) {
      parts.push(part(cyl(0.85, 0.55, 7.5, 10), { at: [x, 0, 0], color: '#a87250', to: 'stone' }));
      parts.push(part(new THREE.SphereGeometry(0.9, 12, 8), { at: [x, 7.5, 0], scale: [1, 0.7, 1], color: '#a87250', to: 'stone' }));
      if (abs(x) > 7) continue;
      for (const s of [-1, 1]) parts.push(rod([x + s * 0.5, 7.1, 0.5], [x + s * 0.7, 5, 0.65], 0.05, 0.05, { color: '#3a3430', to: 'metal' }), part(ring(0.18, 0.05, 8), { at: [x + s * 0.7, 4.9, 0.65], color: '#3a3430', to: 'metal' }));
    }
    return { object: k.build(parts, { name: 'pillars' }), solids: xs.map((x) => ({ circle: [x, 0, 0.9] })) };
  },

  // the acklay: a crab-mantis of a beast, its two scythe arms up, its
  // long neck and head; it scuttles on six legs
  acklay(k) {
    const SKIN = '#6c7a58';
    const BELLY = '#b4b48a';
    const body = new THREE.Group();
    body.add(
      k.build(
        [
          part(new THREE.SphereGeometry(1, 16, 12), { at: [0, 3.2, -0.4], scale: [1.3, 1.2, 2.0], color: SKIN, to: 'leaf' }),
          part(new THREE.SphereGeometry(1, 12, 10), { at: [0, 2.8, -0.2], scale: [1.0, 0.9, 1.6], color: BELLY, to: 'leaf' }),
          part(new THREE.CapsuleGeometry(0.4, 2.2, 4, 10), { at: [0, 4.6, 1.8], rot: [0.8, 0, 0], color: SKIN, to: 'leaf' }),
          part(new THREE.SphereGeometry(0.7, 12, 10), { at: [0, 5.6, 2.9], scale: [1, 0.8, 1.4], color: SKIN, to: 'leaf' }),
          part(new THREE.ConeGeometry(0.35, 0.9, 8), { at: [0, 5.3, 3.8], rot: [PI / 2 + 0.3, 0, 0], color: BELLY, to: 'leaf' }),
          part(new THREE.SphereGeometry(0.12, 6, 4), { at: [-0.4, 5.85, 3.3], color: lit('#ffdc4a', 2), to: 'glow' }),
          part(new THREE.SphereGeometry(0.12, 6, 4), { at: [0.4, 5.85, 3.3], color: lit('#ffdc4a', 2), to: 'glow' }),
        ],
        { name: 'acklay' },
      ),
    );
    const legs = [];
    for (const s of [-1, 1]) {
      // the scythes
      const arm = new THREE.Group();
      arm.position.set(s * 1.1, 3.8, 1.4);
      arm.add(k.build([rod([0, 0, 0], [s * 0.8, 2.6, 1.6], 0.22, 0.16, { color: SKIN, to: 'leaf' }), rod([s * 0.8, 2.6, 1.6], [s * 1.0, 0.6, 3.6], 0.16, 0.04, { color: BELLY, to: 'leaf' })], { name: 'acklay-arm' }));
      body.add(arm);
      legs.push({ g: arm, ph: s > 0 ? 0 : PI, arm: true });
      for (const [z, ph] of [[0.6, 0.5], [-1.0, 2.6], [-2.4, 4.2]]) {
        const leg = new THREE.Group();
        leg.position.set(s * 1.1, 3.2, z);
        leg.add(k.build([rod([0, 0, 0], [s * 2.4, 1.2, z * 0.3], 0.18, 0.14, { color: SKIN, to: 'leaf' }), rod([s * 2.4, 1.2, z * 0.3], [s * 3.2, -3.2, z * 0.5], 0.14, 0.05, { color: SKIN, to: 'leaf' })], { name: 'acklay-leg' }));
        body.add(leg);
        legs.push({ g: leg, ph: ph + (s > 0 ? PI : 0) });
      }
    }
    const object = new THREE.Group();
    object.add(body);
    let cyc = 0;
    return {
      object,
      update(t, dt, move = 0) {
        cyc += (dt ?? 0) * (1 + move * 6);
        for (const l of legs) l.g.rotation.x = l.arm ? -0.2 + sin(t * 1.4 + l.ph) * 0.25 : sin(cyc + l.ph) * 0.25 * move;
        body.position.y = abs(sin(cyc)) * 0.12 * move;
      },
    };
  },

  // an AT-TE: the Republic's six-legged walker, its two hull segments,
  // the mass-driver cannon on top; 22 m long; its legs walk as it goes
  atte(k) {
    const W = '#d6d2c4';
    const G = '#7c7c74';
    const RED = '#9a3a2a';
    const object = new THREE.Group();
    const body = new THREE.Group();
    body.position.y = 7.2;
    object.add(body);
    const seg = (z0, z1, wb, wt, h) =>
      loft([
        { z: z0, pts: trap8(wb * 0.9, wt * 0.9, h * 0.9, 0.5, 0) },
        { z: z0 + 0.8, pts: trap8(wb, wt, h, 0.6, 0) },
        { z: z1 - 0.8, pts: trap8(wb, wt, h, 0.6, 0) },
        { z: z1, pts: trap8(wb * 0.85, wt * 0.8, h * 0.85, 0.5, 0) },
      ]);
    const parts = [part(seg(0.8, 11, 6.4, 5.2, 4.6), { color: W, to: 'paint' }), part(seg(-11, -0.8, 6.0, 5.0, 4.2), { color: W, to: 'paint' }), part(new THREE.CylinderGeometry(1.4, 1.4, 2.4, 12), { rot: [PI / 2, 0, 0], color: G, to: 'metal' })];
    // the cockpit windows, the red markings, the cannon
    parts.push(part(box(3.6, 0.7, 0.3), { at: [0, 0.6, 11.0], color: '#1a1e22', to: 'dark' }));
    for (const s of [-1, 1]) parts.push(part(box(0.2, 1.2, 4), { at: [s * 3.25, 0.4, 7], color: RED, to: 'paint' }));
    parts.push(part(cyl(1.8, 1.6, 1.4, 14), { at: [0, 2.2, 4], color: G, to: 'metal' }));
    parts.push(part(box(2.2, 1.6, 4.4), { at: [0, 3.4, 4.6], color: W, to: 'paint' }));
    parts.push(part(new THREE.CylinderGeometry(0.32, 0.38, 9, 10), { at: [0, 4.9, 9.5], rot: [PI / 2 - 0.2, 0, 0], color: G, to: 'metal' }));
    for (const s of [-1, 1]) parts.push(part(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 8), { at: [s * 1.6, -1.2, 11.6], rot: [PI / 2, 0, 0], color: G, to: 'metal' }));
    body.add(k.build(parts, { name: 'atte-body' }));
    const legs = [];
    for (const [z, ph] of [[7.5, 0], [0, 0.5], [-7.5, 0]]) {
      for (const s of [-1, 1]) {
        const hip = new THREE.Group();
        hip.position.set(s * 3.3, 6.4, z);
        hip.add(k.build([part(new THREE.SphereGeometry(0.9, 10, 8), { color: G, to: 'metal' }), rod([0, 0, 0], [s * 2.2, 2.2, 0], 0.5, 0.45, { color: W, to: 'paint' })], { name: 'atte-thigh' }));
        const knee = new THREE.Group();
        knee.position.set(s * 2.2, 2.2, 0);
        knee.add(k.build([part(new THREE.SphereGeometry(0.6, 10, 8), { color: G, to: 'metal' }), rod([0, 0, 0], [s * 0.8, -8.4, 0], 0.42, 0.36, { color: W, to: 'paint' }), part(cyl(1.2, 1.3, 0.5, 12), { at: [s * 0.8, -8.6, 0], color: G, to: 'metal' })], { name: 'atte-shin' }));
        hip.add(knee);
        object.add(hip);
        legs.push({ hip, knee, ph: (ph + (s > 0 ? 0.5 : 0) + (z > 0 ? 0 : z < 0 ? 0 : 0.5)) % 1 });
      }
    }
    let cyc = 0;
    return {
      object,
      solids: [{ box: [0, 0, 5.5, 11.5, 0] }],
      update(t, dt, move = 0) {
        cyc += (dt ?? 0) * 0.45 * move;
        for (const l of legs) {
          const a = (cyc + l.ph) * PI * 2;
          l.hip.rotation.x = sin(a) * 0.22 * move;
          l.knee.rotation.x = -Math.max(0, sin(a + 1)) * 0.25 * move;
        }
        body.position.y = 7.2 + abs(sin(cyc * PI * 2)) * 0.18 * move;
      },
    };
  },

  // a LAAT/i gunship: the troop bay, the bulbous cockpits, the wings swept
  // down with their ball turrets, red nose art; 17.4 m; hovering
  laat(k, { doors = true } = {}) {
    const W = '#cfcbb8';
    const G = '#7e8070';
    const RED = '#a23a2a';
    const H = 2.2;
    const hull = loft([
      { z: -8.7, pts: trap8(1.6, 1.2, 1.8, 0.3, H + 2.6) },
      { z: -5, pts: trap8(3.6, 2.6, 3.4, 0.5, H + 2.2) },
      { z: 3, pts: trap8(4.0, 3.0, 3.8, 0.6, H + 2.0) },
      { z: 5.6, pts: trap8(3.2, 2.4, 3.0, 0.5, H + 1.8) },
    ]);
    const parts = [part(hull, { color: W, to: 'paint' })];
    parts.push(part(new THREE.SphereGeometry(1, 16, 12), { at: [0, H + 1.9, 6.1], scale: [1.6, 1.4, 2.4], color: W, to: 'paint' }));
    for (const [x, y, z] of [[-0.7, H + 2.6, 7.6], [0.7, H + 2.6, 7.6], [0, H + 1.4, 8.1]]) parts.push(part(new THREE.SphereGeometry(0.55, 12, 8), { at: [x, y, z], scale: [1, 0.8, 1.2], color: '#20303a', to: 'glass' }));
    parts.push(part(box(3.3, 0.5, 1.6), { at: [0, H + 1.2, 6.6], color: RED, to: 'paint' }));
    if (doors) for (const s of [-1, 1]) parts.push(part(box(0.1, 2.4, 4.6), { at: [s * 2.02, H + 0.9, 0.4], color: '#2a2a28', to: 'dark' }));
    // the wings, the turrets, the tail
    for (const s of [-1, 1]) {
      parts.push(part(box(7.6, 0.4, 3.4), { at: [s * 5.2, H + 4.0, -2.5], rot: [0, s * -0.12, s * -0.2], color: W, to: 'paint' }));
      parts.push(part(box(0.5, 1.6, 3.6), { at: [s * 8.9, H + 2.6, -3.1], color: G, to: 'metal' }));
      parts.push(part(new THREE.SphereGeometry(0.75, 12, 10), { at: [s * 2.4, H + 4.2, 0.8], color: '#2a3238', to: 'glass' }));
      parts.push(part(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), { at: [s * 6.8, H + 3.6, -0.6], rot: [PI / 2, 0, 0], color: G, to: 'metal' }));
      parts.push(part(box(0.3, 2.6, 2.2), { at: [s * 1.1, H + 4.2, -7.6], rot: [0, 0, s * 0.3], color: W, to: 'paint' }));
      parts.push(part(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 10), { at: [s * 0.9, H + 2.8, -8.75], rot: [PI / 2, 0, 0], color: lit('#7ad0ff', 2.5), to: 'glow' }));
    }
    const object = k.build(parts, { name: 'laat' });
    const holder = new THREE.Group();
    holder.add(object);
    return {
      object: holder,
      solids: [{ box: [0, 0, 2.2, 8.4, 0] }],
      update(t) {
        object.position.y = sin(t * 1.1) * 0.25;
        object.rotation.z = sin(t * 0.7) * 0.02;
      },
    };
  },

  // a hive spire: the Geonosians' termite-mound towers of red rock, `h`
  // tall, lumpy, holed, glowing in its openings now and then
  hive(k, { h = 60, seed = 1, lights = true } = {}) {
    const r = rng(seed);
    const parts = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const rr = h * 0.16 * (1 - t * 0.8);
      parts.push(part(lump(seed * 13 + i, 0.18), { at: [(r() - 0.5) * rr * 0.3, h * t + rr * 0.4, (r() - 0.5) * rr * 0.3], scale: [rr * 2.2, (h / n) * 1.9, rr * 2.2], color: vary('#a8663e', r, 0.08), to: 'redrock' }));
    }
    parts.push(part(new THREE.ConeGeometry(h * 0.04, h * 0.2, 7), { at: [0, h * 1.0, 0], color: '#9a5a36', to: 'redrock' }));
    if (lights)
      for (let i = 0; i < 6; i++) {
        const t = 0.15 + r() * 0.7;
        const a = r() * PI * 2;
        const rr = h * 0.16 * (1 - t * 0.8) * 1.02;
        parts.push(part(new THREE.SphereGeometry(rr * 0.18, 8, 6), { at: [sin(a) * rr, h * t, cos(a) * rr], scale: [1, 1.5, 0.5], rot: [0, a, 0], color: r() < 0.5 ? lit('#ffb05a', 2) : '#2a1a14', to: r() < 0.5 ? 'glow' : 'dark' }));
      }
    return { object: k.build(parts, { name: 'hive' }), solids: [{ circle: [0, 0, h * 0.2] }] };
  },

  // the droid foundry: a mound of hive rock with furnaces glowing in its
  // mouths, gantries out of it, and droid parts by the crate
  foundry(k) {
    const r = rng(29);
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      const d = i ? 14 : 0;
      const s = i ? 18 + r() * 8 : 30;
      parts.push(part(lump(70 + i, 0.2), { at: [sin(a) * d, s * 0.35, cos(a) * d - 8], scale: [s * 1.3, s * 1.2, s * 1.1], color: vary('#9a5a36', r, 0.08), to: 'redrock' }));
    }
    for (const [x, h] of [[-8, 52], [6, 44]]) {
      parts.push(part(cyl(2.8, 2.2, h, 12), { at: [x, 0, -16], color: '#5a3a2a', to: 'metal' }));
      parts.push(part(cyl(2.25, 2.25, 0.8, 12), { at: [x, h, -16], color: lit('#ff7a2a', 2.4), to: 'glow' }));
    }
    // the furnace mouths
    for (const [x, y, w] of [[-9, 0, 10], [10, 0, 8], [0, 12, 7]]) {
      parts.push(part(new THREE.SphereGeometry(w * 0.5, 12, 8), { at: [x, y + w * 0.35, 15 - y * 0.5], scale: [1, 0.9, 0.6], color: lit('#ff8a2a', 2.8), to: 'glow' }));
      parts.push(part(new THREE.TorusGeometry(w * 0.52, w * 0.12, 6, 14, PI), { at: [x, y + w * 0.35, 15.6 - y * 0.5], color: '#5a3422', to: 'redrock' }));
    }
    // the gantries and the conveyor out of it, and its crates of parts
    for (const s of [-1, 1]) {
      parts.push(part(box(3, 1, 30), { at: [s * 16, 8, 14], rot: [0.12, s * 0.3, 0], color: '#5a4a3e', to: 'metal' }));
      for (let i = 0; i < 4; i++) parts.push(part(box(0.6, 8, 0.6), { at: [s * (16 + i * 2.2), 0, 4 + i * 7], color: '#4a3a30', to: 'metal' }));
    }
    for (let i = 0; i < 8; i++) parts.push(part(box(1.4, 1.4, 1.4), { at: [-12 + (i % 4) * 3, Math.floor(i / 4) * 1.4, 22 + (i % 2) * 2], rot: [0, r(), 0], color: '#a89870', to: 'paint' }));
    return { object: k.build(parts, { name: 'foundry' }), solids: [{ circle: [0, -8, 30] }, { circle: [14, 0, 14] }, { circle: [-14, 0, 14] }, { box: [-7.5, 23, 6.5, 2.5, 0] }] };
  },

  // Count Dooku's solar sailer: a bronze pod under its great lattice sail
  solarsailer(k) {
    const BRONZE = '#9a7448';
    const parts = [
      part(new THREE.SphereGeometry(3.2, 20, 14), { at: [0, 4, 0], scale: [1, 0.8, 1.5], color: BRONZE, to: 'metal' }),
      part(new THREE.SphereGeometry(1.2, 12, 8), { at: [0, 4.6, 4.4], scale: [1, 0.7, 1], color: '#2a2018', to: 'glass' }),
      part(cyl(0.3, 0.2, 9, 8), { at: [0, 6, -2], color: BRONZE, to: 'metal' }),
    ];
    for (const [x, z] of [[-2, 2], [2, 2], [0, -3]]) parts.push(rod([x, 0, z], [x * 0.6, 2.4, z * 0.6], 0.15, 0.15, { color: '#5a4430', to: 'metal' }));
    const object = k.build(parts, { name: 'solarsailer' });
    const tex = k.own(
      canvasTexture(128, (c, sz) => {
        c.clearRect(0, 0, sz, sz);
        c.fillStyle = 'rgba(60,40,24,0.55)';
        c.fillRect(0, 0, sz, sz);
        c.strokeStyle = 'rgba(200,150,90,0.9)';
        c.lineWidth = 2;
        for (let i = 0; i <= sz; i += 16) {
          c.beginPath();
          c.moveTo(i, 0);
          c.lineTo(i, sz);
          c.moveTo(0, i);
          c.lineTo(sz, i);
          c.stroke();
        }
      }),
    );
    tex.repeat.set(4, 2);
    const sail = new THREE.Mesh(k.own(new THREE.SphereGeometry(11, 24, 10, 0, PI * 2, 0, PI * 0.42)), k.own(new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.6, metalness: 0.3 })));
    sail.scale.set(1, 0.7, 1.2);
    sail.position.set(0, 3, -4);
    sail.rotation.x = -0.35;
    object.add(sail);
    return { object, solids: [{ circle: [0, 0, 3.6] }] };
  },

  // Dooku's secret hangar: a spire of rock with a dark mouth at its foot
  // (the mesa it's cut into is the hive model behind it: sites/core.js)
  geohangar(k) {
    const parts = [];
    parts.push(part(new THREE.CylinderGeometry(9, 9, 2, 20, 1, false, 0, PI).rotateZ(PI / 2).rotateY(PI / 2), { at: [0, 0, -4], scale: [1, 1.1, 1], color: '#140c08', to: 'dark' }));
    parts.push(part(box(18, 10, 2), { at: [0, 0, -5], color: '#140c08', to: 'dark' }));
    parts.push(part(cyl(16, 16, 0.4, 28), { at: [0, 0, 12], color: '#7a5a42', to: 'metal' }));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI * 2;
      parts.push(part(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 6), { at: [sin(a) * 15.4, 0.45, 12 + cos(a) * 15.4], color: lit('#ffb05a', 3), to: 'glow' }));
    }
    return { object: k.build(parts, { name: 'geohangar' }), solids: [{ circle: [-10, -16, 11] }, { circle: [10, -16, 11] }, { circle: [0, -24, 12] }] };
  },

  // a Separatist core ship, set down on the plain: a sphere 220 m across
  // on its landing legs; lifts off now and then
  coresphere(k, { rise = 0 } = {}) {
    const R = 110;
    const parts = [
      part(new THREE.SphereGeometry(R, 40, 28), { at: [0, R + 22, 0], color: '#8a8272', to: 'paint' }),
      part(new THREE.CylinderGeometry(R * 1.01, R * 1.01, 8, 40), { at: [0, R + 22, 0], color: '#5e584e', to: 'metal' }),
      part(new THREE.CylinderGeometry(R * 1.015, R * 1.015, 1.5, 40), { at: [0, R + 30, 0], color: lit('#ffd9a0', 1.3), to: 'glow' }),
      part(new THREE.SphereGeometry(R * 0.3, 20, 12), { at: [0, 26, 0], scale: [1, 0.3, 1], color: lit('#ff9a5a', rise ? 2.4 : 0.6), to: 'glow' }),
    ];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      parts.push(rod([sin(a) * R * 0.6, R * 0.5, cos(a) * R * 0.6], [sin(a) * R * 0.95, 0, cos(a) * R * 0.95], 3, 2.2, { color: '#5e584e', to: 'metal' }));
      parts.push(part(cyl(8, 9, 2, 12), { at: [sin(a) * R * 0.95, 0, cos(a) * R * 0.95], color: '#4a453e', to: 'metal' }));
    }
    const object = k.build(parts, { name: 'coresphere', shadows: false });
    const holder = new THREE.Group();
    holder.add(object);
    return {
      object: holder,
      update(t) {
        if (rise) object.position.y = (t * rise) % 900;
      },
    };
  },

  // the Republic's forward command post: a low bunker, the holotable with
  // the battle over it in blue light, antennae, crates
  commandpost(k) {
    const parts = [
      part(box(14, 3, 9), { at: [0, 0, -6], color: '#c8c4b4', to: 'paint' }),
      part(box(15, 0.6, 10), { at: [0, 3, -6], color: '#8a8a7c', to: 'metal' }),
      part(cyl(1.8, 2.0, 1.1, 18), { at: [0, 0, 3], color: '#5a5c58', to: 'metal' }),
      part(cyl(1.7, 1.7, 0.06, 18), { at: [0, 1.12, 3], color: lit('#6ac8ff', 2), to: 'glow' }),
      rod([5, 3.6, -8], [5, 12, -8], 0.08, 0.05, { color: '#5a5c58', to: 'metal' }),
      part(new THREE.SphereGeometry(1.4, 12, 8, 0, PI * 2, 0, PI * 0.4), { at: [-4, 3.6, -8], rot: [-0.9, 0.6, 0], color: '#d8d8d0', to: 'paint' }),
    ];
    parts.push(part(box(2.2, 1.6, 0.2), { at: [0, 1.4, -1.4], color: '#20303a', to: 'glass' }));
    for (let i = 0; i < 5; i++) parts.push(part(box(1.2, 1.2, 1.2), { at: [-6 + i * 1.4, 0, 4 + (i % 2)], rot: [0, i, 0], color: '#a8a48a', to: 'paint' }));
    const object = k.build(parts, { name: 'commandpost' });
    // the hologram over the table: the battle, in blue light, turning
    const holo = new THREE.Mesh(k.own(new THREE.SphereGeometry(1.4, 14, 8, 0, PI * 2, 0, PI / 2)), k.own(new THREE.MeshBasicMaterial({ color: lit('#6ac8ff', 1.6), wireframe: true, transparent: true, opacity: 0.6, toneMapped: false })));
    holo.position.set(0, 1.4, 3);
    holo.scale.set(1, 0.6, 1);
    object.add(holo);
    return {
      object,
      solids: [{ box: [0, -6, 7, 4.5, 0] }, { circle: [0, 3, 2] }],
      update(t) {
        holo.rotation.y = t * 0.4;
      },
    };
  },

  // the command post's holotable on its own, the battle turning over it in
  // blue light (in front of the audit lane's model of the command post,
  // which has no table)
  holotable(k) {
    const parts = [
      part(cyl(1.8, 2.0, 1.1, 18), { color: '#5a5c58', to: 'metal' }),
      part(cyl(1.7, 1.7, 0.06, 18), { at: [0, 1.12, 0], color: lit('#6ac8ff', 2), to: 'glow' }),
    ];
    const object = k.build(parts, { name: 'holotable' });
    const holo = new THREE.Mesh(k.own(new THREE.SphereGeometry(1.4, 14, 8, 0, PI * 2, 0, PI / 2)), k.own(new THREE.MeshBasicMaterial({ color: lit('#6ac8ff', 1.6), wireframe: true, transparent: true, opacity: 0.6, toneMapped: false })));
    holo.position.set(0, 1.4, 0);
    holo.scale.set(1, 0.6, 1);
    object.add(holo);
    return {
      object,
      solids: [{ circle: [0, 0, 2] }],
      update(t) {
        holo.rotation.y = t * 0.4;
      },
    };
  },

  // Geonosis's ring, a pale band across the sky from one horizon to the
  // other (far off, past the fog)
  skyring(k, { az = 0.6, el = 0.62, width = 0.05, dist = 9000 } = {}) {
    const tex = k.own(
      canvasTexture(256, (c, sz) => {
        c.clearRect(0, 0, sz, sz);
        const r = rng(3);
        for (let x = 0; x < sz; x++) {
          const a = 0.25 + 0.5 * r() * r() + (x % 37 < 3 ? -0.2 : 0);
          c.fillStyle = `rgba(255,255,255,${Math.max(0, a)})`;
          c.fillRect(x, 0, 1, sz);
        }
      }),
    );
    const n = 96;
    const pos = [];
    const uv = [];
    const idx = [];
    for (let i = 0; i <= n; i++) {
      const a = az - PI / 2 - 0.15 + (i / n) * (PI + 0.3);
      const e = Math.atan(Math.tan(el) * cos(a - az));
      for (const [j, d] of [[0, -width / 2], [1, width / 2]]) {
        const ee = e + d;
        pos.push(sin(a) * cos(ee) * dist, sin(ee) * dist, cos(a) * cos(ee) * dist);
        uv.push(j, i / 8);
      }
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = k.own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, k.own(new THREE.MeshBasicMaterial({ map: tex, color: '#f2d2b0', transparent: true, opacity: 0.55, depthWrite: false, fog: false, side: THREE.DoubleSide })));
    m.frustumCulled = false;
    m.renderOrder = -5;
    const object = new THREE.Group();
    object.add(m);
    return { object };
  },
};

// Things scattered by the dozen (drawn instanced)
export const SCATTER = {
  // a hive spire, small, by the hundred across Geonosis's plains
  // (Geonosis's red rock, wearing the redrock scan)
  spire(k, { seed = 2, color = '#a8663e' } = {}) {
    const r = rng(seed);
    const list = [];
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      const rr = 4 * (1 - t * 0.78);
      list.push(part(lump(seed * 17 + i, 0.2, 10, 7), { at: [(r() - 0.5) * 1.2, 30 * t + rr * 0.3, (r() - 0.5) * 1.2], scale: [rr * 2, 12, rr * 2], color: vary(color, r, 0.08), to: 'redrock' }));
    }
    list.push(part(new THREE.ConeGeometry(1, 7, 6), { at: [0, 31, 0], color, to: 'redrock' }));
    return { parts: [{ geometry: k.geometry(list), material: k.mats.redrock }], radius: 3.4 };
  },
};
