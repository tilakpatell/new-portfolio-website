import { useEffect, useRef, useState } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine, RiPauseFill, RiPlayFill, RiZoomInLine } from 'react-icons/ri';
import Photo from '../Photo';
import { audioContext } from '../../lib/audio';
import { prefersReducedMotion } from '../../lib/hooks';
import AkdStage from './akd3d/AkdStage';
import TimeTrack from './akd3d/TimeTrack';
import '../../styles/lazy/travel.css';

// A day at each of the two Akshardhams, in their own photographs: pick
// Robbinsville or New Delhi, then slide through the day, play it, swipe it or
// use the arrow keys. The photos cross-fade (opacity only, so it stays smooth
// on a phone) and the one on screen drifts in slowly; in 3D (akd3d/) the light
// changes first and the time track scrubs the day, over that same <img> stack.

const sfx = () => import('../../lib/sfx');

// eslint-disable-next-line react-refresh/only-export-components
export const PLACES = [
  {
    id: 'robbinsville',
    name: 'Robbinsville, NJ',
    place: 'Robbinsville, New Jersey',
    day: [
      { id: 'h-rv-day', time: 'Day', text: 'White stone, carved by hand in India and assembled here, above lawns and flower beds. The mandir opened in October 2023.', pos: '50% 18%' },
      { id: 'h-rv-golden', time: 'Golden hour', text: 'The low sun across the lake, and a fountain in the middle of it.', pos: '50% 55%' },
      { id: 'h-robbinsville', time: 'Sunset', text: 'The last light on the stone, and the mandir doubled in the water.', pos: '50% 55%' },
      { id: 'h-rv-dusk', time: 'Dusk', text: 'From above as the lights come up: the mandir and its long pools.', pos: '50% 50%' },
      { id: 'h-rv-night', time: 'Night', text: 'Lit for the inauguration in October 2023, every path lined with lights.', pos: '50% 50%' },
      { id: 'h-rv-fireworks', time: 'Celebration', text: 'Fireworks over the mandir at the inauguration.', pos: '50% 42%' },
    ],
  },
  {
    id: 'delhi',
    name: 'New Delhi',
    place: 'New Delhi',
    day: [
      { id: 'h-dl-lotus', time: 'Morning', text: 'The Yogi Hriday Kamal: a garden laid out like a lotus opening.', pos: '50% 60%' },
      { id: 'h-dl-day', time: 'Day', text: 'Carved sandstone and marble, 141 feet tall, opened on 6 November 2005.', pos: '50% 50%' },
      { id: 'h-dl-golden', time: 'Golden hour', text: 'The mandir by the lake, the water holding its reflection.', pos: '50% 50%' },
      { id: 'h-dl-dusk', time: 'Dusk', text: 'Nine domes and 234 carved pillars, lit gold as the sky turns violet.', pos: '50% 45%' },
      { id: 'h-dl-night', time: 'Night', text: 'The whole mandir lit against the night sky.', pos: '50% 50%' },
      { id: 'h-dl-watershow', time: 'Water show', text: 'The Sahaj Anand water show, on the steps of the Yagnapurush Kund: the largest stepwell in the world.', pos: '50% 50%' },
    ],
  },
];
// every photo, for the lightbox
 
export const DAY = PLACES.flatMap((p) => p.day.map((d) => ({ ...d, place: p.place })));
const STEP_MS = 4200;

export default function AkshardhamDay({ onOpen }) {
  const [placeId, setPlaceId] = useState(PLACES[0].id);
  const where = PLACES.find((p) => p.id === placeId) ?? PLACES[0];
  const day = where.day;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rang, setRang] = useState(0);
  const [scrub, setScrub] = useState(null); // the time track while it's dragged
  const timer = useRef(0);
  const touch = useRef(null);
  const n = day.length;
  const go = (k) => setI((((k % n) + n) % n));

  // playing steps through the day and stops after dark
  useEffect(() => {
    if (!playing) return undefined;
    timer.current = setTimeout(() => {
      if (i >= n - 1) setPlaying(false);
      else setI(i + 1);
    }, STEP_MS);
    return () => clearTimeout(timer.current);
  }, [playing, i, n]);

  const play = () => {
    if (playing) return setPlaying(false);
    if (i >= n - 1) setI(0);
    setPlaying(true);
    return undefined;
  };
  const step = (d) => {
    setPlaying(false);
    go(i + d);
  };
  const scrubTo = (t) => {
    setPlaying(false);
    setScrub(t);
  };
  const ring = () => {
    audioContext(); // in the click, so the bell can be heard
    sfx().then((s) => s.ghanta());
    setRang(Date.now());
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    }
  };
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(t.clientY - s.y)) step(dx < 0 ? 1 : -1);
  };

  const pick = (id) => {
    setPlaying(false);
    setPlaceId(id);
    setI(0);
  };
  const stop = day[i] ?? day[0];
  const still = prefersReducedMotion();
  return (
    <div className="akd">
      <div className="akd-places" role="group" aria-label="Which Akshardham">
        {PLACES.map((p) => (
          <button key={p.id} type="button" aria-pressed={p.id === placeId} onClick={() => pick(p.id)}>
            {p.name}
          </button>
        ))}
      </div>
      <div
        className="akd-stage"
        role="group"
        aria-roledescription="slideshow"
        aria-label="A day at Akshardham"
        tabIndex={0}
        onKeyDown={onKey}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {day.map((d, k) => (
          <div key={d.id} className="akd-slide" data-on={k === i || undefined} aria-hidden={k !== i}>
            <Photo id={d.id} sizes="(min-width: 1280px) 1180px, 100vw" className="akd-img" style={{ objectPosition: d.pos }} />
          </div>
        ))}
        <AkdStage place={placeId} day={day} index={i} scrub={scrub} rang={rang} />
        <div className="akd-scrim" aria-hidden="true" />
        <div className="akd-text">
          <p className="akd-time">
            {stop.time} · {where.place}
          </p>
          <p className="akd-caption" aria-live="polite">
            {stop.text}
          </p>
        </div>
        <span key={rang} className="akd-bell-ring" data-on={rang || undefined} aria-hidden="true" />
        <button type="button" className="akd-arrow akd-prev" onClick={() => step(-1)} aria-label="Earlier">
          <RiArrowLeftSLine className="h-6 w-6" aria-hidden="true" />
        </button>
        <button type="button" className="akd-arrow akd-next" onClick={() => step(1)} aria-label="Later">
          <RiArrowRightSLine className="h-6 w-6" aria-hidden="true" />
        </button>
        {onOpen && (
          <button type="button" className="akd-zoom" onClick={() => onOpen(stop.id)} aria-label={`Open larger: ${stop.time}, ${where.place}`}>
            <RiZoomInLine className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <TimeTrack day={day} index={i} playing={playing} still={still} stepMs={STEP_MS} onScrub={scrubTo} onPick={(k) => step(k - i)} />

      <div className="akd-controls">
        <ol className="akd-times" aria-label="Time of day">
          {day.map((d, k) => (
            <li key={d.id}>
              <button type="button" aria-current={k === i ? 'step' : undefined} onClick={() => step(k - i)}>
                {d.time}
              </button>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary btn-sm" onClick={play}>
            {playing ? <RiPauseFill className="h-4 w-4" aria-hidden="true" /> : <RiPlayFill className="h-4 w-4" aria-hidden="true" />}
            {playing ? 'Pause' : 'Play the day'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={ring}>
            Ring the bell
          </button>
        </div>
      </div>
    </div>
  );
}
