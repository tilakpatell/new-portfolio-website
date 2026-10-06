// What the worlds' own props are built from (props.js and the worlds'
// builders): parts put together as the galaxy's code-built ships are
// (universe/trafficKit.js: a geometry, where it goes, its colour, the
// material it's drawn with), baked into one mesh per material, each part's
// colour in its vertices. A handful of shared materials: painted metal
// with panel lines, bare metal, dressed stone, rock, adobe, planks,
// concrete, cloth, bark, leaves, glass and glow (hot enough to bloom). All
// in metres.
//
// The solid ones wear photo-scanned surfaces (public/cc0/galaxy/, made by
// scripts/galaxy-textures.mjs from Poly Haven's CC0 scans): a detail map
// under the part's own colour (the grain of the plaster, the seams of the
// plates, the joints of the blocks), a normal map, and ambient occlusion,
// roughness and metalness, laid on at their real size (a block a block's
// size, whatever the wall). Till they're loaded (kit.ready) a part wears a
// painted-in-code stand-in.

import * as THREE from 'three';
import { bake, canvasTexture, panelTexture, part, place, rod, between, compose, mirror, ball, upright } from '../../universe/trafficKit';
import { rng } from './noise';
import SCANS from '../../../../public/cc0/galaxy/index.json';

export { part, place, rod, between, compose, mirror, ball, upright };

const { PI } = Math;

// a grey speckled texture: grime on metal, the grain of stone and adobe
function grimeTexture(seed = 7) {
  const r = rng(seed);
  return canvasTexture(256, (c, n) => {
    c.fillStyle = '#e4e4e4';
    c.fillRect(0, 0, n, n);
    for (let i = 0; i < 2600; i++) {
      const v = 150 + r() * 105;
      c.fillStyle = `rgba(${v},${v},${v},${0.18 + r() * 0.3})`;
      const s = 1 + r() * r() * 9;
      c.fillRect(r() * n, r() * n, s, s);
    }
    // streaks, down (rain and dust down a wall)
    for (let i = 0; i < 70; i++) {
      const v = 120 + r() * 70;
      c.fillStyle = `rgba(${v},${v},${v},0.12)`;
      c.fillRect(r() * n, r() * n, 1 + r() * 3, 10 + r() * 60);
    }
  });
}

