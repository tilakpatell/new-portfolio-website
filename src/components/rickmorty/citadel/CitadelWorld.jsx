import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../../Achievements';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../lib/hooks';
import { readPad, typing } from '../../games/pad';
import { Bubble, Convo, QuestList, Stick } from '../../middleearth/towns/TownHud';
import { keyDown, keyUp, moveOf } from '../../middleearth/towns/keys';
import { drawMap } from '../../middleearth/towns/map';
import { nearest } from '../../middleearth/towns/story';
import { newTalk, talkNode, talkOn } from '../../middleearth/towns/talk';
import { behindYaw, cameraMove, makeWalker, newWalker } from '../../middleearth/towns/walker';
import { newWatchers, stepWatchers } from '../../middleearth/towns/watchers';
import { HERD, calmHerd, newHerd, stepHerd } from './daycare';
import { BOOTH, CAST, COLLIDERS, COUNCIL_DOOR, CORE, ESCAPE_START, FACTORY_DOOR, HANGAR_WALLS, KIOSKS, PEN, PLANTERS, RICK, ROUNDS, SPOTS, WALLS, WORLD, castFor, crowdColliders, spot, validAt } from './layout';
import { CONVOS, COPS, QUESTS, SEAL, SPEAKERS, citadelProgress } from './story';
import { LINE, dropLayer, newLine, stepLine } from './wafers';
import '../../middleearth/shire/shire.css';
import '../../middleearth/towns/bree/bree.css';
import './citadel.css';

// The Citadel of Ricks, the world: walk in through the portal as Rick
// C-137 and play the five scenes there (Morty Day Care, Simple Rick's,
// the Council, Vote Morty, and getting to the cruiser). The concourse is
// in ./layout.js, the story in ./story.js, the drawing in ./scene.js;
// this is the walking, the HUD, the talk, the herd, the line and the Cop
// Ricks. Without 3D, the scenes are listed as cards.

const DONE = 'tp-citadel-done';
const AT = 'tp-citadel-at';
const sounds = () => import('./sounds');
const clip = (id) => import('../../../lib/clips').then((c) => c.playClip(id)).catch(() => null);
const PROMPT = {
  daycare: { name: 'Morty Day Care', act: 'Round them up' },
  factory: { name: 'Simple Rick’s', act: 'Go in' },
  council: { name: 'The Council of Ricks', act: 'Go in' },
  ballot: { name: 'Candidate Morty’s booth', act: 'Cast your ballot' },
  hangar: { name: 'Hangar 7', act: 'Get in the cruiser' },
  leave: { name: 'Hangar 7', act: 'Back to C-137' },
  portal: { name: 'The portal terminal', act: 'Portal home' },
};
const CONTEMPT = new Set(['grovel', 'alibi', 'lost']);
// a walker for each mood: the crowds that are out are in the way too
const walkers = Object.fromEntries(['day', 'election', 'red'].map((m) => [m, makeWalker({ radius: WORLD.radius, colliders: [...COLLIDERS, ...crowdColliders(m)], walls: WALLS, body: RICK })]));
const walkerFor = (mood) => walkers[mood] ?? walkers.day;
const pushCop = (x, z) => walkers.red.push(x, z, 0.45);
const MAP_SCALE = 150 / (WORLD.radius * 2 + 6);
const VOTERS = CAST.filter((c) => c.vote);

export default function CitadelWorld({ onLeave }) {
  const three = use3D();
  const [done, setDone] = useState(() => {
    const d = local.get(DONE, []);
    return citadelProgress(Array.isArray(d) ? d : []).done;
  });
  const prog = citadelProgress(done);
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const { unlock } = useAchievements();
  const complete = useCallback(
    (id) => {
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = citadelProgress([...d, id]).done;
        local.set(DONE, next);
        return next;
      });
      if (SEAL[id]) unlock(SEAL[id]);
    },
    [unlock],
  );
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="shire-world citadel-world" aria-labelledby="citadel-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World prog={prog} done={done} complete={complete} gl={gl} setGl={setGl} onLeave={onLeave} /> : <Cards prog={prog} three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

