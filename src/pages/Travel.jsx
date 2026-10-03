import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RiArrowDownLine } from 'react-icons/ri';
import RouteLine from '../components/RouteLine';
import Photo from '../components/Photo';
import { Reveal, Waypoint } from '../components/ui';
import PlacesExplorer, { countWord } from '../components/travel/PlacesExplorer';
import PhotoBand from '../components/travel/PhotoBand';
import Postcards from '../components/travel/Postcards';
import Heritage from '../components/travel/Heritage';
import Peace from '../components/travel/Peace';
import PhotoCredits from '../components/travel/PhotoCredits';
import { CONTINENT_COUNT, COUNTRY_COUNT, HOME, HOME_CITY, PLACES, distanceKm } from '../data/places';
import { PHOTOS } from '../data/photos';
import { useSectionThemes } from '../theme/ThemeProvider';
import { prefersReducedMotion, useDocumentTitle } from '../lib/hooks';
import { jumpTo } from '../lib/anchors';
import Egg from '../components/Egg';

const num = new Intl.NumberFormat('en-US');
const away = PLACES.filter((p) => !p.home);
const farthest = away.reduce((a, b) => (distanceKm(HOME.at, b.at) > distanceKm(HOME.at, a.at) ? b : a));
const northernmost = PLACES.reduce((a, b) => (b.at[1] > a.at[1] ? b : a));
const southernmost = PLACES.reduce((a, b) => (b.at[1] < a.at[1] ? b : a));

const FACTS = [
  { value: String(COUNTRY_COUNT), label: 'countries, plus the Caribbean' },
  { value: String(CONTINENT_COUNT), label: 'continents' },
  { value: `${num.format(Math.round(distanceKm(HOME.at, farthest.at) / 100) * 100)} km`, label: `to ${farthest.name}, the farthest from ${HOME_CITY}` },
  { value: `${Math.round(northernmost.at[1])}°N to ${Math.round(-southernmost.at[1])}°S`, label: `${northernmost.name} to ${southernmost.name}` },
];

