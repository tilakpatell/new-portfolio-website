// Guns in hand, held and aimed the way a person holds and aims one. Every
// rigged figure on foot (the crews, the Federation's troops, the galaxy's
// Meshy people, the other pilots' crews) stands on Meshy's skeleton with
// the same bone names; the figures built from shapes (Luke) name their
// groups the same. One system poses them all over whatever clip is playing:
//
// - the gun is a child of the right hand, set in it through a grip frame
//   worked out once from the hand's own vertices (which way the palm faces,
//   where the fingers run), so it sits in the palm and points past the
//   knuckles on every model, with a table of fixes for the few that fool it;
// - lowered, the hand is turned to carry it muzzle down along the forearm
//   while the clip swings the arm; brought up (`aim` 0…1), the right arm
//   reaches to put the gun on the line of fire with the elbow bent, the
//   other hand takes the foregrip of a long gun (or cups the gun hand on a
//   pistol), the spine twists toward the target and the head turns to it;
// - a shot kicks the gun back and up on a spring, and the arms and chest
//   follow it.
//
// GUNS: each kind's model (built in code, metres, muzzle toward +z, the grip
// at the origin), how it's held and how it kicks.
// buildGun(kind, owned) → Group, with 'muzzle', 'foregrip' and 'eject' points.
// createGunplay(fig, kind, { unit, who }) → { gun, set(dt, pose), fire() →
//   { muzzle, dir, eject, gun }, aim (0…1 as shown), drop() → the gun to
//   throw (once), dispose() } or null
//   for a figure with no right hand. `fig`: { model, bones? }; `unit`:
//   world units to the metre where the figure stands (METRE on the
//   universe map, 1 on the galaxy's worlds).
// set(dt, { aim, look, dir, forward, up, move }): all directions in world
//   space; `dir` where the shot goes (null: straight ahead), `look` how
//   much the head turns to it (the aim, if not given).

import * as THREE from 'three';
import { frameFrom, palmFrame, reach, rotateWorld, setWorldQuaternion, spring } from '../../lib/three/ik';
import { gripMorphs, ungrip } from './grip';

const V = THREE.Vector3;
const Q = THREE.Quaternion;

// ── The guns ──

const mats = (owned) => {
  const make = (c, extra) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.2, ...extra });
    owned.push(m);
    return m;
  };
  return {
    gunmetal: make('#2a2d33', { metalness: 0.75, roughness: 0.35 }),
    steel: make('#9ea4ad', { metalness: 0.85, roughness: 0.3 }),
    black: make('#141518', { metalness: 0.3, roughness: 0.6 }),
    brown: make('#4a2f1a', { roughness: 0.7, metalness: 0 }),
    wood: make('#6b4a2b', { roughness: 0.65, metalness: 0 }),
    bone: make('#d9d2c2', { roughness: 0.55, metalness: 0.05 }),
    grey: make('#aeb6bf', { metalness: 0.5, roughness: 0.4 }),
    olive: make('#4b5a46', { metalness: 0.4, roughness: 0.55 }),
    navy: make('#1b2538', { metalness: 0.5, roughness: 0.45 }),
    glow: (c, k = 2.5) => make(c, { emissive: new THREE.Color(c), emissiveIntensity: k, roughness: 0.3 }),
    glass: (c) => make(c, { transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0 }),
  };
};
// a small kit: everything in metres, the gun's +z its muzzle, +y its sights
const kit = (g, owned) => {
  const add = (geo, m, [x, y, z] = [0, 0, 0], rot = null) => {
    owned.push(geo);
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    if (rot) o.rotation.set(rot[0] ?? 0, rot[1] ?? 0, rot[2] ?? 0);
    o.castShadow = true;
    g.add(o);
    return o;
  };
  return {
    box: (w, h, d, m, at, rot) => add(new THREE.BoxGeometry(w, h, d), m, at, rot),
    tube: (r, l, m, at, rot, seg = 12) => add(new THREE.CylinderGeometry(r, r, l, seg).rotateX(Math.PI / 2), m, at, rot),
    cone: (r1, r2, l, m, at, rot, seg = 12) => add(new THREE.CylinderGeometry(r2, r1, l, seg).rotateX(Math.PI / 2), m, at, rot), // r1 at the back, r2 at the front
    drum: (r, l, m, at, rot, seg = 12) => add(new THREE.CylinderGeometry(r, r, l, seg), m, at, rot), // along y
    ball: (r, m, at) => add(new THREE.SphereGeometry(r, 12, 8), m, at),
    ring: (r, t, m, at, rot) => add(new THREE.TorusGeometry(r, t, 6, 16), m, at, rot),
    point: (name, [x, y, z]) => {
      const o = new THREE.Object3D();
      o.name = name;
      o.position.set(x, y, z);
      g.add(o);
      return o;
    },
  };
};

