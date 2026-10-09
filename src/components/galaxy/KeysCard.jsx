import { RiCloseLine } from 'react-icons/ri';

// The galaxy's flying keys in one small card (the guide, pages.js, has them
// all in words): until you first fly, and again from the Keys chip. A
// desktop's: a touch screen has its buttons, and flight.css hides this there.
const GROUPS = [
  ['Fly', [['W S', 'Throttle'], ['A D', 'Roll'], ['Arrows', 'Steer'], ['Space', 'Boost'], ['V', 'Cockpit']]],
  ['Fight', [['F', 'Fire (hold)'], ['T Q', 'Next, last target'], ['G', 'Crew power'], ['X', 'The big one']]],
  ['Travel', [['J', 'Jump to the star ahead, or the course'], ['M', 'Galaxy map'], ['E', 'Land']]],
];

export default function KeysCard({ open, onClose }) {
  if (!open) return null;
  return (
    <section className="galaxy-keys" aria-label="Flying keys">
      <button type="button" className="galaxy-keys-close" onClick={onClose} aria-label="Close the keys">
        <RiCloseLine aria-hidden="true" />
      </button>
      {GROUPS.map(([name, rows]) => (
        <div key={name} className="galaxy-keys-group">
          <h3>{name}</h3>
          <dl>
            {rows.map(([keys, what]) => (
              <div key={keys}>
                <dt>
                  {keys.split(' ').map((k) => (
                    <kbd key={k} className="hud-cap">
                      {k}
                    </kbd>
                  ))}
                </dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      <p className="galaxy-keys-more">
        The rest are in the guide: <kbd className="hud-cap">?</kbd>
      </p>
    </section>
  );
}