// a spray of conifer needles on its twigs, alpha-cut (the foliage cards of
// the forest worlds' trees: a twig up the middle, side twigs off it, short
// needles all along them), pale, so a part's colour gives it its green
function needleTexture(seed = 5) {
  const r = rng(seed);
  const t = canvasTexture(256, (c, n) => {
    c.clearRect(0, 0, n, n);
    c.lineCap = 'round';
    const shade = () => {
      const v = 190 + r() * 60;
      return `rgb(${v * 0.92},${v},${v * 0.86})`;
    };
    const twig = (x0, y0, x1, y1, needle, w) => {
      c.strokeStyle = '#9a8c78';
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.stroke();
      const len = Math.hypot(x1 - x0, y1 - y0);
      const [dx, dy] = [(x1 - x0) / len, (y1 - y0) / len];
      for (let d = 0; d < len; d += 2.2) {
        const px = x0 + dx * d;
        const py = y0 + dy * d;
        const l = needle * (0.7 + r() * 0.5) * (1 - (d / len) * 0.45);
        for (const side of [-1, 1]) {
          const a = Math.atan2(dy, dx) + side * (0.75 + r() * 0.35);
          c.strokeStyle = shade();
          c.lineWidth = 1.6 + r() * 0.8;
          c.beginPath();
          c.moveTo(px, py);
          c.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
          c.stroke();
        }
      }
    };
    // the main twig, bottom middle to near the top, and its side twigs
    const bend = (r() - 0.5) * 20;
    twig(n / 2, n * 0.99, n / 2 + bend, n * 0.06, 15, 3);
    for (let i = 0; i < 7; i++) {
      const f = 0.15 + i * 0.11;
      const y = n * (0.99 - f * 0.93);
      const x = n / 2 + bend * f;
      for (const side of [-1, 1]) {
        const reach = n * (0.36 - f * 0.28) * (0.8 + r() * 0.4);
        twig(x, y, x + side * reach, y - reach * (0.55 + r() * 0.3), 11, 2);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return keepCoverage(t);
}

// a spray of broad leaves on a twig, alpha-cut (the jungle's and the
// wroshyrs' canopies, Naboo's groves): leaves alternating up a twig and
// its side shoots, each a pointed oval with its midrib, pale for the part's
// green to tint
function leafTexture(seed = 6) {
  const r = rng(seed);
  const t = canvasTexture(256, (c, n) => {
    c.clearRect(0, 0, n, n);
    const leafAt = (x, y, a, l) => {
      c.save();
      c.translate(x, y);
      c.rotate(a);
      const v = 175 + r() * 70;
      c.fillStyle = `rgb(${v * 0.9},${v},${v * 0.82})`;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(l * 0.32, -l * 0.42, 0, -l);
      c.quadraticCurveTo(-l * 0.32, -l * 0.42, 0, 0);
      c.fill();
      c.strokeStyle = `rgba(120,130,100,0.6)`;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -l * 0.92);
      c.stroke();
      c.restore();
    };
    const twig = (x0, y0, x1, y1, leaves, size) => {
      c.strokeStyle = '#8a7a62';
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.stroke();
      const base = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
      for (let i = 0; i < leaves; i++) {
        const f = (i + 0.5) / leaves;
        const side = i % 2 ? 1 : -1;
        leafAt(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, base + side * (0.7 + r() * 0.4), size * (0.75 + r() * 0.4) * (1 - f * 0.3));
      }
      leafAt(x1, y1, base, size);
    };
    twig(n / 2, n * 0.98, n / 2 + (r() - 0.5) * 30, n * 0.18, 9, n * 0.24);
    for (const side of [-1, 1]) twig(n / 2, n * 0.62, n / 2 + side * n * 0.3, n * 0.36, 5, n * 0.18);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return keepCoverage(t);
}

// A cut-out texture's mip levels made by hand, each level's alpha scaled so
// as much of it is over the cut as at full size: far-off foliage stays as
// thick as near (left to the graphics chip, averaging thins it away)
function keepCoverage(t, cut = 0.3) {
  const src = t.image;
  const levels = [src];
  const coverage = (ctx, n) => {
    const d = ctx.getImageData(0, 0, n, n).data;
    let on = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > cut * 255) on++;
    return on / (n * n);
  };
  const want = coverage(src.getContext('2d'), src.width);
  for (let n = src.width / 2; n >= 1; n /= 2) {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0, n, n);
    // (scale alpha up till the coverage matches: a few tries)
    const img = ctx.getImageData(0, 0, n, n);
    let lo = 1;
    let hi = 4;
    for (let k = 0; k < 8; k++) {
      const m = (lo + hi) / 2;
      let on = 0;
      for (let i = 3; i < img.data.length; i += 4) if (img.data[i] * m > cut * 255) on++;
      if (on / (n * n) < want) lo = m;
      else hi = m;
    }
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = Math.min(255, img.data[i] * hi);
    ctx.putImageData(img, 0, 0);
    levels.push(c);
  }
  t.mipmaps = levels;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

// The scanned surfaces, each loaded once for the page (every world's kit
// shares them; a new renderer uploads them again by itself): role →
// { map, normalMap, arm } textures, or a promise of them
const scanned = new Map();
const SCAN_BASE = '/cc0/galaxy';
export function loadScan(role) {
  if (!scanned.has(role)) {
    const loader = new THREE.TextureLoader();
    const get = (file, srgb) =>
      loader.loadAsync(`${SCAN_BASE}/${role}/${file}.webp`).then((t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 8;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        return t;
      });
    scanned.set(
      role,
      Promise.all([get('color', true), get('normal', false), SCANS[role]?.arm ? get('arm', false) : null])
        .then(([map, normalMap, arm]) => ({ map, normalMap, arm }))
        .catch(() => null),
    );
  }
  return scanned.get(role);
}

// How each solid role wears its scan: how far it repeats (a metre of
// texture is a metre of wall: SCANS' sizes), how rough it is over the
// scan's own roughness, and whether its metalness comes from the scan
// (bare metal) or is the role's own (painted plates, which aren't).
const LOOKS = {
  paint: { roughness: 0.9, metalness: 0.15, normal: 0.9 },
  metal: { roughness: 1, metalness: 0.75, scanMetal: true, normal: 1 },
  stone: { roughness: 1, metalness: 0, normal: 1.1 },
  rock: { roughness: 1, metalness: 0, normal: 1.3 },
  adobe: { roughness: 1, metalness: 0, normal: 0.8 },
  bark: { roughness: 1, metalness: 0, normal: 1.4 },
  wood: { roughness: 1, metalness: 0, normal: 1 },
  concrete: { roughness: 1, metalness: 0, normal: 0.7 },
};
// a role's repeats a metre (the scan's real size; the stand-in's own where
// there's no scan)
export const densityOf = (role, fallback) => (SCANS[role]?.metres ? 1 / SCANS[role].metres : fallback);
// a role's scan's size in metres, and the brightness its detail map is centred on
export const scanOf = (role) => SCANS[role] ?? null;

export function createKit({ seed = 11, scans = true } = {}) {
  const owned = [];
  const own = (x) => {
    owned.push(x);
    return x;
  };
  const r = rng(seed);
  const grime = own(grimeTexture(seed));
  grime.wrapS = grime.wrapT = THREE.RepeatWrapping;
  grime.colorSpace = THREE.SRGBColorSpace;
  const plates = own(panelTexture(r, { min: 10, base: 222, spread: 16, seam: 0.55, detail: 0.35 }));
  plates.wrapS = plates.wrapT = THREE.RepeatWrapping;
  plates.colorSpace = THREE.SRGBColorSpace;
  const std = (o, density, role = null) => {
    const m = own(new THREE.MeshStandardMaterial({ vertexColors: true, ...o }));
    m.userData.density = role ? densityOf(role, density) : density;
    if (role) m.userData.role = role;
    return m;
  };
  const mats = {
    paint: std({ roughness: 0.72, metalness: 0.15, map: plates }, 0.35, 'paint'),
    metal: std({ roughness: 0.42, metalness: 0.55, map: grime }, 0.5, 'metal'),
    stone: std({ roughness: 0.96, map: grime }, 0.18, 'stone'),
    rock: std({ roughness: 0.96, map: grime }, 0.3, 'rock'),
    adobe: std({ roughness: 0.98, map: grime }, 0.12, 'adobe'),
    wood: std({ roughness: 0.9, map: grime }, 0.5, 'wood'),
    concrete: std({ roughness: 0.9, map: grime }, 0.3, 'concrete'),
    cloth: std({ roughness: 1, side: THREE.DoubleSide }, 0.5),
    bark: std({ roughness: 0.95, map: grime }, 0.6, 'bark'),
    leaf: std({ roughness: 0.82, side: THREE.DoubleSide }, 0.5),
    // (foliage cards: needles on twigs, cut out of the light behind them)
    // (cut out by alpha to coverage, where the frame is multisampled: soft
    // edges, and leaves that don't thin away in the smaller mip levels)
    needles: std({ roughness: 0.85, side: THREE.DoubleSide, map: own(needleTexture(seed)), alphaTest: 0.3, alphaToCoverage: true }, 1),
    foliage: std({ roughness: 0.75, side: THREE.DoubleSide, map: own(leafTexture(seed + 1)), alphaTest: 0.3, alphaToCoverage: true }, 1),
    dark: std({ roughness: 0.55, metalness: 0.2 }, 1),
    glass: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.55 })),
    glow: own(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
  };
  for (const m of [mats.glass, mats.glow]) m.userData.density = 1;

  // the scans on every material that wears one: the role's own, and the
  // copies the builders made of them (a clone keeps its role in userData)
  let dead = false;
  const dress = (m, scan) => {
    const look = LOOKS[m.userData.role];
    if (!look || !scan) return;
    m.map = scan.map;
    m.normalMap = scan.normalMap;
    m.normalScale.setScalar(look.normal);
    if (scan.arm) {
      m.aoMap = scan.arm; // (its red)
      m.aoMapIntensity = 0.85;
      m.roughnessMap = scan.arm; // (its green)
      if (look.scanMetal) m.metalnessMap = scan.arm; // (its blue)
    }
    m.roughness = look.roughness;
    m.metalness = look.metalness;
    m.needsUpdate = true;
  };
  const roles = Object.keys(LOOKS).filter((role) => SCANS[role]);
  const ready = scans
    ? Promise.all(roles.map((role) => loadScan(role).then((scan) => [role, scan]))).then((list) => {
        if (dead) return;
        const by = Object.fromEntries(list);
        for (const m of owned) if (m.isMeshStandardMaterial && m.userData.role) dress(m, by[m.userData.role]);
      })
    : Promise.resolve();

  // one geometry of the parts drawn with one material (for instancing)
  const geometry = (parts) => own(bake(parts, mats[parts[0]?.to ?? 'paint']?.userData.density ?? 0.5));

  return {
    mats,
    own,
    rand: r,
    geometry,
    // the scans on (or failed: the stand-ins stay): wait for it before the
    // shaders are made, or they're made twice
    ready,
    // parts → a group of meshes, one per material; shadows cast unless
    // they glow or see through
    build(parts, { shadows = true, name = 'prop' } = {}) {
      const group = new THREE.Group();
      group.name = name;
      const by = {};
      for (const p of parts) (by[p.to ?? 'paint'] ??= []).push(p);
      for (const [to, list] of Object.entries(by)) {
        const mat = mats[to] ?? mats.paint;
        const mesh = new THREE.Mesh(own(bake(list, mat.userData.density ?? 0.5)), mat);
        mesh.name = to;
        mesh.castShadow = shadows && to !== 'glow' && to !== 'glass';
        mesh.receiveShadow = to !== 'glow';
        group.add(mesh);
      }
      return group;
    },
    dispose() {
      dead = true;
      // (the scans are the page's, shared by every world: not freed here)
      for (const o of owned) o.dispose();
      owned.length = 0;
    },
  };
}

// ── Shapes ──

// a lumpy rock, about 1 across, its base flat-ish at y = 0
export function rockGeometry(seed = 1, { sharp = 0.35, detail = 1, flat = 0.55 } = {}) {
  const g = new THREE.IcosahedronGeometry(0.5, detail);
  const r = rng(seed);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const bumps = Array.from({ length: 5 }, () => [new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), (r() - 0.4) * sharp]);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    let k = 1;
    for (const [d, a] of bumps) k += a * Math.max(0, n.dot(d)) ** 3;
    v.multiplyScalar(k);
    v.y = v.y < 0 ? v.y * 0.25 : v.y * flat * 1.6; // sat in the ground, a little squat
    p.setXYZ(i, v.x, v.y + 0.12, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// a cone of cloth (a tent), a dome, a ring
export const dome = (r, h = r, seg = 20) => upright(Array.from({ length: 9 }, (_, i) => [r * Math.cos((i / 8) * (PI / 2)), h * Math.sin((i / 8) * (PI / 2))]), seg);
export const ring = (r, tube, seg = 24) => new THREE.TorusGeometry(r, tube, 8, seg).rotateX(PI / 2);
export const cyl = (r1, r2, h, seg = 16) => new THREE.CylinderGeometry(r2, r1, h, seg).translate(0, h / 2, 0); // (standing on y = 0)
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0); // (standing on y = 0)