// hands: 1 or 2; support: the other hand cups the gun hand (a pistol held
// properly); stock: a long gun, its butt to the shoulder; pitch: the
// barrel's tilt up from the line of the hand (a pistol's grip angle);
// reach, rise, lateral: where the trigger hand goes when aimed, as shares
// of the arm's length along the line of fire, up toward the eye and out to
// the right; kick: the recoil (metres back, radians up) a shot adds; casing:
// it throws brass; smoke: puffs of powder smoke after a shot; flash: the
// muzzle flash's colour and size (metres)
export const GUNS = {
  // Han's (and Luke's) DL-44 heavy blaster: the Mauser's box receiver and
  // broomhandle grip, a long barrel with a flash guard, the scope on top
  blaster: {
    hands: 1,
    support: false,
    stock: false,
    pitch: 0.22,
    reach: 0.93,
    rise: 0.16,
    lateral: 0.0,
    kick: { back: 0.8, up: 2.6 },
    casing: false,
    flash: { color: '#ff6a4a', size: 0.22 },
    build(g, owned) {
      const m = mats(owned);
      const k = kit(g, owned);
      k.box(0.03, 0.048, 0.1, m.gunmetal, [0, 0.05, 0.055]); // the receiver
      k.box(0.034, 0.02, 0.05, m.gunmetal, [0, 0.03, 0.02]); // the magazine well
      k.tube(0.0085, 0.2, m.gunmetal, [0, 0.062, 0.2]); // the barrel
      k.tube(0.012, 0.03, m.gunmetal, [0, 0.062, 0.115]); // its collar
      k.cone(0.011, 0.022, 0.04, m.black, [0, 0.062, 0.3]); // the flash guard
      k.ring(0.016, 0.003, m.steel, [0, 0.062, 0.318], [0, 0, 0]);
      k.tube(0.0105, 0.1, m.black, [0.012, 0.094, 0.06]); // the scope, on the left
      k.box(0.006, 0.018, 0.012, m.black, [0.008, 0.08, 0.03]);
      k.box(0.006, 0.018, 0.012, m.black, [0.008, 0.08, 0.09]);
      k.box(0.024, 0.09, 0.03, m.brown, [0, -0.028, -0.012], [0.3, 0, 0]).name = 'grip'; // the broomhandle grip
      k.box(0.018, 0.016, 0.04, m.steel, [0, 0.016, 0.02]); // the trigger housing
      k.box(0.004, 0.024, 0.016, m.steel, [0, 0.006, 0.03], [0.25, 0, 0]); // the trigger
      k.box(0.004, 0.03, 0.006, m.steel, [0, 0.082, -0.002]); // the hammer
      k.point('muzzle', [0, 0.062, 0.325]);
      k.point('eject', [-0.02, 0.07, 0.04]);
    },
  },
  // Morty's laser pistol: the show's white-and-grey ray gun, a round emitter
  // and a green light down the side
  laser: {
    hands: 1,
    support: true,
    stock: false,
    pitch: 0.24,
    reach: 0.9,
    rise: 0.18,
    lateral: -0.3,
    kick: { back: 0.5, up: 1.6 },
    casing: false,
    flash: { color: '#8dff5a', size: 0.16 },
    build(g, owned) {
      const m = mats(owned);
      const k = kit(g, owned);
      const green = m.glow('#5dff4a', 2.2);
      k.box(0.032, 0.05, 0.13, m.bone, [0, 0.048, 0.05]); // the body
      k.box(0.036, 0.012, 0.09, m.grey, [0, 0.078, 0.04]); // its top rail
      k.tube(0.016, 0.05, m.grey, [0, 0.05, 0.135]); // the emitter housing
      k.ring(0.014, 0.004, green, [0, 0.05, 0.158]); // the lit ring at the muzzle
      k.tube(0.008, 0.02, green, [0, 0.05, 0.15]);
      k.box(0.004, 0.012, 0.08, green, [0.017, 0.05, 0.05]); // the light down each side
      k.box(0.004, 0.012, 0.08, green, [-0.017, 0.05, 0.05]);
      k.box(0.026, 0.08, 0.03, m.grey, [0, -0.02, -0.005], [0.28, 0, 0]).name = 'grip'; // the grip
      k.box(0.016, 0.014, 0.04, m.grey, [0, 0.018, 0.025]); // the trigger housing
      k.box(0.004, 0.02, 0.012, m.black, [0, 0.01, 0.035], [0.3, 0, 0]);
      k.point('muzzle', [0, 0.05, 0.165]);
    },
  },
  // Rick's portal gun: the grey body, the green fluid chamber on top, the
  // three prongs round the bulb at the front
  portal: {
    hands: 1,
    support: false,
    stock: false,
    pitch: 0.12,
    reach: 0.93,
    rise: 0.15,
    lateral: 0.0,
    kick: { back: 0.6, up: 2.0 },
    casing: false,
    flash: { color: '#7dff4a', size: 0.26 },
    build(g, owned) {
      const m = mats(owned);
      const k = kit(g, owned);
      const fluid = m.glow('#3dff32', 2.6);
      k.box(0.062, 0.06, 0.15, m.grey, [0, 0.04, 0.04]); // the body
      k.box(0.05, 0.02, 0.1, m.gunmetal, [0, 0.005, 0.05]); // its underside
      k.drum(0.02, 0.085, m.glass('#9dffb0'), [0, 0.095, 0.03], [Math.PI / 2, 0, 0]); // the chamber, a glass tube lying along the top
      k.drum(0.014, 0.08, fluid, [0, 0.095, 0.03], [Math.PI / 2, 0, 0]); // the fluid in it
      k.tube(0.022, 0.014, m.grey, [0, 0.095, -0.016]); // its caps
      k.tube(0.022, 0.014, m.grey, [0, 0.095, 0.076]);
      k.tube(0.03, 0.03, m.grey, [0, 0.045, 0.125]); // the front housing
      k.ball(0.019, fluid, [0, 0.045, 0.15]); // the bulb
      for (const a of [Math.PI / 2, Math.PI / 2 + (Math.PI * 2) / 3, Math.PI / 2 + (Math.PI * 4) / 3]) {
        // the prongs, round the bulb
        k.box(0.008, 0.008, 0.05, m.steel, [Math.cos(a) * 0.026, 0.045 + Math.sin(a) * 0.026, 0.15], [0, 0, 0]);
      }
      k.box(0.03, 0.085, 0.034, m.grey, [0, -0.03, -0.01], [0.26, 0, 0]).name = 'grip'; // the grip
      k.box(0.004, 0.02, 0.012, m.black, [0, 0.0, 0.03], [0.3, 0, 0]); // the trigger
      k.box(0.012, 0.012, 0.02, m.glow('#ff4a4a', 1.5), [0.02, 0.075, -0.02]); // the red button
      k.point('muzzle', [0, 0.045, 0.172]);
    },
  },
  // Walt's snub-nosed .38: a short barrel, the cylinder, a bobbed hammer,
  // and a rubber grip
  revolver: {
    hands: 1,
    support: true,
    stock: false,
    pitch: 0.28,
    reach: 0.9,
    rise: 0.18,
    lateral: -0.3,
    kick: { back: 0.9, up: 3.4 },
    casing: false,
    smoke: 3,
    flash: { color: '#ffd36b', size: 0.22 },
    build(g, owned) {
      const m = mats(owned);
      const k = kit(g, owned);
      k.box(0.022, 0.04, 0.05, m.gunmetal, [0, 0.045, 0.05]); // the frame over the cylinder
      k.tube(0.0165, 0.036, m.gunmetal, [0, 0.038, 0.05], null, 6); // the cylinder, six-sided
      k.tube(0.007, 0.055, m.gunmetal, [0, 0.052, 0.098]); // the barrel
      k.box(0.012, 0.012, 0.055, m.gunmetal, [0, 0.038, 0.098]); // the ejector-rod shroud under it
      k.box(0.004, 0.012, 0.004, m.gunmetal, [0, 0.062, 0.12]); // the front sight
      k.box(0.006, 0.02, 0.014, m.gunmetal, [0, 0.062, 0.014], [-0.6, 0, 0]); // the hammer
      k.box(0.026, 0.07, 0.03, m.black, [0, -0.02, 0.005], [0.32, 0, 0]).name = 'grip'; // the grip
      k.ring(0.014, 0.0025, m.gunmetal, [0, 0.014, 0.038], [0, Math.PI / 2, 0]); // the trigger guard
      k.box(0.004, 0.018, 0.01, m.gunmetal, [0, 0.016, 0.04], [0.25, 0, 0]); // the trigger
      k.point('muzzle', [0, 0.052, 0.128]);
    },
  },
  // Jesse's automatic: a boxy slide, a polymer frame, a lanyard loop
  pistol: {
    hands: 1,
    support: true,
    stock: false,
    pitch: 0.26,
    reach: 0.9,
    rise: 0.18,
    lateral: -0.3,
    kick: { back: 0.8, up: 2.8 },
    casing: true,
    smoke: 2,
    flash: { color: '#ffd36b', size: 0.2 },
    build(g, owned) {
      const m = mats(owned);
      const k = kit(g, owned);
      k.box(0.026, 0.028, 0.17, m.gunmetal, [0, 0.062, 0.06]); // the slide
      k.box(0.024, 0.02, 0.14, m.black, [0, 0.04, 0.065]); // the frame
      k.tube(0.0065, 0.012, m.steel, [0, 0.064, 0.148]); // the barrel's end
      k.box(0.006, 0.006, 0.006, m.black, [0, 0.08, 0.14]); // the sights
      k.box(0.012, 0.006, 0.006, m.black, [0, 0.08, -0.02]);
      k.box(0.026, 0.08, 0.032, m.black, [0, -0.02, 0.005], [0.3, 0, 0]).name = 'grip'; // the grip
      k.box(0.026, 0.008, 0.034, m.black, [0, -0.062, -0.006], [0.3, 0, 0]); // the magazine's base
      k.box(0.02, 0.004, 0.034, m.black, [0, 0.018, 0.05]); // the trigger guard
      k.box(0.004, 0.02, 0.012, m.steel, [0, 0.028, 0.045], [0.3, 0, 0]); // the trigger
      k.point('muzzle', [0, 0.064, 0.158]);
      k.point('eject', [-0.016, 0.07, 0.05]); // the port, on the right
    },
  },
  // Chewie's bowcaster: a Wookiee's crossbow with a blaster's heart: the
  // long wooden stock, the bow across the front, a string, and the scope
  bowcaster: {
    hands: 2,
    support: false,
    stock: true,
    pitch: 0.08,
    reach: 0.38,
    rise: -0.14,
    lateral: -0.3,
    kick: { back: 1.2, up: 2.0 },
    casing: false,
    flash: { color: '#ff4a3d', size: 0.3 },
    build(g, owned) {
      const m = mats(owned);
      const k = kit(g, owned);
      k.box(0.065, 0.075, 0.5, m.wood, [0, 0.04, 0.08]); // the stock, grip to fore-end
      k.box(0.06, 0.1, 0.2, m.wood, [0, 0.02, -0.26], [-0.12, 0, 0]); // the butt
      k.tube(0.024, 0.46, m.gunmetal, [0, 0.098, 0.13]); // the barrel housing on top
      k.tube(0.012, 0.1, m.gunmetal, [0, 0.098, 0.4]); // the muzzle's end
      k.box(0.09, 0.02, 0.06, m.steel, [0, 0.07, 0.34]); // the bow's mount
      for (const s of [-1, 1]) {
        // the bow arms, swept back a little, and the strings
        k.box(0.3, 0.022, 0.028, m.wood, [s * 0.19, 0.075, 0.33], [0, s * 0.18, 0]);
        k.ball(0.014, m.steel, [s * 0.34, 0.075, 0.3]);
        k.tube(0.0025, 0.5, m.grey, [s * 0.17, 0.075, 0.18], [0, s * -1.22, 0]);
      }
      k.tube(0.013, 0.14, m.black, [0, 0.14, 0.1]); // the scope
      k.box(0.008, 0.02, 0.014, m.black, [0, 0.125, 0.05]);
      k.box(0.008, 0.02, 0.014, m.black, [0, 0.125, 0.15]);
      k.box(0.04, 0.1, 0.045, m.wood, [0, -0.04, -0.01], [0.3, 0, 0]).name = 'grip'; // the grip
      k.box(0.03, 0.006, 0.05, m.steel, [0, 0.004, 0.04]); // the trigger guard
      k.box(0.006, 0.026, 0.012, m.steel, [0, 0.015, 0.04], [0.3, 0, 0]);
      k.point('muzzle', [0, 0.098, 0.455]);
      k.point('foregrip', [0, 0.0, 0.19]);
      k.point('fore', [0, 0.04, 0.19]); // the other hand's grip: round the stock, from below
    },
    fore: { r: 0.045, axis: 'dir' },
  },
  // the Federation's blaster carbine: a squared olive receiver, a long
  // barrel shroud, a folding stock, a blue light where the charge sits
  rifle: {
    hands: 2,
    support: false,
    stock: true,
    pitch: 0.08,
    reach: 0.38,
    rise: -0.14,
    lateral: -0.3,
    kick: { back: 0.9, up: 1.4 },
    casing: false,
    flash: { color: '#62c8ff', size: 0.26 },
    build(g, owned) {
      const m = mats(owned);
      const k = kit(g, owned);
      const blue = m.glow('#62c8ff', 2);
      k.box(0.05, 0.07, 0.3, m.olive, [0, 0.05, 0.08]); // the receiver
      k.box(0.03, 0.03, 0.26, m.gunmetal, [0, 0.1, 0.1]); // the top rail
      k.box(0.044, 0.04, 0.22, m.gunmetal, [0, 0.04, 0.33]); // the barrel shroud
      k.tube(0.01, 0.06, m.gunmetal, [0, 0.055, 0.46]); // the muzzle
      k.cone(0.012, 0.02, 0.03, m.black, [0, 0.055, 0.475]);
      k.box(0.03, 0.012, 0.08, blue, [0, 0.03, 0.04]); // the charge light
      k.box(0.03, 0.05, 0.22, m.olive, [0, 0.03, -0.2], [0, 0, 0]); // the stock
      k.box(0.04, 0.09, 0.05, m.black, [0, 0.0, -0.3]); // its butt
      k.box(0.03, 0.09, 0.035, m.black, [0, -0.035, -0.01], [0.28, 0, 0]).name = 'grip'; // the grip
      k.box(0.03, 0.07, 0.04, m.black, [0, -0.01, 0.2]); // the foregrip
      k.box(0.024, 0.006, 0.05, m.steel, [0, 0.0, 0.04]); // the trigger guard
      k.box(0.004, 0.024, 0.012, m.steel, [0, 0.012, 0.04], [0.3, 0, 0]);
      k.point('muzzle', [0, 0.055, 0.49]);
      k.point('foregrip', [0, -0.035, 0.2]);
      k.point('fore', [0, -0.01, 0.2]); // the other hand's grip: round the foregrip, upright
    },
    fore: { r: 0.022, axis: 'up' },
  },
  // the Citadel cop's service pistol: a heavy navy-blue blaster pistol
  coppistol: {
    hands: 1,
    support: true,
    stock: false,
    pitch: 0.26,
    reach: 0.9,
    rise: 0.18,
    lateral: -0.3,
    kick: { back: 0.7, up: 2.4 },
    casing: false,
    flash: { color: '#62c8ff', size: 0.2 },
    build(g, owned) {
      const m = mats(owned);
      const k = kit(g, owned);
      const blue = m.glow('#62c8ff', 2);
      k.box(0.03, 0.036, 0.16, m.navy, [0, 0.06, 0.06]); // the slide
      k.box(0.026, 0.024, 0.13, m.black, [0, 0.036, 0.06]); // the frame
      k.tube(0.009, 0.03, m.gunmetal, [0, 0.062, 0.15]); // the barrel
      k.box(0.004, 0.01, 0.06, blue, [0.016, 0.062, 0.06]); // the lights
      k.box(0.004, 0.01, 0.06, blue, [-0.016, 0.062, 0.06]);
      k.box(0.028, 0.08, 0.034, m.black, [0, -0.02, 0.0], [0.3, 0, 0]).name = 'grip'; // the grip
      k.box(0.02, 0.004, 0.034, m.black, [0, 0.016, 0.045]); // the trigger guard
      k.box(0.004, 0.02, 0.012, m.steel, [0, 0.026, 0.04], [0.3, 0, 0]);
      k.point('muzzle', [0, 0.062, 0.168]);
    },
  },
};

