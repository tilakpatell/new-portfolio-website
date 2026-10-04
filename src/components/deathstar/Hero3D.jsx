import { useEffect, useRef, useState } from 'react';
import { useFrameLoop, useInView } from '../../lib/hooks';

// The Death Star page's hero in WebGL, over the SVG it replaces. It loads
// Three.js and the scene only when it mounts, follows the page's state, and
// reports 'on' once it has drawn, or 'lost' / 'failed', so the page can show
// the SVG again.
export default function Hero3D({ onState, ...state }) {
  const canvas = useRef(null);
  const api = useRef(null);
  const [status, setStatus] = useState('loading');
  const [ref, inView] = useInView({ rootMargin: '120px' });
  const latest = useRef(state);
  latest.current = state;
  const report = useRef(onState);
  report.current = onState;
  const first = useRef(true);

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
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./DeathStar3D')
      .then(({ createDeathStar3D }) => {
        if (dead || !canvas.current) return;
        try {
          api.current = createDeathStar3D(canvas.current, { onLost: () => fail('lost') });
          api.current.update(latest.current);
          fit();
          first.current = true;
          setStatus('ready');
        } catch {
          fail('failed');
        }
      })
      .catch(() => fail('failed'));
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (canvas.current) ro?.observe(canvas.current);
    return () => {
      dead = true;
      ro?.disconnect();
      api.current?.dispose();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    api.current?.update(state);
  });

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
