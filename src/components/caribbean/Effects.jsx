import { useEffect, useState } from 'react';
import { audioContext } from '../../lib/audio';

const sound = (name) => {
  audioContext(); // inside the press, so the sound may play
  import('./tide/audio').then((s) => s[name]?.());
};

// The rum. Six bottles; press one to drink it. When the last has gone the
// page asks the obvious question, and lists a little.
const BOTTLES = 6;

export function Rum({ onGone }) {
  const [drunk, setDrunk] = useState(() => new Set());
  const gone = drunk.size === BOTTLES;
  useEffect(() => {
    onGone?.(gone);
  }, [gone, onGone]);
  const drink = (i) => {
    if (drunk.has(i)) return;
    sound('glug');
    setDrunk((s) => new Set(s).add(i));
  };
  return (
    <div className="cb-toy card">
      <div className="cb-rum" role="group" aria-label={`Rum: ${BOTTLES - drunk.size} of ${BOTTLES} bottles left`}>
        {Array.from({ length: BOTTLES }, (_, i) => (
          <button key={i} type="button" className="cb-bottle" data-empty={drunk.has(i) || undefined} onClick={() => drink(i)} aria-label={drunk.has(i) ? 'An empty bottle' : 'Drink this bottle'} disabled={drunk.has(i)}>
            <svg viewBox="0 0 40 110" aria-hidden="true">
              <path className="cb-bottle-glass" d="M15 4h10v20c0 6 9 10 9 22v54c0 4-3 6-6 6H12c-3 0-6-2-6-6V46c0-12 9-16 9-22z" />
              <path className="cb-bottle-rum" d="M8 52h24v48c0 2-2 4-4 4H12c-2 0-4-2-4-4z" />
              <rect className="cb-bottle-label" x="9" y="62" width="22" height="20" rx="2" />
              <rect className="cb-bottle-cork" x="15" y="0" width="10" height="8" rx="2" />
            </svg>
          </button>
        ))}
      </div>
      <h3 className="cb-toy-title">{gone ? 'Why is the rum gone?' : 'The rum'}</h3>
      <p className="cb-toy-line" aria-live="polite">
        {gone ? 'One, it turns even the most respectable men into scoundrels. Two, you drank it.' : drunk.size ? `${BOTTLES - drunk.size} left. The horizon is starting to tilt.` : 'Hidden by rum-runners, found by you. Press a bottle.'}
      </p>
      {gone && (
        <button type="button" className="btn btn-ghost btn-sm mt-auto self-start" onClick={() => setDrunk(new Set())}>
          Find the rum-runners’ cache
        </button>
      )}
    </div>
  );
}

// The jar of dirt. Each press says a little more about what's in it.
const JAR = ['Press the jar.', 'I’ve got a jar of dirt.', 'I’ve got a jar of dirt, and guess what’s inside it.', 'Something that beats. Don’t tell the captain of the Dutchman.'];

export function Jar() {
  const [step, setStep] = useState(0);
  const [shake, setShake] = useState(0);
  const press = () => {
    setShake((n) => n + 1);
    const next = Math.min(JAR.length - 1, step + 1);
    setStep(next);
    if (next === JAR.length - 1) sound('heart');
    else sound('glug');
  };
  return (
    <div className="cb-toy card">
      <button type="button" className="cb-jar" key={shake} data-shake={shake ? '' : undefined} data-beating={step === JAR.length - 1 ? '' : undefined} onClick={press} aria-label="The jar of dirt. Press it.">
        <svg viewBox="0 0 120 150" aria-hidden="true">
          <rect className="cb-jar-lid" x="34" y="8" width="52" height="16" rx="4" />
          <path className="cb-jar-glass" d="M30 26h60c6 8 12 16 12 30v70c0 9-6 14-14 14H32c-8 0-14-5-14-14V56c0-14 6-22 12-30z" />
          <path className="cb-jar-dirt" d="M22 78c14-8 26 4 40-2s24-6 36 0v48c0 7-5 12-12 12H34c-7 0-12-5-12-12z" />
          <path className="cb-jar-heart" d="M60 122c-12-8-18-14-18-21 0-5 4-9 9-9 4 0 7 2 9 5 2-3 5-5 9-5 5 0 9 4 9 9 0 7-6 13-18 21z" />
          <path className="cb-jar-shine" d="M32 40c-4 8-6 14-6 22v40" />
        </svg>
      </button>
      <h3 className="cb-toy-title">The jar of dirt</h3>
      <p className="cb-toy-line" aria-live="polite">
        {JAR[step]}
      </p>
      {step === JAR.length - 1 && (
        <button type="button" className="btn btn-ghost btn-sm mt-auto self-start" onClick={() => setStep(0)}>
          Put the lid back on
        </button>
      )}
    </div>
  );
}
