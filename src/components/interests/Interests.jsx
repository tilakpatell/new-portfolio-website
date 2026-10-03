import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiArrowLeftLine, RiArrowRightLine, RiGamepadLine } from 'react-icons/ri';
import { Waypoint } from '../ui';
import Photo from '../Photo';
import { useFun } from '../../fun/FunProvider';
import { SCRIPTS } from '../../fun/scripts';
import { ACHIEVEMENTS, useAchievements } from '../Achievements';
import { COUNTRY_COUNT } from '../../data/places';
import { countWord } from '../travel/PlacesExplorer';
import MusicCard from './MusicCard';
import InterestDock from './InterestDock';
import { prefersReducedMotion } from '../../lib/hooks';
import Gif from '../Gif';
import Gauntlet from './Gauntlet';
import AutobotMark from '../AutobotMark';
import DecepticonMark from '../DecepticonMark';
import { audioContext } from '../../lib/audio';
import '@fontsource/cinzel/600.css';
import { STONES, VIEW } from './stones';
import { EGGS, EGG_KEY } from '../../fun/eggs';
import { local } from '../../lib/hooks';

const eggsFound = () => {
  const saved = local.get(EGG_KEY, []);
  return Array.isArray(saved) ? saved.filter((id) => EGGS[id]).length : 0;
};

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
  const { script, scriptName, toggleScript } = useFun();
  const { unlock } = useAchievements();
  const [text, setText] = useState('Hello there');
  const [obiWan, setObiWan] = useState(false);
  return (
    <Card
      title="Star Wars"
      className="fun-starwars"
      visual={
        obiWan ? (
          <Gif name="helloThere" eager caption={false} className="h-full [&_.gif-frame]:h-full [&_.gif-frame]:!aspect-auto [&_.gif-frame]:rounded-none" />
        ) : (
        <div className="dark-scope relative grid h-full place-items-center px-5 text-center" style={{ background: '#05070c' }}>
          <div className="ds-stars absolute inset-0" aria-hidden="true" />
          <p className="aurebesh relative text-[1.6rem] leading-snug" style={{ color: 'var(--saber)', overflowWrap: 'anywhere' }} aria-hidden="true">
            {text || ' '}
          </p>
        </div>
        )
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
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <button type="button" className="btn btn-ghost btn-sm" onClick={toggleScript}>
          {script ? SCRIPTS[script].back : `Read the site in ${scriptName}`}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" aria-pressed={obiWan} onClick={() => setObiWan((v) => !v)}>
          Hello there
        </button>
      </div>
    </Card>
  );
}

const RING_WORDS = 'Ash nazg durbatulûk · ash nazg gimbatul · ash nazg thrakatulûk · agh burzum-ishi krimpatul ·';

function MiddleEarth() {
  const { speakFriend } = useFun();
  const [word, setWord] = useState('');
  const [say, setSay] = useState('');
  const [heat, setHeat] = useState(false);
  const speak = (e) => {
    e.preventDefault();
    const w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return;
    if (w === 'mellon') {
      setSay('The doors open.');
      speakFriend('shire');
    } else if (w === 'friend') setSay('Close. Now say it in Elvish.');
    else setSay('The doors stay shut.');
  };
  return (
    <Card
      title="The Lord of the Rings"
      className="fun-lotr"
      visual={
        <div className="ring-panel" data-heat={heat || undefined}>
          <svg viewBox="-150 -80 300 160" role="img" aria-label={heat ? 'The One Ring, its inscription burning' : 'The One Ring'}>
            <defs>
              <linearGradient id="card-ring-gold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff1b8" />
                <stop offset="0.35" stopColor="#e8b44c" />
                <stop offset="0.7" stopColor="#a8741f" />
                <stop offset="1" stopColor="#f6d27a" />
              </linearGradient>
              <path id="card-ring-path" d="M -104 0 A 104 46 0 1 1 104 0 A 104 46 0 1 1 -104 0" />
            </defs>
            <ellipse cx="0" cy="5" rx="114" ry="54" fill="none" stroke="#000" strokeOpacity="0.3" strokeWidth="15" />
            <ellipse cx="0" cy="0" rx="114" ry="54" fill="none" stroke="url(#card-ring-gold)" strokeWidth="15" />
            <ellipse cx="0" cy="-3" rx="109" ry="49" fill="none" stroke="#fff6d6" strokeWidth="1.2" opacity="0.55" />
            <text className="card-ring-text">
              <textPath href="#card-ring-path">{RING_WORDS}</textPath>
            </text>
          </svg>
        </div>
      }
    >
      <p className="mt-2 text-[0.95rem] leading-relaxed text-body">Tolkien’s Middle-earth, the books and the films. The doors of Moria are shut. Speak, friend, and enter:</p>
      <form className="mt-3 flex gap-2" onSubmit={speak}>
        <label htmlFor="mellon-input" className="sr-only">
          The password
        </label>
        <input id="mellon-input" value={word} maxLength={24} onChange={(e) => setWord(e.target.value)} className="fun-input" placeholder="The password" autoComplete="off" />
        <button type="submit" className="btn btn-ghost btn-sm flex-none">
          Speak
        </button>
      </form>
      <p className="mt-2 min-h-[1.25rem] text-sm text-muted" aria-live="polite">
        {say}
      </p>
      <button type="button" className="btn btn-ghost btn-sm mt-auto self-start" aria-pressed={heat} onClick={() => setHeat((h) => !h)}>
        {heat ? 'Out of the fire' : 'Hold it to the fire'}
      </button>
    </Card>
  );
}

