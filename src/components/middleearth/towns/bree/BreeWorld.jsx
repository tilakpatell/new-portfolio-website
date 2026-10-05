import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../../../Achievements';
import { audioContext } from '../../../../lib/audio';
import { use3D } from '../../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../../lib/hooks';
import { readPad, typing } from '../../../games/pad';
import { stepGaze } from '../../shire/rules';
import { Bubble, Convo, QuestList, Stick } from '../TownHud';
import { keyDown, keyUp, moveOf } from '../keys';
import { drawMap } from '../map';
import { nearest } from '../story';
import { newTalk, talkNode, talkOn } from '../talk';
import { behindYaw, cameraMove, makeWalker, newWalker } from '../walker';
import { newWatchers, stepWatchers } from '../watchers';
import { COLLIDERS, GATE_WALLS, INN_DOOR, ROADS, ROUNDS, SPOTS, START, TOWN, WALLS, WORLD, castFor, spot, validAt } from './layout';
import { CONVOS, NAZGUL, QUESTS, SEAL, SLIP, SPEAKERS, breeProgress } from './story';
import { POUR, newPour, nextMug, startPour, stepPour, stopPour } from './pints';
import '../../shire/shire.css';
import './bree.css';

// Bree, the town: walk in from the road in the rain as Frodo, the night the
// hobbits came to the Prancing Pony, and play the five scenes there. The
// town is in ./layout.js, the story in ./story.js, the drawing in
// ./scene.js; this is the walking, the HUD, the talk, the inn, the pints,
// the Ring and the Nazgûl. Without 3D, the scenes are listed as cards.

const DONE = 'tp-bree-done';
const AT = 'tp-bree-at';
const sounds = () => import('./sounds');
const shireSounds = () => import('../../shire/sounds');
const sfx = () => import('../../../../lib/sfx');
const clip = (id) => import('../../../../lib/clips').then((c) => c.playClip(id)).catch(() => null);
const PROMPT = {
  gate: { name: 'The West Gate', act: 'Knock' },
  pony: { name: 'The Prancing Pony', act: 'Go in' },
  east: { name: 'Strider, by the East Gate', act: 'Go with him' },
  leave: { name: 'The road to Weathertop', act: 'On to Rivendell' },
};
const walker = makeWalker({ radius: WORLD.radius, colliders: COLLIDERS, walls: WALLS });
const pushNazgul = (x, z) => walker.push(x, z, 0.45);
const MAP_SCALE = 150 / (TOWN.r * 2 + 30);

