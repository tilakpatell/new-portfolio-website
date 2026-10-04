import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeProvider';
import { AchievementProvider, useAchievements } from './components/Achievements';
import { FunProvider } from './fun/FunProvider';
import ErrorBoundary from './components/ErrorBoundary';
import Nav from './components/Nav';
import Footer from './components/Footer';
import ScrollSaber from './components/ScrollSaber';
import Guide from './components/Guide';
import Hyperspace from './components/Hyperspace';
import { audioContext } from './lib/audio';
import WorldGate from './components/worlds/WorldGate';

const Experience = lazy(() => import('./pages/Experience'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Contact = lazy(() => import('./pages/Contact'));
const Travel = lazy(() => import('./pages/Travel'));
const Caribbean = lazy(() => import('./pages/Caribbean'));
const Resume = lazy(() => import('./pages/Resume'));
const Terminal = lazy(() => import('./pages/Terminal'));
const DeathStar = lazy(() => import('./pages/DeathStar'));
const Music = lazy(() => import('./pages/Music'));
const MiddleEarth = lazy(() => import('./pages/MiddleEarth'));
const Scranton = lazy(() => import('./pages/Scranton'));
const Avengers = lazy(() => import('./pages/Avengers'));
const Cybertron = lazy(() => import('./pages/Cybertron'));
const Albuquerque = lazy(() => import('./pages/Albuquerque'));
const RickMorty = lazy(() => import('./pages/RickMorty'));
const Front = lazy(() => import('./pages/Front'));
const Home = lazy(() => import('./pages/Home'));
const NotFound = lazy(() => import('./pages/NotFound'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    // a link to one role (/experience/aws) lands on that role, not the top
    if (!search.includes('role=') && !/^\/(experience|universe)\/[^/]+$/.test(pathname)) window.scrollTo(0, 0);
  }, [pathname, search]);
  // a page's music and lines stop when you leave it
  useEffect(() => {
    import('./lib/clips').then((c) => c.stopPageClips());
  }, [pathname]);
  return null;
}

// ↑ ↑ ↓ ↓ ← → ← → B A — jump to lightspeed.
function Lightspeed() {
  const { unlock } = useAchievements();
  const [on, setOn] = useState(0);
  const seq = useRef([]);
  useEffect(() => {
    const jump = () => {
      audioContext(); // inside the key press, so the sound may play
      setOn(Date.now());
    };
    const onKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      seq.current = [...seq.current, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-KONAMI.length);
      if (seq.current.join() === KONAMI.join()) {
        seq.current = [];
        unlock('konami');
        jump();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('tp:hyperspace', jump);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('tp:hyperspace', jump);
    };
  }, [unlock]);
  if (!on) return null;
  return <Hyperspace key={on} sound onDone={() => setOn(0)} />;
}

// A first visit to the site opens on the crawl, then jumps to lightspeed into
// the universe map (the site's front door), where everything is laid out as
// places to fly to. The inline script in index.html decides (and covers the
// page until it starts). Skip goes straight to the jump. The map loads
// during the crawl.
const OpeningCrawl = lazy(() => import('./components/experience/OpeningCrawl'));
function IntroJump() {
  const [stage, setStage] = useState(() => (document.documentElement.dataset.intro === '1' ? 'crawl' : null));
  useEffect(() => {
    if (!stage) return;
    try {
      window.localStorage.setItem('tp-intro', '1');
    } catch {
      /* storage unavailable */
    }
    if (stage === 'crawl') {
      import('./pages/Front');
      import('./components/universe/scene');
    }
  }, [stage]);
  if (!stage) return null;
  if (stage === 'crawl')
    return (
      <Suspense fallback={null}>
        <OpeningCrawl
          variant="intro"
          onClose={() => {
            // keep the page covered until the jump's first frame, which
            // comes out in the universe
            document.documentElement.dataset.intro = '1';
            setStage('jump');
          }}
        />
      </Suspense>
    );
  return <Hyperspace entry sound onDone={() => setStage(null)} />;
}

// ⌘K / Ctrl+K anywhere, or the search button in the nav.
function PaletteHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('tp:palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('tp:palette', onOpen);
    };
  }, []);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <CommandPalette onClose={() => setOpen(false)} />
    </Suspense>
  );
}

// The universe map is the front door (/) and keeps one page while its URL
// follows the selection (/universe/marvel). Both routes render the same
// element (Front, which holds the map), so React keeps the one map across
// them: picking a planet at /, or the wordmark from /universe/marvel, moves
// the camera instead of building the universe again.
const pageKey = (pathname) => (pathname === '/' || pathname.startsWith('/universe') ? '/universe' : pathname);

function Shell() {
  const { pathname } = useLocation();
  const page = pageKey(pathname);

  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
    const id = idle(() => {
      import('./pages/Home');
      import('./pages/Experience');
      import('./pages/Projects');
      import('./pages/Contact');
      import('./pages/Travel');
    });
    return () => (window.cancelIdleCallback || clearTimeout)(id);
  }, []);

  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      <ScrollToTop />
      <Nav />
      <main id="main" tabIndex={-1} className="relative z-10 outline-none">
        <ErrorBoundary resetKey={page}>
          <Suspense fallback={<div className="min-h-[100svh]" />}>
            <div key={page} className="page-enter">
              {/* a world on a phone (or with Data Saver, or short of space) asks before it downloads its 3D */}
              <WorldGate pathname={pathname}>
              <Routes>
                <Route path="/" element={<Front />} />
                <Route path="/home" element={<Home />} />
                <Route path="/experience/:roleId?" element={<Experience />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/travel" element={<Travel />} />
                <Route path="/caribbean" element={<Caribbean />} />
                <Route path="/resume" element={<Resume />} />
                <Route path="/terminal" element={<Terminal />} />
                <Route path="/deathstar" element={<DeathStar />} />
                <Route path="/music" element={<Music />} />
                <Route path="/middle-earth/:place?" element={<MiddleEarth />} />
                <Route path="/scranton" element={<Scranton />} />
                <Route path="/avengers" element={<Avengers />} />
                <Route path="/cybertron" element={<Cybertron />} />
                <Route path="/albuquerque" element={<Albuquerque />} />
                <Route path="/c-137" element={<RickMorty />} />
                <Route path="/universe/:id?" element={<Front />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </WorldGate>
            </div>
          </Suspense>
        </ErrorBoundary>
      </main>
      {pathname !== '/terminal' && pathname !== '/deathstar' && page !== '/universe' && <Footer />}
      <ScrollSaber />
      <Guide />
      <Lightspeed />
      <PaletteHost />
      <IntroJump />
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeProvider>
        <AchievementProvider>
          <FunProvider>
            <Shell />
          </FunProvider>
        </AchievementProvider>
      </ThemeProvider>
    </HashRouter>
  );
}
