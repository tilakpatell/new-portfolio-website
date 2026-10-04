import { useEffect, useRef } from 'react';
import { analyser } from '../../lib/audio';

// Soundwave's visor: a live trace of whatever the site is playing.
export default function Visor({ className = '' }) {
  const canvas = useRef(null);
  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext('2d');
    if (!ctx) return undefined;
    let raf = 0;
    let visible = true;
    const data = new Float32Array(512);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const an = analyser();
      if (an) an.getFloatTimeDomainData(data);
      else data.fill(0);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#7fe8ff';
      ctx.shadowColor = '#4fd8ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * w;
        const y = h / 2 + Math.max(-1, Math.min(1, data[i] * 2.2)) * (h * 0.42);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    };
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => (visible = e.isIntersecting)) : null;
    io?.observe(cv);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, []);
  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
