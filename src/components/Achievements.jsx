import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { local, storage } from '../lib/hooks';
import { useTheme } from '../theme/ThemeProvider';
import { FAN_THEMES, THEMES, THEME_ORDER } from '../theme/themes';

// eslint-disable-next-line react-refresh/only-export-components
export const ACHIEVEMENTS = {
  explorer: { name: 'Explorer', desc: 'Visited every page' },
  hacker: { name: 'Slicer', desc: 'Opened the Imperial terminal' },
  order66: { name: 'Contingency', desc: 'Executed Order 66' },
  konami: { name: 'Cheat code', desc: 'Entered the Konami code' },
  deathstar: { name: 'Fully operational', desc: 'Found the Death Star plans' },
  trench: { name: 'Use the Force', desc: 'Hit the exhaust port in the trench run' },
  resume: { name: 'Recruited', desc: 'Opened the résumé' },
  cartographer: { name: 'Cartographer', desc: 'Saw all six company themes' },
  player: { name: 'High score', desc: 'Collected 10 coins on the Game Boy' },
  aurebesh: { name: 'Linguist', desc: 'Read Aurebesh' },
  heisenberg: { name: 'Heisenberg', desc: 'Said my name' },
  snap: { name: 'Perfectly balanced', desc: 'Snapped half the page away' },
  dundie: { name: 'Dundie winner', desc: 'That’s what she said' },
  raga: { name: 'Raga', desc: 'Played eight notes on the sitar' },
  globetrotter: { name: 'Globetrotter', desc: 'Flew to every place on the globe' },
  palette: { name: 'Power user', desc: 'Opened the command palette' },
};

const PAGES = ['/', '/experience', '/projects', '/travel', '/contact', '/terminal'];
const KEY = 'tp-achievements';

const AchievementContext = createContext({ unlock: () => {}, notify: () => {}, unlocked: [] });

export function AchievementProvider({ children }) {
  // Kept across visits, so a theme stays unlocked once it is earned.
  const [unlocked, setUnlocked] = useState(() => {
    const saved = local.get(KEY, null) ?? storage.get(KEY, []);
    return Array.isArray(saved) ? saved.filter((id) => ACHIEVEMENTS[id]) : [];
  });
  const [queue, setQueue] = useState([]);
  const unlockedRef = useRef(unlocked);
  const { pathname } = useLocation();
  const { seen } = useTheme();

  const notify = useCallback((title, desc = '', kind = 'note') => {
    setQueue((q) => [...q, { key: `${Date.now()}-${Math.random()}`, kind, title, desc }]);
  }, []);

  const unlock = useCallback(
    (id) => {
      if (!ACHIEVEMENTS[id] || unlockedRef.current.includes(id)) return;
      const next = [...unlockedRef.current, id];
      unlockedRef.current = next;
      setUnlocked(next);
      local.set(KEY, next);
      const theme = FAN_THEMES.find((t) => t.achievement === id);
      notify(ACHIEVEMENTS[id].name, ACHIEVEMENTS[id].desc, theme ? `theme:${theme.id}` : 'achievement');
    },
    [notify],
  );

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
    if (pathname === '/resume') unlock('resume');
  }, [pathname, unlock]);

  useEffect(() => {
    if (THEME_ORDER.every((t) => seen.has(t))) unlock('cartographer');
  }, [seen, unlock]);

  const toast = queue[0];
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 3800);
    return () => clearTimeout(t);
  }, [toast]);

  const value = useMemo(() => ({ unlock, notify, unlocked }), [unlock, notify, unlocked]);
  const themeId = toast?.kind.startsWith('theme:') ? toast.kind.slice(6) : null;

  return (
    <AchievementContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4" aria-live="polite">
        {toast && (
          <div key={toast.key} className="toast card flex max-w-md items-center gap-3 px-4 py-3 shadow-2xl shadow-black/40" style={{ background: 'var(--surface-2)' }}>
            {toast.kind !== 'note' && (
              <span className="grid h-9 w-9 flex-none place-items-center rounded-full border border-line-strong">
                <span className="h-3 w-3 rounded-full" style={{ background: themeId ? THEMES[themeId].swatch : 'var(--accent)' }} />
              </span>
            )}
            <div>
              {toast.kind !== 'note' && <p className="label">Achievement unlocked</p>}
              <p className="font-semibold text-ink">{toast.title}</p>
              {toast.desc && <p className="text-sm text-muted">{toast.desc}</p>}
              {themeId && <p className="mt-1 text-sm text-body">New theme: {THEMES[themeId].company}. Pick it from the site colors.</p>}
            </div>
          </div>
        )}
      </div>
    </AchievementContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAchievements = () => useContext(AchievementContext);
