import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link as RouterLink } from 'react-router-dom';
import { RiArrowDownLine, RiArrowLeftLine, RiArrowUpLine, RiCheckLine, RiCloseLine, RiListCheck2, RiShirtLine } from 'react-icons/ri';
import '@fontsource/luckiest-guy/400.css';
import { useAchievements } from '../../Achievements';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../lib/hooks';
import GpuGate from '../../games/GpuGate';
import { readPad, typing } from '../../games/pad';
import { keyDown, keyUp } from '../../middleearth/towns/keys';
import ButterRobot from '../ButterRobot';
import Cable from '../Cable';
import MeeseeksBox from '../MeeseeksBox';
import PlumbusFactory from '../PlumbusFactory';
import PortalPanic from '../portal/PortalPanic'; // (the page has it already, so not lazy)
import Quiz from './Quiz';
import { MORTY_BEST } from './roy/rules';
import {
  ARCADE,
  AREAS,
  CRUISER,
  DINER,
  DRIVEWAY,
  FRONT_WALK,
  FURNITURE,
  GARAGE,
  HATCH,
  HOTSPOTS,
  HOUSE_PARTS,
  INNER_WALLS,
  LIMO,
  LINKS,
  MEMORIES,
  MEMORY_COLORS,
  NEIGHBOURS,
  PLAN,
  RINGS,
  ROAD,
  SCHOOL_PARTS,
  START,
  TASKS,
  TREES,
  YARDS,
  behindYaw,
  cameraMove,
  canLand,
  dropAt,
  exitCruiser,
  floorAt,
  inArea,
  nearHotspot,
  nearLink,
  newCruiser,
  newMorty,
  progress,
  stepCruiser,
  stepMorty,
} from './rules';
import { newFedShip, newShipVoice, onTail, shipSays, stepFedShip } from './ship';
import { DESTINATIONS, DIAL, destinationById, linkTarget, portalTarget, readDial, writeDial } from './dimensions/destinations';
import DimensionDial from './dimensions/DimensionDial';
import { ROOMS, newTrial, pick as pickRoom, retry as retryRooms } from './dimensions/vindicatorsRules';
import { setShipVoice, shipVoiceOn, speak, stopSpeaking } from './shipVoice';
import { ROOMS_SAY, SAY } from './say';
import { lineVoice } from './voicelines';
import { preloadVoiced, sayVoiced, stopVoiced } from '../../../lib/voiced';
import Wardrobe from '../wardrobe/Wardrobe';
import { useLooks } from '../wardrobe/useLooks';
import './world.css';
import GuideCue from '../../guide/GuideCue';
import { useTravellers } from '../../middleearth/towns/useTravellers';

// Dimension C-137, the world: walk about the Smiths' street as Morty, go into
// the house, Rick's garage and Harry Herpson High, fly Rick's space cruiser
// over the roofs, and step through the garage's portal to the alien street and
// Blips and Chitz. The rules are in ./rules.js and the drawing in ./scene.js;
// this is the controls, the camera's yaw, the HUD, the doors and the things to
// do. Each toy opens over the page (the page's own components, the pop quiz,
// Roy); close it and you're back in the room. Without 3D, the places are
// cards that open the same things. The egg on the living room's bookcase
// starts Total Rickall there (./interiors/rickall.js, loaded then): Morty
// kept in the room with the crowd, a crosshair, E for a memory of whoever's
// in it, F or a click to shoot them, and a card for how it ended.

const Roy = lazy(() => import('./roy/Roy').catch(() => ({ default: RoyDown })));
const Sewer = lazy(() => import('./sewer/Sewer').catch(() => ({ default: RoyDown })));
const sound = (name) =>
  import('../../games/gameAudio')
    .then((g) => g[name]?.())
    .catch(() => {});

const DONE = 'tp-c137-done';
const ROY = 'tp-c137-roy';
const TASK_IDS = new Set(TASKS.map((t) => t.id));
const readDone = () => {
  const d = local.get(DONE, []);
  return Array.isArray(d) ? d.filter((x, i) => TASK_IDS.has(x) && d.indexOf(x) === i) : [];
};
// the best age as Roy so far, or null before a life's been lived
const readBest = () => Math.max(0, Math.floor(Number(local.get(ROY, null)?.best) || 0)) || null;
// Roy's tasks from what Roy keeps (tp-c137-roy): a life lived, and one past Morty's 55
const royDone = () => {
  const r = local.get(ROY, null);
  const best = Number(r?.best) || 0;
  return [...((Number(r?.lives) || 0) > 0 || best > 0 ? ['roy'] : []), ...(best > MORTY_BEST ? ['roy55'] : [])];
};
// what's done, with Roy's caught up (a life that ended before the page was left)
const startDone = () => {
  const d = readDone();
  const more = royDone().filter((id) => !d.includes(id));
  if (!more.length) return d;
  const next = [...d, ...more];
  local.set(DONE, next);
  return next;
};
const CANT_LAND = 'Can’t land here. Slow right down over open ground, clear of the doors: the road or a front lawn.';

// what opens over the page, and the task opening it ticks off
const PLACES = {
  cable: { title: 'Interdimensional cable', where: 'The Smiths’ living room', task: 'cable' },
  butter: { title: 'The butter robot', where: 'The breakfast table', task: 'butter' },
  meeseeks: { title: 'Mr. Meeseeks box', where: 'Rick’s worktable', task: 'meeseeks' },
  plumbus: { title: 'The plumbus factory', where: 'Rick’s garage', task: 'plumbus' },
  portalpanic: { title: 'Portal panic', where: 'The cabinet in Rick’s garage', task: 'portalpanic' },
  quiz: { title: 'Mr. Goldenfold’s pop quiz', where: 'Harry Herpson High' },
  roy: { title: 'Roy: A Life Well Lived', where: 'Blips and Chitz', full: true },
  sewer: { title: 'Pickle Rick’s sewer run', where: 'The agency', full: true },
};
const AREA_NAME = {
  street: 'The Smiths’ street',
  house: 'The Smith house',
  upstairs: 'Upstairs',
  garage: 'Rick’s garage',
  school: 'Mr. Goldenfold’s classroom',
  annex: 'The alien street',
  arcade: 'Blips and Chitz',
  basement: 'Rick’s clone lab',
  mindblowers: 'Morty’s Mind Blowers',
  oval: 'The Oval Office',
  diner: 'Shoney’s',
  wong: 'Dr. Wong’s office',
  ...Object.fromEntries(DESTINATIONS.map((d) => [d.id, d.name])),
};
// a place's name inside a sentence ('The alien street' → 'the alien street')
const inLine = (name) => name.replace(/^The /, 'the ');
// what talking to someone does, beyond what they say: a thing to do, done
const TALK_DONE = { president: 'president', dineragent: 'diner', therapy: 'wong', ...Object.assign({}, ...DESTINATIONS.map((d) => d.done)) };
// and the achievements a talk earns
const TALK_UNLOCK = { therapy: 'wong', ...Object.assign({}, ...DESTINATIONS.map((d) => d.unlock)) };
// the places left in a hurry (./dimensions/destinations.js's `escape`), by
// the hotspot that starts the clock: the Purge Planet's siren, Customs'
// scanner, the wedding's toast
const ESCAPES = Object.fromEntries(DESTINATIONS.filter((d) => d.escape).map((d) => [d.escape.spot, { ...d.escape, area: d.id }]));
// and what using a hotspot tells its place's builder
const ACTS = Object.assign({}, ...DESTINATIONS.map((d) => Object.fromEntries(Object.entries(d.acts).map(([spot, name]) => [spot, [d.id, name]]))));
// and the things done by using every one of a set of hotspots (the simulation's slips), by each hotspot
const COLLECT = Object.assign({}, ...DESTINATIONS.filter((d) => d.collect).map((d) => Object.fromEntries(d.collect.spots.map((spot) => [spot, { ...d.collect, area: d.id }]))));
// a memory's run in the Mind Blowers chair, and how far Morty can stray from the chair before it stops
const MEMORY_S = 5.5;
// Total Rickall: how long a memory of someone stays up over them, and how
// little a click may drag the view and still be a shot (px, ms)
const RECALL_MS = 9000;
const CLICK = { px: 6, ms: 400 };
const NO_HATCH = 'The egg won’t hatch. Give it a moment, then try again.';
const TALK_MS = 3200; // how long someone talks before what they've said counts
const SHIP_WAIT = 6; // how long the cruiser keeps a line it was about to say, in seconds
const CHAIR_R = 1.2;

// the prompt for each thing Morty can be next to
const linkVerb = (l) =>
  l.kind === 'portal' ? 'Step through' : l.kind === 'exit' ? 'Go out' : l.kind === 'stairs' ? (l.to === 'upstairs' ? 'Go up' : 'Go down') : l.kind === 'hatch' ? (l.to === 'basement' ? 'Go down' : 'Climb up') : 'Go in';
const PROMPT = {
  ...Object.fromEntries(LINKS.map((l) => [`link:${l.id}`, { kind: 'link', id: l.id, name: l.label, verb: linkVerb(l), link: l }])),
  ...Object.fromEntries(HOTSPOTS.map((h) => [`spot:${h.id}`, { kind: 'spot', id: h.id, name: h.label, verb: h.verb, spot: h }])),
  cruiser: { kind: 'cruiser', id: 'cruiser', name: 'Rick’s space cruiser', verb: 'Board' },
  land: { kind: 'land', id: 'land', name: 'Open ground', verb: 'Land' },
};
const BOARD_R = 2.7; // how near the cruiser's middle Morty can get in from

// Where the next thing to do is, for the map's marker: the area and the spot
// in it, and from anywhere else, the way towards it.
const GOAL = { cable: ['house', 'spot:cable'], butter: ['house', 'spot:butter'], meeseeks: ['garage', 'spot:meeseeks'], plumbus: ['garage', 'spot:plumbus'], portalpanic: ['garage', 'spot:portalpanic'], quiz: ['school', 'spot:quiz'], fly: ['street', 'cruiser'], portal: ['garage', 'link:garage-portal'], basement: ['garage', 'link:garage-hatch'], roy: ['arcade', 'spot:roy'], roy55: ['arcade', 'spot:roy'], president: ['street', 'spot:president'], oval: ['garage', 'link:garage-oval'], diner: ['street', 'link:diner-door'], mindblowers: ['mindblowers', 'spot:chair'], rickall: ['house', 'spot:egg'], wong: ['street', 'link:wong-door'], ...Object.fromEntries(DESTINATIONS.flatMap((d) => d.tasks.map((t) => [t.id, [d.id, `spot:${Object.keys(d.done).find((k) => d.done[k] === t.id) ?? d.escape?.after ?? d.escape?.spot ?? d.goal}`]]))), sewer: ['agency', 'spot:sewer'] };
// (every destination is through the garage's portal)
const toDest = (via) => Object.fromEntries(DESTINATIONS.map((d) => [d.id, via]));
const WAY = {
  street: { house: 'house-door', upstairs: 'house-door', garage: 'garage-door', basement: 'garage-door', mindblowers: 'garage-door', oval: 'garage-door', school: 'school-door', diner: 'diner-door', wong: 'wong-door', annex: 'garage-door', arcade: 'garage-door', ...toDest('garage-door') },
  house: { street: 'front', upstairs: 'stairs-up', garage: 'kitchen-garage', basement: 'kitchen-garage', mindblowers: 'kitchen-garage', oval: 'kitchen-garage', school: 'front', diner: 'front', wong: 'front', annex: 'kitchen-garage', arcade: 'kitchen-garage', ...toDest('kitchen-garage') },
  garage: { street: 'garage-exit', house: 'garage-kitchen', upstairs: 'garage-kitchen', basement: 'garage-hatch', mindblowers: 'garage-hatch', oval: 'garage-oval', school: 'garage-exit', diner: 'garage-exit', wong: 'garage-exit', annex: 'garage-portal', arcade: 'garage-portal', ...toDest('garage-portal') },
  basement: { mindblowers: 'basement-mind' },
  annex: { arcade: 'arcade-door' },
};
const OUT = { upstairs: 'stairs-down', school: 'school-exit', annex: 'annex-portal', arcade: 'arcade-exit', basement: 'basement-ladder', mindblowers: 'mind-door', oval: 'oval-portal', diner: 'diner-exit', wong: 'wong-exit', ...Object.fromEntries(DESTINATIONS.map((d) => [d.id, `${d.id}-portal`])) };
function goalOf(next, s) {
  if (!next || s.flying) return null;
  const [to, key] = GOAL[next.id];
  if (to === s.area) {
    if (key === 'cruiser') return { x: s.c.x, z: s.c.z };
    const p = PROMPT[key];
    return p.link ?? p.spot;
  }
  const id = WAY[s.area]?.[to] ?? OUT[s.area];
  return PROMPT[`link:${id}`]?.link ?? null;
}

