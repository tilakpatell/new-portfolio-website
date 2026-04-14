import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const ACHIEVEMENTS = {
  explorer:  { name: 'Explorer',     desc: 'Visited all 5 main pages',    icon: '◇' },
  hacker:    { name: 'Hacker',       desc: 'Accessed the Imperial Terminal', icon: '◈' },
  order66:   { name: 'Contingency',  desc: 'Executed Order 66',           icon: '▲' },
  konami:    { name: 'Cheat Code',   desc: 'Entered the Konami Code',     icon: '▣' },
  deathstar: { name: 'Architect',    desc: 'Found the Death Star plans',  icon: '●' },
  resume:    { name: 'Recruited',    desc: 'Downloaded the dossier',      icon: '◆' },
};

const ALL_PAGES = ['/', '/projects', '/experience', '/terminal', '/contact'];

const AchievementCtx = createContext(null);
export const useAchievements = () => useContext(AchievementCtx);

/* ── Page visit tracker (for "Explorer" achievement) ────────────────────── */
const usePageTracker = (unlock) => {
  const location = useLocation();
  useEffect(() => {
    const visited = JSON.parse(sessionStorage.getItem('visited') || '[]');
    const path = location.pathname;
    if (!visited.includes(path)) {
      const next = [...visited, path];
      sessionStorage.setItem('visited', JSON.stringify(next));
      if (ALL_PAGES.every(p => next.includes(p))) unlock('explorer');
    }
    if (path === '/terminal') unlock('hacker');
    if (path === '/deathstar') unlock('deathstar');
  }, [location.pathname, unlock]);
};

/* ── Provider + Toast ───────────────────────────────────────────────────── */
export const AchievementProvider = ({ children }) => {
  const [unlocked, setUnlocked] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('achievements') || '[]'); }
    catch { return []; }
  });
  const [toast, setToast] = useState(null);

  const unlock = useCallback((id) => {
    setUnlocked(prev => {
      if (prev.includes(id) || !ACHIEVEMENTS[id]) return prev;
      const next = [...prev, id];
      sessionStorage.setItem('achievements', JSON.stringify(next));
      setToast(ACHIEVEMENTS[id]);
      return next;
    });
  }, []);

  /* Auto-dismiss toast */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  usePageTracker(unlock);

  return (
    <AchievementCtx.Provider value={{ unlock, unlocked, achievements: ACHIEVEMENTS }}>
      {children}

      {/* Achievement toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 60, x: '-50%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-6 left-1/2 z-[99999] pointer-events-none"
          >
            <div className="bg-[#0a0a0a]/95 border border-white/[0.14] px-5 py-3 flex items-center gap-3.5
                            shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-sm min-w-[240px]">
              <span className="text-white/50 text-lg font-mono leading-none">{toast.icon}</span>
              <div>
                <div className="font-mono text-[0.46rem] tracking-[0.20em] text-white/28 uppercase">
                  Achievement Unlocked
                </div>
                <div className="font-display text-sm font-bold text-white/85 mt-0.5">{toast.name}</div>
                <div className="font-mono text-[0.54rem] text-white/32 mt-0.5">{toast.desc}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AchievementCtx.Provider>
  );
};
