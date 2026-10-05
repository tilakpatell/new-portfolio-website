import { memo, useEffect, useRef, useState } from 'react';
import { RiArrowLeftLine, RiArrowRightLine } from 'react-icons/ri';
import Photo from '../Photo';
import { PLACES } from '../../data/places';
import { distanceLine } from './PlacesExplorer';
import { Waypoint } from '../ui';
import { prefersReducedMotion, useRowEnds } from '../../lib/hooks';
import '../../styles/lazy/travel.css';

// One picture per place (and one per city, where a trip took in several) in a
// row you can swipe. Choosing a card flies the globe above to that place.
const CARDS = PLACES.flatMap((p) => [
  { place: p, photoId: p.id, caption: p.photo, at: p.at },
  ...(p.more ?? []).map((m) => ({ place: p, photoId: m.id, caption: m.photo, at: m.at })),
]);
export default memo(function Postcards({ onPick }) {
  const row = useRef(null);
  // A lazy photo inside a sideways scroller is only fetched and painted once its
  // card is already on screen, so on the first swipe every card arrives empty
  // and fills in late. When the row is within a screen of the viewport, load
  // the whole row instead.
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = row.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setNear(true);
        io.disconnect();
      },
      { rootMargin: '100% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const earlier = useRef(null);
  const more = useRef(null);
  useRowEnds(row, earlier, more);
  const scroll = (dir) => {
    const el = row.current;
    if (!el) return;
    // One card and its gap. Two cards a press, or one where only one fits (a
    // narrow window), so a press never carries a card past without showing it.
    const [a, b] = el.children;
    const step = a && b ? b.offsetLeft - a.offsetLeft : 300;
    const cards = Math.max(1, Math.min(2, Math.floor(el.clientWidth / step)));
    el.scrollBy({ left: dir * step * cards, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <section data-theme-section="travel" className="relative z-10 py-16 md:py-24" aria-labelledby="postcards-title">
      <div className="shell relative flex flex-wrap items-end justify-between gap-6">
        <div className="relative">
          <Waypoint top="0.9rem" />
          <h2 id="postcards-title" className="title">
            Postcards
          </h2>
          <p className="lead mt-4 max-w-[48ch]">A picture for every place on the list. Choose one to find it on the globe.</p>
        </div>
        <div className="swipe-arrows">
          <button ref={earlier} type="button" className="globe-btn" onClick={() => scroll(-1)} aria-label="Earlier postcards">
            <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />
          </button>
          <button ref={more} type="button" className="globe-btn" onClick={() => scroll(1)} aria-label="More postcards">
            <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {/* the frame carries the mist over the row's left edge; the row's top padding grew by 4px, so mt-9 keeps the spacing */}
      <div className="swipe-frame mt-9">
        <ul ref={row} className="postcards" aria-label="Postcards">
          {CARDS.map((c) => (
            <li key={c.photoId}>
              <button type="button" className="postcard group" onClick={() => onPick(c.place.id)}>
                <span className="postcard-photo">
                  <Photo id={c.photoId} eager={near} sizes="(min-width: 768px) 300px, 70vw" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                </span>
                <span className="mt-3 block text-left">
                  <span className="stretch-semi block text-lg font-semibold text-ink">{c.place.name}</span>
                  <span className="mt-0.5 block text-sm text-body">{c.caption}</span>
                  <span className="mt-0.5 block text-xs text-muted">{c.place.home ? 'Home base country' : distanceLine(c)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
});
