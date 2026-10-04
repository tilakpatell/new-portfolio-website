import { useRef } from 'react';
import { RiArrowLeftLine, RiArrowRightLine } from 'react-icons/ri';
import Photo from '../Photo';
import { PLACES } from '../../data/places';
import { distanceLine } from './PlacesExplorer';
import { Waypoint } from '../ui';

// One picture per place (and one per city, where a trip took in several) in a
// row you can swipe. Choosing a card flies the globe above to that place.
const CARDS = PLACES.flatMap((p) => [
  { place: p, photoId: p.id, caption: p.photo, at: p.at },
  ...(p.more ?? []).map((m) => ({ place: p, photoId: m.id, caption: m.photo, at: m.at })),
]);
export default function Postcards({ onPick }) {
  const row = useRef(null);
  const scroll = (dir) => {
    const el = row.current;
    if (!el) return;
    const card = el.querySelector('li');
    const step = card ? card.getBoundingClientRect().width + 16 : 300;
    el.scrollBy({ left: dir * step * 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
        <div className="flex gap-2">
          <button type="button" className="globe-btn" onClick={() => scroll(-1)} aria-label="Earlier postcards">
            <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className="globe-btn" onClick={() => scroll(1)} aria-label="More postcards">
            <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <ul ref={row} className="postcards mt-10" aria-label="Postcards">
        {CARDS.map((c) => (
          <li key={c.photoId}>
            <button type="button" className="postcard group" onClick={() => onPick(c.place.id)}>
              <span className="postcard-photo">
                <Photo id={c.photoId} sizes="(min-width: 768px) 300px, 70vw" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
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
    </section>
  );
}
