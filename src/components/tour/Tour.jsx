import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiArrowLeftLine, RiArrowRightLine, RiCheckLine } from 'react-icons/ri';
import { textOf } from './steps';
import { rowsFor } from './briefs';
import { KeyTable } from '../guide/KeyTable';
import { litBox, placeCard, resolveSteps } from '../../lib/tour';
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
  tour: { count: 'Tour', skip: 'Skip the tour', done: 'Done' },
  brief: { count: 'The basics', skip: 'Skip the basics', done: 'Let’s go' },
};

export default function Tour({ list, kind = 'tour', onEnd }) {
  const [steps] = useState(() => resolveSteps(list, (at) => Boolean(targetOf(at)), kind === 'brief'));
  const [touch] = useState(coarse);
  const words = WORDS[kind] ?? WORDS.tour;
  const [i, setI] = useState(0);
  const [box, setBox] = useState(null); // the lit box, or null for a card in the middle
  const [pos, setPos] = useState(null); // the card's { side, top, left }
  const card = useRef(null);
  const next = useRef(null);
  const ids = useId();
  const step = steps[i];
  const last = i === steps.length - 1;
  const ctx = { key: shortcutLabel() };

  const go = (to) => setI(Math.max(0, Math.min(to, steps.length - 1)));
  const forward = () => (last ? onEnd('done') : go(i + 1));
  const act = useRef({});
  act.current = { forward, back: () => go(i - 1), skip: () => onEnd('skipped') };

  // On: html[data-touring] (it brings the nav and the guide's button back if
  // they're tucked away, and holds the guide's ? key), the page behind put
  // out of reach, focus into the card. Off: all of it back.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const from = document.activeElement;
    html.dataset.touring = '';
    const free = inertBehind();
    const into = requestAnimationFrame(() => next.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(into);
      free();
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
      e.stopImmediatePropagation();
      if (e.key === 'Tab') {
        const els = [...(card.current?.querySelectorAll('button') ?? [])];
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
  useLayoutEffect(() => {
    let el = step.at ? targetOf(step.at) : null;
    if (el && !inView(el)) el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    let frame = 0;
    let was = null;
    const measure = () => {
      if (step.at && !el?.isConnected) el = targetOf(step.at);
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
  }, [step]);

  const text = textOf(step, ctx);
  const rows = rowsFor(step, touch);
  return createPortal(
    <div className="tour" data-kind={kind} data-lit={box ? '' : undefined}>
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
          {words.count} · {i + 1} of {steps.length}
        </p>
        <h2 id={`${ids}-title`} className="tour-title">
          {step.title}
        </h2>
        <p id={`${ids}-text`} className="tour-text">
          {text}
        </p>
        {rows && <KeyTable rows={rows} className="guide-keys tour-keys" />}
        <ol className="tour-dots" aria-hidden="true">
          {steps.map((s, n) => (
            <li key={s.id} data-on={n === i ? '' : undefined} data-past={n < i ? '' : undefined} />
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
          <button ref={next} type="button" className="btn btn-primary btn-sm" onClick={forward}>
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
          {i > 0 && `${i + 1} of ${steps.length}. ${step.title}. ${text}`}
        </p>
      </div>
    </div>,
    document.body,
  );
}
