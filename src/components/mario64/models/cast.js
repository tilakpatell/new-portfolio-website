// The cast, made in code, each with its own little life: Goombas waddle and
// frown, Bob-ombs wind their keys and blink red when lit, King Bob-omb wears
// his crown and moustache, the Chain Chomp gnashes at the end of its chain,
// Toad turns to talk. Each is { root, update(a, t, g) } (t in frames).

import * as THREE from 'three';
import { COLORS, canvasTexture, capsule, cone, cylinder, mesh, pbr, sphere, torus } from './common';

const eyeWhite = () => pbr('#ffffff', { rough: 0.2, clearcoat: 1 });
const pupil = () => pbr('#0c0c0c', { rough: 0.2, clearcoat: 1 });

function goomba() {
  const cap = pbr('#8a4a1f', { rough: 0.55, clearcoat: 0.3 });
  const face = pbr('#f0c99a', { rough: 0.6 });
  const foot = pbr('#3a2214', { rough: 0.5, clearcoat: 0.4 });
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
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
    update(a, t) {
      const flat = a.state === 'flat';
      body.scale.y = flat ? 0.25 : 1;
      body.scale.x = body.scale.z = flat ? 1.3 : 1;
      const k = a.state === 'chase' ? 0.5 : 0.25;
      feet[0].position.z = 0.05 + Math.sin(t * k) * 0.08;
      feet[1].position.z = 0.05 - Math.sin(t * k) * 0.08;
      body.rotation.z = Math.sin(t * k) * 0.06;
      if (a.state === 'knocked') root.rotation.x += 0.4;
    },
  };
}

function bobombBody({ scale = 1, king = false } = {}) {
  const shell = pbr('#1c1c22', { rough: 0.22, clearcoat: 1, metal: 0.3 });
  const lit = pbr('#ff3b2a', { rough: 0.3, clearcoat: 1, emissive: '#ff2200', emissiveIntensity: 0.9 });
  const brass = pbr(COLORS.gold, { rough: 0.3, metal: 1 });
  const feet = pbr('#f2a01f', { rough: 0.45, clearcoat: 0.5 });
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(scale);
  root.add(body);
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
    update(a, t) {
      key.rotation.z = t * 0.12;
      const k = a.state === 'lit' ? 0.6 : 0.25;
      fs[0].position.z = 0.04 + Math.sin(t * k) * 0.07;
      fs[1].position.z = 0.04 - Math.sin(t * k) * 0.07;
      const flash = (a.state === 'lit' || a.state === 'held' || a.state === 'thrown') && Math.floor(t / Math.max(2, 8 - (a.fuse ?? 0) / 20)) % 2 === 0;
      ball.material = flash ? lit : shell;
      spark.visible = a.state !== 'walk' && a.state !== 'wait' && a.state !== 'gone';
      spark.scale.setScalar(0.035 + Math.random() * 0.02);
      root.visible = a.state !== 'gone';
      if (a.state === 'stunned' || a.state === 'defeated') body.rotation.z = Math.sin(t * 0.5) * 0.15;
      else body.rotation.z = 0;
      if (a.state === 'defeated') body.scale.setScalar(scale * Math.max(0.01, 1 - (t % 60) / 60));
    },
  };
}

function chomp() {
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
  upper.add(mesh(half(true), shell));
  lower.add(mesh(half(false), shell));
  upper.add(mesh(new THREE.CircleGeometry(1.42, 48), mouth, { rx: Math.PI / 2, y: -0.01 }));
  lower.add(mesh(new THREE.CircleGeometry(1.42, 48), mouth, { rx: -Math.PI / 2, y: 0.01 }));
  for (let i = 0; i < 9; i++) {
    const ang = -0.95 + (i / 8) * 1.9;
    upper.add(mesh(cone(10), tooth, { x: Math.sin(ang) * 1.32, y: -0.12, z: Math.cos(ang) * 1.32, sx: 0.14, sy: 0.3, sz: 0.14, rx: Math.PI }));
    lower.add(mesh(cone(10), tooth, { x: Math.sin(ang + 0.1) * 1.32, y: 0.12, z: Math.cos(ang + 0.1) * 1.32, sx: 0.14, sy: 0.3, sz: 0.14 }));
  }
  for (const sx of [-1, 1]) {
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
      const open = a.state === 'lunge' ? 0.55 : 0.12 + Math.max(0, Math.sin(t * 0.35)) * 0.25;
      upper.rotation.x = -open;
      lower.rotation.x = open * 0.5;
      head.position.y = 1.5 + Math.abs(Math.sin(t * 0.3)) * (a.state === 'idle' ? 0.15 : 0);
      const post = g?.actors.find((x) => x.type === 'post' && x.def.id === a.def.post);
      chain.visible = Boolean(post) && a.state !== 'free' && a.state !== 'gone';
      if (post) {
        // links in the chomp's own frame (it is turned by its yaw)
        const dx = (post.pos.x - a.pos.x) * 0.01, dz = (post.pos.z - a.pos.z) * 0.01;
        const c = Math.cos(-a.yaw), s = Math.sin(-a.yaw);
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

function toad() {
  const root = new THREE.Group();
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
  return {
    root,
    update(a, t) {
      body.position.y = Math.abs(Math.sin(t * 0.08)) * 0.02;
    },
  };
}

export const CAST = {
  goomba,
  bobomb: () => bobombBody(),
  king: () => bobombBody({ scale: 2.7, king: true }),
  chomp,
  ironball,
  post,
  gate,
  toad,
};
