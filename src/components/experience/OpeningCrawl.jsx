import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiVolumeUpLine } from 'react-icons/ri';
import { prefersReducedMotion } from '../../lib/hooks';
import { audioContext } from '../../lib/audio';

// An opening crawl. `variant="career"` (the Experience page) tells the career
// so far, every line from the roles there; `variant="intro"` is the site's
// welcome on a first visit, shorter, before the jump to lightspeed. Plain CSS
// 3D, so it plays without a GPU too. It renders into <body> so it covers the
// nav (the page's <main> is its own stacking context).

const STORIES = {
  career: {
    episode: 'Episode VI',
    title: 'Return of the Intern',
    paragraphs: [
      'It is a period of co-ops. Striking from a dorm room in Boston, engineer TILAK PATEL has turned five hundred radar documents into knowledge graphs at SRC and retired a legacy LabVIEW test rig at PENDAR.',
      'At BOSE, a three-phase pipeline cut firmware debugging from hours to minutes. At RTX, a modernization roadmap was drawn all the way to 2028.',
      'Now at AMAZON WEB SERVICES, the mission is capacity: planning the data centers that generative AI runs on, and flagging stale data before anyone has to ask…',
    ],
    seconds: 46,
  },
  intro: {
    episode: 'Episode IV',
    title: 'A New Hire',
    paragraphs: [
      'It is a period of internships. From a dorm room at Northeastern, computer science student TILAK PATEL has planned programs and shipped software at AWS, RTX, BOSE, PENDAR, EMPOWERREG and SRC.',
      'Between them he built a Game Boy emulator, an AI translator for Gujarati scripture and a cloud IDE that won a hackathon, and learned to play the sitar.',
      'Now, with graduation in sight, he sets out across the galaxy in search of his next mission, as a technical program manager or a software engineer…',
    ],
    seconds: 36,
  },
};

export default function OpeningCrawl({ onClose, variant = 'career' }) {
  const close = useRef(null);
  const reduced = prefersReducedMotion();
  const story = STORIES[variant] ?? STORIES.career;
  const started = useRef(performance.now());
  const music = useRef(null);
  // before a first click the browser holds sound back; then a button offers it
  const [quiet, setQuiet] = useState(false);

  const play = (fromStart) => {
    const elapsed = fromStart ? 0 : (performance.now() - started.current) / 1000;
    const lead = reduced ? 0 : 4.4; // the music comes in as the crawl starts, after "A long time ago…"
    import('../../lib/clips').then(async (c) => {
      const played = await c.playClip('starWars', elapsed < lead ? { when: lead - elapsed } : { offset: elapsed - lead });
      if (played) music.current = played;
      else if (fromStart) import('../../lib/sfx').then((s) => s.fanfare());
    });
  };

  useEffect(() => {
    // the first-visit cover (index.html) sits above everything: the crawl replaces it
    delete document.documentElement.dataset.intro;
    const ac = audioContext();
    if (variant === 'intro' && ac?.state !== 'running') setQuiet(true);
    else play(true);
    return () => music.current?.stop();
    // once, when the crawl opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const soundOn = () => {
    audioContext(); // in the click, so the music may play
    setQuiet(false);
    play(false);
    close.current?.focus();
  };

  useEffect(() => {
    const prev = document.activeElement;
    close.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    const done = reduced ? null : setTimeout(onClose, story.seconds * 1000);
    return () => {
      document.removeEventListener('keydown', onKey);
      html.style.overflow = overflow;
      clearTimeout(done);
      if (prev instanceof HTMLElement) prev.focus({ preventScroll: true });
    };
  }, [onClose, reduced, story.seconds]);

  return createPortal(
    <div className="crawl dark-scope" data-variant={variant} role="dialog" aria-modal="true" aria-label="Opening crawl">
      <div className="ds-stars absolute inset-0" aria-hidden="true" />
      <div className="crawl-controls">
        {quiet && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={soundOn}>
            <RiVolumeUpLine className="h-4 w-4" aria-hidden="true" /> Sound on
          </button>
        )}
        <button ref={close} type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          {variant === 'intro' ? 'Skip intro' : 'Skip'}
        </button>
      </div>
      {!reduced && <p className="crawl-intro">A long time ago, in a dorm room at Northeastern…</p>}
      <div className={reduced ? 'crawl-static' : 'crawl-stage'}>
        <div className="crawl-text">
          <p className="crawl-episode">{story.episode}</p>
          <p className="crawl-title">{story.title}</p>
          {story.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </div>
      {reduced && variant === 'intro' && (
        <div className="crawl-static-go">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Enter the site
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