function World({ prog, done, complete, gl, setGl, onLeave }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  const canvas = useRef(null);
  const map = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const saved = local.get(AT, null);
    const h = newWalker(validAt(saved, done));
    sim.current = { h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: 0.32, dragAt: -1e9, mode: 'walk', room: null, beat: null, talking: null, talk: null, herd: calmHerd(), line: newLine(), laid: null, watchers: newWatchers(ROUNDS), chased: false, near: null, person: null, canvassed: new Set(), escapeT: null, frame: 0, moved: false, t: 0, air: null, siren: null, padBefore: null, edgeAt: -9, fresh: !saved && done.length === 0, seed: 2 };
  }
  const progRef = useRef(prog);
  progRef.current = prog;
  const doneRef = useRef(done);
  doneRef.current = done;
  const [hud, setHud] = useState({ mode: 'walk', near: null, moved: false });
  const hudKey = useRef('');
  const [toast, setToast] = useState(null);
  const [bubble, setBubble] = useState(null);
  const [list, setList] = useState(false);
  const lines = useRef({});
  const bubbleRef = useRef(null);
  const say = useCallback((text, bad = false) => setToast({ text, bad, at: Date.now() }), []);
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
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4600);
    return () => clearTimeout(t);
  }, [toast]);

  // the world: made once
  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./scene')
      .then(({ createCitadelWorld }) => {
        if (dead || !canvas.current) return null;
        return createCitadelWorld(canvas.current, { onLost: () => !dead && setGl('lost') });
      })
      .then((a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        if (import.meta.env.DEV) window.__CITADEL__ = { api: a, sim: sim.current, complete }; // for the QA scripts
        fit();
        setGl('on');
        // a first visit: through the portal
        if (sim.current.fresh) {
          sim.current.fresh = false;
          a.fx('portal');
          sounds().then((x) => x.portal());
          clip('portalGun');
        }
      })
      .catch((e) => {
        if (import.meta.env.DEV) console.error(e);
        if (!dead) setGl('failed');
      });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (canvas.current) ro?.observe(canvas.current);
    const s = sim.current;
    return () => {
      dead = true;
      ro?.disconnect();
      // out of a room (or the hangar) on to the concourse
      const at = s.mode === 'inside' ? (s.room === 'factory' ? FACTORY_DOOR : COUNCIL_DOOR) : s.h;
      local.set(AT, { x: at.x, z: at.z, face: at.face });
      s.air?.stop();
      s.siren?.stop();
      api.current?.dispose();
      api.current = null;
    };
  }, [setGl, complete]);

  const live = gl === 'on' && inView;

  // the concourse's hum, while it's on screen
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    let stop = false;
    sounds().then((x) => {
      if (stop || !s) return;
      s.air = x.hum();
      s.air.inside(s.mode === 'inside' ? 1 : 0);
    });
    return () => {
      stop = true;
      s.air?.stop();
      s.air = null;
    };
  }, [live]);
  // and the siren on red alert
  const red = prog.mood === 'red';
  useEffect(() => {
    if (!live || !red) return undefined;
    const s = sim.current;
    let stop = false;
    sounds().then((x) => {
      if (stop) return;
      s.siren = x.alarm();
    });
    return () => {
      stop = true;
      s.siren?.stop();
      s.siren = null;
    };
  }, [live, red]);

  // ── into and out of things ──
  const outside = useCallback((at) => {
    const s = sim.current;
    s.mode = 'walk';
    s.room = null;
    s.beat = null;
    s.talking = null;
    s.talk = null;
    s.h = newWalker(at);
    s.yaw = behindYaw(s.h.face);
    s.dragAt = s.t;
    s.air?.inside(0);
  }, []);

  const toRed = useCallback(() => {
    const s = sim.current;
    s.mode = 'walk';
    s.talking = null;
    s.talk = null;
    s.h = newWalker(ESCAPE_START);
    s.yaw = behindYaw(s.h.face);
    s.watchers = newWatchers(ROUNDS);
  }, []);

  const enter = useCallback(
    (id) => {
      const s = sim.current;
      const p = progRef.current;
      const has = (q) => doneRef.current.includes(q);
      audioContext();
      setList(false);
      if (id === 'portal' || id === 'leave') {
        sounds().then((x) => x.portal());
        clip('portalGun');
        return onLeave?.();
      }
      if (id === 'daycare') {
        s.herd = newHerd(s.seed++);
        api.current?.fx('scatter');
        sounds().then((x) => x.blip());
        say('The gate’s been left open, and six Mortys are loose. Walk at them and they run from you: herd them back through the gate.');
      } else if (id === 'factory') {
        s.mode = 'inside';
        s.room = 'factory';
        s.beat = has('wafers') ? 'floor' : 'line';
        s.line = newLine();
        s.air?.inside(1);
        sounds().then((x) => x.doors());
        if (!has('wafers')) say('“You’re on the line, new guy.” Drop each layer on the one below. Whatever hangs over gets cut off.');
      } else if (id === 'council') {
        s.mode = 'inside';
        s.room = 'council';
        s.beat = 'hearing';
        s.talking = 'council';
        s.talk = newTalk(CONVOS.council);
        s.air?.inside(1);
        sounds().then((x) => x.gavel());
      } else if (id === 'ballot') {
        if (s.canvassed.size < VOTERS.length) return say(`Hear out the voters first: ${s.canvassed.size} of ${VOTERS.length}. They’re about the concourse.`);
        s.mode = 'talk';
        s.talking = 'ballot';
        s.talk = newTalk(CONVOS.ballot);
        // facing the booth, the camera over his shoulder
        s.h = { ...s.h, face: Math.atan2(-(BOOTH.z - s.h.z), BOOTH.x - s.h.x) };
        s.yaw = behindYaw(s.h.face);
      } else if (id === 'hangar') {
        if (p.mood !== 'red') return undefined;
        s.mode = 'escape';
        s.escapeT = 0;
        api.current?.fx('liftoff');
        sounds().then((x) => {
          x.doors();
          later(() => x.liftoff(), 1100);
        });
        clip('imIn');
        later(() => {
          const ss = sim.current;
          if (!ss || ss.mode !== 'escape') return;
          complete('citadelout');
          ss.escapeT = null;
          outside({ x: spot('hangar').x - 1.5, z: spot('hangar').z - 1.5, face: (Math.PI * 3) / 4 });
          say('The cruiser’s away, and the Citadel’s behind you. (Rick C-137 is still wanted. He’s fine with it.)');
        }, 4600);
      }
      return undefined;
    },
    [onLeave, say, later, complete, outside],
  );

  // a reply picked, or on to the next line
  const talkOnward = useCallback(
    (choice = null) => {
      const s = sim.current;
      if (!s.talk || !s.talking) return;
      const convo = CONVOS[s.talking];
      const node = talkNode(convo, s.talk);
      if (node?.choices && choice == null) return;
      s.talk = talkOn(convo, s.talk, choice);
      if (!s.talk.end) {
        if (s.talking === 'council' && CONTEMPT.has(s.talk.at)) {
          api.current?.fx('contempt');
          sounds().then((x) => x.gavel());
        }
        return setHud((h) => ({ ...h, line: s.talk.at }));
      }
      const which = s.talking;
      s.talking = null;
      s.talk = null;
      if (which === 'council') {
        complete('council');
        s.beat = 'dismissed';
        clip('riggity');
        later(() => {
          if (sim.current?.room === 'council') outside(COUNCIL_DOOR);
        }, 2600);
        say('Dismissed. On the way out, you hear one of them mutter “the Rickest Rick”. Not as a compliment.');
      } else if (which === 'ballot') {
        complete('votemorty');
        api.current?.fx('vote');
        later(() => api.current?.fx('red'), 400);
        sounds().then((x) => x.chime());
        toRed();
        say('Candidate Morty wins in a landslide. His first order: arrest Rick C-137. Get to your cruiser in the hangar, out of the Cop Ricks’ sight.', true);
      }
      setHud((h) => ({ ...h, line: null }));
      return undefined;
    },
    [complete, later, outside, say, toRed],
  );

  const leaveRoom = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'inside' || s.room === 'council') return;
    sounds().then((x) => x.doors());
    outside(FACTORY_DOOR);
  }, [outside]);

  // the line: drop the next layer
  const drop = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'inside' || s.room !== 'factory' || s.beat !== 'line') return;
    audioContext();
    const before = { x: s.line.x, w: s.line.w, cream: s.line.layer % 2 === 1 };
    const events = dropLayer(s.line);
    let laid = null;
    for (const e of events) {
      if (e.type === 'layer') {
        laid = e;
        sounds().then((x) => x.clunk());
        api.current?.fx('layer', { x: e.x, y: 1.2 + e.layer * 0.12 });
      } else if (e.type === 'cut' && laid) {
        sounds().then((x) => x.cut());
        api.current?.fx('cut', { x: laid.x + e.side * (laid.w / 2 + e.w / 2), w: e.w, cream: laid.cream, side: e.side, y: 1.3 + laid.layer * 0.12 });
      } else if (e.type === 'spoilt') {
        sounds().then((x) => x.spoil());
        api.current?.fx('spoilt', { x: before.x, w: before.w, cream: before.cream });
        say('Missed. That wafer’s spoilt.', true);
      } else if (e.type === 'wafer' && !events.some((x) => x.type === 'good')) {
        say('Too thin. That one’s for the reject bin.', true);
      } else if (e.type === 'good') {
        api.current?.fx('good');
        sounds().then((x) => x.blip());
        const left = LINE.need - s.line.good;
        if (left > 0) say(`A good wafer. ${left} more.`);
      } else if (e.type === 'won') {
        sounds().then((x) => x.jingle());
        complete('wafers');
        say('“Come home to the impossible flavor of your own completion. Come home to Simple Rick’s.”');
        later(() => {
          if (sim.current?.room === 'factory') sim.current.beat = 'floor';
        }, 2400);
      } else if (e.type === 'out') {
        say('The foreman Rick sends you to the back of the line. Try again.', true);
        later(() => {
          const ss = sim.current;
          if (ss?.room === 'factory') ss.line = newLine();
        }, 1600);
      }
    }
  }, [complete, later, say]);

  // the walking keys: held while the world's live, by their place on the keyboard
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => !typing(e.target) && keyDown(s.keys, e);
    const up = (e) => keyUp(s.keys, e);
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
  }, [live]);

  // keys
  const near = hud.near;
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      const onButton = e.target instanceof HTMLButtonElement;
      if (s.mode === 'walk') {
        if (moveOf(e)) {
          e.preventDefault();
          audioContext();
          return;
        }
        if ((k === 'e' || k === 'E' || k === 'Enter') && s.near && !onButton) {
          e.preventDefault();
          enter(s.near);
        } else if (k === 'm' || k === 'M') setList((v) => !v);
        return;
      }
      if (s.talk) {
        if (/^[1-4]$/.test(k)) {
          e.preventDefault();
          talkOnward(Number(k) - 1);
        } else if ((k === ' ' || k === 'Enter' || k === 'e' || k === 'E') && !onButton) {
          e.preventDefault();
          talkOnward();
        } else if (k === 'Escape' && s.mode === 'talk') {
          s.mode = 'walk';
          s.talking = null;
          s.talk = null;
        }
        return;
      }
      if (s.mode === 'inside') {
        if (s.beat === 'line' && k === ' ' && !e.repeat && !onButton) {
          e.preventDefault();
          drop();
        } else if (k === 'Escape') leaveRoom();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [live, near, enter, talkOnward, drop, leaveRoom]);

  // ── every frame ──
  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const s = sim.current;
    const p = progRef.current;
    const fast = import.meta.env.DEV ? (s.speedup ?? 1) : 1;
    const dt = Math.min(0.05, ms / 1000) * fast;
    s.t += dt;
    const k = s.keys;
    const held = (name) => k.has(name);
    const pad = readPad();
    const before = s.padBefore ?? {};
    const pressed = (b) => pad?.[b] && !before[b];
    s.padBefore = pad ?? {};
    const red = p.mood === 'red';

    if (s.mode === 'walk') {
      let fwd = (held('up') ? 1 : 0) - (held('down') ? 1 : 0) - s.stick.y;
      let side = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + s.stick.x;
      if (pad) {
        fwd -= pad.ly;
        side += pad.lx;
        if (Math.abs(pad.rx) > 0) {
          s.yaw -= pad.rx * dt * 2.4;
          s.dragAt = s.t;
        }
        if (pressed('a') && s.near) enter(s.near);
        if (pressed('y')) setList((v) => !v);
      }
      const run = k.has('run') || Math.hypot(s.stick.x, s.stick.y) > 0.92 || Boolean(pad?.rb || pad?.lb);
      const mv = cameraMove(s.yaw, Math.max(-1, Math.min(1, fwd)), Math.max(-1, Math.min(1, side)));
      s.h = walkerFor(p.mood).step(s.h, { x: mv.x, z: mv.z, run }, dt, { closed: HANGAR_WALLS });
      if (Math.hypot(mv.x, mv.z) > 0.1) s.moved = true;
      // boxed in: the camera slides round to where there's room
      const room = a.suggestYaw;
      if (room != null && s.t - s.dragAt > 1.4) {
        let d = room - s.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.yaw += d * Math.min(1, dt * 2.2);
        s.roomAt = s.t;
      }
      if (s.h.speed > 0.5 && s.t - s.dragAt > 1.4 && s.t - (s.roomAt ?? -9) > 1.5) {
        let d = behindYaw(s.h.face) - s.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.yaw += d * Math.min(1, dt * 1.6);
      }
      // the rim: a word instead of a wall
      if (s.h.edge && s.t - s.edgeAt > 6) {
        s.edgeAt = s.t;
        say('The rest of the Citadel can wait. It has four hundred levels.');
      }
    }

    // Morty Day Care: the herd, loose or pottering in the pen
    const pushMorty = (x, z, r) => walkerFor(p.mood).push(x, z, r);
    for (const e of stepHerd(s.herd, s.h, dt, { push: pushMorty })) {
      if (e.type === 'penned') {
        const m = s.herd.mortys[e.id];
        a.fx('penned', { x: m.x, y: 1.6, z: m.z });
        sounds().then((x) => x.blip());
        const n = s.herd.mortys.filter((mm) => mm.penned).length;
        if (n < HERD.count) say(`${n} of ${HERD.count} Mortys back in.`);
      } else if (e.type === 'won') {
        complete('daycare');
        sounds().then((x) => x.jingle());
        say('All six back in. The Day Care Rick turns a page. He never knew.');
      } else if (e.type === 'out') {
        say('The Day Care Rick looks up. “What’s going on out there?” They scatter again.', true);
        s.herd = newHerd(s.seed++);
        a.fx('scatter');
      }
    }

    // the line, swinging
    if (s.mode === 'inside' && s.room === 'factory' && s.beat === 'line') stepLine(s.line, dt);

    // the Cop Ricks, on red alert
    s.chased = false;
    if (red) {
      const ev = stepWatchers(s.watchers, s.h, dt, COPS, { colliders: COLLIDERS, walls: WALLS, ring: false, push: pushCop, active: s.mode === 'walk' });
      for (const e of ev) {
        if (e.type === 'seen') {
          a.fx('seen');
          say(['A Cop Rick’s seen you! Run, and get out of his sight!', '“Freeze, C-137!” Run, round the core or behind a kiosk!', 'He’s got you. Break his line of sight!'][e.id % 3], true);
        } else if (e.type === 'caught') {
          a.fx('caught');
          say('A Cop Rick grabs your collar. You slip him, and end up back by the booth. Try again.', true);
          s.h = newWalker(ESCAPE_START);
          s.yaw = behindYaw(s.h.face);
          s.watchers = newWatchers(ROUNDS);
          break;
        } else if (e.type === 'lost') say('He’s lost you.');
      }
      s.chased = s.watchers.list.some((w) => w.mode === 'alert' || w.mode === 'chase');
    }
    if (s.escapeT != null) s.escapeT += dt;

    // what's here, and who's here
    let spotHere = null;
    if (s.mode === 'walk') {
      const sp = nearest(SPOTS, s.h.x, s.h.z);
      const has = (q) => doneRef.current.includes(q);
      const ok =
        sp &&
        ((sp.id === 'daycare' && !has('daycare') && s.herd.state !== 'loose') ||
          sp.id === 'factory' ||
          (sp.id === 'council' && !has('council')) ||
          (sp.id === 'ballot' && p.mood === 'election') ||
          (sp.id === 'hangar' && ((red && !s.chased) || p.finished)) ||
          sp.id === 'portal');
      spotHere = ok ? (sp.id === 'hangar' && p.finished ? 'leave' : sp.id) : null;
    }
    s.near = spotHere;
    let person = null;
    if (s.mode === 'walk') {
      const c = nearest(castFor(p.mood), s.h.x, s.h.z, 3);
      person = c?.id ?? null;
    }
    if (person !== s.person) {
      s.person = person;
      if (person) {
        const c = CAST.find((x) => x.id === person);
        let line;
        if (p.mood === 'election' && c.vote) {
          line = c.vote;
          if (!s.canvassed.has(c.id)) {
            s.canvassed.add(c.id);
            sounds().then((x) => x.blip());
          }
        } else {
          const n = lines.current[person] ?? 0;
          lines.current[person] = n + 1;
          line = c.lines[n % c.lines.length];
        }
        setBubble({ id: person, name: c.name, line });
      } else setBubble(null);
    }

    // the markers: where to go next
    const has = (q) => doneRef.current.includes(q);
    const markers = p.finished
      ? [spot('hangar'), spot('portal')]
      : red
        ? [spot('hangar')]
        : p.mood === 'election'
          ? s.canvassed.size < VOTERS.length
            ? VOTERS.filter((v) => !s.canvassed.has(v.id))
            : [spot('ballot')]
          : ['daycare', 'factory', 'council'].filter((q) => !has(q)).map((q) => spot(q));

    try {
      a.render(
        {
          rick: s.h,
          mood: p.mood,
          mode: s.mode,
          room: s.room,
          beat: s.beat,
          mortys: s.herd.mortys,
          gateOpen: s.herd.state === 'loose',
          line: s.line,
          cops: red ? s.watchers.list : null,
          chased: s.chased,
          talking: s.talking,
          camYaw: s.yaw,
          camPitch: s.pitch,
          camDist: touch ? 8 : 7,
          hangarOpen: s.mode === 'escape',
          escapeT: s.escapeT,
          debugCam: s.debugCam,
        },
        ms * fast,
        fast,
      );
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      a.dispose();
      api.current = null;
      setGl('failed');
      return;
    }

    // the HUD, when what it shows changes
    const penned = s.herd.mortys.filter((m) => m.penned).length;
    const key = [s.mode, s.room, s.near, s.moved, s.beat, s.talking, s.talk?.at, s.herd.state, penned, Math.ceil(HERD.time - s.herd.t), s.line.good, s.line.made, s.line.layer, s.chased, s.canvassed.size].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ mode: s.mode, room: s.room, near: s.near, moved: s.moved, beat: s.beat, talking: s.talking, line: s.talk?.at ?? null, herd: { state: s.herd.state, penned, left: Math.max(0, Math.ceil(HERD.time - s.herd.t)) }, wafers: { good: s.line.good, made: s.line.made, layer: s.line.layer }, chased: s.chased, canvassed: s.canvassed.size });
    }
    if (s.person && bubbleRef.current) {
      const at = a.screenOf('cast', s.person);
      if (at) {
        bubbleRef.current.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
        bubbleRef.current.style.opacity = '1';
      } else bubbleRef.current.style.opacity = '0';
    }
    if (++s.frame % 4 === 0) drawMap(map.current, { scale: MAP_SCALE, h: s.h, markers, night: red, base: drawConcourse(p) });
    if (s.frame % 120 === 0 && s.mode === 'walk') local.set(AT, { x: s.h.x, z: s.h.z, face: s.h.face });
  }, live);

  // the world's own pointer: drag to look round
  const drag = useRef(null);
  const onPointer = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      audioContext();
      if (s.mode === 'walk') drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      return;
    }
    if (e.type === 'pointermove') {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      s.yaw -= (e.clientX - d.x) * 0.0065;
      s.pitch = Math.max(0.08, Math.min(0.95, s.pitch + (e.clientY - d.y) * (e.pointerType === 'mouse' ? 0.004 : 0)));
      d.x = e.clientX;
      d.y = e.clientY;
      s.dragAt = s.t;
      return;
    }
    drag.current = null;
  };

  // the touch stick
  const stick = useRef(null);
  const onStick = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      e.currentTarget.setPointerCapture(e.pointerId);
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
    const dx = Math.max(-1, Math.min(1, (e.clientX - stick.current.x) / 46));
    const dy = Math.max(-1, Math.min(1, (e.clientY - stick.current.y) / 46));
    s.stick = { x: dx, y: dy };
    e.currentTarget.style.setProperty('--sx', `${dx * 26}px`);
    e.currentTarget.style.setProperty('--sy', `${dy * 26}px`);
  };

  // the list's "go there": straight to where each scene starts
  const travel = (q) => {
    const s = sim.current;
    const sp = spot({ daycare: 'daycare', wafers: 'factory', council: 'council', votemorty: 'ballot', citadelout: 'hangar' }[q.id]);
    // a step in from the spot, toward the core, facing it
    const r = Math.hypot(sp.x, sp.z);
    const at = q.id === 'citadelout' ? ESCAPE_START : { x: sp.x - (sp.x / r) * 1.5, z: sp.z - (sp.z / r) * 1.5, face: Math.atan2(-sp.z, sp.x) };
    s.h = newWalker(at);
    s.yaw = behindYaw(s.h.face);
    setList(false);
  };

  const here = hud.near ? PROMPT[hud.near] : null;
  const mode = hud.mode;
  const walking = mode === 'walk';
  const inside = mode === 'inside';
  const convo = hud.talking ? CONVOS[hud.talking] : null;
  const node = convo && hud.line ? convo.nodes[hud.line] : convo ? convo.nodes[convo.start] : null;
  const herding = hud.herd?.state === 'loose';
  const objective = red && hud.chased ? 'Run! Get out of his sight: round the core, behind a kiosk or a planter.' : herding ? 'Herd the Mortys back through the gate, into the pen: come at them from the far side.' : prog.objective;
  return (
    <div ref={box} className="shire-stage citadel-stage" data-touch={touch || undefined} data-mode={mode} data-mood={prog.mood} data-room={inside ? hud.room : undefined}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label="The Citadel of Ricks in 3D: a round concourse under a glass dome, white and cyan, crowded with Ricks and Mortys, and Rick C-137 walking through it" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      {gl === 'loading' && <p className="shire-loading">Opening a portal to the Citadel…</p>}

      {walking && (
        <div className="shire-hud shire-hud-top">
          <div className="shire-brand">
            <h1 id="citadel-title" className="shire-title">
              The Citadel of Ricks
            </h1>
            <p className="shire-objective" aria-live="polite">
              <span aria-hidden="true">◆</span> {objective}
            </p>
          </div>
          <div className="shire-side">
            <canvas ref={map} className="shire-map" width="150" height="150" aria-hidden="true" />
            <button type="button" className="shire-chip" onClick={() => setList((v) => !v)} aria-expanded={list}>
              <b>{done.length}</b> of {QUESTS.length} done {!touch && <kbd>M</kbd>}
            </button>
            {herding && (
              <div className="shire-meter" role="meter" aria-label="Mortys back in the pen" aria-valuemin={0} aria-valuemax={HERD.count} aria-valuenow={hud.herd.penned}>
                <span className="shire-meter-label">Mortys</span>
                <span className="shire-meter-bar">
                  <span style={{ transform: `scaleX(${hud.herd.penned / HERD.count})` }} />
                </span>
                <span className="shire-meter-time">{hud.herd.left}s</span>
              </div>
            )}
            {prog.mood === 'election' && (
              <p className="shire-chip citadel-voters">
                Voters heard <b>{hud.canvassed ?? 0}</b> of {VOTERS.length}
              </p>
            )}
            {red && <p className="shire-chip citadel-wanted">{hud.chased ? 'Seen!' : 'Wanted: Rick C-137'}</p>}
          </div>
        </div>
      )}
      {!walking && <h1 id="citadel-title" className="sr-only">The Citadel of Ricks</h1>}

      {toast && (
        <p className="shire-toast" data-bad={toast.bad || undefined} role="status" key={toast.at}>
          {toast.text}
        </p>
      )}

      {bubble && walking && <Bubble ref={bubbleRef} name={bubble.name} line={bubble.line} />}

      {here && walking && (
        <div className="shire-door">
          <p className="shire-door-name">{here.name}</p>
          <button type="button" className="btn btn-primary" onClick={() => enter(hud.near)}>
            {here.act} {!touch && <kbd>E</kbd>}
          </button>
        </div>
      )}

      {gl === 'on' && walking && !hud.moved && !here && <p className="shire-hint">{touch ? 'Drag the stick to walk, push it all the way to run. Swipe the view to look round.' : 'W A S D or the arrows to walk, Shift to run. Drag to look round. E to do things, M for the list.'}</p>}

      {node && (mode === 'talk' || inside) && <Convo title={hud.talking === 'council' ? 'Before the Council of Ricks' : 'At Candidate Morty’s booth'} name={SPEAKERS[node.who] ?? ''} node={node} touch={touch} onPick={(i) => talkOnward(i)} onNext={() => talkOnward()} />}

      {inside && hud.room === 'factory' && hud.beat === 'line' && (
        <div className="shire-panel citadel-line">
          <p className="shire-panel-title">Simple Rick’s line</p>
          <p className="shire-panel-stats">
            <span>
              Good wafers <b>{hud.wafers.good}</b> of {LINE.need}
            </span>
            <span>
              Wafers left <b>{Math.max(0, LINE.wafers - hud.wafers.made)}</b>
            </span>
          </p>
          <ol className="citadel-layers" aria-label="The layers of this wafer">
            {Array.from({ length: LINE.layers }, (_, i) => (
              <li key={i} data-laid={i < hud.wafers.layer || undefined} data-cream={i % 2 === 1 || undefined} />
            ))}
          </ol>
          <p className="shire-panel-help">{touch ? 'Tap Drop as the dispenser passes over the stack.' : 'Space (or Drop) as the dispenser passes over the stack.'}</p>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-primary btn-sm citadel-drop" onPointerDown={(e) => (e.preventDefault(), drop())} onContextMenu={(e) => e.preventDefault()}>
              Drop
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={leaveRoom}>
              Back to the concourse {!touch && <kbd>Esc</kbd>}
            </button>
          </div>
        </div>
      )}
      {inside && hud.room === 'factory' && hud.beat === 'floor' && (
        <div className="shire-panel citadel-floor">
          <p className="shire-panel-title">Simple Rick’s</p>
          <p className="shire-panel-say">The line runs on without you. Somewhere under the floor, they say, Simple Rick is still dreaming of his daughter.</p>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={leaveRoom}>
              Back to the concourse {!touch && <kbd>Esc</kbd>}
            </button>
          </div>
        </div>
      )}

      {walking && touch && <Stick onStick={onStick} />}

      {list && <QuestList title="Things to do in the Citadel" quests={prog.quests} next={prog.next} onClose={() => setList(false)} onGo={travel} canGo={(q) => q.open && !q.done && (q.id !== 'citadelout' || red)} />}
    </div>
  );
}

