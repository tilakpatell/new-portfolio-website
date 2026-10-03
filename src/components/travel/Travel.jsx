import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { COUNTRY_COUNT, HOME, HOME_CITY, PLACES, distanceKm } from '../../data/places';
import { useAchievements } from '../Achievements';
import Landscape from './Landscape';

// The globe and its data load only when this section is near the screen.
const Globe = lazy(() => import('./Globe'));

const REGIONS = [...new Set(PLACES.map((p) => p.region))];
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
const countWord = (n) => WORDS[n] ?? String(n);
const km = new Intl.NumberFormat('en-US');
const roundTo = (n, step) => Math.round(n / step) * step;

function PlaceInfo({ place }) {
  if (!place) {
    return (
      <>
        <p className="stretch-semi text-lg font-semibold text-ink">Pick a place</p>
        <p className="mt-1 text-sm leading-relaxed text-body">Choose one above, or click a lit country on the globe, to fly there and see how far it is from {HOME_CITY}.</p>
      </>
    );
  }
  if (place.home) {
    return (
      <>
        <p className="stretch-semi text-lg font-semibold text-ink">{place.name}</p>
        <p className="mt-1 text-sm leading-relaxed text-body">Home base: {HOME_CITY}, where every route on the globe starts.</p>
      </>
    );
  }
  const d = distanceKm(HOME.at, place.at);
  return (
    <>
      <p className="stretch-semi text-lg font-semibold text-ink">{place.name}</p>
      <p className="mt-1 text-sm leading-relaxed text-body">
        {place.region}. About {km.format(roundTo(d, 10))} km ({km.format(roundTo(d * 0.621371, 10))} miles) from {HOME_CITY}.
      </p>
    </>
  );
}

function GlobeSkeleton() {
  return (
    <div className="globe relative aspect-square w-full" aria-hidden="true">
      <div className="globe-skeleton" />
    </div>
  );
}

export default function Travel() {
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const seen = useRef(new Set());
  const { unlock } = useAchievements();

  const select = useCallback(
    (id) => {
      setSelected(id);
      if (!id) return;
      seen.current.add(id);
      if (seen.current.size === PLACES.length) unlock('globetrotter');
    },
    [unlock],
  );

  const place = PLACES.find((p) => p.id === selected);
  const others = PLACES.length - COUNTRY_COUNT;

  return (
    <>
      <div className="shell relative grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div className="relative">
          <h2 id="travel-title" className="title">
            Places I’ve been
          </h2>
          <p className="lead mt-4 max-w-[46ch]">
            {countWord(COUNTRY_COUNT)} countries{others > 0 ? ' and the Caribbean' : ''} so far. Drag the globe to spin it, or pick a place to fly there.
          </p>
          <div className="mt-8 grid gap-5">
            {REGIONS.map((region) => (
              <div key={region}>
                <p className="label">{region}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {PLACES.filter((p) => p.region === region).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="place-chip"
                        aria-pressed={selected === p.id}
                        data-hover={hovered === p.id ? 'true' : undefined}
                        onClick={() => select(selected === p.id ? null : p.id)}
                      >
                        {p.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="place-card mt-8" aria-live="polite">
            <PlaceInfo place={place} />
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[640px]">
          <Suspense fallback={<GlobeSkeleton />}>
            <Globe
              selected={selected}
              onSelect={select}
              onHover={setHovered}
              label="Globe of the places I’ve been. Drag or use the arrow keys to spin it, plus and minus to zoom. The same places are listed as buttons beside it."
            />
          </Suspense>
          <p className="mt-3 text-center text-sm text-muted">Drag to spin. Click a lit country to fly there.</p>
        </div>
      </div>
      <Landscape className="mt-12 md:mt-16" />
    </>
  );
}
