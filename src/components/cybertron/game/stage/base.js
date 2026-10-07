// Team Prime's base, drawn: Transformers: Prime's Omega One, an old missile
// silo dug out under a mesa, its concrete walls and steel ribs, catwalks
// round the top, strip lights overhead. Teletraan-1's wall of green screens
// over its console, scrolling Cybertronian; Ratchet's berth and bench in
// the corner; the ground bridge's tunnel in the east wall with its green
// vortex turning, and the space bridge's frame on the west side, its own
// blue one in it. Bulkhead's dents in the wall, crates, a forklift's worth
// of human-sized clutter for scale.
//
// buildStage(area, { renderer }) → Promise<{ group, update(t), dispose }>

import * as THREE from 'three';
import { createLibrary } from '../../../../lib/cc0';
import { makeThing } from '../bots';
import { drum, makeStrips, merged, platedMaterial, slab } from './common';
import { sharpen } from '../../../../lib/three/textures';

// a vortex: the ground bridge's green, or the space bridge's blue
const VORTEX = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    float r = length(q);
    float a = atan(q.y, q.x);
    float spiral = sin(a * 3.0 + log(r + 0.02) * 9.0 - uTime * 5.0);
    float s2 = sin(a * 5.0 - log(r + 0.02) * 6.0 + uTime * 3.0);
    float glow = (0.55 + 0.45 * spiral) * (0.7 + 0.3 * s2);
    vec3 col = uColor * glow * (1.2 + 2.5 * smoothstep(0.9, 0.0, r)) + vec3(1.0) * pow(smoothstep(0.5, 0.0, r), 3.0) * 2.0;
    float alpha = smoothstep(1.0, 0.92, r);
    gl_FragColor = vec4(col * alpha, alpha);
  }`;
const VORTEX_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

// Teletraan-1's screens: rows of Cybertronian glyphs scrolling up, a map of
// the desert with a dot blinking where the energon is, a scope's sweep
function screens(w, h) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 384;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  sharpen(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  const glyph = (x, y, s, seed) => {
    g.beginPath();
    const r = (k) => (Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1;
    for (let k = 0; k < 4; k++) {
      const a = Math.abs(r(k));
      const b = Math.abs(r(k + 9));
      if (a > 0.5) g.rect(x + b * s * 0.6, y, s * 0.18, s * (0.4 + a * 0.6));
      else g.rect(x, y + b * s * 0.8, s * (0.5 + a), s * 0.16);
    }
    g.fill();
  };
  const panels = [
    [8, 8, 330, 368],
    [346, 8, 330, 176],
    [346, 192, 330, 184],
    [684, 8, 332, 368],
  ];
  return {
    tex,
    draw(t) {
      g.fillStyle = '#020a06';
      g.fillRect(0, 0, 1024, 384);
      for (const [x, y, pw, ph] of panels) {
        g.fillStyle = '#04160c';
        g.fillRect(x, y, pw, ph);
        g.strokeStyle = '#1d6b3c';
        g.lineWidth = 2;
        g.strokeRect(x + 1, y + 1, pw - 2, ph - 2);
      }
      // glyphs scrolling in the outer panels
      g.fillStyle = '#5dff9a';
      const scroll = (t * 20) % 22;
      for (const x0 of [16, 692]) for (let row = 0; row < 17; row++) for (let col = 0; col < 13; col++) glyph(x0 + col * 24, 16 + row * 22 - scroll, 16, row * 31 + col + Math.floor((t * 20) / 22) * 7 + x0);
      // the desert map with the signal blinking
      g.strokeStyle = '#2fbf6a';
      g.lineWidth = 1;
      for (let k = 0; k < 9; k++) {
        g.beginPath();
        g.ellipse(430 + k * 30, 80 + (k % 3) * 30, 20 + k * 3, 12 + k * 2, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = Math.sin(t * 6) > 0 ? '#ff5a3a' : '#5dff9a';
      g.beginPath();
      g.arc(600, 70, 7, 0, Math.PI * 2);
      g.fill();
      // the scope
      g.save();
      g.translate(511, 284);
      g.strokeStyle = '#2fbf6a';
      for (const r of [30, 60, 85]) {
        g.beginPath();
        g.arc(0, 0, r, 0, Math.PI * 2);
        g.stroke();
      }
      g.rotate(t * 1.4);
      const grad = g.createLinearGradient(0, 0, 85, 0);
      grad.addColorStop(0, 'rgba(93,255,154,0.9)');
      grad.addColorStop(1, 'rgba(93,255,154,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, 85, -0.35, 0);
      g.fill();
      g.restore();
      tex.needsUpdate = true;
    },
    w,
    h,
  };
}

export async function buildStage(area, { renderer } = {}) {
  const S = area.stage;
  const B = area.bounds;
  const H = area.ceiling;
  const group = new THREE.Group();
  const own = [];
  const keep = (x) => (own.push(x), x);

  // the light: strips overhead, the screens' green, a warm lamp in the bay
  group.add(new THREE.HemisphereLight('#a8c8bc', '#2a2a26', 0.45));
  const key = new THREE.DirectionalLight('#e8fff4', 0.6);
  key.position.set(20, 60, 30);
  group.add(key);
  const lamps = [
    [-40, 0],
    [0, 0],
    [40, 0],
    [-40, -28],
    [40, 28],
  ].map(([x, z]) => {
    const l = new THREE.PointLight('#dff8ee', 1300, 80, 1.6);
    l.position.set(x, H - 6, z);
    group.add(l);
    return l;
  });
  const screenGlow = new THREE.PointLight('#5dff9a', 500, 45, 1.8);
  screenGlow.position.set(0, 12, B.minZ + 10);
  group.add(screenGlow);
  const bay = new THREE.PointLight('#ffd9a0', 900, 50, 1.6);
  bay.position.set(54, 14, -26);
  group.add(bay);

  // concrete and steel, from the CC0 library where it loads
  const lib = createLibrary(renderer);
  const concrete = await lib.load('concrete');
  const plate = await lib.load('plate-deck');
  const floorMat = keep(plate ? lib.material(plate, { repeat: [28, 18], metal: true, envMapIntensity: 0.5, color: new THREE.Color('#9aa39f') }) : platedMaterial({ base: '#3c4442', alt: '#46504d', windows: 0, panel: [6, 6], metalness: 0.5, roughness: 0.6 }));
  const wallMat = keep(concrete ? lib.material(concrete, { repeat: [14, 5], color: new THREE.Color('#8a948f') }) : platedMaterial({ base: '#5a5e5a', alt: '#646a66', trim: '#4a4e4a', windows: 0, panel: [8, 4], metalness: 0, roughness: 0.9 }));
  const steelMat = keep(platedMaterial({ base: '#30383a', alt: '#3c4648', trim: '#5c6668', windows: 0, panel: [3, 3], metalness: 0.8, roughness: 0.4 }));

  // the room: floor, walls, roof (the walls with gaps for the tunnel)
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(B.maxX - B.minX + 4, B.maxZ - B.minZ + 4)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);
  const wall = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h)), wallMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    group.add(m);
  };
  wall(B.maxX - B.minX, H, 0, H / 2, B.minZ, 0);
  wall(B.maxX - B.minX, H, 0, H / 2, B.maxZ, Math.PI);
  wall(B.maxZ - B.minZ, H, B.minX, H / 2, 0, Math.PI / 2);
  // the east wall, round the tunnel's mouth (24 wide, 28 high)
  const tw = S.tunnel.w;
  const th = S.tunnel.h;
  wall((B.maxZ - B.minZ - tw) / 2, H, B.maxX, H / 2, -(tw / 2 + (B.maxZ - B.minZ - tw) / 4), -Math.PI / 2);
  wall((B.maxZ - B.minZ - tw) / 2, H, B.maxX, H / 2, tw / 2 + (B.maxZ - B.minZ - tw) / 4, -Math.PI / 2);
  wall(tw, H - th, B.maxX, th + (H - th) / 2, 0, -Math.PI / 2);
  const roof = new THREE.Mesh(keep(new THREE.PlaneGeometry(B.maxX - B.minX, B.maxZ - B.minZ)), wallMat);
  roof.rotation.x = Math.PI / 2;
  roof.position.y = H;
  group.add(roof);

  // the steel: ribs up the walls and across the roof, the catwalk round the
  // top, the console, Ratchet's berth and bench, the crates, the pillars
  const parts = [];
  for (let x = B.minX + 10; x < B.maxX - 5; x += 20) {
    parts.push(slab(x, 0, 1.2, (B.maxZ - B.minZ) / 2, H - 2.5, H - 0.5, 0, 0.3));
    for (const z of [B.minZ + 1, B.maxZ - 1]) parts.push(slab(x, z, 1.2, 1, 0, H, 0, 0.32));
  }
  const cw = S.catwalk;
  parts.push(slab(0, B.minZ + cw.depth / 2, (B.maxX - B.minX) / 2, cw.depth / 2, cw.y, cw.y + 0.6, 0, 0.4));
  parts.push(slab(B.minX + cw.depth / 2, 0, cw.depth / 2, (B.maxZ - B.minZ) / 2, cw.y, cw.y + 0.6, 0, 0.4));
  for (const s of area.solids) {
    if (s.tag === 'pillar') parts.push(drum(s.x, s.z, s.r, s.r, 0, H, 16, 0.5));
    else if (s.kind === 'box') parts.push(slab(s.x, s.z, s.hw, s.hd, s.base ?? 0, s.top, s.yaw ?? 0, s.tag === 'crate' ? 0.8 : 0.45));
  }
  const steel = new THREE.Mesh(keep(merged(parts)), steelMat);
  group.add(steel);

  // the floor's markings and the strip lights overhead
  const markings = makeStrips(
    [
      [B.minX + 6, 12, B.maxX - 30, 12, 0.02, 0.4, 0.02],
      [B.minX + 6, -12, B.maxX - 30, -12, 0.02, 0.4, 0.02],
      [B.maxX - 30, -12, B.maxX - 30, 12, 0.02, 0.4, 0.02],
    ],
    '#e8c43a',
    0.8,
  );
  group.add(markings);
  const strips = makeStrips(
    Array.from({ length: 6 }, (_, k) => [B.minX + 14 + k * 22, -30, B.minX + 14 + k * 22, 30, H - 3, 1.2, 0.3]),
    '#e8fff4',
    2.2,
  );
  group.add(strips);

  // Teletraan-1's screens over the console
  const tele = screens(S.screens.w, S.screens.h);
  const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(S.screens.w, S.screens.h)), keep(new THREE.MeshBasicMaterial({ map: tele.tex, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) })));
  screen.position.set(S.screens.x, S.screens.y + S.screens.h / 2, B.minZ + 0.3);
  group.add(screen);
  own.push(tele.tex);

  // the ground bridge: the tunnel and its vortex; the space bridge's frame
  const green = { uTime: { value: 0 }, uColor: { value: new THREE.Color('#5dff9a') } };
  const blue = { uTime: { value: 0 }, uColor: { value: new THREE.Color('#3fd2ff') } };
  const vortexMat = (u) => keep(new THREE.ShaderMaterial({ uniforms: u, vertexShader: VORTEX_VERT, fragmentShader: VORTEX, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  const tunnel = new THREE.Mesh(keep(new THREE.CircleGeometry(Math.min(tw, th) / 2 - 1, 64)), vortexMat(green));
  tunnel.position.set(B.maxX - 0.5, th / 2, 0);
  tunnel.rotation.y = -Math.PI / 2;
  group.add(tunnel);
  // the tunnel's frame: rings stepping back into the wall
  const rings = [];
  for (let k = 0; k < 4; k++) {
    const r = new THREE.Mesh(keep(new THREE.TorusGeometry(Math.min(tw, th) / 2 + 0.2, 0.7, 10, 48)), steelMat);
    r.position.set(B.maxX - 2 - k * 5, th / 2, 0);
    r.rotation.y = Math.PI / 2;
    group.add(r);
    rings.push(r);
  }
  const bc = S.bridgeConsole;
  const frame = new THREE.Mesh(keep(new THREE.TorusGeometry(9, 0.9, 12, 48)), steelMat);
  frame.position.set(bc.x, 10, bc.z);
  frame.rotation.y = Math.PI / 2;
  group.add(frame);
  const portal = new THREE.Mesh(keep(new THREE.CircleGeometry(8.4, 48)), vortexMat(blue));
  portal.position.copy(frame.position);
  portal.rotation.y = Math.PI / 2;
  group.add(portal);
  const glowG = new THREE.PointLight('#5dff9a', 900, 50, 1.8);
  glowG.position.set(B.maxX - 8, th / 2, 0);
  group.add(glowG);

  // Bumblebee's car and Bulkhead's truck, in the bay where they're parked
  for (const p of area.stage.parked ?? [])
    makeThing(p.kind).then((m) => {
      m.position.set(p.x, 0, p.z);
      m.rotation.y = p.yaw;
      group.add(m);
    });

  let last = -1;
  return {
    group,
    update(t) {
      green.uTime.value = t;
      blue.uTime.value = t;
      // the screens redrawn a few times a second
      if (t - last > 0.15) {
        last = t;
        tele.draw(t);
      }
      lamps[1].intensity = 1300 * (0.97 + 0.03 * Math.sin(t * 40));
    },
    dispose() {
      for (const x of own) x.dispose?.();
      lib.dispose();
    },
  };
}
