import { useRef, useState } from 'react';
import { useFun } from '../../fun/FunProvider';
import { audioContext } from '../../lib/audio';
import { jumpTo } from '../../lib/anchors';
import Gif from '../Gif';

const sfx = () => import('../../lib/sfx');
const clip = (id) => import('../../lib/clips').then((c) => c.playClip(id));

// The Scranton branch from above, laid out as the set is: the lobby and lift,
// reception, Michael's office with the conference room beside it, the bullpen,
// accounting, then the hallway past the kitchen and the restrooms to the annex.
// `x`/`y` place each person on the 940×520 plan.
const STAFF = [
  { id: 'michael', gif: 'officeBestBoss', name: 'Michael Scott', role: 'Regional Manager', x: 269, y: 58, item: 'mug', text: 'Runs the branch like a family, a talk show and an improv class at once, from the office with the blinds he never quite closes.', action: 'Thank the room', done: 'Thank you. Thank you so much.' },
  { id: 'jim', gif: 'officeJim', name: 'Jim Halpert', role: 'Salesman', x: 295, y: 194, item: 'jello', text: 'Sits across from Dwight, which explains most of what happens to Dwight’s things.', action: 'Prank Dwight', done: 'Dwight’s stapler, in Jell-O. Again.' },
  { id: 'pam', gif: 'officePamDundie', name: 'Pam Beesly', role: 'Sales, later office administrator', x: 269, y: 258, item: 'phone', text: 'Answered the phones at reception for years, then moved to the desk beside Jim. Paints the building in her spare time.', action: 'Answer the phone', done: 'Dunder Mifflin, this is Pam.' },
  { id: 'dwight', gif: 'officeFalse', name: 'Dwight Schrute', role: 'Assistant (to the) Regional Manager', x: 331, y: 258, item: 'beet', text: 'Beet farmer, volunteer sheriff’s deputy and the branch’s top salesman, by his own count.', action: 'Fact or false?', done: '' },
  { id: 'andy', gif: 'parkour', name: 'Andy Bernard', role: 'Salesman', x: 410, y: 194, item: 'banjo', text: 'Cornell man, banjo player, and one third of the branch’s parkour team.', action: 'Parkour!', done: 'Parkour!' },
  { id: 'phyllis', name: 'Phyllis Vance', role: 'Saleswoman', x: 379, y: 258, item: 'yarn', text: 'Knits, sells, and is married to Bob Vance, of Vance Refrigeration.', action: 'Ask about Bob', done: 'Bob Vance, Vance Refrigeration.' },
  { id: 'stanley', name: 'Stanley Hudson', role: 'Salesman', x: 442, y: 258, item: 'paper', text: 'Does the crossword, keeps his head down, and lives for one day a year.', action: 'Is it Pretzel Day?', done: 'It is. Stanley is first in line.' },
  { id: 'erin', name: 'Erin Hannon', role: 'Receptionist', x: 186, y: 190, item: 'phone', text: 'Took over reception when Pam moved to sales. The first face you see off the lift.', action: 'Ring reception', done: 'Dunder Mifflin, this is Erin.' },
  { id: 'kevin', gif: 'officeChili', name: 'Kevin Malone', role: 'Accountant', x: 197, y: 331, item: 'chili', text: 'Makes one thing better than anyone: his chili. Getting it to the office is another matter.', action: 'Bring in the chili', done: 'The carpet never recovered.' },
  { id: 'angela', name: 'Angela Martin', role: 'Head of Accounting', x: 197, y: 302, item: 'cat', text: 'Runs the party planning committee and an unknown number of cats.', action: 'Meet the cats', done: 'Sprinkles, Bandit, Princess Lady, Garbage, Comstock, Lumpy, and more besides.' },
  { id: 'oscar', name: 'Oscar Martinez', role: 'Accountant', x: 252, y: 290, item: 'book', text: 'The accountant who reads, and the first to say “actually” when someone is wrong.', action: 'Ask Oscar', done: 'Actually, it’s a little more complicated than that.' },
  { id: 'creed', name: 'Creed Bratton', role: 'Quality Assurance', x: 377, y: 319, item: 'question', text: 'Nobody is entirely sure what Creed does. Possibly including Creed.', action: 'Ask what he does', done: 'Quality assurance. Probably.' },
  { id: 'meredith', name: 'Meredith Palmer', role: 'Supplier Relations', x: 307, y: 366, item: 'mug-plain', text: 'Supplier relations, and every office party’s last guest standing.', action: '', done: '' },
  { id: 'darryl', name: 'Darryl Philbin', role: 'Warehouse foreman', x: 462, y: 330, item: 'keys', text: 'Came up from the warehouse to an office of his own, glass walls and all. Plays keys.', action: '', done: '' },
  { id: 'ryan', name: 'Ryan Howard', role: 'The temp, then the closet', x: 600, y: 286, item: 'question', text: 'Started as the temp, rose, fell, and ended up in a closet between the restrooms.', action: '', done: '' },
  { id: 'toby', gif: 'officeNoGod', name: 'Toby Flenderson', role: 'Human Resources', x: 900, y: 270, item: 'binder', text: 'HR, at the far end of the annex. Michael has strong feelings about Toby.', action: 'Welcome Toby back', done: 'Michael took it well.' },
  { id: 'kelly', name: 'Kelly Kapoor', role: 'Customer Service', x: 892, y: 352, item: 'phone', text: 'Customer service in the annex, and the office’s authority on everyone’s business.', action: '', done: '' },
];

