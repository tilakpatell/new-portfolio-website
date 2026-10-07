import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RiCompass3Line } from 'react-icons/ri';
import { useAchievements } from '../Achievements';
import { local } from '../../lib/hooks';
import { RUN_KEY, TOUR_EVENT, TOUR_KEY, markTour, offerHere, openTour, tourFor, tourInSearch } from '../../lib/tour';
import { BRIEF_EVENT, BRIEF_KEY, briefHere, briefKeyFor, sawBrief } from './brief';
import { guideKeyFor } from '../guide/routes';
import './offer.css';

// Always in the shell, and small: starts a tour when asked (openTour: ⌘K,
// the guide, the terminal, a link with ?tour=), and offers one on a first
// arrival; and a world's basics, the first time you arrive in it (before
// you're dropped in) or when the guide asks (openBrief). The runner
// (TourRunner), the card and what each tour says load the first time one's
// offered or started.
const loadRunner = () => import('./TourRunner');
const TourRunner = lazy(loadRunner);
const loadScripts = () => import('./scripts');
const SHELL = ['classic', 'universe'];

// nothing covering the page or asking over it: the intro, the cockpit, the
// phone menu, a tour, a dialog, a world asking before it downloads
const busy = () => {
  const html = document.documentElement;
  return ['covered', 'intro', 'menu', 'touring'].some((k) => k in html.dataset) || Boolean(document.querySelector('[aria-modal="true"], .world-gate'));
};

export default function TourHost() {
  const { pathname, search } = useLocation();
  const { unlock } = useAchievements();
  // the one running: { kind: 'tour', mode } or { kind: 'brief', name, page:
  // the guide's key it's on }, and its script once loaded
  const [run, setRun] = useState(null);
  const [asked, setAsked] = useState(null); // a page's own basics, waiting to show the first time: { key, page }
  const [loaded, setLoaded] = useState(null); // { run, script }: the script, for the run it was loaded for
  const [offer, setOffer] = useState(false);
  const [modes, setModes] = useState(SHELL); // the tours a link may ask for, once the scripts are known
  const where = useRef(pathname);
  where.current = pathname;

  useEffect(() => {
    const onStart = (e) => {
      setOffer(false);
      setRun({ kind: 'tour', mode: e.detail?.mode ?? tourFor(where.current) });
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
    loadScripts()
      .then((m) => (run.kind === 'brief' ? m.loadBrief(run.name) : m.loadScript(run.mode)))
      .then((script) => {
        if (!live) return;
        if (script) setLoaded({ run, script });
        else setRun(null);
      });
    return () => {
      live = false;
    };
  }, [run]);
  const script = loaded?.run === run ? loaded.script : null;

  // A page with another shell tour (back to the map from the feed, out of a
  // world) ends it (and a page's own basics not shown yet); the feed moving
  // the address as you scroll doesn't, nor picking a place on the map. A
  // tour across pages minds its own legs (TourRunner).
  const kind = tourFor(pathname);
  const page = guideKeyFor(pathname);
  useEffect(() => setRun((r) => (r && (r.kind === 'tour' ? SHELL.includes(r.mode) && r.mode !== kind : r.page !== page) ? null : r)), [kind, page]);

  // A world's basics, the first time you're in it (or a page's own, the
  // first time it asks): once nothing's covering it for two checks running,
  // before you've had the chance to be dropped in. Remembered as soon as
  // they show; the guide shows a world's again.
  const briefKey = asked?.page === page ? asked.key : briefKeyFor(pathname);
  useEffect(() => {
    if (!briefKey || !briefHere(briefKey, local.get(BRIEF_KEY, []), navigator.webdriver)) return undefined;
    loadRunner();
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

  // A link that asks for a tour (#/?tour=recruiter): once nothing's covering
  // the page (the intro, the front door's choice), it starts; the address
  // keeps the rest. Asked once, however the page moves on.
  const wanted = tourInSearch(search, modes);
  const linked = useRef(false);
  useEffect(() => {
    if (!wanted || linked.current) return undefined;
    linked.current = true;
    loadRunner();
    loadScripts().then((m) => setModes([...SHELL, ...m.MODES.map((x) => x.id)]));
    let calm = 0;
    const check = setInterval(() => {
      calm = busy() ? 0 : calm + 1;
      if (calm < 2) return;
      clearInterval(check);
      openTour(wanted);
    }, 700);
    return () => clearInterval(check);
  }, [wanted]);

  // The offer, on a first arrival at the map or the feed: once nothing's
  // covering the page (the intro, the front door's choice, the phone menu,
  // any dialog) for two checks running. Made once: it's remembered as soon
  // as it shows. Choosing a place on the map, or scrolling the feed on to
  // its next page, keeps it up; leaving for a world takes it down.
  const here = offerHere(pathname, null) ? kind : null;
  useEffect(() => {
    setOffer(false);
    if (!here || wanted || local.get(TOUR_KEY, null) != null) return undefined;
    let calm = 0;
    const check = setInterval(() => {
      calm = busy() ? 0 : calm + 1;
      if (calm < 2) return;
      clearInterval(check);
      local.set(TOUR_KEY, markTour(local.get(TOUR_KEY, null), null, 'offered'));
      loadRunner(); // (it's likely to be started next)
      setOffer(true);
    }, 1200);
    return () => clearInterval(check);
  }, [here, wanted]);

  // How it ended: done or skipped is remembered against the tour (and done
  // earns its achievement); left (the page changed under it) keeps its place
  // for next time instead.
  const end = (how) => {
    const was = run;
    const what = script;
    setRun(null);
    if (was?.kind !== 'tour' || !what) return;
    if (how === 'left') return;
    local.set(TOUR_KEY, markTour(local.get(TOUR_KEY, null), what.status ?? what.id, how));
    try {
      window.localStorage.removeItem(RUN_KEY);
    } catch {
      /* storage unavailable */
    }
    if (how === 'done') unlock(what.achievement ?? `tour-${what.id}`);
  };
  const notNow = () => {
    setOffer(false);
    local.set(TOUR_KEY, markTour(local.get(TOUR_KEY, null), 'shell', 'skipped'));
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
              <button type="button" className="btn btn-primary btn-sm" onClick={() => openTour()}>
                Take the tour
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={notNow}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
      {run && script && (
        <Suspense fallback={null}>
          <TourRunner key={`${run.kind}:${script.id}`} script={script} kind={run.kind} onEnd={end} />
        </Suspense>
      )}
    </>
  );
}
