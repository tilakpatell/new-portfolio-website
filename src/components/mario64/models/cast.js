// The cast, made in code, each with its own little life: Goombas waddle and
// frown, Bob-ombs wind their keys and blink red when lit, King Bob-omb wears
// his crown and moustache, the Chain Chomp gnashes at the end of its chain,
// Toad turns to talk. Each is { root, update(a, t, g, life) } (t in frames;
// life, from ../scene.js: { dt, the frames since the last; since, the frames
// it's been in its state; prev, the state before; speed, metres a second }).
// Their feet keep to the ground they cover (a phase from distance:
// lib/three/gait.js), a Goomba hops when it spots Mario, a lit Bob-omb
// leans into its run, a thrown one tumbles, King Bob-omb bounces as he
// taunts and shrinks away in the time since he lost, the Chain Chomp rears
// back before it bites, and Toad hops to greet Mario and bobs as he talks.
// Given `hd` (a loaded model, ./hd.js), it wears that instead of the shapes
// made here, and keeps its life: the same groups move, squash and flash.

import * as THREE from 'three';
import { breathe, createGait, sway } from '../../../lib/three/gait';
import { stepAt } from '../pose';
import { COLORS, canvasTexture, capsule, cone, cylinder, mesh, pbr, sphere, torus } from './common';

const eyeWhite = () => pbr('#ffffff', { rough: 0.2, clearcoat: 1 });
const pupil = () => pbr('#0c0c0c', { rough: 0.2, clearcoat: 1 });
const secs = (life) => (life?.dt > 0 ? life.dt / 30 : 0); // (the rules' frames, 30 a second)
const ease = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
// how high a foot's lifted (0…1) at a phase of its stride: off the ground
// from behind to ahead (where it is along it: ../pose.js's stepAt)
const footUp = (phase) => Math.max(0, Math.cos(phase));
// a hop of `frames`, then a squash on landing: { y (0…1 of its height), squash (1 is none) }
function hop(since, frames, land = 4) {
  if (!(since >= 0)) return { y: 0, squash: 1 };
  if (since < frames) return { y: Math.sin((since / frames) * Math.PI), squash: 1 };
  if (since < frames + land) return { y: 0, squash: 1 - 0.2 * Math.sin(((since - frames) / land) * Math.PI) };
  return { y: 0, squash: 1 };
}

const GOOMBA_STRIDE = 0.5; // metres a full waddle covers (two steps)
const SPOT_HOP = 10; // frames: the little jump a Goomba gives when it spots Mario

