import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ArcReactor from '../components/avengers/ArcReactor';
import Mjolnir from '../components/avengers/Mjolnir';
import Compound from '../components/avengers/Compound';
import ShieldThrow from '../components/avengers/ShieldThrow';
import Range from '../components/avengers/Range';
import Dossier from '../components/avengers/Dossier';
import HulkLab from '../components/avengers/HulkLab';
import RepulsorRange from '../components/avengers/repulsor/RepulsorRange';
import TrickShot from '../components/avengers/trickshot/TrickShot';
import HoldTheLawn from '../components/avengers/lawn/HoldTheLawn';
import SmashRun from '../components/avengers/smash/SmashRun';
import Ricochet from '../components/avengers/ricochet/Ricochet';
import Titan from '../components/avengers/titan/Titan';
import { earnedStones, hasEarned, useStones } from '../components/avengers/hq/stones';
import { useAchievements } from '../components/Achievements';
import TesseractRun from '../components/avengers/tesseract/TesseractRun';
import Gauntlet from '../components/interests/Gauntlet';
import { STONES, VIEW } from '../components/interests/stones';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import WorldPhotos from '../components/worlds/WorldPhotos';
import Scenes from '../components/worlds/Scenes';
import { hasPhotos, hasScenes } from '../components/worlds/media';
import { useFun } from '../fun/FunProvider';
import { audioContext } from '../lib/audio';
import { jumpTo } from '../lib/anchors';
import { prefersReducedMotion, useDocumentTitle } from '../lib/hooks';

const sfx = () => import('../lib/sfx');

// The tour of the compound, building by building: scrolling down the page
// walks it, and the map beside it shows where you are. It ends in the hangar,
// where the Tesseract is kept.
const FLOORS = [
  { id: 'stark', short: 'Workshop', where: 'Main building · glass wing', title: 'Tony Stark’s workshop', text: 'Where the suits get built and tested. Out back is the test field, and Ultron’s drones are coming over the trees.' },
  { id: 'thor', short: 'The lawn', where: 'Out front', title: 'Thor', text: 'Mjolnir waits in a crater on the terrace, for someone worthy. Lift it, because the Chitauri are coming across the lawn in the rain.' },
  { id: 'cap', short: 'Training', where: 'Training center', title: 'Captain America', text: 'The training center by the river: twelve rooms of training bots, and a shield that bounces off steel. It always comes back.' },
  { id: 'hawkeye', short: 'The range', where: 'The range', title: 'Clint Barton', text: 'A clearing in the pines past the fence, where Clint keeps his eye in: boards out to sixty metres, clays from the traps, and trick arrows for anyone who strings three together.' },
  { id: 'widow', short: 'Operations', where: 'Main building · operations', title: 'Black Widow', text: 'Natasha ran the compound from this room for five years. Her file stays locked. Most of it, anyway.' },
  { id: 'banner', short: 'The lab', where: 'The lab', title: 'Bruce Banner’s lab', text: 'Gamma research, and a scientist who would rather you didn’t push him. Push him anyway: it’s 2012, the portal is open over Stark Tower, and Midtown is full of Chitauri.' },
  { id: 'vault', short: 'Hangar', where: 'The hangar', title: 'The Tesseract', text: 'The Quinjets live here, and so did the quantum tunnel for the time heist. The Tesseract has to come home to it, slung in its case under a Quinjet: over the woods, under the gantry, over the ridge and, with a storm coming in, through the hangar doors. Set it down gently and the Space Stone opens a hole in the sky, as it did over New York.' },
];

const SPOT_IDS = FLOORS.map((f) => f.id);

// which stone each building gives up (Clint's and Natasha's halves of Soul)
const FLOOR_STONE = { stark: 'power', thor: 'reality', cap: 'mind', hawkeye: 'soul-clint', widow: 'soul-natasha', banner: 'time', vault: 'space' };
const stoneOf = (floorId) => {
  const id = FLOOR_STONE[floorId];
  if (!id || !hasEarned(id)) return null;
  return STONES.find((s) => s.id === (id.startsWith('soul') ? 'soul' : id)) ?? null;
};
const SPOT_TITLES = FLOORS.map((f, i) => `${i + 1}. ${f.title}`);

const FRIDAY = [
  'Reactor on standby, boss.',
  'Reactor online. All systems green.',
  'Output at 200 percent. The suit’s ready when you are.',
  'Output at 400 percent. I’d advise against going any higher, boss.',
];

// Where each stone turned up before Thanos came for it.
const WHERE = {
  space: 'The Tesseract. Captain America: The First Avenger, then The Avengers.',
  mind: 'In Loki’s scepter, then in Vision. The Avengers, Age of Ultron.',
  reality: 'The Aether. Thor: The Dark World.',
  power: 'The Orb, found on Morag. Guardians of the Galaxy.',
  time: 'Inside the Eye of Agamotto. Doctor Strange.',
  soul: 'On Vormir, for a price. Avengers: Infinity War.',
};

