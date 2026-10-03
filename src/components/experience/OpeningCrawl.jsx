import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { prefersReducedMotion } from '../../lib/hooks';

// The career so far, as an opening crawl. Every line comes from the roles on
// this page. Plain CSS 3D, so it plays without a GPU too. It renders into
// <body> so it covers the nav (the page's <main> is its own stacking context).
export default function OpeningCrawl({ onClose }) {
  const close = useRef(null);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    import('../../lib/sfx').then((s) => s.fanfare());
  }, []);

  useEffect(() => {
    const prev = document.activeElement;
    close.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    const done = reduced ? null : setTimeout(onClose, 46000);
    return () => {
      document.removeEventListener('keydown', onKey);
      html.style.overflow = overflow;
      clearTimeout(done);
      if (prev instanceof HTMLElement) prev.focus({ preventScroll: true });
    };
  }, [onClose, reduced]);

  return createPortal(
    <div className="crawl dark-scope" role="dialog" aria-modal="true" aria-label="Opening crawl">
      <div className="ds-stars absolute inset-0" aria-hidden="true" />
      <button ref={close} type="button" className="btn btn-ghost btn-sm crawl-close" onClick={onClose}>
        Skip
      </button>
      {!reduced && <p className="crawl-intro">A long time ago, in a dorm room at Northeastern…</p>}
      <div className={reduced ? 'crawl-static' : 'crawl-stage'}>
        <div className="crawl-text">
          <p className="crawl-episode">Episode VI</p>
          <p className="crawl-title">Return of the Intern</p>
          <p>
            It is a period of co-ops. Striking from a dorm room in Boston, engineer TILAK PATEL has turned five hundred radar documents into knowledge graphs at SRC and
            retired a legacy LabVIEW test rig at PENDAR.
          </p>
          <p>
            At BOSE, a three-phase pipeline cut firmware debugging from hours to minutes. At RTX, a modernization roadmap was drawn all the way to 2028.
          </p>
          <p>
            Now at AMAZON WEB SERVICES, the mission is capacity: planning the data centers that generative AI runs on, and flagging stale data before anyone has to ask…
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