function goomba(a0, hd) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const gait = createGait({ stride: GOOMBA_STRIDE, cadence: [2.5, 5], seed: a0?.id ?? 0 });
  // what every Goomba does, whichever it's made of: its stride, its hop, its spin when knocked
  const life = (a, t, l) => {
    const walking = a.state === 'wander' || a.state === 'chase';
    const step = gait.step(secs(l), walking ? (l?.speed ?? 0) : 0);
    const spotted = a.state === 'chase' && l?.prev === 'wander' ? hop(l.since, SPOT_HOP) : hop(-1, SPOT_HOP);
    if (a.state === 'knocked') root.rotation.x += 0.4 * (l?.dt ?? 0);
    return { step, spotted, breath: breathe(t / 30, a.id ?? 0) };
  };
  if (hd) {
    body.add(hd);
    return {
      root,
      update(a, t, g, l) {
        const { step, spotted, breath } = life(a, t, l);
        const flat = a.state === 'flat';
        const s = sway(step.phase, step.amount);
        const sq = spotted.squash * (1 + breath * 0.012 * (1 - step.amount));
        body.scale.set(flat ? 1.3 : 2 - sq, flat ? 0.25 : sq, flat ? 1.3 : 2 - sq);
        body.position.y = flat ? 0 : s.bob * 0.05 + spotted.y * 0.22;
        body.rotation.z = s.roll * 0.08;
      },
    };
  }
  const cap = pbr('#8a4a1f', { rough: 0.55, clearcoat: 0.3 });
  const face = pbr('#f0c99a', { rough: 0.6 });
  const foot = pbr('#3a2214', { rough: 0.5, clearcoat: 0.4 });
  // the mushroom: a wide brown head over a pale stalk of a face
  const profile = [
    [0, 0.42],
    [0.32, 0.36],
    [0.5, 0.48],
    [0.52, 0.62],
    [0.42, 0.8],
    [0.22, 0.9],
    [0, 0.92],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  body.add(mesh(new THREE.LatheGeometry(profile, 40), cap));
  body.add(mesh(sphere(), face, { y: 0.35, sx: 0.3, sy: 0.27, sz: 0.28 }));
  for (const sx of [-1, 1]) {
    body.add(mesh(sphere(), eyeWhite(), { x: sx * 0.13, y: 0.56, z: 0.4, sx: 0.08, sy: 0.12, sz: 0.04 }));
    body.add(mesh(sphere(), pupil(), { x: sx * 0.12, y: 0.55, z: 0.43, sx: 0.045, sy: 0.07, sz: 0.02 }));
    // the frown: brows angled down to the middle
    body.add(mesh(capsule(1), pupil(), { x: sx * 0.13, y: 0.68, z: 0.42, sx: 0.025, sy: 0.06, sz: 0.02, rz: sx * 1.0 }));
    body.add(mesh(cone(12), eyeWhite(), { x: sx * 0.08, y: 0.27, z: 0.27, sx: 0.035, sy: 0.06, sz: 0.035, rx: Math.PI }));
  }
  const feet = [-1, 1].map((sx) => {
    const f = mesh(sphere(), foot, { x: sx * 0.16, y: 0.07, z: 0.05, sx: 0.13, sy: 0.08, sz: 0.18 });
    root.add(f);
    return f;
  });
  return {
    root,
    update(a, t, g, l) {
      const { step, spotted, breath } = life(a, t, l);
      const flat = a.state === 'flat';
      const sq = spotted.squash * (1 + breath * 0.012 * (1 - step.amount));
      body.scale.y = flat ? 0.25 : sq;
      body.scale.x = body.scale.z = flat ? 1.3 : 2 - sq;
      body.position.y = flat ? 0 : sway(step.phase, step.amount).bob * 0.04 + spotted.y * 0.22;
      // each foot down where it lands until it lifts (a quarter stride either side)
      feet.forEach((f, i) => {
        const ph = step.phase + i * Math.PI;
        f.position.z = 0.05 + stepAt(ph) * (GOOMBA_STRIDE / 4) * step.amount;
        f.position.y = 0.07 + footUp(ph) * 0.06 * step.amount + spotted.y * 0.22;
      });
      body.rotation.z = sway(step.phase, step.amount).roll * 0.06;
    },
  };
}

// What every Bob-omb does, loaded or made here: its waddle paced to the
// ground (a King's as long as he's big), a lean into its run once it's lit,
// a kick while it's held, a tumble once it's thrown (from the time since,
// so the same on any screen), King Bob-omb's two bounces as he taunts you
// and his shrinking away over the second after he's beaten (the rules' own
// count since, between their steps: it once ran on the clock's last 60
// frames, and started part way and popped back).
const BOMB_STRIDE = 0.45;
const TAUNT = 40; // frames: the King's two bounces
function bombLife(a, t, l, gait) {
  const going = a.state === 'walk' || a.state === 'lit';
  const step = gait.step(secs(l), going ? (l?.speed ?? 0) : 0);
  const since = l?.since ?? 0;
  const beaten = Math.max(0, (a.t ?? 0) - (a.since ?? 0) - 1 + (t % 1));
  return {
    step,
    lean: a.state === 'lit' ? 0.25 * ease(since / 6) : 0,
    tumble: a.state === 'thrown' ? since * 0.32 : 0,
    kick: a.state === 'held' ? Math.sin(t * 0.9) : 0,
    shrink: a.state === 'defeated' ? Math.max(0.01, 1 - beaten / 60) : 1,
    taunt: a.state === 'walk' && l?.prev === 'wait' && since < TAUNT ? hop(since % (TAUNT / 2), TAUNT / 2 - 4) : hop(-1, 1),
    // the spark at the fuse: a flicker of its own (once a random size every frame)
    spark: 0.5 + 0.5 * Math.sin(t * 2.3 + Math.sin(t * 0.7) * 3),
  };
}
const lit = (a) => a.state === 'lit' || a.state === 'held' || a.state === 'thrown';
const flashing = (a, t) => lit(a) && Math.floor(t / Math.max(2, 8 - (a.fuse ?? 0) / 20)) % 2 === 0;