export default function BreeWorld({ onLeave }) {
  const three = use3D();
  const [done, setDone] = useState(() => {
    const d = local.get(DONE, []);
    return breeProgress(Array.isArray(d) ? d : []).done;
  });
  const prog = breeProgress(done);
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const { unlock } = useAchievements();
  const complete = useCallback(
    (id) => {
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = breeProgress([...d, id]).done;
        local.set(DONE, next);
        return next;
      });
      if (SEAL[id]) unlock(SEAL[id]);
    },
    [unlock],
  );
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="shire-world bree-world" aria-labelledby="bree-title" data-mode={world ? '3d' : 'cards'}>
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
    const h = newWalker(validAt(local.get(AT, null), done));
    sim.current = { h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: 0.34, dragAt: -1e9, mode: 'walk', talking: null, talk: null, beat: 'room', stepT: 0, pour: newPour(), pourStop: null, wearing: false, gaze: 0, near: null, person: null, watchers: newWatchers(ROUNDS), chased: false, frame: 0, moved: false, t: 0, air: null, wraith: null, padBefore: null, edgeAt: -9, hidden: false };
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
      .then(({ createBreeWorld }) => {
        if (dead || !canvas.current) return null;
        return createBreeWorld(canvas.current, { onLost: () => !dead && setGl('lost') });
      })
      .then((a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        if (import.meta.env.DEV) window.__BREE__ = { api: a, sim: sim.current, complete }; // for the QA scripts
        fit();
        setGl('on');
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
      // out of the inn (or wherever a scene was), on to the forecourt
      const at = s.mode === 'inside' ? INN_DOOR : s.h;
      local.set(AT, { x: at.x, z: at.z, face: at.face });
      s.pourStop?.();
      s.air?.stop();
      s.wraith?.();
      api.current?.dispose();
      api.current = null;
    };
  }, [setGl, complete]);

  const live = gl === 'on' && inView;

  // the weather, while the town's on screen
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    let stop = false;
    sounds().then((x) => {
      if (stop || !s) return;
      s.air = x.weather();
      s.air.inside(s.mode === 'inside' ? 1 : 0);
    });
    return () => {
      stop = true;
      s.air?.stop();
      s.air = null;
    };
  }, [live]);
  useEffect(() => {
    sim.current?.air?.level(prog.sky === 'dawn' ? 0.15 : 1);
  }, [prog.sky]);

  // ── the Ring ──
  const putRing = useCallback(
    (on) => {
      const s = sim.current;
      if (s.wearing === on) return;
      s.wearing = on;
      if (on) {
        sfx().then((x) => {
          if (s.wearing) s.wraith = x.wraith();
        });
        if (s.mode !== 'inside') say(progRef.current.sky === 'night' ? 'You slip it on. Every Rider in Bree turns towards you.' : 'You slip it on. The world goes grey, and something far off turns towards you.', true);
      } else {
        s.wraith?.();
        s.wraith = null;
      }
    },
    [say],
  );

  // ── into and out of things ──
  const toBeat = useCallback((beat) => {
    const s = sim.current;
    s.beat = beat;
    s.stepT = 0;
    s.slipped = false;
    s.talking = beat === 'bar' ? 'butterbur' : beat === 'ask' ? 'ask' : beat === 'strider' ? 'strider' : null;
    s.talk = s.talking ? newTalk(CONVOS[s.talking]) : null;
    if (beat === 'pints') {
      s.pour = newPour();
      say('Pippin: “It comes in pints?” Hold the tap, and let go with the head between the two lines.');
    }
    if (beat === 'slip') {
      s.gaze = 0;
      sounds().then((x) => x.cheer());
    }
  }, [say]);

  const outside = useCallback(
    (night = false) => {
      const s = sim.current;
      s.pourStop?.();
      s.pourStop = null;
      s.mode = 'walk';
      s.talking = null;
      s.talk = null;
      putRing(false);
      s.h = newWalker(INN_DOOR);
      // out over the street, looking back at him on the Pony's step
      s.yaw = behindYaw(s.h.face) + Math.PI * 0.8;
      s.dragAt = s.t;
      s.air?.inside(0);
      if (night) s.watchers = newWatchers(ROUNDS);
    },
    [putRing],
  );

  const enter = useCallback(
    (id) => {
      const s = sim.current;
      const p = progRef.current;
      audioContext();
      if (id === 'leave') return onLeave?.();
      if (id === 'gate') {
        s.mode = 'talk';
        s.talking = 'gate';
        s.talk = newTalk(CONVOS.gate);
        sounds().then((x) => {
          x.knock();
          setTimeout(() => x.hatch(), 900);
        });
      } else if (id === 'pony') {
        if (p.sky !== 'evening') return say('The door’s barred, and every window dark.');
        s.mode = 'inside';
        s.air?.inside(1);
        sounds().then((x) => x.door());
        toBeat(doneRef.current.includes('pony') ? 'room' : 'bar');
      } else if (id === 'east') {
        complete('slip');
        say('Strider: “This way. Quickly, and quietly.” By dawn you’re through, and the rain has stopped.');
        s.watchers = newWatchers(ROUNDS);
      }
      setList(false);
      return undefined;
    },
    [onLeave, say, toBeat, complete],
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
      if (!s.talk.end) return setHud((h) => ({ ...h, line: s.talk.at }));
      // how it ended
      const which = s.talking;
      s.talking = null;
      s.talk = null;
      if (which === 'gate') {
        complete('gate');
        s.mode = 'walk';
        sounds().then((x) => x.bolts());
        api.current?.fx('gate');
        say('The West Gate swings open. The Prancing Pony is up the high street, on the left.');
      } else if (which === 'butterbur') {
        complete('pony');
        toBeat('room');
        say('Butterbur bustles off. At your table Pippin has spotted the beer, and in the corner a hooded man is watching you.');
      } else if (which === 'ask') {
        toBeat('slip');
        api.current?.fx('slip');
      } else if (which === 'strider') {
        complete('strider');
        outside(true);
        say('Night. Hooves on the road, and the West Gate goes down with a crash. The Nazgûl are in Bree.', true);
        clip('nazgul').then((h) => !h && shireSounds().then((x) => x.shriek()));
      }
      setHud((h) => ({ ...h, line: null }));
      return undefined;
    },
    [complete, say, toBeat, outside],
  );

  const leaveInn = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'inside' || s.beat === 'slip' || s.beat === 'strider') return;
    sounds().then((x) => x.door());
    outside(false);
  }, [outside]);

  // the tap: held to pour
  const pour = useCallback(
    (on) => {
      const s = sim.current;
      if (s.mode !== 'inside' || s.beat !== 'pints') return;
      audioContext();
      if (on) {
        if (s.pour.state !== 'ready') return;
        startPour(s.pour);
        sounds().then((x) => {
          if (s.pour.pouring) s.pourStop = x.pouring();
        });
        return;
      }
      s.pourStop?.();
      s.pourStop = null;
      const how = stopPour(s.pour);
      if (!how) return;
      const left = POUR.need - s.pour.good;
      sounds().then((x) => x.clunk());
      if (s.pour.state === 'won') {
        api.current?.fx('good');
        sounds().then((x) => x.cheer());
        say('Three good pints. Pippin: “This is a pint!” Merry: “It comes in pints?! I’m getting one.”');
        complete('pints');
        later(() => sim.current?.beat === 'pints' && toBeat('room'), 2200);
      } else if (s.pour.state === 'out') {
        say('Butterbur takes the jug off you. “Let me show you, little master.” Try again.', true);
        later(() => {
          const ss = sim.current;
          if (ss?.beat === 'pints') ss.pour = newPour();
        }, 1600);
      } else {
        if (how === 'good') api.current?.fx('good');
        say(how === 'good' ? `A good pint! ${left} more for Pippin.` : how === 'short' ? 'That’s not a pint, that’s a half.' : 'All head and no ale. Butterbur tuts.', how !== 'good');
        later(() => sim.current && nextMug(sim.current.pour), 900);
      }
    },
    [say, complete, later, toBeat],
  );

  // the walking keys: held while the town's live, by their place on the
  // keyboard (../keys), and kept when the handlers below are re-made
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
        } else if (k === 'r' || k === 'R') putRing(!s.wearing);
        else if (k === 'm' || k === 'M') setList((v) => !v);
        return;
      }
      if (s.mode === 'talk' || (s.mode === 'inside' && s.talk)) {
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
        if (s.beat === 'pints' && k === ' ' && !e.repeat && !onButton) {
          e.preventDefault();
          pour(true);
        } else if (s.beat === 'slip' && (k === 'r' || k === 'R')) putRing(false);
        else if (k === 'Escape') leaveInn();
      }
    };
    const up = (e) => {
      if (e.key === ' ' && s.mode === 'inside' && s.beat === 'pints') pour(false);
    };
    const blur = () => {
      if (s.pour.pouring) pour(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [live, near, enter, putRing, talkOnward, pour, leaveInn]);

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
    const night = p.sky === 'night';
    const closed = [...(p.gateOpen ? [] : GATE_WALLS.west), ...(p.eastOpen ? [] : GATE_WALLS.east)];

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
        if (pressed('x')) putRing(!s.wearing);
        if (pressed('y')) setList((v) => !v);
      }
      const run = k.has('run') || Math.hypot(s.stick.x, s.stick.y) > 0.92 || Boolean(pad?.rb || pad?.lb);
      const mv = cameraMove(s.yaw, Math.max(-1, Math.min(1, fwd)), Math.max(-1, Math.min(1, side)));
      s.h = walker.step(s.h, { x: mv.x, z: mv.z, run }, dt, { closed });
      if (Math.hypot(mv.x, mv.z) > 0.1) s.moved = true;
      // boxed in against a wall: the camera slides round to where there's
      // room, and stays there a moment rather than swinging straight back
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
        say(s.h.x < -TOWN.r ? 'Back to the Shire? Not with the Ring in your pocket.' : 'The road goes on to Weathertop. Strider will lead you.');
      }
    }

    // the Nazgûl, walking the lanes at night
    s.chased = false;
    if (night) {
      const ev = stepWatchers(s.watchers, s.h, dt, NAZGUL, { colliders: COLLIDERS, walls: WALLS, ring: s.wearing, push: pushNazgul, active: s.mode === 'walk' });
      for (const e of ev) {
        if (e.type === 'seen') {
          a.fx('seen');
          clip('nazgul').then((h) => !h && shireSounds().then((x) => x.shriek()));
          say(['A Rider’s seen you! Run, and get out of its sight!', 'It shrieks, and turns towards you. Run!', 'One of them has your scent. Get away from it!'][e.id % 3], true);
        } else if (e.type === 'caught') {
          a.fx('caught');
          putRing(false);
          say('A cold hand closes on your shoulder, and then Strider’s is there instead, pulling you back to the inn. Try again.', true);
          s.h = newWalker(INN_DOOR);
          s.yaw = behindYaw(s.h.face);
          s.watchers = newWatchers(ROUNDS);
          break;
        } else if (e.type === 'lost') say('It’s lost you.');
      }
      s.chased = s.watchers.list.some((w) => w.mode === 'alert' || w.mode === 'chase');
    }

    // the Ring: the Eye comes nearer while it's on
    s.gaze = stepGaze(s.gaze, s.wearing, dt * (s.mode === 'inside' && s.beat === 'slip' ? SLIP.gaze / 0.16 : 1));
    if (s.wearing && s.gaze >= 1) {
      putRing(false);
      if (s.mode === 'inside' && s.beat === 'slip') {
        say('The Eye finds you, and you tear the Ring off too late. Try again: take it off quicker.', true);
        toBeat('slip');
      } else say('The Eye. You pull the Ring off, shaking.', true);
    }

    // inside: the beat's own clock, the pour, the Ring slipping on
    if (s.mode === 'inside') {
      s.stepT += dt;
      if (s.beat === 'pints') {
        for (const e of stepPour(s.pour, dt)) {
          if (e.type === 'spilt') {
            s.pourStop?.();
            s.pourStop = null;
            a.fx('spilt');
            sounds().then((x) => x.splash());
            say(s.pour.state === 'out' ? 'Ale all over the bar. Butterbur takes the jug off you. Try again.' : 'Over the brim and all over the bar!', true);
            later(() => {
              const ss = sim.current;
              if (!ss || ss.beat !== 'pints') return;
              if (ss.pour.state === 'out') ss.pour = newPour();
              else nextMug(ss.pour);
            }, 1200);
          }
        }
      }
      if (s.beat === 'slip' && !s.wearing && s.stepT > 2.15 && s.stepT < 2.3 && !s.slipped) {
        s.slipped = true;
        putRing(true);
        say('The Ring slips on to your finger, and you vanish. Take it off!', true);
      }
      if (s.beat === 'slip' && s.slipped && !s.wearing && s.stepT > 2.3) {
        // off again: and a hand on your shoulder
        s.slipped = false;
        toBeat('strider');
      }
      if (s.beat !== 'slip') s.slipped = false;
    }

    // what's here, and who's here
    let spotHere = null;
    if (s.mode === 'walk') {
      const sp = nearest(SPOTS, s.h.x, s.h.z);
      const ok = sp && ((sp.id === 'gate' && !p.gateOpen) || (sp.id === 'pony' && p.gateOpen && p.sky === 'evening') || (sp.id === 'east' && night && !s.chased) || (sp.id === 'leave' && p.finished));
      spotHere = ok ? sp.id : null;
    }
    s.near = spotHere;
    let person = null;
    if (s.mode === 'walk') {
      const c = nearest(castFor(p.sky).filter((x) => x.id !== 'harry' || p.gateOpen), s.h.x, s.h.z, 2.8);
      person = c?.id ?? null;
    }
    if (person !== s.person) {
      s.person = person;
      if (person) {
        const c = castFor(p.sky).find((x) => x.id === person);
        const n = lines.current[person] ?? 0;
        lines.current[person] = n + 1;
        setBubble({ id: person, name: c.name, line: c.lines[n % c.lines.length] });
      } else setBubble(null);
    }

    // the markers: where to go next
    const next = p.next;
    const markers = p.finished ? [spot('leave')] : night ? [spot('east')] : next === 'gate' ? [spot('gate')] : [spot('pony')];

    try {
      a.render(
        {
          hobbit: s.h,
          sky: p.sky,
          mode: s.mode,
          beat: s.beat,
          stepT: s.stepT,
          pour: s.pour,
          wearing: s.wearing,
          gaze: s.gaze,
          gateOpen: p.gateOpen,
          smashed: p.smashed,
          eastOpen: p.eastOpen,
          watchers: night ? s.watchers.list : null,
          chased: s.chased,
          talking: s.talking,
          camYaw: s.yaw,
          camPitch: s.pitch,
          camDist: touch ? 7.2 : 6.4,
          near: s.near,
          talk: s.person,
          markers,
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
    const key = [s.mode, s.near, s.moved, s.beat, s.talking, s.talk?.at, s.pour.state, s.pour.good, s.pour.tries, s.pour.pouring, Math.round(s.pour.level * 60), s.wearing, Math.round(s.gaze * 20), s.chased].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ mode: s.mode, near: s.near, moved: s.moved, beat: s.beat, talking: s.talking, line: s.talk?.at ?? null, pour: { ...s.pour }, wearing: s.wearing, gaze: s.gaze, chased: s.chased });
    }
    if (s.person && bubbleRef.current) {
      const at = a.screenOf('cast', s.person);
      if (at) {
        bubbleRef.current.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
        bubbleRef.current.style.opacity = '1';
      } else bubbleRef.current.style.opacity = '0';
    }
    if (++s.frame % 4 === 0) drawMap(map.current, { scale: MAP_SCALE, h: s.h, markers, night: night, base: drawTown(p) });
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
      s.pitch = Math.max(0.1, Math.min(0.95, s.pitch + (e.clientY - d.y) * (e.pointerType === 'mouse' ? 0.004 : 0)));
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
    const at = q.id === 'gate' ? { x: -40, z: 4.2, face: 0 } : q.id === 'slip' ? INN_DOOR : { x: 4, z: 0.6, face: Math.PI / 2 };
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
  const objective = prog.sky === 'night' && hud.chased ? 'Run! Get out of its sight: round a corner, behind a house.' : prog.objective;
  const pourK = hud.pour ? Math.min(1, hud.pour.level + hud.pour.head) : 0;
  return (
    <div ref={box} className="shire-stage bree-stage" data-touch={touch || undefined} data-mode={mode} data-beat={inside ? hud.beat : undefined} data-wearing={hud.wearing || undefined} data-sky={prog.sky}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label="Bree in 3D: the West Gate in the rain, tall houses down the high street, the Prancing Pony, and Frodo in the mud" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      {gl === 'loading' && <p className="shire-loading">Walking into Bree…</p>}

      {walking && (
        <div className="shire-hud shire-hud-top">
          <div className="shire-brand">
            <h1 id="bree-title" className="shire-title">
              Bree
            </h1>
            <p className="shire-objective" aria-live="polite">
              <span aria-hidden="true">✦</span> {objective}
            </p>
          </div>
          <div className="shire-side">
            <canvas ref={map} className="shire-map" width="150" height="150" aria-hidden="true" />
            <button type="button" className="shire-chip" onClick={() => setList((v) => !v)} aria-expanded={list}>
              <b>{done.length}</b> of {QUESTS.length} done {!touch && <kbd>M</kbd>}
            </button>
            <button type="button" className="shire-chip shire-ring-btn" data-on={hud.wearing || undefined} onClick={() => putRing(!sim.current.wearing)}>
              {hud.wearing ? 'Take it off' : 'The Ring'} {!touch && <kbd>R</kbd>}
            </button>
            {hud.wearing && (
              <div className="shire-meter" role="meter" aria-label="The Eye" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.round(hud.gaze * 100) / 100}>
                <span className="shire-meter-label">The Eye</span>
                <span className="shire-meter-bar shire-meter-eye">
                  <span style={{ transform: `scaleX(${hud.gaze})` }} />
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      {!walking && <h1 id="bree-title" className="sr-only">Bree</h1>}

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

      {node && (mode === 'talk' || inside) && <Convo title={hud.talking === 'gate' ? 'At the West Gate' : 'In the Prancing Pony'} name={SPEAKERS[node.who] ?? ''} node={node} touch={touch} onPick={(i) => talkOnward(i)} onNext={() => talkOnward()} />}

      {inside && hud.beat === 'room' && (
        <div className="shire-panel bree-room">
          <p className="shire-panel-title">The Prancing Pony</p>
          <p className="shire-panel-say">Smoke, firelight and a roomful of Big Folk. Pippin is eyeing the beer; in the dark corner, a hooded man is watching you.</p>
          <div className="shire-panel-row">
            {!done.includes('pints') && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => toBeat('pints')}>
                Pints for Pippin
              </button>
            )}
            {done.includes('pints') && !done.includes('strider') && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => toBeat('ask')}>
                Who’s that, in the corner?
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => document.getElementById('pony-rush')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Help in the kitchen (co-op)
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={leaveInn}>
              Back out into the rain {!touch && <kbd>Esc</kbd>}
            </button>
          </div>
        </div>
      )}

      {inside && hud.beat === 'pints' && hud.pour && (
        <div className="shire-panel bree-pints">
          <p className="shire-panel-title">It comes in pints?</p>
          <div className="bree-glass" aria-hidden="true">
            <span className="bree-glass-ale" style={{ transform: `scaleY(${hud.pour.level})` }} />
            <span className="bree-glass-head" style={{ bottom: `${hud.pour.level * 100}%`, height: `${hud.pour.head * 100}%` }} />
            <span className="bree-glass-line" style={{ bottom: `${POUR.lo * 100}%` }} />
            <span className="bree-glass-line" style={{ bottom: `${POUR.hi * 100}%` }} />
          </div>
          <p className="shire-panel-stats">
            <span>
              Good pints <b>{hud.pour.good}</b> of {POUR.need}
            </span>
            <span>
              Goes left <b>{Math.max(0, POUR.tries - hud.pour.tries)}</b>
            </span>
          </p>
          <p className="shire-panel-help">{touch ? 'Press and hold the tap; let go with the top of the head between the lines.' : 'Hold the tap (or Space); let go with the top of the head between the lines.'}</p>
          <div className="shire-panel-row">
            <button
              type="button"
              className="btn btn-primary btn-sm bree-tap"
              data-pouring={hud.pour.pouring || undefined}
              disabled={hud.pour.state !== 'ready' && !hud.pour.pouring}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                pour(true);
              }}
              onPointerUp={() => pour(false)}
              onPointerCancel={() => pour(false)}
              onLostPointerCapture={() => sim.current.pour.pouring && pour(false)}
              onContextMenu={(e) => e.preventDefault()}
              aria-label={`The tap: ${Math.round(pourK * 100)} percent full`}
            >
              {hud.pour.pouring ? 'Pouring…' : 'Hold the tap'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => toBeat('room')}>
              Back to the table
            </button>
          </div>
        </div>
      )}

      {inside && hud.beat === 'slip' && (
        <div className="shire-panel bree-slip">
          <p className="shire-panel-title">{hud.wearing ? 'The Ring!' : 'Frodo Baggins!'}</p>
          <p className="shire-panel-say">{hud.wearing ? 'It’s on your finger, and the Eye is coming. Take it off!' : 'You jump up to stop Pippin, and your foot goes from under you…'}</p>
          {hud.wearing && (
            <>
              <div className="shire-meter" role="meter" aria-label="The Eye" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.round(hud.gaze * 100) / 100}>
                <span className="shire-meter-label">The Eye</span>
                <span className="shire-meter-bar shire-meter-eye">
                  <span style={{ transform: `scaleX(${hud.gaze})` }} />
                </span>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => putRing(false)}>
                Take it off {!touch && <kbd>R</kbd>}
              </button>
            </>
          )}
        </div>
      )}

      {walking && touch && <Stick onStick={onStick} />}

      {list && <QuestList title="Things to do in Bree" quests={prog.quests} next={prog.next} onClose={() => setList(false)} onGo={travel} canGo={(q) => q.open && !q.done && (q.id === 'gate' || (q.id === 'slip' ? prog.sky === 'night' : prog.gateOpen && prog.sky === 'evening'))} />}
    </div>
  );
}

