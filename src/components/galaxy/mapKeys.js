// The galaxy map's own keys (HoloMap.jsx) and its find: M or Escape closes it
// (Escape even from the find field; with the films' panel open, Escape shuts
// that first), / goes to the find field, J jumps to the course, + − 0 zoom;
// the rest is the page's or the field's. Pure, tested.
//
// mapKeyAction({ key, meta, ctrl, alt }, { typing, canJump, filmsOpen }) →
// 'close' | 'closeFilms' | 'find' | 'jump' | 'zoomIn' | 'zoomOut' | 'fit' | null
// findSystems(q, systems, n = 6) → the systems whose name has `q` in it, the
// ones that start with it first, at most n.
export function mapKeyAction({ key, meta, ctrl, alt }, { typing = false, canJump = false, filmsOpen = false } = {}) {
  if (meta || ctrl || alt) return null;
  const k = key.length === 1 ? key.toLowerCase() : key;
  if (k === 'Escape') return filmsOpen ? 'closeFilms' : 'close';
  if (typing) return null;
  if (k === 'm') return 'close';
  if (k === '/') return 'find';
  if (k === 'j') return canJump ? 'jump' : null;
  if (k === '+' || k === '=') return 'zoomIn';
  if (k === '-' || k === '_') return 'zoomOut';
  if (k === '0') return 'fit';
  return null;
}

export function findSystems(q, systems, n = 6) {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const hits = systems.filter((s) => s.name.toLowerCase().includes(t));
  const starts = (s) => s.name.toLowerCase().startsWith(t);
  return [...hits.filter(starts), ...hits.filter((s) => !starts(s))].slice(0, n);
}
