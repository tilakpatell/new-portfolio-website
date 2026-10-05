// The visitor's own flying settings for the universe map, kept between
// visits: how quickly the ship turns and pitches, how far a drag goes for
// full stick, how much the guns help a shot onto the lead, how tightly the
// camera follows, whether up and down are the other way round (as in a
// flight sim, push forward to dive), and what dragging up and down does
// (tips the nose with a mouse and works the throttle on a touch screen, as
// it comes). Pure, so it's tested in Node; FlightSettings.jsx shows them and
// scene.js reads them each frame.

export const CONTROLS_KEY = 'tp-universe-controls';
export const STICK = 70; // px of drag for full stick, as it comes

// the sliders: their range and step, and what they're called
export const CONTROLS = {
  turn: { min: 0.5, max: 2, step: 0.05, label: 'Steering', hint: 'How fast it turns' },
  pitch: { min: 0.5, max: 2, step: 0.05, label: 'Climb and dive', hint: 'How fast the nose tips up and down' },
  drag: { min: 0.4, max: 2.5, step: 0.05, label: 'Drag sensitivity', hint: 'Mouse and touch: less drag for full stick' },
  assist: { min: 0, max: 1.6, step: 0.1, label: 'Aim assist', hint: 'How far shots bend onto the lead' },
  camera: { min: 0.5, max: 2, step: 0.05, label: 'Camera follow', hint: 'How tightly it swings round behind' },
};
export const DRAG_UP = ['auto', 'pitch', 'speed'];
export const DEFAULTS = { turn: 1, pitch: 1, drag: 1, assist: 1, camera: 1, invert: false, dragUp: 'auto' };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Whatever was kept (or nothing), as settings that can be used: numbers
// held inside their sliders, anything unreadable back as it comes.
export function readControls(raw) {
  const c = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return c;
  for (const [k, r] of Object.entries(CONTROLS)) if (typeof raw[k] === 'number' && Number.isFinite(raw[k])) c[k] = clamp(raw[k], r.min, r.max);
  if (typeof raw.invert === 'boolean') c.invert = raw.invert;
  if (DRAG_UP.includes(raw.dragUp)) c.dragUp = raw.dragUp;
  return c;
}

// A drag as a stick: (dx, dy) px from where the press began, and the kind
// of pointer. Side to side turns; up and down tips the nose (a mouse) or
// works the throttle (a touch screen), unless the settings say which.
export function stickInput(dx, dy, c, pointer) {
  const full = STICK / (c.drag || 1);
  const turn = clamp(dx / full, -1, 1);
  const up = clamp(-dy / full, -1, 1);
  const pitch = c.dragUp === 'pitch' || (c.dragUp !== 'speed' && pointer === 'mouse');
  if (pitch) return { turn, throttle: 0, climb: up * (c.invert ? -1 : 1) };
  return { turn, throttle: up, climb: 0 };
}

// Up and down from the keys: R and C say climb and dive whatever the
// setting; the arrows are a stick's, turned over when inverted.
export function keyClimb(keys, c) {
  const say = (keys.climb ? 1 : 0) - (keys.dive ? 1 : 0);
  const arrows = ((keys.pitchUp ? 1 : 0) - (keys.pitchDown ? 1 : 0)) * (c.invert ? -1 : 1);
  return clamp(say + arrows, -1, 1);
}
