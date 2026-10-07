// The exhibits' props, modelled here: each a group about a metre across,
// standing on y = 0, for its glass case. Exhibit Zero's square glasses, the
// snacks never eaten, a film reel, a speech bubble, a bowl of hot cereal, a
// laptop on its blue screen, the shoe a toe came through, a clapperboard, a
// briefcase, a Kohl's-red shopping bag at 4 a.m., and a broken heart.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { bsodTexture, wordTexture } from './textures';
import { sharpen } from '../../lib/three/textures';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0, ...o });
const gold = () => std(0xe0aa3e, { metalness: 1, roughness: 0.22 });

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// a rectangle's outline as a tube of square section: the glasses' rims
function squareRim(w, h, t, mat) {
  const g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(w, t, t, 2, t * 0.3), mat, 0, h / 2 - t / 2, 0));
  g.add(mesh(new RoundedBoxGeometry(w, t, t, 2, t * 0.3), mat, 0, -h / 2 + t / 2, 0));
  g.add(mesh(new RoundedBoxGeometry(t, h, t, 2, t * 0.3), mat, w / 2 - t / 2, 0, 0));
  g.add(mesh(new RoundedBoxGeometry(t, h, t, 2, t * 0.3), mat, -w / 2 + t / 2, 0, 0));
  return g;
}

function glasses() {
  const g = new THREE.Group();
  const frame = std(0x15110f, { roughness: 0.3, metalness: 0.2 });
  const lens = new THREE.MeshPhysicalMaterial({ color: 0x9fc4ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, clearcoat: 1, envMapIntensity: 2 });
  const w = 0.42;
  const h = 0.34;
  const t = 0.05;
  for (const side of [-1, 1]) {
    const rim = squareRim(w, h, t, frame);
    rim.position.x = side * (w / 2 + 0.05);
    g.add(rim);
    g.add(mesh(new THREE.PlaneGeometry(w - t, h - t), lens, side * (w / 2 + 0.05), 0, 0));
    // the arms, folded back
    const arm = mesh(new THREE.BoxGeometry(t * 0.7, t * 0.7, 0.62), frame, side * (w + 0.05 - t / 2), h / 2 - t, -0.31);
    g.add(arm);
  }
  g.add(mesh(new THREE.BoxGeometry(0.12, t * 0.8, t * 0.8), frame, 0, h / 2 - t * 1.2, 0));
  g.position.y = 0.45;
  const wrap = new THREE.Group();
  wrap.add(g);
  return wrap;
}

function snacks() {
  const g = new THREE.Group();
  // a Capri Sun pouch
  const pouch = mesh(new RoundedBoxGeometry(0.34, 0.5, 0.06, 3, 0.03), std(0xc9d2dc, { metalness: 0.9, roughness: 0.25 }), -0.32, 0.25, 0);
  pouch.rotation.z = 0.08;
  g.add(pouch);
  g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3), std(0xffe14a), -0.26, 0.6, 0.02));
  // Go-Gurt tubes, fanned
  const tubeColors = [0x7a3cff, 0xff3c8a, 0x23c3ff];
  tubeColors.forEach((c, i) => {
    const t = mesh(new THREE.CapsuleGeometry(0.035, 0.5, 4, 12), std(c, { roughness: 0.35 }), 0.05 + i * 0.09, 0.3, 0.1);
    t.rotation.z = -0.25 + i * 0.12;
    g.add(t);
  });
  // a Babybel, unopened
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 32), std(0xd4141e, { roughness: 0.3 }), 0.34, 0.04, 0.22));
  // Airheads and a Laffy Taffy, in a heap
  [0xff3b30, 0x34c759, 0x007aff, 0xffcc00].forEach((c, i) => {
    const b = mesh(new RoundedBoxGeometry(0.34, 0.03, 0.09, 2, 0.01), std(c), 0.25 - i * 0.05, 0.02 + i * 0.03, -0.18 + i * 0.03);
    b.rotation.y = i * 0.5;
    g.add(b);
  });
  // a baby carrot, raw, rejected
  const carrot = mesh(new THREE.ConeGeometry(0.03, 0.16, 12), std(0xff7a1a, { roughness: 0.6 }), -0.1, 0.03, 0.28);
  carrot.rotation.z = Math.PI / 2;
  g.add(carrot);
  return g;
}

