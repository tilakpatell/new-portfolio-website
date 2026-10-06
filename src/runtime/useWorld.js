// A page puts a world module on the runtime: useWorld(module, { props,
// enabled, onEvent }) → { host, status, on, meant, world, rt }. `host` is
// the ref for the box (WorldHost renders it); the module is mounted while
// `enabled` and 3D is on (lib/gpu, which a phone's download gate holds);
// its size and whether it's on screen follow the box; `props` reach the
// world's update(); the runtime's events reach `onEvent({ type, ...data })`.
// A module the page handed over to already (rt.handover before the route
// changed) is adopted, not made again, and the cleanup unmounts only the
// module it mounted or adopted, so a handover's page can leave first.

import { useEffect, useRef, useState } from 'react';
import { use3D } from '../lib/gpu';
import { runtime } from './index';

export function useWorld(module, { props, enabled = true, onEvent = null } = {}) {
  const host = useRef(null);
  const world = useRef(null);
  const three = use3D();
  const [status, setStatus] = useState(() => (typeof window === 'undefined' ? 'idle' : runtime().status));
  const propsRef = useRef(props);
  propsRef.current = props;
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;
  const on = enabled && three.on;

  useEffect(() => {
    const el = host.current;
    if (!on || !el) return undefined;
    const rt = runtime();
    let dead = false;
    const off = rt.on(setStatus);
    const offEvents = rt.events.onAny((type, data) => eventRef.current?.({ type, ...(data ?? {}) }));
    const adopt = () => {
      world.current = rt.current?.module === module ? rt.current.world : null;
    };
    if (rt.current?.module === module) {
      // handed over before this page mounted: it's ours now
      if (rt.gfx?.canvas && rt.gfx.canvas.parentNode !== el) el.prepend(rt.gfx.canvas);
      const r = el.getBoundingClientRect();
      rt.resize(r.width, r.height);
      setStatus(rt.status);
      adopt();
    } else {
      rt.mount(module, propsRef.current, el).then(() => {
        if (!dead) adopt();
      });
    }
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(([e]) => {
            if (rt.current?.module === module) rt.resize(e.contentRect.width, e.contentRect.height);
          })
        : null;
    ro?.observe(el);
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([e]) => {
            if (rt.current?.module === module) rt.setVisible(e.isIntersecting);
          })
        : null;
    io?.observe(el);
    return () => {
      dead = true;
      off();
      offEvents();
      ro?.disconnect();
      io?.disconnect();
      world.current = null;
      if (rt.current?.module === module) rt.unmount();
      // (a mount still in flight for this module is dropped by the next mount or unmount)
      else if (!rt.current && rt.status === 'loading') rt.unmount();
    };
  }, [on, module]);

  // the page's props, without re-rendering anything
  useEffect(() => {
    const rt = typeof window !== 'undefined' ? runtime() : null;
    if (rt?.current?.module !== module) return;
    rt.current.world.update?.(props);
    rt.invalidate();
  });

  // 3D first: while the world is meant to show, the box says so, so the
  // page can hide its fallback from the start
  const meant = on && status !== 'failed' && status !== 'slow' && status !== 'lost';
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (meant) el.dataset.gl = status === 'on' ? 'on' : 'loading';
    else delete el.dataset.gl;
  }, [meant, status]);

  return { host, status, on: status === 'on', meant, world, rt: typeof window !== 'undefined' ? runtime() : null };
}
