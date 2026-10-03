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
// The setter lives in its own context so pages that drive the theme don't
// re-render every time it changes.
const ThemeSetterContext = createContext(() => {});

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

  const active = pinned || scrollTheme || ROUTE_THEMES[pathname] || DEFAULT_THEME;

  // A new page starts from its own theme until one of its sections takes over.
  useEffect(() => {
    setScrollTheme(null);
  }, [pathname]);

  useEffect(() => {
    const root = document.documentElement;
    // Switch instantly: suppress every colour transition for one frame so a
    // theme change is a single restyle, not hundreds of animations.
    root.classList.add('theme-switching');
    root.dataset.theme = active;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
    setSeen((prev) => {
      if (prev.has(active)) return prev;
      const next = new Set(prev).add(active);
      session.set(SEEN_KEY, JSON.stringify([...next]));
      return next;
    });
    return () => cancelAnimationFrame(raf);
  }, [active]);

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#09090b' : '#fdfdfc');
  }, [mode]);

  // Until the visitor picks a mode, follow the system's light or dark setting.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const onChange = (e) => {
      try {
        if (window.localStorage.getItem(MODE_KEY)) return;
      } catch {
        /* storage unavailable */
      }
      const next = e.matches ? 'dark' : 'light';
      document.documentElement.dataset.mode = next;
      setMode(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

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
  return (
    <ThemeSetterContext.Provider value={setScrollTheme}>
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    </ThemeSetterContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);

// Auto theming for a page: whichever [data-theme-section] crosses the middle of
// the screen sets the site's colours.
// eslint-disable-next-line react-refresh/only-export-components
export function useSectionThemes() {
  const setScrollTheme = useContext(ThemeSetterContext);
  const { pathname } = useLocation();
  useEffect(() => {
    const sections = [...document.querySelectorAll('[data-theme-section]')];
    if (!sections.length || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setScrollTheme(e.target.dataset.themeSection || null);
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [setScrollTheme, pathname]);
}
