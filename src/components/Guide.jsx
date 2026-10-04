import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { RiCloseLine, RiQuestionLine } from 'react-icons/ri';
import { WORLDS } from './worlds/worlds';

// A guide to the site, and to whatever the page you're on lets you play. The
// "?" button in the corner (or the ? key) opens it.

const PAGES = {
  '/': {
    title: 'Home',
    tips: [
      ['The route line', 'It draws itself down the page as you scroll, lighting each stop.'],
      ['The Game Boy', 'It plays: arrow keys to move, Z (or Space) for A, X for B, Enter for Start and Shift for Select. On a phone, use its buttons.'],
      ['Off the clock', 'Every icon in the row does something, and every card has a toy in it.'],
    ],
  },
  '/experience': {
    title: 'Experience',
    tips: [
      ['Company colors', 'Each role re-themes the site as you scroll past it.'],
      ['The crawl', 'Play the opening crawl for the whole story so far.'],
    ],
  },
  '/projects': {
    title: 'Projects',
    tips: [
      ['The periodic table', 'Click a tile to light up the projects built with it. Click again to clear.'],
      ['The sitar string', 'Pluck it.'],
    ],
  },
  '/deathstar': {
    title: 'The Death Star',
    tips: [
      ['The superlaser', 'Fire it, or set a course to another planet first.'],
      ['The Battle of Yavin', 'Set course for Yavin 4 and a clock starts. Fly the trench run before the moon is in range.'],
      ['The trench run', 'Arrow keys or W A S D steer; Space or the Fire button fires, and T switches off the targeting computer. On a touch screen, drag to steer. The exhaust port glows as you close in and turns green when you’re lined up: stay low and centered, and fire.'],
      ['The readout', 'Open any part of the station on the technical readout.'],
    ],
  },
  '/middle-earth': {
    title: 'Middle-earth',
    tips: [
      ['The Doors of Durin', 'Move your pointer over the cliff to light the lines, or call the moon. Then say the word. It is a riddle: read the arch.'],
      ['The road', 'Step along the map from Hobbiton to Mount Doom.'],
      ['The bridge', 'Face the Balrog, wait until it is well out over the drop, then strike.'],
      ['Gorgoroth', 'Hold to walk. Let go when the Eye’s light comes close: standing still, the elven cloaks hide you.'],
      ['The Ring', 'Hold it to the fire to read it, put it on (Escape takes it off), or cast it in.'],
    ],
  },
  '/avengers': {
    title: 'Avengers Tower',
    tips: [
      ['The lift', 'Scroll down the tower, or pick a floor from the directory.'],
      ['The floors', 'Make Banner angry three times. Tap Widow’s black bars. Click anywhere on Hawkeye’s range. Throw Cap’s shield. Press and hold to lift Mjolnir: you are worthy once you have found ten easter eggs. Power up Stark’s reactor.'],
      ['The vault', 'Space opens the portal. On the other side, set all six stones in the gauntlet and snap.'],
    ],
  },
  '/scranton': {
    title: 'Scranton',
    tips: [
      ['The office', 'Pick a desk to visit someone (on a phone, tap a name under the plan). Each of them has something to do.'],
      ['The paper airplane', 'It glides down the page with you as you scroll.'],
      ['Kevin mode', 'Why waste time say lot word.'],
      ['Dwight’s fact check', 'Fact or false, seven times.'],
      ['The Dundies', 'One for every easter egg you have found on the site.'],
    ],
  },
  '/cybertron': {
    title: 'Cybertron',
    tips: [
      ['Sides', 'Join the Autobots or the Decepticons: the site changes color with you, and so does who you can transform.'],
      ['Transform', 'Optimus folds into his truck, Megatron into his jet. Open Optimus’s Matrix, or fire Megatron’s fusion cannon in either mode.'],
      ['Ground bridge', 'Hold the button, Space, or the scene itself to open the bridge as an Autobot reaches it. Let go before a Vehicon does. Three strikes and Ratchet takes over.'],
      ['The Iacon database', 'Pick what each Cybertronian entry says before the decryption bar fills. Show the key to read it letter by letter. Wrong guesses cost time.'],
      ['The roster', 'Roll out as any of them to wear their colors. The soundboard plays through Soundwave’s visor.'],
    ],
  },
  '/albuquerque': {
    title: 'Albuquerque',
    tips: [
      ['The title card', 'Type a name and it becomes a Breaking Bad title card.'],
      ['The cast', 'Every card does something.'],
      ['The superlab', 'Hold to heat, let go to cool. Keep the needle in the green for the whole cook.'],
      ['Face Off', 'Ring Hector’s bell three times.'],
      ['Los Pollos Hermanos', 'Order at the counter and the tray fills up. Then call Saul.'],
    ],
  },
  '/music': {
    title: 'The music room',
    tips: [
      ['Tune up', 'Pick a Sa and a raga, then start the tanpura.'],
      ['Play', 'Click the sitar’s frets, the harmonium’s keys or the tabla. Everything tunes to the same Sa.'],
    ],
  },
  '/terminal': {
    title: 'The terminal',
    tips: [
      ['Commands', 'Type help. Try worlds, order66, deathstar or language.'],
      ['Keys', 'Tab completes, up and down walk the history, Ctrl+L clears.'],
    ],
  },
  '/travel': {
    title: 'Travel',
    tips: [['The globe', 'Drag to spin it, and click a place to fly there.']],
  },
};