function reel() {
  const g = new THREE.Group();
  const metal = std(0xb9bec6, { metalness: 1, roughness: 0.3 });
  const disc = new THREE.Shape();
  disc.absarc(0, 0, 0.42, 0, Math.PI * 2);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.09, 0, Math.PI * 2, true);
    disc.holes.push(h);
  }
  const hub = new THREE.Path();
  hub.absarc(0, 0, 0.04, 0, Math.PI * 2, true);
  disc.holes.push(hub);
  const geo = new THREE.ExtrudeGeometry(disc, { depth: 0.02, bevelEnabled: false, curveSegments: 32 });
  const a = mesh(geo, metal, 0, 0.5, 0.06);
  const b = mesh(geo, metal, 0, 0.5, -0.08);
  g.add(a, b);
  g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 48), std(0x1a1310, { roughness: 0.6 }), 0, 0.5, 0).rotateX(Math.PI / 2));
  // the strip, trailing off
  const strip = mesh(new THREE.BoxGeometry(0.7, 0.002, 0.1), std(0x221813, { roughness: 0.4 }), 0.45, 0.06, 0.1);
  strip.rotation.z = 0.12;
  g.add(strip);
  return g;
}

async function speech(ex) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-0.5, -0.1);
  s.quadraticCurveTo(-0.55, 0.32, 0, 0.34);
  s.quadraticCurveTo(0.55, 0.32, 0.5, -0.1);
  s.quadraticCurveTo(0.45, -0.32, 0, -0.32);
  s.lineTo(-0.18, -0.32);
  s.lineTo(-0.36, -0.5);
  s.lineTo(-0.3, -0.28);
  s.quadraticCurveTo(-0.5, -0.24, -0.5, -0.1);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, curveSegments: 24 });
  geo.translate(0, 0, -0.04);
  const body = mesh(geo, std(0xfff7e6, { roughness: 0.5 }), 0, 0.6, 0);
  g.add(body);
  // the word is the exhibit's first, out of the sealed exhibits
  const word = await wordTexture(String(ex?.word ?? ex?.items?.[0] ?? '…').toUpperCase());
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.41), new THREE.MeshBasicMaterial({ map: word, toneMapped: false }));
  face.position.set(0, 0.62, 0.065);
  g.add(face);
  const back = face.clone();
  back.rotation.y = Math.PI;
  back.position.z = -0.065;
  g.add(back);
  return g;
}

function cereal() {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector2(0.12 + Math.sin(t * Math.PI * 0.5) * 0.3, t * 0.26));
  }
  const bowl = mesh(new THREE.LatheGeometry(pts, 48), std(0xf3efe6, { roughness: 0.25, side: THREE.DoubleSide }), 0, 0, 0);
  g.add(bowl);
  g.add(mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.01, 48), std(0xfffaf0, { roughness: 0.2 }), 0, 0.22, 0));
  const ring = new THREE.TorusGeometry(0.035, 0.014, 8, 16);
  const colors = [0xffb020, 0xff4b2b, 0x7bd23a, 0xa45cff];
  for (let k = 0; k < 34; k++) {
    const r = Math.sqrt((k * 0.618) % 1) * 0.33;
    const a = k * 2.4;
    const o = mesh(ring, std(colors[k % 4], { roughness: 0.7 }), Math.cos(a) * r, 0.235, Math.sin(a) * r);
    o.rotation.set(Math.PI / 2 + (k % 3) * 0.3, 0, k);
    g.add(o);
  }
  g.add(mesh(new THREE.BoxGeometry(0.05, 0.02, 0.5), std(0xc0c4ca, { metalness: 1, roughness: 0.2 }), 0.25, 0.3, 0).rotateZ(-0.6));
  g.userData.steam = true; // the room adds the steam
  return g;
}

function laptop() {
  const g = new THREE.Group();
  const shell = std(0x2b2f36, { metalness: 0.6, roughness: 0.35 });
  g.add(mesh(new RoundedBoxGeometry(0.8, 0.04, 0.55, 2, 0.015), shell, 0, 0.02, 0));
  // the trackpad, crossed out in red tape
  g.add(mesh(new THREE.BoxGeometry(0.26, 0.004, 0.16), std(0x3a3f47), 0, 0.042, 0.15));
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.3, 0.006, 0.03), std(0xd4141e), 0, 0.046, 0.15).rotateY(s * 0.5));
  const lid = new THREE.Group();
  lid.add(mesh(new RoundedBoxGeometry(0.8, 0.52, 0.03, 2, 0.012), shell, 0, 0.26, 0));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.46), new THREE.MeshBasicMaterial({ map: bsodTexture(), toneMapped: false }));
  screen.position.set(0, 0.26, 0.017);
  lid.add(screen);
  lid.position.set(0, 0.04, -0.27);
  lid.rotation.x = -0.25;
  g.add(lid);
  // and the mouse it's had ever since
  g.add(mesh(new THREE.CapsuleGeometry(0.04, 0.06, 4, 12), std(0x111111, { roughness: 0.3 }), 0.55, 0.04, 0.15).rotateX(Math.PI / 2));
  return g;
}

