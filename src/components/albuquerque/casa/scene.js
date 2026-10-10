// Face Off at Casa Tranquila, in 3D: a room in the rest home, Hector in his
// wheelchair with the bell on its tray, and the nurse holding up the letter
// board, her finger on the lit row or letter. The last word spelled, she
// leaves as Gus walks in; three rings and the room goes up: a flash, a
// fireball, smoke and debris, the walls scorched. When the smoke clears, Gus
// straightens his tie and walks out. No gore: Hector and his chair are gone
// in the smoke.
//
// createCasa3D(canvas) resolves once the room is dressed and the people are
// in, to { render(state, ms), ring(), resize(w, h), info(), dispose(), lost };
// it rejects if the people can't be had (the page shows the 2D games).
// `state` is the rules' (rules.js); the scene keeps its own clock for the
// finale.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createStage } from '../../office/stage3d';
import { houseOn } from '../../../lib/three/house';
import { loadPeople } from '../../office/people';
import { turn } from '../../../lib/three/gait';
import { loadPbr, loadTexture } from '../../../lib/hdri';
import { ABQ } from '../wardrobe';
import { ROWS } from './rules';
import { sharpen } from '../../../lib/three/textures';

const SEAT = 0.48; // the wheelchair's seat
const HECTOR = new THREE.Vector3(-0.25, 0, 0.62);
const FACING = Math.PI + 0.15; // Hector faces the nurse, the board turned a little to us
const NURSE = new THREE.Vector3(-0.25 - Math.sin(0.15) * 1.0, 0, 0.62 - Math.cos(0.15) * 1.0);
const DOOR = new THREE.Vector3(2.15, 0, -1.25); // the doorway, in the right-hand wall
const GUS = new THREE.Vector3(NURSE.x + 0.12, 0, NURSE.z + 0.05); // where he stands, facing Hector
const BOARD = { w: 0.58, h: 0.42, at: new THREE.Vector3(0, 1.16, 0.32) }; // in the nurse's hands (her frame)
const CAMERA = { at: new THREE.Vector3(1.05, 1.62, 2.55), look: new THREE.Vector3(-0.32, 1.02, -0.3) };
const ROOM = { x0: -2.4, x1: 2.4, z0: -2.3, h: 2.7 };
const WINDOW = { x: -0.7, y0: 0.95, y1: 2.15, w: 1.6 };

