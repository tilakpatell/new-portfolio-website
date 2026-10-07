import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiArrowLeftLine, RiArrowRightLine, RiCheckLine } from 'react-icons/ri';
import { textOf } from './steps';
import { rowsFor } from './briefs';
import { targetOf } from './targets';
import { KeyTable } from '../guide/KeyTable';
import { litBox, placeCard } from '../../lib/tour';
import { shortcutLabel } from '../../lib/palette';
import { prefersReducedMotion } from '../../lib/hooks';
import './tour.css';

// One stop of a tour: the page dimmed, the thing lit (a box over its target,
// the dim as the box's shadow), and a card beside it saying what it is.
// Back, Next and Skip, or ← → Enter and Esc. It's a modal dialog: focus
// stays in the card, the page under it takes no clicks or keys (the universe
// doesn't fly), and focus goes back where it was at the end. Which stop, and
// what Next does, is the runner's (TourRunner); the stops are in steps.js and
// the scripts, and a world's basics (kind 'brief', the same cards with its
// keys on them) in briefs.js. `pause` steps aside: no dim, the page takes
// clicks and keys, the card sits in a corner (a stop that says "try it", and
// the wait while a page loads).

const PAD = 6; // round the lit box's target

const inView = (el) => {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight;
};

// the page behind, out of reach of a keyboard and a screen reader while it runs
function inertBehind() {
  const behind = [document.getElementById('main'), document.querySelector('.site-nav'), document.querySelector('.guide-btn'), ...document.querySelectorAll('footer')];
  const set = behind.filter((el) => el && !el.inert);
  set.forEach((el) => (el.inert = true));
  return () => set.forEach((el) => (el.inert = false));
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const coarse = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

const WORDS = {
  tour: { count: 'Tour', skip: 'Skip the tour', done: 'Done', leg: 'Skip this page' },
  brief: { count: 'The basics', skip: 'Skip the basics', done: 'Let’s go', leg: 'Skip this' },
};

export default function TourCard({ stop, kind = 'tour', index = 0, count = 1, first = index === 0, last = index === count - 1, pause = false, notice = null, legTitle = null, onNext = null, onBack = null, onSkip, onSkipLeg = null }) {
  const [touch] = useState(coarse);
  const words = WORDS[kind] ?? WORDS.tour;
  const paused = pause || Boolean(stop.pause);
  const [box, setBox] = useState(null); // the lit box, or null for a card in the middle
  const [pos, setPos] = useState(null); // the card's { side, top, left }
  const card = useRef(null);
  const next = useRef(null);
  const ids = useId();
  const ctx = { key: shortcutLabel(), touch };
  const act = useRef({});
  act.current = { forward: onNext, back: onBack, skip: onSkip };

  // On: html[data-touring] (it brings the nav and the guide's button back if
  // they're tucked away, and holds the guide's ? key), the page behind put
  // out of reach, focus into the card. Off: all of it back. Paused, the page
  // stays in reach: only the flag, so the nav and the button stay put.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const from = document.activeElement;
    html.dataset.touring = '';
    const free = paused ? () => {} : inertBehind();
    const into = paused ? 0 : requestAnimationFrame(() => next.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(into);
      free();
      delete html.dataset.touring;
      if (paused) return;
      // (what started it may be gone: the guide's panel closes as the tour opens)
      const back = from instanceof HTMLElement && from.isConnected && from !== document.body ? from : document.getElementById('main');
      back?.focus({ preventScroll: true });
    };
  }, [paused]);

  // The keys, before the page's own (captured, and stopped there): the
  // arrows, Enter and Escape drive the tour, Tab stays in the card, and no
  // other key gets through to the page under it. Paused, the page has them.
  useEffect(() => {
    if (paused) return undefined;
    const onKey = (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'Tab') {
        const els = [...(card.current?.querySelectorAll('button') ?? [])];
        const at = els.indexOf(document.activeElement);
        const to = e.shiftKey ? (at <= 0 ? els.length - 1 : at - 1) : at === els.length - 1 ? 0 : at + 1;
        e.preventDefault();
        els[to]?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        act.current.skip?.();
      } else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement))) {
        e.preventDefault();
        act.current.forward?.();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        act.current.back?.();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [paused]);

  // The lit box and the card follow the target, a frame at a time (the nav
  // slides back in, the page scrolls, the window changes size), setting
  // state only when something's moved. A target out of view (the ships, low
  // in the panel) is scrolled to first.
  useLayoutEffect(() => {
    let el = stop.at ? targetOf(stop.at) : null;
    if (el && !inView(el)) el.scrollIntoView({ block: stop.scroll ?? 'center', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    let frame = 0;
    let was = null;
    const measure = () => {
      if (stop.at && !el?.isConnected) el = targetOf(stop.at);
      const r = el?.getBoundingClientRect();
      const view = { w: document.documentElement.clientWidth, h: window.innerHeight };
      const lit = r && r.width >= 1 ? litBox(r, view, PAD) : null;
      const c = card.current;
      if (c) {
        const at = paused ? { side: 'corner', top: 0, left: 0 } : placeCard(lit && { ...lit, right: lit.left + lit.width, bottom: lit.top + lit.height }, { w: c.offsetWidth, h: c.offsetHeight }, view);
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
  }, [stop, paused]);

  const text = textOf(stop, ctx);
  const rows = rowsFor(stop, touch);
  const corner = pos?.side === 'corner';
  return createPortal(
    <div className="tour" data-kind={kind} data-lit={box ? '' : undefined} data-pause={paused ? '' : undefined}>
      {/* the clicks on the page under it stop here */}
      <div className="tour-veil" aria-hidden="true" />
      {box && <div className="tour-spot" aria-hidden="true" style={box} />}
      <div
        ref={card}
        className="tour-card card"
        role={paused ? 'status' : 'dialog'}
        aria-modal={paused ? undefined : 'true'}
        aria-labelledby={`${ids}-title`}
        aria-describedby={`${ids}-text`}
        data-side={pos?.side}
        style={pos ? (corner ? undefined : { top: pos.top, left: pos.left }) : { visibility: 'hidden' }}
      >
        <p className="tour-count">
          {words.count} · {index + 1} of {count}
          {legTitle && count > 1 ? ` · ${legTitle}` : ''}
        </p>
        <h2 id={`${ids}-title`} className="tour-title">
          {stop.title}
        </h2>
        <p id={`${ids}-text`} className="tour-text">
          {text}
        </p>
        {notice && <p className="tour-notice">{notice}</p>}
        {rows && <KeyTable rows={rows} className="guide-keys tour-keys" />}
        {count <= 24 && (
          <ol className="tour-dots" aria-hidden="true">
            {Array.from({ length: count }, (_, n) => (
              <li key={n} data-on={n === index ? '' : undefined} data-past={n < index ? '' : undefined} />
            ))}
          </ol>
        )}
        <div className="tour-buttons">
          {!last && (
            <button type="button" className="tour-skip" onClick={onSkip}>
              {words.skip}
            </button>
          )}
          {onSkipLeg && (
            <button type="button" className="tour-skip tour-skip-leg" onClick={onSkipLeg}>
              {words.leg}
            </button>
          )}
          {onBack && !first && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onBack} aria-label="Back">
              <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {onNext && (
            <button ref={next} type="button" className="btn btn-primary btn-sm" onClick={onNext}>
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
          )}
        </div>
        {/* each stop said aloud as it comes (focus stays on Next) */}
        <p className="sr-only" aria-live="polite">
          {index > 0 && `${index + 1} of ${count}. ${stop.title}. ${text}`}
        </p>
      </div>
    </div>,
    document.body,
  );
}