// who's standing in Total Rickall, for Morty to walk round (made again when someone's shot)
const crowdOf = (run) => {
  if (run.crowdN !== run.game.shot.length) {
    run.crowdN = run.game.shot.length;
    run.crowd = run.game.people.filter((p) => !run.game.shot.includes(p.id)).map(({ id, x, z, r }) => ({ id, x, z, r }));
  }
  return run.crowd;
};

const PITCH = 0.17; // the walking camera's lift, as the scene has it
const FADE_MS = 260;
const CLIMB_MS = 480; // down the hatch or up the ladder: a slower fade
const FLY_KEYS = { KeyR: 'rise', KeyF: 'sink', KeyC: 'sink' };
const clamp1 = (v) => Math.max(-1, Math.min(1, v));
const roomAt = (area, x, z) => PLAN.find((r) => r.area === area && x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)?.name ?? null;
const newSim = () => ({
  area: START.area,
  m: newMorty(START),
  c: newCruiser(),
  flying: false,
  landing: false,
  landT: 0,
  boardAt: null,
  yaw: behindYaw(START.face),
  pitch: PITCH,
  dragAt: -1e9,
  t: 0,
  keys: new Set(),
  stick: { x: 0, y: 0 },
  lift: 0,
  jump: false, // asked to jump (Space, or the jump button), till the next step takes it
  near: null,
  moved: false,
  fading: false,
  events: [],
  emit: null,
  duel: null, // a fight on (hearts in the HUD; F fires)
  frame: 0,
  padBefore: {},
  view: { link: null, hotspot: null },
  // the cruiser's voice and what it's noticed; the Federation's ship; a memory playing
  voice: newShipVoice(),
  tookOff: false,
  fastT: 0,
  landedAt: -1e9,
  leftFrom: null,
  shipNext: null,
  fed: newFedShip(),
  mind: null,
  // Total Rickall, while it's on: { phase ('hatching', 'on', 'over'), seed,
  // game (./interiors/rickall.js's), aim (who's in the sights), hide (who's
  // right at his shoulder, out of the picture), told (the memory up over
  // someone), end (how it ended), crowd (who's standing, for Morty to walk
  // round) }
  rickall: null,
});

export default function RmWorld() {
  const three = use3D();
  const { unlock } = useAchievements();
  const [done, setDone] = useState(startDone);
  const doneRef = useRef(done);
  const [open, setOpen] = useState(null);
  const openRef = useRef(null);
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const [toast, setToast] = useState(null);
  const pending = useRef([]); // tasks done while something's open over the page, told on the way out
  const api = useRef(null);

  // (what someone says is heard in their own voice where it's been made
  // (./voicelines.js, lib/voiced.js); the next thing said, voiced or not, stops it)
  const say = useCallback((t) => {
    setToast({ ...t, at: performance.now() });
    if (t.kind === 'say') sayVoiced(lineVoice(t.text), t.text);
  }, []);
  useEffect(() => {
    preloadVoiced();
    return stopVoiced;
  }, []);
  const tellDone = useCallback((ids) => {
    const names = ids.map((id) => TASKS.find((t) => t.id === id)?.name).filter(Boolean);
    const p = progress(doneRef.current);
    setToast({ kind: 'done', who: names.join(' and '), text: p.next ? `${p.count} of ${p.total} done` : `All ${p.total} done. Wubba lubba dub dub.`, at: performance.now() });
  }, []);

  // A thing to do, done: kept straight away (not only when the page is left),
  // sparks over Morty, and a toast now or when what's open closes.
  const complete = useCallback(
    (id) => {
      if (!TASK_IDS.has(id) || doneRef.current.includes(id)) return;
      const next = [...doneRef.current, id];
      doneRef.current = next;
      local.set(DONE, next);
      setDone(next);
      api.current?.fx('done', { id });
      sound('gadget');
      // (and Morty's pleased with himself)
      api.current?.play('cheer', { hold: 0.2 });
      if (openRef.current) pending.current.push(id);
      else tellDone([id]);
    },
    [tellDone],
  );

  const openPlace = useCallback(
    (id) => {
      if (!PLACES[id]) return;
      audioContext();
      openRef.current = id;
      setOpen(id);
      if (PLACES[id].task) complete(PLACES[id].task);
    },
    [complete],
  );
  const close = useCallback(() => {
    openRef.current = null;
    setOpen(null);
    if (pending.current.length) {
      tellDone(pending.current);
      pending.current = [];
    }
  }, [tellDone]);
  const quizDone = useCallback(
    (pass) => {
      if (!pass) return;
      complete('quiz');
      unlock('goldstar');
    },
    [complete, unlock],
  );
  // Roy's headset off: a life lived (and past Morty's 55), and the arcade's board shows the best
  const royLeft = useCallback(
    (age) => {
      const ids = age != null ? ['roy', ...(age > MORTY_BEST ? ['roy55'] : [])] : [];
      for (const id of new Set([...ids, ...royDone()])) complete(id);
      close();
      api.current?.act?.('arcade', 'setBoard', readBest());
    },
    [complete, close],
  );

  // up the hole from the sewer: the run counts when the far drain was made
  const sewerLeft = useCallback(
    (won) => {
      close();
      if (won) complete('sewer');
    },
    [complete, close],
  );

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.kind === 'say' ? 5600 : toast.bad ? 3400 : 4400);
    return () => clearTimeout(t);
  }, [toast]);

  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="rm-world" aria-labelledby="rm-world-title" data-mode={world ? '3d' : 'cards'}>
      {world ? (
        <World api={api} done={done} open={open} openPlace={openPlace} complete={complete} unlock={unlock} gl={gl} setGl={setGl} toast={toast} say={say} />
      ) : (
        <Cards done={done} openPlace={openPlace} three={three} gl={gl} toast={toast} retry={() => setGl('loading')} />
      )}
      {open && <Place id={open} onClose={close} onQuiz={quizDone} onRoy={royLeft} onSewer={sewerLeft} />}
    </section>
  );
}

function Title() {
  return (
    <h2 id="rm-world-title" className="rm-title" aria-label="Dimension C-137">
      <span aria-hidden="true">Dimension</span> <span className="rm-title-num" aria-hidden="true">C-137</span>
    </h2>
  );
}

// a toast: something done, someone talking, or a no
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="rm-toast" data-kind={toast.kind ?? 'note'} data-bad={toast.bad || undefined} role="status" key={toast.at}>
      {toast.kind === 'done' && (
        <span className="rm-toast-tick" aria-hidden="true">
          <RiCheckLine />
        </span>
      )}
      <p>
        {toast.who && <b>{toast.who}</b>}
        <span>{toast.text}</span>
      </p>
    </div>
  );
}

// others online (middleearth/towns/useTravellers), as Mortys from other
// dimensions, in the street or whichever room you're in (each its own area:
// the rooms are built out to some 400 m from the street, hence the reach)
const ROOM = { bound: 820, motion: true };

