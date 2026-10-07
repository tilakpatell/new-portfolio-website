import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RiCompass3Line } from 'react-icons/ri';
import { useAchievements } from '../Achievements';
import { local } from '../../lib/hooks';
import { TOUR_EVENT, TOUR_KEY, offerHere, openTour, tourFor } from '../../lib/tour';
import { BRIEF_EVENT, BRIEF_KEY, briefHere, briefKeyFor, sawBrief } from './brief';
import { guideKeyFor } from '../guide/routes';
import './offer.css';

// Always in the shell, and small: starts the tour of the site when asked
// (openTour: ⌘K, the guide, the terminal), and offers it on a first arrival;
// and a world's basics, the first time you arrive in it (before you're
// dropped in) or when the guide asks (openBrief). The tour (Tour.jsx) and
// what each says load the first time one's offered or started.
const loadTour = () => import('./Tour');
const Tour = lazy(loadTour);
const loadList = (run) => (run.kind === 'brief' ? import('./briefs').then((m) => m.BRIEFS[run.name]) : import('./steps').then((m) => m.TOURS[run.name]));

// nothing covering the page or asking over it: the intro, the cockpit, the
// phone menu, a tour, a dialog, a world asking before it downloads
const busy = () => {
  const html = document.documentElement;
  return ['covered', 'intro', 'menu', 'touring'].some((k) => k in html.dataset) || Boolean(document.querySelector('[aria-modal="true"], .world-gate'));
};

export default function TourHost() {
  const { pathname } = useLocation();
  const { unlock } = useAchievements();
  // the one running: { kind: 'tour', name: 'universe' | 'classic' } or
  // { kind: 'brief', name: a world's key, page: the guide's key it's on},
  // and its stops once loaded
  const [run, setRun] = useState(null);
  const [asked, setAsked] = useState(null); // a page's own basics, waiting to show the first time: { key, page }
  const [loaded, setLoaded] = useState(null); // { run, list }: the stops, for the run they were loaded for
  const [offer, setOffer] = useState(false);
  const where = useRef(pathname);
  where.current = pathname;

  useEffect(() => {
    const onStart = () => {
      setOffer(false);
      setRun({ kind: 'tour', name: tourFor(where.current) });
    };
    const onBrief = (e) => {
      const name = e.detail?.key ?? briefKeyFor(where.current);
      if (!name) return;
      if (e.detail?.first) setAsked({ key: name, page: guideKeyFor(where.current) });
      else setRun({ kind: 'brief', name, page: guideKeyFor(where.current) });
    };
    window.addEventListener(TOUR_EVENT, onStart);
    window.addEventListener(BRIEF_EVENT, onBrief);
    return () => {
      window.removeEventListener(TOUR_EVENT, onStart);
      window.removeEventListener(BRIEF_EVENT, onBrief);
    };
  }, []);

  useEffect(() => {
    if (!run) return undefined;
    let live = true;
    loadList(run).then((list) => live && setLoaded({ run, list }));
    return () => {
      live = false;
    };
  }, [run]);
  const list = loaded?.run === run ? loaded.list : null;

  // a page with another tour (back to the map from the feed, out of a world)
  // ends it (and a page's own basics not shown yet); the feed moving the
  // address as you scroll doesn't, nor picking a place on the map
  const kind = tourFor(pathname);
  const page = guideKeyFor(pathname);
  useEffect(() => setRun((r) => (r && (r.kind === 'tour' ? r.name !== kind : r.page !== page) ? null : r)), [kind, page]);

  // A world's basics, the first time you're in it (or a page's own, the
  // first time it asks): once nothing's covering it for two checks running,
  // before you've had the chance to be dropped in. Remembered as soon as
  // they show; the guide shows a world's again.
  const briefKey = asked?.page === page ? asked.key : briefKeyFor(pathname);
  useEffect(() => {
    if (!briefKey || !briefHere(briefKey, local.get(BRIEF_KEY, []), navigator.webdriver)) return undefined;
    loadTour();
    let calm = 0;
    const check = setInterval(() => {
      calm = busy() ? 0 : calm + 1;
      if (calm < 2) return;
      clearInterval(check);
      local.set(BRIEF_KEY, sawBrief(local.get(BRIEF_KEY, []), briefKey));
      setRun((r) => r ?? { kind: 'brief', name: briefKey, page: guideKeyFor(where.current) });
    }, 700);
    return () => clearInterval(check);
  }, [briefKey]);

  // The offer, on a first arrival at the map or the feed: once nothing's
  // covering the page (the intro, the front door's choice, the phone menu,
  // any dialog) for two checks running. Made once: it's remembered as soon
  // as it shows. Choosing a place on the map, or scrolling the feed on to
  // its next page, keeps it up; leaving for a world takes it down.
  const here = offerHere(pathname, null) ? kind : null;
  useEffect(() => {
    setOffer(false);
    if (!here || local.get(TOUR_KEY, null) != null) return undefined;
    let calm = 0;
    const check = setInterval(() => {
      calm = busy() ? 0 : calm + 1;
      if (calm < 2) return;
      clearInterval(check);
      local.set(TOUR_KEY, 'offered');
      loadTour(); // (it's likely to be started next)
      setOffer(true);
    }, 1200);
    return () => clearInterval(check);
  }, [here]);

  const end = (how) => {
    const was = run;
    setRun(null);
    if (was?.kind !== 'tour') return;
    local.set(TOUR_KEY, how);
    if (how === 'done') unlock('tour');
  };
  const notNow = () => {
    setOffer(false);
    local.set(TOUR_KEY, 'skipped');
  };

  return (
    <>
      {offer && !run && (
        <div className="tour-offer card" role="status">
          <RiCompass3Line className="tour-offer-icon" aria-hidden="true" />
          <div>
            <p className="tour-offer-title">New here?</p>
            <p className="tour-offer-text">A quick look round: where everything is, in under a minute.</p>
            <div className="tour-offer-buttons">
              <button type="button" className="btn btn-primary btn-sm" onClick={openTour}>
                Take the tour
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={notNow}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
      {run && list && (
        <Suspense fallback={null}>
          <Tour key={`${run.kind}:${run.name}`} list={list} kind={run.kind} onEnd={end} />
        </Suspense>
      )}
    </>
  );
}
