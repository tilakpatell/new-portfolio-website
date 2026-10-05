import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../lib/hooks';

// The far side of the Maw: through the black hole is a friend's universe,
// the Matrix (where Rick and Morty come out), and the black gives way to its
// falling code, green on black, a column every few characters, each with a
// bright head and a tail that fades. Thinner in the middle, where where
// you're going is written. None with reduced motion.

const GLYPHS = 'ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789Z:.=*+-<>¦|';
const CELL = 16; // px a character takes, either way

export default function Rain() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!g || reduced) return undefined;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    g.scale(ratio, ratio);
    g.font = `${CELL - 2}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    // a head per column: where it is (in rows), how fast it falls (rows a second)
    const cols = Array.from({ length: Math.ceil(w / CELL) }, () => ({ y: -Math.random() * (h / CELL) * 1.2, v: 9 + Math.random() * 16, last: -1 }));
    const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    let raf = 0;
    let then = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - then) / 1000);
      then = now;
      // the tails fade
      g.fillStyle = `rgba(0, 0, 0, ${Math.min(1, dt * 5.5)})`;
      g.fillRect(0, 0, w, h);
      cols.forEach((c, i) => {
        c.y += c.v * dt;
        const row = Math.floor(c.y);
        if (row !== c.last && row >= 0) {
          const x = i * CELL + CELL / 2;
          // the one before the head turns green; the head is near white
          if (c.last >= 0) {
            g.fillStyle = '#29d35a';
            g.fillText(glyph(), x, c.last * CELL);
          }
          g.fillStyle = '#d8ffe2';
          g.fillText(glyph(), x, row * CELL);
          c.last = row;
        }
        if (row * CELL > h + CELL * 4) Object.assign(c, { y: -Math.random() * 12, v: 9 + Math.random() * 16, last: -1 });
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);
  if (reduced) return null;
  return <canvas ref={ref} className="universe-rain" aria-hidden="true" />;
}
