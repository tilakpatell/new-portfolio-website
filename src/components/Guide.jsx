import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { RiCloseLine, RiQuestionLine } from 'react-icons/ri';
import { WORLDS } from './worlds/worlds';

// A guide to the site, and to whatever the page you're on lets you play. The
// "?" button in the corner (or the ? key) opens it.

const PAGES = {
  '/home': {
    title: 'Home',
    tips: [
      ['The route line', 'It draws itself down the page as you scroll, lighting each stop.'],
      ['The Game Boy', 'It plays: arrow keys to move, Z (or Space) for A, X for B, Enter for Start and Shift for Select. On a phone, use its buttons. In Super Tilak Land a fire flower lets B throw fire, stomps in a row score more each time, and a king waits at the end of the castle. Each game keeps its best score.'],
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
      ['The trench run', 'Over the surface first: hold Space (or the mouse, or the Laser button) to fire the lasers at the TIE fighters and towers, and keep moving, because their shots are aimed at you. Then dive into the trench: dodge the catwalks and walls (a close shave scores), shoot the wall turrets, and lose Vader. F or Enter fires a torpedo. In the trench it blasts the first catwalk, wall or turret in its path, or scorches the floor, so spend them carefully: you need one for the port, which glows as you close in and turns green when you’re lined up, low and centered. T switches off the targeting computer for half again on the score. On a touch screen, drag to steer. Pick Rookie, Red Five or Jedi; each keeps its best score. It plays in 3D wherever the browser has WebGL; the switch under it goes back to 2D.'],
      ['The readout', 'Open any part of the station on the technical readout.'],
    ],
  },
  '/caribbean': {
    title: 'The Caribbean',
    tips: [
      ['Dead man’s tide', 'You are Jack Sparrow, at the helm of the Black Pearl. A and D (or the arrows) turn her; W and S set more or less sail. Her guns point off her sides: Q fires the port guns, E the starboard. Move the mouse to either side to look that way, and click or press Space to fire the side you are looking at. Gold arcs on the water show what each side can reach. Sink the patrol, take the four chests, silence the fort (keep off the red rings: that is where a mortar is about to land), then the Flying Dutchman and the kraken. Pick a refit after each chapter with 1, 2 or 3. A controller works too.'],
      ['The captain’s effects', 'The compass points at what you want most, wherever that is on the page: press it to want something else. Drink the rum, all of it. Press the jar of dirt until it tells you what’s inside.'],
      ['Wanted', 'Every poster does something. Jack and Davy Jones change the colours of the whole site (so does typing savvy anywhere); Barbossa brings the moonlight, and in the moonlight the curse shows.'],
      ['The code', 'Press an article to see what it comes to in practice.'],
    ],
  },
  '/middle-earth': {
    title: 'Middle-earth',
    tips: [
      ['The map', 'Pick a place on the map and the camera flies down to it: the Shire, Rivendell, Moria, Lothlórien or Mordor. The map button takes you back up. A wax seal marks each place you have won.'],
      ['The Doors of Durin', 'Move your pointer over the cliff to light the lines, or call the moon. Then say the word. It is a riddle: read the arch.'],
      ['The road', 'Step along the map from Hobbiton to Mount Doom.'],
      ['The bridge', 'Face the Balrog. When it raises its whip, raise the staff as it falls (Space); a block at nothing leaves the staff down for a moment. Strike the bridge (Enter) with it right over the deep for a perfect. Win and it comes again, faster; your best streak is kept.'],
      ['Gorgoroth', 'Hold to walk (Space or →). Let go when the Eye’s light comes close: standing still, the elven cloaks hide you. Rest before the Ring gets too heavy, and stand still while orc patrols march past. Sam carries Frodo the last stretch. Your best time is kept.'],
      ['The Ring', 'Hold it to the fire to read it, put it on (Escape takes it off), or cast it in.'],
    ],
  },
  '/avengers': {
    title: 'Avengers HQ',
    tips: [
      ['The map', 'Scroll to walk the compound, or pick a pin on the map (or a name under it). On a wide screen the map beside the tour shows where you are.'],
      ['The buildings', 'Power up Stark’s reactor. Press and hold to lift Mjolnir: you are worthy once you have found ten easter eggs. Throw Cap’s shield. Click anywhere on Hawkeye’s range. Tap Widow’s black bars. Make Banner angry three times.'],
      ['The hangar', 'Space opens the portal. On the other side, set all six stones in the gauntlet and snap.'],
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
      ['Ground bridge', 'Hold the button, Space, or the scene itself to open the bridge as an Autobot reaches it. Let go before a Vehicon does. Three strikes and Ratchet takes over. Join the Decepticons and it’s Soundwave’s space bridge: let the Decepticons aboard and shut the Autobots out.'],
      ['Roll out', 'Left and right (or A and D) steer. As a vehicle you’re fast: Space or up boosts, smashing debris, and you take the ramps over broken bridges. As a robot you fight: the blaster fires on its own, and Space or up jumps the barricades, but standing up burns energon. Shift, T or down transforms; it takes half a second, so read the road ahead. A jump pressed while you’re still standing up goes as soon as it can, and Space held through the transform leaps out of the boost. Clearing a roadblock or a broken bridge pays, double if you changed at the last moment; shoot a boss while it charges up to stagger it. Get past Starscream over Jasper, Shockwave in Mission City and Megatron in Kaon, or join the Decepticons and drive Knock Out or Breakdown past Wheeljack, Ultra Magnus and Optimus Prime to Iacon. On a touch screen, drag to steer and use the buttons; a gamepad works too. Each difficulty keeps its best score. It needs hardware acceleration on.'],
      ['The Iacon database', 'Pick what each Cybertronian entry says before the decryption bar fills. Show the key to read it letter by letter. Wrong guesses cost time. On the Decepticons’ side you decode for Lord Megatron, racing Teletraan-1, into a vault of your own.'],
      ['The roster', 'Roll out as any of them to wear their colors. The soundboard plays through Soundwave’s visor.'],
    ],
  },
  '/albuquerque': {
    title: 'Albuquerque',
    tips: [
      ['The title card', 'Type a name and it becomes a Breaking Bad title card.'],
      ['The cast', 'Every card does something.'],
      ['Walt’s Metherria', 'Cook to order, Papa’s style, in 3D. Take each customer’s ticket at the hatch, then work the stations along the bench: pick the size and hold to pour the base to the gold line, counting in the blue and Chili P (and the mix-ins your title unlocks); hold the heat in the green; strike the slab on its crack lines; pick the pack, fill each one to the mark, and stick the stickers where the ticket shows. Hand it over at the hatch. Every station is scored, and so is the wait. Pay buys upgrades between shifts, new customers turn up as the days go on, and from day three Hank drops by (press H to hide the batch). It needs WebGL.'],
      ['Face Off', 'Ring Hector’s bell three times.'],
      ['The letter board', 'Rows light up in turn: ring (Space, the button or a tap on the board) to pick the row, then again on the right letter. Three words; wrong rings cost five seconds.'],
      ['Inside', 'Order at the Los Pollos Hermanos counter (Gus is serving) and the tray fills up. Then call Saul.'],
    ],
  },
  '/c-137': {
    title: 'Dimension C-137',
    tips: [
      ['The portal gun', 'Fire it to look through into another dimension.'],
      ['Portal panic', 'W A S D or the arrows move and the mouse aims. The gun fires on its own at the nearest enemy; F turns that off, and then you hold the mouse button to fire. Space or Shift portal-dashes out of trouble. Clear three waves in each of four dimensions, take a gadget from Rick’s workbench after every wave (1, 2 or 3), and beat the boss to portal on. On a touch screen the left thumb moves and the right thumb aims; a gamepad works too. P pauses. Play as Rick, Morty or Pickle Rick; each difficulty keeps its best score. It needs hardware acceleration on.'],
      ['The Meeseeks box', 'Press the button and give him a task. Give him one he can’t do and he gets help.'],
      ['Interdimensional cable', 'Turn the dial.'],
      ['The Smiths', 'Four of them are a color scheme for the site. Jerry can ask.'],
    ],
  },
  '/universe': {
    title: 'The universe',
    tips: [
      ['Pick a ship', 'Rick and Morty’s space cruiser, Luke and Artoo’s X-wing or Han and Chewie’s Falcon. Each crew has something to say about every place you reach, and each ship sounds like itself.'],
      ['Fly', 'W A S D or the arrows, R to climb and C to dive (Page Up and Page Down work too), Space to boost, F to fire; on a phone, drag anywhere on the map, hold the arrow buttons to climb and dive, hold Boost and tap Fire. M pulls out to the whole map. The gauge on the left shows how high above or below the map you are.'],
      ['Mind the planets', 'Brush one and you bounce off; fly into one at speed and you crash (the crew will have words), then come back beside it.'],
      ['Traffic', 'You’re not alone out here: freighters, transports and corvettes, TIE fighters and X-wings if you fly with Luke or Han; families in their saucers, junk haulers, Gear People, Federation patrols, Gromflomites, Meeseeks and Birdperson if you fly with Rick. Now and then some come your way; you can shoot them down.'],
      ['Deep space', 'Past the planets the universe opens up. Boost out there and the pulse drive takes you across it, to a ringed gas giant, an ice giant, two other suns, a black hole, two nebulae, the Death Star and the Citadel of Ricks; you can climb much higher, too. M pulls out far enough to find your way home, and flying home drops you back to normal speed.'],
      ['Hunted', 'Now and then someone comes after you: the Empire if you fly with Luke or Han (Vader too, sometimes), the Federation or the Council of Ricks if you fly with Rick, and sooner if you’ve been shooting things up. Your shields take their hits and come back; shoot them down or outrun them (deep space is best). Lose your shields and you’re back at the nearest station.'],
      ['Happenings', 'Other things happen too: a Star Destroyer drops out of hyperspace and launches its fighters, someone calls for help with pirates on their tail, a convoy goes by, a comet crosses the sky.'],
      ['Go somewhere', 'The stations round the sun are the site’s pages; the planets are its worlds. Fly close to one, or pick it by name and the ship takes you. E (or the panel’s button) lands or docks.'],
      ['Just looking', 'With no ship, pick a place and the camera flies there. Drag to turn the map, and Escape comes back out.'],
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
  ['Languages', 'Read the whole site in Aurebesh, Cybertronian or Dwarf runes, from the Off the clock row, ⌘K, or the Death Star, Middle-earth and Cybertron pages. Back to English is always at the bottom of the screen, or type english.'],
  ['Easter eggs', 'A small one is tucked away on each of the main pages, and one more on the page that isn’t there. Some words work if you type them anywhere: try aurebesh, rollout, mellon, snap, twss, parkour, precious, wubbalubbadubdub or say my name. ↑ ↑ ↓ ↓ ← → ← → B A jumps to lightspeed.'],
  ['Achievements', 'Each egg you find is counted; the Dundies in Scranton show you where you stand.'],
];

export default function Guide() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const page =
    PAGES[pathname] ??
    (pathname.startsWith('/experience/') ? PAGES['/experience'] : null) ??
    (pathname === '/' || pathname.startsWith('/universe/') ? PAGES['/universe'] : null) ??
    (pathname.startsWith('/middle-earth/') ? PAGES['/middle-earth'] : null) ??
    (pathname.startsWith('/projects/') ? { title: 'This project', tips: [['The demo', 'The panel at the top is live: try it.']] } : null);
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
  // (once a frame at most, and only when it changes)
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let now = false;
    let frame = 0;
    const set = (v) => {
      if (v === now) return;
      now = v;
      setTucked(v);
    };
    const check = () => {
      frame = 0;
      const y = window.scrollY;
      if (y < 160) set(false);
      else if (y > last + 8) set(true);
      else if (y < last - 8) set(false);
      if (Math.abs(y - last) > 8) last = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
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
