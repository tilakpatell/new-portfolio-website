import { useEffect, useState } from 'react';
import { local } from '../../lib/hooks';
import { STAMPS } from './rules';

// The passport's stamps, kept between visits: { placeId: 'YYYY-MM-DD' }, and
// a hook that keeps up as more come in (the page's passport under the world).
const KEY = 'tp-earth-stamps';
const EVENT = 'tp:earth-stamps';

export function readStamps() {
  const s = local.get(KEY, {});
  if (!s || typeof s !== 'object') return {};
  return Object.fromEntries(Object.entries(s).filter(([id, d]) => STAMPS.some((x) => x.id === id) && typeof d === 'string'));
}

export function addStamp(id, date = new Date()) {
  const all = readStamps();
  if (all[id]) return all;
  all[id] = date.toISOString().slice(0, 10);
  local.set(KEY, all);
  window.dispatchEvent(new Event(EVENT));
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

// '2026-10-05' → '5 Oct 2026', as a stamp would print it
export const stampDate = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
