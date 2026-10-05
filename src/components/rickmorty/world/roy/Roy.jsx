import { useCallback, useEffect, useRef, useState } from 'react';
import { RiCloseLine, RiPauseLine } from 'react-icons/ri';
import '@fontsource/luckiest-guy/400.css';
import { useAchievements } from '../../../Achievements';
import { audioContext, output } from '../../../../lib/audio';
import { local, useFrameLoop, useMediaQuery, useReducedMotion } from '../../../../lib/hooks';
import { readPad, typing } from '../../../games/pad';
import { MORTY_BEST, OLD_AGE, STAGE_INFO, ageOf, beatMorty, epitaph, newLife, stageTitle, stepLife } from './rules';
import './roy.css';

// Roy: A Life Well Lived, the VR game at Blips and Chitz: a whole life in
// five stages, scored by the age Roy reaches, against Morty's 55. The rules
// are in ./rules.js and the drawing in ./scene.js; this is the headset: the
// intro, the HUD, the controls, the cards between the stages, the end card,
// and the best age kept in localStorage (tp-c137-roy, { best, lives }).
//
// <Roy onLeave={(age, life) => …} /> fills its parent (the world's overlay).
// onLeave gets the best age Roy reached this session (null if no life ended
// yet) and the last life that ended (or null).
//
// The rules step at a fixed 1/60 s, fed the presses made since the last
// step; the scene is handed the newest life with every step's events since
// the frame before.

const SAVE = 'tp-c137-roy';
const STEP = 1 / 60;
const HOLD_MS = 1500; // the end of a stage, played out before its card
const CARD_MS = 2400;
const WIPE_MS = 950;
const DYING_MS = { cancer: 2600, carpet: 2700, log: 2700, old: 3800 };

const KEYS = {
  left: ['ArrowLeft', 'a', 'A'],
  right: ['ArrowRight', 'd', 'D'],
  act: [' ', 'Enter', 'Spacebar'],
};
const HOW = {
  kid: 'Space to throw',
  football: '← → to dodge',
  carpet: '← → and Space to pick the roll they want',
  cancer: 'Space on the beat',
  finale: '← → to dodge',
};
const HOW_OFFGRID = { carpet: '← → and Space to fetch what’s needed' };
const HOW_TOUCH = { kid: 'Tap Throw as the tire swings through', carpet: '← → and Pick the roll they want', cancer: 'Tap Beat on the beat' };
const HOW_TOUCH_OFFGRID = { carpet: '← → and Pick what’s needed' };
const ACT_LABEL = { kid: 'Throw', carpet: 'Pick', cancer: 'Beat' };
const LINES = {
  kid: 'A boy at the window, dreaming of the NFL.',
  football: 'Friday night under the lights, and the end zone a long way off.',
  carpet: 'The dream goes on the shelf: a family to provide for, and a job at the carpet store.',
  offgrid: 'No job and no store: a cabin in the woods, and whatever the woods give.',
  cancer: '“I’m not ready to die.”',
  finale: 'Back at the store, where the rolls are stacked high.',
  woods: 'Back in the woods, where the logs are stacked high.',
};
const GOT = ['Caught a fish', 'Picked berries', 'Chopped wood'];
const CAUSE = { carpet: 'A roll of carpet came loose', log: 'A log came down', cancer: 'The diagnosis', old: 'All the way to 100' };

const sfx = () => import('../../../../lib/sfx');
const cue = () => import('../../../games/gameAudio');
const play = (name) => sfx().then((s) => s[name]?.(), () => {});
const playCue = (name) => cue().then((s) => s[name]?.(), () => {});
// a heart monitor's beep: a short sine through the site's volume
function beep(freq = 980, dur = 0.08, gain = 0.05) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.setValueAtTime(gain, t + Math.max(0.01, dur - 0.04));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}
const buzz = (ms) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no vibration */
  }
};

function readSave() {
  const s = local.get(SAVE, null);
  return { best: Math.max(0, Math.floor(Number(s?.best) || 0)), lives: Math.max(0, Math.floor(Number(s?.lives) || 0)) };
}

