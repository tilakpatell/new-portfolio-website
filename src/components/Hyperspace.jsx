import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { prefersReducedMotion } from '../lib/hooks';
import { use3D } from '../lib/gpu';
import { T, atPeak, clampStart, holdStart, jumpHeld, jumpStarted, swirlOn } from './hyperspace3d/timeline';
import { jumpFailed, jumpScene, preloadJump } from './hyperspace3d/load';
import Hyperspace3D from './hyperspace3d/Hyperspace3D';

// The jump to lightspeed, full screen. Drawn in WebGL with real depth where
// 3D is on and its scene has already loaded (it's fetched ahead of time, see
// hyperspace3d/load.js, so the jump never waits for it); otherwise, with
// reduced motion, or if WebGL fails, on the plain 2D canvas below. Both run
// on the same timeline with the same callbacks:
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

const ease = (t) => t * t * (3 - 2 * t);
const clamp = (t) => Math.max(0, Math.min(1, t));

export default function Hyperspace({ onPeak, onDone, sound = false, entry = false }) {
  const three = use3D();
  // chosen once, as the jump starts: 3D only if its scene is already here
  const [scene, setScene] = useState(() => (three.on && !prefersReducedMotion() ? jumpScene() : null));
  const peaked = useRef(false);
  const finished = useRef(false);
  const cbs = useRef({ onPeak, onDone });
  cbs.current = { onPeak, onDone };
  const peak = useCallback(() => {
    if (peaked.current) return;
    peaked.current = true;
    cbs.current.onPeak?.();
  }, []);
  const done = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    cbs.current.onDone?.();
  }, []);
  // WebGL gave out: before the flash the 2D version plays the jump from the
  // start; after it, the page has already changed, so the jump just ends.
  // Either way the rest of the visit jumps in 2D.
  const fail = useCallback(() => {
    jumpFailed();
    if (peaked.current) done();
    else setScene(null);
  }, [done]);

  // playing in 2D this time: have the 3D version ready for the next jump
  useEffect(() => {
    if (!scene) preloadJump();
  }, [scene]);

  useEffect(() => {
    if (!sound) return undefined;
    // the real jump, started 1.17 s in so its boom lands on the flash (later
    // for the intro, which starts part way through); the synthesised one if
    // the clip can't play. Before the visitor has interacted, the browser may
    // hold the sound back: then it is dropped rather than played late.
    let alive = true;
    let clip = null;
    import('../lib/clips').then(async ({ playClip }) => {
      clip = await playClip('hyperspaceEnter', { offset: entry ? 1.62 : 1.17, keep: true });
      if (!alive) clip?.stop();
      else if (!clip) import('../lib/sfx').then((sfx) => sfx.hyperspace());
    });
    return () => {
      alive = false;
      import('../lib/audio').then(({ audioContext }) => {
        if (audioContext()?.state !== 'running') clip?.stop();
      });
    };
  }, [sound, entry]);

  if (scene) return <Hyperspace3D scene={scene} entry={entry} onPeak={peak} onDone={done} onFail={fail} />;
  return <Hyperspace2D entry={entry} onPeak={peak} onDone={done} />;
}

