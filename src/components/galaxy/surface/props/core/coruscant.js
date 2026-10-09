// Coruscant's props, built in code (props/index.js has what a builder
// returns): the towers and the platforms on their plinths, the skybridges,
// the Jedi Temple, the Senate, 500 Republica, Dex's Diner, the Outlander
// Club, the Works and the skylanes. Each is what the world places when
// there's no model of it (yet, catalog/core.js), and what there's no
// model of at all. (props/core/index.js has the other core worlds'.)
//
//   PROPS     skyscraper, plinth, cplatform, deck, skybridge, jeditemple,
//             senate, statue, republica, dexdiner, club, works, airspeeder,
//             airlane, senateguard
//             (kit, opts) → { object, solids?, floors?, update? }

import * as THREE from 'three';
import { box, cyl, dome, part, ring, rod } from '../../kit';
import { rng } from '../../noise';
import { litWindows } from '../windows';
import { canvasTexture, lit, loft, rail, trap8, turned, vary } from './shared';

const { PI, cos, sin, abs } = Math;

// posts round a disc's rim you can't get past (a railing, or just the
// edge), leaving gaps: [angle (from +z toward +x), half-width (radians)]
function rim(x, z, r, gaps = [], step = 0.8) {
  const out = [];
  const n = Math.ceil((2 * PI * r) / step);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * PI;
    if (gaps.some(([g, w]) => abs(Math.atan2(sin(a - g), cos(a - g))) < w)) continue;
    out.push({ circle: [x + sin(a) * r, z + cos(a) * r, 0.45] });
  }
  return out;
}

// the towers' body: the kit's paint, with its windows lit in the shader
// (windows.js), one material for every tower in the world
const towerMat = (k) => {
  if (!k.mats.tower) {
    k.mats.tower = k.own(k.mats.paint.clone());
    litWindows(k.mats.tower, { seed: 11, density: 0.55, cell: [3, 4] });
  }
  return 'tower';
};

