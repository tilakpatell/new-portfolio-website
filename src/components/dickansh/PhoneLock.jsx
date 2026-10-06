import { useEffect, useRef, useState } from 'react';
import { RiCloseLine, RiLock2Fill } from 'react-icons/ri';
import SEALED from './sealed.json';
import { unseal } from './seal';
import './phone.css';

// The way in: a Google Pixel in a clear case gone yellow with age, which
// says SAMSUNG gAlaxy on it all the same, its lock screen asking for the
// password. The right one opens the sealed exhibits (./seal.js) and hands
// them on: onOpen(museum, password). It's the overlay over the universe's
// phone, and the page at /dickansh for anyone who comes straight there.
// `onClose` (the overlay's): a close button, and Escape.

const two = (n) => String(n).padStart(2, '0');

export function Galaxy({ className = '' }) {
  return (
    <span className={`ph-brand ${className}`} aria-label="Samsung Galaxy">
      <span className="ph-samsung" aria-hidden="true">
        SAMSUNG
      </span>
      <span className="ph-galaxy" aria-hidden="true">
        g<span className="ph-a">A</span>laxy
      </span>
    </span>
  );
}

export default function PhoneLock({ onOpen, onClose = null, autoFocus = true }) {
  const [value, setValue] = useState('');
  const [state, setState] = useState('idle'); // idle | checking | wrong | open
  const [now, setNow] = useState(() => new Date());
  const input = useRef(null);
  const live = useRef(true); // (put down while it was checking: say nothing)
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (autoFocus) input.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  useEffect(() => {
    if (!onClose) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!value.trim() || state === 'checking' || state === 'open') return;
    setState('checking');
    const museum = await unseal(SEALED, value);
    if (!live.current) return;
    if (museum) {
      setState('open');
      onOpen(museum, value);
    } else {
      setState('wrong');
      input.current?.select();
    }
  };

  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <div className="ph-phone" data-state={state}>
      {onClose && (
        <button type="button" className="ph-close" aria-label="Put the phone down" onClick={onClose}>
          <RiCloseLine aria-hidden="true" />
        </button>
      )}
      <div className="ph-case">
        <div className="ph-body">
          <div className="ph-screen">
            <div className="ph-status" aria-hidden="true">
              <span>
                {two(now.getHours())}:{two(now.getMinutes())}
              </span>
              <span className="ph-punch" />
              <span className="ph-icons">5G ▮▮▮ 12%</span>
            </div>
            <div className="ph-clock" aria-hidden="true">
              {two(now.getHours())}
              <br />
              {two(now.getMinutes())}
            </div>
            <p className="ph-date" aria-hidden="true">
              {date}
            </p>
            <Galaxy className="ph-brand-screen" />
            <form className="ph-form" onSubmit={submit}>
              <RiLock2Fill className="ph-lock" aria-hidden="true" />
              <label className="ph-label" htmlFor="ph-pass">
                Enter password
              </label>
              <input
                id="ph-pass"
                ref={input}
                className="ph-input"
                type="password"
                autoComplete="off"
                spellCheck="false"
                enterKeyHint="go"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (state === 'wrong') setState('idle');
                }}
                aria-invalid={state === 'wrong' || undefined}
                aria-describedby="ph-note"
              />
              <p id="ph-note" className="ph-note" role="status">
                {state === 'wrong' ? 'Wrong password. Try again.' : state === 'checking' ? 'Checking…' : state === 'open' ? 'Unlocked' : ' '}
              </p>
              <button type="submit" className="ph-unlock" disabled={state === 'checking' || state === 'open'}>
                Unlock
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
