import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { local } from '../../lib/hooks';
import { RUN_KEY, legsFor, nearLeg, onLeg, readyFor, resolveSteps } from '../../lib/tour';
import { targetOf } from './targets';

// Walks a script (lib/tour: legs of stops, each leg a page) and shows one
// stop at a time on the card (TourCard). Entering a leg goes to its page if
// you're not on it, waits for the page to be ready (its cover lifted, a
// world's gate answered, its first target showing, or six seconds), then
// resolves the leg's stops against what's on the screen. Next on a leg's
// last stop enters the next; Back on its first goes back a leg. Leaving the
// leg's page by any other way ends the run, keeping its place (tp-tour-run)
// for next time. Lives in the shell (TourHost), so it outlasts the pages.
const TourCard = lazy(() => import('./TourCard'));

const TICK = 200; // between looks at the page
const PATIENCE = 6000; // after which a leg goes on with what's there
const coarse = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

// what the page's state looks like to lib/tour's readyFor
const probe = () => {
  const html = document.documentElement;
  return {
    covered: 'covered' in html.dataset || 'intro' in html.dataset,
    gate: Boolean(document.querySelector('.world-gate')),
    modal: Boolean(document.querySelector('[aria-modal="true"]:not(.tour-card)')),
    has: (name) => Boolean(targetOf(name)),
  };
};

const fire = (what) => {
  if (typeof what === 'function') what();
  else if (typeof what === 'string') window.dispatchEvent(new CustomEvent(what));
};

export default function TourRunner({ script, kind = 'tour', from = null, onEnd }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [legs] = useState(() => legsFor(script, { touch: coarse() }));
  const [leg, setLeg] = useState(() => Math.min(from?.leg ?? 0, Math.max(legs.length - 1, 0)));
  const [i, setI] = useState(from?.stop ?? 0);
  const [list, setList] = useState(null); // { leg, stops }: the leg's stops showing here, once its page is ready
  const [waiting, setWaiting] = useState(false); // the page's taking a moment (a world downloading)
  const [light, setLight] = useState(false); // the world's in its light version (a phone kept it)
  const where = useRef(pathname);
  where.current = pathname;
  const end = useRef(onEnd);
  end.current = onEnd;
  const atEnd = useRef(false); // entering a leg from the one after: land on its last stop
  const started = useRef(from?.startedAt ?? Date.now());
  const cur = legs[leg];
  const total = legs.reduce((n, l) => n + l.stops.length, 0);
  const before = legs.slice(0, leg).reduce((n, l) => n + l.stops.length, 0);

  // Entering a leg: its page, then its stops once the page is ready
  useEffect(() => {
    if (!cur) {
      end.current('done');
      return undefined;
    }
    setList(null);
    setWaiting(false);
    if (cur.path && !onLeg(cur, where.current)) navigate(cur.path);
    const since = Date.now();
    let timer = 0;
    const look = () => {
      const waited = Date.now() - since;
      const here = onLeg(cur, where.current);
      const first = cur.stops.find((s) => s.at)?.at;
      if (!here && waited >= PATIENCE) {
        // the page went somewhere else on the way (a redirect, a world's
        // own door): the run ends here, keeping its place
        end.current('left');
        return;
      }
      if (!here || (!readyFor(cur.ready, probe(), first) && waited < PATIENCE)) {
        setWaiting(here && waited >= 600);
        timer = setTimeout(look, TICK);
        return;
      }
      setWaiting(false);
      setLight(Boolean(document.querySelector('.world-gate-pill')));
      // a world's basics say everything at every stop; a page's own tour
      // drops a stop whose target isn't here, unless the page never came
      // ready (then every card, in the middle, so the script reads whole)
      const keep = kind === 'brief' || waited >= PATIENCE;
      const stops = resolveSteps(cur.stops, (at) => Boolean(targetOf(at)), keep);
      setI((n) => (atEnd.current ? stops.length - 1 : Math.min(n, stops.length - 1)));
      atEnd.current = false;
      setList({ leg, stops });
    };
    look();
    return () => clearTimeout(timer);
  }, [leg, cur, kind, navigate]);

  // Leaving the leg's page another way (the nav, back, a planet) ends the
  // run (once the leg's stops are showing: on the way in, the page is still
  // the last leg's)
  useEffect(() => {
    if (list?.leg === leg && cur?.path && !nearLeg(cur, pathname)) end.current('left');
  }, [pathname, list, leg, cur]);

  // Where you are, for next time (a tour across pages only)
  const stop = list?.leg === leg ? list.stops[i] : null;
  useEffect(() => {
    if (!stop || !legs.some((l) => l.path)) return;
    local.set(RUN_KEY, { mode: script.id, leg, stop: i, startedAt: started.current, path: cur?.path ?? null });
  }, [stop, legs, script.id, leg, i, cur]);

  // a stop's own doing: before it shows, and after
  useEffect(() => {
    if (!stop) return undefined;
    fire(stop.before);
    return () => fire(stop.after);
  }, [stop]);

  const stops = list?.leg === leg ? list.stops : [];
  const lastLeg = leg === legs.length - 1;
  const forward = () => {
    if (i < stops.length - 1) setI(i + 1);
    else if (lastLeg) end.current('done');
    else {
      setI(0);
      setLeg(leg + 1);
    }
  };
  const back = () => {
    if (i > 0) setI(i - 1);
    else if (leg > 0) {
      atEnd.current = true;
      setLeg(leg - 1);
    }
  };
  const skipLeg = () => (lastLeg ? end.current('done') : (setI(0), setLeg(leg + 1)));

  if (!cur) return null;
  if (!stop) {
    if (!waiting) return null;
    const title = cur.title ?? script.title ?? 'the next page';
    return (
      <Suspense fallback={null}>
        <TourCard
          kind={kind}
          pause
          stop={{ id: 'wait', title: `Loading ${title}`, text: cur.waitText ?? 'The tour carries on as soon as it’s in. If this device asks before downloading its 3D, answer it: the tour works either way.' }}
          index={before}
          count={total}
          onSkip={() => end.current('skipped')}
          onSkipLeg={legs.length > 1 && cur.skippable !== false ? skipLeg : null}
        />
      </Suspense>
    );
  }
  const notice = light && i === 0 && cur.ready === 'world' ? (cur.lightText ?? 'This world is in its light version on this device; the 3D loads from the button at the bottom any time.') : null;
  return (
    <Suspense fallback={null}>
      <TourCard
        kind={kind}
        stop={stop}
        index={before + i}
        count={total}
        first={leg === 0 && i === 0}
        last={lastLeg && i === stops.length - 1}
        notice={notice}
        onNext={forward}
        onBack={leg === 0 && i === 0 ? null : back}
        onSkip={() => end.current('skipped')}
        onSkipLeg={legs.length > 1 && cur.skippable !== false && !(lastLeg && i === stops.length - 1) ? skipLeg : null}
        legTitle={cur.title}
      />
    </Suspense>
  );
}
