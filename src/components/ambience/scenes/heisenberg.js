// The Heisenberg theme's background: blue crystals, faceted and glinting,
// tumbling slowly down the sides of the page through a desert haze, pushed
// aside and set spinning by the pointer. Every so often an element from the
// periodic table drifts by on its green tile (the show's title card; Ti and
// Pa are in the name), or the RV crosses the bottom of the screen trailing
// smoke. A click on empty page shatters a crystal: blue shards and a purity.

import { ambience, backdrop, bursts, label, pick, rand, rgb } from '../kit';
import { mix } from '../../../lib/three/theme';
import { sharpen } from '../../../lib/three/textures';

const HAZE = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform vec3 uWarm;
uniform float uAlpha;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  // the desert's heat along the bottom, shimmering a little
  float shimmer = noise(vec2(vUv.x * 9.0, vUv.y * 30.0 - uTime * 0.6)) * 0.35;
  float a = smoothstep(0.32, 0.0, vUv.y + shimmer * 0.06) * (0.75 + shimmer);
  gl_FragColor = vec4(uWarm, a * uAlpha);
}
`;

// The show's title card: number, symbol and weight on a green tile.
const ELEMENTS = [
  ['Br', 35, '79.904'],
  ['Ba', 56, '137.33'],
  ['Ti', 22, '47.867'],
  ['Pa', 91, '231.04'],
  ['C', 6, '12.011'],
  ['H', 1, '1.008'],
  ['N', 7, '14.007'],
];

function tile(THREE, [symbol, number, weight]) {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, s, s);
  grad.addColorStop(0, '#2f8f4e');
  grad.addColorStop(1, '#14532d');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  g.strokeStyle = '#3fae5c';
  g.lineWidth = 5;
  g.strokeRect(2.5, 2.5, s - 5, s - 5);
  g.fillStyle = '#ffffff';
  g.font = '600 18px ui-monospace, monospace';
  g.textAlign = 'right';
  g.fillText(String(number), s - 12, 26);
  g.font = '700 58px "Archivo Variable", Archivo, ui-sans-serif, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(symbol, s / 2, s / 2 + 4);
  g.font = '500 14px ui-monospace, monospace';
  g.fillText(weight, s / 2, s - 16);
  const tex = new THREE.CanvasTexture(c);
  sharpen(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(92, 92), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
}

// The RV, side on, facing right: the box, the cab, two windows, the wheels.
function rv(THREE) {
  const group = new THREE.Group();
  const body = new THREE.Shape([[-78, -14], [78, -14], [78, 4], [70, 12], [56, 14], [50, 30], [-78, 30]].map(([x, y]) => new THREE.Vector2(x, y)));
  const paint = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
  const glass = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
  group.add(new THREE.Mesh(new THREE.ShapeGeometry(body), paint));
  for (const [x, w] of [[-52, 22], [-14, 30]]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w, 12), glass);
    win.position.set(x, 14, 0.1);
    group.add(win);
  }
  const wheel = new THREE.CircleGeometry(10, 16);
  for (const x of [-50, 50]) {
    const w = new THREE.Mesh(wheel, glass);
    w.position.set(x, -14, 0.2);
    group.add(w);
  }
  group.userData = { paint, glass };
  return group;
}

export function create(canvas, ctx) {
  return ambience(canvas, ctx, (k) => {
    const { THREE } = k;
    const haze = backdrop(k, HAZE, { uWarm: { value: new THREE.Color() }, uAlpha: { value: 0.2 } });
    const shards = bursts(k, { shape: 'diamond', size: 14 });

    // the crystals: one faceted shape, many times over, lit from the top left
    const n = Math.round(34 * k.density);
    const geo = new THREE.OctahedronGeometry(1, 0);
    geo.scale(0.55, 1.25, 0.45);
    const mat = new THREE.MeshPhongMaterial({ flatShading: true, shininess: 90, transparent: true, opacity: 0.9, depthTest: true, depthWrite: true });
    const crystals = new THREE.InstancedMesh(geo, mat, n);
    crystals.frustumCulled = false;
    k.scene.add(crystals);
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-0.6, 0.8, 1);
    k.scene.add(ambient, sun);

    const rocks = Array.from({ length: n }, () => ({
      x: 0,
      y: 0,
      vy: rand(10, 26),
      size: rand(9, 24),
      rx: rand(0, 6),
      ry: rand(0, 6),
      sx: rand(-0.6, 0.6),
      sy: rand(-0.9, 0.9),
      kick: 0,
      kx: 0,
    }));
    // they keep to the sides, where there's no text
    const scatter = (r, anywhere) => {
      const side = Math.random() < 0.5 ? -1 : 1;
      r.x = side * rand(k.size.w * 0.3, k.size.w * 0.5);
      r.y = anywhere ? rand(-k.size.h / 2, k.size.h / 2) : k.size.h / 2 + 40;
    };
    let placed = false;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();

    // the big moments: a tile, or the RV
    const card = { mesh: null, t: 0, life: 14, from: [0, 0], to: [0, 0] };
    const van = rv(THREE);
    van.visible = false;
    k.scene.add(van);
    const drive = { on: false, t: 0, dir: 1 };
    let wait = rand(3, 6);
    let turn = 0;
    const purity = [];

    const startTile = () => {
      card.mesh?.parent?.remove(card.mesh);
      card.mesh?.geometry.dispose();
      card.mesh?.material.map.dispose();
      card.mesh?.material.dispose();
      card.mesh = tile(THREE, pick(ELEMENTS));
      card.mesh.renderOrder = 5;
      k.scene.add(card.mesh);
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = side * k.size.w * rand(0.3, 0.42);
      card.from = [x, -k.size.h / 2 - 80];
      card.to = [x + side * rand(-60, 60), k.size.h / 2 + 80];
      card.t = 0;
      card.spin = rand(-0.25, 0.25);
    };
    const startDrive = () => {
      drive.on = true;
      drive.t = 0;
      drive.dir = Math.random() < 0.5 ? 1 : -1;
      van.scale.x = drive.dir;
      van.visible = true;
    };

    return {
      step(dt, t) {
        haze.step(t);
        shards.step(dt);
        if (!placed) {
          for (const r of rocks) scatter(r, true);
          placed = true;
        }
        const reach = 150;
        for (let i = 0; i < n; i++) {
          const r = rocks[i];
          r.y -= r.vy * dt;
          r.x += r.kx * dt;
          r.kx *= 1 - Math.min(1, dt * 1.5);
          // the pointer pushes them aside and sets them spinning
          const dx = r.x - k.pointer.x;
          const dy = r.y - k.pointer.y;
          const d = Math.hypot(dx, dy);
          if (k.pointer.near > 0.5 && d < reach) {
            const f = (1 - d / reach) * 260;
            r.kx += (dx / (d || 1)) * f * dt * 4;
            r.y += (dy / (d || 1)) * f * dt * 0.5;
            r.kick = Math.min(6, r.kick + dt * 10);
          }
          r.kick *= 1 - Math.min(1, dt * 0.8);
          r.rx += (r.sx + Math.sign(r.sx || 1) * r.kick) * dt;
          r.ry += (r.sy + r.kick) * dt;
          if (r.y < -k.size.h / 2 - 40) scatter(r, false);
          e.set(r.rx, r.ry, 0);
          q.setFromEuler(e);
          v.set(r.x, r.y, 0);
          sc.setScalar(r.size);
          m.compose(v, q, sc);
          crystals.setMatrixAt(i, m);
        }
        crystals.instanceMatrix.needsUpdate = true;

        // one big moment at a time
        wait -= dt;
        if (wait <= 0 && !card.mesh && !drive.on && dt > 0) {
          if (turn++ % 2 === 0) startTile();
          else startDrive();
        }
        if (card.mesh) {
          card.t += dt;
          const p = card.t / card.life;
          card.mesh.position.set(card.from[0] + (card.to[0] - card.from[0]) * p, card.from[1] + (card.to[1] - card.from[1]) * p, 0);
          card.mesh.rotation.z = Math.sin(card.t * 0.5) * 0.2 + card.t * card.spin * 0.2;
          card.mesh.material.opacity = Math.min(1, card.t, (card.life - card.t) / 1.5) * this.tileAlpha;
          if (card.t >= card.life) {
            card.mesh.parent.remove(card.mesh);
            card.mesh.geometry.dispose();
            card.mesh.material.map.dispose();
            card.mesh.material.dispose();
            card.mesh = null;
            wait = rand(9, 15);
          }
        }
        if (drive.on) {
          drive.t += dt;
          const span = k.size.w + 260;
          const x = -drive.dir * span / 2 + drive.dir * drive.t * 140;
          van.position.set(x, -k.size.h / 2 + 46 + Math.abs(Math.sin(drive.t * 9)) * 1.5, 0);
          // a puff of smoke from the roof vent now and then
          if (Math.random() < dt * 3) shards.emit(x - drive.dir * 30, van.position.y + 34, { count: 2, speed: [10, 30], life: [1.2, 2], colors: [this.smoke], gravity: 30, size: 22, angle: [Math.PI * 0.35, Math.PI * 0.65] });
          if (drive.t * 140 > span) {
            drive.on = false;
            van.visible = false;
            wait = rand(9, 15);
          }
        }
        for (let i = purity.length - 1; i >= 0; i--) {
          const p = purity[i];
          p.t += dt;
          p.mesh.position.y += dt * 40;
          p.mesh.material.opacity = Math.max(0, 1 - p.t / 1.6);
          if (p.t > 1.6) {
            p.mesh.parent.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.map.dispose();
            p.mesh.material.dispose();
            purity.splice(i, 1);
          }
        }
        // reduced motion: one still frame with the title card in it
        if (k.reduced && !card.mesh) {
          startTile();
          card.t = card.life * 0.35;
          this.step(0, t);
        }
      },
      recolor(c) {
        this.dark = c.dark;
        // ice blue that glows in the dark; a teal ink with deep facets in the light
        const ice = c.dark ? [94, 200, 240] : [28, 138, 196];
        rgb(ice, mat.color);
        rgb(c.dark ? [30, 90, 130] : [0, 0, 0], mat.emissive);
        mat.specular.set(c.dark ? 0xffffff : 0xcfefff);
        mat.opacity = c.dark ? 0.85 : 0.82;
        rgb(c.dark ? [214, 160, 70] : [222, 176, 96], haze.uniforms.uWarm.value);
        haze.uniforms.uAlpha.value = c.dark ? 0.12 : 0.22;
        shards.glow(c.dark);
        const ink = c.dark ? mix(c.text, c.bg, 0.3) : mix(c.text, c.bg, 0.25);
        rgb(c.dark ? [200, 200, 190] : [240, 236, 222], van.userData.paint.color);
        rgb(ink, van.userData.glass.color);
        van.userData.paint.opacity = c.dark ? 0.55 : 0.95;
        van.userData.glass.opacity = c.dark ? 0.7 : 0.85;
        this.smoke = c.dark ? [150, 150, 150] : [170, 170, 170];
        this.tileAlpha = c.dark ? 0.85 : 0.8;
      },
      burst(x, y) {
        shards.emit(x, y, { count: 20, colors: [[94, 200, 240], [180, 235, 255], [40, 140, 190]], speed: [90, 300], gravity: -320, size: 13 });
        const tag = label(`${rand(96, 99.9).toFixed(1)}%`, { font: '700 22px ui-monospace, monospace', color: this.dark ? '#bfeeff' : '#1a6b34' });
        const half = tag.geometry.parameters.width / 2;
        tag.position.set(Math.max(-k.size.w / 2 + half, Math.min(k.size.w / 2 - half, x)), y + 24, 0);
        tag.renderOrder = 12;
        k.scene.add(tag);
        purity.push({ mesh: tag, t: 0 });
      },
      dispose() {
        for (const p of purity) p.mesh.material.map.dispose();
      },
    };
  });
}
