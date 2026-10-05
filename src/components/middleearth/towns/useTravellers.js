import { useEffect, useRef, useState } from 'react';
import { useOnline } from '../../universe/online/useOnline';

// A walkable town's other travellers (./travellers.js), while you're online
// (the site's own switch and callsign) and the town is up. Returns { on,
// ref (the link, or null), join() (go online, as the universe's map does,
// with your callsign or a new one) }. Each frame the town sends your step
// with ref.current?.pose(h, flags) and draws ref.current?.list(). `bound`:
// how far out from the middle a step can be, if a town's bigger than most
// (./travellers.js)
export function useTravellers(town, up, { bound } = {}) {
  const online = useOnline();
  const on = Boolean(online?.on && online.name);
  const name = online?.name ?? null;
  const ref = useRef(null);
  const [count, setCount] = useState(0);
  const nameRef = useRef(name);
  nameRef.current = name;

  useEffect(() => {
    if (!on || !up) return undefined;
    let gone = false;
    let link = null;
    import('./travellers').then(({ createTravellers }) => {
      if (gone) return;
      // (the QA scripts can hand in a room of their own, in development only)
      const relay = import.meta.env.DEV && window.__TOWN_RELAY__ ? { load: window.__TOWN_RELAY__ } : {};
      link = createTravellers({ town, name: nameRef.current, ...(bound ? { bound } : {}), ...relay });
      ref.current = link;
    });
    // closing the tab: out of the room at once
    const bye = () => link?.leave();
    window.addEventListener('pagehide', bye);
    const tick = setInterval(() => setCount(link ? link.list().length : 0), 1500);
    return () => {
      gone = true;
      clearInterval(tick);
      window.removeEventListener('pagehide', bye);
      link?.leave();
      ref.current = null;
      setCount(0);
    };
  }, [on, up, town, bound]);

  useEffect(() => {
    if (name) ref.current?.rename(name);
  }, [name]);

  return { on, ref, count, join: () => online?.goOnline(online.suggest()), available: Boolean(online) };
}
