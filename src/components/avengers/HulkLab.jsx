import { useEffect, useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import '../../styles/lazy/avengers.css';

const sfx = () => import('../../lib/sfx');

// Bruce Banner's lab. Three things make him angry; the third one lets the
// other guy out, and the floor takes the hit.
const STEPS = ['Calm. Running a gamma scan.', 'Mildly irritated.', 'Breathing deeply. Very deeply.'];

export default function HulkLab() {
  const [anger, setAnger] = useState(0);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const poke = () => {
    if (anger >= 3) return;
    audioContext(); // in the click, so the smash can be heard
    const next = anger + 1;
    setAnger(next);
    if (next < 3) return;
    sfx().then((s) => {
      s.boom();
      s.crumble(undefined, undefined, 0.1);
    });
    const root = document.documentElement;
    root.classList.remove('stand-ground');
    void root.offsetWidth;
    root.classList.add('stand-ground');
    timer.current = setTimeout(() => {
      root.classList.remove('stand-ground');
      setAnger(0);
    }, 4200);
  };
  const hulk = anger >= 3;
  return (
    <div>
      <div className="floor-stage hulk-stage" data-hulk={hulk || undefined}>
        <div className="hulk-meter" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} data-on={i < anger || undefined} />
          ))}
        </div>
        <p className="hulk-text">{hulk ? 'HULK SMASH.' : STEPS[anger]}</p>
      </div>
      <button type="button" className="btn btn-primary mt-5" onClick={poke} disabled={hulk}>
        {hulk ? 'Give him a minute' : 'Make him angry'}
      </button>
      <p className="mt-3 min-h-[1.5em] text-sm text-muted" role="status">
        {hulk ? 'The secret, as he told Cap: he is always angry.' : ''}
      </p>
    </div>
  );
}
