import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { storage } from '../lib/hooks';
import { useTheme } from '../theme/ThemeProvider';
import { THEME_ORDER } from '../theme/themes';

// eslint-disable-next-line react-refresh/only-export-components
export const ACHIEVEMENTS = {
  explorer: { name: 'Explorer', desc: 'Visited every page' },
  hacker: { name: 'Slicer', desc: 'Opened the Imperial terminal' },
  order66: { name: 'Contingency', desc: 'Executed Order 66' },
  konami: { name: 'Cheat code', desc: 'Entered the Konami code' },
  deathstar: { name: 'Fully operational', desc: 'Found the Death Star plans' },
  resume: { name: 'Recruited', desc: 'Downloaded the résumé' },
  cartographer: { name: 'Cartographer', desc: 'Saw all six company themes' },
  player: { name: 'High score', desc: 'Collected 10 coins on the Game Boy' },
};

const PAGES = ['/', '/experience', '/projects', '/contact', '/terminal'];

const AchievementContext = createContext({ unlock: () => {}, unlocked: [] });

export function AchievementProvider({ children }) {
  const [unlocked, setUnlocked] = useState(() => storage.get('tp-achievements', []));
  const [toast, setToast] = useState(null);
  const { pathname } = useLocation();
  const { seen } = useTheme();

  const unlock = useCallback((id) => {
    if (!ACHIEVEMENTS[id]) return;
    setUnlocked((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      storage.set('tp-achievements', next);
      setToast({ id, ...ACHIEVEMENTS[id] });
      return next;
    });
  }, []);

  useEffect(() => {
    const top = pathname.startsWith('/projects') ? '/projects' : pathname;
    const visited = storage.get('tp-visited', []);
    if (!visited.includes(top)) {
      const next = [...visited, top];
      storage.set('tp-visited', next);
      if (PAGES.every((p) => next.includes(p))) unlock('explorer');
    }
    if (pathname === '/terminal') unlock('hacker');
    if (pathname === '/deathstar') unlock('deathstar');
  }, [pathname, unlock]);

  useEffect(() => {
    if (THEME_ORDER.every((t) => seen.has(t))) unlock('cartographer');
  }, [seen, unlock]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const value = useMemo(() => ({ unlock, unlocked }), [unlock, unlocked]);

  return (
    <AchievementContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4" aria-live="polite">
        {toast && (
          <div key={toast.id} className="toast card flex items-center gap-3 px-4 py-3 shadow-2xl shadow-black/50" style={{ background: 'var(--surface-2)' }}>
            <span className="grid h-9 w-9 place-items-center rounded-full border border-line-strong">
              <span className="status-dot" />
            </span>
            <div>
              <p className="eyebrow">Achievement unlocked</p>
              <p className="font-semibold text-ink">{toast.name}</p>
              <p className="text-sm text-muted">{toast.desc}</p>
            </div>
          </div>
        )}
      </div>
    </AchievementContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAchievements = () => useContext(AchievementContext);