export function buildGun(kind, owned = []) {
  const spec = GUNS[kind] ?? GUNS.blaster;
  const g = new THREE.Group();
  g.name = `gun:${kind}`;
  spec.build(g, owned);
  return g;
}

// ── The hand ──

// Which way a hand is (a right one, or with `left` a left one), from its
// vertices in its bone's space: `along`
// runs out the fingers, `thumb` across the knuckles toward the thumb, and
// `normal` out of the palm. `axes` are the bone's axes in the world
// ({ x, y, z }), `body` the figure's forward and the way in toward its
// middle, to settle which way is which: the fingers are on the far side of
// the wrist, the thumb points forward or in at rest (an A-pose's palms face
// in or back), and when the cloud can't say which of two axes the palm's
// normal is, it's the one that faces in or out from the body. Also `mean`,
// the palm's middle (bone space), where a grip sits.
export function handFrame(points, axes, body, left = false) {
  const f = palmFrame(points);
  const world = (v) => new V().addScaledVector(axes.x, v.x).addScaledVector(axes.y, v.y).addScaledVector(axes.z, v.z);
  let normal = f.normal;
  let across = f.across;
  // the two shorter axes close: the palm faces in or out, not forward or back
  const [thin, mid] = [0, 1, 2].sort((i, j) => f.spread[i] - f.spread[j]);
  if (f.spread[mid] < f.spread[thin] * 1.35) {
    const lateral = (i) => Math.abs(world(new V().setComponent(i, 1)).dot(body.inward));
    if (lateral(mid) > lateral(thin)) {
      normal = new V().setComponent(mid, 1);
      across = new V().setComponent(thin, 1);
    }
  }
  const along = f.along.clone();
  if (along.dot(new V(...f.mean)) < 0) along.negate(); // out past the wrist
  const thumb = across.clone();
  const toward = body.forward.clone().add(body.inward);
  if (world(thumb).dot(toward) < 0) thumb.negate();
  normal = left ? new V().crossVectors(along, thumb).normalize() : new V().crossVectors(thumb, along).normalize(); // (the palm: a left hand's is the mirror of a right's)
  return { along, thumb, normal, mean: new V(...f.mean) };
}

