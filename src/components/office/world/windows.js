// The office's outside windows, and the blinds in them and in the glass
// fronts. What's out of a window isn't a picture on the wall: each pane is
// a little view of Scranton worked out per pixel from where you stand, so
// it moves as you do (parallax). Two storeys down, the business park's lot
// with its stall lines and parked cars, the light poles along the aisle, a
// grass verge, the park's low buildings and a tree line, the hills round
// the valley and an overcast sky. Bright enough that the bloom just touches it.
//
// The blinds are white one-inch mini-blinds, as on the set (photos from the
// set's tours show them in every outside window, never vertical vanes): real
// slats, one instanced draw for every window and glass front, open, half
// raised or shut, and the glass fronts of Michael's office, the conference
// room and Darryl's tilted open, the conference room's raised to sill
// height and a half.
//
// buildWindows({ windows, panes, T }) → { group, dispose() }
//   windows  [{ a: {x, z}, b: {x, z}, room: +1 | -1 }] on the outside walls
//            (room: which side of the wall line the room is, +z or +x being +1)
//   panes    the glass fronts' runs, [x0, z0, x1, z1]
//   T        the walls' thickness

import * as THREE from 'three';
import { rng } from '../../../lib/texture';
import { sharpen } from '../../../lib/three/textures';

const GROUND = -4.2; // the lot, two storeys down
const SCALE = 32; // painted pixels per metre

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
// a strip of scenery painted twice: in colour, and as a mask (white where
// there's something, black where there's sky) read from an opaque canvas
function strip(w, h, draw) {
  const out = [];
  for (const mask of [false, true]) {
    const c = canvas(w, h);
    const x = c.getContext('2d');
    x.fillStyle = mask ? '#000' : draw.bg;
    x.fillRect(0, 0, w, h);
    draw(x, mask ? () => '#fff' : (s) => s);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.colorSpace = mask ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    sharpen(t);
    out.push(t);
  }
  return out;
}

// parked cars from the front or the back, a stall (2.7 m) each, 4 m tall at 32 px a metre
function carsStrip() {
  const W = 2048;
  const H = 128;
  const draw = (x, col) => {
    const r = rng(41);
    const paints = ['#7c1f24', '#d8d8d2', '#2f3d55', '#5a5d61', '#c9b58a', '#1d1f22', '#8a8f96', '#3a5a3a', '#a8a39a', '#e6e4dc', '#203a6a'];
    const stall = 2.7 * SCALE;
    for (let i = 0; i * stall < W; i++) {
      if (r() < 0.22) continue; // an empty stall
      const tall = r() < 0.3; // a van or an SUV
      const w = (tall ? 1.95 : 1.8) * SCALE;
      const h = (tall ? 1.85 : 1.42) * SCALE;
      const cx = i * stall + stall / 2 + (r() - 0.5) * 8;
      const x0 = cx - w / 2;
      const y0 = H - h;
      const paint = paints[Math.floor(r() * paints.length)];
      // wheels
      x.fillStyle = col('#15161a');
      x.fillRect(x0 + 4, H - 14, 16, 14);
      x.fillRect(x0 + w - 20, H - 14, 16, 14);
      // the body, the cabin narrower on top
      x.fillStyle = col(paint);
      x.beginPath();
      x.roundRect(x0, y0 + h * 0.42, w, h * 0.5, 6);
      x.fill();
      x.beginPath();
      x.moveTo(x0 + w * 0.12, y0 + h * 0.44);
      x.lineTo(x0 + w * 0.2, y0 + 2);
      x.lineTo(x0 + w * 0.8, y0 + 2);
      x.lineTo(x0 + w * 0.88, y0 + h * 0.44);
      x.closePath();
      x.fill();
      if (col('#000') === '#fff') continue;
      // windscreen, lights, grille, plate, bumper
      x.fillStyle = '#2a3440';
      x.beginPath();
      x.moveTo(x0 + w * 0.17, y0 + h * 0.42);
      x.lineTo(x0 + w * 0.23, y0 + 6);
      x.lineTo(x0 + w * 0.77, y0 + 6);
      x.lineTo(x0 + w * 0.83, y0 + h * 0.42);
      x.closePath();
      x.fill();
      x.fillStyle = 'rgba(255,255,255,0.18)';
      x.fillRect(x0 + w * 0.3, y0 + 8, w * 0.12, h * 0.3);
      const back = r() < 0.5;
      x.fillStyle = back ? '#b3202a' : '#e9e6d8';
      x.fillRect(x0 + 5, y0 + h * 0.52, w * 0.18, 7);
      x.fillRect(x0 + w * 0.82 - 5, y0 + h * 0.52, w * 0.18, 7);
      x.fillStyle = '#1b1c1f';
      if (!back) x.fillRect(x0 + w * 0.3, y0 + h * 0.54, w * 0.4, 7);
      x.fillStyle = '#ece9de';
      x.fillRect(cx - 9, y0 + h * 0.68, 18, 8);
      x.fillStyle = 'rgba(0,0,0,0.35)';
      x.fillRect(x0, y0 + h * 0.84, w, 5);
    }
  };
  draw.bg = '#55585c';
  return strip(W, H, draw);
}

