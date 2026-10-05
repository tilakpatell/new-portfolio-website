import { useEffect, useState } from 'react';
import { local } from '../../lib/hooks';
import { projectById } from '../../data/projects';
import { CARTRIDGES } from './rules';

// The cartridges found on Dot Matrix island, kept between visits, and a hook
// that keeps up as more are found (the page's list under the world, say).
export const FOUND = 'tp-dmg-found';
const EVENT = 'tp:dmg-found';

export function readFound() {
  const f = local.get(FOUND, []);
  return Array.isArray(f) ? f.filter((id) => CARTRIDGES.some((c) => c.id === id)) : [];
}

export function saveFound(ids) {
  local.set(FOUND, ids);
  window.dispatchEvent(new Event(EVENT));
}

export function useFound() {
  const [found, setFound] = useState(readFound);
  useEffect(() => {
    const on = () => setFound(readFound());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return found;
}

// what a cartridge says when it's found: its project
export function cartInfo(id) {
  const p = projectById(id);
  return { title: p?.title ?? id, text: p?.summary ?? p?.subtitle ?? '', link: `/projects/${id}` };
}