// (a loaded Bob-omb flashes red all over when it's lit: its own materials,
// glowing)
function hdBobomb(hd, { king, seed }) {
  const root = new THREE.Group();
  const pivot = new THREE.Group(); // turned about its middle: its lean, its tumble
  const body = new THREE.Group();
  root.add(pivot);
  pivot.add(body);
  body.add(hd);
  const mats = [];
  hd.traverse((o) => o.isMesh && mats.push(...[].concat(o.material)));
  const box = new THREE.Box3().setFromObject(hd);
  const centre = (box.min.y + box.max.y) / 2;
  pivot.position.y = centre;
  body.position.y = -centre;
  const spark = mesh(sphere(), pbr('#fff2a0', { emissive: '#ffcf40', emissiveIntensity: 3, rough: 1 }), { y: box.max.y + 0.05, sx: 0.05, sy: 0.05, sz: 0.05, shadow: false });
  body.add(spark);
  const red = new THREE.Color('#ff2200');
  const off = new THREE.Color(0, 0, 0);
  const gait = createGait({ stride: BOMB_STRIDE * (king ? 2.7 : 1), cadence: [1, 4], seed });
  return {
    root,
    update(a, t, g, l) {
      const s = bombLife(a, t, l, gait);
      const flash = flashing(a, t);
      for (const m of mats) {
        if (!m.emissive) continue;
        m.emissive.copy(flash ? red : off);
        m.emissiveIntensity = flash ? 0.7 : 1;
      }
      spark.visible = !king && a.state !== 'walk' && a.state !== 'wait' && a.state !== 'gone';
      spark.scale.setScalar(0.05 + s.spark * 0.03);
      root.visible = a.state !== 'gone';
      const w = sway(s.step.phase, s.step.amount);
      const size = king ? 3 : 1;
      body.position.y = -centre + w.bob * 0.04 * size + s.taunt.y * 0.1 * size;
      pivot.rotation.x = s.lean + s.tumble;
      if (a.state === 'stunned' || a.state === 'defeated') pivot.rotation.z = Math.sin(t * 0.5) * 0.15;
      else pivot.rotation.z = w.roll * 0.05 + s.kick * 0.12;
      const sq = s.taunt.squash;
      root.scale.set(s.shrink * (2 - sq), s.shrink * sq, s.shrink * (2 - sq)); // (about its feet)
    },
  };
}

