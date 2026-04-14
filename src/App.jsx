import { useState, Suspense, lazy, useEffect, useCallback, useRef } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from 'react-error-boundary';
import { BackgroundProvider } from './Home/BackgroundContext';
import { AchievementProvider, useAchievements } from './components/Achievements';
import Navigation from './Home/Navbar';
import CustomCursor from './components/CustomCursor';

const HomePage = lazy(() => import('./Home/HomePage'));
const ProjectsPage = lazy(() => import('./Projects/ProjectsPage'));
const ExperiencePage = lazy(() => import('./Experience/ExperiencePage'));
const ContactPage = lazy(() => import('./Contact/ContactPage'));
const TerminalPage = lazy(() => import('./Terminal/TerminalPage'));
const DeathStarPage = lazy(() => import('./Secret/DeathStarPage'));

const prefetchComponents = () => {
  const timer = setTimeout(() => {
    import('./Projects/ProjectsPage');
    import('./Experience/ExperiencePage');
    import('./Contact/ContactPage');
  }, 2000);
  return () => clearTimeout(timer);
};

/* ── Themed loading skeleton ─────────────────────────────────────────────── */
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border border-white/[0.10] relative overflow-hidden">
        <motion.div
          className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
          animate={{ x: ['-100%', '250%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <span className="font-mono text-[0.52rem] text-white/20 tracking-[0.20em] uppercase">
        Loading Imperial Archives...
      </span>
    </div>
  </div>
);

const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="min-h-screen flex items-center justify-center bg-sw-black px-4">
    <div className="text-center max-w-md">
      <h2 className="font-display text-lg font-bold text-white mb-3">Something went wrong</h2>
      <pre className="text-xs text-white/35 mb-5 whitespace-pre-wrap">{error.message}</pre>
      <button onClick={resetErrorBoundary} className="btn-imperial rounded-lg px-5 py-2">Retry</button>
    </div>
  </div>
);

/* ── Animated page routes ────────────────────────────────────────────────── */
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/experience" element={<ExperiencePage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/terminal" element={<TerminalPage />} />
            <Route path="/deathstar" element={<DeathStarPage />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Konami code listener ────────────────────────────────────────────────── */
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];

function useKonamiCode() {
  const { unlock } = useAchievements();
  const seq = useRef([]);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      seq.current.push(e.key);
      if (seq.current.length > KONAMI.length) seq.current = seq.current.slice(-KONAMI.length);
      if (seq.current.join(',') === KONAMI.join(',')) {
        unlock('konami');
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
        seq.current = [];
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [unlock]);

  return flash;
}

/* ── Main App ────────────────────────────────────────────────────────────── */
function AppInner() {
  const [isScrolled, setIsScrolled] = useState(false);
  const rafRef = useRef(null);
  const lastScrollY = useRef(0);
  const konamiFlash = useKonamiCode();

  const handleScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      const y = window.scrollY;
      if (Math.abs(y - lastScrollY.current) > 5) {
        setIsScrolled(y > 50);
        lastScrollY.current = y;
      }
      rafRef.current = null;
    });
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll]);

  useEffect(() => prefetchComponents(), []);

  /* Global keyboard shortcuts */
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      const nav = (path) => { window.location.hash = `#${path}`; };
      switch (e.key.toLowerCase()) {
        case 'h': nav('/'); break;
        case 'p': nav('/projects'); break;
        case 'e': nav('/experience'); break;
        case 't': nav('/terminal'); break;
        case 'c': nav('/contact'); break;
        default: return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      {/* Konami flash overlay */}
      <AnimatePresence>
        {konamiFlash && (
          <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="fixed inset-0 z-[100000] bg-white pointer-events-none"
          />
        )}
      </AnimatePresence>

      <CustomCursor />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="min-h-screen"
      >
        <Navigation isScrolled={isScrolled} />
        <main className="relative">
          <AnimatedRoutes />
        </main>
      </motion.div>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <HashRouter>
        <BackgroundProvider>
          <AchievementProvider>
            <AppInner />
          </AchievementProvider>
        </BackgroundProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
