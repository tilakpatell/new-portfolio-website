// A star in the lens: the glare a bright sun throws across a camera's glass
// (a halo round it, a streak across, a six-pointed burst, and ghosts of the
// aperture strung along the line through the middle of the frame), fading
// as it nears the edge of the frame and gone past it, and hidden by
// whatever is between the eye and the star.
//
// flareWeight({ ndc, occluded, size }) → 0…1: how strong, from where the star
//   is on the canvas (normalised device coordinates, −1…1 across and up):
//   full well inside the frame, gone 0.15 past its edge; times what isn't
//   hidden
// occluded({ from, to, solids, soften }) → 0…1: how hidden the star at `to`
//   is from `from` by `solids` ([{ at: [x, y, z], r }]): 1 when the line
//   passes within a solid's radius, easing to 0 over the last `soften` of it
//   outside (a limb, not a hard cut-off); only what's between the two counts
// createFlare({ colour, strength, small }) → { group, set({ ndc, weight, colour, camera }), dispose }:
//   the sprites, in a group the camera carries (they're in the scene, so the
//   bloom takes them too), sized in the frame's own units so they look the
//   same on every screen: `set` places them each frame

import * as THREE from 'three';

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function flareWeight({ ndc, occluded: hidden = 0, size = 0.05 } = {}) {
  const edge = Math.max(Math.abs(ndc[0]), Math.abs(ndc[1]));
  // (a big disc starts going a little sooner: its glare reaches the edge first)
  const k = 1 - smooth(0.85 - Math.min(size, 0.3), 1.15, edge);
  return Math.max(0, Math.min(1, k * (1 - hidden)));
}

export function occluded({ from, to, solids = [], soften = 0.1 } = {}) {
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const len = Math.hypot(...d);
  if (len < 1e-9) return 0;
  const u = d.map((v) => v / len);
  let most = 0;
  for (const s of solids) {
    const w = [s.at[0] - from[0], s.at[1] - from[1], s.at[2] - from[2]];
    const t = w[0] * u[0] + w[1] * u[1] + w[2] * u[2];
    if (t <= 0 || t >= len) continue; // behind the eye, or beyond the star
    const off = Math.hypot(w[0] - u[0] * t, w[1] - u[1] * t, w[2] - u[2] * t);
    const k = off <= s.r ? 1 : 1 - (off - s.r) / (soften * s.r);
    if (k > most) most = k;
    if (most >= 1) return 1;
  }
  return Math.max(0, most);
}

// ── the drawing ──

// each painted once, white on black, on a canvas of `n` (the sprite's colour tints it)
function paint(n, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  draw(g, n);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const halo = (n) =>
  paint(n, (g) => {
    const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.18, 'rgba(255,255,255,0.45)');
    r.addColorStop(0.55, 'rgba(255,255,255,0.08)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, n, n);
  });
const ghost = (n) =>
  paint(n, (g) => {
    // a soft hexagon, as the aperture's blades make it, brighter at its rim
    const hex = (rad) => {
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        g[i ? 'lineTo' : 'moveTo'](n / 2 + Math.cos(a) * rad, n / 2 + Math.sin(a) * rad);
      }
      g.closePath();
    };
    g.filter = `blur(${n * 0.02}px)`;
    g.fillStyle = 'rgba(255,255,255,0.35)';
    hex(n * 0.42);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = n * 0.02;
    hex(n * 0.42);
    g.stroke();
  });
const streak = (n) =>
  paint(n, (g) => {
    const x = g.createLinearGradient(0, 0, n, 0);
    x.addColorStop(0, 'rgba(255,255,255,0)');
    x.addColorStop(0.5, 'rgba(255,255,255,1)');
    x.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = x;
    const y = g.createLinearGradient(0, 0, 0, n);
    g.fillRect(0, n * 0.46, n, n * 0.08);
    y.addColorStop(0, 'rgba(0,0,0,1)');
    y.addColorStop(0.5, 'rgba(0,0,0,0)');
    y.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = y;
    g.fillRect(0, 0, n, n);
  });
