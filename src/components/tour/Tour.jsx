import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiArrowLeftLine, RiArrowRightLine, RiArrowRightUpLine, RiCheckLine } from 'react-icons/ri';
import { textOf } from './steps';
import { rowsFor } from './briefs';
import { KeyTable } from '../guide/KeyTable';
import { litBox, nextIndex, placeCard, resolveSteps, samePage, stepState, waitUntil } from '../../lib/tour';
import { useAchievements } from '../Achievements';
import { THINGS_TO_DO, isDone } from '../../data/todo';
import { local } from '../../lib/hooks';
import { VISITED_KEY } from '../../lib/visited';
import { shortcutLabel } from '../../lib/palette';
import { prefersReducedMotion } from '../../lib/hooks';
import './tour.css';

// The tour itself: the page dimmed, one thing lit at a time (a box over its
// target, the dim as the box's shadow), and a card beside it saying what it
// is. Back, Next and Skip, or ← → Enter and Esc. It's a modal dialog: focus
// stays in the card, the page under it takes no clicks or keys (the universe
// doesn't fly), and focus goes back where it was at the end. Loaded the first
// time a tour starts (TourHost); the stops are in steps.js, and a world's
// basics (kind 'brief', the same cards with its keys on them) in briefs.js.
//
// An audience's tour crosses pages: each stop carries its chapter's `path`.
// Arriving at a stop on another page, it asks TourHost to open it, and the
// card waits in the middle ("One moment…") until the page is drawn, nothing
// covers it and its target's there (lib/tour's stepState); eight seconds at
// most, then the card shows in the middle anyway. A stop's `cta` leaves the
// tour for a place (a world, a game) and a stop with keys: 'release' lets ?
// and the palette's shortcut through, ending the tour so they can open.

const PAD = 6; // round the lit box's target