// the business park's low buildings and the trees behind them: 90 m of it,
// 24 m tall, at 11.4 px a metre
export function parkStrip() {
  const W = 1024;
  const H = 272;
  const m = W / 90;
  const draw = (x, col) => {
    const r = rng(7);
    // trees behind everything: rounded crowns, a few bare ones
    for (let i = 0; i < 120; i++) {
      const tx = r() * W;
      const th = (8 + r() * 12) * m;
      const tw = (4 + r() * 6) * m;
      const g = ['#3f5233', '#4c6139', '#38482c', '#5a6a42', '#6e6440'][Math.floor(r() * 5)];
      x.fillStyle = col('#3a2f25');
      x.fillRect(tx - 2, H - th * 0.45, 4, th * 0.45);
      x.fillStyle = col(g);
      for (let k = 0; k < 5; k++) {
        x.beginPath();
        x.ellipse(tx + (r() - 0.5) * tw * 0.6, H - th * 0.55 - r() * th * 0.35, tw * (0.3 + r() * 0.25), th * (0.22 + r() * 0.14), 0, 0, Math.PI * 2);
        x.fill();
      }
    }
    // the park's buildings: long, low, white and grey, ribbon windows
    let bx = r() * 60;
    while (bx < W) {
      const bw = (18 + r() * 26) * m;
      const bh = (4.5 + r() * 3) * m;
      const shade = ['#bdbab2', '#a9a7a0', '#9c9b95', '#b7ad9a'][Math.floor(r() * 4)];
      x.fillStyle = col(shade);
      x.fillRect(bx, H - bh, bw, bh);
      if (col('#000') !== '#fff') {
        x.fillStyle = '#9a9c9c';
        x.fillRect(bx, H - bh, bw, 3);
        x.fillStyle = '#4b5562';
        for (const f of [0.32, 0.68]) x.fillRect(bx + 6, H - bh * (1 - f) - 5, bw - 12, 9);
        x.fillStyle = 'rgba(255,255,255,0.25)';
        for (let k = bx + 10; k < bx + bw - 10; k += 22) x.fillRect(k, H - bh * 0.68 - 5, 2, 9);
      }
      bx += bw + (30 + r() * 60) * m;
    }
  };
  draw.bg = '#5b6450';
  return strip(W, H, draw);
}