// what the HUD shows, from the life on screen
const hudOf = (l) => ({
  age: ageOf(l),
  stage: l.stage,
  route: l.route,
  grit: l.grit,
  title: stageTitle(l),
  throws: l.s.throws ?? 0,
  hits: l.s.hits ?? 0,
  served: l.s.served ?? 0,
  sales: l.stats.sales,
  beats: l.s.beats ?? 0,
  offbeats: l.s.offbeats ?? 0,
});

const agesOf = (stage) => {
  const i = STAGE_INFO[stage];
  if (stage === 'finale') return `Ages ${i.from} on`;
  return i.from === i.to ? `Age ${i.from}` : `Ages ${i.from} to ${i.to}`;
};
const cardFor = (l) => ({
  key: `${l.stage}-${l.route}-${Math.random()}`,
  ages: agesOf(l.stage),
  title: stageTitle(l),
  line: l.stage === 'carpet' && l.route === 'offgrid' ? LINES.offgrid : l.stage === 'finale' && l.route === 'offgrid' ? LINES.woods : LINES[l.stage],
});

export default function Roy({ onLeave }) {
  const { unlock } = useAchievements();
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const calm = useReducedMotion();
  const wrap = useRef(null);
  const api = useRef(null);
  const life = useRef(null); // the life the rules are playing
  const view = useRef(null); // the life on screen (with its events)
  const phaseRef = useRef('loading');
  const phaseT = useRef(0);
  const acc = useRef(0);
  const input = useRef({ left: false, right: false, act: false });
  const padPrev = useRef({});
  const holdNext = useRef(null);
  const resumeTo = useRef('play');
  const auto = useRef(true); // the DEV hook can stop the clock to step by hand
  const saved = useRef(readSave());
  const session = useRef({ best: null, last: null });
  const said = useRef({ grit: 0, morty: false });
  const fast = useRef({}); // the HUD parts the loop writes straight to
  const hudKey = useRef('');
  const [phase, setPhaseState] = useState('loading'); // loading | intro | wipe | card | choose | play | hold | dying | end | paused | failed
  const [hud, setHud] = useState(() => hudOf(newLife()));
  const [card, setCard] = useState(null);
  const [callout, setCallout] = useState(null);
  const [result, setResult] = useState(null);
  const [failed, setFailed] = useState(null);
  const [best, setBest] = useState(saved.current.best);

  const setPhase = useCallback((p) => {
    phaseRef.current = p;
    phaseT.current = 0;
    setPhaseState(p);
  }, []);
  const say = useCallback((text, tone = 'good') => setCallout({ text, tone, key: Math.random() }), []);
  const fail = useCallback(
    (why) => {
      setFailed(why);
      setPhase('failed');
    },
    [setPhase],
  );

  // ── the renderer: a canvas of its own per mount ──
  useEffect(() => {
    let dead = false;
    let made = null;
    const el = wrap.current;
    const c = document.createElement('canvas');
    c.className = 'roy-canvas';
    el.prepend(c);
    import('./scene')
      .then(({ createRoyScene }) => createRoyScene(c, { onLost: () => !dead && fail('lost') }))
      .then((r) => {
        made = r;
        if (dead) {
          r.dispose();
          return;
        }
        api.current = r;
        r.resize(el.clientWidth, el.clientHeight);
        const l = newLife({ seed: 1 });
        life.current = l;
        view.current = l;
        setPhase('intro');
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.error(err);
        if (!dead) fail('failed');
      });
    return () => {
      dead = true;
      made?.dispose();
      api.current = null;
      c.remove();
    };
  }, [fail, setPhase]);

  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => api.current?.resize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── what a frame's steps did: sounds and callouts ──
  const react = (evs, l) => {
    let pulse = false;
    for (const e of evs) {
      switch (e) {
        case 'throw':
          playCue('portalHop');
          break;
        case 'hit':
          play('ding');
          say('Through the tire');
          break;
        case 'miss':
          play('thunk');
          say('Missed', 'meh');
          break;
        case 'tackle':
          play('hit');
          buzz(90);
          say('Tackled', 'bad');
          break;
        case 'touchdown':
          play('applause');
          playCue('gadget');
          say('Touchdown', 'big');
          break;
        case 'sale':
          play('coin');
          say(l.route === 'offgrid' ? GOT[l.s.pointer ?? 1] : 'Sold');
          break;
        case 'lost':
          playCue('powerDown');
          say(l.route === 'offgrid' ? 'Went without' : 'They walked out', 'bad');
          break;
        case 'pulse':
          pulse = true;
          break;
        case 'beat':
          playCue('seed');
          break;
        case 'offbeat':
          play('buzz');
          buzz(60);
          say('Off the beat', 'bad');
          break;
        case 'dodge':
          playCue('nearMiss');
          break;
        case 'shrug':
          play('knock');
          playCue('gadget');
          buzz(80);
          say('Shrugged it off', 'big');
          break;
        case 'death':
          if (l.cause === 'cancer') beep(980, 1.8, 0.05);
          else if (l.cause === 'old') play('ring');
          else {
            setTimeout(() => {
              play('crumble');
              playCue('splat');
              buzz(200);
            }, l.cause === 'carpet' ? 300 : 550);
          }
          break;
        default:
      }
    }
    if (pulse) beep(980, 0.07, 0.045);
    // grit earned at the end of a stage; Morty's 55 passed
    if (l.stage !== 'finale' && l.grit > said.current.grit) say('+1 grit', 'big');
    said.current.grit = l.grit;
    if (l.stage === 'finale' && ageOf(l) > MORTY_BEST && !said.current.morty && !l.over) {
      said.current.morty = true;
      say(`Past Morty’s ${MORTY_BEST}`, 'big');
      play('oneUp');
    }
  };

  // ── moving the life on ──
  const startHold = (prev, next, evs) => {
    holdNext.current = next;
    // the screen keeps the stage that just ended a moment longer, as it ended
    const s = { ...prev.s };
    if (prev.stage === 'kid') {
      s.throws += 1;
      s.hits = next.stats.dream;
    } else if (prev.stage === 'carpet') {
      s.customer = null;
      s.served += 1;
    } else if (prev.stage === 'cancer') s.beats += 1;
    view.current = { ...prev, age: next.age, grit: next.grit, stats: next.stats, s, events: evs.filter((e) => e !== 'stage') };
    setPhase('hold');
  };
  const startDying = (next, evs) => {
    view.current = { ...next, events: evs };
    setPhase('dying');
  };
  // one step of the rules; false when it ended a stage or the life
  const advance = (inp, evs) => {
    const prev = life.current;
    const next = stepLife(prev, inp, STEP);
    life.current = next;
    evs.push(...next.events);
    if (prev.stage === 'cancer' && next.stage === 'cancer' && next.s.elapsed > prev.s.elapsed && !next.over) evs.push('pulse');
    if (next.events.includes('stage')) {
      startHold(prev, next, evs);
      return false;
    }
    if (next.over) {
      startDying(next, evs);
      return false;
    }
    return true;
  };
  const take = () => {
    const i = input.current;
    input.current = { left: false, right: false, act: false };
    return i;
  };
  const toPlay = () => {
    acc.current = 0;
    take();
    setPhase('play');
  };
  const toCard = (l) => {
    life.current = l;
    view.current = { ...l, events: [] };
    playCue('gadget');
    if (l.stage === 'carpet' && l.s.choice) {
      setPhase('choose');
      return;
    }
    setCard(cardFor(l));
    setPhase('card');
  };
  const choose = (route) => {
    if (phaseRef.current !== 'choose') return;
    audioContext();
    const next = stepLife(life.current, { choose: route }, STEP);
    toCard(next);
  };
  const start = () => {
    audioContext();
    const l = newLife({ seed: (Date.now() & 0xffffff) || 1, offerChoice: saved.current.lives >= 1 });
    life.current = l;
    view.current = l;
    said.current = { grit: 0, morty: false };
    setResult(null);
    setCallout(null);
    take();
    if (calm) toCard(l);
    else {
      setPhase('wipe');
      playCue('boost');
    }
  };
  const finish = () => {
    const l = life.current;
    const age = l.endAge ?? ageOf(l);
    const prevBest = saved.current.best;
    const nextBest = Math.max(prevBest, age);
    saved.current = { best: nextBest, lives: saved.current.lives + 1 };
    local.set(SAVE, saved.current);
    setBest(nextBest);
    session.current = { best: Math.max(session.current.best ?? 0, age), last: l };
    unlock('roy');
    if (beatMorty(l)) unlock('royfiftyfive');
    if (l.route === 'offgrid') unlock('offthegrid');
    const text = epitaph(l);
    setResult({ age, title: `Roy, 0–${age}`, body: text.replace(/^Roy, 0–\d+\.\s*/, ''), best: nextBest, prevBest, isBest: age > prevBest, beat: beatMorty(l), cause: l.cause });
    setPhase('end');
    if (age > prevBest && prevBest > 0) play('victory');
  };
  const leave = () => onLeave?.(session.current.best, session.current.last);
  const pause = (on) => {
    const p = phaseRef.current;
    if (on && ['play', 'hold', 'card', 'choose'].includes(p)) {
      resumeTo.current = p;
      take();
      setPhase('paused');
    } else if (!on && p === 'paused') {
      audioContext();
      acc.current = 0;
      setPhase(resumeTo.current);
    }
  };

  // the gamepad: the d-pad or left stick, A to act, Start to pause
  const pollPad = () => {
    const pad = readPad();
    if (!pad) {
      padPrev.current = {};
      return;
    }
    const now = { left: pad.left || pad.lx < -0.55, right: pad.right || pad.lx > 0.55, a: pad.a, b: pad.b, start: pad.start };
    const was = padPrev.current;
    padPrev.current = now;
    const edge = (k) => now[k] && !was[k];
    const p = phaseRef.current;
    if (edge('start')) pause(p !== 'paused');
    if (p === 'play') {
      if (edge('left')) input.current.left = true;
      if (edge('right')) input.current.right = true;
      if (edge('a')) input.current.act = true;
    } else if (p === 'card' && edge('a') && phaseT.current > 500) toPlay();
    else if ((p === 'intro' || p === 'end') && edge('a')) start();
    else if ((p === 'intro' || p === 'end') && edge('b')) leave();
    else if (p === 'paused' && edge('a')) pause(false);
    else if (p === 'choose') {
      const all = [...(wrap.current?.querySelectorAll('.roy-choose') ?? [])];
      const on = all.includes(document.activeElement) ? document.activeElement : all[0];
      if (edge('left')) all[0]?.focus();
      else if (edge('right')) all[all.length - 1]?.focus();
      else if (edge('a')) on?.click();
    }
  };

  // the HUD's moving parts, straight into the DOM; the rest through state when it changes
  const sync = (l) => {
    if (!l) return;
    const h = hudOf(l);
    const key = `${h.age}|${h.stage}|${h.route}|${h.grit}|${h.throws}|${h.hits}|${h.served}|${h.sales}|${h.beats}|${h.offbeats}`;
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud(h);
    }
    const f = fast.current;
    if (l.stage === 'kid' && f.marker) {
      f.marker.style.left = `${((l.s.phase + 1) / 2) * 100}%`;
      f.meter.dataset.hot = Math.abs(l.s.phase) < 0.28 ? '1' : '';
    }
    if (l.stage === 'football') {
      if (f.yards) f.yards.style.transform = `scaleX(${Math.min(1, l.s.dist / 100).toFixed(3)})`;
      if (f.clock) f.clock.textContent = `0:${String(Math.ceil(Math.max(0, 16 - (l.s.time ?? 0)))).padStart(2, '0')}`;
    }
  };

  // ── the loop ──
  const tick = (ms) => {
    const a = api.current;
    if (!a) return;
    phaseT.current += ms;
    pollPad();
    const p = phaseRef.current;
    if (p === 'play' && auto.current) {
      acc.current = Math.min(acc.current + ms / 1000, 0.25);
      const evs = [];
      let n = 0;
      while (acc.current >= STEP && phaseRef.current === 'play') {
        const inp = n === 0 ? take() : {};
        acc.current -= STEP;
        n += 1;
        if (!advance(inp, evs)) break;
      }
      if (n && phaseRef.current === 'play') view.current = { ...life.current, events: evs };
      if (evs.length) react(evs, view.current);
    } else if (p === 'hold' && phaseT.current > HOLD_MS) toCard(holdNext.current);
    else if (p === 'card' && phaseT.current > CARD_MS) toPlay();
    else if (p === 'wipe' && phaseT.current > WIPE_MS) toCard(life.current);
    else if (p === 'dying' && phaseT.current > (DYING_MS[life.current.cause] ?? 2600)) finish();
    if (p !== 'paused') {
      try {
        a.render(view.current, ms);
      } catch (err) {
        if (import.meta.env.DEV) console.error(err);
        fail('failed');
        return;
      }
    }
    sync(view.current);
  };
  useFrameLoop(tick, phase !== 'loading' && phase !== 'failed');

  // the latest handlers, for listeners bound once
  const fns = useRef({});
  fns.current = { start, leave, pause, choose, toPlay, advance, react, setPhase };

  // ── keys, anywhere while the headset's on ──
  useEffect(() => {
    const down = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const F = fns.current;
      const p = phaseRef.current;
      const k = e.key;
      if (p === 'loading') return;
      if (k === 'Escape') {
        e.preventDefault();
        F.leave();
        return;
      }
      const isL = KEYS.left.includes(k);
      const isR = KEYS.right.includes(k);
      const isAct = KEYS.act.includes(k);
      const onButton = e.target instanceof HTMLButtonElement && e.target.dataset.roy == null;
      if (p === 'play') {
        if (k === 'p' || k === 'P') {
          F.pause(true);
          return;
        }
        if (!isL && !isR && !isAct) return;
        e.preventDefault();
        if (e.repeat) return;
        if (isL) input.current.left = true;
        if (isR) input.current.right = true;
        if (isAct) input.current.act = true;
        return;
      }
      if (p === 'card') {
        if (isL || isR || isAct) e.preventDefault();
        if (isAct && !e.repeat && phaseT.current > 500) F.toPlay();
        return;
      }
      if (p === 'hold' || p === 'dying' || p === 'wipe') {
        if (isL || isR || isAct) e.preventDefault();
        return;
      }
      if (p === 'choose') {
        if (k === '1') F.choose('job');
        else if (k === '2') F.choose('offgrid');
        else if (isL || isR) {
          e.preventDefault();
          const all = [...(wrap.current?.querySelectorAll('.roy-choose') ?? [])];
          all[isL ? 0 : all.length - 1]?.focus();
        }
        return;
      }
      if (p === 'paused') {
        if ((isAct && !onButton) || k === 'p' || k === 'P') {
          e.preventDefault();
          F.pause(false);
        }
        return;
      }
      if ((p === 'intro' || p === 'end') && isAct && !onButton && !e.repeat) {
        e.preventDefault();
        F.start();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  // the tab hidden: stop, and wait to be told to carry on
  useEffect(() => {
    const vis = () => document.hidden && fns.current.pause(true);
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);

  // for the browser tests: drive the game by hand
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__ROY__ = {
      get life() {
        return life.current;
      },
      get view() {
        return view.current;
      },
      get phase() {
        return phaseRef.current;
      },
      get api() {
        return api.current;
      },
      get auto() {
        return auto.current;
      },
      set auto(on) {
        auto.current = Boolean(on);
      },
      setLife(l) {
        life.current = l;
        view.current = { ...l, events: [] };
        acc.current = 0;
        fns.current.setPhase('play');
      },
      step(inp = {}) {
        const evs = [];
        if (phaseRef.current !== 'play') fns.current.setPhase('play');
        fns.current.advance(inp, evs);
        if (phaseRef.current === 'play') view.current = { ...life.current, events: evs };
        fns.current.react(evs, view.current);
        return life.current;
      },
      setPhase: (p) => fns.current.setPhase(p),
      start: () => fns.current.start(),
      choose: (r) => fns.current.choose(r),
    };
    return () => {
      delete window.__ROY__;
    };
  }, []);

  // on-screen buttons for a touch screen
  const press = (k) => (e) => {
    e.preventDefault();
    const p = phaseRef.current;
    audioContext();
    if (p === 'play') input.current[k] = true;
    else if (p === 'card' && phaseT.current > 500) toPlay();
  };

  const inGame = ['card', 'choose', 'play', 'hold', 'dying', 'paused'].includes(phase);
  const offgrid = hud.route === 'offgrid';
  const how = (touch ? (offgrid && HOW_TOUCH_OFFGRID[hud.stage]) || HOW_TOUCH[hud.stage] : null) || (offgrid && HOW_OFFGRID[hud.stage]) || HOW[hud.stage];
  const actLabel = ACT_LABEL[hud.stage] ?? null;
  const r = result;

  return (
    <div ref={wrap} className="roy" data-phase={phase} data-stage={hud.stage} role="application" aria-label="Roy: A Life Well Lived. Arrows or A and D move, Space or Enter acts, Escape takes the headset off.">
      <div className="roy-lens" aria-hidden="true" />

      {inGame && (
        <div className="roy-hud">
          <div className="roy-age">
            <span className="roy-age-label">Roy, aged</span>
            <span key={hud.age} className="roy-age-n">
              {hud.age}
            </span>
            <div className="roy-life" role="img" aria-label={`Age ${hud.age} of ${OLD_AGE}. Morty made it to ${MORTY_BEST}${best ? `, your best is ${best}` : ''}.`}>
              <i className="roy-life-fill" style={{ '--k': Math.min(1, hud.age / OLD_AGE) }} />
              <b className="roy-mark" data-kind="morty" style={{ '--k': MORTY_BEST / OLD_AGE }}>
                <span>Morty {MORTY_BEST}</span>
              </b>
              {best > 0 && best !== MORTY_BEST && (
                <b className="roy-mark" data-kind="best" style={{ '--k': Math.min(1, best / OLD_AGE) }}>
                  <span>Best {best}</span>
                </b>
              )}
            </div>
          </div>

          <div className="roy-stage">
            <p className="roy-title">{hud.title}</p>
            <p className="roy-how">{how}</p>
          </div>

          <div className="roy-side">
            <div className="roy-tools">
              <button type="button" className="roy-tool" data-roy onClick={() => pause(phase !== 'paused')} aria-label={phase === 'paused' ? 'Carry on' : 'Pause'} title="Pause (P)">
                <RiPauseLine aria-hidden="true" />
              </button>
              <button type="button" className="roy-tool" data-roy onClick={leave} aria-label="Take the headset off" title="Take the headset off (Esc)">
                <RiCloseLine aria-hidden="true" />
              </button>
            </div>
            <div className="roy-grit" aria-label={`${hud.grit} grit`} title="Grit: each point shrugs off one thing that would finish Roy">
              <span>Grit</span>
              {[0, 1, 2].map((i) => (
                <i key={i} data-on={i < hud.grit || undefined} />
              ))}
            </div>
            {hud.stage === 'kid' && (
              <div className="roy-meter">
                <div className="roy-balls" aria-label={`${hud.hits} through the tire, ${hud.throws} of 5 thrown`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <i key={i} data-state={i < hud.hits ? 'hit' : i < hud.throws ? 'miss' : 'left'} />
                  ))}
                </div>
                <div className="roy-timing" ref={(n) => (fast.current.meter = n)} aria-hidden="true">
                  <span className="roy-timing-band" />
                  <span className="roy-timing-dot" ref={(n) => (fast.current.marker = n)} />
                </div>
              </div>
            )}
            {hud.stage === 'football' && (
              <div className="roy-meter">
                <div className="roy-meter-row">
                  <span>End zone</span>
                  <b ref={(n) => (fast.current.clock = n)}>0:16</b>
                </div>
                <div className="roy-bar">
                  <i ref={(n) => (fast.current.yards = n)} />
                </div>
              </div>
            )}
            {hud.stage === 'carpet' && (
              <div className="roy-meter">
                <div className="roy-meter-row">
                  <span>{offgrid ? 'Got' : 'Sold'}</span>
                  <b>{hud.sales}</b>
                </div>
                <div className="roy-slots" aria-label={`${hud.sales} ${offgrid ? 'got' : 'sold'}, ${hud.served - hud.sales} lost, ${8 - hud.served} to go`}>
                  {Array.from({ length: 8 }, (_, i) => (
                    <i key={i} data-state={i < hud.sales ? 'hit' : i < hud.served ? 'miss' : 'left'} />
                  ))}
                </div>
              </div>
            )}
            {hud.stage === 'cancer' && (
              <div className="roy-meter">
                <div className="roy-meter-row">
                  <span>On the beat</span>
                  <b>{hud.beats} of 12</b>
                </div>
                <div className="roy-meter-row roy-strikes" aria-label={`${hud.offbeats} of 6 off the beat`}>
                  <span>Off</span>
                  <span className="roy-x">
                    {Array.from({ length: 6 }, (_, i) => (
                      <i key={i} data-on={i < hud.offbeats || undefined} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            {hud.stage === 'finale' && (
              <div className="roy-meter">
                <div className="roy-meter-row">
                  {hud.age > MORTY_BEST ? (
                    <span className="roy-past">Past Morty’s {MORTY_BEST}</span>
                  ) : (
                    <>
                      <span>To beat Morty</span>
                      <b>{MORTY_BEST + 1 - hud.age}</b>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {callout && inGame && (
        <p key={callout.key} className="roy-callout" data-tone={callout.tone} onAnimationEnd={() => setCallout(null)}>
          {callout.text}
        </p>
      )}

      {touch && (phase === 'play' || phase === 'card') && (
        <div className="roy-touch">
          <button type="button" data-roy className="roy-pad" onPointerDown={press('left')} disabled={!['football', 'carpet', 'finale'].includes(hud.stage)} aria-label="Left">
            ←
          </button>
          <button type="button" data-roy className="roy-pad roy-pad-act" onPointerDown={press('act')} disabled={!actLabel && phase === 'play'} aria-label={actLabel ?? 'Act'}>
            {actLabel ?? '·'}
          </button>
          <button type="button" data-roy className="roy-pad" onPointerDown={press('right')} disabled={!['football', 'carpet', 'finale'].includes(hud.stage)} aria-label="Right">
            →
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <div className="roy-overlay roy-loading">
          <p>Starting the headset…</p>
          <span className="roy-loading-bar" />
        </div>
      )}

      {phase === 'intro' && (
        <div className="roy-overlay">
          <div className="roy-card roy-intro">
            <p className="roy-kicker">Blips and Chitz · VR</p>
            <h2 className="roy-logo">Roy: A Life Well Lived</h2>
            <p className="roy-sub">Live a whole life as Roy, from a boy at the window to the end: Friday nights, a job, a diagnosis, and work after that. You score the age he gets to.</p>
            <p className="roy-sub">Doing well early earns him grit, and each point of grit shrugs off one thing that would otherwise finish him.</p>
            <p className="roy-vs">
              <span>
                Morty made it to <b>{MORTY_BEST}</b>.
              </span>
              {best > 0 && (
                <span>
                  Your best: <b>{best}</b>
                </span>
              )}
            </p>
            <div className="roy-actions">
              <button type="button" className="roy-btn roy-btn-go" onClick={start} autoFocus>
                Put the headset on
              </button>
              <button type="button" className="roy-btn roy-btn-ghost" onClick={leave}>
                Back to the arcade
              </button>
            </div>
            <p className="roy-keys">
              <kbd>←</kbd>
              <kbd>→</kbd> or <kbd>A</kbd>
              <kbd>D</kbd> move · <kbd>Space</kbd> or <kbd>Enter</kbd> act · <kbd>Esc</kbd> takes the headset off
            </p>
          </div>
        </div>
      )}

      {phase === 'wipe' && !calm && <div className="roy-wipe" aria-hidden="true" />}

      {phase === 'card' && card && (
        <div className="roy-overlay roy-overlay-card" onPointerDown={() => phaseT.current > 500 && toPlay()}>
          <div key={card.key} className="roy-stagecard" data-calm={calm || undefined}>
            <p className="roy-stagecard-ages">{card.ages}</p>
            <p className="roy-stagecard-title">{card.title}</p>
            <p className="roy-stagecard-line">{card.line}</p>
            <p className="roy-stagecard-how">{how}</p>
          </div>
        </div>
      )}

      {phase === 'choose' && (
        <div className="roy-overlay">
          <div className="roy-card roy-choice">
            <p className="roy-kicker">Roy is 19</p>
            <h2 className="roy-logo roy-logo-small">What now?</h2>
            <div className="roy-choices">
              <button type="button" className="roy-choose" onClick={() => choose('job')} autoFocus>
                <kbd>1</kbd>
                <strong>Take the job at the carpet store</strong>
                <span>A family to provide for. The dream goes on the shelf.</span>
              </button>
              <button type="button" className="roy-choose" data-route="offgrid" onClick={() => choose('offgrid')}>
                <kbd>2</kbd>
                <strong>Go off the grid</strong>
                <span>A cabin in the woods, a long way from any carpet.</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'paused' && (
        <div className="roy-overlay">
          <div className="roy-card roy-paused">
            <h2 className="roy-logo roy-logo-small">Paused</h2>
            <div className="roy-actions">
              <button type="button" className="roy-btn roy-btn-go" onClick={() => pause(false)} autoFocus>
                Carry on
              </button>
              <button type="button" className="roy-btn roy-btn-ghost" onClick={leave}>
                Take the headset off
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'end' && r && (
        <div className="roy-overlay roy-overlay-end">
          <div className="roy-card roy-end">
            <p className="roy-kicker">{CAUSE[r.cause] ?? 'The end'}</p>
            <h2 className="roy-tomb">{r.title}</h2>
            <p className="roy-epitaph">{r.body}</p>
            <div className="roy-board" role="img" aria-label={`Roy ${r.age}, Morty ${MORTY_BEST}, your best ${r.best}`}>
              <div className="roy-row" data-kind="you">
                <span>Roy</span>
                <i style={{ '--k': r.age / OLD_AGE }} />
                <b>{r.age}</b>
              </div>
              <div className="roy-row" data-kind="morty">
                <span>Morty</span>
                <i style={{ '--k': MORTY_BEST / OLD_AGE }} />
                <b>{MORTY_BEST}</b>
              </div>
              <div className="roy-row" data-kind="best">
                <span>Your best</span>
                <i style={{ '--k': r.best / OLD_AGE }} />
                <b>{r.best}</b>
              </div>
            </div>
            <p className="roy-verdict">
              Morty made it to {MORTY_BEST}.{' '}
              {r.age > MORTY_BEST ? `Roy outlived him by ${r.age - MORTY_BEST} ${r.age - MORTY_BEST === 1 ? 'year' : 'years'}.` : r.age === MORTY_BEST ? 'Roy matched him.' : `Roy fell ${MORTY_BEST - r.age} years short.`}
            </p>
            {r.isBest && <p className="roy-newbest">{r.prevBest > 0 ? `New best, up from ${r.prevBest}` : 'Your first life, and your best so far'}</p>}
            <div className="roy-actions">
              <button type="button" className="roy-btn roy-btn-go" onClick={start} autoFocus>
                Live again
              </button>
              <button type="button" className="roy-btn roy-btn-ghost" onClick={leave}>
                Take the headset off
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'failed' && (
        <div className="roy-overlay">
          <div className="roy-card">
            <h2 className="roy-logo roy-logo-small">Roy: A Life Well Lived</h2>
            <p className="roy-sub">
              {failed === 'lost' ? 'The headset lost its picture: the graphics chip went away mid-life.' : 'The headset needs WebGL, the 3D graphics this game is drawn with, and this browser isn’t giving the page any.'}
            </p>
            <div className="roy-actions">
              <button type="button" className="roy-btn roy-btn-ghost" onClick={leave} autoFocus>
                Take the headset off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
