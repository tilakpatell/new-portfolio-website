import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrameLoop } from '../../../lib/hooks';
import { M, bandAt, cookSeconds, cracksFor, strikeWindow, traysFor, unlocked } from './rules';
import { PackFace, StickerIcon } from './Ticket';
import { buzz, holdProps, useKeys } from './keys';
import '../../../styles/lazy/albuquerque.css';

// The four stations an order goes through in Walt's Metherria. The 3D scene
// does the drawing: each station writes what it's doing to `live` (its own
// slice, cleared when it goes), and shows only its controls. Each calls
// `onDone` once with what was made, and the game scores it. `say` puts a
// word over the scene.

const sfx = () => import('../../../lib/sfx');
const now = () => performance.now() / 1000;
// a test hook: the QA bot slows the stations down when the browser can only
// manage a few frames a second (software WebGL), so its timing still counts
const pace = () => (import.meta.env.DEV && window.__METH_PACE__) || 1;
const MIX_KEYS = { blue: 'b', chili: 'c', seeds: 's', spice: 'p' };
const MIX_COLOR = { blue: '#2f8fd0', chili: '#c8361e', seeds: '#bfe8ff', spice: '#d99a2b' };
const SIZES = Object.keys(M.sizes);
const PACKS = Object.keys(M.packs);

// Keep this station's slice of `live` current: every frame while it runs,
// after every render, and gone once the station is.
function useLive(live, key, get, active) {
  const read = useRef(get);
  read.current = get;
  useFrameLoop(() => {
    live.current[key] = read.current();
  }, active);
  useEffect(() => {
    live.current[key] = read.current();
  });
  useEffect(
    () => () => {
      live.current[key] = null;
    },
    [live, key],
  );
}