function World({ api, done, open, openPlace, complete, unlock, gl, setGl, toast, say }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const trav = useTravellers('c137', gl === 'on', ROOM);
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.35 });
  const canvas = useRef(null);
  const map = useRef(null);
  const brand = useRef(null); // (the title and what to do: Total Rickall's memory card keeps off it)
  const sim = useRef(null);
  if (!sim.current) sim.current = newSim();
  const prog = progress(done);
  const progRef = useRef(prog);
  progRef.current = prog;
  const doneRef = useRef(done);
  doneRef.current = done;
  const [hud, setHud] = useState({ area: START.area, room: null, flying: false, landing: false, near: null, moved: false, alt: 0, kmh: 0 });
  const hudKey = useRef('');
  const [list, setList] = useState(false);
  const listRef = useRef(list);
  listRef.current = list;
  // the wardrobe: how Morty looks here (and Rick, wherever he turns up)
  const [looks, setLook] = useLooks();
  const looksRef = useRef(looks);
  looksRef.current = looks;
  const [wardrobe, setWardrobe] = useState(false);
  // the portal gun's dial, open at its stand in the garage (it holds Morty still, as the wardrobe does)
  const [dialing, setDialing] = useState(false);
  const dialRef = useRef(readDial());
  // Rick's rooms on the Vindicators' ship, asked one at a time (it holds him still too)
  const [trial, setTrial] = useState(null);
  const trialRef = useRef(newTrial());
  const wardrobeRef = useRef(wardrobe);
  wardrobeRef.current = wardrobe || dialing || !!trial;
  const closeWardrobe = useCallback(() => setWardrobe(false), []);
  const closeDial = useCallback(() => setDialing(false), []);
  const pickDial = useCallback(
    (id) => {
      writeDial(id);
      dialRef.current = portalTarget(id);
      setDialing(false);
      const d = DIAL.find((o) => o.id === dialRef.current);
      say({ kind: 'note', text: `Dialled to ${d.name}. Step through the portal.` });
    },
    [say],
  );
  const closeTrial = useCallback(() => setTrial(null), []);
  const pickTrial = useCallback(
    (id) => {
      const t = trialRef.current;
      const r = pickRoom(t, id);
      if (r === 'next') {
        setTrial({ ...t });
        say({ kind: 'note', text: 'Right. The door slides open on the next room.' });
      } else if (r === 'lost') {
        setTrial(null);
        say({ kind: 'say', ...ROOMS_SAY.lost });
      } else if (r === 'won') {
        setTrial(null);
        say({ kind: 'say', ...ROOMS_SAY.won });
        complete('vindicators');
        unlock('vindicators');
      }
    },
    [say, complete, unlock],
  );
  // (the same list for as long as he's in one room, so the overlay keeps its place in it)
  const room = trial?.room ?? null;
  const trialItems = useMemo(() => (room == null ? [] : ROOMS[room].choices.map((c) => ({ id: c.id, name: c.text }))), [room]);
  useEffect(() => {
    api.current?.setLooks?.(looks);
  }, [api, looks]);
  const chip = useRef(null);
  const listBox = useRef(null);
  // closing the list: if the focus was in it, back to the chip that opened it
  const closeList = useCallback(() => {
    const inside = listBox.current?.contains(document.activeElement);
    setList(false);
    if (inside) chip.current?.focus({ preventScroll: true });
  }, []);
  const [fade, setFade] = useState(null);
  const [duel, setDuel] = useState(null); // the fight's hearts, for the HUD
  const [clock, setClock] = useState(null); // a place left in a hurry: seconds left to the portal
  const clockRef = useRef(null); // null, or the kind of link being gone through
  const [opening, setOpening] = useState(null); // the place a portal's waiting on while it loads
  const [shipLine, setShipLine] = useState(null); // what the cruiser last said, captioned
  const [memory, setMemory] = useState(null); // the memory playing in the Mind Blowers chair
  // the cruiser says something, if it's the time for it (./ship.js decides)
  // (held back only because it's just spoken: asked again for a few seconds)
  const shipTalk = useCallback((event) => {
    const s = sim.current;
    const r = shipSays(s.voice, event, s.t);
    s.voice = r.v;
    if (r.held) s.shipNext = { event, until: s.shipNext?.event === event ? s.shipNext.until : s.t + SHIP_WAIT };
    if (!r.line) return;
    if (s.shipNext?.event === event) s.shipNext = null;
    setShipLine({ text: r.line, at: performance.now() });
    speak(r.line);
  }, []);
  // the ship goes quiet when the world does, and it and whoever was talking when something opens over it
  useEffect(() => stopSpeaking, []);
  useEffect(() => {
    if (open) {
      stopSpeaking();
      stopVoiced();
    }
  }, [open]);
  useEffect(() => {
    if (!shipLine) return undefined;
    const t = setTimeout(() => setShipLine(null), 2600 + shipLine.text.length * 55);
    return () => clearTimeout(t);
  }, [shipLine]);
  // a memory, from the chair: the room flashes its colour
  const playMemory = useCallback(
    (i) => {
      const s = sim.current;
      if (i >= MEMORIES.length) {
        s.mind = null;
        setMemory(null);
        return;
      }
      s.mind = { ...s.mind, i, next: s.t + MEMORY_S };
      setMemory({ i, ...MEMORIES[i], at: performance.now() });
      if (i === 1) complete('mindblowers');
      api.current?.act?.('mindblowers', 'play', MEMORIES[i].color);
      sound('zap');
    },
    [api, complete],
  );
  const timers = useRef(new Set());
  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);
  useEffect(() => {
    const all = timers.current;
    return () => {
      all.forEach(clearTimeout);
      all.clear();
    };
  }, []);

  // ── Total Rickall ──
  // The egg picked up: the rules fetched (the first time), the room chosen
  // and everyone in it loaded, Morty kept in the living room meanwhile; one
  // whose model won't load is left out and the room chosen again without
  // them, and Morty is never in it (he's the one looking). Then the crosshair,
  // E for a memory of whoever's in it, F or a click to shoot them, till it
  // ends (a card) or he stops (Esc, or the button).
  const rkRules = useRef(null);
  const [game, setGame] = useState(null); // what the HUD shows of it: { phase, left, secs, aim, told, end }
  const gameKey = useRef('');
  const recall = useRef(null); // the memory card, moved over whoever it's about each frame
  const stopRickall = useCallback(() => {
    const s = sim.current;
    if (!s.rickall) return;
    s.rickall = null;
    s.m = { ...s.m, mode: null };
    s.pitch = PITCH;
    s.keys.clear();
    gameKey.current = '';
    setGame(null);
  }, []);
  const startRickall = useCallback(
    async (seed = Math.floor(Math.random() * 1e9) + 1) => {
      const s = sim.current;
      const w = api.current;
      if (!w || s.area !== 'house' || s.rickall?.phase === 'hatching') return false;
      const run = { phase: 'hatching', seed, game: null, aim: null, hide: [], told: null, end: null, crowd: [], crowdN: -1 };
      s.rickall = run;
      s.m = { ...s.m, mode: 'rickall' };
      s.keys.clear();
      sound('splat');
      try {
        rkRules.current ??= await import('./interiors/rickall');
        const { newRickall } = rkRules.current;
        let absent = ['morty'];
        let g = null;
        for (let i = 0; i < 8 && !g; i++) {
          const next = newRickall(seed, { absent });
          const ids = next.people.map((p) => p.id);
          const ok = (await w.act('house', 'rickall', ids)) ?? [];
          if (s.rickall !== run || api.current !== w) return false; // (stopped, or the world gone, meanwhile)
          const missing = ids.filter((id) => !ok.includes(id));
          if (missing.length) absent = [...absent, ...missing];
          else g = next;
        }
        if (!g?.people.some((p) => p.parasite)) throw new Error('nobody to play with');
        run.game = g;
        run.phase = 'on';
        // Morty back at the egg, turned to the room, the camera behind him:
        // nobody's put where he's standing, and the crowd's in front of him
        const at = rkRules.current.MORTY_AT;
        s.m = newMorty(at, 'rickall');
        s.yaw = behindYaw(at.face);
        s.pitch = PITCH;
        s.dragAt = -1e9;
        sound('portalHop');
        return true;
      } catch (err) {
        if (import.meta.env.DEV) console.warn('C-137: Total Rickall', err);
        if (s.rickall === run) {
          stopRickall();
          say({ kind: 'note', bad: true, text: NO_HATCH });
        }
        return false;
      }
    },
    [api, say, stopRickall],
  );
  // how it ended: a card, and if it's won, the thing to do done
  const endRickall = useCallback(
    (run) => {
      run.phase = 'over';
      run.told = null;
      run.end = rkRules.current.ending(run.game);
      if (run.end.kind === 'won') {
        complete('rickall');
        unlock('rickall');
      } else sound(run.end.kind === 'out' ? 'powerDown' : 'ouch');
    },
    [complete, unlock],
  );
  // F, or a click: a shot at whoever's in the sights (a zap at nobody, if nobody is)
  const shootRickall = useCallback(() => {
    const run = sim.current.rickall;
    if (run?.phase !== 'on') return;
    audioContext();
    sound('zap');
    const p = run.aim && run.game.people.find((o) => o.id === run.aim);
    const hit = p ? rkRules.current.shoot(run.game, p.id) : null;
    if (!hit) return;
    api.current?.fx('shot', { x: p.x, y: p.h * 0.6, z: p.z, parasite: p.parasite });
    if (run.told?.id === p.id) run.told = null;
    if (hit === 'parasite') sound('splat');
    else endRickall(run);
  }, [api, endRickall]);
  // E: what Morty remembers of whoever's in the sights, the next memory of them each time
  const tellRickall = useCallback(() => {
    const run = sim.current.rickall;
    if (run?.phase !== 'on' || !run.aim) return;
    const r = rkRules.current.tell(run.game, run.aim);
    if (!r) return;
    const p = run.game.people.find((o) => o.id === run.aim);
    run.told = { id: p.id, name: p.name, text: r.memory.text, n: (run.told?.n ?? 0) + 1, at: performance.now() };
    sound('seed');
  }, []);

  // ── what E does ──
  // through a door, up the stairs or through the portal: a fade to black (or
  // green), and out the other side, the camera behind him; down the hatch or
  // up the ladder, a slower one, the lid clanking. A place not built yet (one
  // that loads when it's first entered) starts loading as the fade begins,
  // and the swirl holds till it's there; if the page is left, or the world
  // lost, meanwhile, the trip's off and what loaded is let go.
  const go = useCallback(
    (via) => {
      const s = sim.current;
      if (s.fading) return;
      // (the garage's portal goes where the dial is set: read fresh, as the page's portal gun sets it too)
      dialRef.current = readDial();
      const l = linkTarget(via, dialRef.current);
      s.fading = true;
      s.keys.clear();
      const climb = l.kind === 'hatch';
      setFade(l.kind === 'portal' ? 'portal' : climb ? (l.to === 'basement' ? 'down' : 'up') : 'door');
      if (l.kind === 'portal') sound('portalOpen');
      else if (climb) sound('splat');
      const w = api.current;
      const loading = w && !w.hasArea(l.to) ? w.ensureArea(l.to) : null;
      later(async () => {
        if (loading) {
          if (l.kind === 'portal') setOpening(AREA_NAME[l.to] ?? null);
          await loading.catch(() => {});
          setOpening(null);
          if (api.current !== w || !w.hasArea(l.to)) {
            s.fading = false;
            setFade(null);
            return;
          }
        }
        stopRickall(); // (a trip anywhere is the end of Total Rickall)
        s.area = l.to;
        s.m = newMorty(l.arrive);
        // out of a portal, the camera stands off to one side, so the swirl
        // is beside him rather than between him and the camera
        s.yaw = behindYaw(l.arrive.face) + (l.kind === 'portal' ? 0.85 : 0);
        s.pitch = PITCH;
        s.dragAt = l.kind === 'portal' ? s.t : -1e9;
        s.keys.clear();
        s.fading = false;
        if (l.kind === 'portal') {
          // the portal on this side, swirling open behind him
          const far = LINKS.find((x) => x.area === l.to && x.kind === 'portal' && x.to === l.area);
          api.current?.fx('portal', { at: far ? { x: far.x, z: far.z } : { x: l.arrive.x, z: l.arrive.z } });
          sound('portalHop');
          // (Rick's portal, to Blips and Chitz: the President's is a thing to do of its own)
          if (l.id === 'garage-portal') complete('portal');
        }
        if (l.id === 'garage-hatch') complete('basement');
        if (l.id === 'garage-oval') complete('oval');
        // home from a place left in a hurry, inside the time it gave him
        const e = s.escape;
        if (e && l.id === `${e.area}-portal` && s.t - e.at <= e.s) {
          complete(e.task);
          unlock(e.task);
        }
        if (e?.area === l.area) s.escape = null;
        // (what he's used is for this visit, and the place he's left settles)
        s.used = new Set();
        api.current?.act(l.area, 'calm');
        setFade(null);
      }, climb ? CLIMB_MS : FADE_MS);
    },
    [api, complete, unlock, later, stopRickall],
  );
  const board = useCallback(() => {
    const s = sim.current;
    s.flying = true;
    s.landing = false;
    s.boardAt = { x: s.c.x, z: s.c.z };
    s.tookOff = false;
    s.fastT = 0;
    s.leftFrom = null;
    s.keys.clear();
    api.current?.fx('board');
    sound('boost');
    shipTalk('board');
  }, [api, shipTalk]);
  const touchDown = useCallback(() => {
    const s = sim.current;
    s.flying = false;
    s.landing = false;
    s.c = { ...s.c, y: CRUISER.hover, vy: 0, speed: 0, bank: 0 };
    const out = exitCruiser(s.c, { motorcade: !doneRef.current.includes('president') });
    s.m = newMorty(out);
    s.yaw = behindYaw(out.face);
    s.pitch = PITCH;
    s.dragAt = -1e9;
    s.keys.clear();
    api.current?.fx('land');
    sound('powerDown');
    s.landedAt = s.t;
    s.leftFrom = { x: s.c.x, z: s.c.z };
    shipTalk('land');
  }, [api, shipTalk]);
  const act = useCallback(() => {
    const s = sim.current;
    if (!api.current || s.fading || s.landing) return;
    audioContext();
    // (in Total Rickall, E is a memory of whoever's in the sights)
    if (s.rickall) {
      tellRickall();
      return;
    }
    if (s.flying) {
      if (canLand(s.c, { motorcade: !doneRef.current.includes('president') })) {
        // straight down from here: no drift into a roof's edge on the way
        s.landing = true;
        s.landT = 0;
        s.c = { ...s.c, speed: 0 };
        s.keys.clear();
      } else {
        say({ kind: 'note', bad: true, text: CANT_LAND });
        shipTalk('refuse');
      }
      return;
    }
    const n = s.near;
    if (!n) return;
    if (n.kind === 'link') go(n.link);
    else if (n.kind === 'cruiser') board();
    else if (n.spot?.kind === 'rickall') startRickall();
    else if (n.spot?.kind === 'trial') {
      // (from the first room, however the last go ended)
      s.keys.clear();
      if (trialRef.current.state !== 'on') retryRooms(trialRef.current);
      setTrial({ ...trialRef.current });
    }
    else if (PLACES[n.id]) {
      s.keys.clear();
      openPlace(n.id);
    } else if (n.id === 'chair') {
      // sat in the chair, the helmet on: the memories, one after another, till
      // he gets up (E again: the next one)
      s.keys.clear();
      if (s.mind) playMemory(s.mind.i + 1);
      else {
        s.mind = { x: s.m.x, z: s.m.z, i: 0, next: 0 };
        playMemory(0);
      }
    } else if (n.id === 'dial') {
      s.keys.clear();
      dialRef.current = readDial();
      setDialing(true);
    } else if (SAY[n.id]) {
      // (a place's clock starts only once what comes first is done: the
      // scanner finds nothing on him till he's taken the seeds)
      const e = ESCAPES[n.id];
      const early = e?.after && !s.used?.has(e.after);
      say({ kind: 'say', ...(early ? e.before : SAY[n.id]) });
      (s.used ??= new Set()).add(n.id);
      if (!early && n.spot?.anim) api.current?.play(n.spot.anim, n.spot.anim === 'dance' ? { loop: false, hold: 0.2 } : {});
      if (!early && ACTS[n.id]) api.current?.act(...ACTS[n.id]);
      // the siren, the scanner, the toast: the clock starts for the portal home
      if (e && !early && !s.escape) {
        s.escape = { ...e, at: s.t };
        sound('portalOpen');
      }
      // (done once they've had their say: the President gets in his car then)
      if (TALK_DONE[n.id]) later(() => complete(TALK_DONE[n.id]), TALK_MS);
      if (COLLECT[n.id] && COLLECT[n.id].spots.every((id) => s.used.has(id))) {
        const c = COLLECT[n.id];
        // (the last one found: the place is told, and either it's done or the clock starts)
        api.current?.act(c.area, 'collected');
        if (c.escape) {
          if (!s.escape) s.escape = { area: c.area, task: c.task, s: c.escape.s, at: s.t };
          sound('portalOpen');
        } else if (!c.start) later(() => complete(c.task), TALK_MS);
      }
      if (TALK_UNLOCK[n.id]) later(() => unlock(TALK_UNLOCK[n.id]), TALK_MS);
    }
  }, [api, go, board, openPlace, say, complete, unlock, playMemory, shipTalk, later, startRickall, tellRickall]);
  // what a place's people do to Morty (stage.js's NPC behaviour, through the
  // render state's emit): caught, he's put back at the way in with what the
  // catcher said, and the place settles; a bark is a line said in passing
  const npc = useCallback(
    (name, e) => {
      const s = sim.current;
      if (!s || s.fading || s.area !== e.area) return;
      if (name === 'caught') {
        const d = destinationById(e.area);
        if (!d) return;
        say({ kind: 'say', who: SAY[e.who]?.who ?? e.who ?? null, text: e.text ?? d.caught ?? 'Caught.' });
        sound('ouch');
        api.current?.play('scared', { hold: 0.4 });
        // a blink, and he's back at the way in
        s.fading = true;
        s.keys.clear();
        setFade('door');
        later(() => {
          s.m = newMorty(d.arrive);
          s.yaw = behindYaw(d.arrive.face);
          s.pitch = PITCH;
          s.dragAt = -1e9;
          s.used = new Set();
          s.escape = null;
          s.fading = false;
          api.current?.act(e.area, 'calm');
          setFade(null);
        }, FADE_MS);
      } else if (name === 'bark') {
        if (s.t - (s.barkAt ?? -1e9) < 6) return;
        s.barkAt = s.t;
        say({ kind: 'say', who: e.who, text: e.text });
      } else if (name === 'done') complete(e.task);
      else if (name === 'spotted') {
        // someone's seen him: a word and a sound, not too often
        if (s.t - (s.spottedAt ?? -1e9) < 8) return;
        s.spottedAt = s.t;
        sound('zap');
        say({ kind: 'say', who: SAY[e.who]?.who ?? null, text: e.text ?? 'They’ve seen you.' });
      } else if (name === 'duel') {
        // the fight's on: the hearts show, and F fires
        s.duel = { who: e.who, hp: e.hp, max: e.max, mortyHp: e.mortyHp, mortyMax: e.mortyMax };
        setDuel({ ...s.duel });
        sound('zap');
      } else if (name === 'strike') {
        s.duel = { who: e.who, hp: e.hp, max: e.max, mortyHp: e.mortyHp, mortyMax: e.mortyMax };
        setDuel({ ...s.duel });
        sound('ouch');
        if (e.beaten) {
          // beaten: he goes down, and comes round at the way in; the fight's off till the next try
          api.current?.play('fall', { hold: 1.2 });
          say({ kind: 'say', who: SAY[e.who]?.who ?? e.who ?? null, text: e.text ?? 'Beaten.' });
          const d = destinationById(e.area);
          s.fading = true;
          s.keys.clear();
          later(() => {
            setFade('door');
            later(() => {
              if (d) {
                s.m = newMorty(d.arrive);
                s.yaw = behindYaw(d.arrive.face);
                s.pitch = PITCH;
                s.dragAt = -1e9;
              }
              s.used = new Set();
              s.escape = null;
              s.duel = null;
              setDuel(null);
              s.fading = false;
              api.current?.act(e.area, 'calm');
              setFade(null);
            }, FADE_MS);
          }, 1400);
        } else api.current?.play('hit');
      }
    },
    [api, say, complete, later],
  );
  // Morty's shot in a duel (F): the place says whether it landed
  const fire = useCallback(() => {
    const s = sim.current;
    if (!s?.duel || s.fading || s.t - (s.firedAt ?? -1e9) < 0.5) return;
    s.firedAt = s.t;
    api.current?.play('shoot', { hold: 0 });
    sound('zap');
    const r = api.current?.act(s.area, 'fire', { x: s.m.x, z: s.m.z, face: s.m.face });
    if (!r) return;
    s.duel = { ...s.duel, hp: r.hp, max: r.max };
    setDuel({ ...s.duel });
    if (r.down) {
      sound('splat');
      if (r.task) complete(r.task);
      if (r.won) later(() => say({ kind: 'say', ...r.won }), 900);
      later(() => {
        s.duel = null;
        setDuel(null);
      }, 2500);
    }
  }, [api, complete, say, later]);
  const fns = useRef({});
  fns.current = { act, go, shoot: shootRickall, stop: stopRickall, start: startRickall, end: endRickall, npc, fire };

  // ── the world: made once, kept while something's open over it ──
  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./scene')
      .then(({ createRmWorld }) => {
        if (dead || !canvas.current) return null;
        return createRmWorld(canvas.current, { onLost: () => !dead && setGl('lost'), looks: looksRef.current });
      })
      .then((a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        a.act?.('arcade', 'setBoard', readBest());
        a.setLooks?.(looksRef.current); // (a look picked while it loaded)
        if (import.meta.env.DEV) {
          // for the QA scripts (scripts/c137-shots.mjs): where everyone is, E,
          // a jump to anywhere, and a trip anywhere the way a door makes it
          const s = sim.current;
          const land = () => {
            if (s.flying) s.c = { ...s.c, y: CRUISER.hover, vy: 0, speed: 0, bank: 0 };
            s.flying = false;
            s.landing = false;
          };
          const warp = (area, x, z, face = Math.PI / 2) => {
            land();
            s.area = area;
            s.m = newMorty({ x, z, face }, s.m.mode); // (in Total Rickall, still in the living room)
            s.yaw = behindYaw(face);
            s.keys.clear();
          };
          window.__C137__ = Object.assign(window.__C137__ ?? {}, {
            api: a,
            sim: s,
            act: () => fns.current.act(),
            complete,
            warp,
            // the portal gun's dial, set as the stand in the garage sets it
            dial(id) {
              writeDial(id);
              dialRef.current = portalTarget(id);
              return dialRef.current;
            },
            // Total Rickall, with `seed` (by the egg first, if he isn't in the
            // house): resolves true once it's on. Then lookAt(id) stands Morty
            // in front of someone with them in the sights, as a player would,
            // and shoot() is F. (sim.rickall has the game.)
            rickall(seed = 1) {
              if (s.area !== 'house') warp('house', -305.1, -6.5, 0);
              return fns.current.start(seed);
            },
            // (from the room's middle side of them first, then round either
            // way, the first place he can stand with them in the sights)
            lookAt(id, back = 1.3) {
              const R = rkRules.current;
              const run = s.rickall;
              const p = run?.game?.people.find((o) => o.id === id);
              if (!p || !R) return false;
              const mid = { x: -301.8, z: -4.95 }; // (the living room's middle)
              const toward = Math.atan2(mid.z - p.z, mid.x - p.x);
              for (const turn of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.2, -2.2, Math.PI]) {
                const a = toward + turn;
                const at = { x: p.x + Math.cos(a) * (p.r + back), z: p.z + Math.sin(a) * (p.r + back) };
                const m = newMorty({ ...at, face: Math.atan2(-(p.z - at.z), p.x - at.x) }, 'rickall');
                const stood = stepMorty(m, { x: 0, z: 0 }, 1 / 60, 'house', { crowd: crowdOf(run) });
                if (Math.hypot(stood.x - at.x, stood.z - at.z) > 0.01) continue;
                let yaw = s.yaw;
                for (let i = 0; i < 4; i++) {
                  const o = R.sight(m, yaw);
                  yaw = Math.atan2(-(p.x - o.x), -(p.z - o.z));
                }
                const o = R.sight(m, yaw);
                const pitch = Math.atan2(o.y - p.h * 0.6, Math.hypot(p.x - o.x, p.z - o.z)) + R.SIGHT.level - R.SIGHT.tip;
                if (R.aimAt(run.game, R.sight(m, yaw, pitch)) !== id) continue;
                s.m = m;
                s.yaw = yaw;
                s.pitch = pitch;
                s.dragAt = s.t;
                s.keys.clear();
                return true;
              }
              return false;
            },
            shoot: () => fns.current.shoot(),
            stopRickall: () => fns.current.stop(),
            // through a door that isn't there: the fade, a place that loads
            // when it's entered built first, and Morty out at (x, z) facing
            // `face`, the camera behind him. False if he's already on his way
            // somewhere.
            goto(area, x, z, face = Math.PI / 2) {
              if (!AREAS[area]) throw new Error(`C-137: no area ${area}`);
              if (s.fading) return false;
              land();
              fns.current.go({ id: 'goto', area: s.area, kind: 'door', to: area, label: '', arrive: { x, z, face } });
              return true;
            },
            // true once he's there and nothing's still loading: the place, and
            // whoever's in it
            ready: () => api.current === a && !a.lost && !s.fading && a.hasArea(s.area) && a.loading() === 0,
          });
        }
        fit();
        setGl('on');
      })
      .catch((e) => {
        if (import.meta.env.DEV) console.error(e);
        if (!dead) setGl('failed');
      });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (canvas.current) ro?.observe(canvas.current);
    return () => {
      dead = true;
      ro?.disconnect();
      api.current?.dispose();
      api.current = null;
      setGl((g) => (g === 'on' ? 'loading' : g));
    };
  }, [api, setGl, complete]);

  // keys and the frame loop only while the world's on screen and nothing's
  // open over it (closing the effect lets go of every key held)
  const live = gl === 'on' && inView && !open;
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target) || wardrobeRef.current) return; // (the wardrobe's open over him: he stands still)
      const onButton = e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;
      // C: the wardrobe, on foot (flying, it's the cruiser's way down)
      if (e.code === 'KeyC' && !s.flying && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) {
        e.preventDefault();
        s.keys.clear();
        setWardrobe(true);
        return;
      }
      // a duel (Evil Rick's lair): F fires
      if (s.duel && !s.rickall && e.code === 'KeyF' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (!e.repeat) fns.current.fire();
        return;
      }
      // Total Rickall: F shoots; Esc stops it (once the list's shut)
      if (s.rickall && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.code === 'KeyF') {
          e.preventDefault();
          if (!e.repeat) fns.current.shoot();
          return;
        }
        if (e.key === 'Escape' && !listRef.current) {
          e.preventDefault();
          fns.current.stop();
          return;
        }
      }
      const m = keyDown(s.keys, e);
      const f = e.metaKey || e.ctrlKey || e.altKey ? null : FLY_KEYS[e.code];
      if (f) s.keys.add(f);
      if (m || f) {
        // (Space is the cruiser's climb; walking, Morty's jump)
        if (m !== 'run' && !(m === 'space' && onButton)) e.preventDefault();
        if (m === 'space' && !onButton && !s.flying && !e.repeat) s.jump = true;
        audioContext();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (e.key === 'e' || e.key === 'E' || (e.key === 'Enter' && !onButton)) {
        e.preventDefault();
        fns.current.act();
      } else if (e.key === 'm' || e.key === 'M') {
        if (listRef.current) closeList();
        else setList(true);

      } else if (e.key === 'Escape' && listRef.current) closeList();
    };
    const up = (e) => {
      keyUp(s.keys, e);
      if (FLY_KEYS[e.code]) s.keys.delete(FLY_KEYS[e.code]);
    };
    const blur = () => s.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      s.keys.clear();
    };
  }, [live, closeList]);

  // ── every frame ──
  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const s = sim.current;
    const dt = Math.min(0.05, ms / 1000);
    s.t += dt;
    const k = s.keys;
    const raw = readPad();
    const before = s.padBefore;
    s.padBefore = raw ?? {};
    const pad = wardrobeRef.current ? null : raw; // (the wardrobe's open over him: the pad's for it)
    const pressed = (b) => pad?.[b] && !before[b];
    if (pressed('a')) fns.current.act();
    if (pressed('x') && s.rickall) fns.current.shoot();
    if (pressed('b') && listRef.current) closeList();
    if (pressed('y')) {
      if (listRef.current) closeList();
      else setList(true);
    }

    if (s.flying) {
      let throttle = (k.has('up') ? 1 : 0) - (k.has('down') ? 1 : 0) - s.stick.y;
      let steer = (k.has('left') ? 1 : 0) - (k.has('right') ? 1 : 0) - s.stick.x;
      let lift = (k.has('space') || k.has('rise') ? 1 : 0) - (k.has('run') || k.has('sink') ? 1 : 0) + s.lift;
      if (pad) {
        throttle += (pad.rt ? 1 : 0) - (pad.lt ? 1 : 0) - pad.ly;
        steer -= pad.lx;
        lift += (pad.rb ? 1 : 0) - (pad.lb ? 1 : 0) - pad.ry;
      }
      if (s.landing) throttle = steer = lift = 0;
      s.c = stepCruiser(s.c, { throttle: clamp1(throttle), steer: clamp1(steer), lift: clamp1(lift) }, dt);
      if (Math.abs(throttle) + Math.abs(steer) + Math.abs(lift) > 0.1) s.moved = true;
      // set down: it sinks to its hover height, quicker the higher it is; if
      // the ground under it isn't open after all (or it takes too long), it
      // stays up and the controls come back
      if (s.landing) {
        s.landT += dt;
        if (floorAt(s.c.x, s.c.z) > CRUISER.hover + 0.01 || !inArea('street', s.c.x, s.c.z) || s.landT > 6) {
          s.landing = false;
          say({ kind: 'note', bad: true, text: CANT_LAND });
          shipTalk('refuse');
        } else {
          s.c.y = Math.max(CRUISER.hover, s.c.y - Math.max(4, (s.c.y - CRUISER.hover) * 2.6) * dt);
          s.c.vy = -2;
          if (s.c.y <= CRUISER.hover + 0.01) touchDown();
        }
      }
      // the first take-off: up off the driveway, or away along the street
      if (s.flying && s.boardAt && !doneRef.current.includes('fly') && (s.c.y > CRUISER.hover + 1.5 || Math.hypot(s.c.x - s.boardAt.x, s.c.z - s.boardAt.z) > 5)) complete('fly');
      // the cruiser has something to say: up, fast, at the ceiling, the Federation behind
      if (s.flying && !s.landing) {
        if (!s.tookOff && s.c.y > CRUISER.hover + 2) {
          s.tookOff = true;
          shipTalk('takeoff');
        }
        s.fastT = Math.abs(s.c.speed) > CRUISER.top * 0.85 ? s.fastT + dt : 0;
        if (s.fastT > 1.2) shipTalk('fast');
        if (s.c.y > CRUISER.ceiling - 0.5) shipTalk('ceiling');
        if (onTail(s.fed, s.c)) shipTalk('tail');
      }
    } else {
      let fwd = (k.has('up') ? 1 : 0) - (k.has('down') ? 1 : 0) - s.stick.y;
      let side = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) + s.stick.x;
      if (pad) {
        fwd -= pad.ly;
        side += pad.lx;
        if (pad.rx) {
          s.yaw -= pad.rx * dt * 2.4;
          s.dragAt = s.t;
        }
      }
      if (s.fading) fwd = side = 0;
      const run = k.has('run') || Math.hypot(s.stick.x, s.stick.y) > 0.92 || Boolean(pad?.rb || pad?.lb);
      const mv = cameraMove(s.yaw, clamp1(fwd), clamp1(side));
      s.m = stepMorty(s.m, { x: mv.x, z: mv.z, run, jump: s.jump && !s.fading }, dt, s.area, s.area === 'street' ? { cruiser: { x: s.c.x, z: s.c.z }, motorcade: !doneRef.current.includes('president') } : s.rickall?.game ? { crowd: crowdOf(s.rickall) } : undefined);
      s.jump = false;
      if (Math.hypot(mv.x, mv.z) > 0.1) s.moved = true;
      // in Total Rickall, stood still, he turns to face the way he's aiming
      if (s.rickall?.game && s.m.speed < 0.5) {
        const d = Math.atan2(Math.cos(s.yaw), -Math.sin(s.yaw)) - s.m.face;
        s.m.face += Math.atan2(Math.sin(d), Math.cos(d)) * Math.min(1, dt * 10);
      }
      // out over the open hatch: down it
      const drop = s.fading ? null : dropAt(s.area, s.m.x, s.m.z, s.m.y);
      if (drop) go(drop);
      // up out of the Mind Blowers chair: the memories stop; sat, they go on
      if (s.mind && (s.area !== 'mindblowers' || Math.hypot(s.m.x - s.mind.x, s.m.z - s.mind.z) > CHAIR_R)) {
        s.mind = null;
        setMemory(null);
      } else if (s.mind && s.t > s.mind.next) playMemory(s.mind.i + 1);
      // the cruiser, parked: a word as he walks off, a hello as he comes back, and now and then a thought
      if (s.area === 'street') {
        const d = Math.hypot(s.m.x - s.c.x, s.m.z - s.c.z);
        if (s.leftFrom && d > 7) {
          s.leftFrom = null;
          shipTalk('leave');
        } else if (d < 4.5 && s.t - s.landedAt > 12 && s.t > 6) shipTalk('hello');
        else if (d < 14 && s.t > 30) shipTalk('idle');
      }
      // the camera drifts round behind him as he walks, unless it's just been turned
      if (s.m.speed > 0.5 && s.t - s.dragAt > 1.4) {
        const d = behindYaw(s.m.face) - s.yaw;
        s.yaw += Math.atan2(Math.sin(d), Math.cos(d)) * Math.min(1, dt * 1.6);
        s.pitch += (PITCH - s.pitch) * Math.min(1, dt * 0.8);
      }
    }

    // what he's next to: a door, then a thing to touch, then the cruiser; or, flying, somewhere to land
    let near = null;
    const motorcade = !doneRef.current.includes('president');
    s.motorcade = motorcade;
    if (s.flying) near = !s.landing && canLand(s.c, { motorcade }) ? 'land' : null;
    else if (!s.fading && !s.rickall) {
      const l = nearLink(s.area, s.m.x, s.m.z, doneRef.current);
      const h = l ? null : nearHotspot(s.area, s.m.x, s.m.z, doneRef.current);
      near = l ? `link:${l.id}` : h ? `spot:${h.id}` : s.area === 'street' && Math.hypot(s.m.x - s.c.x, s.m.z - s.c.z) < BOARD_R ? 'cruiser' : null;
    }
    s.near = near ? PROMPT[near] : null;
    s.view.link = s.near?.kind === 'link' ? s.near.id : null;
    s.view.hotspot = s.near?.kind === 'spot' ? s.near.id : null;
    // the Federation's patrol ship, round its loop or on the cruiser's tail
    s.fed = stepFedShip(s.fed, s.c, s.flying, dt);
    // the clock of a place left in a hurry, for the HUD (whole seconds, so it rarely redraws)
    const left = s.escape && s.area === s.escape.area ? Math.max(0, Math.ceil(s.escape.s - (s.t - s.escape.at))) : null;
    if (left !== clockRef.current) {
      clockRef.current = left;
      setClock(left);
    }
    if (s.escape && left === 0) s.escape = null;
    // what the cruiser was about to say when it'd only just spoken
    if (s.shipNext) {
      if (s.t > s.shipNext.until || s.area !== 'street') s.shipNext = null;
      else shipTalk(s.shipNext.event);
    }

    // others online: where you are to them (on foot, in the street or a room:
    // only those in the same one see you), and where they are
    const tv = trav.ref.current;
    tv?.pose(s.m, { inside: Boolean(s.flying), area: s.area });

    // Total Rickall: off, if he's somehow out of the house; the clock; the
    // line the camera's put on, how far back along it, and who's too close
    // to it to be seen; and who's in the sights along it
    let sightLine = null;
    if (s.rickall && (s.area !== 'house' || s.flying)) fns.current.stop();
    const run = s.rickall;
    if (run?.game) {
      const R = rkRules.current;
      if (run.phase === 'on' && R.stepRickall(run.game, dt)) fns.current.end(run);
      sightLine = R.sight(s.m, s.yaw, s.pitch);
      const v = R.view(run.game, sightLine);
      sightLine.back = v.back;
      run.hide = v.hide;
      run.aim = run.phase === 'on' ? R.aimAt(run.game, sightLine) : null;
      if (run.told && (performance.now() - run.told.at > RECALL_MS || run.game.shot.includes(run.told.id))) run.told = null;
    }

    s.emit ??= (name, e) => s.events.push([name, e]);
    try {
      a.render(
        {
          area: s.area,
          morty: s.m,
          flying: s.flying,
          cruiser: s.c,
          camYaw: s.yaw,
          camPitch: s.pitch,
          near: s.view,
          done: doneRef.current,
          fed: s.fed,
          travellers: tv ? tv.list() : null,
          sight: sightLine,
          rickall: run?.game ? { game: run.game, aim: run.aim, hide: run.hide } : null,
          fading: s.fading,
          emit: s.emit,
        },
        ms,
      );
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      a.dispose();
      api.current = null;
      setGl('failed');
      return;
    }

    // what the place's people did this frame (stage.js's NPC behaviour)
    if (s.events.length) {
      const evs = s.events.splice(0);
      for (const [name, e] of evs) fns.current.npc?.(name, e);
    }

    // its HUD, when what it shows changes, and the memory card over whoever it's about
    if (run || gameKey.current) {
      const R = rkRules.current; // (there once there's a game)
      const left = run?.game ? R.parasitesLeft(run.game) : 0;
      const secs = run?.game ? Math.max(0, Math.ceil(R.RICKALL.time - run.game.t)) : 0;
      const aim = run?.aim ? run.game.people.find((p) => p.id === run.aim) : null;
      const gkey = run ? `${run.phase}|${left}|${secs}|${aim?.id}|${run.told?.n}|${run.end?.kind}` : '';
      if (gkey !== gameKey.current) {
        gameKey.current = gkey;
        setGame(run ? { phase: run.phase, left, secs, aim: aim ? { id: aim.id, name: aim.name } : null, told: run.told, end: run.end } : null);
      }
      const el = recall.current;
      const p = run?.told && run.game.people.find((o) => o.id === run.told.id);
      const at = p ? a.project(p.x, p.h + 0.3, p.z) : null;
      if (el) {
        el.style.visibility = at ? 'visible' : 'hidden';
        if (at) {
          // (kept on screen, and below the title and the map if it'd be over them)
          const c = canvas.current.getBoundingClientRect();
          const half = el.offsetWidth / 2;
          const x = Math.max(half + 12, Math.min(c.width - half - 12, at.x));
          let top = Math.max(12, at.y - el.offsetHeight);
          for (const box of [brand.current, map.current?.parentElement]) {
            const r = box?.getBoundingClientRect();
            if (r && x - half < r.right - c.left && x + half > r.left - c.left && top < r.bottom - c.top) top = r.bottom - c.top + 10;
          }
          el.style.transform = `translate(${x.toFixed(1)}px, ${(top + el.offsetHeight).toFixed(1)}px) translate(-50%, -100%)`;
        }
      }
    }

    // the HUD, when what it shows changes
    const room = s.flying ? null : roomAt(s.area, s.m.x, s.m.z);
    const alt = s.flying ? Math.round(s.c.y) : 0;
    const kmh = s.flying ? Math.round((Math.abs(s.c.speed) * 3.6) / 2) * 2 : 0;
    const key = `${s.area}|${room}|${s.flying}|${s.landing}|${near}|${s.moved}|${alt}|${kmh}`;
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ area: s.area, room, flying: s.flying, landing: s.landing, near, moved: s.moved, alt, kmh });
    }
    if (++s.frame % 3 === 0) {
      // the place's people, for the map (stage.js's NPC layer says where they are)
      s.npcs = api.current?.act(s.area, 'npcs') ?? null;
      drawMap(map.current, s, goalOf(progRef.current.next, s), s.t);
    }
  }, live);

  // something open over the world: let go of the stick and the up and down buttons
  const stickEl = useRef(null);
  useEffect(() => {
    if (!open) return;
    const s = sim.current;
    s.stick = { x: 0, y: 0 };
    s.lift = 0;
    stickEl.current?.style.setProperty('--sx', '0px');
    stickEl.current?.style.setProperty('--sy', '0px');
  }, [open]);

  // ── the pointer: drag the view round (and in Total Rickall, up and down
  // too, and a click that doesn't drag it is a shot) ──
  const drag = useRef(null);
  const onPointer = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      audioContext();
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, x0: e.clientX, y0: e.clientY, at: performance.now() };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (e.type === 'pointermove') {
      if (e.pointerType === 'mouse' && e.buttons === 0) {
        drag.current = null;
        return;
      }
      s.yaw -= (e.clientX - d.x) * 0.0065;
      s.pitch = Math.max(-0.1, Math.min(0.95, s.pitch + (e.clientY - d.y) * (e.pointerType === 'mouse' || s.rickall ? 0.004 : 0)));
      d.x = e.clientX;
      d.y = e.clientY;
      s.dragAt = s.t;
      return;
    }
    drag.current = null;
    if (e.type === 'pointerup' && s.rickall && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < CLICK.px && performance.now() - d.at < CLICK.ms) fns.current.shoot();
  };

  // the touch stick: drag from where the thumb goes down
  const stick = useRef(null);
  const onStick = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      stick.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      audioContext();
    }
    if (!stick.current || stick.current.id !== e.pointerId) return;
    if (e.type === 'pointerup' || e.type === 'pointercancel' || e.type === 'lostpointercapture') {
      stick.current = null;
      s.stick = { x: 0, y: 0 };
      e.currentTarget.style.setProperty('--sx', '0px');
      e.currentTarget.style.setProperty('--sy', '0px');
      return;
    }
    const dx = clamp1((e.clientX - stick.current.x) / 46);
    const dy = clamp1((e.clientY - stick.current.y) / 46);
    s.stick = { x: dx, y: dy };
    e.currentTarget.style.setProperty('--sx', `${dx * 26}px`);
    e.currentTarget.style.setProperty('--sy', `${dy * 26}px`);
  };
  // up and down, held, while flying
  const onJump = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    sim.current.jump = true;
    audioContext();
  };
  const onLift = (dir) => (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      s.lift = dir;
      audioContext();
    } else s.lift = 0;
  };

  const here = hud.near ? PROMPT[hud.near] : null;
  const placeName = hud.flying ? 'Over the Smiths’ street' : (hud.room ?? AREA_NAME[hud.area]);
  return (
    <div ref={box} className="rm-world-stage" data-touch={touch || undefined} data-flying={hud.flying || undefined} data-area={hud.area}>
      <canvas
        ref={canvas}
        className="rm-world-canvas"
        data-on={gl === 'on' || undefined}
        role="img"
        aria-label="The Smiths’ street in 3D: the Smith house with Rick’s garage, Harry Herpson High across the road, Rick’s space cruiser in the driveway, and Morty on the sidewalk"
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onPointerUp={onPointer}
        onPointerCancel={onPointer}
        onLostPointerCapture={onPointer}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="rm-fade" data-on={fade || undefined} data-kind={fade ?? undefined} aria-hidden="true" />
      {opening && (
        <div className="rm-loading rm-opening" role="status">
          <span className="rm-swirl" aria-hidden="true" />
          <p>Opening a portal to {inLine(opening)}…</p>
        </div>
      )}
      {gl === 'loading' && (
        <div className="rm-loading" role="status">
          <span className="rm-swirl" aria-hidden="true" />
          <p>Opening a portal…</p>
        </div>
      )}

      <div className="rm-hud rm-hud-top">
        <div ref={brand} className="rm-brand">
          <Title />
          {game ? (
            <p className="rm-objective rm-rickall-status" aria-live="polite">
              <span className="rm-swirl rm-swirl-sm" aria-hidden="true" />
              <span>{game.phase === 'hatching' ? 'The egg’s hatching…' : game.phase === 'over' ? 'Total Rickall' : `Total Rickall: ${game.left} ${game.left === 1 ? 'parasite' : 'parasites'} left`}</span>
              {game.phase === 'on' && (
                <b className="rm-rickall-clock" aria-hidden="true">
                  {Math.floor(game.secs / 60)}:{String(game.secs % 60).padStart(2, '0')}
                </b>
              )}
            </p>
          ) : (
            <p className="rm-objective" aria-live="polite">
              <span className="rm-swirl rm-swirl-sm" aria-hidden="true" />
              <span>{prog.objective}</span>
            </p>
          )}
          {duel && (
            <div className="rm-fight" aria-live="polite">
              <div className="rm-fight-row">
                <b>{SAY[duel.who]?.who ?? 'Them'}</b>
                <span className="rm-fight-hearts" aria-label={`${duel.hp} of ${duel.max}`}>
                  {Array.from({ length: duel.max }, (_, i) => (
                    <span key={i} data-off={i >= duel.hp || undefined}>
                      ♥
                    </span>
                  ))}
                </span>
              </div>
              <div className="rm-fight-row">
                <b>Morty</b>
                <span className="rm-fight-hearts" aria-label={`${duel.mortyHp} of ${duel.mortyMax}`}>
                  {Array.from({ length: duel.mortyMax }, (_, i) => (
                    <span key={i} data-off={i >= duel.mortyHp || undefined}>
                      ♥
                    </span>
                  ))}
                </span>
              </div>
              <span className="rm-fight-hint">F fires. Keep out of reach.</span>
            </div>
          )}
          {clock != null && (
            <div className="rm-clock" data-late={clock <= 10 || undefined} aria-live="polite">
              Back through the portal: {clock} s
            </div>
          )}
          {hud.flying && (
            <p className="rm-flightstats" aria-live="off">
              <span>
                Height <b>{hud.alt}</b> m
              </span>
              <span>
                Speed <b>{hud.kmh}</b> km/h
              </span>
            </p>
          )}
        </div>
        <div className="rm-side">
          <figure className="rm-map">
            <canvas ref={map} width={MAP_W * MAP_PX} height={MAP_H * MAP_PX} aria-hidden="true" />
            <figcaption>{placeName}</figcaption>
          </figure>
          {game && (
            <button type="button" className="rm-chip rm-chip-stop" onClick={stopRickall} aria-label="Stop the game">
              <RiCloseLine aria-hidden="true" />
              <span>Stop the game</span>
              {!touch && <kbd>Esc</kbd>}
            </button>
          )}
          <button ref={chip} type="button" className="rm-chip" onClick={() => setList((v) => !v)} aria-expanded={list} aria-controls="rm-list" aria-label={`Things to do, ${prog.count} of ${prog.total} done`}>
            <RiListCheck2 aria-hidden="true" />
            <span>Things to do</span>
            <b>
              {prog.count}/{prog.total}
            </b>
            {!touch && <kbd>M</kbd>}
          </button>
          <button type="button" className="rm-chip" onClick={() => setWardrobe(true)} aria-haspopup="dialog" aria-label="Wardrobe: how Morty and Rick look">
            <RiShirtLine aria-hidden="true" />
            <span>Wardrobe</span>
            {!touch && <kbd>C</kbd>}
          </button>
          <OtherMortys trav={trav} />
        </div>
      </div>
      <Wardrobe open={wardrobe} onClose={closeWardrobe} looks={looks} onLook={setLook} who="morty" />
      <DimensionDial open={dialing} items={DIAL} value={dialRef.current} onPick={pickDial} onClose={closeDial} />
      <DimensionDial open={!!trial} items={trialItems} value={null} onPick={pickTrial} onClose={closeTrial} title={`Rick’s rooms · ${(trial?.room ?? 0) + 1} of ${ROOMS.length}`} lead={trial ? ROOMS[trial.room].prompt : null} foot="↑ ↓ to choose, Enter to pick, Esc to back out" label="Rick’s rooms" />

      <Toast toast={toast} />
      {shipLine && hud.area === 'street' && (
        <p className="rm-shipline" role="status" key={shipLine.at}>
          <span className="rm-shipline-eyes" aria-hidden="true">
            <i />
            <i />
          </span>
          <span>
            <b>The ship</b> {shipLine.text}
          </span>
        </p>
      )}
      {memory && hud.area === 'mindblowers' && (
        <div className="rm-memory" role="status" key={memory.at} style={{ '--vial': MEMORY_COLORS[memory.color] }}>
          <p className="rm-memory-head">
            <span className="rm-memory-vial" aria-hidden="true" />
            Memory {memory.i + 1} of {MEMORIES.length}
          </p>
          <p className="rm-memory-text">{memory.caption}</p>
          <p className="rm-memory-hint">{touch ? 'Tap for the next one; walk away to stop.' : 'E for the next one; walk away to stop.'}</p>
        </div>
      )}

      {gl === 'on' && here && (
        <div className="rm-prompt" data-kind={here.kind}>
          <p className="rm-prompt-name">{here.name}</p>
          {!touch && (
            <button type="button" className="rm-btn" onClick={act}>
              {here.verb} <kbd>E</kbd>
            </button>
          )}
        </div>
      )}

      {/* Total Rickall: the crosshair, whoever's in it, what's remembered of them, how it ended */}
      {gl === 'on' && game?.phase === 'on' && <div className="rm-crosshair" data-on={game.aim ? true : undefined} aria-hidden="true" />}
      {gl === 'on' && game?.told && (
        <div ref={recall} className="rm-recall" role="status" key={game.told.n}>
          <p className="rm-recall-head">
            What you remember of <b>{game.told.name}</b>
          </p>
          <p className="rm-recall-text">{game.told.text}</p>
        </div>
      )}
      {gl === 'on' && game?.phase === 'on' && game.aim && (
        <div className="rm-prompt" data-kind="aim">
          <p className="rm-prompt-name">{game.aim.name}</p>
          {!touch && (
            <div className="rm-prompt-acts">
              <button type="button" className="rm-btn rm-btn-ghost" onClick={tellRickall}>
                Remember <kbd>E</kbd>
              </button>
              <button type="button" className="rm-btn rm-btn-shoot" onClick={shootRickall}>
                Shoot <kbd>F</kbd>
              </button>
            </div>
          )}
        </div>
      )}
      {gl === 'on' && game?.phase === 'on' && !game.aim && (
        <p className="rm-hint">
          {touch
            ? 'Turn till someone’s in the crosshair, then Remember, or Shoot. A parasite only ever leaves good memories.'
            : 'Turn till someone’s in the crosshair: E for what you remember of them, F or a click to shoot. A parasite only ever leaves good memories.'}
        </p>
      )}
      {gl === 'on' && game?.end && <Ending end={game.end} onAgain={() => startRickall()} onLeave={stopRickall} />}

      {gl === 'on' && !here && !game && !hud.flying && !hud.moved && (
        <p className="rm-hint">{touch ? 'Drag the stick to walk; push it all the way to run; the arrow jumps, the star fires in a fight. Swipe sideways to look round.' : 'W A S D or the arrows to walk, Shift to run, Space to jump. Drag to look round. E uses things, F fires in a fight, M lists what to do.'}<GuideCue touch={touch} /></p>
      )}
      {gl === 'on' && hud.flying && !here && (
        <p className="rm-hint rm-keys">
          {touch ? (
            'The stick flies; hold the arrows to climb and drop. Slow down over open ground to land.'
          ) : hud.landing ? (
            'Setting down…'
          ) : (
            <>
              <span>
                <kbd>W</kbd>
                <kbd>S</kbd> speed
              </span>
              <span>
                <kbd>A</kbd>
                <kbd>D</kbd> steer
              </span>
              <span>
                <kbd>Space</kbd> up
              </span>
              <span>
                <kbd>Shift</kbd> down
              </span>
              <span>Slow down over open ground, then E to land</span>
            </>
          )}
        </p>
      )}

      <div className="rm-hud rm-hud-bottom">
        {touch ? (
          <>
            <div ref={stickEl} className="rm-stick" onPointerDown={onStick} onPointerMove={onStick} onPointerUp={onStick} onPointerCancel={onStick} onLostPointerCapture={onStick} aria-hidden="true">
              <span />
            </div>
            <div className="rm-pad">
              {!hud.flying && (
                <div className="rm-lift">
                  <button type="button" aria-label="Jump" onPointerDown={onJump} onContextMenu={(e) => e.preventDefault()}>
                    <RiArrowUpLine aria-hidden="true" />
                  </button>
                  {duel && (
                    <button
                      type="button"
                      className="rm-fire"
                      aria-label="Fire"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        fns.current.fire();
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      ✦
                    </button>
                  )}
                </div>
              )}
              {hud.flying && (
                <div className="rm-lift">
                  <button type="button" aria-label="Climb" onPointerDown={onLift(1)} onPointerUp={onLift(0)} onPointerCancel={onLift(0)} onLostPointerCapture={onLift(0)} onContextMenu={(e) => e.preventDefault()}>
                    <RiArrowUpLine aria-hidden="true" />
                  </button>
                  <button type="button" aria-label="Drop" onPointerDown={onLift(-1)} onPointerUp={onLift(0)} onPointerCancel={onLift(0)} onLostPointerCapture={onLift(0)} onContextMenu={(e) => e.preventDefault()}>
                    <RiArrowDownLine aria-hidden="true" />
                  </button>
                </div>
              )}
              {game ? (
                <>
                  <button type="button" className="rm-act rm-act-alt" data-idle={!game.aim || undefined} onClick={tellRickall}>
                    Remember
                  </button>
                  <button type="button" className="rm-act rm-act-shoot" data-idle={!game.aim || undefined} onClick={shootRickall}>
                    Shoot
                  </button>
                </>
              ) : (
                <button type="button" className="rm-act" data-idle={!here || undefined} onClick={act}>
                  {here ? here.verb : hud.flying ? 'Land' : 'Use'}
                </button>
              )}
            </div>
          </>
        ) : (
          <RouterLink to="/" className="rm-back">
            <RiArrowLeftLine aria-hidden="true" /> Back to the site
          </RouterLink>
        )}
      </div>

      {list && <ThingsToDo box={listBox} prog={prog} done={done} onClose={closeList} />}
    </div>
  );
}

