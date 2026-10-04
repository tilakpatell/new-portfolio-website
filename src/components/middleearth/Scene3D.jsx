import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion, useFrameLoop, useInView } from '../../lib/hooks';

// A Middle-earth scene in WebGL, laid over the drawing it stands in for.
// It loads Three.js and the scene only once it is near the screen, hands the
// scene the game's state every frame (`read`), and reports 'on' once it has
// drawn, or 'lost' / 'failed', so the drawing can come back. `api` is a ref
// the game keeps, to tell the scene about moments (`api.current.fx(...)`).
export default function Scene3D({ name, load, read, api, soft = false, onState }) {
  const canvas = useRef(null);
  const scene = useRef(null);
  const [status, setStatus] = useState('waiting'); // waiting, loading, ready, on, lost, failed
  const [box, inView] = useInView({ rootMargin: '240px' });
  const [near, setNear] = useState(false);
  const latest = useRef(read);
  latest.current = read;
  const report = useRef(onState);
  report.current = onState;
  const first = useRef(true);

  useEffect(() => {
    if (inView) setNear(true);
  }, [inView]);
  useEffect(() => {
    report.current?.(status);
  }, [status]);

  useEffect(() => {
    if (!near) return undefined;
    let dead = false;
    const fail = (why) => {
      scene.current?.dispose();
      scene.current = null;
      if (api) api.current = null;
      if (!dead) setStatus(why);
    };
    const size = () => {
      const r = canvas.current?.getBoundingClientRect();
      if (r && r.width > 0) scene.current?.resize(r.width, r.height);
    };
    setStatus('loading');
    load()
      .then((create) => {
        if (dead || !canvas.current) return;
        try {
          scene.current = create(canvas.current, { soft, reduced: prefersReducedMotion(), onLost: () => fail('lost') });
          if (api) api.current = scene.current;
          if (import.meta.env.DEV) window.__ME__ = { ...window.__ME__, [name]: scene.current }; // for the browser tests
          size();
          first.current = true;
          setStatus('ready');
        } catch {
          fail('failed');
        }
      })
      .catch(() => fail('failed'));
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null;
    if (canvas.current) ro?.observe(canvas.current);
    return () => {
      dead = true;
      ro?.disconnect();
      scene.current?.dispose();
      scene.current = null;
      if (api) api.current = null;
    };
    // the scene is made once; `load`, `soft` and `api` don't change under it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near]);

  useFrameLoop((ms) => {
    const s = scene.current;
    if (!s || s.lost) return;
    try {
      s.update(latest.current());
      s.render(ms);
      if (first.current) {
        first.current = false;
        setStatus('on'); // drawn once: now the drawing can step aside
      }
    } catch {
      s.dispose();
      scene.current = null;
      if (api) api.current = null;
      setStatus('failed');
    }
  }, inView && (status === 'ready' || status === 'on'));

  return (
    <div ref={box} className="me-gl" aria-hidden="true">
      <canvas ref={canvas} data-on={status === 'on' || undefined} />
    </div>
  );
}