function bobombBody({ scale = 1, king = false, hd = null, seed = 0 } = {}) {
  if (hd) return hdBobomb(hd, { king, seed });
  const shell = pbr('#1c1c22', { rough: 0.22, clearcoat: 1, metal: 0.3 });
  const glow = pbr('#ff3b2a', { rough: 0.3, clearcoat: 1, emissive: '#ff2200', emissiveIntensity: 0.9 });
  const brass = pbr(COLORS.gold, { rough: 0.3, metal: 1 });
  const feet = pbr('#f2a01f', { rough: 0.45, clearcoat: 0.5 });
  const root = new THREE.Group();
  const pivot = new THREE.Group(); // turned about its middle: its lean, its tumble
  const body = new THREE.Group();
  body.scale.setScalar(scale);
  pivot.position.y = 0.55 * scale;
  body.position.y = -0.55 * scale;
  root.add(pivot);
  pivot.add(body);
  const gait = createGait({ stride: BOMB_STRIDE * scale, cadence: [1, 4], seed });
  const ball = mesh(sphere(), shell, { y: 0.55, sx: 0.45, sy: 0.45, sz: 0.45 });
  body.add(ball);
  // the cap the fuse comes out of, and the fuse
  body.add(mesh(cylinder(1, 1, 24), pbr('#9a9aa0', { rough: 0.35, metal: 1 }), { y: 1.0, sx: 0.12, sy: 0.08, sz: 0.12 }));
  const fuse = mesh(capsule(1), pbr('#d8c9a0', { rough: 0.9 }), { y: 1.12, sx: 0.025, sy: 0.07, sz: 0.025, rz: 0.3 });
  body.add(fuse);
  const spark = mesh(sphere(), pbr('#fff2a0', { emissive: '#ffcf40', emissiveIntensity: 3, rough: 1 }), { x: 0.05, y: 1.22, sx: 0.04, sy: 0.04, sz: 0.04, shadow: false });
  body.add(spark);
  // the wind-up key on its back
  const key = new THREE.Group();
  key.position.set(0, 0.6, -0.46);
  body.add(key);
  key.add(mesh(cylinder(1, 1, 12), brass, { z: -0.06, sx: 0.035, sy: 0.14, sz: 0.035, rx: Math.PI / 2 }));
  for (const sx of [-1, 1]) key.add(mesh(torus(0.28), brass, { x: sx * 0.12, z: -0.13, sx: 0.11, sy: 0.11, sz: 0.11, ry: Math.PI / 2 }));
  for (const sx of [-1, 1]) {
    body.add(mesh(sphere(), eyeWhite(), { x: sx * 0.12, y: 0.62, z: 0.39, sx: 0.08, sy: 0.13, sz: 0.05 }));
    body.add(mesh(sphere(), pupil(), { x: sx * 0.11, y: 0.6, z: 0.43, sx: 0.035, sy: 0.07, sz: 0.02 }));
  }
  const fs = [-1, 1].map((sx) => {
    const f = mesh(sphere(), feet, { x: sx * 0.18, y: 0.08, z: 0.04, sx: 0.12, sy: 0.08, sz: 0.17 });
    body.add(f);
    return f;
  });
  if (king) {
    // the crown, the white moustache, the gloved hands
    const crown = new THREE.Group();
    crown.position.y = 1.0;
    body.add(crown);
    crown.add(mesh(cylinder(1, 1.05, 32), brass, { y: 0.05, sx: 0.24, sy: 0.12, sz: 0.24 }));
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      crown.add(mesh(cone(8), brass, { x: Math.sin(ang) * 0.21, y: 0.17, z: Math.cos(ang) * 0.21, sx: 0.05, sy: 0.12, sz: 0.05 }));
      crown.add(mesh(sphere(), pbr('#d6224a', { rough: 0.1, clearcoat: 1, metal: 0.2 }), { x: Math.sin(ang) * 0.235, y: 0.05, z: Math.cos(ang) * 0.235, sx: 0.025, sy: 0.025, sz: 0.025 }));
    }
    const tache = pbr('#f4f1ea', { rough: 0.85, sheen: 0.6 });
    for (const sx of [-1, 1]) body.add(mesh(sphere(), tache, { x: sx * 0.12, y: 0.45, z: 0.41, sx: 0.15, sy: 0.06, sz: 0.06, rz: sx * 0.35 }));
    for (const sx of [-1, 1]) body.add(mesh(sphere(), pbr(COLORS.white, { rough: 0.55, sheen: 0.4 }), { x: sx * 0.52, y: 0.6, z: 0.1, sx: 0.12, sy: 0.12, sz: 0.12 }));
  }
  return {
    root,
    update(a, t, g, l) {
      const s = bombLife(a, t, l, gait);
      // the key winds faster once it's lit
      key.rotation.z = t * (lit(a) ? 0.3 : 0.12);
      // each foot down where it lands until it lifts; held, they kick
      fs.forEach((f, i) => {
        const ph = s.step.phase + i * Math.PI;
        f.position.z = 0.04 + stepAt(ph) * (BOMB_STRIDE / 4) * s.step.amount + (i ? -1 : 1) * s.kick * 0.07;
        f.position.y = 0.08 + footUp(ph) * 0.05 * s.step.amount;
      });
      ball.material = flashing(a, t) ? glow : shell;
      spark.visible = a.state !== 'walk' && a.state !== 'wait' && a.state !== 'gone';
      spark.scale.setScalar(0.035 + s.spark * 0.02);
      root.visible = a.state !== 'gone';
      const w = sway(s.step.phase, s.step.amount);
      body.position.y = -0.55 * scale + (w.bob * 0.03 + s.taunt.y * 0.1) * scale;
      pivot.rotation.x = s.lean + s.tumble;
      if (a.state === 'stunned' || a.state === 'defeated') pivot.rotation.z = Math.sin(t * 0.5) * 0.15;
      else pivot.rotation.z = w.roll * 0.04 + s.kick * 0.12;
      const sq = s.taunt.squash;
      root.scale.set(s.shrink * (2 - sq), s.shrink * sq, s.shrink * (2 - sq)); // (about its feet)
    },
  };
}