// ─── Build: the size, the base poured to its line, mix-ins counted in ────────
export function BuildStation({ order, upgrades, rank, active, live, onDone, say }) {
  const open = unlocked(rank).mixins;
  const [size, setSize] = useState(null);
  const [base, setBase] = useState(0);
  const [mix, setMix] = useState({});
  const [pouring, setPouring] = useState(false);
  const baseRef = useRef(0);
  const pourRef = useRef(false);
  const last = useRef({ k: null, at: -9 });
  const done = useRef(false);
  const target = size ? M.sizes[size].base : 0;
  const tol = upgrades.includes('notes') ? 0.028 : 0.018;
  const near = !!size && Math.abs(base - target) < tol;

  useLive(
    live,
    'build',
    () => ({
      size,
      base: baseRef.current,
      mix,
      pour: pourRef.current ? 'base' : last.current.k === 'blue' && now() - last.current.at < 0.35 ? 'blue' : null,
      target,
      near: upgrades.includes('notes') && !!size && Math.abs(baseRef.current - target) < tol,
      lastAdd: last.current.k,
      lastAddAt: last.current.at,
    }),
    active,
  );

  useFrameLoop((ms) => {
    const b = Math.min(1, baseRef.current + M.pourRate * pace() * (ms / 1000));
    baseRef.current = b;
    setBase(b);
    if (b >= 1) {
      pour(false);
      say('Up to the neck', 'bad');
    }
  }, active && pouring);

  const pour = (on) => {
    if (done.current || pourRef.current === on) return;
    pourRef.current = on;
    setPouring(on);
    if (on || !size) return;
    const err = baseRef.current - target;
    if (Math.abs(err) < tol) {
      say('On the line', 'great');
      buzz(25);
    } else if (Math.abs(err) < 0.05) say(err > 0 ? 'A touch over' : 'A touch under', 'good');
    else if (err < 0) say('Keep pouring', 'okay');
    else say('Over the line', 'bad');
  };
  const pickSize = (s) => {
    if (done.current) return;
    setSize(s);
    sfx().then((x) => x.knock(undefined, undefined, 0.02));
  };
  const add = (k) => {
    if (done.current || !open.includes(k)) return;
    if ((mix[k] ?? 0) >= M.mixins[k].max) {
      say(`That’s all the ${M.mixins[k].label.toLowerCase()} it takes`, 'okay');
      buzz(40);
      return;
    }
    setMix((m) => ({ ...m, [k]: (m[k] ?? 0) + 1 }));
    last.current = { k, at: now() };
    sfx().then((x) => x.pop());
    buzz(10);
  };
  const dump = () => {
    if (done.current) return;
    pour(false);
    baseRef.current = 0;
    setBase(0);
    setMix({});
    setSize(null);
    sfx().then((x) => x.sizzle?.());
  };
  const ready = !!size && base > 0.05;
  const finish = () => {
    if (done.current || !ready) return;
    done.current = true;
    pour(false);
    onDone({ size, base: Math.round(baseRef.current * 1000) / 1000, mix: { ...mix } });
  };

  useKeys(
    active,
    (k, e) => {
      if (k === ' ') {
        if (!e.repeat) pour(true);
        return true;
      }
      const s = SIZES[Number(k) - 1];
      if (s) {
        pickSize(s);
        return true;
      }
      const mk = Object.keys(MIX_KEYS).find((m) => MIX_KEYS[m] === k.toLowerCase());
      if (mk && open.includes(mk)) {
        if (!e.repeat) add(mk);
        return true;
      }
      if (k === 'Backspace') {
        dump();
        return true;
      }
      if (k === 'Enter') {
        finish();
        return true;
      }
      return false;
    },
    (k) => {
      if (k === ' ' || k === 'blur') {
        pour(false);
        return k === ' ';
      }
      return false;
    },
  );

  return (
    <div className="wm-station" data-station="build">
      <div className="wm-row" role="group" aria-label="Batch size">
        {SIZES.map((s, i) => (
          <button key={s} type="button" className="wm-chip" aria-pressed={size === s} onClick={() => pickSize(s)}>
            <span className="wm-trays" aria-hidden="true">
              {Array.from({ length: M.sizes[s].trays }, (_, j) => (
                <i key={j} />
              ))}
            </span>
            {M.sizes[s].label}
            <kbd>{i + 1}</kbd>
          </button>
        ))}
      </div>
      <div className="wm-row" role="group" aria-label="Mix-ins">
        {open.map((k) => (
          <button key={k} type="button" className="wm-chip" onClick={() => add(k)} aria-label={`${M.mixins[k].label}, ${mix[k] ?? 0} of ${M.mixins[k].max}`}>
            <span className="wm-swatch" style={{ background: MIX_COLOR[k] }} aria-hidden="true" />
            {M.mixins[k].label}
            <span className="wm-pips" aria-hidden="true">
              {Array.from({ length: M.mixins[k].max }, (_, j) => (
                <i key={j} data-on={j < (mix[k] ?? 0) || undefined} />
              ))}
            </span>
            <kbd>{MIX_KEYS[k].toUpperCase()}</kbd>
          </button>
        ))}
      </div>
      <div className="wm-row">
        <button type="button" className="btn btn-primary hold-btn wm-big" aria-pressed={pouring} disabled={base >= 1} {...holdProps(pour)}>
          Hold to pour the base <kbd>Space</kbd>
        </button>
        <span className="wm-readout" data-near={near || undefined}>
          {size ? `${Math.round(base * 100)}% · line at ${Math.round(target * 100)}%` : `${Math.round(base * 100)}% · pick a size for the line`}
        </span>
      </div>
      <div className="wm-row wm-row-end">
        <button type="button" className="btn btn-ghost" onClick={dump} disabled={!base && !size && !Object.keys(mix).length}>
          Dump it <kbd>⌫</kbd>
        </button>
        <button type="button" className="btn btn-primary" onClick={finish} disabled={!ready}>
          To the cook <kbd>⏎</kbd>
        </button>
      </div>
      <p className="wm-hint">
        {!size ? `Pick the size: ${M.sizes[order.size].label.toLowerCase()} on this ticket.` : 'Pour the base to the gold line, count in the mix-ins, and send it to the cook.'}
      </p>
    </div>
  );
}

