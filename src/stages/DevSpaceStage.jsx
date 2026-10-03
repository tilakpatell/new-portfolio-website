import { useEffect, useState } from 'react';
import { RiTrophyLine } from 'react-icons/ri';
import { StageWindow } from './StageKit';
import { useInView, useReducedMotion } from '../lib/hooks';

// Two people typing into the same CUDA file at once, then running it on the Jetson.
const CODE = [
  { who: 0, text: '__global__ void add(int *a, int *b, int *c) {' },
  { who: 0, text: '  int i = blockIdx.x * blockDim.x + threadIdx.x;' },
  { who: 0, text: '  c[i] = a[i] + b[i];' },
  { who: 0, text: '}' },
  { who: -1, text: '' },
  { who: 1, text: 'int main() {' },
  { who: 1, text: '  add<<<4, 64>>>(d_a, d_b, d_c);' },
  { who: 1, text: '  cudaDeviceSynchronize();' },
  { who: 1, text: '  return 0;' },
  { who: 1, text: '}' },
];
const PEOPLE = [
  { name: 'tilak', color: 'var(--accent)' },
  { name: 'teammate', color: '#7cc8ff' },
];
const TERMINAL = [
  '$ devspace run kernel.cu --gpu',
  '→ container devspace-cuda on jetson-nano',
  '→ nvcc kernel.cu -o kernel',
  '→ launched 4 blocks × 64 threads',
  '✓ exited 0',
];

const lanes = [0, 1].map((who) => CODE.map((l, i) => ({ ...l, i })).filter((l) => l.who === who));
const laneLength = (lane) => lane.reduce((n, l) => n + l.text.length + 1, 0);
const TOTAL = Math.max(...lanes.map(laneLength));

function progressFor(lane, typed) {
  const out = {};
  let left = typed;
  let cursor = null;
  for (const l of lane) {
    const n = Math.min(l.text.length, Math.max(0, left));
    out[l.i] = n;
    if (left >= 0 && left <= l.text.length) cursor = { line: l.i, col: n };
    left -= l.text.length + 1;
  }
  if (!cursor) {
    const last = lane[lane.length - 1];
    cursor = { line: last.i, col: last.text.length };
  }
  return { out, cursor };
}

function highlight(text) {
  return text.split(/(\b(?:__global__|void|int|return)\b|<<<|>>>|\/\/.*$)/).map((part, i) => {
    if (/^(__global__|void|int|return)$/.test(part)) return <span key={i} className="text-accent">{part}</span>;
    if (part === '<<<' || part === '>>>') return <span key={i} style={{ color: '#7cc8ff' }}>{part}</span>;
    return <span key={i}>{part}</span>;
  });
}

export default function DevSpaceStage() {
  const [ref, inView] = useInView({ rootMargin: '0px' });
  const reduced = useReducedMotion();
  const [typed, setTyped] = useState(reduced ? TOTAL + 40 : 0);

  useEffect(() => {
    if (!inView || reduced) return undefined;
    const t = setInterval(() => setTyped((n) => (n > TOTAL + 110 ? 0 : n + 1)), 42);
    return () => clearInterval(t);
  }, [inView, reduced]);

  const a = progressFor(lanes[0], typed);
  const b = progressFor(lanes[1], typed);
  const shown = { ...a.out, ...b.out };
  const termLines = Math.max(0, Math.min(TERMINAL.length, Math.floor((typed - TOTAL - 4) / 14)));
  const cursors = [a.cursor, b.cursor];

  return (
    <div ref={ref} className="grid gap-4">
      <StageWindow
        title="kernel.cu — DevSpace"
        right={
          <span className="flex items-center gap-1.5">
            {PEOPLE.map((p) => (
              <span key={p.name} className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} title={p.name} />
            ))}
            <span className="ml-1">2 editing</span>
          </span>
        }
      >
        <div className="stage-code relative grid grid-cols-[2.5rem_1fr] overflow-x-auto px-2 py-4">
          {CODE.map((l, i) => {
            const n = l.who < 0 ? 0 : shown[i] ?? 0;
            return [
              <span key={`n${i}`} className="select-none pr-3 text-right text-muted">
                {i + 1}
              </span>,
              <span key={`l${i}`} className="relative whitespace-pre text-body">
                {highlight(l.text.slice(0, n))}
                {cursors.map((c, who) =>
                  c.line === i && typed <= TOTAL + 2 ? (
                    <span key={who} className="relative inline-block h-[1.15em] w-0 align-[-0.2em]">
                      <span className="absolute left-0 top-0 h-full w-[2px]" style={{ background: PEOPLE[who].color }} />
                      <span className="stage-flag" style={{ background: PEOPLE[who].color }}>
                        {PEOPLE[who].name}
                      </span>
                    </span>
                  ) : null,
                )}
              </span>,
            ];
          })}
        </div>
      </StageWindow>
      <StageWindow title="terminal — jetson-nano (CUDA)">
        <div className="stage-code min-h-[9.5rem] px-4 py-3">
          {TERMINAL.slice(0, termLines).map((line, i) => (
            <p key={i} className={i === 0 ? 'text-ink' : line.startsWith('✓') ? 'text-accent' : 'text-muted'}>
              {line}
            </p>
          ))}
          {termLines < TERMINAL.length && <span className="stage-caret anim-blink" aria-hidden="true" />}
        </div>
      </StageWindow>
      <p className="flex items-center gap-2 text-sm text-body">
        <RiTrophyLine className="h-4 w-4 text-accent" aria-hidden="true" />
        HackBeanpot — 1st place
      </p>
    </div>
  );
}