function Transformers() {
  const { rollOut } = useFun();
  const [text, setText] = useState('Till all are one');
  const [side, setSide] = useState('autobot');
  const autobot = side === 'autobot';
  const switchSides = () => {
    audioContext(); // in the click, so the transformation can be heard
    import('../../lib/clips').then((c) => c.playClip('transform'));
    setSide(autobot ? 'decepticon' : 'autobot');
  };
  return (
    <Card
      title="Transformers"
      className="fun-tf"
      visual={
        <div className="cy-panel" data-faction={side}>
          <span key={side} className="cy-panel-mark" aria-hidden="true">
            {autobot ? <AutobotMark /> : <DecepticonMark />}
          </span>
          <p className="cy-panel-text" aria-hidden="true">
            {text || ' '}
          </p>
        </div>
      }
    >
      <p className="mt-2 text-[0.95rem] leading-relaxed text-body">
        The Aligned continuity first (War for Cybertron, Prime), with a soft spot for the Bay films. Write something in Cybertronian:
      </p>
      <label htmlFor="cybertronian-input" className="sr-only">
        Text to write in Cybertronian
      </label>
      <input id="cybertronian-input" value={text} maxLength={32} onChange={(e) => setText(e.target.value)} className="fun-input mt-3" autoComplete="off" />
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => rollOut(autobot ? 'optimus' : 'megatron')}>
          {autobot ? 'Autobots, roll out' : 'Decepticons, attack'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={switchSides}>
          {autobot ? 'Join the Decepticons' : 'Join the Autobots'}
        </button>
      </div>
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
      <p className="mt-2 text-sm text-muted">
        Hint: ↑ ↑ ↓ ↓ ← → ← → B A. And there’s a hidden easter egg on every page: {eggsFound()} of {Object.keys(EGGS).length} found.
      </p>
      <Link to="/projects/gameboy-emulator" className="btn btn-ghost btn-sm mt-auto self-start">
        Press Start
      </Link>
    </Card>
  );
}