const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const ease = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// The letter board: cream card, black letters, the lit row or letter in
// yellow. Cells are in a 6 × 5 grid with a strip for the word along the foot.
const GRID = { left: 0.06, top: 0.07, cw: 0.88 / 6, ch: 0.7 / 5 };
const cellUV = (row, col) => [GRID.left + (col + 0.5) * GRID.cw, GRID.top + (row + 0.5) * GRID.ch];
function paintBoard(ctx, s) {
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = '#efe7d2';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#7d6b4c';
  ctx.lineWidth = W * 0.012;
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
  const playing = s.phase === 'rows' || s.phase === 'letters';
  ROWS.forEach((letters, r) => {
    const rowLit = playing && s.row === r;
    if (rowLit) {
      ctx.fillStyle = s.phase === 'rows' ? '#f6d860' : '#f8eab4';
      ctx.fillRect(GRID.left * W, (GRID.top + r * GRID.ch) * H, 6 * GRID.cw * W, GRID.ch * H);
    }
    [...letters].forEach((ch, c) => {
      const [u, v] = cellUV(r, c);
      if (rowLit && s.phase === 'letters' && c === s.col % letters.length) {
        ctx.fillStyle = '#f2b01e';
        ctx.fillRect((u - GRID.cw / 2) * W + 3, (v - GRID.ch / 2) * H + 3, GRID.cw * W - 6, GRID.ch * H - 6);
      }
      ctx.fillStyle = '#1d1a16';
      ctx.font = `700 ${Math.round(GRID.ch * H * 0.66)}px Georgia, 'Times New Roman', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, u * W, v * H + GRID.ch * H * 0.04);
    });
  });
  // the word so far, along the foot
  const word = s.words[s.w] ?? '';
  const shown = [...word].map((ch, i) => (i < s.typed.length ? ch : '_')).join(' ');
  ctx.fillStyle = '#3b3226';
  ctx.font = `700 ${Math.round(H * 0.11)}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(playing ? shown : s.phase === 'gus' || s.phase === 'bell' ? 'DING  DING  DING' : '', W / 2, H * 0.89);
}

// The desert through the window: sky, mesas, scrub.
function paintDesert() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 330);
  sky.addColorStop(0, '#7fb2db');
  sky.addColorStop(1, '#f2dcb4');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 512);
  g.fillStyle = '#b07a52';
  g.beginPath();
  g.moveTo(0, 330);
  for (const [x, y] of [[90, 300], [160, 252], [300, 250], [340, 300], [520, 318], [600, 268], [740, 264], [780, 306], [1024, 312]]) g.lineTo(x, y);
  g.lineTo(1024, 512);
  g.lineTo(0, 512);
  g.fill();
  const ground = g.createLinearGradient(0, 320, 0, 512);
  ground.addColorStop(0, '#d2ad78');
  ground.addColorStop(1, '#b98f5c');
  g.fillStyle = ground;
  g.fillRect(0, 330, 1024, 182);
  g.fillStyle = '#6f7a4a';
  for (let i = 0; i < 60; i++) {
    const x = (i * 197) % 1024;
    const y = 345 + ((i * 89) % 150);
    g.beginPath();
    g.ellipse(x, y, 6 + (i % 5) * 2, 3 + (i % 3), 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function createCasa3D(canvas, { onLost, onSlow } = {}) {
  const stage = createStage(canvas, { onLost, onSlow, fov: 44 });
  const { renderer, scene, camera } = stage;
  scene.background = new THREE.Color(0x1d1a17);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.45;
  camera.position.copy(CAMERA.at);
  camera.lookAt(CAMERA.look);

  // ── light: the afternoon through the window, a ceiling light, the room's bounce ──
  const hemi = new THREE.HemisphereLight(0xfff6e8, 0x7a6e60, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe0b0, 2.4);
  sun.position.set(WINDOW.x - 1.2, 4.2, ROOM.z0 - 3.5);
  sun.target.position.set(0.2, 0, 0.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(stage.coarse ? 1024 : 2048, stage.coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 14 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const lamp = new THREE.PointLight(0xfff1dc, 5, 7, 1.6);
  lamp.position.set(0.2, ROOM.h - 0.25, 0);
  scene.add(lamp);
  const flash = new THREE.PointLight(0xffa04a, 0, 9, 1.5);
  scene.add(flash);

  // ── the room ──
  const owned = []; // textures and materials made here, to dispose
  const mat = (o) => {
    const m = new THREE.MeshStandardMaterial(o);
    owned.push(m);
    return m;
  };
  const shadowy = (o) => {
    o.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return o;
  };
  const box = (w, h, d, material, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    return m;
  };
  const wallMat = mat({ color: 0xe8dcc4, roughness: 0.9 });
  const floorMat = mat({ color: 0xb8a98c, roughness: 0.7 });
  const trimMat = mat({ color: 0xf1ede4, roughness: 0.6 });
  const W = ROOM.x1 - ROOM.x0;
  const D = 2.8 - ROOM.z0;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, (ROOM.z0 + 2.8) / 2);
  floor.receiveShadow = true;
  scene.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat({ color: 0xf2eee6, roughness: 0.95 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, ROOM.h, floor.position.z);
  scene.add(ceiling);
  // the back wall, with the window cut out (UVs in metres)
  const back = new THREE.Shape([new THREE.Vector2(ROOM.x0, 0), new THREE.Vector2(ROOM.x1, 0), new THREE.Vector2(ROOM.x1, ROOM.h), new THREE.Vector2(ROOM.x0, ROOM.h)]);
  back.holes.push(new THREE.Path([new THREE.Vector2(WINDOW.x - WINDOW.w / 2, WINDOW.y0), new THREE.Vector2(WINDOW.x + WINDOW.w / 2, WINDOW.y0), new THREE.Vector2(WINDOW.x + WINDOW.w / 2, WINDOW.y1), new THREE.Vector2(WINDOW.x - WINDOW.w / 2, WINDOW.y1)]));
  const backWall = new THREE.Mesh(new THREE.ShapeGeometry(back), wallMat);
  backWall.position.z = ROOM.z0;
  const side = (x, ry) => {
    const g = new THREE.PlaneGeometry(D, ROOM.h);
    g.translate(0, ROOM.h / 2, 0);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * D, uv.getY(i) * ROOM.h);
    const m = new THREE.Mesh(g, wallMat);
    m.position.set(x, 0, floor.position.z);
    m.rotation.y = ry;
    return m;
  };
  const leftWall = side(ROOM.x0, Math.PI / 2);
  const rightWall = side(ROOM.x1, -Math.PI / 2);
  for (const w of [backWall, leftWall, rightWall]) w.receiveShadow = true;
  scene.add(backWall, leftWall, rightWall);
  // skirting along the walls
  scene.add(box(W, 0.1, 0.02, trimMat, 0, 0.05, ROOM.z0 + 0.01), box(0.02, 0.1, D, trimMat, ROOM.x0 + 0.01, 0.05, floor.position.z), box(0.02, 0.1, D, trimMat, ROOM.x1 - 0.01, 0.05, floor.position.z));
  // the window: frame, mullions, glass, the desert beyond
  const frameMat = mat({ color: 0xf4f1ea, roughness: 0.5 });
  const wy = (WINDOW.y0 + WINDOW.y1) / 2;
  const wh = WINDOW.y1 - WINDOW.y0;
  const win = new THREE.Group();
  win.add(
    box(WINDOW.w + 0.12, 0.06, 0.12, frameMat, WINDOW.x, WINDOW.y0 - 0.03, ROOM.z0),
    box(WINDOW.w + 0.12, 0.06, 0.12, frameMat, WINDOW.x, WINDOW.y1 + 0.03, ROOM.z0),
    box(0.06, wh, 0.12, frameMat, WINDOW.x - WINDOW.w / 2 - 0.03, wy, ROOM.z0),
    box(0.06, wh, 0.12, frameMat, WINDOW.x + WINDOW.w / 2 + 0.03, wy, ROOM.z0),
    box(0.04, wh, 0.05, frameMat, WINDOW.x, wy, ROOM.z0),
    box(WINDOW.w, 0.04, 0.05, frameMat, WINDOW.x, wy, ROOM.z0),
    box(WINDOW.w + 0.2, 0.04, 0.2, frameMat, WINDOW.x, WINDOW.y0 - 0.06, ROOM.z0 + 0.08), // the sill
  );
  scene.add(shadowy(win));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW.w, wh), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.2 }));
  owned.push(glass.material);
  glass.position.set(WINDOW.x, wy, ROOM.z0 - 0.01);
  scene.add(glass);
  const desert = paintDesert();
  owned.push(desert);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: desert, color: new THREE.Color(1.15, 1.1, 1.05) }));
  owned.push(outside.material);
  outside.position.set(WINDOW.x, 2.05, ROOM.z0 - 3.2);
  scene.add(outside);
  // the bed, against the left wall, and the nightstand
  const bed = new THREE.Group();
  const steel = mat({ color: 0xb9bcbf, roughness: 0.35, metalness: 0.8 });
  bed.add(
    box(0.98, 0.32, 2.02, steel, 0, 0.32, 0),
    box(0.94, 0.16, 1.98, mat({ color: 0xf4f2ee, roughness: 0.85 }), 0, 0.56, 0),
    box(0.97, 0.06, 1.35, mat({ color: 0x9fb8c8, roughness: 0.9 }), 0, 0.66, 0.3),
    box(0.62, 0.12, 0.36, mat({ color: 0xfbfaf6, roughness: 0.9 }), 0, 0.69, -0.74),
    box(1.0, 0.95, 0.05, mat({ color: 0xa47b52, roughness: 0.6 }), 0, 0.48, -1.0),
  );
  bed.position.set(ROOM.x0 + 0.55, 0, -1.05);
  scene.add(shadowy(bed));
  const stand = new THREE.Group();
  stand.add(box(0.45, 0.6, 0.4, mat({ color: 0xa47b52, roughness: 0.6 }), 0, 0.3, 0), box(0.12, 0.3, 0.12, mat({ color: 0xd8cfbe, roughness: 0.5 }), 0, 0.75, 0));
  stand.position.set(ROOM.x0 + 0.3, 0, -2.0);
  scene.add(shadowy(stand));
  // a framed print on the left wall
  const print = box(0.03, 0.5, 0.7, mat({ color: 0x8aa3b5, roughness: 0.6 }), ROOM.x0 + 0.02, 1.6, 0.4);
  scene.add(print, box(0.02, 0.56, 0.76, mat({ color: 0x6b4f33, roughness: 0.5 }), ROOM.x0 + 0.01, 1.6, 0.4));
  // the door, in the right-hand wall, hung on the hinge at its back edge
  const doorway = box(0.06, 2.12, 1.04, trimMat, ROOM.x1 - 0.02, 1.06, DOOR.z);
  scene.add(doorway);
  const hall = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 2.04), mat({ color: 0x5c564d, roughness: 1 }));
  hall.position.set(ROOM.x1 + 0.01, 1.02, DOOR.z);
  hall.rotation.y = -Math.PI / 2;
  scene.add(hall);
  const door = new THREE.Group();
  door.position.set(ROOM.x1 - 0.04, 0, DOOR.z - 0.46);
  const slab = box(0.045, 2.02, 0.92, mat({ color: 0xb08a5e, roughness: 0.55 }), 0, 1.01, 0.46);
  const handle = box(0.06, 0.03, 0.12, steel, -0.05, 1.0, 0.82);
  door.add(slab, handle);
  scene.add(shadowy(door));

  // ── the wheelchair, the tray, the bell ──
  const chair = new THREE.Group();
  const black = mat({ color: 0x26272a, roughness: 0.6 });
  const chrome = mat({ color: 0xc9ccd0, roughness: 0.25, metalness: 0.9 });
  chair.add(box(0.46, 0.05, 0.44, black, 0, SEAT - 0.03, 0.02), box(0.46, 0.46, 0.04, black, 0, SEAT + 0.24, -0.2));
  for (const s of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.022, 10, 36), black);
    wheel.position.set(s * 0.29, 0.3, -0.05);
    wheel.rotation.y = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.007, 6, 36), chrome);
    rim.position.copy(wheel.position).add(new THREE.Vector3(s * 0.025, 0, 0));
    rim.rotation.y = Math.PI / 2;
    const caster = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 18), black);
    caster.position.set(s * 0.22, 0.07, 0.28);
    caster.rotation.y = Math.PI / 2;
    chair.add(wheel, rim, caster, box(0.03, 0.03, 0.42, chrome, s * 0.25, SEAT + 0.19, 0.04), box(0.03, 0.22, 0.03, chrome, s * 0.25, SEAT + 0.08, 0.22), box(0.025, 0.6, 0.025, chrome, s * 0.22, SEAT + 0.25, -0.23));
  }
  chair.add(box(0.36, 0.02, 0.14, chrome, 0, 0.12, 0.38)); // the footrest
  // the tray across the right arm, and the brass bell on it
  const tray = box(0.24, 0.025, 0.2, mat({ color: 0xd9d3c6, roughness: 0.5 }), -0.2, SEAT + 0.22, 0.18);
  const brass = mat({ color: 0xc89b3c, roughness: 0.28, metalness: 1 });
  const bell = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), brass);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.052, 0.012, 20), mat({ color: 0x3a2a1c, roughness: 0.6 }));
  plinth.position.y = -0.006;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.022, 8), brass);
  knob.position.y = 0.054;
  bell.add(dome, plinth, knob);
  bell.position.set(-0.2, SEAT + 0.245, 0.18);
  chair.add(tray, bell);
  chair.position.copy(HECTOR);
  chair.rotation.y = FACING - Math.PI; // the chair's front is its +z
  scene.add(shadowy(chair));

  // ── the board ──
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 1024;
  boardCanvas.height = 740;
  const boardCtx = boardCanvas.getContext('2d');
  const boardTex = new THREE.CanvasTexture(boardCanvas);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  boardTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  owned.push(boardTex);
  const board = new THREE.Mesh(new THREE.BoxGeometry(BOARD.w, BOARD.h, 0.012), [trimMat, trimMat, trimMat, trimMat, mat({ map: boardTex, roughness: 0.75 }), trimMat]);
  board.position.copy(BOARD.at);
  board.castShadow = true;
  let boardKey = '';
  // a cell on the board (world), a little proud of it
  const cellAt = (row, col, out) => {
    const [u, v] = cellUV(row, col);
    return board.localToWorld(out.set((u - 0.5) * BOARD.w, (0.5 - v) * BOARD.h, 0.03));
  };

  // ── smoke, fire and debris ──
  const puffs = [];
  const fire = [];
  let cloudTex = null;
  const sprite = (additive) => {
    const m = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    owned.push(m);
    const s = new THREE.Sprite(m);
    s.visible = false;
    scene.add(s);
    return s;
  };
  for (let i = 0; i < 9; i++) fire.push({ s: sprite(true), dir: new THREE.Vector3(Math.sin(i * 2.4), 0.4 + (i % 3) * 0.3, Math.cos(i * 2.4)).normalize(), size: 0.8 + (i % 4) * 0.25 });
  for (let i = 0; i < 12; i++) puffs.push({ s: sprite(false), dir: new THREE.Vector3(Math.sin(i * 1.7), 0.25 + (i % 4) * 0.12, Math.cos(i * 1.7)).normalize(), size: 1.4 + (i % 5) * 0.35, delay: (i % 4) * 0.08 });
  const DEBRIS = 36;
  const debris = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.03, 0.05), mat({ color: 0x3b342d, roughness: 0.9 }), DEBRIS);
  debris.castShadow = true;
  debris.visible = false;
  scene.add(debris);
  const bits = Array.from({ length: DEBRIS }, (_, i) => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), spin: new THREE.Vector3(Math.sin(i), Math.cos(i * 1.3), Math.sin(i * 0.7)).multiplyScalar(8), scale: 0.6 + ((i * 37) % 10) / 10 }));
  const dummy = new THREE.Object3D();

  // ── load the dressing and the people ──
  const [people, wall, lino, cloud] = await Promise.all([
    loadPeople([ABQ.hector, ABQ.nurse, ABQ.gus], null, { clips: true }),
    loadPbr('casa-wall').catch(() => null),
    loadPbr('casa-floor').catch(() => null),
    loadTexture('cloud.webp').catch(() => null),
  ]);
  const hector = people.person(ABQ.hector, { pose: 'wheelchair', seat: SEAT, idle: true });
  // (the two on their feet stand on clips: a calm idle, a walk paced to the
  // floor, office/people.js; Gus breathes and looks about like anyone)
  const nurse = people.person(ABQ.nurse, { pose: 'stand', idle: true, anim: true });
  const gus = people.person(ABQ.gus, { pose: 'stand', idle: true, anim: true });
  if (!hector || !nurse || !gus) {
    people.dispose();
    env.dispose();
    for (const o of owned) o.dispose();
    stage.dispose();
    throw new Error('the people of Casa Tranquila did not load');
  }
  const dress = (m, maps, metres, w, h) => {
    if (!maps) return;
    for (const t of Object.values(maps)) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(w / metres, h / metres);
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      owned.push(t);
    }
    Object.assign(m, { map: maps.color, normalMap: maps.normal, roughnessMap: maps.arm, aoMap: maps.arm, roughness: 1 });
    m.needsUpdate = true;
  };
  dress(wallMat, wall, 1.6, 1, 1); // the walls' UVs are in metres
  wallMat.color.set(0xfff6e6);
  dress(floorMat, lino, 1.5, W, D);
  floorMat.color.set(0xffffff);
  cloudTex = cloud;
  if (cloud) for (const p of [...fire, ...puffs]) p.s.material.map = cloud;
  for (const p of [...fire, ...puffs]) p.s.material.needsUpdate = true;

  hector.group.position.copy(HECTOR);
  hector.group.rotation.y = FACING;
  nurse.group.add(board);
  scene.add(hector.group, nurse.group, gus.group);
  for (const p of [hector, nurse, gus]) p.group.traverse((o) => o.isMesh && (o.castShadow = true));
  // the house look (lib/three/house): the room's shade one colour, from the
  // afternoon's light, as in every world
  // (the stage starts at the house's exposure already: lifting it again would wash the room out)
  houseOn({ renderer, scene, sun, hemi, keepExposure: true, look: { fog: false } });
  const wallBase = wallMat.color.clone();
  const floorBase = floorMat.color.clone();
  const scorched = new THREE.Color(0x4a3f36);

  // on a narrow screen, closer in, so the board stays readable
  const eye = CAMERA.at.clone();
  const resize = (w, h) => {
    stage.resize(w, h);
    const narrow = clamp01((1.6 - w / Math.max(1, h)) / 0.8);
    eye.copy(CAMERA.at).lerp(CAMERA.look, 0.3 * narrow);
  };

  // ── per frame ──
  const v = new THREE.Vector3();
  const w2 = new THREE.Vector3();
  const bellTop = new THREE.Vector3();
  const shake = new THREE.Vector3();
  let clock = 0;
  let phase = null;
  let since = 0; // seconds in this phase
  let tap = -1; // seconds since Hector's last ring
  let glare = -1; // seconds since a miss
  let misses = 0;
  let blown = false; // the blast has started
  const reset = () => {
    blown = false;
    nurse.group.visible = true;
    nurse.group.position.copy(NURSE);
    nurse.group.rotation.y = yawTo(NURSE, HECTOR);
    nurse.walk(false);
    gus.group.visible = false;
    gus.group.rotation.y = yawTo(DOOR, GUS); // (in at the door, facing into the room)
    gus.walk(false);
    gus.reach('right', null);
    hector.group.visible = true;
    chair.visible = true;
    door.rotation.y = 0;
    wallMat.color.copy(wallBase);
    floorMat.color.copy(floorBase);
    for (const p of [...fire, ...puffs]) p.s.visible = false;
    debris.visible = false;
    flash.intensity = 0;
  };
  reset();

  // walk a figure from a to b over [t0, t1] of `t`, easing off and easing
  // to a stop (its feet paced to it, on clips), turning to where they go
  // and, once there, to `face` (a yaw), by time rather than at once
  let frameDt = 1 / 60;
  const faceTo = (p, want, rate = 6) => (p.group.rotation.y = turn(p.group.rotation.y, want, frameDt, rate));
  const stroll = (p, a, b, t, t0, t1, face = null) => {
    const k = clamp01((t - t0) / (t1 - t0));
    p.group.position.lerpVectors(a, b, ease(k));
    p.group.position.y = p.bob();
    p.walk(k > 0 && k < 1);
    if (k > 0 && k < 1) faceTo(p, yawTo(a, b), 8);
    else if (k >= 1 && face != null) faceTo(p, face);
    return k;
  };

  const boom = (t) => {
    if (t === 0) {
      // where the bell was
      bell.getWorldPosition(v);
      for (const b of bits) {
        b.p.copy(v);
        b.v.set((Math.random() - 0.5) * 7, 2 + Math.random() * 4, (Math.random() - 0.5) * 7);
      }
      for (const p of [...fire, ...puffs]) {
        p.s.visible = true;
        p.s.position.copy(v);
      }
      debris.visible = true;
      hector.group.visible = false;
      chair.visible = false;
    }
    flash.position.copy(bellTop).add(w2.set(0, 0.3, 0));
    flash.intensity = 45 * Math.exp(-t * 4.5);
    const burn = clamp01(t / 0.35) * 0.82;
    wallMat.color.copy(wallBase).lerp(scorched, burn);
    floorMat.color.copy(floorBase).lerp(scorched, burn * 0.8);
    for (const f of fire) {
      const k = clamp01(t / 1.1);
      f.s.position.copy(bellTop).addScaledVector(f.dir, 0.15 + ease(k) * 0.9 * f.size);
      f.s.position.y += k * 0.5;
      f.s.scale.setScalar((0.5 + ease(k) * 1.5) * f.size);
      f.s.material.opacity = Math.pow(1 - k, 1.5);
      f.s.material.color.setHSL(0.11 - k * 0.09, 1, 0.62 - k * 0.32);
      f.s.visible = k < 1;
    }
  };
  const smoke = (t) => {
    for (const p of puffs) {
      // the smoke billows up and out from the blast, away from us, and thins
      const k = clamp01((t - 0.25 - p.delay) / 2.6);
      p.s.position.copy(bellTop).addScaledVector(p.dir, 0.2 + ease(k) * 1.1 * p.size);
      p.s.position.z -= 0.4 + k * 0.6;
      p.s.position.y += 0.2 + k * 0.9;
      p.s.scale.setScalar((0.35 + ease(k) * 1.15) * p.size);
      const thick = clamp01((t - 0.25 - p.delay) / 0.6) * (t < 2.8 ? 0.72 : Math.max(0, 0.72 - (t - 2.8) * 0.26));
      p.s.material.opacity = thick;
      p.s.material.color.setScalar(0.2 + k * 0.18);
      p.s.visible = thick > 0.01;
    }
  };
  const fall = (dt) => {
    for (let i = 0; i < DEBRIS; i++) {
      const b = bits[i];
      b.v.y -= 9.8 * dt;
      b.p.addScaledVector(b.v, dt);
      if (b.p.y < 0.015) {
        b.p.y = 0.015;
        b.v.multiplyScalar(0.35);
        b.v.y = Math.abs(b.v.y) * 0.3;
      } else {
        b.r.x += b.spin.x * dt;
        b.r.y += b.spin.y * dt;
        b.r.z += b.spin.z * dt;
      }
      b.p.x = THREE.MathUtils.clamp(b.p.x, ROOM.x0 + 0.05, ROOM.x1 - 0.05);
      b.p.z = THREE.MathUtils.clamp(b.p.z, ROOM.z0 + 0.05, 1.7); // not into our lap
      dummy.position.copy(b.p);
      dummy.rotation.copy(b.r);
      dummy.scale.setScalar(b.scale);
      dummy.updateMatrix();
      debris.setMatrixAt(i, dummy.matrix);
    }
    debris.instanceMatrix.needsUpdate = true;
  };

  function render(s, ms = 16) {
    if (stage.lost) return;
    const dt = Math.min(0.05, ms / 1000);
    frameDt = dt;
    clock += dt;
    if (s.phase !== phase) {
      if ((s.phase === 'rows' || s.phase === 'letters') && (phase === 'after' || phase === 'boom' || phase === 'bell' || phase === 'gus' || phase === null)) reset();
      if (!(phase === 'rows' && s.phase === 'letters') && !(phase === 'letters' && s.phase === 'rows')) since = 0;
      phase = s.phase;
    }
    since += dt;
    if (s.misses > misses) glare = 0;
    misses = s.misses;
    bell.getWorldPosition(bellTop);

    // the board, repainted when what it shows changes
    const key = `${s.phase}|${s.row}|${s.col}|${s.w}|${s.typed}`;
    if (key !== boardKey) {
      boardKey = key;
      paintBoard(boardCtx, s);
      boardTex.needsUpdate = true;
    }

    // the nurse: her left hand on the board's edge, her right finger on the lit row or letter
    const playing = s.phase === 'rows' || s.phase === 'letters';
    if (nurse.group.visible) {
      nurse.reach('left', board.localToWorld(v.set(-BOARD.w / 2 + 0.03, 0, -0.01)));
      nurse.reach('right', playing ? cellAt(s.row, s.phase === 'letters' ? s.col % ROWS[s.row].length : 0, w2) : null);
      nurse.look(playing ? board.getWorldPosition(v) : hector.headAt(v));
    }

    // Hector: his eyes on the board, on us when he's wrong, on Gus when he's in
    glare = glare >= 0 ? glare + dt : -1;
    if (glare > 1.4) glare = -1;
    if (glare === 0 || (glare > 0 && glare < dt * 1.5)) hector.gesture('shake');
    hector.look(glare >= 0 ? camera.position : s.phase === 'gus' || s.phase === 'bell' ? gus.headAt(v) : board.getWorldPosition(v));
    // his finger on the bell when he rings; the nurse's eyes go to him, and
    // in the finale Gus's go down to the bell, and on the second ring he knows
    if (tap === 0) {
      if (nurse.group.visible && playing) nurse.glance(hector.headAt(w2), 0.7);
      if (s.phase === 'bell' && gus.group.visible) {
        gus.glance(bellTop, 1.4);
        if ((s.rings ?? 0) >= 2) gus.play('alert', { layer: 'upper' });
      }
    }
    tap = tap >= 0 ? tap + dt : -1;
    hector.reach('right', tap >= 0 && tap < 0.32 ? w2.copy(bellTop).add(v.set(0, 0.07, 0)) : null);
    if (tap > 0.6) tap = -1;
    const press = tap >= 0 ? Math.sin(clamp01(tap / 0.22) * Math.PI) : 0;
    knob.position.y = 0.054 - press * 0.012;
    bell.scale.setScalar(1 + press * 0.04);

    // the finale
    if (s.phase === 'gus' || s.phase === 'bell') {
      door.rotation.y = -1.25 * ease(clamp01(since / 0.6));
      // she takes the board out as he comes in
      if (nurse.group.visible) {
        const out = DOOR.clone().add(w2.set(0.3, 0, -0.2));
        const k = stroll(nurse, NURSE, out, s.phase === 'gus' ? since : 9, 0.2, 2.9);
        if (k >= 1) nurse.group.visible = false;
      }
      gus.group.visible = true;
      const gIn = DOOR.clone().add(w2.set(0.25, 0, 0.15));
      // (in, and turned to face the old man once he's there)
      stroll(gus, gIn, GUS, s.phase === 'gus' ? since : 9, 0, 2.4, yawTo(GUS, HECTOR));
      gus.look(hector.headAt(v));
    } else if (s.phase === 'boom') {
      boom(blown ? since : 0);
      blown = true;
      smoke(since);
      fall(dt);
      gus.look(null);
    } else if (s.phase === 'after') {
      const t = since + 2.6;
      smoke(t);
      fall(dt);
      for (const f of fire) f.s.visible = false;
      flash.intensity = 0;
      // he straightens his tie, then walks out
      gus.headAt(v);
      const tie = w2.set(Math.sin(gus.group.rotation.y) * 0.13, -0.3, Math.cos(gus.group.rotation.y) * 0.13).add(v);
      gus.reach('right', since > 0.4 && since < 1.8 ? tie : null);
      if (since > 2) {
        const k = stroll(gus, GUS, DOOR.clone().add(v.set(0.3, 0, 0)), since, 2, 4.8);
        if (k >= 1) gus.group.visible = false;
      }
    }

    // the camera: still, but for a breath, and the blast
    camera.position.copy(eye);
    camera.position.y += Math.sin(clock * 0.5) * 0.008;
    if (s.phase === 'boom') {
      const k = Math.max(0, 1 - since / 1.2) * 0.06;
      camera.position.add(shake.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, 0));
    }
    camera.lookAt(CAMERA.look);

    for (const p of [hector, nurse, gus]) if (p.group.visible) p.update(clock, dt);
    stage.render(ms);
  }

  return {
    render,
    // Hector rings: his hand to the bell, the bell dips
    ring() {
      tap = 0;
    },
    resize,
    info: stage.info,
    project: stage.project,
    dispose() {
      people.dispose();
      env.dispose();
      for (const o of owned) o.dispose?.();
      if (cloudTex) cloudTex.dispose();
      stage.dispose();
    },
    get lost() {
      return stage.lost;
    },
  };
}
