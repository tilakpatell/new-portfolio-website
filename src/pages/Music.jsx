import { useEffect, useRef, useState } from 'react';
import { RiPauseFill, RiPlayFill } from 'react-icons/ri';
import Photo from '../components/Photo';
import PhotoCredits from '../components/travel/PhotoCredits';
import { Waypoint } from '../components/ui';
import { useAchievements } from '../components/Achievements';
import { useDocumentTitle } from '../lib/hooks';
import { audioContext } from '../lib/audio';
import {
  FIRST_STRING,
  LISTEN_URL,
  RAGAS,
  SA_NOTES,
  chikari,
  dayanHz,
  playPhrase,
  saHz,
  setTanpuraListener,
  startTanpura,
  stopAll,
  stopTanpura,
  tanpuraPlaying,
  tanpuraStrings,
} from '../components/music/engine';
import { useTuning } from '../components/music/useTuning';
import SitarNeck from '../components/music/SitarNeck';
import Harmonium from '../components/music/Harmonium';
import Tabla from '../components/music/Tabla.jsx'; // tabla.js sits beside it, and a case-blind disk (macOS) would pick that
import Egg from '../components/Egg';
import WorldSwitcher from '../components/worlds/WorldSwitcher';

const CREDIT = 'https://commons.wikimedia.org/wiki/File:Sitar_clipping.ogg';
const hz = (f) => `${f.toFixed(1)} Hz`;

// The tanpura's drone, shared by the controls at the top and the floating one.
function useDrone() {
  const [on, setOn] = useState(tanpuraPlaying);
  // the string sounding now, and a count so each pluck restarts its animation
  const [pluck, setPluck] = useState({ i: -1, n: 0 });
  const onPluck = (i) => setPluck((p) => ({ i, n: p.n + 1 }));
  useEffect(() => {
    if (tanpuraPlaying()) setTanpuraListener(onPluck);
  }, []);
  const toggle = () => {
    if (!audioContext()) return; // inside the click, so the drone may play
    if (tanpuraPlaying()) {
      stopTanpura();
      setOn(false);
      setPluck({ i: -1, n: 0 });
    } else {
      startTanpura(onPluck);
      setOn(true);
    }
  };
  return { on, pluck, toggle };
}

