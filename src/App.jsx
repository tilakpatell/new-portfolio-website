import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeProvider';
import { AchievementProvider, useAchievements } from './components/Achievements';
import { FunProvider } from './fun/FunProvider';
import OnlineProvider from './components/universe/online/OnlineProvider';
import ErrorBoundary from './components/ErrorBoundary';
import Nav from './components/Nav';
import Footer from './components/Footer';
import ScrollSaber from './components/ScrollSaber';
import Guide from './components/Guide';
// fetches the 3D jump ahead of time (the intro's, and three.js once a page has it)
import './components/hyperspace3d/load';
import { audioContext } from './lib/audio';
import { introPlaying } from './lib/stale';
import WorldGate from './components/worlds/WorldGate';

const Experience = lazy(() => import('./pages/Experience'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Contact = lazy(() => import('./pages/Contact'));
const Travel = lazy(() => import('./pages/Travel'));
const Caribbean = lazy(() => import('./pages/Caribbean'));
const Invincible = lazy(() => import('./pages/Invincible'));
const Resume = lazy(() => import('./pages/Resume'));
const Terminal = lazy(() => import('./pages/Terminal'));
const DeathStar = lazy(() => import('./pages/DeathStar'));
const Galaxy = lazy(() => import('./pages/Galaxy'));
const GalaxyMission = lazy(() => import('./pages/GalaxyMission'));
const GalaxySurface = lazy(() => import('./pages/GalaxySurface'));
const Music = lazy(() => import('./pages/Music'));
const MiddleEarth = lazy(() => import('./pages/MiddleEarth'));
const Scranton = lazy(() => import('./pages/Scranton'));
const Avengers = lazy(() => import('./pages/Avengers'));
const Cybertron = lazy(() => import('./pages/Cybertron'));
const Albuquerque = lazy(() => import('./pages/Albuquerque'));
const RickMorty = lazy(() => import('./pages/RickMorty'));
const Citadel = lazy(() => import('./pages/Citadel'));
const DotMatrix = lazy(() => import('./pages/DotMatrix'));
const Earth = lazy(() => import('./pages/Earth'));
const Front = lazy(() => import('./pages/Front'));
const Home = lazy(() => import('./pages/Home'));
const NotFound = lazy(() => import('./pages/NotFound'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));
const Hyperspace = lazy(() => import('./components/Hyperspace'));

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
  return (
    <Suspense fallback={null}>
      <Hyperspace key={on} sound onDone={() => setOn(0)} />
    </Suspense>
  );
}

// A first visit to the site opens on a welcome (what the site is, what the
// intro does, and whose worlds these are; Skip goes straight to the front
// door), then the crawl, then puts you in a cockpit
// (the Falcon first; the X-wing, Rick's cruiser and the RV a click away),
// and the launch comes out at the front door's choice over the universe
// map, where everything is laid out as places to fly to. The inline script
// in index.html decides (and covers the page until it starts). The map and
// the cockpit load during the crawl; the map stays still under the crawl
// and the cockpit (html[data-covered], see lib/three/useScene) and comes on
// at the launch's flash. ⌘K's "Back to the cockpit" plays it again.
const OpeningCrawl = lazy(() => import('./components/experience/OpeningCrawl'));
const Cockpit = lazy(() => import('./components/cockpit/Cockpit'));
const Welcome = lazy(() => import('./components/cockpit/Welcome'));
const cover = (on) => {
  const el = document.documentElement;
  if (on) el.dataset.covered = '';
  else if ('covered' in el.dataset) {
    delete el.dataset.covered;
    window.dispatchEvent(new Event('tp:uncover'));
  }
};
function IntroJump() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [stage, setStage] = useState(() => (document.documentElement.dataset.intro === '1' ? 'welcome' : null));
  const [ride, setRide] = useState(null); // a replay: { vehicle }, or null for the first visit
  useEffect(() => {
    if (!stage) return;
    try {
      window.localStorage.setItem('tp-intro', '1');
    } catch {
      /* storage unavailable */
    }
    if (stage === 'welcome' || stage === 'crawl') {
      import('./components/experience/OpeningCrawl');
      import('./pages/Front');
      import('./components/universe/scene');
      import('./components/cockpit/load').then((m) => m.preloadCockpit());
    }
  }, [stage]);
  useEffect(() => {
    cover(stage === 'welcome' || stage === 'crawl' || stage === 'cockpit');
    return () => cover(false);
  }, [stage]);
  // (a reload for the new build in the middle of a first visit's intro plays it again: lib/stale)
  useEffect(() => introPlaying(Boolean(stage) && !ride), [stage, ride]);
  // ⌘K: back to the cockpit, from anywhere
  useEffect(() => {
    const again = (e) => {
      if (stage) return;
      import('./components/cockpit/load').then((m) => m.preloadCockpit(e.detail?.vehicle));
      setRide({ vehicle: e.detail?.vehicle ?? null });
      setStage('cockpit');
    };
    window.addEventListener('tp:cockpit', again);
    return () => window.removeEventListener('tp:cockpit', again);
  }, [stage]);
  const closeCrawl = useCallback(() => {
    // keep the page covered until the cockpit's first frame
    document.documentElement.dataset.intro = '1';
    setStage('cockpit');
  }, []);
  if (!stage) return null;
  if (stage === 'welcome')
    return (
      <Suspense fallback={null}>
        <Welcome
          onStart={() => setStage('crawl')}
          onSkip={() => {
            setStage(null);
            // to the front door's choice, as the launch would have come out
            requestAnimationFrame(() => document.querySelector('.start-choice button')?.focus({ preventScroll: true }));
          }}
        />
      </Suspense>
    );
  if (stage === 'crawl')
    return (
      <Suspense fallback={null}>
        <OpeningCrawl variant="intro" onClose={closeCrawl} />
      </Suspense>
    );
  return (
    <Suspense fallback={null}>
      <Cockpit
        start={ride?.vehicle ?? undefined}
        onPeak={() => {
          // out into the universe (the front door is it, unless a visitor
          // asked for the home page), flying the ship you launched in
          if (!/^\/(universe(\/|$)|$)/.test(pathname)) navigate('/universe');
          cover(false);
        }}
        onDone={() => {
          setStage(null);
          setRide(null);
        }}
      />
    </Suspense>
  );
}