// The concourse on the corner map: the floor, the core, the pen, the booth
// and the cover, the shopfronts' ring; red on red alert.
const drawConcourse = (prog) => (g, at) => {
  const red = prog.mood === 'red';
  g.fillStyle = red ? '#3a2228' : '#c9d3e2';
  g.beginPath();
  g.arc(...at(0, 0), WORLD.radius * MAP_SCALE, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = red ? '#ff4a5a' : '#6ff3ff';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = red ? '#6a3a44' : '#8a9ab4';
  g.beginPath();
  g.arc(...at(CORE.x, CORE.z), CORE.r * MAP_SCALE, 0, Math.PI * 2);
  g.fill();
  // the pen
  g.strokeStyle = '#e8483c';
  g.lineWidth = 1.5;
  const [px, pz] = at(PEN.x - PEN.w / 2, PEN.z - PEN.d / 2);
  g.strokeRect(px, pz, PEN.w * MAP_SCALE, PEN.d * MAP_SCALE);
  // the cover
  g.fillStyle = red ? '#8a5a64' : '#6a7a94';
  for (const k of KIOSKS) {
    g.beginPath();
    g.arc(...at(k.x, k.z), 1.6 * MAP_SCALE, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = red ? '#5a7a5a' : '#4fae8a';
  for (const [x, z] of PLANTERS) {
    g.beginPath();
    g.arc(...at(x, z), 1.3 * MAP_SCALE, 0, Math.PI * 2);
    g.fill();
  }
  const [bx, bz] = at(BOOTH.x, BOOTH.z);
  g.fillStyle = prog.mood === 'day' ? '#7d8798' : '#c8262e';
  g.fillRect(bx - 2, bz - 2, 4, 4);
};

// Without 3D: the scenes, as cards.
function Cards({ prog, three, gl, retry }) {
  return (
    <div className="shell shire-cards-wrap">
      <h1 id="citadel-title" className="title">
        The Citadel of Ricks
      </h1>
      <p className="lead mt-4 max-w-[60ch]">A whole city of Ricks, and their Mortys, that you can walk about in 3D as Rick C-137. {prog.objective}</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here’s the Citadel as cards.' : gl === 'failed' ? 'The 3D Citadel couldn’t start here, so here it is as cards.' : three.held ? 'The 3D Citadel isn’t loaded yet, so here it is as cards.' : '3D is switched off, so here’s the Citadel as cards.'}
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
      <ul className="shire-cards">
        {prog.quests.map((q) => (
          <li key={q.id} data-done={q.done || undefined}>
            <p className="shire-list-name">{q.name}</p>
            <p className="shire-list-sub">{q.where}</p>
            <p className="mt-2 text-sm text-muted">{q.blurb}</p>
            {q.done && <p className="mt-2 text-sm font-semibold">Done</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