function Marvel() {
  const { snap } = useFun();
  const [have, setHave] = useState([]);
  const all = have.length === STONES.length;
  const last = STONES.find((s) => s.id === have[have.length - 1]);
  return (
    <Card
      title="Marvel"
      className="fun-marvel"
      visual={
        <div className="stones-panel" data-all={all || undefined}>
          <div className="ds-stars absolute inset-0" aria-hidden="true" />
          <div className="gauntlet-wrap">
            <Gauntlet have={have} all={all} />
            <div className="gauntlet-sockets" role="group" aria-label="Infinity Stones">
              {STONES.map((s) => {
                const on = have.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="socket"
                    style={{ left: `${((s.x - VIEW.x) / VIEW.w) * 100}%`, top: `${((s.y - VIEW.y) / VIEW.h) * 100}%`, '--glow': s.color }}
                    aria-pressed={on}
                    aria-label={on ? `${s.name}, collected` : `Collect the ${s.name}`}
                    data-label={s.name}
                    onClick={() => setHave((h) => (on ? h : [...h, s.id]))}
                  />
                );
              })}
            </div>
          </div>
        </div>
      }
    >
      <p className="mt-2 text-[0.95rem] leading-relaxed text-body">All in on the whole saga. Set all six stones in the gauntlet, then snap.</p>
      <p className="mt-2 text-sm text-muted" aria-live="polite">
        {all ? 'All six. Ready when you are.' : last ? `${last.name} set. ${6 - have.length} to go.` : 'Tap a socket to set its stone.'}
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
  const [clip, setClip] = useState(null);
  return (
    <Card
      title="The Office"
      className="fun-office"
      visual={
        clip ? (
          <Gif key={clip} name={clip} eager caption={false} className="h-full [&_.gif-frame]:h-full [&_.gif-frame]:!aspect-auto [&_.gif-frame]:rounded-none" />
        ) : (
          <div className="memo-panel h-full px-5 py-4">
            <p className="memo-head">Dunder Mifflin · Scranton</p>
            <p className="memo-body" aria-live="polite">
              {FACTS[i]}
            </p>
          </div>
        )
      }
    >
      <p className="mt-2 text-[0.95rem] leading-relaxed text-body">The show I put on in the background more than any other.</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {clip ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setClip(null)}>
            Back to the memo
          </button>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setI((n) => (n + 1) % FACTS.length)}>
            Another fact
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setClip('twss');
            twss(false);
          }}
        >
          That’s what she said
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setClip('parkour')}>
          Parkour!
        </button>
      </div>
      {clip && <p className="mt-2 text-xs text-muted">The Office (NBC), via GIPHY. The speaker button turns the clip’s sound on.</p>}
    </Card>
  );
}

// The show's title card, with my name: Ti (titanium) and Pa (protactinium).
function Tile({ n, sym, mass, name }) {
  return (
    <span className="bb-tile">
      <span className="bb-num">{n}</span>
      <span className="bb-sym">{sym}</span>
      <span className="bb-mass">{mass}</span>
      <span className="bb-name">{name}</span>
    </span>
  );
}

function BreakingBad() {
  const { sayMyName } = useFun();
  const [saul, setSaul] = useState(false);
  return (
    <Card
      title="Breaking Bad & Better Call Saul"
      className="fun-bb"
      visual={
        saul ? (
          <Gif name="saulExcited" eager caption={false} className="h-full [&_.gif-frame]:h-full [&_.gif-frame]:!aspect-auto [&_.gif-frame]:rounded-none" />
        ) : (
        <div className="bb-card">
          <span className="bb-smoke bb-smoke-a" aria-hidden="true" />
          <span className="bb-smoke bb-smoke-b" aria-hidden="true" />
          <p className="bb-title">
            <span className="sr-only">Tilak Patel</span>
            <span className="bb-line" aria-hidden="true">
              <Tile n={22} sym="Ti" mass="47.867" name="Titanium" />
              <span className="bb-rest">lak</span>
            </span>
            <span className="bb-line bb-line-2" aria-hidden="true">
              <Tile n={91} sym="Pa" mass="231.04" name="Protactinium" />
              <span className="bb-rest">tel</span>
            </span>
          </p>
        </div>
        )
      }
    >
      <p className="mt-2 text-[0.95rem] leading-relaxed text-body">Both halves of my name start with a real element: titanium and protactinium.</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <button type="button" className="btn btn-primary btn-sm" onClick={sayMyName}>
          Say my name
        </button>
        <button type="button" className="btn btn-ghost btn-sm" aria-pressed={saul} onClick={() => setSaul((v) => !v)}>
          S’all good, man
        </button>
      </div>
      {saul && <p className="mt-2 text-xs text-muted">Better Call Saul (AMC), via GIPHY.</p>}
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
        <div className="relative">
          <Waypoint top="0.9rem" />
          <h2 id="interests-title" className="title">
            Off the clock
          </h2>
          <p className="lead mt-4 max-w-[52ch]">Star Wars first. Then Indian classical music, Tolkien, Transformers, Marvel, games, The Office, Breaking Bad and a lot of travel.</p>
          <div className="mt-6">
            <InterestDock />
          </div>
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
        <MusicCard />
        <MiddleEarth />
        <Transformers />
        <Marvel />
        <BreakingBad />
        <Office />
        <Gaming />
        <Travel />
      </ul>
    </section>
  );
}