function Item({ kind, active }) {
  const S = { stroke: '#2b3340', strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' };
  switch (kind) {
    case 'mug':
      return (
        <svg viewBox="0 0 80 80" className="office-item" data-active={active || undefined}>
          <path d="M18 22 h36 v40 a6 6 0 0 1 -6 6 h-24 a6 6 0 0 1 -6 -6 Z" fill="#ffffff" {...S} />
          <path d="M54 30 h6 a8 8 0 0 1 0 16 h-6" fill="none" {...S} />
          <rect className="mug-coffee" x="20" y="24" width="32" height="6" rx="2" fill="#6b3f1d" />
          <text x="36" y="44" textAnchor="middle" fontSize="6.4" fontWeight="700" fill="#1f2937" fontFamily="var(--font-sans)">
            WORLD’S
          </text>
          <text x="36" y="52" textAnchor="middle" fontSize="6.4" fontWeight="700" fill="#1f2937" fontFamily="var(--font-sans)">
            BEST BOSS
          </text>
        </svg>
      );
    case 'beet':
      return (
        <svg viewBox="0 0 80 80" className="office-item" data-active={active || undefined}>
          <path d="M40 30 C22 30 18 52 30 62 C34 66 38 70 40 76 C42 70 46 66 50 62 C62 52 58 30 40 30 Z" fill="#8b1e3f" {...S} />
          <path d="M40 30 C34 18 26 12 20 12 C24 20 30 26 40 30 Z M40 30 C44 16 52 8 60 8 C56 18 50 26 40 30 Z" fill="#3f7d3a" {...S} />
        </svg>
      );
    case 'jello':
      return (
        <svg viewBox="0 0 80 80" className="office-item" data-active={active || undefined}>
          <g className="jello">
            <path d="M14 30 Q40 18 66 30 L62 66 Q40 74 18 66 Z" fill="#7bd36a" fillOpacity="0.75" {...S} />
            <path d="M26 46 h26 l4 -6 h-26 Z" fill="#2b3340" opacity="0.85" />
            <path d="M28 52 h28" stroke="#2b3340" strokeWidth="3" opacity="0.85" />
            <ellipse cx="30" cy="34" rx="8" ry="3" fill="#ffffff" opacity="0.45" />
          </g>
        </svg>
      );
    case 'phone':
      return (
        <svg viewBox="0 0 80 80" className="office-item" data-active={active || undefined}>
          <rect x="12" y="34" width="56" height="30" rx="6" fill="#3a4250" {...S} />
          <path className="phone-handset" d="M14 30 C14 20 66 20 66 30 L58 34 L52 28 L28 28 L22 34 Z" fill="#525c6c" {...S} />
          {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={28 + c * 9} y={40 + r * 7} width="6" height="4" rx="1" fill="#d6dbe3" />))}
        </svg>
      );
    case 'banjo':
      return (
        <svg viewBox="0 0 80 80" className="office-item" data-active={active || undefined}>
          <circle cx="30" cy="52" r="18" fill="#efe6d2" {...S} />
          <circle cx="30" cy="52" r="12" fill="none" stroke="#b08a4c" strokeWidth="2" />
          <path d="M42 40 L68 12" stroke="#7a4a22" strokeWidth="6" strokeLinecap="round" />
          <path d="M32 50 L66 14" stroke="#c9ced6" strokeWidth="1" />
        </svg>
      );
    case 'chili':
      return (
        <svg viewBox="0 0 80 80" className="office-item" data-active={active || undefined}>
          <g className="chili-pot">
            <path d="M14 34 h52 v22 a10 10 0 0 1 -10 10 h-32 a10 10 0 0 1 -10 -10 Z" fill="#9aa3ad" {...S} />
            <path d="M8 34 h64" {...S} />
            <ellipse cx="40" cy="34" rx="24" ry="5" fill="#a63a12" />
          </g>
          <ellipse className="chili-spill" cx="52" cy="72" rx="22" ry="5" fill="#a63a12" />
        </svg>
      );
    case 'cat':
      return (
        <svg viewBox="0 0 80 80" className="office-item" data-active={active || undefined}>
          <path d="M22 70 C18 50 24 36 34 32 L30 18 L40 26 L50 18 L46 32 C56 36 62 50 58 70 Z" fill="#e9e2d6" {...S} />
          <circle cx="35" cy="40" r="2" fill="#2b3340" />
          <circle cx="45" cy="40" r="2" fill="#2b3340" />
          <path d="M58 64 C70 62 72 50 66 44" fill="none" {...S} />
        </svg>
      );
    case 'paper':
      return (
        <svg viewBox="0 0 80 80" className="office-item" data-active={active || undefined}>
          <rect x="14" y="14" width="52" height="56" rx="2" fill="#f8f6f0" {...S} />
          {[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => <rect key={`${r}${c}`} x={22 + c * 8} y={24 + r * 8} width="7" height="7" fill={(r * 5 + c) % 3 === 0 ? '#2b3340' : '#ffffff'} stroke="#2b3340" strokeWidth="0.6" />))}
        </svg>
      );
    case 'binder':
      return (
        <svg viewBox="0 0 80 80" className="office-item" data-active={active || undefined}>
          <rect x="20" y="12" width="42" height="58" rx="3" fill="#2f5ea8" {...S} />
          <rect x="14" y="12" width="10" height="58" rx="2" fill="#24497f" {...S} />
          <text x="43" y="46" textAnchor="middle" fontSize="16" fontWeight="800" fill="#ffffff" fontFamily="var(--font-sans)">
            HR
          </text>
        </svg>
      );
    case 'yarn':
      return (
        <svg viewBox="0 0 80 80" className="office-item" data-active={active || undefined}>
          <circle cx="40" cy="44" r="22" fill="#d06a8f" {...S} />
          <path d="M22 36 C34 30 46 52 58 44 M20 48 C34 42 48 62 60 52 M28 26 C38 34 50 30 56 30" fill="none" stroke="#8e3a5b" strokeWidth="2" />
          <path d="M60 30 L72 14 M64 34 L74 22" stroke="#9aa3ad" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'book':
      return (
        <svg viewBox="0 0 80 80" className="office-item" data-active={active || undefined}>
          <path d="M14 20 h24 a4 4 0 0 1 4 4 v42 a4 4 0 0 0 -4 -4 h-24 Z M66 20 h-24 a4 4 0 0 0 -4 4 v42 a4 4 0 0 1 4 -4 h24 Z" fill="#f4efe4" {...S} />
          <path d="M20 30 h14 M20 38 h14 M20 46 h12 M46 30 h14 M46 38 h14 M46 46 h10" stroke="#9aa3ad" strokeWidth="2" />
        </svg>
      );
    case 'keys':
      return (
        <svg viewBox="0 0 80 80" className="office-item" data-active={active || undefined}>
          <rect x="8" y="30" width="64" height="26" rx="3" fill="#2b3340" {...S} />
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} x={12 + i * 6.6} y="34" width="5.6" height="18" rx="1" fill="#f4f6f8" />
          ))}
          {[0, 1, 3, 4, 5, 7].map((i) => (
            <rect key={i} x={15.6 + i * 6.6} y="34" width="3.6" height="11" rx="0.8" fill="#1a1d22" />
          ))}
        </svg>
      );
    case 'mug-plain':
      return (
        <svg viewBox="0 0 80 80" className="office-item" data-active={active || undefined}>
          <path d="M20 24 h34 v38 a6 6 0 0 1 -6 6 h-22 a6 6 0 0 1 -6 -6 Z" fill="#b8d4e8" {...S} />
          <path d="M54 32 h6 a8 8 0 0 1 0 16 h-6" fill="none" {...S} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 80 80" className="office-item" data-active={active || undefined}>
          <circle cx="40" cy="40" r="26" fill="#f1ede4" {...S} />
          <text x="40" y="52" textAnchor="middle" fontSize="34" fontWeight="800" fill="#2b3340" fontFamily="var(--font-sans)">
            ?
          </text>
        </svg>
      );
  }
}

