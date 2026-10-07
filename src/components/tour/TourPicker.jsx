import { useEffect, useRef } from 'react';
import { RiCompass3Line } from 'react-icons/ri';
import './offer.css';

// Which tour: the card on a first arrival (in place of the old "Take the
// tour"), and what ⌘K's, the guide's and the terminal's "tour" open when
// they don't say. One button per tour across pages (scripts/index's MODES),
// the shell's minute-long look round, and, with a tour part way through
// from earlier (tp-tour-run), picking it up where it left off. `first` is
// the arrival's: it says hello and offers "Not now".
export default function TourPicker({ modes, resume = null, first = false, onPick, onResume, onClose }) {
  const box = useRef(null);
  useEffect(() => {
    if (first) return undefined;
    box.current?.querySelector('button')?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [first, onClose]);

  return (
    <div ref={box} className="tour-offer tour-picker card" role={first ? 'status' : 'dialog'} aria-label={first ? undefined : 'Take a tour'}>
      <RiCompass3Line className="tour-offer-icon" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="tour-offer-title">{first ? 'New here?' : 'Take a tour'}</p>
        <p className="tour-offer-text">{first ? 'A tour of the part you came for, a stop at a time.' : 'A stop at a time, across the pages; Esc ends it whenever you like.'}</p>
        <ul className="tour-picker-list">
          {resume && (
            <li>
              <button type="button" className="tour-picker-choice" onClick={onResume}>
                <span className="tour-picker-name">Pick up where you left off</span>
                <span className="tour-picker-hint">{resume.title}, stop {resume.stop + 1}</span>
              </button>
            </li>
          )}
          {modes.map((m) => (
            <li key={m.id}>
              <button type="button" className="tour-picker-choice" onClick={() => onPick(m.id)}>
                <span className="tour-picker-name">{m.title}</span>
                <span className="tour-picker-hint">{m.text}</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="tour-picker-choice" onClick={() => onPick(null)}>
              <span className="tour-picker-name">Just the site</span>
              <span className="tour-picker-hint">Where everything is, in under a minute.</span>
            </button>
          </li>
        </ul>
        <div className="tour-offer-buttons">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {first ? 'Not now' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
