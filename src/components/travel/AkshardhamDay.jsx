import { useEffect, useRef, useState } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine, RiPauseFill, RiPlayFill, RiZoomInLine } from 'react-icons/ri';
import Photo from '../Photo';
import { audioContext } from '../../lib/audio';
import { prefersReducedMotion } from '../../lib/hooks';

// A day at the two Akshardhams, in photographs: morning to after dark, one
// photo for each time of day. Slide through it, play it, swipe it, or use the
// arrow keys; the photos cross-fade (opacity only, so it stays smooth on a
// phone) and the one on screen drifts in slowly.

const sfx = () => import('../../lib/sfx');

// eslint-disable-next-line react-refresh/only-export-components
export const DAY = [
  { id: 'h-robbinsville-day', time: 'Morning', place: 'Robbinsville, New Jersey', text: 'White stone, carved by hand in India and assembled here. The mandir opened in October 2023.', pos: '50% 38%' },
  { id: 'h-delhi-gardens', time: 'Midday', place: 'New Delhi', text: 'Lawns, hedges and gardens all around the mandir, close to the bank of the Yamuna.', pos: '50% 78%' },
  { id: 'h-robbinsville', time: 'Sunset', place: 'Robbinsville, New Jersey', text: 'The last of the sun on the stone, and the mandir doubled in the water in front of it.', pos: '50% 55%' },
  { id: 'h-delhi', time: 'Evening', place: 'New Delhi', text: 'The lights come up, and the reflection in the water with them.', pos: '50% 50%' },
  { id: 'h-delhi-night', time: 'Night', place: 'New Delhi', text: 'Nine domes and 234 carved pillars, lit gold.', pos: '50% 50%' },
  { id: 'h-delhi-fountain', time: 'After dark', place: 'New Delhi', text: 'The Sahaj Anand water show, on the steps of the Yagnapurush Kund: the largest stepwell in the world.', pos: '50% 55%' },
];
const STEP_MS = 4200;

export default function AkshardhamDay({ onOpen }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rang, setRang] = useState(0);
  const timer = useRef(0);
  const touch = useRef(null);
  const n = DAY.length;
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

  const stop = DAY[i];
  const still = prefersReducedMotion();
  return (
    <div className="akd">
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
        {DAY.map((d, k) => (
          <div key={d.id} className="akd-slide" data-on={k === i || undefined} aria-hidden={k !== i}>
            <Photo id={d.id} sizes="(min-width: 1280px) 1180px, 100vw" priority={k === 0} className="akd-img" style={{ objectPosition: d.pos }} />
          </div>
        ))}
        <div className="akd-scrim" aria-hidden="true" />
        <div className="akd-text">
          <p className="akd-time">
            {stop.time} · {stop.place}
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
          <button type="button" className="akd-zoom" onClick={() => onOpen(stop.id)} aria-label={`Open larger: ${stop.time}, ${stop.place}`}>
            <RiZoomInLine className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {playing && !still && <span key={i} className="akd-progress" style={{ '--d': `${STEP_MS}ms` }} aria-hidden="true" />}
      </div>

      <div className="akd-controls">
        <ol className="akd-times" aria-label="Time of day">
          {DAY.map((d, k) => (
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
