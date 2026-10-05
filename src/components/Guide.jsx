import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RiQuestionLine } from 'react-icons/ri';

// A guide to the site, and to whatever the page you're on lets you play. The
// "?" button in the corner (or the ? key) opens it. The panel and everything
// it says load the first time it opens (or the button is pointed at).
const loadPanel = () => import('./GuidePanel');
const GuidePanel = lazy(loadPanel);

export default function Guide() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const button = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === '?') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  // On a phone the button tucks away while you scroll down the page (so it
  // never sits over a game's controls) and comes back when you scroll up.
  // (once a frame at most, and only when it changes)
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let now = false;
    let frame = 0;
    const set = (v) => {
      if (v === now) return;
      now = v;
      setTucked(v);
    };
    const check = () => {
      frame = 0;
      const y = window.scrollY;
      if (y < 160) set(false);
      else if (y > last + 8) set(true);
      else if (y < last - 8) set(false);
      if (Math.abs(y - last) > 8) last = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className="guide-btn"
        data-tucked={(tucked && !open) || undefined}
        onClick={() => setOpen((o) => !o)}
        onPointerEnter={loadPanel}
        onFocus={loadPanel}
        aria-expanded={open}
        aria-controls="guide-panel"
        aria-label="Guide: how this site works"
      >
        <RiQuestionLine className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && (
        <Suspense fallback={null}>
          <GuidePanel pathname={pathname} close={close} onLeave={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
