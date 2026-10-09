// The visitor's own flying settings for the universe map, kept between
// visits: how quickly the ship turns, pitches and rolls, how quickly it
// rolls itself back upright when let go (or not at all), how far a drag goes
// for full stick, how much the guns help a shot onto the lead, how much the
// nose follows a lock, how tightly the camera follows, whether up and down are the other way round (as in a
// flight sim, push forward to dive), what A and D do (roll, as in
// Battlefront, or turn) and what dragging up and down does (tips the nose
// with a mouse and works the throttle on a touch screen, as it comes). Pure,
// so it's tested in Node; FlightSettings.jsx shows them and scene.js reads
// them each frame.

import { DEFAULT as DEFAULT_DIFFICULTY, LEVELS } from './difficulty';

export const CONTROLS_KEY = 'tp-universe-controls';
export const STICK = 70; // px of drag for full stick, as it comes
// of the stick's length, each way: a hand resting on the screen or a mouse
// that wobbles as it's pressed flies straight (the touch stick's own dead zone)
export const DEAD = 0.1;

// the sliders: their range and step, and what they're called
export const CONTROLS = {
  turn: { min: 0.5, max: 2, step: 0.05, label: 'Steering', hint: 'How fast the nose swings left and right' },
  pitch: { min: 0.5, max: 2, step: 0.05, label: 'Pitch', hint: 'How fast the nose comes up and over' },
  roll: { min: 0.5, max: 2, step: 0.05, label: 'Roll', hint: 'How fast it rolls over' },
  level: { min: 0, max: 2, step: 0.1, label: 'Self-levelling', hint: 'How quickly it rolls back upright when you let go' },
  drag: { min: 0.4, max: 2.5, step: 0.05, label: 'Drag sensitivity', hint: 'Mouse and touch: less drag for full stick' },
  assist: { min: 0, max: 1.6, step: 0.1, label: 'Aim assist', hint: 'How far shots bend onto the lead' },
  track: { min: 0, max: 1.6, step: 0.1, label: 'Lock tracking', hint: 'How much the nose follows a locked target' },
  camera: { min: 0.5, max: 2, step: 0.05, label: 'Camera follow', hint: 'How tightly it swings round behind' },
};
export const DRAG_UP = ['auto', 'pitch', 'speed'];
export const AD = ['roll', 'turn'];
// how hard the fight is (difficulty.js): the hunters' skill, how hard they hit, and the law's search
export const DIFFICULTIES = LEVELS;
export const DEFAULTS = { turn: 1, pitch: 1, roll: 1, level: 1, drag: 1, assist: 1, track: 1, camera: 1, invert: false, dragUp: 'auto', ad: 'roll', difficulty: DEFAULT_DIFFICULTY };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// inside the dead zone nothing; past it rescaled, so the stick's length is still full
const dead = (v) => (Math.abs(v) <= DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

// Whatever was kept (or nothing), as settings that can be used: numbers
// held inside their sliders, anything unreadable back as it comes.
export function readControls(raw) {
  const c = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return c;
  for (const [k, r] of Object.entries(CONTROLS)) if (typeof raw[k] === 'number' && Number.isFinite(raw[k])) c[k] = clamp(raw[k], r.min, r.max);
  if (typeof raw.invert === 'boolean') c.invert = raw.invert;
  if (DRAG_UP.includes(raw.dragUp)) c.dragUp = raw.dragUp;
  if (AD.includes(raw.ad)) c.ad = raw.ad;
  if (LEVELS.includes(raw.difficulty)) c.difficulty = raw.difficulty;
  return c;
}

// Whether a drag on the map is a stick at all: on a phone or a tablet it's
// the only one; where a mouse or a trackpad comes first (a laptop, a
// desktop) the keys fly the ship, and a brush of the trackpad, a stray touch
// of the screen or a drag meant for the galaxy map shouldn't grab it.
// `fine`: the device's main pointer is a precise one (CSS `pointer: fine`).
export const dragSteers = ({ fine = globalThis.matchMedia?.('(pointer: fine)').matches ?? false } = {}) => !fine;

// A drag as a stick: (dx, dy) px from where the press began, and the kind
// of pointer. Side to side swings the nose; up and down tips it (a mouse)
// or works the throttle (a touch screen), unless the settings say which.
export function stickInput(dx, dy, c, pointer) {
  const full = STICK / (c.drag || 1);
  const turn = dead(clamp(dx / full, -1, 1));
  const up = dead(clamp(-dy / full, -1, 1));
  const pitch = c.dragUp === 'pitch' || (c.dragUp !== 'speed' && pointer === 'mouse');
  if (pitch) return { turn, throttle: 0, climb: up * (c.invert ? -1 : 1), roll: 0 };
  return { turn, throttle: up, climb: 0, roll: 0 };
}

// The keys as a stick, Battlefront's way: W and S the throttle, A and D the
// roll (or the turn, if the settings say), and the arrows the nose: left
// and right, and up and down (turned over when inverted).
export function keyAxes(keys, c) {
  const on = (k) => (keys[k] ? 1 : 0);
  const ad = on('d') - on('a');
  const roll = c.ad === 'turn' ? 0 : ad;
  return {
    throttle: on('up') - on('down'),
    turn: clamp(on('right') - on('left') + (c.ad === 'turn' ? ad : 0), -1, 1),
    climb: (on('pitchUp') - on('pitchDown')) * (c.invert ? -1 : 1),
    roll,
  };
}

// Whether a key pressed with `el` focused is the ship's to fly with, or the
// element's own: typing goes to a text box, a list or anything editable;
// a checkbox (the settings' switches) keeps Space and Enter, but the arrows
// fly on (they do nothing on a checkbox, and with the invert switch focused
// the ship had stopped steering); a button's keys are the scene's to sort
// out (Enter is the button's; the arrows and Space fly)
export function keyFlies(el, key) {
  const tag = el?.tagName;
  if (!tag) return true;
  if (el.isContentEditable) return false;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return false;
  if (tag === 'INPUT') return el.type === 'checkbox' && /^arrow/.test(key);
  return true;
}