// The intro has a boundary of its own: a file of it gone after a deploy (the
// cockpit's, asked for as the crawl ends) reloads for the new build
// (ErrorBoundary), and anything else in it puts you in the site, uncovered,
// instead of blanking the page.
function IntroGone() {
  useEffect(() => {
    delete document.documentElement.dataset.intro;
  }, []);
  return null;
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
// the camera instead of building the universe again. Middle-earth's places
// (/middle-earth/moria) keep one page the same way, so its map stays up,
// and so do the galaxy's systems (/galaxy/hoth), so a jump from one to the
// next keeps the one scene (its missions' briefings are pages of their own).
const pageKey = (pathname) =>
  pathname === '/' || pathname.startsWith('/universe')
    ? '/universe'
    : pathname.startsWith('/middle-earth')
      ? '/middle-earth'
      : /^\/galaxy(\/[a-z0-9-]+)?$/.test(pathname)
        ? '/galaxy'
        : pathname;

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
      import('./components/Hyperspace');
    });
    return () => (window.cancelIdleCallback || clearTimeout)(id);
  }, []);

  return (
    <OnlineProvider>
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
                <Route path="/invincible" element={<Invincible />} />
                <Route path="/resume" element={<Resume />} />
                <Route path="/terminal" element={<Terminal />} />
                <Route path="/deathstar" element={<DeathStar />} />
                <Route path="/galaxy/:system?" element={<Galaxy />} />
                <Route path="/galaxy/:system/mission" element={<GalaxyMission />} />
                <Route path="/galaxy/:system/surface" element={<GalaxySurface />} />
                <Route path="/music" element={<Music />} />
                <Route path="/middle-earth/:place?" element={<MiddleEarth />} />
                <Route path="/scranton" element={<Scranton />} />
                <Route path="/avengers" element={<Avengers />} />
                <Route path="/cybertron" element={<Cybertron />} />
                <Route path="/albuquerque" element={<Albuquerque />} />
                <Route path="/c-137" element={<RickMorty />} />
                <Route path="/c-137/citadel" element={<Citadel />} />
                <Route path="/dot-matrix" element={<DotMatrix />} />
                <Route path="/earth" element={<Earth />} />
                <Route path="/universe/:id?" element={<Front />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </WorldGate>
            </div>
          </Suspense>
        </ErrorBoundary>
      </main>
      {pathname !== '/terminal' && pathname !== '/deathstar' && page !== '/universe' && page !== '/galaxy' && !pathname.endsWith('/surface') && <Footer />}
      <ScrollSaber />
      <Guide />
      <Lightspeed />
      <PaletteHost />
      <ErrorBoundary fallback={<IntroGone />}>
        <IntroJump />
      </ErrorBoundary>
    </OnlineProvider>
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