// ─── Cook: hold the heat, keep the needle in the green ───────────────────────
const KICKS = [
  [0.14, 'The burner flares'],
  [0.12, 'Jesse knocks the regulator'],
  [-0.12, 'A draft from the loading door'],
  [-0.14, 'The coolant kicks in'],
];
const WARM = 4; // seconds to bring it up before being cold starts to cost

export function CookStation({ order, upgrades, active, live, onDone, say }) {
  const need = cookSeconds(traysFor(order), upgrades);
  const s = useRef({ heat: 0.3, on: false, t: 0, good: 0, wob: Math.random() * 10, started: false, purity: M.topPurity, kick: 2.2 + Math.random(), drift: 0, driftLeft: 0 });
  const [view, setView] = useState({ heat: 0.3, good: 0, purity: M.topPurity, inBand: false, band: bandAt(0, upgrades), started: false });
  const [heating, setHeating] = useState(false);
  const done = useRef(false);
  const hold = (on) => {
    s.current.on = on && !done.current;
    setHeating(s.current.on);
  };

  useLive(live, 'cook', () => ({ heat: s.current.heat, band: view.band, progress: Math.min(1, s.current.good / need), inBand: view.inBand }), active);

  useFrameLoop((ms) => {
    const st = s.current;
    if (done.current) return;
    const dt = (ms / 1000) * pace();
    st.wob += dt;
    st.t += dt;
    if (st.started) {
      st.kick -= dt;
      if (st.kick <= 0) {
        const [push, what] = KICKS[Math.floor(Math.random() * KICKS.length)];
        st.drift = push;
        st.driftLeft = 1.1 + Math.random() * 0.6;
        st.kick = 2.6 + Math.random() * 1.8;
        say(what, 'okay');
      }
      if (st.driftLeft > 0) {
        st.driftLeft -= dt;
        if (st.driftLeft <= 0) st.drift = 0;
      }
    }
    st.heat += ((st.on ? 0.34 : -0.2) + st.drift) * dt + Math.sin(st.wob * 3.1) * 0.05 * dt;
    st.heat = Math.max(0, Math.min(1, st.heat));
    const band = bandAt(st.good / need, upgrades);
    const good = st.heat >= band[0] && st.heat <= band[1];
    if (good && !st.started) {
      st.started = true;
      say('Up to temperature', 'good');
    }
    if (st.started || st.t > WARM) {
      if (good) st.good += dt;
      else {
        const off = st.heat < band[0] ? band[0] - st.heat : st.heat - band[1];
        st.purity = Math.max(0, st.purity - dt * (0.5 + 20 * off));
      }
    }
    setView({ heat: st.heat, good: st.good, purity: st.purity, inBand: good, band, started: st.started });
    if (st.good >= need) {
      done.current = true;
      hold(false);
      onDone(Math.round(st.purity * 10) / 10);
    }
  }, active);

  useKeys(
    active,
    (k, e) => {
      if (k === ' ') {
        if (!e.repeat) hold(true);
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

  const k = Math.min(1, view.good / need);
  const status = !view.started ? 'Bring it up to temperature: hold the heat until the needle is in the green.' : view.inBand ? 'Steady. Keep it in the green.' : view.heat > view.band[1] ? 'Too hot. Let go.' : 'Too cold. More heat.';
  return (
    <div className="wm-station" data-station="cook" data-in={view.inBand || undefined}>
      <div className="wm-row">
        <button type="button" className="btn btn-primary hold-btn wm-big" aria-pressed={heating} {...holdProps(hold)}>
          Hold for heat <kbd>Space</kbd>
        </button>
        <div className="wm-meters">
          <span className="wm-meter" aria-label={`Cooked ${Math.round(k * 100)}%`}>
            <span style={{ transform: `scaleX(${k})` }} />
          </span>
          <span className="wm-readout" data-near={view.inBand || undefined}>
            Purity {view.purity.toFixed(1)}% · wanted {order.purity}% · cooked {Math.round(k * 100)}%
          </span>
        </div>
      </div>
      <p className="wm-hint" role="status">
        {status}
      </p>
    </div>
  );
}

// ─── Break: strike the slab on its crack lines ───────────────────────────────
export function BreakStation({ order, upgrades, active, live, onDone, say, tapRef }) {
  const cracks = useMemo(() => cracksFor(order.cut), [order]);
  const window_ = strikeWindow(upgrades);
  const pos = useRef(0);
  const dir = useRef(1);
  const brokenRef = useRef(cracks.map(() => null)); // accuracy, once struck
  const [broken, setBroken] = useState(brokenRef.current);
  const strikeAt = useRef(-9);
  const wild = useRef(0);
  const swings = useRef(0);
  const [, setSwung] = useState(0);
  const done = useRef(false);
  const maxSwings = cracks.length + 3;

  useLive(live, 'brk', () => ({ x: pos.current, dir: dir.current, cracks, broken: brokenRef.current, strikeAt: strikeAt.current }), active);

  useFrameLoop((ms) => {
    if (done.current) return;
    let p = pos.current + dir.current * M.sweepRate * pace() * (ms / 1000);
    if (p > 1) {
      p = 2 - p;
      dir.current = -1;
    } else if (p < 0) {
      p = -p;
      dir.current = 1;
    }
    pos.current = p;
  }, active);

  const strike = () => {
    if (done.current || !active) return;
    swings.current += 1;
    setSwung(swings.current);
    strikeAt.current = now();
    const p = pos.current;
    const was = brokenRef.current;
    let best = -1;
    let d = Infinity;
    cracks.forEach((c, i) => {
      if (was[i] == null && Math.abs(c - p) < d) {
        d = Math.abs(c - p);
        best = i;
      }
    });
    let next = was;
    if (best >= 0 && d <= window_) {
      const acc = Math.round((1 - (d / window_) * 0.6) * 100) / 100;
      next = was.map((b, i) => (i === best ? acc : b));
      brokenRef.current = next;
      setBroken(next);
      say(acc > 0.9 ? 'Clean!' : acc > 0.7 ? 'Good' : 'Close', acc > 0.9 ? 'great' : acc > 0.7 ? 'good' : 'okay');
      sfx().then((x) => x.clang(undefined, undefined, 0));
      buzz(acc > 0.9 ? 30 : 15);
    } else {
      wild.current += 1;
      say('Miss', 'bad');
      sfx().then((x) => x.knock());
    }
    const left = next.filter((b) => b == null).length;
    if (!left || swings.current >= maxSwings) {
      done.current = true;
      const hits = next.filter((b) => b != null);
      setTimeout(() => onDone({ hits, cracks: cracks.length, wild: wild.current, made: { cracks, broken: next } }), 650);
    }
  };
  const strikeRef = useRef(strike);
  strikeRef.current = strike;
  useEffect(() => {
    if (!tapRef) return undefined;
    tapRef.current = () => strikeRef.current();
    return () => {
      tapRef.current = null;
    };
  }, [tapRef]);

  useKeys(active, (k, e) => {
    if (k === ' ' || k === 'Enter') {
      if (!e.repeat) strike();
      return true;
    }
    return false;
  });

  const struck = broken.filter((b) => b != null).length;
  return (
    <div className="wm-station" data-station="break">
      <div className="wm-row">
        <button type="button" className="btn btn-primary wm-big" onClick={strike}>
          Strike <kbd>Space</kbd>
        </button>
        <span className="wm-cracks" aria-label={`${struck} of ${cracks.length} cracks struck`}>
          {broken.map((b, i) => (
            <i key={i} data-tone={b == null ? undefined : b > 0.9 ? 'great' : b > 0.7 ? 'good' : 'okay'} />
          ))}
        </span>
        <span className="wm-readout">{Math.max(0, maxSwings - swings.current)} swings left</span>
      </div>
      <p className="wm-hint">{M.cuts[order.cut].label}: strike when the gold marker is over a white line. Tapping the scene strikes too.</p>
    </div>
  );
}

// ─── Pack: the pack, each one filled to the mark, stickers where they go ────
export function PackStation({ order, upgrades, rank, active, live, onDone, say }) {
  const kinds = unlocked(rank).stickers;
  const trays = traysFor(order);
  const [step, setStep] = useState('pick'); // pick | fill | stickers
  const [pack, setPack] = useState(null);
  const [bags, setBags] = useState([]);
  const [filling, setFilling] = useState(false);
  const [stickers, setStickers] = useState([]);
  const [kind, setKind] = useState(kinds[0] ?? null);
  const [cursor, setCursor] = useState({ x: 0.5, y: 0.5 });
  const wRef = useRef(0);
  const [w, setW] = useState(0);
  const fillRef = useRef(false);
  const bagsRef = useRef([]);
  const done = useRef(false);
  const target = pack ? M.packs[pack].weight : 0;
  const tol = upgrades.includes('notes') ? 0.045 : 0.03;

  useLive(live, 'pack', () => ({ pack, w: wRef.current, bags: bagsRef.current, stickers }), active);

  useFrameLoop((ms) => {
    wRef.current = Math.min(1, wRef.current + M.fillRate * pace() * (ms / 1000));
    setW(wRef.current);
  }, active && filling);

  const choose = (p) => {
    if (done.current || bagsRef.current.length) return;
    setPack(p);
    setStep('fill');
    sfx().then((x) => x.knock(undefined, undefined, 0.02));
  };
  const finish = (weights = bagsRef.current, placed = stickers) => {
    if (done.current) return;
    done.current = true;
    onDone({ pack, weights, stickers: placed });
  };
  const fill = (on) => {
    if (done.current || step !== 'fill') return;
    const was = fillRef.current;
    fillRef.current = on;
    setFilling(on);
    if (on || !was || wRef.current <= 0.02) return;
    // let go: weigh this one, then a fresh one
    const weight = Math.round(wRef.current * 1000) / 1000;
    const err = weight > target ? (weight - target) * 1.6 : target - weight;
    if (err < 0.02) say('On the mark', 'great');
    else if (err < 0.06) say('Close', 'good');
    else say(weight > target ? 'Heavy' : 'Light', 'bad');
    buzz(err < 0.02 ? 30 : 12);
    sfx().then((x) => x.zip());
    const next = [...bagsRef.current, weight];
    bagsRef.current = next;
    setBags(next);
    wRef.current = 0;
    setW(0);
    if (next.length >= trays) {
      if (kinds.length) setStep('stickers');
      else setTimeout(() => finish(next, []), 500);
    }
  };
  const place = (x, y) => {
    if (done.current || step !== 'stickers' || !kind || stickers.length >= 4) return;
    const p = { kind, x: Math.max(0.08, Math.min(0.92, x)), y: Math.max(0.08, Math.min(0.92, y)) };
    setStickers((s) => [...s, p]);
    sfx().then((x2) => x2.pop());
    buzz(10);
  };
  const undo = () => setStickers((s) => s.slice(0, -1));

  useKeys(
    active,
    (k, e) => {
      if (step === 'pick') {
        const p = PACKS[Number(k) - 1];
        if (p) {
          choose(p);
          return true;
        }
        return false;
      }
      if (step === 'fill') {
        if (k === ' ') {
          if (!e.repeat) fill(true);
          return true;
        }
        return false;
      }
      // stickers: arrows aim, Space sticks, numbers pick, Enter bags it up
      const move = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] }[k];
      if (move) {
        setCursor((c) => ({ x: Math.max(0.08, Math.min(0.92, c.x + move[0])), y: Math.max(0.08, Math.min(0.92, c.y + move[1])) }));
        return true;
      }
      if (k === ' ') {
        if (!e.repeat) place(cursor.x, cursor.y);
        return true;
      }
      const pick = kinds[Number(k) - 1];
      if (pick) {
        setKind(pick);
        return true;
      }
      if (k === 'Backspace') {
        undo();
        return true;
      }
      if (k === 'Enter') {
        finish();
        return true;
      }
      return false;
    },
    (k) => {
      if (step === 'fill' && (k === ' ' || k === 'blur')) {
        fill(false);
        return k === ' ';
      }
      return false;
    },
  );

  return (
    <div className="wm-station" data-station="pack">
      {step === 'pick' && (
        <>
          <div className="wm-row" role="group" aria-label="Pack">
            {PACKS.map((p, i) => (
              <button key={p} type="button" className="wm-chip wm-chip-pack" onClick={() => choose(p)}>
                <PackFace pack={p} size="xs" />
                {M.packs[p].label}
                <kbd>{i + 1}</kbd>
              </button>
            ))}
          </div>
          <p className="wm-hint">Pick the pack on the ticket. {trays === 1 ? 'One to fill.' : `${trays} to fill, one per tray.`}</p>
        </>
      )}
      {step === 'fill' && (
        <>
          <div className="wm-row">
            <button type="button" className="btn btn-primary hold-btn wm-big" aria-pressed={filling} {...holdProps(fill)}>
              Hold to fill <kbd>Space</kbd>
            </button>
            <span className="wm-meter wm-meter-scale" aria-label={`On the scale: ${Math.round(w * 1000)} grams, the mark is ${Math.round(target * 1000)}`}>
              <span style={{ transform: `scaleX(${w})` }} />
              <b style={{ left: `${(target - tol) * 100}%`, width: `${tol * 200}%` }} />
            </span>
            <span className="wm-readout">
              {M.packs[pack].label}: {Math.min(bags.length + 1, trays)} of {trays}
            </span>
          </div>
          <div className="wm-row">
            {bags.map((b, i) => (
              <span key={i} className="wm-bagmark" data-good={Math.abs(b - target) < tol || undefined}>
                {Math.round(b * 1000)}g
              </span>
            ))}
            {!bags.length && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep('pick')}>
                A different pack
              </button>
            )}
          </div>
          <p className="wm-hint">Hold to fill, and let go on the green mark on the scale.</p>
        </>
      )}
      {step === 'stickers' && (
        <div className="wm-sticker-step">
          <PackFace
            pack={pack}
            stickers={stickers}
            size="lg"
            className="wm-board"
            onPointerDown={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              place((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
            }}
          >
            <span className="wm-aim" style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }} aria-hidden="true" />
          </PackFace>
          <div className="wm-sticker-side">
            <div className="wm-row" role="group" aria-label="Sticker">
              {kinds.map((k, i) => (
                <button key={k} type="button" className="wm-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
                  <StickerIcon kind={k} />
                  {M.stickers[k].label}
                  <kbd>{i + 1}</kbd>
                </button>
              ))}
            </div>
            <p className="wm-hint">
              {order.stickers.length ? 'Tap the pack where the ticket shows each sticker (or aim with the arrows and press Space).' : 'No stickers on this ticket. Bag it up as it is.'}
            </p>
            <div className="wm-row wm-row-end">
              <button type="button" className="btn btn-ghost" onClick={undo} disabled={!stickers.length}>
                Peel one off <kbd>⌫</kbd>
              </button>
              <button type="button" className="btn btn-primary" onClick={() => finish()}>
                Bag it up <kbd>⏎</kbd>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
