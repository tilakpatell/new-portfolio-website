import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiArrowLeftLine, RiArrowRightLine, RiGamepadLine } from 'react-icons/ri';
import { Waypoint } from '../ui';
import Photo from '../Photo';
import { useFun } from '../../fun/FunProvider';
import { ACHIEVEMENTS, useAchievements } from '../Achievements';
import { COUNTRY_COUNT } from '../../data/places';
import { countWord } from '../travel/PlacesExplorer';
import { prefersReducedMotion } from '../../lib/hooks';

// What I'm into when I'm not writing code, one interactive card each.

function Card({ title, children, visual, className = '' }) {
  return (
    <li className={`fun-card ${className}`}>
      <div className="fun-visual">{visual}</div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="stretch-semi text-xl font-semibold text-ink">{title}</h3>
        {children}
      </div>
    </li>
  );
}

function StarWars() {
  const { aurebesh, toggleAurebesh } = useFun();
  const { unlock } = useAchievements();
  const [text, setText] = useState('Hello there');
  return (
    <Card
      title="Star Wars"
      className="fun-starwars"
      visual={
        <div className="dark-scope relative grid h-full place-items-center px-5 text-center" style={{ background: '#05070c' }}>
          <div className="ds-stars absolute inset-0" aria-hidden="true" />
          <p className="aurebesh relative text-[1.6rem] leading-snug" style={{ color: 'var(--saber)', overflowWrap: 'anywhere' }} aria-hidden="true">
            {text || ' '}
          </p>
        </div>
      }
    >
      <p className="mt-2 text-[0.95rem] leading-relaxed text-body">The theme of this whole site, if you hadn’t noticed. Write something in Aurebesh:</p>
      <label htmlFor="aurebesh-input" className="sr-only">
        Text to write in Aurebesh
      </label>
      <input
        id="aurebesh-input"
        value={text}
        maxLength={40}
        onChange={(e) => {
          setText(e.target.value);
          unlock('aurebesh');
        }}
        className="fun-input mt-3"
        autoComplete="off"
      />
      <button type="button" className="btn btn-ghost btn-sm mt-auto self-start" onClick={toggleAurebesh}>
        {aurebesh ? 'Back to Basic' : 'Read the site in Aurebesh'}
      </button>
    </Card>
  );
}

function Sitar() {
  const { unlock } = useAchievements();
  const [lit, setLit] = useState(-1);
  const [noSound, setNoSound] = useState(false);
  const strings = useRef(null);
  const down = useRef(null);
  const plucks = useRef(0);
  const notes = ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni', 'Sa’'];

  const play = useCallback(
    async (i) => {
      const { pluck } = await import('./sitar');
      if (!pluck(i)) setNoSound(true);
      setLit(i);
      const el = strings.current?.querySelectorAll('.sitar-string')[i];
      if (el && !prefersReducedMotion()) {
        el.classList.remove('is-plucked');
        void el.offsetWidth;
        el.classList.add('is-plucked');
      }
      plucks.current += 1;
      if (plucks.current >= 8) unlock('raga');
    },
    [unlock],
  );

  const indexAt = (x) => {
    const r = strings.current.getBoundingClientRect();
    return Math.max(0, Math.min(7, Math.floor(((x - r.left) / r.width) * 8)));
  };

  return (
    <Card
      title="Sitar"
      className="fun-sitar"
      visual={
        <div
          ref={strings}
          className="sitar-neck"
          onPointerDown={(e) => {
            if (e.target.closest('button')) return; // the buttons handle their own clicks
            const i = indexAt(e.clientX);
            down.current = { id: e.pointerId, i };
            e.currentTarget.setPointerCapture?.(e.pointerId);
            play(i);
          }}
          onPointerMove={(e) => {
            const d = down.current;
            if (!d || d.id !== e.pointerId) return;
            const i = indexAt(e.clientX);
            if (i !== d.i) {
              d.i = i;
              play(i);
            }
          }}
          onPointerUp={() => (down.current = null)}
          onPointerCancel={() => (down.current = null)}
        >
          <span className="sitar-fret" style={{ top: '22%' }} aria-hidden="true" />
          <span className="sitar-fret" style={{ top: '44%' }} aria-hidden="true" />
          <span className="sitar-fret" style={{ top: '66%' }} aria-hidden="true" />
          {notes.map((n, i) => (
            <button key={n} type="button" className="sitar-string" data-lit={lit === i || undefined} onClick={(e) => e.detail === 0 && play(i)} aria-label={`Pluck ${n}`}>
              <span className="sitar-wire" aria-hidden="true" />
              <span className="sitar-note">{n}</span>
            </button>
          ))}
        </div>
      }
    >
      <p className="mt-2 text-[0.95rem] leading-relaxed text-body">I play sitar. Pluck a string, or drag across them to strum. The sound is made right here in your browser.</p>
      {noSound && <p className="mt-2 text-sm text-muted">This browser can’t play sound here.</p>}
      <p className="mt-auto pt-4 text-xs text-muted">Sa Re Ga Ma Pa Dha Ni Sa, tuned to C♯</p>
    </Card>
  );
}

