// The planet map: the ground's biomes and heights round the ship, drawn from
// the field, nothing stored. The terrain worker makes a raster of each 2 km
// square (lib/land/flight/mapRaster.js) when the map asks, behind the
// ground's own leaves; each is painted once into a 32 px canvas, hill-shaded
// from the north-west, and the minimap and the full map are composited from
// those canvases, the markers over them upright (./mapRules.js says where).
//
//   createMap({ spec, workers, makeCanvas }) → { want(centre, radiusM),
//     put(key, raster) → kept, has(key), size(), drawMini(ctx, { ship, size,
//     headingUp, markers }) → the cell's address, drawFull(ctx, { ship,
//     markers }, { w, h, centre, scale }), hit(markers, [px, py], view) →
//     the marker under a tap | null, dispose() }

import { MAP_DEPTH, MAP_N } from '../../../lib/land/flight/mapRaster';
import { leafOf, sizeAt } from '../../../lib/land/flight/quadtree';
import { WORKER } from './groundCore';
import { LABEL_H, MAP_CELL, MAP_KEEP, biomeRgb, cellAddress, miniScale, placeLabels, project, visibleLeaves } from './mapRules';

// behind the ground's leaves (their priority is their depth, 0 to 6), two at
// a time, so the pool always has a worker for the ground
export const MAP_PRIORITY = 20;
export const MAP_FLYING = 2;

const SQUARE = sizeAt(MAP_DEPTH);
const INK = '#1a1f2b';
const GLASS = 'rgba(255, 255, 255, 0.86)';
const FONT = '600 12px system-ui, sans-serif';
export const MARK = { poi: '#f0c040', waypoint: '#ff6b4a', pilot: '#36c5f0', built: '#b48cff', occurrence: '#ffd37a' };
const HIT_PX = 22; // half a 44 px target

const defaultCanvas = (n) => {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(n, n);
  const c = document.createElement('canvas');
  c.width = c.height = n;
  return c;
};

const parseKey = (key) => key.split(':').slice(1).map(Number);

