import { useState } from 'react';

// Natasha Romanoff's S.H.I.E.L.D. file, partly redacted. Hover, tap or focus a
// black bar to declassify it.
const FILE = [
  ['Name', ['Natasha Romanoff']],
  ['Codename', ['Black Widow']],
  ['Trained', ['in the ', { r: 'Red Room' }, ', from childhood.']],
  ['Recruited', ['by ', { r: 'Clint Barton' }, ', who was sent to kill her and made a different call.']],
  ['Status', ['Avenger. Has ', { r: 'red in her ledger' }, ' and is wiping it out.']],
];

export default function Dossier() {
  const [open, setOpen] = useState(() => new Set());
  const reveal = (k) => setOpen((s) => new Set(s).add(k));
  let n = 0;
  return (
    <div className="dossier">
      <p className="dossier-head">S.H.I.E.L.D. · Personnel file · Level 7</p>
      <dl className="mt-4 grid gap-3">
        {FILE.map(([label, parts]) => (
          <div key={label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
            <dt className="dossier-label">{label}</dt>
            <dd className="m-0">
              {parts.map((part) => {
                if (typeof part === 'string') return part;
                const k = n++;
                const shown = open.has(k);
                return (
                  <button key={k} type="button" className="redacted" data-open={shown || undefined} onMouseEnter={() => reveal(k)} onFocus={() => reveal(k)} onClick={() => reveal(k)} aria-label={shown ? part.r : 'Redacted. Press to declassify'}>
                    <span aria-hidden={!shown}>{part.r}</span>
                  </button>
                );
              })}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-muted">{open.size === 3 ? 'Fully declassified. Clearance noted.' : `${3 - open.size} redacted ${3 - open.size === 1 ? 'line' : 'lines'} left.`}</p>
    </div>
  );
}
