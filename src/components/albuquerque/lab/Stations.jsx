import { useMemo, useRef, useState } from 'react';
import { useFrameLoop } from '../../../lib/hooks';
import { LAB, bandAt, cookSeconds, cracksFor, strikeWindow } from '../lab';
import { buzz, holdProps, useKeys } from './keys';

// The four stations an order goes through. Each takes the order and calls
// `onDone` once with what was made; the lab scores it. Space works the main
// control (hold or strike), Enter moves on where there's a choice.

const sfx = () => import('../../../lib/sfx');
const mix = (a, b, k) => {
  const pa = a.match(/\w\w/g).map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g).map((h) => parseInt(h, 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(',')})`;
};
const shade = (blue) => mix('d8e6ea', '15629f', Math.max(0, Math.min(1, blue)));

// A short word over the station: how that went.
function Callout({ text, tone }) {
  if (!text) return null;
  return (
    <span key={text + tone} className="lab-callout" data-tone={tone}>
      {text}
    </span>
  );
}

// ─── Mix: pour the base to the line, tint it, Chili P or not ────────────────
export function MixStation({ order, upgrades, onDone, active }) {
  const [base, setBase] = useState(0);
  const [blue, setBlue] = useState(0);
  const [chili, setChili] = useState(0);
  const [pour, setPour] = useState(null); // 'base' | 'blue' | null
  const done = useRef(false);
  const target = LAB.baseFor(order.trays);
  const tint = LAB.tints[order.tint];

  useFrameLoop((dt) => {
    const s = dt / 1000;
    if (pour === 'base') setBase((b) => Math.min(1, b + LAB.pourRate * s));
    if (pour === 'blue') setBlue((b) => Math.min(1, b + LAB.tintRate * s));
  }, active && !!pour);

  const finish = () => {
    if (done.current || base < 0.05) return;
    done.current = true;
    setPour(null);
    onDone({ base, blue, chili });
  };
  const shake = () => {
    setChili((n) => Math.min(5, n + 1));
    sfx().then((x) => x.knock(undefined, undefined, 0.05));
    buzz(15);
  };
  const reset = () => {
    setBase(0);
    setBlue(0);
    setChili(0);
  };
  useKeys(
    active,
    (k, e) => {
      if (k === ' ' || k === '1') {
        if (!e.repeat) setPour('base');
        return true;
      }
      if (k === '2' || k === 'b') {
        if (!e.repeat) setPour('blue');
        return true;
      }
      if (k === '3' || k === 'c') {
        if (!e.repeat) shake();
        return true;
      }
      if (k === 'Enter') {
        finish();
        return true;
      }
      return false;
    },
    (k) => {
      if (k === ' ' || k === '1' || k === '2' || k === 'b' || k === 'blur') {
        setPour(null);
        return k !== 'blur';
      }
      return false;
    },
  );

  const H = 150;
  const top = 30 + H * (1 - base);
  // Gale's notes light the line when the pour is on it
  const near = upgrades.includes('notes') && Math.abs(base - target) < 0.03;
  return (
    <div className="lab-station lab-mix">
      <svg viewBox="0 0 320 220" className="lab-art" aria-hidden="true">
        {/* two drums on the shelf, and the flask */}
        <g transform="translate(18 40)">
          <rect width="54" height="80" rx="6" fill="#c9cdd1" stroke="#6b7177" strokeWidth="2" />
          <text x="27" y="44" textAnchor="middle" className="lab-drum-label">BASE</text>
          <rect y="90" width="54" height="80" rx="6" fill="#4fb8ea" stroke="#1d5f86" strokeWidth="2" />
          <text x="27" y="134" textAnchor="middle" className="lab-drum-label lab-drum-label-light">BLUE</text>
          {pour === 'base' && <path d="M54 20 Q90 10 112 40" stroke="#e8ecef" strokeWidth="4" fill="none" className="lab-stream" />}
          {pour === 'blue' && <path d="M54 110 Q96 60 112 40" stroke="#4fb8ea" strokeWidth="4" fill="none" className="lab-stream" />}
        </g>
        <g transform="translate(130 0)">
          <clipPath id="lab-flask">
            <path d="M40 30 h60 v40 l40 120 q4 14 -10 14 h-120 q-14 0 -10 -14 l40 -120 Z" />
          </clipPath>
          <g clipPath="url(#lab-flask)">
            <rect x="-20" y={top} width="200" height={H + 40} fill={shade(blue)} style={{ transition: 'fill 0.15s linear' }} />
            {Array.from({ length: chili }, (_, i) => (
              <circle key={i} cx={52 + i * 9} cy={top + 6 + (i % 2) * 4} r="2.4" fill="#d2381e" />
            ))}
          </g>
          <path d="M40 30 h60 v40 l40 120 q4 14 -10 14 h-120 q-14 0 -10 -14 l40 -120 Z" fill="none" stroke="#e8ecef" strokeWidth="3" />
          {/* the fill line for this order */}
          <path d={`M-6 ${30 + H * (1 - target)} h152`} stroke={near ? '#7ef0a0' : '#f2c318'} strokeWidth="2" strokeDasharray="6 4" />
          <text x="150" y={34 + H * (1 - target)} className="lab-small" fill={near ? '#7ef0a0' : '#f2c318'}>
            {order.trays} {order.trays === 1 ? 'tray' : 'trays'}
          </text>
        </g>
      </svg>
      {/* the shade: where it is, where it should be */}
      <div className="lab-shade" aria-hidden="true">
        <span className="lab-shade-target" style={{ left: `${tint.level * 100}%` }} />
        <span className="lab-shade-now" style={{ left: `${blue * 100}%` }} />
      </div>
      <p className="lab-hint">
        Fill to the line, then tint to <b>{tint.label.toLowerCase()}</b>. {order.chili ? 'Chili P, they asked for it.' : 'No Chili P.'}
      </p>
      <div className="lab-controls">
        <button type="button" className="btn btn-primary hold-btn" aria-pressed={pour === 'base'} {...holdProps((on) => setPour(on ? 'base' : null))}>
          Pour base <kbd>1</kbd>
        </button>
        <button type="button" className="btn btn-primary hold-btn" aria-pressed={pour === 'blue'} {...holdProps((on) => setPour(on ? 'blue' : null))}>
          Add blue <kbd>2</kbd>
        </button>
        <button type="button" className="btn btn-ghost" onClick={shake}>
          Chili P <kbd>3</kbd>
        </button>
        <button type="button" className="btn btn-ghost" onClick={reset} disabled={!base && !blue && !chili}>
          Dump it
        </button>
        <button type="button" className="btn btn-primary" onClick={finish} disabled={base < 0.05}>
          To the cook <kbd>Enter</kbd>
        </button>
      </div>
    </div>
  );
}

// ─── Cook: hold to heat, keep the needle in the green ───────────────────────
const KICKS = [
  [0.14, 'The burner flares.'],
  [0.12, 'Jesse knocks the regulator.'],
  [-0.12, 'A draft from the loading door.'],
  [-0.14, 'The coolant kicks in.'],
];
const WARM = 4; // seconds to bring it up before being cold starts to cost

export function CookStation({ order, upgrades, onDone, active }) {
  const need = cookSeconds(order.trays, upgrades);
  const s = useRef({ heat: 0.3, on: false, t: 0, good: 0, wob: Math.random() * 10, started: false, purity: LAB.topPurity, kick: 2.2 + Math.random(), drift: 0, driftLeft: 0 });
  const [view, setView] = useState({ heat: 0.3, good: 0, purity: LAB.topPurity, inBand: false, band: bandAt(0, upgrades), event: '', started: false });
  const done = useRef(false);
  const hold = (on) => {
    s.current.on = on;
  };

  useFrameLoop((ms) => {
    const st = s.current;
    if (done.current) return;
    const dt = ms / 1000;
    st.wob += dt;
    st.t += dt;
    let event = view.event;
    if (st.started) {
      st.kick -= dt;
      if (st.kick <= 0) {
        const [push, what] = KICKS[Math.floor(Math.random() * KICKS.length)];
        st.drift = push;
        st.driftLeft = 1.1 + Math.random() * 0.6;
        st.kick = 2.6 + Math.random() * 1.8;
        event = what;
      }
      if (st.driftLeft > 0) {
        st.driftLeft -= dt;
        if (st.driftLeft <= 0) {
          st.drift = 0;
          event = '';
        }
      }
    }
    st.heat += ((st.on ? 0.34 : -0.2) + st.drift) * dt + Math.sin(st.wob * 3.1) * 0.05 * dt;
    st.heat = Math.max(0, Math.min(1, st.heat));
    const band = bandAt(st.good / need, upgrades);
    const good = st.heat >= band[0] && st.heat <= band[1];
    if (good) st.started = true;
    if (st.started || st.t > WARM) {
      if (good) st.good += dt;
      else {
        const off = st.heat < band[0] ? band[0] - st.heat : st.heat - band[1];
        st.purity = Math.max(0, st.purity - dt * (0.5 + 20 * off));
      }
    }
    setView({ heat: st.heat, good: st.good, purity: st.purity, inBand: good, band, event, started: st.started });
    if (st.good >= need) {
      done.current = true;
      st.on = false;
      onDone(Math.round(st.purity * 10) / 10);
    }
  }, active);

  useKeys(
    active,
    (k) => {
      if (k === ' ') {
        hold(true);
        return true;
      }
      return false;
    },
    (k) => {
      if (k === ' ' || k === 'blur') {
        hold(false);
        return k === ' ';
      }
      return false;
    },
  );

  const angle = -120 + view.heat * 240;
  const arc = (v) => {
    const a = ((-120 + v * 240 - 90) * Math.PI) / 180;
    return `${(Math.cos(a) * 62).toFixed(2)} ${(Math.sin(a) * 62).toFixed(2)}`;
  };
  const k = Math.min(1, view.good / need);
  const status = !view.started ? 'Bring it up to temperature.' : `${view.inBand ? 'Steady.' : view.heat > view.band[1] ? 'Too hot.' : 'Too cold.'}${view.event ? ` ${view.event}` : ''}`;
  return (
    <div className="lab-station lab-cook" data-in={view.inBand || undefined}>
      <svg viewBox="0 0 320 200" className="lab-art" aria-hidden="true" {...holdProps(hold)}>
        <g transform="translate(110 108)">
          <circle r="78" fill="#0f1416" stroke="#8a949a" strokeWidth="5" />
          <path d={`M${arc(0)} A62 62 0 1 1 ${arc(1)}`} stroke="#2a3236" strokeWidth="12" fill="none" />
          <path d={`M${arc(view.band[0])} A62 62 0 0 1 ${arc(view.band[1])}`} stroke="#3fae5c" strokeWidth="12" fill="none" />
          <path d="M0 0 L0 -60" stroke="#ff5b4a" strokeWidth="4" strokeLinecap="round" style={{ transform: `rotate(${angle}deg)` }} />
          <circle r="7" fill="#e8ecef" />
          <text y="44" textAnchor="middle" className="lab-small" fill="#9aa4ab">
            TEMP
          </text>
        </g>
        {/* the batch, filling its trays as the cook goes on */}
        <g transform="translate(212 50)">
          {Array.from({ length: order.trays }, (_, i) => (
            <g key={i} transform={`translate(0 ${i * 40})`}>
              <rect width="92" height="26" rx="3" fill="#2e3538" stroke="#5b646a" strokeWidth="2" />
              <rect x="3" y="3" height="20" width={Math.max(0, Math.min(1, k * order.trays - i)) * 86} fill={LAB.tints[order.tint].color} opacity="0.85" />
            </g>
          ))}
        </g>
      </svg>
      <p className="lab-hint" role="status">
        {status}
      </p>
      <div className="lab-controls">
        <button type="button" className="btn btn-primary hold-btn" {...holdProps(hold)}>
          Hold to heat <kbd>Space</kbd>
        </button>
        <span className="lab-readout">
          Purity {view.purity.toFixed(1)}% · wanted {order.purity}%+ · cook {Math.round(k * 100)}%
        </span>
      </div>
    </div>
  );
}

// ─── Break: strike the slab on its crack lines ──────────────────────────────
export function BreakStation({ order, upgrades, onDone, active }) {
  const cracks = useMemo(() => cracksFor(order.cut), [order]);
  const window_ = strikeWindow(upgrades);
  const [x, setX] = useState(0);
  const dir = useRef(1);
  const [broken, setBroken] = useState(() => cracks.map(() => null)); // accuracy, once struck
  const [call, setCall] = useState({ text: '', tone: '' });
  const done = useRef(false);
  const swings = useRef(0);
  const maxSwings = cracks.length + 3;
  const pos = useRef(0);

  useFrameLoop((ms) => {
    let p = pos.current + dir.current * LAB.sweepRate * (ms / 1000);
    if (p > 1) {
      p = 2 - p;
      dir.current = -1;
    } else if (p < 0) {
      p = -p;
      dir.current = 1;
    }
    pos.current = p;
    setX(p);
  }, active && !done.current);

  const finish = (hits, w) => {
    if (done.current) return;
    done.current = true;
    setTimeout(() => onDone({ hits, cracks: cracks.length, wild: w }), 650);
  };

  const brokenRef = useRef(broken);
  const wildRef = useRef(0);
  const strike = () => {
    if (done.current) return;
    swings.current += 1;
    const p = pos.current;
    const now = brokenRef.current;
    let best = -1;
    let d = Infinity;
    cracks.forEach((c, i) => {
      if (now[i] == null && Math.abs(c - p) < d) {
        d = Math.abs(c - p);
        best = i;
      }
    });
    let next = now;
    let w = wildRef.current;
    if (best >= 0 && d <= window_) {
      const acc = Math.round((1 - (d / window_) * 0.6) * 100) / 100;
      next = now.map((b, i) => (i === best ? acc : b));
      brokenRef.current = next;
      setBroken(next);
      setCall(acc > 0.9 ? { text: 'Clean!', tone: 'great' } : acc > 0.7 ? { text: 'Good', tone: 'good' } : { text: 'Close', tone: 'okay' });
      sfx().then((s) => s.clang(undefined, undefined, 0));
      buzz(acc > 0.9 ? 30 : 15);
    } else {
      w += 1;
      wildRef.current = w;
      setCall({ text: 'Miss', tone: 'bad' });
      sfx().then((s) => s.knock());
    }
    const left = next.filter((b) => b == null).length;
    if (!left || swings.current >= maxSwings) finish(next.filter((b) => b != null), w);
  };

  useKeys(active, (k, e) => {
    if (k === ' ' || k === 'Enter') {
      if (!e.repeat) strike();
      return true;
    }
    return false;
  });

  const L = 20;
  const Wd = 280;
  return (
    <div className="lab-station lab-break">
      <svg viewBox="0 0 320 170" className="lab-art lab-tap" aria-hidden="true" onPointerDown={(e) => (e.preventDefault(), strike())}>
        <rect x={L - 8} y="58" width={Wd + 16} height="86" rx="6" fill="#3a4246" stroke="#5b646a" strokeWidth="3" />
        <rect x={L} y="66" width={Wd} height="70" rx="3" fill={LAB.tints[order.tint].color} opacity="0.9" />
        <rect x={L} y="66" width={Wd} height="10" fill="#ffffff" opacity="0.25" />
        {cracks.map((c, i) => {
          const cx = L + c * Wd;
          return broken[i] == null ? (
            <path key={i} d={`M${cx} 66 v70`} stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2" strokeDasharray="4 5" />
          ) : (
            <path key={i} d={`M${cx} 66 l-5 14 l7 12 l-6 14 l5 14 l-3 16`} stroke="#0c2f45" strokeWidth="3" fill="none" />
          );
        })}
        {/* the hammer's head, sweeping over the slab */}
        <g transform={`translate(${L + x * Wd} 0)`}>
          <rect x="-16" y="12" width="32" height="18" rx="3" fill="#8d959c" stroke="#3a4148" strokeWidth="2" />
          <rect x="-3" y="30" width="6" height="22" fill="#6b4a32" />
          <path d="M0 54 l-6 -8 h12 Z" fill="#f2c318" />
        </g>
      </svg>
      <Callout {...call} />
      <p className="lab-hint">
        {LAB.cuts[order.cut].label}: strike when the hammer is over a line. {cracks.length - broken.filter((b) => b != null).length} to go, {Math.max(0, maxSwings - swings.current)} swings left.
      </p>
      <div className="lab-controls">
        <button type="button" className="btn btn-primary" onClick={strike}>
          Strike <kbd>Space</kbd>
        </button>
      </div>
    </div>
  );
}

// ─── Bag: fill each bag to the mark on the scale ────────────────────────────
export function BagStation({ order, upgrades, onDone, active }) {
  const target = LAB.packs[order.pack].weight;
  const [w, setW] = useState(0);
  const [bags, setBags] = useState([]);
  const [filling, setFilling] = useState(false);
  const [call, setCall] = useState({ text: '', tone: '' });
  const done = useRef(false);
  const wRef = useRef(0);

  useFrameLoop((ms) => {
    wRef.current = Math.min(1, wRef.current + LAB.fillRate * (ms / 1000));
    setW(wRef.current);
  }, active && filling);

  const fillingRef = useRef(false);
  const bagsRef = useRef([]);
  const fill = (on) => {
    if (done.current) return;
    const was = fillingRef.current;
    fillingRef.current = on;
    setFilling(on);
    if (on || !was || wRef.current <= 0.02) return;
    // let go: weigh this bag, then a fresh one
    const weight = Math.round(wRef.current * 1000) / 1000;
    const err = weight > target ? (weight - target) * 1.6 : target - weight;
    setCall(err < 0.02 ? { text: 'On the mark', tone: 'great' } : err < 0.06 ? { text: 'Close', tone: 'good' } : weight > target ? { text: 'Heavy', tone: 'bad' } : { text: 'Light', tone: 'bad' });
    buzz(err < 0.02 ? 30 : 12);
    sfx().then((s) => s.zip());
    const next = [...bagsRef.current, weight];
    bagsRef.current = next;
    setBags(next);
    wRef.current = 0;
    if (next.length >= order.trays) {
      done.current = true;
      setTimeout(() => onDone(next), 600);
    } else setTimeout(() => !done.current && !fillingRef.current && setW(0), 350);
  };

  useKeys(
    active,
    (k, e) => {
      if (k === ' ') {
        if (!e.repeat) fill(true);
        return true;
      }
      return false;
    },
    (k) => {
      if (k === ' ' || k === 'blur') {
        fill(false);
        return k === ' ';
      }
      return false;
    },
  );

  const ang = (v) => -90 + v * 180;
  const pt = (v, r) => {
    const a = ((ang(v) - 90) * Math.PI) / 180;
    return [(Math.cos(a) * r).toFixed(2), (Math.sin(a) * r).toFixed(2)];
  };
  const tol = upgrades.includes('notes') ? 0.045 : 0.03;
  const [ax, ay] = pt(target - tol, 70);
  const [bx, by] = pt(target + tol, 70);
  const pack = order.pack;
  return (
    <div className="lab-station lab-bag">
      <svg viewBox="0 0 320 190" className="lab-art" aria-hidden="true" {...holdProps(fill)}>
        <g transform="translate(110 130)">
          <path d="M-86 0 A86 86 0 0 1 86 0" fill="#0f1416" stroke="#8a949a" strokeWidth="4" />
          <path d={`M${ax} ${ay} A70 70 0 0 1 ${bx} ${by}`} stroke="#3fae5c" strokeWidth="12" fill="none" />
          <path d="M0 0 L0 -74" stroke="#ff5b4a" strokeWidth="4" strokeLinecap="round" style={{ transform: `rotate(${ang(w)}deg)` }} />
          <circle r="7" fill="#e8ecef" />
          <rect x="-70" y="8" width="140" height="12" rx="3" fill="#5b646a" />
        </g>
        {/* the pack on the pan */}
        <g transform="translate(228 40)">
          {pack === 'baggie' && (
            <>
              <path d="M14 20 h56 l-4 96 h-48 Z" fill="#e9f3f7" fillOpacity="0.12" stroke="#cfe3ea" strokeWidth="2" />
              <path d="M14 30 h56" stroke="#e04a3a" strokeWidth="3" />
            </>
          )}
          {pack === 'box' && (
            <>
              <rect x="6" y="30" width="72" height="86" rx="3" fill="#f2c318" stroke="#b08b0c" strokeWidth="2" />
              <text x="42" y="74" textAnchor="middle" className="lab-small" fill="#7a2a12">
                LOS POLLOS
              </text>
            </>
          )}
          {pack === 'barrel' && (
            <>
              <rect x="8" y="22" width="68" height="96" rx="8" fill="#5a7a9a" stroke="#2c3e52" strokeWidth="2" />
              <path d="M8 50 h68 M8 90 h68" stroke="#2c3e52" strokeWidth="3" />
              <text x="42" y="74" textAnchor="middle" className="lab-small" fill="#e8ecef">
                MADRIGAL
              </text>
            </>
          )}
          <clipPath id="lab-pack-fill">
            <rect x="0" y={118 - w * 92} width="84" height={w * 92} />
          </clipPath>
          <rect x="18" y="26" width="48" height="90" fill={LAB.tints[order.tint].color} opacity="0.75" clipPath="url(#lab-pack-fill)" />
        </g>
      </svg>
      <Callout {...call} />
      <p className="lab-hint">
        {LAB.packs[pack].label}: hold to fill, let go on the green. Bag {Math.min(bags.length + 1, order.trays)} of {order.trays}.
      </p>
      <div className="lab-controls">
        <button type="button" className="btn btn-primary hold-btn" aria-pressed={filling} {...holdProps(fill)}>
          Hold to fill <kbd>Space</kbd>
        </button>
        <span className="lab-readout">
          {bags.map((b, i) => (
            <span key={i} className="lab-bagmark" data-good={Math.abs(b - target) < 0.04 || undefined}>
              {Math.round(b * 1000)}g
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
