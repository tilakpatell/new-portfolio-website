import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { prefersReducedMotion } from '../lib/hooks';

// The jump to lightspeed, full screen, on a plain 2D canvas (no GPU needed).
//
//   0.00–0.45s  the view darkens and the stars begin to drift outward
//   0.45–1.15s  they stretch into streaks as the ship accelerates
//   1.15–1.30s  a flash on entry; `onPeak` fires here, so whatever changes
//               behind the effect (a new planet) is hidden by the flash
//   1.30–1.95s  the hyperspace tunnel: blue-white streaks swirl past
//   1.95–2.45s  streaks snap back to stars and the view clears
//
// With reduced motion it is a quick dark crossfade instead.
//
// `sound` plays the jump (only call it from something the visitor clicked or
// pressed: browsers block audio before that). `entry` is the version used as
// the site's intro: it starts already dark (the page is covered from the first
// paint by the html[data-intro] style) and any click, key, scroll or touch
// skips straight to the exit.

const T = { drift: 450, jump: 1150, flash: 1300, tunnel: 1950, end: 2450 };
const ease = (t) => t * t * (3 - 2 * t);
const clamp = (t) => Math.max(0, Math.min(1, t));

export default function Hyperspace({ onPeak, onDone, sound = false, entry = false }) {
  const canvas = useRef(null);
  const peaked = useRef(false);
  const cbs = useRef({ onPeak, onDone });
  cbs.current = { onPeak, onDone };

  useEffect(() => {
    if (!sound) return;
    import('../lib/sfx').then((sfx) => sfx.hyperspace());
  }, [sound]);

  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv.getContext('2d');
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const W = window.innerWidth;
    const H = window.innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = W / 2;
    const cy = H / 2;
    const maxR = Math.hypot(cx, cy) * 1.05;
    const reduced = prefersReducedMotion();
    const peak = () => {
      if (peaked.current) return;
      peaked.current = true;
      cbs.current.onPeak?.();
    };

    if (reduced) {
      delete document.documentElement.dataset.intro;
      let raf = 0;
      const start = performance.now();
      const frame = (now) => {
        const t = now - start;
        const a = t < 220 ? t / 220 : t < 420 ? 1 : Math.max(0, 1 - (t - 420) / 260);
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = `rgba(3,7,18,${a})`;
        ctx.fillRect(0, 0, W, H);
        if (t >= 220) peak();
        if (t < 680) raf = requestAnimationFrame(frame);
        else cbs.current.onDone?.();
      };
      raf = requestAnimationFrame(frame);
      return () => cancelAnimationFrame(raf);
    }

    // Stars on rays from the centre: angle, distance and a little colour.
    const N = W * H > 900000 ? 760 : 420;
    const stars = Array.from({ length: N }, () => ({
      a: Math.random() * Math.PI * 2,
      d: Math.pow(Math.random(), 0.7) * maxR,
      w: 0.5 + Math.random() * 1.3,
      tint: Math.random(),
    }));
    let raf = 0;
    let last = 0;
    let swirl = 0;
    let start = performance.now() - (entry ? T.drift : 0);
    // the cover in index.html hides the page until the first frame is drawn
    const uncover = () => delete document.documentElement.dataset.intro;
    let skipped = false;
    const skip = () => {
      if (skipped) return;
      skipped = true;
      const t = performance.now() - start;
      if (t < T.tunnel) start = performance.now() - T.tunnel; // straight to the exit
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    if (entry) events.forEach((e) => window.addEventListener(e, skip, { passive: true }));

    const speedAt = (t) => {
      if (t < T.drift) return 0.12 + 0.25 * (t / T.drift);
      if (t < T.jump) return 0.37 + 9 * Math.pow((t - T.drift) / (T.jump - T.drift), 2.6);
      if (t < T.tunnel) return 6.5;
      return 6.5 * Math.pow(1 - clamp((t - T.tunnel) / (T.end - T.tunnel)), 3);
    };
    // How long a streak is, as a share of the distance it covers this frame.
    const stretchAt = (t) => {
      if (t < T.drift) return 1;
      if (t < T.jump) return 1 + 26 * ease(clamp((t - T.drift) / (T.jump - T.drift)));
      if (t < T.tunnel) return 18;
      return 1 + 17 * Math.pow(1 - clamp((t - T.tunnel) / (T.end - T.tunnel)), 2);
    };

    const frame = (now) => {
      const t = now - start;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      const speed = speedAt(t);
      const stretch = stretchAt(t);
      const inTunnel = t >= T.flash && t < T.tunnel;
      if (inTunnel) swirl += dt * 0.9;

      // Background: darken the page, then the deep blue of the tunnel, then clear.
      ctx.clearRect(0, 0, W, H);
      const bgAlpha = t < T.drift ? ease(t / T.drift) * 0.92 : t < T.tunnel ? 1 : 1 - ease(clamp((t - T.tunnel) / (T.end - T.tunnel)));
      if (entry) uncover();
      ctx.fillStyle = `rgba(3,7,18,${bgAlpha})`;
      ctx.fillRect(0, 0, W, H);
      if (t > T.jump - 250 && t < T.end - 120) {
        const glow = t < T.flash ? clamp((t - (T.jump - 250)) / 400) : t < T.tunnel ? 1 : 1 - clamp((t - T.tunnel) / (T.end - 120 - T.tunnel));
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.75);
        g.addColorStop(0, `rgba(180,215,255,${0.5 * glow})`);
        g.addColorStop(0.25, `rgba(70,120,230,${0.28 * glow})`);
        g.addColorStop(1, 'rgba(3,7,18,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // The streaks
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const s of stars) {
        const step = s.d * speed * dt + speed * dt * 40;
        const prev = s.d;
        s.d += step;
        if (s.d > maxR) {
          s.d = Math.random() * maxR * 0.08 + 2;
          s.a = Math.random() * Math.PI * 2;
          continue;
        }
        const a = s.a + (inTunnel ? swirl * (0.4 + s.tint * 0.6) * (1 - s.d / maxR) : 0);
        const len = Math.min(maxR * 0.6, (s.d - prev) * stretch);
        const r0 = Math.max(0, s.d - len);
        const x1 = cx + Math.cos(a) * r0;
        const y1 = cy + Math.sin(a) * r0;
        const x2 = cx + Math.cos(a) * s.d;
        const y2 = cy + Math.sin(a) * s.d;
        const near = s.d / maxR;
        const alpha = Math.min(1, 0.25 + near * 1.2) * (t > T.tunnel ? 0.6 + 0.4 * bgAlpha : 1);
        const blue = inTunnel ? 0.55 + s.tint * 0.45 : 0.15 + s.tint * 0.25;
        ctx.strokeStyle = `rgba(${Math.round(255 - 110 * blue)},${Math.round(255 - 50 * blue)},255,${alpha})`;
        ctx.lineWidth = s.w * (0.6 + near * 1.6);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2 + 0.01, y2);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';

      // The flash on entry, where the scene behind changes
      if (t > T.jump - 60 && t < T.flash + 60) {
        const f = t < T.jump + 40 ? clamp((t - (T.jump - 60)) / 100) : 1 - ease(clamp((t - (T.jump + 40)) / (T.flash + 60 - (T.jump + 40))));
        ctx.fillStyle = `rgba(235,244,255,${0.92 * f})`;
        ctx.fillRect(0, 0, W, H);
        if (t >= T.jump + 20) peak();
      }

      if (t < T.end) raf = requestAnimationFrame(frame);
      else {
        peak();
        cbs.current.onDone?.();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      events.forEach((e) => window.removeEventListener(e, skip));
      uncover();
    };
  }, [entry]);

  // Rendered at the top of the page, above the nav and everything else.
  return createPortal(<canvas ref={canvas} className="hyperspace-canvas" aria-hidden="true" />, document.body);
}
