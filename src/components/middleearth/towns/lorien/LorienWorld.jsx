import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../../../Achievements';
import { audioContext } from '../../../../lib/audio';
import { use3D } from '../../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../../lib/hooks';
import { readPad, typing } from '../../../games/pad';
import { Bubble, Convo, QuestList, Stick, Travellers } from '../TownHud';
import { useTravellers } from '../useTravellers';
import { keyDown, keyUp, moveOf } from '../keys';
import { nearest } from '../story';
import { newTalk, talkNode, talkOn } from '../talk';
import { behindYaw, cameraMove, makeWalker, newWalker } from '../walker';
import { followAt, lead as leadParty, newParty } from '../rivendell/rules';
import { AMBUSH, COLLIDERS, LANDING, LEAD, MIRROR, SPOTS, START, STAIR, TABLE, TREE, WALLS, castFor, moodFor, validAt } from './layout';
import { CONVOS, NOT_FOR, QUESTS, SEAL, SPEAKERS, THANKS, lorienProgress } from './story';
import { GIFTS, MIRROR_PULL, RIVER, allGiven, eyeOn, eyeSoon, giveGift, newBoat, newGifts, newLead, newPull, stepBoat, stepLead, stepPull, takeGift } from './rules';
import '../../shire/shire.css';
import '../bree/bree.css';
import './lorien.css';

// Lothlórien, the sixth town on the road: the golden wood, Caras
// Galadhon, the Mirror, the gifts, and the river to the Argonath. The
// places are in ./layout.js, the story in ./story.js, the games in
// ./rules.js, the drawing in ./scene.js; this is the walking, the HUD, the
// talk and the games. Without 3D, the scenes are listed as cards.

const DONE = 'tp-lorien-done';
const AT = 'tp-lorien-at';
const sounds = () => import('./sounds');
const PROMPT = {
  stair: { name: 'The great mallorn', act: 'Climb the stair' },
  mirror: { name: 'The Mirror of Galadriel', act: 'Go down to the Mirror' },
  table: { name: 'The Lady’s gifts', act: 'Take a gift' },
  boats: { name: 'The boats', act: 'Into the boat' },
};
const walker = makeWalker({ radius: 400, colliders: COLLIDERS, walls: WALLS });
// the Fellowship following you in, behind Haldir
const COMPANY = ['aragorn', 'sam', 'gimli', 'legolas', 'merry', 'pippin', 'boromir'];
// camera shots for the conversations: where from, and at what
const SHOTS = {
  haldir: { at: [AMBUSH.x - 3.2, 3.4, AMBUSH.z + 3.2], look: [AMBUSH.x + 4, 1.2, AMBUSH.z - 1.4] },
  caras: { flet: true },
  mirror: { at: [MIRROR.x - 3.2, 1.5, MIRROR.z - 3.4], look: [MIRROR.x + 1, 0.5, MIRROR.z + 0.4] },
  test: { at: [MIRROR.x - 2.2, 1.1, MIRROR.z - 2.4], look: [MIRROR.x + 1.6, 0.7, MIRROR.z + 0.4] },
  phial: { at: [TABLE.x - 1, 2, TABLE.z - 6.5], look: [54, 1.4, -12.5] },
};
// how fast you climb the stair, all the way up
const CLIMB = 1 / 13;

export default function LorienWorld({ onLeave }) {
  const three = use3D();
  const [done, setDone] = useState(() => {
    const d = local.get(DONE, []);
    return lorienProgress(Array.isArray(d) ? d : []).done;
  });
  const prog = lorienProgress(done);
  const [gl, setGl] = useState('loading');
  const { unlock } = useAchievements();
  const complete = useCallback(
    (id) => {
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = lorienProgress([...d, id]).done;
        local.set(DONE, next);
        return next;
      });
      if (SEAL[id]) unlock(SEAL[id]);
    },
    [unlock],
  );
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="shire-world lorien-world" aria-labelledby="lorien-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World prog={prog} complete={complete} gl={gl} setGl={setGl} onLeave={onLeave} /> : <Cards prog={prog} three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