// the vertices skinned to `hand`, in its space (the figure at rest)
function handPoints(root, hand) {
  const pts = [];
  const v = new V();
  root.updateMatrixWorld(true);
  const inv = hand.matrixWorld.clone().invert();
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const idx = o.skeleton.bones.indexOf(hand);
    const si = o.geometry.attributes.skinIndex;
    const sw = o.geometry.attributes.skinWeight;
    if (idx < 0 || !si || !sw) return;
    o.skeleton.update();
    const n = si.count;
    const step = Math.max(1, Math.floor(n / 8000));
    for (let i = 0; i < n; i += step) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === idx) w += sw.getComponent(i, k);
      if (w < 0.6) continue;
      o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      pts.push([v.x, v.y, v.z]);
    }
  });
  return pts;
}

// fixes by who's holding: a hand whose geometry says the wrong thing, or a
// figure built from shapes ('built': its hand groups hang straight down
// −y, the thumb forward). along, thumb: in the hand's space; grip: the
// palm's middle, metres from the wrist along the fingers; curl: false to
// leave the fingers as they are, or { knuckle } (the share of the hand's
// length out to the knuckles) where its shape fools the measuring
export const GRIP_FIX = {
  built: { along: [0, -1, 0], thumb: [0, 0, 1], grip: 0.045 },
};

