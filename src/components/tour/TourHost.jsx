import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { RiCompass3Line } from 'react-icons/ri';
import { useAchievements } from '../Achievements';
import { local } from '../../lib/hooks';
import { TOUR_EVENT, TOUR_KEY, flatten, offerHere, openTour, parseTourLink, planFor, readProgress, stopIndexFor, tourFor, writeProgress } from '../../lib/tour';
import { isFeedMove } from '../feed/feed';
import { BRIEF_EVENT, BRIEF_KEY, briefHere, briefKeyFor, sawBrief } from './brief';
import { guideKeyFor } from '../guide/routes';
import './offer.css';

// Always in the shell, and small: starts a tour of the site when asked
// (openTour: ⌘K, the guide, the terminal, the checklist, a ?tour= link),
// and offers one on a first arrival; and a world's basics, the first time
// you arrive in it (before you're dropped in) or when the guide asks
// (openBrief). The tour (Tour.jsx) and what each says load the first time
// one's offered or started.
//
// Two sorts of tour: the view's (the shell of the universe or the classic
// site, on the page you're on) and an audience's (the recruiter's, the
// player's, the whole one), which crosses pages: it opens them itself,
// remembers where it's got to, and ends if you leave by another way (Back).
const loadTour = () => import('./Tour');
const Tour = lazy(loadTour);

// the stops, and where to start: a world's basics, the view's tour, or an
// audience's chapters laid out as one run
async function loadList(run) {
  if (run.kind === 'brief') return { list: (await import('./briefs')).BRIEFS[run.name], start: 0 };
  const { TOURS } = await import('./steps');
  if (!run.audience) return { list: TOURS[run.name], start: 0 };
  const list = flatten(planFor(TOURS, run.audience, run.view, run.here));
  return { list, start: stopIndexFor(list, run) };
}

// nothing covering the page or asking over it: the intro, the cockpit, the
// phone menu, a tour, a dialog, a world asking before it downloads
const busy = () => {
  const html = document.documentElement;
  return ['covered', 'intro', 'menu', 'touring'].some((k) => k in html.dataset) || Boolean(document.querySelector('[aria-modal="true"], .world-gate'));
};

const under = (pathname, path) => pathname === path || pathname.startsWith(`${path}/`);
const BOTH = { mixed: ['recruiter', 'player'] };
const PRIZE = { recruiter: 'tourRecruiter', player: 'tourPlayer' };