const SITE = [
  ['Getting around', 'The menu at the top, or ⌘K (Ctrl+K) for the command palette, which can take you anywhere and do most things. The Terminal page takes commands too.'],
  ['Colors', 'The dot in the menu picks a color scheme: each company I’ve worked at, any fan theme you’ve unlocked, or your own color.'],
  ['Languages', 'Read the whole site in Aurebesh, Cybertronian or Dwarf runes, whichever the theme speaks, from the Off the clock row or ⌘K.'],
  ['Easter eggs', 'A small one is tucked away on each of the main pages, and one more on the page that isn’t there. Some words work if you type them anywhere: try aurebesh, rollout, mellon, snap, twss, parkour, precious or say my name. ↑ ↑ ↓ ↓ ← → ← → B A jumps to lightspeed.'],
  ['Achievements', 'Each egg you find is counted; the Dundies in Scranton show you where you stand.'],
];

export default function Guide() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const page = PAGES[pathname] ?? (pathname.startsWith('/projects/') ? { title: 'This project', tips: [['The demo', 'The panel at the top is live: try it.']] } : null);
  const [tab, setTab] = useState('page');
  const panel = useRef(null);
  const button = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === '?') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (open) {
      setTab(page ? 'page' : 'site');
      requestAnimationFrame(() => panel.current?.focus());
    }
    // the tab resets each time it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => setOpen(false), [pathname]);

  // On a phone the button tucks away while you scroll down the page (so it
  // never sits over a game's controls) and comes back when you scroll up.
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 160) setTucked(false);
      else if (y > last + 8) setTucked(true);
      else if (y < last - 8) setTucked(false);
      if (Math.abs(y - last) > 8) last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <>
      <button ref={button} type="button" className="guide-btn" data-tucked={(tucked && !open) || undefined} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="guide-panel" aria-label="Guide: how this site works">
        <RiQuestionLine className="h-5 w-5" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div id="guide-panel" ref={panel} className="guide-panel card" role="dialog" aria-modal="false" aria-label="Guide" tabIndex={-1}>
            <div className="flex items-center justify-between gap-4">
              <div className="seg" role="tablist" aria-label="Guide">
                {page && (
                  <button type="button" role="tab" aria-selected={tab === 'page'} aria-pressed={tab === 'page'} onClick={() => setTab('page')}>
                    On this page
                  </button>
                )}
                <button type="button" role="tab" aria-selected={tab === 'site'} aria-pressed={tab === 'site'} onClick={() => setTab('site')}>
                  The site
                </button>
              </div>
              <button type="button" className="guide-close" onClick={close} aria-label="Close the guide">
                <RiCloseLine className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {tab === 'page' && page ? (
              <div className="mt-5">
                <p className="label">{page.title}</p>
                <dl className="guide-list mt-3">
                  {page.tips.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <div className="mt-5">
                <dl className="guide-list">
                  {SITE.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="label mt-5">The worlds</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {WORLDS.map((w) => (
                    <li key={w.to}>
                      <Link to={w.to} className="world-link" onClick={() => setOpen(false)}>
                        {w.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-5 text-xs text-muted">Press ? any time to open this, and Escape to close it.</p>
          </div>,
          document.body,
        )}
    </>
  );
}