// ── A stance ──

// Where the trigger hand goes for a gun aimed along `dir` from the shoulder
// at `S`, `armLen` being the arm's full reach: out along the line (a
// pistol nearly straight-armed, a long gun's hand in by the chest), up
// toward the eye line, a little to the side; and which way the elbow bends.
export function stance(gun, S, dir, up, armLen) {
  const right = new V().crossVectors(dir, up).normalize();
  const hand = S.clone()
    .addScaledVector(dir, gun.reach * armLen)
    .addScaledVector(up, gun.rise * armLen)
    .addScaledVector(right, gun.lateral * armLen);
  // (never quite out of reach: an elbow locked dead straight looks wrong)
  const out = hand.distanceTo(S);
  if (out > armLen * 0.96) hand.sub(S).multiplyScalar((armLen * 0.96) / out).add(S);
  // the elbow: a long gun's down and a little out; a pistol arm's nearly
  // straight, what bend there is going out to the side rather than down
  const pole = gun.stock ? new V().addScaledVector(up, -1).addScaledVector(right, 0.35).addScaledVector(dir, -0.3) : new V().addScaledVector(up, -0.45).addScaledVector(right, 0.85).addScaledVector(dir, -0.2);
  return { hand, pole: pole.normalize(), right };
}

// ── Holding and aiming ──

