// Mario, made in code: a jointed body (hips, spine, head, two arms and two
// legs, each in two parts) of smooth shapes in physically based materials:
// the red cap with its M, the moustache, the blue overalls with gold
// buttons, white gloves, brown shoes. pose.js says where every joint is;
// apply() puts it there. It stands in until a loaded model replaces it, and
// is the one used when nothing can be loaded.

import * as THREE from 'three';
import { JOINTS } from '../pose';
import { COLORS, canvasTexture, capsule, cylinder, mesh, pbr, sphere, torus } from './common';

const HIP_Y = 0.62;
const CENTRE = 0.8; // where he spins about, for the flips

function emblem() {
  return canvasTexture('m64-cap-m', 256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(w / 2, h / 2, w * 0.47, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = COLORS.red;
    g.font = `900 ${Math.round(h * 0.62)}px "Arial Black", Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('M', w / 2, h * 0.54);
  });
}

function eyeTexture() {
  return canvasTexture('m64-eye', 128, 192, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    const grad = g.createRadialGradient(w * 0.55, h * 0.52, 4, w * 0.55, h * 0.55, w * 0.42);
    grad.addColorStop(0, '#5aa9ff');
    grad.addColorStop(0.7, '#1f5fd6');
    grad.addColorStop(1, '#0b2c78');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(w * 0.55, h * 0.55, w * 0.36, h * 0.3, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#0a0a12';
    g.beginPath();
    g.ellipse(w * 0.57, h * 0.56, w * 0.17, h * 0.15, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(w * 0.47, h * 0.45, w * 0.07, 0, Math.PI * 2);
    g.fill();
  });
}

export function makeMario() {
  const red = pbr(COLORS.red, { rough: 0.62, sheen: 0.5, sheenColor: '#ff9a9a' });
  const blue = pbr(COLORS.blue, { rough: 0.78, sheen: 0.6, sheenColor: '#7aa0ff' });
  const skin = pbr(COLORS.skin, { rough: 0.48, sheen: 0.25, sheenColor: '#ffd9c0' });
  const glove = pbr(COLORS.white, { rough: 0.55, sheen: 0.4 });
  const shoe = pbr(COLORS.brown, { rough: 0.35, clearcoat: 0.7 });
  const hair = pbr(COLORS.hair, { rough: 0.85 });
  const gold = pbr(COLORS.gold, { rough: 0.28, metal: 1 });
  const em = emblem();
  const eyeMap = eyeTexture();
  const eye = eyeMap ? pbr('#ffffff', { rough: 0.15, clearcoat: 1, map: eyeMap }) : pbr('#ffffff', { rough: 0.15 });

  const root = new THREE.Group();
  const offset = new THREE.Group();
  const spin = new THREE.Group();
  const body = new THREE.Group();
  root.add(offset);
  offset.add(spin);
  spin.position.y = CENTRE;
  spin.add(body);
  body.position.y = -CENTRE;

  const J = {};
  const joint = (name, parent, x, y, z) => {
    const j = new THREE.Group();
    j.position.set(x, y, z);
    parent.add(j);
    J[name] = j;
    return j;
  };

  // hips: the seat of the overalls
  const hips = joint('hips', body, 0, HIP_Y, 0);
  hips.add(mesh(sphere(), blue, { y: 0.02, sx: 0.25, sy: 0.19, sz: 0.21 }));

  // the torso: the red shirt, the overalls' bib and straps, two buttons
  const spine = joint('spine', hips, 0, 0.04, 0);
  spine.add(mesh(sphere(), red, { y: 0.26, sx: 0.27, sy: 0.28, sz: 0.23 }));
  spine.add(mesh(sphere(), blue, { y: 0.1, sx: 0.265, sy: 0.17, sz: 0.225 }));
  spine.add(mesh(sphere(), blue, { y: 0.27, z: 0.085, sx: 0.17, sy: 0.15, sz: 0.15 }));
  for (const sx of [-1, 1]) {
    spine.add(mesh(capsule(0.3), blue, { x: sx * 0.12, y: 0.36, z: 0.04, sx: 0.04, sy: 0.6, sz: 0.04, rx: -0.25 }));
    spine.add(mesh(sphere(), gold, { x: sx * 0.11, y: 0.32, z: 0.215, sx: 0.04, sy: 0.04, sz: 0.025 }));
  }

  // the head: face, nose, moustache, eyes, ears, hair, and the cap
  const head = joint('head', spine, 0, 0.5, 0.02);
  head.add(mesh(sphere(), skin, { y: 0.16, sx: 0.25, sy: 0.25, sz: 0.24 }));
  head.add(mesh(sphere(), skin, { y: 0.11, z: 0.25, sx: 0.085, sy: 0.075, sz: 0.085 }));
  for (const sx of [-1, 1]) {
    // the moustache in two curls, the eyes, the ears, the sideburns
    head.add(mesh(sphere(), hair, { x: sx * 0.07, y: 0.04, z: 0.235, sx: 0.085, sy: 0.04, sz: 0.04, rz: sx * -0.35 }));
    head.add(mesh(sphere(), eye, { x: sx * 0.075, y: 0.215, z: 0.205, sx: 0.048, sy: 0.07, sz: 0.035, ry: sx * 0.18 }));
    head.add(mesh(sphere(), hair, { x: sx * 0.085, y: 0.3, z: 0.215, sx: 0.045, sy: 0.012, sz: 0.012, rz: sx * 0.15 }));
    head.add(mesh(sphere(), skin, { x: sx * 0.245, y: 0.15, z: -0.01, sx: 0.04, sy: 0.065, sz: 0.04 }));
    head.add(mesh(sphere(), hair, { x: sx * 0.22, y: 0.18, z: 0.06, sx: 0.04, sy: 0.08, sz: 0.06 }));
  }
  head.add(mesh(sphere(), hair, { y: 0.14, z: -0.13, sx: 0.23, sy: 0.15, sz: 0.14 }));
  const cap = new THREE.Group();
  cap.position.set(0, 0.22, -0.01);
  cap.rotation.x = -0.12;
  head.add(cap);
  cap.add(mesh(sphere(), red, { y: 0.02, sx: 0.27, sy: 0.22, sz: 0.27 }));
  cap.add(mesh(cylinder(1, 1, 40), red, { y: 0.0, z: 0.16, sx: 0.24, sy: 0.02, sz: 0.2 }));
  if (em) {
    const disc = mesh(new THREE.CircleGeometry(0.085, 40), pbr('#ffffff', { rough: 0.5, map: em, transparent: true }), { y: 0.08, z: 0.245, rx: -0.38, shadow: false });
    cap.add(disc);
  }

  // arms: shoulder, elbow, a gloved hand with its cuff
  for (const [name, sx] of [
    ['L', 1],
    ['R', -1],
  ]) {
    const arm = joint(`arm${name}`, spine, sx * 0.3, 0.4, 0);
    arm.add(mesh(capsule(1.6), red, { y: -0.11, sx: 0.075, sy: 0.075, sz: 0.075 }));
    const fore = joint(`fore${name}`, arm, 0, -0.24, 0);
    fore.add(mesh(capsule(1.4), red, { y: -0.09, sx: 0.065, sy: 0.065, sz: 0.065 }));
    fore.add(mesh(torus(0.35), glove, { y: -0.2, sx: 0.075, sy: 0.075, sz: 0.075, rx: Math.PI / 2 }));
    fore.add(mesh(sphere(), glove, { y: -0.27, sx: 0.1, sy: 0.095, sz: 0.1 }));
    fore.add(mesh(sphere(), glove, { x: -sx * 0.06, y: -0.24, z: 0.06, sx: 0.04, sy: 0.05, sz: 0.04, rz: sx * 0.6 }));
  }

  // legs: hip, knee, a big brown shoe
  for (const [name, sx] of [
    ['L', 1],
    ['R', -1],
  ]) {
    const leg = joint(`leg${name}`, hips, sx * 0.12, -0.06, 0);
    leg.add(mesh(capsule(1.0), blue, { y: -0.12, sx: 0.105, sy: 0.105, sz: 0.105 }));
    const shin = joint(`shin${name}`, leg, 0, -0.25, 0);
    shin.add(mesh(capsule(1.0), blue, { y: -0.1, sx: 0.095, sy: 0.095, sz: 0.095 }));
    shin.add(mesh(sphere(), shoe, { y: -0.27, z: 0.07, sx: 0.12, sy: 0.085, sz: 0.19 }));
  }

  for (const j of JOINTS) if (!J[j]) throw new Error(`no joint ${j}`);
  const rest = Object.fromEntries(JOINTS.map((j) => [j, J[j].position.clone()]));

  return {
    root,
    joints: J,
    hands: [J.foreL, J.foreR],
    // pose.js's pose onto the joints
    apply(p) {
      for (const j of JOINTS) {
        const r = p.joints[j];
        J[j].rotation.set(r[0], r[1], r[2]);
      }
      J.hips.position.y = rest.hips.y + p.lift;
      body.scale.set(1 + (1 - p.squash) * 0.6, p.squash, 1 + (1 - p.squash) * 0.6);
      spin.rotation.set(p.spin[0], p.spin[1], p.spin[2]);
      offset.position.set(p.offset[0], p.offset[1], p.offset[2]);
    },
    // blinking while hurt
    setVisible(on) {
      body.visible = on;
    },
  };
}