// The town on the corner map: the stockade, the streets, the houses' dark
// shapes, and the Pony lit.
const drawTown = (prog) => (g, at) => {
  const night = prog.sky === 'night';
  g.fillStyle = night ? '#2a3424' : '#a8b884';
  g.beginPath();
  g.arc(...at(0, 0), TOWN.r * MAP_SCALE, 0, Math.PI * 2);
  g.fill();
  g.lineCap = 'round';
  g.strokeStyle = night ? '#6a5a40' : '#8a6a44';
  for (const r of ROADS) {
    g.lineWidth = Math.max(1.2, r.w * MAP_SCALE);
    g.beginPath();
    g.moveTo(...at(r.a[0], r.a[1]));
    g.lineTo(...at(r.b[0], r.b[1]));
    g.stroke();
  }
  for (const c of COLLIDERS) {
    if (c.kind !== 'box' || c.low) continue;
    const [x, y] = at(c.x, c.z);
    g.save();
    g.translate(x, y);
    g.rotate(-(c.turn || 0));
    g.fillStyle = c.id === 'pony' ? '#d8a040' : night ? '#4a4034' : '#6a5a48';
    g.fillRect((-c.w / 2) * MAP_SCALE, (-c.d / 2) * MAP_SCALE, c.w * MAP_SCALE, c.d * MAP_SCALE);
    g.restore();
  }
  g.strokeStyle = night ? '#8a7a5a' : '#4a3420';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(...at(0, 0), TOWN.r * MAP_SCALE, 0, Math.PI * 2);
  g.stroke();
  // the start, outside the gate
  if (!prog.gateOpen) {
    const [x, y] = at(START.x, START.z);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(x - 1, y - 1, 2, 2);
  }
};

// Without 3D: the scenes, as cards.
function Cards({ prog, three, gl, retry }) {
  return (
    <div className="shell shire-cards-wrap">
      <h1 id="bree-title" className="title">
        Bree
      </h1>
      <p className="lead mt-4 max-w-[60ch]">A wet night at the Prancing Pony, in a Bree you can walk about in 3D. {prog.objective}</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here’s Bree as cards.' : gl === 'failed' ? 'The 3D Bree couldn’t start here, so here it is as cards.' : three.held ? 'The 3D Bree isn’t loaded yet, so here it is as cards.' : '3D is switched off, so here’s Bree as cards.'}
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