function World({ prog, complete, gl, setGl, onLeave }) {
  const trav = useTravellers('lorien', gl === 'on');
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  const canvas = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const at = validAt(local.get(AT, null));
    const h = newWalker(at);
    sim.current = { zone: 'wood', h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: 0.34, dragAt: -1e9, mode: 'walk', talking: null, talk: null, near: null, person: null, frame: 0, moved: false, t: 0, stepT: 0, air: null, padBefore: null, ambushed: false, lead: null, party: newParty(), climb: 0, pull: null, gifts: null, boat: null, busy: false, steer: 0, up: 0, hold: false, tempt: 0 };
  }
  const progRef = useRef(prog);
  progRef.current = prog;
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
    const t = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./scene')
      .then(({ createLorienWorld }) => {
        if (dead || !canvas.current) return null;
        return createLorienWorld(canvas.current, { onLost: () => !dead && setGl('lost') });
      })
      .then((a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        if (import.meta.env.DEV) window.__LORIEN__ = { api: a, sim: sim.current, complete };
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
      if (s.mode === 'walk' && s.zone === 'wood') local.set(AT, { x: s.h.x, z: s.h.z, face: s.h.face });
      s.air?.stop();
      api.current?.dispose();
      api.current = null;
    };
  }, [setGl, complete]);

  const live = gl === 'on' && inView;
  // the wood's air: leaves, birds by day, the elves singing at night
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    let stop = false;
    sounds().then((x) => {
      if (stop || !s) return;
      s.air = x.air();
      s.air.night(moodFor(progRef.current.next) === 'night' ? 1 : 0);
    });
    return () => {
      stop = true;
      s.air?.stop();
      s.air = null;
    };
  }, [live]);
  useEffect(() => {
    sim.current.air?.night(moodFor(prog.next) === 'night' ? 1 : 0);
  }, [prog.next]);

  const startTalk = useCallback((id) => {
    const s = sim.current;
    s.mode = 'talk';
    s.talking = id;
    s.talk = newTalk(CONVOS[id]);
    s.stepT = 0;
  }, []);

  const startPull = useCallback(() => {
    const s = sim.current;
    s.mode = 'mirror';
    s.pull = newPull(Math.floor(Math.random() * 1000) + 1);
    s.hold = false;
    s.busy = false;
    say('Hold back (Space, or the button) while the Eye looks for you. Rest when it doesn’t.', true);
  }, [say]);

  const startRiver = useCallback(() => {
    const s = sim.current;
    s.zone = 'river';
    s.mode = 'river';
    s.boat = newBoat();
    s.busy = false;
    s.air?.river(1);
    sounds().then((x) => x.oars());
    say('Down the river. Steer round the rocks (A and D), and dig in with the paddle (W).', true);
  }, [say]);

  const toWood = useCallback((at = START) => {
    const s = sim.current;
    s.zone = 'wood';
    s.mode = 'walk';
    s.boat = null;
    s.h = newWalker(at);
    s.yaw = behindYaw(at.face);
    s.air?.river(0);
  }, []);

  const enter = useCallback(
    (id) => {
      audioContext();
      const s = sim.current;
      if (id === 'stair') {
        s.mode = 'climb';
        s.climb = 0;
        sounds().then((x) => x.chime());
        say('Up the stair round the great tree (W, or hold the button).');
      } else if (id === 'mirror') {
        s.h = newWalker({ x: MIRROR.x - 1.4, z: MIRROR.z - 1.6, face: -Math.PI / 4 });
        startTalk('mirror');
      } else if (id === 'table') {
        s.mode = 'table';
      } else if (id === 'boats') startRiver();
      setList(false);
    },
    [say, startTalk, startRiver],
  );

  const talkOnward = useCallback(
    (choice = null) => {
      const s = sim.current;
      if (!s.talk || !s.talking) return;
      const convo = CONVOS[s.talking];
      const node = talkNode(convo, s.talk);
      if (node?.choices && choice == null) return;
      s.talk = talkOn(convo, s.talk, choice);
      if (!s.talk.end) {
        const at = s.talk.at;
        if (s.talking === 'haldir' && at === 'bows') {
          s.ambushed = true;
          sounds().then((x) => x.bows());
        }
        if (s.talking === 'test') {
          if (at === 'queen') {
            s.tempt = 1;
            api.current?.fx('tempt');
            sounds().then((x) => x.tempt());
          } else if (at === 'pass') s.tempt = 0;
        }
        return setHud((h) => ({ ...h, line: at }));
      }
      const which = s.talking;
      s.talking = null;
      s.talk = null;
      setHud((h) => ({ ...h, line: null }));
      if (which === 'haldir') {
        s.mode = 'walk';
        s.lead = newLead(LEAD);
        s.party = newParty();
        for (let x = s.h.x - 10; x <= s.h.x; x += 0.3) leadParty(s.party, x, s.h.z);
        say('Follow Haldir. He won’t wait long.', true);
      } else if (which === 'caras') {
        complete('caras');
        s.climb = 0;
        toWood({ x: TREE.x - STAIR.r - 2.6, z: TREE.z + 1, face: Math.PI });
        say('You sleep, under a pavilion on the ground. When you wake, the elves are singing a lament for Gandalf, and the Lady has gone down to the Mirror.', false);
      } else if (which === 'mirror') startPull();
      else if (which === 'test') {
        complete('mirror');
        s.pull = null;
        s.tempt = 0;
        s.mode = 'walk';
        s.h = newWalker({ x: MIRROR.x, z: MIRROR.z - MIRROR.r - 1, face: Math.PI / 2 });
        s.yaw = behindYaw(Math.PI / 2);
        say('Morning. Galadriel’s gifts are on the table at the landing, east, by the boats.');
      } else if (which === 'phial') {
        complete('gifts');
        s.mode = 'walk';
        s.gifts = null;
        say('“Farewell,” and the elves load the boats.', false);
      } else if (which === 'argonath') {
        complete('argonath');
        s.mode = 'end';
      } else s.mode = 'walk';
      return undefined;
    },
    [complete, say, startPull, toWood],
  );

  const take = useCallback(
    (id) => {
      const s = sim.current;
      if (!s.gifts) s.gifts = newGifts();
      if (takeGift(s.gifts, id)) {
        const g = GIFTS.find((x) => x.id === id);
        sounds().then((x) => x.chime());
        say(`You take ${g.name}. Who is it for?`);
      }
      s.mode = 'walk';
    },
    [say],
  );

  // give what you're carrying to whoever you're next to
  const give = useCallback(() => {
    const s = sim.current;
    const c = s.person ? castFor(progRef.current.next).find((x) => x.id === s.person) : null;
    if (!c || !c.gift || !s.gifts?.carrying) return;
    const r = giveGift(s.gifts, c.look);
    if (r === 'right') {
      api.current?.fx('gift', c.id);
      sounds().then((x) => x.chime(2));
      say(THANKS[c.look], false);
      if (allGiven(s.gifts)) later(() => sim.current?.mode === 'walk' && startTalk('phial'), 2600);
    } else if (r === 'wrong') say(NOT_FOR[c.look] ?? 'Not for them.', true);
  }, [later, say, startTalk]);

  const doAct = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'walk') return undefined;
    if (s.near) return enter(s.near);
    if (s.gifts?.carrying) return give();
    return undefined;
  }, [enter, give]);

  // keys
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
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      const onButton = e.target instanceof HTMLButtonElement;
      if (s.talk) {
        if (/^[1-4]$/.test(k)) {
          e.preventDefault();
          talkOnward(Number(k) - 1);
        } else if ((k === ' ' || k === 'Enter' || k === 'e' || k === 'E') && !onButton) {
          e.preventDefault();
          talkOnward();
        }
        return;
      }
      if (s.mode === 'table') {
        const i = Number(k) - 1;
        const left = GIFTS.filter((g) => s.gifts?.left.includes(g.id) ?? true);
        if (left[i]) {
          e.preventDefault();
          take(left[i].id);
        } else if (k === 'Escape') s.mode = 'walk';
        return;
      }
      if (moveOf(e) && s.mode !== 'end') {
        e.preventDefault();
        audioContext();
      }
      if ((k === ' ' || k === 'e' || k === 'E' || k === 'Enter') && !onButton && !e.repeat) {
        if (s.mode === 'walk' && (s.near || s.gifts?.carrying)) {
          e.preventDefault();
          doAct();
        } else if (s.mode === 'mirror' || s.mode === 'climb') e.preventDefault();
      } else if ((k === 'm' || k === 'M') && s.mode === 'walk') setList((v) => !v);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [live, talkOnward, doAct, take]);

  // ── every frame ──
  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const s = sim.current;
    const p = progRef.current;
    const fast = import.meta.env.DEV ? (s.speedup ?? 1) : 1;
    const dt = Math.min(0.05, ms / 1000) * fast;
    s.t += dt;
    s.stepT += dt;
    const k = s.keys;
    const held = (name) => k.has(name);
    const pad = readPad();
    const before = s.padBefore ?? {};
    const pressed = (b) => pad?.[b] && !before[b];
    s.padBefore = pad ?? {};
    if (pad && s.talk && pressed('a')) talkOnward(0);

    // walking in the wood
    if (s.mode === 'walk' && s.zone === 'wood') {
      let fwd = (held('up') ? 1 : 0) - (held('down') ? 1 : 0) - s.stick.y;
      let side = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + s.stick.x;
      if (pad) {
        fwd -= pad.ly;
        side += pad.lx;
        if (Math.abs(pad.rx) > 0) {
          s.yaw -= pad.rx * dt * 2.4;
          s.dragAt = s.t;
        }
        if (pressed('a')) doAct();
      }
      const run = k.has('run') || Math.hypot(s.stick.x, s.stick.y) > 0.92 || Boolean(pad?.rb || pad?.lb);
      const mv = cameraMove(s.yaw, Math.max(-1, Math.min(1, fwd)), Math.max(-1, Math.min(1, side)));
      s.h = walker.step(s.h, { x: mv.x, z: mv.z, run }, dt);
      if (Math.hypot(mv.x, mv.z) > 0.1) s.moved = true;
      if (s.h.speed > 0.5 && s.t - s.dragAt > 1.4) {
        let d = behindYaw(s.h.face) - s.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.yaw += d * Math.min(1, dt * 1.6);
      }
      if (s.lead) leadParty(s.party, s.h.x, s.h.z);
    }

    // the Galadhrim, and Haldir leading you in
    if (s.mode === 'walk' && p.next === 'haldir' && !s.ambushed && !s.lead && s.h.x > AMBUSH.x - 9) {
      s.h = newWalker({ x: AMBUSH.x - 2, z: AMBUSH.z, face: 0 });
      startTalk('haldir');
    }
    if (s.lead && s.mode === 'walk') {
      for (const e of stepLead(s.lead, dt, s.h, LEAD)) {
        if (e.type === 'wait') say('Haldir stops, and looks back for you.');
        else if (e.type === 'there') {
          complete('haldir');
          sounds().then((x) => x.chime(3));
          say('“Caras Galadhon. The heart of Elvendom on earth. Realm of the Lord Celeborn and of Galadriel, Lady of Light.” Up the stair round the great tree.', false);
          later(() => {
            const ss = sim.current;
            if (ss) ss.lead = null;
          }, 1500);
        }
      }
    }

    // the climb
    if (s.mode === 'climb') {
      const up = (held('up') ? 1 : 0) + (held('run') ? 0.5 : 0) + Math.max(0, -s.stick.y) + (s.up ?? 0) + (pad ? Math.max(0, -pad.ly) + (pad.a ? 1 : 0) : 0) + (k.has('space') ? 1 : 0);
      s.climb = Math.min(1, s.climb + Math.min(1.2, up) * CLIMB * dt);
      if (s.climb >= 1) startTalk('caras');
    }

    // the Mirror
    if (s.mode === 'mirror' && s.pull && !s.busy) {
      const hold = s.hold || held('space') || held('down') || Boolean(pad?.a);
      for (const e of stepPull(s.pull, dt, hold)) {
        if (e.type === 'warn') sounds().then((x) => x.eye(0.4));
        else if (e.type === 'look') {
          a.fx('eye');
          sounds().then((x) => x.eye(1));
        } else if (e.type === 'touched') {
          s.busy = true;
          a.fx('touched');
          say('The Ring swings down on its chain, nearly into the water. Galadriel: “Do not touch the water!” You pull back. Look again, and hold fast when the Eye looks.', true);
          later(() => sim.current?.mode === 'mirror' && startPull(), 2200);
        } else if (e.type === 'done') {
          s.busy = true;
          later(() => sim.current?.mode === 'mirror' && startTalk('test'), 900);
        }
      }
    }

    // the river
    if (s.mode === 'river' && s.boat && !s.busy) {
      let steer = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + s.stick.x + (s.steer ?? 0);
      if (pad) steer += pad.lx;
      const paddle = held('up') || s.stick.y < -0.5 || Boolean(pad?.a);
      for (const e of stepBoat(s.boat, dt, { steer, paddle })) {
        if (e.type === 'hit') {
          a.fx('hit');
          sounds().then((x) => x.bump());
          say(s.boat.hits === 1 ? 'The boat grinds over a rock, and ships water. Sam bails.' : 'Another! Sam: “Mr. Frodo, I can’t swim!”', true);
        } else if (e.type === 'swamped') {
          s.busy = true;
          say('Too much water in the boat. Aragorn brings you in to the bank to tip it out. Again: steer clear of the rocks.', true);
          later(() => sim.current?.mode === 'river' && startRiver(), 2200);
        } else if (e.type === 'argonath') {
          sounds().then((x) => x.horn());
          startTalk('argonath');
        }
      }
    }
    // the boat drifts on between the Kings while Aragorn speaks
    if (s.zone === 'river' && s.mode === 'talk' && s.boat) s.boat.s = Math.min(RIVER.len, s.boat.s + dt * 3);

    // what's here, and who's here
    let spotHere = null;
    if (s.mode === 'walk' && s.zone === 'wood' && !s.lead) {
      const sp = nearest(SPOTS, s.h.x, s.h.z);
      spotHere = sp && sp.quest === p.next ? sp.id : null;
      // the table only while there are gifts on it
      if (spotHere === 'table' && s.gifts && s.gifts.left.length === 0) spotHere = null;
    }
    s.near = spotHere;
    let cast = s.zone === 'wood' ? castFor(p.next) : [];
    if (s.ambushed || s.lead) cast = cast.filter((c) => !c.while?.includes('haldir'));
    let person = null;
    if (s.mode === 'walk') person = nearest(cast, s.h.x, s.h.z, 2.8)?.id ?? null;
    if (person !== s.person) {
      s.person = person;
      if (person) {
        const c = cast.find((x) => x.id === person);
        const n = lines.current[person] ?? 0;
        lines.current[person] = n + 1;
        setBubble({ id: person, name: c.name, line: c.lines[n % c.lines.length] });
      } else setBubble(null);
    }

    // the Fellowship behind you, following Haldir in
    const company = {};
    if (s.talking === 'haldir' && s.ambushed) {
      // standing close together, the arrows on them
      COMPANY.forEach((id, i) => {
        company[id] = { x: AMBUSH.x - 3.6 - (i % 3) * 1.2, z: AMBUSH.z - 1.8 + Math.floor(i / 3) * 1.5, face: 0, moving: false };
      });
    } else if (s.lead) {
      COMPANY.forEach((id, i) => {
        const at = followAt(s.party, i);
        if (at) company[id] = { ...at, moving: s.h.speed > 0.4 };
      });
    }

    const markers = p.finished || s.lead ? [] : SPOTS.filter((x) => x.quest === p.next && (x.id !== 'table' || !s.gifts || s.gifts.left.length > 0));
    const node = s.talk ? talkNode(CONVOS[s.talking], s.talk) : null;
    const tv = trav.ref.current;
    tv?.pose(s.h, { inside: false, ring: false });
    const pull = s.pull;
    try {
      a.render(
        {
          zone: s.zone,
          mode: s.mode,
          mood: s.zone === 'river' ? 'day' : moodFor(p.next),
          hobbit: s.h,
          travellers: s.zone === 'wood' && tv ? tv.list() : null,
          cast: cast.map((c) => c.id),
          talk: s.person,
          talking: s.talking,
          speaker: node?.who ?? null,
          line: s.talk?.at ?? null,
          camShot: s.mode === 'talk' && SHOTS[s.talking] ? { id: s.talking, ...SHOTS[s.talking] } : null,
          ambush: s.ambushed && (s.mode === 'talk' || Boolean(s.lead)),
          lead: s.lead,
          company,
          climb: s.climb,
          flet: s.mode === 'climb' || (s.mode === 'talk' && s.talking === 'caras'),
          pull: pull ? { k: Math.min(1, pull.t / MIRROR_PULL.length), pull: pull.pull, eye: eyeOn(pull), soon: eyeSoon(pull), holding: pull.holding } : null,
          vision: s.mode === 'mirror' || (s.mode === 'talk' && (s.talking === 'test' || (s.talking === 'mirror' && s.talk?.at === 'go'))),
          tempt: s.tempt,
          carrying: s.gifts?.carrying ?? null,
          given: s.gifts ? Object.keys(s.gifts.given) : [],
          giftsLeft: s.gifts ? s.gifts.left : p.next === 'gifts' ? GIFTS.map((g) => g.id) : [],
          boat: s.boat,
          stepT: s.stepT,
          markers,
          camYaw: s.yaw,
          camPitch: s.pitch,
          camDist: touch ? 7.2 : 6.4,
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

    const b = s.boat;
    const key = [s.zone, s.mode, s.near, s.moved, s.talking, s.talk?.at, Boolean(s.lead), s.lead?.waiting, s.mode === 'climb' ? Math.round(s.climb * 20) : '', pull ? Math.round(pull.pull * 30) : '', pull ? Math.round(pull.strength * 20) : '', pull ? eyeOn(pull) + eyeSoon(pull) * 2 : '', b ? Math.round(b.s / 4) : '', b?.hits, s.gifts?.carrying, s.gifts?.left.length, s.person, p.done.length].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ zone: s.zone, mode: s.mode, near: s.near, moved: s.moved, talking: s.talking, line: s.talk?.at ?? null, leading: Boolean(s.lead), climb: s.climb, pull: pull ? { pull: pull.pull, strength: pull.strength, eye: eyeOn(pull), soon: eyeSoon(pull) } : null, boat: b ? { s: b.s, hits: b.hits } : null, carrying: s.gifts?.carrying ?? null, left: s.gifts ? [...s.gifts.left] : GIFTS.map((g) => g.id), giveTo: s.gifts?.carrying && s.person ? (cast.find((c) => c.id === s.person && c.gift)?.name ?? null) : null });
    }
    if (s.person && bubbleRef.current) {
      const at = a.screenOf('cast', s.person);
      if (at) {
        bubbleRef.current.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
        bubbleRef.current.style.opacity = '1';
      } else bubbleRef.current.style.opacity = '0';
    }
    if (++s.frame % 120 === 0 && s.mode === 'walk' && s.zone === 'wood') local.set(AT, { x: s.h.x, z: s.h.z, face: s.h.face });
  }, live);

  // look round by dragging; the stick on touch
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
  // a button held down: steering, climbing, holding back
  const hold = (name, v) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      sim.current[name] = v;
      audioContext();
    },
    onPointerUp: () => (sim.current[name] = 0),
    onPointerCancel: () => (sim.current[name] = 0),
    onLostPointerCapture: () => (sim.current[name] = 0),
    onContextMenu: (e) => e.preventDefault(),
  });
  const travel = (q) => {
    const sp = SPOTS.find((x) => x.quest === q.id);
    const at = sp ? { x: sp.x - 2.5, z: sp.z, face: 0 } : START;
    if (q.id === 'mirror') Object.assign(at, { x: sp.x, z: sp.z - 3, face: -Math.PI / 2 });
    toWood(at);
    setList(false);
  };
  const stay = () => toWood({ x: LANDING.x - 4, z: LANDING.z, face: Math.PI });

  const here = hud.near ? PROMPT[hud.near] : null;
  const mode = hud.mode;
  const walking = mode === 'walk';
  const convo = hud.talking ? CONVOS[hud.talking] : null;
  const node = convo && hud.line ? convo.nodes[hud.line] : convo ? convo.nodes[convo.start] : null;
  const P = hud.pull;
  const B = hud.boat;
  const carrying = hud.carrying ? GIFTS.find((g) => g.id === hud.carrying) : null;
  return (
    <div ref={box} className="shire-stage lorien-stage" data-touch={touch || undefined} data-mode={mode} data-sky={hud.zone === 'river' ? 'day' : moodFor(prog.next)} data-game={['climb', 'mirror', 'river', 'table'].includes(mode) || undefined}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label="Lothlórien in 3D: the golden wood of the mallorns, Caras Galadhon and its lanterns, the Mirror of Galadriel, and the river down to the Argonath" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      {gl === 'loading' && <p className="shire-loading">Into the golden wood…</p>}

      {walking && (
        <div className="shire-hud shire-hud-top">
          <div className="shire-brand">
            <h1 id="lorien-title" className="shire-title">
              Lothlórien
            </h1>
            <p className="shire-objective" aria-live="polite">
              <span aria-hidden="true">✦</span> {hud.leading ? 'Follow Haldir through the wood.' : carrying ? `Carrying ${carrying.name}. Who is it for?` : prog.objective}
            </p>
          </div>
          <div className="shire-side">
            <button type="button" className="shire-chip" onClick={() => setList((v) => !v)} aria-expanded={list}>
              <b>{prog.done.length}</b> of {QUESTS.length} done {!touch && <kbd>M</kbd>}
            </button>
            <Travellers trav={trav} />
          </div>
        </div>
      )}
      {!walking && (
        <h1 id="lorien-title" className="sr-only">
          Lothlórien
        </h1>
      )}

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
      {!here && walking && hud.giveTo && carrying && (
        <div className="shire-door">
          <p className="shire-door-name">{hud.giveTo}</p>
          <button type="button" className="btn btn-primary" onClick={give}>
            Give {carrying.name.replace(/,.*$/, '')} {!touch && <kbd>E</kbd>}
          </button>
        </div>
      )}
      {gl === 'on' && walking && !hud.moved && !here && <p className="shire-hint">{touch ? 'Drag the stick to walk. Swipe the view to look round.' : 'W A S D or the arrows to walk, Shift to run. Drag to look round. E to do things, M for the list.'}</p>}

      {node && <Convo title="Lothlórien" name={SPEAKERS[node.who] ?? ''} node={node} touch={touch} onPick={(i) => talkOnward(i)} onNext={() => talkOnward()} />}

      {mode === 'climb' && (
        <div className="shire-panel lorien-game" role="group" aria-label="The stair">
          <p className="shire-panel-title">Up the great mallorn</p>
          <div className="shire-meter" role="meter" aria-label="How far up" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.climb * 100)}>
            <span className="shire-meter-label">The flet</span>
            <span className="shire-meter-bar lorien-meter-climb">
              <span style={{ transform: `scaleX(${hud.climb})` }} />
            </span>
          </div>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-primary btn-sm lorien-big" {...hold('up', 1)}>
                Climb
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">Hold W or the up arrow to climb.</p>
          )}
        </div>
      )}
      {mode === 'mirror' && P && (
        <div className="shire-panel lorien-game" role="group" aria-label="The Mirror" data-eye={P.eye || undefined} data-soon={P.soon || undefined}>
          <p className="shire-panel-title">{P.eye ? 'The Eye is looking for you!' : P.soon ? 'Something stirs in the water…' : 'The Mirror'}</p>
          <div className="shire-meter" role="meter" aria-label="The Ring’s pull" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(P.pull * 100)}>
            <span className="shire-meter-label">The pull</span>
            <span className="shire-meter-bar lorien-meter-pull">
              <span style={{ transform: `scaleX(${Math.min(1, P.pull)})` }} />
            </span>
          </div>
          <div className="shire-meter" role="meter" aria-label="Your strength" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(P.strength * 100)}>
            <span className="shire-meter-label">Strength</span>
            <span className="shire-meter-bar lorien-meter-strength">
              <span style={{ transform: `scaleX(${P.strength})` }} />
            </span>
          </div>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-primary btn-sm lorien-big" {...hold('hold', true)}>
              Hold back {!touch && <kbd>Space</kbd>}
            </button>
          </div>
        </div>
      )}
      {mode === 'table' && (
        <div className="shire-panel lorien-game" role="dialog" aria-label="The Lady’s gifts">
          <p className="shire-panel-title">The Lady’s gifts</p>
          <p className="shire-panel-say">Take one, and carry it to the one it’s for.</p>
          <div className="lorien-gifts">
            {GIFTS.filter((g) => hud.left.includes(g.id)).map((g, i) => (
              <button key={g.id} type="button" className="btn btn-ghost btn-sm" onClick={() => take(g.id)}>
                {!touch && <kbd>{i + 1}</kbd>} {g.name}
              </button>
            ))}
          </div>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => (sim.current.mode = 'walk')}>
              Leave them
            </button>
          </div>
        </div>
      )}
      {mode === 'river' && B && (
        <div className="shire-panel lorien-game" role="group" aria-label="Down the Anduin">
          <p className="shire-panel-title">Down the Anduin</p>
          <div className="shire-meter" role="meter" aria-label="Down the river" aria-valuemin={0} aria-valuemax={RIVER.len} aria-valuenow={Math.round(B.s)}>
            <span className="shire-meter-label">The river</span>
            <span className="shire-meter-bar lorien-meter-river">
              <span style={{ transform: `scaleX(${Math.min(1, B.s / RIVER.len)})` }} />
            </span>
          </div>
          <p className="shire-panel-stats">
            <span>
              Water shipped <b>{B.hits}</b> of {RIVER.hits}
            </span>
          </p>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Steer left" {...hold('steer', -1)}>
                ◀
              </button>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Steer right" {...hold('steer', 1)}>
                ▶
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">A and D to steer round the rocks; W to dig in.</p>
          )}
        </div>
      )}
      {mode === 'end' && (
        <div className="shire-panel lorien-end" role="dialog" aria-label="Past the Argonath">
          <p className="shire-panel-title">The Pillars of the Kings</p>
          <p className="shire-panel-say">Past the Argonath, the river widens into the long lake of Nen Hithoel, and the roar of the falls of Rauros comes up the water. Aragorn turns the boats to the western shore, under the hill of Amon Hen.</p>
          <div className="shire-panel-row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onLeave?.()}>
              On to Amon Hen
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={stay}>
              Stay in Lothlórien
            </button>
          </div>
        </div>
      )}
      {walking && touch && <Stick onStick={onStick} />}
      {list && <QuestList title="Things to do in Lothlórien" quests={prog.quests} next={prog.next} onClose={() => setList(false)} onGo={travel} canGo={(q) => q.open && !q.done && q.id !== 'haldir' && sim.current.mode === 'walk' && !sim.current.lead} />}
    </div>
  );
}

// Without 3D: the scenes, as cards.
function Cards({ prog, three, gl, retry }) {
  return (
    <div className="shell shire-cards-wrap">
      <h1 id="lorien-title" className="title">
        Lothlórien
      </h1>
      <p className="lead mt-4 max-w-[60ch]">The golden wood of Galadriel, from the Nimrodel to the Argonath, to walk through in 3D. {prog.objective}</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here’s Lothlórien as cards.' : gl === 'failed' ? 'The 3D Lothlórien couldn’t start here, so here it is as cards.' : three.held ? 'The 3D Lothlórien isn’t loaded yet, so here it is as cards.' : '3D is switched off, so here’s Lothlórien as cards.'}
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