const VIEW_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const VIEW_FRAG = /* glsl */ `
  uniform vec3 uN;
  uniform vec3 uT;
  uniform float uGround, uGain, uTime;
  uniform sampler2D uCars, uCarsMask, uPark, uParkMask;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
    return s;
  }
  // an overcast Pennsylvania sky: pale at the horizon, soft grey cloud
  vec3 sky(vec3 v) {
    float up = clamp(v.y, 0.0, 1.0);
    vec3 c = mix(vec3(0.8, 0.84, 0.87), vec3(0.52, 0.61, 0.73), smoothstep(0.02, 0.6, up));
    vec2 q = v.xz / max(v.y, 0.05) * 0.5 + vec2(uTime * 0.003, 0.0);
    c = mix(c, vec3(0.93, 0.93, 0.92), smoothstep(0.42, 0.78, fbm(q * 1.4)) * 0.7);
    c = mix(c, vec3(0.62, 0.65, 0.7), smoothstep(0.55, 0.9, fbm(q * 2.6 + 3.1)) * 0.45);
    return c;
  }
  void main() {
    vec3 V = normalize(vWorld - cameraPosition);
    float vn = max(dot(V, uN), 0.03);
    vec3 haze = vec3(0.76, 0.8, 0.84);
    vec3 col = sky(V);
    float best = 1e9;
    // the hills round the valley, 900 m off
    {
      float t = 900.0 / vn;
      vec3 h = vWorld + V * t;
      float a = dot(h, uT);
      float ridge = 38.0 + 46.0 * fbm(vec2(a / 420.0, 1.7)) + 10.0 * noise(vec2(a / 60.0, 4.2));
      if (h.y - uGround < ridge) { col = mix(vec3(0.36, 0.43, 0.4), haze, 0.5); best = t; }
    }
    // the business park and the trees, 38 m out
    {
      float t = 38.0 / vn;
      vec3 h = vWorld + V * t;
      float hy = h.y - uGround;
      vec2 uv = vec2(dot(h, uT) / 90.0, hy / 24.0);
      if (hy > 0.0 && hy < 24.0 && texture2D(uParkMask, uv).r > 0.5 && t < best) { col = mix(texture2D(uPark, uv).rgb, haze, 0.12); best = t; }
    }
    // the ground: verge, path, the lot and its lines, grass beyond
    if (V.y < 0.0) {
      float t = (uGround - vWorld.y) / V.y;
      if (t < best) {
        vec3 h = vWorld + V * t;
        float b = dot(h - vWorld, uN);
        float a = dot(h, uT);
        float n = noise(h.xz * 1.7) * 0.6 + noise(h.xz * 9.0) * 0.4;
        vec3 g;
        if (b < 2.6) g = vec3(0.33, 0.41, 0.26) * (0.8 + 0.4 * n);
        else if (b < 4.4) g = vec3(0.64, 0.63, 0.6) * (0.92 + 0.12 * n) * (fract(a / 1.5) < 0.02 ? 0.8 : 1.0);
        else if (b < 4.6) g = vec3(0.75);
        else if (b < 28.0) {
          g = vec3(0.3, 0.31, 0.32) * (0.85 + 0.25 * n);
          bool stalls = (b > 6.0 && b < 11.0) || (b > 17.0 && b < 22.0);
          float s = fract(a / 2.7);
          if (stalls && (s < 0.045)) g = vec3(0.86, 0.86, 0.82);
          if (abs(b - 6.0) < 0.08 || abs(b - 22.0) < 0.08) g = vec3(0.86, 0.86, 0.82);
          // oil and wear, mid-stall
          if (stalls && abs(s - 0.5) < 0.18) g *= 0.82 + 0.18 * noise(h.xz * 3.0);
        } else g = vec3(0.35, 0.42, 0.27) * (0.8 + 0.4 * n);
        col = mix(g, haze, clamp(t / 220.0, 0.0, 0.55));
        best = t;
      }
    }
    // light poles down the aisle
    {
      float t = 14.0 / vn;
      vec3 h = vWorld + V * t;
      float hy = h.y - uGround;
      float a = dot(h, uT) + 7.0;
      float s = abs(fract(a / 22.0) - 0.5) * 22.0;
      if (t < best && hy > 0.0 && ((hy < 7.6 && s > 10.9) || (hy > 7.5 && hy < 7.75 && s > 10.2))) { col = vec3(0.3, 0.31, 0.33); best = t; }
    }
    // the parked cars, two rows facing each other
    for (int k = 0; k < 2; k++) {
      float b = k == 0 ? 8.6 : 19.4;
      float t = b / vn;
      if (t >= best) continue;
      vec3 h = vWorld + V * t;
      float hy = h.y - uGround;
      vec2 uv = vec2((dot(h, uT) + float(k) * 23.0) / 64.0, hy / 4.0);
      if (hy > 0.0 && hy < 2.0 && texture2D(uCarsMask, uv).r > 0.5) { col = mix(texture2D(uCars, uv).rgb, haze, 0.1 + float(k) * 0.06); best = t; }
    }
    gl_FragColor = vec4(col * uGain, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function buildWindows({ windows, panes, T }) {
  const group = new THREE.Group();
  group.name = 'windows';
  const own = [];
  const keep = (x) => (own.push(x), x);
  const [cars, carsMask] = carsStrip().map(keep);
  const [park, parkMask] = parkStrip().map(keep);
  // one view material for each way a wall faces (uN, out through it)
  const views = new Map();
  const viewFor = (n, t) => {
    const k = `${n.x},${n.z}`;
    if (!views.has(k))
      views.set(
        k,
        keep(
          new THREE.ShaderMaterial({
            uniforms: { uN: { value: n.clone() }, uT: { value: t.clone() }, uGround: { value: GROUND }, uGain: { value: 1.32 }, uTime: { value: 0 }, uCars: { value: cars }, uCarsMask: { value: carsMask }, uPark: { value: park }, uParkMask: { value: parkMask } },
            vertexShader: VIEW_VERT,
            fragmentShader: VIEW_FRAG,
          }),
        ),
      );
    return views.get(k);
  };

  const frameMat = keep(new THREE.MeshStandardMaterial({ color: 0x9fa4a8, roughness: 0.35, metalness: 0.8 }));
  const sillMat = keep(new THREE.MeshStandardMaterial({ color: 0xece8de, roughness: 0.55 }));
  const vaneMat = keep(new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.8, side: THREE.DoubleSide }));
  const glassParts = [];
  const vanes = [];
  const VIEW_H = 1.38;
  const VIEW_Y = 1.52;
  const add = (geo, m, x, y, z, rotY = 0) => {
    const o = new THREE.Mesh(keep(geo), m);
    o.position.set(x, y, z);
    o.rotation.y = rotY;
    o.castShadow = o.receiveShadow = true;
    group.add(o);
    return o;
  };
  // how the blinds hang in each window, in turn
  const MODES = ['open', 'half', 'open', 'shut', 'open', 'half', 'open', 'shut', 'half', 'open'];
  windows.forEach(({ a, b, room }, wi) => {
    const vertical = Math.abs(a.x - b.x) < 1e-6;
    const len = vertical ? Math.abs(b.z - a.z) : Math.abs(b.x - a.x);
    const cx = (a.x + b.x) / 2;
    const cz = (a.z + b.z) / 2;
    // along the wall, and into the room
    const tan = vertical ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const inward = vertical ? new THREE.Vector3(room, 0, 0) : new THREE.Vector3(0, 0, room);
    const rotY = Math.atan2(inward.x, inward.z); // a plane facing into the room
    const at = (along, into, y) => [cx + tan.x * along + inward.x * into, y, cz + tan.z * along + inward.z * into];
    const face = T / 2 + 0.004;
    // the view, on the wall's face
    const view = add(new THREE.PlaneGeometry(len, VIEW_H), viewFor(inward.clone().negate(), tan), ...at(0, face, VIEW_Y), rotY);
    view.castShadow = false;
    // a sheen of glass over it, for the room's reflections
    {
      const g = new THREE.PlaneGeometry(len, VIEW_H);
      g.rotateY(rotY);
      g.translate(...at(0, face + 0.012, VIEW_Y));
      glassParts.push(g);
    }
    // the frame: sill, head, jambs and a mullion every metre and a half
    const sill = add(new THREE.BoxGeometry(len + 0.1, 0.035, 0.16), sillMat, ...at(0, face + 0.07, VIEW_Y - VIEW_H / 2 - 0.018), rotY);
    sill.castShadow = false;
    add(new THREE.BoxGeometry(len + 0.06, 0.05, 0.05), frameMat, ...at(0, face + 0.025, VIEW_Y + VIEW_H / 2 + 0.02), rotY).castShadow = false;
    const mullions = Math.max(1, Math.round(len / 1.5));
    for (let i = 0; i <= mullions; i++) {
      const along = -len / 2 + (i * len) / mullions;
      add(new THREE.BoxGeometry(0.05, VIEW_H, 0.045), frameMat, ...at(along, face + 0.022, VIEW_Y), rotY).castShadow = false;
    }
    add(new THREE.BoxGeometry(len, 0.03, 0.04), frameMat, ...at(0, face + 0.02, VIEW_Y - 0.12), rotY).castShadow = false; // the transom
    // the blinds: a headrail, and 2.5 cm slats 2.2 cm apart, tilted open,
    // raised half way, or let down and shut; raised ones stacked under the rail
    const mode = MODES[wi % MODES.length];
    add(new THREE.BoxGeometry(len + 0.04, 0.05, 0.07), sillMat, ...at(0, face + 0.07, 2.31), rotY).castShadow = false;
    const top = 2.27;
    const bottom = mode === 'half' ? VIEW_Y + 0.05 : VIEW_Y - VIEW_H / 2 + 0.03;
    const tilt = mode === 'open' ? 1.05 : mode === 'half' ? 0.7 : 0.12;
    const rot = vertical ? Math.PI / 2 : 0;
    for (let y = top - 0.03; y > bottom; y -= 0.022) vanes.push({ p: at(0, face + 0.07, y), len: len - 0.04, rotY: rot, tilt: tilt + Math.sin(y * 31 + wi) * 0.03 });
    if (mode === 'half') for (let k = 0; k < 14; k++) vanes.push({ p: at(0, face + 0.07, top - 0.02 - k * 0.004), len: len - 0.04, rotY: rot, tilt: 0 });
    add(new THREE.BoxGeometry(len - 0.04, 0.012, 0.03), sillMat, ...at(0, face + 0.07, bottom - 0.01), rotY).castShadow = false; // the bottom rail
  });
  // every pane of glass, one draw
  if (glassParts.length) {
    const flat = glassParts.map((g) => g.toNonIndexed());
    const geo = new THREE.BufferGeometry();
    const pos = [];
    const nor = [];
    for (const g of flat) {
      pos.push(...g.attributes.position.array);
      nor.push(...g.attributes.normal.array);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const glass = new THREE.Mesh(keep(geo), keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.07, depthWrite: false, envMapIntensity: 1.6 })));
    glass.renderOrder = 2;
    group.add(glass);
    for (const g of [...glassParts, ...flat]) g.dispose();
  }

  // the glass fronts' slats: 2.5 cm, every 2.2 cm, tilted open; the
  // conference room's raised to a third, Darryl's half closed
  const slats = [];
  for (const [x0, z0, x1, z1] of panes) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.3) continue;
    const vertical = Math.abs(x1 - x0) < 1e-6;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    // whose blinds: the office behind the glass (Darryl's is south of its front, the others north)
    const darryl = cz > 0;
    const conference = !darryl && cx > -4.6;
    const into = darryl ? 0.07 : -0.07;
    const top = 2.08;
    const bottom = conference ? 1.55 : 0.9;
    const tilt = darryl ? 0.35 : 0.95;
    for (let y = top - 0.03; y > bottom; y -= 0.022) slats.push({ x: vertical ? cx + into : cx, z: vertical ? cz : cz + into, y, len: len * 0.97, rotY: vertical ? Math.PI / 2 : 0, tilt });
    // the headrail and the bottom rail
    for (const [y, h] of [
      [top + 0.01, 0.035],
      [bottom - 0.012, 0.012],
    ])
      add(new THREE.BoxGeometry(len * 0.98, h, 0.05), sillMat, vertical ? cx + into : cx, y, vertical ? cz : cz + into, vertical ? Math.PI / 2 : 0).castShadow = false;
  }

  // the vanes and the slats, instanced
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  if (vanes.length) {
    const geo = keep(new THREE.BoxGeometry(1, 0.0022, 0.025));
    const inst = new THREE.InstancedMesh(geo, vaneMat, vanes.length);
    const s = new THREE.Vector3();
    vanes.forEach((vn, i) => inst.setMatrixAt(i, m4.compose(v.set(...vn.p), q.setFromEuler(e.set(vn.tilt, vn.rotY, 0, 'YXZ')), s.set(vn.len, 1, 1))));
    inst.castShadow = false; // (a shadow of a thousand slats: the light's from above, through the ceiling)
    inst.receiveShadow = true;
    group.add(inst);
  }
  if (slats.length) {
    const geo = keep(new THREE.BoxGeometry(1, 0.0022, 0.025));
    const inst = new THREE.InstancedMesh(geo, vaneMat, slats.length);
    const s = new THREE.Vector3();
    slats.forEach((sl, i) => inst.setMatrixAt(i, m4.compose(v.set(sl.x, sl.y, sl.z), q.setFromEuler(e.set(sl.tilt, sl.rotY, 0, 'YXZ')), s.set(sl.len, 1, 1))));
    inst.castShadow = false;
    inst.receiveShadow = true;
    group.add(inst);
  }

  return {
    group,
    step(t) {
      for (const m of views.values()) m.uniforms.uTime.value = t;
    },
    dispose() {
      for (const o of own) o.dispose?.();
    },
  };
}