function chomp(_, hd) {
  const shell = pbr('#16161a', { rough: 0.18, clearcoat: 1, metal: 0.4 });
  const mouth = pbr('#5a0b10', { rough: 0.7 });
  const tooth = pbr('#fbfbf5', { rough: 0.2, clearcoat: 1 });
  const link = pbr('#2b2b31', { rough: 0.35, metal: 1 });
  const root = new THREE.Group();
  const head = new THREE.Group();
  head.position.y = 1.5;
  root.add(head);
  const upper = new THREE.Group();
  const lower = new THREE.Group();
  head.add(upper, lower);
  const half = (top) => new THREE.SphereGeometry(1.5, 48, 24, 0, Math.PI * 2, top ? 0 : Math.PI / 2, Math.PI / 2);
  // (a loaded one is one piece: it rears back to bite instead)
  if (hd) {
    hd.position.y = -1.5;
    head.add(hd);
  }
  if (!hd) upper.add(mesh(half(true), shell));
  if (!hd) lower.add(mesh(half(false), shell));
  if (!hd) upper.add(mesh(new THREE.CircleGeometry(1.42, 48), mouth, { rx: Math.PI / 2, y: -0.01 }));
  if (!hd) lower.add(mesh(new THREE.CircleGeometry(1.42, 48), mouth, { rx: -Math.PI / 2, y: 0.01 }));
  for (let i = 0; i < (hd ? 0 : 9); i++) {
    const ang = -0.95 + (i / 8) * 1.9;
    upper.add(mesh(cone(10), tooth, { x: Math.sin(ang) * 1.32, y: -0.12, z: Math.cos(ang) * 1.32, sx: 0.14, sy: 0.3, sz: 0.14, rx: Math.PI }));
    lower.add(mesh(cone(10), tooth, { x: Math.sin(ang + 0.1) * 1.32, y: 0.12, z: Math.cos(ang + 0.1) * 1.32, sx: 0.14, sy: 0.3, sz: 0.14 }));
  }
  for (const sx of hd ? [] : [-1, 1]) {
    upper.add(mesh(sphere(), eyeWhite(), { x: sx * 0.55, y: 0.75, z: 1.15, sx: 0.32, sy: 0.32, sz: 0.2 }));
    upper.add(mesh(sphere(), pupil(), { x: sx * 0.52, y: 0.72, z: 1.33, sx: 0.12, sy: 0.12, sz: 0.06 }));
  }
  // the chain back to the post: links laid between it and its post
  const chain = new THREE.Group();
  root.add(chain);
  const links = Array.from({ length: 9 }, (_, i) => {
    const l = mesh(torus(0.3), link, { sx: 0.22, sy: 0.22, sz: 0.22, ry: i % 2 ? Math.PI / 2 : 0 });
    chain.add(l);
    return l;
  });
  return {
    root,
    update(a, t, g) {
      // its tell (the rules' a.tell, 0…1, over its last moments before a
      // bite): it rears back and up, its jaws wide, quivering, then goes
      const tell = a.state === 'idle' ? ease(a.tell ?? 0) : 0;
      const open = a.state === 'lunge' ? 0.55 : tell > 0 ? 0.12 + 0.5 * tell : 0.12 + Math.max(0, Math.sin(t * 0.35)) * 0.25;
      upper.rotation.x = -open;
      lower.rotation.x = open * 0.5;
      head.rotation.x = (hd ? -open * 0.35 : 0) - 0.42 * tell;
      head.rotation.z = Math.sin(t * 2.6) * 0.05 * tell;
      head.position.z = -0.4 * tell;
      head.position.y = 1.5 + 0.2 * tell + Math.abs(Math.sin(t * 0.3)) * (a.state === 'idle' ? 0.15 * (1 - tell) : 0);
      const post = g?.actors?.find((x) => x.type === 'post' && x.def.id === a.def.post);
      chain.visible = Boolean(post) && a.state !== 'free' && a.state !== 'gone';
      if (post) {
        // links in the chomp's own frame (turned as it's drawn: watching Mario)
        const yaw = root.rotation.y;
        const dx = (post.pos.x - a.pos.x) * 0.01, dz = (post.pos.z - a.pos.z) * 0.01;
        const c = Math.cos(-yaw), s = Math.sin(-yaw);
        const lx = dx * c + dz * s, lz = -dx * s + dz * c;
        // from its back, low, to the top of the post, sagging between
        const ly = (post.pos.y - a.pos.y) * 0.01 + 1.0;
        links.forEach((l, i) => {
          const k = (i + 1) / (links.length + 1);
          l.position.set(lx * k, 0.6 + (ly - 0.6) * k - Math.sin(k * Math.PI) * 0.35, lz * k);
        });
      }
    },
  };
}

