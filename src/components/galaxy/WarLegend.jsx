import { memo } from 'react';
import { RiCloseLine, RiInformationLine } from 'react-icons/ri';
import Emblem from './Emblem';
import { SIDES, WARS } from './sides';
import { whose } from './warText';

// The holotable's key to its war (WarLayers.jsx and the systems' rings),
// shut till it's asked for (HoloMap.jsx keeps whether it's open, so Escape
// can shut it): a picture of each mark in the shown war's own colours, and
// what it means, in three groups: the systems', the war's and the routes'.

// a mark's picture, 28 by 14
const Mark = ({ children }) => (
  <svg className="holomap-key-mark" viewBox="0 0 28 14" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

const WarLegend = memo(function WarLegend({ war, open = false, onToggle }) {
  const w = WARS[war];
  const lib = SIDES[w.liberator];
  const raid = SIDES[w.raider];
  // each mark and what it means, in three groups: the systems', the war's, the routes'
  const systems = [
    [
      <span key="m" className="holomap-key-here" style={{ '--held': lib.colour }} />,
      'You are here, tagged YOU',
    ],
    [
      <span key="m" className="holomap-key-dot" style={{ '--held': lib.colour }} />,
      'A system: ringed in its holder’s colour, named in its own',
    ],
    [
      <span key="m" className="holomap-key-glyphs" aria-hidden="true">
        <b className="holomap-fight">⚔</b>
      </span>,
      'A battle on now',
    ],
    [
      <span key="m" className="holomap-key-glyphs" aria-hidden="true">
        <b className="holomap-star">★</b>
      </span>,
      'The major order',
    ],
    [
      <span key="m" className="holomap-key-glyphs" aria-hidden="true">
        <span className="holomap-pilots">3</span>
      </span>,
      'Pilots online there now',
    ],
    [
      <span key="m" className="holomap-key-glyphs" aria-hidden="true">
        <i className="holomap-key-you" />
      </span>,
      'You fought there',
    ],
  ];
  const warMarks = [
    [
      <Mark key="m">
        <rect x="1" y="1" width="26" height="12" rx="2" fill={lib.colour} fillOpacity="0.24" stroke={lib.colour} strokeOpacity="0.5" />
      </Mark>,
      `Space a power holds: ${whose(w.liberator, 'the')} here (the brighter, the firmer its hold)`,
    ],
    [
      <Mark key="m">
        <defs>
          <pattern id="holomap-key-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
            <line x1="1" y1="0" x2="1" y2="4" stroke={raid.colour} strokeWidth="1.2" />
          </pattern>
        </defs>
        <rect x="1" y="1" width="26" height="12" rx="2" fill={lib.colour} fillOpacity="0.2" />
        <rect x="1" y="1" width="26" height="12" rx="2" fill="url(#holomap-key-hatch)" />
      </Mark>,
      `Fought over: hatched in the attacker’s colour (${whose(w.raider, 'the')} here)`,
    ],
    [
      <Mark key="m">
        <line x1="2" y1="7" x2="26" y2="7" stroke="#fff" strokeOpacity="0.18" strokeWidth="4" />
        <line x1="2" y1="7" x2="26" y2="7" stroke="#fff" strokeWidth="1.2" />
      </Mark>,
      'Where two powers meet (dashed and moving where they fight)',
    ],
    [
      <Mark key="m">
        <path d="M2 10 Q12 2 21 7" fill="none" stroke={raid.colour} strokeWidth="1.6" strokeDasharray="4 2.4" />
        <polygon points="26,9 19,3.6 18.4,10.4" fill={raid.colour} />
      </Mark>,
      'An offensive, flowing from where its fleets come from',
    ],
    [
      <Mark key="m">
        <path d="M2 10 Q12 2 21 7" fill="none" stroke={SIDES.hutt.colour} strokeWidth="1.8" strokeLinecap="round" strokeDasharray="0.1 3.2" />
        <polygon points="26,9 19,3.6 18.4,10.4" fill={SIDES.hutt.colour} />
      </Mark>,
      'A Hutt raid',
    ],
    [
      <Mark key="m">
        <path d="M2 10 Q12 2 21 7" fill="none" stroke={lib.colour} strokeWidth="4.4" />
        <path d="M2 10 Q12 2 21 7" fill="none" stroke="#020611" strokeWidth="2" />
        <path d="M2 10 Q12 2 21 7" fill="none" stroke={lib.colour} strokeWidth="0.8" />
        <polygon points="26,9 19,3.6 18.4,10.4" fill={lib.colour} />
      </Mark>,
      'The decisive battle, in the campaign’s Climax',
    ],
    [
      <span key="m" className="holomap-key-fleet" style={{ '--by': raid.colour }}>
        <Emblem side={w.raider} />
      </span>,
      'A fleet and its crest, closing in as its side gains',
    ],
    [
      <span key="m" className="holomap-key-ring" data-glyph="+" style={{ '--by': lib.colour, '--held': raid.colour, '--take': 0.35 }} />,
      `A front: ${whose(w.liberator, 'the')} share of the ring grows as it liberates`,
    ],
    [
      <span key="m" className="holomap-key-ring" data-glyph="−" style={{ '--by': raid.colour, '--held': lib.colour, '--take': 0.6 }} />,
      'Under attack: its holder’s share of the ring drains',
    ],
    [
      <span key="m" className="holomap-key-cut" style={{ '--held': raid.colour }} />,
      'Cut off from supply: joined to neither its capital nor a stronghold, it holds less well and doesn’t mend',
    ],
  ];
  const routes = [
    [
      <Mark key="m">
        <line x1="1" y1="3" x2="27" y2="3" stroke={lib.colour} strokeOpacity="0.55" strokeWidth="1.4" />
        <line x1="1" y1="7" x2="27" y2="7" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="2.5 2.5" />
        <line x1="1" y1="11" x2="27" y2="11" stroke="#ffb347" strokeWidth="1.4" strokeDasharray="4 2.5" />
      </Mark>,
      'The lanes the war runs along: held, contested, fought along',
    ],
    [
      <Mark key="m">
        <line x1="2" y1="7" x2="26" y2="7" stroke="#7fd6ff" strokeOpacity="0.28" strokeWidth="5" />
        <line x1="2" y1="7" x2="26" y2="7" stroke="#fff" strokeWidth="1.6" strokeDasharray="3.6 2.4" />
      </Mark>,
      'Your course: the way a jump to the system picked goes, with its length and time',
    ],
  ];
  const groups = [
    ['Systems', systems],
    ['The war', warMarks],
    ['Routes', routes],
  ];
  return (
    <div className="holomap-legend" data-open={open || undefined}>
      <button type="button" className="holomap-legend-toggle" aria-expanded={open} aria-controls="holomap-legend-panel" onClick={() => onToggle?.(!open)}>
        {open ? <RiCloseLine aria-hidden="true" /> : <RiInformationLine aria-hidden="true" />} {open ? 'Close the key' : 'Key'}
      </button>
      <div id="holomap-legend-panel" className="holomap-legend-panel" hidden={!open}>
        <p className="holomap-kicker">{w.name}</p>
        {groups.map(([name, entries]) => (
          <div key={name}>
            <h4 className="holomap-key-h">{name}</h4>
            <ul>
              {entries.map(([mark, text]) => (
                <li key={text}>
                  {mark}
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
});

export default WarLegend;
