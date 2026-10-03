import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeProvider';
import { AchievementProvider, useAchievements } from './components/Achievements';
import ErrorBoundary from './components/ErrorBoundary';
import Nav from './components/Nav';
import Footer from './components/Footer';
import ScrollSaber from './components/ScrollSaber';
import Home from './pages/Home';

const Experience = lazy(() => import('./pages/Experience'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Contact = lazy(() => import('./pages/Contact'));
const Terminal = lazy(() => import('./pages/Terminal'));
const DeathStar = lazy(() => import('./pages/DeathStar'));
const NotFound = lazy(() => import('./pages/NotFound'));

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (!search.includes('role=')) window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
}

// ↑ ↑ ↓ ↓ ← → ← → B A — jump to lightspeed.
function Lightspeed() {
  const { unlock } = useAchievements();
  const [on, setOn] = useState(0);
  const seq = useRef([]);
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      seq.current = [...seq.current, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-KONAMI.length);
      if (seq.current.join() === KONAMI.join()) {
        seq.current = [];
        unlock('konami');
        setOn(Date.now());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [unlock]);
  useEffect(() => {
    if (!on) return undefined;
    const t = setTimeout(() => setOn(0), 1300);
    return () => clearTimeout(t);
  }, [on]);
  if (!on) return null;
  return (
    <svg key={on} className="lightspeed" viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {Array.from({ length: 90 }).map((_, i) => {
        const a = (i * 137.5 * Math.PI) / 180;
        const r = 4 + ((i * 7) % 18);
        return (
          <line
            key={i}
            x1={Math.cos(a) * r}
            y1={Math.sin(a) * r}
            x2={Math.cos(a) * 80}
            y2={Math.sin(a) * 80}
            pathLength="1"
            strokeWidth={0.18 + (i % 3) * 0.12}
            style={{ animationDelay: `${(i % 9) * 18}ms` }}
          />
        );
      })}
    </svg>
  );
}

function Shell() {
  const { pathname } = useLocation();

  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
    const id = idle(() => {
      import('./pages/Experience');
      import('./pages/Projects');
      import('./pages/Contact');
    });
    return () => (window.cancelIdleCallback || clearTimeout)(id);
  }, []);

  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      <ScrollToTop />
      <Nav />
      <main id="main" tabIndex={-1} className="relative z-10 outline-none">
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<div className="min-h-[100svh]" />}>
            <div key={pathname} className="page-enter">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/experience" element={<Experience />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/terminal" element={<Terminal />} />
                <Route path="/deathstar" element={<DeathStar />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </Suspense>
        </ErrorBoundary>
      </main>
      {pathname !== '/terminal' && pathname !== '/deathstar' && <Footer />}
      <ScrollSaber />
      <Lightspeed />
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeProvider>
        <AchievementProvider>
          <Shell />
        </AchievementProvider>
      </ThemeProvider>
    </HashRouter>
  );
}