function ironball() {
  const root = new THREE.Group();
  const ball = mesh(sphere(), pbr('#2a2a2f', { rough: 0.38, metal: 1 }), { y: 1.3, sx: 1.3, sy: 1.3, sz: 1.3 });
  root.add(ball);
  return {
    root,
    update(a) {
      ball.rotation.x = a.roll ?? 0;
    },
  };
}

function post() {
  const root = new THREE.Group();
  const wood = pbr('#7a4b26', { rough: 0.8 });
  root.add(mesh(cylinder(1, 1, 24), wood, { y: 0.6, sx: 0.55, sy: 1.2, sz: 0.55 }));
  root.add(mesh(torus(0.18), pbr('#7d7d84', { rough: 0.4, metal: 1 }), { y: 0.95, sx: 0.58, sy: 0.58, sz: 0.58, rx: Math.PI / 2 }));
  return {
    root,
    update(a) {
      root.position.y = -(a.hits ?? 0) * 0.35;
    },
  };
}

function gate() {
  const root = new THREE.Group();
  const iron = pbr('#3a3a40', { rough: 0.45, metal: 1 });
  const w = 5.2, h = 4.2;
  for (const [ox, oz, ry] of [
    [0, -w / 2, 0],
    [0, w / 2, 0],
    [-w / 2, 0, Math.PI / 2],
    [w / 2, 0, Math.PI / 2],
  ]) {
    const side = new THREE.Group();
    side.position.set(ox, 0, oz);
    side.rotation.y = ry;
    root.add(side);
    for (let i = 0; i <= 8; i++) side.add(mesh(cylinder(1, 1, 10), iron, { x: -w / 2 + (i / 8) * w, y: h / 2, sx: 0.07, sy: h, sz: 0.07 }));
    side.add(mesh(cylinder(1, 1, 10), iron, { y: h, sx: 0.09, sy: w, sz: 0.09, rz: Math.PI / 2 }));
    side.add(mesh(cylinder(1, 1, 10), iron, { y: 0.2, sx: 0.09, sy: w, sz: 0.09, rz: Math.PI / 2 }));
  }
  return { root, update() {} };
}

