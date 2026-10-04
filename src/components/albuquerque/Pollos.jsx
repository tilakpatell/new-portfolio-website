import { useState } from 'react';
import { audioContext } from '../../lib/audio';
import Gif from '../Gif';

// The counter at Los Pollos Hermanos: order, and the tray fills up.
const MENU = [
  ['Pollo clásico', '8 pieces'],
  ['Pollo picante', 'with the house spice'],
  ['Spice curls', 'the house recommends'],
  ['Sweet tea', 'Mike’s order'],
];

export default function Pollos() {
  const [tray, setTray] = useState([]);
  const order = (i) => {
    audioContext(); // in the click, so the bell can be heard
    import('../../lib/sfx').then((s) => s.ding());
    setTray((t) => (t.includes(i) ? t : [...t, i]));
  };
  return (
    <div className="pollos card">
      <div className="pollos-inside">
        <Gif name="bcsSpiceCurls" size="medium" />
      </div>
      <div className="pollos-board mt-4">
        <p className="pollos-name">Los Pollos Hermanos</p>
        <p className="pollos-sub">Albuquerque, New Mexico</p>
        <ul className="mt-4 grid gap-2">
          {MENU.map(([item, note], i) => (
            <li key={item}>
              <button type="button" className="pollos-item" aria-pressed={tray.includes(i)} onClick={() => order(i)}>
                <span>{item}</span>
                <span className="pollos-note">{note}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 min-h-[1.5em] text-sm text-body" aria-live="polite">
        {tray.length === MENU.length ? 'The manager brings it out himself, and thanks you for your business.' : tray.length ? `${tray.length} on the tray.` : 'Order at the counter.'}
      </p>
    </div>
  );
}
