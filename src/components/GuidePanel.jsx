import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { RiCloseLine } from 'react-icons/ri';
import { WORLDS } from './worlds/worlds';

// The guide's panel: what each page lets you do, and the site as a whole.
// Loaded the first time the guide opens (components/Guide.jsx), not before.

// the portfolio pages run into one another (components/feed)
const FEED_TIP = ['Keep scrolling', 'The six portfolio pages run into one another: reach the end of this one and the next begins, and the address and the menu follow. After the sixth, the end.'];

const PAGES = {
  '/home': {
    title: 'Home',
    tips: [
      ['The route line', 'It draws itself down the page as you scroll, lighting each stop.'],
      ['The Game Boy', 'It plays: arrow keys to move, Z (or Space) for A, X for B, Enter for Start and Shift for Select. On a phone, use its buttons. In Super Tilak Land a fire flower lets B throw fire, stomps in a row score more each time, and a king waits at the end of the castle. Each game keeps its best score.'],
      ['Off the clock', 'Every icon in the row does something, and every card has a toy in it.'],
      FEED_TIP,
    ],
  },
  '/experience': {
    title: 'Experience',
    tips: [
      ['Company colors', 'Each role re-themes the site as you scroll past it.'],
      ['The crawl', 'Play the opening crawl for the whole story so far.'],
      FEED_TIP,
    ],
  },
  '/projects': {
    title: 'Projects',
    tips: [
      ['The periodic table', 'Click a tile to light up the projects built with it. Click again to clear.'],
      ['The sitar string', 'Pluck it.'],
      FEED_TIP,
    ],
  },
  '/galaxy': {
    title: 'A galaxy far, far away',
    tips: [
      ['Flying', 'The same ship and the same controls as the universe map: W and S the throttle, A and D roll, the arrows swing the nose, Space boosts (out in the open the sublight drive opens up), hold F to fire, T and Q change target, V the cockpit, O the settings. Or drag anywhere like a stick.'],
      ['Jumping to lightspeed', 'M (or Plot a course) opens the galaxy map. Pick a system, then Jump: the ship comes round onto the bearing for it, the stars stretch, and you’re in hyperspace. Filter the map by era or film to see the galaxy as it was then.'],
      ['What’s there', 'Every system is a moment from the films (or the shows, The Mandalorian and Ahsoka): the Tantive IV over Tatooine, Death Squadron at Hoth, the Battle of Endor, the Death Star rounding Yavin (fly its trench), the Razor Crest with a TIE on its tail at Nevarro, the Mandalorians retaking Mandalore. Click a name to fly there.'],
      ['Missions', 'Each system has one. Most are briefings for games still being built (with their own opening crawl); the trench run and boarding the Death Star are here now. Watch for its tractor beam at Alderaan.'],
      ['Online', 'Go online and the other pilots in the same system are there with you, in their own ships. The galaxy map shows how many are where.'],
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
  '/invincible': {
    title: 'Invincible',
    tips: [
      ['The city', 'The page opens on the Graysons’ city, to fly about as Mark: six kilometres of downtown, river, suburbs, coast and hills. W, A, S and D fly the way you’re looking (walk, on the ground), Space goes up (and takes off), C goes down (and lands), Shift goes flat out: past about 430 km/h the air breaks with a boom. Come down fast and the street cracks; hit a tower too fast and you bounce off it. Drag or the arrow keys look round, E at a place (the Graysons’, the high school, Burger Mart, the Guardians’ hall, the GDA), T changes the time of day. On a phone, a stick on the left and Up, Down and Boost on the right.'],
      ['Think, Mark!', 'You are Invincible, flying over the city. W, A, S and D fly the way the camera looks (so look down to dive), Space climbs, C drops and Shift goes flat out; drag the mouse or use the arrow keys to look round. J or a click throws a punch at whatever you’re locked on to (Tab picks another); K or a right-click dodges, and nothing can touch you for a moment. Four chapters: fly through your father’s rings in order; knock the Flaxans back through their portal (dodge their purple bolts); then Omni-Man and Thragg. A Viltrumite blocks a punch and hits back, unless he’s recovering from a charge: watch the ring close round him, dodge as it closes, then hit him while he’s open. A dodge just in time slows everything down and leaves him open for longer. On a touch screen, the left of the screen steers, a drag on the right looks, a tap punches. A controller works too.'],
      ['The title card', 'Press it for the next episode. It has a rough season.'],
      ['The files', 'Drag a figure to turn him, or pick a pose: they’re the HD models the game uses.'],
      ['Things your father said', 'Every card does something.'],
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
      ['The compound', 'You are Spider-Man. W A S D or the arrows walk, Shift runs, Space jumps, and dragging looks round (on a phone, the stick walks; push it all the way to run). Walk up to a door and press E (or the button) to go in: each building’s game opens over the page, and Escape or Back to the compound brings you out at its door. M lists the buildings, with Go there for each. Thor, Natasha, the Hulk and a training bot have something to say if you walk up to them.'],
      ['Other players', 'See other players goes online (with your callsign, as the universe map does): everyone else walking the compound shows as a pale hologram with their name over them, and on the map in the corner as a dot. They can’t touch your games, nor you theirs; whoever goes into a building fades out until they come back.'],
      ['The stones', 'Win a building’s game and its Infinity Stone hangs over the door (Clint’s range and Natasha’s operations room each give half the Soul Stone). The Space Stone, from the hangar, opens a portal over the helipad: walk under it to Titan.'],
      ['Without 3D', 'The compound is drawn from the air, and its pins open the games, each in its simple version: power up Stark’s reactor, hold to lift Mjolnir (you are worthy once you have found ten easter eggs), throw Cap’s shield, click Hawkeye’s range, tap Widow’s black bars, make Banner angry three times.'],
      ['The gate: Thwip!', 'Spider-Man, late for school. Hold Space (or the mouse, or a finger) to shoot a web at the wall ahead and swing; let go to fly. Let go on the upswing, past where the web caught, for a perfect release: faster, and a flip. A and D steer across the avenue (on a touch screen, hold on the left or right); W reels the web in to climb. Nothing to swing from over the cross streets, so carry your speed over them. Grab Peter’s backpacks on the way, beat the bell, and keep off the street: the traffic gets three chances.'],
      ['The hangar', 'Space opens the portal. On the other side, set all six stones in the gauntlet and snap.'],
    ],
  },
  '/scranton': {
    title: 'Scranton',
    tips: [
      ['Walk the office', 'You’re Jim. W A S D or the arrows walk, Shift runs, drag to look round, E does things, M lists the week’s seven jobs: reception, the stapler in Jell-O, Kevin’s chili, paper toss, the fact check, Dwight’s fire drill and the Dundies. Everyone has something to say as you pass.'],
      ['The office from above', 'Further down: pick a desk to visit someone (on a phone, tap a name under the plan). Each of them has something to do.'],
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
  '/c-137/citadel': {
    title: 'The Citadel of Ricks',
    tips: [
      ['Walk', 'W A S D or the arrows, Shift to run, and drag to look round; on a phone, the stick and a swipe. E does what the panel says, M lists what there is to do.'],
      ['Morty Day Care', 'Six Mortys are loose. They run from you, so come at them from the far side and drive them through the gate. All six in before the clock runs out.'],
      ['Simple Rick’s', 'Space (or Drop) lays the next layer as the dispenser swings over the stack. What hangs over is cut off, so keep it narrow and true. Three good wafers.'],
      ['The Council', 'Answer the way C-137 would. Grovelling gets you held in contempt.'],
      ['Election day', 'Once the first three are done: hear out three voters, then vote at Candidate Morty’s booth. It doesn’t matter how.'],
      ['Red alert', 'The Cop Ricks see in a cone and hear you running close by. The core, the kiosks and the planters hide you; the benches don’t. Get to the hangar.'],
    ],
  },
  '/dot-matrix': {
    title: 'Dot Matrix',
    tips: [
      ['Walk and jump', 'The arrows or W A S D walk, Space (or Z) jumps: hold it to jump higher. Q and E turn the camera an eighth of the way round, or drag the island. On a phone, the pad walks, A jumps and B acts. A controller works too.'],
      ['B', 'X (or Enter) reads a sign, plays the giant Game Boy in the square when you stand in front of it, and takes you down a pipe you are standing on.'],
      ['The cartridges', 'Eight of them, each one a project of mine: up the plateau, on top of Block Drop tower, in the snake’s pen, among the plants, on the cloud, out on the islet, on a roof and in the long grass. M lists them, with a hint for each you haven’t found.'],
      ['Mind', 'Jump on the walkers; walking into one hurts. A plant won’t come up while you stand on its pipe. Wait for the gap in the snake. Three hearts, and a "?" block somewhere gives one back.'],
      ['The screen', 'The chip at the top switches between the DMG’s greens, the Pocket’s greys and the Light’s teal.'],
    ],
  },
  '/earth': {
    title: 'Earth',
    tips: [
      ['From orbit', 'The Earth as it is right now: the sun is where it really is, so the night side is the real night. Drag to turn it, or pick a place to fly there. It comes down onto the globe on its own after a moment; M goes back up.'],
      ['Fly', 'The arrows or W A S D: left and right turn, up and down climb and descend. Shift (or Space) goes faster. On a phone, the stick flies and the button goes faster. A controller works too.'],
      ['The passport', 'Fly over a place to stamp your passport and get its postcard. P opens the passport; Fly here sets the autopilot, which follows the great circle there (Escape, or any turn, takes the controls back). The arrow at the bottom points at the next place, or wherever the autopilot is going.'],
      ['Night', 'N keeps the sun over your shoulder, always day, if the real one has set where you are.'],
    ],
  },
  '/universe': {
    title: 'The universe',
    tips: [
      ['Pick a ship', 'Rick and Morty’s space cruiser, Luke and Artoo’s X-wing or Han and Chewie’s Falcon. Each crew has something to say about every place you reach, and each ship sounds like itself.'],
      ['Fly', 'W A S D or the arrows, R to climb and C to dive (Page Up and Page Down work too), Space to boost, F to fire; on a phone, drag anywhere on the map, hold the arrow buttons to climb and dive, hold Boost and tap Fire. M pulls out to the whole map. The gauge on the left shows how high above or below the map you are.'],
      ['Mind the planets', 'Brush one and you bounce off; fly into one at speed and you crash (the crew will have words), then come back beside it.'],
      ['Traffic', 'You’re not alone out here: freighters, transports and corvettes, TIE fighters and X-wings if you fly with Luke or Han; families in their saucers, junk haulers, Gear People, Federation patrols, Gromflomites, Meeseeks and Birdperson if you fly with Rick. Now and then some come your way; you can shoot them down.'],
      ['Deep space', 'The home system is the sun and the stations. The worlds are far out in deep space, hundreds of units apart, each marked by a beacon in its colour, with a ringed gas giant, an ice giant, two other suns, a black hole, two nebulae and the Citadel of Ricks between them. Boost out in the open and the pulse drive takes over; it drops back as you near any place, so you arrive at flying speed. You can climb much higher out there. M pulls out far enough to find your way home.'],
      ['On the way', 'Hunters drop in ahead of you between places and pull you out of the pulse drive (an interdiction): fight them off or wait them out, and the drive comes back. Fly into the Citadel too fast and its portals take you inside it; a sun burns you back; a giant takes you down into its clouds and spits you out.'],
      ['The black hole', 'The one thing out there you don’t come back from. Touch it at any speed and it has you, and on its far side is a friend’s universe: Shrey Pathak’s portfolio, the Matrix. Back brings you home.'],
      ['Hunted', 'Now and then someone comes after you: the Empire if you fly with Luke or Han (Vader too, sometimes), the Federation or the Council of Ricks if you fly with Rick, either if you fly the RV, and sooner if you’ve been shooting things up. Your shields take their hits and come back; shoot them down or outrun them. Lose your shields and you’re back at the nearest place.'],
      ['Happenings', 'Other things happen too: a Star Destroyer drops out of hyperspace and launches its fighters, someone calls for help with pirates on their tail, a convoy goes by, a comet crosses the sky, a star flares and its shockwave rattles the ship, a rift tears open ahead of you (fly into it and it takes you somewhere else on the map), and something enormous swims past: purrgil, or a Cromulon with something to say.'],
      ['Go somewhere', 'The stations round the sun are the site’s pages; the planets are its worlds. Fly close to one, or pick it by name and the ship takes you. E (or the panel’s button) lands or docks.'],
      ['Just looking', 'With no ship, pick a place and the camera flies there. Drag to turn the map, and Escape comes back out.'],
    ],
  },
  '/music': {
    title: 'The music room',
    tips: [
      ['The music planet', 'The page opens on a courtyard at dusk: click it, then W A S D to walk, the arrows to turn, drag to look (on a phone, the stick and a swipe). Walk up to an instrument and press E to play it; whatever sounds glows, and its notes float up.'],
      ['Tune up', 'Pick a Sa and a raga (forty of them, or one of your own), then start the tanpura.'],
      ['Play', 'Click the sitar’s frets, the harmonium’s keys or the tabla. Everything tunes to the same Sa. Hold Space on the sitar for a chikari roll; Record the room keeps what you play.'],
    ],
  },
  '/terminal': {
    title: 'The terminal',
    tips: [
      ['Commands', 'Type help. Try worlds, order66, deathstar or language.'],
      ['Keys', 'Tab completes, up and down walk the history, Ctrl+L clears.'],
    ],
  },
  '/resume': {
    title: 'Résumé',
    tips: [
      ['Skills', 'Click any skill on the résumé to light up every line that uses it; the PDF tab has the one-page version.'],
      FEED_TIP,
    ],
  },
  '/contact': {
    title: 'Contact',
    tips: [
      ['The memo', 'The form opens your email app with the memo filled in. Nothing is sent from this page.'],
      FEED_TIP,
    ],
  },
  '/travel': {
    title: 'Travel',
    tips: [['The globe', 'Drag to spin it, and click a place to fly there.'], FEED_TIP],
  },
};

const SITE = [
  ['Two ways round', 'The Universe and Classic switch at the top: fly through the site as a universe, or read it as plain pages. Either takes you to the same place in the other, and the site opens on the one you picked last.'],
  ['Getting around', 'The menu at the top, or ⌘K (Ctrl+K) for the command palette, which can take you anywhere and do most things. The Terminal page takes commands too.'],
  ['Colors', 'The dot in the menu picks a color scheme: each company I’ve worked at, any fan theme you’ve unlocked, or your own color.'],
  ['Languages', 'Read the whole site in Aurebesh, Cybertronian or Dwarf runes, from the Off the clock row, ⌘K, or the Death Star, Middle-earth and Cybertron pages. Back to English is always at the bottom of the screen, or type english.'],
  ['Easter eggs', 'A small one is tucked away on each of the main pages, and one more on the page that isn’t there. Some words work if you type them anywhere: try aurebesh, rollout, mellon, snap, twss, parkour, precious, wubbalubbadubdub or say my name. ↑ ↑ ↓ ↓ ← → ← → B A jumps to lightspeed.'],
  ['Achievements', 'Each egg you find is counted; the Dundies in Scranton show you where you stand.'],
];

const pageFor = (pathname) =>
  PAGES[pathname] ??
  (pathname.startsWith('/experience/') ? PAGES['/experience'] : null) ??
  (pathname === '/' || pathname.startsWith('/universe/') ? PAGES['/universe'] : null) ??
  (pathname.startsWith('/middle-earth/') ? PAGES['/middle-earth'] : null) ??
  (pathname.startsWith('/galaxy/') && !pathname.endsWith('/mission') ? PAGES['/galaxy'] : null) ??
  (pathname.startsWith('/projects/') ? { title: 'This project', tips: [['The demo', 'The panel at the top is live: try it.']] } : null);

// Mounted each time the guide opens, so it starts on this page's tab.
export default function GuidePanel({ pathname, close, onLeave }) {
  const page = pageFor(pathname);
  const [tab, setTab] = useState(page ? 'page' : 'site');
  const panel = useRef(null);
  useEffect(() => {
    requestAnimationFrame(() => panel.current?.focus());
  }, []);

  return createPortal(
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
                <Link to={w.to} className="world-link" onClick={onLeave}>
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
  );
}