// Toad: a hop when Mario comes up (he turns to him, ../scene.js), and while
// his words are up, a quicker bob and a sway as he talks; else a breath
const GREET = 600; // units: Mario this near, Toad greets him
const GREET_HOP = 12; // frames
function toadLife() {
  let near = false;
  let hopAt = -99;
  return (a, t, g) => {
    const m = g?.mario;
    const now = Boolean(m) && Math.hypot(m.pos.x - a.pos.x, m.pos.z - a.pos.z) < GREET;
    if (now && !near) hopAt = t;
    near = now;
    const talking = g?.mode === 'dialog' && g.dialogs?.[0]?.title === (a.def?.title ?? 'Toad');
    return {
      hop: hop(t - hopAt, GREET_HOP),
      bob: talking ? Math.abs(Math.sin(t * 0.45)) : Math.abs(Math.sin(t * 0.08)),
      roll: talking ? Math.sin(t * 0.3) * 0.06 : Math.sin(t * 0.04) * 0.03,
      talking,
    };
  };
}
function toadMoves(root, body, life) {
  return (a, t, g) => {
    const s = life(a, t, g);
    body.position.y = s.bob * (s.talking ? 0.035 : 0.025) + s.hop.y * 0.14;
    body.rotation.z = s.roll;
    root.scale.set(2 - s.hop.squash, s.hop.squash, 2 - s.hop.squash);
  };
}

function toad(_, hd) {
  const root = new THREE.Group();
  if (hd) {
    const body = new THREE.Group();
    body.add(hd);
    root.add(body);
    return { root, update: toadMoves(root, body, toadLife()) };
  }
  const spots = canvasTexture('m64-toad-cap', 256, 128, (g, w, h) => {
    g.fillStyle = '#fbfbf6';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e0242c';
    for (const [x, y, r] of [
      [0.15, 0.45, 0.13],
      [0.5, 0.35, 0.16],
      [0.85, 0.45, 0.13],
      [0.32, 0.85, 0.09],
      [0.68, 0.85, 0.09],
    ]) {
      g.beginPath();
      g.arc(x * w, y * h, r * w * 0.5, 0, Math.PI * 2);
      g.fill();
    }
  });
  const capMat = spots ? pbr('#ffffff', { rough: 0.45, clearcoat: 0.6, map: spots }) : pbr('#fbfbf6', { rough: 0.45 });
  const body = new THREE.Group();
  root.add(body);
  body.add(mesh(sphere(), capMat, { y: 1.05, sx: 0.48, sy: 0.38, sz: 0.48 }));
  body.add(mesh(sphere(), pbr('#ffd8b0', { rough: 0.5 }), { y: 0.82, sx: 0.24, sy: 0.24, sz: 0.22 }));
  for (const sx of [-1, 1]) {
    body.add(mesh(sphere(), pupil(), { x: sx * 0.08, y: 0.86, z: 0.2, sx: 0.035, sy: 0.06, sz: 0.02 }));
    body.add(mesh(sphere(), pbr('#4a2a14', { rough: 0.5, clearcoat: 0.4 }), { x: sx * 0.1, y: 0.06, z: 0.03, sx: 0.1, sy: 0.07, sz: 0.14 }));
  }
  body.add(mesh(sphere(), pbr('#2a54c8', { rough: 0.7, sheen: 0.5 }), { y: 0.5, sx: 0.24, sy: 0.22, sz: 0.2 }));
  body.add(mesh(sphere(), pbr('#fbfbf6', { rough: 0.7, sheen: 0.4 }), { y: 0.28, sx: 0.21, sy: 0.17, sz: 0.19 }));
  return { root, update: toadMoves(root, body, toadLife()) };
}

export const CAST = {
  goomba,
  bobomb: (a, hd) => bobombBody({ hd, seed: a?.id ?? 0 }),
  king: (a, hd) => bobombBody({ scale: 2.7, king: true, hd, seed: a?.id ?? 0 }),
  chomp,
  ironball,
  post,
  gate,
  toad,
};