// The 2D canvas version: the fallback, and the reduced-motion crossfade.
function Hyperspace2D({ onPeak, onDone, entry }) {
  const canvas = useRef(null);
  const peaked = useRef(false);
  const cbs = useRef({ onPeak, onDone });
  cbs.current = { onPeak, onDone };

  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv.getContext('2d');
    // the intro runs while the page is still loading, so it draws at 1x
    const dpr = entry ? 1 : Math.min(1.5, window.devicePixelRatio || 1);
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
      let start = 0;
      const frame = (now) => {
        if (!start) {
          start = now;
          jumpStarted(); // (a page waiting on its dark times its fallback from here)
        }
        // (held at full dark while the galaxy builds its next system: hyperspace3d/timeline.js)
        if (jumpHeld() && now - start > 320) start = now - 320;
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
    // timed from the first frame actually drawn, so a slow start skips nothing
    let start = 0;
    const glowFill = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.75);
    glowFill.addColorStop(0, 'rgba(180,215,255,0.5)');
    glowFill.addColorStop(0.25, 'rgba(70,120,230,0.28)');
    glowFill.addColorStop(1, 'rgba(3,7,18,0)');
    // streaks are drawn in batches: three distances from the centre, two tints
    const BANDS = 3;
    const batches = Array.from({ length: BANDS * 2 }, () => []);
    // the cover in index.html hides the page until the first frame is drawn
    const uncover = () => delete document.documentElement.dataset.intro;
    let skipped = false;
    const skip = () => {
      if (skipped || !start) return;
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
      if (start) start = clampStart(start, last, now); // (a stall: the jump waits where it was)
      else {
        start = now - (entry ? T.drift : 0);
        jumpStarted(); // (a page waiting on its dark times its fallback from here)
      }
      start = holdStart(now, start); // (held in the tunnel while the galaxy builds its next system)
      const t = now - start;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      const speed = speedAt(t);
      const stretch = stretchAt(t);
      const inTunnel = t >= T.flash && t < T.tunnel;
      swirl = swirlOn(swirl, t, dt); // (not while held: hyperspace3d/timeline.js)

      // Background: darken the page, then the deep blue of the tunnel, then clear.
      ctx.clearRect(0, 0, W, H);
      const bgAlpha = t < T.drift ? ease(t / T.drift) * 0.92 : t < T.tunnel ? 1 : 1 - ease(clamp((t - T.tunnel) / (T.end - T.tunnel)));
      if (entry) uncover();
      ctx.fillStyle = `rgba(3,7,18,${bgAlpha})`;
      ctx.fillRect(0, 0, W, H);
      if (t > T.jump - 250 && t < T.end - 120) {
        const glow = t < T.flash ? clamp((t - (T.jump - 250)) / 400) : t < T.tunnel ? 1 : 1 - clamp((t - T.tunnel) / (T.end - 120 - T.tunnel));
        ctx.globalAlpha = glow;
        ctx.fillStyle = glowFill;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      // The streaks, gathered into a few batches so each frame is six strokes,
      // not hundreds
      batches.forEach((b) => (b.length = 0));
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
        const near = s.d / maxR;
        const band = Math.min(BANDS - 1, Math.floor(near * BANDS));
        batches[band * 2 + (s.tint > 0.5 ? 1 : 0)].push(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * s.d + 0.01, cy + Math.sin(a) * s.d);
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const fade = t > T.tunnel ? 0.6 + 0.4 * bgAlpha : 1;
      batches.forEach((pts, k) => {
        if (!pts.length) return;
        const band = Math.floor(k / 2);
        const near = (band + 0.5) / BANDS;
        const tint = k % 2 ? 0.75 : 0.25;
        const blue = inTunnel ? 0.55 + tint * 0.45 : 0.15 + tint * 0.25;
        const alpha = Math.min(1, 0.25 + near * 1.2) * fade;
        ctx.strokeStyle = `rgba(${Math.round(255 - 110 * blue)},${Math.round(255 - 50 * blue)},255,${alpha})`;
        ctx.lineWidth = 1.1 * (0.6 + near * 1.6);
        ctx.beginPath();
        for (let i = 0; i < pts.length; i += 4) {
          ctx.moveTo(pts[i], pts[i + 1]);
          ctx.lineTo(pts[i + 2], pts[i + 3]);
        }
        ctx.stroke();
      });
      ctx.globalCompositeOperation = 'source-over';

      // The flash on entry, where the scene behind changes
      if (t > T.jump - 60 && t < T.flash + 60) {
        const f = t < T.jump + 40 ? clamp((t - (T.jump - 60)) / 100) : 1 - ease(clamp((t - (T.jump + 40)) / (T.flash + 60 - (T.jump + 40))));
        ctx.fillStyle = `rgba(235,244,255,${0.92 * f})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (atPeak(t)) peak();

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