export function createMap({ spec, workers, makeCanvas = defaultCanvas }) {
  const kept = new Map(); // key → { raster, canvas | null }, oldest first
  const flying = new Set();
  const blocked = new Set();
  let wanted = [];
  let disposed = false;
  const nB = spec.biomes.length;

  const whole = (r) => {
    if (!(r?.biome instanceof Uint8Array) || !(r.height instanceof Float32Array)) return false;
    if (r.biome.length !== MAP_N * MAP_N || r.height.length !== MAP_N * MAP_N) return false;
    for (let i = 0; i < r.biome.length; i++) if (r.biome[i] >= nB || !Number.isFinite(r.height[i])) return false;
    return true;
  };

  function put(key, raster) {
    if (!whole(raster)) return false;
    kept.delete(key);
    kept.set(key, { raster, canvas: null });
    // (a Map keeps its order: the first key is the one touched longest ago)
    while (kept.size > MAP_KEEP) kept.delete(kept.keys().next().value);
    return true;
  }

  function ask(key) {
    const [ix, iz] = parseKey(key);
    flying.add(key);
    workers.request(WORKER, { type: 'raster', key, priority: MAP_PRIORITY, spec, leaf: leafOf(MAP_DEPTH, ix, iz) }).then(
      (a) => {
        if (disposed || !flying.delete(key) || !a) return;
        if (!put(key, a)) blocked.add(key);
        pump();
      },
      () => {
        flying.delete(key);
        blocked.add(key);
      },
    );
  }

  function pump() {
    for (const key of wanted) {
      if (flying.size >= MAP_FLYING) return;
      if (!kept.has(key) && !flying.has(key) && !blocked.has(key)) ask(key);
    }
  }

  function want(centre, radiusM) {
    if (disposed) return;
    // (never more than half the keep: a wide view mustn't push out what it shows)
    wanted = visibleLeaves(centre, radiusM, 1).slice(0, MAP_KEEP / 2);
    const now = new Set(wanted);
    for (const key of [...flying]) {
      if (now.has(key)) continue;
      flying.delete(key);
      workers.cancel(WORKER, key);
    }
    for (const key of wanted) {
      const k = kept.get(key);
      if (k) {
        kept.delete(key);
        kept.set(key, k);
      }
    }
    pump();
  }

  // a raster as 32 × 32 pixels: the biome's colour at its height, lit from
  // the north-west by the slope, so ridges and craters read on a flat map
  function paint(entry) {
    const { biome, height } = entry.raster;
    const c = makeCanvas(MAP_N);
    const g = c.getContext('2d');
    const img = g.createImageData(MAP_N, MAP_N);
    const cell = SQUARE / MAP_N;
    const at = (x, z) => height[Math.min(MAP_N - 1, Math.max(0, z)) * MAP_N + Math.min(MAP_N - 1, Math.max(0, x))];
    for (let z = 0; z < MAP_N; z++)
      for (let x = 0; x < MAP_N; x++) {
        const i = z * MAP_N + x;
        const slope = (at(x - 1, z) - at(x + 1, z) + at(x, z - 1) - at(x, z + 1)) / (2 * cell);
        const lit = 1 + Math.max(-0.35, Math.min(0.35, slope * 1.4));
        const [r, gr, b] = biomeRgb(spec, biome[i], height[i]);
        img.data[i * 4] = r * lit;
        img.data[i * 4 + 1] = gr * lit;
        img.data[i * 4 + 2] = b * lit;
        img.data[i * 4 + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    entry.canvas = c;
    return c;
  }

  // the squares round `centre`, in a frame already moved to the map's middle
  // (and turned, heading up): each at its offset in px
  function ground(ctx, centre, scale, radiusPx) {
    const px = SQUARE / scale;
    // (a 64 m cell is 4 to 8 px here: smoothed, the biomes blend as the ground does)
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    for (const key of visibleLeaves(centre, radiusPx, scale)) {
      const k = kept.get(key);
      if (!k) continue;
      const [ix, iz] = parseKey(key);
      ctx.drawImage(k.canvas ?? paint(k), (ix * SQUARE - centre[0]) / scale, (iz * SQUARE - centre[1]) / scale, px, px);
    }
  }

  function shipAt(ctx, x, y, yaw, size = 9) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-yaw);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.7, size * 0.8);
    ctx.lineTo(0, size * 0.35);
    ctx.lineTo(-size * 0.7, size * 0.8);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function mark(ctx, m, x, y) {
    ctx.fillStyle = MARK[m.kind] ?? '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (m.kind === 'poi') {
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 7, y);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 7, y);
      ctx.closePath();
    } else if (m.kind === 'built') {
      ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.strokeRect(x - 5, y - 5, 10, 10);
      return;
    } else if (m.kind === 'waypoint') {
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = MARK.waypoint;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = MARK.waypoint;
      ctx.fill();
      return;
    } else ctx.arc(x, y, m.kind === 'pilot' ? 4.5 : 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // labels on glass, upright, beside their markers, none over another
  // (mapRules' placeLabels); `marks` [[text, x, y]], the most wanted first
  function labels(ctx, marks, inside) {
    ctx.font = FONT;
    const items = marks.filter(([t]) => t).map(([text, x, y]) => ({ text, x, y, w: ctx.measureText(text).width + 10 }));
    for (const r of placeLabels(items, inside)) {
      ctx.fillStyle = GLASS;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, LABEL_H, 6);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.fillText(r.text, r.x + 5, r.y + 14);
    }
  }

  return {
    want,
    put,
    has: (key) => kept.has(key),
    size: () => kept.size,

    // the disc: the ground round the ship (north up, or turned so the nose
    // is up), the markers on it, the ship in the middle; a waypoint off the
    // disc sits on its rim, pointing the way
    drawMini(ctx, { ship, size, headingUp = false, markers = [] }) {
      const r = size / 2;
      const scale = miniScale(size);
      const centre = [ship.x, ship.z];
      const view = { centre, scale, headingUp, heading: ship.yaw };
      want(centre, r * scale * 1.2);
      ctx.save();
      ctx.beginPath();
      ctx.arc(r, r, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#5b6878';
      ctx.fillRect(0, 0, size, size);
      ctx.save();
      ctx.translate(r, r);
      if (headingUp) ctx.rotate(ship.yaw);
      ground(ctx, centre, scale, r * 1.42);
      ctx.restore();
      // north, on the rim (under the markers: a waypoint due north shows over it)
      const [nx, ny] = project([ship.x, ship.z - (r - 13) * scale], view);
      ctx.font = FONT;
      ctx.fillStyle = GLASS;
      ctx.beginPath();
      ctx.arc(r + nx, r + ny, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.fillText('N', r + nx - 4.5, r + ny + 4.5);
      const named = [];
      for (const m of markers) {
        let [x, y] = project(m.at, view);
        const d = Math.hypot(x, y);
        if (d > r - 10) {
          if (m.kind !== 'waypoint') continue;
          [x, y] = [(x / d) * (r - 12), (y / d) * (r - 12)];
        } else if (m.kind === 'poi' || m.kind === 'waypoint') named.push([d, m.label, r + x, r + y]);
        mark(ctx, m, r + x, r + y);
      }
      // (nearest first; a label's corners all inside the disc)
      const inDisc = (b) => [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].every(([x, y]) => Math.hypot(x - r, y - r) < r - 2);
      labels(ctx, named.sort((a, b) => a[0] - b[0]).map(([, ...rest]) => rest), inDisc);
      shipAt(ctx, r, r, headingUp ? 0 : ship.yaw);
      ctx.restore();
      return `Cell ${cellAddress(ship.x, ship.z)}`;
    },

    // the full map: the squares in view at `scale` m a px, the cells' grid,
    // every marker with its label, the ship, and a line to the waypoint
    drawFull(ctx, { ship, markers = [] }, { w, h, centre, scale }) {
      want(centre, (Math.hypot(w, h) / 2) * scale);
      ctx.fillStyle = '#5b6878';
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ground(ctx, centre, scale, Math.hypot(w, h) / 2);
      // the shared world's cells, faint, so the address reads off the map
      ctx.strokeStyle = 'rgba(26, 31, 43, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const x0 = Math.floor((centre[0] - (w / 2) * scale) / MAP_CELL), x1 = Math.ceil((centre[0] + (w / 2) * scale) / MAP_CELL);
      const z0 = Math.floor((centre[1] - (h / 2) * scale) / MAP_CELL), z1 = Math.ceil((centre[1] + (h / 2) * scale) / MAP_CELL);
      for (let i = x0; i <= x1; i++) {
        const x = (i * MAP_CELL - centre[0]) / scale;
        ctx.moveTo(x, -h / 2);
        ctx.lineTo(x, h / 2);
      }
      for (let i = z0; i <= z1; i++) {
        const y = (i * MAP_CELL - centre[1]) / scale;
        ctx.moveTo(-w / 2, y);
        ctx.lineTo(w / 2, y);
      }
      ctx.stroke();
      ctx.restore();
      const view = { centre, scale };
      const at = (p) => {
        const [x, y] = project(p, view);
        return [w / 2 + x, h / 2 + y];
      };
      const [sx, sy] = at([ship.x, ship.z]);
      const way = markers.find((m) => m.kind === 'waypoint');
      if (way) {
        const [wx, wy] = at(way.at);
        ctx.save();
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = MARK.waypoint;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(wx, wy);
        ctx.stroke();
        ctx.restore();
      }
      const shown = [];
      for (const m of markers) {
        const [x, y] = at(m.at);
        if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
        mark(ctx, m, x, y);
        shown.push([m, x, y]);
      }
      // (the ship's surroundings named first; a waypoint on a place is named once)
      const named = shown.filter(([m]) => m.kind !== 'waypoint' || !markers.some((o) => o.kind === 'poi' && o.id === m.id));
      named.sort((a, b) => Math.hypot(a[1] - sx, a[2] - sy) - Math.hypot(b[1] - sx, b[2] - sy));
      labels(ctx, named.map(([m, x, y]) => [m.label, x, y]), (b) => b.x >= 4 && b.y >= 4 && b.x + b.w <= w - 4 && b.y + b.h <= h - 4);
      shipAt(ctx, sx, sy, ship.yaw, 11);
    },

    // the marker nearest a tap, within half a 44 px target
    hit(markers, [px, py], { w, h, centre, scale }) {
      let best = null, bestD = HIT_PX;
      for (const m of markers) {
        const [x, y] = project(m.at, { centre, scale });
        const d = Math.hypot(w / 2 + x - px, h / 2 + y - py);
        if (d <= bestD) [best, bestD] = [m, d];
      }
      return best;
    },

    dispose() {
      disposed = true;
      for (const key of flying) workers.cancel(WORKER, key);
      flying.clear();
      kept.clear();
    },
  };
}

