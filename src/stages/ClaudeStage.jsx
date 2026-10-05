import { useEffect, useState } from 'react';
import { useInView, useReducedMotion } from '../lib/hooks';
import './stages.css';
import { ClaudeSpark } from './ClaudeSpark';

// Claude reading one scanned page and streaming the translation back.

const ANSWER = [
  { t: 'Chapter 1', b: true, br: 2 },
  { t: 'Shriji Maharaj', i: true },
  { t: ' was seated in the ' },
  { t: 'darbar', i: true },
  { t: ' of Dada Khachar in Gadhada. Many ' },
  { t: 'sadhus', i: true },
  { t: ' and devotees were seated in the assembly.', br: 2 },
  { t: 'Lord of ' },
  { t: 'Akshardham', i: true },
  { t: ',', br: 1 },
  { t: 'Sahajanand Swami.', br: 2 },
  { t: '1. Gadhada, in Saurashtra.' },
];
const WORDS = ANSWER.flatMap((run, r) =>
  (run.t.match(/\S+\s*|\s+/g) || []).map((w, k, arr) => ({ ...run, t: w, br: k === arr.length - 1 ? run.br : 0, key: `${r}-${k}` })),
);

export default function ClaudeStage() {
  const [ref, inView] = useInView({ rootMargin: '0px' });
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(reduced ? 3 : 0); // 0 prompt · 1 thinking · 2 streaming · 3 done
  const [n, setN] = useState(reduced ? WORDS.length : 0);

  useEffect(() => {
    if (!inView || reduced) return undefined;
    let t;
    if (phase === 0) t = setTimeout(() => setPhase(1), 900);
    else if (phase === 1) t = setTimeout(() => setPhase(2), 1500);
    else if (phase === 2) {
      if (n < WORDS.length) t = setTimeout(() => setN((x) => x + 1), 55);
      else t = setTimeout(() => setPhase(3), 300);
    } else
      t = setTimeout(() => {
        setN(0);
        setPhase(0);
      }, 3600);
    return () => clearTimeout(t);
  }, [phase, n, inView, reduced]);

  return (
    <div ref={ref} className="claude-ui overflow-hidden rounded-card border">
      <div className="claude-bar flex items-center gap-2.5 px-4 py-3">
        <ClaudeSpark spinning={phase === 1 || phase === 2} className="h-5 w-5" />
        <span className="font-medium">Claude</span>
        <span className="mono ml-auto text-xs opacity-70">translation · page 12</span>
      </div>
      <div className="grid gap-5 px-4 py-5 sm:px-6">
        {/* the request */}
        <div className="ml-auto max-w-[34rem] rounded-2xl px-4 py-3 claude-user">
          <p>Translate page 12 into English. Keep the locked glossary terms in italics, and set verse as verse.</p>
          <p className="mono mt-2 flex flex-wrap gap-2 text-[0.72rem] opacity-80">
            <span className="claude-chip">page-012.png</span>
            <span className="claude-chip">ocr-012.json</span>
            <span className="claude-chip">glossary · 247 terms</span>
          </p>
        </div>

        {/* the answer */}
        <div className="flex gap-3">
          <ClaudeSpark spinning={phase === 1 || phase === 2} className="mt-1 h-6 w-6 flex-none" />
          <div className="min-h-[11rem] flex-1">
            {phase === 1 && <p className="claude-shimmer">Reading the page image and the OCR together…</p>}
            {phase >= 2 && (
              <p className="claude-answer whitespace-pre-wrap">
                {WORDS.slice(0, n).map((w) => (
                  <span key={w.key} className={w.b ? 'text-[1.15em] font-semibold' : ''}>
                    {w.i ? <em className="claude-term">{w.t}</em> : w.t}
                    {w.br ? '\n'.repeat(w.br) : ''}
                  </span>
                ))}
                {phase === 2 && <span className="claude-caret" aria-hidden="true" />}
              </p>
            )}
            {phase === 3 && (
              <p className="mono mt-4 flex flex-wrap gap-2 text-[0.72rem]">
                <span className="claude-chip claude-chip-accent">prompt cache hit · style guide + glossary</span>
                <span className="claude-chip">4 glossary terms locked</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
