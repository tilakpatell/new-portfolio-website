import { useEffect, useState } from 'react';
import { local } from '../../lib/hooks';
import { STAMPS } from './rules';

// The passport's stamps, kept between visits: { placeId: 'YYYY-MM-DD' }, and
// a hook that keeps up as more come in (the page's passport under the world).
// `store` is anything with get(key, fallback) and set(key, value): lib/hooks's
// local by default, the world runtime's saves from the module.
const KEY = 'tp-earth-stamps';
const EVENT = 'tp:earth-stamps';

export function readStamps(store = local) {
  const s = store.get(KEY, {});
  if (!s || typeof s !== 'object') return {};
  return Object.fromEntries(Object.entries(s).filter(([id, d]) => STAMPS.some((x) => x.id === id) && typeof d === 'string'));
}

export function addStamp(id, date = new Date(), store = local) {
  const all = readStamps(store);
  if (all[id]) return all;
  all[id] = date.toISOString().slice(0, 10);
  store.set(KEY, all);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
  return all;
}

export function useStamps() {
  const [stamps, setStamps] = useState(readStamps);
  useEffect(() => {
    const on = () => setStamps(readStamps());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return stamps;
}

// The distance flown over every visit, in km, kept between them.
const FLOWN = 'tp-earth-flown';
const FLOWN_EVENT = 'tp:earth-flown';
export function readFlown(store = local) {
  const n = Number(store.get(FLOWN, 0));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
export function addFlown(km, store = local) {
  const total = readFlown(store) + Math.max(0, km);
  store.set(FLOWN, Math.round(total));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(FLOWN_EVENT));
  return total;
}
export function useFlown() {
  const [flown, setFlown] = useState(readFlown);
  useEffect(() => {
    const on = () => setFlown(readFlown());
    window.addEventListener(FLOWN_EVENT, on);
    return () => window.removeEventListener(FLOWN_EVENT, on);
  }, []);
  return flown;
}

// '2026-10-05' → '5 Oct 2026', as a stamp would print it
export const stampDate = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
