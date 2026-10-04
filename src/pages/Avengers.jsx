import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ArcReactor from '../components/avengers/ArcReactor';
import Mjolnir from '../components/avengers/Mjolnir';
import Gauntlet from '../components/interests/Gauntlet';
import { STONES, VIEW } from '../components/interests/stones';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import WorldPhotos from '../components/worlds/WorldPhotos';
import Scenes from '../components/worlds/Scenes';
import { hasPhotos, hasScenes } from '../components/worlds/media';
import { useFun } from '../fun/FunProvider';
import { audioContext } from '../lib/audio';
import { useDocumentTitle } from '../lib/hooks';

const sfx = () => import('../lib/sfx');

const ON_DISPLAY = [
  { id: 'marvel-ironman', title: 'Iron Man armour', note: 'On display.' },
  { id: 'marvel-campus', title: 'Avengers Campus', note: 'The Avengers’ own corner of a Disney park.' },
  { id: 'marvel-shield', title: 'Captain America’s shield', note: 'Vibranium, allegedly.' },
  { id: 'marvel-mjolnir', title: 'Mjolnir', note: 'Unlifted, so far.' },
];
const SCENES = ['marvelIronMan', 'marvelAssemble', 'marvelWorthy', 'marvelGroot', 'marvelAllDay', 'marvelPuny', 'marvelBargain', 'snap'];

const JARVIS = [
  'Reactor on standby.',
  'Reactor online. All systems nominal.',
  'Output at 200 percent. The suit is ready when you are.',
  'Output at 400 percent. I would advise against going any higher, sir.',
];

// Where each stone turned up before Thanos came for it.
const WHERE = {
  space: 'The Tesseract. Captain America: The First Avenger, then The Avengers.',
  mind: 'In Loki’s sceptre, then in Vision. The Avengers, Age of Ultron.',
  reality: 'The Aether. Thor: The Dark World.',
  power: 'The Orb, found on Morag. Guardians of the Galaxy.',
  time: 'Inside the Eye of Agamotto. Doctor Strange.',
  soul: 'On Vormir, for a price. Avengers: Infinity War.',
};

// Avengers Tower: the arc reactor, Mjolnir and the Infinity Gauntlet.
export default function Avengers() {
  useDocumentTitle('Avengers Tower');
  const { snap } = useFun();
  const [power, setPower] = useState(0);
  const [blast, setBlast] = useState(0);
  const [have, setHave] = useState([]);
  const intro = useRef(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => intro.current?.stop(), []);

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

  const all = have.length === STONES.length;
  return (
    <div className="relative">
      <section className="shell relative z-10 grid items-center gap-10 pb-16 pt-[calc(var(--nav-h)+36px)] md:pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16" aria-labelledby="tower-title">
        <figure className="reactor-stage m-0">
          <ArcReactor power={power} blast={blast} />
        </figure>
        <div>
          <p className="eyebrow">Avengers Tower · Stark Industries</p>
          <h1 id="tower-title" className="display mt-6 text-[clamp(3rem,1.6rem+4.6vw,5.6rem)]">
            Avengers Tower
          </h1>
          <p className="lead mt-6 max-w-[46ch]">Marvel, all of it. Power up the reactor, try to lift the hammer, and set all six stones if you dare.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={powerUp}>
              {power === 3 ? 'Power down' : 'Power up'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={fire}>
              Fire a repulsor
            </button>
            <button type="button" className="btn btn-ghost" onClick={playIntro} aria-pressed={playing}>
              {playing ? 'Stop the intro' : 'Play the Marvel Studios intro'}
            </button>
            <Link to="/" className="btn btn-ghost">
              Back to the site
            </Link>
          </div>
          <p className="mono mt-5 min-h-[1.5em] text-sm text-accent" role="status">
            J.A.R.V.I.S.: {JARVIS[power]}
          </p>
          <WorldSwitcher className="mt-8" />
        </div>
      </section>

      <section className="shell relative z-10 py-14 md:py-20" aria-labelledby="mjolnir-title">
        <Mjolnir />
      </section>

      <section className="shell relative z-10 pb-16 pt-10 md:pb-20" aria-labelledby="gauntlet-title">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="stones-panel gauntlet-stage" data-all={all || undefined}>
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
                      aria-label={on ? `${s.name}, set` : `Set the ${s.name}`}
                      data-label={s.name}
                      onClick={() => setHave((h) => (on ? h : [...h, s.id]))}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <div>
            <h2 id="gauntlet-title" className="title">
              The Infinity Gauntlet
            </h2>
            <p className="lead mt-4 max-w-[46ch]">Tap a socket to set its stone. With all six, the snap takes half of this page with it, for a few seconds.</p>
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
              <button type="button" className="btn btn-primary" disabled={!all} onClick={snap}>
                Snap
              </button>
              <button type="button" className="btn btn-ghost" disabled={!have.length} onClick={() => setHave([])}>
                Take them out
              </button>
            </div>
          </div>
        </div>
      </section>

      {hasScenes(SCENES) && (
        <section className="shell relative z-10 py-10" aria-labelledby="av-scenes-title">
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
