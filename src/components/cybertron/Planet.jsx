import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../lib/hooks';
import { useScene } from '../../lib/three/useScene';
import '../../styles/lazy/cybertron.css';

// Cybertron, turning slowly: a planet plated in metal, scored with glowing
// circuitry and burning in places from the war. `side` sets the energon
// colour.
//
// In WebGL it's a real globe (./planet3d.js): plates, energon, city rings and
// fires from one shader, with its moons and a ring of wreckage, and you can
// turn it by hand. Without WebGL it's drawn on a 2D canvas: a metal texture
// is painted once, then each frame wraps it round a lit sphere, pixel by
// pixel, and adds the glow on top.

const load = () => import('./planet3d');
const LABEL = 'The planet Cybertron, plated in metal and burning in places, turning slowly';

export default function Planet({ side = 'autobot', className = '' }) {
  const { wrap, meant } = useScene(load, { id: 'cy-planet', props: { side } });
  return (
    <div ref={wrap} className={className} role="img" aria-label={`${LABEL}. Drag to turn it.`}>
      {!meant && <Planet2D side={side} className="cy-planet-flat" />}
    </div>
  );
}

const TW = 1024;
const TH = 512;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// The surface, painted flat: plates and seams (albedo), and what glows (emission).
function paint(side) {
  const r = rng(1984);
  const albedo = document.createElement('canvas');
  albedo.width = TW;
  albedo.height = TH;
  const a = albedo.getContext('2d');
  a.fillStyle = '#3c424b';
  a.fillRect(0, 0, TW, TH);
  // plates, small and dense near the equator, larger towards the poles
  for (let i = 0; i < 2600; i++) {
    const y = r() * TH;
    const lat = Math.abs(y / TH - 0.5) * 2;
    const w = 6 + r() * (lat > 0.7 ? 70 : 34);
    const h = 4 + r() * (lat > 0.7 ? 26 : 16);
    const g = 52 + Math.floor(r() * 70);
    a.fillStyle = `rgb(${g},${g + 4},${g + 10})`;
    a.fillRect(r() * TW, y, w, h);
    if (r() > 0.6) {
      a.strokeStyle = 'rgba(10,12,16,0.65)';
      a.lineWidth = 1;
      a.strokeRect(r() * TW, y, w, h);
    }
  }
  // trenches and canyons
  a.strokeStyle = 'rgba(8,10,14,0.85)';
  for (let i = 0; i < 26; i++) {
    a.lineWidth = 1 + r() * 3;
    a.beginPath();
    const y = r() * TH;
    a.moveTo(0, y);
    for (let x = 0; x <= TW; x += 32) a.lineTo(x, y + Math.sin(x / 90 + i) * 6);
    a.stroke();
  }
  // scorched ground where the fires are
  const fires = Array.from({ length: 14 }, () => ({ x: r() * TW, y: TH * (0.2 + r() * 0.6), s: 14 + r() * 34 }));
  fires.forEach((f) => {
    const g = a.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.s * 1.8);
    g.addColorStop(0, 'rgba(20,10,6,0.9)');
    g.addColorStop(1, 'rgba(20,10,6,0)');
    a.fillStyle = g;
    a.fillRect(f.x - f.s * 2, f.y - f.s * 2, f.s * 4, f.s * 4);
  });

  const glow = document.createElement('canvas');
  glow.width = TW;
  glow.height = TH;
  const e = glow.getContext('2d');
  e.fillStyle = '#000';
  e.fillRect(0, 0, TW, TH);
  const energon = side === 'decepticon' ? [180, 120, 255] : [79, 216, 255];
  const gold = side === 'decepticon' ? [255, 70, 90] : [255, 196, 70];
  // circuitry: bands of light along the latitudes, and great rings
  for (let i = 0; i < 18; i++) {
    const c = i % 3 ? energon : gold;
    e.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.35 + r() * 0.5})`;
    e.lineWidth = 1 + r() * 2;
    const y = TH * (0.12 + r() * 0.76);
    const x0 = r() * TW;
    e.beginPath();
    e.moveTo(x0, y);
    e.lineTo(x0 + 80 + r() * 380, y);
    e.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const c = i % 2 ? gold : energon;
    const x = r() * TW;
    const y = TH * (0.25 + r() * 0.5);
    for (let k = 0; k < 3; k++) {
      e.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.75 - k * 0.2})`;
      e.lineWidth = 2.5 - k * 0.6;
      e.beginPath();
      e.ellipse(x, y, 24 + k * 16 + r() * 10, (24 + k * 16) * 0.55, 0, 0, Math.PI * 2);
      e.stroke();
    }
  }
  // city lights: a scatter of tiny windows
  for (let i = 0; i < 1600; i++) {
    const c = r() > 0.75 ? gold : energon;
    e.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.25 + r() * 0.6})`;
    e.fillRect(r() * TW, TH * (0.08 + r() * 0.84), 1 + r() * 2, 1);
  }
  // the fires themselves
  fires.forEach((f) => {
    const g = e.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.s);
    g.addColorStop(0, 'rgba(255,236,170,1)');
    g.addColorStop(0.3, 'rgba(255,120,30,0.9)');
    g.addColorStop(1, 'rgba(160,30,0,0)');
    e.fillStyle = g;
    e.fillRect(f.x - f.s, f.y - f.s, f.s * 2, f.s * 2);
  });
  return {
    albedo: a.getImageData(0, 0, TW, TH).data,
    glow: e.getImageData(0, 0, TW, TH).data,
  };
}

function Planet2D({ side = 'autobot', className = '' }) {
  const canvas = useRef(null);
  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext('2d');
    if (!ctx) return undefined;
    const tex = paint(side);
    const still = prefersReducedMotion();
    let size = 0;
    let map = null; // per pixel inside the disc: texture u, v row, light
    let img = null;
    const light = [-0.55, -0.45, 0.7];
    const ll = Math.hypot(...light);
    const setup = () => {
      const css = cv.clientWidth;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      size = Math.max(160, Math.min(640, Math.round(css * dpr)));
      cv.width = size;
      cv.height = size;
      img = ctx.createImageData(size, size);
      const R = size * 0.4;
      const c = size / 2;
      const cells = [];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const nx = (x - c) / R;
          const ny = (y - c) / R;
          const d2 = nx * nx + ny * ny;
          if (d2 > 1) continue;
          const nz = Math.sqrt(1 - d2);
          const u = Math.atan2(nx, nz) / (Math.PI * 2) + 0.5;
          const v = Math.min(TH - 1, Math.max(0, Math.floor((0.5 + Math.asin(ny) / Math.PI) * TH)));
          const lit = Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / ll);
          cells.push((y * size + x) * 4, u, v, 0.12 + lit * 0.95, Math.pow(1 - nz, 3));
        }
      }
      map = Float32Array.from(cells);
    };
    setup();

    let raf = 0;
    let visible = true;
    let spin = 0.18;
    let last = 0;
    const flares = [];
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      if (!still) spin = (spin + dt * 0.012) % 1;
      const d = img.data;
      d.fill(0);
      const flick = 0.85 + 0.15 * Math.sin(now / 140);
      for (let i = 0; i < map.length; i += 5) {
        const p = map[i];
        const tu = Math.floor(((map[i + 1] + spin) % 1) * TW);
        const t = (map[i + 2] * TW + tu) * 4;
        const lit = map[i + 3];
        const rim = map[i + 4];
        d[p] = Math.min(255, tex.albedo[t] * lit + tex.glow[t] * flick + rim * 60);
        d[p + 1] = Math.min(255, tex.albedo[t + 1] * lit + tex.glow[t + 1] * flick + rim * 110);
        d[p + 2] = Math.min(255, tex.albedo[t + 2] * lit + tex.glow[t + 2] * flick + rim * 170);
        d[p + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      // explosions now and then, flaring and fading on the near side
      if (!still && Math.random() < dt * 0.6) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * size * 0.36;
        flares.push({ x: size / 2 + Math.cos(a) * rr, y: size / 2 + Math.sin(a) * rr, t: 0 });
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = flares.length - 1; i >= 0; i--) {
        const f = flares[i];
        f.t += dt;
        const k = f.t / 1.2;
        if (k >= 1) {
          flares.splice(i, 1);
          continue;
        }
        const rad = size * (0.02 + k * 0.05);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rad);
        g.addColorStop(0, `rgba(255,230,160,${0.9 * (1 - k)})`);
        g.addColorStop(0.4, `rgba(255,110,30,${0.6 * (1 - k)})`);
        g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(f.x - rad, f.y - rad, rad * 2, rad * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      if (still) cancelAnimationFrame(raf);
    };
    raf = requestAnimationFrame(draw);
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => (visible = e.isIntersecting)) : null;
    io?.observe(cv);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => cv.clientWidth && Math.abs(cv.clientWidth * Math.min(1.5, window.devicePixelRatio || 1) - size) > 40 && setup()) : null;
    ro?.observe(cv);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      ro?.disconnect();
    };
  }, [side]);
  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