const burst = (n) =>
  paint(n, (g) => {
    g.translate(n / 2, n / 2);
    for (let i = 0; i < 6; i++) {
      g.rotate(Math.PI / 3);
      const x = g.createLinearGradient(0, 0, n / 2, 0);
      x.addColorStop(0, 'rgba(255,255,255,0.9)');
      x.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = x;
      g.beginPath();
      g.moveTo(0, -n * 0.012);
      g.lineTo(n / 2, 0);
      g.lineTo(0, n * 0.012);
      g.fill();
    }
  });

// [texture, where along the line from the star (1) through the middle (0), size (half-heights), [w, h] stretch, strength]
const PARTS = [
  ['halo', 1, 0.35, [1, 1], 0.9],
  ['burst', 1, 0.5, [1, 1], 0.55],
  ['streak', 1, 1.2, [1, 0.025], 0.7],
  ['ghost', 0.7, 0.06, [1, 1], 0.18],
  ['ghost', 0.3, 0.1, [1, 1], 0.14],
  ['ghost', -0.15, 0.05, [1, 1], 0.2],
  ['ghost', -0.4, 0.16, [1, 1], 0.1],
];

export function createFlare({ colour = '#ffd6a8', strength = 1, small = false } = {}) {
  // the four pictures, painted once into one atlas (2 × 2), and the seven
  // parts as quads of one mesh: one draw for the whole flare
  const n = small ? 128 : 256;
  const atlas = document.createElement('canvas');
  atlas.width = atlas.height = n * 2;
  const g = atlas.getContext('2d');
  const TILE = { halo: [0, 0], ghost: [1, 0], streak: [0, 1], burst: [1, 1] };
  for (const [name, make] of Object.entries({ halo, ghost, streak, burst })) {
    const t = make(n);
    const [tx, ty] = TILE[name];
    g.drawImage(t.image, tx * n, ty * n);
    t.dispose();
  }
  const tex = new THREE.CanvasTexture(atlas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const count = PARTS.length;
  const pos = new Float32Array(count * 4 * 3);
  const uv = new Float32Array(count * 4 * 2);
  const col = new Float32Array(count * 4 * 3);
  const index = [];
  PARTS.forEach(([which], i) => {
    const [tx, ty] = TILE[which];
    // (the atlas's rows from the top; uv's v from the bottom)
    const u0 = tx / 2;
    const v0 = 1 - (ty + 1) / 2;
    uv.set([u0, v0, u0 + 0.5, v0, u0 + 0.5, v0 + 0.5, u0, v0 + 0.5], i * 8);
    const b = i * 4;
    index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(index);
  const mat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 20;
  mesh.frustumCulled = false;
  const group = new THREE.Group();
  group.name = 'flare';
  group.add(mesh);
  group.visible = false;
  const tint = new THREE.Color(colour);
  // where each part's middle is, in the camera's space (the test reads these)
  const centres = PARTS.map(() => new THREE.Vector3());
  return {
    group,
    centres,
    // ndc: where the star is on the canvas; weight: flareWeight's; camera:
    // the one carrying the group (its lens and its near plane place them)
    set({ ndc, weight, colour: c = null, camera }) {
      group.visible = weight > 0.002;
      if (!group.visible) return;
      if (c) tint.set(c);
      // just past the near plane, in front of everything; placed through the
      // camera's own projection, which can be shifted (a view offset, leaving
      // room for a panel): a point straight ahead lands at (−P8, −P9) in the
      // frame, and a point at `ndc` is (ndc + P8) d / P0 across at depth d
      const d = camera.near * 1.5;
      const P = camera.projectionMatrix.elements;
      const halfX = d / P[0];
      const half = d / P[5];
      const [cx, cy] = [-P[8], -P[9]];
      PARTS.forEach(([, along, size, [sw, sh], k], i) => {
        // (along the line from the star through the frame's middle)
        const nx = cx + (ndc[0] - cx) * along;
        const ny = cy + (ndc[1] - cy) * along;
        const x = (nx + P[8]) * halfX;
        const y = (ny + P[9]) * half;
        centres[i].set(x, y, -d);
        const w = size * half * sw;
        const h = size * half * sh;
        pos.set([x - w, y - h, -d, x + w, y - h, -d, x + w, y + h, -d, x - w, y + h, -d], i * 12);
        const a = weight * strength * k;
        for (let v = 0; v < 4; v++) col.set([tint.r * a, tint.g * a, tint.b * a], (i * 4 + v) * 3);
      });
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      tex.dispose();
      group.removeFromParent();
    },
  };
}
