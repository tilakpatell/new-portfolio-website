// The projects page's opening: a hand of game cartridges, one for each
// project, fanned out like cards and dealt in when the page opens. Each is
// moulded in its project's own colour with a printed label (title, what it
// is, what it's built with). The hand leans toward the pointer; the one
// under it rises and turns to face you; a click (or a tap) opens that
// project. Cartridges.jsx gives it the projects and what opening one does;
// below it, the page's own list is the way in for a keyboard or without 3D.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clamp01, createRenderer, disposeTree, easeOut, precompile } from '../../../lib/three/renderer';

const W = 1;
const H = 1.12;
const D = 0.16;
const SPREAD = 0.8; // radians across the whole fan
const RADIUS = 3.0; // the fan's pivot is this far below its middle card
const FPS_GAP = 1000 / 30 - 2;

// The label, printed once on a canvas: a band in the project's colour with
// its title, what it is, and the first of what it's built with.
function labelTexture(project, color, ratio) {
  const w = 512;
  const h = 448;
  const c = document.createElement('canvas');
  c.width = w * ratio;
  c.height = h * ratio;
  const g = c.getContext('2d');
  g.scale(ratio, ratio);
  g.fillStyle = '#f6f4ee';
  g.fillRect(0, 0, w, h);
  const band = g.createLinearGradient(0, 0, w, h);
  band.addColorStop(0, color);
  band.addColorStop(1, shade(color, -0.25));
  g.fillStyle = band;
  g.fillRect(22, 22, w - 44, h - 120);
  // the brand line across the top, like a console's own
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.font = '700 22px ui-monospace, "JetBrains Mono", monospace';
  g.fillText('TILAK PATEL', 44, 62);
  g.font = '600 18px ui-monospace, "JetBrains Mono", monospace';
  g.textAlign = 'right';
  g.fillText(project.kind.toUpperCase(), w - 44, 62);
  g.textAlign = 'left';
  // the title, wrapped to two lines at most
  g.fillStyle = '#ffffff';
  const size = project.title.length > 18 ? 46 : 56;
  g.font = `800 ${size}px "Archivo Variable", Archivo, ui-sans-serif, sans-serif`;
  const words = project.title.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > w - 96 && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  lines.slice(0, 2).forEach((l, i) => g.fillText(l, 44, 170 + i * size * 1.08));
  // what it's built with, on the strip under the band
  g.fillStyle = '#2a2a2a';
  g.font = '600 20px ui-monospace, "JetBrains Mono", monospace';
  g.fillText(project.stack.slice(0, 3).join(' · '), 32, h - 56);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function shade(hex, t) {
  const c = new THREE.Color(hex);
  return `#${c.lerp(new THREE.Color(t < 0 ? 0x000000 : 0xffffff), Math.abs(t)).getHexString()}`;
}

export async function create(canvas, ctx) {
  if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))]);
  const gl = createRenderer(canvas, { alpha: true, ratio: 1.75, onLost: ctx.onLost, onSlow: ctx.onSlow });
  const { renderer } = gl;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.55;
  room.dispose();
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  camera.position.set(0, -0.15, 9);

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-2, 4, 6);
  scene.add(key);

  const hand = new THREE.Group();
  scene.add(hand);
  const body = new RoundedBoxGeometry(W, H, D, 4, 0.05);
  const labelGeo = new THREE.PlaneGeometry(W * 0.82, W * 0.82 * (448 / 512));
  // the grip ridges along the top, and the arrow pressed in below the label
  const ridgeGeo = new THREE.BoxGeometry(W * 0.7, 0.014, 0.012);
  const arrow = new THREE.Shape([new THREE.Vector2(-0.07, 0.03), new THREE.Vector2(0.07, 0.03), new THREE.Vector2(0, -0.05)]);
  const arrowGeo = new THREE.ShapeGeometry(arrow);
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const hitGeo = new THREE.PlaneGeometry(W, H);
  const hitMat = new THREE.MeshBasicMaterial();

  const cards = ctx.projects.map((p, i) => {
    const plastic = new THREE.MeshStandardMaterial({ color: new THREE.Color(p.color).lerp(new THREE.Color(0x222222), 0.08), roughness: 0.42, metalness: 0.05 });
    const card = new THREE.Group();
    const shell = new THREE.Mesh(body, plastic);
    card.add(shell);
    const label = new THREE.Mesh(labelGeo, new THREE.MeshStandardMaterial({ map: labelTexture(p, p.color, ratio), roughness: 0.65 }));
    label.position.set(0, 0.07, D / 2 + 0.002);
    card.add(label);
    const ridgeMat = new THREE.MeshStandardMaterial({ color: plastic.color.clone().multiplyScalar(0.7), roughness: 0.5 });
    for (let r = 0; r < 4; r++) {
      const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
      ridge.position.set(0, H / 2 - 0.05 - r * 0.026, D / 2 + 0.004);
      card.add(ridge);
    }
    const mark = new THREE.Mesh(arrowGeo, ridgeMat);
    mark.position.set(0, -H / 2 + 0.07, D / 2 + 0.003);
    card.add(mark);
    hand.add(card);
    // where it sits in the fan, and where it is now
    const n = ctx.projects.length;
    const a = n > 1 ? (i / (n - 1) - 0.5) * SPREAD : 0;
    // what the pointer is tested against: the card where it rests, so one
    // that rises out from under the pointer stays the one pointed at
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.visible = false;
    hit.userData.index = i;
    hit.position.set(Math.sin(a) * RADIUS, Math.cos(a) * RADIUS - RADIUS, i * 0.03);
    hit.rotation.z = -a;
    hand.add(hit);
    return { project: p, card, hit, rest: a, lift: 0, deal: 0, delay: 0.12 + i * 0.09 };
  });

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  let hover = -1;
  let t = 0;
  let lastDraw = 0;
  let drawn = false;
  const hits = cards.map((c) => c.hit);

  const pick = (e) => {
    const r = ctx.el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(hits, false)[0];
    return hit ? hit.object.userData.index : -1;
  };
  const onMove = (e) => {
    const r = ctx.el.getBoundingClientRect();
    look.tx = clamp01((e.clientX - r.left) / r.width) * 2 - 1;
    look.ty = clamp01((e.clientY - r.top) / r.height) * 2 - 1;
    const h = pick(e);
    if (h !== hover) {
      hover = h;
      ctx.el.style.cursor = h >= 0 ? 'pointer' : '';
      ctx.onHover?.(h >= 0 ? cards[h].project : null);
    }
    ctx.invalidate();
  };
  const onLeave = () => {
    look.tx = look.ty = 0;
    hover = -1;
    ctx.el.style.cursor = '';
    ctx.onHover?.(null);
    ctx.invalidate();
  };
  const onClick = (e) => {
    const h = hover >= 0 ? hover : pick(e);
    if (h >= 0) ctx.onOpen?.(cards[h].project);
  };
  ctx.el.addEventListener('pointermove', onMove);
  ctx.el.addEventListener('pointerleave', onLeave);
  ctx.el.addEventListener('click', onClick);

  const place = (c, i, dt) => {
    const k = 1 - Math.exp(-dt * 10);
    c.lift += ((i === hover ? 1 : 0) - c.lift) * k;
    const d = ctx.reduced ? 1 : easeOut(clamp01((t - c.delay) / 0.7));
    c.deal = d;
    // round the pivot below the fan, then lifted along its own up when picked
    const a = c.rest * (1 - c.lift * 0.85);
    const x = Math.sin(a) * RADIUS;
    const y = Math.cos(a) * RADIUS - RADIUS - (1 - d) * 3.2 + c.lift * 0.38;
    const bob = ctx.reduced ? 0 : Math.sin(t * 1.1 + c.rest * 6) * 0.025;
    // left to right, each over the last, as a hand of cards is held
    c.card.position.set(x, y + bob, i * 0.03 + c.lift * 0.6);
    c.card.rotation.set(0, 0, -a + (1 - d) * 0.6);
    c.card.scale.setScalar(1 + c.lift * 0.08);
  };

  const fit = (w, h) => {
    camera.aspect = w / h;
    // keep the whole fan in view whatever the box's shape
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const needW = 3.9 / (2 * half * camera.aspect);
    const needH = 1.95 / (2 * half);
    camera.position.z = Math.max(needW, needH);
    camera.updateProjectionMatrix();
  };

  return {
    ready: precompile(renderer, scene, camera),
    resize(w, h) {
      gl.setSize(w, h);
      fit(Math.max(1, w), Math.max(1, h));
      drawn = false;
    },
    render(ms, now) {
      if (gl.lost) return false;
      gl.watch(now);
      if (drawn && now - lastDraw < FPS_GAP && !ctx.reduced) return true;
      const dt = lastDraw ? Math.min(0.1, (now - lastDraw) / 1000) : 1 / 30;
      lastDraw = now;
      t += dt;
      const k = 1 - Math.exp(-dt * 4);
      look.x += (look.tx - look.x) * k;
      look.y += (look.ty - look.y) * k;
      hand.rotation.y = look.x * 0.22;
      hand.rotation.x = look.y * 0.12;
      cards.forEach((c, i) => place(c, i, dt));
      renderer.render(scene, camera);
      drawn = true;
      // with reduced motion it stills once it has settled
      return !ctx.reduced || cards.some((c) => Math.abs(c.lift - (cards.indexOf(c) === hover ? 1 : 0)) > 0.01);
    },
    dispose() {
      ctx.el.removeEventListener('pointermove', onMove);
      ctx.el.removeEventListener('pointerleave', onLeave);
      ctx.el.removeEventListener('click', onClick);
      ctx.el.style.cursor = '';
      scene.environment?.dispose();
      disposeTree(scene);
      gl.dispose();
    },
  };
}
