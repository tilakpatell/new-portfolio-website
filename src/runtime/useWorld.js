// A page puts a world module on the runtime: useWorld(module, { props,
// enabled, onEvent, attempt, rebuild }) → { host, status, progress, on, meant, world, rt }
// (`attempt` bumped mounts it again after a failure; `rebuild` is what the
// world is made for, and a change of it makes the world again: a mission
// the page changes to, say). `host` is
// the ref for the box (WorldHost renders it); the module is mounted while
// `enabled` and 3D is on (lib/gpu, which a phone's download gate holds);
// its size and whether it's on screen follow the box; `props` reach the
// world's update(); the mounted module's events reach `onEvent({ type,
// ...data })`, and the world hears it's being listened to (attached()).
// A module the page handed over to already (rt.handover before the route
// changed) is adopted, not made again: its canvas and the handover's cover
// move into this box before the first paint (rt.adopt). One a page made for
// another `rebuild` isn't (adoptable): a page mounting again for a new one
// would otherwise show the old world, unchanged until a reload. The world goes
// (rt.unmount) a tick after the last page holding its module lets go, so
// a handover's page can leave first and React's second run of an effect
// in development keeps what the first one had.
// While the world's prepare runs (after `ready`, before its first frame) the
// status is 'preparing' and `progress` ({ value, step }, as useScene's) says
// how far it's got, for the page's loading veil; the box still says
// data-gl="loading". The prepare events of a world made for another page (a
// handover's, while this page's world draws on) aren't this page's.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { use3D } from '../lib/gpu';
import { runtime } from './index';

const useBeforePaint = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
const NO_PROGRESS = { value: 0, step: null };
// (a change of it only: a world reporting the same twice renders nothing)
const putProgress = (ref, set, p) => {
  if (ref.current.value === p.value && ref.current.step === p.step) return;
  ref.current = p;
  set(p);
};
const holders = new Map(); // module → how many mounted pages hold it
const hold = (module, by) => holders.set(module, Math.max(0, (holders.get(module) ?? 0) + by));
// what each world a page made or adopted was for (its `rebuild`); a world
// handed over by a page that's going has none, and is adopted whatever's asked
export const madeFor = new WeakMap();
export const adoptable = (current, module, rebuild) => Boolean(current && current.module === module && (!madeFor.has(current.world) || madeFor.get(current.world) === rebuild));

export function useWorld(module, { props, enabled = true, onEvent = null, attempt = 0, rebuild = null } = {}) {
  const host = useRef(null);
  const world = useRef(null);
  const three = use3D();
  const [status, setStatus] = useState(() => (typeof window === 'undefined' ? 'idle' : runtime().status));
  const [progress, setProgressState] = useState(NO_PROGRESS);
  const progressRef = useRef(progress);
  const propsRef = useRef(props);
  propsRef.current = props;
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;
  const on = enabled && three.on;

  // handed over already: into this box before the page is painted, so the
  // cover over it never leaves the screen
  useBeforePaint(() => {
    const el = host.current;
    if (!on || !el) return;
    const rt = runtime();
    if (adoptable(rt.current, module, rebuild)) rt.adopt(module, el);
  }, [on, module, rebuild]);

  useEffect(() => {
    const el = host.current;
    if (!on || !el) return undefined;
    const rt = runtime();
    let dead = false;
    hold(module, 1);
    const off = rt.on(setStatus);
    // (a world made again starts its progress from the beginning)
    putProgress(progressRef, setProgressState, NO_PROGRESS);
    const offEvents = rt.events.onAny((type, data) => {
      if (type === 'prepare') {
        if (rt.loading !== module) return;
        if (!dead) putProgress(progressRef, setProgressState, { value: data?.value ?? 0, step: data?.step ?? null });
      }
      if (rt.current?.module === module) eventRef.current?.({ type, ...(data ?? {}) });
    });
    const adopt = () => {
      world.current = rt.current?.module === module ? rt.current.world : null;
      if (world.current) madeFor.set(world.current, rebuild);
      world.current?.attached?.();
    };
    if (adoptable(rt.current, module, rebuild)) {
      // handed over before this page mounted (or kept through React's second run): it's ours now
      rt.adopt(module, el);
      setStatus(rt.status);
      adopt();
    } else {
      // (none, another module's, or ours made for something else: made afresh, the old one let go)
      rt.mount(module, propsRef.current, el).then((shown) => {
        if (shown && rt.current?.module === module) madeFor.set(rt.current.world, rebuild);
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
      hold(module, -1);
      setTimeout(() => {
        if (holders.get(module)) return; // (another page, or this one again, has it)
        if (rt.current?.module === module) rt.unmount();
        // (a mount of this module still on its way: only this page wanted it)
        else if (rt.loading === module) rt.unmount();
      }, 0);
    };
  }, [on, module, attempt, rebuild]);

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

  return { host, status, progress, on: status === 'on', meant, world, rt: typeof window !== 'undefined' ? runtime() : null };
}