function Gaming() {
  const { unlocked } = useAchievements();
  const total = Object.keys(ACHIEVEMENTS).length;
  return (
    <Card
      title="Gaming"
      className="fun-gaming"
      visual={
        <div className="pixel-panel grid h-full place-items-center">
          <div className="text-center">
            <RiGamepadLine className="mx-auto h-10 w-10" style={{ color: '#8bc11a' }} aria-hidden="true" />
            <div className="pixel-row mt-4" role="img" aria-label={`${unlocked.length} of ${total} achievements unlocked`}>
              {Array.from({ length: total }, (_, i) => (
                <span key={i} data-on={i < unlocked.length || undefined} />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <p className="mt-2 text-[0.95rem] leading-relaxed text-body">
        Games got me into code. This site keeps score: {unlocked.length} of {total} achievements unlocked.
      </p>
      <p className="mt-2 text-sm text-muted">Hint: ↑ ↑ ↓ ↓ ← → ← → B A</p>
      <Link to="/projects/gameboy-emulator" className="btn btn-ghost btn-sm mt-auto self-start">
        Press Start
      </Link>
    </Card>
  );
}

const STONES = [
  { id: 'space', name: 'Space Stone', color: '#2f6ce0' },
  { id: 'mind', name: 'Mind Stone', color: '#f2c230' },
  { id: 'reality', name: 'Reality Stone', color: '#d7263d' },
  { id: 'power', name: 'Power Stone', color: '#8e44ad' },
  { id: 'time', name: 'Time Stone', color: '#2fa84f' },
  { id: 'soul', name: 'Soul Stone', color: '#f28c28' },
];

function Marvel() {
  const { snap } = useFun();
  const [have, setHave] = useState([]);
  const all = have.length === STONES.length;
  return (
    <Card
      title="Marvel"
      className="fun-marvel"
      visual={
        <div className="stones-panel grid h-full place-items-center">
          <div className="flex gap-3" role="group" aria-label="Infinity Stones">
            {STONES.map((s) => {
              const on = have.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className="stone"
                  aria-pressed={on}
                  aria-label={on ? `${s.name}, collected` : `Collect the ${s.name}`}
                  style={{ '--stone': s.color }}
                  onClick={() => setHave((h) => (on ? h : [...h, s.id]))}
                />
              );
            })}
          </div>
        </div>
      }
    >
      <p className="mt-2 text-[0.95rem] leading-relaxed text-body">All in on the whole saga. Collect the six stones, then snap.</p>
      <p className="mt-2 text-sm text-muted" aria-live="polite">
        {all ? 'All six. Ready.' : `${have.length} of 6 collected`}
      </p>
      <button type="button" className="btn btn-primary btn-sm mt-auto self-start" disabled={!all} onClick={snap}>
        Snap
      </button>
    </Card>
  );
}

const FACTS = [
  'Fact: this site has more easter eggs than Schrute Farms has beets.',
  'Fact: the terminal answers to order66. Questions?',
  'Bears. Beets. Battlestar Galactica.',
  'Fact: every skill on the résumé lights up when you click it. False: you are too busy to try.',
  'Fact: typing twss anywhere on this site earns a Dundie.',
];

function Office() {
  const { twss } = useFun();
  const [i, setI] = useState(0);
  return (
    <Card
      title="The Office"
      className="fun-office"
      visual={
        <div className="memo-panel h-full px-5 py-4">
          <p className="memo-head">Dunder Mifflin · Scranton</p>
          <p className="memo-body" aria-live="polite">
            {FACTS[i]}
          </p>
        </div>
      }
    >
      <p className="mt-2 text-[0.95rem] leading-relaxed text-body">The show I put on in the background more than any other.</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setI((n) => (n + 1) % FACTS.length)}>
          Another fact
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={twss}>
          That’s what she said
        </button>
      </div>
    </Card>
  );
}

function BreakingBad() {
  const { sayMyName } = useFun();
  return (
    <Card
      title="Breaking Bad"
      className="fun-bb"
      visual={
        <div className="bb-panel grid h-full place-items-center">
          <p className="display text-[3.4rem]" aria-label="Ti and Pa">
            <span className="element">
              <sup aria-hidden="true">22</sup>Ti<sub aria-hidden="true">47.867</sub>
            </span>
            <span className="element ml-2">
              <sup aria-hidden="true">91</sup>Pa<sub aria-hidden="true">231.04</sub>
            </span>
          </p>
        </div>
      }
    >
      <p className="mt-2 text-[0.95rem] leading-relaxed text-body">Both halves of my name start with an element: titanium and protactinium.</p>
      <button type="button" className="btn btn-primary btn-sm mt-auto self-start" onClick={sayMyName}>
        Say my name
      </button>
    </Card>
  );
}

function Travel() {
  return (
    <Card
      title="Travel"
      className="fun-travel"
      visual={<Photo id="band" sizes="360px" className="h-full w-full object-cover" alt="" />}
    >
      <p className="mt-2 text-[0.95rem] leading-relaxed text-body">
        {countWord(COUNTRY_COUNT)} countries and the Caribbean, mostly chasing mountains and lakes.
      </p>
      <Link to="/travel" className="btn btn-ghost btn-sm mt-auto self-start">
        See the travel page
      </Link>
    </Card>
  );
}

export default function Interests() {
  const row = useRef(null);
  const scroll = (dir) => {
    const el = row.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.85, 720), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  return (
    <section data-theme-section="aws" className="relative z-10 py-14 md:py-20" aria-labelledby="interests-title">
      <div className="shell relative flex flex-wrap items-end justify-between gap-6">
        <div>
          <Waypoint top="0.9rem" />
          <h2 id="interests-title" className="title">
            Off the clock
          </h2>
          <p className="lead mt-4 max-w-[52ch]">Star Wars first. Then sitar, games, Marvel, The Office, Breaking Bad and a lot of travel.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="globe-btn" onClick={() => scroll(-1)} aria-label="Previous interests">
            <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className="globe-btn" onClick={() => scroll(1)} aria-label="More interests">
            <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <ul ref={row} className="fun-row mt-10" aria-label="Interests">
        <StarWars />
        <Sitar />
        <Marvel />
        <BreakingBad />
        <Office />
        <Gaming />
        <Travel />
      </ul>
    </section>
  );
}