// The list (M): every thing to do, ticked when it's done, with where to go
// for the rest; and the switch for the cruiser's voice.
function ThingsToDo({ box, prog, done, onClose }) {
  const [voice, setVoice] = useState(shipVoiceOn);
  return (
    <div ref={box} className="rm-list" id="rm-list" role="region" aria-label="Things to do in Dimension C-137">
      <div className="rm-list-head">
        <p>
          Things to do <b>{prog.count}</b>/{prog.total}
        </p>
        <button type="button" className="rm-icon-btn" onClick={onClose} aria-label="Close the list">
          <RiCloseLine aria-hidden="true" />
        </button>
      </div>
      <ol>
        {TASKS.map((t) => {
          const ticked = done.includes(t.id);
          return (
            <li key={t.id} data-done={ticked || undefined} data-next={prog.next?.id === t.id || undefined}>
              <span className="rm-tick" aria-hidden="true">
                {ticked && <RiCheckLine />}
              </span>
              <div>
                <p className="rm-list-name">
                  {t.name}
                  {ticked && <span className="sr-only"> (done)</span>}
                </p>
                {!ticked && <p className="rm-list-sub">{t.hint}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      <label className="rm-list-switch">
        <input
          type="checkbox"
          checked={voice}
          onChange={(e) => {
            setShipVoice(e.target.checked);
            setVoice(e.target.checked);
            if (!e.target.checked) stopSpeaking();
          }}
        />
        <span>The ship’s voice</span>
      </label>
      <RouterLink to="/" className="rm-list-back">
        <RiArrowLeftLine aria-hidden="true" /> Back to the site
      </RouterLink>
    </div>
  );
}

// How Total Rickall ended, on a card over the room: again, or leave it there
// (the focus on again, so Enter plays again)
function Ending({ end, onAgain, onLeave }) {
  const again = useRef(null);
  useEffect(() => {
    again.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="rm-ending" data-kind={end.kind} role="dialog" aria-labelledby="rm-ending-title" aria-describedby="rm-ending-line">
      <p className="rm-ending-where">Total Rickall</p>
      <h3 id="rm-ending-title" className="rm-ending-title">
        {end.title}
      </h3>
      <p id="rm-ending-line" className="rm-ending-line">
        {end.line}
      </p>
      <div className="rm-ending-acts">
        <button ref={again} type="button" className="rm-btn" onClick={onAgain}>
          Play again
        </button>
        <button type="button" className="rm-btn rm-btn-ghost" onClick={onLeave}>
          Leave it there
        </button>
      </div>
    </div>
  );
}

// ── the map in the corner ──
// The street from above (the road, the houses, the school, the trees, the
// cruiser), a room as its plan (the rooms, the walls, the furniture), or the
// alien street; the doors as rings, the next thing to do as a gold one, and Morty.
const MAP_W = 184;
const MAP_H = 124;
const MAP_PX = 2; // canvas pixels to a CSS pixel
const INK = '#1b1424';
const css = (n) => `#${n.toString(16).padStart(6, '0')}`;
const FLOORS = { garage: 0xa9b3a4, school: 0xa9c6e0, arcade: 0x3d2a5c };
function drawMap(c, s, goal, t) {
  const g = c?.getContext('2d');
  if (!g) return;
  const W = c.width;
  const H = c.height;
  const u = MAP_PX;
  const A = AREAS[s.area];
  const pad = 8 * u;
  const k = Math.min((W - pad * 2) / (A.x1 - A.x0), (H - pad * 2) / (A.z1 - A.z0));
  const ox = W / 2 - ((A.x0 + A.x1) / 2) * k;
  const oz = H / 2 - ((A.z0 + A.z1) / 2) * k;
  const X = (x) => ox + x * k;
  const Z = (z) => oz + z * k;
  const rect = (x0, x1, z0, z1) => g.fillRect(X(x0), Z(z0), (x1 - x0) * k, (z1 - z0) * k);
  const edge = (x0, x1, z0, z1) => g.strokeRect(X(x0), Z(z0), (x1 - x0) * k, (z1 - z0) * k);
  const foot = (b, fill) => {
    g.fillStyle = fill;
    rect(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2);
    edge(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2);
  };
  const disc = (x, z, r, fill, stroke) => {
    g.beginPath();
    g.arc(X(x), Z(z), r, 0, Math.PI * 2);
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (stroke) {
      g.strokeStyle = stroke;
      g.stroke();
    }
  };
  g.setLineDash([]);
  g.lineJoin = 'round';

  if (s.area === 'street') {
    g.fillStyle = '#7cc25a';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#6bb04b';
    for (const y of YARDS) rect(y.x0, y.x1, y.z0, y.z1);
    g.fillStyle = '#d8d1c1';
    rect(A.x0 - 20, A.x1 + 20, ROAD.z - ROAD.w / 2 - ROAD.sidewalk, ROAD.z + ROAD.w / 2 + ROAD.sidewalk);
    g.fillStyle = '#4b5060';
    rect(A.x0 - 20, A.x1 + 20, ROAD.z - ROAD.w / 2, ROAD.z + ROAD.w / 2);
    g.strokeStyle = '#f2d34b';
    g.lineWidth = 1 * u;
    g.setLineDash([3 * u, 3 * u]);
    g.beginPath();
    g.moveTo(0, Z(ROAD.z));
    g.lineTo(W, Z(ROAD.z));
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#c8c0b0';
    rect(DRIVEWAY.x0, DRIVEWAY.x1, DRIVEWAY.z0, DRIVEWAY.z1);
    g.fillStyle = '#b4533e';
    rect(FRONT_WALK.x0, FRONT_WALK.x1, FRONT_WALK.z0, FRONT_WALK.z1);
    for (const tr of TREES) disc(tr.x, tr.z, Math.max(1.8 * u, 1.7 * tr.s * k), '#3f8a35');
    g.strokeStyle = INK;
    g.lineWidth = 1 * u;
    // Shoney's, yellow, and its lot; the limo at the kerb while the President's there
    g.fillStyle = '#7d8088';
    rect(DINER.x - DINER.w / 2 - 1.5, DINER.x + DINER.w / 2 + 1.5, DINER.z + DINER.d / 2, -ROAD.w / 2 - ROAD.sidewalk);
    for (const n of NEIGHBOURS) foot(n, n === DINER ? '#f0dc86' : css(n.tint));
    if (s.motorcade) foot({ x: LIMO.x, z: LIMO.z, w: LIMO.d, d: LIMO.w }, '#16171b');
    for (const p of SCHOOL_PARTS) foot(p, '#c0603f');
    foot(GARAGE, '#f4e3b5');
    for (const p of HOUSE_PARTS) foot(p, '#f4e3b5');
  } else if (s.area === 'annex') {
    g.fillStyle = '#3a2560';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#5e4290';
    rect(A.x0, A.x1, A.z0, A.z1);
    g.strokeStyle = INK;
    g.lineWidth = 1 * u;
    foot(ARCADE, '#ff7ac8');
  } else {
    g.fillStyle = '#211a2b';
    g.fillRect(0, 0, W, H);
    const rooms = PLAN.filter((r) => r.area === s.area);
    const ring = RINGS[s.area];
    g.strokeStyle = 'rgba(27, 20, 36, 0.55)';
    g.lineWidth = 0.75 * u;
    if (ring) {
      // a round room: its ellipse
      g.fillStyle = css(rooms[0]?.floor ?? 0xc4a77a);
      g.beginPath();
      g.ellipse(X(ring.x), Z(ring.z), ring.a * k, ring.b * k, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else if (rooms.length)
      for (const r of rooms) {
        g.fillStyle = css(r.floor);
        rect(r.x0, r.x1, r.z0, r.z1);
        edge(r.x0, r.x1, r.z0, r.z1);
      }
    else {
      g.fillStyle = css(FLOORS[s.area] ?? 0xc4a77a);
      rect(A.x0, A.x1, A.z0, A.z1);
    }
    g.fillStyle = 'rgba(27, 20, 36, 0.42)';
    for (const f of FURNITURE) {
      if (f.area !== s.area) continue;
      const side = Math.abs(Math.sin(f.turn)) > 0.5;
      const w = side ? f.d : f.w;
      const d = side ? f.w : f.d;
      rect(f.x - w / 2, f.x + w / 2, f.z - d / 2, f.z + d / 2);
    }
    g.strokeStyle = INK;
    g.lineWidth = 1.6 * u;
    g.lineCap = 'round';
    for (const [x0, z0, x1, z1] of INNER_WALLS[s.area] ?? []) {
      g.beginPath();
      g.moveTo(X(x0), Z(z0));
      g.lineTo(X(x1), Z(z1));
      g.stroke();
    }
    for (const h of HOTSPOTS) if (h.area === s.area) disc(h.x, h.z, 2.1 * u, '#c9ff5a');
    // the hatch in the garage floor
    if (s.area === 'garage') {
      g.fillStyle = '#3a4046';
      g.strokeStyle = '#f2c23c';
      g.lineWidth = 1 * u;
      rect(HATCH.x - HATCH.w / 2, HATCH.x + HATCH.w / 2, HATCH.z - HATCH.d / 2, HATCH.z + HATCH.d / 2);
      edge(HATCH.x - HATCH.w / 2, HATCH.x + HATCH.w / 2, HATCH.z - HATCH.d / 2, HATCH.z + HATCH.d / 2);
    }
  }

  // the doors and portals
  g.lineWidth = 1.4 * u;
  for (const l of LINKS) if (l.area === s.area) disc(l.x, l.z, 3 * u, null, l.kind === 'portal' ? '#9dff5a' : '#ffffff');
  // the next thing to do, pulsing
  // the place's people: a dot each, red and pulsing for one who's after Morty, grey for one who's down
  if (Array.isArray(s.npcs))
    for (const n of s.npcs) {
      if (!n.visible) continue;
      if (n.hunting) disc(n.x, n.z, (2.6 + Math.sin(t * 8) * 0.8) * u, '#ff3a3a', '#ffffff');
      else disc(n.x, n.z, 1.8 * u, n.dead ? '#6a6a6a' : '#ffffff', null);
    }
  if (goal) {
    g.lineWidth = 2 * u;
    disc(goal.x, goal.z, (6 + Math.sin(t * 4.5) * 1.6) * u, null, '#ffd23a');
  }
  // the cruiser, parked; or flying, as the arrow
  const arrow = (x, z, turn, fill) => {
    g.save();
    g.translate(X(x), Z(z));
    g.rotate(turn);
    g.fillStyle = fill;
    g.strokeStyle = INK;
    g.lineWidth = 1.5 * u;
    g.beginPath();
    g.moveTo(0, -6.5 * u);
    g.lineTo(4.8 * u, 5 * u);
    g.lineTo(0, 2.4 * u);
    g.lineTo(-4.8 * u, 5 * u);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  };
  if (s.area === 'street') {
    if (s.flying) arrow(s.c.x, s.c.z, Math.PI - s.c.yaw, '#9dff5a');
    else {
      g.lineWidth = 1.2 * u;
      disc(s.c.x, s.c.z, Math.max(3.6 * u, CRUISER.radius * k), '#c4cad2', INK);
    }
  }
  if (!s.flying) arrow(s.m.x, s.m.z, Math.PI / 2 - s.m.face, '#f3d84b');
}

// ── without 3D: the places as cards ──
const CARDS = [
  { id: 'house', name: 'The Smith house', blurb: 'Jerry’s on the couch with the TV on, and Rick left something at the breakfast table.', items: ['cable', 'butter'] },
  { id: 'garage', name: 'Rick’s garage', blurb: 'One car wide: the workbench, the worktable, the plumbus machine, a Portal panic cabinet, a portal on the wall, and a hatch in the floor down to Rick’s secret lab.', items: ['meeseeks', 'plumbus', 'portalpanic'] },
  { id: 'school', name: 'Harry Herpson High', blurb: 'Mr. Goldenfold has a pop quiz on the board. Seven right is a pass.', items: ['quiz'] },
  { id: 'arcade', name: 'Blips and Chitz', blurb: 'The arcade on the far side of the portal, and the game everyone queues for.', items: ['roy'] },
];
const CARD_LABEL = { cable: 'Watch interdimensional cable', butter: 'Switch on the butter robot', meeseeks: 'Press the Meeseeks box', plumbus: 'Watch a plumbus get made', portalpanic: 'Play Portal panic', quiz: 'Sit the pop quiz', roy: 'Play Roy: A Life Well Lived' };
const CARD_TASK = { cable: ['cable'], butter: ['butter'], meeseeks: ['meeseeks'], plumbus: ['plumbus'], portalpanic: ['portalpanic'], quiz: ['quiz'], roy: ['roy', 'roy55'] };

function Cards({ done, openPlace, three, gl, toast, retry }) {
  const prog = progress(done);
  return (
    <div className="shell rm-cards-wrap">
      <div className="rm-cards-head">
        <div>
          <Title />
          <p className="lead mt-4 max-w-[60ch]">Rick and Morty’s neighbourhood: the Smith house, Rick’s garage lab, Harry Herpson High, and through the portal, Blips and Chitz.</p>
        </div>
        <p className="rm-cards-count">
          <b>{prog.count}</b> of {prog.total} things done
        </p>
      </div>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost'
            ? 'The graphics chip reset, so here’s the neighbourhood as cards.'
            : gl === 'failed'
              ? 'The 3D neighbourhood couldn’t start here, so here it is as cards.'
              : three.held
                ? `The 3D neighbourhood isn’t loaded yet${three.hold?.mb ? ` (about ${three.hold.mb} MB)` : ''}, so here it is as cards.`
                : '3D is switched off, so here’s the neighbourhood as cards.'}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (!three.on) three.set('auto');
              retry();
            }}
          >
            {three.on ? 'Try 3D again' : three.held ? 'Load the 3D' : 'Turn 3D on'}
          </button>
        </p>
      )}
      <div className="rm-cards-toast">
        <Toast toast={toast} />
      </div>
      <ul className="rm-cards">
        {CARDS.map((p) => (
          <li key={p.id} data-place={p.id}>
            <h3 className="rm-card-name">{p.name}</h3>
            <p className="rm-card-blurb">{p.blurb}</p>
            <div className="rm-card-acts">
              {p.items.map((id) => {
                const ticked = CARD_TASK[id].every((t) => done.includes(t));
                return (
                  <button key={id} type="button" className="rm-card-btn" data-done={ticked || undefined} onClick={() => openPlace(id)}>
                    <span className="rm-tick" aria-hidden="true">
                      {ticked && <RiCheckLine />}
                    </span>
                    {CARD_LABEL[id]}
                    {ticked && <span className="sr-only"> (done)</span>}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Roy, if its code won't load (offline, or a deploy since the page opened)
function RoyDown({ onLeave }) {
  return (
    <div className="rm-place-down" role="alert">
      <p>Roy’s headset didn’t load. Check the connection, then reload the page to try again.</p>
      <button type="button" className="rm-btn" onClick={() => onLeave?.(null, null)}>
        Back to the arcade
      </button>
    </div>
  );
}

// ── what opens over the page ──
// Its component, and the way back to the room (Esc, the button, or B on a
// controller). Roy fills the screen and has its own way out.
function Place({ id, onClose, onQuiz, onRoy, onSewer }) {
  const p = PLACES[id];
  const back = useRef(null);
  const shell = useRef(null);
  // where the focus was before this opened (read while rendering, before the toy takes it)
  const before = useRef(typeof document === 'undefined' ? null : document.activeElement);
  useEffect(() => {
    const from = before.current;
    if (!shell.current?.contains(document.activeElement)) (back.current ?? shell.current)?.focus({ preventScroll: true });
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = 'hidden';
    // (a game that marks itself [data-owns-escape] takes Esc for itself: Roy
    // and Portal panic pause what's being played, and Esc on the pause card,
    // or its own way out, leaves; Roy also leaves on Esc from its intro or
    // end card, or while it's loading)
    const esc = (e) => e.key === 'Escape' && !e.defaultPrevented && !shell.current?.querySelector('[data-owns-escape]') && onClose();
    window.addEventListener('keydown', esc);
    // B on a controller, for the ones that aren't games with their own buttons
    let raf = 0;
    let held = true;
    const poll = () => {
      const b = Boolean(readPad()?.b);
      if (b && !held) onClose();
      held = b;
      raf = requestAnimationFrame(poll);
    };
    if (!p.full && id !== 'portalpanic') raf = requestAnimationFrame(poll);
    return () => {
      html.style.overflow = was;
      window.removeEventListener('keydown', esc);
      cancelAnimationFrame(raf);
      if (from instanceof HTMLElement) from.focus({ preventScroll: true });
    };
  }, [id, p.full, onClose]);
  const body = {
    cable: <Cable />,
    butter: <ButterRobot />,
    meeseeks: <MeeseeksBox />,
    plumbus: <PlumbusFactory />,
    portalpanic: <PortalPanic />,
    quiz: <Quiz onDone={onQuiz} />,
    // (behind the site's 3D gate, as Portal panic is, with a way back from its cards)
    roy: (
      <GpuGate
        className="rm-roy-gate"
        extra={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRoy(null, null)}>
            Back to the arcade
          </button>
        }
      >
        {() => <Roy onLeave={onRoy} />}
      </GpuGate>
    ),
    sewer: (
      <GpuGate
        className="rm-roy-gate"
        extra={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSewer(false)}>
            Back up the hole
          </button>
        }
      >
        {() => <Sewer onLeave={onSewer} />}
      </GpuGate>
    ),
  }[id];
  return createPortal(
    <div ref={shell} className="rm-place" data-full={p.full || undefined} data-place={id} role="dialog" aria-modal="true" aria-label={p.full ? p.title : undefined} aria-labelledby={p.full ? undefined : 'rm-place-title'} tabIndex={-1}>
      {!p.full && (
        <header className="rm-place-head">
          <div>
            <p className="rm-place-where">{p.where}</p>
            <h2 id="rm-place-title" className="rm-place-title">
              {p.title}
            </h2>
          </div>
          <button ref={back} type="button" className="rm-btn rm-btn-ghost" onClick={onClose}>
            Back to the room <kbd>Esc</kbd>
          </button>
        </header>
      )}
      <div className="rm-place-body">
        <Suspense fallback={<p className="rm-place-wait">{p.full ? 'Putting the headset on…' : 'Opening it up…'}</p>}>{p.full ? body : <div className="shell py-6 md:py-10">{body}</div>}</Suspense>
      </div>
    </div>,
    document.body,
  );
}

// Others online in the street: how many, or a way to see them (going online
// is the site's own switch, with your callsign, as on the universe map).
function OtherMortys({ trav }) {
  if (!trav.available) return null;
  if (!trav.on)
    return (
      <button type="button" className="rm-chip" onClick={trav.join} title="Go online, and see everyone else in the street as a Morty from another dimension">
        <span>See other Mortys</span>
      </button>
    );
  return (
    <span className="rm-chip" title="Everyone else online in the street shows as a Morty from another dimension: they can’t touch your things to do, nor you theirs">
      <b>{trav.count}</b>
      <span>{trav.count === 1 ? 'other Morty' : 'other Mortys'} here</span>
    </span>
  );
}