const ON_DISPLAY = [
  { id: 'marvel-ironman', title: 'Iron Man armor', note: 'From the cave-built Mark I to the suits that followed, under glass.' },
  { id: 'marvel-shield', title: 'Captain America’s shield', note: 'Vibranium, and it shows every dent.' },
  { id: 'marvel-campus', title: 'Avengers Campus', note: 'A Quinjet parked on the roof of the Avengers’ headquarters, at Disney California Adventure.' },
  { id: 'marvel-gauntlet', title: 'The Infinity Gauntlet', note: 'A replica, all six stones set. Snap responsibly.' },
];
const SCENES = ['marvelAssemble', 'marvelGroot', 'snap'];

function Floor({ i, floor, children, aside }) {
  return (
    <section id={`floor-${floor.id}`} data-floor={i} className="tower-floor scroll-mt-28" aria-labelledby={`floor-${floor.id}-title`}>
      <p className="tower-floor-badge">
        {i + 1} · {floor.where}
      </p>
      <h2 id={`floor-${floor.id}-title`} className="title mt-3">
        {floor.title}
      </h2>
      <p className="lead mt-3 max-w-[48ch]">{floor.text}</p>
      <div className={aside ? 'mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)]' : 'mt-7'}>
        <div>{children}</div>
        {aside}
      </div>
    </section>
  );
}

