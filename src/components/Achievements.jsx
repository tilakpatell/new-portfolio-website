import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { local, storage } from '../lib/hooks';
import { useTheme } from '../theme/ThemeProvider';
import { FAN_THEMES, THEMES, THEME_ORDER } from '../theme/themes';
import Gif from './Gif';

// eslint-disable-next-line react-refresh/only-export-components
export const ACHIEVEMENTS = {
  explorer: { name: 'Explorer', desc: 'Visited every page' },
  hacker: { name: 'Slicer', desc: 'Opened the Imperial terminal' },
  order66: { name: 'Contingency', desc: 'Executed Order 66' },
  konami: { name: 'Cheat code', desc: 'Entered the Konami code' },
  deathstar: { name: 'Fully operational', desc: 'Found the Death Star plans' },
  trench: { name: 'Use the Force', desc: 'Hit the exhaust port in the trench run' },
  rebels: { name: 'Medal of Yavin', desc: 'Saved Yavin 4 in the Battle of Yavin' },
  empire: { name: 'Fear will keep them in line', desc: 'Let the Empire win at Yavin' },
  resume: { name: 'Recruited', desc: 'Opened the résumé' },
  cartographer: { name: 'Cartographer', desc: 'Saw all six company themes' },
  player: { name: 'High score', desc: 'Collected 10 coins on the Game Boy' },
  castle: { name: 'Super Tilak', desc: 'Beat the king of the castle on the Game Boy' },
  tetris: { name: 'Four at once', desc: 'Cleared four lines at once in Block Drop' },
  aurebesh: { name: 'Linguist', desc: 'Read Aurebesh' },
  polyglot: { name: 'Polyglot', desc: 'Read the site in Aurebesh, Cybertronian and Dwarf runes' },
  heisenberg: { name: 'Heisenberg', desc: 'Said my name' },
  bluesky: { name: 'Blue Sky', desc: 'Served a 95% order at Walt’s Metherria' },
  snap: { name: 'Perfectly balanced', desc: 'Snapped half the page away' },
  dundie: { name: 'Dundie winner', desc: 'That’s what she said' },
  raga: { name: 'Raga', desc: 'Played eight notes on the sitar' },
  jugalbandi: { name: 'Jugalbandi', desc: 'Played the sitar, harmonium and tabla' },
  rollout: { name: 'Roll out', desc: 'Transformed the site' },
  groundbridge: { name: 'Bridge them back', desc: 'Brought all of Team Prime home through the ground bridge' },
  spacebridge: { name: 'All aboard', desc: 'Brought every Decepticon up to the Nemesis through the space bridge' },
  iacon: { name: 'Archivist', desc: 'Recovered every relic in the Iacon database' },
  'iacon-dcp': { name: 'Spoils of Iacon', desc: 'Recovered every relic in the Iacon database for Lord Megatron' },
  grounded: { name: 'Grounded', desc: 'Brought Starscream down over Jasper in Roll out' },
  onestand: { name: 'One shall stand', desc: 'Beat Megatron in Kaon in Roll out' },
  onefall: { name: 'One shall fall', desc: 'Beat Optimus Prime in Iacon in Roll out, as a Decepticon' },
  wubba: { name: 'Wubba lubba dub dub', desc: 'Got schwifty: the site went portal green' },
  meeseeks: { name: 'Look at me!', desc: 'Summoned a Mr. Meeseeks' },
  showmewhatyougot: { name: 'Show me what you got', desc: 'Beat the Cromulon in Portal panic' },
  peaceamongworlds: { name: 'Peace among worlds', desc: 'Cleared all four dimensions in Portal panic' },
  collector: { name: 'Collector', desc: 'Found every hidden easter egg' },
  mellon: { name: 'Speak, friend', desc: 'Said the word that opens the Doors of Durin' },
  balrog: { name: 'You shall not pass', desc: 'Held the Bridge of Khazad-dûm' },
  gorgoroth: { name: 'Unseen', desc: 'Crossed Gorgoroth without the Eye seeing you' },
  ringbearer: { name: 'Ring-bearer', desc: 'Cast the One Ring into the fire' },
  worthy: { name: 'Worthy', desc: 'Lifted Mjolnir' },
  globetrotter: { name: 'Globetrotter', desc: 'Flew to every place on the globe' },
  palette: { name: 'Power user', desc: 'Opened the command palette' },
};

const PAGES = ['/', '/experience', '/projects', '/travel', '/contact', '/terminal'];

// "New theme: Raga." or, when one easter egg opens several, all of them.
const newThemes = (themeId) => {
  const egg = FAN_THEMES.find((f) => f.id === themeId)?.achievement;
  const names = FAN_THEMES.filter((f) => f.achievement === egg).map((f) => THEMES[f.id].company);
  if (names.length < 2) return `New theme: ${names[0] ?? THEMES[themeId].company}.`;
  return `New themes: ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}.`;
};
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

  const notify = useCallback((title, desc = '', kind = 'note', gif = null) => {
    setQueue((q) => [...q, { key: `${Date.now()}-${Math.random()}`, kind, title, desc, gif }]);
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
    const top = pathname.startsWith('/projects') ? '/projects' : pathname.startsWith('/experience') ? '/experience' : pathname;
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
    const t = setTimeout(() => setQueue((q) => q.slice(1)), toast.gif ? 7000 : 3800);
    return () => clearTimeout(t);
  }, [toast]);

  const value = useMemo(() => ({ unlock, notify, unlocked }), [unlock, notify, unlocked]);
  const themeId = toast?.kind.startsWith('theme:') ? toast.kind.slice(6) : null;

  return (
    <AchievementContext.Provider value={value}>
      {children}
      {/* taps pass through the toast to whatever is under it, except on its own controls */}
      {/* in language mode the toast reads plainly, and sits above the Back to English pill */}
      <div className="toast-host pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4 [&_.toast_a]:pointer-events-auto [&_.toast_button]:pointer-events-auto" aria-live="polite">
        {toast && (
          <div
            key={toast.key}
            className="toast ab-keep card flex max-w-md items-center gap-3 px-4 py-3 shadow-2xl shadow-black/40"
            style={{ background: 'var(--surface-2)', animationDuration: toast.gif ? '7s' : '3.8s' }}
          >
            {toast.kind !== 'note' && (
              <span className="grid h-9 w-9 flex-none place-items-center rounded-full border border-line-strong">
                <span className="h-3 w-3 rounded-full" style={{ background: themeId ? THEMES[themeId].swatch : 'var(--accent)' }} />
              </span>
            )}
            <div>
              {toast.kind !== 'note' && <p className="label">Achievement unlocked</p>}
              <p className="font-semibold text-ink">{toast.title}</p>
              {toast.desc && <p className="text-sm text-muted">{toast.desc}</p>}
              {themeId && <p className="mt-1 text-sm text-body">{newThemes(themeId)} Pick from the site colors.</p>}
              {toast.gif && <Gif name={toast.gif} eager />}
            </div>
          </div>
        )}
      </div>
    </AchievementContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAchievements = () => useContext(AchievementContext);
