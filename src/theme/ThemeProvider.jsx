import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_THEME, ROUTE_THEMES, THEMES } from './themes';

// One active theme re-skins the whole site. It flows on its own — AWS by
// default, the company whose chapter is on screen on the Experience page, and
// each project's own theme on its page — unless the visitor pins a company
// from the dots in the nav. Light or dark mode is remembered.

const PIN_KEY = 'tp-theme-pin';
const SEEN_KEY = 'tp-themes-seen';
const MODE_KEY = 'tp-mode';

const session = {
  get(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value == null) window.sessionStorage.removeItem(key);
      else window.sessionStorage.setItem(key, value);
    } catch {
      /* storage unavailable */
    }
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { pathname } = useLocation();
  const [scrollTheme, setScrollTheme] = useState(null);
  const [pinned, setPinned] = useState(() => {
    const saved = session.get(PIN_KEY);
    return saved && THEMES[saved] ? saved : null;
  });
  const [mode, setMode] = useState(() => (document.documentElement.dataset.mode === 'dark' ? 'dark' : 'light'));
  const [seen, setSeen] = useState(() => {
    try {
      return new Set(JSON.parse(session.get(SEEN_KEY) || '[]'));
    } catch {
      return new Set();
    }
  });

  const onExperience = pathname === '/experience';
  const active = pinned || ROUTE_THEMES[pathname] || (onExperience && scrollTheme) || DEFAULT_THEME;

  useEffect(() => {
    if (!onExperience) setScrollTheme(null);
  }, [onExperience]);

  useEffect(() => {
    document.documentElement.dataset.theme = active;
    setSeen((prev) => {
      if (prev.has(active)) return prev;
      const next = new Set(prev).add(active);
      session.set(SEEN_KEY, JSON.stringify([...next]));
      return next;
    });
  }, [active]);

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#000000' : '#ffffff');
  }, [mode]);

  const pin = useCallback((id) => {
    const next = id && THEMES[id] ? id : null;
    setPinned(next);
    session.set(PIN_KEY, next);
  }, []);

  const toggleMode = useCallback(() => {
    setMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.mode = next;
      try {
        window.localStorage.setItem(MODE_KEY, next);
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ active, theme: THEMES[active], pinned, pin, setScrollTheme, seen, mode, toggleMode }),
    [active, pinned, pin, seen, mode, toggleMode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);