export const PROPS = {
  // a Coruscant tower, ~200 m: stepped, round, a slab or an octagon, its
  // windows lit in bands, a beacon on top
  skyscraper(k, { style = 0, h = 200, w = 24, seed = 1 } = {}) {
    const r = rng(seed + style * 31);
    const BODY = ['#8c8780', '#a09a8e', '#77767a', '#938a7e'][style % 4];
    const TOWER = towerMat(k);
    const parts = [];
    const windows = (cx, cz, ww, dd, y0, y1, every = 7) => {
      for (let y = y0 + 4; y < y1 - 2; y += every) {
        if (r() < 0.2) continue;
        const c = r() < 0.75 ? lit('#ffd49a', 1.5 + r()) : lit('#9ad4ff', 1.4 + r());
        parts.push(part(new THREE.BoxGeometry(ww * (0.6 + r() * 0.35), 1.1, dd + 0.3), { at: [cx, y, cz], color: c, to: 'glow' }));
        parts.push(part(new THREE.BoxGeometry(ww + 0.3, 1.1, dd * (0.6 + r() * 0.35)), { at: [cx, y + every / 2, cz], color: c, to: 'glow' }));
      }
    };
    let top;
    if (style === 0) {
      const tiers = [[w, h * 0.55], [w * 0.74, h * 0.28], [w * 0.5, h * 0.17]];
      let y = 0;
      for (const [tw, th] of tiers) {
        parts.push(part(box(tw, th, tw), { at: [0, y, 0], color: BODY, to: TOWER }));
        parts.push(part(box(tw + 1.2, 1.2, tw + 1.2), { at: [0, y + th - 1.2, 0], color: '#5a5650', to: 'metal' }));
        windows(0, 0, tw, tw, y, y + th);
        y += th;
      }
      top = y;
      parts.push(part(cyl(1.2, 0.2, 24, 8), { at: [0, top, 0], color: '#6a6660', to: 'metal' }));
      top += 24;
    } else if (style === 1) {
      parts.push(part(cyl(w * 0.5, w * 0.42, h * 0.9, 20), { color: BODY, to: TOWER }));
      for (let y = 10; y < h * 0.9; y += 9) parts.push(part(cyl(w * 0.5 + 0.4, w * 0.5 + 0.4, 1.2, 20), { at: [0, y, 0], color: r() < 0.7 ? lit('#ffd49a', 1.6 + r()) : '#5a5650', to: r() < 0.7 ? 'glow' : 'metal' }));
      parts.push(part(cyl(w * 0.42, w * 0.95, h * 0.06, 24), { at: [0, h * 0.9, 0], color: BODY, to: TOWER }));
      parts.push(part(cyl(w * 0.95, w * 0.8, h * 0.04, 24), { at: [0, h * 0.96, 0], color: '#6a6660', to: 'metal' }));
      top = h;
    } else if (style === 2) {
      // (a deeper slab, its side window bands showing past the pilasters)
      parts.push(part(box(w * 1.3, h, w * 0.8), { color: BODY, to: TOWER }));
      parts.push(part(box(w * 0.5, h * 0.12, w * 0.8), { at: [w * 0.4, h, 0], rot: [0, 0, 0.5], color: BODY, to: TOWER }));
      windows(0, 0, w * 1.3, w * 0.8, 0, h, 6);
      for (const x of [-w * 0.66, w * 0.66]) parts.push(part(box(1.2, h, w * 0.3), { at: [x, 0, 0], color: '#5a5650', to: 'metal' }));
      top = h + h * 0.06;
    } else {
      parts.push(part(cyl(w * 0.62, w * 0.42, h * 0.85, 8), { color: BODY, to: TOWER }));
      windows(0, 0, w * 0.75, w * 0.75, 0, h * 0.85, 8);
      parts.push(part(cyl(w * 0.42, w * 0.6, h * 0.05, 8), { at: [0, h * 0.85, 0], color: '#6a6660', to: 'metal' }));
      parts.push(part(cyl(w * 0.5, w * 0.08, h * 0.15, 8), { at: [0, h * 0.9, 0], color: BODY, to: TOWER }));
      top = h * 1.05;
    }
    const object = k.build(parts, { name: 'skyscraper', shadows: false });
    // (the warning light at the top, blinking)
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3a2a').multiplyScalar(3), toneMapped: false }));
    beacon.position.y = top + 1;
    object.add(beacon);
    const phase = r() * 6;
    return { object, solids: [{ circle: [0, 0, w * 0.55] }], update: (t) => (beacon.visible = sin(t * 5.2 + phase) > 0.2) };
  },

  // the column of city under a platform or a plaza, `depth` down into the
  // haze, lit windows down it
  plinth(k, { w = 60, d = 60, depth = 330, round = false } = {}) {
    const r = rng(Math.round(w * 7 + d));
    const parts = [round ? part(cyl(w * 0.5, w * 0.5, depth, 28), { at: [0, -depth, 0], color: '#7e7870', to: 'paint' }) : part(box(w, depth, d), { at: [0, -depth, 0], color: '#7e7870', to: 'paint' })];
    for (let y = -depth + 6; y < -4; y += 7) {
      if (r() < 0.25) continue;
      const c = lit(r() < 0.8 ? '#ffd49a' : '#9ad4ff', 1.4 + r());
      if (round) parts.push(part(cyl(w * 0.5 + 0.25, w * 0.5 + 0.25, 1.1, 28), { at: [0, y, 0], color: c, to: 'glow' }));
      else parts.push(part(new THREE.BoxGeometry(w + 0.4, 1.1, d + 0.4), { at: [0, y, 0], color: c, to: 'glow' }));
    }
    return { object: k.build(parts, { name: 'plinth', shadows: false }) };
  },

  // a landing platform on top of its tower: a disc of plating, its lights
  // round the rim, the markings; the tower down into the haze below
  cplatform(k, { r: R = 28, depth = 330, light = '#8fd0ff', color = '#9a968e' } = {}) {
    const parts = [
      part(cyl(R, R, 0.6, 48), { at: [0, -0.3, 0], color, to: 'paint' }),
      part(cyl(R * 0.94, R * 0.94, 0.62, 48), { at: [0, -0.3, 0], color: '#7c7a76', to: 'paint' }),
      part(cyl(R * 0.45, R, 10, 48), { at: [0, -10.3, 0], color: '#6c6862', to: 'paint' }),
      part(cyl(R * 0.45, R * 0.45, depth, 28), { at: [0, -depth, 0], color: '#77736c', to: 'paint' }),
      part(ring(R * 0.62, 0.3, 40), { at: [0, 0.33, 0], color: '#d8c890', to: 'paint' }),
    ];
    for (const a of [0, PI / 2]) parts.push(part(new THREE.BoxGeometry(R * 1.3, 0.04, 0.8), { at: [0, 0.32, 0], rot: [0, a, 0], color: '#d8c890', to: 'paint' }));
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * PI * 2;
      parts.push(part(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 8), { at: [sin(a) * R * 0.97, 0.36, cos(a) * R * 0.97], color: lit(light, 3), to: 'glow' }));
    }
    for (let y = -16; y > -depth + 10; y -= 9) parts.push(part(cyl(R * 0.45 + 0.3, R * 0.45 + 0.3, 1.1, 28), { at: [0, y, 0], color: lit('#ffd49a', 1.2 + ((y * 7) % 5) * 0.2), to: 'glow' }));
    return { object: k.build(parts, { name: 'cplatform' }), floors: [{ x: 0, z: 0, r: R, y: 0.3 }] };
  },

  // a plaza on its plinth: a broad deck, paved, lit round its edge
  deck(k, { hw = 50, hd = 35, depth = 330, color = '#a8a296' } = {}) {
    const parts = [part(box(hw * 2, 0.6, hd * 2), { at: [0, -0.3, 0], color, to: 'stone' }), part(box(hw * 2 - 6, 4, hd * 2 - 6), { at: [0, -4.3, 0], color: '#6c6862', to: 'paint' })];
    for (let i = -hw + 6; i < hw - 2; i += 8) parts.push(part(box(0.3, 0.02, hd * 2 - 4), { at: [i, 0.3, 0], color: '#8e887c', to: 'stone' }));
    for (const s of [-1, 1]) {
      for (let i = 0; i < 12; i++) parts.push(part(new THREE.BoxGeometry(0.6, 0.12, 0.6), { at: [-hw + 3 + (i * (hw * 2 - 6)) / 11, 0.36, s * (hd - 1)], color: lit('#ffe2b0', 2.5), to: 'glow' }));
      for (let i = 0; i < 8; i++) parts.push(part(new THREE.BoxGeometry(0.6, 0.12, 0.6), { at: [s * (hw - 1), 0.36, -hd + 3 + (i * (hd * 2 - 6)) / 7], color: lit('#ffe2b0', 2.5), to: 'glow' }));
    }
    const object = k.build(parts, { name: 'deck' });
    const under = PROPS.plinth(k, { w: hw * 2 - 8, d: hd * 2 - 8, depth });
    under.object.position.y = -4.3;
    object.add(under.object);
    return { object, floors: [{ x: 0, z: 0, hw, hd, y: 0.3 }] };
  },

  // a skybridge: a deck between two platforms, its glass rails lit along
  // the top, the truss underneath; `len` long, facing along z
  skybridge(k, { len = 100, w = 6, style = 'coruscant' } = {}) {
    const K = style === 'kamino';
    const DECK = K ? '#8a939a' : '#8e8a84';
    const parts = [part(box(w, 0.6, len), { at: [0, -0.3, 0], color: DECK, to: 'paint' }), part(box(w * 0.5, 1.6, len), { at: [0, -1.9, 0], color: K ? '#b8c0c8' : '#5e5a56', to: 'metal' })];
    const rl = len - 3;
    for (const s of [-1, 1]) {
      parts.push(part(box(0.1, 1.05, rl), { at: [s * (w / 2 - 0.1), 0.3, 0], color: K ? '#c8d8e4' : '#9ab0c0', to: 'glass' }));
      parts.push(part(box(0.22, 0.12, rl), { at: [s * (w / 2 - 0.1), 1.35, 0], color: K ? lit('#d8f0ff', 1.6) : lit('#9ad8ff', 2.2), to: 'glow' }));
      for (let z = -rl / 2; z <= rl / 2; z += 6) parts.push(part(box(0.14, 1.2, 0.14), { at: [s * (w / 2 - 0.1), 0.3, z], color: '#5a5a5e', to: 'metal' }));
    }
    for (let z = -len / 2 + 5; z < len / 2 - 4; z += 10) parts.push(rod([-w * 0.25, -2.6, z], [w * 0.25, -2.6, z + 5], 0.12, 0.12, { color: '#5a5a5e', to: 'metal' }));
    const solids = [...rail([-(w / 2 - 0.1), -rl / 2], [-(w / 2 - 0.1), rl / 2]), ...rail([w / 2 - 0.1, -rl / 2], [w / 2 - 0.1, rl / 2])];
    return { object: k.build(parts, { name: 'skybridge', shadows: false }), floors: [{ x: 0, z: 0, hw: w / 2, hd: len / 2, yaw: 0, y: 0.3 }], solids };
  },

  // the Jedi Temple: a ziggurat of pale stone, 300 m, its five spires on
  // top (the tallest the High Council's), the great doors at its foot
  jeditemple(k) {
    const S = '#cbbd9f';
    const D = '#a99a7e';
    const parts = [];
    const sq = (bot, top, h, y) => part(new THREE.CylinderGeometry(top / Math.SQRT2, bot / Math.SQRT2, h, 4, 1).rotateY(PI / 4).translate(0, h / 2, 0), { at: [0, y, 0], color: S, to: 'stone' });
    parts.push(sq(200, 168, 64, 0), sq(166, 140, 8, 64), sq(138, 112, 46, 72), sq(110, 96, 6, 118), sq(94, 84, 22, 124));
    // the fluting up its faces
    for (let i = -8; i <= 8; i++) for (const [yaw, off] of [[0, 1], [PI / 2, 1], [PI, 1], [-PI / 2, 1]]) {
      const x = i * 10;
      const at = [x * cos(yaw) + 96.5 * sin(yaw) * off, 6, -x * sin(yaw) + 96.5 * cos(yaw) * off];
      parts.push(part(box(1.4, 52, 1.4), { at, rot: [0, yaw, 0], color: D, to: 'stone' }));
    }
    // the great doors and their columns
    parts.push(part(box(36, 46, 2), { at: [0, 0, 99.5], color: '#2e2a24', to: 'dark' }));
    for (let i = 0; i < 6; i++) parts.push(part(cyl(2.2, 2, 48, 14), { at: [-25 + i * 10, 0, 103], color: S, to: 'stone' }));
    parts.push(part(box(60, 5, 8), { at: [0, 48, 102], color: D, to: 'stone' }));
    // the spires: four at the corners, the tallest in the middle
    const spire = (x, z, base, h) => {
      parts.push(part(cyl(9, 7.5, h * 0.5, 12), { at: [x, base, z], color: S, to: 'stone' }));
      parts.push(part(cyl(7.5, 3.6, h * 0.36, 12), { at: [x, base + h * 0.5, z], color: S, to: 'stone' }));
      parts.push(part(cyl(4.2, 4.2, 2.4, 12), { at: [x, base + h * 0.62, z], color: lit('#ffd9a0', 1.5), to: 'glow' }));
      parts.push(part(cyl(3.6, 0.3, h * 0.16, 12), { at: [x, base + h * 0.86, z], color: '#d8c890', to: 'metal' }));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2;
        parts.push(part(box(1.2, h * 0.42, 1.2), { at: [x + sin(a) * 8.6, base + 2, z + cos(a) * 8.6], color: D, to: 'stone' }));
      }
    };
    for (const [x, z] of [[-30, -30], [30, -30], [-30, 30], [30, 30]]) spire(x, z, 146, 110);
    spire(0, 0, 146, 160);
    return { object: k.build(parts, { name: 'jeditemple', shadows: false }), solids: [{ box: [0, 0, 100, 100, 0] }, { box: [0, 103, 30, 3, 0] }] };
  },

  // the Senate: the great mushroom of a dome on its stem, ringed with
  // windows, standing over its plaza
  senate(k, { r: R = 90 } = {}) {
    const BODY = '#a8b0b8';
    const parts = [
      part(cyl(R * 0.62, R * 0.5, 30, 48), { color: '#8e969e', to: 'paint' }),
      part(cyl(R * 0.5, R * 0.98, 18, 48), { at: [0, 30, 0], color: BODY, to: 'paint' }),
      part(cyl(R * 0.98, R, 4, 48), { at: [0, 48, 0], color: '#8e969e', to: 'paint' }),
      part(dome(R, R * 0.22, 48), { at: [0, 52, 0], color: BODY, to: 'paint' }),
      part(ring(R * 0.99, 0.8, 48), { at: [0, 50, 0], color: lit('#cfe6ff', 1.5), to: 'glow' }),
    ];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * PI * 2;
      parts.push(part(box(3, 16, 1), { at: [sin(a) * R * 0.6, 6, cos(a) * R * 0.6], rot: [0, a, 0], color: '#2a3038', to: 'dark' }));
    }
    for (let y = 8; y < 28; y += 7) parts.push(part(cyl(R * 0.6 + 0.4, R * 0.6 + 0.4, 0.8, 48), { at: [0, y, 0], color: lit('#ffe2b0', 1.6), to: 'glow' }));
    return { object: k.build(parts, { name: 'senate', shadows: false }), solids: [{ circle: [0, 0, R * 0.62] }] };
  },

  // a great statue on its pedestal (the Senate's founders, the Temple's
  // Jedi of old), the pedestal's column down to the city, `drop` metres
  // (style 'jedi': the Processional Way's, the audit lane's model where it
  // loads; this one where it won't)
  statue(k, { h = 22, drop = 0 } = {}) {
    const S = '#c4b89c';
    const parts = [
      part(box(5, 3, 5), { color: '#8e887c', to: 'stone' }),
      part(cyl(1.6, 2.6, h * 0.62, 12), { at: [0, 3, 0], color: S, to: 'stone' }),
      part(new THREE.SphereGeometry(1.6, 12, 10), { at: [0, 3 + h * 0.66, 0], scale: [1.4, 1, 1.1], color: S, to: 'stone' }),
      part(new THREE.SphereGeometry(1.1, 12, 10), { at: [0, 3 + h * 0.78, 0.2], color: S, to: 'stone' }),
      part(new THREE.ConeGeometry(1.3, 1.6, 12).translate(0, 0.8, 0), { at: [0, 3 + h * 0.8, -0.1], color: S, to: 'stone' }),
    ];
    for (const s of [-1, 1]) parts.push(rod([s * 1.9, 3 + h * 0.64, 0.2], [s * 1.2, 3 + h * 0.42, 1.4], 0.55, 0.45, { color: S, to: 'stone' }));
    parts.push(rod([0, 3 + h * 0.42, 1.6], [0, 3 + h * 0.95, 1.6], 0.3, 0.3, { color: '#b0a488', to: 'stone' }));
    if (drop) parts.push(part(box(4, drop, 4), { at: [0, -drop, 0], color: '#7e7870', to: 'paint' }));
    return { object: k.build(parts, { name: 'statue', shadows: false }), solids: [{ box: [0, 0, 2.5, 2.5, 0] }] };
  },

  // 500 Republica: the tallest of the residential towers, its fluted
  // spire, and a senator's veranda out over the skylanes (railed, but for
  // the way in from the bridge, at +z)
  republica(k, { depth = 330 } = {}) {
    const BODY = '#c9c2b4';
    const parts = [
      part(cyl(16, 13, depth + 120, 16), { at: [0, -depth, 0], color: BODY, to: 'paint' }),
      part(cyl(13, 6, 150, 16), { at: [0, 120, 0], color: BODY, to: 'paint' }),
      part(cyl(6, 0.6, 60, 12), { at: [0, 270, 0], color: '#d8d0c0', to: 'metal' }),
      part(cyl(16, 16, 0.6, 32), { at: [0, -0.3, 22], color: '#bdb6a8', to: 'stone' }),
      part(cyl(9, 16, 6, 32), { at: [0, -6.3, 22], color: '#8a847a', to: 'paint' }),
    ];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * PI * 2;
      parts.push(part(box(1.4, depth + 260, 1.4), { at: [sin(a) * 16, -depth, cos(a) * 16], color: '#a8a090', to: 'stone' }));
    }
    for (let y = -depth + 8; y < 260; y += 8) if ((y * 13) % 7 > 1) parts.push(part(cyl(y < 120 ? 16.2 : 12, y < 120 ? 16.2 : 12, 1.1, 16), { at: [0, y, 0], color: lit('#ffe0b0', 1.5), to: 'glow' }));
    // Padmé's rooms off the veranda: tall lit windows, a low wall of planters
    parts.push(part(box(18, 5, 0.4), { at: [0, 0.3, 15.8], color: lit('#ffd9a8', 1.3), to: 'glow' }));
    for (let i = 0; i < 9; i++) parts.push(part(box(0.5, 5, 0.6), { at: [-8 + i * 2, 0.3, 16.1], color: '#8a847a', to: 'metal' }));
    const solids = [{ circle: [0, 0, 16.4] }];
    for (const c of rim(0, 22, 15.6, [[0, 0.32]])) if (Math.hypot(c.circle[0], c.circle[1]) > 16.5) solids.push(c);
    parts.push(part(new THREE.TorusGeometry(15.6, 0.12, 6, 48, PI * 1.8).rotateX(PI / 2).rotateY(PI / 2 + 0.31), { at: [0, 1.25, 22], color: lit('#9ad8ff', 2), to: 'glow' }));
    return { object: k.build(parts, { name: 'republica', shadows: false }), floors: [{ x: 0, z: 22, r: 15.6, y: 0.3 }], solids };
  },

  // Dex's Diner in CoCo Town: a chrome-trimmed diner, its windows warm,
  // its sign in neon on the roof
  dexdiner(k) {
    const tex = k.own(
      canvasTexture(256, (c, s) => {
        c.clearRect(0, 0, s, s);
        c.font = 'bold 92px sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.shadowColor = '#ff6a3a';
        c.shadowBlur = 18;
        c.fillStyle = '#ffd0a0';
        c.fillText('DEX’S', s / 2, s * 0.36);
        c.font = 'bold 44px sans-serif';
        c.fillStyle = '#9af0ff';
        c.shadowColor = '#2ad0ff';
        c.fillText('DINER', s / 2, s * 0.7);
      }),
    );
    const parts = [
      part(new THREE.CapsuleGeometry(4, 12, 6, 16).rotateZ(PI / 2), { at: [0, 4, 0], scale: [1, 1, 1.2], color: '#d8c8a8', to: 'paint' }),
      part(box(20, 0.4, 10.4), { at: [0, 0, 0], color: '#6a6660', to: 'metal' }),
      part(box(15, 2.2, 9.9), { at: [0, 2.3, 0], color: lit('#ffcf8a', 1.15), to: 'glow' }),
      part(box(20.4, 0.4, 10.2), { at: [0, 5.2, 0], color: '#e8e8ec', to: 'metal' }),
      part(box(20.4, 0.4, 10.2), { at: [0, 1.8, 0], color: '#3aa8a0', to: 'paint' }),
      part(box(2, 3, 0.4), { at: [0, 0.2, 4.95], color: '#2a2420', to: 'dark' }),
      part(box(0.4, 4.2, 0.4), { at: [-4, 8, 0], color: '#5a5650', to: 'metal' }),
      part(box(0.4, 4.2, 0.4), { at: [4, 8, 0], color: '#5a5650', to: 'metal' }),
    ];
    for (let i = 0; i < 8; i++) parts.push(part(box(0.3, 2.3, 10.1), { at: [-7 + i * 2, 2.25, 0], color: '#4a4a50', to: 'metal' }));
    const object = k.build(parts, { name: 'dexdiner' });
    // the sign, readable from both sides
    const signMat = k.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, color: lit('#ffffff', 1.6), depthWrite: false }));
    for (const a of [0, PI]) {
      const sign = new THREE.Mesh(k.own(new THREE.PlaneGeometry(10, 10)), signMat);
      sign.position.set(0, 12, a ? -0.05 : 0.05);
      sign.rotation.y = a;
      object.add(sign);
    }
    return { object, solids: [{ box: [0, 0, 10, 5.2, 0] }] };
  },

  // the Outlander Club, in the Uscru entertainment district: neon up its
  // front, a vertical sign, light spilling out of its door
  club(k) {
    const r = rng(41);
    // its sign's dark glyphs, strokes of an alien script on the lit panel
    const tex = k.own(
      canvasTexture(256, (c, s) => {
        c.clearRect(0, 0, s, s);
        c.fillStyle = '#1a0e10';
        for (let i = 0; i < 7; i++) {
          const x = 14 + i * 34;
          c.fillRect(x, 40 + r() * 20, 22, 10);
          c.fillRect(x + (r() < 0.5 ? 0 : 12), 50, 10, 120 + r() * 40);
          if (r() < 0.6) c.fillRect(x, 150 + r() * 40, 22, 10);
        }
      }),
    );
    const parts = [
      part(box(24, 16, 16), { color: '#2a1a1e', to: 'paint' }),
      part(box(26, 1, 18), { at: [0, 16, 0], color: '#2a2830', to: 'metal' }),
      // the sign over the door
      part(box(15, 1.8, 0.5), { at: [-2, 8.5, 8.3], color: lit('#ffe6b0', 1.8), to: 'glow' }),
      // the door: a dark round-ended portal, a glowing half-ring beside it
      part(box(7, 5, 0.3), { at: [-2, 0, 8.1], color: '#140c10', to: 'dark' }),
      part(new THREE.TorusGeometry(4, 0.45, 8, 24, PI), { at: [3.5, 4, 8.4], rot: [0, 0, -PI / 2], color: lit('#fff2d8', 2.2), to: 'glow' }),
      // the green and red roundels
      part(cyl(1.2, 1.2, 0.3, 20), { at: [7.5, 10, 8.3], rot: [PI / 2, 0, 0], color: lit('#3aff8a', 2), to: 'glow' }),
      part(cyl(1.2, 1.2, 0.3, 20), { at: [7.5, 12.5, 8.3], rot: [PI / 2, 0, 0], color: lit('#ff3a3a', 2), to: 'glow' }),
    ];
    for (const x of [-5.5, 1.5]) parts.push(part(cyl(2.5, 2.5, 0.3, 24), { at: [x, 2.5, 8.1], rot: [PI / 2, 0, 0], color: '#140c10', to: 'dark' }));
    // blue panels down the side the bridge comes in on
    for (let i = 0; i < 3; i++) parts.push(part(box(0.2, 4, 1.4), { at: [12.1, 4, -4 + i * 4], color: lit('#3ad8ff', 1.8), to: 'glow' }));
    const object = k.build(parts, { name: 'club' });
    const sign = new THREE.Mesh(k.own(new THREE.PlaneGeometry(14, 1.6)), k.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
    sign.position.set(-2, 9.4, 8.57);
    object.add(sign);
    return { object, solids: [{ box: [0, 0, 12, 8, 0] }] };
  },

  // the Works: the derelict industrial district, rusting cranes and
  // girder towers, chimneys with beacons
  works(k) {
    const r = rng(23);
    const RUST = '#5a3e30';
    const parts = [];
    const solids = [];
    for (let i = 0; i < 3; i++) {
      const x = -14 + i * 14;
      const h = 30 + r() * 22;
      const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [dx, dz] of legs) parts.push(rod([x + dx * 2.4, 0, -8 + dz * 2.4], [x + dx * 2.4 * 0.7, h, -8 + dz * 2.4 * 0.7], 0.25, 0.22, { color: RUST, to: 'metal' }));
      // braced as a lattice mast: a diagonal across each face in every 5 m
      // bay, alternating; a deck every 10 m
      const off = (y) => 2.4 * (1 - (0.3 * y) / h);
      for (let y0 = 0, bay = 0; y0 + 5 <= h; y0 += 5, bay++)
        for (let f = 0; f < 4; f++) {
          const [a0, b0] = legs[f];
          const [a1, b1] = legs[(f + 1) % 4];
          const [lo, hi] = bay % 2 ? [[a1, b1], [a0, b0]] : [[a0, b0], [a1, b1]];
          parts.push(rod([x + lo[0] * off(y0), y0, -8 + lo[1] * off(y0)], [x + hi[0] * off(y0 + 5), y0 + 5, -8 + hi[1] * off(y0 + 5)], 0.1, 0.1, { color: RUST, to: 'metal' }));
        }
      for (let y = 4; y < h; y += 10) parts.push(part(box(5, 0.4, 5), { at: [x, y, -8], color: '#3e2e26', to: 'metal' }));
      // the crane's boom out over the edge, its cable and hook
      const a = r() * PI * 2;
      const L = 22 + r() * 10;
      parts.push(rod([x, h, -8], [x + sin(a) * L, h + 4, -8 + cos(a) * L], 0.45, 0.3, { color: '#c8902a', to: 'paint' }));
      parts.push(rod([x + sin(a) * L, h + 4, -8 + cos(a) * L], [x + sin(a) * L, h - 14, -8 + cos(a) * L], 0.05, 0.05, { color: '#2a2622', to: 'metal' }));
      parts.push(part(new THREE.SphereGeometry(0.5, 8, 6), { at: [x, h + 1, -8], color: lit('#ff4a2a', 3), to: 'glow' }));
      solids.push({ box: [x, -8, 2.8, 2.8, 0] });
    }
    for (const [x, z, h] of [[16, 10, 34], [20, 2, 26]]) {
      parts.push(part(cyl(2.6, 2.2, h, 14), { at: [x, 0, z], color: '#6a5a4c', to: 'metal' }));
      parts.push(part(cyl(2.3, 2.3, 0.6, 14), { at: [x, h, z], color: lit('#ffb05a', 2), to: 'glow' }));
      solids.push({ circle: [x, z, 2.7] });
    }
    for (let i = 0; i < 4; i++) parts.push(part(cyl(4, 4, 7, 18), { at: [-16 + i * 9, 0, 12], color: vary('#5e5046', r, 0.12), to: 'metal' }));
    solids.push({ box: [-2.5, 12, 18, 4.2, 0] });
    parts.push(part(box(26, 0.3, 6), { at: [-6, 14, -2], color: '#3e2e26', to: 'metal' }));
    return { object: k.build(parts, { name: 'works' }), solids };
  },

  // Anakin's airspeeder: yellow, its twin turbines out front with the
  // energy binder crackling between them, the open cockpit behind; 6 m,
  // hovering
  airspeeder(k, { color = '#eac524' } = {}) {
    const H = 1.2;
    const parts = [];
    for (const x of [-0.85, 0.85]) {
      parts.push(part(turned([[0.05, -1.2], [0.42, -0.9], [0.48, 1.2], [0.4, 2.0], [0.3, 2.2]], 14), { at: [x, H, 1.1], color, to: 'paint' }));
      parts.push(part(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12), { at: [x, H, 3.33], rot: [PI / 2, 0, 0], color: '#2a2a2c', to: 'dark' }));
    }
    parts.push(part(new THREE.TorusGeometry(0.85, 0.04, 6, 16, PI), { at: [0, H, 3.2], rot: [0, 0, 0], color: lit('#bfe8ff', 3), to: 'glow' }));
    const body = loft([
      { z: -2.9, pts: trap8(0.8, 0.5, 0.5, 0.1, H + 0.1) },
      { z: -1.2, pts: trap8(1.4, 1.0, 0.8, 0.15, H + 0.1) },
      { z: 0.4, pts: trap8(1.3, 0.9, 0.7, 0.15, H) },
      { z: 1.4, pts: trap8(0.5, 0.4, 0.4, 0.1, H) },
    ]);
    parts.push(part(body, { color, to: 'paint' }));
    parts.push(part(box(1.0, 0.5, 1.4), { at: [0, H + 0.3, -1.2], color: '#3a2a22', to: 'cloth' }));
    parts.push(part(new THREE.BoxGeometry(1.1, 0.4, 0.05), { at: [0, H + 0.7, -0.35], rot: [-0.5, 0, 0], color: '#a8c0c8', to: 'glass' }));
    for (const x of [-0.85, 0.85]) parts.push(rod([x, H, 0.2], [0, H, -0.2], 0.08, 0.08, { color: '#7a7a7e', to: 'metal' }));
    return { object: k.build(parts, { name: 'airspeeder' }), solids: [{ box: [0, 0.3, 1.3, 3.2, 0] }] };
  },

  // the skylanes: a stream of speeders going one way, and another coming
  // back alongside it; `len` long, along z
  airlane(k, { len = 1400, n = 30, speed = 34, gap = 9, seed = 1 } = {}) {
    const r = rng(seed);
    const COLORS = ['#c8c2b8', '#d84a3a', '#e8c040', '#5a7ad0', '#e0e0e4', '#3a3a40', '#a86ad0'];
    const body = k.geometry([part(new THREE.CapsuleGeometry(0.7, 3.2, 4, 8).rotateX(PI / 2), { scale: [1.2, 0.6, 1], color: '#ffffff', to: 'paint' }), part(box(3.2, 0.2, 1.2), { at: [0, -0.1, -0.8], color: '#ffffff', to: 'paint' })]);
    const glow = k.geometry([part(new THREE.SphereGeometry(0.35, 6, 4), { at: [-0.6, 0, -2.4], color: lit('#ff7a4a', 3), to: 'glow' }), part(new THREE.SphereGeometry(0.35, 6, 4), { at: [0.6, 0, -2.4], color: lit('#ff7a4a', 3), to: 'glow' })]);
    const mat = k.own(k.mats.paint.clone());
    mat.vertexColors = true;
    const ships = new THREE.InstancedMesh(body, mat, n * 2);
    const lights = new THREE.InstancedMesh(glow, k.mats.glow, n * 2);
    for (const m of [ships, lights]) m.frustumCulled = false;
    const lanes = Array.from({ length: n * 2 }, (_, i) => ({ dir: i < n ? 1 : -1, at: r() * len, dy: (r() - 0.5) * 4, dx: (i < n ? -gap / 2 : gap / 2) + (r() - 0.5) * 2, v: speed * (0.8 + r() * 0.4) }));
    const c = new THREE.Color();
    lanes.forEach((l, i) => ships.setColorAt(i, c.set(COLORS[i % COLORS.length])));
    const object = new THREE.Group();
    object.add(ships, lights);
    // (the lane itself, glowing: a ribbon a side, one tone each way, the
    // skylanes of the film's sunsets seen from afar)
    for (const [dx, tone] of [[-gap / 2, '#ffd9a0'], [gap / 2, '#8fd0ff']]) {
      const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.6, len).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(tone).multiplyScalar(1.6), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      ribbon.position.set(dx, -1.2, 0);
      ribbon.frustumCulled = false;
      object.add(ribbon);
    }
    const M = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const qBack = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), PI);
    const one = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    const place = (t) => {
      lanes.forEach((l, i) => {
        const z = ((((l.at + t * l.v) % len) + len) % len) - len / 2;
        p.set(l.dx, l.dy + sin(t * 0.7 + i) * 0.3, z * l.dir);
        M.compose(p, l.dir > 0 ? q : qBack, one);
        ships.setMatrixAt(i, M);
        lights.setMatrixAt(i, M);
      });
      ships.instanceMatrix.needsUpdate = true;
      lights.instanceMatrix.needsUpdate = true;
    };
    place(0);
    return { object, update: (t) => place(t) };
  },

  // a Senate Guard: blue robes to the ground, the tall crested helmet, a
  // ceremonial pike
  senateguard(k) {
    const BLUE = '#2a4a9a';
    const parts = [
      part(new THREE.ConeGeometry(0.42, 1.5, 14, 1, true).translate(0, 0.75, 0), { color: BLUE, to: 'cloth' }),
      part(new THREE.CapsuleGeometry(0.2, 0.45, 4, 10), { at: [0, 1.45, 0], scale: [1.2, 1, 0.8], color: BLUE, to: 'cloth' }),
      part(new THREE.SphereGeometry(0.15, 12, 10), { at: [0, 1.88, 0], scale: [1, 1.2, 1.1], color: '#1e3a86', to: 'paint' }),
      part(box(0.05, 0.4, 0.34), { at: [0, 1.86, -0.02], color: '#1e3a86', to: 'paint' }),
      part(box(0.18, 0.04, 0.04), { at: [0, 1.9, 0.14], color: '#0a0a10', to: 'dark' }),
      part(cyl(0.025, 0.025, 2.6, 6), { at: [0.3, 0, 0.12], color: '#c8c0a8', to: 'metal' }),
      part(new THREE.ConeGeometry(0.05, 0.3, 6), { at: [0.3, 2.7, 0.12], color: '#e8e0c8', to: 'metal' }),
    ];
    for (const s of [-1, 1]) parts.push(rod([s * 0.26, 1.62, 0], [s * 0.3 * (s > 0 ? 1 : 1.1), 1.15, 0.12], 0.07, 0.06, { color: BLUE, to: 'cloth' }));
    const body = k.build(parts, { name: 'senateguard' });
    const object = new THREE.Group();
    object.add(body);
    return {
      object,
      update(t, dt, move = 0) {
        body.rotation.z = sin(t * 7) * 0.03 * move;
        body.position.y = abs(sin(t * 7)) * 0.03 * move;
      },
    };
  },
};
