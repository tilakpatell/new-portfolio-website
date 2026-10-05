import { useMemo, useState } from 'react';
import { CHROMATIC, RAGAS, SWARA_NAME, THAATS, TIMES, ragaOf } from './tuning';
import SwaraLabel from './SwaraLabel';
import { useTuning } from './useTuning';
import './music.css';
import '../../styles/lazy/music.css';

// The raga database (./ragas.js), to browse and tune the room to: find one
// by name, thaat or the time it is sung; see its notes, its way up and down,
// its vadi and samvadi; hear its phrase or its aroha and avaroha on the
// sitar. Or make a raga of your own from any notes, and everything on the
// page follows it as it would any other.

// Sargam written out: N. is mandra Ni, S' taar Sa.
export function Sargam({ text, tune }) {
  return (
    <span className="raga-sargam">
      {String(text)
        .split(/\s+/)
        .filter(Boolean)
        .map((tok, i) => {
          const m = /^([SrRgGmMPdDnN])([.']?)$/.exec(tok);
          if (!m) return null;
          return <SwaraLabel key={i} s={m[1]} oct={m[2] === '.' ? -1 : m[2] === "'" ? 1 : 0} ati={Boolean(tune?.[m[1]])} />;
        })}
    </span>
  );
}

const fold = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export default function RagaBook({ onPhrase, playing }) {
  const [tuning, setTuning] = useTuning();
  const [query, setQuery] = useState('');
  const [thaat, setThaat] = useState('all');
  const [time, setTime] = useState('all');
  const raga = ragaOf(tuning.raga);
  const own = tuning.raga === 'custom';
  // a raga of your own starts from the one you were in
  const ownNotes = tuning.customRaga?.notes || raga.notes;
  const ownName = tuning.customRaga?.name || '';

  const shown = useMemo(() => {
    const q = fold(query.trim());
    return Object.entries(RAGAS).filter(([, r]) => {
      if (thaat !== 'all' && (thaat === 'south' ? r.thaat !== null : r.thaat !== thaat)) return false;
      if (time !== 'all' && r.time !== time) return false;
      return !q || fold(`${r.name} ${r.thaat ?? 'south'} ${TIMES[r.time].label}`).includes(q);
    });
  }, [query, thaat, time]);

  const pick = (id) => setTuning({ raga: id, first: RAGAS[id].first });
  const makeOwn = (notes, name = ownName) => {
    const r = ragaOf('custom', { customRaga: { notes, name } });
    setTuning({ raga: 'custom', customRaga: { notes: r.notes, name }, first: r.first });
  };

  return (
    <div className="raga-book">
      <div className="raga-filters">
        <label className="raga-search">
          <span className="sr-only">Find a raga</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Find a raga: ${Object.keys(RAGAS).length} to choose from`} />
        </label>
        <div className="seg seg-wrap" role="group" aria-label="Thaat">
          {[['all', 'Every thaat'], ...Object.keys(THAATS).map((t) => [t, t]), ['south', 'From the south']].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={thaat === id} onClick={() => setThaat(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="seg seg-wrap" role="group" aria-label="Sung">
          {[['all', 'Any time'], ...Object.entries(TIMES).map(([id, t]) => [id, t.label])].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={time === id} onClick={() => setTime(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="raga-body">
        <div>
          <ul className="raga-list" aria-label="Ragas">
            {shown.map(([id, r]) => (
              <li key={id}>
                <button type="button" aria-pressed={tuning.raga === id} onClick={() => pick(id)}>
                  <span className="raga-list-name">{r.name}</span>
                  <span className="raga-list-meta">
                    {r.thaat ?? 'South'} · {TIMES[r.time].label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!shown.length && <p className="text-sm text-muted">No raga matches. Try another thaat or time, or clear the search.</p>}
        </div>

        <article className="raga-card card" aria-live="polite">
          <p className="label">{own ? 'Your raga' : raga.thaat ? `${raga.thaat} thaat` : 'From the south'}</p>
          <h3 className="title mt-1 text-[1.6rem]">{raga.name}</h3>
          <p className="mt-1 text-sm text-muted">{raga.time ? `Sung ${TIMES[raga.time].when}.` : 'Sung whenever you like.'}</p>
          <dl className="raga-facts">
            <dt>Notes</dt>
            <dd>
              <Sargam text={[...raga.notes].join(' ')} tune={raga.tune} />
            </dd>
            <dt>Aroha</dt>
            <dd>
              <Sargam text={raga.aroha} tune={raga.tune} />
            </dd>
            <dt>Avaroha</dt>
            <dd>
              <Sargam text={raga.avaroha} tune={raga.tune} />
            </dd>
            {raga.vadi && (
              <>
                <dt>Vadi, samvadi</dt>
                <dd>
                  <Sargam text={`${raga.vadi} ${raga.samvadi}`} tune={raga.tune} />
                </dd>
              </>
            )}
            <dt>Tanpura</dt>
            <dd>{raga.first}, Sa, Sa, Sa</dd>
          </dl>
          {raga.tune && (
            <p className="mt-3 text-sm text-muted">
              Two lines under a note: it sits lower than komal, as {raga.name} plays it, and the sitar’s frets and sympathetic strings follow.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={playing} onClick={() => onPhrase()}>
              {playing ? 'Playing…' : 'Hear its phrase'}
            </button>
            <button type="button" className="btn btn-ghost" disabled={playing} onClick={() => onPhrase(`${raga.aroha} - ${raga.avaroha} - -`)}>
              Up and down
            </button>
          </div>
        </article>
      </div>

      <section className="raga-own card" aria-labelledby="raga-own-title">
        <h3 id="raga-own-title" className="stretch-semi text-lg font-semibold text-ink">
          A raga of your own
        </h3>
        <p className="mt-1 text-sm text-muted">Choose its notes; the frets, the sympathetic strings, the harmonium and the tanpura tune to it as you do.</p>
        <label className="raga-own-name mt-3">
          <span className="text-sm">Name</span>
          <input type="text" maxLength={32} value={ownName} placeholder="Your raga" onChange={(e) => makeOwn(ownNotes, e.target.value)} />
        </label>
        <div className="seg seg-wrap mt-3" role="group" aria-label="Its notes">
          {CHROMATIC.map((s) => {
            const on = ownNotes.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                disabled={s === 'S'}
                title={s === 'S' ? 'Every raga has Sa' : undefined}
                aria-label={`${on ? 'Take out' : 'Put in'} ${SWARA_NAME[s]}`}
                onClick={() => makeOwn(on ? ownNotes.replace(s, '') : ownNotes + s)}
              >
                <SwaraLabel s={s} />
              </button>
            );
          })}
        </div>
        {!own && (
          <button type="button" className="btn btn-ghost mt-3" onClick={() => makeOwn(ownNotes)}>
            Tune the room to it
          </button>
        )}
      </section>
    </div>
  );
}