function Tuning({ drone }) {
  const [tuning, setTuning] = useTuning();
  return (
    <div className="music-tuning card">
      <div>
        <p className="label" id="sa-label">
          Sa
        </p>
        <div className="seg seg-wrap mt-2" role="group" aria-labelledby="sa-label">
          {SA_NOTES.map((n, i) => (
            <button key={n} type="button" aria-pressed={tuning.sa === i} onClick={() => setTuning({ sa: i })} aria-label={`Sa on ${n}, ${hz(saHz(i))}`}>
              {n}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">
          Sa is {SA_NOTES[tuning.sa]}3, {hz(saHz(tuning.sa))}. The tabla’s right drum rings at {hz(dayanHz())}.
        </p>
      </div>
      <div>
        <p className="label" id="raga-label">
          Raga
        </p>
        <div className="seg seg-wrap mt-2" role="group" aria-labelledby="raga-label">
          {Object.entries(RAGAS).map(([id, r]) => (
            <button key={id} type="button" aria-pressed={tuning.raga === id} onClick={() => setTuning({ raga: id, first: r.first })}>
              {r.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">
          {RAGAS[tuning.raga].name}, a raga for the {RAGAS[tuning.raga].time.toLowerCase()}. The sitar’s frets and sympathetic strings follow it.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div>
          <p className="label" id="first-label">
            Tanpura, first string
          </p>
          <div className="seg mt-2" role="group" aria-labelledby="first-label">
            {Object.entries(FIRST_STRING).map(([id, f]) => (
              <button key={id} type="button" aria-pressed={tuning.first === id} onClick={() => setTuning({ first: id })}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={drone.toggle} aria-pressed={drone.on}>
          {drone.on ? <RiPauseFill className="h-4 w-4" aria-hidden="true" /> : <RiPlayFill className="h-4 w-4" aria-hidden="true" />}
          {drone.on ? 'Stop the tanpura' : 'Start the tanpura'}
        </button>
      </div>
    </div>
  );
}

function TanpuraStrings({ pluck }) {
  const [tuning] = useTuning();
  const strings = tanpuraStrings(tuning);
  const names = ['First', 'Second', 'Third', 'Fourth'];
  return (
    <ol className="tanpura-board" aria-label="The tanpura’s four strings">
      {strings.map((s, i) => (
        <li key={i} className="tanpura-string" data-lit={pluck.i === i || undefined}>
          <span className="tanpura-wire" key={pluck.i === i ? `p${pluck.n}` : 'idle'} aria-hidden="true" />
          <span className="text-sm font-semibold text-ink">{i === 0 ? `${s.label} (low)` : i === 3 ? 'Sa (low)' : 'Sa'}</span>
          <span className="mono text-xs text-muted">{hz(s.hz)}</span>
          <span className="sr-only">{names[i]} string</span>
        </li>
      ))}
    </ol>
  );
}

function Listen() {
  const [listening, setListening] = useState(false);
  const [progress, setProgress] = useState(0);
  const el = useRef(null);
  useEffect(() => () => el.current?.pause(), []);
  const toggle = () => {
    let a = el.current;
    if (!a) {
      a = new Audio(LISTEN_URL);
      a.preload = 'auto';
      a.addEventListener('timeupdate', () => setProgress(a.duration ? a.currentTime / a.duration : 0));
      a.addEventListener('ended', () => {
        setListening(false);
        setProgress(0);
      });
      a.addEventListener('pause', () => setListening(false));
      a.addEventListener('play', () => setListening(true));
      el.current = a;
    }
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };
  return (
    <button type="button" className="btn btn-ghost listen-btn" aria-pressed={listening} onClick={toggle} style={{ '--p': progress }}>
      {listening ? <RiPauseFill className="h-4 w-4" aria-hidden="true" /> : <RiPlayFill className="h-4 w-4" aria-hidden="true" />}
      Listen to a real sitar
    </button>
  );
}

export default function Music() {
  useDocumentTitle('Indian classical music');
  const [tuning] = useTuning();
  const { unlock } = useAchievements();
  const drone = useDrone();
  const [phrase, setPhrase] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const used = useRef(new Set());
  const notes = useRef(0);
  const hero = useRef(null);

  useEffect(() => () => stopAll(), []);
  useEffect(() => {
    const el = hero.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setPastHero(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onPlay = (instrument) => {
    used.current.add(instrument);
    if (used.current.size === 3) unlock('jugalbandi');
    if (instrument === 'sitar' && ++notes.current >= 8) unlock('raga');
  };
  const play = async () => {
    if (!audioContext()) return;
    onPlay('sitar');
    notes.current += 8;
    unlock('raga');
    const seconds = await playPhrase(tuning.raga);
    if (!seconds) return;
    setPhrase(true);
    setTimeout(() => setPhrase(false), seconds * 1000 + 400);
  };

  return (
    <>
      <section ref={hero} className="shell relative z-10 pb-12 pt-[calc(var(--nav-h)+40px)] md:pb-20 md:pt-[calc(var(--nav-h)+72px)]" aria-labelledby="music-title">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
          <div className="relative">
            <Waypoint top="0.6rem" />
            <p className="eyebrow">Riyaz room</p>
            <h1 id="music-title" className="display mt-5 text-[clamp(2.6rem,1.4rem+5vw,5rem)]">
              Indian classical music
            </h1>
            <p className="lead mt-6 max-w-[54ch]">
              I play sitar. Pick a Sa and a raga, start the tanpura, and everything on this page tunes to it: the sitar, the harmonium and the tabla.
            </p>
            <WorldSwitcher className="mt-7" />
          </div>
          <figure className="music-hero-photo m-0">
            <Photo id="music-sitar" sizes="(min-width: 1024px) 40vw, 100vw" priority className="h-full w-full object-cover" />
          </figure>
        </div>
        <div className="mt-10">
          <Tuning drone={drone} />
        </div>
      </section>

      <section className="shell relative z-10 py-14 md:py-20" aria-labelledby="tanpura-title">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="relative">
            <Waypoint top="0.9rem" />
            <h2 id="tanpura-title" className="title">
              Tanpura
            </h2>
            <p className="lead mt-4 max-w-[52ch]">
              The drone everything else sits on. Four strings, plucked slowly in turn and never fretted: the first tuned to {FIRST_STRING[tuning.first].note}, then
              Sa, Sa, and Sa an octave down.
            </p>
            <p className="mt-4 max-w-[60ch] text-[0.95rem] leading-relaxed text-body">
              Pa is the usual first string. Ragas that leave Pa out, like Malkauns, tune it to Ma instead; ragas built around Ni, like Marwa, tune it to Ni. Its
              bridge is a wide curve with a thread under each string, which is what makes a tanpura shimmer: the overtones bloom after each pluck instead of
              fading.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] sm:items-center">
            <TanpuraStrings pluck={drone.pluck} />
            <figure className="music-photo m-0">
              <Photo id="music-tanpura" sizes="(min-width: 640px) 30vw, 100vw" className="h-full w-full object-cover" />
            </figure>
          </div>
        </div>
      </section>

      <section className="shell relative z-10 py-14 md:py-20" aria-labelledby="sitar-title">
        <div className="relative">
          <Waypoint top="0.9rem" />
          <h2 id="sitar-title" className="title">
            Sitar
          </h2>
          <p className="lead mt-4 max-w-[60ch]">
            Every swara has a fret, from mandra Pa to taar Ga, and the raga’s notes are lit. Tap a fret to pluck it. Hold and slide along the neck to glide
            between frets, or pull the string across the fret to bend it: meend.
          </p>
        </div>
        <div className="mt-8">
          <SitarNeck onPlay={onPlay} />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={play} disabled={phrase}>
            {phrase ? 'Playing…' : `Play a phrase in ${RAGAS[tuning.raga].name}`}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (!audioContext()) return;
              chikari();
              onPlay('sitar');
            }}
          >
            Chikari
          </button>
          <Listen />
        </div>
        <div className="mt-12 grid items-center gap-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-12">
          <figure className="music-photo m-0">
            <Photo id="music-tarab" sizes="(min-width: 768px) 36vw, 100vw" className="h-full w-full object-cover" />
          </figure>
          <div className="max-w-[62ch] text-[0.95rem] leading-relaxed text-body">
            <h3 className="stretch-semi text-xl font-semibold text-ink">Real strokes, on every fret</h3>
            <p className="mt-3">
              Each note is a real sitar: two strokes, the inward Da and the outward Ra, recorded and shifted along the neck so no fret is more than two
              semitones from a recording, and the jawari’s buzz stays the instrument’s own. Play quickly and the strokes alternate, as the mizrab does. Meend
              and krintan move the note without a new stroke, the way the left hand pulls and lets go of the string.
            </p>
            <p className="mt-3">
              Under the frets run eleven sympathetic strings, the tarab, tuned to the notes of {RAGAS[tuning.raga].name}. Nobody plucks them; they ring when a
              note you play matches one, and you hear them bloom after it, a modelled string with its own jawari for each. They glow on the neck as they ring.
            </p>
            <p className="mt-3">
              Above the main string run the chikari, two high strings tuned to Sa, struck for rhythm. With Auto chikari on, the right hand strikes them by
              itself in the rests between your notes: in your own pulse when you play alone, on the tabla’s beat when it keeps a taal (hardest on sam), and
              never on top of a note, a slide or a meend. When your notes come evenly, it leaves the next one its beat.
            </p>
            <p className="mt-3">
              On a keyboard, 1 to = and Q to ] play the frets in order. Shift with a fret’s key moves to it without a new stroke (krintan), holding ↑ pulls
              the note up to the raga’s next one (meend), Space strikes the chikari and Esc stops the string.
            </p>
            <p className="mt-3 text-sm text-muted">
              Sitar strokes by{' '}
              <a className="link" href="https://freesound.org/people/chinpen/sounds/42268/" target="_blank" rel="noopener noreferrer">
                chinpen
              </a>{' '}
              (CC BY 3.0, pitch-shifted across the neck); the recording to listen to by{' '}
              <a className="link" href={CREDIT} target="_blank" rel="noopener noreferrer">
                Sanath311
              </a>{' '}
              (CC BY-SA 3.0). Tanpura pluck by{' '}
              <a className="link" href="https://freesound.org/people/luckylittleraven/sounds/416606/" target="_blank" rel="noopener noreferrer">
                luckylittleraven
              </a>{' '}
              (CC0). Tabla strokes by{' '}
              <a className="link" href="https://github.com/sonic-pi-net/sonic-pi/blob/main/etc/samples/README.md" target="_blank" rel="noopener noreferrer">
                dio_333
              </a>{' '}
              (CC0, from Sonic Pi’s sample library). Rosewood texture from{' '}
              <a className="link" href="https://polyhaven.com/a/rosewood_veneer1" target="_blank" rel="noopener noreferrer">
                Poly Haven
              </a>{' '}
              (CC0).
            </p>
          </div>
        </div>
      </section>

      <section className="shell relative z-10 py-14 md:py-20" aria-labelledby="harmonium-title">
        <div className="grid items-end gap-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] md:gap-12">
          <div className="relative">
            <Waypoint top="0.9rem" />
            <h2 id="harmonium-title" className="title">
              Harmonium
            </h2>
            <p className="lead mt-4 max-w-[56ch]">
              Pumped by hand, two reeds to every key. The labels show where each note falls from your Sa; the dotted ones are in {RAGAS[tuning.raga].name}.
            </p>
          </div>
          <figure className="music-photo music-photo-wide m-0">
            <Photo id="music-harmonium" sizes="(min-width: 768px) 30vw, 100vw" className="h-full w-full object-cover" />
          </figure>
        </div>
        <div className="mt-8">
          <Harmonium onPlay={onPlay} />
        </div>
      </section>

      <section className="shell relative z-10 py-14 md:py-20" aria-labelledby="tabla-title">
        <Egg id="cassette" className="egg-corner" />
        <div className="grid items-end gap-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] md:gap-12">
          <div className="relative">
            <Waypoint top="0.9rem" />
            <h2 id="tabla-title" className="title">
              Tabla
            </h2>
            <p className="lead mt-4 max-w-[56ch]">
              Every stroke has a name, a bol, and every taal is a cycle of them. These are real strokes, the right drum retuned to Sa and the left to Sa or Pa below it, so they play in tune with the tanpura.
            </p>
          </div>
          <figure className="music-photo music-photo-wide m-0">
            <Photo id="music-tabla" sizes="(min-width: 768px) 30vw, 100vw" className="h-full w-full object-cover" />
          </figure>
        </div>
        <div className="mt-8">
          <Tabla onPlay={onPlay} />
        </div>
      </section>

      <PhotoCredits
        ids={['music-sitar', 'music-tanpura', 'music-tarab', 'music-harmonium', 'music-tabla']}
        note="Freely licensed photos from Wikimedia Commons. The sitar, tanpura and tabla play real recordings, credited above; the harmonium is synthesised in your browser."
      />

      {(pastHero || drone.on) && (
        <div className="drone-pill" role="region" aria-label="Tanpura">
          <span className="drone-pill-dot" data-on={drone.on || undefined} aria-hidden="true" />
          <span className="text-sm">
            Tanpura · Sa {SA_NOTES[tuning.sa]}
            <span className="drone-pill-raga text-muted"> · {RAGAS[tuning.raga].name}</span>
          </span>
          <button type="button" className="drone-pill-btn" onClick={drone.toggle} aria-pressed={drone.on} aria-label={drone.on ? 'Stop the tanpura' : 'Start the tanpura'}>
            {drone.on ? <RiPauseFill className="h-4 w-4" aria-hidden="true" /> : <RiPlayFill className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      )}
    </>
  );
}
