import { useEffect, useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import { local } from '../../lib/hooks';
import { useAchievements } from '../Achievements';

// The Iacon database: entries on the relics the Autobots hid, in Cybertronian.
// Read each one (the key helps) before the Decepticons decrypt it. What you
// recover stays in the vault between visits; all nine is an achievement.

const sfx = () => import('../../lib/sfx');
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ROUND = 5;
const STORE = 'tp-iacon';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const ICONS = {
  sword: <path d="M12 2 L14 14 H10 Z M7 14 H17 M12 14 V20 M10.5 21.5 h3" />,
  armor: <path d="M5 5 L12 3 L19 5 L18 14 L12 20 L6 14 Z M12 3 V20 M7 9 h10" />,
  phase: <path d="M4 10 h16 v5 h-16 Z M3 6 q2.25 -2 4.5 0 t4.5 0 t4.5 0 t4.5 0 M3 19 q2.25 -2 4.5 0 t4.5 0 t4.5 0 t4.5 0" />,
  magnet: <path d="M6 4 V12 a6 6 0 0 0 12 0 V4 M6 7 h3 M15 7 h3 M9 4 V12 a3 3 0 0 0 6 0 V4" />,
  waves: <path d="M3 10 h9 v5 h-9 Z M12 11 h4 M6 15 v3 M17 8 a5 5 0 0 1 0 7 M19.5 6 a8.5 8.5 0 0 1 0 11" />,
  lock: <path d="M12 7 V21 M12 1.5 a3 3 0 1 0 0.01 0 M8 11 l8 4 M16 11 l-8 4" />,
  spark: <path d="M12 4 L13.8 10.2 L20 12 L13.8 13.8 L12 20 L10.2 13.8 L4 12 L10.2 10.2 Z M5 5 l2 2 M19 5 l-2 2 M5 19 l2 -2 M19 19 l-2 -2" />,
  shield: <path d="M3 17 a9 9 0 0 1 18 0 Z M7 17 a5 5 0 0 1 10 0 M12 4 v3" />,
  key: <path d="M8 12 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M12 12 H21 M18 12 V15 M21 12 V15" />,
};

const RELICS = [
  { id: 'star-saber', name: 'Star Saber', icon: 'sword', text: 'Forged by Solus Prime. Only a Prime can wield it.' },
  { id: 'apex-armor', name: 'Apex Armor', icon: 'armor', text: 'Armor that almost nothing can get through.' },
  { id: 'phase-shifter', name: 'Phase Shifter', icon: 'phase', text: 'Lets whoever wears it pass straight through solid walls.' },
  { id: 'polarity-gauntlet', name: 'Polarity Gauntlet', icon: 'magnet', text: 'Complete control over magnetism.' },
  { id: 'resonance-blaster', name: 'Resonance Blaster', icon: 'waves', text: 'Fires sonic bursts that scramble a Cybertronian’s audio circuits.' },
  { id: 'immobilizer', name: 'Immobilizer', icon: 'lock', text: 'Its beam locks a Transformer’s servos, so they cannot move.' },
  { id: 'spark-extractor', name: 'Spark Extractor', icon: 'spark', text: 'Draws the sparks out of any Transformer in range.' },
  { id: 'force-field', name: 'Force Field Generator', icon: 'shield', text: 'Raises shields of any shape and size.' },
  { id: 'omega-keys', name: 'Omega Keys', icon: 'key', text: 'Four of them. Together, in the Omega Lock, they could make Cybertron live again.' },
];

const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

function Icon({ name, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...S}>
      {ICONS[name]}
    </svg>
  );
}

const seconds = (i) => Math.max(9, 15 - i * 1.5);

