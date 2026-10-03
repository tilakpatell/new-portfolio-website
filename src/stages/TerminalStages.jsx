import { useEffect, useState } from 'react';
import { StageWindow } from './StageKit';
import { useInView, useReducedMotion } from '../lib/hooks';

// Plays a list of { cmd, out[] } entries: types each command, then prints its output.
function useTyped(entries, active, { cps = 28, pause = 900 } = {}) {
  const reduced = useReducedMotion();
  const [state, setState] = useState({ entry: 0, chars: 0, out: false });
  useEffect(() => {
    if (!active || reduced) return undefined;
    const e = entries[state.entry];
    let t;
    if (state.chars < e.cmd.length) t = setTimeout(() => setState((s) => ({ ...s, chars: s.chars + 1 })), 1000 / cps);
    else if (!state.out) t = setTimeout(() => setState((s) => ({ ...s, out: true })), 260);
    else
      t = setTimeout(
        () => setState((s) => (s.entry + 1 < entries.length ? { entry: s.entry + 1, chars: 0, out: false } : { entry: 0, chars: 0, out: false })),
        pause + e.out.length * 160,
      );
    return () => clearTimeout(t);
  }, [state, active, reduced, entries, cps, pause]);
  if (reduced) return { entry: entries.length - 1, chars: Infinity, out: true, all: true };
  return state;
}