function shoe() {
  const g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(0.34, 0.08, 0.86, 3, 0.04), std(0xf2f2f2, { roughness: 0.7 }), 0, 0.04, 0));
  const upper = mesh(new THREE.CapsuleGeometry(0.15, 0.48, 6, 16), std(0x2d4fd6, { roughness: 0.75 }), 0, 0.2, 0.02);
  upper.rotation.x = Math.PI / 2;
  upper.scale.set(1, 1, 0.85);
  g.add(upper);
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.18, 24), std(0x2d4fd6, { roughness: 0.75 }), 0, 0.3, -0.24));
  // the toe that came through the top
  g.add(mesh(new THREE.SphereGeometry(0.06, 20, 12), std(0xc98b62, { roughness: 0.55 }), 0.03, 0.32, 0.26));
  g.add(mesh(new THREE.SphereGeometry(0.04, 16, 10), std(0xd9a07a, { roughness: 0.4 }), 0.03, 0.36, 0.29));
  // laces
  for (let k = 0; k < 4; k++) g.add(mesh(new THREE.BoxGeometry(0.2, 0.012, 0.02), std(0xffffff), 0, 0.34, -0.08 + k * 0.07));
  return g;
}

function clapper() {
  const g = new THREE.Group();
  const black = std(0x111111, { roughness: 0.5 });
  g.add(mesh(new THREE.BoxGeometry(0.7, 0.5, 0.04), black, 0, 0.32, 0));
  const stripes = (y, rot) => {
    const arm = new THREE.Group();
    arm.add(mesh(new THREE.BoxGeometry(0.72, 0.1, 0.045), black, 0.36, 0, 0));
    for (let k = 0; k < 5; k++) {
      const s = mesh(new THREE.BoxGeometry(0.07, 0.102, 0.047), std(0xffffff), 0.06 + k * 0.14, 0, 0);
      s.rotation.z = 0.5;
      arm.add(s);
    }
    arm.position.set(-0.36, y, 0);
    arm.rotation.z = rot;
    return arm;
  };
  g.add(stripes(0.62, 0));
  g.add(stripes(0.72, 0.35));
  // a chalk line: RRR → PANDA
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.012, 0.002), std(0xffffff), 0, 0.3, 0.022));
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.012, 0.002), std(0xffffff), 0, 0.18, 0.022));
  return g;
}

function briefcase() {
  const g = new THREE.Group();
  const leather = std(0x5a3418, { roughness: 0.55 });
  g.add(mesh(new RoundedBoxGeometry(0.7, 0.5, 0.18, 3, 0.03), leather, 0, 0.25, 0));
  const handle = mesh(new THREE.TorusGeometry(0.1, 0.02, 10, 24, Math.PI), std(0x2a170b), 0, 0.5, 0);
  g.add(handle);
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.06, 0.05, 0.19), gold(), s * 0.2, 0.42, 0));
  // 20 applications, 2 interviews
  for (let k = 0; k < 6; k++) {
    const p = mesh(new THREE.BoxGeometry(0.3, 0.004, 0.4), std(0xfdfcf8), -0.55 + (k % 2) * 0.05, 0.004 + k * 0.006, 0.1);
    p.rotation.y = k * 0.17;
    g.add(p);
  }
  return g;
}

function bag() {
  const g = new THREE.Group();
  const red = std(0xb5122e, { roughness: 0.6 });
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.6, 0.22), red, 0, 0.3, 0));
  for (const z of [-0.08, 0.08]) g.add(mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 24, Math.PI), std(0x1a0a0a), 0, 0.6, z));
  // a clock at 4:00
  const face = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 32), std(0xfdf8ec), 0, 0.32, 0.12);
  face.rotation.x = Math.PI / 2;
  g.add(face);
  const hand = (len, angle) => {
    const h = mesh(new THREE.BoxGeometry(0.012, len, 0.006), std(0x111111), 0, 0.32, 0.135);
    h.geometry.translate(0, len / 2, 0);
    h.rotation.z = -angle;
    return h;
  };
  g.add(hand(0.07, (4 / 12) * Math.PI * 2), hand(0.11, 0));
  return g;
}

