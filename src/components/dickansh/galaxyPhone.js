// The phone in the universe: a Google Pixel (the camera bar across its back)
// in a clear case gone yellow with age, SAMSUNG gAlaxy printed on it anyway,
// its lock screen swirling like a portal. It's the way into the Dickansh and
// Deekbeggers Universe (src/pages/Dickansh.jsx): the universe shows it, and
// clicking it asks for the password.
//
// build({ renderer }) → { group, hit, update(t), dispose }
// `group` is a phone 1 unit wide (Pixel 8 proportions, about 2.1 tall), its
// screen facing +z; `hit` is what to raycast against.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const W = 1;
const H = 2.126;
const D = 0.11;
const R = 0.13;

function roundedRect(w, h, r, cy = 0, Kind = THREE.Shape) {
  const s = new Kind();
  const x = -w / 2;
  const y = cy - h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// SAMSUNG, and under it gAlaxy, the capital A standing up on top of the rest
function drawBrand(g, cx, y, scale, color) {
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = `800 ${28 * scale}px system-ui, sans-serif`;
  const sam = 'S A M S U N G';
  g.fillText(sam, cx, y);
  const base = y + 70 * scale;
  g.font = `600 ${64 * scale}px system-ui, sans-serif`;
  const gw = g.measureText('g').width;
  const lw = g.measureText('laxy').width;
  g.font = `800 ${96 * scale}px system-ui, sans-serif`;
  const aw = g.measureText('A').width;
  const total = gw + aw + lw;
  let x = cx - total / 2;
  g.textAlign = 'left';
  g.font = `600 ${64 * scale}px system-ui, sans-serif`;
  g.fillText('g', x, base);
  x += gw;
  g.font = `800 ${96 * scale}px system-ui, sans-serif`;
  g.save();
  g.shadowColor = 'rgba(255,190,80,0.9)';
  g.shadowBlur = 18 * scale;
  g.fillStyle = '#ffd98a';
  g.fillText('A', x, base - 26 * scale);
  g.restore();
  x += aw;
  g.fillStyle = color;
  g.font = `600 ${64 * scale}px system-ui, sans-serif`;
  g.fillText('laxy', x, base);
}

function lockScreen() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 1088;
  const g = c.getContext('2d');
  const draw = () => {
    g.clearRect(0, 0, c.width, c.height);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    g.fillStyle = '#fff';
    g.font = '600 26px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText(`${hh}:${mm}`, 40, 56);
    g.textAlign = 'right';
    g.fillText('5G ▮▮▮ 12%', 472, 56);
    g.fillStyle = '#000';
    g.beginPath();
    g.arc(256, 46, 13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffe7b8';
    g.textAlign = 'center';
    g.font = '300 190px system-ui, sans-serif';
    g.fillText(hh, 256, 300);
    g.fillText(mm, 256, 470);
    drawBrand(g, 256, 590, 1, '#ffffff');
    // a padlock, and the ask
    g.strokeStyle = '#fff';
    g.lineWidth = 7;
    g.beginPath();
    g.arc(256, 892, 22, Math.PI, 0);
    g.stroke();
    g.fillStyle = '#fff';
    g.fillRect(226, 890, 60, 46);
    g.font = '500 30px system-ui, sans-serif';
    g.fillText('Locked', 256, 990);
    g.font = '400 24px system-ui, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillText('Tap to enter password', 256, 1030);
  };
  draw();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, redraw: () => (draw(), (tex.needsUpdate = true)) };
}

function backPrint() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  drawBrand(g, 256, 240, 1.3, '#d8d2c4');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const SCREEN_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SCREEN_FS = /* glsl */ `
varying vec2 vUv;
uniform float time;
uniform float glow;
uniform sampler2D ui;
uniform vec2 size;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 p = (vUv - 0.5) * size;
  if (sdRound(p, size * 0.5, 0.1) > 0.0) discard;
  vec2 q = p - vec2(0.0, -0.18);
  float r = length(q);
  float a = atan(q.y, q.x);
  float swirl = a + 1.6 / (r + 0.25) - time * 1.2;
  // noise read round a circle, so the swirl has no seam where the angle wraps
  float n = fbm(vec2(cos(swirl), sin(swirl)) * 1.8 + vec2(log(r + 0.05) * 2.4 - time * 1.2, 0.0));
  vec3 col = mix(vec3(0.35, 0.02, 0.04), vec3(1.0, 0.42, 0.06), n);
  col = mix(col, vec3(1.0, 0.85, 0.5), smoothstep(0.66, 0.92, n));
  col += vec3(1.0, 0.8, 0.5) * smoothstep(0.35, 0.0, r) * 0.8;
  col *= 0.55;
  vec4 u = texture2D(ui, vUv);
  col = mix(col, u.rgb * 1.4, u.a);
  gl_FragColor = vec4(col * glow, 1.0);
}`;