const BONES = ['RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm', 'LeftHand', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head', 'Hips'];
const SPINE_SHARE = [0.22, 0.3, 0.48]; // Spine02 (lowest), Spine01, Spine
const TWIST_MAX = 1.05; // radians the chest turns to a target off to one side
const PITCH_MAX = 0.6;
const HEAD_MAX = 1.35; // and the head, all told
const RECOIL = { k: 160, c: 13 }; // the spring the gun kicks on
const EASE = { chest: 0.3, head: 0.45 }; // radians from the facing, at the most, at ease
const CUP = 0.04; // metres from a pistol's grip to the other hand's fingers cupping the gun hand's
const LOOSE = 0.3; // how far a hand with nothing in it closes
const FREE = { r: 0.03, at: 0.5 }; // the free hand of a one-handed gun: loosely closed, as a hand at rest is
const _a = new V();
const _b = new V();
const _c = new V();
const _d = new V();
const _e = new V();
const _q = new Q();
const _q2 = new Q();

const signedAngle = (from, to, axis) => Math.atan2(_c.crossVectors(from, to).dot(axis), from.dot(to));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Put a figure's skeleton in the pose it was bound in (Meshy's A-pose,
// facing +z) for `fn`, then back as it was: what's measured about the
// hands and the head is then the same whatever clip it's been playing.
// Only the bones' turns are set: each one's turn under its parent is the
// parent's inverse bind matrix times the inverse of its own (whatever
// space or scale those were made in cancels out), and the root bone's turn
// in the world is the model's (the glTF scene the armature hangs in)
// times its inverse bind's. Lengths and offsets stay as the bones have them.
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _t = new V();
const _s = new V();
function inBindPose(root, fn) {
  const bones = [];
  root.traverse((o) => o.isBone && bones.push(o));
  const saved = bones.map((b) => [b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
  root.updateMatrixWorld(true);
  const inv = new Map(); // bone → its inverse bind matrix
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.skeleton.bones.forEach((b, i) => b && !inv.has(b) && inv.set(b, o.skeleton.boneInverses[i]));
  });
  const q = new Q();
  // (traversal order: parents before children)
  for (const b of bones) {
    const ib = inv.get(b);
    if (!ib) continue;
    const ip = inv.get(b.parent);
    if (ip) {
      _m.copy(ip).multiply(_m2.copy(ib).invert());
      _m.decompose(_t, q, _s);
      b.quaternion.copy(q);
    } else {
      // the root bone: the model's turn, times its bind's
      const skinRoot = b.parent.parent && b.parent !== root ? b.parent.parent : b.parent;
      skinRoot.updateWorldMatrix(true, false);
      skinRoot.matrixWorld.decompose(_t, q, _s);
      _m2.copy(ib).invert().decompose(_t, _q2, _s);
      q.multiply(_q2); // its turn in the world
      b.parent.getWorldQuaternion(_q2);
      b.quaternion.copy(_q2.invert().multiply(q));
    }
    b.updateMatrixWorld(true);
  }
  root.updateMatrixWorld(true);
  try {
    return fn();
  } finally {
    bones.forEach((b, i) => {
      b.position.copy(saved[i][0]);
      b.quaternion.copy(saved[i][1]);
      b.scale.copy(saved[i][2]);
    });
    root.updateMatrixWorld(true);
  }
}

// a hand's grip frame and palm, worked out from its own vertices (in the
// bind pose); or a fix's
function measureHand(root, hand, hips, left, fix, unit) {
  const handScale = hand.getWorldScale(new V()).x || 1;
  const toLocal = (metres) => (metres * unit) / handScale;
  const out = { along: new V(0, 1, 0), thumb: new V(0, 0, 1), mean: new V(0, toLocal(0.085), 0) };
  if (fix?.along) {
    out.along.set(...fix.along);
    out.thumb.set(...fix.thumb);
    out.mean.copy(out.along).multiplyScalar(toLocal(fix.grip ?? 0.085));
  } else {
    const pts = handPoints(root, hand);
    if (pts.length >= 24) {
      hand.updateWorldMatrix(true, false);
      const m = hand.matrixWorld;
      const axes = { x: new V().setFromMatrixColumn(m, 0).normalize(), y: new V().setFromMatrixColumn(m, 1).normalize(), z: new V().setFromMatrixColumn(m, 2).normalize() };
      const forward = new V(0, 0, 1).transformDirection(root.matrixWorld);
      const upW = new V(0, 1, 0).transformDirection(root.matrixWorld);
      const inward = (hips ?? root).getWorldPosition(new V()).sub(hand.getWorldPosition(new V()));
      inward.addScaledVector(forward, -inward.dot(forward)).addScaledVector(upW, -inward.dot(upW)).normalize();
      const f = handFrame(pts, axes, { forward, inward }, left);
      out.along.copy(f.along);
      out.thumb.copy(f.thumb);
      out.mean.copy(f.mean);
    }
  }
  out.normal = left ? new V().crossVectors(out.along, out.thumb).normalize() : new V().crossVectors(out.thumb, out.along).normalize();
  // the palm's reach out from the wrist, in the world's units
  out.palm = Math.abs(out.mean.dot(out.along)) * handScale;
  out.toLocal = toLocal;
  return out;
}

export function createGunplay(fig, kind, { unit = 1, who = null } = {}) {
  const spec = GUNS[kind];
  const root = fig.model;
  if (!spec || !root) return null;
  const bones = {};
  for (const n of BONES) bones[n] = fig.bones?.[n] ?? root.getObjectByName(n) ?? null;
  const hand = bones.RightHand;
  if (!hand || !bones.RightArm || !bones.RightForeArm) return null;
  const owned = [];
  const gun = buildGun(kind, owned);
  const twoHanded = spec.hands === 2 || spec.support;
  const left = Boolean(bones.LeftArm && bones.LeftForeArm && bones.LeftHand) && twoHanded;
  const fix = who ? GRIP_FIX[who] : null;
  const look = [bones.Spine, bones.Spine01, bones.Spine02].find(Boolean) ?? null; // the chest
  const rest = new Map(); // bone → its forward and up in its own frame, from the bind pose

  // measured once, in the bind pose: the hands, the arms' reach, where the chest and head face
  // (a curl left on from before would be measured as the hand's own shape)
  ungrip(root);
  const gripBox = gun.getObjectByName('grip');
  const girth = gripBox?.geometry.parameters; // (round a box: the circle of the same perimeter)
  const gripR = girth ? (girth.width + girth.depth) / Math.PI : 0.018;
  const m = inBindPose(root, () => {
    const R = measureHand(root, hand, bones.Hips, false, fix, unit);
    const L = left ? measureHand(root, bones.LeftHand, bones.Hips, true, fix, unit) : null;
    const free = !left && bones.LeftHand ? measureHand(root, bones.LeftHand, bones.Hips, true, fix, unit) : null;
    // the fingers closed round the grip (and the other hand's round the
    // fore-end, or the gun hand; or, with nothing to hold, half closed)
    const knuckle = fix?.curl?.knuckle;
    const curl =
      fix?.curl === false || fix?.along
        ? null
        : gripMorphs(
            root,
            [
              { bone: hand, frame: R, side: 'R', radius: R.toLocal(gripR), knuckle },
              L && { bone: bones.LeftHand, frame: L, side: 'L', radius: L.toLocal(spec.fore?.r ?? CUP), knuckle },
              free && { bone: bones.LeftHand, frame: free, side: 'L', radius: free.toLocal(FREE.r), knuckle },
            ],
            knuckle ? `${kind}:${who}` : kind,
          );
    const forward = new V(0, 0, 1).transformDirection(root.matrixWorld).normalize();
    const upW = new V(0, 1, 0).transformDirection(root.matrixWorld).normalize();
    for (const b of [look, bones.Head]) {
      if (!b) continue;
      const inv = b.getWorldQuaternion(new Q()).invert();
      rest.set(b, { f: forward.clone().applyQuaternion(inv), u: upW.clone().applyQuaternion(inv) });
    }
    const len = (a, b, c) => a.getWorldPosition(new V()).distanceTo(b.getWorldPosition(new V())) + b.getWorldPosition(new V()).distanceTo(c.getWorldPosition(new V()));
    return { R, L, curl, armLen: len(bones.RightArm, bones.RightForeArm, hand), armLenL: left ? len(bones.LeftArm, bones.LeftForeArm, bones.LeftHand) : 0 };
  });
  const armLen = m.armLen;

  // the gun into the hand: its size in the hand's units, the grip in the palm, the sights along the thumb
  const handScale = hand.getWorldScale(new V()).x || 1;
  gun.scale.setScalar(unit / handScale);
  const gripQ = frameFrom(m.R.along, m.R.thumb).multiply(new Q().setFromAxisAngle(new V(1, 0, 0), -spec.pitch));
  gun.quaternion.copy(gripQ);
  const curl = m.curl;
  if (curl?.shape.R) {
    // the grip's middle on the curl's centre: the fingers close round it
    gun.position
      .copy(gripBox?.position ?? new V())
      .multiplyScalar(unit / handScale)
      .applyQuaternion(gripQ)
      .negate()
      .add(curl.shape.R.centre);
  } else gun.position.copy(m.R.mean).addScaledVector(m.R.normal, m.R.toLocal(fix?.along ? 0 : 0.018)); // (where the fingers close, a little out from the palm)
  hand.add(gun);
  // where the other hand's grip is, in its own space: what it closes round goes there
  const leftAt = m.L ? (curl?.shape.L?.centre.clone() ?? m.L.mean.clone().addScaledVector(m.L.normal, m.L.toLocal(0.012 + (spec.fore?.r ?? CUP)))) : null;
  const gripInv = gripQ.clone().invert();
  const leftInv = m.L ? frameFrom(m.L.along, m.L.thumb).invert() : null;
  const muzzle = gun.getObjectByName('muzzle');
  const fore = gun.getObjectByName('fore');
  const eject = gun.getObjectByName('eject');

  // what this turned last frame, and what it was before: a figure without
  // a clip writing its bones each frame (one built from shapes, a clip
  // that doesn't key a bone) would otherwise wind up a little more each
  // frame. A bone still as it was left is put back before it's turned again.
  const turned = [bones.Spine02, bones.Spine01, bones.Spine, bones.neck, bones.Head, bones.RightArm, bones.RightForeArm, hand, bones.LeftArm, bones.LeftForeArm, bones.LeftHand].filter(Boolean);
  const before = new Map(turned.map((b) => [b, b.quaternion.clone()]));
  const after = new Map(turned.map((b) => [b, b.quaternion.clone()]));
  const restore = () => {
    for (const b of turned) {
      if (b.quaternion.equals(after.get(b))) b.quaternion.copy(before.get(b));
      before.get(b).copy(b.quaternion);
    }
  };
  const remember = () => {
    for (const b of turned) after.get(b).copy(b.quaternion);
  };
  // where a bone faces now (its rest forward, turned as it is), as a yaw and
  // pitch from the figure's forward
  const facing = (b, forward, up) => {
    const r = rest.get(b);
    b.updateWorldMatrix(true, false);
    const f = _e.copy(r.f).applyQuaternion(b.getWorldQuaternion(_q2));
    const pitch = Math.asin(clamp(f.dot(up), -1, 1));
    f.addScaledVector(up, -f.dot(up));
    if (f.lengthSq() < 1e-8) return { yaw: 0, pitch };
    return { yaw: signedAngle(forward, f.normalize(), up), pitch };
  };

  const st = {
    aim: 0, // as shown, eased
    look: 0,
    dir: null, // the line of fire, eased
    back: { x: 0, v: 0 }, // recoil, metres back and radians up
    up: { x: 0, v: 0 },
    curlR: 0, // how closed each hand is (0 as sculpted, 1 round its grip)
    curlL: 0,
  };

  const set = (dt, pose) => {
    const { forward, up } = pose;
    if (!forward || !up) return;
    dt = Math.min(dt, 0.1);
    restore();
    // easing: the gun comes up quicker than it goes down
    const wantAim = clamp(pose.aim ?? 0, 0, 1);
    st.aim += (wantAim - st.aim) * (1 - Math.exp(-dt * (wantAim > st.aim ? 11 : 4.5)));
    const wantLook = clamp(pose.look ?? wantAim, 0, 1);
    st.look += (wantLook - st.look) * (1 - Math.exp(-dt * 7));
    const want = pose.dir ?? forward;
    if (!st.dir) st.dir = want.clone();
    else st.dir.lerp(want, 1 - Math.exp(-dt * 14)).normalize();
    spring(st.back, dt, RECOIL.k, RECOIL.c);
    spring(st.up, dt, RECOIL.k, RECOIL.c);
    const aim = st.aim;
    const dir = st.dir;
    const right = _a.crossVectors(forward, up).normalize(); // (about it, + tips something upright back)

    // the line of fire as a turn and a tilt from the figure's facing
    const level = _b.copy(dir).addScaledVector(up, -dir.dot(up));
    const yaw = level.lengthSq() > 1e-8 ? clamp(signedAngle(forward, level.normalize(), up), -HEAD_MAX, HEAD_MAX) : 0;
    const pitch = clamp(Math.asin(clamp(dir.dot(up), -1, 1)), -PITCH_MAX, PITCH_MAX);

    // the chest: round to face most of the way to the target (whatever way
    // the clip had it), tipped back to aim high, and back a touch on a kick
    // (at ease, no further round than EASE from the way it's facing: some
    // of the clips stand side-on, a fighter's stance, which on a figure
    // walking the way you steer it reads as looking off somewhere else)
    const spine = [bones.Spine02, bones.Spine01, bones.Spine];
    const twist = Math.max(aim, st.look * 0.45);
    if (look) {
      const now = facing(look, forward, up).yaw;
      const want = clamp(now, -EASE.chest, EASE.chest) * (1 - twist) + clamp(yaw, -TWIST_MAX, TWIST_MAX) * 0.75 * twist;
      const turn = want - now;
      if (Math.abs(turn) > 1e-4) spine.forEach((b, i) => b && rotateWorld(b, up, turn * SPINE_SHARE[i], 1));
    }
    const lift = pitch * 0.4 * aim + st.up.x * 0.25;
    if (Math.abs(lift) > 1e-5) spine.forEach((b, i) => b && rotateWorld(b, right, lift * SPINE_SHARE[i], 1));
    // the head: the rest of the way, onto the target
    const lookW = Math.max(st.look, aim);
    if (bones.Head) {
      const now = facing(bones.Head, forward, up);
      const easeYaw = clamp(now.yaw, -EASE.head, EASE.head);
      const dy = easeYaw * (1 - lookW) + yaw * lookW - now.yaw;
      const dp = (pitch * 0.9 - now.pitch) * lookW;
      if (bones.neck) {
        rotateWorld(bones.neck, up, dy * 0.4, 1);
        rotateWorld(bones.neck, right, dp * 0.4, 1);
      }
      rotateWorld(bones.Head, up, bones.neck ? dy * 0.6 : dy, 1);
      rotateWorld(bones.Head, right, bones.neck ? dp * 0.6 : dp, 1);
    }

    // lowered: carried muzzle down beside the thigh, the hand turned to hold it so
    bones.RightForeArm.updateWorldMatrix(true, false);
    const E = bones.RightForeArm.getWorldPosition(_c);
    const H = hand.getWorldPosition(_d);
    const carry = H.sub(E).normalize().addScaledVector(forward, 0.1).addScaledVector(up, -0.4);
    carry.addScaledVector(right, -carry.dot(right)).normalize();
    frameFrom(carry, forward, _q); // (the sights forward)
    _q.multiply(gripInv);
    setWorldQuaternion(hand, _q, 1);

    // up: the arm reaches to put the gun on the line of fire, the gun pointed along it
    if (aim > 0.002) {
      bones.RightArm.updateWorldMatrix(true, false);
      const S = bones.RightArm.getWorldPosition(new V());
      const { hand: target, pole } = stance(spec, S, dir, up, armLen);
      target.addScaledVector(dir, -st.back.x * unit); // the kick, back along the barrel
      reach(bones.RightArm, bones.RightForeArm, hand, target, pole, aim);
      frameFrom(dir, up, _q);
      _q2.setFromAxisAngle(_b.crossVectors(dir, up).normalize(), st.up.x); // and the muzzle up
      _q.premultiply(_q2).multiply(gripInv);
      setWorldQuaternion(hand, _q, aim);
      if (left) {
        gun.updateWorldMatrix(true, true);
        const across = _b.crossVectors(dir, up).normalize(); // the gun's right
        // the other hand, closed round what it holds: a long gun's fore-end
        // (under a stock, palm up and the fingers round to the right; an
        // upright foregrip, the palm on its left and the fingers round its
        // front), or a pistol's gun hand (the palm against the grip's left
        // side over the gun hand's fingertips, its fingers round the front
        // of them, the knuckles lined up with the grip). Its turn first,
        // then the wrist where that puts the grip's middle on what it holds.
        const anchor = _c;
        let fingers;
        let axis;
        if (fore) {
          fore.getWorldPosition(anchor);
          if (spec.fore.axis === 'up') {
            axis = _d.set(0, 1, 0).transformDirection(gun.matrixWorld);
            fingers = new V().copy(dir).addScaledVector(across, 0.15).normalize();
          } else {
            axis = _d.copy(dir);
            fingers = new V().copy(across).addScaledVector(up, 0.3).normalize();
          }
        } else {
          (gripBox ?? gun).getWorldPosition(anchor);
          axis = _d.set(0, 1, 0).transformDirection((gripBox ?? gun).matrixWorld);
          fingers = new V().copy(dir).addScaledVector(up, -0.35).addScaledVector(across, 0.2).normalize();
        }
        frameFrom(fingers, axis, _q);
        _q.multiply(leftInv);
        const wrist = _e.copy(leftAt).multiplyScalar(bones.LeftHand.getWorldScale(_s).x).applyQuaternion(_q).negate().add(anchor);
        const poleL = new V().addScaledVector(up, -1).addScaledVector(across, -0.6).addScaledVector(dir, -0.1).normalize();
        reach(bones.LeftArm, bones.LeftForeArm, bones.LeftHand, wrist, poleL, aim);
        leftMiss = bones.LeftHand.getWorldPosition(_t).distanceTo(wrist) / unit;
        setWorldQuaternion(bones.LeftHand, _q, aim);
      }
    }
    // the fingers: the gun hand's closed on the grip while it has it, the
    // other's closing on its hold as the gun comes up
    if (curl) {
      const k = 1 - Math.exp(-dt * 18);
      st.curlR += ((gun.parent === hand ? 1 : LOOSE) - st.curlR) * k;
      st.curlL += ((left ? LOOSE + (1 - LOOSE) * aim : FREE.at) - st.curlL) * k;
      curl.set({ R: st.curlR, L: st.curlL });
    }
    gun.updateWorldMatrix(true, true);
    remember();
  };

  // (for checking: where the chest and head face, and how far the other hand is from where it's going)
  let leftMiss = null;
  const debug = (forward, up) => ({
    chest: look ? facing(look, forward, up) : null,
    head: bones.Head ? facing(bones.Head, forward, up) : null,
    leftMiss,
    palmL: m.L?.palm ?? null,
    curl: curl ? { R: st.curlR, L: st.curlL, shape: curl.shape } : null,
  });

  return {
    gun,
    spec,
    bones,
    armLen,
    debug,
    get aim() {
      return st.aim;
    },
    set,
    // a shot: the kick, and where it leaves from (world)
    fire() {
      st.back.v += spec.kick.back;
      st.up.v += spec.kick.up;
      gun.updateWorldMatrix(true, true);
      const from = (muzzle ?? gun).getWorldPosition(new V());
      const dir = new V(0, 0, 1).transformDirection(gun.matrixWorld).normalize();
      return { muzzle: from, dir, eject: eject ? eject.getWorldPosition(new V()) : null, gun };
    },
    // let go of it (going down): the gun, where it is in the world, for
    // whoever's to throw it; the hands keep posing without it
    drop() {
      if (!gun.parent || gun.parent !== hand) return null;
      gun.updateWorldMatrix(true, false);
      return gun;
    },
    dispose() {
      curl?.dispose();
      gun.removeFromParent();
      for (const o of owned) o.dispose?.();
      owned.length = 0;
    },
  };
}