export default function Iacon() {
  const { unlock } = useAchievements();
  const [vault, setVault] = useState(() => {
    const saved = local.get(STORE, []);
    return Array.isArray(saved) ? saved.filter((id) => RELICS.some((r) => r.id === id)) : [];
  });
  const [round, setRound] = useState(null); // { entries, i, results }
  const [stage, setStage] = useState('idle'); // idle | ask | reveal | done
  const [options, setOptions] = useState([]);
  const [wrong, setWrong] = useState([]);
  const [progress, setProgress] = useState(0);
  const [showKey, setShowKey] = useState(false);
  const clock = useRef({ start: 0, penalty: 0 });
  const settled = useRef(false);
  const next = useRef(null);

  const entry = round ? round.entries[round.i] : null;

  const ask = (r, i) => {
    const relic = r.entries[i];
    const others = shuffle(RELICS.filter((x) => x.id !== relic.id)).slice(0, 3);
    setOptions(shuffle([relic, ...others]));
    setWrong([]);
    setProgress(0);
    clock.current = { start: performance.now(), penalty: 0 };
    settled.current = false;
    setStage('ask');
  };

  const start = () => {
    audioContext(); // in the click, so the console can be heard
    // the relics you haven't recovered come up first
    const missing = shuffle(RELICS.filter((r) => !vault.includes(r.id)));
    const have = shuffle(RELICS.filter((r) => vault.includes(r.id)));
    const entries = [...missing, ...have].slice(0, ROUND);
    const r = { entries, i: 0, results: [] };
    setRound(r);
    ask(r, 0);
  };

  const settle = (got) => {
    if (!round || settled.current) return;
    settled.current = true;
    const results = [...round.results, got];
    const r = { ...round, results };
    setRound(r);
    setStage('reveal');
    if (got) {
      sfx().then((s) => s.decode());
      if (!vault.includes(entry.id)) {
        const nv = [...vault, entry.id];
        setVault(nv);
        local.set(STORE, nv);
        if (nv.length === RELICS.length) unlock('iacon');
      }
    } else sfx().then((s) => s.alarm());
  };

  const advance = () => {
    clearTimeout(next.current);
    if (!round) return;
    if (round.i + 1 >= round.entries.length) {
      setStage('done');
      return;
    }
    const r = { ...round, i: round.i + 1 };
    setRound(r);
    ask(r, r.i);
  };

  const choose = (relic) => {
    if (stage !== 'ask') return;
    audioContext();
    if (relic.id === entry.id) settle(true);
    else {
      sfx().then((s) => s.buzz());
      setWrong((w) => [...w, relic.id]);
      clock.current.penalty += 0.22; // a wrong guess hands the Decepticons time
    }
  };

  // the Decepticons' decryption creeps up; pauses while the tab is hidden
  useEffect(() => {
    if (stage !== 'ask' || !round) return undefined;
    const total = seconds(round.i) * 1000;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      if (document.hidden) clock.current.start += now - last;
      last = now;
      const p = Math.min(1, (now - clock.current.start) / total + clock.current.penalty);
      setProgress(p);
      if (p >= 1) settle(false);
    }, 100);
    return () => clearInterval(id);
    // settle reads the current round; it is re-created with each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, round?.i]);

  // after a reveal, the next entry comes up on its own
  useEffect(() => {
    if (stage !== 'reveal') return undefined;
    next.current = setTimeout(advance, 2600);
    return () => clearTimeout(next.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const got = round?.results[round.results.length - 1];
  const score = round ? round.results.filter(Boolean).length : 0;
  const shown = stage === 'reveal' && !got ? 1 : progress;

  return (
    <div className="iacon">
      <div className="iacon-console card">
        <div className="iacon-bar">
          <span className="label">Iacon database</span>
          <span className="label">{round && stage !== 'idle' && stage !== 'done' ? `Entry ${round.i + 1} of ${round.entries.length}` : 'Teletraan-1'}</span>
        </div>

        {stage === 'idle' && (
          <div className="iacon-body">
            <p className="text-[0.95rem] leading-relaxed text-body">
              Before Iacon fell, the Autobots hid their relics. Where they are is written in the database, in Cybertronian, and the Decepticons are decrypting it too. Read each entry before they do.
            </p>
            <button type="button" className="btn btn-primary btn-sm mt-5" onClick={start}>
              Access the database
            </button>
          </div>
        )}

        {(stage === 'ask' || stage === 'reveal') && entry && (
          <div className="iacon-body">
            <p className="iacon-glyphs" aria-hidden="true">
              {entry.name.toUpperCase()}
            </p>
            <p className="sr-only">An entry in Cybertronian, {entry.name.replace(/ /g, '').length} letters long.</p>
            <div className="iacon-decrypt" aria-hidden="true">
              <span style={{ transform: `scaleX(${shown})` }} />
            </div>
            <p className="mt-2 text-xs text-muted">Decepticon decryption {Math.round(shown * 100)}%</p>
            <div className="iacon-options mt-4" role="group" aria-label="What does the entry say?">
              {options.map((o) => {
                const isWrong = wrong.includes(o.id);
                const isRight = stage === 'reveal' && o.id === entry.id;
                return (
                  <button key={o.id} type="button" className="iacon-option" data-wrong={isWrong || undefined} data-right={isRight || undefined} disabled={stage !== 'ask' || isWrong} onClick={() => choose(o)}>
                    {o.name}
                  </button>
                );
              })}
            </div>
            <div className="iacon-result" role="status" aria-live="polite">
              {stage === 'reveal' &&
                (got ? (
                  <div className="iacon-found">
                    <Icon name={entry.icon} className="iacon-found-icon" />
                    <div>
                      <p className="font-semibold text-ink">Recovered: {entry.name}</p>
                      <p className="text-sm text-body">{entry.text}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-body">
                    Soundwave got there first. It was the <b className="text-ink">{entry.name}</b>.
                  </p>
                ))}
            </div>
            {stage === 'reveal' && (
              <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={advance}>
                {round.i + 1 >= round.entries.length ? 'Finish' : 'Next entry'}
              </button>
            )}
          </div>
        )}

        {stage === 'done' && round && (
          <div className="iacon-body">
            <p className="text-lg font-semibold text-ink">
              {score === round.entries.length ? 'Every entry read first.' : score === 0 ? 'The Decepticons read them all first.' : `You read ${score} of ${round.entries.length} first.`}
            </p>
            <p className="mt-2 text-sm text-body">
              {vault.length === RELICS.length ? 'All nine relics are in the vault. Orion Pax would be proud.' : `${vault.length} of ${RELICS.length} relics in the vault so far.`}
            </p>
            <button type="button" className="btn btn-primary btn-sm mt-5" onClick={start}>
              Another search
            </button>
          </div>
        )}

        <div className="iacon-keybar">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowKey((k) => !k)} aria-expanded={showKey} aria-controls="iacon-key">
            {showKey ? 'Hide the key' : 'Show the key'}
          </button>
        </div>
        {showKey && (
          <ul id="iacon-key" className="iacon-key" aria-label="The Cybertronian alphabet">
            {[...ALPHABET].map((ch) => (
              <li key={ch}>
                <span className="iacon-key-glyph" aria-hidden="true">
                  {ch}
                </span>
                <span className="iacon-key-letter">{ch}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="iacon-vault">
        <p className="label">
          The vault · {vault.length} of {RELICS.length}
        </p>
        <ul className="iacon-relics mt-3">
          {RELICS.map((r) => {
            const have = vault.includes(r.id);
            return (
              <li key={r.id} className="iacon-relic" data-have={have || undefined} title={have ? r.text : undefined}>
                <Icon name={r.icon} className="iacon-relic-icon" />
                <span className="iacon-relic-name">{have ? r.name : <span className="iacon-relic-unknown">{r.name.toUpperCase()}</span>}</span>
                {!have && <span className="sr-only">not yet recovered</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