export default function TourHost() {
  const location = useLocation();
  const { pathname, search } = location;
  const navType = useNavigationType();
  const navigate = useNavigate();
  const { unlock } = useAchievements();
  // the one running: { kind: 'tour', name: 'universe' | 'classic' }, an
  // audience's { kind: 'tour', name, audience, view, here, chapter?, stop?,
  // todo?, to? }, or { kind: 'brief', name: a world's key, page: the guide's
  // key it's on}; `n` counts starts, so starting again starts over
  const [run, setRun] = useState(null);
  const [asked, setAsked] = useState(null); // a page's own basics, waiting to show the first time: { key, page }
  const [loaded, setLoaded] = useState(null); // { run, list, start }: the stops, for the run they were loaded for
  const [offer, setOffer] = useState(false);
  const where = useRef(pathname);
  where.current = pathname;
  // the page an audience tour is on, or opening: leaving it any other way ends the tour
  const expected = useRef(null);
  const starts = useRef(0);

  useEffect(() => {
    const onStart = (e) => {
      setOffer(false);
      const d = e.detail;
      const view = tourFor(where.current);
      expected.current = null;
      starts.current += 1;
      setRun(d?.audience ? { kind: 'tour', name: d.audience, audience: d.audience, chapter: d.chapter, stop: d.stop, todo: d.todo, to: d.to, view, here: where.current, n: starts.current } : { kind: 'tour', name: view, n: starts.current });
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

  // A link that starts a tour (/#/home?tour=recruiter): marked offered
  // before the offer's first check, so the two don't both show; the
  // parameter taken off the address at once, so the feed (which puts a
  // page's own search back as you scroll back to it) can't start it again.
  useEffect(() => {
    const link = parseTourLink(search);
    if (!link) return;
    local.set(TOUR_KEY, writeProgress(local.get(TOUR_KEY, null), {}));
    const rest = new URLSearchParams(search);
    rest.delete('tour');
    rest.delete('chapter');
    const q = rest.toString();
    navigate({ pathname, search: q ? `?${q}` : '' }, { replace: true });
    openTour(link);
  }, [search, pathname, navigate]);

  useEffect(() => {
    if (!run) return undefined;
    let live = true;
    loadList(run).then(({ list, start }) => {
      if (!live) return;
      // Nothing to show: the audience's chapters aren't written, or what was
      // asked for isn't in them. A thing to do with no stop of its own is
      // still a place to go.
      if (!list?.length || start < 0) {
        setRun(null);
        if (run.to) navigate(run.to);
        return;
      }
      setLoaded({ run, list, start });
    });
    return () => {
      live = false;
    };
  }, [run, navigate]);
  const ready = loaded?.run === run ? loaded : null;

  // A page with another tour (back to the map from the feed, out of a
  // world) ends the view's tour (and a page's own basics not shown yet);
  // the feed moving the address as you scroll doesn't, nor picking a place
  // on the map. An audience's tour ends when you leave the page it's on by
  // any way but its own (it opens its pages itself): Back, or a link.
  const kind = tourFor(pathname);
  const page = guideKeyFor(pathname);
  useEffect(() => setRun((r) => (r && (r.kind === 'brief' ? r.page !== page : !r.audience && r.name !== kind) ? null : r)), [kind, page]);
  const feedMove = isFeedMove(location, navType);
  useEffect(() => {
    if (expected.current && !feedMove && !under(pathname, expected.current)) {
      expected.current = null;
      setRun((r) => (r?.audience ? null : r));
    }
  }, [pathname, feedMove]);

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
  // as it shows, and a link that started a tour counts. Choosing a place on
  // the map, or scrolling the feed on to its next page, keeps it up;
  // leaving for a world takes it down.
  const here = offerHere(pathname, null) ? kind : null;
  useEffect(() => {
    setOffer(false);
    const unset = () => readProgress(local.get(TOUR_KEY, null)) == null;
    if (!here || !unset()) return undefined;
    let calm = 0;
    const check = setInterval(() => {
      if (!unset()) return clearInterval(check);
      calm = busy() ? 0 : calm + 1;
      if (calm < 2) return;
      clearInterval(check);
      local.set(TOUR_KEY, writeProgress(null, {}));
      loadTour(); // (it's likely to be started next)
      setOffer(true);
    }, 1200);
    return () => clearInterval(check);
  }, [here]);

  const remember = (patch) => local.set(TOUR_KEY, writeProgress(local.get(TOUR_KEY, null), patch));

  // how: 'done', 'skipped', 'paused' (a key let through), 'cta' (gone to a
  // place the card offered). Only finishing forgets where an audience's
  // tour had got to; the guide offers to carry on from there otherwise.
  const end = (how) => {
    const was = run;
    expected.current = null;
    setRun(null);
    if (was?.kind !== 'tour' || how !== 'done') {
      if (was?.kind === 'tour') remember({});
      return;
    }
    unlock('tour');
    if (!was.audience) return remember({ done: ['view'] });
    const done = BOTH[was.audience] ?? [was.audience];
    done.forEach((a) => PRIZE[a] && unlock(PRIZE[a]));
    remember({ done: [...done, was.audience], audience: undefined, chapter: undefined, stop: undefined });
  };
  const notNow = () => {
    setOffer(false);
    remember({});
  };
  const start = (audience) => () => openTour({ audience });

  // an audience's tour, at stop i: remembered, so a reload or the guide can carry on
  const onProgress = (stop) => {
    expected.current = stop.path;
    remember({ audience: run.audience, chapter: stop.chapter, stop: stop.id });
  };
  const onNavigate = (path) => {
    expected.current = path;
    navigate(path);
  };
  const onCta = (to) => {
    end('cta');
    navigate(to);
  };

  return (
    <>
      {offer && !run && (
        <div className="tour-offer card" role="status">
          <RiCompass3Line className="tour-offer-icon" aria-hidden="true" />
          <div>
            <p className="tour-offer-title">New here?</p>
            <p className="tour-offer-text">Here to hire, here to play, or both? I’ll show you round.</p>
            <div className="tour-offer-buttons">
              <button type="button" className="btn btn-ghost btn-sm" onClick={start('recruiter')}>
                Hire
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={start('player')}>
                Play
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={start('mixed')}>
                Both
              </button>
              <button type="button" className="tour-offer-later" onClick={notNow}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
      {run && ready && (
        <Suspense fallback={null}>
          <Tour
            key={`${run.kind}:${run.name}:${run.n ?? 0}`}
            list={ready.list}
            start={ready.start}
            kind={run.kind}
            pathname={pathname}
            onEnd={end}
            onProgress={run.audience ? onProgress : undefined}
            onNavigate={onNavigate}
            onCta={onCta}
          />
        </Suspense>
      )}
    </>
  );
}