// The Scranton branch, from above: walls, rooms and desks on a 940×520 plan.
function Plan() {
  const desk = (x, y, w, h) => <rect x={x} y={y} width={w} height={h} rx="2" className="of-desk" />;
  return (
    <svg viewBox="0 0 940 520" className="block h-auto w-full" aria-hidden="true">
      {/* floor: the office proper, the supply room below accounting, and the annex wing */}
      <path d="M142 12 H926 V376 H670 V440 H586 V376 H298 V403 H161 V238 H142 Z" className="of-floor" />
      <rect x="161" y="403" width="137" height="106" className="of-floor of-floor-alt" />
      {/* the lobby and the lift, outside the office */}
      <rect x="14" y="14" width="128" height="75" className="of-outside" />
      <rect x="48" y="89" width="91" height="50" className="of-lift" />
      <path d="M52 93 L135 135 M135 93 L52 135" className="of-lift-x" />
      {/* walls */}
      <path d="M142 12 H926 V376 H670 V440 H586 V376 H298 V403 M161 403 V509 H298 V403 M161 403 V238 H142 V12" className="of-wall" />
      <path d="M206 12 V127 H514 V12 M324 12 V127 M514 12 V376 M552 12 V175 M514 175 H739 M514 252 H739 M628 252 V376 M739 12 V376 M806 12 V141 H926 M406 288 V376 M161 384 H298" className="of-wall of-wall-in" />
      <path d="M206 127 H324 M326 127 H514 M406 288 H514" className="of-glass" />
      <path d="M566 252 V300 H628" className="of-wall of-wall-in" />
      {/* doors: in from the lobby, into the hallway, into the annex */}
      <path d="M142 40 V70 M514 200 V228 M739 200 V228 M300 127 V127" className="of-door" />
      {/* labels */}
      <text x="22" y="36" className="of-label">LOBBY</text>
      <text x="56" y="128" className="of-label">LIFT</text>
      <text x="214" y="30" className="of-label">MICHAEL</text>
      <text x="334" y="30" className="of-label">CONFERENCE ROOM</text>
      <text x="560" y="30" className="of-label">STAIRS</text>
      <text x="522" y="192" className="of-label">KITCHEN</text>
      <text x="522" y="368" className="of-label">MEN</text>
      <text x="636" y="368" className="of-label">WOMEN</text>
      <text x="748" y="30" className="of-label">ANNEX</text>
      <text x="814" y="30" className="of-label">BREAK ROOM</text>
      <text x="166" y="170" className="of-label">RECEPTION</text>
      <text x="166" y="376" className="of-label">ACCOUNTING</text>
      <text x="414" y="306" className="of-label">DARRYL</text>
      <text x="166" y="424" className="of-label">SUPPLIES</text>
      {/* furniture */}
      <rect x="352" y="48" width="118" height="38" rx="3" className="of-desk" />
      <rect x="242" y="44" width="56" height="24" rx="2" className="of-desk" />
      <path d="M162 178 h52 v42 h-14 v-28 h-38 Z" className="of-desk" />
      {desk(269, 181, 53, 24)}
      {desk(269, 206, 26, 55)}
      {desk(296, 206, 26, 55)}
      {desk(382, 181, 53, 24)}
      {desk(382, 206, 26, 55)}
      {desk(409, 206, 26, 55)}
      {desk(167, 290, 54, 26)}
      {desk(167, 317, 54, 26)}
      {desk(222, 284, 26, 59)}
      {desk(312, 316, 27, 55)}
      {desk(340, 316, 27, 55)}
      {desk(436, 322, 56, 24)}
      {desk(580, 276, 32, 20)}
      <circle cx="677" cy="206" r="16" className="of-desk" />
      <rect x="520" y="180" width="58" height="12" className="of-desk" />
      <rect x="806" y="140" width="56" height="26" rx="2" className="of-desk" />
      <rect x="806" y="186" width="27" height="68" rx="2" className="of-desk" />
      <rect x="896" y="244" width="26" height="54" rx="2" className="of-desk" />
      <rect x="870" y="340" width="52" height="24" rx="2" className="of-desk" />
      {[[842, 44], [866, 70], [842, 96]].map(([x, y]) => (
        <circle key={x + y} cx={x} cy={y} r="10" className="of-desk" />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M${560 + i * 0} ${30 + i * 22} H730`} className="of-stair" />
      ))}
    </svg>
  );
}

export default function OfficeFloor({ say = (t) => t }) {
  const { parkour } = useFun();
  const [sel, setSel] = useState('michael');
  const [done, setDone] = useState(null);
  const panel = useRef(null);
  const p = STAFF.find((s) => s.id === sel);

  const visit = (id) => {
    setSel(id);
    setDone(null);
    if (window.matchMedia?.('(max-width: 1023px)').matches) panel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const act = () => {
    audioContext(); // in the click, so the moment can be heard
    if (sel === 'dwight') return jumpTo(null, 'facts-title');
    if (sel === 'michael') clip('thankYou');
    if (sel === 'toby') clip('noGod');
    if (sel === 'andy') parkour();
    if (sel === 'pam' || sel === 'erin') sfx().then((s) => s.ring());
    if (sel === 'jim' || sel === 'kevin') sfx().then((s) => s.knock());
    setDone(Date.now());
    return undefined;
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:gap-12">
      <div className="office-plan">
        <Plan />
        {STAFF.map((s) => (
          <button
            key={s.id}
            type="button"
            className="office-mark"
            style={{ left: `${(s.x / 940) * 100}%`, top: `${(s.y / 520) * 100}%` }}
            aria-pressed={sel === s.id}
            aria-label={`${s.name}, ${s.role}`}
            onClick={() => visit(s.id)}
          >
            {s.name
              .split(' ')
              .map((w) => w[0])
              .join('')}
          </button>
        ))}
      </div>
      <div ref={panel} className="office-panel card scroll-mt-28" aria-live="polite">
        {p.gif ? (
          <div className="office-gif">
            <Gif key={p.gif} name={p.gif} size="medium" eager />
            <span className="office-gif-item" aria-hidden="true">
              <Item kind={p.item} active={Boolean(done)} key={`${p.id}-${done}`} />
            </span>
          </div>
        ) : (
          <Item kind={p.item} active={Boolean(done)} key={`${p.id}-${done}`} />
        )}
        <h3 className="stretch-semi mt-4 text-xl font-semibold text-ink">{p.name}</h3>
        <p className="text-sm text-muted">{p.role}</p>
        <p className="mt-3 leading-relaxed text-body">{say(p.text)}</p>
        {p.action && (
          <button type="button" className="btn btn-primary btn-sm mt-5" onClick={act}>
            {p.action}
          </button>
        )}
        <p className="mt-3 min-h-[1.5em] text-sm font-semibold text-ink">{done ? p.done : ''}</p>
      </div>
    </div>
  );
}
