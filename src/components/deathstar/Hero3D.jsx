import { useEffect, useRef, useState } from 'react';
import { useFrameLoop, useInView } from '../../lib/hooks';
import { settle } from '../../lib/settle';

// The Death Star page's hero in WebGL, over the SVG it replaces. It loads
// Three.js and the scene only when it mounts, follows the page's state, and
// reports 'on' once it has drawn, or 'lost' / 'failed', so the page can show
// the SVG again.
export default function Hero3D({ onState, svgRef, ...state }) {
  const canvas = useRef(null);
  const api = useRef(null);
  const [status, setStatus] = useState('loading');
  const [ref, inView] = useInView({ rootMargin: '120px' });
  const latest = useRef(state);
  latest.current = state;
  const report = useRef(onState);
  report.current = onState;
  const first = useRef(true);
  const fitRef = useRef(null);

  useEffect(() => {
    report.current?.(status);
  }, [status]);

  useEffect(() => {
    let dead = false;
    const fail = (why) => {
      api.current?.dispose();
      api.current = null;
      if (!dead) setStatus(why);
    };
    // The canvas spans the whole hero; the SVG's box inside it fixes the
    // scale, so the 3D scene lands exactly where the 2D one would.
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      const svg = svgRef?.current?.getBoundingClientRect();
      const vb = latest.current.vb;
      let frame = null;
      if (svg && svg.width > 0 && vb) {
        const k = vb.w / svg.width;
        frame = { x0: vb.x - (svg.left - r.left) * k, x1: vb.x + (r.right - svg.left) * k, y0: vb.y - (svg.top - r.top) * k, y1: vb.y + (r.bottom - svg.top) * k };
      }
      api.current.resize(Math.round(r.width), Math.round(r.height), frame);
    };
    fitRef.current = fit;
    import('./DeathStar3D')
      .then(({ createDeathStar3D }) => {
        if (dead || !canvas.current) return;
        try {
          const a = createDeathStar3D(canvas.current, { onLost: () => fail('lost') });
          api.current = a;
          a.update(latest.current);
          fit();
          // its shaders link in the background: the first frame waits for them
          // (the SVG meanwhile), so drawing it doesn't stop the page
          settle(a.ready).then(() => {
            if (dead || api.current !== a || a.lost) return;
            first.current = true;
            setStatus('ready');
          });
        } catch {
          fail('failed');
        }
      })
      .catch(() => fail('failed'));
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (canvas.current) ro?.observe(canvas.current);
    if (svgRef?.current) ro?.observe(svgRef.current);
    window.addEventListener('resize', fit);
    return () => {
      dead = true;
      ro?.disconnect();
      window.removeEventListener('resize', fit);
      api.current?.dispose();
      api.current = null;
    };
  }, [svgRef]);

  useEffect(() => {
    api.current?.update(state);
  });
  // a different crop (phone or desktop) moves the SVG: fit again
  const vbKey = state.vb ? `${state.vb.x},${state.vb.y},${state.vb.w},${state.vb.h}` : '';
  useEffect(() => {
    fitRef.current?.();
  }, [vbKey]);

  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    try {
      a.render(ms);
      if (first.current) {
        first.current = false;
        setStatus('on'); // drawn once: now the SVG can step aside
      }
    } catch {
      a.dispose();
      api.current = null;
      setStatus('failed');
    }
  }, inView && (status === 'ready' || status === 'on'));

  return (
    <div ref={ref} className="ds-gl" aria-hidden="true">
      <canvas ref={canvas} data-on={status === 'on' || undefined} />
    </div>
  );
}