export function build() {
  const group = new THREE.Group();
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);

  // the phone: Obsidian, glossy, the screen nearly edge to edge
  const body = new THREE.Mesh(keep(new RoundedBoxGeometry(W, H, D, 6, R * 0.6)), keep(new THREE.MeshPhysicalMaterial({ color: 0x1b1c1f, roughness: 0.25, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.15 })));
  group.add(body);
  const { tex: ui, redraw } = lockScreen();
  keep(ui);
  const screenMat = keep(
    new THREE.ShaderMaterial({
      vertexShader: SCREEN_VS,
      fragmentShader: SCREEN_FS,
      toneMapped: false,
      uniforms: { time: { value: 0 }, glow: { value: 1.1 }, ui: { value: ui }, size: { value: new THREE.Vector2(W - 0.07, H - 0.07) } },
    }),
  );
  const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(W - 0.07, H - 0.07)), screenMat);
  screen.position.z = D / 2 + 0.002;
  group.add(screen);

  // the back: the camera bar, and the print
  const bar = new THREE.Group();
  const barGlass = new THREE.Mesh(keep(new RoundedBoxGeometry(W + 0.01, 0.27, 0.07, 4, 0.03)), keep(new THREE.MeshPhysicalMaterial({ color: 0x0a0a0c, roughness: 0.08, metalness: 0.3, clearcoat: 1 })));
  bar.add(barGlass);
  const ring = keep(new THREE.MeshStandardMaterial({ color: 0x9a9ea6, metalness: 1, roughness: 0.25 }));
  const lens = keep(new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.02, metalness: 0.5, clearcoat: 1, iridescence: 0.6 }));
  for (const x of [-0.27, -0.06]) {
    const rim = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 32)), ring);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, 0, -0.04);
    bar.add(rim);
    const glass = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.065, 0.065, 0.022, 32)), lens);
    glass.rotation.x = Math.PI / 2;
    glass.position.set(x, 0, -0.042);
    bar.add(glass);
  }
  const flash = new THREE.Mesh(keep(new THREE.CircleGeometry(0.03, 20)), keep(new THREE.MeshBasicMaterial({ color: 0xfff2d0 })));
  flash.rotation.y = Math.PI;
  flash.position.set(0.22, 0, -0.0362);
  bar.add(flash);
  bar.position.set(0, H * 0.3, -D / 2 - 0.01);
  group.add(bar);
  const print = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.8, 0.8)), keep(new THREE.MeshStandardMaterial({ map: keep(backPrint()), transparent: true, roughness: 0.5 })));
  print.rotation.y = Math.PI;
  print.position.set(0, -0.25, -D / 2 - 0.003);
  group.add(print);

  // the case: clear plastic gone yellow, a rim round the screen and a back plate
  const yellowed = keep(new THREE.MeshPhysicalMaterial({ color: 0xd99e22, roughness: 0.48, metalness: 0, transparent: true, opacity: 0.72, clearcoat: 1, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color(0xfff0b0), depthWrite: false }));
  const outer = roundedRect(W + 0.08, H + 0.08, R + 0.04);
  outer.holes.push(roundedRect(W - 0.03, H - 0.03, R - 0.02, 0, THREE.Path));
  const rim = new THREE.Mesh(keep(new THREE.ExtrudeGeometry(outer, { depth: D + 0.06, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3, curveSegments: 10 })), yellowed);
  rim.position.z = -(D + 0.06) / 2;
  rim.renderOrder = 2;
  group.add(rim);
  // the back plate, with a cut-out for the camera bar
  const back = roundedRect(W + 0.06, H + 0.06, R + 0.03);
  back.holes.push(roundedRect(W - 0.04, 0.31, 0.06, H * 0.3, THREE.Path));
  const plate = new THREE.Mesh(keep(new THREE.ExtrudeGeometry(back, { depth: 0.02, bevelEnabled: false, curveSegments: 10 })), yellowed);
  plate.position.z = -D / 2 - 0.05;
  plate.renderOrder = 2;
  group.add(plate);

  // a warm halo, so it reads from far off in space
  const haloTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,190,90,0.55)');
    grd.addColorStop(0.5, 'rgba(255,120,40,0.15)');
    grd.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return keep(new THREE.CanvasTexture(c));
  })();
  const halo = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
  halo.scale.set(4.2, 4.2, 1);
  halo.renderOrder = -1;
  group.add(halo);

  let minute = -1;
  const toCamera = new THREE.Vector3();
  return {
    group,
    hit: [body, screen, rim],
    // `camera`: the halo is kept behind the phone as seen from it
    update(t, camera = null) {
      if (camera) {
        group.worldToLocal(toCamera.copy(camera.position)).normalize();
        halo.position.copy(toCamera).multiplyScalar(-1.2);
      }
      screenMat.uniforms.time.value = t;
      const m = Math.floor(Date.now() / 60000);
      if (m !== minute) {
        minute = m;
        redraw();
      }
    },
    setGlow(v) {
      screenMat.uniforms.glow.value = v;
    },
    dispose() {
      for (const d of disposables) d.dispose?.();
    },
  };
}