function heart() {
  const g = new THREE.Group();
  // half a heart, from the point at the bottom round one lobe to the notch;
  // the other half is its mirror, and the two lean apart: friendzoned
  const s = new THREE.Shape();
  s.moveTo(0, -0.3);
  s.bezierCurveTo(-0.08, -0.2, -0.42, 0.0, -0.36, 0.2);
  s.bezierCurveTo(-0.3, 0.4, -0.06, 0.38, 0, 0.22);
  s.lineTo(-0.03, 0.12);
  s.lineTo(0.02, 0.02);
  s.lineTo(-0.025, -0.1);
  s.lineTo(0, -0.3);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 32 });
  geo.translate(0, 0, -0.06);
  const mat = std(0xe0193a, { roughness: 0.2, metalness: 0.1, emissive: 0x400010 });
  for (const side of [-1, 1]) {
    const half = mesh(geo, mat, side * 0.06, 0.62, 0);
    half.scale.x = -side;
    half.rotation.z = side * -0.14;
    g.add(half);
  }
  return g;
}

// an old TV on its feet, the screen cracked (it isn't: that was the prank)
function tv() {
  const g = new THREE.Group();
  const shell = std(0x2a2522, { roughness: 0.5 });
  g.add(mesh(new RoundedBoxGeometry(0.9, 0.56, 0.08, 3, 0.02), shell, 0, 0.42, 0));
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 300;
  const k = c.getContext('2d');
  const grd = k.createLinearGradient(0, 0, 512, 300);
  grd.addColorStop(0, '#1b2a4a');
  grd.addColorStop(1, '#0a0f1c');
  k.fillStyle = grd;
  k.fillRect(0, 0, 512, 300);
  // the crack, spreading from where it "hit"
  k.strokeStyle = 'rgba(235,240,255,0.9)';
  k.lineCap = 'round';
  const hit = [330, 120];
  for (let a = 0; a < 14; a++) {
    let [x, y] = hit;
    const ang = (a / 14) * Math.PI * 2 + 0.2;
    k.lineWidth = 2.4;
    k.beginPath();
    k.moveTo(x, y);
    for (let seg = 0; seg < 6; seg++) {
      x += Math.cos(ang + Math.sin(seg * 3 + a) * 0.4) * (22 + seg * 9);
      y += Math.sin(ang + Math.cos(seg * 2 + a) * 0.4) * (22 + seg * 9);
      k.lineTo(x, y);
      k.lineWidth = Math.max(0.6, k.lineWidth - 0.35);
    }
    k.stroke();
  }
  for (const rad of [16, 38, 70]) {
    k.lineWidth = 1.2;
    k.beginPath();
    k.arc(hit[0], hit[1], rad, 0, Math.PI * 2);
    k.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  sharpen(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.48), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.set(0, 0.42, 0.041);
  g.add(screen);
  for (const s of [-1, 1]) {
    const leg = mesh(new THREE.BoxGeometry(0.03, 0.16, 0.03), shell, s * 0.3, 0.07, 0);
    leg.rotation.z = s * 0.35;
    g.add(leg);
  }
  return g;
}

// a big gold question mark: the things he did not know
function question() {
  const g = new THREE.Group();
  const goldish = std(0xf0c24a, { metalness: 1, roughness: 0.2 });
  const hook = mesh(new THREE.TorusGeometry(0.2, 0.06, 16, 40, Math.PI * 1.35), goldish, 0, 0.78, 0);
  hook.rotation.z = -Math.PI * 0.35;
  g.add(hook);
  const stem = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 20), goldish, 0, 0.44, 0);
  g.add(stem);
  g.add(mesh(new THREE.SphereGeometry(0.075, 24, 16), goldish, 0, 0.16, 0));
  return g;
}

const MAKERS = { glasses, snacks, reel, speech, cereal, laptop, shoe, clapper, briefcase, bag, heart, tv, question };

export async function makeProp(kind, ex) {
  const make = MAKERS[kind] ?? snacks;
  return make(ex);
}
