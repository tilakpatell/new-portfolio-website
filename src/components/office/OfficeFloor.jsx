import { useRef, useState } from 'react';
import { useFun } from '../../fun/FunProvider';
import { audioContext } from '../../lib/audio';
import { jumpTo } from '../../lib/anchors';
import { use3D } from '../../lib/gpu';
import { useMediaQuery } from '../../lib/hooks';
import { sayVoiced } from '../../lib/voiced';
import Gif from '../Gif';
import OfficeTour3D from './OfficeTour3D';
import './office.css';
import { DOORS, FLOOR, GLASS, LABELS, LIFT, LOBBY, STAFF, SUPPLIES, WALLS_INNER, WALLS_INNER_2, WALLS_OUTER } from './layout';
import '../../styles/lazy/office.css';

const sfx = () => import('../../lib/sfx');
const clip = (id) => import('../../lib/clips').then((c) => c.playClip(id));

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
      <path d={FLOOR} className="of-floor" />
      <rect x={SUPPLIES.x} y={SUPPLIES.y} width={SUPPLIES.w} height={SUPPLIES.h} className="of-floor of-floor-alt" />
      {/* the lobby and the lift, outside the office */}
      <rect x={LOBBY.x} y={LOBBY.y} width={LOBBY.w} height={LOBBY.h} className="of-outside" />
      <rect x={LIFT.x} y={LIFT.y} width={LIFT.w} height={LIFT.h} className="of-lift" />
      <path d="M52 93 L135 135 M135 93 L52 135" className="of-lift-x" />
      {/* walls */}
      <path d={WALLS_OUTER} className="of-wall" />
      <path d={WALLS_INNER} className="of-wall of-wall-in" />
      <path d={GLASS} className="of-glass" />
      <path d={WALLS_INNER_2} className="of-wall of-wall-in" />
      {/* doors: in from the lobby, into the hallway, into the annex */}
      <path d={DOORS} className="of-door" />
      {/* labels */}
      {LABELS.map(([t, x, y]) => (
        <text key={t} x={x} y={y} className="of-label">
          {t}
        </text>
      ))}
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
  const phone = useMediaQuery('(max-width: 639px)');
  const [sel, setSel] = useState('michael');
  const [done, setDone] = useState(null);
  const panel = useRef(null);
  const toby = useRef(0); // which of Michael's two lines Toby gets
  const p = STAFF.find((s) => s.id === sel);
  // the office in 3D where there's a graphics chip for it; this map otherwise
  const three = use3D();
  const [gl, setGl] = useState('off'); // loading | on | failed | lost
  const gave = gl === 'failed' || gl === 'lost';
  // 3D first: on wherever WebGL works, unless the visitor turned it off
  const in3D = three.on && !gave;

  const visit = (id) => {
    setSel(id);
    setDone(null);
    if (window.matchMedia?.('(max-width: 1023px)').matches) panel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const act = () => {
    audioContext(); // in the click, so the moment can be heard
    if (sel === 'dwight') return jumpTo(null, 'facts-title');
    if (sel === 'michael') clip('thankYou');
    if (sel === 'toby') clip(toby.current++ % 2 ? 'noGod' : 'whyAreYou'); // Michael, both ways
    if (sel === 'andy') parkour();
    if (sel === 'pam' || sel === 'erin') sfx().then((s) => s.ring());
    if (sel === 'jim') clip('dwightPunish').then((h) => h || sfx().then((s) => s.knock())); // Dwight finds the Jell-O
    if (sel === 'kevin') clip('undercookOnions').then((h) => h || sfx().then((s) => s.knock()));
    if (p.said) sayVoiced(p.id, p.done); // what they say, in their own voice where it's been made (lib/voiced.js)
    setDone(Date.now());
    return undefined;
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:gap-12">
      <div className="self-start">
        {in3D ? (
          <OfficeTour3D sel={sel} onPick={visit} onState={setGl} />
        ) : (
        <div className="office-plan">
          <Plan />
          {STAFF.map((s) => (
            <button
              key={s.id}
              type="button"
              className="office-mark"
              style={{ left: `${(s.x / 940) * 100}%`, top: `${(s.y / 520) * 100}%` }}
              aria-pressed={sel === s.id}
              // (named first with the initials it shows, for voice control)
              aria-label={`${s.name.split(' ').map((w) => w[0]).join('')}, ${s.name}, ${s.role}`}
              // on a phone the desks are too close to tap: the names below do it
              aria-hidden={phone || undefined}
              tabIndex={phone ? -1 : undefined}
              onClick={() => visit(s.id)}
            >
              {s.name
                .split(' ')
                .map((w) => w[0])
                .join('')}
            </button>
          ))}
        </div>
        )}
        <div className="office3d-note">
          {three.can ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-pressed={in3D}
              onClick={() => {
                setGl('off');
                three.set(in3D ? 'off' : 'on');
              }}
            >
              3D office: {in3D ? 'on' : 'off'}
            </button>
          ) : null}
          {gl === 'lost' && <span>The graphics chip let go, so this is the map.</span>}
          {gl === 'failed' && <span>3D couldn’t start here, so this is the map.</span>}
          {in3D && gl === 'on' && <span>Drag to look round. Pick anyone to go to their desk.</span>}
        </div>
        {phone && (
          <ul className="office-roll mt-4" aria-label="Who sits where">
            {STAFF.map((s) => (
              <li key={s.id}>
                <button type="button" aria-pressed={sel === s.id} aria-label={`${s.name}, ${s.role}`} onClick={() => visit(s.id)}>
                  {s.name.split(' ')[0]}
                </button>
              </li>
            ))}
          </ul>
        )}
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
