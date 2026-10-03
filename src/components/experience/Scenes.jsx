import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../lib/hooks';

// A little animated scene for each role, like a looping GIF at the top of the
// chapter. All of them pause when off screen and sit still for reduced motion.

function usePlaying() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) el.dataset.play = 'true';
      else delete el.dataset.play;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

// ── AWS: a pixel hero runs and jumps across a row of server racks, collecting
// GPU coins under drifting clouds. Drawn at 320×80 and scaled up crisp.
const HERO = [
  '..OOOO..',
  '.OOOOOO.',
  '.SSFFS..',
  'SFSFFFS.',
  '.FFFFF..',
  '..BBRB..',
  '.BBBRBB.',
  '..L..L..',
];
const HERO_RUN = [
  '..OOOO..',
  '.OOOOOO.',
  '.SSFFS..',
  'SFSFFFS.',
  '.FFFFF..',
  '..BBRB..',
  '.BBBRBB.',
  '.L....L.',
];

function AwsScene() {
  const wrap = usePlaying();
  const canvas = useRef(null);
  const hud = useRef(null);
  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv.getContext('2d');
    const W = 320;
    const H = 72;
    cv.width = W;
    cv.height = H;
    const reduced = prefersReducedMotion();
    const css = getComputedStyle(cv);
    const read = () => ({
      accent: css.getPropertyValue('--accent').trim() || '#ff9900',
      text: css.getPropertyValue('--text').trim() || '#0f1111',
      border: css.getPropertyValue('--border').trim() || '#d5dbdb',
      strong: css.getPropertyValue('--border-strong').trim() || '#879596',
      surface: css.getPropertyValue('--surface-2').trim() || '#f2f3f3',
      dark: document.documentElement.dataset.mode === 'dark',
    });
    let pal = read();
    const racks = [];
    for (let x = 4; x < W + 40; x += 34) racks.push({ x, h: 18 + ((x * 7) % 10), gap: (x / 34) % 5 === 3 });
    let coins = [];
    const seedCoins = () => {
      coins = racks.filter((r) => !r.gap).map((r, i) => ({ x: r.x + 14, y: H - r.h - 13 - (i % 2) * 5, got: false, pop: 0 }));
    };
    seedCoins();
    let t = 0;
    let last = 0;
    let raf = 0;
    let score = 64;
    const hero = { x: -10, y: 0, vy: 0 };

    const groundAt = (x) => {
      const r = racks.find((rk) => x + 4 >= rk.x && x + 4 < rk.x + 30);
      return r && !r.gap ? H - r.h : H + 20;
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      // clouds (cloud computing)
      ctx.fillStyle = pal.dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,17,17,0.06)';
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 97 + t * 4) % (W + 60)) - 30;
        const cy = 22 + (i % 2) * 8;
        ctx.fillRect(cx, cy, 22, 4);
        ctx.fillRect(cx + 4, cy - 3, 12, 3);
      }
      // racks
      for (const r of racks) {
        if (r.gap) continue;
        const top = H - r.h;
        ctx.fillStyle = pal.border;
        ctx.fillRect(r.x, top, 30, r.h);
        ctx.fillStyle = pal.strong;
        ctx.fillRect(r.x, top, 30, 1);
        for (let row = top + 4; row < H - 2; row += 5) {
          ctx.fillStyle = pal.strong;
          ctx.fillRect(r.x + 3, row, 24, 1);
          const on = Math.sin(t * 6 + r.x * 0.7 + row) > 0.2;
          ctx.fillStyle = on ? pal.accent : pal.surface;
          ctx.fillRect(r.x + 24, row - 2, 2, 2);
          ctx.fillStyle = Math.sin(t * 4 + row * 1.3 + r.x) > 0.6 ? '#3eb34f' : pal.surface;
          ctx.fillRect(r.x + 20, row - 2, 2, 2);
        }
      }
      // coins (GPUs)
      for (const c of coins) {
        if (c.got) {
          if (c.pop > 0) {
            ctx.fillStyle = pal.accent;
            ctx.font = '6px monospace';
            ctx.fillText('+1', c.x - 2, c.y - (10 - c.pop));
          }
          continue;
        }
        const bob = Math.round(Math.sin(t * 4 + c.x) * 1.5);
        ctx.fillStyle = pal.accent;
        ctx.fillRect(c.x, c.y + bob, 5, 5);
        ctx.fillStyle = pal.text;
        ctx.fillRect(c.x + 1, c.y + bob + 2, 3, 1);
      }
      // the hero
      const sprite = Math.floor(t * 8) % 2 ? HERO_RUN : HERO;
      const colors = { O: pal.accent, S: pal.text, F: '#f2c6a0', B: pal.dark ? '#4a78c2' : '#2f5fa8', R: '#c0392b', L: pal.text };
      sprite.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (ch === '.') return;
          ctx.fillStyle = colors[ch];
          ctx.fillRect(Math.round(hero.x) + x, Math.round(hero.y) + y, 1, 1);
        }),
      );
      if (hud.current) hud.current.textContent = `GPUs ${String(score).padStart(3, '0')}`;
    };

    const step = (dt) => {
      t += dt;
      hero.x += 26 * dt;
      if (hero.x > W + 10) {
        hero.x = -10;
        seedCoins();
      }
      const ground = groundAt(hero.x) - 8;
      const ahead = groundAt(hero.x + 14) - 8;
      const onGround = hero.y >= ground - 0.5 && hero.vy >= 0;
      if (onGround) {
        hero.y = ground;
        hero.vy = 0;
        if (ahead > ground + 4 || ahead < ground - 3) hero.vy = -62; // jump the gap or up a step
      } else {
        hero.vy += 170 * dt;
        hero.y += hero.vy * dt;
        if (hero.y > ground && hero.vy > 0) hero.y = ground;
      }
      for (const c of coins) {
        if (!c.got && Math.abs(c.x + 2 - (hero.x + 4)) < 5 && Math.abs(c.y + 2 - (hero.y + 4)) < 7) {
          c.got = true;
          c.pop = 10;
          score += 1;
        }
        if (c.pop > 0) c.pop -= dt * 20;
      }
    };

    hero.y = groundAt(hero.x) - 8;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (!wrap.current?.dataset.play) {
        last = 0;
        return;
      }
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      if (last && now - last < 33) return; // 30fps is plenty for pixels
      last = now;
      step(dt);
      draw();
    };
    draw();
    if (!reduced) raf = requestAnimationFrame(loop);
    const mo = new MutationObserver(() => {
      pal = read();
      draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
    };
  }, [wrap]);
  return (
    <div ref={wrap} className="scene scene-aws" aria-hidden="true">
      <canvas ref={canvas} className="pixel-canvas" />
      <span ref={hud} className="pixel-hud">GPUs 064</span>
    </div>
  );
}