function Transcript({ entries, prompt, state }) {
  return (
    <div className="stage-code min-h-[16rem] px-4 py-3">
      {entries.map((e, i) => {
        if (!state.all && i > state.entry) return null;
        const current = !state.all && i === state.entry;
        const cmd = current ? e.cmd.slice(0, state.chars) : e.cmd;
        const showOut = state.all || !current || state.out;
        return (
          <div key={i}>
            <p className="whitespace-pre-wrap break-words">
              <span className="text-accent">{prompt}</span> <span className="text-ink">{cmd}</span>
              {current && !state.out && <span className="stage-caret anim-blink ml-0.5" aria-hidden="true" />}
            </p>
            {showOut && e.out.map((o, j) => (
              <p key={j} className="whitespace-pre-wrap break-words text-muted">
                {o}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Unix shell ─────────────────────────────────────────────────────────────
const SHELL = [
  { cmd: 'ls src | grep "\\.c$" | wc -l', out: ['3'] },
  { cmd: 'sort names.txt > sorted.txt', out: [] },
  { cmd: 'head -n 2 < sorted.txt', out: ['ada', 'grace'] },
  { cmd: 'sleep 30 &', out: ['[1] 4127'] },
  { cmd: 'jobs', out: ['[1]+  Running    sleep 30 &'] },
  { cmd: 'cd .. && pwd', out: ['/home/tilak'] },
];

export function ShellStage() {
  const [ref, inView] = useInView({ rootMargin: '0px' });
  const state = useTyped(SHELL, inView);
  return (
    <div ref={ref}>
      <StageWindow title="tsh · a Unix shell in C" right="pipes · redirection · jobs">
        <Transcript entries={SHELL} prompt="tsh>" state={state} />
      </StageWindow>
    </div>
  );
}

// ─── FUSE file system ───────────────────────────────────────────────────────
const FS = [
  { cmd: './tpfs disk.img /mnt/tpfs', out: ['mounted tpfs on /mnt/tpfs (fuse)'], blocks: 3 },
  { cmd: 'mkdir docs src', out: [], blocks: 5 },
  { cmd: 'echo "hello" > hello.txt', out: [], blocks: 7 },
  { cmd: 'cp ~/notes.txt docs/', out: [], blocks: 11 },
  { cmd: 'touch src/main.c', out: [], blocks: 12 },
  { cmd: 'ls -i', out: ['2 docs   3 src   4 hello.txt'], blocks: 12 },
];
const TREE = [
  { label: '/mnt/tpfs', ino: 1, step: 0 },
  { label: '├── docs/', ino: 2, step: 1 },
  { label: '│   └── notes.txt', ino: 5, step: 3 },
  { label: '├── src/', ino: 3, step: 1 },
  { label: '│   └── main.c', ino: 6, step: 4 },
  { label: '└── hello.txt', ino: 4, step: 2 },
];

export function TreeStage() {
  const [ref, inView] = useInView({ rootMargin: '0px' });
  const state = useTyped(FS, inView, { pause: 1100 });
  const upto = state.all ? FS.length - 1 : state.out ? state.entry : state.entry - 1;
  const rows = TREE.filter((r) => r.step <= upto);
  const used = upto >= 0 ? FS[upto].blocks : 0;

  return (
    <div ref={ref} className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
      <StageWindow title="bash · FUSE mount">
        <Transcript entries={FS} prompt="$" state={state} />
      </StageWindow>
      <div className="grid gap-4">
        <StageWindow title="tree /mnt/tpfs">
          <div className="stage-code min-h-[8rem] px-4 py-3">
            {rows.map((r) => (
              <p key={r.ino} className="flex justify-between gap-4 whitespace-pre">
                <span className="text-ink">{r.label}</span>
                <span className="text-muted">ino {r.ino}</span>
              </p>
            ))}
          </div>
        </StageWindow>
        <StageWindow title="disk.img (mmap), 64 blocks">
          <div className="grid gap-1 p-4" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
            {Array.from({ length: 64 }).map((_, i) => {
              const kind = i === 0 ? 'super' : i < 3 ? 'meta' : i < used ? 'data' : 'free';
              return (
                <span
                  key={i}
                  className="aspect-square rounded-[2px] transition-colors duration-500"
                  title={kind}
                  style={{
                    background:
                      kind === 'super' ? 'var(--text)' : kind === 'meta' ? 'var(--muted)' : kind === 'data' ? 'var(--accent)' : 'var(--surface-2)',
                  }}
                />
              );
            })}
          </div>
          <p className="mono flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-xs text-muted">
            <span>■ superblock</span>
            <span>■ bitmaps</span>
            <span className="text-accent">■ data</span>
          </p>
        </StageWindow>
      </div>
    </div>
  );
}

// ─── Finance platform API ───────────────────────────────────────────────────
const API = [
  { cmd: 'POST /auth/login', out: ['200 OK · session token issued'] },
  { cmd: 'GET /finance/quote?symbol=AAPL', out: ['200 OK · 180 daily closes'] },
  { cmd: 'GET /finance/recommend', out: ['200 OK · { "portfolio": [ … ], "risk": "…" }'] },
  { cmd: 'POST /chat', out: ['200 OK · { "reply": "Here’s how your portfolio is split…" }'] },
];

function series() {
  const pts = [];
  let v = 60;
  for (let i = 0; i < 48; i++) {
    const x = Math.sin(i * 1.7) * 43758.5453;
    v += (x - Math.floor(x) - 0.45) * 9;
    v = Math.max(16, Math.min(104, v));
    pts.push([12 + i * 6.4, 120 - v]);
  }
  return pts;
}
const PRICE = series();

export function ApiStage() {
  const [ref, inView] = useInView({ rootMargin: '0px' });
  const state = useTyped(API, inView, { cps: 34, pause: 1400 });
  const chartOn = state.all || state.entry > 1 || (state.entry === 1 && state.out);
  return (
    <div ref={ref} className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <StageWindow title="uvicorn · FastAPI request log">
        <Transcript entries={API} prompt="→" state={state} />
      </StageWindow>
      <StageWindow title="AAPL · daily close">
        <svg viewBox="0 0 320 140" className="block h-auto w-full p-2" role="img" aria-label="Line chart of daily closing prices">
          {[30, 60, 90, 120].map((y) => (
            <path key={y} d={`M 12 ${y} L 312 ${y}`} style={{ stroke: 'var(--border)', strokeWidth: 1 }} />
          ))}
          <path
            d={`M ${PRICE.map((p) => p.join(' ')).join(' L ')}`}
            fill="none"
            pathLength="1"
            style={{ stroke: 'var(--accent)', strokeWidth: 2, strokeLinejoin: 'round', strokeDasharray: 1, strokeDashoffset: chartOn ? 0 : 1, transition: chartOn ? 'stroke-dashoffset 1.6s ease' : 'none' }}
          />
        </svg>
      </StageWindow>
    </div>
  );
}

// ─── Smart summarizer ───────────────────────────────────────────────────────
const SENTENCES = [
  { text: 'The city council approved a plan on Tuesday to put solar panels on every public school by 2030.', score: 0.92 },
  { text: 'Officials said the panels would cut electricity costs and double as teaching tools for science classes.', score: 0.74 },
  { text: 'The meeting ran long, and several residents spoke about unrelated parking concerns.', score: 0.11 },
  { text: 'Funding will come from a state clean-energy grant, so no new local taxes are needed.', score: 0.66 },
  { text: 'A pilot installation at two high schools begins next spring.', score: 0.41 },
];
const SUM_PHASES = [
  { ms: 1800, label: 'Input article' },
  { ms: 2200, label: 'Encode each sentence with BERT' },
  { ms: 2400, label: 'Score sentences for salience' },
  { ms: 3600, label: 'Keep the top three: the summary' },
];

export function SummarizerStage() {
  const [ref, inView] = useInView({ rootMargin: '0px' });
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(reduced ? 3 : 0);
  useEffect(() => {
    if (!inView || reduced) return undefined;
    const t = setTimeout(() => setPhase((p) => (p + 1) % SUM_PHASES.length), SUM_PHASES[phase].ms);
    return () => clearTimeout(t);
  }, [phase, inView, reduced]);
  const ranked = [...SENTENCES].sort((a, b) => b.score - a.score).slice(0, 3);

  return (
    <div ref={ref} className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <StageWindow title="article.txt" right={SUM_PHASES[phase].label}>
        <ol className="grid gap-3 p-4">
          {SENTENCES.map((s, i) => {
            const keep = ranked.includes(s);
            return (
              <li key={i} className="grid grid-cols-[1fr_4.5rem] items-center gap-4">
                <p
                  className="text-sm leading-relaxed transition-all duration-500"
                  style={{
                    color: phase === 3 && !keep ? 'var(--muted)' : 'var(--text-body)',
                    opacity: phase === 3 && !keep ? 0.55 : 1,
                    background: phase === 1 ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                    transitionDelay: phase === 1 ? `${i * 120}ms` : '0ms',
                  }}
                >
                  {s.text}
                </p>
                <span className="relative h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }} aria-label={`score ${s.score}`}>
                  <span
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                    style={{ width: phase >= 2 ? `${s.score * 100}%` : '0%', background: keep ? 'var(--accent)' : 'var(--muted)' }}
                  />
                </span>
              </li>
            );
          })}
        </ol>
      </StageWindow>
      <StageWindow title="summary.txt">
        <div className="p-4 text-sm leading-relaxed">
          {phase === 3 ? (
            SENTENCES.filter((s) => ranked.includes(s)).map((s, i) => (
              <p key={i} className="stage-fade mb-2 text-ink" data-on="true">
                {s.text}
              </p>
            ))
          ) : (
            <p className="mono text-muted">Waiting for scores…</p>
          )}
        </div>
      </StageWindow>
    </div>
  );
}