function Hero() {
  return (
    <header className="travel-hero relative isolate overflow-hidden" aria-labelledby="travel-hero-title">
      <Photo id="hero" priority sizes="100vw" className="absolute inset-0 -z-30 h-full w-full object-cover" />
      <div className="travel-hero-scrim -z-20" aria-hidden="true" />
      <div className="fog fog-a -z-10" aria-hidden="true" />
      <div className="fog fog-b -z-10" aria-hidden="true" />
      <div className="hero-mist -z-10" aria-hidden="true" />
      <div className="shell relative flex min-h-[clamp(560px,90svh,940px)] flex-col justify-end pb-[clamp(7rem,20vh,12rem)] pt-[calc(var(--nav-h)+48px)]">
        <p className="eyebrow hero-in !text-white/85">Travel</p>
        <h1 id="travel-hero-title" className="display hero-in mt-5 max-w-4xl text-[clamp(3.2rem,1.2rem+7vw,7.4rem)] !text-white" style={{ '--d': '80ms' }}>
          Places I’ve been
        </h1>
        <p className="lead hero-in mt-6 max-w-[34rem] !text-[clamp(1.1rem,1rem+0.45vw,1.3rem)] !text-white/90" style={{ '--d': '160ms' }}>
          {countWord(COUNTRY_COUNT)} countries and the Caribbean so far, with a soft spot for mountains and lakes.
        </p>
        <div className="hero-in mt-9" style={{ '--d': '240ms' }}>
          <a href="#globe" className="btn btn-primary btn-lg group" onClick={(e) => jumpTo(e, 'globe')}>
            Spin the globe <RiArrowDownLine className="h-4 w-4 transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
}

function HomeBase() {
  const school = PHOTOS['west-genesee'];
  return (
    <section data-theme-section="travel" className="shell relative z-10 py-16 md:py-24" aria-labelledby="home-base-title">
      <Egg id="mug" className="egg-corner" />
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
        <div className="relative">
          <Waypoint top="0.9rem" />
          <h2 id="home-base-title" className="title">
            Home base: Syracuse, New York
          </h2>
          <p className="lead mt-5 max-w-[44ch]">
            Home is Syracuse, in Central New York. I went to West Genesee High School, just west of the city in Camillus.
          </p>
          <p className="mt-4 leading-relaxed text-body">Every route on the globe starts here.</p>
        </div>
        <div className="relative pb-16 sm:pb-10">
          <Reveal as="figure" className="m-0">
            <div className="heritage-photo aspect-[16/10]">
              <Photo id="syracuse" sizes="(min-width: 1024px) 640px, 100vw" className="h-full w-full object-cover" />
            </div>
            <figcaption className="mt-2.5 text-sm text-muted">Downtown Syracuse</figcaption>
          </Reveal>
          <Reveal delay={120} className="school-card">
            {school && (
              <div className="mb-4 aspect-[16/10] overflow-hidden rounded-[calc(var(--r-card)-6px)]">
                <Photo id="west-genesee" sizes="280px" className="h-full w-full object-cover" />
              </div>
            )}
            <p className="label">High school</p>
            <p className="stretch-semi mt-1 text-lg font-semibold leading-snug text-ink">West Genesee High School</p>
            <p className="mt-0.5 text-sm text-body">Camillus, New York</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Facts() {
  return (
    <PhotoBand id="band" className="travel-band">
      <div className="shell relative py-[clamp(7rem,16vw,12rem)]">
        <h2 className="sr-only">By the numbers</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          {FACTS.map((f, i) => (
            <Reveal key={f.label} delay={i * 80} className="band-fact">
              <dt className="sr-only">{f.label}</dt>
              <dd className="m-0">
                <span className="display block text-[clamp(2rem,1.2rem+2.8vw,3.6rem)] !text-white">{f.value}</span>
                <span className="mt-2 block text-sm leading-snug text-white/85">{f.label}</span>
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </PhotoBand>
  );
}

export default function Travel() {
  useDocumentTitle('Travel');
  useSectionThemes();
  const page = useRef(null);
  const [params] = useSearchParams();
  const [selected, setSelected] = useState(() => (PLACES.some((p) => p.id === params.get('place')) ? params.get('place') : null));

  // Deep links from the command palette: /travel?place=is flies to Iceland.
  useEffect(() => {
    const id = params.get('place');
    if (!PLACES.some((p) => p.id === id)) return undefined;
    setSelected(id);
    const t = setTimeout(() => document.getElementById('globe')?.scrollIntoView({ block: 'start' }), 300);
    return () => clearTimeout(t);
  }, [params]);

  // /travel?section=heritage opens at that section (the hero's temple icon)
  useEffect(() => {
    const id = params.get('section');
    if (!id) return undefined;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 350);
    return () => clearTimeout(t);
  }, [params]);

  const flyTo = useCallback((id) => {
    setSelected(id);
    document.getElementById('globe')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }, []);

  return (
    <div ref={page} className="relative">
      <RouteLine containerRef={page} />
      <Hero />
      <HomeBase />
      <section id="globe" data-theme-section="travel" className="relative z-10 scroll-mt-20 py-16 md:py-24" aria-labelledby="globe-title">
        <div className="shell relative">
          <div className="relative">
            <Waypoint top="0.9rem" />
          </div>
        </div>
        <PlacesExplorer
          title="Every trip, from Syracuse"
          titleId="globe-title"
          intro="Drag the globe to spin it, or pick a place to fly there and see how far it is from home."
          selected={selected}
          onSelect={setSelected}
        />
      </section>
      <Postcards onPick={flyTo} />
      <Heritage />
      <Peace />
      <Facts />
      <PhotoCredits />
    </div>
  );
}