// ── RTX: fighter jets in formation, contrails behind them
const JET = 'M0 10 L34 7 L44 0 L50 0 L46 8 L70 9 L76 4 L82 4 L80 10 L82 16 L76 16 L70 11 L46 12 L50 20 L44 20 L34 13 Z';
function RtxScene() {
  const ref = usePlaying();
  return (
    <div ref={ref} className="scene scene-rtx" aria-hidden="true">
      <svg viewBox="0 0 1200 220" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="contrail" x1="0" x2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <g className="sc-clouds">
          <ellipse cx="200" cy="60" rx="90" ry="16" />
          <ellipse cx="700" cy="170" rx="130" ry="18" />
          <ellipse cx="1050" cy="80" rx="80" ry="14" />
        </g>
        {[
          { y: 52, d: '0s', s: 1 },
          { y: 100, d: '-0.4s', s: 0.85 },
          { y: 146, d: '-0.8s', s: 0.72 },
        ].map((j, i) => (
          <g key={i} className="sc-jet" style={{ animationDelay: j.d }}>
            <g transform={`translate(0 ${j.y}) scale(${j.s * 1.9})`}>
              <rect x="-260" y="8.5" width="250" height="3" fill="url(#contrail)" className="sc-trail" />
              <path d="M-4 8 L0 10 L-4 12 L-12 10 Z" className="sc-burner" />
              <path d={JET} className="sc-jet-body" />
              <path d="M64 7.5 Q70 4.5 76 7.5 Z" className="sc-canopy" />
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Bose: headphones, an equaliser, floating notes, and Vader on the playlist
function BoseScene() {
  const ref = usePlaying();
  return (
    <div ref={ref} className="scene scene-bose" aria-hidden="true">
      <svg viewBox="0 0 1200 220" preserveAspectRatio="xMidYMid slice">
        <g className="sc-eq">
          {Array.from({ length: 28 }, (_, i) => (
            <rect key={i} x={70 + i * 22} y="40" width="12" height="150" rx="3" style={{ animationDelay: `${-(i * 137) % 900}ms`, animationDuration: `${700 + ((i * 53) % 500)}ms` }} />
          ))}
        </g>
        <g className="sc-phones" transform="translate(880 30)">
          <path d="M40 120 C40 30 200 30 200 120" fill="none" strokeWidth="14" strokeLinecap="round" />
          <rect x="18" y="104" width="44" height="76" rx="18" />
          <rect x="178" y="104" width="44" height="76" rx="18" />
        </g>
        <g className="sc-notes">
          {['♪', '♫', '♪', '♬', '♫'].map((n, i) => (
            <text key={i} x={860 + i * 70} y="190" style={{ animationDelay: `${i * -1.1}s` }}>
              {n}
            </text>
          ))}
        </g>
      </svg>
      <p className="scene-now-playing">
        <span className="scene-dot" /> Now playing: “No, I am your father.” <span className="scene-progress" />
      </p>
    </div>
  );
}

// ── Pendar: a laser scans a sample, and the spectrum answers
function PendarScene() {
  const ref = usePlaying();
  return (
    <div ref={ref} className="scene scene-pendar" aria-hidden="true">
      <svg viewBox="0 0 1200 220" preserveAspectRatio="xMidYMid slice">
        <rect x="70" y="92" width="90" height="36" rx="6" className="sc-device" />
        <line x1="160" y1="110" x2="760" y2="110" className="sc-beam" />
        <line x1="160" y1="110" x2="760" y2="110" className="sc-beam-core" />
        <circle cx="760" cy="110" r="10" className="sc-spot" />
        <path className="sc-spectrum" d="M820 170 L860 168 L880 150 L895 168 L940 166 L960 90 L975 166 L1010 164 L1030 130 L1045 164 L1090 165 L1100 120 L1112 166 L1140 168" />
      </svg>
    </div>
  );
}

// ── Empowerreg: a heartbeat that keeps going
function EmpowerregScene() {
  const ref = usePlaying();
  const beat = 'M0 120 H140 L160 120 L175 80 L190 160 L205 40 L222 150 L236 120 H300';
  return (
    <div ref={ref} className="scene scene-empowerreg" aria-hidden="true">
      <svg viewBox="0 0 1200 220" preserveAspectRatio="xMidYMid slice">
        <g className="sc-ecg">
          {[0, 300, 600, 900].map((x) => (
            <path key={x} d={beat} transform={`translate(${x} 0)`} />
          ))}
        </g>
        <circle cx="0" cy="120" r="6" className="sc-ecg-dot" />
      </svg>
    </div>
  );
}

// ── SRC: a radar sweep with contacts that fade in and out
function SrcScene() {
  const ref = usePlaying();
  return (
    <div ref={ref} className="scene scene-src" aria-hidden="true">
      <svg viewBox="0 0 1200 220" preserveAspectRatio="xMidYMid slice">
        <g transform="translate(600 110)" className="sc-radar">
          {[40, 80, 120, 160].map((r) => (
            <circle key={r} r={r} />
          ))}
          <path d="M-170 0 H170 M0 -170 V170" />
          <g className="sc-sweep">
            <path d="M0 0 L170 0 A170 170 0 0 0 147 -85 Z" />
          </g>
          {[
            [60, -40],
            [-90, 30],
            [120, 60],
            [-30, -100],
            [20, 90],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="4" className="sc-blip" style={{ animationDelay: `${i * 0.6}s` }} />
          ))}
        </g>
      </svg>
    </div>
  );
}

const SCENES = { aws: AwsScene, rtx: RtxScene, bose: BoseScene, pendar: PendarScene, empowerreg: EmpowerregScene, src: SrcScene };

export default function ChapterScene({ kind, className = '' }) {
  const Scene = SCENES[kind];
  if (!Scene) return null;
  return (
    <div className={`chapter-scene ${className}`}>
      <Scene />
    </div>
  );
}
