// What every brain shares: the numbers a meeting is flown by, and a few
// plain vector sums on { x, y, z }. Pure, so the brains and npcRules.js
// (which runs them) are tested in Node.

export const NPC = {
  seen: 40, // map units: inside this, the first time, it says it's seen you
  park: 3, // past a station's surface, where a merchant parks
  station: 120, // and the furthest a station may be for it to fly there (further, it parks where it is)
  offer: 15, // a parked merchant offers you a part when you're this near
  done: 60, // and leaves once you've gone this far off again
  wary: 45, // a merchant runs from any hunter this near it
  alongside: 5, // how far off your wing an informant flies while it tells you
  tell: 6, // seconds it flies alongside, telling you
  duel: 35, // seconds a rival fights you before it calls it a draw
  orbit: 10, // how far off you a rival circles
  range: 16, // anyone fires inside this
  fear: 60, // a faction an NPC fears, this near it, and it's off
  huntFrom: 50, // one it hunts, this near you, and it goes after it
  far: 150, // further than this from you…
  forget: 10, // …for this long, and it's let go of
  leaveFar: 90, // one leaving is gone once this far from you
  leaveFor: 14, // or after this long
  hold: 3, // under this speed you've cut your engines (an inspector's or a trickster's ask)
  scan: 5, // seconds held still before an inspector has scanned you (or a trickster has looked you over)
  patience: 14, // seconds an inspector waits for you to stop before it comes after you
  toll: 10, // and a trickster
  ignore: 40, // further off than this from one waiting on you, and you've run
  run: 12, // or faster than this for a moment (the boost, and more)
  wanted: 2.5, // heat (what you've shot down lately) at which an inspector's scan finds you wanted
  pass: 5, // seconds between a nemesis's passes
  jink: 1.4, // seconds in front of your nose before a nemesis jinks away
  summon: 0.6, // of its hull left, and a nemesis falls back and calls its friends in (its second phase)
  fallback: 12, // seconds it hangs back, firing from range, before it comes in again
  fury: 0.35, // of its hull left, and a nemesis throws everything at you (its third phase)
  retreat: 0.15, // of its hull left, and a nemesis breaks off
  nemesis: 90, // seconds a nemesis fights before it breaks off anyway
  dodge: 0.7, // how much of a shot's chance to land hard turning (and the boost) takes away, at most
  chatter: 22, // seconds between a tagalong's words
  tag: 95, // seconds a tagalong stays
  hide: 55, // how far off a tagalong runs from a fight
};

export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const add = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const unit = (a) => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
// your nose and your right, level (heading 0 is −z, as ship.js has it)
export const forwardOf = (s) => ({ x: -Math.sin(s.heading ?? 0), y: 0, z: -Math.cos(s.heading ?? 0) });
export const rightOf = (s) => ({ x: Math.cos(s.heading ?? 0), y: 0, z: -Math.sin(s.heading ?? 0) });
// your velocity, level, along your nose
export const velocityOf = (s) => {
  const f = forwardOf(s);
  const v = s.speed ?? 0;
  return { x: f.x * v, y: 0, z: f.z * v };
};
// the nearest of `list` (each with an `at`) to `p`, and how far
export function nearest(list, p, keep = () => true) {
  let best = null;
  let d = Infinity;
  for (const o of list ?? []) {
    if (!keep(o)) continue;
    const k = apart(o.at, p);
    if (k < d) {
      d = k;
      best = o;
    }
  }
  return { it: best, d };
}