// the first element marked for a stop that's showing (the guide's "?" is the
// corner button on most pages, the panel's own on the map)
function targetOf(name) {
  for (const el of document.querySelectorAll(`[data-tour~="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width >= 1 && r.height >= 1 && getComputedStyle(el).visibility !== 'hidden') return el;
  }
  return null;
}

const inView = (el) => {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight;
};

// the page behind, out of reach of a keyboard and a screen reader while it
// runs (again after each page the tour opens: a new page brings its own footer)
function inertBehind() {
  const behind = [document.getElementById('main'), document.querySelector('.site-nav'), document.querySelector('.guide-btn'), ...document.querySelectorAll('footer')];
  const set = behind.filter((el) => el && !el.inert);
  set.forEach((el) => (el.inert = true));
  return () => set.forEach((el) => (el.inert = false));
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// what covers the page, other than this tour: the intro, the cockpit, the
// phone menu, a dialog, a world asking before it downloads
const covered = () => {
  const html = document.documentElement;
  if (['covered', 'intro', 'menu'].some((k) => k in html.dataset)) return true;
  return [...document.querySelectorAll('[aria-modal="true"], .world-gate')].some((el) => !el.closest('.tour'));
};

// the page's code has arrived and drawn: the route's Suspense fallback
// (App.jsx, data-fallback) is gone and something's in its place
const drawn = () => {
  const main = document.getElementById('main');
  return Boolean(main?.firstElementChild) && !main.querySelector(':scope > [data-fallback]');
};

const released = (e) => e.key === '?' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k');
const coarse = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

const WORDS = {
  tour: { count: 'Tour', skip: 'Skip the tour', done: 'Done' },
  brief: { count: 'The basics', skip: 'Skip the basics', done: 'Let’s go' },
};

const noop = () => {};

export default function Tour({ list, kind = 'tour', start = 0, pathname, onEnd, onProgress, onNavigate = noop, onCta = noop }) {
  // an audience's stops are on pages not open yet, so they're checked as
  // they come; a view's tour and a world's basics are all on this page
  const crosses = list.some((s) => s.path);
  const [steps] = useState(() => (crosses ? list : resolveSteps(list, (at) => Boolean(targetOf(at)), kind === 'brief')));
  const [touch] = useState(coarse);
  const words = WORDS[kind] ?? WORDS.tour;
  const [i, setI] = useState(start);
  const [waiting, setWaiting] = useState(crosses); // on its way to the stop's page, or waiting for it
  const [box, setBox] = useState(null); // the lit box, or null for a card in the middle
  const [pos, setPos] = useState(null); // the card's { side, top, left }
  const card = useRef(null);
  const next = useRef(null);
  const ids = useId();
  const step = steps[i];
  const last = i === steps.length - 1;
  const ctx = { key: shortcutLabel() };

  const dir = useRef(1); // the way it's going, for a stop skipped on the way
  const go = (to) => {
    dir.current = to < i ? -1 : 1;
    setI(Math.max(0, Math.min(to, steps.length - 1)));
  };
  const forward = () => (waiting ? undefined : last ? onEnd('done') : go(i + 1));
  const act = useRef({});
  act.current = { forward, back: () => go(i - 1), skip: () => onEnd('skipped'), release: step.keys === 'release' && !waiting, pause: () => onEnd('paused') };
  const here = useRef(pathname);
  here.current = pathname;
  const opened = useRef(null); // the page this tour last opened, or started on
  const frees = useRef([]);

  // On: html[data-touring] (it brings the nav and the guide's button back if
  // they're tucked away, and holds the guide's ? key), the page behind put
  // out of reach, focus into the card. Off: all of it back.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const from = document.activeElement;
    html.dataset.touring = '';
    frees.current.push(inertBehind());
    const into = requestAnimationFrame(() => next.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(into);
      frees.current.forEach((free) => free());
      frees.current = [];
      delete html.dataset.touring;
      // (what started it may be gone: the guide's panel closes as the tour opens)
      const back = from instanceof HTMLElement && from.isConnected && from !== document.body ? from : document.getElementById('main');
      back?.focus({ preventScroll: true });
    };
  }, []);

  // The keys, before the page's own (captured, and stopped there): the
  // arrows, Enter and Escape drive the tour, Tab stays in the card, and no
  // other key gets through to the page under it.
  useEffect(() => {
    const onKey = (e) => {
      // a stop that asks you to try ? or the palette: the key goes through
      // to open it, and the tour ends (the guide offers to carry on); the
      // guide, which hears it first, knows by html[data-touring="release"]
      if (act.current.release && released(e)) {
        act.current.pause();
        return;
      }
      e.stopImmediatePropagation();
      if (e.key === 'Tab') {
        const els = [...(card.current?.querySelectorAll('button:not(:disabled)') ?? [])];
        const at = els.indexOf(document.activeElement);
        const to = e.shiftKey ? (at <= 0 ? els.length - 1 : at - 1) : at === els.length - 1 ? 0 : at + 1;
        e.preventDefault();
        els[to]?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        act.current.skip();
      } else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement))) {
        e.preventDefault();
        act.current.forward();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        act.current.back();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // The lit box and the card follow the target, a frame at a time (the nav
  // slides back in, the page scrolls, the window changes size), setting
  // state only when something's moved. A target out of view (the ships, low
  // in the panel) is scrolled to first.
  // An audience's stop: remembered, its page opened if it isn't this one,
  // then shown once the page is ready (or after the wait), or passed over if
  // it's a shell stop not on this screen.
  const live = useRef({});
  live.current = { steps, onProgress, onNavigate };
  useEffect(() => {
    if (!crosses) return undefined;
    // (the page's own changes don't restart the wait: they're read live)
    const { steps, onProgress, onNavigate } = live.current;
    const step = steps[i];
    onProgress?.(step);
    setWaiting(true);
    // A new chapter's page is opened unless you're on it; within a chapter
    // it's opened again only if you've somehow left it (the feed moving the
    // address to its neighbour as it settles isn't leaving).
    const there = opened.current === step.path ? samePage(here.current, step.path) : here.current === step.path;
    if (!there) onNavigate(step.path);
    opened.current = step.path;
    let off = false;
    const page = { busy: covered, rendered: () => drawn() && samePage(here.current, step.path), hasTarget: (at) => Boolean(targetOf(at)) };
    const check = (waited) => {
      const s = stepState(step, page, waited);
      return s === 'wait' ? null : s;
    };
    waitUntil(check, { tick: (fn) => setTimeout(fn, 120), now: () => performance.now(), cancelled: () => off }).then((how) => {
      if (off || how === 'cancelled') return;
      if (how === 'skip') {
        if (i === 0) dir.current = 1; // (nothing before the first: on, and on from here)
        const to = nextIndex(steps, i, dir.current);
        if (to !== i) return setI(to);
      }
      frees.current.push(inertBehind());
      setWaiting(false);
      requestAnimationFrame(() => next.current?.focus({ preventScroll: true }));
    });
    return () => {
      off = true;
    };
  }, [i, crosses]);

  useLayoutEffect(() => {
    let el = step.at && !waiting ? targetOf(step.at) : null;
    if (el && !inView(el)) el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    let frame = 0;
    let was = null;
    const measure = () => {
      if (step.at && !waiting && !el?.isConnected) el = targetOf(step.at);
      const r = el?.getBoundingClientRect();
      const view = { w: document.documentElement.clientWidth, h: window.innerHeight };
      const lit = r && r.width >= 1 ? litBox(r, view, PAD) : null;
      const c = card.current;
      if (c) {
        const at = placeCard(lit && { ...lit, right: lit.left + lit.width, bottom: lit.top + lit.height }, { w: c.offsetWidth, h: c.offsetHeight }, view);
        const now = { lit, at: { ...at, top: Math.round(at.top), left: Math.round(at.left) } };
        if (!same(now, was)) {
          was = now;
          setBox(now.lit);
          setPos(now.at);
        }
      }
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [step, waiting]);

  // the guide's ? goes through at a stop that asks you to try it
  const release = step.keys === 'release' && !waiting;
  useEffect(() => {
    const html = document.documentElement;
    if ('touring' in html.dataset) html.dataset.touring = release ? 'release' : '';
  }, [release]);

  // a stop showing a thing to do says so when it's done (spec 3.2)
  const { unlocked } = useAchievements();
  const thing = step.todo && !waiting ? THINGS_TO_DO.find((t) => t.id === step.todo) : null;
  const ticked = thing ? isDone(thing, { unlocked, visited: local.get(VISITED_KEY, []) }) : false;
  const text = waiting ? 'One moment…' : textOf(step, ctx);
  // (keys: 'release' says which keys go through, not which to show)
  const shown = waiting ? null : rowsFor(step, touch);
  const rows = Array.isArray(shown) ? shown : null;
  // an audience's tour counts by chapter, and its dots are the chapter's
  const chapter = crosses ? steps.filter((s) => s.chapter === step.chapter) : steps;
  const at = crosses ? chapter.indexOf(step) : i;
  return createPortal(
    <div className="tour" data-kind={kind} data-lit={box ? '' : undefined} data-waiting={waiting ? '' : undefined}>
      {/* the clicks on the page under it stop here */}
      <div className="tour-veil" aria-hidden="true" />
      {box && <div className="tour-spot" aria-hidden="true" style={box} />}
      <div
        ref={card}
        className="tour-card card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        aria-describedby={`${ids}-text`}
        data-side={pos?.side}
        style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
      >
        <p className="tour-count">
          {crosses ? step.chapterTitle : words.count} · {at + 1} of {chapter.length}
          {ticked && (
            <span className="tour-ticked">
              {' '}
              · <RiCheckLine className="inline h-3.5 w-3.5" aria-hidden="true" /> Done
            </span>
          )}
        </p>
        <h2 id={`${ids}-title`} className="tour-title">
          {waiting ? step.chapterTitle : step.title}
        </h2>
        <p id={`${ids}-text`} className="tour-text">
          {text}
        </p>
        {rows && <KeyTable rows={rows} className="guide-keys tour-keys" />}
        {step.cta && !waiting && (
          <button type="button" className="btn btn-ghost btn-sm tour-cta" onClick={() => onCta(step.cta.to)}>
            {step.cta.label} <RiArrowRightUpLine className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <ol className="tour-dots" aria-hidden="true">
          {chapter.map((s, n) => (
            <li key={s.key ?? s.id} data-on={n === at ? '' : undefined} data-past={n < at ? '' : undefined} />
          ))}
        </ol>
        <div className="tour-buttons">
          {!last && (
            <button type="button" className="tour-skip" onClick={() => onEnd('skipped')}>
              {words.skip}
            </button>
          )}
          {i > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => go(i - 1)} aria-label="Back">
              <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button ref={next} type="button" className="btn btn-primary btn-sm" onClick={forward} disabled={waiting}>
            {last ? (
              <>
                <RiCheckLine className="h-4 w-4" aria-hidden="true" /> {words.done}
              </>
            ) : (
              <>
                Next <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
        {/* each stop said aloud as it comes (focus stays on Next) */}
        <p className="sr-only" aria-live="polite">
          {waiting ? `${step.chapterTitle}. One moment…` : (i > 0 || crosses) && `${at + 1} of ${chapter.length}. ${step.title}. ${text}`}
        </p>
      </div>
    </div>,
    document.body,
  );
}
