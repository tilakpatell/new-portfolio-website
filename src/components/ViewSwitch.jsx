import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IconClassic, IconUniverse } from './icons';
import { useAchievements } from './Achievements';
import { START_KEY, VIEW_EVENT, classicPathFor, readStart, saveStart, universePathFor, viewOf } from '../lib/view';

// The way between the two views of the site, both ways, from anywhere: the
// universe (the map) and the classic site (the pages). Picking one goes to the
// same place in it (Experience's station, or its page) and keeps the pick, so
// the front door opens there next time. See lib/view.js.
// eslint-disable-next-line react-refresh/only-export-components
export function useView() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { notify } = useAchievements();
  const [start, setStart] = useState(readStart);
  useEffect(() => {
    const onPick = (e) => setStart(e.detail ?? readStart());
    const onStorage = (e) => e.key === START_KEY && setStart(readStart());
    window.addEventListener(VIEW_EVENT, onPick);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(VIEW_EVENT, onPick);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  const view = viewOf(pathname, start);
  const switchTo = useCallback(
    (next) => {
      const where = next === 'classic' ? 'home' : 'universe';
      const changed = readStart() !== where;
      saveStart(where);
      const to = next === 'classic' ? classicPathFor(pathname) : universePathFor(pathname);
      if (to !== pathname) navigate(to);
      if (changed)
        // one sentence: a toast is gone in under four seconds
        notify(next === 'classic' ? 'Classic site' : 'The universe', 'The site opens here from now on.');
    },
    [pathname, navigate, notify],
  );
  return { view, start, switchTo };
}

const OPTIONS = [
  { id: 'universe', label: 'Universe', title: 'Universe: fly through the site in 3D', Icon: IconUniverse },
  { id: 'classic', label: 'Classic', title: 'Classic: the site as pages to read', Icon: IconClassic },
];

// `size` 'bar' sits in the nav, where the words go when room is short:
// `labels` 'all', then 'active' (only the view you're in is named), then
// 'none' (icons, named for screen readers). 'menu' is the phone menu's
// full-width version.
export default function ViewSwitch({ size = 'bar', labels = 'all', className = '' }) {
  const { view, switchTo } = useView();
  return (
    <div className={`view-switch switch ${className}`} data-size={size} data-tour="view" role="group" aria-label="View the site as">
      {OPTIONS.map(({ id, label, title, Icon }) => (
        <button key={id} type="button" aria-pressed={view === id} title={title} onClick={() => switchTo(id)}>
          <Icon className="h-4 w-4 flex-none" aria-hidden="true" />
          <span className={labels === 'all' || (labels === 'active' && view === id) ? 'view-switch-label' : 'sr-only'}>{label}</span>
        </button>
      ))}
    </div>
  );
}