// Avengers HQ: walk the compound past each hero's building to the hangar, open
// the portal with the Tesseract, and come out in front of Thanos.
export default function Avengers() {
  useDocumentTitle('Avengers HQ');
  const { snap } = useFun();
  const { unlock, notify } = useAchievements();
  const earned = useStones();
  const titan = useRef(null);
  const [power, setPower] = useState(0);
  const [blast, setBlast] = useState(0);
  // the gauntlet starts with every stone won back in the games
  const [have, setHave] = useState(earnedStones);
  const [current, setCurrent] = useState(0);
  const [portal, setPortal] = useState(false);
  const [arrived, setArrived] = useState(false);
  const intro = useRef(null);
  const [playing, setPlaying] = useState(false);
  const timers = useRef([]);
  useEffect(
    () => () => {
      intro.current?.stop();
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  // which floor is in the middle of the screen
  useEffect(() => {
    const els = [...document.querySelectorAll('[data-floor]')];
    if (!els.length || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(Number(e.target.dataset.floor));
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const powerUp = () => {
    audioContext(); // in the click, so the reactor can be heard
    sfx().then((s) => s.repulsor());
    setPower((p) => (p + 1) % 4);
  };
  const fire = () => {
    audioContext();
    if (!power) setPower(1);
    sfx().then((s) => s.repulsor());
    setBlast((n) => n + 1);
  };
  const playIntro = async () => {
    if (!audioContext()) return;
    if (intro.current) {
      intro.current.stop();
      intro.current = null;
      setPlaying(false);
      return;
    }
    const c = await import('../lib/clips');
    const clip = await c.playClip('marvel');
    if (!clip) return;
    intro.current = clip;
    setPlaying(true);
    clip.ended.then(() => {
      if (intro.current !== clip) return;
      intro.current = null;
      setPlaying(false);
    });
  };

  // The Space Stone opens the portal over the roof; on the other side, Thanos.
  const openPortal = () => {
    if (portal) return;
    audioContext();
    sfx().then((s) => s.hyperspace());
    setPortal(true);
    const still = prefersReducedMotion();
    timers.current.push(
      setTimeout(
        () => {
          setArrived(true);
          jumpTo(null, 'thanos');
        },
        still ? 200 : 1300,
      ),
      setTimeout(() => setPortal(false), still ? 400 : 2600),
    );
  };

  useEffect(() => setHave((h) => [...new Set([...h, ...earned])]), [earned]);
  const all = have.length === STONES.length;
  // all six taken back by playing: the snap is Tony's
  const heist = earned.length === STONES.length;
  const doSnap = () => {
    audioContext();
    const after = (tony) => {
      if (!tony) {
        snap();
        return;
      }
      sfx().then((s) => s.thunder());
      unlock('whatever');
      notify('I am Iron Man.', 'Every stone, won back on the compound. Thanos and his army are dust; this page is not.', 'note', 'whatever');
    };
    if (titan.current?.snap(heist, after)) return;
    after(heist);
  };
  return (
    <div className="relative">
      <section className="shell relative z-10 grid items-center gap-10 pb-12 pt-[calc(var(--nav-h)+32px)] md:pb-16 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:gap-14" aria-labelledby="hq-title">
        <figure className="m-0">
          <Compound spots={SPOT_IDS} titles={SPOT_TITLES} stones={SPOT_IDS.map((id) => stoneOf(id)?.color ?? null)} onPick={(id) => jumpTo(null, `floor-${id}`)} className="hq-hero-map" live />
          <figcaption className="mt-3 text-sm text-muted">The compound from the air. Pick a pin to go straight to it.</figcaption>
        </figure>
        <div>
          <p className="eyebrow">The Avengers compound · Upstate New York</p>
          <h1 id="hq-title" className="display mt-6 text-[clamp(3rem,1.6rem+4.6vw,5.6rem)]">
            Avengers HQ
          </h1>
          <p className="lead mt-6 max-w-[48ch]">Marvel, all of it. Walk the compound: every building belongs to someone, and the Tesseract is waiting in the hangar.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#floor-stark" className="btn btn-primary" onClick={(e) => jumpTo(e, 'floor-stark')}>
              Start the tour
            </a>
            <button type="button" className="btn btn-ghost" onClick={playIntro} aria-pressed={playing}>
              {playing ? 'Stop the intro' : 'Play the Marvel Studios intro'}
            </button>
            <Link to="/" className="btn btn-ghost">
              Back to the site
            </Link>
          </div>
          <nav className="tower-directory mt-8" aria-label="Places in the compound">
            <p className="label">On the map</p>
            <ol className="mt-3">
              {FLOORS.map((f, i) => (
                <li key={f.id}>
                  <a href={`#floor-${f.id}`} onClick={(e) => jumpTo(e, `floor-${f.id}`)}>
                    <span className="tower-directory-level">{i + 1}</span>
                    {f.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <WorldSwitcher className="mt-8" />
        </div>
      </section>

      <div className="shell relative z-10 grid gap-10 lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-14">
        <aside className="hq-rail" aria-hidden="true">
          <Compound spots={SPOT_IDS} current={current} stones={SPOT_IDS.map((id) => stoneOf(id)?.color ?? null)} compact />
          <p className="hq-now">
            <span className="hq-now-label">You are here</span>
            {FLOORS[current].title}
          </p>
          <ol className="hq-rail-list">
            {FLOORS.map((f, i) => (
              <li key={f.id} data-on={i === current || undefined}>
                <span>{i + 1}</span>
                {f.short}
                {stoneOf(f.id) && <i className="stone-dot hq-rail-stone" style={{ '--glow': stoneOf(f.id).color }} title={stoneOf(f.id).name} />}
              </li>
            ))}
          </ol>
        </aside>
        <div className="grid gap-20 pb-20 md:gap-28">
          <Floor i={0} floor={FLOORS[0]}>
            <RepulsorRange
              fallback={
                <div className="grid items-center gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <figure className="reactor-stage m-0">
                    <ArcReactor power={power} blast={blast} />
                  </figure>
                  <div>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" className="btn btn-primary" onClick={powerUp}>
                        {power === 3 ? 'Power down' : 'Power up'}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={fire}>
                        Fire a repulsor
                      </button>
                    </div>
                    <p className="mono mt-5 min-h-[1.5em] text-sm text-accent" role="status">
                      F.R.I.D.A.Y.: {FRIDAY[power]}
                    </p>
                  </div>
                </div>
              }
            />
          </Floor>
          <Floor i={1} floor={FLOORS[1]}>
            <HoldTheLawn fallback={<Mjolnir />} />
          </Floor>
          <Floor i={2} floor={FLOORS[2]}>
            <Ricochet fallback={<ShieldThrow />} />
          </Floor>
          <Floor i={3} floor={FLOORS[3]}>
            <TrickShot fallback={<Range />} />
          </Floor>
          <Floor i={4} floor={FLOORS[4]}>
            <Dossier />
          </Floor>
          <Floor i={5} floor={FLOORS[5]}>
            <SmashRun fallback={<HulkLab />} />
          </Floor>
          <Floor i={6} floor={FLOORS[6]}>
            <TesseractRun
              onPortal={openPortal}
              fallback={
                <div>
                  <div className="roof-stage" data-portal={portal || undefined}>
                    <svg viewBox="0 0 600 260" className="block h-auto w-full" role="img" aria-label="The Tesseract glowing in a glass containment case">
                      <defs>
                        <radialGradient id="tess-glow">
                          <stop offset="0" stopColor="#d6f3ff" />
                          <stop offset="0.4" stopColor="#4fb8ff" stopOpacity="0.8" />
                          <stop offset="1" stopColor="#1f5fd1" stopOpacity="0" />
                        </radialGradient>
                        <linearGradient id="vault-wall" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#0d1420" />
                          <stop offset="1" stopColor="#1b2534" />
                        </linearGradient>
                      </defs>
                      <rect width="600" height="260" fill="url(#vault-wall)" />
                      {Array.from({ length: 9 }, (_, i) => (
                        <path key={i} d={`M${i * 75} 0 V200`} stroke="#22304a" strokeWidth="2" />
                      ))}
                      <circle className="roof-portal" cx="300" cy="120" r="60" fill="url(#tess-glow)" />
                      <path d="M0 200 H600 V260 H0 Z" fill="#141c29" />
                      <path d="M230 200 h140 l-16 -16 h-108 Z" fill="#2b3748" />
                      <rect x="262" y="96" width="76" height="88" rx="4" fill="rgba(160, 210, 255, 0.07)" stroke="#9fd4ff" strokeOpacity="0.5" strokeWidth="2" />
                      <path d="M268 100 l10 0 l-10 18 Z" fill="#ffffff" opacity="0.15" />
                      <g className="tesseract">
                        <circle cx="300" cy="140" r="34" fill="url(#tess-glow)" />
                        <rect x="286" y="126" width="28" height="28" rx="3" fill="#7fd6ff" stroke="#e6f8ff" strokeWidth="2" transform="rotate(12 300 140)" />
                      </g>
                      <text x="300" y="222" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" letterSpacing="2" fill="#7f9ab8">
                        S.H.I.E.L.D. · CONTAINMENT
                      </text>
                    </svg>
                  </div>
                  <button type="button" className="btn btn-primary mt-6" onClick={openPortal} disabled={portal}>
                    Space
                  </button>
                  <p className="mt-3 text-sm text-muted">The Space Stone opens a portal. Thanos is on the other side.</p>
                </div>
              }
            />
          </Floor>
        </div>
      </div>

      {portal && <div className="portal-flash" aria-hidden="true" />}

      <section id="thanos" className="space-scope relative z-10 py-20 md:py-28" data-arrived={arrived || undefined} aria-labelledby="gauntlet-title">
        <div className="ds-stars pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="shell relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="stones-panel gauntlet-stage" data-all={all || undefined}>
            <Titan
              ref={titan}
              have={have}
              onSet={(id) => setHave((h) => (h.includes(id) ? h : [...h, id]))}
              fallback={
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
                      aria-label={on ? `${s.name}, set` : `Set the ${s.name}`}
                      data-label={s.name}
                      onClick={() => setHave((h) => (on ? h : [...h, s.id]))}
                    />
                  );
                })}
              </div>
            </div>
              }
            />
          </div>
          <div>
            <p className="eyebrow">Titan · beyond the portal</p>
            <h2 id="gauntlet-title" className="title mt-4">
              Thanos
            </h2>
            <p className="lead mt-4 max-w-[46ch]">
              {heist
                ? 'You took every stone back from the compound. Set them, and this time the snap is Tony’s: Thanos and his army turn to dust, and the page stays.'
                : 'He has the gauntlet. Set all six stones, and the snap takes half of this page with it, for a few seconds. Win all six back in the games on the compound, and the snap is Tony’s.'}
            </p>
            <ul className="stone-list mt-6">
              {STONES.map((s) => (
                <li key={s.id} data-on={have.includes(s.id) || undefined} style={{ '--glow': s.color }}>
                  <span className="stone-dot" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-ink">{s.name}</span>
                    <span className="block text-sm text-body">{WHERE[s.id]}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" className="btn btn-primary" disabled={!all} onClick={doSnap}>
                {heist ? 'Snap: I am Iron Man' : 'Snap'}
              </button>
              <button type="button" className="btn btn-ghost" disabled={!have.length} onClick={() => setHave([])}>
                Take them out
              </button>
              <a href="#floor-vault" className="btn btn-ghost" onClick={(e) => jumpTo(e, 'floor-vault')}>
                Back through the portal
              </a>
            </div>
          </div>
        </div>
      </section>

      {hasScenes(SCENES) && (
        <section className="shell relative z-10 py-14" aria-labelledby="av-scenes-title">
          <h2 id="av-scenes-title" className="title">
            From the films
          </h2>
          <div className="mt-8">
            <Scenes names={SCENES} />
          </div>
        </section>
      )}

      {hasPhotos(ON_DISPLAY) && (
        <section className="shell relative z-10 pb-24 pt-10 md:pb-28" aria-labelledby="av-display-title">
          <h2 id="av-display-title" className="title">
            On display
          </h2>
          <p className="lead mt-4 max-w-[54ch]">Props, replicas and a theme park, out in the real world.</p>
          <div className="mt-8">
            <WorldPhotos items={ON_DISPLAY} />
          </div>
        </section>
      )}
    </div>
  );
}
